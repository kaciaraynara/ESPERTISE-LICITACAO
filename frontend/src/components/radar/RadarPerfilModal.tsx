import { useEffect, useState } from 'react';
import { X, Search, Plus, Loader2, MapPin, Check, Bell } from 'lucide-react';
import { empresasApi, licitacoesApi } from '../../services/api';
import { useCompany, type Company } from '../../contexts/CompanyContext';
import toast from 'react-hot-toast';

export type ObjectTypeOption = 'BENS' | 'SERVICOS' | 'OBRAS';

export interface RadarPerfilDraft {
  ramos: string[];
  palavras: string[];
  tiposObjeto: ObjectTypeOption[];
  incluirSemClassificacao: boolean;
  ufs: string[];
}

interface CatalogRamoItem {
  id: string;
  label: string;
  palavras: string[];
  tiposObjeto: ObjectTypeOption[];
}

interface RadarPerfilModalProps {
  isOpen: boolean;
  onClose: () => void;
  company: Company | null;
  initialDraft: RadarPerfilDraft;
  onApply: (draft: RadarPerfilDraft) => void;
  onSaved?: (draft: RadarPerfilDraft) => void;
}

const ALL_UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

const QUICK_PROMPTS = [
  'Uniformes escolares, vestuário e fardamento',
  'Software, sistemas de gestão e licenças',
  'Limpeza predial e material de higiene',
  'Obras, reformas e manutenção predial',
  'Medicamentos e material hospitalar',
  'Alimentos e merenda escolar',
];

export function RadarPerfilModal({
  isOpen,
  onClose,
  company,
  initialDraft,
  onApply,
  onSaved,
}: RadarPerfilModalProps) {
  const { refreshCompanies } = useCompany();

  const [descricao, setDescricao] = useState('');
  const [draft, setDraft] = useState<RadarPerfilDraft>(initialDraft);
  const [catalogoRamos, setCatalogoRamos] = useState<CatalogRamoItem[]>([]);
  const [adicionandoPalavra, setAdicionandoPalavra] = useState(false);
  const [novaPalavra, setNovaPalavra] = useState('');
  const [escolhendoEstados, setEscolhendoEstados] = useState(initialDraft.ufs.length > 0);
  const [ramoParaAdicionar, setRamoParaAdicionar] = useState('');

  const [sugerindo, setSugerindo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [estimativa, setEstimativa] = useState<{
    abertasAgora: number;
    ultimos30Dias: number;
    estimativaPorDia: number;
  } | null>(null);
  const [estimando, setEstimando] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setDraft(initialDraft);
    setEscolhendoEstados(initialDraft.ufs.length > 0);
    setAdicionandoPalavra(false);
    setNovaPalavra('');

    if (catalogoRamos.length === 0) {
      licitacoesApi
        .listarRamos()
        .then((res) => {
          const items = res?.data?.data;
          if (Array.isArray(items)) setCatalogoRamos(items);
        })
        .catch(() => {});
    }
  }, [isOpen, initialDraft, catalogoRamos.length]);

  useEffect(() => {
    if (!isOpen) return;
    setEstimando(true);
    const timer = setTimeout(() => {
      licitacoesApi
        .estimarPerfil({
          palavras: draft.palavras,
          tiposObjeto: draft.tiposObjeto,
          incluirSemClassificacao: draft.incluirSemClassificacao,
          ufs: draft.ufs,
        })
        .then((res) => {
          if (res?.data?.data) {
            setEstimativa(res.data.data);
          }
        })
        .catch(() => {})
        .finally(() => setEstimando(false));
    }, 250);

    return () => clearTimeout(timer);
  }, [
    isOpen,
    draft.palavras,
    draft.tiposObjeto,
    draft.incluirSemClassificacao,
    draft.ufs,
  ]);

  if (!isOpen) return null;

  const handleSugerirComIa = async (textoOverride?: string) => {
    const desc = (textoOverride ?? descricao).trim();
    if (!desc && !company?.cnaePrincipal && draft.ramos.length === 0) {
      toast.error('Descreva o que sua empresa vende ou presta antes de gerar sugestões.');
      return;
    }
    setSugerindo(true);
    try {
      const res = await licitacoesApi.sugerirPerfil({
        descricao: desc || undefined,
        cnae: company?.cnaePrincipal || company?.cnae_principal || undefined,
        ramos: draft.ramos,
        ufs: draft.ufs,
      });
      const data = res?.data?.data;
      if (data) {
        setDraft((prev) => ({
          ramos: Array.from(new Set([...prev.ramos, ...(Array.isArray(data.ramos) ? data.ramos : [])])),
          palavras: Array.from(new Set([...prev.palavras, ...(Array.isArray(data.palavras) ? data.palavras : [])])).slice(0, 15),
          tiposObjeto:
            Array.isArray(data.tiposObjeto) && data.tiposObjeto.length > 0
              ? data.tiposObjeto
              : prev.tiposObjeto,
          incluirSemClassificacao:
            data.incluirSemClassificacao !== undefined ? Boolean(data.incluirSemClassificacao) : prev.incluirSemClassificacao,
          ufs: prev.ufs,
        }));
        if (data.estimativa) setEstimativa(data.estimativa);
        toast.success('Sugestões aplicadas ao seu perfil de busca!');
      }
    } catch {
      toast.error('Não foi possível gerar sugestões automáticas agora.');
    } finally {
      setSugerindo(false);
    }
  };

  const handleAddPalavra = () => {
    const clean = novaPalavra.trim();
    if (!clean) return;
    const itens = clean
      .split(/[,;]+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 2);
    if (itens.length === 0) return;

    setDraft((prev) => ({
      ...prev,
      palavras: Array.from(new Set([...prev.palavras, ...itens])).slice(0, 20),
    }));
    setNovaPalavra('');
    setAdicionandoPalavra(false);
  };

  const handleToggleTipoObjeto = (tipo: ObjectTypeOption) => {
    setDraft((prev) => {
      const exists = prev.tiposObjeto.includes(tipo);
      const next = exists
        ? prev.tiposObjeto.filter((t) => t !== tipo)
        : [...prev.tiposObjeto, tipo];
      return { ...prev, tiposObjeto: next };
    });
  };

  const handleToggleUf = (uf: string) => {
    setDraft((prev) => {
      const exists = prev.ufs.includes(uf);
      const next = exists ? prev.ufs.filter((u) => u !== uf) : [...prev.ufs, uf];
      return { ...prev, ufs: next };
    });
  };

  const handleSelectRamoCatalogo = (ramoId: string) => {
    setRamoParaAdicionar('');
    const found = catalogoRamos.find((r) => r.id === ramoId || r.label === ramoId);
    if (!found) return;
    setDraft((prev) => ({
      ...prev,
      ramos: Array.from(new Set([...prev.ramos, found.label])),
      palavras: Array.from(new Set([...prev.palavras, ...found.palavras])).slice(0, 20),
      tiposObjeto:
        prev.tiposObjeto.length > 0
          ? Array.from(new Set([...prev.tiposObjeto, ...found.tiposObjeto]))
          : found.tiposObjeto,
    }));
  };

  const handleSalvarReceberAlertas = async () => {
    if (!company?.id || company.id === 'default') {
      onApply(draft);
      toast('Filtros aplicados no Radar! Cadastre sua empresa em Minha Empresa para salvar alertas recorrentes.');
      onClose();
      return;
    }

    setSalvando(true);
    try {
      await empresasApi.atualizar(company.id, {
        nicho: draft.ramos,
        palavras_chave: draft.palavras,
        regioes: draft.ufs,
        radar_tipos_objeto: draft.tiposObjeto,
        radar_incluir_sem_classificacao: draft.incluirSemClassificacao,
      });
      await refreshCompanies();
      onApply(draft);
      onSaved?.(draft);
      toast.success('Perfil de Radar e alertas salvo para a empresa!');
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao salvar perfil do Radar.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="radar-perfil-modal-title"
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        {/* Cabeçalho */}
        <div className="flex items-start justify-between border-b border-slate-100 bg-slate-50/70 px-6 py-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-[#0070C0]">
              <Search className="h-3.5 w-3.5" />
              Busca personalizada e alertas do Radar
            </div>
            <h2 id="radar-perfil-modal-title" className="mt-1 text-lg font-extrabold text-[#081C3A]">
              Configurar ramos, palavras e estados
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 cursor-pointer"
            aria-label="Fechar modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Corpo */}
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {/* Descrição livre + Sugestor */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <label htmlFor="radar-ia-descricao" className="block text-xs font-bold text-[#081C3A]">
              Descreva o que sua empresa vende ou presta (Sugestão automática de ramos e palavras)
            </label>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <input
                id="radar-ia-descricao"
                type="text"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void handleSugerirComIa();
                  }
                }}
                placeholder="Ex.: uniformes escolares, fardamento, sistemas de gestão, limpeza predial..."
                className="flex-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-[#081C3A] outline-none focus:border-[#0070C0]"
              />
              <button
                type="button"
                onClick={() => void handleSugerirComIa()}
                disabled={sugerindo}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#081C3A] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#0f2b56] disabled:opacity-60 cursor-pointer"
              >
                {sugerindo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4 text-emerald-400" />}
                Sugerir Termos
              </button>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {QUICK_PROMPTS.map((exemplo) => (
                <button
                  key={exemplo}
                  type="button"
                  onClick={() => {
                    setDescricao(exemplo);
                    void handleSugerirComIa(exemplo);
                  }}
                  className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:border-[#0070C0] hover:text-[#0070C0] cursor-pointer"
                >
                  + {exemplo}
                </button>
              ))}
            </div>
          </div>

          {/* Bloco de Ramos, Palavras e Tipo de Objeto */}
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
            {/* RAMOS */}
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                  RAMOS · {draft.ramos.length}
                </span>
                {catalogoRamos.length > 0 && (
                  <select
                    aria-label="Adicionar ramo do catálogo"
                    value={ramoParaAdicionar}
                    onChange={(e) => handleSelectRamoCatalogo(e.target.value)}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 outline-none focus:border-[#0070C0] cursor-pointer"
                  >
                    <option value="">+ Adicionar ramo do catálogo</option>
                    {catalogoRamos
                      .filter((r) => !draft.ramos.includes(r.label))
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.label}
                        </option>
                      ))}
                  </select>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {draft.ramos.length === 0 ? (
                  <span className="text-xs text-slate-400">Nenhum ramo específico selecionado (busca aberta por palavras).</span>
                ) : (
                  draft.ramos.map((ramo) => (
                    <span
                      key={ramo}
                      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-[#081C3A]"
                    >
                      {ramo}
                      <button
                        type="button"
                        onClick={() =>
                          setDraft((prev) => ({ ...prev, ramos: prev.ramos.filter((r) => r !== ramo) }))
                        }
                        className="rounded-full p-0.5 text-slate-500 hover:bg-slate-200 hover:text-slate-900 cursor-pointer"
                        aria-label={`Remover ramo ${ramo}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))
                )}
              </div>
            </div>

            {/* PALAVRAS */}
            <div className="border-t border-slate-100 pt-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                  PALAVRAS · {draft.palavras.length}
                </span>
                {draft.palavras.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setDraft((prev) => ({ ...prev, palavras: [] }))}
                    className="text-[11px] font-semibold text-slate-400 hover:text-rose-600 cursor-pointer"
                  >
                    Limpar palavras
                  </button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {draft.palavras.map((kw) => (
                  <span
                    key={kw}
                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-[#081C3A]"
                  >
                    {kw}
                    <button
                      type="button"
                      onClick={() =>
                        setDraft((prev) => ({
                          ...prev,
                          palavras: prev.palavras.filter((item) => item !== kw),
                        }))
                      }
                      className="rounded-full p-0.5 text-slate-500 hover:bg-slate-200 hover:text-slate-900 cursor-pointer"
                      aria-label={`Remover palavra ${kw}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}

                {adicionandoPalavra ? (
                  <div className="inline-flex items-center gap-1.5">
                    <input
                      type="text"
                      autoFocus
                      value={novaPalavra}
                      onChange={(e) => setNovaPalavra(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddPalavra();
                        } else if (e.key === 'Escape') {
                          setAdicionandoPalavra(false);
                          setNovaPalavra('');
                        }
                      }}
                      placeholder="Ex: fardamento"
                      className="w-36 rounded-full border border-[#0070C0] px-3 py-1 text-xs text-[#081C3A] outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddPalavra}
                      className="rounded-full bg-[#0070C0] px-2.5 py-1 text-xs font-bold text-white cursor-pointer"
                    >
                      OK
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAdicionandoPalavra(true)}
                    className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-[#0070C0] hover:text-[#0070C0] cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    adicionar
                  </button>
                )}
              </div>
            </div>

            {/* TIPO DE OBJETO */}
            <div className="border-t border-slate-100 pt-3">
              <span className="mb-2 block text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                TIPO DE OBJETO
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {(
                  [
                    { id: 'BENS', label: 'Bens' },
                    { id: 'SERVICOS', label: 'Serviços' },
                    { id: 'OBRAS', label: 'Obras' },
                  ] as const
                ).map((item) => {
                  const active = draft.tiposObjeto.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleToggleTipoObjeto(item.id)}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-bold transition cursor-pointer ${
                        active
                          ? 'border-[#081C3A] bg-[#081C3A] text-white'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {active && <Check className="h-3 w-3" />}
                      {item.label}
                    </button>
                  );
                })}
                {draft.tiposObjeto.length === 0 && (
                  <span className="text-xs font-medium text-slate-500">Todos os tipos incluídos</span>
                )}
              </div>
              <label className="mt-2.5 inline-flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.incluirSemClassificacao}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, incluirSemClassificacao: e.target.checked }))
                  }
                  className="h-3.5 w-3.5 accent-[#0070C0]"
                />
                Incluir licitações ainda sem classificação
              </label>
            </div>
          </div>

          {/* ONDE */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-[#0070C0]" />
                <span className="text-xs font-bold text-[#081C3A]">
                  Onde buscar: {draft.ufs.length === 0 ? 'Todo o Brasil' : `${draft.ufs.length} estado(s): ${draft.ufs.join(', ')}`}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setDraft((prev) => ({ ...prev, ufs: [] }));
                    setEscolhendoEstados(false);
                  }}
                  className={`rounded-full px-3 py-1 text-xs font-bold cursor-pointer ${
                    !escolhendoEstados && draft.ufs.length === 0
                      ? 'bg-[#081C3A] text-white'
                      : 'border border-slate-200 text-slate-600 hover:border-[#0070C0]'
                  }`}
                >
                  Todo o Brasil
                </button>
                <button
                  type="button"
                  onClick={() => setEscolhendoEstados((v) => !v)}
                  className={`rounded-full px-3 py-1 text-xs font-bold cursor-pointer ${
                    escolhendoEstados || draft.ufs.length > 0
                      ? 'bg-blue-50 text-[#0070C0] border border-[#0070C0]'
                      : 'border border-slate-200 text-slate-600 hover:border-[#0070C0]'
                  }`}
                >
                  Escolher estados
                </button>
              </div>
            </div>

            {escolhendoEstados && (
              <div className="mt-3 grid grid-cols-6 gap-1.5 sm:grid-cols-9">
                {ALL_UFS.map((uf) => {
                  const selected = draft.ufs.includes(uf);
                  return (
                    <button
                      key={uf}
                      type="button"
                      onClick={() => handleToggleUf(uf)}
                      className={`rounded-lg border py-1.5 text-xs font-bold transition cursor-pointer ${
                        selected
                          ? 'border-[#0070C0] bg-[#0070C0] text-white'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-[#0070C0]/60'
                      }`}
                    >
                      {uf}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Rodapé */}
        <div className="border-t border-slate-200 bg-slate-50 px-6 py-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="inline-flex items-center gap-2 font-semibold text-emerald-700">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              {estimando ? (
                <span>Calculando estimativa real na base...</span>
              ) : (
                <span>
                  Abertas agora: <strong>{(estimativa?.abertasAgora ?? 0).toLocaleString('pt-BR')}</strong> • Média estimada:{' '}
                  <strong>~{(estimativa?.estimativaPorDia ?? 0).toLocaleString('pt-BR')}/dia</strong>
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => {
                onApply(draft);
                onClose();
              }}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              Aplicar só nesta busca
            </button>
            <button
              type="button"
              onClick={() => void handleSalvarReceberAlertas()}
              disabled={salvando}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#081C3A] px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#0f2b56] disabled:opacity-60 cursor-pointer"
            >
              {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4 text-[#FF6600]" />}
              Salvar e receber alertas
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
