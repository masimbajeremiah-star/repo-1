const isProduction = process.env.NODE_ENV === 'production';

function csv(value, fallback = '') {
  return String(value || fallback).split(',').map((item) => item.trim()).filter(Boolean);
}

export function loadConfig() {
  const config = {
    isProduction,
    host: process.env.HOST || '0.0.0.0',
    port: Number(process.env.PORT || 3000),
    databaseUrl: process.env.DATABASE_URL || '',
    tokenSecret: process.env.AUTH_TOKEN_SECRET || (isProduction ? '' : 'development-only-change-me'),
    tokenTtlSeconds: Number(process.env.AUTH_TOKEN_TTL_SECONDS || 60 * 60 * 24 * 30),
    allowedOrigins: csv(process.env.ALLOWED_ORIGINS, isProduction ? '' : 'http://localhost:4173,http://127.0.0.1:4173,https://localhost,capacitor://localhost'),
    requireDatabase: process.env.REQUIRE_DATABASE === 'true' || isProduction,
  };

  const errors = [];
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) errors.push('PORT must be a valid TCP port');
  if (!config.tokenSecret || config.tokenSecret.length < 24) errors.push('AUTH_TOKEN_SECRET must contain at least 24 characters');
  if (config.requireDatabase && !config.databaseUrl) errors.push('DATABASE_URL is required');
  if (isProduction && config.allowedOrigins.length === 0) errors.push('ALLOWED_ORIGINS is required in production');
  if (errors.length) throw new Error(`Invalid environment: ${errors.join('; ')}`);
  return config;
}
