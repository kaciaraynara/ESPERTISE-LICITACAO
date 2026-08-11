import React, { useState } from 'react';
import { 
  Bot, Scale, Sparkles, Download, Loader2
} from 'lucide-react';
import { lexApi } from '@services/api';
import toast from 'react-hot-toast';

interface CláusulaAnalisada {
  id: string;
  item: string;
  categoria: 'RISCO_JURIDICO' | 'EXIGENCIA_ABUSIVA' | 'AMBIGUIDADE' | 'CONFORME';
  textoClausula: string;
  analiseLex: string;
  sugestaoImpugnacao?: string;
  nivelRisco: 'ALTO' | 'MEDIO' | 'BAIXO';
}

export const LexAnalisePage: React.FC = () => {
  const [editalSelecionado, setEditalSelecionado] = useState('PE 102/2026 - PMSP');
  const [analisando, setAnalisando] = useState(false);

  const [clausulas, setClausulas] = useState<CláusulaAnalisada[]>([
    {
      id: '1',
      item: 'Cláusula 7.3.2 - Habilitação Técnica',
      categoria: 'EXIGENCIA_ABUSIVA',
      textoClausula: 'Exigência de atestado registrado no CREA emitido exclusivamente no mesmo estado do órgão contratante.',
      analiseLex: 'Restrição indevida de competitividade. A jurisprudência pacífica do TCU (Súmula 272) veda exigência territorial para comprovação de aptidão técnica.',
      sugestaoImpugnacao: 'Solicita-se a exclusão do trecho "emitido exclusivamente no mesmo estado", por violar o art. 9º, I da Lei 14.133/2021.',
      nivelRisco: 'ALTO'
    },
    {
      id: '2',
      item: 'Cláusula 12.1 - Prazos de Pagamento',
      categoria: 'RISCO_JURIDICO',
      textoClausula: 'Pagamento efetuado em até 60 (sessenta) dias após liquidação do documento fiscal.',
      analiseLex: 'O prazo ultrapassa o limite de 30 dias estabelecido como regra geral na Lei 14.133/2021 (art. 143), gerando risco ao fluxo de caixa.',
      sugestaoImpugnacao: 'Requer-se adequação do prazo máximo para 30 dias contados da entrega definitiva.',
      nivelRisco: 'MEDIO'
    },
    {
      id: '3',
      item: 'Cláusula 4.1 - Amostras e Prova de Conceito',
      categoria: 'CONFORME',
      textoClausula: 'Apresentação de amostra apenas pelo licitante provisoriamente classificado em primeiro lugar.',
      analiseLex: 'Totalmente conforme a Nova Lei de Licitações. Impede custos desnecessários antes do julgamento das propostas.',
      nivelRisco: 'BAIXO'
    }
  ]);

  const executarAnaliseIa = async () => {
    setAnalisando(true);
    try {
      const res = await lexApi.consultar({ 
        pergunta: `Analise o edital ${editalSelecionado} buscando por irregularidades na Nova Lei de Licitações.` 
      });
      if (res.data?.data) {
        toast.success('Análise finalizada pela LEX AI!');
      }
    } catch (err) {
      toast.error('Erro na comunicação com a API de IA, utilizando dados em cache.');
    } finally {
      setAnalisando(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800 p-8">
      
      {/* CABEÇALHO */}
      <header className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-[#0A2540] text-white rounded-lg shadow-md">
              <Bot size={20} />
            </span>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              LEX AI - Inteligência Jurídica & Leitura de Edital
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Análise automatizada por IA para identificação de cláusulas ilícitas, pegadinhas e sugestões de impugnação.
          </p>
        </div>

        <button 
          onClick={executarAnaliseIa}
          disabled={analisando}
          className="px-6 py-3 bg-[#EA580C] hover:bg-orange-600 text-white font-black text-xs rounded-xl shadow-lg flex items-center gap-2 transition-all disabled:opacity-50"
        >
          {analisando ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {analisando ? 'REANALISANDO EDITAL...' : 'EXECUTAR ANÁLISE COMPLETA'}
        </button>
      </header>

      {/* PAINEL PRINCIPAL */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* ESQUERDA: LISTA DE CLÁUSULAS */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200">
            <span className="text-xs font-bold text-slate-700">Edital sob Análise:</span>
            <select 
              value={editalSelecionado}
              onChange={(e) => setEditalSelecionado(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-900 focus:outline-none"
            >
              <option value="PE 102/2026 - PMSP">PE 102/2026 - Prefeitura Municipal de SP</option>
              <option value="PE 088/2026 - SES">PE 088/2026 - Secretaria de Saúde SP</option>
            </select>
          </div>

          <div className="space-y-4">
            {clausulas.map((c) => (
              <div key={c.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="font-bold text-xs text-slate-900">{c.item}</span>
                  <span className={`text-[10px] font-black px-2.5 py-0.5 rounded uppercase ${
                    c.nivelRisco === 'ALTO'
                      ? 'bg-rose-100 text-rose-800'
                      : c.nivelRisco === 'MEDIO'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    Risco {c.nivelRisco}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs font-mono text-slate-700">
                  "{c.textoClausula}"
                </div>

                <div className="space-y-2 pt-1">
                  <div className="flex items-start gap-2 text-xs">
                    <Scale size={16} className="text-[#0A2540] shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-slate-900">Parecer Jurídico LEX:</span>
                      <p className="text-slate-600 mt-0.5">{c.analiseLex}</p>
                    </div>
                  </div>

                  {c.sugestaoImpugnacao && (
                    <div className="mt-3 p-3 bg-orange-50/50 rounded-xl border border-orange-200/60 text-xs">
                      <span className="font-bold text-[#EA580C] block mb-1">
                        Minuta Recomendada para Impugnação/Esclarecimento:
                      </span>
                      <p className="text-slate-700 italic">{c.sugestaoImpugnacao}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* DIREITA: PARECER GERAL */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-[#0A2540] text-white p-6 rounded-2xl shadow-xl space-y-4">
            <h3 className="text-xs font-bold text-[#EA580C] uppercase tracking-wider">
              Resumo do Diagnóstico LEX
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">Total de Cláusulas Analisadas:</span>
                <span className="font-bold text-white">48</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">Pontos Críticos / Abusivos:</span>
                <span className="font-bold text-rose-400">2</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">Ambiguidades Detectadas:</span>
                <span className="font-bold text-amber-400">1</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Índice de Conformidade Legal:</span>
                <span className="font-bold text-emerald-400">93.7%</span>
              </div>
            </div>

            <button className="w-full mt-4 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2">
              <Download size={14} /> Exportar Parecer Jurídico (PDF)
            </button>
          </div>
        </div>

      </div>

    </div>
  );
};