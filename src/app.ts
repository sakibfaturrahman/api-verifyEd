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

export { logger };

const app = express();

const SWAGGER_CDN = "https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0";

app.use(
  helmet({
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

// daftar origin yang diizinkan
const configuredOrigins = (env.CORS_ORIGIN || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

// selalu izinkan localhost pada mode pengembangan atau jika list kosong
const allowedOrigins = [
  ...configuredOrigins,
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // izinkan permintaan tanpa header origin (seperti curl, mobile app, postman)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn({ origin, allowedOrigins }, "cors blocked origin");
      callback(null, false);
    }
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
  ],
  credentials: true,
  optionsSuccessStatus: 200,
};

// pasang middleware cors dan tangani preflight options ke seluruh rute
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

// parsing payload request
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// pencatatan log request http
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

// pembatasan laju global
app.use("/api", apiRateLimit);

// pemeriksaan kesehatan server
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

// dokumentasi swagger ui
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

// rute utama api
app.use("/api/v1", apiRouter);

// penanganan 404
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    error: { code: "ROUTE_NOT_FOUND" },
  });
});

// penanganan error terpusat
app.use(
  errorMiddleware as (
    err: Error,
    req: Request,
    res: Response,
    next: NextFunction,
  ) => void,
);

export default app;
