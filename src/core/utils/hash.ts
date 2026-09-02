import crypto from 'crypto';

/**
 * Calculates the SHA-256 hash of a buffer.
 * Used for certificate PDF integrity checking.
 * @param buffer - File content as Buffer
 * @returns Hex-encoded SHA-256 hash string
 */
export function sha256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Compares two hash strings in constant time to prevent timing attacks.
 */
export function compareHashes(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}
