// 📁 frontend/src/types/modulo-lex.types.ts

export interface PontoCritico {
  id: string;
  pagina: number;
  clausula: string; // Ex: "Cláusula 7.2.1"
  trechoEdital: string; // O texto original do PDF
  artigoViolado: string; // Ex: "Art. 67, § 1º da Lei 14.133/2021"
  descricaoIrregularidade: string;
  gravidade: 'alta' | 'media' | 'baixa';
  sugestaoImpugnacao: string;
}

export interface RiscoIrregularidade {
  score: number; // Ex: 87
  nivel: 'ALTO' | 'MÉDIO' | 'BAIXO';
  leiReferencia: string; // "Lei 14.133/2021"
  resumoJuridico: string;
}

export interface AnaliseLexData {
  editalId: string;
  numeroEdital: string; // Ex: "Pregão Eletrônico nº 015/2024"
  orgaoComprador: string; // Ex: "Prefeitura Municipal de São Paulo"
  totalPaginas: number;
  risco: RiscoIrregularidade;
  pontosCriticos: PontoCritico[];
}

export interface MinutaRecursoRequest {
  editalId: string;
  pontosCriticosIds: string[];
  razaoSocialEmpresa: string;
  cnpjEmpresa: string;
}

export interface MinutaRecursoResponse {
  minutaId: string;
  titulo: string;
  conteudoMarkdown: string;
  dataGeracao: string;
}