export type CategoriaDocumento = 
  | 'REGULARIDADE_FISCAL' 
  | 'HABILITACAO_JURIDICA' 
  | 'QUALIFICACAO_TECNICA' 
  | 'QUALIFICACAO_FINANCEIRA';

export type StatusValidade = 'VALIDO' | 'ALERTA_VENCIMENTO' | 'VENCIDO';

export interface DocumentoCofre {
  id: string;
  nome: string; // Ex: "CND Federal - Tributos e Dívida Ativa"
  categoria: CategoriaDocumento;
  orgaoEmissor: string; // Ex: "Receita Federal / PGFN"
  dataEmissao: string;
  dataValidade: string;
  diasParaVencer: number;
  status: StatusValidade;
  versao: string;
  tamanhoArquivo: string;
  tag: string; // Ex: "Obrigatório"
  arquivoUrl: string;
}

export interface MetricasCofre {
  totalDocumentos: number;
  validos: number;
  prestesAVencer: number;
  vencidos: number;
}