import React, { useState } from 'react';
import {
  FileText,
  Sparkles,
  UploadCloud,
  CheckCircle2,
  Clock,
  ShieldAlert,
  ArrowRight,
  Scale,
  Copy,
  Check,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FORNECEDOR_ROUTES } from '@/routes';
import { streamAiChat } from '@/services/aiStream.service';

export const LeitorEditaisPage: React.FC = () => {
  const [editalTexto, setEditalTexto] = useState('');
  const [analisando, setAnalisando] = useState(false);
  const [resultadoStreaming, setResultadoStreaming] = useState('');
  const [analiseConcluida, setAnaliseConcluida] = useState(false);
  const [copiado, setCopiado] = useState(false);

  // Exemplo pré-carregável para teste imediato de demonstração real
  const carregarExemploEdital = () => {
    setEditalTexto(`PREGÃO ELETRÔNICO Nº 45/2026 - UASG 153052
ÓRGÃO: UNIVERSIDADE FEDERAL DE MINAS GERAIS - UFMG
OBJETO: Contratação de serviços de tecnologia da informação, sustentação de infraestrutura em nuvem e suporte técnico especializado sob demanda.
REGIME LEGAL: Lei Federal nº 14.133/2021 e Decreto nº 11.462/2023.
CRITÉRIO DE JULGAMENTO: Menor Preço Global.
VALOR ESTIMADO TOTAL: R$ 4.850.000,00.
DATA DA SESSÃO PÚBLICA: 18 de Novembro de 2026, às 10h00 (horário de Brasília).
PRAZO LIMITE PARA IMPUGNAÇÃO: Até 3 (três) dias úteis anteriores à abertura da sessão (Art. 164 da Lei 14.133/21).

DA HABILITAÇÃO TÉCNICA:
1. Comprovação de aptidão para desempenho de atividade pertinente e compatível em características, quantidades e prazos com o objeto da licitação, mediante atestados de capacidade técnica emitidos por pessoas jurídicas de direito público ou privado.
2. Certificação ISO 27001 e CMMI nível 3 obrigatória no momento da entrega das propostas. (ALERTA: Cláusula restritiva segundo jurisprudência consolidada do TCU - Acórdão 1214/2013-Plenário).

DA QUALIFICAÇÃO ECONÔMICO-FINANCEIRA:
1. Balanço patrimonial e demonstrações contábeis do último exercício social.
2. Índices de Liquidez Geral (LG), Solvência Geral (SG) e Liquidez Corrente (LC) superiores a 1,0.
3. Certidão Negativa de Falência e Recuperação Judicial expedida pelo distribuidor da sede da pessoa jurídica.`);
    toast.success('Edital de demonstração carregado com sucesso!');
  };

  const handleAnalisar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editalTexto.trim()) {
      toast.error('Cole o texto do edital ou carregue um arquivo para análise.');
      return;
    }

    setAnalisando(true);
    setResultadoStreaming('');
    setAnaliseConcluida(false);

    try {
      const prompt = `Você é um assistente especializado em análise de editais de licitações públicas sob a Lei 14.133/2021.
Analise detalhadamente o seguinte edital e estruture um dossiê executivo completo:

1. DADOS FUNDAMENTAIS: Órgão, Modalidade, Objeto, Valor Estimado, Critério de Julgamento.
2. CRONOGRAMA & PRAZOS FATAIS: Data da Sessão, Prazo Limite para Impugnação (Art. 164 da Lei 14.133/21) e Esclarecimentos.
3. REQUISITOS DE HABILITAÇÃO (Arts. 62 a 70 da Lei 14.133/21): Jurídica, Técnica, Fiscal/Trabalhista e Econômico-Financeira.
4. RADAR DE CLÁUSULAS RESTRITIVAS / ABUSIVAS: Aponte exigências que ferem a competitividade com base na Jurisprudência do TCU.
5. CHECKLIST DE CONFORMIDADE PARA O LICITANTE: Documentos obrigatórios indispensáveis para não ser inabilitado.
6. EXEQUÍVEL & PRECIFICAÇÃO: Recomendações estratégicas para elaboração da proposta de preços.

TEXTO DO EDITAL:
${editalTexto.slice(0, 8000)}`;

      await streamAiChat({
        pergunta: prompt,
        onChunk: (chunk: string) => {
          setResultadoStreaming((prev) => prev + chunk);
        },
        onError: () => {
          toast.error('Não foi possível analisar o edital. Tente novamente.');
        },
      });

      setAnaliseConcluida(true);
      toast.success('Auditoria do edital concluída com sucesso!');
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao conectar com o motor de inteligência artificial.');
    } finally {
      setAnalisando(false);
    }
  };

  const copiarRelatorio = () => {
    if (!resultadoStreaming) return;
    navigator.clipboard.writeText(resultadoStreaming);
    setCopiado(true);
    toast.success('Dossiê do edital copiado para a área de transferência!');
    setTimeout(() => setCopiado(false), 3000);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-6 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* CABEÇALHO */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="p-2.5 bg-[#0A2540] text-white rounded-xl shadow-md">
                <FileText size={24} />
              </span>
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                  Leitor Inteligente de Editais
                </h1>
                <p className="text-xs text-slate-500 font-medium">
                  Consulte um resumo do edital, seus prazos e os requisitos que merecem atenção.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={carregarExemploEdital}
              className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs transition-all shadow-sm"
            >
              Carregar Exemplo Real
            </button>
            <Link
              to={FORNECEDOR_ROUTES.radar}
              className="px-4 py-2.5 rounded-xl bg-[#0A2540] hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-2 shadow-md transition-all"
            >
              Buscar no Radar de Editais
              <ArrowRight size={14} />
            </Link>
          </div>
        </header>

        {/* CARDS DE RESUMO OPERACIONAL */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-blue-50 text-[#0A2540] rounded-xl">
              <Scale size={22} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Regime Jurídico</p>
              <p className="text-lg font-black text-slate-900">Lei 14.133/2021</p>
              <p className="text-[11px] text-slate-400">Nova Lei de Licitações</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
              <Clock size={22} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Prazo de Impugnação</p>
              <p className="text-lg font-black text-slate-900">3 Dias Úteis</p>
              <p className="text-[11px] text-slate-400">Art. 164, caput</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-red-50 text-red-600 rounded-xl">
              <ShieldAlert size={22} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pontos de Atenção</p>
              <p className="text-lg font-black text-slate-900">Regras e exigências</p>
              <p className="text-[11px] text-slate-400">Identificação de requisitos que merecem revisão</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <Sparkles size={22} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Lex</p>
              <p className="text-lg font-black text-slate-900">Análise em linguagem clara</p>
              <p className="text-[11px] text-slate-400">Apoio para revisar as informações do edital</p>
            </div>
          </div>
        </div>

        {/* ÁREA DE ENTRADA DO EDITAL E AUDITORIA */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* PAINEL ESQUERDO: INPUT */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm flex flex-col justify-between">
            <form onSubmit={handleAnalisar} className="space-y-4 flex-1 flex flex-col">
              <div className="flex items-center justify-between">
                <label className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <UploadCloud size={18} className="text-[#EA580C]" />
                  Texto ou Cláusulas do Edital
                </label>
                <span className="text-xs font-bold text-slate-400">
                  {editalTexto.length} caracteres
                </span>
              </div>

              <textarea
                value={editalTexto}
                onChange={(e) => setEditalTexto(e.target.value)}
                placeholder="Cole aqui o texto completo ou trechos do edital, termo de referência ou exigências de habilitação..."
                className="w-full flex-1 min-h-[360px] p-4 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#EA580C] text-slate-800 leading-relaxed resize-none"
              />

              <div className="pt-2 flex items-center gap-3">
                <button
                  type="submit"
                  disabled={analisando || !editalTexto.trim()}
                  className="w-full py-3 px-4 rounded-xl bg-[#EA580C] hover:bg-orange-600 disabled:bg-slate-300 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
                >
                  {analisando ? (
                    <>
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Analisando o edital...
                    </>
                  ) : (
                    <>
                      <Sparkles size={18} />
                      Analisar edital
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* PAINEL DIREITO: RESULTADO STREAMING */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
                <h3 className="font-black text-slate-900 text-sm">
                  Resumo e pontos de atenção
                </h3>
              </div>

              {resultadoStreaming && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={copiarRelatorio}
                    className="p-2 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-bold flex items-center gap-1.5 transition-all"
                    title="Copiar relatório completo"
                  >
                    {copiado ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                    {copiado ? 'Copiado' : 'Copiar'}
                  </button>
                  <Link
                    to={FORNECEDOR_ROUTES.propostas}
                    className="px-3 py-1.5 rounded-lg bg-[#0A2540] hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 transition-all"
                  >
                    Gerar Proposta
                    <ArrowRight size={13} />
                  </Link>
                </div>
              )}
            </div>

            <div className="flex-1 mt-4 p-5 bg-slate-50 border border-slate-200/60 rounded-xl overflow-y-auto max-h-[500px]">
              {resultadoStreaming ? (
                <div className="prose prose-sm max-w-none text-slate-800 text-xs leading-relaxed whitespace-pre-wrap font-sans">
                  {resultadoStreaming}
                </div>
              ) : (
                <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center p-8 space-y-3">
                  <div className="p-4 bg-white rounded-full border border-slate-200 shadow-sm text-slate-400">
                    <Sparkles size={32} className="text-[#EA580C]" />
                  </div>
                  <h4 className="font-black text-slate-800 text-sm">
                    Aguardando o texto do edital
                  </h4>
                  <p className="text-xs text-slate-500 max-w-sm">
                    Cole o texto do edital ao lado ou carregue um exemplo para ver como a análise funciona.
                  </p>
                </div>
              )}
            </div>

            {analiseConcluida && (
              <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                <span className="text-emerald-700 font-bold flex items-center gap-1.5">
                  <CheckCircle2 size={16} /> Auditoria concluída sob a Lei 14.133/2021
                </span>
                <div className="flex items-center gap-2">
                  <Link
                    to={FORNECEDOR_ROUTES.impugnacao}
                    className="px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold transition-all"
                  >
                    Montar Peça de Impugnação
                  </Link>
                  <Link
                    to={FORNECEDOR_ROUTES.propostas}
                    className="px-3 py-1.5 rounded-lg bg-[#EA580C] hover:bg-orange-600 text-white font-bold transition-all"
                  >
                    Montar Proposta de Preços
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeitorEditaisPage;
