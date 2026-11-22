import React, { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Sparkles,
  Send,
  Loader2,
  ShieldAlert,
  FileText,
  Calculator,
  Building2,
  Download,
  RefreshCw,
  Bot,
  Paperclip,
  X,
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
    titulo: 'Investigar CNPJ',
    icon: Building2,
    prompt: 'Investigue este CNPJ (sócios, endereco, CNAE e possíveis vínculos entre empresas): ',
  },
  {
    titulo: 'Proposta (-8%)',
    icon: Calculator,
    prompt: 'Com base nos itens e valores de referencia deste edital/link do PNCP, monte uma proposta competitiva aplicando -8% e destacando margem de seguranca: ',
  },
  {
    titulo: 'Riscos e Irregularidades',
    icon: ShieldAlert,
    prompt: 'Faça uma varredura investigativa neste edital buscando clausulas restritivas, exigências atipicas ou indicios de direcionamento, com linhas de defesa: ',
  },
  {
    titulo: 'Resumo Executivo',
    icon: FileText,
    prompt: 'Faca um resumo executivo direto e visual deste edital (objeto, valor estimado, data da sessao, habilitação e pontos de atencao): ',
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
        'Olá! Eu sou a Luli, especialista em licitações da Expertise.\n\nCole aqui um link do PNCP, envie um PDF/Foto do edital ou digite um CNPJ para eu analisar e responder de forma completa.',
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [anexo, setAnexo] = useState<{ name: string; mimeType: string; base64: string } | null>(null);
  const [carregando, setCarregando] = useState(false);
  const fimChatRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const autoExecutedRef = useRef(false);

  useEffect(() => {
    fimChatRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens, carregando]);

  const montarContextoEdital = (edital: EditalOption | null): string | undefined => {
    if (!edital) return undefined;
    return [
      `ID do Edital: ${edital.id}`,
      edital.objeto ? `Objeto: ${edital.objeto}` : '',
      edital.orgao ? `Órgão: ${edital.orgao}` : '',
      (edital as any).uf ? `UF: ${(edital as any).uf}` : '',
      edital.valorEstimado ? `Valor Estimado: R$ ${edital.valorEstimado}` : '',
    ]
      .filter(Boolean)
      .join(' | ');
  };

  const enviarMensagem = async (textoCustom?: string) => {
    const texto = (textoCustom ?? input).trim();
    if (!texto && !anexo) return;
    if (carregando) return;

    const conteudoEnvio = texto || `Análise o arquivo anexado: ${anexo?.name}`;
    const horaAtual = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const novaMsgUser: MensagemChat = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: anexo ? `[${anexo.name}] ${conteudoEnvio}` : conteudoEnvio,
      timestamp: horaAtual,
    };

    const historicoAtualizado = [...mensagens, novaMsgUser];
    setMensagens(historicoAtualizado);
    if (!textoCustom) setInput('');
    const anexoAtual = anexo;
    setAnexo(null);
    setCarregando(true);

    try {
      const payloadMessages = historicoAtualizado
        .filter((m) => m.id !== 'welcome')
        .map((m) => ({ role: m.role, content: m.content }));

      const noticeIdAtivo =
        (editalSelecionado as any)?.numeroControlePNCP ||
        (editalSelecionado as any)?.id ||
        searchParams.get('noticeId') ||
        undefined;
      const resp = await lexApi.chat({
        messages: payloadMessages,
        ...(noticeIdAtivo ? { noticeId: noticeIdAtivo } : {}),
        contextoEdital: montarContextoEdital(editalSelecionado),
        stream: false,
        ...(anexoAtual
          ? { fileBase64: anexoAtual.base64, fileMimeType: anexoAtual.mimeType, fileName: anexoAtual.name }
          : {}),
      } as any);

      const data: any = resp.data || {};
      const respostaTexto =
        data.reply ||
        data.response ||
        data.resposta ||
        data.answer ||
        data.message ||
        data.content ||
        data.texto ||
        data.data?.reply ||
        data.data?.resposta ||
        data.data?.response ||
        data.data?.answer ||
        'Não foi possível obter o parecer agora. Tente novamente.';

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
        'A análise demorou mais que o esperado. Tente novamente com um trecho menor ou um link especifico do PNCP.';
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
      enviarMensagem(`Faça uma análise completa e objetiva do edital selecionado (${editalSelecionado.objeto || urlEditalId}).`);
    }
  }, [urlEditalId, editalSelecionado]);

  const limparConversa = () => {
    setMensagens([
      {
        id: 'welcome',
        role: 'assistant',
        content: 'Nova consulta iniciada. Cole um link do PNCP, anexe um PDF/Foto ou digite um CNPJ.',
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
            ${m.role === 'user' ? 'Consulta do Licitante' : 'Parecer Luli - Expertise Licitatória'} (${escapeHtml(m.timestamp)})
          </div>
          <div style="font-size:13px;line-height:1.6;color:#1e293b;white-space:pre-wrap;">${escapeHtml(m.content)}</div>
        </div>`
      )
      .join('');

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Parecer Luli - Expertise Licitatória</title>
  <style>
    @page { size: A4; margin: 18mm; }
    body { font-family: Arial, sans-serif; color: #0f172a; margin: 0; }
    .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #F97316; padding-bottom: 12px; margin-bottom: 20px; }
    .header img { height: 46px; }
  </style>
</head>
<body>
  <div class="header">
    <img src="${window.location.origin}/assets/logo-expertise.png" alt="Expertise Licitatória" />
    <div style="text-align:right;font-size:11px;color:#475569;">
      <strong>Luli Investigativa</strong><br/>Emitido em ${new Date().toLocaleString('pt-BR')}
    </div>
  </div>
  ${blocosHtml}
  <script>window.onload = function(){ window.print(); };</script>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-3 py-4 sm:px-6">
      {/* Barra superior compacta */}
      <div className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm md:flex-row md:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#081C3A] text-[#F97316]">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-extrabold text-[#081C3A]">Luli — Análise Investigativa</h1>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                <Sparkles className="h-3 w-3" /> Online
              </span>
            </div>
            <p className="text-xs text-slate-500">Leitura de editais, PDF/Foto, CNPJs e propostas</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="w-full sm:w-64">
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
            <Download className="h-3.5 w-3.5 text-[#F97316]" /> PDF
          </button>
          <button
            type="button"
            onClick={limparConversa}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Limpar
          </button>
        </div>
      </div>

      {/* Area ampla do Chat (sem espremer) */}
      <div className="flex min-h-[68vh] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
          {mensagens.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[92%] sm:max-w-[82%] rounded-2xl px-4 py-3.5 text-sm leading-relaxed ${
                    isUser
                      ? 'bg-[#081C3A] text-white'
                      : 'border border-slate-200 bg-slate-50 text-slate-800'
                  }`}
                >
                  <div className="mb-1.5 flex items-center justify-between gap-4 text-[11px] font-bold opacity-75">
                    <span>{isUser ? 'Voce' : 'Luli Especialista'}</span>
                    <span>{msg.timestamp}</span>
                  </div>
                  <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                </div>
              </div>
            );
          })}

          {carregando && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold text-[#081C3A]">
                <Loader2 className="h-4 w-4 animate-spin text-[#F97316]" />
                Analisando dados oficiais...
              </div>
            </div>
          )}
          <div ref={fimChatRef} />
        </div>

        {/* Barra de atalhos compactos + entrada */}
        <div className="border-t border-slate-200 bg-slate-50 p-3 sm:p-4 space-y-2.5">
          <div className="flex flex-wrap gap-1.5">
            {ACOES_RAPIDAS.map((acao) => {
              const Icon = acao.icon;
              return (
                <button
                  key={acao.titulo}
                  type="button"
                  onClick={() => {
                    setInput(acao.prompt);
                    inputRef.current?.focus();
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-bold text-[#081C3A] hover:border-[#F97316]"
                >
                  <Icon className="h-3 w-3 text-[#F97316]" />
                  {acao.titulo}
                </button>
              );
            })}
          </div>

          {anexo && (
            <div className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-[#081C3A]">
              <Paperclip className="h-3.5 w-3.5 text-[#0070C0]" />
              <span>{anexo.name}</span>
              <button type="button" onClick={() => setAnexo(null)} className="text-slate-500 hover:text-rose-600">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 12 * 1024 * 1024) {
                    toast.error('Arquivo muito grande. Limite de 12 MB.');
                    return;
                  }
                  const reader = new FileReader();
                  reader.onload = () => {
                    const resStr = String(reader.result || '');
                    const base64 = resStr.includes(',') ? resStr.split(',')[1] : resStr;
                    setAnexo({ name: file.name, mimeType: file.type || 'application/pdf', base64 });
                    toast.success(`Arquivo "${file.name}" anexado.`);
                  };
                  reader.readAsDataURL(file);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-[#081C3A] hover:bg-slate-100"
              >
                <Paperclip className="h-4 w-4 text-[#F97316]" />
                PDF / Foto
              </button>
            </div>

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
              placeholder="Cole um link do PNCP, digite um CNPJ ou pergunte para a Luli..."
              className="w-full flex-1 resize-none rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-[#081C3A]"
            />

            <button
              type="button"
              disabled={carregando || (!input.trim() && !anexo)}
              onClick={() => enviarMensagem()}
              className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#F97316] px-5 text-sm font-bold text-white shadow-sm hover:bg-orange-600 disabled:opacity-50"
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
