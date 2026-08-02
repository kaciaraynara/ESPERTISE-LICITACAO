import { Briefcase, Crosshair, Gauge, type Icon } from '@phosphor-icons/react';
import { FORNECEDOR_ROUTES } from '@/routes';

export type ProfileRole = 'fornecedor';

export interface NavItem {
  path: string;
  label: string;
  icon: Icon;
  exact?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: Record<ProfileRole, NavGroup[]> = {
  fornecedor: [
    {
      label: 'Visão geral',
      items: [
        {
          path: FORNECEDOR_ROUTES.dashboard,
          label: 'Página Inicial',
          icon: Gauge,
          exact: true,
        },
        {
          path: FORNECEDOR_ROUTES.radar,
          label: 'Radar de Editais',
          icon: Crosshair,
        },
      ],
    },
    {
      label: 'Habilitação',
      items: [
        {
          path: FORNECEDOR_ROUTES.documentos,
          label: 'Documentos do Licitante',
          icon: Briefcase,
        },
      ],
    },
  ],
};

export function resolveProfileRole(_role?: string | null): ProfileRole {
  return 'fornecedor';
}

export function resolveProfileNavigation(_role?: string | null): NavGroup[] {
  return NAV_GROUPS.fornecedor;
}

export function resolveProfileLogoutPath(_role?: string | null) {
  return '/login';
}

export function resolveProfileLabel(_role?: string | null) {
  return 'Fornecedor';
}
