import { prisma } from '../database/prisma';
import { Prisma } from '@prisma/client';
import { storageService } from './storage.service';

export interface CertidaoDef {
  id: string;
  tipoDb: string;
  nome: string;
  orgao: string;
  esfera: 'FEDERAL' | 'ESTADUAL' | 'MUNICIPAL' | 'TRABALHISTA' | 'JUDICIAL';
  urlEmissao: string;
  urlValidacao: string;
}

export const CERTIDOES_CATALOGO: CertidaoDef[] = [
  {
    id: 'cnd-federal',
    tipoDb: 'CND Federal',
    nome: 'Certidão Negativa de Débitos Relativos a Créditos Tributários Federais e à Dívida Ativa da União',
    orgao: 'Receita Federal do Brasil / Procuradoria-Geral da Fazenda Nacional (PGFN)',
    esfera: 'FEDERAL',
    urlEmissao: 'https://solucoes.receita.fazenda.gov.br/Servicos/certidaointernet/PJ/Emitir',
    urlValidacao: 'https://solucoes.receita.fazenda.gov.br/Servicos/certidaointernet/PJ/Consultar',
  },
  {
    id: 'crf-fgts',
    tipoDb: 'FGTS',
    nome: 'CRF - Certificado de Regularidade do FGTS',
    orgao: 'Caixa Econômica Federal',
    esfera: 'FEDERAL',
    urlEmissao: 'https://consulta-crf.caixa.gov.br/consultacrf/pages/consultaEmpregador.jsf',
    urlValidacao: 'https://consulta-crf.caixa.gov.br/consultacrf/pages/consultaEmpregador.jsf',
  },
  {
    id: 'cndt-tst',
    tipoDb: 'CNDT',
    nome: 'Certidão Negativa de Débitos Trabalhistas (CNDT)',
    orgao: 'Tribunal Superior do Trabalho (TST) / CSJT',
    esfera: 'TRABALHISTA',
    urlEmissao: 'https://cndt-certidao.tst.jus.br/inicio.faces',
    urlValidacao: 'https://cndt-certidao.tst.jus.br/inicio.faces',
  },
  {
    id: 'cnd-falencia',
    tipoDb: 'Falência e Concordata',
    nome: 'Certidão Negativa de Falência, Concordata e Recuperação Judicial',
    orgao: 'Tribunal de Justiça do Estado (Comarca da Sede)',
    esfera: 'JUDICIAL',
    urlEmissao: 'https://esaj.tjsp.jus.br/sco/abrirCadastro.do',
    urlValidacao: 'https://esaj.tjsp.jus.br/sco/abrirAutenticidade.do',
  },
  {
    id: 'cnd-estadual',
    tipoDb: 'CND Estadual',
    nome: 'Certidão Negativa de Débitos Tributários da Dívida Ativa do Estado (ICMS)',
    orgao: 'Secretaria da Fazenda e Planejamento Estadual / PGE',
    esfera: 'ESTADUAL',
    urlEmissao: 'https://www.dividaativa.pge.sp.gov.br/sc/pages/crda/emitirCrda.jsf',
    urlValidacao: 'https://www.dividaativa.pge.sp.gov.br/sc/pages/crda/consultarCrda.jsf',
  },
  {
    id: 'cnd-municipal',
    tipoDb: 'CND Municipal',
    nome: 'Certidão Negativa de Tributos Imobiliários e Mobiliários (ISS / Taxas)',
    orgao: 'Secretaria Municipal da Fazenda / Prefeitura da Sede',
    esfera: 'MUNICIPAL',
    urlEmissao: 'https://duc.prefeitura.sp.gov.br/certidoes/formas_anonimas.aspx',
    urlValidacao: 'https://duc.prefeitura.sp.gov.br/certidoes/formas_anonimas.aspx',
  },
];

export interface CertidaoViewItem {
  id: string;
  nome: string;
  orgao: string;
  esfera: 'FEDERAL' | 'ESTADUAL' | 'MUNICIPAL' | 'TRABALHISTA' | 'JUDICIAL';
  validade: string | null;
  diasParaVencer: number | null;
  status: 'VALIDA' | 'VENCENDO' | 'VENCIDA' | 'SEM_VALIDADE';
  regularidade?: 'REGULAR' | 'IRREGULAR' | 'NAO_IDENTIFICADA';
  urlEmissao: string | null;
  urlValidacao: string | null;
  documentoId?: string;
  arquivoUrl?: string;
  temArquivo: boolean;
}

export class CertidaoArquivoIndisponivelError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CertidaoArquivoIndisponivelError';
  }
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function matchesCertidao(value: string | undefined | null, certidao: CertidaoDef): boolean {
  if (!value) return false;
  const normalized = normalizeText(value);
  const aliases = [certidao.id, certidao.tipoDb, certidao.nome];
  if (certidao.id === 'cnd-federal') aliases.push('receita', 'pgfn', 'tributos federais', 'divida ativa da uniao', 'uniao', 'federal');
  if (certidao.id === 'crf-fgts') aliases.push('fgts', 'caixa', 'crf', 'regularidade do fgts');
  if (certidao.id === 'cndt-tst') aliases.push('trabalhista', 'cndt', 'tst', 'debitos trabalhistas', 'justica do trabalho');
  if (certidao.id === 'cnd-falencia') aliases.push('falencia', 'concordata', 'recuperacao judicial');
  if (certidao.id === 'cnd-estadual') aliases.push('estadual', 'icms', 'sefaz', 'divida ativa do estado', 'fazenda estadual');
  if (certidao.id === 'cnd-municipal') aliases.push('municipal', 'iss', 'prefeitura', 'tributos municipais', 'fazenda municipal');

  return aliases.some((alias) => normalized.includes(normalizeText(alias)));
}

function getCalendarDay(value: Date): number {
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}

function formatDate(value: Date): string {
  return new Date(
    value.getUTCFullYear(),
    value.getUTCMonth(),
    value.getUTCDate(),
  ).toLocaleDateString('pt-BR');
}

function isHttpUrl(value?: string | null): boolean {
  return Boolean(value && /^https?:\/\//i.test(value));
}

function isRegionalIssuer(certidao: CertidaoDef): boolean {
  return ['cnd-estadual', 'cnd-municipal', 'cnd-falencia'].includes(certidao.id);
}

function getOfficialRegularity(metadata: Prisma.JsonValue | null): CertidaoViewItem['regularidade'] {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return undefined;
  const providerData = metadata.infosimples;
  if (!providerData || typeof providerData !== 'object' || Array.isArray(providerData)) return undefined;
  const regularidade = providerData.regularidade;
  return regularidade === 'REGULAR' || regularidade === 'IRREGULAR' || regularidade === 'NAO_IDENTIFICADA'
    ? regularidade
    : undefined;
}

export class CertidoesService {
  /**
   * Lista as certidões obrigatórias da empresa vinculando aos documentos salvos no cofre
   */
  async listarCertidoes(userId: string, companyId?: string): Promise<CertidaoViewItem[]> {
    // 1. Busca empresa
    const company = await prisma.company.findFirst({
      where: companyId ? { id: companyId, userId } : { userId },
      orderBy: { createdAt: 'asc' },
    });

    // 2. Busca documentos da empresa
    if (!company) {
      return CERTIDOES_CATALOGO.map((item) => ({
        id: item.id,
        nome: item.nome,
        orgao: item.orgao,
        esfera: item.esfera,
        validade: null,
        diasParaVencer: null,
        status: 'SEM_VALIDADE',
        urlEmissao: null,
        urlValidacao: null,
        temArquivo: false,
      }));
    }

    const now = new Date();
    const [docsRaw, certificates] = await Promise.all([
      prisma.document.findMany({
        where: {
          userId,
          companyId: company.id,
        },
      }),
      prisma.companyCertificate.findMany({
        where: { companyId: company.id },
      }),
    ]);

    const docs = [...docsRaw].sort((a, b) => {
      const timeA = a.validade ? new Date(a.validade).getTime() : 0;
      const timeB = b.validade ? new Date(b.validade).getTime() : 0;
      return timeB - timeA;
    });

    const today = getCalendarDay(now);

    return CERTIDOES_CATALOGO.map((item) => {
      const doc = docs.find((document) =>
        matchesCertidao(document.tipo, item) || matchesCertidao(document.nome, item),
      );
      const certificate = certificates.find((entry) => matchesCertidao(entry.type, item));
      const expirationDate = doc?.validade && certificate?.expirationDate
        ? (doc.validade > certificate.expirationDate ? doc.validade : certificate.expirationDate)
        : (doc?.validade ?? certificate?.expirationDate ?? null);
      const daysRemaining = expirationDate
        ? Math.ceil((getCalendarDay(expirationDate) - today) / 86_400_000)
        : null;

      const status: CertidaoViewItem['status'] = daysRemaining === null
        ? 'SEM_VALIDADE'
        : daysRemaining < 0
          ? 'VENCIDA'
          : daysRemaining <= 15
            ? 'VENCENDO'
            : 'VALIDA';

      const downloadUrl = doc?.id
        ? `/api/v1/documentos/${doc.id}/download`
        : doc?.url || (certificate?.documentUrl && isHttpUrl(certificate.documentUrl) ? certificate.documentUrl : `/api/v1/certidoes/${item.id}/download`);

      return {
        id: item.id,
        nome: item.nome,
        orgao: item.orgao,
        esfera: item.esfera,
        validade: expirationDate ? formatDate(expirationDate) : null,
        diasParaVencer: daysRemaining,
        status,
        urlEmissao: isRegionalIssuer(item) && company.uf?.toUpperCase() !== 'SP'
          ? null
          : item.urlEmissao,
        urlValidacao: isRegionalIssuer(item) && company.uf?.toUpperCase() !== 'SP'
          ? null
          : item.urlValidacao,
        documentoId: doc?.id,
        arquivoUrl: downloadUrl,
        regularidade: getOfficialRegularity(certificate?.metadata ?? null),
        temArquivo: Boolean(
          doc?.id
          || doc?.storageKey
          || isHttpUrl(doc?.url)
          || isHttpUrl(certificate?.documentUrl),
        ),
      };
    });
  }

  /**
   * Obtém somente um arquivo de certidão armazenado pela empresa.
   */
  async obterArquivoCertidao(
    certidaoIdOuTipo: string,
    userId: string,
    companyId?: string
  ): Promise<{ buffer: Buffer; fileName: string; mimeType: string; redirectUrl?: string }> {
    const company = await prisma.company.findFirst({
      where: companyId ? { id: companyId, userId } : { userId },
      orderBy: { createdAt: 'asc' },
    });

    if (!company) {
      throw new CertidaoArquivoIndisponivelError(
        'Cadastre uma empresa antes de baixar documentos de certidões.',
      );
    }

    const certidaoDef =
      CERTIDOES_CATALOGO.find(
        (c) =>
          c.id.toLowerCase() === certidaoIdOuTipo.toLowerCase() ||
          c.tipoDb.toLowerCase() === certidaoIdOuTipo.toLowerCase()
      );

    if (!certidaoDef) {
      throw new CertidaoArquivoIndisponivelError('Tipo de certidão não reconhecido.');
    }

    const [doc, certificates] = await Promise.all([
      prisma.document.findFirst({
        where: {
          userId,
          companyId: company.id,
          OR: [
            { tipo: { contains: certidaoDef.tipoDb, mode: 'insensitive' } },
            { nome: { contains: certidaoDef.id, mode: 'insensitive' } },
            { nome: { contains: certidaoDef.tipoDb, mode: 'insensitive' } },
          ],
        },
        select: { id: true, storageKey: true, url: true, fileMimeType: true, arquivoNome: true },
      }),
      prisma.companyCertificate.findMany({
        where: { companyId: company.id },
      }),
    ]);

    const certificate = certificates.find((entry) => matchesCertidao(entry.type, certidaoDef));

    if (doc?.storageKey) {
      const presignedUrl = await storageService.getPresignedDownloadUrl(doc.storageKey);
      if (presignedUrl.startsWith('http://') || presignedUrl.startsWith('https://')) {
        return {
          buffer: Buffer.alloc(0),
          fileName: doc.arquivoNome || certidaoDef.id,
          mimeType: doc.fileMimeType || 'application/octet-stream',
          redirectUrl: presignedUrl,
        };
      }

      const fileContent = await storageService.getFileBuffer(doc.storageKey);
      return {
        buffer: fileContent.buffer,
        fileName: doc.arquivoNome || certidaoDef.id,
        mimeType: doc.fileMimeType || fileContent.mimeType || 'application/octet-stream',
      };
    }

    if (doc && isHttpUrl(doc.url)) {
      return {
        buffer: Buffer.alloc(0),
        fileName: doc.arquivoNome || certidaoDef.id,
        mimeType: doc.fileMimeType || 'application/octet-stream',
        redirectUrl: doc.url || undefined,
      };
    }

    if (certificate && isHttpUrl(certificate.documentUrl)) {
      return {
        buffer: Buffer.alloc(0),
        fileName: certidaoDef.id,
        mimeType: 'application/octet-stream',
        redirectUrl: certificate.documentUrl || undefined,
      };
    }

    throw new CertidaoArquivoIndisponivelError(
      'Nenhum arquivo desta certidão está salvo no cofre da empresa. Acesse o portal emissor e envie o documento.',
    );
  }

}

export const certidoesService = new CertidoesService();
