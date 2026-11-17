import React, { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Sparkles,
  Send,
  Loader2,
  Search,
  ShieldAlert,
  FileText,
  Calculator,
  Building2,
  Download,
  RefreshCw,
  Bot,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { lexApi } from '../../services/api';
import { EditalOption, EditalSelector } from '../../components/EditalSelector';

interface MensagemChat {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

const ACOES_RAPIDAS = [
  {
    titulo: 'Investigar CNPJ e Socios',
    descricao: 'Cruzar quadro societario, endereco e situacao cadastral',
    icon: Building2,
    prompt: 'Investigue este CNPJ (socios, endereco, CNAE e possiveis vinculos entre empresas): ',
  },
  {
    titulo: 'Montar Proposta (-8%)',
    descricao: 'Calcular lances competitivos com base nos itens do PNCP',
    icon: Calculator,
    prompt: 'Com base nos itens e valores de referencia deste edital/link do PNCP, monte uma proposta competitiva aplicando -8% e destacando margem de seguranca: ',
  },
  {
    titulo: 'Detectar Irregularidades',
    descricao: 'Apontar clausulas restritivas e indicios de risco',
    icon: ShieldAlert,
    prompt: 'Faca uma varredura investigativa neste edital buscando clausulas restritivas, exigencias atipicas ou indicios de direcionamento, com linhas de defesa: ',
  },
  {
    titulo: 'Resumo Executivo',
    descricao: 'Objeto, prazos, exigencias e documentos em segundos',
    icon: FileText,
    prompt: 'Faca um resumo executivo direto e visual deste edital (objeto, valor estimado, data da sessao, habilitacao e pontos de atencao): ',
  },
];

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export const LexAnalisePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const urlEditalId =
    searchParams.get('edital') ||
    searchParams.get('editalId') ||
    searchParams.get('noticeId') ||
    searchParams.get('id') ||
    '';

  const [editalSelecionado, setEditalSelecionado] = useState<EditalOption | null>(null);
  const [mensagens, setMensagens] = useState<MensagemChat[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Ola! Eu sou a Luli, sua Central Investigativa da Expertise Licitatoria.\n\nVoce pode colar aqui um link oficial do PNCP, digitar um CNPJ para eu cruzar socios e endereco na Receita, ou selecionar um edital acima para analisar riscos, montar proposta (-8%) e preparar impugnacoes.',
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [carregando, setCarregando] = useState(false);
  const fimChatRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const autoExecutedRef = useRef(false);

  useEffect(() => {
    fimChatRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens, carregando]);

  const montarContextoEdital = (edital: EditalOption | null): string | undefined => {
    if (!edital) return undefined;
    return [
      `ID do Edital: ${edital.id}`,
      edital.objeto ? `Objeto: ${edital.objeto}` : '',
      edital.orgao ? `Orgao: ${edital.orgao}` : '',
      (edital as any).uf ? `UF: ${(edital as any).uf}` : '',
      edital.valorEstimado ? `Valor Estimado: R$ ${edital.valorEstimado}` : '',
    ]
      .filter(Boolean)
      .join(' | ');
  };

  const enviarMensagem = async (textoCustom?: string) => {
    const texto = (textoCustom ?? input).trim();
    if (!texto || carregando) return;

    const horaAtual = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const novaMsgUser: MensagemChat = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: texto,
      timestamp: horaAtual,
    };

    const historicoAtualizado = [...mensagens, novaMsgUser];
    setMensagens(historicoAtualizado);
    if (!textoCustom) setInput('');
    setCarregando(true);

    try {
      const payloadMessages = historicoAtualizado
        .filter((m) => m.id !== 'welcome')
        .map((m) => ({ role: m.role, content: m.content }));

      const resp = await lexApi.chat({
        messages: payloadMessages,
        contextoEdital: montarContextoEdital(editalSelecionado),
        stream: false,
      });

      const data: any = resp.data || {};
      const respostaTexto =
        data.reply ||
        data.response ||
        data.message ||
        data.content ||
        data.texto ||
        'Analise concluida, mas o retorno veio vazio. Tente reformular a pergunta.';

      setMensagens((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: String(respostaTexto),
          timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (err: any) {
      const msgErro =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        'A analise demorou mais que o esperado. Tente novamente com um trecho menor ou um link especifico do PNCP.';
      toast.error(msgErro);
      setMensagens((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: `Nao consegui concluir essa consulta agora: ${msgErro}`,
          timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    if (urlEditalId && editalSelecionado && !autoExecutedRef.current) {
      autoExecutedRef.current = true;
      enviarMensagem(`Faca uma analise investigativa completa do edital selecionado (${editalSelecionado.objeto || urlEditalId}).`);
    }
  }, [urlEditalId, editalSelecionado]);

  const usarAcaoRapida = (promptBase: string) => {
    setInput(promptBase);
    inputRef.current?.focus();
  };

  const limparConversa = () => {
    setMensagens([
      {
        id: 'welcome',
        role: 'assistant',
        content:
          'Conversa reiniciada. Cole um link do PNCP, um CNPJ para investigar ou pergunte sobre qualquer edital.',
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  const exportarConversaPdf = () => {
    const msgsParaImprimir = mensagens.filter((m) => m.id !== 'welcome');
    if (msgsParaImprimir.length === 0) {
      toast.error('Faca pelo menos uma consulta antes de gerar o relatorio.');
      return;
    }

    const blocosHtml = msgsParaImprimir
      .map(
        (m) => `
        <div style="margin-bottom:16px;padding:14px;border-radius:8px;border:1px solid ${
          m.role === 'user' ? '#cbd5e1' : '#bfdbfe'
        };background:${m.role === 'user' ? '#f8fafc' : '#eff6ff'};">
          <div style="font-size:11px;font-weight:700;color:#081C3A;margin-bottom:6px;text-transform:uppercase;">
            ${m.role === 'user' ? 'Consulta do Licitante' : 'Parecer Luli - Central Investigativa'} (${escapeHtml(m.timestamp)})
          </div>
          <div style="font-size:13px;line-height:1.6;color:#1e293b;white-space:pre-wrap;">${escapeHtml(m.content)}</div>
        </div>`
      )
      .join('');

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Relatorio Luli - Expertise Licitatoria</title>
  <style>
    @page { size: A4; margin: 18mm; }
    body { font-family: Arial, sans-serif; color: #0f172a; margin: 0; }
    .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #F97316; padding-bottom: 12px; margin-bottom: 20px; }
    .header img { height: 46px; }
    .meta { text-align: right; font-size: 11px; color: #475569; }
    h1 { font-size: 18px; color: #081C3A; margin: 0 0 12px 0; }
  </style>
</head>
<body>
  <div class="header">
    <img src="${window.location.origin}/assets/logo-expertise.png" alt="Expertise Licitatoria" />
    <div class="meta">
      <strong>Central Investigativa Luli</strong><br/>
      Emitido em ${new Date().toLocaleString('pt-BR')}
    </div>
  </div>
  <h1>Relatorio Tecnico e Investigativo</h1>
  ${editalSelecionado ? `<p style="font-size:12px;color:#334155;"><strong>Edital Vinculado:</strong> ${escapeHtml(editalSelecionado.objeto || editalSelecionado.id)}</p>` : ''}
  ${blocosHtml}
  <script>window.onload = function(){ window.print(); };</script>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
    } else {
      toast.error('Permita pop-ups para visualizar e salvar o PDF.');
    }
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-5.5rem)] max-w-6xl flex-col gap-4 p-4 md:p-6">
      {/* Cabecalho visual da Central */}
      <div className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#081C3A] text-white shadow-sm">
            <Bot className="h-6 w-6 text-[#F97316]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-extrabold text-[#081C3A]">Luli — Central Investigativa</h1>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
                <Sparkles className="h-3 w-3" /> Online
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Cole links do PNCP, investigue CNPJs e monte propostas competitivas em um unico chat
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="w-full md:w-72">
            <EditalSelector
              selectedId={editalSelecionado?.id || urlEditalId}
              onSelectEdital={(edital: EditalOption) => setEditalSelecionado(edital)}
            />
          </div>
          <button
            type="button"
            onClick={exportarConversaPdf}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-[#081C3A] hover:bg-slate-50"
          >
            <Download className="h-4 w-4 text-[#F97316]" />
            Baixar PDF
          </button>
          <button
            type="button"
            onClick={limparConversa}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" />
            Nova Consulta
          </button>
        </div>
      </div>

      {/* Cards de Acoes Rapidas */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        {ACOES_RAPIDAS.map((acao) => {
          const Icon = acao.icon;
          return (
            <button
              key={acao.titulo}
              type="button"
              onClick={() => usarAcaoRapida(acao.prompt)}
              className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-[#F97316] hover:bg-orange-50/30"
            >
              <div className="mt-0.5 rounded-lg bg-slate-100 p-2 text-[#081C3A]">
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-[#081C3A]">{acao.titulo}</div>
                <div className="mt-0.5 text-[11px] leading-snug text-slate-500">{acao.descricao}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Area principal do Chat */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex-1 space-y-4 overflow-y-auto p-4 md:p-6">
          {mensagens.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-xs ${
                    isUser
                      ? 'bg-[#081C3A] text-white'
                      : 'border border-slate-200 bg-slate-50 text-slate-800'
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between gap-4 text-[11px] font-bold opacity-75">
                    <span>{isUser ? 'Voce' : 'Luli Investigativa'}</span>
                    <span>{msg.timestamp}</span>
                  </div>
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                </div>
              </div>
            );
          })}

          {carregando && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold text-[#081C3A]">
                <Loader2 className="h-4 w-4 animate-spin text-[#F97316]" />
                Cruzando dados oficiais e preparando resposta...
              </div>
            </div>
          )}
          <div ref={fimChatRef} />
        </div>

        {/* Barra de entrada */}
        <div className="border-t border-slate-200 bg-slate-50 p-3 md:p-4">
          <div className="flex items-end gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-3.5 left-3.5 h-4 w-4 text-slate-400" />
              <textarea
                ref={inputRef}
                rows={2}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    enviarMensagem();
                  }
                }}
                placeholder="Cole um link do PNCP, digite um CNPJ para investigar ou peca uma proposta..."
                className="w-full resize-none rounded-xl border border-slate-300 bg-white py-2.5 pr-3 pl-10 text-sm text-slate-800 outline-none focus:border-[#081C3A] focus:ring-2 focus:ring-[#081C3A]/10"
              />
            </div>
            <button
              type="button"
              disabled={carregando || !input.trim()}
              onClick={() => enviarMensagem()}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#F97316] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LexAnalisePage;
