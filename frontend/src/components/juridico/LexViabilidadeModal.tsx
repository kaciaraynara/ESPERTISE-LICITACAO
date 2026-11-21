import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation } from '@tanstack/react-query';
import { lexApi } from '@services/api';
import { 
  X, 
  Target, 
  ShieldAlert, 
  BarChart3, 
  MessageSquare,
  AlertTriangle,
} from '@components/icons/phosphor-compat';

type Tab = 'resumo' | 'riscos' | 'viabilidade' | 'chat';

interface LexViabilidadeModalProps {
  isOpen: boolean;
  onClose: () => void;
  licitacaoId: string;
  objeto: string;
}

export default function LexViabilidadeModal({ isOpen, onClose, licitacaoId, objeto }: LexViabilidadeModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('resumo');

  const resumoMutation = useMutation({
    mutationFn: () => lexApi.resumo({ edital_id: licitacaoId })
  });

  const resumoBruto: any = (resumoMutation.data as any)?.data ?? resumoMutation.data ?? null;
  const textoResumo = typeof resumoBruto === 'string'
    ? resumoBruto
    : resumoBruto?.resumo || resumoBruto?.analise || resumoBruto?.texto || null;
  const objetoResumo = resumoBruto?.objeto || objeto;
  const modeloResumo = resumoBruto?.modeloContratacao || resumoBruto?.modelo_contratacao || null;
  const exigenciasResumo = resumoBruto?.exigenciasQualificacao || resumoBruto?.exigencias_qualificacao || null;

  useEffect(() => {
    if (isOpen && licitacaoId && !resumoMutation.data) {
      resumoMutation.mutate();
    }
    // A mutation é estável enquanto o modal está montado; disparar somente na abertura
    // evita requisições repetidas a cada renderização.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, licitacaoId]);


  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-brand-blue/40 backdrop-blur-sm p-4 sm:p-6">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="w-full max-w-5xl max-h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 bg-gradient-to-r from-brand-blue to-blue-900 text-white">
              <div className="flex items-center gap-3">
                <div className="p-1 bg-white/20 rounded-lg backdrop-blur-md w-10 h-10 flex items-center justify-center overflow-hidden">
                  <img src="/assets/mascote-3d.png" alt="Assistente de Análise" className="w-8 h-8 object-contain" />
                </div>
                <div>
                  <h2 className="text-xl font-bold tracking-tight">Análise de Editais</h2>
                  <p className="text-blue-100 text-sm truncate max-w-md" title={objeto}>{objeto}</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Area */}
            <div className="flex flex-1 overflow-hidden min-h-[500px]">
              {/* Sidebar Tabs */}
              <div className="w-64 bg-slate-50 border-r border-slate-200 p-4 space-y-2 overflow-y-auto hidden md:block">
                <button
                  onClick={() => setActiveTab('resumo')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                    activeTab === 'resumo' 
                      ? 'bg-white text-brand-blue shadow-sm border border-slate-200' 
                      : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  <Target className={`w-5 h-5 ${activeTab === 'resumo' ? 'text-brand-orange' : ''}`} />
                  Resumo Executivo
                </button>
                <button
                  onClick={() => setActiveTab('riscos')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                    activeTab === 'riscos' 
                      ? 'bg-white text-brand-blue shadow-sm border border-slate-200' 
                      : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  <ShieldAlert className={`w-5 h-5 ${activeTab === 'riscos' ? 'text-brand-orange' : ''}`} />
                  Análise de Riscos
                </button>
                <button
                  onClick={() => setActiveTab('viabilidade')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                    activeTab === 'viabilidade' 
                      ? 'bg-white text-brand-blue shadow-sm border border-slate-200' 
                      : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  <BarChart3 className={`w-5 h-5 ${activeTab === 'viabilidade' ? 'text-brand-orange' : ''}`} />
                  Inteligência Comercial
                </button>
                <button
                  onClick={() => setActiveTab('chat')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                    activeTab === 'chat' 
                      ? 'bg-white text-brand-blue shadow-sm border border-slate-200' 
                      : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  <MessageSquare className={`w-5 h-5 ${activeTab === 'chat' ? 'text-brand-orange' : ''}`} />
                  Chat com Edital
                </button>
              </div>

              {/* Main Panel */}
              <div className="flex-1 bg-white p-6 overflow-y-auto">
                
                {/* Aba: Resumo */}
                {activeTab === 'resumo' && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xl font-bold text-brand-blue">Resumo do Edital</h3>
                      <button
                        onClick={() => resumoMutation.mutate()}
                        disabled={resumoMutation.isPending}
                        className="text-sm font-semibold text-brand-orange hover:underline disabled:opacity-50"
                      >
                        {resumoMutation.isPending ? 'Analisando...' : 'Gerar Novamente'}
                      </button>
                    </div>

                    {resumoMutation.isError && (
                      <div className="p-4 bg-orange-50 border border-brand-orange/20 rounded-xl flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-brand-orange shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-bold text-slate-800">Não foi possível gerar o resumo automático.</p>
                          <p className="text-sm text-slate-600 mt-1">
                            Nenhum dado foi inferido. Confira o edital original antes de prosseguir.
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Objeto Principal</p>
                        <p className="font-medium text-slate-800 line-clamp-3" title={objetoResumo}>{objetoResumo}</p>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Modelo de Contratação</p>
                        <p className="font-medium text-slate-800">{modeloResumo || 'Não informado no resumo automático'}</p>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Exigência de Qualificação</p>
                        <p className="font-medium text-slate-800">{exigenciasResumo || 'Não informado no resumo automático'}</p>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Análise da LEX</p>
                        <p className="font-medium text-brand-blue">
                            {textoResumo || (resumoMutation.isPending ? 'Analisando o edital...' : 'Gere o resumo para ver os pontos extraídos.')}
                          </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Aba: Riscos */}
                {activeTab === 'riscos' && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xl font-bold text-brand-blue">Auditoria Jurídica & Habilitação</h3>
                      <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                        <AlertTriangle className="w-4 h-4" /> Sem análise estruturada
                      </span>
                    </div>

                    <div className="space-y-4">
                      <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl flex gap-4 items-start">
                        <AlertTriangle className="w-6 h-6 text-brand-orange shrink-0 mt-0.5" />
                        <div>
                          <h4 className="font-bold text-slate-800 mb-1">Análise de risco indisponível</h4>
                          <p className="text-sm text-slate-600 leading-relaxed">
                            A LEX não possui evidências extraídas deste edital para afirmar restrições ou
                            regularidade de índices. Não exibimos alertas automáticos sem fonte verificável.
                            Confira pessoalmente os requisitos de habilitação no edital original.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Aba: Viabilidade */}
                {activeTab === 'viabilidade' && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                    <h3 className="text-xl font-bold text-brand-blue mb-4">Inteligência Competitiva</h3>

                    <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl flex gap-4 items-start">
                      <AlertTriangle className="w-6 h-6 text-brand-orange shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-bold text-slate-800 mb-1">Dados de mercado não disponíveis nesta análise</h4>
                        <p className="text-sm text-slate-600 leading-relaxed">
                          A LEX não possui histórico de deságio, quantidade de lances ou dados de pagamento
                          deste órgão. Não exibimos números estimados como se fossem reais. Consulte o PNCP
                          e o edital original antes de formar preço ou decidir pela participação.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Aba: Chat */}
                {activeTab === 'chat' && (
                  <div className="h-full flex flex-col animate-in fade-in slide-in-from-bottom-2">
                    <div className="flex items-center gap-2 mb-4">
                      <MessageSquare className="w-5 h-5 text-brand-blue" />
                      <h3 className="text-xl font-bold text-brand-blue">Converse com o Edital</h3>
                    </div>

                    <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-6 flex items-center justify-center">
                      <div className="max-w-md text-center">
                        <AlertTriangle className="w-8 h-8 text-brand-orange mx-auto mb-3" />
                        <p className="text-sm font-bold text-slate-800">Funcionalidade indisponível nesta versão</p>
                        <p className="text-sm text-slate-600 mt-2">
                          O chat com o edital ainda não está conectado a uma fonte verificável. Não exibimos
                          respostas simuladas que possam ser confundidas com análise do edital.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
