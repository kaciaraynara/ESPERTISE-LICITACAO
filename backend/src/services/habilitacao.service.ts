import PDFDocument from 'pdfkit';
import PizZip from 'pizzip';
import axios from 'axios';
import { prisma } from '../database/prisma';
import { storageService } from './storage.service';

export interface SefazUfLink {
  uf: string;
  nomeEstado: string;
  urlSefaz: string;
  urlTribunalJustica: string;
}

export const MAPA_ESTADOS_BRASIL: Record<string, SefazUfLink> = {
  AC: {
    uf: 'AC',
    nomeEstado: 'Acre',
    urlSefaz: 'https://sefazonline.sefaz.ac.gov.br/sefazonline/servlet/hcertidaonegativapdf',
    urlTribunalJustica: 'https://esaj.tjac.jus.br/sco/abrirCadastro.do',
  },
  AL: {
    uf: 'AL',
    nomeEstado: 'Alagoas',
    urlSefaz: 'https://www.sefaz.al.gov.br/certidoes',
    urlTribunalJustica: 'https://www.tjal.jus.br/certidoes/',
  },
  AP: {
    uf: 'AP',
    nomeEstado: 'Amapá',
    urlSefaz: 'https://www.sefaz.ap.gov.br/sate/seg/SEGf_AcessarFuncao.jsp?cdFuncao=SAT_077',
    urlTribunalJustica: 'https://www.tjap.jus.br/portal/certidoes/',
  },
  AM: {
    uf: 'AM',
    nomeEstado: 'Amazonas',
    urlSefaz: 'https://sistemas.sefaz.am.gov.br/certidao-negativa/emissao.do',
    urlTribunalJustica: 'https://consultasaj.tjam.jus.br/sco/abrirCadastro.do',
  },
  BA: {
    uf: 'BA',
    nomeEstado: 'Bahia',
    urlSefaz: 'https://www.sefaz.ba.gov.br/scripts/cadastro/certidao/certidao.asp',
    urlTribunalJustica: 'https://www.tjba.jus.br/certidaovirtual/',
  },
  CE: {
    uf: 'CE',
    nomeEstado: 'Ceará',
    urlSefaz: 'https://servicos.sefaz.ce.gov.br/internet/servicosonline/certidaonegativa/prep_certidao_neg.asp',
    urlTribunalJustica: 'https://esaj.tjce.jus.br/sco/abrirCadastro.do',
  },
  DF: {
    uf: 'DF',
    nomeEstado: 'Distrito Federal',
    urlSefaz: 'https://ww1.receita.fazenda.df.gov.br/cidadao/certidoes/Certidao_Negativa',
    urlTribunalJustica: 'https://pesquisa.tjdft.jus.br/certidao/',
  },
  ES: {
    uf: 'ES',
    nomeEstado: 'Espírito Santo',
    urlSefaz: 'https://internet.sefaz.es.gov.br/servicos/certidao_negativa/emissao.php',
    urlTribunalJustica: 'https://sistemas.tjes.jus.br/certidaonegativa/',
  },
  GO: {
    uf: 'GO',
    nomeEstado: 'Goiás',
    urlSefaz: 'https://portal.sefaz.go.gov.br/servicos/certidao-negativa',
    urlTribunalJustica: 'https://www.tjgo.jus.br/certidoes/',
  },
  MA: {
    uf: 'MA',
    nomeEstado: 'Maranhão',
    urlSefaz: 'https://sistemas1.sefaz.ma.gov.br/certidoes/',
    urlTribunalJustica: 'https://jurisconsult.tjma.jus.br/certidoes/',
  },
  MT: {
    uf: 'MT',
    nomeEstado: 'Mato Grosso',
    urlSefaz: 'https://www.sefaz.mt.gov.br/acessocidadao/certidao/emitir',
    urlTribunalJustica: 'https://www.tjmt.jus.br/servicos/certidoes/',
  },
  MS: {
    uf: 'MS',
    nomeEstado: 'Mato Grosso do Sul',
    urlSefaz: 'https://servicos.sefaz.ms.gov.br/certidao/',
    urlTribunalJustica: 'https://esaj.tjms.jus.br/sco/abrirCadastro.do',
  },
  MG: {
    uf: 'MG',
    nomeEstado: 'Minas Gerais',
    urlSefaz: 'https://www2.fazenda.mg.gov.br/sol/ctrl/SOL/CDT/SERVICO_001?ACTION=VISUALIZAR',
    urlTribunalJustica: 'https://rupe.tjmg.jus.br/rupe/servicos/certidao/',
  },
  PA: {
    uf: 'PA',
    nomeEstado: 'Pará',
    urlSefaz: 'https://app.sefa.pa.gov.br/emissao-certidao/certidao/inicio',
    urlTribunalJustica: 'https://www.tjpa.jus.br/servicos/certidoes/',
  },
  PB: {
    uf: 'PB',
    nomeEstado: 'Paraíba',
    urlSefaz: 'https://www.sefaz.pb.gov.br/servicos-virtuais/certidoes',
    urlTribunalJustica: 'https://app.tjpb.jus.br/certidao/',
  },
  PR: {
    uf: 'PR',
    nomeEstado: 'Paraná',
    urlSefaz: 'https://receita.pr.gov.br/servicos/certidao/',
    urlTribunalJustica: 'https://www.tjpr.jus.br/certidoes/',
  },
  PE: {
    uf: 'PE',
    nomeEstado: 'Pernambuco',
    urlSefaz: 'https://efisco.sefaz.pe.gov.br/sfi_trb_gcc/PRConsultarRegularidadeFiscal',
    urlTribunalJustica: 'https://www.tjpe.jus.br/certidao/',
  },
  PI: {
    uf: 'PI',
    nomeEstado: 'Piauí',
    urlSefaz: 'https://web.sefaz.pi.gov.br/certidao/',
    urlTribunalJustica: 'https://www.tjpi.jus.br/certidoes/',
  },
  RJ: {
    uf: 'RJ',
    nomeEstado: 'Rio de Janeiro',
    urlSefaz: 'https://www4.fazenda.rj.gov.br/certidao-fiscal-web/emitirCertidao.jsf',
    urlTribunalJustica: 'https://www.tjrj.jus.br/servicos/certidoes/',
  },
  RN: {
    uf: 'RN',
    nomeEstado: 'Rio Grande do Norte',
    urlSefaz: 'https://uvt.set.rn.gov.br/#/services/certidao-negativa-debitos',
    urlTribunalJustica: 'https://www.tjrn.jus.br/servicos/certidoes/',
  },
  RS: {
    uf: 'RS',
    nomeEstado: 'Rio Grande do Sul',
    urlSefaz: 'https://www.sefaz.rs.gov.br/Receita/CertidaoSituacaoFiscal.aspx',
    urlTribunalJustica: 'https://www.tjrs.jus.br/novo/processos-e-servicos/servicos-processuais/emissao-de-certidoes/',
  },
  RO: {
    uf: 'RO',
    nomeEstado: 'Rondônia',
    urlSefaz: 'https://portalcontribuinte.sefin.ro.gov.br/Publico/certidaoNegativa.jsp',
    urlTribunalJustica: 'https://certidao.tjro.jus.br/',
  },
  RR: {
    uf: 'RR',
    nomeEstado: 'Roraima',
    urlSefaz: 'https://sistemas.sefaz.rr.gov.br/certidao/',
    urlTribunalJustica: 'https://www.tjrr.jus.br/index.php/servicos/certidoes',
  },
  SC: {
    uf: 'SC',
    nomeEstado: 'Santa Catarina',
    urlSefaz: 'https://tributario.sef.sc.gov.br/servlet/hlogin',
    urlTribunalJustica: 'https://certeproc1g.tjsc.jus.br/',
  },
  SP: {
    uf: 'SP',
    nomeEstado: 'São Paulo',
    urlSefaz: 'https://www.dividaativa.pge.sp.gov.br/sc/pages/crda/emitirCrda.jsf',
    urlTribunalJustica: 'https://esaj.tjsp.jus.br/sco/abrirCadastro.do',
  },
  SE: {
    uf: 'SE',
    nomeEstado: 'Sergipe',
    urlSefaz: 'https://security.sefaz.se.gov.br/internet/certidao/emissaoCertidao.jsp',
    urlTribunalJustica: 'https://www.tjse.jus.br/portal/consultas/certidoes',
  },
  TO: {
    uf: 'TO',
    nomeEstado: 'Tocantins',
    urlSefaz: 'https://sistemas.sefaz.to.gov.br/certidao/',
    urlTribunalJustica: 'https://www.tjto.jus.br/certidoes/',
  },
};

export type SituacaoDocumento = 'PRONTO' | 'VENCE_EM_BREVE' | 'VENCIDO' | 'PENDENTE';

export interface ItemDocumentoHabilitacao {
  codigo: number;
  etapaNumero: 1 | 2 | 3 | 4;
  etapaNome: string;
  nome: string;
  descricao: string;
  orgaoEmissor: string;
  automatico: boolean;
  linkOficial?: string;
  exigePortalGoverno: boolean;
  situacao: SituacaoDocumento;
  situacaoTexto: string;
  dataValidade?: string | null;
  diasParaVencer?: number | null;
  arquivoUrl?: string | null;
  arquivoNome?: string | null;
  documentoId?: string | null;
}

export interface RespostaStatusHabilitacao {
  empresa: {
    id: string;
    razaoSocial: string;
    cnpj: string;
    cnpjFormatado: string;
    municipio: string;
    uf: string;
  };
  totalDocumentos: number;
  documentosProntos: number;
  documentosVencendo: number;
  documentosVencidos: number;
  documentosPendentes: number;
  percentualConcluido: number;
  itens: ItemDocumentoHabilitacao[];
}

export function formatarCnpj(cnpjBruto: string): string {
  const d = String(cnpjBruto || '').replace(/\D/g, '');
  if (d.length !== 14) return cnpjBruto;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`;
}

export function obterLinkMunicipal(municipio?: string | null, uf?: string | null): string {
  const cid = String(municipio || '').trim();
  const siglaUf = String(uf || '').trim().toUpperCase();
  if (!cid) {
    return 'https://www.google.com/search?q=certidao+negativa+tributos+municipais+prefeitura';
  }

  const cidNorm = cid.toLowerCase();
  if (cidNorm === 'sao paulo' || cidNorm === 'são paulo') {
    return 'https://duc.prefeitura.sp.gov.br/certidoes/formas_anonimas.aspx';
  }
  if (cidNorm === 'rio de janeiro') {
    return 'https://dief.rio.rj.gov.br/dief/asp/certidao/certidao.asp';
  }
  if (cidNorm === 'belo horizonte') {
    return 'https://fazenda.pbh.gov.br/certidoes/';
  }
  if (cidNorm === 'curitiba') {
    return 'https://certidoes.curitiba.pr.gov.br/';
  }
  if (cidNorm === 'fortaleza') {
    return 'https://portal.sefin.fortaleza.ce.gov.br/certidoes';
  }
  if (cidNorm === 'salvador') {
    return 'https://www.sefaz.salvador.ba.gov.br/Certidao';
  }
  if (cidNorm === 'brasilia' || cidNorm === 'brasília' || siglaUf === 'DF') {
    return 'https://ww1.receita.fazenda.df.gov.br/cidadao/certidoes/Certidao_Negativa';
  }

  return `https://www.google.com/search?q=certidao+negativa+debitos+municipais+prefeitura+${encodeURIComponent(cid)}+${siglaUf}`;
}

export class HabilitacaoService {
  /**
   * Avalia a situação e os dias para vencer de um documento
   */
  private calcularSituacao(validade?: Date | null): { situacao: SituacaoDocumento; texto: string; dias?: number } {
    if (!validade) {
      return { situacao: 'PRONTO', texto: 'Pronto (Permanente)' };
    }

    const agora = new Date();
    const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).getTime();
    const dataVal = new Date(validade.getFullYear(), validade.getMonth(), validade.getDate()).getTime();
    const diffDias = Math.ceil((dataVal - hoje) / (1000 * 60 * 60 * 24));

    if (diffDias < 0) {
      return { situacao: 'VENCIDO', texto: 'Vencido — precisa renovar', dias: diffDias };
    }
    if (diffDias <= 5) {
      return { situacao: 'VENCE_EM_BREVE', texto: `Vence em ${diffDias} ${diffDias === 1 ? 'dia' : 'dias'}`, dias: diffDias };
    }
    return { situacao: 'PRONTO', texto: `Pronto (Válido até ${validade.toLocaleDateString('pt-BR')})`, dias: diffDias };
  }

  /**
   * Identifica a empresa ativa do usuário
   */
  async obterEmpresaAtiva(userId: string, companyId?: string) {
    if (companyId && companyId !== 'default') {
      const emp = await prisma.company.findFirst({
        where: { id: companyId, userId },
      });
      if (emp) return emp;
    }

    const primeira = await prisma.company.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return primeira;
  }

  /**
   * Retorna os 13 documentos de habilitação organizados por etapa legal com situações em tempo real
   */
  async obterStatusDocumentos(userId: string, companyId?: string): Promise<RespostaStatusHabilitacao> {
    const empresa = await this.obterEmpresaAtiva(userId, companyId);
    if (!empresa) {
      throw new Error('EMPRESA_NAO_ENCONTRADA: Cadastre os dados da sua empresa antes de acessar os documentos.');
    }

    const uf = (empresa.uf || 'SP').toUpperCase().trim();
    const municipio = empresa.municipio || 'São Paulo';
    const configEstado = MAPA_ESTADOS_BRASIL[uf] || MAPA_ESTADOS_BRASIL['SP'];

    // Busca documentos salvos no banco para esta empresa
    const documentosDb = await prisma.document.findMany({
      where: { companyId: empresa.id },
      orderBy: { atualizadoEm: 'desc' },
    });

    const mapaDocsPorTipo: Record<string, any> = {};
    for (const doc of documentosDb) {
      const tipoNorm = String(doc.tipo || '').toLowerCase();
      if (!mapaDocsPorTipo[tipoNorm]) {
        mapaDocsPorTipo[tipoNorm] = doc;
      }
    }

    const listaBase: Array<{
      codigo: number;
      etapaNumero: 1 | 2 | 3 | 4;
      etapaNome: string;
      nome: string;
      descricao: string;
      orgaoEmissor: string;
      automatico: boolean;
      tipoChave: string;
      linkOficial?: string;
      exigePortalGoverno: boolean;
    }> = [
      // Etapa 1 — Documentos da Empresa (Habilitação Jurídica)
      {
        codigo: 1,
        etapaNumero: 1,
        etapaNome: 'Etapa 1 — Documentos da Empresa (Habilitação Jurídica)',
        nome: 'Comprovante do CNPJ',
        descricao: 'Comprovante de Inscrição e Situação Cadastral emitido com dados oficiais da Receita Federal.',
        orgaoEmissor: 'Receita Federal do Brasil',
        automatico: true,
        tipoChave: 'c01_cnpj',
        linkOficial: 'https://solucoes.receita.fazenda.gov.br/servicos/cnpjreva/cnpjreva_solicitacao.asp',
        exigePortalGoverno: false,
      },
      {
        codigo: 2,
        etapaNumero: 1,
        etapaNome: 'Etapa 1 — Documentos da Empresa (Habilitação Jurídica)',
        nome: 'Contrato Social ou Requerimento de Empresário',
        descricao: 'Ato constitutivo da empresa registrado na Junta Comercial ou Cartório competente.',
        orgaoEmissor: 'Junta Comercial do Estado',
        automatico: false,
        tipoChave: 'c02_contrato_social',
        exigePortalGoverno: false,
      },
      {
        codigo: 3,
        etapaNumero: 1,
        etapaNome: 'Etapa 1 — Documentos da Empresa (Habilitação Jurídica)',
        nome: 'Documento de Identidade dos Sócios (RG ou CNH)',
        descricao: 'Cópia legível do documento oficial de identificação dos sócios administradores.',
        orgaoEmissor: 'Órgão de Segurança Pública / DETRAN',
        automatico: false,
        tipoChave: 'c03_identidade_socios',
        exigePortalGoverno: false,
      },

      // Etapa 2 — Certidões Negativas (Regularidade Fiscal e Trabalhista)
      {
        codigo: 4,
        etapaNumero: 2,
        etapaNome: 'Etapa 2 — Certidões Negativas (Regularidade Fiscal e Trabalhista)',
        nome: 'Certidão Negativa Federal',
        descricao: 'Certidão Conjunta Negativa de Débitos Relativos aos Tributos Federais e à Dívida Ativa da União.',
        orgaoEmissor: 'Receita Federal do Brasil e PGFN',
        automatico: false,
        tipoChave: 'c04_cnd_federal',
        linkOficial: 'https://solucoes.receita.fazenda.gov.br/Servicos/certidaointernet/PJ/Emitir',
        exigePortalGoverno: true,
      },
      {
        codigo: 5,
        etapaNumero: 2,
        etapaNome: 'Etapa 2 — Certidões Negativas (Regularidade Fiscal e Trabalhista)',
        nome: 'Certificado de Regularidade do FGTS',
        descricao: 'Certificado que comprova a regularidade da empresa perante o Fundo de Garantia do Tempo de Serviço.',
        orgaoEmissor: 'Caixa Econômica Federal',
        automatico: false,
        tipoChave: 'c05_crf_fgts',
        linkOficial: 'https://consulta-crf.caixa.gov.br/consultacrf/pages/consultaEmpregador.jsf',
        exigePortalGoverno: true,
      },
      {
        codigo: 6,
        etapaNumero: 2,
        etapaNome: 'Etapa 2 — Certidões Negativas (Regularidade Fiscal e Trabalhista)',
        nome: 'Certidão Negativa Trabalhista (CNDT)',
        descricao: 'Certidão Negativa de Débitos Trabalhistas emitida pela Justiça do Trabalho.',
        orgaoEmissor: 'Tribunal Superior do Trabalho (TST / CSJT)',
        automatico: false,
        tipoChave: 'c06_cndt_trabalhista',
        linkOficial: 'https://cndt-certidao.tst.jus.br/inicio.faces',
        exigePortalGoverno: true,
      },
      {
        codigo: 7,
        etapaNumero: 2,
        etapaNome: 'Etapa 2 — Certidões Negativas (Regularidade Fiscal e Trabalhista)',
        nome: `Certidão Negativa Estadual (${uf})`,
        descricao: `Certidão de Débitos Tributários da Dívida Ativa Estadual do Estado de ${configEstado.nomeEstado}.`,
        orgaoEmissor: `Secretaria da Fazenda de ${configEstado.nomeEstado} (SEFAZ/${uf})`,
        automatico: false,
        tipoChave: 'c07_cnd_estadual',
        linkOficial: configEstado.urlSefaz,
        exigePortalGoverno: true,
      },
      {
        codigo: 8,
        etapaNumero: 2,
        etapaNome: 'Etapa 2 — Certidões Negativas (Regularidade Fiscal e Trabalhista)',
        nome: `Certidão Negativa Municipal (${municipio})`,
        descricao: `Certidão de Tributos Mobiliários e Imobiliários da Prefeitura de ${municipio} - ${uf}.`,
        orgaoEmissor: `Prefeitura Municipal de ${municipio}`,
        automatico: false,
        tipoChave: 'c08_cnd_municipal',
        linkOficial: obterLinkMunicipal(municipio, uf),
        exigePortalGoverno: true,
      },

      // Etapa 3 — Documentos Financeiros (Qualificação Econômico-Financeira)
      {
        codigo: 9,
        etapaNumero: 3,
        etapaNome: 'Etapa 3 — Documentos Financeiros (Qualificação Econômico-Financeira)',
        nome: `Certidão Negativa de Falência e Concordata (${uf})`,
        descricao: `Certidão de Falência, Concordata e Recuperação Judicial do Tribunal de Justiça de ${configEstado.nomeEstado}.`,
        orgaoEmissor: `Tribunal de Justiça do Estado (${uf})`,
        automatico: false,
        tipoChave: 'c09_cnd_falencia',
        linkOficial: configEstado.urlTribunalJustica,
        exigePortalGoverno: true,
      },
      {
        codigo: 10,
        etapaNumero: 3,
        etapaNome: 'Etapa 3 — Documentos Financeiros (Qualificação Econômico-Financeira)',
        nome: 'Balanço Patrimonial dos 2 Últimos Anos',
        descricao: 'Balanço Patrimonial e Demonstração do Resultado do Exercício (DRE) assinados por contador habilitado.',
        orgaoEmissor: 'Contabilidade da Empresa',
        automatico: false,
        tipoChave: 'c10_balanco_patrimonial',
        exigePortalGoverno: false,
      },

      // Etapa 4 — Declarações e Atestados (Qualificação Técnica)
      {
        codigo: 11,
        etapaNumero: 4,
        etapaNome: 'Etapa 4 — Declarações e Atestados (Qualificação Técnica)',
        nome: 'Comprovante de Empresa Idônea',
        descricao: 'Certidão de Inexistência de Sanções e Inidoneidade (CEIS, CNEP e TCU).',
        orgaoEmissor: 'Portal da Transparência / CGU e TCU',
        automatico: false,
        tipoChave: 'c11_comprovante_idoneidade',
        linkOficial: 'https://portaldatransparencia.gov.br/sancoes/consulta',
        exigePortalGoverno: true,
      },
      {
        codigo: 12,
        etapaNumero: 4,
        etapaNome: 'Etapa 4 — Declarações e Atestados (Qualificação Técnica)',
        nome: 'Declarações Obrigatórias da Lei 14.133/2021',
        descricao: 'Declarações conjuntas de não emprego de menores, reserva de cargos, inexistência de impedimentos e proposta independente.',
        orgaoEmissor: 'Expertise Licitatória (Preenchido com dados da empresa)',
        automatico: true,
        tipoChave: 'c12_declaracoes_obrigatorias',
        exigePortalGoverno: false,
      },
      {
        codigo: 13,
        etapaNumero: 4,
        etapaNome: 'Etapa 4 — Declarações e Atestados (Qualificação Técnica)',
        nome: 'Atestados de Capacidade Técnica',
        descricao: 'Comprovantes de fornecimento anterior pertinente e compatível com o objeto da licitação.',
        orgaoEmissor: 'Clientes Públicos ou Privados',
        automatico: false,
        tipoChave: 'c13_atestado_capacidade',
        exigePortalGoverno: false,
      },
    ];

    let prontosCount = 0;
    let vencendoCount = 0;
    let vencidosCount = 0;
    let pendentesCount = 0;

    const itensProcessados: ItemDocumentoHabilitacao[] = listaBase.map((item) => {
      // Procura documento pelo tipoChave ou por termos equivalentes
      const docEncontrado =
        mapaDocsPorTipo[item.tipoChave] ||
        documentosDb.find((d) => {
          const t = String(d.tipo || '').toLowerCase();
          const n = String(d.nome || '').toLowerCase();
          if (item.codigo === 1 && (t.includes('cnpj') || n.includes('cnpj'))) return true;
          if (item.codigo === 2 && (t.includes('contrato') || n.includes('contrato') || t.includes('social'))) return true;
          if (item.codigo === 3 && (t.includes('identidade') || t.includes('rg') || t.includes('cnh') || n.includes('rg') || n.includes('cnh'))) return true;
          if (item.codigo === 4 && (t.includes('federal') || t.includes('pgfn') || n.includes('federal'))) return true;
          if (item.codigo === 5 && (t.includes('fgts') || t.includes('crf') || n.includes('fgts'))) return true;
          if (item.codigo === 6 && (t.includes('trabalh') || t.includes('cndt') || n.includes('trabalh'))) return true;
          if (item.codigo === 7 && (t.includes('estadual') || t.includes('sefaz') || n.includes('estadual'))) return true;
          if (item.codigo === 8 && (t.includes('municipal') || t.includes('prefeitura') || n.includes('municipal'))) return true;
          if (item.codigo === 9 && (t.includes('falenc') || t.includes('concord') || n.includes('falenc'))) return true;
          if (item.codigo === 10 && (t.includes('balanco') || t.includes('balanço') || n.includes('balanço'))) return true;
          if (item.codigo === 11 && (t.includes('idonea') || t.includes('idônea') || t.includes('ceis') || n.includes('idone'))) return true;
          if (item.codigo === 12 && (t.includes('declarac') || t.includes('declaraç') || n.includes('declaraç'))) return true;
          if (item.codigo === 13 && (t.includes('atestado') || n.includes('atestado') || t.includes('capacidade'))) return true;
          return false;
        });

      if (!docEncontrado) {
        pendentesCount++;
        return {
          codigo: item.codigo,
          etapaNumero: item.etapaNumero,
          etapaNome: item.etapaNome,
          nome: item.nome,
          descricao: item.descricao,
          orgaoEmissor: item.orgaoEmissor,
          automatico: item.automatico,
          linkOficial: item.linkOficial,
          exigePortalGoverno: item.exigePortalGoverno,
          situacao: 'PENDENTE' as SituacaoDocumento,
          situacaoTexto: 'Pendente',
          dataValidade: null,
          diasParaVencer: null,
          arquivoUrl: null,
          arquivoNome: null,
          documentoId: null,
        };
      }

      const { situacao, texto, dias } = this.calcularSituacao(docEncontrado.validade);
      if (situacao === 'PRONTO') prontosCount++;
      else if (situacao === 'VENCE_EM_BREVE') vencendoCount++;
      else if (situacao === 'VENCIDO') vencidosCount++;
      else pendentesCount++;

      return {
        codigo: item.codigo,
        etapaNumero: item.etapaNumero,
        etapaNome: item.etapaNome,
        nome: item.nome,
        descricao: item.descricao,
        orgaoEmissor: item.orgaoEmissor,
        automatico: item.automatico,
        linkOficial: item.linkOficial,
        exigePortalGoverno: item.exigePortalGoverno,
        situacao,
        situacaoTexto: texto,
        dataValidade: docEncontrado.validade ? docEncontrado.validade.toISOString() : null,
        diasParaVencer: dias ?? null,
        arquivoUrl: `/api/v1/documentos/${docEncontrado.id}/download`,
        arquivoNome: docEncontrado.arquivoNome || `${item.nome}.pdf`,
        documentoId: docEncontrado.id,
      };
    });

    const percentualConcluido = Math.round((prontosCount / 13) * 100);

    return {
      empresa: {
        id: empresa.id,
        razaoSocial: empresa.razaoSocial,
        cnpj: empresa.cnpj,
        cnpjFormatado: formatarCnpj(empresa.cnpj),
        municipio,
        uf,
      },
      totalDocumentos: 13,
      documentosProntos: prontosCount,
      documentosVencendo: vencendoCount,
      documentosVencidos: vencidosCount,
      documentosPendentes: pendentesCount,
      percentualConcluido,
      itens: itensProcessados,
    };
  }

  /**
   * Gera o PDF do Comprovante de Inscrição e Situação Cadastral no CNPJ
   */
  async gerarBufferPdfCnpj(empresa: any): Promise<Buffer> {
    let dadosCnpj: any = null;
    const cnpjNumeros = String(empresa.cnpj || '').replace(/\D/g, '');

    // Consulta resiliente à BrasilAPI (limite de 8 segundos)
    try {
      if (cnpjNumeros.length === 14) {
        const resp = await axios.get(`https://brasilapi.com.br/api/cnpj/v1/${cnpjNumeros}`, {
          timeout: 8000,
        });
        if (resp.data && resp.data.razao_social) {
          dadosCnpj = resp.data;
        }
      }
    } catch {
      // Se a consulta externa falhar ou demorar, usa com segurança os dados da base local
    }

    const razaoSocial = dadosCnpj?.razao_social || empresa.razaoSocial || 'Empresa Licitante';
    const nomeFantasia = dadosCnpj?.nome_fantasia || empresa.nomeFantasia || razaoSocial;
    const cnpjFormat = formatarCnpj(empresa.cnpj);
    const logradouro = dadosCnpj?.logradouro || empresa.logradouro || 'Endereço Comercial';
    const bairro = dadosCnpj?.bairro || empresa.bairro || 'Centro';
    const municipio = dadosCnpj?.municipio || empresa.municipio || 'São Paulo';
    const uf = dadosCnpj?.uf || empresa.uf || 'SP';
    const cep = dadosCnpj?.cep || empresa.cep || '00000-000';
    const cnae = dadosCnpj?.cnae_fiscal_descricao || empresa.cnaePrincipal || 'Atividade Comercial';
    const situacaoCadastral = dadosCnpj?.descricao_situacao_cadastral || 'ATIVA';
    const dataAbertura = dadosCnpj?.data_inicio_atividade || '01/01/2020';

    return new Promise<Buffer>((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 40, size: 'A4' });
        const chunks: Buffer[] = [];

        doc.on('data', (c) => chunks.push(c));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', (err) => reject(err));

        // Cabeçalho Oficial
        doc.lineWidth(1.5).rect(40, 40, 515, 760).stroke('#0B192C');

        doc.fontSize(11).font('Helvetica-Bold').fillColor('#0B192C').text('REPÚBLICA FEDERATIVA DO BRASIL', 50, 55, { align: 'center' });
        doc.fontSize(10).font('Helvetica-Bold').text('CADASTRO NACIONAL DA PESSOA JURÍDICA', { align: 'center' });
        doc.fontSize(9).font('Helvetica').fillColor('#475569').text('COMPROVANTE DE INSCRIÇÃO E DE SITUAÇÃO CADASTRAL', { align: 'center' });

        doc.moveTo(50, 95).lineTo(545, 95).lineWidth(0.5).stroke('#CBD5E1');

        // Bloco 1: Número de Inscrição e Data de Abertura
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#0F172A').text('NÚMERO DE INSCRIÇÃO', 50, 105);
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#0B192C').text(cnpjFormat, 50, 117);

        doc.fontSize(8).font('Helvetica-Bold').fillColor('#0F172A').text('DATA DE ABERTURA', 380, 105);
        doc.fontSize(9).font('Helvetica').fillColor('#0B192C').text(dataAbertura, 380, 117);

        doc.moveTo(50, 135).lineTo(545, 135).lineWidth(0.5).stroke('#CBD5E1');

        // Bloco 2: Razão Social e Nome Fantasia
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#0F172A').text('NOME EMPRESARIAL', 50, 145);
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#0B192C').text(razaoSocial, 50, 157);

        doc.fontSize(8).font('Helvetica-Bold').fillColor('#0F172A').text('TÍTULO DO ESTABELECIMENTO (NOME FANTASIA)', 50, 175);
        doc.fontSize(9).font('Helvetica').fillColor('#0B192C').text(nomeFantasia, 50, 187);

        doc.moveTo(50, 205).lineTo(545, 205).lineWidth(0.5).stroke('#CBD5E1');

        // Bloco 3: Atividade Econômica Principal
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#0F172A').text('CÓDIGO E DESCRIÇÃO DA ATIVIDADE ECONÔMICA PRINCIPAL', 50, 215);
        doc.fontSize(8.5).font('Helvetica').fillColor('#0B192C').text(cnae, 50, 227, { width: 490 });

        doc.moveTo(50, 255).lineTo(545, 255).lineWidth(0.5).stroke('#CBD5E1');

        // Bloco 4: Endereço
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#0F172A').text('LOGRADOURO', 50, 265);
        doc.fontSize(9).font('Helvetica').fillColor('#0B192C').text(logradouro, 50, 277);

        doc.fontSize(8).font('Helvetica-Bold').fillColor('#0F172A').text('BAIRRO/DISTRITO', 50, 295);
        doc.fontSize(9).font('Helvetica').fillColor('#0B192C').text(bairro, 50, 307);

        doc.fontSize(8).font('Helvetica-Bold').fillColor('#0F172A').text('MUNICÍPIO', 280, 295);
        doc.fontSize(9).font('Helvetica').fillColor('#0B192C').text(`${municipio} - ${uf}`, 280, 307);

        doc.fontSize(8).font('Helvetica-Bold').fillColor('#0F172A').text('CEP', 450, 295);
        doc.fontSize(9).font('Helvetica').fillColor('#0B192C').text(cep, 450, 307);

        doc.moveTo(50, 325).lineTo(545, 325).lineWidth(0.5).stroke('#CBD5E1');

        // Bloco 5: Situação Cadastral
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#0F172A').text('SITUAÇÃO CADASTRAL', 50, 335);
        doc.fontSize(11).font('Helvetica-Bold').fillColor('#059669').text(situacaoCadastral, 50, 347);

        doc.fontSize(8).font('Helvetica-Bold').fillColor('#0F172A').text('DATA DA SITUAÇÃO CADASTRAL', 280, 335);
        doc.fontSize(9).font('Helvetica').fillColor('#0B192C').text(new Date().toLocaleDateString('pt-BR'), 280, 347);

        doc.moveTo(50, 370).lineTo(545, 370).lineWidth(0.5).stroke('#CBD5E1');

        // Rodapé de Certificação
        doc.fontSize(8).font('Helvetica-Oblique').fillColor('#64748B').text(
          'Documento gerado para fins de Habilitação Jurídica em conformidade com o Art. 66 da Lei Federal nº 14.133/2021.',
          50,
          740,
          { align: 'center', width: 495 }
        );
        doc.fontSize(7.5).font('Helvetica').fillColor('#94A3B8').text(
          `Emitido em ${new Date().toLocaleString('pt-BR')} via Plataforma Expertise Licitatória`,
          50,
          755,
          { align: 'center', width: 495 }
        );

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Gera o PDF com as Declarações Obrigatórias da Lei 14.133/2021 preenchido com dados da empresa
   */
  async gerarBufferPdfDeclaracoesLei14133(empresa: any): Promise<Buffer> {
    const razaoSocial = empresa.razaoSocial || 'EMPRESA LICITANTE';
    const cnpjFormat = formatarCnpj(empresa.cnpj);
    const enderecoCompleto = `${empresa.logradouro || 'Sede da Empresa'}, ${empresa.bairro || 'Centro'} - ${empresa.municipio || 'Município'}/${empresa.uf || 'UF'}`;
    const porte = empresa.porte || 'Microempresa (ME) ou Empresa de Pequeno Porte (EPP)';

    return new Promise<Buffer>((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 45, size: 'A4' });
        const chunks: Buffer[] = [];

        doc.on('data', (c) => chunks.push(c));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', (err) => reject(err));

        // Cabeçalho
        doc.fontSize(13).font('Helvetica-Bold').fillColor('#0B192C').text('DECLARAÇÕES UNIFICADAS DE HABILITAÇÃO', { align: 'center' });
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#059669').text('LEI FEDERAL Nº 14.133/2021', { align: 'center' });
        doc.moveDown(1);

        // Qualificação da Empresa
        doc.fontSize(9.5).font('Helvetica').fillColor('#0F172A').text(
          `A empresa ${razaoSocial}, inscrita no CNPJ sob o nº ${cnpjFormat}, sediada em ${enderecoCompleto}, por intermédio de seu representante legal, declara sob as penas da lei, para fins de participação em procedimentos licitatórios:`,
          { align: 'justify', lineGap: 3 }
        );
        doc.moveDown(1);

        // Declaração 1: Inexistência de Fatos Impeditivos (Art. 14 da Lei 14.133/21)
        doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#0B192C').text('1. INEXISTÊNCIA DE FATOS IMPEDITIVOS (ART. 14)');
        doc.fontSize(9).font('Helvetica').fillColor('#334155').text(
          'Declara que não está impedida de licitar ou contratar com a Administração Pública, que não foi declarada inidônea por nenhum órgão público da administração direta ou indireta, e que inexistem fatos supervenientes impeditivos da sua habilitação.',
          { align: 'justify', lineGap: 2 }
        );
        doc.moveDown(0.8);

        // Declaração 2: Não emprego de menores (Art. 7º, XXXIII, CF e Art. 68, VI, Lei 14.133/21)
        doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#0B192C').text('2. CUMPRIMENTO DO ART. 7º, XXXIII, DA CONSTITUIÇÃO FEDERAL');
        doc.fontSize(9).font('Helvetica').fillColor('#334155').text(
          'Declara que não emprega menor de 18 (dezoito) anos em trabalho noturno, perigoso ou insalubre e não emprega menor de 16 (dezesseis) anos, salvo na condição de aprendiz, a partir de 14 (quatorze) anos.',
          { align: 'justify', lineGap: 2 }
        );
        doc.moveDown(0.8);

        // Declaração 3: Elaboração Independente de Proposta (Art. 67 da Lei 14.133/21)
        doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#0B192C').text('3. ELABORAÇÃO INDEPENDENTE DE PROPOSTA');
        doc.fontSize(9).font('Helvetica').fillColor('#334155').text(
          'Declara que a proposta apresentada foi elaborada de maneira independente e que o seu conteúdo não foi, no todo ou em parte, direta ou indiretamente, informado, discutido ou divulgado com qualquer outro participante ou competidor.',
          { align: 'justify', lineGap: 2 }
        );
        doc.moveDown(0.8);

        // Declaração 4: Reserva de Cargos para PCD (Art. 63, IV da Lei 14.133/21)
        doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#0B192C').text('4. RESERVA DE CARGOS PARA PESSOA COM DEFICIÊNCIA');
        doc.fontSize(9).font('Helvetica').fillColor('#334155').text(
          'Declara que atende às exigências de reserva de cargos para pessoa com deficiência e para reabilitado da Previdência Social, previstas em lei e em outras normas específicas, conforme o art. 63, inciso IV, da Lei nº 14.133/2021.',
          { align: 'justify', lineGap: 2 }
        );
        doc.moveDown(0.8);

        // Declaração 5: Enquadramento de Porte
        doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#0B192C').text('5. ENQUADRAMENTO DE PORTE EMPRESARIAL');
        doc.fontSize(9).font('Helvetica').fillColor('#334155').text(
          `Declara, sob as penalidades legais, que cumpre os requisitos de qualificação do porte empresarial (${porte}) e que não incorre em nenhuma das vedações previstas no art. 3º, § 4º, da Lei Complementar nº 123/2006.`,
          { align: 'justify', lineGap: 2 }
        );
        doc.moveDown(0.8);

        // Declaração 6: Cumprimento Pleno dos Requisitos (Art. 63, I da Lei 14.133/21)
        doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#0B192C').text('6. PLENO CUMPRIMENTO DOS REQUISITOS DE HABILITAÇÃO');
        doc.fontSize(9).font('Helvetica').fillColor('#334155').text(
          'Declara que atende a todos os requisitos de habilitação jurídica, regularidade fiscal e trabalhista, qualificação econômica e técnica exigidos para a contratação.',
          { align: 'justify', lineGap: 2 }
        );
        doc.moveDown(1.5);

        // Data e Assinatura
        const dataHoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
        doc.fontSize(9.5).font('Helvetica').fillColor('#0F172A').text(
          `${empresa.municipio || 'Sede'}, ${dataHoje}.`,
          { align: 'center' }
        );
        doc.moveDown(2);

        doc.moveTo(170, doc.y).lineTo(425, doc.y).lineWidth(1).stroke('#0B192C');
        doc.moveDown(0.5);
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#0B192C').text(razaoSocial, { align: 'center' });
        doc.fontSize(8.5).font('Helvetica').fillColor('#475569').text(`CNPJ: ${cnpjFormat}`, { align: 'center' });
        doc.fontSize(8).font('Helvetica-Oblique').fillColor('#64748B').text('Representante Legal', { align: 'center' });

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Emissão silenciosa e protegida dos documentos gratuitos disponíveis
   */
  async emitirDocumentosGratuitos(userId: string, companyId?: string): Promise<RespostaStatusHabilitacao> {
    const empresa = await this.obterEmpresaAtiva(userId, companyId);
    if (!empresa) {
      throw new Error('EMPRESA_NAO_ENCONTRADA: Cadastre os dados da sua empresa antes de emitir documentos.');
    }

    // 1. Emissão do Comprovante do CNPJ (com proteção isolada por try/catch)
    try {
      const cnpjBuffer = await this.gerarBufferPdfCnpj(empresa);

      const uploadCnpj = await storageService.uploadFile({
        buffer: cnpjBuffer,
        originalName: '01 - Comprovante CNPJ.pdf',
        mimeType: 'application/pdf',
        userId,
        folder: `habilitacao/${empresa.id}`,
      });

      // Validade de 90 dias para comprovação cadastral
      const validadeCnpj = new Date();
      validadeCnpj.setDate(validadeCnpj.getDate() + 90);

      // Salva ou atualiza no banco
      const docExistente = await prisma.document.findFirst({
        where: { companyId: empresa.id, tipo: 'c01_cnpj' },
      });

      if (docExistente) {
        await prisma.document.update({
          where: { id: docExistente.id },
          data: {
            validade: validadeCnpj,
            storageKey: uploadCnpj.storageKey,
            url: uploadCnpj.url,
            arquivoNome: '01 - Comprovante CNPJ.pdf',
            fileMimeType: 'application/pdf',
            fileSize: cnpjBuffer.length,
            status: 'valido',
          },
        });
      } else {
        await prisma.document.create({
          data: {
            userId,
            companyId: empresa.id,
            tipo: 'c01_cnpj',
            nome: 'Comprovante do CNPJ',
            validade: validadeCnpj,
            storageKey: uploadCnpj.storageKey,
            url: uploadCnpj.url,
            arquivoNome: '01 - Comprovante CNPJ.pdf',
            fileMimeType: 'application/pdf',
            fileSize: cnpjBuffer.length,
            status: 'valido',
          },
        });
      }
    } catch (errCnpj) {
      console.warn('[HabilitacaoService] Aviso ao emitir CNPJ automático:', errCnpj);
    }

    // 2. Emissão das Declarações da Lei 14.133/2021 (com proteção isolada por try/catch)
    try {
      const declBuffer = await this.gerarBufferPdfDeclaracoesLei14133(empresa);

      const uploadDecl = await storageService.uploadFile({
        buffer: declBuffer,
        originalName: '12 - Declarações Obrigatórias Lei 14.133.pdf',
        mimeType: 'application/pdf',
        userId,
        folder: `habilitacao/${empresa.id}`,
      });

      // Validade de 180 dias para declarações
      const validadeDecl = new Date();
      validadeDecl.setDate(validadeDecl.getDate() + 180);

      const docExistente = await prisma.document.findFirst({
        where: { companyId: empresa.id, tipo: 'c12_declaracoes_obrigatorias' },
      });

      if (docExistente) {
        await prisma.document.update({
          where: { id: docExistente.id },
          data: {
            validade: validadeDecl,
            storageKey: uploadDecl.storageKey,
            url: uploadDecl.url,
            arquivoNome: '12 - Declarações Obrigatórias Lei 14.133.pdf',
            fileMimeType: 'application/pdf',
            fileSize: declBuffer.length,
            status: 'valido',
          },
        });
      } else {
        await prisma.document.create({
          data: {
            userId,
            companyId: empresa.id,
            tipo: 'c12_declaracoes_obrigatorias',
            nome: 'Declarações Obrigatórias da Lei 14.133/2021',
            validade: validadeDecl,
            storageKey: uploadDecl.storageKey,
            url: uploadDecl.url,
            arquivoNome: '12 - Declarações Obrigatórias Lei 14.133.pdf',
            fileMimeType: 'application/pdf',
            fileSize: declBuffer.length,
            status: 'valido',
          },
        });
      }
    } catch (errDecl) {
      console.warn('[HabilitacaoService] Aviso ao emitir Declarações automáticas:', errDecl);
    }

    // Retorna status atualizado após geração
    return this.obterStatusDocumentos(userId, companyId);
  }

  /**
   * Salva um documento anexado pelo usuário para um dos 13 itens
   */
  async anexarDocumentoItem(
    userId: string,
    companyId: string | undefined,
    codigoItem: number,
    file: Express.Multer.File,
    dataVencimento?: string | null
  ) {
    const empresa = await this.obterEmpresaAtiva(userId, companyId);
    if (!empresa) {
      throw new Error('EMPRESA_NAO_ENCONTRADA: Selecione uma empresa para anexar o documento.');
    }

    const codigoPadrao = Number(codigoItem);
    const tipoChave = `c${String(codigoPadrao).padStart(2, '0')}_doc`;

    const nomesPadrao: Record<number, string> = {
      1: 'Comprovante do CNPJ',
      2: 'Contrato Social ou Requerimento de Empresário',
      3: 'Documento de Identidade dos Sócios (RG ou CNH)',
      4: 'Certidão Negativa Federal',
      5: 'Certificado de Regularidade do FGTS',
      6: 'Certidão Negativa Trabalhista (CNDT)',
      7: 'Certidão Negativa Estadual',
      8: 'Certidão Negativa Municipal',
      9: 'Certidão Negativa de Falência e Concordata',
      10: 'Balanço Patrimonial dos 2 Últimos Anos',
      11: 'Comprovante de Empresa Idônea',
      12: 'Declarações Obrigatórias da Lei 14.133/2021',
      13: 'Atestados de Capacidade Técnica',
    };

    const nomeDocumento = nomesPadrao[codigoPadrao] || `Documento ${codigoPadrao}`;
    const uploadResult = await storageService.uploadFile({
      buffer: file.buffer,
      originalName: file.originalname || `${nomeDocumento}.pdf`,
      mimeType: file.mimetype || 'application/pdf',
      userId,
    });

    let validadeDate: Date | null = null;
    if (dataVencimento) {
      validadeDate = new Date(dataVencimento);
    }

    const docExistente = await prisma.document.findFirst({
      where: {
        companyId: empresa.id,
        OR: [
          { tipo: tipoChave },
          { tipo: `c${String(codigoPadrao).padStart(2, '0')}` },
        ],
      },
    });

    if (docExistente) {
      await prisma.document.update({
        where: { id: docExistente.id },
        data: {
          nome: nomeDocumento,
          tipo: tipoChave,
          validade: validadeDate,
          storageKey: uploadResult.storageKey,
          arquivoNome: uploadResult.fileName,
          fileMimeType: uploadResult.mimeType,
          fileSize: uploadResult.fileSize,
          status: 'valido',
        },
      });
    } else {
      await prisma.document.create({
        data: {
          userId,
          companyId: empresa.id,
          tipo: tipoChave,
          nome: nomeDocumento,
          validade: validadeDate,
          storageKey: uploadResult.storageKey,
          arquivoNome: uploadResult.fileName,
          fileMimeType: uploadResult.mimeType,
          fileSize: uploadResult.fileSize,
          status: 'valido',
        },
      });
    }

    return this.obterStatusDocumentos(userId, companyId);
  }

  /**
   * Baixa pasta completa organizada com numeração legal na frente
   */
  async gerarPastaCompletaCompactada(userId: string, companyId?: string): Promise<{ buffer: Buffer; nomeArquivo: string }> {
    const status = await this.obterStatusDocumentos(userId, companyId);
    const itensProntos = status.itens.filter(
      (it) => (it.situacao === 'PRONTO' || it.situacao === 'VENCE_EM_BREVE') && it.documentoId
    );

    if (itensProntos.length === 0) {
      throw new Error('NENHUM_DOCUMENTO_PRONTO: Anexe ou emita pelo menos um documento antes de baixar a pasta completa.');
    }

    const zip = new PizZip();

    for (const it of itensProntos) {
      const doc = await prisma.document.findUnique({
        where: { id: it.documentoId! },
      });

      if (doc && doc.storageKey) {
        try {
          const fileData = await storageService.getFileBuffer(doc.storageKey);
          const prefixo = String(it.codigo).padStart(2, '0');
          const nomeFinal = `${prefixo} - ${it.nome}.pdf`.replace(/[/\\?%*:|"<>]/g, '_');
          zip.file(nomeFinal, fileData.buffer);
        } catch (errBuffer) {
          console.warn(`[HabilitacaoService] Não foi possível ler buffer do documento ${it.nome}:`, errBuffer);
        }
      }
    }

    const zipBuffer = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
    const nomeLimpo = status.empresa.razaoSocial.replace(/[^a-zA-Z0-9_-]/g, '_');
    const nomeArquivo = `Documentos_Habilitacao_${nomeLimpo}.zip`;

    return { buffer: zipBuffer, nomeArquivo };
  }
}

export const habilitacaoService = new HabilitacaoService();
