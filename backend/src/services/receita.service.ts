import axios, { AxiosInstance } from 'axios';
import { normalizarCnpj } from './cnpj.service';

export type ReceitaFonte = 'brasilapi-cnpj';

export type ReceitaServiceErrorCode =
  | 'CNPJ_INVALIDO'
  | 'CNPJ_NAO_ENCONTRADO'
  | 'RECEITA_TIMEOUT'
  | 'RECEITA_INDISPONIVEL'
  | 'RECEITA_RESPOSTA_INVALIDA';

export interface ReceitaSocioQsa {
  nome: string;
  documentoMascarado: string | null;
  qualificacao: string | null;
  codigoQualificacao: number | null;
  dataEntradaSociedade: string | null;
  identificadorSocio: number | null;
  faixaEtaria: string | null;
  pais: string | null;
  representanteLegal: {
    nome: string | null;
    documentoMascarado: string | null;
    qualificacao: string | null;
  };
}

export interface ReceitaEmpresaQsa {
  fonte: ReceitaFonte;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  situacaoCadastral: string | null;
  naturezaJuridica: string | null;
  municipio: string | null;
  uf: string | null;
  qsa: ReceitaSocioQsa[];
  consultadoEm: string;
}

interface BrasilApiCnpjResponse {
  cnpj?: string;
  razao_social?: string;
  nome_fantasia?: string | null;
  descricao_situacao_cadastral?: string | null;
  natureza_juridica?: string | null;
  municipio?: string | null;
  uf?: string | null;
  qsa?: BrasilApiQsaSocio[] | null;
}

interface BrasilApiQsaSocio {
  nome_socio?: string | null;
  cnpj_cpf_do_socio?: string | null;
  qualificacao_socio?: string | null;
  codigo_qualificacao_socio?: number | null;
  data_entrada_sociedade?: string | null;
  identificador_de_socio?: number | null;
  faixa_etaria?: string | null;
  pais?: string | null;
  nome_representante_legal?: string | null;
  cpf_representante_legal?: string | null;
  qualificacao_representante_legal?: string | null;
}

export interface ReceitaConsultaFalha {
  cnpj: string;
  code: ReceitaServiceErrorCode;
  message: string;
  statusCode: number;
  providerStatusCode?: number;
}

export interface ReceitaConsultaLoteResultado {
  empresas: ReceitaEmpresaQsa[];
  falhas: ReceitaConsultaFalha[];
  totalSolicitado: number;
  totalSucesso: number;
  totalFalhas: number;
  conclusiva: boolean;
}

export class ReceitaFederalServiceError extends Error {
  readonly code: ReceitaServiceErrorCode;
  readonly statusCode: number;
  readonly providerStatusCode?: number;

  constructor(
    code: ReceitaServiceErrorCode,
    message: string,
    statusCode: number,
    providerStatusCode?: number,
  ) {
    super(message);
    this.name = 'ReceitaFederalServiceError';
    this.code = code;
    this.statusCode = statusCode;
    this.providerStatusCode = providerStatusCode;
  }
}

export class ReceitaService {
  private readonly client: AxiosInstance;

  constructor(client?: AxiosInstance) {
    this.client = client ?? axios.create({
      baseURL: getBrasilApiBaseUrl(),
      timeout: getNumberEnv('RECEITA_CNPJ_TIMEOUT_MS', 8000),
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Expertise-SaaS/2.0',
      },
    });
  }

  async consultarQsaPorCnpj(cnpj: string): Promise<ReceitaEmpresaQsa> {
    const cnpjLimpo = normalizarCnpj(cnpj);

    if (cnpjLimpo.length !== 14) {
      throw new ReceitaFederalServiceError(
        'CNPJ_INVALIDO',
        'CNPJ inválido. Informe um CNPJ com 14 dígitos.',
        400,
      );
    }

    try {
      const { data } = await this.client.get<BrasilApiCnpjResponse>(`/api/cnpj/v1/${cnpjLimpo}`);
      return mapBrasilApiCnpjResponse(data, cnpjLimpo);
    } catch (error) {
      if (error instanceof ReceitaFederalServiceError) {
        throw error;
      }

      throw mapExternalError(error, cnpjLimpo);
    }
  }

  async consultarQsaEmLoteDetalhado(
    cnpjs: string[],
  ): Promise<ReceitaConsultaLoteResultado> {
    const cnpjsUnicos = Array.from(new Set(cnpjs.map(normalizarCnpj)));

    if (cnpjsUnicos.some((cnpj) => cnpj.length !== 14)) {
      throw new ReceitaFederalServiceError(
        'CNPJ_INVALIDO',
        'Todos os CNPJs devem conter 14 dígitos.',
        400,
      );
    }

    const empresas: ReceitaEmpresaQsa[] = [];
    const falhas: ReceitaConsultaFalha[] = [];

    const concorrencia = Math.min(
      getNumberEnv('RECEITA_CNPJ_CONCURRENCY', 4),
      Math.max(cnpjsUnicos.length, 1),
    );

    let proximoIndice = 0;

    const worker = async () => {
      while (true) {
        const indice = proximoIndice++;
        if (indice >= cnpjsUnicos.length) return;

        const cnpj = cnpjsUnicos[indice];

        try {
          empresas.push(await this.consultarQsaPorCnpj(cnpj));
        } catch (error) {
          if (error instanceof ReceitaFederalServiceError) {
            falhas.push({
              cnpj,
              code: error.code,
              message: error.message,
              statusCode: error.statusCode,
              providerStatusCode: error.providerStatusCode,
            });
          } else {
            falhas.push({
              cnpj,
              code: 'RECEITA_INDISPONIVEL',
              message: 'Falha ao consultar dados públicos da Receita Federal.',
              statusCode: 502,
            });
          }
        }
      }
    };

    await Promise.all(
      Array.from({ length: concorrencia }, () => worker()),
    );

    empresas.sort(
      (a, b) => cnpjsUnicos.indexOf(a.cnpj) - cnpjsUnicos.indexOf(b.cnpj),
    );

    falhas.sort(
      (a, b) => cnpjsUnicos.indexOf(a.cnpj) - cnpjsUnicos.indexOf(b.cnpj),
    );

    return {
      empresas,
      falhas,
      totalSolicitado: cnpjsUnicos.length,
      totalSucesso: empresas.length,
      totalFalhas: falhas.length,
      conclusiva: falhas.length === 0,
    };
  }

  async consultarQsaEmLote(cnpjs: string[]): Promise<ReceitaEmpresaQsa[]> {
    const resultado = await this.consultarQsaEmLoteDetalhado(cnpjs);

    if (resultado.falhas.length > 0) {
      const falha = resultado.falhas[0];

      throw new ReceitaFederalServiceError(
        falha.code,
        falha.message,
        falha.statusCode,
        falha.providerStatusCode,
      );
    }

    return resultado.empresas;
  }
}

function mapBrasilApiCnpjResponse(data: BrasilApiCnpjResponse, cnpj: string): ReceitaEmpresaQsa {
  if (!data || !data.razao_social) {
    throw new ReceitaFederalServiceError(
      'RECEITA_RESPOSTA_INVALIDA',
      'A Receita Federal retornou uma resposta sem dados cadastrais suficientes.',
      502,
    );
  }

  return {
    fonte: 'brasilapi-cnpj',
    cnpj,
    razaoSocial: data.razao_social,
    nomeFantasia: normalizeNullableString(data.nome_fantasia),
    situacaoCadastral: normalizeNullableString(data.descricao_situacao_cadastral),
    naturezaJuridica: normalizeNullableString(data.natureza_juridica),
    municipio: normalizeNullableString(data.municipio),
    uf: normalizeNullableString(data.uf),
    qsa: Array.isArray(data.qsa) ? data.qsa.map(mapBrasilApiQsaSocio).filter((socio) => socio.nome) : [],
    consultadoEm: new Date().toISOString(),
  };
}

function mapBrasilApiQsaSocio(socio: BrasilApiQsaSocio): ReceitaSocioQsa {
  return {
    nome: normalizeRequiredString(socio.nome_socio),
    documentoMascarado: normalizeNullableString(socio.cnpj_cpf_do_socio),
    qualificacao: normalizeNullableString(socio.qualificacao_socio),
    codigoQualificacao: normalizeNullableNumber(socio.codigo_qualificacao_socio),
    dataEntradaSociedade: normalizeNullableString(socio.data_entrada_sociedade),
    identificadorSocio: normalizeNullableNumber(socio.identificador_de_socio),
    faixaEtaria: normalizeNullableString(socio.faixa_etaria),
    pais: normalizeNullableString(socio.pais),
    representanteLegal: {
      nome: normalizeNullableString(socio.nome_representante_legal),
      documentoMascarado: normalizeNullableString(socio.cpf_representante_legal),
      qualificacao: normalizeNullableString(socio.qualificacao_representante_legal),
    },
  };
}

function mapExternalError(error: unknown, cnpj: string): ReceitaFederalServiceError {
  if (axios.isAxiosError(error)) {
    const providerStatusCode = error.response?.status;

    if (providerStatusCode === 404) {
      return new ReceitaFederalServiceError(
        'CNPJ_NAO_ENCONTRADO',
        `CNPJ ${cnpj} não encontrado na base pública consultada.`,
        404,
        providerStatusCode,
      );
    }

    if (error.code === 'ECONNABORTED' || error.message.toLowerCase().includes('timeout')) {
      return new ReceitaFederalServiceError(
        'RECEITA_TIMEOUT',
        'Tempo limite excedido ao consultar dados públicos da Receita Federal.',
        504,
        providerStatusCode,
      );
    }

    return new ReceitaFederalServiceError(
      'RECEITA_INDISPONIVEL',
      'Serviço público de CNPJ indisponível no momento.',
      502,
      providerStatusCode,
    );
  }

  return new ReceitaFederalServiceError(
    'RECEITA_INDISPONIVEL',
    error instanceof Error ? error.message : 'Falha desconhecida ao consultar dados públicos da Receita Federal.',
    502,
  );
}

function normalizeRequiredString(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeNullableString(value: string | null | undefined): string | null {
  const normalized = normalizeRequiredString(value);
  return normalized || null;
}

function normalizeNullableNumber(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function getBrasilApiBaseUrl() {
  return (process.env.BRASILAPI_URL || 'https://brasilapi.com.br').replace(/\/+$/, '');
}

function getNumberEnv(name: string, fallback: number) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
