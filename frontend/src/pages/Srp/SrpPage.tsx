import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Building2,
  CalendarDays,
  ExternalLink,
  FileCheck,
  RefreshCw,
  Search,
} from 'lucide-react';
import { licitacoesApi } from '../../services/api';

interface AtaRegistroPreco {
  id: string;
  numeroControlePNCP: string;
  processo?: string | null;
  orgao: string;
  objeto: string;
  valorEstimado?: number | null;
  dataAbertura?: string | null;
  dataPublicacao?: string | null;
  link?: string | null;
  srp?: boolean;
}

function formatarMoeda(valor?: number | null) {
  if (valor == null || !Number.isFinite(valor)) return 'Não informado';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor);
}

function formatarData(valor?: string | null) {
  if (!valor) return 'Não informada';
  const data = new Date(valor);
  return Number.isNaN(data.getTime())
    ? 'Não informada'
    : data.toLocaleDateString('pt-BR');
}

export const SrpPage: React.FC = () => {
  const [atas, setAtas] = useState<AtaRegistroPreco[]>([]);
  const [busca, setBusca] = useState('');
  const [buscaAplicada, setBuscaAplicada] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);

  const carregarEditais = useCallback(async (termo = '') => {
    setCarregando(true);
    setErro(null);

    try {
      try {
        await licitacoesApi.sincronizar({
          srp: true,
          palavraChave: termo.trim() || undefined,
          pagina: 1,
          tamanhoPagina: 50,
        });
      } catch (syncError: any) {
        setErro(
          syncError.response?.data?.message
          || 'Falha ao atualizar agora os editais no PNCP. Exibindo os registros já sincronizados.',
        );
      }

      const resposta = await licitacoesApi.listar({
        srp: true,
        palavraChave: termo.trim() || undefined,
        pagina: 1,
        tamanhoPagina: 50,
      });
      const itens = resposta.data?.data;

      if (!Array.isArray(itens)) {
        throw new Error('Não foi possível carregar as atas de registro de preços.');
      }

      setAtas(itens.filter((item: AtaRegistroPreco) => item.srp === true));
      setAtualizadoEm(new Date());
    } catch (requestError: any) {
      setErro(
        requestError.response?.data?.message
        || requestError.message
        || 'Não foi possível consultar os editais de registro de preços no PNCP.',
      );
      setAtas([]);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregarEditais();
  }, [carregarEditais]);

  const handleBuscar = (event: React.FormEvent) => {
    event.preventDefault();
    const termo = busca.trim();
    setBuscaAplicada(termo);
    void carregarEditais(termo);
  };

  return (
    <div className="min-h-full bg-slate-50 p-6 font-sans text-slate-800 lg:p-8">
      <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="rounded-xl bg-[#0A2540] p-2.5 text-white shadow-sm">
              <FileCheck size={20} />
            </span>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">
              Registro de Preços no PNCP
            </h1>
          </div>
          <p className="mt-2 text-sm text-slate-600">
            Consulte oportunidades oficiais de contratação com Sistema de Registro de Preços.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void carregarEditais(buscaAplicada)}
          disabled={carregando}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0A2540] px-4 py-3 text-xs font-bold uppercase tracking-wide text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw size={15} className={carregando ? 'animate-spin' : ''} />
          Atualizar no PNCP
        </button>
      </header>

      <form onSubmit={handleBuscar} className="mb-6 flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">Buscar editais de registro de preços</span>
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="Buscar por objeto ou órgão..."
            className="w-full rounded-xl border border-slate-200 bg-white py-3.5 pl-11 pr-4 text-sm text-slate-900 outline-none transition focus:border-blue-700 focus:ring-4 focus:ring-blue-700/10"
          />
        </label>
        <button
          type="submit"
          disabled={carregando}
          className="rounded-xl bg-orange-600 px-6 py-3 text-xs font-black uppercase tracking-wide text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Buscar oportunidades
        </button>
      </form>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="font-semibold text-slate-700">
          {carregando ? 'Consultando a fonte oficial...' : `${atas.length} oportunidade(s) encontradas`}
        </p>
        {atualizadoEm && (
          <p className="text-xs text-slate-500">
            Atualizado às {atualizadoEm.toLocaleTimeString('pt-BR')}
          </p>
        )}
      </div>

      {erro && (
        <div role="alert" className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      {carregando && (
        <div role="status" className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center text-sm font-semibold text-slate-600">
          Consultando editais atuais de Registro de Preços no PNCP...
        </div>
      )}

      {!carregando && !erro && atas.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <FileCheck size={32} className="mx-auto mb-3 text-slate-400" />
          <h2 className="font-bold text-slate-900">Nenhum edital SRP encontrado nesta consulta</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-slate-600">
            Não há resultados correspondentes aos filtros na resposta atual do PNCP. Tente outro termo ou atualize a consulta.
          </p>
        </div>
      )}

      {!carregando && atas.length > 0 && (
        <div className="space-y-4">
          {atas.map((ata) => (
            <article key={ata.id} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="mb-2 inline-flex rounded-lg bg-blue-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-blue-900">
                    Sistema de Registro de Preços
                  </p>
                  <h2 className="font-bold leading-relaxed text-slate-900">{ata.objeto || 'Objeto não informado pelo PNCP'}</h2>
                  <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                    <Building2 size={14} className="shrink-0 text-slate-400" />
                    {ata.orgao || 'Órgão não informado'}
                  </p>
                </div>
                {ata.link && (
                  <a
                    href={ata.link}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                  >
                    Abrir no PNCP <ExternalLink size={14} />
                  </a>
                )}
              </div>
              <div className="grid gap-4 text-sm sm:grid-cols-3">
                <div>
                  <span className="block text-xs font-semibold text-slate-500">Processo / controle PNCP</span>
                  <span className="mt-1 block break-all font-bold text-slate-800">{ata.processo || ata.numeroControlePNCP}</span>
                </div>
                <div>
                  <span className="block text-xs font-semibold text-slate-500">Valor estimado</span>
                  <span className="mt-1 block font-bold text-slate-800">{formatarMoeda(ata.valorEstimado)}</span>
                </div>
                <div>
                  <span className="block text-xs font-semibold text-slate-500">Abertura da proposta</span>
                  <span className="mt-1 inline-flex items-center gap-1.5 font-bold text-slate-800">
                    <CalendarDays size={14} className="text-slate-400" />
                    {formatarData(ata.dataAbertura || ata.dataPublicacao)}
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};
