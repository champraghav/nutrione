import Redis from 'ioredis';
import { env } from './env';
import { logger } from '../utils/logger';

export const redis = new Redis(env.redisUrl, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

redis.on('error', (err) => {
  logger.warn({ err: err.message }, 'Redis connection error');
});

export async function connectRedis(): Promise<void> {
  try {
    await redis.connect();
    logger.info('Connected to Redis');
  } catch (err) {
    logger.warn({ err }, 'Could not connect to Redis; continuing without cache');
  }
}
