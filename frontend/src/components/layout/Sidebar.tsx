import {
  House,
  GraduationCap,
  MagnifyingGlass,
  ChartBar,
  WarningCircle,
  Copy,
  Bookmark,
  CheckCircle,
  Crosshair,
  Robot,
  CurrencyDollar,
  FileText,
  ListBullets,
  Clock,
  Brain,
  Eye,
  ChartPie,
  CreditCard,
  Gear,
  SignOut,
  CaretLeft,
  type Icon,
} from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import BrandLogo from '@components/brand/BrandLogo';
import { useLogout } from '@/hooks';
import { FORNECEDOR_ROUTES } from '@/routes';
import { documentosApi } from '@/services/api';
import { useAuthStore } from '@/store/auth.store';
import { getUserDisplayName } from '@/utils';

type EssentialNavigationItem = {
  path: string;
  label: string;
  icon: Icon;
  exact?: boolean;
};
const essentialNavigation: EssentialNavigationItem[] = [
  { path: FORNECEDOR_ROUTES.dashboard, label: 'Página Inicial', icon: House, exact: true },
  { path: FORNECEDOR_ROUTES.academia, label: 'Academia do Licitante', icon: GraduationCap },
  { path: FORNECEDOR_ROUTES.radar, label: 'Radar de Editais', icon: MagnifyingGlass },
  { path: FORNECEDOR_ROUTES.historico_concorrentes, label: 'Histórico de Concorrentes', icon: Eye },
  { path: FORNECEDOR_ROUTES.analise_viabilidade, label: 'Análise de Viabilidade', icon: CheckCircle },
  { path: FORNECEDOR_ROUTES.score_oportunidades, label: 'Score de Oportunidades', icon: ChartBar },
  { path: FORNECEDOR_ROUTES.radar_nulidades, label: 'Radar de Nulidades', icon: WarningCircle },
  { path: FORNECEDOR_ROUTES.srp_carona, label: 'SRP e Carona', icon: Copy },
  { path: FORNECEDOR_ROUTES.editais_monitorados, label: 'Editais Monitorados', icon: Bookmark },
  { path: FORNECEDOR_ROUTES.estrategia_disputa, label: 'Estratégia de Disputa', icon: Crosshair },
  { path: FORNECEDOR_ROUTES.robo_lances, label: 'Robô de Lances', icon: Robot },
  { path: FORNECEDOR_ROUTES.precificacao_estrategica, label: 'Precificação Estratégica', icon: CurrencyDollar },
  { path: FORNECEDOR_ROUTES.propostas, label: 'Propostas', icon: FileText },
  { path: FORNECEDOR_ROUTES.catalogo, label: 'Catálogo de Produtos', icon: ListBullets },
];

const documentsNavigation: EssentialNavigationItem = {
  path: FORNECEDOR_ROUTES.documentos,
  label: 'Documentos do Licitante',
  icon: FileText,
};

const secondaryNavigation: EssentialNavigationItem[] = [
  { path: FORNECEDOR_ROUTES.prazos_alertas, label: 'Prazos e Alertas', icon: Clock },
  { path: FORNECEDOR_ROUTES.lex, label: 'LEX Inteligência', icon: Brain },
  { path: FORNECEDOR_ROUTES.relatorios_estrategicos, label: 'Relatórios Estratégicos', icon: ChartPie },
  { path: FORNECEDOR_ROUTES.planos, label: 'Planos', icon: CreditCard },
  { path: FORNECEDOR_ROUTES.configuracoes, label: 'Configurações', icon: Gear },
];

function NavigationLink({ item, isCollapsed }: { item: EssentialNavigationItem, isCollapsed: boolean }) {
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
      className={`group relative flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} rounded-lg px-3 py-3 transition-colors ${
        active
          ? 'bg-white/[0.08] text-white'
          : 'text-blue-100/70 hover:bg-white/[0.05] hover:text-white'
      }`}
    >
      {active ? (
        <span
          className={`absolute inset-y-2 w-1 rounded-r-full bg-brand-orange transition-all duration-300 ease-in-out ${isCollapsed ? 'left-0' : '-left-4'}`}
          aria-hidden="true"
        />
      ) : null}
      <Icon
        className={`h-5 w-5 shrink-0 transition-colors ${active ? 'text-brand-orange' : 'text-blue-200/60'}`}
        weight={active ? 'fill' : 'regular'}
        aria-hidden="true"
      />
      <AnimatePresence>
        {!isCollapsed && (
          <motion.span 
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.2 }}
            className="min-w-0 overflow-hidden whitespace-nowrap"
          >
            <span className="block truncate text-sm font-bold">{item.label}</span>
          </motion.span>
        )}
      </AnimatePresence>
    </Link>
  );
}

export default function Sidebar() {
  const user = useAuthStore((state) => state.user);
  const logout = useLogout();
  const displayName = getUserDisplayName(user, 'Usuário');
  
  // Estado global da Sidebar retrátil
  const [isCollapsed, setIsCollapsed] = useState(false);

  const storageQuery = useQuery({
    queryKey: ['documents', 'storage-status'],
    queryFn: async () => {
      const response = await documentosApi.status();
      if (
        response.data?.success !== true
        || typeof response.data?.data?.available !== 'boolean'
      ) {
        throw new Error('DOCUMENT_STORAGE_STATUS_INVALID_RESPONSE');
      }
      return response.data.data.available;
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <motion.aside
      initial={false}
      animate={{ width: isCollapsed ? 80 : 292 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="hidden h-screen shrink-0 flex-col border-r border-white/10 bg-[#0A2540] text-white md:flex relative z-50"
      aria-label="Menu principal"
    >
      {/* Botão de Toggle */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        title={isCollapsed ? 'Expandir painel de opções' : 'Recolher painel de opções'}
        className="absolute top-6 -right-4 flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-md transition-all hover:border-[#EA580C] hover:text-[#EA580C] z-50"
      >
        <motion.div
          animate={{ rotate: isCollapsed ? 180 : 0 }}
          transition={{ duration: 0.3 }}
        >
          <CaretLeft weight="bold" className="h-4 w-4" />
        </motion.div>
      </button>

      <div className={`border-b border-white/10 py-5 transition-all duration-300 ${isCollapsed ? 'px-3' : 'px-5'}`}>
        <Link
          to={FORNECEDOR_ROUTES.dashboard}
          className={`flex items-center rounded-xl focus-visible:ring-2 focus-visible:ring-brand-orange focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A2540] ${isCollapsed ? 'justify-center' : 'gap-3'}`}
          aria-label="EXPERTISE Licitatória, Página Inicial"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white p-1.5 shadow-lg">
            <BrandLogo imageClassName="h-full w-full object-contain" />
          </div>
          <AnimatePresence>
            {!isCollapsed && (
              <motion.span 
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                className="min-w-0 overflow-hidden whitespace-nowrap"
                aria-hidden="true"
              >
                <span className="block text-base font-black tracking-[0.04em] text-white">
                  EXPERTISE
                </span>
                <span className="block text-[11px] font-black uppercase tracking-[0.2em] text-brand-orange">
                  Licitatória
                </span>
              </motion.span>
            )}
          </AnimatePresence>
        </Link>
      </div>

      <div className={`border-b border-white/10 py-5 transition-all duration-300 ${isCollapsed ? 'px-3 flex justify-center' : 'px-5'}`}>
        <div className={`flex min-w-0 items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-orange text-sm font-black text-white" title={isCollapsed ? displayName : undefined}>
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
                <p className="truncate text-sm font-black text-white">{displayName}</p>
                <p className="truncate text-xs text-blue-200/50">{user?.email || 'Conta autenticada'}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <nav className={`flex-1 overflow-y-auto overflow-x-hidden py-6 transition-all duration-300 ${isCollapsed ? 'px-2' : 'px-4'}`} aria-label="Áreas disponíveis">
        <AnimatePresence>
          {!isCollapsed && (
            <motion.p 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="px-3 text-[10px] font-black uppercase tracking-[0.22em] text-blue-200/30 whitespace-nowrap overflow-hidden"
            >
              Navegação
            </motion.p>
          )}
        </AnimatePresence>
        
        <div className={`space-y-1.5 ${!isCollapsed && 'mt-3'}`}>
          {essentialNavigation.map((item) => (
            <NavigationLink key={item.path} item={item} isCollapsed={isCollapsed} />
          ))}
          {storageQuery.data === true ? (
            <NavigationLink item={documentsNavigation} isCollapsed={isCollapsed} />
          ) : (
            <div
              className={`flex items-center rounded-lg border border-white/[0.06] py-3 text-blue-100/40 ${isCollapsed ? 'justify-center' : 'gap-3 px-3'}`}
              aria-disabled="true"
              title={isCollapsed ? "Documentos do Licitante" : undefined}
            >
              <FileText className="h-5 w-5 shrink-0 text-blue-200/30" aria-hidden="true" />
              {!isCollapsed && (
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold">Documentos do Licitante</span>
                </span>
              )}
            </div>
          )}
        </div>

        <AnimatePresence>
          {!isCollapsed && (
            <motion.p 
              initial={{ opacity: 0, height: 0, marginTop: 0 }}
              animate={{ opacity: 1, height: 'auto', marginTop: 24 }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              className="px-3 text-[10px] font-black uppercase tracking-[0.22em] text-blue-200/30 whitespace-nowrap overflow-hidden"
            >
              Ferramentas Avançadas
            </motion.p>
          )}
        </AnimatePresence>

        <div className={`space-y-1.5 ${!isCollapsed && 'mt-3'}`}>
          {secondaryNavigation.map((item) => (
            <NavigationLink key={item.path} item={item} isCollapsed={isCollapsed} />
          ))}
        </div>

        <AnimatePresence>
          {!isCollapsed && (
            <motion.p 
              initial={{ opacity: 0, height: 0, marginTop: 0 }}
              animate={{ opacity: 1, height: 'auto', marginTop: 28 }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-3 text-xs leading-5 text-blue-100/60 overflow-hidden"
            >
              O menu exibe somente módulos com fluxo operacional ativo.
            </motion.p>
          )}
        </AnimatePresence>
      </nav>

      <div className={`border-t border-white/10 p-4 transition-all duration-300 ${isCollapsed ? 'flex justify-center' : ''}`}>
        <button
          type="button"
          onClick={() => void logout()}
          title={isCollapsed ? 'Encerrar sessão' : undefined}
          className={`flex items-center rounded-lg border border-red-400/20 bg-red-500/[0.06] py-3 text-sm font-bold text-red-200 transition hover:border-red-300/30 hover:bg-red-500/10 hover:text-white ${isCollapsed ? 'justify-center px-3' : 'w-full gap-3 px-3'}`}
        >
          <SignOut className="h-5 w-5 shrink-0" weight="bold" aria-hidden="true" />
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
