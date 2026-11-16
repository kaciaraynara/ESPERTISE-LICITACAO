import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { Bot, Maximize2, Minimize2, Send, Trash2, X } from 'lucide-react';
import { useCompany } from '../contexts/CompanyContext';

interface Mensagem {
  id: string;
  autor: 'usuario' | 'luli';
  texto: string;
  horario: string;
}

const API_URL =
  import.meta.env.VITE_API_URL || 'https://espertise-licitacao.onrender.com/api';

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
  const [imgErro, setImgErro] = useState(false);
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
      const token =
        localStorage.getItem('token') || localStorage.getItem('accessToken') || '';

      const res = await fetch(`${API_URL}/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          message: texto,
          mensagem: texto,
          contexto: {
            tela: contextoTela(pathname),
            rota: pathname,
            empresa: selectedCompany?.razaoSocial || selectedCompany?.nomeFantasia || '',
            cnpj: selectedCompany?.cnpj || '',
            cnae: (selectedCompany as any)?.cnaePrincipal || '',
          },
          history: historicoAtual.slice(-8).map((m) => ({
            role: m.autor === 'usuario' ? 'user' : 'assistant',
            content: m.texto,
          })),
        }),
      });

      const data = await res.json().catch(() => ({}));
      const respostaTexto =
        data?.reply ||
        data?.response ||
        data?.message ||
        data?.data?.reply ||
        data?.data?.response ||
        '';

      if (!res.ok || !respostaTexto) {
        throw new Error('Sem resposta do serviço de atendimento.');
      }

      setMensagens((prev) => [
        ...prev,
        {
          id: String(Date.now() + 1),
          autor: 'luli',
          texto: respostaTexto,
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
            'Não consegui concluir sua consulta agora porque o serviço de atendimento demorou para responder. Tente enviar novamente em alguns segundos.',
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
        aria-label="Conversar com a Luli"
        className="group fixed bottom-5 right-5 z-50 flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-xl ring-2 ring-[#0070C0]/25 transition-transform duration-300 hover:scale-105"
      >
        {!imgErro ? (
          <img
            src="/assets/mascote-3d.png"
            alt="Luli"
            onError={() => setImgErro(true)}
            className="h-14 w-14 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#081C3A] text-white">
            <Bot className="h-6 w-6" />
          </div>
        )}
      </button>
    );
  }

  return (
    <div
      className={`fixed bottom-5 right-5 z-50 flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl transition-all ${
        expandido ? 'h-[80vh] w-[92vw] max-w-2xl' : 'h-[520px] w-[92vw] max-w-sm'
      }`}
    >
      {/* Cabeçalho limpo e humano */}
      <div className="flex items-center justify-between bg-[#081C3A] px-4 py-3.5 text-white">
        <div className="flex items-center gap-3">
          {!imgErro ? (
            <img
              src="/assets/mascote-3d.png"
              alt="Luli"
              onError={() => setImgErro(true)}
              className="h-10 w-10 rounded-full bg-white object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0070C0]">
              <Bot className="h-5 w-5" />
            </div>
          )}
          <div>
            <h3 className="text-sm font-extrabold leading-tight">Luli</h3>
            <p className="text-[11px] text-slate-300">
              Licitações, Disputas, Contabilidade e Jurídico
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

      {/* Área de mensagens */}
      <div className="flex-1 space-y-3 overflow-y-auto bg-[#F8FAFC] p-4">
        {mensagens.map((msg) => {
          const ehUsuario = msg.autor === 'usuario';
          return (
            <div
              key={msg.id}
              className={`flex flex-col ${ehUsuario ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                  ehUsuario
                    ? 'bg-[#0070C0] text-white'
                    : 'border border-slate-200 bg-white text-[#081C3A]'
                }`}
              >
                {msg.texto}
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

      {/* Campo de envio */}
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
