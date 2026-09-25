import { PDFDocument, PDFPage, degrees } from "pdf-lib";
import QRCode from "qrcode";
import { QrConfig } from "./certificate.validation";

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

const DEFAULT_QR_CONFIG: QrConfig = {
  x: 450,
  y: 30,
  width: 100,
  height: 100,
  page: 1,
  rotation: 0,
};

async function generateQrCodeImage(verifyUrl: string): Promise<Buffer> {
  // Langsung dapatkan PNG Buffer tanpa konversi base64 string
  return QRCode.toBuffer(verifyUrl, {
    type: "png",
    errorCorrectionLevel: "H",
    margin: 1,
    width: 300,
    color: {
      dark: "#000000",
      light: "#FFFFFF",
    },
  });
}

export async function embedQrCodeInPdf(
  options: GeneratorOptions,
): Promise<GeneratorResult> {
  const { pdfBuffer, qrToken, verifyBaseUrl, certificateNumber } = options;
  const config = options.qrConfig ?? DEFAULT_QR_CONFIG;

  const verifyUrl = `${verifyBaseUrl}/verify/${qrToken}`;
  const qrImageBuffer = await generateQrCodeImage(verifyUrl);

  // Tambahkan ignoreEncryption agar file template dengan proteksi izin tetap bisa dimodifikasi
  const pdfDoc = await PDFDocument.load(pdfBuffer, {
    ignoreEncryption: true,
  });

  const pageCount = pdfDoc.getPageCount();
  const pageIndex = Math.min(Math.max((config.page || 1) - 1, 0), pageCount - 1);
  const page: PDFPage = pdfDoc.getPage(pageIndex);

  const qrImage = await pdfDoc.embedPng(qrImageBuffer);

  page.drawImage(qrImage, {
    x: config.x,
    y: config.y,
    width: config.width,
    height: config.height,
    rotate: config.rotation !== undefined ? degrees(config.rotation) : undefined,
  });

  pdfDoc.setTitle(`Certificate: ${certificateNumber}`);
  pdfDoc.setKeywords([certificateNumber, qrToken]);

  const generatedPdfBuffer = Buffer.from(await pdfDoc.save());

  return {
    generatedPdfBuffer,
    appliedConfig: { ...config, page: pageIndex + 1 },
  };
}