import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";
import pinoHttp from "pino-http";
import swaggerUi from "swagger-ui-express";

import { env } from "./config/env";
import { swaggerSpec } from "./config/swagger";
import { apiRateLimit } from "./core/middleware/rateLimit.middleware";
import { errorMiddleware } from "./core/middleware/error.middleware";
import apiRouter from "./routes/index";
import { logger } from "./core/utils/logger";

export { logger };

const app = express();

const SWAGGER_CDN = "https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0";

// ── 1. Penanganan CORS & Preflight OPTIONS (Wajib di urutan pertama) ──────────
const configuredOrigins = (env.CORS_ORIGIN || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const defaultAllowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3001",
];

const allAllowedOrigins = [
  ...new Set([...configuredOrigins, ...defaultAllowedOrigins]),
];

// Helper validasi origin
function isOriginAllowed(origin?: string): boolean {
  if (!origin) return true; // Server-to-server, Postman, curl
  if (allAllowedOrigins.includes(origin)) return true;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
  if (origin.endsWith(".vercel.app")) return true;
  return false;
}

// Interceptor manual: Pastikan header CORS selalu terpasang untuk origin yang valid
app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;

  if (isOriginAllowed(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Requested-With, Accept, Origin, X-CSRF-Token",
    );
  }

  // Jika preflight request, segera akhiri dengan status 204 No Content
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  next();
});

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      logger.warn({ origin, allAllowedOrigins }, "CORS blocked origin");
      callback(null, false); // Jangan lempar new Error() agar tidak menjadi 500 crash
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "Origin",
    "X-CSRF-Token",
  ],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

// ── 2. Security Headers (Helmet) ─────────────────────────────────────────────
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://cdnjs.cloudflare.com",
        ],
        styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
        imgSrc: ["'self'", "data:", "https://validator.swagger.io"],
      },
    },
  }),
);

// ── 3. Parsing Payload Body ──────────────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ── 4. Logging ───────────────────────────────────────────────────────────────
app.use(
  pinoHttp({
    logger,
    customLogLevel: (_req, res) => {
      if (res.statusCode >= 500) return "error";
      if (res.statusCode >= 400) return "warn";
      return "info";
    },
    autoLogging: { ignore: (req) => req.url === "/health" },
  }),
);

// ── 5. Rate Limiting ─────────────────────────────────────────────────────────
app.use("/api", (req: Request, res: Response, next: NextFunction) => {
  if (req.method === "OPTIONS") return next();
  return apiRateLimit(req, res, next);
});

// ── 6. Health Checks ─────────────────────────────────────────────────────────
app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "verifyed-backend",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
  });
});

app.get("/health/database", async (_req: Request, res: Response) => {
  const { checkDatabaseConnection } = await import("./config/supabase");
  const isConnected = await checkDatabaseConnection();
  const statusCode = isConnected ? 200 : 503;
  res.status(statusCode).json({
    status: isConnected ? "ok" : "error",
    database: isConnected ? "connected" : "unreachable",
    timestamp: new Date().toISOString(),
  });
});

// ── 7. Swagger Documentation ─────────────────────────────────────────────────
app.use(
  "/api/docs",
  swaggerUi.serveFiles(swaggerSpec, {
    customCssUrl: `${SWAGGER_CDN}/swagger-ui.min.css`,
    customJs: [
      `${SWAGGER_CDN}/swagger-ui-bundle.min.js`,
      `${SWAGGER_CDN}/swagger-ui-standalone-preset.min.js`,
    ],
  }),
  swaggerUi.setup(swaggerSpec, {
    customSiteTitle: "VerifyEd API Docs",
    customCss: ".swagger-ui .topbar { display: none }",
    customCssUrl: `${SWAGGER_CDN}/swagger-ui.min.css`,
    customJs: [
      `${SWAGGER_CDN}/swagger-ui-bundle.min.js`,
      `${SWAGGER_CDN}/swagger-ui-standalone-preset.min.js`,
    ],
    swaggerOptions: {
      persistAuthorization: true,
      tryItOutEnabled: true,
    },
  }),
);

app.get("/api/docs.json", (_req: Request, res: Response) => {
  res.setHeader("Content-Type", "application/json");
  res.send(swaggerSpec);
});

// ── 8. Routes ────────────────────────────────────────────────────────────────
app.use("/api/v1", apiRouter);

// ── 9. Not Found & Error Handlers ────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    error: { code: "ROUTE_NOT_FOUND" },
  });
});

app.use(
  errorMiddleware as (
    err: Error,
    req: Request,
    res: Response,
    next: NextFunction,
  ) => void,
);

export default app;
