import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { MessageSquareText, Scale, Maximize2, Minimize2, Send, Trash2, X } from 'lucide-react';
import { useCompany } from '../contexts/CompanyContext';
import { lexApi } from '../services/api';
import { ChatMessage, cleanHumanAiText } from './ChatMessage';

interface Mensagem {
  id: string;
  autor: 'usuario' | 'luli';
  texto: string;
  horario: string;
}

function horaAtual(): string {
  return new Date().toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function contextoTela(pathname: string): string {
  if (pathname.includes('radar') || pathname.includes('licitacoes')) return 'Radar de Editais';
  if (pathname.includes('disputa') || pathname.includes('robo')) return 'Sala de Disputa';
  if (pathname.includes('proposta')) return 'Gerador de Propostas';
  if (pathname.includes('fornecedor')) return 'Rede de Fornecedores';
  if (pathname.includes('recurso') || pathname.includes('impugnacao')) return 'Defesas e Recursos';
  if (pathname.includes('certid') || pathname.includes('cofre') || pathname.includes('habilitacao')) {
    return 'Documentos e Certidões';
  }
  if (pathname.includes('fiscal')) return 'Área Fiscal e Contábil';
  if (pathname.includes('contrato') || pathname.includes('pos-vitoria')) return 'Contratos e Pós-Vitória';
  return 'Painel da Empresa';
}

const MENSAGEM_INICIAL: Mensagem = {
  id: 'inicial',
  autor: 'luli',
  texto:
    'Oi! Sou a Luli e estou aqui para te auxiliar em tudo o que você precisar sobre licitações, disputas, contabilidade, impostos e parte jurídica. Pode perguntar do seu jeito — como posso te ajudar agora?',
  horario: '',
};

export function LexFloatingWidget() {
  const { pathname } = useLocation();
  const { selectedCompany } = useCompany();

  const [aberto, setAberto] = useState(false);
  const [expandido, setExpandido] = useState(false);
  const [entrada, setEntrada] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [mensagens, setMensagens] = useState<Mensagem[]>([MENSAGEM_INICIAL]);

  const fimListaRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMensagens((prev) =>
      prev.map((m) => (m.id === 'inicial' && !m.horario ? { ...m, horario: horaAtual() } : m))
    );
  }, []);

  useEffect(() => {
    if (aberto) {
      fimListaRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [mensagens, aberto]);

  useEffect(() => {
    const handler = async (ev: Event) => {
      const edital = (ev as CustomEvent)?.detail;
      if (!edital) return;
      setAberto(true);
      const orgao = edital.orgao || edital.nomeOrgao || edital.buyerName || edital.orgaoEntidade?.razaoSocial || 'Órgão Licitante';
      const objeto = edital.objetoCompra || edital.objeto || 'Objeto não informado';
      const valor = edital.valorTotalEstimado ?? edital.valorEstimado ?? edital.valor_estimado;
      const pergunta = `Analise este edital para a minha empresa e me diga a melhor estratégia para vencer:\nÓrgão: ${orgao}\nEdital: ${edital.numeroEdital || edital.numeroCompra || edital.numeroControlePNCP || edital.id}\nModalidade: ${edital.modalidadeNome || edital.modalidade || 'Pregão'}\nObjeto: ${objeto}\nValor estimado: ${valor ? 'R$ ' + Number(valor).toLocaleString('pt-BR') : 'Consultar edital'}`;

      setMensagens((prev) => [
        ...prev,
        { id: String(Date.now()), autor: 'usuario', texto: `Analise o edital: ${objeto.slice(0, 120)}...`, horario: horaAtual() },
      ]);
      setEnviando(true);
      try {
        const resp = await lexApi.chat({
          stream: false,
          noticeId: edital.numeroControlePNCP || edital.id,
          contexto: `Radar de Editais - Empresa: ${selectedCompany?.razaoSocial || selectedCompany?.nomeFantasia || ''}`,
          messages: [{ role: 'user', content: pergunta }],
        } as any);
        const texto = resp?.data?.data?.answer || resp?.data?.answer || resp?.data?.data?.resposta || resp?.data?.resposta || 'Não consegui analisar este edital agora.';
        setMensagens((prev) => [
          ...prev,
          { id: String(Date.now() + 1), autor: 'luli', texto: String(texto), horario: horaAtual() },
        ]);
      } catch {
        setMensagens((prev) => [
          ...prev,
          { id: String(Date.now() + 1), autor: 'luli', texto: 'Não consegui concluir a análise agora. Tente novamente em instantes.', horario: horaAtual() },
        ]);
      } finally {
        setEnviando(false);
      }
    };
    window.addEventListener('luli:analisar-edital', handler);
    return () => window.removeEventListener('luli:analisar-edital', handler);
  }, [selectedCompany]);

  const limparConversa = () => {
    setMensagens([{ ...MENSAGEM_INICIAL, horario: horaAtual() }]);
  };

  const enviarMensagem = async (e: FormEvent) => {
    e.preventDefault();
    const texto = entrada.trim();
    if (!texto || enviando) return;

    const novaUsuario: Mensagem = {
      id: String(Date.now()),
      autor: 'usuario',
      texto,
      horario: horaAtual(),
    };

    const historicoAtual = [...mensagens, novaUsuario];
    setMensagens(historicoAtual);
    setEntrada('');
    setEnviando(true);

    try {
      const empresaInfo = selectedCompany
        ? `Empresa ativa: ${selectedCompany.razaoSocial || selectedCompany.nomeFantasia || ''} (CNPJ: ${selectedCompany.cnpj || ''}, Ramo: ${(selectedCompany as any).cnaePrincipal || ''}).`
        : '';

      const contextoEdital = `Tela atual: ${contextoTela(pathname)}. ${empresaInfo} Responda como a Luli, de forma humana, natural e direta, sem jargões técnicos, ajudando com licitações (Lei 14.133/2021), disputas, contabilidade/impostos e parte jurídica.`;

      const resp: any = await lexApi.chat({
        messages: historicoAtual
          .filter((m) => m.id !== 'inicial')
          .slice(-10)
          .map((m) => ({
            role: m.autor === 'usuario' ? 'user' : 'assistant',
            content: m.texto,
          })),
        contextoEdital,
        stream: false,
      });

      const payload = resp?.data?.data || resp?.data || resp || {};
      const respostaTexto =
        payload.answer ||
        payload.resposta ||
        payload.reply ||
        payload.response ||
        payload.text ||
        payload.content ||
        payload.message ||
        resp?.data?.answer ||
        resp?.data?.text ||
        (typeof payload === 'string' ? payload : '');

      if (!respostaTexto) {
        throw new Error('Resposta vazia');
      }

      setMensagens((prev) => [
        ...prev,
        {
          id: String(Date.now() + 1),
          autor: 'luli',
          texto: String(respostaTexto),
          horario: horaAtual(),
        },
      ]);
    } catch {
      setMensagens((prev) => [
        ...prev,
        {
          id: String(Date.now() + 1),
          autor: 'luli',
          texto:
            'Não consegui concluir essa resposta agora. Confira se sua conexão está estável e tente enviar novamente.',
          horario: horaAtual(),
        },
      ]);
    } finally {
      setEnviando(false);
    }
  };

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        aria-label="Abrir Consultor Licitatório Luli"
        title="Consultor Licitatório (Luli)"
        className="group fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0B192C] text-white shadow-2xl ring-4 ring-emerald-500/20 transition-all duration-300 hover:scale-105 hover:bg-[#081524] cursor-pointer"
      >
        <div className="relative flex items-center justify-center">
          <MessageSquareText className="h-6 w-6 text-emerald-400 group-hover:text-emerald-300 transition-colors" />
          <span className="absolute -top-1.5 -right-1.5 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </span>
        </div>
      </button>
    );
  }

  return (
    <div
      className={`fixed bottom-5 right-5 z-50 flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl transition-all ${expandido ? 'h-[80vh] w-[92vw] max-w-2xl' : 'h-[520px] w-[92vw] max-w-sm'
        }`}
    >
      <div className="flex items-center justify-between bg-[#0B192C] px-4 py-3.5 text-white">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600/30 border border-emerald-400/40 text-emerald-300">
            <Scale className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold leading-tight text-white">
              Luli — Consultor Licitatório
            </h3>
            <p className="text-[11px] text-slate-300">
              Especialista em Licitações Públicas (Lei 14.133/2021)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={limparConversa}
            title="Nova conversa"
            className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setExpandido((v) => !v)}
            title={expandido ? 'Reduzir' : 'Expandir'}
            className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white"
          >
            {expandido ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => setAberto(false)}
            title="Fechar"
            className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto bg-[#F8FAFC] p-4">
        {mensagens.map((msg) => {
          const ehUsuario = msg.autor === 'usuario';
          return (
            <div
              key={msg.id}
              className={`flex flex-col ${ehUsuario ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${ehUsuario
                  ? 'bg-[#0070C0] text-white'
                  : 'border border-slate-200 bg-white text-[#081C3A]'
                  }`}
              >
                {ehUsuario ? msg.texto : <ChatMessage role="assistant" content={cleanHumanAiText(msg.texto)} />}
              </div>
              {msg.horario && (
                <span className="mt-1 px-1 text-[10px] text-slate-400">
                  {ehUsuario ? 'Você' : 'Luli'} • {msg.horario}
                </span>
              )}
            </div>
          );
        })}

        {enviando && (
          <div className="flex items-start">
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs text-slate-500">
              Luli está escrevendo...
            </div>
          </div>
        )}
        <div ref={fimListaRef} />
      </div>

      <form
        onSubmit={enviarMensagem}
        className="flex items-center gap-2 border-t border-slate-200 bg-white p-3"
      >
        <input
          type="text"
          value={entrada}
          onChange={(e) => setEntrada(e.target.value)}
          placeholder="Escreva sua dúvida aqui..."
          className="flex-1 rounded-full border border-slate-200 bg-[#F8FAFC] px-4 py-2.5 text-sm text-[#081C3A] outline-none focus:border-[#0070C0] focus:bg-white"
        />
        <button
          type="submit"
          disabled={enviando || !entrada.trim()}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0070C0] text-white transition hover:bg-[#005ea3] disabled:opacity-40"
          aria-label="Enviar mensagem"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}

export default LexFloatingWidget;
