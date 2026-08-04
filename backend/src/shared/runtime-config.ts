import { isProduction } from '../config/env';

const DEFAULT_LOCAL_ORIGINS = [
  'http://localhost:4173',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:4173',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
];

export function getAllowedOrigins() {
  const configuredOrigins = [
    ...splitOrigins(process.env.CORS_ORIGIN),
    ...splitOrigins(process.env.FRONTEND_URL),
  ];

  if (isProduction()) {
    return [...new Set(configuredOrigins)];
  }

  return [...new Set([...configuredOrigins, ...DEFAULT_LOCAL_ORIGINS])];
}

export function isOriginAllowed(origin?: string) {
  if (!origin) {
    return true;
  }

  // Permite qualquer domínio da Vercel para não bloquear a API em produção
  if (origin.includes('vercel.app')) {
    return true;
  }

  return getAllowedOrigins().includes(origin);
}

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET?.trim();

  if (
    !secret ||
    secret.length < 32 ||
    secret === 'secret-expertise-key-default' ||
    secret.includes('sua_chave_jwt_super_secreta')
  ) {
    throw new Error('JWT_SECRET ausente ou insegura. Configure uma chave com pelo menos 32 caracteres.');
  }

  return secret;
}

function splitOrigins(raw?: string) {
  return String(raw ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}
