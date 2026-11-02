import React, { useState, useEffect } from 'react';
import {
  Zap,
  Clock,
  Building2,
  DollarSign,
  Search,
  ArrowRight,
  Bot,
  FileCheck2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { licitacoesApi } from '@/services/api';
import { FORNECEDOR_ROUTES } from '@/routes';

interface DispensaItem {
  id: string;
  numero: string;
  orgao: string;
  objeto: string;
  valor: number;
  modalidade: string;
  dataAbertura: string;
  uf: string;
  municipio: string;
  link?: string;
  status: string;
}

interface RadarProfile {
  cnaes?: string[];
  palavras_chave?: string[];
}

export const DispensaEletronicaPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [dispensas, setDispensas] = useState<DispensaItem[]>([]);
  const [perfilRadar, setPerfilRadar] = useState<RadarProfile | null>(null);
  const [busca, setBusca] = useState('');
  const [ufSelecionada, setUfSelecionada] = useState('TODOS');
  const [limiteValor, setLimiteValor] = useState<'TODOS' | 'COMPRAS' | 'ENGENHARIA'>('TODOS');

  // Valores limites atualizados pelo Decreto Federal (Art. 75, I e II da Lei 14.133/21)
  const LIMITE_COMPRAS = 59906.02;
  const LIMITE_ENGENHARIA = 119812.02;

  const carregarDispensas = async () => {
    setLoading(true);
    try {
      try {
        await licitacoesApi.sincronizar({
          palavraChave: busca.trim() || undefined,
          modalidade: 8,
          uf: ufSelecionada !== 'TODOS' ? ufSelecionada : undefined,
          pagina: 1,
          tamanhoPagina: 50,
        });
      } catch (syncError: any) {
        toast.error(
          syncError?.response?.data?.message
          || 'Não foi possível atualizar agora os dados oficiais do PNCP. Tentando exibir os últimos resultados salvos.',
        );
      }

      const res = await licitacoesApi.listar({
        termo: busca.trim() || undefined,
        modalidade: 'Dispensa Eletrônica',
        uf: ufSelecionada !== 'TODOS' ? ufSelecionada : undefined,
      });

      const lista = res.data?.data || res.data || [];
      setDispensas(Array.isArray(lista)
        ? lista.map((item: Record<string, unknown>) => ({
            id: String(item.id ?? item.numeroControlePNCP ?? ''),
            numero: String(item.numero ?? item.processo ?? item.numeroCompra ?? ''),
            orgao: String(item.orgao ?? ''),
            objeto: String(item.objeto ?? ''),
            valor: Number(item.valor ?? item.valorEstimado ?? item.valor_estimado ?? 0),
            modalidade: String(item.modalidade ?? 'Dispensa Eletrônica'),
            dataAbertura: String(item.dataAbertura ?? item.data_abertura ?? ''),
            uf: String(item.uf ?? ''),
            municipio: String(item.municipio ?? ''),
            link: typeof item.link === 'string' ? item.link : undefined,
            status: String(item.status ?? item.situacao ?? ''),
          }))
        : []);
      setPerfilRadar(res.data?.meta?.perfilRadar ?? null);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Erro ao carregar as dispensas salvas do PNCP.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDispensas();
  }, [ufSelecionada]);

  const formatarMoeda = (val: number | null | undefined) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(val) || 0);

  const dispensasFiltradas = dispensas.filter((d) => {
    const val = Number(d.valor) || 0;
    if (limiteValor === 'COMPRAS' && val > LIMITE_COMPRAS) return false;
    if (limiteValor === 'ENGENHARIA' && (val <= LIMITE_COMPRAS || val > LIMITE_ENGENHARIA)) return false;
    if (busca && !d.objeto.toLowerCase().includes(busca.toLowerCase()) && !d.orgao.toLowerCase().includes(busca.toLowerCase())) {
      return false;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-6 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* CABEÇALHO */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="p-2.5 bg-[#EA580C] text-white rounded-xl shadow-md">
                <Zap size={24} />
              </span>
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                  Radar de Dispensa Eletrônica
                </h1>
                <p className="text-xs text-slate-500 font-medium">
                  Contratações diretas de pequeno valor sob o Art. 75 da Lei 14.133/21 com janela de disputa ágil.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              to={FORNECEDOR_ROUTES.propostas}
              className="px-4 py-2.5 rounded-xl bg-[#0A2540] hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-2 shadow-md transition-all"
            >
              Gerador de Propostas
              <ArrowRight size={14} />
            </Link>
          </div>
        </header>

        {perfilRadar?.palavras_chave?.length ? (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3">
            <span className="mr-1 text-[10px] font-black uppercase tracking-wider text-[#0A2540]">
              Oportunidades alinhadas às atividades da empresa
            </span>
            {perfilRadar.palavras_chave.slice(0, 6).map((tag) => (
              <span
                key={tag}
                className="rounded-lg border border-blue-100 bg-white px-2.5 py-1 text-[10px] font-bold text-slate-600"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        {/* CARDS DE LIMITES LEGAIS (ART. 75) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                Art. 75, II — Compras & Serviços
              </p>
              <p className="text-xl font-black text-[#0A2540]">{formatarMoeda(LIMITE_COMPRAS)}</p>
              <p className="text-[11px] text-emerald-600 font-bold">Limite por exercício financeiro</p>
            </div>
            <div className="p-3 bg-blue-50 text-[#0A2540] rounded-xl">
              <DollarSign size={24} />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                Art. 75, I — Obras & Engenharia
              </p>
              <p className="text-xl font-black text-[#EA580C]">{formatarMoeda(LIMITE_ENGENHARIA)}</p>
              <p className="text-[11px] text-amber-600 font-bold">Limite por exercício financeiro</p>
            </div>
            <div className="p-3 bg-orange-50 text-[#EA580C] rounded-xl">
              <Building2 size={24} />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                Janela de Disputa
              </p>
              <p className="text-xl font-black text-slate-900">Mínimo 3 Dias Úteis</p>
              <p className="text-[11px] text-slate-500 font-bold">Envio de lances via Compras.gov</p>
            </div>
            <div className="p-3 bg-slate-100 text-slate-700 rounded-xl">
              <Clock size={24} />
            </div>
          </div>
        </div>

        {/* BARRA DE FILTROS E BUSCA */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por objeto, órgão ou número..."
              className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#EA580C]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold text-slate-600">
              <button
                onClick={() => setLimiteValor('TODOS')}
                className={`px-3 py-1.5 rounded-lg transition-all ${limiteValor === 'TODOS' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'
                  }`}
              >
                Todos
              </button>
              <button
                onClick={() => setLimiteValor('COMPRAS')}
                className={`px-3 py-1.5 rounded-lg transition-all ${limiteValor === 'COMPRAS' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'
                  }`}
              >
                Até R$ 59,9k (Compras)
              </button>
              <button
                onClick={() => setLimiteValor('ENGENHARIA')}
                className={`px-3 py-1.5 rounded-lg transition-all ${limiteValor === 'ENGENHARIA' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'
                  }`}
              >
                Até R$ 119,8k (Obras)
              </button>
            </div>

            <select
              value={ufSelecionada}
              onChange={(e) => setUfSelecionada(e.target.value)}
              className="py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
            >
              <option value="TODOS">Todas as UFs</option>
              <option value="SP">São Paulo (SP)</option>
              <option value="RJ">Rio de Janeiro (RJ)</option>
              <option value="MG">Minas Gerais (MG)</option>
              <option value="DF">Distrito Federal (DF)</option>
              <option value="PR">Paraná (PR)</option>
              <option value="RS">Rio Grande do Sul (RS)</option>
              <option value="BA">Bahia (BA)</option>
            </select>
            <button
              type="button"
              onClick={() => void carregarDispensas()}
              disabled={loading}
              className="rounded-xl bg-[#0A2540] px-4 py-2.5 text-xs font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Buscar no PNCP
            </button>
          </div>
        </div>

        {/* LISTAGEM DE DISPENSAS ELETRÔNICAS */}
        <div className="space-y-4">
          {loading ? (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-sm">
              <div className="h-8 w-8 border-3 border-[#0A2540] border-t-[#EA580C] rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-700">Sincronizando dispensas eletrônicas do PNCP...</p>
            </div>
          ) : dispensasFiltradas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 gap-5 text-center max-w-lg mx-auto bg-white rounded-3xl border-2 border-dashed border-slate-200 shadow-sm">
              <div className="relative p-4 rounded-3xl bg-slate-50 border border-slate-100">
                <svg className="w-20 h-20 text-[#EA580C]" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="48" cy="48" r="44" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" className="opacity-20" />
                  <circle cx="48" cy="48" r="32" stroke="currentColor" strokeWidth="2" className="opacity-30" />
                  <circle cx="48" cy="48" r="18" stroke="currentColor" strokeWidth="2" className="opacity-50" />
                  <circle cx="48" cy="48" r="5" fill="#0A2540" />
                  <line x1="48" y1="8" x2="48" y2="88" stroke="currentColor" strokeWidth="1.5" className="opacity-20" />
                  <line x1="8" y1="48" x2="88" y2="48" stroke="currentColor" strokeWidth="1.5" className="opacity-20" />
                  <path d="M48 48 L72 24" stroke="#0A2540" strokeWidth="2.5" strokeLinecap="round" />
                  <circle cx="72" cy="24" r="3.5" fill="#0A2540" />
                </svg>
              </div>

              <div className="space-y-1.5">
                <h3 className="text-xl font-black text-slate-900 tracking-tight">
                  Nenhuma dispensa encontrada nesta busca.
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed max-w-md">
                  A consulta ao PNCP foi atualizada agora. Ajuste o termo ou a UF e consulte novamente.
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2 w-full justify-center">
                <button
                  type="button"
                  onClick={() => void carregarDispensas()}
                  className="w-full sm:w-auto px-5 py-3 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-xs"
                >
                  Atualizar dispensas
                </button>
              </div>
            </div>
          ) : (
            dispensasFiltradas.map((disp) => (
              <div
                key={disp.id}
                className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:border-[#EA580C]/40 transition-all flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"
              >
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-md bg-[#EA580C]/10 text-[#EA580C] text-[11px] font-black uppercase">
                      {disp.numero || 'Dispensa Eletrônica'}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px] font-bold">
                      {disp.uf || 'BR'} · {disp.municipio || 'Nacional'}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-bold flex items-center gap-1">
                      <Clock size={12} /> {disp.dataAbertura || 'Em aberto'}
                    </span>
                  </div>

                  <h3 className="text-sm font-black text-slate-900 leading-snug">{disp.objeto}</h3>
                  <p className="text-xs text-slate-500 font-medium flex items-center gap-1">
                    <Building2 size={13} /> {disp.orgao}
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row lg:flex-col items-end justify-between gap-3 lg:border-l lg:border-slate-100 lg:pl-6 shrink-0">
                  <div className="text-left sm:text-right lg:text-right">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Valor Estimado</p>
                    <p className="text-lg font-black text-[#0A2540]">
                      {disp.valor ? formatarMoeda(disp.valor) : 'Não informado'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      to={`${FORNECEDOR_ROUTES.robo_lances}?id=${disp.id}`}
                      className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-all"
                      title="Configurar robô para envio de lances nesta dispensa"
                    >
                      <Bot size={14} className="text-[#0A2540]" /> Robô
                    </Link>
                    <Link
                      to={`${FORNECEDOR_ROUTES.propostas}?edital=${disp.id}`}
                      className="px-4 py-2 rounded-xl bg-[#EA580C] hover:bg-orange-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-md transition-all"
                    >
                      <FileCheck2 size={14} /> Elaborar Proposta
                    </Link>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default DispensaEletronicaPage;
