import express, { type Express } from "express";
import cors from "cors";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pinoHttp from "pino-http";
import router from "./routes";
import { authMiddleware } from "./middlewares/auth";
import { requestLoggerMiddleware } from "./lib/requestLogger";
import { logger } from "./lib/logger";
import { pool } from "@workspace/db";

const PgSession = connectPgSimple(session);

const SESSION_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS "user_sessions" (
    "sid" varchar NOT NULL COLLATE "default",
    "sess" json NOT NULL,
    "expire" timestamp(6) NOT NULL
  )
  WITH (OIDS=FALSE);
  ALTER TABLE "user_sessions" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE;
  CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "user_sessions" ("expire");
`;

pool.query(SESSION_TABLE_SQL).catch(() => {});

const app: Express = express();

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

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : true;

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
);

const SESSION_SECRET = process.env.SESSION_SECRET ?? "lsg-dev-secret-change-in-prod";

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

// Webhook routes need raw body for signature verification
app.use(/\/api\/payments\/webhook\//, express.raw({ type: "*/*", limit: "5mb" }));

// All other routes use JSON
app.use((req, _res, next) => {
  if (req.headers["content-type"]?.startsWith("application/json") && !Buffer.isBuffer(req.body)) {
    express.json()(req, _res, next);
  } else {
    next();
  }
});
app.use(express.urlencoded({ extended: true }));

// Attach userId from session or Bearer JWT on every request
app.use(authMiddleware);

// Log every API request for admin analytics
app.use(requestLoggerMiddleware);

app.use("/api", router);

export default app;
