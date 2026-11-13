import {
  House,
  Crosshair,
  ListChecks as QuadroIcon,
  Scales,
  Trophy,
  MagnifyingGlass,
  WarningCircle,
  Article,
  ChartLineUp,
  Robot,
  Lightning,
  Gavel,
  CheckSquare,
  Vault,
  ShieldCheck,
  Certificate,
  Receipt,
  GraduationCap,
  FileText,
  Brain,
  Eye,
  CreditCard,
  Gear,
  SignOut,
  CaretDown,
  type Icon,
} from '@phosphor-icons/react';
import { Pin, PinOff } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import BrandLogo from '@components/brand/BrandLogo';
import { useLogout } from '@/hooks';
import { FORNECEDOR_ROUTES } from '@/routes';
import { useAuthStore } from '@/store/auth.store';
import { useNavigationStore } from '@/store/navigation.store';
import type { User } from '@/types';
import { getUserDisplayName } from '@/utils';

export type CommercialPlanTier = 'BASICO' | 'AVANCADO' | 'MASTER';

export const TRIAL_DURATION_DAYS = 15;
export const TRIAL_DURATION_MS = TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000;

/**
 * Prefetch Inteligente de Rotas
 * Ao passar o mouse sobre um item de menu, pré-carrega o módulo correspondente.
 */
const ROUTE_PREFETCH_MAP: Record<string, () => Promise<unknown>> = {
  [FORNECEDOR_ROUTES.dashboard]: () => import('@/pages/DashboardPage'),
  [FORNECEDOR_ROUTES.radar]: () => import('@/pages/RadarPage'),
  [FORNECEDOR_ROUTES.historico_concorrentes]: () => import('@/pages/HistoricoConcorrentesPage'),
  [FORNECEDOR_ROUTES.disputa_ao_vivo]: () => import('@/pages/DisputaAoVivoPage'),
  [FORNECEDOR_ROUTES.disputas]: () => import('@/pages/CrmKanbanPage'),
  [FORNECEDOR_ROUTES.robo_lances]: () => import('@/pages/RoboPage'),
  [FORNECEDOR_ROUTES.propostas]: () => import('@/pages/Propostas/PropostasPage'),
  [FORNECEDOR_ROUTES.catalogo]: () => import('@/pages/Catalogo/CatalogoPage'),
  [FORNECEDOR_ROUTES.prazos_alertas]: () => import('@/pages/PrazosAlertas/PrazosAlertasPage'),
  [FORNECEDOR_ROUTES.defesas_recursos]: () => import('@/pages/Contencioso/ContenciosoHubPage'),
  [FORNECEDOR_ROUTES.lex]: () => import('@/pages/Lex/LexAnalisePage'),
  [FORNECEDOR_ROUTES.impugnacao]: () => import('@/pages/ImpugnacaoPage'),
  [FORNECEDOR_ROUTES.recursos]: () => import('@/pages/RecursosPage'),
  [FORNECEDOR_ROUTES.leitor_editais]: () => import('@/pages/LeitorEditaisPage'),
  [FORNECEDOR_ROUTES.radar_nulidades]: () => import('@/pages/Nulidades/NulidadesPage'),
  [FORNECEDOR_ROUTES.academia]: () => import('@/pages/Academia/AcademiaPage'),
  [FORNECEDOR_ROUTES.gestao_pos_vitoria]: () => import('@/pages/GestaoPosVitoriaPage'),
  [FORNECEDOR_ROUTES.gestao_contratual]: () => import('@/pages/GestaoContratualPage'),
  [FORNECEDOR_ROUTES.expertise_fiscal]: () => import('@/pages/ExpertiseFiscalPage'),
  [FORNECEDOR_ROUTES.cofre]: () => import('@/pages/CofrePage'),
  [FORNECEDOR_ROUTES.certidoes]: () => import('@/pages/CertidoesPage'),
  [FORNECEDOR_ROUTES.habilitacao]: () => import('@/pages/HabilitacaoPage'),
  [FORNECEDOR_ROUTES.srp]: () => import('@/pages/Srp/SrpPage'),
  [FORNECEDOR_ROUTES.relatorios_estrategicos]: () => import('@/pages/Relatorios/RelatoriosPage'),
  [FORNECEDOR_ROUTES.planos]: () => import('@/pages/PlanosPage'),
  [FORNECEDOR_ROUTES.configuracoes]: () => import('@/pages/Configuracoes/ConfiguracoesPage'),
};

export function prefetchRoute(path: string) {
  const loader = ROUTE_PREFETCH_MAP[path];
  if (loader) {
    loader().catch(() => { });
  }
}

/**
 * Verifica se a conta do utilizador está dentro do período de Trial de 15 dias.
 */
export function isUserTrialActive(user?: User | null): boolean {
  const targetUser = user ?? useAuthStore.getState().user;
  if (!targetUser) return false;

  if (targetUser.isTrialActive === true) {
    return true;
  }

  const now = Date.now();

  if (targetUser.trialEndsAt) {
    const trialEndsMs = new Date(targetUser.trialEndsAt).getTime();
    if (!Number.isNaN(trialEndsMs)) {
      return trialEndsMs > now;
    }
  }

  const rawCreatedAt =
    targetUser.created_at ||
    (targetUser as User & { createdAt?: string }).createdAt;

  if (rawCreatedAt) {
    const createdAtMs = new Date(rawCreatedAt).getTime();
    if (!Number.isNaN(createdAtMs)) {
      return now - createdAtMs < TRIAL_DURATION_MS;
    }
  }

  return targetUser.isTrialActive !== false;
}

/**
 * Calcula quantos dias restam no Trial de 15 dias do utilizador.
 */
export function getTrialDaysLeft(user?: User | null): number {
  const targetUser = user ?? useAuthStore.getState().user;
  if (!targetUser) return 0;

  if (typeof targetUser.daysLeftTrial === 'number' && targetUser.daysLeftTrial > 0) {
    return targetUser.daysLeftTrial;
  }

  const now = Date.now();

  if (targetUser.trialEndsAt) {
    const trialEndsMs = new Date(targetUser.trialEndsAt).getTime();
    if (!Number.isNaN(trialEndsMs) && trialEndsMs > now) {
      return Math.max(1, Math.ceil((trialEndsMs - now) / (1000 * 60 * 60 * 24)));
    }
  }

  const rawCreatedAt =
    targetUser.created_at ||
    (targetUser as User & { createdAt?: string }).createdAt;

  if (rawCreatedAt) {
    const createdAtMs = new Date(rawCreatedAt).getTime();
    if (!Number.isNaN(createdAtMs)) {
      const expiresAtMs = createdAtMs + TRIAL_DURATION_MS;
      if (expiresAtMs > now) {
        return Math.max(1, Math.ceil((expiresAtMs - now) / (1000 * 60 * 60 * 24)));
      }
      return 0;
    }
  }

  return isUserTrialActive(targetUser) ? TRIAL_DURATION_DAYS : 0;
}

/**
 * Verifica se o utilizador possui um plano comercial pago ativo (fora do estado 'free').
 */
export function hasActivePaidPlan(user?: User | null, activePlanIdOverride?: string | null): boolean {
  const access = useAuthStore.getState();
  const effectivePlanRaw = String(
    activePlanIdOverride ??
    (access.planAccessLoaded ? access.activePlanId : user?.planType || user?.plano || 'free'),
  )
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const paidPlans = new Set([
    'basic',
    'basico',
    'starter',
    'avancado',
    'medium',
    'medio',
    'pro',
    'profissional',
    'professional',
    'premium',
    'master',
    'enterprise',
  ]);

  return paidPlans.has(effectivePlanRaw);
}

export function resolveUserPlanTier(user?: User | null): CommercialPlanTier {
  if (isUserTrialActive(user)) {
    return 'MASTER';
  }

  const access = useAuthStore.getState();
  const raw = String(access.planAccessLoaded ? access.activePlanId : user?.planType || user?.plano || 'free')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (raw === 'master' || raw === 'enterprise') {
    return 'MASTER';
  }

  if (
    raw === 'avancado' ||
    raw === 'medium' ||
    raw === 'medio' ||
    raw === 'pro' ||
    raw === 'profissional' ||
    raw === 'professional' ||
    raw === 'premium'
  ) {
    return 'AVANCADO';
  }

  return 'BASICO';
}

export function getPlanDisplayLabel(tier: CommercialPlanTier): string {
  if (tier === 'MASTER') return 'Plano Master';
  if (tier === 'AVANCADO') return 'Plano Avançado';
  return 'Plano Básico';
}

export function hasUserPlanFeature(user: User | null | undefined, requiredFeature?: string): boolean {
  if (!requiredFeature) return true;
  if (isUserTrialActive(user)) return true;
  const access = useAuthStore.getState();
  if (isUserTrialActive(access.user)) return true;
  if (!access.planAccessLoaded) return true;
  return access.activePlanFeatures.includes(requiredFeature);
}

export interface StrategicSubItem {
  path: string;
  label: string;
  icon: Icon;
  exact?: boolean;
  requiredFeature?: string;
}

export interface StrategicHubConfig {
  id: string;
  label: string;
  subtitle: string;
  icon: Icon;
  items: StrategicSubItem[];
}

/**
 * AS 4 CENTRAIS ESTRATÉGICAS DA PLATAFORMA
 */
const STRATEGIC_HUBS: StrategicHubConfig[] = [
  {
    id: 'radar',
    label: 'Radar & Oportunidades',
    subtitle: 'Captação & Inteligência',
    icon: Crosshair,
    items: [
      { path: FORNECEDOR_ROUTES.radar, label: 'Radar de Editais', icon: MagnifyingGlass, requiredFeature: 'radar_editais' },
      { path: FORNECEDOR_ROUTES.historico_concorrentes, label: 'Histórico de Concorrentes', icon: Eye, requiredFeature: 'historico_concorrentes' },
    ],
  },
  {
    id: 'disputas',
    label: 'Disputa ao Vivo',
    subtitle: 'Acompanhamento & Lances',
    icon: QuadroIcon,
    items: [
      { path: FORNECEDOR_ROUTES.disputa_ao_vivo, label: 'Painel de Controle da Disputa', icon: Lightning, requiredFeature: 'robo_lances' },
      { path: FORNECEDOR_ROUTES.disputas, label: 'Quadro de Etapas das Disputas', icon: QuadroIcon, requiredFeature: 'crm_kanban' },
      { path: FORNECEDOR_ROUTES.robo_lances, label: 'Envio Automático de Lances', icon: Robot, requiredFeature: 'robo_lances' },
      { path: FORNECEDOR_ROUTES.propostas, label: 'Criar Proposta', icon: FileText, requiredFeature: 'fabrica_propostas' },
      { path: FORNECEDOR_ROUTES.catalogo, label: 'Histórico de Compras', icon: Receipt, requiredFeature: 'catalogo_produtos' },
      { path: FORNECEDOR_ROUTES.prazos_alertas, label: 'Prazos & Alertas Críticos', icon: WarningCircle, requiredFeature: 'prazos_alertas' },
    ],
  },
  {
    id: 'defesas_recursos',
    label: 'Defesas e Recursos',
    subtitle: 'Segurança e Recursos 14.133',
    icon: Scales,
    items: [
      { path: FORNECEDOR_ROUTES.defesas_recursos, label: 'Central de Defesas e Recursos', icon: Scales, requiredFeature: 'recursos_administrativos' },
      { path: FORNECEDOR_ROUTES.lex, label: 'Assistente Lex', icon: Brain, requiredFeature: 'lex_ia_avancada' },
      { path: FORNECEDOR_ROUTES.impugnacao, label: 'Impugnação de Edital', icon: Scales, requiredFeature: 'impugnacao_edital' },
      { path: FORNECEDOR_ROUTES.recursos, label: 'Recursos & Contrarrazões', icon: Gavel, requiredFeature: 'recursos_administrativos' },
      { path: FORNECEDOR_ROUTES.leitor_editais, label: 'Leitura de Editais', icon: Article, requiredFeature: 'resumo_edital_completo' },
      { path: FORNECEDOR_ROUTES.radar_nulidades, label: 'Radar de Nulidades', icon: WarningCircle, requiredFeature: 'radar_erros_edital' },
      { path: FORNECEDOR_ROUTES.academia, label: 'Jurisprudência TCU', icon: GraduationCap, requiredFeature: 'academia_licitante' },
    ],
  },
  {
    id: 'pos_vitoria',
    label: 'Gestão Pós-Vitória & Garantias',
    subtitle: 'Execução & Conformidade',
    icon: Trophy,
    items: [
      { path: FORNECEDOR_ROUTES.gestao_pos_vitoria, label: 'Garantias & Cauções Retidas', icon: ShieldCheck, requiredFeature: 'gestao_contratual' },
      { path: FORNECEDOR_ROUTES.gestao_contratual, label: 'Gestão Contratual & Aditivos', icon: Trophy, requiredFeature: 'gestao_contratual' },
      { path: FORNECEDOR_ROUTES.expertise_fiscal, label: 'Expertise Fiscal (Add-on)', icon: Scales, requiredFeature: 'gestao_contratual' },
      { path: FORNECEDOR_ROUTES.cofre, label: 'Cofre de Documentos', icon: Vault, requiredFeature: 'cofre_documentos' },
      { path: FORNECEDOR_ROUTES.certidoes, label: 'Monitoramento de Certidões', icon: Certificate, requiredFeature: 'certidoes' },
      { path: FORNECEDOR_ROUTES.habilitacao, label: 'Documentos de Habilitação', icon: CheckSquare, requiredFeature: 'habilitacao' },
      { path: FORNECEDOR_ROUTES.srp, label: 'Registro de Preços & Carona SRP', icon: Receipt, requiredFeature: 'srp_carona' },
      { path: FORNECEDOR_ROUTES.relatorios_estrategicos, label: 'Relatórios Executivos & KPIs', icon: ChartLineUp, requiredFeature: 'relatorios_estrategicos' },
    ],
  },
];

interface NavigationSubLinkProps {
  item: StrategicSubItem;
  isCollapsed: boolean;
}

function NavigationSubLink({ item, isCollapsed }: NavigationSubLinkProps) {
  const location = useLocation();
  const active = item.exact
    ? location.pathname === item.path
    : location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);

  const Icon = item.icon;

  return (
    <Link
      to={item.path}
      onMouseEnter={() => prefetchRoute(item.path)}
      aria-current={active ? 'page' : undefined}
      title={isCollapsed ? item.label : undefined}
      className={`group relative flex items-center ${isCollapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2 gap-2.5'
        } rounded-lg text-xs font-semibold transition-all duration-150 ${active
          ? 'bg-brand-orange/15 text-white font-bold border-l-2 border-brand-orange'
          : 'text-slate-400 hover:bg-white/[0.06] hover:text-white'
        }`}
    >
      <Icon
        className={`h-4.5 w-4.5 shrink-0 transition-colors ${active ? 'text-brand-orange' : 'text-slate-400 group-hover:text-slate-200'
          }`}
        weight={active ? 'fill' : 'regular'}
        aria-hidden="true"
      />
      {!isCollapsed && (
        <span className="min-w-0 flex-1 truncate transition-opacity duration-300">
          {item.label}
        </span>
      )}
    </Link>
  );
}

interface StrategicHubNodeProps {
  hub: StrategicHubConfig;
  isCollapsed: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}

function StrategicHubNode({ hub, isCollapsed, isExpanded, onToggle }: StrategicHubNodeProps) {
  const location = useLocation();
  const Icon = hub.icon;

  const isAnyChildActive = hub.items.some(
    (item) => location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)
  );

  return (
    <div className="mb-1.5">
      <button
        type="button"
        onClick={onToggle}
        onMouseEnter={() => {
          hub.items.forEach((it) => prefetchRoute(it.path));
        }}
        title={isCollapsed ? `${hub.label} — ${hub.subtitle}` : undefined}
        aria-expanded={isExpanded}
        className={`w-full group relative flex items-center ${isCollapsed ? 'justify-center p-2.5' : 'px-3 py-2.5 gap-3'
          } rounded-xl text-left transition-all duration-200 cursor-pointer ${isAnyChildActive
            ? 'bg-white/[0.08] text-white border border-brand-blue/30 shadow-sm'
            : 'text-slate-300 hover:bg-white/[0.05] hover:text-white border border-transparent'
          }`}
      >
        {isAnyChildActive && (
          <span
            className="absolute left-0 inset-y-1.5 w-1 rounded-r-full bg-brand-orange"
            aria-hidden="true"
          />
        )}

        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-105 ${isAnyChildActive
              ? 'bg-brand-orange text-white shadow-md shadow-brand-orange/20'
              : 'bg-white/5 text-slate-400 group-hover:bg-white/10 group-hover:text-white'
            }`}
        >
          <Icon className="h-4.5 w-4.5" weight={isAnyChildActive ? 'bold' : 'regular'} />
        </div>

        {!isCollapsed && (
          <div className="min-w-0 flex-1 transition-opacity duration-300">
            <span className="block truncate text-xs font-black tracking-tight text-white">
              {hub.label}
            </span>
            <p className="truncate text-[10px] font-semibold text-slate-400">
              {hub.subtitle}
            </p>
          </div>
        )}

        {!isCollapsed && (
          <CaretDown
            className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180 text-white' : ''
              }`}
            weight="bold"
          />
        )}
      </button>

      {/* Sub-itens expansíveis */}
      <AnimatePresence initial={false}>
        {isExpanded && !isCollapsed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden mt-1 space-y-0.5 pl-3.5 ml-3.5 border-l border-white/10"
          >
            {hub.items.map((subItem) => (
              <NavigationSubLink
                key={subItem.path}
                item={subItem}
                isCollapsed={isCollapsed}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Sidebar() {
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const isTrialActive = isUserTrialActive(user);
  const trialDaysLeft = getTrialDaysLeft(user);
  const logout = useLogout();
  const displayName = getUserDisplayName(user, 'Executivo');
  const currentPlanTier = resolveUserPlanTier(user);
  const currentPlanLabel = getPlanDisplayLabel(currentPlanTier);

  // Estado Pinned (Persistido no localStorage)
  const [isPinned, setIsPinned] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('expertise_sidebar_pinned') === 'true';
  });

  // Estado Hover Inteligente com Abertura e Fechamento Suave Tardio
  const [isHovered, setIsHovered] = useState(false);
  const openTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isOpen = isPinned || isHovered;
  const isCollapsed = !isOpen;

  const handleMouseEnter = () => {
    // 1. Cancela imediatamente qualquer fechamento pendente
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    if (isPinned || isHovered) return;

    // 2. Aguarda 120ms com intenção de abertura antes de expandir (evita aberturas acidentais)
    openTimeoutRef.current = setTimeout(() => {
      setIsHovered(true);
      openTimeoutRef.current = null;
    }, 120);
  };

  const handleMouseLeave = () => {
    // 1. Cancela qualquer abertura pendente
    if (openTimeoutRef.current) {
      clearTimeout(openTimeoutRef.current);
      openTimeoutRef.current = null;
    }
    if (isPinned) return;

    // 2. Aguarda 150ms antes de recolher, garantindo fechamento suave e tolerante a oscilações
    closeTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
      closeTimeoutRef.current = null;
    }, 150);
  };

  useEffect(() => {
    return () => {
      if (openTimeoutRef.current) clearTimeout(openTimeoutRef.current);
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, []);

  const togglePin = () => {
    setIsPinned((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('expertise_sidebar_pinned', String(next));
      }
      if (next) setIsHovered(true);
      return next;
    });
  };

  const expandedHubs = useNavigationStore((state) => state.expandedHubs);
  const toggleHub = useNavigationStore((state) => state.toggleHub);
  const expandHub = useNavigationStore((state) => state.expandHub);

  // Auto-expande a Central Estratégica que contém a rota atual
  useEffect(() => {
    const activeHub = STRATEGIC_HUBS.find((hub) =>
      hub.items.some(
        (item) => location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)
      )
    );
    if (activeHub && !expandedHubs[activeHub.id]) {
      expandHub(activeHub.id);
    }
  }, [location.pathname]);

  const visibleHubs = useMemo(() => STRATEGIC_HUBS, []);

  const isDashboardActive =
    location.pathname === FORNECEDOR_ROUTES.dashboard ||
    location.pathname === '/dashboard';

  return (
    <>
      {/* ===================================================================
          ESPAÇADOR FIXO NO FLUXO FLEX (ELIMINA 100% DO LAYOUT SHIFT)
          Permanece w-16 quando flutuante (!isPinned) para nunca empurrar
          ou redimensionar tabelas e cards do ERP ao passar o cursor.
          =================================================================== */}
      <div
        className={`shrink-0 transition-[width] duration-[380ms] ${isPinned ? 'w-68' : 'w-16'
          }`}
        aria-hidden="true"
      />

      {/* ===================================================================
          BARRA LATERAL CORPORATIVA COM HOVER INTELIGENTE E TRANSIÇÃO SUAVE
          Renderizada com position: fixed para flutuar sem alterar o grid.
          =================================================================== */}
      <aside
        data-tour="sidebar-menu"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleMouseEnter}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) {
            handleMouseLeave();
          }
        }}
        aria-label="Menu Principal da Plataforma"
        style={{
          transition: 'width 380ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 380ms ease',
        }}
        className={`fixed left-0 top-0 bottom-0 z-40 flex h-screen flex-col border-r border-white/10 bg-brand-dark text-white select-none ${isOpen ? 'w-68 shadow-2xl shadow-black/50' : 'w-16 shadow-md'
          }`}
      >
        {/* Header com Logo Institucional e Botão de Fixar */}
        <div
          className={`border-b border-white/10 py-3.5 transition-all duration-300 ${isCollapsed ? 'px-2.5 flex justify-center' : 'px-4'
            }`}
        >
          <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
            <Link
              to={FORNECEDOR_ROUTES.dashboard}
              onMouseEnter={() => prefetchRoute(FORNECEDOR_ROUTES.dashboard)}
              className={`flex items-center rounded-xl focus-visible:ring-2 focus-visible:ring-brand-orange ${isCollapsed ? 'justify-center' : 'gap-2.5'
                }`}
              aria-label="EXPERTISE Licitatória — Página Inicial"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white p-1 shadow-md">
                <BrandLogo imageClassName="h-full w-full object-contain" />
              </div>
              {!isCollapsed && (
                <div className="min-w-0 overflow-hidden whitespace-nowrap transition-opacity duration-300">
                  <span className="block text-sm font-black tracking-wider text-white">EXPERTISE</span>
                </div>
              )}
            </Link>

            {!isCollapsed && (
              <button
                type="button"
                onClick={togglePin}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${isPinned
                    ? 'bg-brand-orange text-white shadow-xs'
                    : 'text-slate-400 hover:text-white hover:bg-white/10'
                  }`}
                title={isPinned ? 'Desafixar menu (recolher automaticamente)' : 'Fixar menu aberto'}
                aria-label={isPinned ? 'Desafixar menu' : 'Fixar menu'}
              >
                {isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
              </button>
            )}
          </div>
        </div>

        {/* Perfil & Status do Plano */}
        <div
          className={`border-b border-white/10 py-3 transition-all duration-300 ${isCollapsed ? 'px-2.5 flex justify-center' : 'px-4'
            }`}
        >
          <div className={`flex min-w-0 items-center ${isCollapsed ? 'justify-center' : 'gap-2.5'}`}>
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-orange text-xs font-black text-white shadow-sm"
              title={isCollapsed ? displayName : undefined}
            >
              {displayName.charAt(0).toUpperCase() || 'E'}
            </span>
            {!isCollapsed && (
              <div className="min-w-0 overflow-hidden whitespace-nowrap transition-opacity duration-300">
                <p className="truncate text-xs font-black text-white">{displayName}</p>
                <p className="truncate text-[10px] font-bold text-brand-orange">
                  {isTrialActive
                    ? `Teste Gratuito (${trialDaysLeft}d)`
                    : currentPlanLabel}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Navegação Principal — 4 Centrais Estratégicas */}
        <nav
          data-tour="strategic-hubs"
          className={`flex-1 overflow-y-auto overflow-x-hidden py-3 transition-all duration-300 scrollbar-thin scrollbar-thumb-white/10 ${isCollapsed ? 'px-1.5' : 'px-3'
            }`}
        >
          {/* Botão de Atalho para a Página Inicial */}
          <div className="mb-2">
            <Link
              to={FORNECEDOR_ROUTES.dashboard}
              onMouseEnter={() => prefetchRoute(FORNECEDOR_ROUTES.dashboard)}
              title={isCollapsed ? 'Página Inicial' : undefined}
              className={`group relative flex items-center ${isCollapsed ? 'justify-center p-2.5' : 'px-3 py-2.5 gap-3'
                } rounded-xl font-bold transition-all duration-150 ${isDashboardActive
                  ? 'bg-brand-orange text-white shadow-md shadow-brand-orange/20'
                  : 'text-slate-300 hover:bg-white/[0.06] hover:text-white'
                }`}
            >
              <House className="h-5 w-5 shrink-0" weight={isDashboardActive ? 'fill' : 'regular'} />
              {!isCollapsed && (
                <div className="min-w-0 flex-1 transition-opacity duration-300">
                  <span className="block text-xs font-black tracking-tight">Página Inicial</span>
                </div>
              )}
            </Link>
          </div>

          {!isCollapsed && (
            <p className="px-3 pb-2 pt-1 text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 transition-opacity duration-300">
              Centrais Estratégicas
            </p>
          )}

          {/* 4 Nós Principais / Centrais */}
          <div className="space-y-1">
            {visibleHubs.map((hub) => (
              <StrategicHubNode
                key={hub.id}
                hub={hub}
                isCollapsed={isCollapsed}
                isExpanded={Boolean(expandedHubs[hub.id])}
                onToggle={() => toggleHub(hub.id)}
              />
            ))}
          </div>

          {/* Seção Inferior de Gestão e Configurações */}
          <div className="my-2.5 border-t border-white/10" />

          <div className="space-y-1">
            <Link
              to={FORNECEDOR_ROUTES.planos}
              onMouseEnter={() => prefetchRoute(FORNECEDOR_ROUTES.planos)}
              title={isCollapsed ? 'Planos & Assinatura' : undefined}
              className={`flex items-center ${isCollapsed ? 'justify-center p-2.5' : 'px-3 py-2 gap-2.5'
                } rounded-lg text-xs font-semibold text-slate-300 hover:bg-white/[0.06] hover:text-white transition`}
            >
              <CreditCard className="h-4.5 w-4.5 shrink-0 text-slate-400" />
              {!isCollapsed && <span className="transition-opacity duration-300">Planos & Assinatura</span>}
            </Link>

            <Link
              to={FORNECEDOR_ROUTES.configuracoes}
              onMouseEnter={() => prefetchRoute(FORNECEDOR_ROUTES.configuracoes)}
              title={isCollapsed ? 'Configurações' : undefined}
              className={`flex items-center ${isCollapsed ? 'justify-center p-2.5' : 'px-3 py-2 gap-2.5'
                } rounded-lg text-xs font-semibold text-slate-300 hover:bg-white/[0.06] hover:text-white transition`}
            >
              <Gear className="h-4.5 w-4.5 shrink-0 text-slate-400" />
              {!isCollapsed && <span className="transition-opacity duration-300">Configurações</span>}
            </Link>
          </div>
        </nav>

        {/* Botão de Logout Seguro */}
        <div
          className={`border-t border-white/10 p-3 transition-all duration-300 ${isCollapsed ? 'flex justify-center' : ''
            }`}
        >
          <button
            type="button"
            onClick={() => void logout()}
            title={isCollapsed ? 'Encerrar sessão' : undefined}
            className={`flex items-center rounded-xl border border-red-400/20 bg-red-500/[0.06] py-2 text-xs font-bold text-red-200 transition hover:border-red-300/30 hover:bg-red-500/15 hover:text-white cursor-pointer ${isCollapsed ? 'justify-center px-2.5' : 'w-full gap-2.5 px-3'
              }`}
          >
            <SignOut className="h-4.5 w-4.5 shrink-0" weight="bold" aria-hidden="true" />
            {!isCollapsed && (
              <span className="overflow-hidden whitespace-nowrap transition-opacity duration-300">
                Encerrar sessão
              </span>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
