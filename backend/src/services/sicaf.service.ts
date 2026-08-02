/**
 * Integração SICAF.
 *
 * Este módulo nunca retorna dados simulados.
 * Enquanto a integração oficial/autorizada não estiver implementada,
 * qualquer tentativa de consulta falha de forma explícita e rastreável.
 */

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
  return Boolean(
    process.env.SICAF_API_BASE_URL?.trim()
      && process.env.GOVBR_CLIENT_ID?.trim()
      && process.env.GOVBR_CLIENT_SECRET?.trim(),
  );
}

/**
 * Consulta SICAF.
 *
 * A função permanece fechada até existir uma implementação oficial,
 * autorizada, testada e auditável.
 */
export async function consultarSicaf(cnpj: string): Promise<SicafFornecedor> {
  const cnpjNormalizado = cnpj.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

  if (!cnpjNormalizado) {
    throw new TypeError('CNPJ obrigatório para consulta ao SICAF.');
  }

  if (!isSicafConfigured()) {
    throw new SicafIntegrationError(
      'SICAF_INTEGRATION_NOT_CONFIGURED',
      'A integração oficial com o SICAF não está configurada.',
    );
  }

  /*
   * Mesmo com variáveis presentes, não devemos consultar uma API
   * até existir um cliente oficial implementado e validado.
   */
  throw new SicafIntegrationError(
    'SICAF_INTEGRATION_NOT_IMPLEMENTED',
    'As credenciais SICAF estão configuradas, mas o conector oficial ainda não foi implementado.',
  );
}

/**
 * Retorna somente um endereço para consulta manual no portal oficial.
 * Não representa consulta, validação ou confirmação automática.
 */
export function getLinkConsultaSicaf(cnpj: string): string {
  const cnpjNormalizado = cnpj.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

  return (
    'https://www.gov.br/compras/pt-br/acesso-a-informacao/'
    + `sicaf/pesquisa-de-fornecedores?cnpj=${encodeURIComponent(cnpjNormalizado)}`
  );
}

/**
 * Avalia somente um objeto proveniente de integração real.
 * Esta função não busca, completa nem fabrica informações.
 */
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

  if (certidoesVencidas >= 2) {
    motivos.push(`${certidoesVencidas} certidões vencidas`);
  }

  if (habilitacoesPendentes > 0) {
    motivos.push(`${habilitacoesPendentes} habilitações pendentes`);
  }

  if (fornecedor.situacao_cadastral !== 'ativo') {
    motivos.push('Situação cadastral não ativa');
  }

  const nivel =
    motivos.length === 0
      ? 'baixo'
      : motivos.length === 1
        ? 'medio'
        : 'alto';

  return { nivel, motivos };
}
