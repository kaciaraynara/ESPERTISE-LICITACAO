import {
  Brain,
  Briefcase,
  Calculator,
  CheckCircle,
  Clock,
  CreditCard,
  Eye,
  FileText,
  Gavel,
  Gauge,
  Gear,
  Stack,
  ListBullets,
  ListChecks,
  MagnifyingGlass,
  Receipt,
  Scales,
  ShieldCheck,
  Storefront,
  Trophy,
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

const NAV_GROUPS: Record<ProfileRole, NavGroup[]> = {
  fornecedor: [
    {
      label: 'Radar & Oportunidades',
      items: [
        { path: FORNECEDOR_ROUTES.dashboard, label: 'Página Inicial', icon: Gauge, exact: true },
        { path: FORNECEDOR_ROUTES.radar, label: 'Radar de Editais', icon: MagnifyingGlass },
        { path: '/tipos-contratacao', label: 'Tipos de Contratação', icon: ListChecks },
        { path: FORNECEDOR_ROUTES.analise_viabilidade, label: 'Análise de Viabilidade', icon: CheckCircle },
        { path: FORNECEDOR_ROUTES.historico_concorrentes, label: 'Histórico de Concorrentes', icon: Eye },
        { path: '/fornecedor/investigacao', label: 'Inteligência Competitiva', icon: Trophy },
      ],
    },
    {
      label: 'Propostas & Disputa',
      items: [
        { path: FORNECEDOR_ROUTES.disputas, label: 'Gestão de Disputas', icon: ListChecks },
        { path: '/fornecedor/precificacao', label: 'Planilha & Precificação', icon: Calculator },
        { path: FORNECEDOR_ROUTES.propostas, label: 'Criar Proposta PDF', icon: FileText },
        { path: FORNECEDOR_ROUTES.robo_lances, label: 'Sala de Disputa & Robô', icon: Gavel },
        { path: FORNECEDOR_ROUTES.srp, label: 'SRP e Carona (Art. 86)', icon: Stack },
        { path: FORNECEDOR_ROUTES.catalogo, label: 'Catálogo de Produtos', icon: ListBullets },
        { path: FORNECEDOR_ROUTES.rede_fornecedores, label: 'Rede de Fornecedores', icon: Storefront },
      ],
    },
    {
      label: 'Jurídico & Habilitação',
      items: [
        { path: FORNECEDOR_ROUTES.lex, label: 'Análise com a Luli', icon: Brain },
        { path: FORNECEDOR_ROUTES.impugnacao, label: 'Impugnação de Editais', icon: Scales },
        { path: FORNECEDOR_ROUTES.recursos, label: 'Recursos Administrativos', icon: FileText },
        { path: FORNECEDOR_ROUTES.radar_nulidades, label: 'Radar de Nulidades', icon: ShieldCheck },
        { path: FORNECEDOR_ROUTES.habilitacao, label: 'Matriz de Habilitação', icon: CheckCircle },
        { path: FORNECEDOR_ROUTES.certidoes, label: 'Certidões Negativas', icon: FileText },
        { path: FORNECEDOR_ROUTES.cofre, label: 'Cofre de Documentos', icon: Briefcase },
        { path: FORNECEDOR_ROUTES.prazos_alertas, label: 'Prazos e Alertas', icon: Clock },
      ],
    },
    {
      label: 'Contratos & Conta',
      items: [
        { path: FORNECEDOR_ROUTES.gestao_contratual, label: 'Gestão Contratual', icon: Receipt },
        { path: FORNECEDOR_ROUTES.expertise_fiscal, label: 'Expertise Fiscal', icon: Calculator },
        { path: FORNECEDOR_ROUTES.empresa, label: 'Minha Empresa', icon: Briefcase },
        { path: FORNECEDOR_ROUTES.planos, label: 'Planos e Assinatura', icon: CreditCard },
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