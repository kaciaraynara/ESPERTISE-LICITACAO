export interface CitacaoJuridica {
  id?: string;
  fonte: string; // Ex: "Lei 14.133/2021", "Acórdão TCU"
  artigoOuNorma: string; // Ex: "Art. 165, § 1º, I", "Acórdão 1211/2021-Plenário"
  autoridade: string; // Ex: "TCU", "AGU", "STJ"
  ementaOuTeor: string;
  aplicabilidadeContrarrazao: string; // Como esta citação derruba a tese adversária
}

export interface AnalyzeRivalInput {
  pdfBuffer: Buffer;
  nomeArquivo?: string;
  pregaoNumero?: string;
  nomeNossaEmpresa?: string;
  objetoLicitacao?: string;
}

export interface AnalyzeRivalResult {
  resumoRecursoConcorrente: string;
  tesesAlegadasPeloConcorrente: string[];
  contrarazaoMarkdown: string; // Contrarrazão recursal completa redigida pelo GPT-4o
  citacoesMapeadas: CitacaoJuridica[];
  pontosChaveRefutados: {
    alegacaoAdversaria: string;
    fundamentoDefesa: string;
    dispositivoLegal: string;
  }[];
  conclusaoEstrategica: string;
  metadadosProcessamento: {
    totalCaracteresPdf: number;
    totalPaginas: number;
    modeloUtilizado: string;
    tempoProcessamentoSegundos: number;
  };
}

