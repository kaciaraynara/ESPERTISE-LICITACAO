import { isProduction } from '../config/env';

const DEFAULT_LOCAL_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:4173',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
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

export function isOriginAllowed(origin?: string): boolean {
  if (!origin) {
    return true;
  }

  const normalizedOrigin = origin.trim().replace(/\/$/, '');

  // Permitir conexões locais em desenvolvimento
  if (!isProduction() && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(normalizedOrigin)) {
    return true;
  }

  // Sempre permitir o domínio oficial e todos os subdomínios (incluindo www)
  if (/^https?:\/\/([a-z0-9-]+\.)*expertiselicitatoria\.com\.br$/i.test(normalizedOrigin)) {
    return true;
  }

  // Permitir deploys e previews da Vercel
  if (/^https?:\/\/([a-z0-9-]+\.)*vercel\.app$/i.test(normalizedOrigin)) {
    return true;
  }

  const allowed = getAllowedOrigins().map((o) => o.replace(/\/$/, ''));
  return allowed.includes(normalizedOrigin);
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
