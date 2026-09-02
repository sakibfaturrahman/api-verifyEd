import pino from 'pino';
import { env, isDev } from '../../config/env';

export const logger = pino({
  level: env.LOG_LEVEL as pino.LevelWithSilent,
  transport: isDev
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } }
    : undefined,
  redact: {
    // Never log secrets
    paths: [
      'req.headers.authorization',
      'body.password',
      'body.currentPassword',
      'body.newPassword',
      'body.accessToken',
      'body.refreshToken',
    ],
    censor: '[REDACTED]',
  },
});
