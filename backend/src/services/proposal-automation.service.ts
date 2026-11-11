
export interface EnrichedNoticeItem {
  id?: string;
  itemNumber: string;
  numeroItem: number | string;
  description: string;
  descricao: string;
  quantity: number;
  quantidade: number;
  unit: string;
  unidadeMedida: string;
  estimatedUnitValue: number | null;
  valorUnitarioEstimado: number | null;
  estimatedTotalValue: number | null;
  valorTotal: number | null;
  catalogoCodigo?: string | null;
  matched: boolean;
  catalogItem?: {
    id: string;
    nome: string;
    sku: string;
    codigoCatmat?: string | null;
    custoBase: number;
    precoMinimoLicitacao?: number | null;
    unidadeMedida: string;
  } | null;
  unitCost: number | null;
  custoBase: number | null;
  precoMinimoStopLoss: number | null;
  precoAlvo: number | null;
  margemLiquidaPercentual?: number | null;
  statusMargem?: string | null;
}

export interface SyncNoticeItemsResult {
  notice: any;
  items: EnrichedNoticeItem[];
  total: number;
  valorTotalItens: number;
  totalComMatch: number;
}

import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import ExcelJS from 'exceljs';
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import { prisma } from '../database/prisma';
import { calcularSimulacaoBdi } from './tax-bdi.service';
import { resolveAuthorizedCompany } from '../shared/middlewares/auth.middleware';
import { buscarItensPNCP, parsePncpControlNumber } from './pncp.service';
import { buscarLicitacaoPorIdOuControle } from './licitacoes.service';

export type ProposalExportFormat = 'docx' | 'xlsx';

export interface GenerateHydratedProposalInput {
  userId: string;
  companyId?: string;
  format?: ProposalExportFormat;
  pregaoId?: string;
  noticeId?: string;
  orgao?: string;
  objeto?: string;
  custoInsumos: number;
  despesasOperacionais?: number;
  margemLucroDesejada?: number;
  margemMinimaStopLoss?: number;
  bidAmount?: number;
  validadeDias?: number;
}

export interface GeneratedProposalDocument {
  buffer: Buffer;
  mimeType: string;
  filename: string;
}

function formatCurrencyBrl(value: number): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatCnpj(cnpj: string): string {
  const digits = (cnpj || '').replace(/\D/g, '');
  if (digits.length !== 14) return cnpj || 'Não informado';
  return digits.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    '$1.$2.$3/$4-$5',
  );
}

/**
 * Constrói em memória um template .docx contendo as tags {{...}}
 * para ser processado e hidratado pelo motor docxtemplater + pizzip.
 */
async function buildDocxTemplateBuffer(): Promise<Buffer> {
  const borderCell = {
    top: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
    bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
    left: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
    right: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
  };

  function makeRow(label: string, tag: string, highlight = false): TableRow {
    return new TableRow({
      children: [
        new TableCell({
          borders: borderCell,
          shading: highlight
            ? { fill: '0A2540', type: ShadingType.CLEAR, color: 'auto' }
            : { fill: 'F8FAFC', type: ShadingType.CLEAR, color: 'auto' },
          width: { size: 60, type: WidthType.PERCENTAGE },
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: label,
                  bold: true,
                  size: 20,
                  color: highlight ? 'FFFFFF' : '0A2540',
                }),
              ],
            }),
          ],
        }),
        new TableCell({
          borders: borderCell,
          shading: highlight
            ? { fill: '0A2540', type: ShadingType.CLEAR, color: 'auto' }
            : undefined,
          width: { size: 40, type: WidthType.PERCENTAGE },
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [
                new TextRun({
                  text: tag,
                  bold: highlight,
                  size: 20,
                  color: highlight ? 'FFFFFF' : '1E293B',
                }),
              ],
            }),
          ],
        }),
      ],
    });
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 },
            children: [
              new TextRun({
                text: 'PROPOSTA COMERCIAL E DEMONSTRATIVO DE BDI / IVA DUAL',
                bold: true,
                size: 28,
                color: '0A2540',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 300 },
            children: [
              new TextRun({
                text: 'Documento Oficial Gerado em Tempo Real — Lei Federal nº 14.133/2021 e EC nº 132/2023',
                italics: true,
                size: 18,
                color: '475569',
              }),
            ],
          }),

          // 1. IDENTIFICAÇÃO DA LICITANTE
          new Paragraph({
            spacing: { before: 200, after: 100 },
            children: [
              new TextRun({
                text: '1. IDENTIFICAÇÃO DA EMPRESA PROPONENTE',
                bold: true,
                size: 22,
                color: '0A2540',
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 60 },
            children: [
              new TextRun({ text: 'Razão Social: ', bold: true, size: 20 }),
              new TextRun({ text: '{{razao_social}}', size: 20 }),
            ],
          }),
          new Paragraph({
            spacing: { after: 60 },
            children: [
              new TextRun({ text: 'Nome Fantasia: ', bold: true, size: 20 }),
              new TextRun({ text: '{{nome_fantasia}}', size: 20 }),
            ],
          }),
          new Paragraph({
            spacing: { after: 60 },
            children: [
              new TextRun({ text: 'CNPJ: ', bold: true, size: 20 }),
              new TextRun({ text: '{{cnpj}}', size: 20 }),
            ],
          }),
          new Paragraph({
            spacing: { after: 60 },
            children: [
              new TextRun({ text: 'CNAE Principal: ', bold: true, size: 20 }),
              new TextRun({ text: '{{cnae_principal}}', size: 20 }),
            ],
          }),
          new Paragraph({
            spacing: { after: 60 },
            children: [
              new TextRun({ text: 'Endereço / Sede: ', bold: true, size: 20 }),
              new TextRun({ text: '{{endereco}}', size: 20 }),
            ],
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [
              new TextRun({ text: 'Representante / Contato: ', bold: true, size: 20 }),
              new TextRun({ text: '{{representante_nome}} ({{representante_email}} | {{representante_telefone}})', size: 20 }),
            ],
          }),

          // 2. DADOS DO CERTAME
          new Paragraph({
            spacing: { before: 150, after: 100 },
            children: [
              new TextRun({
                text: '2. DADOS DO CERTAME E OBJETO',
                bold: true,
                size: 22,
                color: '0A2540',
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 60 },
            children: [
              new TextRun({ text: 'Identificador da Disputa / Edital: ', bold: true, size: 20 }),
              new TextRun({ text: '{{pregao_id}}', size: 20 }),
            ],
          }),
          new Paragraph({
            spacing: { after: 60 },
            children: [
              new TextRun({ text: 'Órgão / Entidade Promotora: ', bold: true, size: 20 }),
              new TextRun({ text: '{{orgao}}', size: 20 }),
            ],
          }),
          new Paragraph({
            spacing: { after: 60 },
            children: [
              new TextRun({ text: 'Objeto da Contratação: ', bold: true, size: 20 }),
              new TextRun({ text: '{{objeto}}', size: 20 }),
            ],
          }),
          new Paragraph({
            spacing: { after: 220 },
            children: [
              new TextRun({ text: 'Validade da Proposta: ', bold: true, size: 20 }),
              new TextRun({ text: '{{validade_proposta}} dias corridos a contar da data de abertura.', size: 20 }),
            ],
          }),

          // 3. PLANILHA DE CUSTOS, BDI E SPLIT PAYMENT (IVA DUAL)
          new Paragraph({
            spacing: { before: 150, after: 120 },
            children: [
              new TextRun({
                text: '3. COMPOSIÇÃO DE PREÇOS, BDI E RETENÇÃO SPLIT PAYMENT (IVA DUAL)',
                bold: true,
                size: 22,
                color: '0A2540',
              }),
            ],
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              makeRow('Custo Direto de Insumos e Materiais', 'R$ {{custo_insumos}}'),
              makeRow('Despesas Operacionais e Indiretas', 'R$ {{despesas_operacionais}}'),
              makeRow('Custo Total Base de Execução', 'R$ {{custo_total}}'),
              makeRow('Retenção Split Payment CBS — União ({{cbs_aliquota}}%)', 'R$ {{cbs_valor}}'),
              makeRow('Retenção Split Payment IBS — Estados/Municípios ({{ibs_aliquota}}%)', 'R$ {{ibs_valor}}'),
              makeRow('Total IVA Dual Retido na Fonte ({{iva_dual_aliquota}}%)', 'R$ {{iva_dual_total}}'),
              makeRow('Receita Líquida Pós-Split Payment', 'R$ {{receita_liquida_split}}'),
              makeRow('Margem Alvo Planejada / Margem Líquida Efetiva', '{{margem_desejada}}% / {{margem_liquida}}%'),
              makeRow('Resultado Líquido Operacional (Lucro Líquido)', 'R$ {{lucro_liquido}}'),
              makeRow('Piso Mínimo de Segurança (Stop-Loss Calculado)', 'R$ {{stop_loss_minimo}}'),
              makeRow('VALOR GLOBAL FINAL DA PROPOSTA COMERCIAL', 'R$ {{valor_total}}', true),
            ],
          }),

          // 4. DECLARAÇÃO DE EXEQUIBILIDADE E CONFORMIDADE
          new Paragraph({
            spacing: { before: 260, after: 120 },
            children: [
              new TextRun({
                text: '4. DECLARAÇÃO DE INTEGRALIDADE DOS CUSTOS (ART. 63, § 1º DA LEI 14.133/2021)',
                bold: true,
                size: 22,
                color: '0A2540',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: 280 },
            children: [
              new TextRun({
                text: 'A empresa {{razao_social}}, inscrita no CNPJ sob o nº {{cnpj}}, declara expressamente, sob as penas da Lei Federal nº 14.133/2021, que o valor global proposto de R$ {{valor_total}} compreende a integralidade dos custos para atendimento dos direitos trabalhistas assegurados na Constituição Federal, nas leis trabalhistas, nas normas infralegais, nas convenções coletivas de trabalho, bem como todos os tributos incidentes sob o regime de Split Payment (IVA Dual: CBS e IBS), encargos sociais, insumos e despesas operacionais.',
                size: 20,
              }),
            ],
          }),

          // 5. LOCAL, DATA E ASSINATURA
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing: { after: 360 },
            children: [
              new TextRun({
                text: '{{endereco}}, {{data_emissao}}.',
                size: 20,
                bold: true,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: '__________________________________________________________________',
                size: 20,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: '{{razao_social}} — CNPJ: {{cnpj}}',
                bold: true,
                size: 20,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: 'Representante Legal: {{representante_nome}}',
                size: 18,
                color: '475569',
              }),
            ],
          }),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer);
}

export class ProposalAutomationService {
  /**
   * Hidrata os dados reais da empresa logada no Prisma + cálculos tributários da Sala de Guerra
   * e gera em memória o arquivo .docx (via docxtemplater) ou .xlsx (via exceljs).
   */
  public async generateHydratedProposal(
    input: GenerateHydratedProposalInput,
  ): Promise<GeneratedProposalDocument> {
    const format: ProposalExportFormat = input.format === 'xlsx' ? 'xlsx' : 'docx';

    // 1. Busca dados reais da empresa e do usuário logado no banco de dados via Prisma
    const [company, user] = await Promise.all([
      resolveAuthorizedCompany(input.userId, input.companyId),
      prisma.user.findUnique({
        where: { id: input.userId },
        select: {
          id: true,
          nome: true,
          email: true,
          telefone: true,
        },
      }),
    ]);

    if (!company) {
      throw new Error('Empresa ativa não encontrada para o usuário autenticado.');
    }

    // 2. Se houver pregaoId ou noticeId, tenta enriquecer com dados reais do edital no Prisma
    const identifier = (input.noticeId || input.pregaoId || '').trim();
    let noticeRecord: {
      noticeNumber: string | null;
      buyerName: string | null;
      object: string | null;
      uf: string | null;
      municipality: string | null;
    } | null = null;

    if (identifier) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
      noticeRecord = await prisma.procurementNotice
        .findFirst({
          where: {
            OR: [
              ...(isUuid ? [{ id: identifier }] : []),
              { noticeNumber: { equals: identifier, mode: 'insensitive' } },
              { externalId: { equals: identifier, mode: 'insensitive' } },
            ],
          },
          select: {
            noticeNumber: true,
            buyerName: true,
            object: true,
            uf: true,
            municipality: true,
          },
        })
        .catch(() => null);
    }

    // 3. Executa o cálculo real de BDI, IVA Dual (CBS 11,3% + IBS 0,1%) e Stop-Loss
    const bdi = calcularSimulacaoBdi({
      custoInsumos: Number(input.custoInsumos) || 0,
      despesasOperacionais:
        input.despesasOperacionais !== undefined ? Number(input.despesasOperacionais) : undefined,
      margemLucroDesejada:
        input.margemLucroDesejada !== undefined ? Number(input.margemLucroDesejada) : 15,
      margemMinimaStopLoss:
        input.margemMinimaStopLoss !== undefined ? Number(input.margemMinimaStopLoss) : 5,
      bidAmount:
        input.bidAmount !== undefined && Number(input.bidAmount) > 0
          ? Number(input.bidAmount)
          : undefined,
    });

    const enderecoCompleto = [company.municipio, company.uf].filter(Boolean).join(' - ') || 'Brasil';
    const pregaoCodigo = noticeRecord?.noticeNumber || identifier || 'PREGAO-2026';
    const orgaoNome =
      input.orgao?.trim() ||
      noticeRecord?.buyerName ||
      'Órgão / Entidade da Administração Pública';
    const objetoDescricao =
      input.objeto?.trim() ||
      noticeRecord?.object ||
      `Fornecimento de bens/serviços conforme especificações do certame ${pregaoCodigo}`;
    const dataEmissao = new Date().toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
    const validadeProposta = Number(input.validadeDias) > 0 ? Number(input.validadeDias) : 60;

    // 4. Dicionário de tags hidratadas com dados reais do Prisma + Calculadora de Impostos
    const templateVariables = {
      razao_social: company.razaoSocial,
      nome_fantasia: company.nomeFantasia || company.razaoSocial,
      cnpj: formatCnpj(company.cnpj),
      cnae_principal: company.cnaePrincipal || 'Conforme Contrato Social / CNPJ',
      endereco: enderecoCompleto,
      municipio: company.municipio || 'Não informado',
      uf: company.uf || 'BR',
      representante_nome: user?.nome || company.razaoSocial,
      representante_email: user?.email || 'contato@empresa.com.br',
      representante_telefone: user?.telefone || 'Comercial',
      pregao_id: pregaoCodigo,
      edital_numero: pregaoCodigo,
      orgao: orgaoNome,
      objeto: objetoDescricao,
      data_emissao: dataEmissao,
      validade_proposta: String(validadeProposta),
      custo_insumos: formatCurrencyBrl(bdi.custoInsumos),
      despesas_operacionais: formatCurrencyBrl(bdi.despesasOperacionais),
      custo_total: formatCurrencyBrl(bdi.custoTotal),
      cbs_aliquota: bdi.aliquotas.cbsPercentual.toFixed(1).replace('.', ','),
      cbs_valor: formatCurrencyBrl(bdi.splitPayment.retencaoCbs),
      ibs_aliquota: bdi.aliquotas.ibsPercentual.toFixed(1).replace('.', ','),
      ibs_valor: formatCurrencyBrl(bdi.splitPayment.retencaoIbs),
      iva_dual_aliquota: bdi.aliquotas.ivaDualTotalPercentual.toFixed(1).replace('.', ','),
      iva_dual_total: formatCurrencyBrl(bdi.splitPayment.totalRetidoFonte),
      receita_liquida_split: formatCurrencyBrl(bdi.receitaLiquidaAposSplit),
      margem_desejada: Number(input.margemLucroDesejada ?? 15).toFixed(1).replace('.', ','),
      margem_liquida: bdi.margemLiquidaPercentual.toFixed(2).replace('.', ','),
      lucro_liquido: formatCurrencyBrl(bdi.lucroLiquido),
      stop_loss_minimo: formatCurrencyBrl(bdi.precoMinimoStopLoss),
      valor_total: formatCurrencyBrl(bdi.bidSimulado),
    };

    const safeSlug = pregaoCodigo.replace(/[^a-zA-Z0-9_-]/g, '_');

    if (format === 'xlsx') {
      const xlsxBuffer = await this.buildHydratedXlsxBuffer(
        templateVariables,
        bdi,
        Number(input.margemLucroDesejada ?? 15),
        Number(input.margemMinimaStopLoss ?? 5),
      );
      return {
        buffer: xlsxBuffer,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        filename: `Planilha_BDI_Proposta_${safeSlug}.xlsx`,
      };
    }

    // 5. Geração de .docx hidratado via docxtemplater + pizzip
    const rawTemplateBuffer = await buildDocxTemplateBuffer();
    const zip = new PizZip(rawTemplateBuffer);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: { start: '{{', end: '}}' },
    });

    doc.render(templateVariables);

    const hydratedDocxBuffer = doc.getZip().generate({
      type: 'nodebuffer',
      compression: 'DEFLATE',
    });

    return {
      buffer: hydratedDocxBuffer,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      filename: `Proposta_Comercial_${safeSlug}.docx`,
    };
  }

  /**
   * Gera a Planilha de Custos, BDI e Split Payment (.xlsx) em memória usando ExcelJS.
   */

  /**
   * Conecta os itens reais do edital no PNCP com a base do sistema,
   * cruzando com o Catálogo de Produtos da empresa para precificação determinística via BDI.
   */
  public async syncNoticeItemsWithCatalog(
    noticeId: string,
    companyId?: string,
    tenantId?: string,
    options?: {
      margemLucroDesejada?: number;
      margemMinimaStopLoss?: number;
      despesasOperacionais?: number;
    },
  ): Promise<SyncNoticeItemsResult> {
    const cleanId = String(noticeId || '').trim();
    if (!cleanId) {
      throw new Error('ID ou Número de Controle do edital obrigatório.');
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanId);

    // 1. Busca edital no banco local
    let notice = await prisma.procurementNotice.findFirst({
      where: {
        OR: [
          ...(isUuid ? [{ id: cleanId }] : []),
          { externalId: cleanId },
          { numeroControlePncp: cleanId },
          { dedupeKey: `pncp-${cleanId}` },
          { noticeNumber: cleanId },
        ],
      },
      include: {
        items: {
          orderBy: { itemNumber: 'asc' },
        },
      },
    });

    // Se não encontrou no banco local, busca e persiste via buscarLicitacaoPorIdOuControle
    if (!notice) {
      try {
        const fetched = await buscarLicitacaoPorIdOuControle(cleanId, { requirePersistence: true });
        const targetId = fetched?.databaseId || fetched?.id;
        if (targetId) {
          notice = await prisma.procurementNotice.findFirst({
            where: {
              OR: [
                { id: targetId },
                { externalId: fetched.numeroControlePNCP },
                { dedupeKey: `pncp-${fetched.numeroControlePNCP}` },
              ],
            },
            include: {
              items: {
                orderBy: { itemNumber: 'asc' },
              },
            },
          });
        }
      } catch (fetchErr) {
        console.warn('[syncNoticeItemsWithCatalog] Falha ao sincronizar edital remoto:', fetchErr);
      }
    }

    const parsed = parsePncpControlNumber(notice?.externalId || notice?.numeroControlePncp || cleanId);

    // 2. Se o edital não tiver itens no banco ou itens vazios, busca na API oficial do PNCP
    let rawItems: any[] = [];
    if (notice?.items && notice.items.length > 0) {
      rawItems = notice.items.map((it) => ({
        id: it.id,
        numeroItem: it.itemNumber,
        descricao: it.description,
        quantidade: it.quantity ? Number(it.quantity) : 1,
        unidadeMedida: it.unit || 'UN',
        valorUnitarioEstimado: it.estimatedUnitValue ? Number(it.estimatedUnitValue) : null,
        valorTotal: it.estimatedTotalValue ? Number(it.estimatedTotalValue) : null,
        catalogoCodigo: it.catalogoCodigo || null,
      }));
    } else if (parsed) {
      try {
        const pncpItems = await buscarItensPNCP(parsed.cnpj, parsed.ano, parsed.sequencial);
        if (pncpItems && pncpItems.length > 0) {
          rawItems = pncpItems;
          // Persiste os itens na tabela ProcurementItem vinculada ao ProcurementNotice
          if (notice?.id) {
            for (const it of pncpItems) {
              const itemNumber = String(it.numeroItem ?? 1);
              const desc = String(it.descricao ?? 'Item da contratação').trim();
              const qtd = Number(it.quantidade) > 0 ? Number(it.quantidade) : 1;
              const vUnit = Number(it.valorUnitarioEstimado) > 0 ? Number(it.valorUnitarioEstimado) : null;
              const vTot = Number(it.valorTotal) > 0 ? Number(it.valorTotal) : (vUnit ? vUnit * qtd : null);
              const unit = String(it.unidadeMedida ?? 'UN').trim();
              const catCod = it.codigoItemCatalogo ?? it.catalogoCodigo ?? null;

              await prisma.procurementItem.upsert({
                where: {
                  procurementNoticeId_itemNumber: {
                    procurementNoticeId: notice.id,
                    itemNumber,
                  },
                },
                create: {
                  procurementNoticeId: notice.id,
                  tenantId: tenantId ?? notice.tenantId ?? null,
                  itemNumber,
                  description: desc,
                  quantity: qtd,
                  unit,
                  estimatedUnitValue: vUnit,
                  estimatedTotalValue: vTot,
                  catalogoCodigo: catCod,
                  metadata: it,
                },
                update: {
                  description: desc,
                  quantity: qtd,
                  unit,
                  estimatedUnitValue: vUnit,
                  estimatedTotalValue: vTot,
                  catalogoCodigo: catCod,
                  metadata: it,
                },
              }).catch(() => null);
            }
          }
        }
      } catch (pncpErr) {
        console.warn('[syncNoticeItemsWithCatalog] Falha ao consultar itens no PNCP:', pncpErr);
      }
    }

    // 3. Busca catálogo de produtos da empresa ativa
    let catalogItems: any[] = [];
    let resolvedCompanyId = companyId;

    if (!resolvedCompanyId && tenantId) {
      const company = await prisma.company.findFirst({
        where: { tenantId },
        select: { id: true },
      });
      if (company) resolvedCompanyId = company.id;
    }

    if (resolvedCompanyId) {
      catalogItems = await prisma.catalogItem.findMany({
        where: {
          companyId: resolvedCompanyId,
          status: 'ATIVO',
        },
      });
    }

    // 4. Cruzamento inteligente de cada item com o Catálogo da empresa
    const margemDesejada = options?.margemLucroDesejada ?? 15;
    const margemMinima = options?.margemMinimaStopLoss ?? 5;
    let totalComMatch = 0;

    const enrichedItems: EnrichedNoticeItem[] = rawItems.map((it, idx) => {
      const itemNumber = String(it.numeroItem ?? it.itemNumber ?? idx + 1);
      const descricao = String(it.descricao ?? it.description ?? 'Item da contratação').trim();
      const quantidade = Number(it.quantidade ?? it.quantity ?? 1);
      const unidadeMedida = String(it.unidadeMedida ?? it.unit ?? 'UN').trim();
      const valorUnitarioEstimado =
        it.valorUnitarioEstimado != null && Number(it.valorUnitarioEstimado) > 0
          ? Number(it.valorUnitarioEstimado)
          : it.estimatedUnitValue != null && Number(it.estimatedUnitValue) > 0
          ? Number(it.estimatedUnitValue)
          : null;
      const valorTotal =
        it.valorTotal != null && Number(it.valorTotal) > 0
          ? Number(it.valorTotal)
          : it.estimatedTotalValue != null && Number(it.estimatedTotalValue) > 0
          ? Number(it.estimatedTotalValue)
          : valorUnitarioEstimado != null
          ? valorUnitarioEstimado * quantidade
          : null;
      const catalogoCodigo = it.catalogoCodigo ?? it.codigoItemCatalogo ?? null;

      const itDescLower = descricao.toLowerCase();
      const itCodeLower = String(catalogoCodigo || '').toLowerCase();

      // Cruzamento por CATMAT/CATSER, SKU ou Similaridade de Descrição
      const matchedCat = catalogItems.find((cat) => {
        const catMat = (cat.codigoCatmat || '').toLowerCase();
        const catSku = (cat.sku || '').toLowerCase();
        const catNome = (cat.nome || '').toLowerCase();

        if (catMat && itCodeLower && itCodeLower.includes(catMat)) return true;
        if (catMat && itDescLower.includes(catMat)) return true;
        if (catSku && itDescLower.includes(catSku)) return true;
        if (catNome.length >= 3 && (itDescLower.includes(catNome) || catNome.includes(itDescLower))) return true;
        return false;
      });

      let unitCost: number | null = null;
      let precoMinimoStopLoss: number | null = null;
      let precoAlvo: number | null = null;
      let margemLiquidaPercentual: number | null = null;
      let statusMargem: string | null = null;

      if (matchedCat) {
        totalComMatch++;
        unitCost =
          matchedCat.custoBase != null && Number(matchedCat.custoBase) > 0
            ? Number(matchedCat.custoBase)
            : matchedCat.precoMinimoLicitacao != null && Number(matchedCat.precoMinimoLicitacao) > 0
            ? Number(matchedCat.precoMinimoLicitacao)
            : null;

        if (unitCost != null && unitCost > 0) {
          const bdi = calcularSimulacaoBdi({
            custoInsumos: unitCost,
            despesasOperacionais: options?.despesasOperacionais,
            margemLucroDesejada: margemDesejada,
            margemMinimaStopLoss: margemMinima,
          });
          precoMinimoStopLoss = bdi.precoMinimoStopLoss;
          precoAlvo = bdi.precoSugeridoVenda;
          margemLiquidaPercentual = bdi.margemLiquidaPercentual;
          statusMargem = bdi.statusMargem;
        }
      } else if (valorUnitarioEstimado != null && valorUnitarioEstimado > 0) {
        precoAlvo = valorUnitarioEstimado;
      }

      return {
        id: it.id,
        itemNumber,
        numeroItem: Number(itemNumber) || itemNumber,
        description: descricao,
        descricao,
        quantity: quantidade,
        quantidade,
        unit: unidadeMedida,
        unidadeMedida,
        estimatedUnitValue: valorUnitarioEstimado,
        valorUnitarioEstimado,
        estimatedTotalValue: valorTotal,
        valorTotal,
        catalogoCodigo,
        matched: Boolean(matchedCat),
        catalogItem: matchedCat
          ? {
              id: matchedCat.id,
              nome: matchedCat.nome,
              sku: matchedCat.sku,
              codigoCatmat: matchedCat.codigoCatmat,
              custoBase: Number(matchedCat.custoBase) || 0,
              precoMinimoLicitacao: matchedCat.precoMinimoLicitacao ? Number(matchedCat.precoMinimoLicitacao) : null,
              unidadeMedida: matchedCat.unidadeMedida,
            }
          : null,
        unitCost,
        custoBase: unitCost,
        precoMinimoStopLoss,
        precoAlvo,
        margemLiquidaPercentual,
        statusMargem,
      };
    });

    const valorTotalItens = enrichedItems.reduce(
      (acc, it) => acc + (it.valorTotal || (it.valorUnitarioEstimado ? it.valorUnitarioEstimado * it.quantidade : 0)),
      0,
    );

    // Se o edital estava sem valor estimado global (sigiloso) e obtivemos o total dos itens, atualiza o edital
    if (notice?.id && (!notice.estimatedValue || Number(notice.estimatedValue) <= 0) && valorTotalItens > 0) {
      await prisma.procurementNotice.update({
        where: { id: notice.id },
        data: { estimatedValue: valorTotalItens },
      }).catch(() => null);
      (notice as any).estimatedValue = valorTotalItens;
    }

    return {
      notice,
      items: enrichedItems,
      total: enrichedItems.length,
      valorTotalItens,
      totalComMatch,
    };
  }

  private async buildHydratedXlsxBuffer(
    vars: Record<string, string>,
    bdi: ReturnType<typeof calcularSimulacaoBdi>,
    margemDesejadaPct: number,
    margemStopLossPct: number,
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Expertise Licitatória — Sala de Guerra';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Proposta e BDI (IVA Dual)', {
      views: [{ showGridLines: true }],
    });

    sheet.columns = [
      { header: 'Item / Rubrica', key: 'rubrica', width: 52 },
      { header: 'Alíquota / Parâmetro', key: 'parametro', width: 24 },
      { header: 'Valor Calculado (R$)', key: 'valor', width: 26 },
    ];

    // Cabeçalho Institucional
    sheet.mergeCells('A1:C1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'DEMONSTRATIVO DE FORMAÇÃO DE PREÇOS, BDI E PROPOSTA COMERCIAL';
    titleCell.font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0A2540' },
    };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getRow(1).height = 28;

    const addSectionHeader = (title: string) => {
      const row = sheet.addRow([title, '', '']);
      sheet.mergeCells(`A${row.number}:C${row.number}`);
      row.font = { bold: true, size: 11, color: { argb: 'FF0A2540' } };
      row.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE2E8F0' },
      };
      row.height = 22;
    };

    const addInfoRow = (label: string, val: string) => {
      const row = sheet.addRow([label, '', val]);
      sheet.mergeCells(`B${row.number}:C${row.number}`);
      row.getCell(1).font = { bold: true, size: 10, color: { argb: 'FF334155' } };
      row.getCell(2).font = { size: 10, color: { argb: 'FF0F172A' } };
      row.getCell(2).alignment = { horizontal: 'left' };
    };

    // Bloco 1: Dados da Empresa (Prisma)
    addSectionHeader('1. IDENTIFICAÇÃO DA EMPRESA LICITANTE (DADOS REAIS)');
    addInfoRow('Razão Social', vars.razao_social);
    addInfoRow('Nome Fantasia', vars.nome_fantasia);
    addInfoRow('CNPJ', vars.cnpj);
    addInfoRow('CNAE Principal', vars.cnae_principal);
    addInfoRow('Endereço / Sede', vars.endereco);
    addInfoRow('Representante Legal', `${vars.representante_nome} (${vars.representante_email})`);

    sheet.addRow([]);

    // Bloco 2: Dados do Certame
    addSectionHeader('2. DADOS DO CERTAME E DISPUTA');
    addInfoRow('ID da Disputa / Edital', vars.pregao_id);
    addInfoRow('Órgão Público', vars.orgao);
    addInfoRow('Objeto', vars.objeto);
    addInfoRow('Data de Emissão', vars.data_emissao);
    addInfoRow('Validade da Proposta', `${vars.validade_proposta} dias`);

    sheet.addRow([]);

    // Bloco 3: Planilha Financeira e Tributária (IVA Dual / Split Payment)
    addSectionHeader('3. COMPOSIÇÃO DE CUSTOS, IVA DUAL (SPLIT PAYMENT) E MARGEM');

    const tableHeader = sheet.addRow([
      'Componente de Custo / Tributação',
      'Referência / Alíquota',
      'Valor (R$)',
    ]);
    tableHeader.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    tableHeader.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' },
    };

    const addFinancialRow = (
      rubrica: string,
      referencia: string,
      valor: number,
      highlight = false,
    ) => {
      const row = sheet.addRow([rubrica, referencia, valor]);
      row.getCell(3).numFmt = '"R$" #,##0.00';
      row.getCell(2).alignment = { horizontal: 'center' };
      row.getCell(3).alignment = { horizontal: 'right' };

      if (highlight) {
        row.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFEA580C' },
        };
        row.height = 24;
      }
    };

    addFinancialRow('Custo Direto de Insumos / Materiais', 'Base Direta', bdi.custoInsumos);
    addFinancialRow('Despesas Operacionais e Indiretas', 'Custos Indiretos', bdi.despesasOperacionais);
    addFinancialRow('Custo Total Base de Execução', 'Soma Direto + Indireto', bdi.custoTotal);
    addFinancialRow(
      'Retenção Split Payment CBS (União)',
      `${bdi.aliquotas.cbsPercentual.toFixed(1)}%`,
      bdi.splitPayment.retencaoCbs,
    );
    addFinancialRow(
      'Retenção Split Payment IBS (Estados/Municípios)',
      `${bdi.aliquotas.ibsPercentual.toFixed(1)}%`,
      bdi.splitPayment.retencaoIbs,
    );
    addFinancialRow(
      'Total IVA Dual Retido na Fonte (Split Payment)',
      `${bdi.aliquotas.ivaDualTotalPercentual.toFixed(1)}%`,
      bdi.splitPayment.totalRetidoFonte,
    );
    addFinancialRow(
      'Receita Líquida Creditada Pós-Split Payment',
      'Valor Bruto - IVA Dual',
      bdi.receitaLiquidaAposSplit,
    );
    addFinancialRow(
      'Piso Mínimo Inviolável (Stop-Loss)',
      `Margem Mín. ${margemStopLossPct.toFixed(1)}%`,
      bdi.precoMinimoStopLoss,
    );
    addFinancialRow(
      'Preço Sugerido para Margem Alvo',
      `Margem Alvo ${margemDesejadaPct.toFixed(1)}%`,
      bdi.precoSugeridoVenda,
    );
    addFinancialRow(
      'Lucro Líquido Efetivo da Proposta',
      `Margem Real ${bdi.margemLiquidaPercentual.toFixed(2)}%`,
      bdi.lucroLiquido,
    );
    addFinancialRow(
      'VALOR GLOBAL FINAL DA PROPOSTA COMERCIAL',
      `Status: ${bdi.statusMargem}`,
      bdi.bidSimulado,
      true,
    );

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }
}

export const proposalAutomationService = new ProposalAutomationService();

