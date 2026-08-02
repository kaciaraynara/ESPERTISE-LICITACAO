import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation } from '@tanstack/react-query';
import { lexApi } from '@services/api';
import { 
  X, 
  Target, 
  ShieldAlert, 
  BarChart3, 
  MessageSquare,
  Zap as Sparkles,
  CheckCircle2,
  AlertTriangle,
  Send
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
  const [chatMessage, setChatMessage] = useState('');
  
  // Mutações simuladas (para plugar na API real depois)
  const resumoMutation = useMutation({
    mutationFn: () => lexApi.resumo({ edital_id: licitacaoId })
  });



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
                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-md">
                  <Sparkles className="w-6 h-6 text-brand-orange" />
                </div>
                <div>
                  <h2 className="text-xl font-bold tracking-tight">Especialista LEX</h2>
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
                      <h3 className="text-xl font-bold text-brand-blue">Resumo Instantâneo</h3>
                      <button onClick={() => resumoMutation.mutate()} className="text-sm font-semibold text-brand-orange hover:underline">
                        Gerar Novamente
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Objeto Principal</p>
                        <p className="font-medium text-slate-800 line-clamp-3" title={objeto}>{objeto}</p>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Modelo de Contratação</p>
                        <p className="font-medium text-slate-800">Sistema de Registro de Preços (SRP) - Vigência 12 meses.</p>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Exigência de Qualificação</p>
                        <p className="font-medium text-slate-800">Balanço Patrimonial (Liquidez &gt; 1,0), Atestado de Capacidade Técnica.</p>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Dica LEX</p>
                        <p className="font-medium text-brand-blue">Leia atentamente o Anexo I - Termo de Referência.</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Aba: Riscos */}
                {activeTab === 'riscos' && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xl font-bold text-brand-blue">Auditoria Jurídica & Habilitação</h3>
                      <span className="bg-orange-100 text-brand-orange px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                        <AlertTriangle className="w-4 h-4" /> 1 Alerta Crítico
                      </span>
                    </div>

                    <div className="space-y-4">
                      <div className="p-5 bg-orange-50/50 border border-brand-orange/20 rounded-xl flex gap-4 items-start">
                        <AlertTriangle className="w-6 h-6 text-brand-orange shrink-0 mt-0.5" />
                        <div>
                          <h4 className="font-bold text-slate-800 mb-1">Atestado de Capacidade Técnica Restritivo</h4>
                          <p className="text-sm text-slate-600 leading-relaxed">
                            O edital exige atestado que comprove fornecimento prévio limitando somatório (Exemplo Base). 
                            <strong className="block mt-2 text-brand-orange">Sugestão LEX:</strong> É altamente recomendável pedir impugnação para permitir o somatório de atestados caso haja restrição.
                          </p>
                          <button className="mt-3 text-xs font-bold bg-white text-brand-blue border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50">
                            Gerar Impugnação com IA
                          </button>
                        </div>
                      </div>

                      <div className="p-5 bg-green-50/50 border border-green-200 rounded-xl flex gap-4 items-start">
                        <CheckCircle2 className="w-6 h-6 text-green-600 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="font-bold text-slate-800 mb-1">Balanço Patrimonial</h4>
                          <p className="text-sm text-slate-600">
                            Os índices exigidos estão dentro dos padrões normais de mercado.
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
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-slate-50 p-5 rounded-xl border border-slate-100">
                        <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Deságio Histórico Estimado</h4>
                        <div className="flex items-end gap-2 mb-2">
                          <span className="text-4xl font-black text-brand-blue">~18%</span>
                          <span className="text-sm font-medium text-slate-500 mb-1">média geral</span>
                        </div>
                        <p className="text-sm text-slate-600">Este é um cálculo probabilístico feito pela IA com base em objetos semelhantes de fornecimento.</p>
                      </div>

                      <div className="bg-slate-50 p-5 rounded-xl border border-slate-100 flex flex-col">
                        <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Ficha do Órgão (Crédito)</h4>
                        <div className="flex flex-col gap-3">
                          <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                            <span className="text-sm text-slate-600 font-medium">Atraso Médio de Pagamento</span>
                            <span className="text-sm font-black text-green-600 bg-green-50 px-2 py-0.5 rounded">12 dias</span>
                          </div>
                          <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                            <span className="text-sm text-slate-600 font-medium">Empenhos Pagos (2025)</span>
                            <span className="text-sm font-black text-brand-blue">R$ 4.2M</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-slate-600 font-medium">Risco de Inadimplência</span>
                            <span className="text-sm font-black text-green-600 flex items-center gap-1">
                               Baixo
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 p-4 bg-blue-50 border border-brand-blue/20 rounded-xl flex items-start gap-3">
                       <Sparkles className="w-6 h-6 text-brand-orange shrink-0 mt-0.5" />
                       <div>
                         <p className="text-sm font-medium text-brand-blue mb-1">
                            <strong>Veredito LEX:</strong>
                         </p>
                         <p className="text-sm text-brand-blue/80">Excelente oportunidade dependendo do preço de custo. Avalie participar se sua margem bruta for superior ao deságio esperado.</p>
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
                    
                    <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4 overflow-y-auto space-y-4">
                      <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-brand-orange text-white flex items-center justify-center shrink-0">
                          <Sparkles className="w-4 h-4" />
                        </div>
                        <div className="bg-white border border-slate-200 p-3 rounded-2xl rounded-tl-none shadow-sm text-sm text-slate-700 max-w-[85%]">
                          Olá! Eu sou o LEX. Posso te ajudar a navegar por este edital. O que você gostaria de saber? Posso confirmar especificações técnicas, multas ou datas.
                        </div>
                      </div>
                    </div>

                    <div className="relative">
                      <input 
                        type="text" 
                        value={chatMessage}
                        onChange={(e) => setChatMessage(e.target.value)}
                        placeholder="Ex: Quais são as penalidades por atraso na entrega?"
                        className="w-full bg-white border border-slate-200 rounded-xl pl-4 pr-12 py-3 text-sm focus:outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
                      />
                      <button className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-brand-blue hover:bg-blue-900 text-white rounded-lg transition-colors">
                        <Send className="w-4 h-4" />
                      </button>
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
