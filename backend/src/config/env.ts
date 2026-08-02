export type RuntimeMode = 'development' | 'test' | 'production';

export function getNodeEnv(): RuntimeMode {
  const value = (process.env.NODE_ENV || 'development').toLowerCase();
  if (value === 'production') return 'production';
  if (value === 'test') return 'test';
  return 'development';
}

export function isProduction() {
  return getNodeEnv() === 'production';
}

export function isTest() {
  return getNodeEnv() === 'test';
}

export function getBooleanEnv(name: string, defaultValue = false) {
  const raw = process.env[name];
  if (raw === undefined) return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(raw.trim().toLowerCase());
}

export function getNumberEnv(name: string, defaultValue: number) {
  const numeric = Number(process.env[name]);
  return Number.isFinite(numeric) ? numeric : defaultValue;
}

export function getStringEnv(name: string, defaultValue = '') {
  const raw = process.env[name];
  return typeof raw === 'string' && raw.trim() ? raw.trim() : defaultValue;
}

export function isDatabaseConfigured() {
  const url = getStringEnv('DATABASE_URL');
  return Boolean(url) && !url.includes('[PASSWORD]') && !url.includes('localhost:0');
}

export function assertProductionConfig() {
  if (!isProduction()) {
    return;
  }

  const productionForbiddenFlags = [
    'ENABLE_BID_ROBOT',
    'ENABLE_LEX',
    'ENABLE_CRM',
    'ENABLE_LEGACY_MARKETPLACE',
    'ENABLE_LEGACY_PRICING_STRATEGY',
    'RBAC_ALLOW_ENV_FALLBACK',
  ];

  for (const frozenFeature of productionForbiddenFlags) {
    if (getBooleanEnv(frozenFeature, false)) {
      throw new Error(`${frozenFeature} nao pode estar ativo em producao.`);
    }
  }

  if (!isDatabaseConfigured()) {
    throw new Error('DATABASE_URL e obrigatoria em producao.');
  }

  const jwtSecret = getStringEnv('JWT_SECRET');
  if (jwtSecret.length < 32) {
    throw new Error('JWT_SECRET deve ter pelo menos 32 caracteres em producao.');
  }

  const corsOrigin = getStringEnv('CORS_ORIGIN') || getStringEnv('FRONTEND_URL');
  if (!corsOrigin) {
    throw new Error('CORS_ORIGIN ou FRONTEND_URL deve ser configurado em producao.');
  }
  if (corsOrigin.split(',').some((origin) => origin.trim() === '*')) {
    throw new Error('CORS com origem curinga nao e permitido em producao.');
  }
}
