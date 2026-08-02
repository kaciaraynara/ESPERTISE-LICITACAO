import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileText,
  FolderOpen,
  Loader2,
  RefreshCw,
  Search,
  UploadCloud,
  XCircle,
} from '@components/icons/phosphor-compat';
import { documentosApi, empresasApi } from '@services/api';

const DOCUMENT_TYPES = [
  'CND Federal',
  'CND Estadual',
  'CND Municipal',
  'CNDT',
  'FGTS',
  'SICAF',
  'Contrato social',
  'Balanço patrimonial',
  'Atestado de capacidade técnica',
  'Alvará de funcionamento',
  'Outro',
] as const;
type DocumentType = (typeof DOCUMENT_TYPES)[number];

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_FILE_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
]);

type DocumentHealth = 'valido' | 'atencao' | 'vencido' | 'sem_validade';
type DocumentFilter = 'todos' | DocumentHealth;

interface Company {
  id: string;
  cnpj: string;
  razao_social: string;
  nome_fantasia?: string | null;
}

interface DocumentRecord {
  id: string;
  empresa_id?: string | null;
  tipo: string;
  nome: string;
  validade: string | null;
  status: 'valido' | 'atencao' | 'vencido' | 'sem_validade';
  url?: string | null;
  arquivo_nome?: string | null;
  criado_em: string;
  atualizado_em?: string;
}

interface DocumentView extends DocumentRecord {
  health: DocumentHealth;
  daysRemaining: number | null;
}

function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function daysUntil(value?: string | null): number | null {
  const date = parseDate(value);
  if (!date) return null;
  return Math.ceil((date.getTime() - Date.now()) / 86_400_000);
}

function resolveHealth(documento: DocumentRecord): DocumentHealth {
  const remaining = daysUntil(documento.validade);
  if (remaining === null) return 'sem_validade';
  if (remaining < 0) return 'vencido';
  if (remaining <= 30) return 'atencao';
  return 'valido';
}

function formatDate(value?: string | null): string {
  const parsed = parseDate(value);
  if (!parsed) return 'Não informada';
  return new Intl.DateTimeFormat('pt-BR').format(parsed);
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    return error.response?.data?.message ?? fallback;
  }
  return fallback;
}

function StatusBadge({ health, daysRemaining }: Pick<DocumentView, 'health' | 'daysRemaining'>) {
  const config: Record<DocumentHealth, { label: string; className: string }> = {
    valido: {
      label: 'Regular',
      className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    },
    atencao: {
      label: daysRemaining === 0 ? 'Vence hoje' : `Vence em ${daysRemaining} dia(s)`,
      className: 'border-amber-200 bg-amber-50 text-amber-700',
    },
    vencido: {
      label: 'Vencido',
      className: 'border-red-200 bg-red-50 text-red-700',
    },
    sem_validade: {
      label: 'Sem validade',
      className: 'border-slate-200 bg-slate-50 text-slate-600',
    },
  };

  const current = config[health];
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold ${current.className}`}>
      {current.label}
    </span>
  );
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">{value}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>
    </article>
  );
}

export default function CofrePage() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<DocumentFilter>('todos');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState<DocumentType | ''>('');
  const [expiresAt, setExpiresAt] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState('');

  const storageQuery = useQuery({
    queryKey: ['documents', 'storage-status'],
    queryFn: async () => {
      const response = await documentosApi.status();
      if (
        response.data?.success !== true
        || typeof response.data?.data?.available !== 'boolean'
      ) {
        throw new Error('DOCUMENT_STORAGE_STATUS_INVALID_RESPONSE');
      }
      return response.data.data.available;
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const companiesQuery = useQuery({
    queryKey: ['companies', 'document-vault'],
    queryFn: async () => {
      const response = await empresasApi.listar();
      if (response.data?.success !== true || !Array.isArray(response.data.data)) {
        throw new Error('COMPANIES_INVALID_RESPONSE');
      }
      return response.data.data as Company[];
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const companies = companiesQuery.data ?? [];
  const company = companies.find((item) => item.id === selectedCompanyId)
    ?? companies[0]
    ?? null;

  const documentsQuery = useQuery({
    queryKey: ['documents', company?.id],
    enabled: Boolean(company?.id) && storageQuery.data === true,
    queryFn: async () => {
      const response = await documentosApi.listar({ empresa_id: company!.id });
      if (response.data?.success !== true || !Array.isArray(response.data.data)) {
        throw new Error('DOCUMENTS_INVALID_RESPONSE');
      }
      return response.data.data as DocumentRecord[];
    },
    staleTime: 60 * 1000,
    retry: false,
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!company || !selectedFile || !documentType || storageQuery.data !== true) {
        throw new Error('UPLOAD_INCOMPLETE');
      }

      const formData = new FormData();
      formData.append('arquivo', selectedFile);
      formData.append('tipo', documentType);
      formData.append('nome', selectedFile.name.replace(/\.(pdf|png|jpe?g)$/i, ''));
      formData.append('empresa_id', company.id);
      if (expiresAt) formData.append('validade', expiresAt);

      return documentosApi.upload(formData);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['documents', company?.id] });
      setSelectedFile(null);
      setExpiresAt('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      toast.success('Arquivo enviado e vinculado à empresa.');
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => documentosApi.remover(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['documents', company?.id] });
      toast.success('Documento removido.');
    },
  });

  const documents = useMemo<DocumentView[]>(
    () => (documentsQuery.data ?? []).map((documento) => ({
      ...documento,
      health: resolveHealth(documento),
      daysRemaining: daysUntil(documento.validade),
    })),
    [documentsQuery.data],
  );

  const filteredDocuments = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR');
    return documents.filter((documento) => {
      const matchesTerm = !term
        || documento.nome.toLocaleLowerCase('pt-BR').includes(term)
        || documento.tipo.toLocaleLowerCase('pt-BR').includes(term)
        || (documento.arquivo_nome ?? '').toLocaleLowerCase('pt-BR').includes(term);
      const matchesFilter = filter === 'todos' || documento.health === filter;
      return matchesTerm && matchesFilter;
    });
  }, [documents, filter, search]);

  const counters = useMemo(() => ({
    total: documents.length,
    valid: documents.filter((item) => item.health === 'valido').length,
    attention: documents.filter((item) => item.health === 'atencao').length,
    expired: documents.filter((item) => item.health === 'vencido').length,
  }), [documents]);

  function chooseFile(file: File | undefined) {
    if (!file) return;
    if (!ACCEPTED_FILE_TYPES.has(file.type)) {
      toast.error('Formato inválido. Envie PDF, PNG ou JPG.');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error('O arquivo deve ter no máximo 10 MB.');
      return;
    }
    setSelectedFile(file);
  }

  async function submitUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFile) {
      toast.error('Selecione um arquivo antes de enviar.');
      return;
    }
    if (!documentType) {
      toast.error('Selecione o tipo do documento.');
      return;
    }
    await uploadMutation.mutateAsync().catch(() => undefined);
  }

  async function removeDocument(documento: DocumentView) {
    const confirmed = window.confirm(`Remover o documento "${documento.nome}"?`);
    if (!confirmed) return;
    await removeMutation.mutateAsync(documento.id).catch(() => undefined);
  }

  if (companiesQuery.isLoading) {
    return (
      <section className="mx-auto flex min-h-[60vh] max-w-4xl items-center justify-center px-6" aria-busy="true">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-brand-blue" aria-hidden="true" />
          <h1 className="mt-4 text-xl font-bold text-slate-900">Carregando documentos</h1>
          <p className="mt-2 text-sm text-slate-500">Validando a empresa vinculada à conta.</p>
        </div>
      </section>
    );
  }

  if (companiesQuery.isError) {
    return (
      <section className="mx-auto flex min-h-[60vh] max-w-3xl items-center justify-center px-6 text-center">
        <div>
          <AlertTriangle className="mx-auto h-10 w-10 text-amber-600" aria-hidden="true" />
          <h1 className="mt-4 text-2xl font-bold text-slate-900">Não foi possível consultar sua empresa</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {getErrorMessage(companiesQuery.error, 'O serviço de empresas está indisponível. Nenhum dado foi substituído por conteúdo local.')}
          </p>
          <button
            type="button"
            onClick={() => void companiesQuery.refetch()}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand-blue px-5 py-3 text-sm font-bold text-white"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Tentar novamente
          </button>
        </div>
      </section>
    );
  }

  if (!company) {
    return (
      <section className="mx-auto flex min-h-[60vh] max-w-3xl items-center justify-center px-6 text-center">
        <div>
          <Building2 className="mx-auto h-10 w-10 text-brand-blue" aria-hidden="true" />
          <h1 className="mt-4 text-2xl font-bold text-slate-900">Nenhuma empresa vinculada</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Os documentos exigem uma empresa válida vinculada à conta. Revise o cadastro antes de enviar arquivos.
          </p>
          <button
            type="button"
            onClick={() => void companiesQuery.refetch()}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand-blue px-5 py-3 text-sm font-bold text-white"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Verificar novamente
          </button>
        </div>
      </section>
    );
  }

  if (storageQuery.isLoading) {
    return (
      <section className="mx-auto flex min-h-[60vh] max-w-4xl items-center justify-center px-6" aria-busy="true">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-brand-blue" aria-hidden="true" />
          <h1 className="mt-4 text-xl font-bold text-slate-900">Validando armazenamento seguro</h1>
          <p className="mt-2 text-sm text-slate-500">Consultando a configuração real do serviço.</p>
        </div>
      </section>
    );
  }

  if (storageQuery.isError || storageQuery.data !== true) {
    return (
      <section className="mx-auto flex min-h-[60vh] max-w-3xl items-center justify-center px-6 text-center">
        <div>
          <AlertTriangle className="mx-auto h-10 w-10 text-amber-600" aria-hidden="true" />
          <h1 className="mt-4 text-2xl font-bold text-slate-900">
            Armazenamento documental indisponível
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {storageQuery.isError
              ? 'Não foi possível validar o serviço de arquivos. Nenhum armazenamento local foi usado como alternativa.'
              : 'O Supabase Storage privado ainda não foi configurado neste ambiente. O envio de arquivos permanece bloqueado para evitar registros sem documento real.'}
          </p>
          <button
            type="button"
            onClick={() => void storageQuery.refetch()}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand-blue px-5 py-3 text-sm font-bold text-white"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Verificar novamente
          </button>
        </div>
      </section>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] px-5 py-7 sm:px-8 sm:py-9 lg:px-8 lg:py-9 bg-slate-50 min-h-screen">
      <header className="flex flex-col gap-6 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 border-l-4 border-brand-orange pl-3">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Documentos do Licitante
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="rounded-full bg-slate-200 px-4 py-1.5 text-xs font-bold text-slate-600">
            CNPJ: {company.cnpj}
          </span>
          <button
            type="button"
            onClick={() => {
              void companiesQuery.refetch();
              void documentsQuery.refetch();
            }}
            disabled={companiesQuery.isFetching || documentsQuery.isFetching}
            className="inline-flex items-center gap-2 rounded-xl bg-white border border-slate-200 px-5 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 transition"
          >
            <RefreshCw className={`h-4 w-4 ${companiesQuery.isFetching || documentsQuery.isFetching ? 'animate-spin' : ''}`} aria-hidden="true" />
            Atualizar
          </button>
        </div>
      </header>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Resumo documental">
          <MetricCard label="Arquivos cadastrados" value={counters.total} detail="Total retornado pela API" />
          <MetricCard label="Regulares" value={counters.valid} detail="Validade superior a 30 dias" />
          <MetricCard label="Atenção" value={counters.attention} detail="Vencimento em até 30 dias" />
          <MetricCard label="Vencidos" value={counters.expired} detail="Prazo de validade encerrado" />
        </section>

        <div className="mt-6 grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <aside>
            <form onSubmit={submitUpload} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-brand-blue">
                  <UploadCloud className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="font-bold text-slate-900">Enviar documento</h2>
                  <p className="text-xs text-slate-500">PDF, PNG ou JPG de até 10 MB</p>
                </div>
              </div>

              <div className="mt-5 space-y-4">
                {companies.length > 1 && (
                  <label className="block">
                    <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-600">Empresa</span>
                    <select
                      value={company.id}
                      onChange={(event) => setSelectedCompanyId(event.target.value)}
                      className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-brand-blue focus:ring-2 focus:ring-blue-100"
                    >
                      {companies.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.nome_fantasia || item.razao_social}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <label className="block">
                  <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-600">Tipo documental</span>
                  <select
                    required
                    value={documentType}
                    onChange={(event) => setDocumentType(event.target.value as DocumentType | '')}
                    className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-brand-blue focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="" disabled>Selecione o tipo</option>
                    {DOCUMENT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-600">Validade, se aplicável</span>
                  <input
                    type="date"
                    value={expiresAt}
                    onChange={(event) => setExpiresAt(event.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm text-slate-800 outline-none focus:border-brand-blue focus:ring-2 focus:ring-blue-100"
                  />
                </label>

                <div>
                  <input
                    ref={fileInputRef}
                    id="document-file"
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    className="sr-only"
                    onChange={(event) => chooseFile(event.target.files?.[0])}
                  />
                  <label
                    htmlFor="document-file"
                    className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center transition hover:border-brand-blue hover:bg-blue-50/40"
                  >
                    <FileText className="h-6 w-6 text-brand-blue" aria-hidden="true" />
                    <span className="mt-2 max-w-full truncate text-sm font-bold text-slate-700">
                      {selectedFile?.name ?? 'Selecionar arquivo'}
                    </span>
                    <span className="mt-1 text-xs text-slate-500">A classificação é definida por você.</span>
                  </label>
                </div>

                {uploadMutation.isError && (
                  <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-700">
                    {getErrorMessage(uploadMutation.error, 'Não foi possível enviar o documento.')}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={!selectedFile || !documentType || uploadMutation.isPending}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-orange px-4 py-3 text-sm font-bold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {uploadMutation.isPending
                    ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    : <UploadCloud className="h-4 w-4" aria-hidden="true" />}
                  {uploadMutation.isPending ? 'Enviando arquivo...' : 'Enviar documento'}
                </button>
              </div>
            </form>
          </aside>

          <section className="min-w-0">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="relative w-full lg:max-w-md">
                  <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                  <label htmlFor="document-search" className="sr-only">Buscar documentos</label>
                  <input
                    id="document-search"
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar por nome, tipo ou arquivo"
                    className="h-11 w-full rounded-xl border border-slate-300 pl-10 pr-3 text-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <div className="flex flex-wrap gap-2" aria-label="Filtrar documentos por situação">
                  {([
                    ['todos', 'Todos'],
                    ['valido', 'Regulares'],
                    ['atencao', 'Atenção'],
                    ['vencido', 'Vencidos'],
                    ['sem_validade', 'Sem validade'],
                  ] as Array<[DocumentFilter, string]>).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setFilter(value)}
                      aria-pressed={filter === value}
                      className={`rounded-lg px-3 py-2 text-xs font-bold transition ${
                        filter === value
                          ? 'bg-brand-blue text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {documentsQuery.isLoading && (
              <div className="mt-4 flex min-h-56 items-center justify-center rounded-2xl border border-slate-200 bg-white" aria-busy="true">
                <div className="text-center">
                  <Loader2 className="mx-auto h-7 w-7 animate-spin text-brand-blue" aria-hidden="true" />
                  <p className="mt-3 text-sm font-semibold text-slate-600">Consultando documentos...</p>
                </div>
              </div>
            )}

            {documentsQuery.isError && (
              <div className="mt-4 flex min-h-56 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
                <div>
                  <AlertTriangle className="mx-auto h-8 w-8 text-amber-700" aria-hidden="true" />
                  <h2 className="mt-3 text-lg font-bold text-slate-900">Documentos indisponíveis</h2>
                  <p className="mt-2 max-w-lg text-sm leading-6 text-slate-600">
                    {getErrorMessage(documentsQuery.error, 'A API não retornou seus documentos. Este erro não foi convertido em uma lista vazia.')}
                  </p>
                  <button
                    type="button"
                    onClick={() => void documentsQuery.refetch()}
                    className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-blue px-4 py-2.5 text-sm font-bold text-white"
                  >
                    <RefreshCw className="h-4 w-4" aria-hidden="true" />
                    Tentar novamente
                  </button>
                </div>
              </div>
            )}

            {!documentsQuery.isLoading && !documentsQuery.isError && filteredDocuments.length === 0 && (
              <div className="mt-4 flex min-h-56 items-center justify-center rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
                <div>
                  <FolderOpen className="mx-auto h-9 w-9 text-slate-400" aria-hidden="true" />
                  <h2 className="mt-3 text-lg font-bold text-slate-900">
                    {documents.length === 0 ? 'Nenhum arquivo enviado' : 'Nenhum resultado para este filtro'}
                  </h2>
                  <p className="mt-2 text-sm text-slate-500">
                    {documents.length === 0
                      ? 'Use o formulário ao lado para enviar o primeiro documento real da empresa.'
                      : 'Ajuste a busca ou selecione outra situação.'}
                  </p>
                </div>
              </div>
            )}

            {!documentsQuery.isLoading && !documentsQuery.isError && filteredDocuments.length > 0 && (
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                {filteredDocuments.map((documento) => (
                  <article key={documento.id} className="flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-brand-blue">
                        <FileText className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <StatusBadge health={documento.health} daysRemaining={documento.daysRemaining} />
                    </div>

                    <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.13em] text-brand-blue">{documento.tipo}</p>
                    <h2 className="mt-2 line-clamp-2 text-lg font-bold leading-6 text-slate-900">{documento.nome}</h2>
                    <p className="mt-2 truncate text-xs text-slate-500" title={documento.arquivo_nome ?? undefined}>
                      {documento.arquivo_nome ?? 'Nome original não informado'}
                    </p>

                    <dl className="mt-5 grid grid-cols-2 gap-3 border-y border-slate-100 py-4 text-sm">
                      <div>
                        <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Validade</dt>
                        <dd className="mt-1 flex items-center gap-1.5 font-semibold text-slate-700">
                          <Calendar className="h-4 w-4 text-slate-400" aria-hidden="true" />
                          {formatDate(documento.validade)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Enviado em</dt>
                        <dd className="mt-1 flex items-center gap-1.5 font-semibold text-slate-700">
                          <Clock3 className="h-4 w-4 text-slate-400" aria-hidden="true" />
                          {formatDate(documento.criado_em)}
                        </dd>
                      </div>
                    </dl>

                    {removeMutation.isError && removeMutation.variables === documento.id && (
                      <p role="alert" className="mt-4 text-xs leading-5 text-red-700">
                        {getErrorMessage(removeMutation.error, 'Não foi possível remover este documento.')}
                      </p>
                    )}

                    <div className="mt-5 flex gap-3">
                      {documento.url ? (
                        <a
                          href={documento.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-brand-blue px-4 py-2.5 text-sm font-bold text-white"
                        >
                          Abrir arquivo
                          <ExternalLink className="h-4 w-4" aria-hidden="true" />
                        </a>
                      ) : (
                        <span className="inline-flex min-h-10 flex-1 items-center justify-center rounded-xl bg-slate-100 px-4 py-2.5 text-center text-xs font-semibold text-slate-500">
                          Arquivo indisponível
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => void removeDocument(documento)}
                        disabled={removeMutation.isPending}
                        aria-label={`Remover ${documento.nome}`}
                        className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 px-3 text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                      >
                        {removeMutation.isPending && removeMutation.variables === documento.id
                          ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                          : <XCircle className="h-4 w-4" aria-hidden="true" />}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}

            {!documentsQuery.isLoading && !documentsQuery.isError && documents.length > 0 && (
              <p className="mt-4 flex items-center gap-2 text-xs text-slate-500">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                Situações calculadas exclusivamente pelas datas de validade retornadas pela API.
              </p>
            )}
          </section>
      </div>
    </div>
  );
}
