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

// Keamanan Header HTTP
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

// ── Penanganan CORS ────────────────────────────────────────────────────────
const configuredOrigins = (env.CORS_ORIGIN || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const defaultAllowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:3001",
];

const allAllowedOrigins = [
  ...new Set([...configuredOrigins, ...defaultAllowedOrigins]),
];

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Izinkan request tanpa origin (seperti curl, mobile app, postman)
    if (!origin) {
      return callback(null, true);
    }

    // Izinkan jika ada di list atau merupakan origin localhost/vercel preview
    const isAllowed =
      allAllowedOrigins.includes(origin) ||
      /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ||
      origin.endsWith(".vercel.app");

    if (isAllowed) {
      callback(null, true);
    } else {
      logger.warn({ origin, allAllowedOrigins }, "CORS blocked origin");
      callback(new Error(`Origin ${origin} not allowed by CORS`));
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
  ],
  optionsSuccessStatus: 204,
};

// Gunakan satu middleware cors terpadu (otomatis menangani preflight OPTIONS)
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

// Parsing payload body
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Logging
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

// Pembatasan laju akses (lewati method OPTIONS agar preflight tidak pernah terblokir)
app.use("/api", (req: Request, res: Response, next: NextFunction) => {
  if (req.method === "OPTIONS") return next();
  return apiRateLimit(req, res, next);
});

// Health checks
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

// Swagger docs
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

// Routes
app.use("/api/v1", apiRouter);

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    error: { code: "ROUTE_NOT_FOUND" },
  });
});

// Error handling middleware
app.use(
  errorMiddleware as (
    err: Error,
    req: Request,
    res: Response,
    next: NextFunction,
  ) => void,
);

export default app;
