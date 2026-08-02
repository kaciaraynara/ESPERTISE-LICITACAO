import { useQuery } from '@tanstack/react-query';
import { modulesApi, type SystemModule, type SystemModuleStatus } from '@services/api';

export const systemModuleRoutes: Record<string, string> = {
  'pagina-inicial': '/fornecedor/dashboard',
  'radar-editais': '/fornecedor/radar',
  'editais-monitorados': '/fornecedor/editais-monitorados',
  'resumo-editais': '/fornecedor/resumo-editais',
  'assistente-juridico': '/fornecedor/assistente-juridico',
  juridico: '/fornecedor/juridico',
  'contabilidade-habilitacao': '/fornecedor/contabilidade-habilitacao',
  'cofre-documental': '/fornecedor/documentos',
  propostas: '/fornecedor/propostas',
  'precificacao-estrategica': '/fornecedor/precificacao-estrategica',
  'estrategia-lances': '/fornecedor/estrategia-lances',
  'robo-lance': '/fornecedor/robo-lance',
  prazos: '/fornecedor/prazos',
  notificacoes: '/fornecedor/notificacoes',
  planos: '/fornecedor/planos',
  configuracoes: '/fornecedor/configuracoes',
};

export function resolveModuleRoute(module: Pick<SystemModule, 'key' | 'route'>) {
  if (systemModuleRoutes[module.key]) {
    return systemModuleRoutes[module.key];
  }

  if (module.route?.startsWith('/app')) {
    return module.route.replace(/^\/app/, '/fornecedor');
  }

  return module.route || '/fornecedor/dashboard';
}

export function resolveStatusLabel(status: SystemModuleStatus) {
  const labels: Record<SystemModuleStatus, string> = {
    AVAILABLE: 'Disponível',
    IN_IMPLANTATION: 'Em implantação',
    INTEGRATION_PENDING: 'Integração pendente',
    HIDDEN: 'Oculto',
    DISABLED: 'Desabilitado',
  };

  return labels[status] ?? status;
}

export function resolveStatusClass(status: SystemModuleStatus) {
  const classes: Record<SystemModuleStatus, string> = {
    AVAILABLE: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    IN_IMPLANTATION: 'border-amber-100 bg-amber-50 text-amber-700',
    INTEGRATION_PENDING: 'border-blue-100 bg-blue-50 text-blue-700',
    HIDDEN: 'border-slate-100 bg-slate-50 text-slate-500',
    DISABLED: 'border-slate-100 bg-slate-50 text-slate-500',
  };

  return classes[status] ?? classes.IN_IMPLANTATION;
}

export function useSystemModules() {
  return useQuery<SystemModule[]>({
    queryKey: ['system-modules'],
    queryFn: async () => {
      const response = await modulesApi.listar();
      if (!Array.isArray(response.data?.modules)) {
        throw new Error('Resposta inválida ao consultar os módulos do sistema.');
      }
      return response.data.modules;
    },
    staleTime: 1000 * 60 * 5,
    retry: false,
  });
}
