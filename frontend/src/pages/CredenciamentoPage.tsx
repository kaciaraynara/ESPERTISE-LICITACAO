import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Key,
  Globe,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RefreshCw,
  ExternalLink,
  FileCheck,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { empresasApi } from '@/services/api';

interface PortalCredenciamento {
  id: string;
  nome: string;
  sigla: string;
  url: string;
  status: 'ATIVO' | 'EM_ANALISE' | 'VENCENDO' | 'PENDENTE';
  tipoAcesso: 'CERTIFICADO_DIGITAL' | 'LOGIN_SENHA' | 'GOV_BR';
  dataUltimaSincronizacao: string;
  observacao: string;
}

interface NivelSicaf {
  nivel: number;
  titulo: string;
  descricao: string;
  status: 'REGULAR' | 'PENDENTE' | 'EXPIRADO';
  validade?: string;
}

export const CredenciamentoPage: React.FC = () => {
  const [empresaSelecionada, setEmpresaSelecionada] = useState<any>(null);
  const portais: PortalCredenciamento[] = [];
  const niveisSicaf: NivelSicaf[] = [];

  useEffect(() => {
    empresasApi
      .listar()
      .then((res) => {
        const list = res.data?.data || res.data || [];
        if (Array.isArray(list) && list.length > 0) {
          setEmpresaSelecionada(list[0]);
        }
      })
      .catch((error) => {
        console.error('[Credenciamento] Falha ao carregar empresas.', error);
        toast.error('Não foi possível carregar os dados da empresa.');
      });
  }, []);

  const handleSincronizarPortais = () => {
    toast.error('A sincronização com portais oficiais ainda não está integrada. Nenhum dado foi consultado.');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ATIVO':
      case 'REGULAR':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 size={12} /> Regular / Ativo
          </span>
        );
      case 'EM_ANALISE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-amber-50 text-amber-700 border border-amber-200">
            <Clock size={12} /> Em Análise
          </span>
        );
      case 'VENCENDO':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-orange-50 text-orange-700 border border-orange-200">
            <AlertTriangle size={12} /> Vencendo em breve
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-red-50 text-red-700 border border-red-200">
            <AlertTriangle size={12} /> Pendente
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-6 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* CABEÇALHO */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="p-2.5 bg-[#0A2540] text-white rounded-xl shadow-md">
                <ShieldCheck size={24} />
              </span>
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                  Credenciamento e SICAF
                </h1>
                <p className="text-xs text-slate-500 font-medium">
                  Consulta de credenciamento e SICAF ainda não conectada a fontes oficiais.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleSincronizarPortais}
              className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center gap-2 transition-all shadow-sm cursor-pointer"
            >
              <RefreshCw size={14} />
              Verificar integração
            </button>
          </div>
        </header>

        {/* CARTÃO DE STATUS DO CERTIFICADO DIGITAL */}
        <div className="bg-gradient-to-r from-[#0A2540] to-slate-900 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 opacity-10 pointer-events-none">
            <Key size={260} />
          </div>

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-200 text-xs font-bold">
                <AlertTriangle size={13} />
                Certificado digital não verificado
              </div>
              <h2 className="text-xl font-black tracking-tight">
                {empresaSelecionada?.razaoSocial || 'Empresa não identificada'}
              </h2>
              <p className="text-xs text-slate-300 font-mono">
                CNPJ: {empresaSelecionada?.cnpj || 'Não informado'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4 bg-white/5 border border-white/10 rounded-xl p-4 backdrop-blur-sm">
              <p className="text-sm text-slate-200">
                Nenhum certificado foi cadastrado ou validado nesta aplicação.
              </p>
            </div>
          </div>
        </div>

        {/* NÍVEIS DO SICAF (LEI 14.133/2021) */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <FileCheck size={18} className="text-[#EA580C]" />
                SICAF Digital — Níveis I a VI (Art. 62 a 70 da Lei 14.133/21)
              </h3>
              <p className="text-xs text-slate-500">
                Sistema de Cadastramento Unificado de Fornecedores do Governo Federal.
              </p>
            </div>
            <a
              href="https://www.gov.br/compras/pt-br/sicaf"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-bold text-[#EA580C] hover:underline flex items-center gap-1"
            >
              Consultar SICAF Oficial <ExternalLink size={12} />
            </a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {niveisSicaf.length === 0 && (
              <p className="md:col-span-2 lg:col-span-3 text-sm text-slate-500">
                Não há integração ativa com o SICAF. Consulte o portal oficial para confirmar seus níveis e certidões.
              </p>
            )}
            {niveisSicaf.map((item) => (
              <div
                key={item.nivel}
                className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-white hover:border-[#EA580C]/40 transition-all shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-black text-[#0A2540] uppercase tracking-wider">
                      Nível {item.nivel}
                    </span>
                    {getStatusBadge(item.status)}
                  </div>
                  <h4 className="text-sm font-black text-slate-900">{item.titulo}</h4>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">{item.descricao}</p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500 font-bold">
                  <span>Validade:</span>
                  <span className="text-slate-800">{item.validade}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* PORTAIS DE COMPRAS PÚBLICAS */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Globe size={18} className="text-[#0A2540]" />
                Situação dos portais de compras ({portais.length} conectados)
              </h3>
              <p className="text-xs text-slate-500">
                As integrações com portais oficiais ainda não estão configuradas.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            {portais.length === 0 && (
              <p className="p-6 text-sm text-slate-500">
                Nenhum portal está conectado. Os status serão exibidos somente após uma integração oficial validada.
              </p>
            )}
            {portais.length > 0 && <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 uppercase font-black tracking-wider text-[10px] bg-slate-50/70">
                  <th className="py-3 px-5">Portal de Licitações</th>
                  <th className="py-3 px-4">Método de Acesso</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Última Sincronização</th>
                  <th className="py-3 px-4">Observação Operacional</th>
                  <th className="py-3 px-5 text-right">Acesso Direto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {portais.map((portal) => (
                  <tr key={portal.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-slate-100 text-[#0A2540] rounded-lg font-black text-xs">
                          {portal.sigla}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{portal.nome}</p>
                          <p className="text-[11px] text-slate-400 font-mono">{portal.url}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 font-bold text-slate-600">
                      {portal.tipoAcesso === 'CERTIFICADO_DIGITAL'
                        ? 'Certificado Digital A1/A3'
                        : portal.tipoAcesso === 'GOV_BR'
                        ? 'Login Único Gov.br'
                        : 'Login & Senha'}
                    </td>
                    <td className="py-4 px-4">{getStatusBadge(portal.status)}</td>
                    <td className="py-4 px-4 text-slate-500 font-medium">
                      {portal.dataUltimaSincronizacao}
                    </td>
                    <td className="py-4 px-4 text-slate-600 max-w-xs truncate font-medium">
                      {portal.observacao}
                    </td>
                    <td className="py-4 px-5 text-right">
                      <a
                        href={portal.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold transition-all"
                      >
                        Acessar Portal <ExternalLink size={12} />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CredenciamentoPage;
