import {
  House,
  Crosshair,
  Kanban,
  Scales,
  Trophy,
  MagnifyingGlass,
  WarningCircle,
  Article,
  ChartLineUp,
  Robot,
  IdentificationCard,
  Lightning,
  Gavel,
  CheckSquare,
  Vault,
  Certificate,
  Receipt,
  GraduationCap,
  FileText,
  Brain,
  Eye,
  CreditCard,
  Gear,
  SignOut,
  CaretLeft,
  CaretDown,
  type Icon,
} from '@phosphor-icons/react';
import { Link, useLocation } from 'react-router-dom';
import { useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import BrandLogo from '@components/brand/BrandLogo';
import { useLogout } from '@/hooks';
import { FORNECEDOR_ROUTES } from '@/routes';
import { useAuthStore } from '@/store/auth.store';
import { useNavigationStore } from '@/store/navigation.store';
import type { User } from '@/types';
import { getUserDisplayName } from '@/utils';

export type CommercialPlanTier = 'BASICO' | 'AVANCADO' | 'MASTER';

export function resolveUserPlanTier(user?: User | null): CommercialPlanTier {
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
  if (user?.isTrialActive) return true;
  const access = useAuthStore.getState();
  if (access.user?.isTrialActive) return true;
  return access.planAccessLoaded && access.activePlanFeatures.includes(requiredFeature);
}

export interface StrategicSubItem {
  path: string;
  label: string;
  icon: Icon;
  badge?: string;
  exact?: boolean;
  requiredFeature?: string;
}

export interface StrategicHubConfig {
  id: string;
  label: string;
  subtitle: string;
  icon: Icon;
  badge?: string;
  items: StrategicSubItem[];
}

/**
 * AS 4 CENTRAIS ESTRATÉGICAS DO COMMAND CENTER ENTERPRISE
 */
const STRATEGIC_HUBS: StrategicHubConfig[] = [
  {
    id: 'radar',
    label: 'Radar & Oportunidades',
    subtitle: 'Captação & Inteligência',
    icon: Crosshair,
    badge: 'PNCP / IA',
    items: [
      { path: FORNECEDOR_ROUTES.radar, label: 'Radar de Editais & CNAE', icon: MagnifyingGlass, requiredFeature: 'radar_editais', badge: 'IA' },
      { path: FORNECEDOR_ROUTES.score_viabilidade, label: 'Termômetro de Oportunidades', icon: ChartLineUp, requiredFeature: 'score_oportunidade' },
      { path: FORNECEDOR_ROUTES.dispensa_eletronica, label: 'Dispensas Eletrônicas (Art. 75)', icon: Lightning, requiredFeature: 'dispensa_eletronica', badge: 'Rápido' },
      { path: FORNECEDOR_ROUTES.pregao_eletronico, label: 'Pregão & Concorrência', icon: Gavel, requiredFeature: 'radar_editais' },
      { path: FORNECEDOR_ROUTES.historico_concorrentes, label: 'Histórico de Concorrentes', icon: Eye, requiredFeature: 'historico_concorrentes' },
      { path: FORNECEDOR_ROUTES.credenciamento, label: 'Credenciamento & SICAF', icon: IdentificationCard, requiredFeature: 'radar_editais' },
    ],
  },
  {
    id: 'disputas',
    label: 'Sala de Guerra & Disputas',
    subtitle: 'Operação ao Vivo & Lances',
    icon: Kanban,
    badge: 'Disputa',
    items: [
      { path: FORNECEDOR_ROUTES.sala_de_guerra, label: 'Cockpit & Split Payment', icon: Lightning, requiredFeature: 'robo_lances', badge: 'Ao Vivo' },
      { path: FORNECEDOR_ROUTES.disputas, label: 'Sala de Disputas (CRM Kanban)', icon: Kanban, requiredFeature: 'crm_disputas' },
      { path: FORNECEDOR_ROUTES.robo_lances, label: 'Robô Estratégico de Lances', icon: Robot, requiredFeature: 'robo_lances', badge: 'Auto' },
      { path: FORNECEDOR_ROUTES.propostas, label: 'Fábrica de Propostas', icon: FileText, requiredFeature: 'fabrica_propostas' },
      { path: FORNECEDOR_ROUTES.catalogo, label: 'Catálogo de Produtos & Custos', icon: Receipt, requiredFeature: 'catalogo_produtos' },
      { path: FORNECEDOR_ROUTES.prazos_alertas, label: 'Prazos & Alertas Críticos', icon: WarningCircle, requiredFeature: 'prazos_alertas' },
    ],
  },
  {
    id: 'contencioso',
    label: 'Contencioso & Defesas (Lex)',
    subtitle: 'Segurança Jurídica 14.133',
    icon: Scales,
    badge: 'Lex IA',
    items: [
      { path: FORNECEDOR_ROUTES.contencioso, label: 'Central de Contencioso & Defesas', icon: Scales, requiredFeature: 'recursos_administrativos', badge: 'RAG' },
      { path: FORNECEDOR_ROUTES.lex, label: 'Copiloto Jurídico LEX', icon: Brain, requiredFeature: 'lex_ai', badge: 'GPT-4o' },
      { path: FORNECEDOR_ROUTES.impugnacao, label: 'Preparar Impugnação de Edital', icon: Scales, requiredFeature: 'impugnacao_edital' },
      { path: FORNECEDOR_ROUTES.recursos, label: 'Recursos & Contrarrazões', icon: Gavel, requiredFeature: 'recursos_administrativos' },
      { path: FORNECEDOR_ROUTES.leitor_editais, label: 'Leitura e Análise de Editais', icon: Article, requiredFeature: 'resumo_edital_completo' },
      { path: FORNECEDOR_ROUTES.radar_nulidades, label: 'Radar de Nulidades & Restrições', icon: WarningCircle, requiredFeature: 'radar_erros_edital' },
      { path: FORNECEDOR_ROUTES.academia, label: 'Academia & Jurisprudência TCU', icon: GraduationCap, requiredFeature: 'academia' },
    ],
  },
  {
    id: 'pos_vitoria',
    label: 'Gestão Pós-Vitória & Garantias',
    subtitle: 'Execução & Conformidade',
    icon: Trophy,
    badge: 'Art. 96',
    items: [
      { path: FORNECEDOR_ROUTES.gestao_contratual, label: 'Gestão Contratual & Aditivos', icon: Trophy, requiredFeature: 'gestao_contratual' },
      { path: FORNECEDOR_ROUTES.cofre, label: 'Cofre de Documentos', icon: Vault, requiredFeature: 'cofre_documentos' },
      { path: FORNECEDOR_ROUTES.certidoes, label: 'Monitoramento de Certidões', icon: Certificate, requiredFeature: 'monitoramento_certidoes' },
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
      aria-current={active ? 'page' : undefined}
      title={isCollapsed ? item.label : undefined}
      className={`group relative flex items-center ${isCollapsed ? 'justify-center px-2 py-2' : 'px-3 py-2 gap-2.5'
        } rounded-lg text-xs font-semibold transition-all duration-150 ${active
          ? 'bg-[#EA580C]/15 text-white font-bold border-l-2 border-[#EA580C]'
          : 'text-slate-400 hover:bg-white/[0.06] hover:text-white'
        }`}
    >
      <Icon
        className={`h-4 w-4 shrink-0 transition-colors ${active ? 'text-[#EA580C]' : 'text-slate-400 group-hover:text-slate-200'
          }`}
        weight={active ? 'fill' : 'regular'}
        aria-hidden="true"
      />
      {!isCollapsed && (
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
      )}
      {!isCollapsed && item.badge && (
        <span
          className={`ml-auto px-1.5 py-0.5 text-[9px] font-black tracking-wider uppercase rounded ${active ? 'bg-[#EA580C] text-white' : 'bg-white/10 text-slate-300'
            }`}
        >
          {item.badge}
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
    <div className="mb-2">
      <button
        type="button"
        onClick={onToggle}
        title={isCollapsed ? `${hub.label} — ${hub.subtitle}` : undefined}
        aria-expanded={isExpanded}
        className={`w-full group relative flex items-center ${isCollapsed ? 'justify-center p-2.5' : 'px-3 py-2.5 gap-3'
          } rounded-xl text-left transition-all duration-200 ${isAnyChildActive
            ? 'bg-gradient-to-r from-blue-900/40 to-slate-800/40 text-white border border-blue-500/20 shadow-sm'
            : 'text-slate-300 hover:bg-white/[0.05] hover:text-white border border-transparent'
          }`}
      >
        {/* Indicador de barra ativa na lateral */}
        {isAnyChildActive && (
          <span
            className="absolute left-0 inset-y-1.5 w-1 rounded-r-full bg-[#EA580C]"
            aria-hidden="true"
          />
        )}

        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-105 ${isAnyChildActive
              ? 'bg-[#EA580C] text-white shadow-md shadow-orange-500/20'
              : 'bg-white/5 text-slate-400 group-hover:bg-white/10 group-hover:text-white'
            }`}
        >
          <Icon className="h-4.5 w-4.5" weight={isAnyChildActive ? 'bold' : 'regular'} />
        </div>

        {!isCollapsed && (
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1">
              <span className="truncate text-xs font-black tracking-tight text-white">
                {hub.label}
              </span>
              {hub.badge && (
                <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[9px] font-black text-blue-300 border border-blue-400/20">
                  {hub.badge}
                </span>
              )}
            </div>
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
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className={`overflow-hidden mt-1 space-y-0.5 ${isCollapsed ? 'pl-0' : 'pl-3.5 ml-3.5 border-l border-white/10'
              }`}
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
  const planAccessLoaded = useAuthStore((state) => state.planAccessLoaded);
  const isTrialActive = Boolean(user?.isTrialActive);
  const logout = useLogout();
  const displayName = getUserDisplayName(user, 'Executivo');
  const currentPlanTier = resolveUserPlanTier(user);
  const currentPlanLabel = getPlanDisplayLabel(currentPlanTier);

  // Zustand Store com persistência e zero re-renders globais
  const isCollapsed = useNavigationStore((state) => state.isCollapsed);
  const expandedHubs = useNavigationStore((state) => state.expandedHubs);
  const toggleSidebar = useNavigationStore((state) => state.toggleSidebar);
  const toggleHub = useNavigationStore((state) => state.toggleHub);
  const expandHub = useNavigationStore((state) => state.expandHub);

  // Auto-expande a Central Estratégica que contém a rota atual no primeiro acesso
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

  // Filtra as centrais e subitens com base nos recursos do plano (ou libera 100% no Free Trial)
  const visibleHubs = useMemo(() => {
    if (isTrialActive) return STRATEGIC_HUBS;
    if (!planAccessLoaded) return STRATEGIC_HUBS; // Fallback gracioso

    return STRATEGIC_HUBS.map((hub) => ({
      ...hub,
      items: hub.items.filter((item) => hasUserPlanFeature(user, item.requiredFeature)),
    })).filter((hub) => hub.items.length > 0);
  }, [isTrialActive, planAccessLoaded, user]);

  const isDashboardActive = location.pathname === FORNECEDOR_ROUTES.dashboard;

  return (
    <motion.aside
      data-tour="sidebar-menu"
      initial={false}
      animate={{ width: isCollapsed ? 80 : 288 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      aria-label="Menu Principal do Command Center"
      className="relative z-40 flex h-screen shrink-0 flex-col border-r border-white/10 bg-[#07172b] text-white shadow-2xl select-none"
    >
      {/* Botão de Toggle da Sidebar (Retrátil) */}
      <button
        type="button"
        onClick={toggleSidebar}
        title={isCollapsed ? 'Expandir barra lateral' : 'Recolher barra lateral'}
        aria-label={isCollapsed ? 'Expandir barra lateral' : 'Recolher barra lateral'}
        className="absolute -right-3.5 top-6 z-50 flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-[#0A2540] text-white shadow-lg transition hover:bg-[#EA580C] hover:scale-110 active:scale-95 cursor-pointer"
      >
        <motion.div animate={{ rotate: isCollapsed ? 180 : 0 }} transition={{ duration: 0.25 }}>
          <CaretLeft weight="bold" className="h-3.5 w-3.5" />
        </motion.div>
      </button>

      {/* Header com Logo Institucional */}
      <div className={`border-b border-white/10 py-4 transition-all duration-300 ${isCollapsed ? 'px-3' : 'px-5'}`}>
        <Link
          to={FORNECEDOR_ROUTES.dashboard}
          className={`flex items-center rounded-xl focus-visible:ring-2 focus-visible:ring-[#EA580C] ${isCollapsed ? 'justify-center' : 'gap-3'
            }`}
          aria-label="EXPERTISE Licitatória — Command Center"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white p-1.5 shadow-md">
            <BrandLogo imageClassName="h-full w-full object-contain" />
          </div>
          <AnimatePresence>
            {!isCollapsed && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                className="min-w-0 overflow-hidden whitespace-nowrap"
              >
                <span className="block text-sm font-black tracking-wider text-white">EXPERTISE</span>
                <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-[#EA580C]">
                  Command Center
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </Link>
      </div>

      {/* Perfil & Status do Plano */}
      <div className={`border-b border-white/10 py-3.5 transition-all duration-300 ${isCollapsed ? 'px-3 flex justify-center' : 'px-5'}`}>
        <div className={`flex min-w-0 items-center ${isCollapsed ? 'justify-center' : 'gap-2.5'}`}>
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#EA580C] text-xs font-black text-white shadow-sm"
            title={isCollapsed ? displayName : undefined}
          >
            {displayName.charAt(0).toUpperCase() || 'E'}
          </span>
          <AnimatePresence>
            {!isCollapsed && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                className="min-w-0 overflow-hidden whitespace-nowrap"
              >
                <p className="truncate text-xs font-black text-white">{displayName}</p>
                <p className="truncate text-[10px] font-bold text-[#EA580C]">
                  {isTrialActive
                    ? `Trial Enterprise (${user?.daysLeftTrial ?? 15}d)`
                    : currentPlanLabel}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Navegação Principal — 4 Centrais Estratégicas */}
      <nav
        data-tour="strategic-hubs"
        className={`flex-1 overflow-y-auto overflow-x-hidden py-3.5 transition-all duration-300 scrollbar-thin scrollbar-thumb-white/10 ${isCollapsed ? 'px-2' : 'px-3'
          }`}
      >
        {/* Botão de Atalho para o Painel Executivo Consolidado */}
        <div className="mb-3">
          <Link
            to={FORNECEDOR_ROUTES.dashboard}
            title={isCollapsed ? 'Painel Executivo (Command Center)' : undefined}
            className={`group relative flex items-center ${isCollapsed ? 'justify-center p-2.5' : 'px-3 py-2.5 gap-3'
              } rounded-xl font-bold transition-all duration-150 ${isDashboardActive
                ? 'bg-[#EA580C] text-white shadow-md shadow-orange-500/20'
                : 'text-slate-300 hover:bg-white/[0.06] hover:text-white'
              }`}
          >
            <House className="h-4.5 w-4.5 shrink-0" weight={isDashboardActive ? 'fill' : 'regular'} />
            {!isCollapsed && (
              <div className="min-w-0 flex-1">
                <span className="block text-xs font-black tracking-tight">Painel Executivo</span>
                <span className="block text-[10px] text-orange-200/80 font-semibold">
                  Visão Consolidada
                </span>
              </div>
            )}
          </Link>
        </div>

        {!isCollapsed && (
          <p className="px-3 pb-2 pt-1 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">
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
              onToggle={() => {
                if (isCollapsed) {
                  toggleSidebar();
                  expandHub(hub.id);
                } else {
                  toggleHub(hub.id);
                }
              }}
            />
          ))}
        </div>

        {/* Seção Inferior de Gestão e Configurações */}
        <div className="my-3 border-t border-white/10" />

        <div className="space-y-1">
          <Link
            to={FORNECEDOR_ROUTES.planos}
            title={isCollapsed ? 'Planos & Upgrade' : undefined}
            className={`flex items-center ${isCollapsed ? 'justify-center p-2' : 'px-3 py-2 gap-2.5'
              } rounded-lg text-xs font-semibold text-slate-400 hover:bg-white/[0.06] hover:text-white transition`}
          >
            <CreditCard className="h-4 w-4 shrink-0 text-amber-400" />
            {!isCollapsed && <span>Planos & Assinatura</span>}
          </Link>

          <Link
            to={FORNECEDOR_ROUTES.configuracoes}
            title={isCollapsed ? 'Configurações' : undefined}
            className={`flex items-center ${isCollapsed ? 'justify-center p-2' : 'px-3 py-2 gap-2.5'
              } rounded-lg text-xs font-semibold text-slate-400 hover:bg-white/[0.06] hover:text-white transition`}
          >
            <Gear className="h-4 w-4 shrink-0" />
            {!isCollapsed && <span>Configurações</span>}
          </Link>
        </div>
      </nav>

      {/* Botão de Logout Seguro */}
      <div className={`border-t border-white/10 p-3 transition-all duration-300 ${isCollapsed ? 'flex justify-center' : ''}`}>
        <button
          type="button"
          onClick={() => void logout()}
          title={isCollapsed ? 'Encerrar sessão' : undefined}
          className={`flex items-center rounded-xl border border-red-400/20 bg-red-500/[0.06] py-2.5 text-xs font-bold text-red-200 transition hover:border-red-300/30 hover:bg-red-500/15 hover:text-white cursor-pointer ${isCollapsed ? 'justify-center px-2.5' : 'w-full gap-2.5 px-3'
            }`}
        >
          <SignOut className="h-4.5 w-4.5 shrink-0" weight="bold" aria-hidden="true" />
          <AnimatePresence>
            {!isCollapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                className="overflow-hidden whitespace-nowrap"
              >
                Encerrar sessão
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </motion.aside>
  );
}
