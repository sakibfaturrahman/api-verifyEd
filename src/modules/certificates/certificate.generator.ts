import { PDFDocument, PDFPage, degrees } from 'pdf-lib';
import QRCode from 'qrcode';
import { QrConfig } from './certificate.validation';

export interface GeneratorOptions {
  pdfBuffer: Buffer;
  certificateNumber: string;
  qrToken: string;
  verifyBaseUrl: string;
  qrConfig?: QrConfig;
}

export interface GeneratorResult {
  generatedPdfBuffer: Buffer;
  appliedConfig: QrConfig;
}

/**
 * Default QR placement — bottom-right corner, page 1.
 */
const DEFAULT_QR_CONFIG: QrConfig = {
  x: 450,
  y: 30,
  width: 100,
  height: 100,
  page: 1,
  rotation: 0,
};

/**
 * Generates a QR code image (PNG) as a Buffer.
 * The QR encodes the public verification URL.
 */
async function generateQrCodeImage(verifyUrl: string): Promise<Buffer> {
  const dataUrl = await QRCode.toDataURL(verifyUrl, {
    errorCorrectionLevel: 'H',
    margin: 1,
    width: 300,
    color: {
      dark: '#000000',
      light: '#FFFFFF',
    },
  });

  // Strip the data URL prefix and convert to Buffer
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
  return Buffer.from(base64, 'base64');
}

/**
 * Embeds a QR code onto an existing PDF and returns the modified PDF buffer.
 *
 * Design decisions:
 * - Uses pdf-lib for pure Node.js PDF manipulation (no headless browser)
 * - Coordinates follow PDF coordinate system (origin = bottom-left)
 * - Page numbers are 1-indexed for user-friendliness; converted internally
 */
export async function embedQrCodeInPdf(options: GeneratorOptions): Promise<GeneratorResult> {
  const { pdfBuffer, qrToken, verifyBaseUrl, certificateNumber } = options;
  const config = options.qrConfig ?? DEFAULT_QR_CONFIG;

  // Build the verification URL that the QR will encode
  const verifyUrl = `${verifyBaseUrl}/verify/${qrToken}`;

  // Generate QR code image
  const qrImageBuffer = await generateQrCodeImage(verifyUrl);

  // Load existing PDF
  const pdfDoc = await PDFDocument.load(pdfBuffer);

  // Validate page number
  const pageCount = pdfDoc.getPageCount();
  const pageIndex = Math.min(config.page - 1, pageCount - 1); // Convert to 0-indexed
  const page: PDFPage = pdfDoc.getPage(pageIndex);

  // Embed QR image into PDF
  const qrImage = await pdfDoc.embedPng(qrImageBuffer);

  // Draw QR code on page
  page.drawImage(qrImage, {
    x: config.x,
    y: config.y,
    width: config.width,
    height: config.height,
    rotate: config.rotation !== undefined ? degrees(config.rotation) : undefined,
  });

  // Add certificate metadata to PDF info dict (optional, non-functional)
  pdfDoc.setTitle(`Certificate: ${certificateNumber}`);
  pdfDoc.setKeywords([certificateNumber, qrToken]);

  const generatedPdfBuffer = Buffer.from(await pdfDoc.save());

  return {
    generatedPdfBuffer,
    appliedConfig: { ...config, page: pageIndex + 1 },
  };
}
