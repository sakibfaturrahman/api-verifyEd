import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sha256, compareHashes } from '../src/core/utils/hash';
import { generateSecureToken, generateCertificateNumber } from '../src/core/utils/token';
import { validatePdfFile } from '../src/core/utils/file';
import { parsePagination, buildPaginationMeta } from '../src/core/utils/pagination';

// ─── Hash Utilities ──────────────────────────────────────────────────────────
describe('sha256', () => {
  it('returns a 64-char hex string', () => {
    const hash = sha256(Buffer.from('hello world'));
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  it('produces identical hashes for same input', () => {
    const buf = Buffer.from('test-content');
    expect(sha256(buf)).toBe(sha256(buf));
  });

  it('produces different hashes for different inputs', () => {
    const h1 = sha256(Buffer.from('hello'));
    const h2 = sha256(Buffer.from('world'));
    expect(h1).not.toBe(h2);
  });
});

describe('compareHashes', () => {
  it('returns true for matching hashes', () => {
    const hash = sha256(Buffer.from('test'));
    expect(compareHashes(hash, hash)).toBe(true);
  });

  it('returns false for different hashes', () => {
    const h1 = sha256(Buffer.from('a'));
    const h2 = sha256(Buffer.from('b'));
    expect(compareHashes(h1, h2)).toBe(false);
  });

  it('returns false for different lengths', () => {
    expect(compareHashes('abc', 'abcd')).toBe(false);
  });
});

// ─── Token Utilities ─────────────────────────────────────────────────────────
describe('generateSecureToken', () => {
  it('returns a 64-char hex string by default', () => {
    const token = generateSecureToken();
    expect(token).toHaveLength(64);
    expect(token).toMatch(/^[0-9a-f]+$/);
  });

  it('generates unique tokens each call', () => {
    const tokens = new Set(Array.from({ length: 100 }, () => generateSecureToken()));
    expect(tokens.size).toBe(100);
  });

  it('respects custom byte length', () => {
    const token = generateSecureToken(16);
    expect(token).toHaveLength(32); // 16 bytes * 2 hex chars
  });
});

describe('generateCertificateNumber', () => {
  it('follows CERT-{YYYYMMDD}-{8HEX} format', () => {
    const certNum = generateCertificateNumber();
    expect(certNum).toMatch(/^CERT-\d{8}-[A-F0-9]{8}$/);
  });

  it('generates unique numbers each call', () => {
    const numbers = new Set(Array.from({ length: 1000 }, () => generateCertificateNumber()));
    // Should be unique with high probability (birthday paradox, 1000 vs 4B+ possibilities)
    expect(numbers.size).toBeGreaterThan(990);
  });
});

// ─── File Validation ─────────────────────────────────────────────────────────
describe('validatePdfFile', () => {
  const PDF_MAGIC = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]); // %PDF-1.4
  const maxSize = 10 * 1024 * 1024; // 10MB

  it('accepts a valid PDF file', () => {
    const result = validatePdfFile('cert.pdf', 'application/pdf', PDF_MAGIC, maxSize);
    expect(result.valid).toBe(true);
  });

  it('rejects wrong MIME type', () => {
    const result = validatePdfFile('cert.pdf', 'image/jpeg', PDF_MAGIC, maxSize);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('PDF');
  });

  it('rejects wrong extension', () => {
    const result = validatePdfFile('cert.jpg', 'application/pdf', PDF_MAGIC, maxSize);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('extension');
  });

  it('rejects file with wrong magic bytes (spoofed extension)', () => {
    const fakeContent = Buffer.from('This is not a PDF');
    const result = validatePdfFile('cert.pdf', 'application/pdf', fakeContent, maxSize);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('magic bytes');
  });

  it('rejects oversized file', () => {
    const bigBuffer = Buffer.concat([PDF_MAGIC, Buffer.alloc(maxSize)]); // Over limit
    const result = validatePdfFile('cert.pdf', 'application/pdf', bigBuffer, maxSize);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('size');
  });
});

// ─── Pagination ───────────────────────────────────────────────────────────────
describe('parsePagination', () => {
  it('uses defaults for undefined inputs', () => {
    const { page, limit, offset } = parsePagination(undefined, undefined);
    expect(page).toBe(1);
    expect(limit).toBe(10);
    expect(offset).toBe(0);
  });

  it('parses string numbers', () => {
    const { page, limit, offset } = parsePagination('3', '20');
    expect(page).toBe(3);
    expect(limit).toBe(20);
    expect(offset).toBe(40);
  });

  it('clamps limit to maxLimit', () => {
    const { limit } = parsePagination('1', '999', 100);
    expect(limit).toBe(100);
  });

  it('floors page to 1 for invalid values', () => {
    const { page } = parsePagination('-5', '10');
    expect(page).toBe(1);
  });
});

describe('buildPaginationMeta', () => {
  it('calculates totalPages correctly', () => {
    const meta = buildPaginationMeta(1, 10, 95);
    expect(meta.totalPages).toBe(10); // ceil(95/10) = 10
  });

  it('handles exact division', () => {
    const meta = buildPaginationMeta(1, 10, 100);
    expect(meta.totalPages).toBe(10);
  });

  it('handles single item', () => {
    const meta = buildPaginationMeta(1, 10, 1);
    expect(meta.totalPages).toBe(1);
  });
});
