import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Search, BarChart2, ExternalLink, Loader2, AlertTriangle, Lock, Crown, CheckCircle, ArrowRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import api from '@services/api';
import { useAuthStore } from '@/store/auth.store';
import { hasUserPlanFeature } from '@/components/layout/Sidebar';
import { FORNECEDOR_ROUTES } from '@/routes';
import toast from 'react-hot-toast';
import { formatCnpjMask, isValidCnpj, sanitizeCnpj } from '@/utils/cnpj';

export const InvestigacaoConcorrencialPage: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const hasMalhaFina = hasUserPlanFeature(user, 'malha_fina_qsa');

  const [cnpjBusca, setCnpjBusca] = useState('');
  const [cnpjSubmetido, setCnpjSubmetido] = useState('');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const { data: resp, isLoading, error, isError } = useQuery({
    queryKey: ['concorrente_dossie', cnpjSubmetido],
    queryFn: async () => {
      const res = await api.get(`/concorrentes/${encodeURIComponent(cnpjSubmetido)}/dossie`);
      return res.data;
    },
    enabled: !!cnpjSubmetido && isValidCnpj(cnpjSubmetido, { optional: false }),
    retry: false,
  });

  const dossie = resp?.data;

  const handleBuscar = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCnpj = sanitizeCnpj(cnpjBusca);
    if (cleanCnpj.length === 0) {
      setCnpjSubmetido('');
      return;
    }
    if (!isValidCnpj(cleanCnpj, { optional: false })) {
      toast.error('CNPJ inválido. Digite 14 caracteres alfanuméricos (XX.XXX.XXX/XXXX-XX).');
      return;
    }
    setCnpjSubmetido(cleanCnpj);
  };

  const formatarMoeda = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800 p-8">
      
      {/* CABEÇALHO */}
      <header className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-[#0A2540] text-white rounded-lg shadow-md">
              <Users size={20} />
            </span>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Investigação Concorrencial & Inteligência de Mercado
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Gere o dossiê de um concorrente a partir do seu CNPJ para mapear histórico de contratos e volume faturado.
          </p>
        </div>
      </header>

      {/* FILTRO E BUSCA */}
      <form onSubmit={handleBuscar} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm mb-6 flex flex-col md:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search size={18} className="absolute left-3 top-3 text-slate-400" />
          <input 
            type="text"
            maxLength={18}
            placeholder="Digite o CNPJ do concorrente (XX.XXX.XXX/XXXX-XX — letras e números)..."
            value={cnpjBusca}
            onChange={(e) => setCnpjBusca(formatCnpjMask(e.target.value))}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0A2540]"
          />
        </div>
        <button 
          type="submit"
          className="px-6 py-2.5 bg-[#EA580C] hover:bg-orange-600 text-white font-black text-sm rounded-xl shadow-lg transition-all w-full md:w-auto flex justify-center items-center gap-2 cursor-pointer"
          disabled={isLoading}
        >
          {isLoading ? <Loader2 size={18} className="animate-spin" /> : 'GERAR DOSSIÊ'}
        </button>

        {hasMalhaFina ? (
          <button
            type="button"
            onClick={() => navigate(FORNECEDOR_ROUTES.historico_concorrentes)}
            className="px-5 py-2.5 bg-[#0A2540] hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-sm transition-all w-full md:w-auto flex justify-center items-center gap-2 cursor-pointer"
          >
            <Users size={16} />
            <span>Auditoria Profunda (Malha Fina QSA)</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setShowUpgradeModal(true)}
            className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-600 border border-slate-300 font-bold text-xs uppercase tracking-wider rounded-xl transition-all w-full md:w-auto flex justify-center items-center gap-2 cursor-pointer"
          >
            <Lock size={15} className="text-slate-500 shrink-0" />
            <span>Auditoria Profunda · Desbloquear no Plano Master</span>
          </button>
        )}
      </form>

      {/* RESULTADO DO DOSSIÊ */}
      {isError && (
        <div className="bg-rose-50 border border-rose-200 p-4 rounded-2xl flex items-center gap-3 text-rose-800 font-bold mb-6">
          <AlertTriangle size={24} />
          <div>
            <p>Erro ao gerar dossiê do concorrente.</p>
            <p className="text-xs font-medium text-rose-600 mt-1">
              Verifique o CNPJ ou tente novamente mais tarde. (Detalhe: {(error as any)?.response?.data?.message || error.message})
            </p>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <Loader2 size={48} className="animate-spin text-[#EA580C] mb-4" />
          <h2 className="text-lg font-black text-slate-900">Coletando Dados do Concorrente...</h2>
          <p className="text-sm text-slate-500">Isso pode levar alguns segundos, pois estamos buscando em múltiplas fontes do governo.</p>
        </div>
      )}

      {dossie && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Total de Contratos</p>
              <h2 className="text-3xl font-black text-[#0A2540]">{dossie.estatisticas.totalContratos}</h2>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Valor Total Faturado</p>
              <h2 className="text-2xl font-black text-emerald-600">{formatarMoeda(dossie.estatisticas.valorTotalContratado)}</h2>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Maior Contrato</p>
              <h2 className="text-2xl font-black text-[#0A2540]">{formatarMoeda(dossie.estatisticas.maiorContrato)}</h2>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Ticket Médio</p>
              <h2 className="text-2xl font-black text-[#0A2540]">{formatarMoeda(dossie.estatisticas.ticketMedio)}</h2>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 font-bold text-slate-900 text-sm flex items-center gap-2">
              <BarChart2 size={16} className="text-[#EA580C]" />
              Histórico de Contratos (Últimos {dossie.historico.length})
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 uppercase font-black tracking-wider text-[10px] bg-slate-50">
                    <th className="p-4">Órgão</th>
                    <th className="p-4">Objeto</th>
                    <th className="p-4 text-center">Data</th>
                    <th className="p-4 text-right">Valor do Contrato</th>
                    <th className="p-4 text-center">Fonte</th>
                    <th className="p-4 text-center">Link</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                  {dossie.historico.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-500">Nenhum contrato encontrado no histórico.</td>
                    </tr>
                  ) : (
                    dossie.historico.map((c: any) => (
                      <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-4 font-bold text-slate-900">{c.orgao}</td>
                        <td className="p-4 text-slate-600 max-w-xs truncate" title={c.objeto}>{c.objeto}</td>
                        <td className="p-4 text-center">{c.dataAssinatura ? c.dataAssinatura.split('-').reverse().join('/') : '-'}</td>
                        <td className="p-4 text-right font-black text-emerald-700">{formatarMoeda(c.valor)}</td>
                        <td className="p-4 text-center">
                          <span className="text-[10px] font-black px-2.5 py-0.5 rounded uppercase bg-slate-100 text-slate-600">
                            {c.fonte}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          {c.url ? (
                            <a href={c.url} target="_blank" rel="noopener noreferrer" className="inline-block p-2 text-slate-600 hover:text-[#0A2540] hover:bg-slate-100 rounded-lg transition-all">
                              <ExternalLink size={16} />
                            </a>
                          ) : '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showUpgradeModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 bg-[#0A2540]/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
        >
          <div className="bg-white p-8 rounded-2xl max-w-lg w-full shadow-2xl relative overflow-hidden border border-slate-100">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-amber-400 via-[#EA580C] to-amber-600" />
            <div className="flex justify-center mb-5">
              <div className="relative w-16 h-16 rounded-2xl bg-[#0A2540] text-white flex items-center justify-center shadow-lg">
                <Crown size={30} className="text-amber-400" />
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#EA580C] text-white flex items-center justify-center border-2 border-white">
                  <Lock size={12} />
                </div>
              </div>
            </div>
            <h2 className="text-2xl font-black text-slate-900 text-center mb-2">
              Auditoria Profunda & Malha Fina QSA
            </h2>
            <p className="text-slate-600 text-center mb-6 leading-relaxed text-sm">
              Desbloqueie a investigação societária profunda para cruzar o Quadro de Sócios e Administradores (QSA) dos concorrentes no <strong>Plano Master</strong>.
            </p>
            <ul className="space-y-2.5 mb-7 text-xs sm:text-sm text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
              <li className="flex items-start gap-2"><CheckCircle size={16} className="text-emerald-600 shrink-0 mt-0.5" /> Detecção de sócios em comum e vínculos ocultos</li>
              <li className="flex items-start gap-2"><CheckCircle size={16} className="text-emerald-600 shrink-0 mt-0.5" /> Fundamentação automática na Lei 14.133/2021</li>
              <li className="flex items-start gap-2"><CheckCircle size={16} className="text-emerald-600 shrink-0 mt-0.5" /> Até 20 CNPJs e propostas ilimitadas</li>
            </ul>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowUpgradeModal(false)}
                className="flex-1 px-4 py-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-bold text-sm cursor-pointer"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={() => navigate(FORNECEDOR_ROUTES.planos)}
                className="flex-1 px-5 py-3 bg-[#EA580C] hover:bg-orange-600 text-white font-black rounded-xl shadow-lg flex items-center justify-center gap-2 text-sm cursor-pointer"
              >
                <span>Fazer Upgrade</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};