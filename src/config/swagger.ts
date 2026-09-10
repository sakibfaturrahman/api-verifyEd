import path from "path";
import swaggerJsdoc from "swagger-jsdoc";
import { env } from "./env";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.3",
    info: {
      title: "VerifyEd API",
      version: "1.0.0",
      description: `
# VerifyEd Backend API

VerifyEd adalah platform penerbitan dan verifikasi sertifikat digital berbasis cryptographic verification.
API ini memungkinkan client/organisasi untuk:
- Menerbitkan dan mengelola sertifikat digital
- Generate QR code untuk validasi instan
- Memverifikasi keaslian dokumen via Certificate Number, QR Token, atau upload file PDF

## Authentication

Semua protected endpoint mewajibkan token Bearer pada header \`Authorization\`:
\`\`\`text
Authorization: Bearer <supabase-access-token>
\`\`\`

Dapatkan access token melalui endpoint \`POST /api/v1/auth/login\`.

## Pagination

Semua list endpoint mendukung pagination via query parameter:
- \`page\` (default: 1)
- \`limit\` (default: 10, max: 100)

Response payload menyertakan metadata pagination pada object \`meta\`.

## Verification Methods

| Method | Endpoint | Authentication |
|--------|----------|----------------|
| Certificate Number | GET /api/v1/verify/certificate/:num | Public (None) |
| QR Token | GET /api/v1/verify/qr/:token | Public (None) |
| PDF Upload | POST /api/v1/verify/pdf | Public (None) |

## Error Codes

| Code | HTTP Status / Deskripsi |
|------|-------------------------|
| UNAUTHORIZED | Access token missing, expired, atau invalid |
| FORBIDDEN | Insufficient permissions / hak akses ditolak |
| NOT_FOUND | Resource yang diminta tidak ditemukan |
| VALIDATION_ERROR | Request body / query parameter validation failed |
| CONFLICT | Duplicate entry / data sudah terdaftar |
| CERTIFICATE_NOT_FOUND | Sertifikat tidak terdaftar di database |
| CERTIFICATE_REVOKED | Sertifikat telah dicabut (revoked) |
| INTEGRITY_MISMATCH | File hash PDF tidak cocok dengan cryptographic hash tersimpan |
| ACCOUNT_INACTIVE | Akun user dinonaktifkan (suspended) |
      `,
      contact: {
        name: "VerifyEd API Support",
        email: "support@verifyed.io",
      },
      license: {
        name: "MIT",
      },
    },
    servers: [
      {
        url: "https://api-verifyed.vercel.app",
        description: "Production Server (Vercel)",
      },
      {
        url: `http://localhost:${env.PORT || 5000}`,
        description: "Local Development Server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description:
            "Supabase JWT access token diperoleh dari /api/v1/auth/login",
        },
      },
      schemas: {
        SuccessResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            message: {
              type: "string",
              example: "Operation completed successfully",
            },
            data: { type: "object" },
          },
        },
        ErrorResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            message: { type: "string", example: "Internal server error" },
            error: {
              type: "object",
              properties: {
                code: { type: "string", example: "NOT_FOUND" },
              },
            },
          },
        },
        ValidationErrorResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            message: { type: "string", example: "Validation failed" },
            errors: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  field: { type: "string", example: "email" },
                  message: { type: "string", example: "Invalid email format" },
                },
              },
            },
          },
        },
        PaginationMeta: {
          type: "object",
          properties: {
            page: { type: "integer", example: 1 },
            limit: { type: "integer", example: 10 },
            total: { type: "integer", example: 100 },
            totalPages: { type: "integer", example: 10 },
          },
        },
        Profile: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string", example: "John Doe" },
            email: { type: "string", format: "email" },
            phone: { type: "string", nullable: true },
            address: { type: "string", nullable: true },
            description: { type: "string", nullable: true },
            avatarUrl: { type: "string", nullable: true },
            role: { type: "string", enum: ["admin", "user"] },
            status: { type: "string", enum: ["active", "inactive"] },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        Event: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            userId: { type: "string", format: "uuid" },
            name: { type: "string", example: "Web Development Bootcamp 2024" },
            organizer: { type: "string", example: "Tech Academy" },
            description: { type: "string", nullable: true },
            eventDate: { type: "string", format: "date" },
            location: { type: "string", nullable: true },
            status: { type: "string", enum: ["draft", "ongoing", "completed"] },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        Certificate: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            eventId: { type: "string", format: "uuid" },
            certificateNumber: {
              type: "string",
              example: "CERT-20240101-A1B2C3D4",
            },
            recipientName: { type: "string", example: "Jane Smith" },
            fileHash: { type: "string", example: "sha256hexhash..." },
            qrToken: { type: "string", example: "abc123..." },
            qrConfig: {
              type: "object",
              nullable: true,
              properties: {
                x: { type: "number" },
                y: { type: "number" },
                width: { type: "number" },
                height: { type: "number" },
                page: { type: "integer" },
              },
            },
            status: { type: "string", enum: ["active", "revoked"] },
            issuedAt: { type: "string", format: "date-time" },
            revokedAt: { type: "string", format: "date-time", nullable: true },
            revokeReason: { type: "string", nullable: true },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        VerificationResult: {
          type: "object",
          properties: {
            status: {
              type: "string",
              enum: ["verified", "revoked", "not_found"],
              example: "verified",
            },
            certificate: {
              type: "object",
              nullable: true,
              properties: {
                certificateNumber: { type: "string" },
                recipientName: { type: "string" },
                event: { type: "string" },
                organization: { type: "string" },
                issuedAt: { type: "string", format: "date-time" },
                documentIntegrity: {
                  type: "string",
                  enum: ["valid", "invalid", "not_checked"],
                },
                revokedAt: {
                  type: "string",
                  format: "date-time",
                  nullable: true,
                },
                revokeReason: { type: "string", nullable: true },
              },
            },
          },
        },
      },
    },
    tags: [
      { name: "System", description: "Health check dan system status" },
      {
        name: "Auth",
        description:
          "Authentication — sign up, sign in, sign out, dan session management",
      },
      { name: "Profile", description: "User profile management" },
      {
        name: "Events",
        description: "Event CRUD dan grouping sertifikat",
      },
      {
        name: "Certificates",
        description:
          "Certificate lifecycle management (issuing, batching, revoking)",
      },
      {
        name: "Verification",
        description: "Public certificate verification (tanpa autentikasi)",
      },
      { name: "Dashboard", description: "User analytics and metrics" },
      { name: "Admin", description: "Admin-only management endpoints" },
    ],
  },
  // Menggunakan path absolut runtime yang mencakup modul routes & controllers
  apis: [
    path.join(process.cwd(), "src/**/*.routes.ts"),
    path.join(process.cwd(), "src/**/*.controller.ts"),
    path.join(process.cwd(), "src/app.ts"),
    path.join(__dirname, "../**/*.routes.{ts,js}"),
    path.join(__dirname, "../**/*.controller.{ts,js}"),
    path.join(__dirname, "../app.{ts,js}"),
  ],
};

export const swaggerSpec = swaggerJsdoc(options);
