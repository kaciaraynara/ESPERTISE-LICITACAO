import axios from 'axios';

export interface AuditLogUserSummary {
  id: string;
  email: string;
  nome: string | null;
  role: string;
}

export interface AuditLogTelemetryItem {
  id: string;
  userId: string | null;
  action: string;
  ipAddress: string;
  userAgent: string | null;
  payload: Record<string, unknown> | null;
  timestamp: string;
  user?: AuditLogUserSummary | null;
}

export interface AdminTelemetryResponse {
  success: boolean;
  data: {
    logs: AuditLogTelemetryItem[];
    total: number;
    generatedAt: string;
  };
}

/**
 * Resolve o caminho secreto administrativo configurado via variável de ambiente.
 */
export function resolveAdminSecretPath(): string {
  const viteSecret = import.meta.env.VITE_ADMIN_SECRET_PATH?.trim();
  const clean = (viteSecret || 'internal-ops-vault').replace(/^\/+|\/+$/g, '');
  return clean || 'internal-ops-vault';
}

/**
 * Resolve a origem do servidor backend (sem sufixo `/api/v1`) para atingir `/backend/${ADMIN_SECRET_PATH}/...`.
 */
export function resolveBackendOrigin(): string {
  const configured = import.meta.env.VITE_API_URL?.trim().replace(/\/+$/, '');
  const isLocalHost =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  if (configured) {
    return configured.replace(/\/api(\/v1)?$/, '');
  }

  if (isLocalHost) {
    return 'http://localhost:3001';
  }

  return '';
}

/**
 * Busca os últimos 50 eventos de auditoria na rota ofuscada `/backend/${ADMIN_SECRET_PATH}/radar/telemetry`.
 * Inclui obrigatoriamente `withCredentials: true` para envio automático do cookie HttpOnly `admin_session_jwt`.
 */
export async function fetchAdminRadarTelemetry(): Promise<AdminTelemetryResponse> {
  const origin = resolveBackendOrigin();
  const secretPath = resolveAdminSecretPath();
  const endpoint = `${origin}/backend/${secretPath}/radar/telemetry`;

  const response = await axios.get<AdminTelemetryResponse>(endpoint, {
    withCredentials: true,
    headers: {
      Accept: 'application/json',
    },
  });

  return response.data;
}

export const adminTelemetryApi = {
  getTelemetry: fetchAdminRadarTelemetry,
};

