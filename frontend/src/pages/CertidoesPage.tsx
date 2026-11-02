import React, { useState, useEffect, useCallback } from 'react';
import {
  FileCheck2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Building2,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { certidoesApi } from '@/services/api';
import { useCompany, type Company } from '@/contexts/CompanyContext';

export interface CertidaoItem {
  id: string;
  nome: string;
  orgao: string;
  esfera: 'FEDERAL' | 'ESTADUAL' | 'MUNICIPAL' | 'TRABALHISTA' | 'JUDICIAL';
  validade: string | null;
  diasParaVencer: number | null;
  status: 'VALIDA' | 'VENCENDO' | 'VENCIDA' | 'SEM_VALIDADE';
  regularidade?: 'REGULAR' | 'IRREGULAR' | 'NAO_IDENTIFICADA';
  urlEmissao: string | null;
  urlValidacao: string | null;
  documentoId?: string;
  arquivoUrl?: string;
  temArquivo?: boolean;
}

export const CertidoesPage: React.FC = () => {
  const { selectedCompany } = useCompany();
  const [empresa, setEmpresa] = useState<Company | null>(selectedCompany);
  const [certidoes, setCertidoes] = useState<CertidaoItem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null);

  const carregarCertidoes = useCallback(async (company: Company | null) => {
    setCarregando(true);
    setErroCarregamento(null);
    setEmpresa(company);
    try {
      if (!company) {
        setCertidoes([]);
        return;
      }

      const response = await certidoesApi.listar({ empresa_id: company.id });
      const registros = response.data?.data;
      if (!Array.isArray(registros)) {
        throw new Error('Não foi possível carregar as certidões da empresa.');
      }
      setCertidoes(registros);
    } catch (error) {
      console.error('[Certidões] Falha ao carregar dados reais da empresa.', error);
      setErroCarregamento('Não foi possível carregar as certidões da empresa. Tente novamente.');
      toast.error('Não foi possível carregar as certidões da empresa.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregarCertidoes(selectedCompany);
  }, [carregarCertidoes, selectedCompany]);

  const sincronizarCertidoes = async () => {
    if (!selectedCompany || sincronizando) return;

    setSincronizando(true);
    try {
      await certidoesApi.forceSync();
      toast.success('Certidões atualizadas pela consulta oficial da InfoSimples.');
      await carregarCertidoes(selectedCompany);
    } catch (error) {
      const message = axios.isAxiosError<{ message?: string }>(error)
        ? error.response?.data?.message
        : undefined;
      toast.error(message || 'Não foi possível consultar a InfoSimples.');
    } finally {
      setSincronizando(false);
    }
  };

  const getStatusBadge = (st: CertidaoItem['status'], dias: number | null) => {
    if (st === 'VALIDA') {
      return (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
          <CheckCircle2 size={12} /> Data válida ({dias} dias)
        </span>
      );
    }
    if (st === 'VENCENDO') {
      return (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-orange-50 text-orange-700 border border-orange-200 flex items-center gap-1">
          <Clock size={12} /> Vencendo ({dias} dias)
        </span>
      );
    }
    if (st === 'SEM_VALIDADE') {
      return (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-1">
          <AlertTriangle size={12} /> Sem validade registrada
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-red-50 text-red-700 border border-red-200 flex items-center gap-1">
        <AlertTriangle size={12} /> Vencida
      </span>
    );
  };

  const getRegularityBadge = (regularidade: CertidaoItem['regularidade']) => {
    if (regularidade === 'REGULAR') {
      return <span className="mt-1 block text-[10px] font-bold text-emerald-700">Consulta oficial: regular</span>;
    }
    if (regularidade === 'IRREGULAR') {
      return <span className="mt-1 block text-[10px] font-bold text-red-700">Consulta oficial: irregular</span>;
    }
    if (regularidade === 'NAO_IDENTIFICADA') {
      return <span className="mt-1 block text-[10px] font-bold text-slate-500">Regularidade não identificada pelo provedor</span>;
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-6 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* CABEÇALHO */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="p-2.5 bg-[#0A2540] text-white rounded-xl shadow-md">
                <FileCheck2 size={24} />
              </span>
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                  Monitoramento de Certidões
                </h1>
                <p className="text-xs text-slate-500 font-medium">
                  Consulte as datas de validade registradas para o CNPJ selecionado.
                </p>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void sincronizarCertidoes()}
            disabled={!selectedCompany || sincronizando || carregando}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0A2540] px-4 py-2.5 text-xs font-black text-white shadow-sm transition hover:bg-[#123b60] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw size={15} className={sincronizando ? 'animate-spin' : ''} />
            {sincronizando ? 'Consultando emissores...' : 'Atualizar Status'}
          </button>
        </header>

        {/* CARDS DE RESUMO DE CONFORMIDADE */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <CheckCircle2 size={22} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Validades Vigentes</p>
              <p className="text-xl font-black text-slate-900">
              {certidoes.filter((c) => c.status === 'VALIDA' && c.regularidade !== 'IRREGULAR').length} de {certidoes.length}
              </p>
              <p className="text-[11px] text-slate-400">Validade registrada</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-orange-50 text-orange-600 rounded-xl">
              <Clock size={22} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Atenção Renovação</p>
              <p className="text-xl font-black text-orange-600">
                {certidoes.filter((c) => c.status === 'VENCENDO').length} certidão(ões)
              </p>
              <p className="text-[11px] text-slate-400">Vence em menos de 15 dias</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-blue-50 text-[#0A2540] rounded-xl">
              <Building2 size={22} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">CNPJ Vinculado</p>
              <p className="text-sm font-black text-slate-900 truncate max-w-[150px]">
                {empresa?.cnpj || 'Nenhuma empresa'}
              </p>
              <p className="text-[11px] text-slate-400">{empresa?.razaoSocial || 'Selecione uma empresa'}</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-red-50 text-red-600 rounded-xl">
              <AlertTriangle size={22} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Certidões Vencidas</p>
              <p className="text-xl font-black text-red-700">
                {certidoes.filter((c) => c.status === 'VENCIDA').length} certidão(ões)
              </p>
              <p className="text-[11px] text-slate-400">Com validade registrada</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4 text-xs leading-5 text-blue-950">
          A atualização consulta a InfoSimples para Receita Federal/PGFN, FGTS e CNDT/TST e grava validade,
          regularidade retornada e comprovante disponível. O CRON também sincroniza as empresas cadastradas quando
          a chave de produção estiver configurada.
        </div>

        {/* TABELA DE CERTIDÕES */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <ShieldCheck size={18} className="text-[#0A2540]" />
                Semáforo das Certidões ({certidoes.length})
              </h3>
              <p className="text-xs text-slate-500">
                Verde: validade registrada vigente · Amarelo: próxima do vencimento · Vermelho: vencida
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 uppercase font-black tracking-wider text-[10px] bg-slate-50/70">
                  <th className="py-3 px-5">Certidão Negativa</th>
                  <th className="py-3 px-4">Órgão Emissor</th>
                  <th className="py-3 px-4">Esfera</th>
                  <th className="py-3 px-4">Validade Oficial</th>
                  <th className="py-3 px-4">Status & Prazo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {carregando ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      Carregando certidões da empresa...
                    </td>
                  </tr>
                ) : erroCarregamento ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-red-700">
                      {erroCarregamento}{' '}
                      <button type="button" onClick={() => void carregarCertidoes(selectedCompany)} className="font-bold underline">
                        Tentar novamente
                      </button>
                    </td>
                  </tr>
                ) : !empresa ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-600">
                      Selecione uma empresa para acompanhar as certidões.
                    </td>
                  </tr>
                ) : certidoes.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-600">
                      Nenhuma certidão cadastrada para esta empresa.
                    </td>
                  </tr>
                ) : certidoes.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-4 px-5">
                      <p className="font-black text-slate-900">{c.nome}</p>
                    </td>
                    <td className="py-4 px-4 font-bold text-slate-600">{c.orgao}</td>
                    <td className="py-4 px-4">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-bold text-[10px]">
                        {c.esfera}
                      </span>
                    </td>
                    <td className="py-4 px-4 font-bold text-slate-800">{c.validade || 'Não informada'}</td>
                    <td className="py-4 px-4">
                      {getStatusBadge(c.status, c.diasParaVencer)}
                      {getRegularityBadge(c.regularidade)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CertidoesPage;
