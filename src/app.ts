import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";
import pinoHttp from "pino-http";
import swaggerUi from "swagger-ui-express";

import { env, isDev } from "./config/env";
import { swaggerSpec } from "./config/swagger";
import { apiRateLimit } from "./core/middleware/rateLimit.middleware";
import { errorMiddleware } from "./core/middleware/error.middleware";
import apiRouter from "./routes/index";

import { logger } from "./core/utils/logger";

//  Structured Logger
export { logger };

//  Express App
const app = express();

// Security headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"], // Required for Swagger UI
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
      },
    },
  }),
);

// CORS
const allowedOrigins = env.CORS_ORIGIN.split(",").map((o) => o.trim());
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g., mobile apps, curl, Postman)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin '${origin}' not allowed`));
      }
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

// Request parsing — strict size limits
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// HTTP request logging (structured)
app.use(
  pinoHttp({
    logger,
    customLogLevel: (_req, res) => {
      if (res.statusCode >= 500) return "error";
      if (res.statusCode >= 400) return "warn";
      return "info";
    },
    // Don't log health check noise
    autoLogging: { ignore: (req) => req.url === "/health" },
  }),
);

// Global rate limit
app.use("/api", apiRateLimit);

//  Health Check

/**
 * @openapi
 * /health:
 *   get:
 *     tags: [System]
 *     summary: Health check
 *     responses:
 *       200:
 *         description: Service is healthy
 */
app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "verifyed-backend",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
  });
});

/**
 * @openapi
 * /health/database:
 *   get:
 *     tags: [System]
 *     summary: Database connectivity check
 *     responses:
 *       200:
 *         description: Database is reachable
 *       503:
 *         description: Database unreachable
 */
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

//  Swagger UI ──
app.use(
  "/api/docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customSiteTitle: "VerifyEd API Docs",
    customCss: ".swagger-ui .topbar { display: none }",
    swaggerOptions: {
      persistAuthorization: true,
      tryItOutEnabled: true,
    },
  }),
);

// Expose raw OpenAPI JSON spec
app.get("/api/docs.json", (_req: Request, res: Response) => {
  res.setHeader("Content-Type", "application/json");
  res.send(swaggerSpec);
});

//  API Routes
app.use("/api/v1", apiRouter);

//  404 Handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    error: { code: "ROUTE_NOT_FOUND" },
  });
});

//  Centralized Error Handler
app.use(
  errorMiddleware as (
    err: Error,
    req: Request,
    res: Response,
    next: NextFunction,
  ) => void,
);

export default app;
