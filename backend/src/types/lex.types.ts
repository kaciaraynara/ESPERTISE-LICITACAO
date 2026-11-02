/**
 * Tipos e contratos conceituais para o LEX (Inteligência Jurídica e Estratégica do EXPERTISE).
 * 
 * Regra inegociável: distinção clara entre:
 * 1. Fato da fonte
 * 2. Cálculo reproduzível
 * 3. Indício
 * 4. Hipótese
 * 5. Inconclusivo
 */

export type LexEpistemicCategory =
  | 'Fato da fonte'
  | 'Cálculo reproduzível'
  | 'Indício'
  | 'Hipótese'
  | 'Inconclusivo';

export type LexIntent =
  | 'ESCLARECIMENTO_EDITAL'
  | 'ANALISE_HABILITACAO'
  | 'CALCULO_PRAZO_VALOR'
  | 'RISCO_IMPUGNACAO_RECURSO'
  | 'ANALISE_CONCORRENCIAL'
  | 'GERAL_NORMATIVA'
  | 'INSUFICIENTE_OU_FORA_DE_ESCOPO';

export type LexCertaintyLevel = 'alto' | 'medio' | 'baixo' | 'inconclusivo';

export interface LexEvidenceItem {
  fonte: string;
  identificador: string;
  trechoRelevante: string;
  tipoEpistemico: LexEpistemicCategory;
  confianca: number;
  metadata?: Record<string, unknown>;
}

export interface LexDeterministicCalculation {
  tipo: 'prazo_impugnacao' | 'prazo_recurso' | 'bdi' | 'variacao_desconto' | 'outro';
  formula: string;
  parametrosEntrada: Record<string, unknown>;
  resultado: unknown;
  descricao: string;
  fundamentacaoLegal?: string;
}

export interface LexEpistemicDistribution {
  fatos: number;
  calculos: number;
  indicios: number;
  hipoteses: number;
  inconclusivo: boolean;
}

export interface LexResponsePayload {
  resposta: string;
  intencao: LexIntent;
  fontes: LexEvidenceItem[];
  calculos: LexDeterministicCalculation[];
  dataConsulta: string;
  limitacoes: string[];
  nivelCerteza: LexCertaintyLevel;
  dadosFaltantes?: string[];
  distribuicaoEpistemica: LexEpistemicDistribution;
  status: 'sucesso' | 'inconclusivo' | 'bloqueado' | 'erro';
  aiRunId: string;
  retrievalSessionId?: string | null;
  provider?: string | null;
}
