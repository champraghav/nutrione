import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { env } from './config/env';
import { logger } from './utils/logger';
import { apiRouter } from './routes';
import { notFoundHandler, errorHandler } from './middleware/error.middleware';
import { apiRateLimit } from './middleware/rateLimit.middleware';

export function createApp(): Express {
  const app = express();

  // Must come before the rate limiter, which reads req.ip.
  if (env.trustProxyHops > 0) app.set('trust proxy', env.trustProxyHops);

  app.use(helmet());
  app.use(cors({ origin: env.corsOrigin }));
  // Generous enough for a base64-encoded meal photo from a phone camera.
  app.use(express.json({ limit: '12mb' }));
  app.use(pinoHttp({ logger }));

  app.get('/health', (_req, res) => {
    res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
  });

  app.use('/api/v1', apiRateLimit, apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
