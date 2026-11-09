import {
  Brain,
  Briefcase,
  CheckCircle,
  Clock,
  CreditCard,
  Eye,
  FileText,
  Gauge,
  Gear,
  ListBullets,
  ListChecks,
  MagnifyingGlass,
  Receipt,
  type Icon,
} from '@phosphor-icons/react';
import { FORNECEDOR_ROUTES } from '@/routes';
import type { User } from '@/types';

export type ProfileRole = 'fornecedor';

export interface NavItem {
  path: string;
  label: string;
  icon: Icon;
  exact?: boolean;
  requiredFeature?: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

// Navegação móvel espelha o menu lateral e respeita as permissões do plano do usuário.
const NAV_GROUPS: Record<ProfileRole, NavGroup[]> = {
  fornecedor: [
    {
      label: 'Operacional',
      items: [
        { path: FORNECEDOR_ROUTES.dashboard, label: 'Página Inicial', icon: Gauge, exact: true },
        { path: FORNECEDOR_ROUTES.radar, label: 'Radar de Editais', icon: MagnifyingGlass, requiredFeature: 'radar_editais' },
        { path: '/tipos-contratacao', label: 'Tipos de Contratação', icon: ListChecks, requiredFeature: 'radar_editais' },
        { path: FORNECEDOR_ROUTES.disputas, label: 'Gestão de Disputas', icon: ListChecks, requiredFeature: 'crm_kanban' },
        { path: FORNECEDOR_ROUTES.analise_viabilidade, label: 'Análise de Viabilidade', icon: CheckCircle, requiredFeature: 'analise_viabilidade' },
        { path: FORNECEDOR_ROUTES.propostas, label: 'Criar Proposta', icon: FileText, requiredFeature: 'fabrica_propostas' },
        { path: FORNECEDOR_ROUTES.catalogo, label: 'Catálogo de Produtos', icon: ListBullets, requiredFeature: 'catalogo_produtos' },
        { path: FORNECEDOR_ROUTES.documentos, label: 'Meus Documentos', icon: Briefcase, requiredFeature: 'cofre_documentos' },
        { path: FORNECEDOR_ROUTES.historico_concorrentes, label: 'Histórico de Concorrentes', icon: Eye, requiredFeature: 'historico_concorrentes' },
        { path: FORNECEDOR_ROUTES.prazos_alertas, label: 'Prazos e Alertas', icon: Clock, requiredFeature: 'prazos_alertas' },
        { path: FORNECEDOR_ROUTES.gestao_contratual, label: 'Gestão Contratual', icon: Receipt, requiredFeature: 'gestao_contratual' },
        { path: FORNECEDOR_ROUTES.lex, label: 'Análise de Editais', icon: Brain, requiredFeature: 'lex_ia_avancada' },
      ],
    },
    {
      label: 'Conta',
      items: [
        { path: FORNECEDOR_ROUTES.planos, label: 'Planos', icon: CreditCard },
        { path: FORNECEDOR_ROUTES.configuracoes, label: 'Configurações', icon: Gear },
      ],
    },
  ],
};

export function resolveProfileRole(_role?: string | null): ProfileRole {
  return 'fornecedor';
}

export function resolveProfileNavigation(_role?: string | null, _user?: User | null): NavGroup[] {
  return NAV_GROUPS.fornecedor;
}

export function resolveProfileLogoutPath(_role?: string | null) {
  return '/login';
}

export function resolveProfileLabel(_role?: string | null) {
  return 'Fornecedor';
}
