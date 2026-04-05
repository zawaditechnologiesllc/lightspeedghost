import type { Request, Response, NextFunction } from "express";
import { pool } from "@workspace/db";

let tablesReady = false;

async function ensureLogTables() {
  if (tablesReady) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS request_logs (
        id        BIGSERIAL PRIMARY KEY,
        method    TEXT,
        path      TEXT,
        status    INT,
        duration_ms INT,
        user_id   TEXT,
        ip        TEXT,
        country   TEXT NOT NULL DEFAULT '??',
        user_agent TEXT,
        error_msg TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS rl_created_idx ON request_logs (created_at DESC);
      CREATE INDEX IF NOT EXISTS rl_country_idx ON request_logs (country);
      CREATE INDEX IF NOT EXISTS rl_user_idx   ON request_logs (user_id);

      CREATE TABLE IF NOT EXISTS api_errors (
        id         BIGSERIAL PRIMARY KEY,
        method     TEXT,
        path       TEXT,
        status     INT,
        user_id    TEXT,
        ip         TEXT,
        country    TEXT,
        error_msg  TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS ae_created_idx ON api_errors (created_at DESC);
    `);
    tablesReady = true;
  } catch {
    /* non-fatal — logging must never crash the app */
  }
}

ensureLogTables();

function getCountry(req: Request): string {
  return (
    (req.headers["cf-ipcountry"] as string | undefined) ??
    (req.headers["x-vercel-ip-country"] as string | undefined) ??
    "??"
  );
}

function getIp(req: Request): string {
  const fwd = req.headers["x-forwarded-for"] as string | undefined;
  return fwd ? fwd.split(",")[0].trim() : (req.ip ?? "unknown");
}

const SKIP = new Set(["/api/healthz", "/api/admin/verify"]);

export function requestLoggerMiddleware(req: Request, res: Response, next: NextFunction) {
  if (SKIP.has(req.path)) return next();

  const start = Date.now();
  const ip = getIp(req);
  const country = getCountry(req);

  res.on("finish", () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const userId = req.userId ?? null;
    const errorMsg = status >= 400 ? (res.locals.errorMessage as string | undefined ?? null) : null;
    const ua = (req.headers["user-agent"] ?? "").slice(0, 250) || null;

    pool.query(
      `INSERT INTO request_logs (method, path, status, duration_ms, user_id, ip, country, user_agent, error_msg)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [req.method, req.path, status, duration, userId, ip, country, ua, errorMsg],
    ).catch(() => {});

    if (status >= 500) {
      pool.query(
        `INSERT INTO api_errors (method, path, status, user_id, ip, country, error_msg)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [req.method, req.path, status, userId, ip, country, errorMsg],
      ).catch(() => {});
    }
  });

  next();
}
