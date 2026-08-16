const isProduction = process.env.NODE_ENV === 'production';

export const BUILTIN_CLIENT_ORIGINS = Object.freeze([
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  'http://localhost:4175',
  'http://127.0.0.1:4175',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://localhost',
  'capacitor://localhost',
]);

function csv(value, fallback = '') {
  return String(value || fallback).split(',').map((item) => item.trim()).filter(Boolean);
}

export function loadConfig() {
  const configuredOrigins = csv(process.env.ALLOWED_ORIGINS);
  const config = {
    isProduction,
    host: process.env.HOST || '0.0.0.0',
    port: Number(process.env.PORT || 3000),
    databaseUrl: process.env.DATABASE_URL || '',
    tokenSecret: process.env.AUTH_TOKEN_SECRET || (isProduction ? '' : 'development-only-change-me'),
    tokenTtlSeconds: Number(process.env.AUTH_TOKEN_TTL_SECONDS || 60 * 60 * 24 * 30),
    // Keep production web origins environment-controlled while always allowing
    // the exact Vite and Capacitor origins used by supported clients.
    allowedOrigins: [...new Set([...configuredOrigins, ...BUILTIN_CLIENT_ORIGINS])],
    requireDatabase: process.env.REQUIRE_DATABASE === 'true' || isProduction,
    mpesa: {
      environment: process.env.MPESA_ENV || 'sandbox',
      consumerKey: process.env.MPESA_CONSUMER_KEY || '',
      consumerSecret: process.env.MPESA_CONSUMER_SECRET || '',
      shortCode: process.env.MPESA_SHORTCODE || '',
      passkey: process.env.MPESA_PASSKEY || '',
      callbackUrl: process.env.MPESA_CALLBACK_URL || '',
    },
  };

  const errors = [];
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) errors.push('PORT must be a valid TCP port');
  if (!config.tokenSecret || config.tokenSecret.length < 24) errors.push('AUTH_TOKEN_SECRET must contain at least 24 characters');
  if (config.requireDatabase && !config.databaseUrl) errors.push('DATABASE_URL is required');
  if (isProduction && configuredOrigins.length === 0) errors.push('ALLOWED_ORIGINS is required in production');
  if (!['sandbox', 'production'].includes(config.mpesa.environment)) errors.push('MPESA_ENV must be sandbox or production');
  if (errors.length) throw new Error(`Invalid environment: ${errors.join('; ')}`);
  return config;
}
