import axios from 'axios';
import { createHash } from 'crypto';
import { prisma } from '../database/prisma';
import { parsePncpControlNumber } from './pncp.service';

/**
 * Monta o texto de escopo real estrito para editais sem PDF ou sem texto extraível no PNCP.
 * Proíbe o LLM de presumir ou inventar cláusulas, fixando a auditoria jurídica no registro oficial.
 */
export function buildFallbackNoticeScope(notice: any): string {
  const raw = (notice?.rawPayload || {}) as any;
  const objeto = notice?.object || raw?.objetoCompra || 'Objeto não especificado no registro do PNCP.';
  const informacaoComplementar =
    raw?.informacaoComplementar ||
    notice?.metadata?.informacaoComplementar ||
    'Nenhuma informação complementar adicional registrada pelo órgão no PNCP.';
  const amparoLegal =
    notice?.amparoLegal ||
    raw?.amparoLegal?.nome ||
    raw?.amparoLegal ||
    'Lei Federal nº 14.133/2021';
  const modoDisputa =
    notice?.modoDisputa ||
    raw?.modoDisputaNome ||
    raw?.modoDisputa ||
    'Conforme edital oficial';

  return [
    '================================================================================',
    'AVISO DE ESCOPO REAL — TEXTO INTEGRAL DO EDITAL NÃO DISPONIBILIZADO EM PDF NO PNCP',
    '================================================================================',
    'O órgão licitante não disponibilizou o arquivo do Edital em PDF com texto pesquisável na API do PNCP (ou o anexo cadastrado é imagem/arquivo comprimido).',
    'A análise jurídica, fundamentação e auditoria devem limitar-se ESTRITAMENTE aos dados oficiais registrados no PNCP abaixo.',
    'É EXPRESSAMENTE PROIBIDO inventar, presumir ou alucinar cláusulas, penalidades, exigências habilitatórias ou regras que não constem deste registro oficial.',
    '',
    `• Objeto Oficial: ${objeto}`,
    `• Informação Complementar: ${informacaoComplementar}`,
    `• Amparo Legal: ${amparoLegal}`,
    `• Modo de Disputa: ${modoDisputa}`,
  ].join('\n');
}

/**
 * Faz a extração do texto do PDF do Edital usando a API do PNCP para baixar o anexo principal.
 * Suporta busca por UUID no banco, externalId (numeroControlePNCP), reaproveitamento de chunks
 * salvos e fallback com aviso de escopo real estrito para proteger contra alucinações.
 */
export async function preencherTextoEditalAutomaticamente(edital_id: string): Promise<string> {
  const cleanId = String(edital_id || '').trim();
  if (!cleanId) return '';

  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cleanId);
    let notice: any = null;

    // 1. Primeiro verifica se edital_id é um UUID no prisma.procurementNotice;
    // se for, recupera o externalId (numeroControlePNCP) antes de fazer o parse
    if (isUuid) {
      notice = await prisma.procurementNotice.findUnique({
        where: { id: cleanId },
      });
    }

    if (!notice) {
      notice = await prisma.procurementNotice.findFirst({
        where: {
          OR: [
            { externalId: cleanId },
            { dedupeKey: `pncp-${cleanId}` },
            { dedupeKey: cleanId },
            { noticeNumber: cleanId },
          ],
        },
      });
    }

    const targetNoticeId = notice?.id || cleanId;
    const lookupIds = [targetNoticeId];
    if (cleanId !== targetNoticeId) {
      lookupIds.push(cleanId);
    }
    if (notice?.externalId && !lookupIds.includes(notice.externalId)) {
      lookupIds.push(notice.externalId);
    }

    // 2. Salve os trechos na tabela de contexto/chunks do edital para evitar downloads repetidos:
    // Se já existem chunks salvos, retorna o texto concatenado
    const existingChunks = await prisma.documentChunk.findMany({
      where: {
        sourceType: 'procurement_notice',
        sourceId: { in: lookupIds },
      },
      orderBy: { chunkIndex: 'asc' },
      take: 15,
      select: { content: true },
    });

    if (existingChunks.length > 0) {
      return existingChunks.map((c) => c.content).join('\n\n');
    }

    // Verifica se já temos texto extraído na tabela ProcurementAttachment
    if (notice?.id) {
      const existingAttachment = await prisma.procurementAttachment.findFirst({
        where: {
          procurementNoticeId: notice.id,
          extractedText: { not: null },
        },
        select: { extractedText: true },
      });
      if (existingAttachment?.extractedText && existingAttachment.extractedText.length > 50) {
        return existingAttachment.extractedText;
      }
    }

    // 3. Extrai { cnpj, ano, sequencial } via parsePncpControlNumber
    const rawExternalId = notice?.externalId || (notice?.rawPayload as any)?.numeroControlePNCP || cleanId;
    const parsed = parsePncpControlNumber(rawExternalId);

    let cnpj = parsed?.cnpj;
    let ano = parsed?.ano ? String(parsed.ano) : '';
    let sequencial = parsed?.sequencial ? String(parsed.sequencial) : '';

    if (!cnpj && notice?.rawPayload) {
      const raw = notice.rawPayload as any;
      cnpj = (raw.orgaoEntidade?.cnpj || notice.buyerDocument || '').replace(/\D/g, '');
      ano = String(raw.anoCompra || '');
      sequencial = String(Number(raw.sequencialCompra || ''));
    }

    if (!cnpj || !ano || !sequencial || sequencial === 'NaN') {
      console.warn('[PNCP Parser] Não foi possível extrair parâmetros PNCP para:', cleanId);
      return buildFallbackNoticeScope(notice);
    }

    const PNCP_BASE = process.env.PNCP_FILES_BASE_URL || 'https://pncp.gov.br/api/pncp/v1';

    // 4. Consulta https://pncp.gov.br/api/pncp/v1/orgaos/${cnpj}/compras/${ano}/${sequencial}/arquivos
    const urlArquivos = `${PNCP_BASE}/orgaos/${cnpj}/compras/${ano}/${sequencial}/arquivos`;
    let arquivos: any[] = [];
    try {
      const responseLista = await axios.get(urlArquivos, {
        headers: { Accept: 'application/json' },
        timeout: 20000,
      });
      arquivos = Array.isArray(responseLista.data) ? responseLista.data : [];
    } catch (listErr: any) {
      console.warn('[PNCP Parser] Falha ao consultar lista de arquivos no PNCP:', listErr.message);
      return buildFallbackNoticeScope(notice);
    }

    if (arquivos.length === 0) {
      console.warn('[PNCP Parser] Nenhum arquivo disponível no PNCP para a compra:', cleanId);
      return buildFallbackNoticeScope(notice);
    }

    // 5. Prioriza o download do arquivo cujo tipoDocumentoNome ou titulo contenha "Edital" ou "Termo de Referência" (ou primeiro ativo)
    const editalArquivo =
      arquivos.find((a: any) => {
        const tipo = String(a.tipoDocumentoNome || a.tipo_documento_nome || '').toLowerCase();
        const titulo = String(a.titulo || a.nome || '').toLowerCase();
        return (
          tipo.includes('edital') ||
          titulo.includes('edital') ||
          tipo.includes('termo de refer') ||
          titulo.includes('termo de refer')
        );
      }) ||
      arquivos.find((a: any) => a.statusAtivo !== false) ||
      arquivos[0];

    const seqArquivo = editalArquivo.sequencialArquivo || editalArquivo.sequencial || 1;
    const urlArquivoPDF = `${PNCP_BASE}/orgaos/${cnpj}/compras/${ano}/${sequencial}/arquivos/${seqArquivo}`;

    // 6. Faz o download dos bytes do arquivo
    let docBuffer: Buffer | null = null;
    try {
      const docRes = await axios.get(urlArquivoPDF, {
        responseType: 'arraybuffer',
        timeout: 25000,
      });
      docBuffer = Buffer.from(docRes.data);
    } catch (downErr: any) {
      console.warn('[PNCP Parser] Falha ao baixar bytes do arquivo no PNCP:', downErr.message);
      return buildFallbackNoticeScope(notice);
    }

    // 7. Extrai texto real com pdf-parse
    let extractedText = '';
    try {
      let pdfParseModule: any;
      try {
        pdfParseModule = (await import('pdf-parse')).default;
      } catch {
        pdfParseModule = require('pdf-parse');
      }
      const pdfFn = typeof pdfParseModule === 'function' ? pdfParseModule : pdfParseModule?.default || pdfParseModule;
      const pdfData = await pdfFn(docBuffer);
      extractedText = (pdfData?.text || '').trim();
    } catch (pdfErr: any) {
      console.warn('[PNCP Parser] Arquivo sem texto pesquisável ou formato inválido:', pdfErr.message);
    }

    // 8. Caso o órgão não tenha enviado PDF para o PNCP ou o arquivo seja um ZIP/imagem sem texto extraível:
    if (!extractedText || extractedText.length < 50) {
      console.warn('[PNCP Parser] Arquivo sem texto extraível (ZIP/imagem). Aplicando aviso de escopo real.');
      return buildFallbackNoticeScope(notice);
    }

    // 9. Salva os trechos na tabela de contexto/chunks do edital para evitar downloads repetidos
    const chunkSize = 1800;
    const chunkOverlap = 200;
    const chunks: string[] = [];
    for (let i = 0; i < extractedText.length && chunks.length < 15; i += (chunkSize - chunkOverlap)) {
      const part = extractedText.slice(i, i + chunkSize).trim();
      if (part) chunks.push(part);
    }

    const sourceIdToSave = notice?.id || cleanId;
    try {
      await prisma.documentChunk.deleteMany({
        where: {
          sourceType: 'procurement_notice',
          sourceId: sourceIdToSave,
        },
      });

      await prisma.documentChunk.createMany({
        data: chunks.map((chunk, index) => ({
          tenantId: notice?.tenantId ?? null,
          sourceType: 'procurement_notice',
          sourceId: sourceIdToSave,
          chunkIndex: index,
          contentHash: createHash('sha256').update(chunk).digest('hex'),
          content: chunk,
          tokenCount: Math.ceil(chunk.length / 4),
          metadata: {
            fileName: editalArquivo.titulo || 'Edital.pdf',
            fileUrl: urlArquivoPDF,
            cnpj,
            ano,
            sequencial,
            sequencialArquivo: seqArquivo,
          },
        })),
      });

      if (notice?.id) {
        await prisma.procurementAttachment.upsert({
          where: {
            procurementNoticeId_fileUrl: {
              procurementNoticeId: notice.id,
              fileUrl: urlArquivoPDF,
            },
          },
          create: {
            procurementNoticeId: notice.id,
            tenantId: notice.tenantId ?? null,
            source: 'pncp',
            externalId: String(seqArquivo),
            attachmentType: 'edital',
            fileName: editalArquivo.titulo || 'Edital.pdf',
            fileUrl: urlArquivoPDF,
            mimeType: 'application/pdf',
            extractedText: extractedText.slice(0, 50000),
            contentHash: createHash('sha256').update(extractedText.slice(0, 50000)).digest('hex'),
          },
          update: {
            extractedText: extractedText.slice(0, 50000),
            contentHash: createHash('sha256').update(extractedText.slice(0, 50000)).digest('hex'),
          },
        });
      }
    } catch (saveErr: any) {
      console.warn('[PNCP Parser] Falha ao persistir chunks no banco:', saveErr.message);
    }

    return extractedText;
  } catch (err: any) {
    console.error('[PNCP Parser] Falha na extração de texto do edital:', err.message);
    return '';
  }
}
