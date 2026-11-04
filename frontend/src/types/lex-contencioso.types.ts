export interface CitacaoJuridica {
  id?: string;
  fonte: string;
  artigoOuNorma: string;
  autoridade: string;
  ementaOuTeor: string;
  aplicabilidadeContrarrazao: string;
}

export interface PontoRefutado {
  alegacaoAdversaria: string;
  fundamentoDefesa: string;
  dispositivoLegal: string;
}

export interface AnalyzeRivalResult {
  resumoRecursoConcorrente: string;
  tesesAlegadasPeloConcorrente: string[];
  contrarazaoMarkdown: string;
  citacoesMapeadas: CitacaoJuridica[];
  pontosChaveRefutados: PontoRefutado[];
  conclusaoEstrategica: string;
  metadadosProcessamento: {
    totalCaracteresPdf: number;
    totalPaginas: number;
    modeloUtilizado: string;
    tempoProcessamentoSegundos: number;
  };
}

