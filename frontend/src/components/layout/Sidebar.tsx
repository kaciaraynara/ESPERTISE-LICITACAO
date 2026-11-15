import {
  House,
  GraduationCap,
  MagnifyingGlass,
  Kanban,
  Eye,
  CheckCircle,
  ChartBar,
  WarningCircle,
  Copy,
  BookmarkSimple,
  Crosshair,
  Robot,
  CurrencyDollar,
  FileText,
  ListBullets,
  Clock,
  Brain,
  ChartPie,
  CreditCard,
  Gear,
  SignOut,
  Vault,
  ShieldCheck,
  Receipt,
  Scales,
  Users,
  Buildings,
  type Icon,
} from '@phosphor-icons/react';
import { Pin, PinOff } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useRef, useState } from 'react';

import BrandLogo from '@components/brand/BrandLogo';
import { useLogout } from '@/hooks';
import { FORNECEDOR_ROUTES } from '@/routes';
import { useAuthStore } from '@/store/auth.store';
import type { User } from '@/types';
import { getUserDisplayName } from '@/utils';

export type CommercialPlanTier = 'BASICO' | 'AVANCADO' | 'MASTER';

export const TRIAL_DURATION_DAYS = 15;
export const TRIAL_DURATION_MS = TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000;

const ROUTE_PREFETCH_MAP: Record<string, () => Promise<unknown>> = {
  [FORNECEDOR_ROUTES.dashboard]: () => import('@/pages/DashboardPage'),
  [FORNECEDOR_ROUTES.radar]: () => import('@/pages/LicitacoesPage'),
  [FORNECEDOR_ROUTES.srp]: () => import('@/pages/Srp/SrpPage'),
  [FORNECEDOR_ROUTES.disputas]: () => import('@/pages/CrmKanbanPage'),
  [FORNECEDOR_ROUTES.propostas]: () => import('@/pages/Propostas/PropostasPage'),
  [FORNECEDOR_ROUTES.robo_lances]: () => import('@/pages/RoboPage'),
  [FORNECEDOR_ROUTES.cofre]: () => import('@/pages/CofrePage'),
  [FORNECEDOR_ROUTES.fornecedores]: () => import('@/pages/RedeFornecedoresPage'),
  [FORNECEDOR_ROUTES.leitor_editais]: () => import('@/pages/LeitorEditaisPage'),
  [FORNECEDOR_ROUTES.defesas_recursos]: () => import('@/pages/Contencioso/ContenciosoHubPage'),
  [FORNECEDOR_ROUTES.empresa]: () => import('@/pages/EmpresaPage'),
  [FORNECEDOR_ROUTES.configuracoes]: () => import('@/pages/Configuracoes/ConfiguracoesPage'),
  [FORNECEDOR_ROUTES.planos]: () => import('@/pages/PlanosPage'),
};

export function prefetchRoute(path: string) {
  const loader = ROUTE_PREFETCH_MAP[path];
  if (loader) {
    loader().catch(() => {});
  }
}

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

export const STRATEGIC_HUBS: StrategicHubConfig[] = [
  {
    id: 'oportunidades',
    label: 'Oportunidades',
    subtitle: 'Radar e Registro de Preços',
    icon: Crosshair,
    items: [
      { path: FORNECEDOR_ROUTES.radar, label: 'Radar de Editais', icon: MagnifyingGlass, requiredFeature: 'radar_editais' },
      { path: FORNECEDOR_ROUTES.srp, label: 'Registro de Preços', icon: Receipt, requiredFeature: 'srp_carona' },
    ],
  },
  {
    id: 'disputas',
    label: 'Disputas',
    subtitle: 'Gestão, Propostas e Sala',
    icon: Kanban,
    items: [
      { path: FORNECEDOR_ROUTES.disputas, label: 'Gestão de Disputas', icon: Kanban, requiredFeature: 'crm_kanban' },
      { path: FORNECEDOR_ROUTES.propostas, label: 'Gerador de Propostas', icon: FileText, requiredFeature: 'fabrica_propostas' },
      { path: FORNECEDOR_ROUTES.robo_lances, label: 'Sala de Disputa', icon: Robot, requiredFeature: 'robo_lances' },
    ],
  },
  {
    id: 'documentos_fornecedores',
    label: 'Documentos e Fornecedores',
    subtitle: 'Cofre, Certidões e Parceiros',
    icon: Vault,
    items: [
      { path: FORNECEDOR_ROUTES.cofre, label: 'Cofre e Certidões', icon: ShieldCheck, requiredFeature: 'cofre_documentos' },
      { path: '/fornecedores', label: 'Rede de Fornecedores', icon: Users, requiredFeature: 'fornecedores' },
    ],
  },
  {
    id: 'defesas_recursos',
    label: 'Defesas e Recursos',
    subtitle: 'Análises, Impugnações e Recursos',
    icon: Scales,
    items: [
      { path: FORNECEDOR_ROUTES.leitor_editais, label: 'Análise de Editais', icon: Brain, requiredFeature: 'resumo_edital_completo' },
      { path: FORNECEDOR_ROUTES.defesas_recursos, label: 'Impugnações e Recursos', icon: Scales, requiredFeature: 'recursos_administrativos' },
    ],
  },
  {
    id: 'configuracoes_empresa',
    label: 'Configurações e Empresa',
    subtitle: 'Dados e Preferências',
    icon: Gear,
    items: [
      { path: FORNECEDOR_ROUTES.empresa, label: 'Minha Empresa', icon: Buildings, requiredFeature: 'empresa' },
      { path: FORNECEDOR_ROUTES.configuracoes, label: 'Configurações', icon: Gear, requiredFeature: 'configuracoes' },
      { path: FORNECEDOR_ROUTES.planos, label: 'Planos e Assinatura', icon: CreditCard, requiredFeature: 'planos' },
    ],
  },
];

interface NavItemDef {
  path: string;
  label: string;
  icon: Icon;
  exact?: boolean;
}

const PRIMARY_NAV_ITEMS: NavItemDef[] = [
  { path: FORNECEDOR_ROUTES.dashboard, label: 'Página Inicial', icon: House, exact: true },
  { path: FORNECEDOR_ROUTES.academia, label: 'Academia do Licitante', icon: GraduationCap },
  { path: FORNECEDOR_ROUTES.radar, label: 'Radar de Editais', icon: MagnifyingGlass },
  { path: FORNECEDOR_ROUTES.disputas, label: 'CRM / Pipeline', icon: Kanban },
  { path: FORNECEDOR_ROUTES.historico_concorrentes, label: 'Histórico de Concorrentes', icon: Eye },
  { path: FORNECEDOR_ROUTES.analise_viabilidade, label: 'Análise de Viabilidade', icon: CheckCircle },
  { path: FORNECEDOR_ROUTES.score_oportunidades, label: 'Score de Oportunidades', icon: ChartBar },
  { path: FORNECEDOR_ROUTES.radar_nulidades, label: 'Radar de Nulidades', icon: WarningCircle },
  { path: FORNECEDOR_ROUTES.srp_carona, label: 'SRP e Carona', icon: Copy },
  { path: FORNECEDOR_ROUTES.editais_monitorados, label: 'Editais Monitorados', icon: BookmarkSimple },
  { path: FORNECEDOR_ROUTES.estrategia_disputa, label: 'Central de Estratégia e Alert...', icon: Crosshair },
  { path: FORNECEDOR_ROUTES.robo_lances, label: 'Robô de Lances (Em Implan...', icon: Robot },
  { path: FORNECEDOR_ROUTES.precificacao_estrategica, label: 'Precificação Estratégica', icon: CurrencyDollar },
  { path: FORNECEDOR_ROUTES.propostas, label: 'Fábrica de Propostas', icon: FileText },
  { path: FORNECEDOR_ROUTES.catalogo, label: 'Catálogo de Produtos', icon: ListBullets },
  { path: FORNECEDOR_ROUTES.cofre, label: 'Documentos do Licitante', icon: FileText },
];

const ADVANCED_NAV_ITEMS: NavItemDef[] = [
  { path: FORNECEDOR_ROUTES.prazos_alertas, label: 'Prazos e Alertas', icon: Clock },
  { path: FORNECEDOR_ROUTES.lex, label: 'LEX Inteligência', icon: Brain },
  { path: FORNECEDOR_ROUTES.relatorios_estrategicos, label: 'Relatórios Estratégicos', icon: ChartPie },
  { path: FORNECEDOR_ROUTES.planos, label: 'Planos', icon: CreditCard },
  { path: FORNECEDOR_ROUTES.configuracoes, label: 'Configurações', icon: Gear },
];

export default function Sidebar() {
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const logout = useLogout();
  const displayName = getUserDisplayName(user, 'Luis Antonio Gomes Paiva');
  const userEmail = user?.email || 'luiscidgomes2020@gmail.com';

  const [isPinned, setIsPinned] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('expertise_sidebar_pinned') !== 'false';
  });

  const [isHovered, setIsHovered] = useState(false);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isOpen = isPinned || isHovered;
  const isCollapsed = !isOpen;

  const handleMouseEnter = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    if (isPinned || isHovered) return;
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    if (isPinned) return;
    closeTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
      closeTimeoutRef.current = null;
    }, 150);
  };

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

  const isItemActive = (item: NavItemDef) => {
    if (item.exact) {
      return (
        location.pathname === item.path ||
        (item.path === FORNECEDOR_ROUTES.dashboard && location.pathname === '/dashboard')
      );
    }
    return location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
  };

  const renderNavButton = (item: NavItemDef) => {
    const active = isItemActive(item);
    const Icon = item.icon;

    return (
      <Link
        key={item.path}
        to={item.path}
        onMouseEnter={() => prefetchRoute(item.path)}
        aria-current={active ? 'page' : undefined}
        title={isCollapsed ? item.label : undefined}
        className={`group relative flex items-center ${
          isCollapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2 gap-3'
        } rounded-xl text-xs transition-all duration-150 ${
          active
            ? 'bg-white/[0.08] text-white font-bold'
            : 'text-slate-300 hover:bg-white/[0.05] hover:text-white font-medium'
        }`}
      >
        {active && (
          <span
            className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-md bg-brand-orange"
            aria-hidden="true"
          />
        )}
        <Icon
          className={`h-4.5 w-4.5 shrink-0 transition-colors ${
            active ? 'text-brand-orange' : 'text-slate-400 group-hover:text-slate-200'
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
  };

  return (
    <>
      <div
        className={`shrink-0 transition-[width] duration-[380ms] ${
          isPinned ? 'w-68' : 'w-16'
        }`}
        aria-hidden="true"
      />

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
        className={`fixed left-0 top-0 bottom-0 z-40 flex h-screen flex-col border-r border-white/10 bg-[#081C3A] text-white select-none ${
          isOpen ? 'w-68 shadow-2xl shadow-black/50' : 'w-16 shadow-md'
        }`}
      >
        {/* Brand Header */}
        <div
          className={`border-b border-white/10 py-3.5 transition-all duration-300 ${
            isCollapsed ? 'px-2.5 flex justify-center' : 'px-4'
          }`}
        >
          <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
            <Link
              to={FORNECEDOR_ROUTES.dashboard}
              onMouseEnter={() => prefetchRoute(FORNECEDOR_ROUTES.dashboard)}
              className={`flex items-center rounded-xl focus-visible:ring-2 focus-visible:ring-brand-orange ${
                isCollapsed ? 'justify-center' : 'gap-3'
              }`}
              aria-label="EXPERTISE Licitatória — Página Inicial"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white p-1 shadow-md">
                <BrandLogo imageClassName="h-full w-full object-contain" />
              </div>
              {!isCollapsed && (
                <div className="min-w-0 overflow-hidden whitespace-nowrap transition-opacity duration-300">
                  <span className="block text-sm font-black tracking-wider text-white">EXPERTISE</span>
                  <span className="block text-[11px] font-black tracking-wider text-brand-orange -mt-0.5">LICITATÓRIA</span>
                </div>
              )}
            </Link>

            {!isCollapsed && (
              <button
                type="button"
                onClick={togglePin}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  isPinned
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

        {/* User Profile Card */}
        <div
          className={`border-b border-white/10 py-3 transition-all duration-300 ${
            isCollapsed ? 'px-2.5 flex justify-center' : 'px-4'
          }`}
        >
          <div className={`flex min-w-0 items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-orange text-sm font-black text-white shadow-sm"
              title={isCollapsed ? displayName : undefined}
            >
              {displayName.charAt(0).toUpperCase() || 'L'}
            </span>
            {!isCollapsed && (
              <div className="min-w-0 overflow-hidden whitespace-nowrap transition-opacity duration-300">
                <p className="truncate text-xs font-bold text-white leading-tight">{displayName}</p>
                <p className="truncate text-[11px] font-normal text-slate-400 leading-tight">
                  {userEmail}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation List */}
        <nav
          data-tour="strategic-hubs"
          className={`flex-1 overflow-y-auto overflow-x-hidden py-2.5 transition-all duration-300 scrollbar-thin scrollbar-thumb-white/10 ${
            isCollapsed ? 'px-1.5' : 'px-2.5'
          }`}
        >
          {/* Primary Tools */}
          <div className="space-y-0.5">
            {PRIMARY_NAV_ITEMS.map((item) => renderNavButton(item))}
          </div>

          {/* Section Divider & Header: FERRAMENTAS AVANÇADAS */}
          {!isCollapsed && (
            <p className="px-3 pt-4 pb-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400/90">
              Ferramentas Avançadas
            </p>
          )}

          {/* Advanced Tools */}
          <div className="space-y-0.5">
            {ADVANCED_NAV_ITEMS.map((item) => renderNavButton(item))}
          </div>
        </nav>

        {/* Helper Note Card */}
        {!isCollapsed && (
          <div className="px-3 pt-2">
            <div className="rounded-xl border border-white/10 bg-[#0d2244]/60 p-2.5 text-center shadow-inner">
              <p className="text-[10px] leading-relaxed text-slate-400 font-medium">
                O menu exibe somente módulos com fluxo operacional ativo.
              </p>
            </div>
          </div>
        )}

        {/* Exit Session Button */}
        <div
          className={`border-t border-white/10 p-3 transition-all duration-300 ${
            isCollapsed ? 'flex justify-center' : ''
          }`}
        >
          <button
            type="button"
            onClick={() => void logout()}
            title={isCollapsed ? 'Encerrar sessão' : undefined}
            className={`flex items-center rounded-xl border border-white/10 bg-white/[0.04] py-2 text-xs font-bold text-slate-300 transition hover:bg-white/10 hover:text-white cursor-pointer ${
              isCollapsed ? 'justify-center px-2.5' : 'w-full gap-2.5 px-3'
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
