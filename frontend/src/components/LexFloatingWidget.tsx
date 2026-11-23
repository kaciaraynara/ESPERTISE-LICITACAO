import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Maximize2, Minimize2, Send, Trash2, X, Move, Sparkles } from 'lucide-react';
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
  if (pathname.includes('disputa') || pathname.includes('robo')) return 'Sala de Disputa & Robô de Lances';
  if (pathname.includes('proposta')) return 'Gerador de Propostas';
  if (pathname.includes('fornecedor')) return 'Rede de Fornecedores';
  if (pathname.includes('recurso') || pathname.includes('impugnacao')) return 'Defesas e Recursos';
  if (pathname.includes('certid') || pathname.includes('cofre') || pathname.includes('habilitacao')) {
    return 'Documentos de Habilitação';
  }
  if (pathname.includes('fiscal')) return 'Área Fiscal e Contábil';
  if (pathname.includes('contrato') || pathname.includes('pos-vitoria')) return 'Contratos e Pós-Vitória';
  return 'Painel da Empresa';
}

const MENSAGEM_INICIAL: Mensagem = {
  id: 'inicial',
  autor: 'luli',
  texto:
    'Olá! Sou a Luli, sua consultora especialista em Licitações Públicas (Lei nº 14.133/2021). Estou aqui para analisar editais, viabilidade, estratégias de lances e documentação jurídica. Como posso ajudar você a vencer agora?',
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
  const [hovered, setHovered] = useState(false);

  // Controle de arraste e persistência de posição
  const [posicao, setPosicao] = useState<{ x: number; y: number }>(() => {
    try {
      const salva = localStorage.getItem('luli_pos_coords');
      if (salva) return JSON.parse(salva);
    } catch { }
    return { x: 0, y: 0 };
  });

  const dragStartPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
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

  // Captura evento global de análise de edital disparado de qualquer tela
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

  const handleDragStart = (_: any, info: any) => {
    dragStartPos.current = { x: info.point.x, y: info.point.y };
    isDraggingRef.current = false;
  };

  const handleDragEnd = (_: any, info: any) => {
    const dx = info.point.x - dragStartPos.current.x;
    const dy = info.point.y - dragStartPos.current.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Se moveu mais de 6 pixels, consideramos arraste e salvamos a nova posição
    if (dist > 6) {
      isDraggingRef.current = true;
      const nova = {
        x: posicao.x + info.offset.x,
        y: posicao.y + info.offset.y,
      };
      setPosicao(nova);
      try {
        localStorage.setItem('luli_pos_coords', JSON.stringify(nova));
      } catch { }
    } else {
      isDraggingRef.current = false;
    }
  };

  const handleBotaoClick = () => {
    // Se o usuário apenas clicou (sem arrastar), abre/fecha o chat
    if (!isDraggingRef.current) {
      setAberto((v) => !v);
    }
  };

  return (
    <>
      {/* ROBÔ FLUTUANTE REALISTA ARRASTÁVEL (LULI) */}
      <motion.div
        drag
        dragMomentum={false}
        dragElastic={0.08}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        animate={{ x: posicao.x, y: posicao.y }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed bottom-6 right-6 z-50 flex flex-col items-center select-none"
        style={{ touchAction: 'none' }}
      >
        {/* Balão Dica ao passar o mouse ou quando fechado */}
        <AnimatePresence>
          {hovered && !aberto && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.9 }}
              className="absolute -top-12 pointer-events-none flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-blue-400/30 bg-[#0B192C]/95 px-3 py-1.5 text-[11px] font-bold text-white shadow-xl backdrop-blur-md"
            >
              <Move className="h-3 w-3 text-cyan-400 animate-pulse" />
              <span>Arraste para onde quiser ou clique para falar</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* CONTAINER DA LULI 3D COM ANIMAÇÃO DE LEVITAÇÃO E SOMBRA REALISTA */}
        <div
          onClick={handleBotaoClick}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          className="group relative flex flex-col items-center cursor-grab active:cursor-grabbing"
          title="Luli — Consultora Licitatória (Clique para conversar ou arraste para mover)"
        >
          {/* Efeito Glow / Halo Holográfico Volumétrico */}
          <div className="absolute inset-0 -m-3 rounded-full bg-gradient-to-tr from-blue-600/30 via-cyan-400/25 to-emerald-400/20 blur-xl opacity-75 group-hover:opacity-100 transition-opacity duration-500 animate-pulse" />

          {/* Imagem 3D da Luli com levitação e rotação suave */}
          <motion.div
            animate={{
              y: [0, -10, 0],
              rotate: [0, 1.5, -1, 0],
            }}
            transition={{
              repeat: Infinity,
              duration: 3.6,
              ease: 'easeInOut',
            }}
            className="relative z-10 flex items-center justify-center"
          >
            <img
              src="/assets/mascote-3d.png"
              alt="Luli - Robô Consultor de Licitações"
              draggable={false}
              className="h-20 w-20 sm:h-24 sm:w-24 object-contain filter drop-shadow-[0_16px_28px_rgba(0,112,192,0.45)] transition-transform duration-300 group-hover:scale-105"
            />

            {/* Badge de Status Online (Verde Pulsante) */}
            <span className="absolute bottom-1 right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-white shadow-sm"></span>
            </span>
          </motion.div>

          {/* Sombra 3D no Solo sincronizada com a flutuação */}
          <motion.div
            animate={{
              scale: [1, 0.78, 1],
              opacity: [0.55, 0.28, 0.55],
            }}
            transition={{
              repeat: Infinity,
              duration: 3.6,
              ease: 'easeInOut',
            }}
            className="mt-[-6px] h-3 w-16 rounded-full bg-blue-950/40 blur-[3px]"
          />

          {/* Tag com Nome da Luli */}
          <div className="mt-1 flex items-center gap-1 rounded-full border border-blue-200/60 bg-white/95 px-2.5 py-0.5 shadow-md backdrop-blur-xs transition-transform duration-200 group-hover:scale-105">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
            <span className="text-[10px] font-black tracking-wider text-[#0B192C]">LULI</span>
            <Sparkles className="h-2.5 w-2.5 text-amber-500" />
          </div>
        </div>
      </motion.div>

      {/* JANELA DO CHAT DA LULI (ABERTA) */}
      <AnimatePresence>
        {aberto && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className={`fixed bottom-28 right-6 z-50 flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl transition-all ${expandido ? 'h-[80vh] w-[92vw] max-w-2xl' : 'h-[520px] w-[92vw] max-w-sm'
              }`}
          >
            {/* Header com a Luli 3D em miniatura e controles */}
            <div className="flex items-center justify-between bg-gradient-to-r from-[#0B192C] via-[#0D2444] to-[#0B192C] px-4 py-3 text-white shadow-md">
              <div className="flex items-center gap-3">
                <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 p-1 border border-white/20 shadow-inner">
                  <img
                    src="/assets/mascote-3d.png"
                    alt="Luli"
                    className="h-9 w-9 object-contain drop-shadow"
                  />
                  <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-[#0B192C]"></span>
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-sm font-extrabold leading-tight text-white">Luli</h3>
                    <span className="rounded-md bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300 border border-emerald-400/30">
                      Online
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    Consultora Licitatória (Lei 14.133/2021)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={limparConversa}
                  title="Nova conversa"
                  className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white transition"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setExpandido((v) => !v)}
                  title={expandido ? 'Reduzir' : 'Expandir'}
                  className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white transition"
                >
                  {expandido ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => setAberto(false)}
                  title="Minimizar Luli"
                  className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white transition"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Mensagens */}
            <div className="flex-1 space-y-3 overflow-y-auto bg-[#F8FAFC] p-4">
              {mensagens.map((msg) => {
                const ehUsuario = msg.autor === 'usuario';
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${ehUsuario ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-xs ${ehUsuario
                        ? 'bg-[#0070C0] text-white'
                        : 'border border-slate-200 bg-white text-[#081C3A]'
                        }`}
                    >
                      {ehUsuario ? (
                        msg.texto
                      ) : (
                        <div className="flex items-start gap-2">
                          <img
                            src="/assets/mascote-3d.png"
                            alt="Luli"
                            className="h-6 w-6 shrink-0 object-contain mt-0.5"
                          />
                          <div className="flex-1">
                            <ChatMessage role="assistant" content={cleanHumanAiText(msg.texto)} />
                          </div>
                        </div>
                      )}
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
                <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs text-slate-600 shadow-xs max-w-[80%]">
                  <img
                    src="/assets/mascote-3d.png"
                    alt="Luli analisando"
                    className="h-5 w-5 animate-bounce object-contain"
                  />
                  <span>Luli está analisando a legislação e preparando sua resposta...</span>
                </div>
              )}
              <div ref={fimListaRef} />
            </div>

            {/* Caixa de Entrada */}
            <form
              onSubmit={enviarMensagem}
              className="flex items-center gap-2 border-t border-slate-200 bg-white p-3"
            >
              <input
                type="text"
                value={entrada}
                onChange={(e) => setEntrada(e.target.value)}
                placeholder="Pergunte à Luli sobre editais, prazos, lances..."
                className="flex-1 rounded-full border border-slate-200 bg-[#F8FAFC] px-4 py-2.5 text-sm text-[#081C3A] outline-none focus:border-[#0070C0] focus:bg-white transition"
              />
              <button
                type="submit"
                disabled={enviando || !entrada.trim()}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0070C0] text-white transition hover:bg-[#005ea3] disabled:opacity-40 shadow-xs"
                aria-label="Enviar mensagem"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default LexFloatingWidget;
