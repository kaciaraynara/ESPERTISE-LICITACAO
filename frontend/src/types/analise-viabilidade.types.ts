export interface ScoreViabilidade {
  percentual: number; // Ex: 85
  classificacao: string; // Ex: "VIÁVEL (ALTA VIABILIDADE)" | "MARGEM APERTADA" | "INVIÁVEL"
  descricao: string; // Ex: "Excelente oportunidade para participação"
}

export interface ItemResumo {
  titulo: string;
  status: string;
  riscosCount?: string;
  detalhe?: string;
}

export interface AnalisePrecos {
  nossoPreco: number;
  estimativaEdital: number;
  precoMinimoSustentavel?: number;
  custoProduto?: number;
  custoLogistico?: number;
  impostosValor?: number;
  taxasAdministrativas?: number;
  margemEstimadaPercent: number;
  margemEstimadaValor?: number;
}

export interface ExigenciaEdital {
  id: string;
  categoria: string;
  status: string;
  detalhe?: string;
}

export interface AnaliseViabilidadeData {
  editalId?: string;
  editalNumero: string;
  orgao?: string;
  objeto?: string;
  uf?: string | null;
  municipio?: string | null;
  modalidade?: string | null;
  dataAbertura?: string | null;
  score: ScoreViabilidade;
  resumo: ItemResumo[];
  precos: AnalisePrecos;
  exigencias: ExigenciaEdital[];
  radarConcorrencia?: Array<{
    eixo: string;
    nossoValor: number;
    concorrente1?: number;
    concorrente2?: number;
    concorrente3?: number;
  }>;
  lexAnalysis?: {
    parecerExequibilidade?: string;
    alertasRiscos?: string[];
    recomendacaoEstrategica?: string;
  };
  lex?: {
    parecerExequibilidade?: string;
    recomendacaoEstrategica?: string;
    alertas?: Array<{
      risco: 'Alto' | 'Médio' | 'Medio' | 'Atenção' | 'Atencao' | 'Baixo' | string;
      titulo?: string;
      mensagem?: string;
      texto?: string;
    } | string>;
  };
}