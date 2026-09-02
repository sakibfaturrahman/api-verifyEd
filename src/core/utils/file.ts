import path from 'path';

/** Allowed MIME types for certificate PDFs */
const ALLOWED_MIME_TYPES = ['application/pdf'];

/** Allowed file extensions (lowercase) */
const ALLOWED_EXTENSIONS = ['.pdf'];

/** PDF magic bytes: %PDF- */
const PDF_MAGIC_BYTES = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]);

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates a file buffer to ensure it is actually a PDF.
 * Checks:
 * 1. MIME type (from multer)
 * 2. File extension
 * 3. Magic bytes (actual file content signature)
 * Never trust extension alone.
 */
export function validatePdfFile(
  originalname: string,
  mimetype: string,
  buffer: Buffer,
  maxSize: number,
): FileValidationResult {
  // Check file size
  if (buffer.length > maxSize) {
    return {
      valid: false,
      error: `File size exceeds maximum allowed size of ${Math.round(maxSize / 1024 / 1024)}MB`,
    };
  }

  // Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(mimetype)) {
    return { valid: false, error: 'Only PDF files are allowed' };
  }

  // Check extension
  const ext = path.extname(originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return { valid: false, error: 'File must have .pdf extension' };
  }

  // Check magic bytes — prevents extension spoofing
  if (buffer.length < PDF_MAGIC_BYTES.length) {
    return { valid: false, error: 'File is too small to be a valid PDF' };
  }

  const fileMagic = buffer.slice(0, PDF_MAGIC_BYTES.length);
  if (!fileMagic.equals(PDF_MAGIC_BYTES)) {
    return { valid: false, error: 'File content is not a valid PDF (magic bytes mismatch)' };
  }

  return { valid: true };
}

/**
 * Sanitizes a filename to prevent path traversal attacks.
 */
export function sanitizeFilename(filename: string): string {
  return path
    .basename(filename)
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .substring(0, 255);
}

/**
 * Builds a structured Supabase Storage path.
 * Format: {userId}/{eventId}/{certificateId}/original.pdf
 */
export function buildStoragePath(
  userId: string,
  eventId: string,
  certificateId: string,
  type: 'original' | 'generated',
): string {
  return `${userId}/${eventId}/${certificateId}/${type}.pdf`;
}
