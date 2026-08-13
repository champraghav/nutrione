import { createApp } from './app';
import { env } from './config/env';
import { connectRedis } from './config/redis';
import { logger } from './utils/logger';

async function main(): Promise<void> {
  await connectRedis();

  const app = createApp();
  app.listen(env.port, () => {
    logger.info(`Health OS API listening on port ${env.port} (${env.nodeEnv})`);
  });
}

main().catch((err) => {
  logger.error({ err }, 'Failed to start server');
  process.exit(1);
});
