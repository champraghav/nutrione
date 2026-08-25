import dotenv from 'dotenv';

dotenv.config();

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const isProduction = (process.env.NODE_ENV ?? 'development') === 'production';

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),

  databaseUrl: required('DATABASE_URL', 'postgres://health_os:health_os@localhost:5432/health_os'),
  redisUrl: required('REDIS_URL', 'redis://localhost:6379'),

  jwtAccessSecret: required('JWT_ACCESS_SECRET', 'dev-access-secret'),
  jwtRefreshSecret: required('JWT_REFRESH_SECRET', 'dev-refresh-secret'),
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '30d',

  ollamaUrl: process.env.OLLAMA_URL ?? 'http://localhost:11434',
  ollamaModel: process.env.OLLAMA_MODEL ?? 'mistral',

  // Photo-based food recognition (optional; the feature reports itself as
  // unconfigured rather than erroring when the key is absent).
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
  visionModel: process.env.VISION_MODEL ?? 'claude-sonnet-4-5-20250929',
  // Overridable so the API can be pointed at a compatible proxy or gateway.
  anthropicApiUrl: process.env.ANTHROPIC_API_URL ?? 'https://api.anthropic.com/v1/messages',

  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',

  /**
   * Request budgets per 15-minute window. Production values are deliberately
   * tight; development gets a generous ceiling because a browser-driven test
   * pass legitimately makes hundreds of calls a minute and being locked out of
   * your own dev server for 15 minutes is pure friction.
   */
  /**
   * How many reverse proxies sit in front of this app.
   *
   * Behind one (Render, Heroku, Fly, most load balancers) every request
   * arrives from the proxy's address, so without this the rate limiter sees a
   * single client and its per-IP budget becomes a global one — twenty sign-in
   * attempts across the entire user base, then nobody can log in.
   *
   * Deliberately a hop count rather than `true`: trusting every proxy lets a
   * client set its own X-Forwarded-For and walk straight past the limit.
   */
  trustProxyHops: Number(process.env.TRUST_PROXY_HOPS ?? (isProduction ? 1 : 0)),

  rateLimitApi: Number(process.env.RATE_LIMIT_API ?? (isProduction ? 300 : 10000)),
  rateLimitAuth: Number(process.env.RATE_LIMIT_AUTH ?? (isProduction ? 20 : 500)),
};
