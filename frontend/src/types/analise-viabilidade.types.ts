export interface ScoreViabilidade {
  percentual: number; // Ex: 85
  classificacao: 'ALTA VIABILIDADE' | 'MEDIA VIABILIDADE' | 'BAIXA VIABILIDADE';
  descricao: string; // Ex: "Excelente oportunidade para participação"
}

export interface ItemResumo {
  titulo: string;
  status: 'Concluído' | 'Pendente' | 'Em Análise';
  riscosCount?: string; // Ex: "2 riscos baixos"
}

export interface AnalisePrecos {
  nossoPreco: number; // Ex: 245000.00
  estimativaEdital: number; // Ex: 280000.00
  margemEstimadaPercent: number; // Ex: 12.5
}

export interface EixoConcorrencia {
  eixo: 'Preço' | 'Qualidade Técnica' | 'Capacidade' | 'Histórico' | 'Prazo';
  nossoValor: number; // Escala de 0 a 100
  concorrente1: number;
  concorrente2: number;
  concorrente3: number;
}

export interface ExigenciaEdital {
  id: string;
  categoria: string; // Ex: "Qualificação Técnica"
  status: 'Atendido' | 'Atenção' | 'Não exigida';
}

export interface AnaliseViabilidadeData {
  editalNumero: string;
  score: ScoreViabilidade;
  resumo: ItemResumo[];
  precos: AnalisePrecos;
  radarConcorrencia: EixoConcorrencia[];
  exigencias: ExigenciaEdital[];
}