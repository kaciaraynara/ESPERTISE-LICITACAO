import React, { useState, useEffect } from 'react';
import { 
  Settings, Building, ShieldCheck, Bell, 
  Cpu, Save, CheckCircle2, Loader2
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { empresasApi } from '@services/api';
import toast from 'react-hot-toast';

export default function ConfiguracoesPage() {
  const [abaAtiva, setAbaAtiva] = useState<'EMPRESA' | 'CERTIFICADO' | 'INTEGRACOES' | 'NOTIFICACOES'>('EMPRESA');
  const queryClient = useQueryClient();

  const { data: empresasResp, isLoading } = useQuery({
    queryKey: ['minhas_empresas'],
    queryFn: async () => {
      const res = await empresasApi.listar();
      return res.data;
    }
  });

  const empresa = empresasResp?.data?.[0];

  const [formData, setFormData] = useState({
    razaoSocial: '',
    cnpj: '',
    cnaePrincipal: '',
    status: '',
    whatsapp: '', // Futuro
  });

  useEffect(() => {
    if (empresa) {
      setFormData({
        razaoSocial: empresa.razaoSocial || '',
        cnpj: empresa.cnpj || '',
        cnaePrincipal: empresa.cnaePrincipal || '',
        status: empresa.status || '',
        whatsapp: '+55 (11) 98888-7777', // Fixo por enquanto
      });
    }
  }, [empresa]);

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      if (empresa?.id) {
        return empresasApi.atualizar(empresa.id, data);
      } else {
        return empresasApi.criar(data);
      }
    },
    onSuccess: () => {
      toast.success('Configurações salvas com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['minhas_empresas'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Erro ao salvar configurações.');
    }
  });

  const handleSave = () => {
    mutation.mutate({
      razaoSocial: formData.razaoSocial,
      cnpj: formData.cnpj,
      cnaePrincipal: formData.cnaePrincipal,
      status: formData.status,
    });
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-orange" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800 p-8">
      
      {/* CABEÇALHO */}
      <header className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-[#0A2540] text-white rounded-lg shadow-md">
              <Settings size={20} />
            </span>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Configurações da Empresa & Integrações
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Gestão de credenciais de portais governamentais, certificado digital A1/A3 e robô de automação.
          </p>
        </div>

        <button 
          onClick={handleSave}
          disabled={mutation.isPending}
          className="px-5 py-2.5 bg-[#EA580C] hover:bg-orange-600 text-white font-black text-xs rounded-xl shadow-lg flex items-center gap-2 transition-all disabled:opacity-50"
        >
          {mutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} 
          SALVAR ALTERAÇÕES
        </button>
      </header>

      {/* NAVEGAÇÃO DE ABAS */}
      <div className="flex border-b border-slate-200 mb-8 space-x-4">
        <button 
          onClick={() => setAbaAtiva('EMPRESA')}
          className={`pb-3 text-xs font-black flex items-center gap-2 border-b-2 transition-all ${
            abaAtiva === 'EMPRESA' ? 'border-[#0A2540] text-[#0A2540]' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <Building size={16} /> Dados do Licitante
        </button>

        <button 
          onClick={() => setAbaAtiva('CERTIFICADO')}
          className={`pb-3 text-xs font-black flex items-center gap-2 border-b-2 transition-all ${
            abaAtiva === 'CERTIFICADO' ? 'border-[#0A2540] text-[#0A2540]' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <ShieldCheck size={16} /> Certificado Digital (A1)
        </button>

        <button 
          onClick={() => setAbaAtiva('INTEGRACOES')}
          className={`pb-3 text-xs font-black flex items-center gap-2 border-b-2 transition-all ${
            abaAtiva === 'INTEGRACOES' ? 'border-[#0A2540] text-[#0A2540]' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <Cpu size={16} /> Credenciais dos Portais
        </button>

        <button 
          onClick={() => setAbaAtiva('NOTIFICACOES')}
          className={`pb-3 text-xs font-black flex items-center gap-2 border-b-2 transition-all ${
            abaAtiva === 'NOTIFICACOES' ? 'border-[#0A2540] text-[#0A2540]' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <Bell size={16} /> Alertas & WhatsApp
        </button>
      </div>

      {/* CONTEÚDO DA ABA SELECIONADA */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm max-w-4xl space-y-6">
        
        {abaAtiva === 'EMPRESA' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
              Informações Cadastrais da Empresa
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Razão Social</label>
                <input 
                  type="text" 
                  value={formData.razaoSocial}
                  disabled
                  className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-500 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">CNPJ</label>
                <input 
                  type="text" 
                  value={formData.cnpj}
                  onChange={(e) => setFormData(p => ({ ...p, cnpj: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Porte da Empresa / Status</label>
                <select 
                  value={formData.status}
                  disabled
                  className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-500 cursor-not-allowed"
                >
                  <option value="">Selecione...</option>
                  <option value="EPP">Empresa de Pequeno Porte (EPP)</option>
                  <option value="ME">Microempresa (ME)</option>
                  <option value="DEMAIS">Demais (Geral)</option>
                  <option value="ATIVA">Ativa</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">CNAE Principal</label>
                <input 
                  type="text" 
                  value={formData.cnaePrincipal}
                  disabled
                  className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-500 cursor-not-allowed"
                />
              </div>
            </div>
          </div>
        )}

        {abaAtiva === 'CERTIFICADO' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
              Gerenciamento do Certificado Digital A1 (.PFX / .P12)
            </h3>

            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="text-emerald-600" size={20} />
                <div>
                  <strong className="text-xs font-bold text-emerald-900 block">Certificado Válido Instalado</strong>
                  <span className="text-[10px] text-emerald-700">Validade até: 22/11/2026 | Emissor: AC Certisign RFB</span>
                </div>
              </div>
              <button className="px-3 py-1.5 bg-white border border-emerald-300 text-emerald-800 text-xs font-bold rounded-lg hover:bg-emerald-100 transition-all">
                Substituir Certificado
              </button>
            </div>
          </div>
        )}

        {abaAtiva === 'INTEGRACOES' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
              Conexões Ativas com Portais
            </h3>

            <div className="space-y-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                <div>
                  <strong className="text-slate-900 font-bold block">Compras.gov.br (SIASG)</strong>
                  <span className="text-slate-500 text-[10px]">Autenticação via Certificado A1 + Chave API PNCP</span>
                </div>
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded bg-emerald-100 text-emerald-800">CONECTADO</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                <div>
                  <strong className="text-slate-900 font-bold block">LicitaNet / Portal de Compras Públicas</strong>
                  <span className="text-slate-500 text-[10px]">Integração via Robô de Lances Automático</span>
                </div>
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded bg-emerald-100 text-emerald-800">CONECTADO</span>
              </div>
            </div>
          </div>
        )}

        {abaAtiva === 'NOTIFICACOES' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
              Disparo de Notificações via WhatsApp & Telegram
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Número do WhatsApp para Alertas Urgentes</label>
                <input 
                  type="text" 
                  value={formData.whatsapp}
                  onChange={(e) => setFormData(p => ({ ...p, whatsapp: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900"
                />
              </div>
            </div>
          </div>
        )}

      </div>

    </div>
  );
}