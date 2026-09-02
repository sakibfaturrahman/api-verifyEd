import dns from 'node:dns';

// Force IPv4 first to prevent Supabase fetch failed on Node.js / Windows
dns.setDefaultResultOrder('ipv4first');

import app, { logger } from './app';
import { env } from './config/env';

const server = app.listen(env.PORT, () => {
  logger.info(
    {
      port: env.PORT,
      env: env.NODE_ENV,
      docs: `http://localhost:${env.PORT}/api/docs`,
    },
    '🚀 VerifyEd Backend started',
  );
});

// ─── Graceful Shutdown ────────────────────────────────────────────────────────

function gracefulShutdown(signal: string) {
  logger.info({ signal }, 'Shutdown signal received, closing server gracefully...');

  server.close((err) => {
    if (err) {
      logger.error({ err }, 'Error during server close');
      process.exit(1);
    }

    logger.info('Server closed successfully');
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10_000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors — log and exit (let process manager restart)
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception — shutting down');
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.fatal({ reason }, 'Unhandled promise rejection — shutting down');
  process.exit(1);
});

export default server;