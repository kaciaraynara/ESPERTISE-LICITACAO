import api from './api';

/**
 * Instância Axios unificada com renovação automática de JWT em 401,
 * injeção automática do cabeçalho multi-empresa (x-company-id) e disparo de paywall em 403.
 */
export const apiClient = api;
export default api;
