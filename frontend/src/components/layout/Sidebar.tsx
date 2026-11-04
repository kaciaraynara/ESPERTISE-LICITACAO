import {
  House,
  MagnifyingGlass,
  WarningCircle,
  Article,
  Scales,
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
  Kanban,
  SignOut,
  CaretLeft,
  CaretDown,
  Briefcase,
  ListBullets,
  Clock,
  type Icon,
} from '@phosphor-icons/react';
import { Link, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import BrandLogo from '@components/brand/BrandLogo';
import { useLogout } from '@/hooks';
import { FORNECEDOR_ROUTES } from '@/routes';
import { useAuthStore } from '@/store/auth.store';
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

type NavigationLinkItem = {
  type?: 'link';
  path: string;
  label: string;
  icon: Icon;
  exact?: boolean;
  badge?: string;
  requiredFeature?: string;
};

type NavigationGroupItem = {
  type: 'group';
  label: string;
  icon: Icon;
  children: NavigationLinkItem[];
};

type NavigationItem = NavigationLinkItem | NavigationGroupItem;

type NavigationSection = {
  label: string;
  items: NavigationItem[];
};

const ferramentasSections: NavigationSection[] = [
  {
    label: 'Oportunidades',
    items: [
      { path: FORNECEDOR_ROUTES.radar, label: 'Buscar Oportunidades', icon: MagnifyingGlass, requiredFeature: 'radar_editais' },
      {
        type: 'group',
        label: 'Tipos de Contratação',
        icon: Briefcase,
        children: [
          { path: FORNECEDOR_ROUTES.dispensa_eletronica, label: 'Dispensa Eletrônica (Art. 75)', icon: Lightning, requiredFeature: 'dispensa_eletronica' },
          { path: FORNECEDOR_ROUTES.pregao_eletronico, label: 'Pregão Eletrônico', icon: Gavel, requiredFeature: 'radar_editais' },
          { path: FORNECEDOR_ROUTES.concorrencia, label: 'Concorrência', icon: Scales, requiredFeature: 'radar_editais' },
          { path: FORNECEDOR_ROUTES.credenciamento, label: 'Credenciamento', icon: IdentificationCard, requiredFeature: 'radar_editais' },
          { path: FORNECEDOR_ROUTES.srp, label: 'SRP (Sistema de Registro de Preços)', icon: Receipt, requiredFeature: 'srp_carona' },
        ],
      },
      { path: FORNECEDOR_ROUTES.score_viabilidade, label: 'Termômetro de Oportunidade', icon: ChartLineUp, requiredFeature: 'score_oportunidade' },
      { path: FORNECEDOR_ROUTES.historico_concorrentes, label: 'Histórico de Concorrentes', icon: Eye, requiredFeature: 'historico_concorrentes' },
    ],
  },
  {
    label: 'Preparar disputa',
    items: [
      { path: FORNECEDOR_ROUTES.leitor_editais, label: 'Leitura de Editais', icon: Article, requiredFeature: 'resumo_edital_completo' },
      { path: FORNECEDOR_ROUTES.radar_nulidades, label: 'Revisão de Exigências', icon: WarningCircle, requiredFeature: 'radar_erros_edital' },
      { path: FORNECEDOR_ROUTES.impugnacao, label: 'Preparar Impugnação', icon: Scales, requiredFeature: 'impugnacao_edital' },
      { path: FORNECEDOR_ROUTES.recursos, label: 'Recursos Administrativos', icon: Gavel, requiredFeature: 'recursos_administrativos' },
      { path: FORNECEDOR_ROUTES.propostas, label: 'Gerador de Propostas', icon: FileText, requiredFeature: 'fabrica_propostas' },
      { path: FORNECEDOR_ROUTES.habilitacao, label: 'Habilitação', icon: CheckSquare, requiredFeature: 'habilitacao' },
      { path: FORNECEDOR_ROUTES.robo_lances, label: 'Estratégia de Lances', icon: Robot, requiredFeature: 'robo_lances' },
    ],
  },
  {
    label: 'Documentos e apoio',
    items: [
      { path: FORNECEDOR_ROUTES.cofre, label: 'Meus Documentos', icon: Vault, requiredFeature: 'cofre_documentos' },
      { path: FORNECEDOR_ROUTES.certidoes, label: 'Certidões', icon: Certificate, requiredFeature: 'certidoes' },
      { path: FORNECEDOR_ROUTES.sicaf_credenciamento, label: 'SICAF e Certificação', icon: IdentificationCard, requiredFeature: 'credenciamento' },
      { path: FORNECEDOR_ROUTES.academia, label: 'Academia do Licitante', icon: GraduationCap, requiredFeature: 'academia_licitante' },
      { path: FORNECEDOR_ROUTES.lex, label: 'Análise de Editais', icon: Brain, badge: 'NOVO', requiredFeature: 'lex_ia_avancada' },
    ],
  },
];

const gestaoSections: NavigationSection[] = [
  {
    label: 'Painel e operação',
    items: [
      { path: FORNECEDOR_ROUTES.dashboard, label: 'Página Inicial', icon: House, exact: true },
      { path: FORNECEDOR_ROUTES.disputas, label: 'Gestão de Disputas', icon: Kanban, requiredFeature: 'crm_kanban' },
      { path: FORNECEDOR_ROUTES.prazos_alertas, label: 'Prazos e Alertas', icon: Clock, requiredFeature: 'prazos_alertas' },
      { path: FORNECEDOR_ROUTES.gestao_contratual, label: 'Gestão Contratual', icon: Receipt, badge: 'PÓS-VITÓRIA', requiredFeature: 'gestao_contratual' },
      { path: FORNECEDOR_ROUTES.catalogo, label: 'Catálogo de Produtos', icon: ListBullets, requiredFeature: 'catalogo_produtos' },
    ],
  },
  {
    label: 'Conta',
    items: [
      { path: FORNECEDOR_ROUTES.planos, label: 'Planos', icon: CreditCard },
      { path: FORNECEDOR_ROUTES.configuracoes, label: 'Configurações', icon: Gear },
    ],
  },
];

function NavigationLink({ item, isCollapsed }: { item: NavigationLinkItem; isCollapsed: boolean }) {
  const location = useLocation();
  const active = item.exact
    ? location.pathname === item.path
    : location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
  const Icon = item.icon;

  return (
    <Link
      to={item.path}
      title={isCollapsed ? item.label : undefined}
      aria-current={active ? 'page' : undefined}
      className={`group relative flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} rounded-lg px-3 py-2.5 transition-colors ${
        active
          ? 'bg-white/[0.08] text-white font-black'
          : 'text-blue-100/70 hover:bg-white/[0.05] hover:text-white font-medium'
      }`}
    >
      {active ? (
        <span
          className={`absolute inset-y-2 w-1 rounded-r-full bg-[#EA580C] transition-all duration-300 ease-in-out ${
            isCollapsed ? 'left-0' : '-left-4'
          }`}
          aria-hidden="true"
        />
      ) : null}
      <Icon
        className={`h-4.5 w-4.5 shrink-0 transition-colors ${active ? 'text-[#EA580C]' : 'text-blue-200/60'}`}
        weight={active ? 'fill' : 'regular'}
        aria-hidden="true"
      />
      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.2 }}
            className="min-w-0 flex-1 flex items-center justify-between overflow-hidden whitespace-nowrap"
          >
            <span className="truncate text-xs font-bold">{item.label}</span>
            {item.badge && (
              <span className="ml-2 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider rounded bg-[#EA580C] text-white shrink-0">
                {item.badge}
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </Link>
  );
}

function NavigationGroup({ item, isCollapsed }: { item: NavigationGroupItem; isCollapsed: boolean }) {
  const location = useLocation();
  const active = item.children.some((child) =>
    location.pathname === child.path || location.pathname.startsWith(`${child.path}/`),
  );
  const [isExpanded, setIsExpanded] = useState(active);
  const Icon = item.icon;

  useEffect(() => {
    if (active) setIsExpanded(true);
  }, [active]);

  return (
    <div>
      <button
        type="button"
        title={isCollapsed ? item.label : undefined}
        aria-expanded={isExpanded}
        aria-controls="sidebar-contract-types"
        onClick={() => setIsExpanded((expanded) => !expanded)}
        className={`group relative flex w-full items-center ${isCollapsed ? 'justify-center' : 'gap-3'} rounded-lg px-3 py-2.5 transition-colors ${
          active
            ? 'bg-white/[0.08] text-white font-black'
            : 'text-blue-100/70 hover:bg-white/[0.05] hover:text-white font-medium'
        }`}
      >
        {active && (
          <span
            className={`absolute inset-y-2 w-1 rounded-r-full bg-[#EA580C] ${
              isCollapsed ? 'left-0' : '-left-4'
            }`}
            aria-hidden="true"
          />
        )}
        <Icon
          className={`h-4.5 w-4.5 shrink-0 ${active ? 'text-[#EA580C]' : 'text-blue-200/60'}`}
          weight={active ? 'fill' : 'regular'}
          aria-hidden="true"
        />
        {!isCollapsed && (
          <>
            <span className="min-w-0 flex-1 truncate text-left text-xs font-bold">{item.label}</span>
            <CaretDown
              className={`h-3.5 w-3.5 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          </>
        )}
      </button>
      {isExpanded && (
        <div id="sidebar-contract-types" className={`mt-0.5 space-y-0.5 ${isCollapsed ? '' : 'ml-3 border-l border-white/10 pl-2'}`}>
          {item.children.map((child) => (
            <NavigationLink key={child.path} item={child} isCollapsed={isCollapsed} />
          ))}
        </div>
      )}
    </div>
  );
}

function filterNavigationItems(items: NavigationItem[], user: User | null | undefined): NavigationItem[] {
  const visibleItems: NavigationItem[] = [];

  items.forEach((item) => {
    if (item.type === 'group') {
      const children = item.children.filter((child) => hasUserPlanFeature(user, child.requiredFeature));
      if (children.length > 0) visibleItems.push({ ...item, children });
      return;
    }

    if (hasUserPlanFeature(user, item.requiredFeature)) visibleItems.push(item);
  });

  return visibleItems;
}

export default function Sidebar() {
  const user = useAuthStore((state) => state.user);
  const planAccessLoaded = useAuthStore((state) => state.planAccessLoaded);
  const isTrialActive = Boolean(user?.isTrialActive);
  const logout = useLogout();
  const displayName = getUserDisplayName(user, 'Usuário');
  const currentPlanTier = resolveUserPlanTier(user);
  const currentPlanLabel = getPlanDisplayLabel(currentPlanTier);

  // Se isTrialActive === true, todas as seções e ferramentas são liberadas sem restrição.
  const visibleFerramentasSections = isTrialActive
    ? ferramentasSections
    : planAccessLoaded
    ? ferramentasSections
        .map((section) => ({
          ...section,
          items: filterNavigationItems(section.items, user),
        }))
        .filter((section) => section.items.length > 0)
    : [];

  const visibleGestaoSections = isTrialActive
    ? gestaoSections
    : gestaoSections
        .map((section) => ({
          ...section,
          items: filterNavigationItems(section.items, user),
        }))
        .filter((section) => section.items.length > 0);

  // Estado da Sidebar retrátil
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <motion.aside
      initial={false}
      animate={{ width: isCollapsed ? 80 : 280 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="hidden h-screen shrink-0 flex-col border-r border-white/10 bg-[#0A2540] text-white md:flex relative z-50 select-none"
      aria-label="Menu principal"
      data-tour="sidebar-menu"
    >
      {/* Botão de Toggle */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        title={isCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
        className="absolute top-6 -right-3.5 flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-md transition-all hover:border-[#EA580C] hover:text-[#EA580C] z-50 cursor-pointer"
      >
        <motion.div animate={{ rotate: isCollapsed ? 180 : 0 }} transition={{ duration: 0.3 }}>
          <CaretLeft weight="bold" className="h-3.5 w-3.5" />
        </motion.div>
      </button>

      {/* Header com Logo */}
      <div className={`border-b border-white/10 py-4 transition-all duration-300 ${isCollapsed ? 'px-3' : 'px-5'}`}>
        <Link
          to={FORNECEDOR_ROUTES.dashboard}
          className={`flex items-center rounded-xl focus-visible:ring-2 focus-visible:ring-[#EA580C] ${
            isCollapsed ? 'justify-center' : 'gap-3'
          }`}
          aria-label="EXPERTISE Licitatória, Página Inicial"
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
                  Licitatória
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </Link>
      </div>

      {/* Perfil do Usuário */}
      <div className={`border-b border-white/10 py-3.5 transition-all duration-300 ${isCollapsed ? 'px-3 flex justify-center' : 'px-5'}`}>
        <div className={`flex min-w-0 items-center ${isCollapsed ? 'justify-center' : 'gap-2.5'}`}>
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#EA580C] text-xs font-black text-white shadow-xs"
            title={isCollapsed ? displayName : undefined}
          >
            {displayName.charAt(0).toUpperCase() || 'U'}
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
                    ? `Trial Master (${user?.daysLeftTrial ?? 15}d)`
                    : planAccessLoaded
                    ? currentPlanTier === 'BASICO' && useAuthStore.getState().activePlanId === 'free'
                      ? 'Sem assinatura'
                      : currentPlanLabel
                    : 'Verificando assinatura…'}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Lista de Navegação com Scrollbar customizada */}
      <nav className={`flex-1 overflow-y-auto overflow-x-hidden py-4 transition-all duration-300 ${isCollapsed ? 'px-2' : 'px-3'}`}>
        <div className="space-y-4">
          {visibleFerramentasSections.map((section) => (
            <section key={section.label} aria-label={section.label}>
              {!isCollapsed && (
                <p className="px-3 pb-1.5 text-[9px] font-black uppercase tracking-[0.18em] text-blue-200/40">
                  {section.label}
                </p>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  item.type === 'group'
                    ? <NavigationGroup key={item.label} item={item} isCollapsed={isCollapsed} />
                    : <NavigationLink key={item.path} item={item} isCollapsed={isCollapsed} />
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="my-4 border-t border-white/10" />

        <div className="space-y-4">
          {visibleGestaoSections.map((section) => (
            <section key={section.label} aria-label={section.label}>
              {!isCollapsed && (
                <p className="px-3 pb-1.5 text-[9px] font-black uppercase tracking-[0.18em] text-blue-200/40">
                  {section.label}
                </p>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  item.type === 'group'
                    ? <NavigationGroup key={item.label} item={item} isCollapsed={isCollapsed} />
                    : <NavigationLink key={item.path} item={item} isCollapsed={isCollapsed} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </nav>

      {/* Botão Encerrar Sessão */}
      <div className={`border-t border-white/10 p-3 transition-all duration-300 ${isCollapsed ? 'flex justify-center' : ''}`}>
        <button
          type="button"
          onClick={() => void logout()}
          title={isCollapsed ? 'Encerrar sessão' : undefined}
          className={`flex items-center rounded-lg border border-red-400/20 bg-red-500/[0.06] py-2.5 text-xs font-bold text-red-200 transition hover:border-red-300/30 hover:bg-red-500/10 hover:text-white cursor-pointer ${
            isCollapsed ? 'justify-center px-2.5' : 'w-full gap-2.5 px-3'
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
