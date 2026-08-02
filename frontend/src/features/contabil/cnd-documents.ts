export type CndStatus =
  | 'regular'
  | 'atencao'
  | 'critica'
  | 'pendente';

export type DocumentoApiRecord = {
  id: string;
  user_id?: string;
  empresa_id?: string | null;
  tipo: string;
  nome: string;
  validade?: string | null;
  status?: string | null;
  url?: string | null;
  arquivo_nome?: string | null;
  criado_em?: string | null;
  atualizado_em?: string | null;
};

export type CndDocumentRecord = {
  id: string;
  empresaId: string | null;
  nome: string;
  tipo: string;
  status: CndStatus;
  vencimento: string | null;
  url: string | null;
  arquivoNome: string | null;
  atualizadoEm: string | null;
};

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function parseDocumentDate(
  value?: string | null,
): Date | null {
  if (!value) {
    return null;
  }

  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);

  const date = new Date(
    isDateOnly ? `${value}T12:00:00` : value,
  );

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

export function isCndDocument(
  documento: DocumentoApiRecord,
): boolean {
  const searchable = normalizeText(
    `${documento.tipo} ${documento.nome}`,
  );

  const certificateTerms = [
    'certidao',
    'cnd',
    'cndt',
    'crf',
    'fgts',
    'regularidade fiscal',
    'regularidade trabalhista',
    'sicaf',
    'alvara',
  ];

  return certificateTerms.some((term) =>
    searchable.includes(term),
  );
}

export function daysUntilCnd(
  value?: string | null,
): number | null {
  const dueDate = parseDocumentDate(value);

  if (!dueDate) {
    return null;
  }

  dueDate.setHours(12, 0, 0, 0);

  const today = new Date();
  today.setHours(12, 0, 0, 0);

  return Math.ceil(
    (dueDate.getTime() - today.getTime()) / 86_400_000,
  );
}

export function calculateCndStatus(
  validade?: string | null,
): CndStatus {
  const days = daysUntilCnd(validade);

  if (days === null) {
    return 'pendente';
  }

  if (days < 0) {
    return 'critica';
  }

  if (days <= 15) {
    return 'atencao';
  }

  return 'regular';
}

export function mapDocumentoToCnd(
  documento: DocumentoApiRecord,
): CndDocumentRecord {
  return {
    id: documento.id,
    empresaId: documento.empresa_id ?? null,
    nome: documento.nome,
    tipo: documento.tipo,
    status: calculateCndStatus(documento.validade),
    vencimento: documento.validade ?? null,
    url: documento.url ?? null,
    arquivoNome: documento.arquivo_nome ?? null,
    atualizadoEm:
      documento.atualizado_em
      ?? documento.criado_em
      ?? null,
  };
}

export function cndStatusLabel(
  status: CndStatus,
): string {
  if (status === 'regular') {
    return 'Regular';
  }

  if (status === 'atencao') {
    return 'Atenção';
  }

  if (status === 'critica') {
    return 'Vencida';
  }

  return 'Sem validade';
}

export function cndStatusClass(
  status: CndStatus,
): string {
  if (status === 'regular') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  }

  if (status === 'atencao') {
    return 'border-amber-200 bg-amber-50 text-amber-800';
  }

  if (status === 'critica') {
    return 'border-red-200 bg-red-50 text-red-800';
  }

  return 'border-slate-200 bg-slate-50 text-slate-600';
}

export function formatCndDate(
  value?: string | null,
): string {
  if (!value) {
    return 'Não informada';
  }

  const date = parseDocumentDate(value);

  if (!date) {
    return 'Data inválida';
  }

  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatCndDateTime(
  value?: string | null,
): string {
  if (!value) {
    return 'Não informada';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Data inválida';
  }

  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
