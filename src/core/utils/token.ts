import crypto from 'crypto';
import { format } from 'util';

/**
 * Generates a cryptographically secure random token.
 * Uses crypto.randomBytes — never Math.random.
 * @param bytes - Number of random bytes (default: 32 → 64 hex chars)
 * @returns Hex-encoded random string
 */
export function generateSecureToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Generates a human-readable certificate number.
 * Format: CERT-{YYYYMMDD}-{8-char-uppercase-hex}
 * Example: CERT-20240101-A1B2C3D4
 *
 * Properties:
 * - Not sequential (not guessable via increment)
 * - Human-readable for customer support
 * - Unique enough for practical use (birthday collision unlikely until ~millions)
 */
export function generateCertificateNumber(): string {
  const date = new Date();
  const datePart = format(
    '%s%s%s',
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  );
  const randomPart = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `CERT-${datePart}-${randomPart}`;
}
