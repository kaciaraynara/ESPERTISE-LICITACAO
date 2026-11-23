import axios from 'axios';
import { consultarCguCompleto } from './intelligence.service';

const COMPRASGOV_BASE = (process.env.COMPRASGOV_BASE_URL || 'https://dadosabertos.compras.gov.br').replace(/\/+$/, '');
const TCU_APF_BASE = 'https://certidoes-apf.apps.tcu.gov.br/api/rest/publico/certidoes';
const BRASILAPI_CNPJ_BASE = 'https://brasilapi.com.br/api/cnpj/v1';

const DEFAULT_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'EXPERTISE-SaaS/1.0',
};

export interface SicafFornecedor {
  cnpj: string;
  razao_social: string;
  situacao_cadastral: 'ativo' | 'suspenso' | 'inativo' | 'nao_cadastrado';
  habilitacoes: SicafHabilitacao[];
  certidoes: SicafCertidao[];
  linhas_servico: string[];
  data_validade_cadastro?: string;
  nivel_descentralizado?: string;
}

export interface SicafHabilitacao {
  tipo: 'juridica' | 'tecnica' | 'economica' | 'fiscal' | 'trabalhista';
  status: 'habilitado' | 'pendente' | 'irregular';
  descricao: string;
}

export interface SicafCertidao {
  nome: string;
  status: 'valida' | 'vencida' | 'pendente';
  validade: string;
  link_renovacao: string;
  orgao: string;
}

export interface NivelSicafConsolidado {
  nivel: string;
  titulo: string;
  descricao: string;
  status: 'REGULAR' | 'ATENCAO' | 'IRREGULAR' | 'VERIFICAR_PORTAL';
  fonteVerificada: string;
  detalhe: string;
  linkOficial: string;
}

export interface CertidaoTcuApfItem {
  emissor: string;
  tipo: string;
  descricao: string;
  situacao: string;
  constaOcorrencia: boolean;
  dataHoraEmissao: string | null;
  linkConsultaManual: string;
}

export interface PortalOficialStatus {
  id: string;
  nome: string;
  sigla: string;
  url: string;
  tipoAcesso: 'API_ABERTA' | 'GOV_BR' | 'CERTIFICADO_DIGITAL';
  status: 'ATIVO' | 'REQUER_CREDENCIAL_PORTAL';
  observacao: string;
}

export interface SicafConsolidadoDiagnostico {
  cnpj: string;
  cadastradoSicaf: boolean;
  dadosSicaf: {
    razaoSocial: string | null;
    porte: string | null;
    naturezaJuridica: string | null;
    municipio: string | null;
    uf: string | null;
    cnaePrincipal: string | null;
    ativo: boolean | null;
  } | null;
  dadosReceita: {
    razaoSocial: string;
    nomeFantasia: string;
    situacaoCadastral: string;
    dataAbertura: string | null;
    cnaePrincipal: string;
    cnaeDescricao: string;
    porte: string;
    capitalSocial: number | null;
    uf: string;
    municipio: string;
  } | null;
  certidoesTcuApf: CertidaoTcuApfItem[];
  integridadeCgu: {
    ceis: number;
    cnep: number;
    cepim: number;
    leniencia: number;
    alerta: boolean;
    resumo: string;
  };
  niveisSicaf: NivelSicafConsolidado[];
  portaisOficiais: PortalOficialStatus[];
  avaliacaoRisco: {
    nivel: 'baixo' | 'medio' | 'alto';
    motivos: string[];
  };
  fontesConsultadas: Array<{
    id: string;
    nome: string;
    ok: boolean;
    ms: number;
    mensagem: string;
  }>;
  linkPortalSicaf: string;
  consultadoEm: string;
}

export type SicafIntegrationErrorCode =
  | 'SICAF_INTEGRATION_NOT_CONFIGURED'
  | 'SICAF_INTEGRATION_NOT_IMPLEMENTED';

export class SicafIntegrationError extends Error {
  readonly source = 'SICAF';
  readonly official = true;
  readonly statusCode = 503;

  constructor(
    readonly code: SicafIntegrationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'SicafIntegrationError';
  }
}

export function isSicafConfigured(): boolean {
  return true;
}

export function getLinkConsultaSicaf(cnpj: string): string {
  const cnpjNormalizado = cnpj.replace(/\D/g, '');
  return (
    'https://www.gov.br/compras/pt-br/acesso-a-informacao/'
    + `sicaf/pesquisa-de-fornecedores?cnpj=${encodeURIComponent(cnpjNormalizado)}`
  );
}

function classifySituacaoApf(situacao: string): boolean {
  const up = String(situacao || '').toUpperCase();
  return up.includes('CONSTA') && !up.includes('NADA_CONSTA') && !up.includes('NADA CONSTA');
}

export async function consultarSicafConsolidado(cnpj: string): Promise<SicafConsolidadoDiagnostico> {
  const cnpjLimpo = String(cnpj || '').replace(/\D/g, '');
  if (cnpjLimpo.length !== 14) {
    throw new TypeError('CNPJ válido com 14 dígitos é obrigatório para consulta ao SICAF.');
  }

  const tSicafStart = Date.now();
  const sicafPromise = axios.get(`${COMPRASGOV_BASE}/modulo-fornecedor/1_consultarFornecedor`, {
    params: { cnpj: cnpjLimpo, ativo: true, pagina: 1, tamanhoPagina: 10 },
    timeout: 9000,
    headers: DEFAULT_HEADERS,
    validateStatus: (s) => s === 200 || s === 404,
  }).then((r) => ({ ms: Date.now() - tSicafStart, status: r.status, data: r.data }));

  const tRfbStart = Date.now();
  const rfbPromise = axios.get(`${BRASILAPI_CNPJ_BASE}/${cnpjLimpo}`, {
    timeout: 9000,
    headers: DEFAULT_HEADERS,
    validateStatus: (s) => s === 200 || s === 404,
  }).then((r) => ({ ms: Date.now() - tRfbStart, status: r.status, data: r.data }));

  const tTcuStart = Date.now();
  const tcuPromise = axios.get(`${TCU_APF_BASE}/${cnpjLimpo}`, {
    timeout: 10000,
    headers: DEFAULT_HEADERS,
    validateStatus: (s) => s === 200 || s === 404 || s === 400,
  }).then((r) => ({ ms: Date.now() - tTcuStart, status: r.status, data: r.data }));

  const tCguStart = Date.now();
  const cguPromise = consultarCguCompleto(cnpjLimpo)
    .then((data) => ({ ms: Date.now() - tCguStart, data }));

  const [sicafRes, rfbRes, tcuRes, cguRes] = await Promise.allSettled([
    sicafPromise,
    rfbPromise,
    tcuPromise,
    cguPromise,
  ]);

  const fontesConsultadas: SicafConsolidadoDiagnostico['fontesConsultadas'] = [];

  // 1. Compras.gov.br / SICAF Aberto
  let dadosSicaf: SicafConsolidadoDiagnostico['dadosSicaf'] = null;
  let cadastradoSicaf = false;
  if (sicafRes.status === 'fulfilled') {
    const lista = Array.isArray(sicafRes.value.data?.resultado) ? sicafRes.value.data.resultado : [];
    const primeiro = lista[0];
    if (sicafRes.value.status === 200 && primeiro) {
      cadastradoSicaf = true;
      dadosSicaf = {
        razaoSocial: primeiro.razaoSocial || primeiro.nome || null,
        porte: primeiro.porteEmpresaNome || primeiro.porteEmpresa || null,
        naturezaJuridica: primeiro.naturezaJuridicaNome || null,
        municipio: primeiro.nomeMunicipio || null,
        uf: primeiro.ufSigla || null,
        cnaePrincipal: primeiro.codigoCnae ? String(primeiro.codigoCnae) : null,
        ativo: primeiro.ativo !== false,
      };
      fontesConsultadas.push({
        id: 'COMPRASGOV_SICAF',
        nome: 'Compras.gov.br (SICAF Dados Abertos)',
        ok: true,
        ms: sicafRes.value.ms,
        mensagem: 'Fornecedor localizado e ativo no cadastro aberto Federal',
      });
    } else {
      fontesConsultadas.push({
        id: 'COMPRASGOV_SICAF',
        nome: 'Compras.gov.br (SICAF Dados Abertos)',
        ok: true,
        ms: sicafRes.value.ms,
        mensagem: 'Não localizado na base aberta de fornecedores ativos (consulte Gov.br se cadastrado recentemente)',
      });
    }
  } else {
    fontesConsultadas.push({
      id: 'COMPRASGOV_SICAF',
      nome: 'Compras.gov.br (SICAF Dados Abertos)',
      ok: false,
      ms: Date.now() - tSicafStart,
      mensagem: 'Endpoint público temporariamente indisponível',
    });
  }

  // 2. Receita Federal / BrasilAPI
  let dadosReceita: SicafConsolidadoDiagnostico['dadosReceita'] = null;
  if (rfbRes.status === 'fulfilled' && rfbRes.value.status === 200 && rfbRes.value.data?.cnpj) {
    const d = rfbRes.value.data;
    dadosReceita = {
      razaoSocial: String(d.razao_social || '').trim(),
      nomeFantasia: String(d.nome_fantasia || '').trim(),
      situacaoCadastral: String(d.descricao_situacao_cadastral || 'NÃO INFORMADA').trim(),
      dataAbertura: d.data_inicio_atividade || null,
      cnaePrincipal: d.cnae_fiscal ? String(d.cnae_fiscal) : '',
      cnaeDescricao: String(d.cnae_fiscal_descricao || '').trim(),
      porte: String(d.porte || '').trim(),
      capitalSocial: Number.isFinite(Number(d.capital_social)) ? Number(d.capital_social) : null,
      uf: String(d.uf || '').trim(),
      municipio: String(d.municipio || '').trim(),
    };
    fontesConsultadas.push({
      id: 'RECEITA_CNPJ',
      nome: 'Receita Federal (via BrasilAPI)',
      ok: true,
      ms: rfbRes.value.ms,
      mensagem: `Situação cadastral: ${dadosReceita.situacaoCadastral}`,
    });
  } else {
    fontesConsultadas.push({
      id: 'RECEITA_CNPJ',
      nome: 'Receita Federal (via BrasilAPI)',
      ok: false,
      ms: rfbRes.status === 'fulfilled' ? rfbRes.value.ms : Date.now() - tRfbStart,
      mensagem: rfbRes.status === 'fulfilled' && rfbRes.value.status === 404
        ? 'CNPJ não encontrado na base pública'
        : 'Receita/BrasilAPI indisponível no momento',
    });
  }

  // 3. TCU Consulta Consolidada (TCU Inidôneos, CNJ, CGU CEIS, CGU CNEP)
  let certidoesTcuApf: CertidaoTcuApfItem[] = [];
  if (tcuRes.status === 'fulfilled' && tcuRes.value.status === 200 && Array.isArray(tcuRes.value.data?.certidoes)) {
    certidoesTcuApf = tcuRes.value.data.certidoes.map((c: any) => ({
      emissor: String(c.emissor || 'TCU').trim(),
      tipo: String(c.tipo || '').trim(),
      descricao: String(c.descricao || '').trim(),
      situacao: String(c.situacao || '').trim(),
      constaOcorrencia: classifySituacaoApf(c.situacao),
      dataHoraEmissao: c.dataHoraEmissao || null,
      linkConsultaManual: String(c.linkConsultaManual || 'https://certidoes-apf.apps.tcu.gov.br/'),
    }));
    const alertasTcu = certidoesTcuApf.filter((c) => c.constaOcorrencia).length;
    fontesConsultadas.push({
      id: 'TCU_APF',
      nome: 'TCU — Certidão Consolidada APF (TCU / CNJ / CGU)',
      ok: true,
      ms: tcuRes.value.ms,
      mensagem: alertasTcu > 0
        ? `${alertasTcu} apontamento(s) encontrado(s) nas bases APF`
        : `${certidoesTcuApf.length} base(s) verificada(s): Nada Consta`,
    });
  } else {
    fontesConsultadas.push({
      id: 'TCU_APF',
      nome: 'TCU — Certidão Consolidada APF (TCU / CNJ / CGU)',
      ok: false,
      ms: tcuRes.status === 'fulfilled' ? tcuRes.value.ms : Date.now() - tTcuStart,
      mensagem: 'Serviço TCU APF indisponível no momento',
    });
  }

  // 4. CGU Completo (se token configurado)
  const integridadeCgu = cguRes.status === 'fulfilled'
    ? cguRes.value.data
    : { ceis: 0, cnep: 0, cepim: 0, leniencia: 0, alerta: false, resumo: 'Falha na consulta CGU' };

  const cguTokenOk = !integridadeCgu.resumo.toLowerCase().includes('pendente');
  fontesConsultadas.push({
    id: 'CGU_TRANSPARENCIA',
    nome: 'CGU — Portal da Transparência (CEIS/CNEP/CEPIM/Leniência)',
    ok: cguTokenOk,
    ms: cguRes.status === 'fulfilled' ? cguRes.value.ms : Date.now() - tCguStart,
    mensagem: integridadeCgu.resumo,
  });

  // Consolidação Níveis I–VI da Lei 14.133/2021 com total transparência sobre o que é verificável via API pública
  const rfbAtiva = Boolean(dadosReceita?.situacaoCadastral.toUpperCase().includes('ATIVA'));
  const tcuOkSemAlerta = certidoesTcuApf.length > 0 && certidoesTcuApf.every((c) => !c.constaOcorrencia);
  const tcuComAlerta = certidoesTcuApf.some((c) => c.constaOcorrencia);

  const niveisSicaf: NivelSicafConsolidado[] = [
    {
      nivel: 'I',
      titulo: 'Credenciamento no SICAF',
      descricao: 'Cadastro básico do fornecedor e representante legal no SIASG/Compras.gov.br.',
      status: cadastradoSicaf ? 'REGULAR' : 'ATENCAO',
      fonteVerificada: 'Compras.gov.br (Dados Abertos)',
      detalhe: cadastradoSicaf
        ? `Ativo na base federal (${dadosSicaf?.municipio || 'BR'}${dadosSicaf?.uf ? `/${dadosSicaf.uf}` : ''}).`
        : 'Não localizado automaticamente na listagem aberta de ativos — confirme o login Gov.br no SICAF.',
      linkOficial: 'https://www3.comprasnet.gov.br/sicaf-web/index.jsf',
    },
    {
      nivel: 'II',
      titulo: 'Habilitação Jurídica',
      descricao: 'Situação cadastral ativa na Receita Federal, ato constitutivo e CNAE compatível.',
      status: !dadosReceita ? 'VERIFICAR_PORTAL' : rfbAtiva ? 'REGULAR' : 'IRREGULAR',
      fonteVerificada: 'Receita Federal / BrasilAPI',
      detalhe: dadosReceita
        ? `${dadosReceita.situacaoCadastral} · CNAE ${dadosReceita.cnaePrincipal || '—'} · Porte ${dadosReceita.porte || '—'}`
        : 'Consulte o Cartão CNPJ no portal da Receita Federal.',
      linkOficial: 'https://solucoes.receita.fazenda.gov.br/Servicos/cnpjreva/cnpjreva_solicitacao.asp',
    },
    {
      nivel: 'III',
      titulo: 'Regularidade Fiscal Federal e Trabalhista',
      descricao: 'CND Receita/PGFN, CRF FGTS (Caixa) e CNDT (TST) — emissão exigida nos pregões eletrônicos.',
      status: tcuComAlerta || integridadeCgu.alerta ? 'IRREGULAR' : 'VERIFICAR_PORTAL',
      fonteVerificada: 'Portais Oficiais RFB/PGFN, Caixa e TST + TCU APF',
      detalhe: tcuComAlerta || integridadeCgu.alerta
        ? 'Consta restrição/sanção em cadastro federal de idoneidade. Valide CND, FGTS e CNDT.'
        : 'As CND Federal, FGTS e CNDT exigem validação direta com certificado/captcha nos órgãos emissores.',
      linkOficial: 'https://solucoes.receita.fazenda.gov.br/Servicos/certidaointernet/PJ/Emitir',
    },
    {
      nivel: 'IV',
      titulo: 'Regularidade Fiscal Estadual e Municipal',
      descricao: 'Inscrição estadual/municipal e certidões negativas da SEFAZ/Prefeitura.',
      status: 'VERIFICAR_PORTAL',
      fonteVerificada: 'SEFAZ Estadual / Prefeitura Sede',
      detalhe: dadosReceita
        ? `Verifique a CND da SEFAZ-${dadosReceita.uf} e Prefeitura de ${dadosReceita.municipio}.`
        : 'Emissão direta na SEFAZ do Estado e Fazenda Municipal.',
      linkOficial: 'https://www3.comprasnet.gov.br/sicaf-web/index.jsf',
    },
    {
      nivel: 'V',
      titulo: 'Qualificação Técnica',
      descricao: 'Atestados de capacidade técnica, registros profissionais (CREA/CAU/CRM) e CNES/ANVISA quando aplicável.',
      status: 'VERIFICAR_PORTAL',
      fonteVerificada: 'Cofre de Documentos & Conselhos de Classe',
      detalhe: 'Armazene seus atestados no Cofre da EXPERTISE para anexar automaticamente nas habilitações.',
      linkOficial: 'https://www3.comprasnet.gov.br/sicaf-web/index.jsf',
    },
    {
      nivel: 'VI',
      titulo: 'Qualificação Econômico-Financeira & Idoneidade (TCU/CGU)',
      descricao: 'Balanço patrimonial, certidão negativa de falência e ausência de impedimentos no TCU, CNJ e CGU.',
      status: tcuComAlerta || integridadeCgu.alerta
        ? 'IRREGULAR'
        : tcuOkSemAlerta
          ? 'REGULAR'
          : 'VERIFICAR_PORTAL',
      fonteVerificada: 'TCU Consulta Consolidada APF + CGU',
      detalhe: tcuComAlerta
        ? 'Apontamento detectado na Certidão Consolidada TCU/CNJ/CEIS/CNEP.'
        : tcuOkSemAlerta
          ? 'TCU Inidôneos, CNJ Improbidade, CEIS e CNEP verificados ao vivo: Nada Consta.'
          : 'Valide também o balanço patrimonial e CND de falência no Tribunal de Justiça.',
      linkOficial: 'https://certidoes-apf.apps.tcu.gov.br/',
    },
  ];

  const portaisOficiais: PortalOficialStatus[] = [
    {
      id: 'pncp',
      nome: 'PNCP — Portal Nacional de Contratações Públicas',
      sigla: 'PNCP',
      url: 'https://pncp.gov.br/',
      tipoAcesso: 'API_ABERTA',
      status: 'ATIVO',
      observacao: 'Editais, PCAs, contratos e atas integrados em tempo real na plataforma.',
    },
    {
      id: 'comprasgov_sicaf',
      nome: 'Compras.gov.br & SICAF Digital',
      sigla: 'SIASG',
      url: 'https://www3.comprasnet.gov.br/sicaf-web/index.jsf',
      tipoAcesso: 'GOV_BR',
      status: 'ATIVO',
      observacao: 'CATMAT/CATSER, Pesquisa de Preços e Consulta Aberta de Fornecedores integrados; operação de lances exige login Gov.br.',
    },
    {
      id: 'tcu_apf',
      nome: 'TCU — Certidão Consolidada APF (Inidôneos / CNJ / CEIS / CNEP)',
      sigla: 'TCU',
      url: 'https://certidoes-apf.apps.tcu.gov.br/',
      tipoAcesso: 'API_ABERTA',
      status: 'ATIVO',
      observacao: 'Consulta pública automática em tempo real para habilitação e análise de concorrentes.',
    },
    {
      id: 'cgu_transparencia',
      nome: 'Portal da Transparência — CGU (CEIS / CNEP / CEPIM / Leniência)',
      sigla: 'CGU',
      url: 'https://portaldatransparencia.gov.br/sancoes',
      tipoAcesso: 'API_ABERTA',
      status: cguTokenOk ? 'ATIVO' : 'REQUER_CREDENCIAL_PORTAL',
      observacao: cguTokenOk
        ? 'Integração ativa para sanções e contratos federais.'
        : 'Base CEIS/CNEP coberta via TCU APF; CEPIM e Leniência requerem TRANSPARENCIA_API_TOKEN.',
    },
    {
      id: 'bcb_indices',
      nome: 'Banco Central do Brasil (SGS — IPCA / IGP-M / SELIC)',
      sigla: 'BCB',
      url: 'https://www3.bcb.gov.br/sgspub/',
      tipoAcesso: 'API_ABERTA',
      status: 'ATIVO',
      observacao: 'Índices oficiais em tempo real para reajuste e repactuação contratual (Art. 135 Lei 14.133/2021).',
    },
    {
      id: 'bll_bnc',
      nome: 'Portais Estaduais / Privados (BLL, BNC, Licitações-e)',
      sigla: 'PORTAIS',
      url: 'https://bllcompras.com',
      tipoAcesso: 'CERTIFICADO_DIGITAL',
      status: 'REQUER_CREDENCIAL_PORTAL',
      observacao: 'Operação de lances exige certificado digital A1/A3 e credenciamento próprio em cada bolsa.',
    },
  ];

  const motivosRisco: string[] = [];
  if (dadosReceita && !rfbAtiva) {
    motivosRisco.push(`Situação cadastral na Receita Federal: ${dadosReceita.situacaoCadastral}`);
  }
  for (const c of certidoesTcuApf) {
    if (c.constaOcorrencia) motivosRisco.push(`${c.emissor} (${c.tipo}): ${c.situacao}`);
  }
  if (integridadeCgu.alerta) {
    motivosRisco.push(integridadeCgu.resumo);
  }
  if (!cadastradoSicaf) {
    motivosRisco.push('CNPJ não retornado na consulta aberta de fornecedores ativos do Compras.gov.br');
  }

  const temImpedimentoGrave =
    (dadosReceita && !rfbAtiva) || tcuComAlerta || integridadeCgu.alerta;

  const avaliacaoRisco = {
    nivel: temImpedimentoGrave ? ('alto' as const) : motivosRisco.length > 0 ? ('medio' as const) : ('baixo' as const),
    motivos: motivosRisco,
  };

  return {
    cnpj: cnpjLimpo,
    cadastradoSicaf,
    dadosSicaf,
    dadosReceita,
    certidoesTcuApf,
    integridadeCgu,
    niveisSicaf,
    portaisOficiais,
    avaliacaoRisco,
    fontesConsultadas,
    linkPortalSicaf: getLinkConsultaSicaf(cnpjLimpo),
    consultadoEm: new Date().toISOString(),
  };
}

export async function consultarSicaf(cnpj: string): Promise<SicafFornecedor> {
  const diagnostico = await consultarSicafConsolidado(cnpj);
  const rfbAtiva = Boolean(diagnostico.dadosReceita?.situacaoCadastral.toUpperCase().includes('ATIVA'));
  const tcuIrregular = diagnostico.certidoesTcuApf.some((c) => c.constaOcorrencia) || diagnostico.integridadeCgu.alerta;

  return {
    cnpj: diagnostico.cnpj,
    razao_social:
      diagnostico.dadosReceita?.razaoSocial ||
      diagnostico.dadosSicaf?.razaoSocial ||
      `Empresa ${diagnostico.cnpj}`,
    situacao_cadastral: tcuIrregular
      ? 'suspenso'
      : diagnostico.dadosReceita && !rfbAtiva
        ? 'inativo'
        : diagnostico.cadastradoSicaf
          ? 'ativo'
          : 'nao_cadastrado',
    habilitacoes: diagnostico.niveisSicaf.slice(0, 5).map((n, idx) => ({
      tipo: (['juridica', 'juridica', 'fiscal', 'fiscal', 'tecnica'][idx] || 'juridica') as SicafHabilitacao['tipo'],
      status: n.status === 'REGULAR' ? 'habilitado' : n.status === 'IRREGULAR' ? 'irregular' : 'pendente',
      descricao: `${n.titulo}: ${n.detalhe}`,
    })),
    certidoes: diagnostico.certidoesTcuApf.map((c) => ({
      nome: `${c.emissor} — ${c.descricao}`,
      status: c.constaOcorrencia ? 'vencida' : 'valida',
      validade: c.dataHoraEmissao || new Date().toISOString(),
      link_renovacao: c.linkConsultaManual,
      orgao: c.emissor,
    })),
    linhas_servico: diagnostico.dadosReceita?.cnaeDescricao
      ? [`${diagnostico.dadosReceita.cnaePrincipal} - ${diagnostico.dadosReceita.cnaeDescricao}`]
      : [],
    nivel_descentralizado: diagnostico.cadastradoSicaf ? 'I-VI (SICAF Federal Ativo)' : 'Validar via Gov.br',
  };
}

export function avaliarRiscoIrregularidade(
  fornecedor: SicafFornecedor,
): {
  nivel: 'baixo' | 'medio' | 'alto';
  motivos: string[];
} {
  const motivos: string[] = [];

  const certidoesVencidas = fornecedor.certidoes.filter(
    (certidao) => certidao.status === 'vencida',
  ).length;

  const habilitacoesPendentes = fornecedor.habilitacoes.filter(
    (habilitacao) => habilitacao.status !== 'habilitado',
  ).length;

  if (certidoesVencidas >= 1) {
    motivos.push(`${certidoesVencidas} apontamento(s) ou certidão(ões) irregulares`);
  }

  if (habilitacoesPendentes > 0) {
    motivos.push(`${habilitacoesPendentes} habilitação(ões) pendente(s)`);
  }

  if (fornecedor.situacao_cadastral !== 'ativo') {
    motivos.push(`Situação no SICAF: ${fornecedor.situacao_cadastral}`);
  }

  const nivel =
    motivos.length === 0
      ? 'baixo'
      : motivos.length === 1
        ? 'medio'
        : 'alto';

  return { nivel, motivos };
}
