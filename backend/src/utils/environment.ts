const insecureSecrets = new Set([
  'replace_with_a_random_secret_at_least_32_characters',
  'pelita-admin-secret-2026-32-characters-minimum',
]);

export function validateEnvironment(env: NodeJS.ProcessEnv = process.env) {
  const secret = env.JWT_SECRET;
  if (!secret || secret.length < 32 || insecureSecrets.has(secret.toLowerCase())) {
    throw new Error('JWT_SECRET must be a unique secret containing at least 32 characters.');
  }

  if (!env.DATABASE_URL) throw new Error('DATABASE_URL must be configured.');
  let databaseUrl: URL;
  try {
    databaseUrl = new URL(env.DATABASE_URL);
  } catch {
    throw new Error('DATABASE_URL must be a valid MySQL connection URL.');
  }
  if (databaseUrl.protocol !== 'mysql:' && databaseUrl.protocol !== 'mysqls:') {
    throw new Error('DATABASE_URL must use the mysql:// or mysqls:// protocol.');
  }

  const port = Number(env.PORT ?? 4000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer between 1 and 65535.');

  const origins = (env.FRONTEND_ORIGIN ?? 'http://localhost:3000').split(',').map((origin) => origin.trim());
  if (!origins.length || origins.some((origin) => {
    try {
      const parsed = new URL(origin);
      return !['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== origin;
    } catch {
      return true;
    }
  })) {
    throw new Error('FRONTEND_ORIGIN must contain comma-separated origins without paths.');
  }

  const trustProxy = env.TRUST_PROXY?.trim();
  if (trustProxy && (!/^\d+$/.test(trustProxy) || Number(trustProxy) > 10)) {
    throw new Error('TRUST_PROXY must be an integer between 0 and 10 when set.');
  }

  if (env.NODE_ENV === 'production') {
    if (origins.some((origin) => !origin.startsWith('https://'))) {
      throw new Error('FRONTEND_ORIGIN must use HTTPS in production.');
    }
    if (origins.some((origin) => ['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname))) {
      throw new Error('FRONTEND_ORIGIN must not use a loopback host in production.');
    }
    if (['localhost', '127.0.0.1', '::1', '[::1]'].includes(databaseUrl.hostname)) {
      throw new Error('DATABASE_URL must point to a non-local database in production.');
    }
  }

  return { port, origins, trustProxy: trustProxy ? Number(trustProxy) : false };
}
