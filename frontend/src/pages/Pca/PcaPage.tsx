import React, { useEffect, useState } from 'react';
import { CalendarClock, Compass, ExternalLink, BellPlus, Search, Loader2, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { licitacoesApi, prazosApi } from '@/services/api';
import { useCompany } from '@/contexts/CompanyContext';

export const PcaPage: React.FC = () => {
  const { selectedCompany } = useCompany();
  const [termo, setTermo] = useState('');
  const [uf, setUf] = useState('');
  const [ano, setAno] = useState<string>('2026');
  const [pagina, setPagina] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [cnaeFiltroAtivo, setCnaeFiltroAtivo] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erroBusca, setErroBusca] = useState<string | null>(null);
  const [pcas, setPcas] = useState<any[]>([]);
  const [criandoAlertaId, setCriandoAlertaId] = useState<string | null>(null);

  const buscarPcas = async (
    termoOverride?: string,
    cnaeOverride?: string,
    paginaAlvo = 1,
    forceRefresh = false,
  ) => {
    setCarregando(true);
    setErroBusca(null);
    setPagina(paginaAlvo);
    try {
      const qVal = (termoOverride !== undefined ? termoOverride : termo).trim();
      const cnaeVal = cnaeOverride !== undefined ? cnaeOverride : cnaeFiltroAtivo;
      const resp = await licitacoesApi.listarPca({
        q: qVal || undefined,
        cnae: cnaeVal || undefined,
        uf: uf.trim().toUpperCase() || undefined,
        ano: ano ? Number(ano) : undefined,
        pagina: paginaAlvo,
        tamanhoPagina: 20,
        refresh: forceRefresh || undefined,
      });
      const lista = resp.data?.data || resp.data?.items || [];
      const arr = Array.isArray(lista) ? lista : [];
      setPcas(arr);
      setTotal(Number(resp.data?.total ?? arr.length));
      setTotalPaginas(Math.max(1, Number(resp.data?.totalPaginas || 1)));
    } catch {
      const msg = 'Não foi possível consultar os PCAs do PNCP agora. Tente atualizar em instantes.';
      setErroBusca(msg);
      toast.error(msg);
      setPcas([]);
      setTotal(0);
      setTotalPaginas(1);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    void buscarPcas('', '', 1);
  }, []);

  const extrairPalavraRealCnae = (raw?: string | null) => {
    if (!raw) return '';
    const semCodigo = String(raw)
      .replace(/^\s*\d[\d./\-\s]*/, '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z\s]/g, ' ')
      .trim();
    const stop = new Set(['comercio', 'varejista', 'atacadista', 'servicos', 'artigos', 'outros', 'produtos', 'geral', 'ltda', 'para', 'atividades']);
    const palavra = semCodigo.split(/\s+/).find((w) => w.length > 3 && !stop.has(w.toLowerCase()));
    return palavra ? palavra.toLowerCase() : '';
  };

  const filtrarPorCnae = () => {
    const emp = selectedCompany as any;
    const rawCnae = String(emp?.cnaeDescricao || emp?.cnaePrincipal || emp?.nicho || '');
    const palavra = extrairPalavraRealCnae(rawCnae);
    setCnaeFiltroAtivo(rawCnae);
    setTermo(palavra);
    void buscarPcas(palavra, rawCnae, 1);
  };

  const limparFiltros = () => {
    setTermo('');
    setUf('');
    setAno('2026');
    setCnaeFiltroAtivo('');
    void buscarPcas('', '', 1);
  };

  const criarAlertaPca = async (item: any, idx: number) => {
    const key = `${item.idPcaPncp}-${idx}`;
    setCriandoAlertaId(key);
    try {
      const dataAlvo = item.dataDesejada || new Date(Date.now() + 30 * 86400000).toISOString();
      await prazosApi.criar({
        title: `PCA ${item.anoPca} — ${item.orgaoNome}`,
        type: 'PCA_FUTURA_CONTRATACAO',
        date: dataAlvo,
        description: `Previsão de contratação (Art. 12, VII): ${item.descricaoItem}`,
      });
      toast.success('Alerta de futura contratação criado em Prazos e Alertas!');
    } catch {
      toast.error('Erro ao salvar alerta de prazo.');
    } finally {
      setCriandoAlertaId(null);
    }
  };

  const formatarMoeda = (v: number) =>
    v > 0 ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v) : 'A definir no TR';

  const imediatos = pcas.filter((p) => p.janelaTatica === 'IMEDIATA').length;
  const estrategicos = pcas.filter((p) => p.janelaTatica === 'ESTRATEGICA').length;
  const valorTotal = pcas.reduce((s, p) => s + Number(p.valorTotalEstimado || 0), 0);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#081C3A] text-[#F97316]">
              <Compass className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-[#081C3A]">
                Planos de Contratações Anuais (PCA)
              </h1>
              <p className="mt-1 text-xs text-slate-600 max-w-3xl">
                Previsto no <strong>Art. 12, VII da Lei 14.133/2021</strong>, o PCA revela o que os órgãos públicos planejam licitar nos próximos meses <strong>antes mesmo de o edital ser publicado</strong> — permitindo cotar fornecedores e preparar atestados antes da concorrência.
              </p>
            </div>
          </div>
          {selectedCompany?.cnaePrincipal && (
            <button
              type="button"
              onClick={filtrarPorCnae}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 cursor-pointer"
            >
              <Sparkles className="h-4 w-4" />
              Filtrar pelo meu CNAE
            </button>
          )}
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setCnaeFiltroAtivo('');
          void buscarPcas(termo, '', 1);
        }}
        className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-6"
      >
        <input
          type="text"
          value={termo}
          onChange={(e) => {
            setTermo(e.target.value);
            if (!e.target.value) setCnaeFiltroAtivo('');
          }}
          placeholder="Objeto ou item previsto (ex: software, uniforme, limpeza)..."
          className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#081C3A] md:col-span-2"
        />
        <select
          value={ano}
          onChange={(e) => setAno(e.target.value)}
          className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#081C3A]"
        >
          <option value="2026">PCA 2026</option>
          <option value="2027">PCA 2027</option>
          <option value="">Todos os anos</option>
        </select>
        <input
          type="text"
          maxLength={2}
          value={uf}
          onChange={(e) => setUf(e.target.value.toUpperCase())}
          placeholder="UF (ex: CE, SP)"
          className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#081C3A]"
        />
        <button
          type="submit"
          disabled={carregando}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0070C0] px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 cursor-pointer disabled:opacity-50"
        >
          {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Pesquisar PCAs
        </button>
        <button
          type="button"
          disabled={carregando}
          onClick={() => void buscarPcas(undefined, undefined, 1, true)}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-[#081C3A] hover:bg-slate-50 cursor-pointer disabled:opacity-50"
        >
          Atualizar PNCP
        </button>
      </form>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="text-xs font-semibold text-slate-500">Itens de PCA Mapeados</span>
          <div className="mt-1 text-2xl font-extrabold text-[#081C3A]">{total.toLocaleString('pt-BR')}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="text-xs font-semibold text-slate-500">Janela Imediata (&le;30 dias)</span>
          <div className="mt-1 text-2xl font-extrabold text-rose-600">{imediatos}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="text-xs font-semibold text-slate-500">Preparação (31–90 dias)</span>
          <div className="mt-1 text-2xl font-extrabold text-amber-600">{estrategicos}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="text-xs font-semibold text-slate-500">Demanda Futura Estimada</span>
          <div className="mt-1 text-lg font-extrabold text-emerald-700">{formatarMoeda(valorTotal)}</div>
        </div>
      </div>

      <div className="space-y-4">
        {carregando && pcas.length === 0 ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-36 animate-pulse rounded-2xl border border-slate-200 bg-white p-5" />
            ))}
          </div>
        ) : pcas.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center space-y-3">
            <p className="text-sm font-bold text-[#081C3A]">
              {erroBusca || 'Nenhum item de PCA encontrado para os filtros informados.'}
            </p>
            <p className="text-xs text-slate-500">
              Tente limpar os filtros de UF/palavra-chave ou atualizar diretamente os dados mais recentes do PNCP.
            </p>
            <button
              type="button"
              onClick={limparFiltros}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-[#081C3A] hover:bg-slate-50 cursor-pointer"
            >
              Limpar filtros e exibir todos
            </button>
          </div>
        ) : (
          pcas.map((item, idx) => (
          <div key={`${item.idPcaPncp}-${idx}`} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[#081C3A] px-3 py-1 text-[11px] font-bold text-white">
                  PCA {item.anoPca}
                </span>
                <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${
                  item.janelaTatica === 'IMEDIATA'
                    ? 'bg-rose-100 text-rose-800'
                    : item.janelaTatica === 'ESTRATEGICA'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-blue-100 text-blue-800'
                }`}>
                  {item.janelaTatica === 'IMEDIATA' ? 'Antecipação Imediata' : item.janelaTatica === 'ESTRATEGICA' ? 'Janela Estratégica' : 'Planejamento Futuro'}
                </span>
                {item.uf && <span className="text-xs font-bold text-slate-500">{item.municipio ? `${item.municipio} - ${item.uf}` : item.uf}</span>}
              </div>
              <span className="text-sm font-extrabold text-emerald-700">{formatarMoeda(item.valorTotalEstimado)}</span>
            </div>

            <div>
              <h3 className="text-sm font-extrabold text-[#081C3A]">{item.descricaoItem}</h3>
              <p className="text-xs font-semibold text-slate-600 mt-0.5">
                {item.orgaoNome} • Categoria: {item.categoria}
                {item.dataAtualizacao && ` • Atualizado em ${new Date(item.dataAtualizacao).toLocaleDateString('pt-BR')}`}
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs text-slate-700">
              <strong className="text-[#081C3A]">Como agir estrategicamente:</strong> {item.insightEstrategico}
              {item.dataDesejada && (
                <span className="block mt-1 text-slate-500">
                  <CalendarClock className="inline h-3.5 w-3.5 mr-1" />
                  Previsão informada pelo órgão: <strong>{new Date(item.dataDesejada).toLocaleDateString('pt-BR')}</strong>
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                disabled={criandoAlertaId === `${item.idPcaPncp}-${idx}`}
                onClick={() => criarAlertaPca(item, idx)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#F97316] px-3.5 py-2 text-xs font-bold text-white hover:bg-orange-600 cursor-pointer"
              >
                <BellPlus className="h-3.5 w-3.5" />
                Criar Alerta de Prazo
              </button>
              <a
                href={item.linkPcaPncp}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-[#081C3A] hover:border-[#0070C0]"
              >
                Ver no PNCP <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
          ))
        )}

        {totalPaginas > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-3.5 shadow-sm">
            <span className="text-xs font-semibold text-slate-600">
              Página <strong className="text-[#081C3A]">{pagina}</strong> de <strong className="text-[#081C3A]">{totalPaginas}</strong> ({total} itens encontrados)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={pagina <= 1 || carregando}
                onClick={() => void buscarPcas(undefined, undefined, pagina - 1)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-1.5 text-xs font-bold text-[#081C3A] hover:border-[#0070C0] disabled:opacity-40 cursor-pointer"
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={pagina >= totalPaginas || carregando}
                onClick={() => void buscarPcas(undefined, undefined, pagina + 1)}
                className="rounded-xl bg-[#081C3A] px-4 py-1.5 text-xs font-bold text-white hover:bg-[#0f2b56] disabled:opacity-40 cursor-pointer"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PcaPage;