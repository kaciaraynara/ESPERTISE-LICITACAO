import axios, { AxiosInstance } from 'axios';

// ─── Tipos ────────────────────────────────────────────────────────────────────
export interface GovBrConta {
  id: string;                   // CPF do cidadão
  name: string;                 // Nome completo
  email: string;
  emailVerified: string;
  phoneNumber: string;
  phoneNumberVerified: string;
  status: string;
  creationLocalDateTime: string;
}

export interface GovBrConfiabilidade {
  confiabilidade: {
    id: string;
    categoria: string;          // ex: "bb_internet_banking"
    titulo: string;             // ex: "internet_banking"
    descricao: string;
  };
  dataCriacao: string;
  dataAtualizacao: string;
}

export type NivelConfiabilidade = 'bronze' | 'prata' | 'ouro' | 'desconhecido';

// ─── Token Cache (evita chamadas desnecessárias) ──────────────────────────────
let _tokenCache: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (_tokenCache && Date.now() < _tokenCache.expiresAt) {
    return _tokenCache.token;
  }

  const clientId     = process.env.GOVBR_CLIENT_ID;
  const clientSecret = process.env.GOVBR_CLIENT_SECRET;
  const tokenUrl     = process.env.GOVBR_TOKEN_URL || 'https://apigateway.conectagov.estaleiro.serpro.gov.br/oauth2/jwt-token';

  if (!clientId || !clientSecret) {
    throw new Error('Credenciais Gov.br não configuradas (GOVBR_CLIENT_ID / GOVBR_CLIENT_SECRET)');
  }

  const params = new URLSearchParams();
  params.append('grant_type', 'client_credentials');

  const response = await axios.post(tokenUrl, params, {
    auth: { username: clientId, password: clientSecret },
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 10000,
  });

  const { access_token, expires_in } = response.data;
  // Armazena com margem de 5 minutos (300s)
  _tokenCache = {
    token: access_token,
    expiresAt: Date.now() + ((expires_in - 300) * 1000),
  };

  console.log('[GovBr] Token OAuth2 obtido com sucesso');
  return access_token;
}

// ─── Cliente HTTP com token automático ───────────────────────────────────────
const GOVBR_BASE = process.env.GOVBR_BASE_URL || 'https://apigateway.conectagov.estaleiro.serpro.gov.br';

async function createClient(cpfOperador: string): Promise<AxiosInstance> {
  const token = await getAccessToken();

  return axios.create({
    baseURL: GOVBR_BASE,
    timeout: 15000,
    headers: {
      Authorization: `Bearer ${token}`,
      'x-cpf-usuario': cpfOperador,
      Accept: 'application/json',
      'User-Agent': 'Expertise-SaaS/1.0',
    },
  });
}

// ─── Funções principais ───────────────────────────────────────────────────────

/**
 * Consulta dados de uma conta Gov.br pelo CPF
 */
export async function consultarContaGovBr(cpf: string, cpfOperador: string): Promise<GovBrConta> {
  const cpfLimpo = cpf.replace(/\D/g, '');
  const client   = await createClient(cpfOperador);
  const response = await client.get(`/api-govbr-contas/v1/contas/${cpfLimpo}`);
  return response.data as GovBrConta;
}

/**
 * Consulta o nível de confiabilidade Gov.br de um CPF
 */
export async function consultarConfiabilidade(cpf: string, cpfOperador: string): Promise<GovBrConfiabilidade[]> {
  const cpfLimpo = cpf.replace(/\D/g, '');
  const client   = await createClient(cpfOperador);
  const response = await client.get(`/api-govbr-confiabilidades/v1/confiabilidades/${cpfLimpo}`);
  // A API pode retornar um objeto ou array — normalizamos para array
  const raw = response.data;
  return Array.isArray(raw) ? raw : [raw];
}

/**
 * Determina o nível de confiabilidade (Bronze/Prata/Ouro) a partir das confiabilidades
 * Lógica baseada nas categorias retornadas pelo Serpro
 */
export function calcularNivelConfiabilidade(confiabilidades: GovBrConfiabilidade[]): {
  nivel: NivelConfiabilidade;
  descricao: string;
  pontos: number;
} {
  const cats = confiabilidades.map((c) => c.confiabilidade?.categoria?.toLowerCase() || '');

  // Nível Ouro: biometria facial, certificado digital A3
  const isOuro = cats.some((c) =>
    c.includes('biometria') || c.includes('certificado_digital') || c.includes('a3') || c.includes('ouro')
  );

  // Nível Prata: validação bancária (BB, CEF), validação via cartão de crédito, detentos
  const isPrata = cats.some((c) =>
    c.includes('internet_banking') || c.includes('banco') || c.includes('bb_') ||
    c.includes('caixa') || c.includes('cartao') || c.includes('prata') ||
    c.includes('validacaobalcao')
  );

  if (isOuro) {
    return { nivel: 'ouro', descricao: 'Verificação biométrica ou via certificado digital A3', pontos: 3 };
  }
  if (isPrata) {
    return { nivel: 'prata', descricao: 'Verificação via Internet Banking ou validação presencial', pontos: 2 };
  }
  if (confiabilidades.length > 0) {
    return { nivel: 'bronze', descricao: 'Conta Gov.br com validação básica', pontos: 1 };
  }
  return { nivel: 'desconhecido', descricao: 'Sem dados de confiabilidade', pontos: 0 };
}

/**
 * Consulta completa: conta + confiabilidade em paralelo
 */
export async function consultarPerfilCompleto(
  cpf: string,
  cpfOperador: string
): Promise<{
  conta: GovBrConta;
  confiabilidades: GovBrConfiabilidade[];
  nivel: ReturnType<typeof calcularNivelConfiabilidade>;
}> {
  const [conta, confiabilidades] = await Promise.all([
    consultarContaGovBr(cpf, cpfOperador),
    consultarConfiabilidade(cpf, cpfOperador),
  ]);

  return {
    conta,
    confiabilidades,
    nivel: calcularNivelConfiabilidade(confiabilidades),
  };
}
