import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ShieldAlert, Gavel, Scale, Loader2, CheckCircle, Copy, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { EditalSelector, EditalOption } from '@components/EditalSelector';
import KanbanImpugnacao from '@components/juridico/KanbanImpugnacao';
import RecursoFraudeWizard from '@components/juridico/RecursoFraudeWizard';
import { streamAiChat } from '@/services/aiStream.service';
import { ChatMessage } from '@/components/ChatMessage';
import { useCompany } from '@/contexts/CompanyContext';
import {
  exportarPecaJuridicaPdf,
  PROMPT_PADRAO_IMPUGNACAO_COMPLETA,
} from '@/utils/legalPdfGenerator';

export default function ImpugnacaoPage() {
  const { selectedCompany } = useCompany();
  const [searchParams] = useSearchParams();
  const urlEditalId =
    searchParams.get('edital') ||
    searchParams.get('editalId') ||
    searchParams.get('noticeId') ||
    searchParams.get('id') ||
    '';

  const vicioParam = searchParams.get('vicio') || searchParams.get('titulo') || '';
  const trechoParam = searchParams.get('trecho') || '';
  const fundamentoParam = searchParams.get('fundamento') || '';
  const arquivoParam = searchParams.get('arquivo') || '';
  const paginaParam = searchParams.get('pagina') || '';

  const [editalSelecionado, setEditalSelecionado] = useState<EditalOption | null>(null);
  const [analisando, setAnalisando] = useState(false);
  const [streamingAuditText, setStreamingAuditText] = useState('');
  const [isAuditStreaming, setIsAuditStreaming] = useState(false);
  const autoTriggeredRef = useRef(false);

  const executarAnaliseImpugnacao = async (alvo?: EditalOption) => {
    const edital = alvo || editalSelecionado;
    if (!edital) {
      toast.error('Selecione um edital real para disparar a leitura fundamentada.');
      return;
    }

    setAnalisando(true);
    setIsAuditStreaming(true);
    setStreamingAuditText('');

    let perguntaFinal = PROMPT_PADRAO_IMPUGNACAO_COMPLETA;
    if (trechoParam || vicioParam) {
      perguntaFinal = `Elabore uma PEÇA JURÍDICA FORMAL DE IMPUGNAÇÃO AO EDITAL com fundamento no Art. 164 da Lei Federal nº 14.133/2021 direcionada ao Pregoeiro / Comissão de Contratação.
OBJETO DA IMPUGNAÇÃO: Ilegalidade apontada: "${vicioParam || 'Cláusula restritiva à ampla competitividade'}".
LOCALIZAÇÃO NO EDITAL: Arquivo: ${arquivoParam || 'Edital Oficial'} | Página: ${paginaParam || 'Conforme texto oficial'}.
TRECHO LITERAL IMPUGNADO DO EDITAL:
"${trechoParam}"
FUNDAMENTAÇÃO JURÍDICA ESPECÍFICA:
${fundamentoParam || 'Artigos 9º, 40, 41, 63 e 67 da Lei Federal nº 14.133/2021 e Súmulas vinculantes do TCU'}

Requisitos da Peça:
1. Endereçamento ao Ilmo. Sr. Pregoeiro / Agente de Contratação do órgão licitante.
2. Tempestividade expressa com fulcro no Art. 164 da Lei 14.133/2021 (tempestiva até 3 dias úteis antes da abertura).
3. Dos Fatos e da Ilegalidade do Trecho Litigioso.
4. Do Direito e Jurisprudência do TCU (demonstrar a lesão ao caráter competitivo).
5. Dos Pedidos Finais: Recebimento, acolhimento, suspensão do certame e republicação com reabertura de prazo legal.`;
    }

    try {
      await streamAiChat({
        endpoint: '/lex/impugnacao',
        noticeId: edital.id,
        pergunta: perguntaFinal,
        onChunk: (_chunk, accumulated) => {
          setStreamingAuditText(accumulated);
        },
        onDone: (fullText) => {
          setStreamingAuditText(fullText);
          setIsAuditStreaming(false);
          if (fullText.trim()) {
            toast.success('Peça de impugnação fundamentada gerada com sucesso!');
          }
        },
        onError: () => {
          toast.error('Não foi possível processar a impugnação automaticamente.');
          setAnalisando(false);
          setIsAuditStreaming(false);
        },
      });
    } catch {
      toast.error('Falha ao conectar com o serviço de auditoria jurídica.');
    } finally {
      setAnalisando(false);
      setIsAuditStreaming(false);
    }
  };

  const handleSelectEdital = (ed: EditalOption) => {
    setEditalSelecionado(ed);
  };

  useEffect(() => {
    if (urlEditalId && editalSelecionado && !autoTriggeredRef.current && !analisando) {
      autoTriggeredRef.current = true;
      void executarAnaliseImpugnacao(editalSelecionado);
    }
  }, [urlEditalId, editalSelecionado]);

  const copiarTexto = () => {
    if (!streamingAuditText) return;
    navigator.clipboard.writeText(streamingAuditText);
    toast.success('Minuta de impugnação copiada para a área de transferência!');
  };

  const baixarImpugnacaoPdfTimbrado = () => {
    if (!streamingAuditText) return;
    exportarPecaJuridicaPdf({
      tipoPeca: 'IMPUGNAÇÃO AO EDITAL',
      orgao: editalSelecionado?.orgao || 'Órgão Público Licitante',
      numeroEdital: editalSelecionado?.numeroEdital || editalSelecionado?.id || 'Edital Oficial',
      objeto: editalSelecionado?.objeto || 'Conforme instrumento convocatório',
      empresaNome: selectedCompany?.razaoSocial || 'Empresa Licitante',
      empresaCnpj: selectedCompany?.cnpj || '',
      empresaEndereco: selectedCompany?.endereco || [selectedCompany?.municipio, selectedCompany?.uf].filter(Boolean).join('/'),
      conteudo: streamingAuditText,
    });
    toast.success('Peça de Impugnação exportada em PDF Timbrado!');
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-6 md:p-8 lg:p-12 font-sans">
      {/* SELETOR DE EDITAL E LEITURA FUNDAMENTADA */}
      <section className="bg-white rounded-3xl border border-slate-200 p-6 md:p-8 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-center gap-3">
            <span className="p-2.5 bg-orange-600 text-white rounded-2xl shadow-md">
              <ShieldAlert size={24} />
            </span>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                Impugnação de Editais & Auditoria Preventiva
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Audite ilegalidades, cláusulas restritivas e calcule tempestividade recursal sob a Lei 14.133/2021.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => executarAnaliseImpugnacao()}
            disabled={analisando || !editalSelecionado}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#EA580C] hover:bg-orange-600 px-5 py-2.5 text-xs font-black uppercase tracking-wider text-white transition active:scale-95 disabled:opacity-50 shadow-md cursor-pointer"
          >
            {analisando ? <Loader2 size={16} className="animate-spin" /> : <Gavel size={16} />}
            {analisando ? 'Auditando Edital...' : 'Auditar Impugnação'}
          </button>
        </div>

        <EditalSelector
          label="Edital / Processo para Impugnação"
          selectedId={urlEditalId}
          onSelectEdital={handleSelectEdital}
        />

        {/* PAINEL DE LEITURA FUNDAMENTADA */}
        {(isAuditStreaming || streamingAuditText) && (
          <div className="bg-[#0A2540] border border-orange-500/40 rounded-2xl p-6 shadow-xl text-white space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-slate-700 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-slate-800 rounded-lg">
                  <Scale className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white tracking-wide">
                    Diagnóstico Jurídico para Impugnação
                  </h3>
                  <span className="text-[10px] text-slate-400">
                    Art. 164 da Lei 14.133/2021 — Prazo tempestivo: até 3 dias úteis antes da abertura
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {isAuditStreaming ? (
                  <span className="flex items-center gap-1.5 text-[10px] text-orange-400 font-bold bg-orange-950/60 px-2.5 py-1 rounded-full border border-orange-500/30">
                    <span className="h-2 w-2 rounded-full bg-orange-500 animate-ping" />
                    Lendo Edital no PNCP...
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-500/30">
                    <CheckCircle size={12} />
                    Leitura Concluída
                  </span>
                )}
                {streamingAuditText && (
                  <>
                    <button
                      type="button"
                      onClick={baixarImpugnacaoPdfTimbrado}
                      className="inline-flex items-center gap-1 rounded-lg bg-orange-600 hover:bg-orange-500 px-2.5 py-1 text-[11px] font-bold text-white transition cursor-pointer"
                      title="Exportar Impugnação em PDF Timbrado"
                    >
                      <Download size={13} />
                      PDF Timbrado
                    </button>
                    <button
                      type="button"
                      onClick={copiarTexto}
                      className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition"
                      title="Copiar texto fundamentado"
                    >
                      <Copy size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="text-xs leading-relaxed text-slate-100 bg-slate-900/60 p-5 rounded-xl border border-slate-800 max-h-96 overflow-y-auto custom-scrollbar">
              <ChatMessage content={streamingAuditText} isStreaming={isAuditStreaming} />
            </div>
          </div>
        )}
      </section>

      {/* WIZARD DE MALHA SOCIETÁRIA & COMBATE A CARTÉIS */}
      <RecursoFraudeWizard initialEditalId={editalSelecionado?.id || urlEditalId} />

      {/* ESTEIRA DE GESTÃO DE IMPUGNAÇÕES */}
      <KanbanImpugnacao />
    </div>
  );
}
