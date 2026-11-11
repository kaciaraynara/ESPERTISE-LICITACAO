import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@store/auth.store';
import {
  Activity,
  AlertTriangle,
  BarChart2,
  CheckCircle,
  Crosshair,
  Globe,
  Link as LinkIcon,
  Lock,
  Maximize2,
  Minimize2,
  Power,
  RefreshCw,
  Send,
  Settings2,
  Shield,
  TrendingDown,
} from '@components/icons/phosphor-compat';
import api, { roboApi } from '@services/api';
import toast from 'react-hot-toast';

type StrategyType = 'SNIPER' | 'AGRESSIVO' | 'CONSERVADOR';
type ActiveTab = 'painel' | 'monitor' | 'config';

type LogEntry = {
  id: number | string;
  time: string;
  text: string;
  type: 'info' | 'system' | 'action' | 'alert';
};

type LicitacaoResumo = {
  id: string;
  objeto: string;
  orgao: string;
  link?: string;
  score?: { pontuacao: number };
};

type RoboConfig = {
  estrategia: StrategyType;
  precoInicial: number;
  precoLimite: number;
  decrementoMinimo: number;
  ativo: boolean;
  sessao_nome?: string;
  objeto?: string;
  portal_nome?: string;
  portal_url?: string;
  score_aderencia?: number;
};

const DISPUTE_PORTALS = [
  { id: 'comprasnet', label: 'ComprasNet', url: 'https://www.comprasnet.gov.br/seguro/pregao/' },
  { id: 'bnc', label: 'BNC', url: 'https://www.bnc.org.br/' },
  { id: 'licitanet', label: 'LicitaNet', url: 'https://www.licitanet.com.br/' },
  { id: 'bllcompras', label: 'BLL Compras', url: 'https://bllcompras.com/' },
  { id: 'outros', label: 'URL customizada', url: '' },
] as const;

type DisputePortal = {
  id: (typeof DISPUTE_PORTALS)[number]['id'];
  label: string;
  url: string;
};

const STRATEGIES = [
  { id: 'SNIPER', label: 'Sniper', desc: 'Aguarda a janela final para cobrir.', icon: Crosshair },
  { id: 'AGRESSIVO', label: 'Agressivo', desc: 'Pressiona a disputa com mais velocidade.', icon: TrendingDown },
  { id: 'CONSERVADOR', label: 'Seguro', desc: 'Preserva margem e cobertura minima.', icon: Shield },
] as const;

const TABS = [
  { id: 'painel', label: 'Painel de Controle', icon: BarChart2 },
  { id: 'monitor', label: 'Portal da Disputa', icon: Globe },
  { id: 'config', label: 'Configuracoes', icon: Settings2 },
] as const;

function formatLogTime(value?: string | Date) {
  const date = value ? new Date(value) : new Date();
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function inferPortal(url?: string | null): DisputePortal {
  if (!url) return DISPUTE_PORTALS[0];
  const match = DISPUTE_PORTALS.find((portal) => portal.url && url.includes(new URL(portal.url).hostname));
  return match ?? DISPUTE_PORTALS[DISPUTE_PORTALS.length - 1];
}

function resolvePortalUrl(portal: DisputePortal, customUrl: string, fallbackUrl?: string | null) {
  if (portal.id === 'outros') {
    return customUrl || fallbackUrl || '';
  }

  return portal.url || fallbackUrl || '';
}



function mapRemoteLog(log: any): LogEntry {
  const type =
    log.acao === 'PARAR'
      ? 'alert'
      : log.acao === 'LANCE'
        ? 'action'
        : 'system';

  return {
    id: log.id,
    time: formatLogTime(log.timestamp),
    text: log.motivo,
    type,
  };
}

export default function RoboPage() {
  const [searchParams] = useSearchParams();
  const licitacaoId = searchParams.get('id') || searchParams.get('licitacao') || searchParams.get('noticeId') || 'sala-livre';
  const precoLimiteQuery = Number(searchParams.get('precoLimite') || searchParams.get('stopLoss') || searchParams.get('piso') || '0') || 0;
  const isStopLossLocked = precoLimiteQuery > 0;
  const portalQuery = searchParams.get('portal') || '';
  const portalNomeQuery = searchParams.get('portalNome') || '';
  const objetoQuery = searchParams.get('objeto') || '';
  const scoreQuery = Number(searchParams.get('score') || '0') || 0;

  const [licitacao, setLicitacao] = useState<LicitacaoResumo | null>(null);
  const [loadingContext, setLoadingContext] = useState(true);
  const [strategy, setStrategy] = useState<StrategyType>('SNIPER');
  const [isBotActive, setIsBotActive] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [currentValue, setCurrentValue] = useState(0);
  const [initialValue, setInitialValue] = useState(precoLimiteQuery > 0 ? Math.round(precoLimiteQuery * 1.15) : 50000);
  const [stopLossValue, setStopLossValue] = useState(precoLimiteQuery > 0 ? precoLimiteQuery : 38000);
  const [manualLance, setManualLance] = useState('');
  const [decrementoMin, setDecrementoMin] = useState(10);
  const [sessaoNome, setSessaoNome] = useState('Sala de disputa');
  const [scoreAderencia, setScoreAderencia] = useState(scoreQuery || 78);
  const [tempoRestante, setTempoRestante] = useState(120);
  const [activeTab, setActiveTab] = useState<ActiveTab>('painel');
  const [portalSel, setPortalSel] = useState<DisputePortal>(() => {
    const detectedPortal = inferPortal(portalQuery);
    return portalQuery && detectedPortal.id !== 'outros'
      ? { ...detectedPortal, url: portalQuery }
      : detectedPortal;
  });
  const [customUrl, setCustomUrl] = useState<string>(portalQuery && inferPortal(portalQuery).id === 'outros' ? portalQuery : '');
  const [iframeUrl, setIframeUrl] = useState<string>('');
  const [iframeExpanded, setIframeExpanded] = useState<boolean>(false);
  const [iframeLoading, setIframeLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState(false);

  const { accessToken } = useAuthStore();
  const socketRef = useRef<Socket | null>(null);

  const logsEndRef = useRef<HTMLDivElement>(null);

  const currentValueRef = useRef(currentValue);
  const tempoRestanteRef = useRef(tempoRestante);

  function addLog(text: string, type: LogEntry['type'] = 'info') {
    setLogs((previous) => [
      ...previous.slice(-119),
      { id: crypto.randomUUID(), time: formatLogTime(), text, type },
    ]);
  }

  async function carregarContexto() {
    setLoadingContext(true);

    try {
      const licitacaoPromise = licitacaoId !== 'sala-livre'
        ? api.get(`/licitacoes/${encodeURIComponent(licitacaoId)}`)
        : Promise.resolve(null);

      const [licitacaoResponse, configResponse, logsResponse] = await Promise.allSettled([
        licitacaoPromise,
        roboApi.buscarConfig(licitacaoId),
        roboApi.listarLogs(licitacaoId),
      ]);

      if (licitacaoResponse.status === 'fulfilled' && licitacaoResponse.value) {
        const payload = licitacaoResponse.value.data?.data ?? null;
        if (payload) {
          setLicitacao(payload);
          setSessaoNome(`Sala do Robo · ${payload.id}`);
          setScoreAderencia(payload.score?.pontuacao ?? (scoreQuery || 78));
          if (!portalQuery && payload.link) {
            const detectedPortal = inferPortal(payload.link);
            if (detectedPortal.id === 'outros') {
              setPortalSel(detectedPortal);
              setCustomUrl(payload.link);
            } else {
              setPortalSel({ ...detectedPortal, url: payload.link });
            }
          }
        }
      } else if (objetoQuery) {
        setLicitacao({
          id: licitacaoId,
          objeto: objetoQuery,
          orgao: 'Operacao vinculada manualmente',
          link: portalQuery || undefined,
          score: scoreQuery ? { pontuacao: scoreQuery } : undefined,
        });
      }

      if (configResponse.status === 'fulfilled') {
        const config = (configResponse.value.data?.data ?? null) as RoboConfig | null;
        if (config) {
          const finalPiso = precoLimiteQuery > 0 ? Math.max(config.precoLimite, precoLimiteQuery) : config.precoLimite;
          const finalInicial = precoLimiteQuery > 0 ? Math.max(config.precoInicial, Math.round(finalPiso * 1.15)) : config.precoInicial;
          setStrategy(config.estrategia);
          setInitialValue(finalInicial);
          setCurrentValue(finalInicial);
          setStopLossValue(finalPiso);
          setDecrementoMin(config.decrementoMinimo);
          setIsBotActive(Boolean(config.ativo));
          if (config.sessao_nome) {
            setSessaoNome(config.sessao_nome);
          }
          setScoreAderencia(config.score_aderencia ?? (scoreQuery || 78));
          if (config.portal_url) {
            const detectedPortal = inferPortal(config.portal_url);
            if (detectedPortal.id === 'outros') {
              setPortalSel(detectedPortal);
              setCustomUrl(config.portal_url);
            } else {
              setPortalSel({ ...detectedPortal, url: config.portal_url });
            }
          }
        }
      }

      if (logsResponse.status === 'fulfilled') {
        const loadedLogs = (logsResponse.value.data?.data ?? []).map(mapRemoteLog);
        if (loadedLogs.length > 0) {
          setLogs(loadedLogs);
        }
      }

    } catch {
      addLog('Nao foi possivel carregar toda a sala do robo. Alguns recursos ficarao em modo local.', 'alert');
    } finally {
      setLoadingContext(false);
    }
  }

  async function persistirConfig(overrides?: Partial<RoboConfig>) {
    setSaving(true);

    try {
      const portalAtual = resolvePortalUrl(portalSel, customUrl, licitacao?.link || portalQuery);
      const payload: RoboConfig = {
        estrategia: strategy,
        precoInicial: initialValue,
        precoLimite: stopLossValue,
        decrementoMinimo: decrementoMin,
        ativo: isBotActive,
        sessao_nome: sessaoNome,
        objeto: licitacao?.objeto || objetoQuery,
        portal_nome: portalNomeQuery || portalSel.label,
        portal_url: portalAtual,
        score_aderencia: scoreAderencia,
        ...overrides,
      };

      const response = await roboApi.salvarConfig(licitacaoId, payload);
      const config = response.data?.data as RoboConfig | undefined;
      return config;
    } finally {
      setSaving(false);
    }
  }

  async function ativarOuPausarRobo(ativar: boolean) {
    try {
      const config = await persistirConfig({ ativo: ativar });
      const syncedActive = Boolean(config?.ativo ?? ativar);
      setIsBotActive(syncedActive);
    } catch {
      toast.error('Nao foi possivel sincronizar a sala do robo.');
    }
  }

  function openPortal() {
    const url = resolvePortalUrl(portalSel, customUrl, licitacao?.link || portalQuery);
    if (!url) return;
    setIframeUrl(url);
    setIframeLoading(true);
    addLog(`Portal de disputa vinculado: ${url}`, 'system');
  }

  async function startBot() {
    if (initialValue <= stopLossValue) {
      toast.error('O valor inicial precisa ser maior que o piso de seguranca.');
      return;
    }

    setCurrentValue(initialValue);
    setTempoRestante((previous) => (previous > 0 ? previous : 120));
    await ativarOuPausarRobo(true);
    socketRef.current?.emit('iniciar_robo', {
      pregaoId: licitacaoId,
      valorInicial: initialValue,
      lanceMinimoPermitido: stopLossValue,
      estrategia: strategy.toLowerCase(),
    });
  }

  async function stopBot() {
    await ativarOuPausarRobo(false);
    socketRef.current?.emit('pausar_robo');
  }

  function handleLanceManual() {
    const value = Number(manualLance.replace(',', '.'));
    if (!value || value <= 0) return;

    if (value <= stopLossValue) {
      toast.error(`Lance BLOQUEADO: R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} viola o piso de segurança definido (${isStopLossLocked ? 'Travado pela Precificação/BDI' : 'Stop-Loss'}: R$ ${stopLossValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}).`);
      addLog(`Proposta manual de R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} rejeitada. Viola o piso de segurança de R$ ${stopLossValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`, 'alert');
      return;
    }

    socketRef.current?.emit('lance_manual', { valor: value });
    setCurrentValue(value);
    setManualLance('');
    toast.success('Proposta validada contra a margem. Registre no portal oficial!');
  }

  useEffect(() => {
    void carregarContexto();
  }, [licitacaoId]);

  useEffect(() => {
    currentValueRef.current = currentValue;
  }, [currentValue]);

  useEffect(() => {
    tempoRestanteRef.current = tempoRestante;
  }, [tempoRestante]);

  useEffect(() => {
    const monitorUrl = resolvePortalUrl(portalSel, customUrl, licitacao?.link || portalQuery);
    if (!monitorUrl) return;
    setIframeUrl((current: string) => {
      if (current === monitorUrl) return current;
      setIframeLoading(true);
      return monitorUrl;
    });
  }, [customUrl, licitacao?.link, portalQuery, portalSel]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  useEffect(() => {
    if (!accessToken) return;

    const socketUrl =
      import.meta.env.VITE_API_URL?.replace('/api/v1', '') ||
      (import.meta.env.PROD && typeof window !== 'undefined'
        ? window.location.origin
        : 'http://localhost:3001');

    socketRef.current = io(socketUrl, {
      auth: { token: accessToken },
      transports: ['websocket', 'polling'],
    });

    const socket = socketRef.current;

    socket.on('robo_log', (log: any) => {
      addLog(log.text, log.type);
    });

    socket.on('lance_validado', (data: any) => {
      setCurrentValue(data.valor);
      addLog(`Lance de R$ ${Number(data.valor).toLocaleString('pt-BR')} validado contra o piso. Registre no portal oficial.`, 'action');
    });

    socket.on('sugestao_lance', (data: any) => {
      setCurrentValue(data.valor);
      addLog(`Sugestão tática (${String(data.estrategia || '').toUpperCase()}): R$ ${Number(data.valor).toLocaleString('pt-BR')}. Submeta no portal oficial.`, 'system');
    });

    socket.on('margem_atingida', () => {
      setIsBotActive(false);
      addLog('Piso de proteção atingido. Estratégia recomenda interromper novas ofertas para preservar a rentabilidade.', 'alert');
    });

    socket.on('robo_status', (data: any) => {
      setIsBotActive(data.ativo);
      if (data.estrategia) setStrategy(data.estrategia.toUpperCase() as StrategyType);
    });

    return () => {
      socket.disconnect();
    };
  }, [accessToken]);

  const pct = currentValue > 0 && initialValue > stopLossValue
    ? Math.max(0, Math.min(100, ((currentValue - stopLossValue) / (initialValue - stopLossValue)) * 100))
    : 0;

  const progressColor = pct > 55 ? '#10b981' : pct > 25 ? '#f59e0b' : '#ef4444';
  const portalAtualUrl = resolvePortalUrl(portalSel, customUrl, licitacao?.link || portalQuery);

  const monitorPanel = (
    <section className={`tech-panel overflow-hidden ${iframeExpanded ? 'fixed inset-4 z-50' : 'xl:sticky xl:top-28'}`}>
      <div className="flex items-center justify-between border-b border-[#D8E6FF] bg-white px-5 py-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#3E6FB7]">Acesso ao Portal Oficial</p>
          <p className="mt-1 text-sm font-bold text-brand-blue">
            {portalAtualUrl ? 'Portal vinculado para a disputa' : 'Defina o portal da licitação'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {portalAtualUrl && (
            <a
              href={portalAtualUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-blue px-3 py-2 text-xs font-bold text-white transition hover:bg-brand-blue/90 shadow-sm"
            >
              <Globe className="h-3.5 w-3.5" />
              Abrir Portal Oficial (Nova Aba)
            </a>
          )}
          <button
            onClick={() => setIframeExpanded((prev) => !prev)}
            className="tech-outline-button !p-2"
            title={iframeExpanded ? 'Minimizar' : 'Expandir'}
          >
            {iframeExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {portalAtualUrl ? (
          <>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700 leading-relaxed">
              <p className="font-bold text-slate-900 mb-1 flex items-center gap-1.5">
                <Shield className="h-4 w-4 text-emerald-600" />
                Diretrizes de Segurança do Licitante:
              </p>
              <ul className="list-disc pl-4 space-y-1 mt-1 text-slate-600">
                <li>Abra o portal oficial em uma nova janela ou monitor paralelo.</li>
                <li>Utilize o certificado digital ICP-Brasil autenticado diretamente no seu navegador.</li>
                <li>Confira se o valor do lance respeita rigorosamente o piso estipulado de <strong>R$ {stopLossValue.toLocaleString('pt-BR')}</strong>.</li>
                <li>A submissão oficial é de inteira responsabilidade do operador credenciado no certame.</li>
              </ul>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-900 leading-relaxed">
              <span className="font-bold text-amber-950">Nota Técnica sobre Navegação: </span>
              A maioria dos portais governamentais (Compras.gov.br, BNC, etc.) bloqueia exibição embutida por cabeçalhos de segurança (CSP / X-Frame-Options). Utilize o botão acima para operar com segurança em janela oficial.
            </div>

            {iframeUrl && (
              <div className="mt-3">
                <div className="flex items-center justify-between pb-2 text-xs font-bold text-slate-600">
                  <span>Pré-visualização embutida (se permitida pelo portal):</span>
                  {iframeLoading && <RefreshCw className="h-3.5 w-3.5 animate-spin text-brand-blue" />}
                </div>
                <iframe
                  src={iframeUrl}
                  title="Monitor de disputa"
                  className="h-[360px] w-full rounded-lg border border-slate-200 bg-white"
                  onLoad={() => setIframeLoading(false)}
                  sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
                />
              </div>
            )}
          </>
        ) : (
          <div className="flex min-h-[360px] flex-col items-center justify-center px-8 text-center">
            <Globe className="mb-4 h-12 w-12 text-brand-blue/70" />
            <p className="text-lg font-bold text-brand-blue">Nenhum portal vinculado</p>
            <p className="mt-2 max-w-md text-sm leading-7 text-brand-blue/70">
              Vincule o link direto da disputa para manter os dados da licitação organizados e acessar o certame com agilidade.
            </p>
          </div>
        )}
      </div>
    </section>
  );

  return (
    <div className="flex h-full flex-col bg-[#F3F8FF]">
      <div className="sticky top-0 z-20 border-b border-gray-100 bg-white px-6 py-4 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-brand-blue/70">
              <Activity className="h-3.5 w-3.5" />
              Estratégia de Lances
              <span className="rounded-lg border border-amber-500 bg-amber-500/10 px-2 py-0.5 text-amber-700 ml-2 text-[10px] font-bold">
                Você envia os lances no portal oficial
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-brand-blue">{sessaoNome}</h1>
              <span className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${
                isBotActive
                  ? 'border-emerald-500/30 bg-emerald-50 text-emerald-700'
                  : 'border-slate-200 bg-white text-slate-600'
              }`}>
                <span className={`h-2 w-2 rounded-full ${isBotActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                {isBotActive ? 'Acompanhamento ativo' : 'Planejamento em andamento'}
              </span>
            </div>

            <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-900 leading-relaxed shadow-sm">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-amber-950">Importante: </span>
                  A plataforma não envia lances por você. Use as informações desta tela como apoio e envie cada oferta diretamente no portal oficial.
                </div>
              </div>
            </div>

            {isStopLossLocked && (
              <div className="mt-3 rounded-xl border border-emerald-300 bg-emerald-50 p-3.5 text-xs text-emerald-950 leading-relaxed shadow-sm flex items-start gap-2.5">
                <Lock className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Piso de Segurança Travado (Stop-Loss BDI): </span>
                  R$ {precoLimiteQuery.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.
                  Este edital possui margem mínima calculada na Precificação/BDI. O robô e validações de lance estão estritamente travados contra ofertas inferiores.
                </div>
              </div>
            )}

            <p className="mt-2 text-sm text-brand-blue/70">
              {licitacao?.objeto || objetoQuery || 'Defina sua margem de segurança e acompanhe a disputa pelo portal oficial.'}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as ActiveTab)}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-bold transition ${
                  activeTab === tab.id
                    ? 'border border-[#F1F5F9] bg-white text-brand-blue shadow-sm'
                    : 'border border-transparent bg-white text-brand-blue/70 hover:text-brand-blue'
                }`}
              >
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 py-6 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="tech-panel p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em]">
                    <span className="rounded-lg border border-[#B8D4FF] bg-white px-3 py-1 text-brand-blue">
                      Compatibilidade {scoreAderencia}/100
                    </span>
                    {licitacao?.orgao && (
                      <span className="rounded-lg border border-gray-100 bg-white px-3 py-1 text-brand-blue/70">
                        {licitacao.orgao}
                      </span>
                    )}
                  </div>
                  <p className="text-sm leading-7 text-brand-blue/70">
                    Defina seu valor mínimo aceitável e confira o impacto na margem antes de enviar cada lance.
                  </p>
                </div>

                <div className="rounded-lg border border-gray-100 bg-white px-4 py-3 text-right">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-blue/70">Margem da Empresa</p>
                  <p className="mt-1 text-sm font-bold text-emerald-700">
                    Piso: R$ {stopLossValue.toLocaleString('pt-BR')}
                  </p>
                  <p className="mt-1 text-xs text-brand-blue/70">Margem: R$ {(initialValue - stopLossValue).toLocaleString('pt-BR')}</p>
                </div>
              </div>
            </div>

            <div className="tech-dark-panel p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-blue/70">Termômetro de Margem</p>
                  <p className="mt-2 text-3xl font-bold">
                    {currentValue > 0 ? `R$ ${currentValue.toLocaleString('pt-BR')}` : 'Aguardando'}
                  </p>
                </div>
                <Settings2 className="h-9 w-9 text-[#BFDBFE]" />
              </div>

              <div className="mt-5 h-3 overflow-hidden rounded-lg bg-[#153057]">
                <div className="h-full rounded-lg transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: progressColor }} />
              </div>

              <div className="mt-3 flex items-center justify-between text-xs text-brand-blue/70">
                <span>Piso: R$ {stopLossValue.toLocaleString('pt-BR')}</span>
                <span>{Math.round(pct)}% da margem</span>
                <span>Inicial: R$ {initialValue.toLocaleString('pt-BR')}</span>
              </div>
            </div>
          </section>

          {activeTab === 'painel' && (
            <div className="space-y-6">
              <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr] xl:items-start">
                <div className="space-y-6">
                  <section className="tech-panel p-5">
                    <div className="mb-4 flex items-center gap-2">
                      <Crosshair className="h-4 w-4 text-brand-blue" />
                      <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-brand-blue">Estrategia de disputa</h2>
                    </div>

                    <div className="grid gap-3 md:grid-cols-3">
                      {STRATEGIES.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => {
                            setStrategy(item.id);
                            addLog(`Estrategia ajustada para ${item.label}.`, 'system');
                          }}
                          disabled={isBotActive}
                          className={`rounded-lg border p-4 text-left transition ${
                            strategy === item.id
                              ? 'border-brand-blue bg-brand-blue text-white shadow-lg shadow-brand-blue/20'
                              : 'border-gray-100 bg-white text-brand-blue hover:border-[#E2E8F0] hover:bg-white'
                          } disabled:opacity-70`}
                        >
                          <item.icon className="mb-3 h-5 w-5" />
                          <p className="text-sm font-bold">{item.label}</p>
                          <p className={`mt-1 text-xs leading-5 ${strategy === item.id ? 'text-brand-blue' : 'text-brand-blue/70'}`}>
                            {item.desc}
                          </p>
                        </button>
                      ))}
                    </div>
                  </section>

                  <section className="tech-panel p-5">
                    <div className="mb-2 flex items-center gap-2">
                      <Send className="h-4 w-4 text-brand-blue" />
                      <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-brand-blue">Simulação e Validação de Proposta Manual</h2>
                    </div>

                    <p className="mb-3 text-xs text-brand-blue/70">
                      Informe o valor pretendido para calcular a margem restante e garantir que sua oferta não fira o piso de R$ {stopLossValue.toLocaleString('pt-BR')}.
                    </p>

                    <div className="flex flex-col gap-3 sm:flex-row">
                      <div className="relative flex-1">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-brand-blue/70">R$</span>
                        <input
                          type="number"
                          value={manualLance}
                          onChange={(event) => setManualLance(event.target.value)}
                          onKeyDown={(event) => event.key === 'Enter' && handleLanceManual()}
                          className="w-full rounded-lg border border-gray-100 bg-white py-3 pl-11 pr-4 text-sm font-bold text-brand-blue outline-none transition focus:border-brand-blue focus:bg-white"
                          placeholder="0,00"
                        />
                      </div>
                      <button onClick={handleLanceManual} className="tech-primary-button">
                        Validar Margem
                      </button>
                    </div>
                  </section>

                  <section className="tech-panel p-5">
                    <div className="mb-4 flex items-center gap-2">
                      <Globe className="h-4 w-4 text-brand-blue" />
                      <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-brand-blue">Portal Oficial Vinculado</h2>
                    </div>

                    <p className="text-sm leading-7 text-brand-blue/70">
                      Abra o portal oficial em uma janela ao lado para digitar suas ofertas reais com agilidade e proteção.
                    </p>

                    <div className="mt-4 rounded-[24px] border border-[#D8E6FF] bg-white p-4">
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#3E6FB7]">Destino Oficial</p>
                      <p className="mt-2 break-all text-sm font-semibold text-brand-blue">
                        {portalAtualUrl || 'Defina o link direto da disputa'}
                      </p>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {portalAtualUrl ? (
                        <a
                          href={portalAtualUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="tech-primary-button inline-flex items-center justify-center gap-2 text-center"
                        >
                          <Globe className="h-4 w-4" />
                          Acessar Portal (Nova Aba)
                        </a>
                      ) : (
                        <button disabled className="tech-primary-button opacity-50 cursor-not-allowed">
                          Link não informado
                        </button>
                      )}
                      <button onClick={() => setActiveTab('monitor')} className="tech-outline-button">
                        Configurar Portal
                      </button>
                    </div>
                  </section>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      onClick={() => void (isBotActive ? stopBot() : startBot())}
                      className={`inline-flex items-center justify-center gap-3 rounded-[24px] px-5 py-4 text-sm font-bold uppercase tracking-[0.18em] text-white transition ${
                        isBotActive
                          ? 'bg-amber-600 hover:bg-amber-700'
                          : 'bg-brand-blue shadow-lg shadow-brand-blue/20 hover:shadow-xl hover:shadow-brand-blue/25'
                      }`}
                    >
                      <Power className="h-4 w-4" />
                      {isBotActive ? 'Pausar Monitoramento' : 'Ativar Monitoramento Tático'}
                    </button>

                    <button
                      onClick={() => void persistirConfig()}
                      disabled={saving}
                      className="tech-outline-button disabled:opacity-60"
                    >
                      {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Settings2 className="h-4 w-4" />}
                      Salvar Estratégia
                    </button>
                  </div>
                </div>

                {monitorPanel}
              </div>

              <section className="tech-panel flex min-h-[420px] flex-col overflow-hidden">
                <div className="flex items-center justify-between border-b border-[#D8E6FF] px-5 py-4">
                  <div className="mb-4 flex items-center gap-2">
                    <Settings2 className="h-4 w-4 text-brand-blue" />
                    <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-brand-blue">Log da sala</h2>
                  </div>
                  <button
                    onClick={() => setLogs([{ id: Date.now(), time: formatLogTime(), text: 'Log reiniciado manualmente.', type: 'system' }])}
                    className="text-xs font-bold text-brand-blue/70 transition hover:text-brand-blue"
                  >
                    Limpar
                  </button>
                </div>

                <div className="flex-1 space-y-2 overflow-y-auto p-5 font-mono text-xs">
                  {loadingContext && logs.length === 0 && (
                    <div className="flex items-center gap-2 text-brand-blue/70">
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      Carregando contexto da sala...
                    </div>
                  )}

                  {logs.length === 0 && !loadingContext && (
                    <div className="rounded-lg border border-dashed border-gray-100 bg-white p-4 text-sm text-brand-blue/70">
                      Os eventos da disputa vao aparecer aqui conforme a sala operar.
                    </div>
                  )}

                  {logs.map((log) => (
                    <div key={log.id} className="flex items-start gap-3 rounded-lg border border-gray-100 bg-white px-3 py-2.5">
                      <span className="shrink-0 tabular-nums text-brand-blue/70">{log.time}</span>
                      <span className={`leading-6 ${
                        log.type === 'system'
                          ? 'font-semibold text-brand-blue'
                          : log.type === 'action'
                            ? 'font-bold text-brand-blue'
                            : log.type === 'alert'
                              ? 'font-bold text-brand-blue'
                              : 'text-brand-blue/70'
                      }`}>
                        {log.text}
                      </span>
                    </div>
                  ))}
                  <div ref={logsEndRef} />
                </div>
              </section>
            </div>
          )}

          {activeTab === 'monitor' && (
            <div className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr] xl:items-start">
              <div className="space-y-6">
                <section className="tech-panel p-5">
                  <div className="mb-4 flex items-center gap-2">
                    <Globe className="h-4 w-4 text-brand-blue" />
                    <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-brand-blue">Portal da disputa</h2>
                  </div>

                  <div className="mb-4 flex flex-wrap gap-2">
                    {DISPUTE_PORTALS.map((portal) => (
                      <button
                        key={portal.id}
                        onClick={() => {
                          setPortalSel({ ...portal });
                          if (portal.id === 'outros') {
                            setCustomUrl((current) => current || portalAtualUrl);
                          }
                        }}
                        className={`rounded-lg border px-4 py-2 text-xs font-bold transition ${
                          portalSel.id === portal.id
                            ? 'border-brand-blue bg-brand-blue text-white'
                            : 'border-gray-100 bg-white text-brand-blue/70 hover:border-[#E2E8F0] hover:bg-white'
                        }`}
                      >
                        {portal.label}
                      </button>
                    ))}
                  </div>

                  <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-brand-blue/70">
                    Link direto da disputa
                  </label>
                  <div className="relative">
                    <LinkIcon className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-blue/70" />
                    <input
                      type="url"
                      value={portalSel.id === 'outros' ? customUrl : portalSel.url}
                      onChange={(event) => {
                        if (portalSel.id === 'outros') {
                          setCustomUrl(event.target.value);
                        } else {
                          setPortalSel((current) => ({ ...current, url: event.target.value }));
                        }
                      }}
                      placeholder="https://plataforma-da-disputa.gov.br"
                      className="w-full rounded-lg border border-gray-100 bg-white py-3 pl-11 pr-4 text-sm font-medium text-brand-blue outline-none transition focus:border-brand-blue focus:bg-white"
                    />
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      onClick={openPortal}
                      disabled={!portalAtualUrl}
                      className="tech-primary-button disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Espelhar na sala
                    </button>
                    <button
                      onClick={() => void persistirConfig()}
                      disabled={saving}
                      className="tech-outline-button disabled:opacity-60"
                    >
                      {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Settings2 className="h-4 w-4" />}
                      Salvar portal
                    </button>
                  </div>
                </section>

                <div className="rounded-[24px] border border-[#F1F5F9] bg-white p-4 text-sm text-[#123A7A]">
                  O portal da disputa permanece no lado direito da sala para voce continuar operando estrategia, lance e acompanhamento no mesmo ambiente.
                </div>
              </div>

              {monitorPanel}
            </div>
          )}

          {activeTab === 'config' && (
            <div className="grid gap-6 xl:grid-cols-[0.84fr_1.16fr] xl:items-start">
              <div className="tech-panel p-6">
                <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-brand-blue/70">Nome da sessao</label>
                  <input
                    type="text"
                    value={sessaoNome}
                    onChange={(event) => setSessaoNome(event.target.value)}
                    className="w-full rounded-lg border border-gray-100 bg-white px-4 py-3 text-sm font-semibold text-brand-blue outline-none transition focus:border-brand-blue focus:bg-white"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-brand-blue/70">Score de aderencia</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={scoreAderencia}
                    onChange={(event) => setScoreAderencia(Number(event.target.value))}
                    className="w-full rounded-lg border border-gray-100 bg-white px-4 py-3 text-sm font-semibold text-brand-blue outline-none transition focus:border-brand-blue focus:bg-white"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-brand-blue/70">Valor inicial</label>
                  <input
                    type="number"
                    value={initialValue}
                    onChange={(event) => setInitialValue(Number(event.target.value))}
                    disabled={isBotActive}
                    className="w-full rounded-lg border border-gray-100 bg-white px-4 py-3 text-sm font-semibold text-brand-blue outline-none transition focus:border-brand-blue focus:bg-white disabled:opacity-60"
                  />
                </div>

                <div>
                  <label className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.18em] text-brand-blue/70">
                    {isStopLossLocked && <Lock className="h-3 w-3 text-emerald-600 inline" />}
                    Piso de segurança {isStopLossLocked ? '(Travado pelo BDI)' : ''}
                  </label>
                  <input
                    type="number"
                    value={stopLossValue}
                    onChange={(event) => {
                      const val = Number(event.target.value);
                      setStopLossValue(isStopLossLocked ? Math.max(val, precoLimiteQuery) : val);
                    }}
                    disabled={isBotActive || isStopLossLocked}
                    title={isStopLossLocked ? 'Piso travado pelo cálculo de viabilidade/BDI' : undefined}
                    className="w-full rounded-lg border border-gray-100 bg-white px-4 py-3 text-sm font-semibold text-brand-blue outline-none transition focus:border-brand-blue focus:bg-white disabled:opacity-60 disabled:bg-slate-50"
                  />
                  {isStopLossLocked && (
                    <p className="mt-1 text-[11px] font-bold text-emerald-700">
                      Piso mínimo travado: R$ {precoLimiteQuery.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-brand-blue/70">Decremento minimo</label>
                  <input
                    type="number"
                    value={decrementoMin}
                    onChange={(event) => setDecrementoMin(Number(event.target.value))}
                    disabled={isBotActive}
                    className="w-full rounded-lg border border-gray-100 bg-white px-4 py-3 text-sm font-semibold text-brand-blue outline-none transition focus:border-brand-blue focus:bg-white disabled:opacity-60"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-brand-blue/70">Tempo de disputa (simulado)</label>
                  <input
                    type="number"
                    value={tempoRestante}
                    onChange={(event) => setTempoRestante(Number(event.target.value))}
                    disabled={isBotActive}
                    className="w-full rounded-lg border border-gray-100 bg-white px-4 py-3 text-sm font-semibold text-brand-blue outline-none transition focus:border-brand-blue focus:bg-white disabled:opacity-60"
                  />
                </div>
                </div>

                <div className="mt-6 rounded-[24px] border border-brand-orange/50 bg-brand-orange/10 p-4 text-sm text-brand-blue">
                  O robo protege margem automaticamente, mas a decisao final continua sendo estrategica. Use a sala para combinar score do edital, portal da disputa e limite de rentabilidade antes de operar.
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    onClick={() => void persistirConfig()}
                    disabled={saving}
                    className="tech-primary-button disabled:opacity-60"
                  >
                    {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Settings2 className="h-4 w-4" />}
                    Salvar configuracao
                  </button>
                  <button
                    onClick={() => setActiveTab('painel')}
                    className="tech-outline-button"
                  >
                    Voltar ao painel de controle
                  </button>
                </div>
              </div>

              {monitorPanel}
            </div>
          )}

          <section className="tech-panel p-6 border-l-4 border-l-brand-blue">
            <div className="flex items-center gap-2 mb-3">
              <Lock className="h-5 w-5 text-brand-blue" />
              <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-brand-blue">
                Cuidados antes de enviar suas ofertas
              </h2>
            </div>
            <p className="text-xs text-brand-blue/70 mb-4 leading-relaxed">
              A plataforma não envia lances por você nem acessa certificados digitais. Revise as informações e envie cada oferta diretamente no portal oficial:
            </p>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-xs">
              <div className="rounded-xl border border-[#D8E6FF] bg-white p-3.5 shadow-sm">
                <span className="font-bold text-brand-blue block mb-1">1. Confira as regras do portal</span>
                <p className="text-brand-blue/70 text-[11px] leading-relaxed">
                  Consulte as regras do órgão responsável antes de participar da disputa.
                </p>
              </div>

              <div className="rounded-xl border border-[#D8E6FF] bg-white p-3.5 shadow-sm">
                <span className="font-bold text-brand-blue block mb-1">2. Use o acesso oficial</span>
                <p className="text-brand-blue/70 text-[11px] leading-relaxed">
                  Acesse os portais pelos canais oficiais e siga as orientações de cada um.
                </p>
              </div>

              <div className="rounded-xl border border-[#D8E6FF] bg-white p-3.5 shadow-sm">
                <span className="font-bold text-brand-blue block mb-1">3. Proteja seus dados de acesso</span>
                <p className="text-brand-blue/70 text-[11px] leading-relaxed">
                  Não compartilhe senhas ou certificados e permita acesso apenas a pessoas autorizadas.
                </p>
              </div>

              <div className="rounded-xl border border-[#D8E6FF] bg-white p-3.5 shadow-sm">
                <span className="font-bold text-brand-blue block mb-1">4. Revise cada oferta</span>
                <p className="text-brand-blue/70 text-[11px] leading-relaxed">
                  Confira valores e condições antes de confirmar o envio no portal oficial.
                </p>
              </div>

              <div className="rounded-xl border border-[#D8E6FF] bg-white p-3.5 shadow-sm">
                <span className="font-bold text-brand-blue block mb-1">5. Respeite seu preço mínimo</span>
                <p className="text-brand-blue/70 text-[11px] leading-relaxed">
                  Defina o menor valor que sua empresa aceita para evitar propostas abaixo da margem desejada.
                </p>
              </div>

              <div className="rounded-xl border border-[#D8E6FF] bg-white p-3.5 shadow-sm">
                <span className="font-bold text-brand-blue block mb-1">6. Acompanhe a disputa</span>
                <p className="text-brand-blue/70 text-[11px] leading-relaxed">
                  Confira o andamento diretamente no portal oficial e ajuste sua estratégia quando necessário.
                </p>
              </div>

              <div className="rounded-xl border border-[#D8E6FF] bg-white p-3.5 shadow-sm">
                <span className="font-bold text-brand-blue block mb-1">7. Consulte o histórico</span>
                <p className="text-brand-blue/70 text-[11px] leading-relaxed">
                  Revise as informações registradas na plataforma para acompanhar as alterações realizadas.
                </p>
              </div>

              <div className="rounded-xl border border-[#D8E6FF] bg-white p-3.5 shadow-sm">
                <span className="font-bold text-brand-blue block mb-1">8. Tenha uma alternativa</span>
                <p className="text-brand-blue/70 text-[11px] leading-relaxed">
                  Se a plataforma estiver indisponível, acesse o portal oficial para acompanhar a disputa.
                </p>
              </div>
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-3">
            <div className="tech-panel p-5">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-emerald-600" />
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-blue">Proteção de Margem</p>
              </div>
              <p className="mt-3 text-sm leading-7 text-brand-blue/70">
                Use o valor mínimo cadastrado como referência ao avaliar uma proposta e proteger a margem da empresa.
              </p>
            </div>

            <div className="tech-panel p-5">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-brand-blue" />
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-blue">Acesse o portal oficial</p>
              </div>
              <p className="mt-3 text-sm leading-7 text-brand-blue/70">
                Consulte esta tela como apoio e envie suas ofertas diretamente no portal oficial do governo.
              </p>
            </div>

            <div className="tech-panel p-5">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-brand-blue" />
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-blue">Histórico da empresa</p>
              </div>
              <p className="mt-3 text-sm leading-7 text-brand-blue/70">
                Consulte as informações registradas para acompanhar as alterações feitas na plataforma.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
