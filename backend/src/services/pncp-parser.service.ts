import axios from 'axios';
import { createHash } from 'crypto';
import { prisma } from '../database/prisma';
import { parsePncpControlNumber, buscarItensPNCP } from './pncp.service';
import { buscarLicitacaoPorIdOuControle } from './licitacoes.service';

export interface ArquivoOficialPncp {
  titulo: string;
  tipoDocumento: string;
  urlDownloadOficial: string;
  urlDownloadInterno: string;
  sequencial: number;
  tamanhoBytes?: number;
}

export interface ResultadoExtracaoEdital {
  text: string;
  sourceMode: 'PDF_ANEXO_REAL' | 'PDF_ESCANEADO_SEM_TEXTO' | 'APENAS_METADADOS_PNCP';
  arquivosOficiais: ArquivoOficialPncp[];
  chunks: string[];
}

export interface BufferArquivoOficialResultado {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  tamanhoBytes: number;
}

/**
 * Salva chunks de texto na tabela DocumentChunk vinculados ao edital.
 */
async function saveDocumentChunks(
  sourceId: string,
  tenantId: string | null | undefined,
  text: string,
  metadata: Record<string, any>,
): Promise<void> {
  const chunkSize = 1800;
  const chunkOverlap = 200;
  const chunks: string[] = [];
  for (let i = 0; i < text.length && chunks.length < 80; i += (chunkSize - chunkOverlap)) {
    const part = text.slice(i, i + chunkSize).trim();
    if (part) chunks.push(part);
  }
  if (chunks.length === 0 && text.trim()) {
    chunks.push(text.trim());
  }

  try {
    await prisma.documentChunk.deleteMany({
      where: {
        sourceType: 'procurement_notice',
        sourceId,
      },
    });

    await prisma.documentChunk.createMany({
      data: chunks.map((chunk, index) => {
        // Tenta identificar se o chunk tem marcador de página
        const matchPage = chunk.match(/\[Página\s+(\d+)\s+de\s+([^\]]+)\]/i);
        const chunkMeta = {
          ...metadata,
          pageNumber: matchPage ? matchPage[1] : metadata.pageNumber || null,
          fileName: matchPage ? matchPage[2].trim() : metadata.fileName || null,
        };

        return {
          tenantId: tenantId ?? null,
          sourceType: 'procurement_notice',
          sourceId,
          chunkIndex: index,
          contentHash: createHash('sha256').update(chunk).digest('hex'),
          content: chunk,
          tokenCount: Math.ceil(chunk.length / 4),
          metadata: chunkMeta,
        };
      }),
    });
  } catch (err: any) {
    console.warn('[PNCP Parser] Falha ao salvar chunks na tabela DocumentChunk:', err.message);
  }
}

/**
 * Monta o texto de escopo real estrito para editais sem PDF ou sem texto extraível no PNCP.
 * Proíbe o sistema de presumir ou inventar cláusulas, fixando a auditoria jurídica no registro oficial.
 */
export function buildFallbackNoticeScope(notice: any, rawItens: any[] = []): string {
  const raw = (notice?.rawPayload || {}) as any;
  const objeto = notice?.object || raw?.objetoCompra || raw?.objeto || 'Objeto não especificado no registro do PNCP.';
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
  const criterioJulgamento =
    notice?.judgmentCriterion ||
    raw?.criterioJulgamentoNome ||
    raw?.criterioJulgamento ||
    'Menor Preço / Maior Desconto';

  const itensList =
    Array.isArray(rawItens) && rawItens.length > 0
      ? rawItens
      : Array.isArray(notice?.items) && notice.items.length > 0
        ? notice.items
        : Array.isArray(raw?.itens) && raw.itens.length > 0
          ? raw.itens
          : [];

  const itensFormatados =
    itensList.length > 0
      ? itensList
        .map((it: any, idx: number) => {
          const num = it.itemNumber ?? it.numeroItem ?? idx + 1;
          const desc = it.description ?? it.descricao ?? 'Item da contratação';
          const qtd = Number(it.quantity ?? it.quantidade ?? 1);
          const un = it.unit ?? it.unidadeMedida ?? 'UN';
          const vUnit = Number(it.estimatedUnitValue ?? it.valorUnitarioEstimado) || null;
          const vTot =
            Number(it.estimatedTotalValue ?? it.valorTotal) ||
            (vUnit ? vUnit * qtd : null);
          const vTotStr = vTot != null && vTot > 0 ? ` | Valor Estimado: R$ ${vTot.toFixed(2)}` : '';
          return `• Item ${num}: ${desc} (Qtd: ${qtd} ${un}${vTotStr})`;
        })
        .join('\n')
      : '• Nenhum item individual cadastrado no registro do certame.';

  return [
    '================================================================================',
    'AVISO DE ESCOPO REAL — TEXTO INTEGRAL DO EDITAL NÃO DISPONIBILIZADO EM PDF NO PNCP',
    '================================================================================',
    'O órgão licitante não disponibilizou o arquivo do Edital em PDF com texto pesquisável na API do PNCP (ou o anexo cadastrado é imagem/arquivo comprimido).',
    'A análise jurídica, fundamentação e auditoria devem limitar-se ESTRITAMENTE aos dados oficiais registrados no PNCP abaixo.',
    'É EXPRESSAMENTE PROIBIDO inventar, presumir ou supor cláusulas, penalidades, exigências habilitatórias ou regras que não constem deste registro oficial.',
    '',
    `• Objeto Oficial: ${objeto}`,
    `• Informação Complementar: ${informacaoComplementar}`,
    `• Amparo Legal: ${amparoLegal}`,
    `• Modo de Disputa: ${modoDisputa}`,
    `• Critério de Julgamento: ${criterioJulgamento}`,
    '',
    '• Itens Registrados no PNCP:',
    itensFormatados,
  ].join('\n');
}

/**
 * Lê buffer PDF e extrai texto página por página preservando a identificação exata da página.
 */
async function parsePdfBufferComPaginas(buf: Buffer, fileName: string): Promise<{ text: string; numPages: number; isScanned: boolean }> {
  try {
    let pdfParseModule: any = require('pdf-parse');
    const pdfFn = typeof pdfParseModule === 'function' ? pdfParseModule : pdfParseModule?.default || pdfParseModule;

    // Configura renderizador de página para preservar [Página X de NOME_DO_ARQUIVO]
    const pagerender = (pageData: any) => {
      const renderOptions = {
        normalizeWhitespace: false,
        disableCombineTextItems: false,
      };

      return pageData.getTextContent(renderOptions).then((textContent: any) => {
        let lastY: any;
        let pageText = '';
        for (const item of textContent.items) {
          if (lastY === item.transform[5] || !lastY) {
            pageText += item.str;
          } else {
            pageText += '\n' + item.str;
          }
          lastY = item.transform[5];
        }

        const pageNum = pageData.pageIndex !== undefined ? pageData.pageIndex + 1 : (pageData.pageNumber || 1);
        return `\n\n[Página ${pageNum} de ${fileName}]\n` + pageText.trim();
      });
    };

    const pdfData = await pdfFn(buf, { pagerender });
    const fullText = String(pdfData?.text || '').trim();
    const numPages = Number(pdfData?.numpages || 1);
    const isScanned = numPages > 0 && fullText.replace(/\[Página \d+ de [^\]]+\]/g, '').trim().length < 150;

    return {
      text: fullText,
      numPages,
      isScanned,
    };
  } catch (err: any) {
    console.warn(`[PNCP Parser] Falha ao extrair texto com pdf-parse de ${fileName}:`, err.message);
    return { text: '', numPages: 0, isScanned: false };
  }
}

/**
 * Converte PDF escaneado (imagens) em texto legível utilizando leitura visual de IA (Gemini multimodal).
 */
async function parseVisualPdfEscaneadoComIa(buf: Buffer, fileName: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return '';

  try {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // Envia o PDF como inlineData
    // Limita tamanho para no máximo 15MB de buffer para segurança
    if (buf.length > 15 * 1024 * 1024) {
      console.warn(`[PNCP Parser] PDF escaneado ${fileName} é maior que 15MB, leitura visual limitada.`);
      return '';
    }

    const base64Data = buf.toString('base64');
    const prompt = `Você é um leitor óptico especialista em documentos de licitações públicas brasileiras.
Extraia fielmente TODO o texto visível das páginas deste documento PDF escaneado (${fileName}).
Para cada página do documento, inicie com a linha exata:
[Página X de ${fileName}]
seguida do texto integral transcrito.
NÃO resuma, NÃO omita valores, prazos, itens, exigências habilitatórias ou cláusulas.
Se uma página for ilegível, informe "[Página X de ${fileName} - Trecho ilegível no original]".`;

    const response = await model.generateContent([
      {
        inlineData: {
          data: base64Data,
          mimeType: 'application/pdf',
        },
      },
      prompt,
    ]);

    const visualText = String(response?.response?.text?.() || '').trim();
    if (visualText.length >= 100) {
      return visualText;
    }
    return '';
  } catch (aiErr: any) {
    console.warn(`[PNCP Parser] Falha na leitura visual IA de ${fileName}:`, aiErr.message);
    return '';
  }
}

/**
 * Extrai conteúdo de buffers com suporte a PDF, DOCX, XLSX e descompactação recursiva de ZIP.
 */
async function extrairBufferRecursivo(buf: Buffer, nome: string, depth = 0): Promise<string> {
  if (depth > 2) return '';
  const lower = nome.toLowerCase();

  // 1. PDF
  const isPdf = buf.slice(0, 4).toString() === '%PDF' || lower.endsWith('.pdf');
  if (isPdf) {
    const parsedPdf = await parsePdfBufferComPaginas(buf, nome);
    if (parsedPdf.text.length >= 150 && !parsedPdf.isScanned) {
      return parsedPdf.text;
    }

    // Se tiver páginas mas o leitor normal extraiu menos de 150 caracteres, aciona leitura visual
    if (parsedPdf.isScanned || (parsedPdf.text.length < 150 && parsedPdf.numPages > 0)) {
      console.log(`[PNCP Parser] PDF escaneado detectado em ${nome} (${parsedPdf.numPages} páginas). Acionando leitura visual...`);
      const textoVisual = await parseVisualPdfEscaneadoComIa(buf, nome);
      if (textoVisual && textoVisual.length >= 150) {
        return textoVisual;
      }
    }

    if (parsedPdf.text.length >= 30) {
      return parsedPdf.text;
    }
  }

  // 2. ZIP ou DOCX
  const isZipLike = buf.slice(0, 2).toString() === 'PK' || lower.endsWith('.docx') || lower.endsWith('.zip');
  if (isZipLike) {
    try {
      const PizZip = require('pizzip');
      const zip = new PizZip(buf);

      // Se for DOCX
      if (zip.files['word/document.xml']) {
        const xml = zip.files['word/document.xml'].asText();
        const docxText = xml
          .replace(/<w:p[^>]*>/g, '\n')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        return `\n[Documento Word: ${nome}]\n${docxText}`;
      }

      // Se for arquivo ZIP com vários documentos internos
      const parts: string[] = [];
      const entries = Object.keys(zip.files).sort();

      for (const entryName of entries) {
        const entry = zip.files[entryName];
        if (entry.dir) continue;

        const entryLower = entryName.toLowerCase();
        if (/\.(pdf|docx|txt|csv|xlsx)$/i.test(entryLower)) {
          const innerBuf = entry.asNodeBuffer();
          const innerTxt = await extrairBufferRecursivo(innerBuf, entryName, depth + 1);
          if (innerTxt && innerTxt.length >= 30) {
            parts.push(`=== ARQUIVO INTERNO DO PACOTE: ${entryName} ===\n${innerTxt}`);
          }
          if (parts.join('\n\n').length > 180000) break;
        }
      }

      if (parts.length > 0) {
        return parts.join('\n\n');
      }
    } catch (zipErr: any) {
      console.warn(`[PNCP Parser] Falha ao descompactar pacote ${nome}:`, zipErr.message);
    }
  }

  // 3. Texto simples ou CSV
  if (lower.endsWith('.txt') || lower.endsWith('.csv')) {
    try {
      return `\n[Arquivo: ${nome}]\n` + buf.toString('utf-8');
    } catch {
      return '';
    }
  }

  return '';
}

/**
 * Extrai { cnpj, ano, sequencial } dos identificadores do edital
 */
function extrairParametrosPncp(notice: any, cleanId: string): { cnpj: string; ano: string; sequencial: string } | null {
  const rawExternalId = notice?.externalId || (notice?.rawPayload as any)?.numeroControlePNCP || cleanId;
  const parsed =
    parsePncpControlNumber(notice?.externalId) ||
    parsePncpControlNumber(rawExternalId) ||
    parsePncpControlNumber(cleanId);

  let cnpj = parsed?.cnpj || '';
  let ano = parsed?.ano ? String(parsed.ano) : '';
  let sequencial = parsed?.sequencial ? String(parsed.sequencial) : '';

  if (!cnpj && notice?.rawPayload) {
    const raw = notice.rawPayload as any;
    cnpj = (raw.orgaoEntidade?.cnpj || notice.buyerDocument || '').replace(/\D/g, '');
    ano = String(raw.anoCompra || '');
    sequencial = String(Number(raw.sequencialCompra || ''));
  }

  if (cnpj && ano && sequencial && sequencial !== 'NaN') {
    return { cnpj, ano, sequencial };
  }
  return null;
}

/**
 * Obtém o buffer binário de um arquivo oficial publicado no PNCP para download direto dentro da Expertise.
 */
export async function obterBufferArquivoOficial(
  edital_id: string,
  sequencialArquivoAlvo?: number | string,
): Promise<BufferArquivoOficialResultado | null> {
  const cleanId = String(edital_id || '').trim();
  const PNCP_BASE = process.env.PNCP_FILES_BASE_URL || 'https://pncp.gov.br/api/pncp/v1';

  let notice = await prisma.procurementNotice.findFirst({
    where: {
      OR: [
        { id: cleanId.match(/^[0-9a-fA-F-]{36}$/) ? cleanId : undefined },
        { externalId: cleanId },
        { dedupeKey: `pncp-${cleanId}` },
        { dedupeKey: cleanId },
        { noticeNumber: cleanId },
      ].filter(Boolean) as any,
    },
  });

  if (!notice) {
    const fetched = await buscarLicitacaoPorIdOuControle(cleanId, { requirePersistence: true });
    if (fetched?.databaseId) {
      notice = await prisma.procurementNotice.findUnique({ where: { id: fetched.databaseId } });
    }
  }

  const params = extrairParametrosPncp(notice, cleanId);
  if (!params) return null;

  const { cnpj, ano, sequencial } = params;

  // Consulta lista de arquivos oficiais
  const urlLista = `${PNCP_BASE}/orgaos/${cnpj}/compras/${ano}/${sequencial}/arquivos`;
  let arquivos: any[] = [];
  try {
    const res = await axios.get(urlLista, { headers: { Accept: 'application/json' }, timeout: 15000 });
    arquivos = Array.isArray(res.data) ? res.data : [];
  } catch (err: any) {
    console.warn('[PNCP Parser] Erro ao consultar lista de arquivos para download:', err.message);
    return null;
  }

  if (arquivos.length === 0) return null;

  let arquivoAlvo = arquivos[0];

  if (sequencialArquivoAlvo && sequencialArquivoAlvo !== 'principal' && sequencialArquivoAlvo !== 'edital') {
    const seqNum = Number(sequencialArquivoAlvo);
    const encontrado = arquivos.find((a: any) => (a.sequencialArquivo || a.sequencial) === seqNum);
    if (encontrado) arquivoAlvo = encontrado;
  } else {
    // Seleciona o principal (Edital ou Termo de Referência)
    const scoreArquivo = (a: any) => {
      const txt = `${a.tipoDocumentoNome || a.tipo_documento_nome || ''} ${a.titulo || a.nome || ''}`.toLowerCase();
      if (txt.includes('edital')) return 4;
      if (txt.includes('termo de refer') || txt.includes('projeto b')) return 3;
      if (txt.includes('estudo t') || txt.includes('etp')) return 2;
      return 1;
    };
    arquivos.sort((a, b) => scoreArquivo(b) - scoreArquivo(a));
    arquivoAlvo = arquivos[0];
  }

  const seqArq = arquivoAlvo.sequencialArquivo || arquivoAlvo.sequencial || 1;
  const urlDownload = `${PNCP_BASE}/orgaos/${cnpj}/compras/${ano}/${sequencial}/arquivos/${seqArq}`;

  try {
    const responseFile = await axios.get(urlDownload, {
      responseType: 'arraybuffer',
      timeout: 30000,
    });

    const buffer = Buffer.from(responseFile.data);
    let fileName = String(arquivoAlvo.titulo || arquivoAlvo.nome || 'edital.pdf').trim();
    if (!/\.[a-zA-Z0-9]+$/.test(fileName)) {
      fileName += '.pdf';
    }

    const mimeType = String(responseFile.headers['content-type'] || 'application/pdf');

    return {
      buffer,
      fileName,
      mimeType,
      tamanhoBytes: buffer.length,
    };
  } catch (downloadErr: any) {
    console.error(`[PNCP Parser] Falha ao baixar arquivo oficial ${urlDownload}:`, downloadErr.message);
    return null;
  }
}

/**
 * Faz a extração do texto do PDF/ZIP do Edital usando a API do PNCP para baixar todos os anexos.
 * Salva no banco de dados e aciona a ficha técnica profunda.
 */
export async function preencherTextoEditalAutomaticamente(edital_id: string): Promise<string> {
  const cleanId = String(edital_id || '').trim();
  if (!cleanId) return '';

  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cleanId);
    let notice: any = null;

    if (isUuid) {
      notice = await prisma.procurementNotice.findUnique({
        where: { id: cleanId },
        include: { items: { orderBy: { itemNumber: 'asc' } } },
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
        include: { items: { orderBy: { itemNumber: 'asc' } } },
      });
    }

    if (!notice) {
      try {
        const fetched = await buscarLicitacaoPorIdOuControle(cleanId, { requirePersistence: true });
        const targetId = fetched?.databaseId || fetched?.id;
        if (targetId) {
          notice = await prisma.procurementNotice.findFirst({
            where: {
              OR: [
                ...(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId) ? [{ id: targetId }] : []),
                { externalId: fetched.numeroControlePNCP },
                { dedupeKey: `pncp-${fetched.numeroControlePNCP}` },
              ],
            },
            include: { items: { orderBy: { itemNumber: 'asc' } } },
          });
        }
      } catch (fetchErr) {
        console.warn('[pncp-parser] Falha ao sincronizar edital remoto:', fetchErr);
      }
    }

    const targetNoticeId = notice?.id || cleanId;
    const lookupIds = [targetNoticeId];
    if (cleanId !== targetNoticeId) lookupIds.push(cleanId);
    if (notice?.externalId && !lookupIds.includes(notice.externalId)) lookupIds.push(notice.externalId);

    // Se já existem chunks de PDF real salvos, retorna o texto concatenado
    const existingChunks = await prisma.documentChunk.findMany({
      where: {
        sourceType: 'procurement_notice',
        sourceId: { in: lookupIds },
      },
      orderBy: { chunkIndex: 'asc' },
      take: 80,
      select: { content: true, metadata: true },
    });

    const hasRealPdfChunk = existingChunks.some((c: any) => !c?.metadata?.structuredFallback);
    if (existingChunks.length > 0 && hasRealPdfChunk) {
      return existingChunks.map((c) => c.content).join('\n\n');
    }

    const params = extrairParametrosPncp(notice, cleanId);

    // Função interna para gerar fallback estruturado
    const buildAndPersistFallback = async (): Promise<string> => {
      let itensParaEscopo = notice?.items || [];
      if ((!itensParaEscopo || itensParaEscopo.length === 0) && params) {
        try {
          const pncpItens = await buscarItensPNCP(params.cnpj, Number(params.ano), Number(params.sequencial));
          if (pncpItens && pncpItens.length > 0) {
            itensParaEscopo = pncpItens;
          }
        } catch (itemErr: any) {
          console.warn('[PNCP Parser] Falha ao consultar itens para escopo estruturado:', itemErr.message);
        }
      }

      const fallbackText = buildFallbackNoticeScope(notice, itensParaEscopo);
      await saveDocumentChunks(targetNoticeId, notice?.tenantId, fallbackText, {
        structuredFallback: true,
        fallbackReason: 'NO_SEARCHABLE_PDF',
        cnpj: params?.cnpj,
        ano: params?.ano,
        sequencial: params?.sequencial,
      });

      return fallbackText;
    };

    if (!params) {
      console.warn('[PNCP Parser] Não foi possível extrair parâmetros PNCP para:', cleanId);
      return await buildAndPersistFallback();
    }

    const { cnpj, ano, sequencial } = params;
    const PNCP_BASE = process.env.PNCP_FILES_BASE_URL || 'https://pncp.gov.br/api/pncp/v1';

    // Consulta lista completa de arquivos oficiais no PNCP
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
      return await buildAndPersistFallback();
    }

    if (arquivos.length === 0) {
      console.warn('[PNCP Parser] Nenhum arquivo disponível no PNCP para a compra:', cleanId);
      return await buildAndPersistFallback();
    }

    // Seleciona até 6 anexos prioritários (Edital, Termo de Referência, ETP, Minuta, Planilhas)
    const scoreArquivo = (a: any) => {
      const txt = `${a.tipoDocumentoNome || a.tipo_documento_nome || ''} ${a.titulo || a.nome || ''}`.toLowerCase();
      if (txt.includes('edital')) return 5;
      if (txt.includes('termo de refer') || txt.includes('projeto b')) return 4;
      if (txt.includes('estudo t') || txt.includes('etp')) return 3;
      if (txt.includes('minuta') || txt.includes('contrato')) return 2;
      if (txt.includes('planilha') || txt.includes('anexo')) return 1;
      return 0;
    };

    const candidatos = [...arquivos]
      .filter((a: any) => a.statusAtivo !== false)
      .sort((a: any, b: any) => scoreArquivo(b) - scoreArquivo(a))
      .slice(0, 6);
    if (candidatos.length === 0 && arquivos[0]) candidatos.push(arquivos[0]);

    const editalArquivo = candidatos[0];
    const seqArquivo = editalArquivo?.sequencialArquivo || editalArquivo?.sequencial || 1;
    const urlArquivoPDF = `${PNCP_BASE}/orgaos/${cnpj}/compras/${ano}/${sequencial}/arquivos/${seqArquivo}`;

    const textosAnexos: string[] = [];
    for (const arq of candidatos) {
      const seq = arq.sequencialArquivo || arq.sequencial || 1;
      const urlArq = `${PNCP_BASE}/orgaos/${cnpj}/compras/${ano}/${sequencial}/arquivos/${seq}`;
      const nomeArq = String(arq.titulo || arq.nome || 'anexo.pdf');

      try {
        const docRes = await axios.get(urlArq, { responseType: 'arraybuffer', timeout: 35000 });
        const txt = await extrairBufferRecursivo(Buffer.from(docRes.data), nomeArq);
        if (txt && txt.length >= 50) {
          textosAnexos.push(`=== ANEXO: ${nomeArq} ===\n${txt}`);
        }
      } catch (downErr: any) {
        console.warn(`[PNCP Parser] Falha ao baixar anexo ${nomeArq}:`, downErr.message);
      }
    }

    // Proteção de memória: limita texto total extraído a 250.000 caracteres
    const extractedText = textosAnexos.join('\n\n').slice(0, 250000);
    if (!extractedText || extractedText.length < 50) {
      console.warn('[PNCP Parser] Anexos sem texto extraível legível. Aplicando escopo estruturado.');
      return await buildAndPersistFallback();
    }

    // Salva chunks reais com identificação de arquivo e páginas
    await saveDocumentChunks(targetNoticeId, notice?.tenantId, extractedText, {
      sourceMode: 'PDF_ANEXO_REAL',
      fileName: editalArquivo.titulo || 'Edital.pdf',
      fileUrl: urlArquivoPDF,
      cnpj,
      ano,
      sequencial,
      sequencialArquivo: seqArquivo,
    });

    // Salva registro em ProcurementAttachment
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
          extractedText: extractedText.slice(0, 250000),
          contentHash: createHash('sha256').update(extractedText.slice(0, 250000)).digest('hex'),
        },
        update: {
          extractedText: extractedText.slice(0, 250000),
          contentHash: createHash('sha256').update(extractedText.slice(0, 250000)).digest('hex'),
        },
      });
    }

    // Atualiza a ficha técnica profunda (EditalDeepAnalyzerService)
    try {
      const { EditalDeepAnalyzerService } = require('./edital-deep-analyzer.service');
      await EditalDeepAnalyzerService.processarEditalPorId(targetNoticeId);
    } catch (deepErr: any) {
      console.warn('[PNCP Parser] Falha ao atualizar ficha profunda do edital:', deepErr.message);
    }

    return extractedText;
  } catch (err: any) {
    console.error('[PNCP Parser] Falha na extração de texto do edital:', err.message);
    return '';
  }
}

/**
 * Retorna o texto extraído, modo de fonte real e a lista completa de arquivos oficiais
 * com links seguros para download direto dentro da plataforma Expertise.
 */
export async function obterTextoEAnexosOficiais(edital_id: string): Promise<ResultadoExtracaoEdital> {
  const cleanId = String(edital_id || '').trim();
  const PNCP_BASE = process.env.PNCP_FILES_BASE_URL || 'https://pncp.gov.br/api/pncp/v1';

  let notice: any = null;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cleanId);
  if (isUuid) {
    notice = await prisma.procurementNotice.findUnique({
      where: { id: cleanId },
      include: { items: { orderBy: { itemNumber: 'asc' } } },
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
      include: { items: { orderBy: { itemNumber: 'asc' } } },
    });
  }

  const targetNoticeId = notice?.id || cleanId;
  const lookupIds = [targetNoticeId];
  if (cleanId !== targetNoticeId) lookupIds.push(cleanId);
  if (notice?.externalId && !lookupIds.includes(notice.externalId)) lookupIds.push(notice.externalId);

  const params = extrairParametrosPncp(notice, cleanId);
  let arquivosOficiais: ArquivoOficialPncp[] = [];

  if (params) {
    const { cnpj, ano, sequencial } = params;
    try {
      const urlArquivos = `${PNCP_BASE}/orgaos/${cnpj}/compras/${ano}/${sequencial}/arquivos`;
      const resLista = await axios.get(urlArquivos, {
        headers: { Accept: 'application/json' },
        timeout: 15000,
      });
      const rawArquivos = Array.isArray(resLista.data) ? resLista.data : [];
      arquivosOficiais = rawArquivos
        .filter((a: any) => a.statusAtivo !== false)
        .map((a: any) => {
          const seq = a.sequencialArquivo || a.sequencial || 1;
          return {
            titulo: String(a.titulo || a.nome || 'Anexo do Edital').trim(),
            tipoDocumento: String(a.tipoDocumentoNome || a.tipo_documento_nome || 'Documento Oficial').trim(),
            urlDownloadOficial: `${PNCP_BASE}/orgaos/${cnpj}/compras/${ano}/${sequencial}/arquivos/${seq}`,
            urlDownloadInterno: `/api/v1/notices/${encodeURIComponent(targetNoticeId)}/download-arquivo/${seq}`,
            sequencial: seq,
            tamanhoBytes: a.tamanhoBytes || a.tamanho || undefined,
          };
        });
    } catch (err: any) {
      console.warn('[PNCP Parser] Aviso ao consultar lista de anexos no PNCP:', err.message);
    }
  }

  // Consulta chunks existentes
  let existingChunks = await prisma.documentChunk.findMany({
    where: {
      sourceType: 'procurement_notice',
      sourceId: { in: lookupIds },
    },
    orderBy: { chunkIndex: 'asc' },
    take: 80,
    select: { content: true, metadata: true },
  });

  const hasRealPdfChunk = existingChunks.some((c: any) => !c?.metadata?.structuredFallback);

  // Se não tem chunks ou se só tinha fallback antigo mas temos arquivos oficiais, dispara extração real
  if (existingChunks.length === 0 || (!hasRealPdfChunk && arquivosOficiais.length > 0)) {
    await preencherTextoEditalAutomaticamente(cleanId);
    existingChunks = await prisma.documentChunk.findMany({
      where: {
        sourceType: 'procurement_notice',
        sourceId: { in: lookupIds },
      },
      orderBy: { chunkIndex: 'asc' },
      take: 80,
      select: { content: true, metadata: true },
    });
  }

  const fullText = existingChunks.map((c) => c.content).join('\n\n');
  const isFallbackText = fullText.includes('AVISO DE ESCOPO REAL — TEXTO INTEGRAL DO EDITAL NÃO DISPONIBILIZADO EM PDF');

  let sourceMode: ResultadoExtracaoEdital['sourceMode'] = 'APENAS_METADADOS_PNCP';
  if (!isFallbackText && fullText.trim().length >= 100) {
    sourceMode = 'PDF_ANEXO_REAL';
  } else if (arquivosOficiais.length > 0) {
    sourceMode = 'PDF_ESCANEADO_SEM_TEXTO';
  } else {
    sourceMode = 'APENAS_METADADOS_PNCP';
  }

  const cleanChunkTexts = existingChunks
    .map((c) => c.content)
    .filter((c) => !c.includes('AVISO DE ESCOPO REAL — TEXTO INTEGRAL DO EDITAL NÃO DISPONIBILIZADO EM PDF'));

  return {
    text: fullText,
    sourceMode,
    arquivosOficiais,
    chunks: cleanChunkTexts.length > 0 ? cleanChunkTexts : existingChunks.map((c) => c.content),
  };
}
