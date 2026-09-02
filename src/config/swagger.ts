import swaggerJsdoc from 'swagger-jsdoc';
import { env } from './env';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'VerifyEd API',
      version: '1.0.0',
      description: `
# VerifyEd Backend API

VerifyEd is a digital certificate issuance and verification platform. 
This API allows organizations to:
- Issue and manage digital certificates
- Generate QR codes for certificates
- Verify certificate authenticity via Certificate ID, QR code, or PDF upload

## Authentication

All protected endpoints require a Bearer token in the Authorization header:
\`\`\`
Authorization: Bearer <supabase-access-token>
\`\`\`

Obtain a token via \`POST /api/v1/auth/login\`.

## Pagination

List endpoints support:
- \`page\` (default: 1)
- \`limit\` (default: 10, max: 100)

Response includes a \`meta\` object with pagination info.

## Verification Methods

| Method | Endpoint | Auth Required |
|--------|----------|---------------|
| Certificate Number | GET /api/v1/verify/certificate/:num | No |
| QR Token | GET /api/v1/verify/qr/:token | No |
| PDF Upload | POST /api/v1/verify/pdf | No |

## Error Codes

| Code | Meaning |
|------|---------|
| UNAUTHORIZED | Missing or invalid token |
| FORBIDDEN | Insufficient permissions |
| NOT_FOUND | Resource not found |
| VALIDATION_ERROR | Request validation failed |
| CONFLICT | Duplicate resource |
| CERTIFICATE_NOT_FOUND | Certificate does not exist |
| CERTIFICATE_REVOKED | Certificate has been revoked |
| INTEGRITY_MISMATCH | PDF hash does not match stored hash |
| ACCOUNT_INACTIVE | User account is deactivated |
      `,
      contact: {
        name: 'VerifyEd API Support',
        email: 'support@verifyed.io',
      },
      license: {
        name: 'MIT',
      },
    },
    servers: [
      {
        url: `http://localhost:${env.PORT}`,
        description: 'Development server',
      },
      {
        url: 'https://api.verifyed.io',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Supabase Access Token obtained from /api/v1/auth/login',
        },
      },
      schemas: {
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Operation successful' },
            data: { type: 'object' },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'Something went wrong' },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string', example: 'NOT_FOUND' },
              },
            },
          },
        },
        ValidationErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'Validation failed' },
            errors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string', example: 'email' },
                  message: { type: 'string', example: 'Invalid email address' },
                },
              },
            },
          },
        },
        PaginationMeta: {
          type: 'object',
          properties: {
            page: { type: 'integer', example: 1 },
            limit: { type: 'integer', example: 10 },
            total: { type: 'integer', example: 100 },
            totalPages: { type: 'integer', example: 10 },
          },
        },
        Profile: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string', example: 'John Doe' },
            email: { type: 'string', format: 'email' },
            phone: { type: 'string', nullable: true },
            address: { type: 'string', nullable: true },
            description: { type: 'string', nullable: true },
            avatarUrl: { type: 'string', nullable: true },
            role: { type: 'string', enum: ['admin', 'user'] },
            status: { type: 'string', enum: ['active', 'inactive'] },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Event: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid' },
            name: { type: 'string', example: 'Web Development Bootcamp 2024' },
            organizer: { type: 'string', example: 'Tech Academy' },
            description: { type: 'string', nullable: true },
            eventDate: { type: 'string', format: 'date' },
            location: { type: 'string', nullable: true },
            status: { type: 'string', enum: ['draft', 'ongoing', 'completed'] },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Certificate: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            eventId: { type: 'string', format: 'uuid' },
            certificateNumber: { type: 'string', example: 'CERT-20240101-A1B2C3D4' },
            recipientName: { type: 'string', example: 'Jane Smith' },
            fileHash: { type: 'string', example: 'sha256hexhash...' },
            qrToken: { type: 'string', example: 'abc123...' },
            qrConfig: {
              type: 'object',
              nullable: true,
              properties: {
                x: { type: 'number' },
                y: { type: 'number' },
                width: { type: 'number' },
                height: { type: 'number' },
                page: { type: 'integer' },
              },
            },
            status: { type: 'string', enum: ['active', 'revoked'] },
            issuedAt: { type: 'string', format: 'date-time' },
            revokedAt: { type: 'string', format: 'date-time', nullable: true },
            revokeReason: { type: 'string', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        VerificationResult: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['verified', 'revoked', 'not_found'],
              example: 'verified',
            },
            certificate: {
              type: 'object',
              nullable: true,
              properties: {
                certificateNumber: { type: 'string' },
                recipientName: { type: 'string' },
                event: { type: 'string' },
                organization: { type: 'string' },
                issuedAt: { type: 'string', format: 'date-time' },
                documentIntegrity: {
                  type: 'string',
                  enum: ['valid', 'invalid', 'not_checked'],
                },
                revokedAt: { type: 'string', format: 'date-time', nullable: true },
                revokeReason: { type: 'string', nullable: true },
              },
            },
          },
        },
      },
    },
    tags: [
      { name: 'System', description: 'Health checks and system info' },
      { name: 'Auth', description: 'Authentication — register, login, logout, session' },
      { name: 'Profile', description: 'User profile management' },
      { name: 'Events', description: 'Event CRUD for certificate grouping' },
      { name: 'Certificates', description: 'Certificate lifecycle management' },
      { name: 'Verification', description: 'Public certificate verification (no auth required)' },
      { name: 'Dashboard', description: 'User statistics and analytics' },
      { name: 'Admin', description: 'Admin-only management endpoints' },
    ],
  },
  apis: ['./src/**/*.routes.ts', './src/**/*.controller.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
