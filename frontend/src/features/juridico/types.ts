export type PlanoJuridicoId =
  | 'juridico_essencial'
  | 'juridico_profissional';

export type StatusCasoJuridico = 'novo' | 'em_andamento' | 'concluido';

export type PlanoJuridico = {
  id: PlanoJuridicoId;
  nome: string;
  valor: number;
  descricao: string;
  features: string[];
};

export type AssinaturaJuridica = {
  plano: string;
  categoria: 'plataforma' | 'juridico';
  status: 'active' | 'canceled' | 'past_due' | 'trialing';
  periodo_fim: string;
  cancelar_ao_fim: boolean;
};

export type Advogado = {
  id: string;
  user_id: string;
  nome_exibicao: string;
  oab_numero: string;
  oab_uf: string;
  especialidades: string[];
  cidade: string | null;
  uf: string | null;
  bio: string | null;
  contato_publico: string | null;
  plano_mensal: PlanoJuridicoId;
  status: 'ativo' | 'analise' | 'pausado';
  casos_ativos: number;
  avaliacao_media?: number | null;
  avaliacoes_total?: number;
  diretorio_liberado?: boolean;
  assinatura_juridica?: AssinaturaJuridica | null;
};

export type MensagemJuridica = {
  id: string;
  sender_user_id: string;
  sender_tipo: 'cliente' | 'advogado';
  sender_nome: string;
  conteudo: string;
  created_at: string;
};

export type CasoJuridico = {
  id: string;
  assunto: string;
  edital_id: string | null;
  edital_objeto: string | null;
  descricao: string;
  telefone_cliente: string | null;
  status: StatusCasoJuridico;
  created_at: string;
  updated_at: string;
  client: {
    id: string;
    nome: string;
    telefone: string | null;
    email: string | null;
  };
  lawyer: {
    id: string;
    nome_exibicao: string;
    oab: string;
    especialidades: string[];
    plano_mensal: PlanoJuridicoId;
  } | null;
  messages: MensagemJuridica[];
  triagem: {
    fila: 'novos' | 'aguardando_advogado' | 'aguardando_cliente' | 'concluidos';
    prioridade: 'critica' | 'alta' | 'media' | 'baixa';
    score: number;
    aguardando: 'advogado' | 'cliente' | 'encerrado';
    horas_desde_ultima_interacao: number;
    resumo: string;
  };
  review: {
    id: string;
    nota: number;
    comentario: string | null;
    created_at: string;
    client_user_id: string;
  } | null;
  pode_avaliar: boolean;
};

export type SalvarPerfilJuridicoPayload = {
  nome_exibicao?: string;
  oab_numero: string;
  oab_uf: string;
  especialidades: string[] | string;
  cidade?: string;
  uf?: string;
  bio?: string;
  contato_publico?: string;
  plano_mensal: PlanoJuridicoId;
};

export type AbrirCasoJuridicoPayload = {
  lawyer_user_id: string;
  assunto: string;
  edital_id?: string;
  edital_objeto?: string;
  descricao: string;
  telefone_cliente?: string;
};