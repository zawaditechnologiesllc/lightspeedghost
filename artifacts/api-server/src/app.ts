import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pinoHttp from "pino-http";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import router from "./routes";
import { authMiddleware } from "./middlewares/auth";
import { requestLoggerMiddleware } from "./lib/requestLogger";
import { logger } from "./lib/logger";
import { pool } from "@workspace/db";
import { getSystemSettings } from "./lib/systemSettings";

const PgSession = connectPgSimple(session);

const app: Express = express();

// ── Trust Render's proxy — required for express-rate-limit to read real IPs ───
// Render (and most PaaS) sits behind a load balancer that sets X-Forwarded-For.
// Without this, express-rate-limit throws a validation error on every request.
app.set("trust proxy", 1);

// ── Health check — MUST be before CORS so monitoring tools (no Origin header) ─
// don't get rejected. UptimeRobot, Render health checks, etc. send no Origin.
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});
app.head("/api/health", (_req: Request, res: Response) => {
  res.status(200).end();
});

// ── Security headers (helmet) ─────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }),
);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// ── CORS — strict allowlist, never open wildcard ───────────────────────────────
// Build the origin set from ALLOWED_ORIGINS and automatically include
// both the www and non-www variant of every listed domain so the user
// only needs to set one form (e.g. https://example.com is enough to
// also allow https://www.example.com and vice-versa).
const ENV_ORIGINS = new Set<string>();
if (process.env.ALLOWED_ORIGINS) {
  for (const raw of process.env.ALLOWED_ORIGINS.split(",")) {
    const o = raw.trim();
    if (!o) continue;
    ENV_ORIGINS.add(o);
    try {
      const url = new URL(o);
      const host = url.hostname;
      const alt = host.startsWith("www.") ? host.slice(4) : `www.${host}`;
      ENV_ORIGINS.add(`${url.protocol}//${alt}${url.port ? `:${url.port}` : ""}`);
    } catch { /* ignore malformed entries */ }
  }
}

const KNOWN_DEV_ORIGINS = [
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
  /\.replit\.dev$/,
  /\.repl\.co$/,
  /\.vercel\.app$/,
];

app.use(
  cors({
    origin(origin, cb) {
      // Non-browser requests (Postman, curl) have no origin — allow only in dev
      if (!origin) {
        if (process.env.NODE_ENV !== "production") return cb(null, true);
        return cb(new Error("CORS: origin required in production"), false);
      }
      // Explicit allowlist from env var always wins (includes auto-added www variant)
      if (ENV_ORIGINS.has(origin)) return cb(null, true);
      // Dev/Replit/Vercel preview pattern match
      if (KNOWN_DEV_ORIGINS.some((pat) => pat.test(origin))) return cb(null, true);
      cb(new Error(`CORS: origin '${origin}' is not allowed`), false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-admin-password"],
  }),
);

// ── Session ───────────────────────────────────────────────────────────────────
const SESSION_SECRET = process.env.SESSION_SECRET ?? "lsg-dev-secret-change-in-prod";

if (SESSION_SECRET === "lsg-dev-secret-change-in-prod" && process.env.NODE_ENV === "production") {
  logger.error("FATAL: SESSION_SECRET is using the dev default in production. Set a strong random secret in Render environment variables immediately.");
}

app.use(
  session({
    store: new PgSession({
      pool,
      tableName: "user_sessions",
      createTableIfMissing: false,
    }),
    name: "lsg.sid",
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 30 * 24 * 60 * 60 * 1000,
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    },
  }),
);

// ── Global rate limiter — 120 requests/min per IP ─────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please slow down." },
  skip: (req) => req.path === "/api/health",
});
app.use(globalLimiter);

// ── AI route limiter — 20 requests/min per IP (prevents API cost abuse) ───────
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many AI requests. Please wait before trying again." },
});

app.use(
  [
    "/api/writing/generate-stream",
    "/api/writing/outline",
    "/api/humanizer/detect",
    "/api/humanizer/humanize-stream",
    "/api/revision/analyse",
    "/api/revision/submit-stream",
    "/api/stem/solve",
    "/api/study/ask",
    "/api/study/generate",
    "/api/plagiarism/check",
    "/api/plagiarism/humanize",
    "/api/plagiarism/code",
  ],
  aiLimiter,
);

// ── Body parsers — strict size limits ─────────────────────────────────────────
// Webhook routes need raw body for signature verification
app.use(/\/api\/payments\/webhook\//, express.raw({ type: "*/*", limit: "5mb" }));

// File upload routes allow larger bodies
app.use("/api/files", express.json({ limit: "20mb" }));
app.use("/api/files", express.urlencoded({ extended: true, limit: "20mb" }));

// All other routes: tightly limited
app.use((req, _res, next) => {
  if (req.headers["content-type"]?.startsWith("application/json") && !Buffer.isBuffer(req.body)) {
    express.json({ limit: "2mb" })(req, _res, next);
  } else {
    next();
  }
});
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

// ── Auth — resolve userId from session or Bearer JWT ─────────────────────────
app.use(authMiddleware);

// ── Public status endpoint — returns maintenance + signup state ───────────────
// Must be AFTER CORS (so browsers can call it) but BEFORE maintenance middleware
// so the frontend can always reach it regardless of maintenance state.
app.get("/api/status", async (_req: Request, res: Response) => {
  const settings = await getSystemSettings();
  res.json({ maintenance: settings.maintenance_mode, allow_signups: settings.allow_signups });
});

// ── Diagnostic endpoint — env vars check (no secret values exposed) ───────────
app.get("/api/health/config", (_req: Request, res: Response) => {
  const check = (key: string) => !!process.env[key];
  res.json({
    env: process.env.NODE_ENV,
    keys: {
      ANTHROPIC_API_KEY: check("ANTHROPIC_API_KEY"),
      OPENAI_API_KEY: check("OPENAI_API_KEY"),
      SUPABASE_JWT_SECRET: check("SUPABASE_JWT_SECRET"),
      DATABASE_URL: check("DATABASE_URL"),
      SESSION_SECRET: check("SESSION_SECRET"),
      ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS ?? "(not set)",
    },
  });
});

// ── Maintenance mode middleware ────────────────────────────────────────────────
// When maintenance_mode is 'true' in system_settings, block all routes except:
//   /api/health, /api/status, /api/admin/*, /api/payments/webhook/*
const MAINTENANCE_EXEMPT = [
  /^\/api\/health/,
  /^\/api\/status/,
  /^\/api\/admin\//,
  /^\/api\/payments\/webhook\//,
];

app.use(async (req: Request, res: Response, next: NextFunction) => {
  if (MAINTENANCE_EXEMPT.some((pat) => pat.test(req.path))) return next();
  try {
    const { maintenance_mode } = await getSystemSettings();
    if (maintenance_mode) {
      res.status(503).json({
        error: "maintenance",
        message: "The platform is currently undergoing maintenance. Please check back soon.",
      });
      return;
    }
  } catch {
    // If we can't reach the DB, fail open (don't block users)
  }
  next();
});

// ── Request logging ───────────────────────────────────────────────────────────
app.use(requestLoggerMiddleware);

// ── Suppress noisy X-Powered-By header ───────────────────────────────────────
app.disable("x-powered-by");

app.use("/api", router);

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err.message?.startsWith("CORS:")) {
    res.status(403).json({ error: "Forbidden: origin not allowed" });
    return;
  }
  logger.error({ err }, "Unhandled error");
  res.status(500).json({ error: "Internal server error" });
});

export default app;
