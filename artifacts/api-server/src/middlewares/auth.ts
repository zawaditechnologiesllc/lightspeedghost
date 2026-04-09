import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import jwksRsa from "jwks-rsa";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userEmail?: string;
    }
  }
}

declare module "express-session" {
  interface SessionData {
    userId?: string;
    userEmail?: string;
  }
}

const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET;
const SUPABASE_URL = process.env.SUPABASE_URL;

if (!SUPABASE_JWT_SECRET) {
  console.error(
    "[auth] FATAL: SUPABASE_JWT_SECRET env var is not set. " +
    "Bearer JWT authentication will be disabled until this is configured. " +
    "Set it in your Render environment variables (Supabase → Project Settings → API → JWT Secret).",
  );
}

interface SupabaseJwtPayload {
  sub?: string;
  email?: string;
  exp?: number;
  iat?: number;
  role?: string;
}

// ── JWKS client for RS256 tokens (Supabase's new JWT Signing Keys) ─────────────
let jwksClient: jwksRsa.JwksClient | null = null;

function getJwksClient(): jwksRsa.JwksClient | null {
  if (jwksClient) return jwksClient;
  const url = SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  if (!url) return null;
  jwksClient = jwksRsa({
    jwksUri: `${url}/auth/v1/.well-known/jwks.json`,
    cache: true,
    cacheMaxAge: 10 * 60 * 1000, // 10 minutes
    rateLimit: true,
  });
  return jwksClient;
}

function getSigningKey(kid: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = getJwksClient();
    if (!client) return reject(new Error("JWKS client unavailable — SUPABASE_URL not set"));
    client.getSigningKey(kid, (err, key) => {
      if (err || !key) return reject(err ?? new Error("Signing key not found"));
      resolve(key.getPublicKey());
    });
  });
}

/**
 * Verifies a Supabase JWT.
 *
 * Supports both:
 *   - HS256 (Legacy JWT Secret) — verified with SUPABASE_JWT_SECRET
 *   - RS256 (JWT Signing Keys)  — verified via Supabase's JWKS endpoint
 *
 * Development: falls back to jwt.decode() (no signature check) when
 *   SUPABASE_JWT_SECRET is missing and NODE_ENV !== "production".
 */
async function verifyJwt(token: string): Promise<SupabaseJwtPayload | null> {
  // Peek at the header to determine algorithm without verifying yet
  let header: { alg?: string; kid?: string } = {};
  try {
    const decoded = jwt.decode(token, { complete: true });
    if (decoded && typeof decoded === "object") {
      header = decoded.header as { alg?: string; kid?: string };
    }
  } catch {
    // ignore — invalid token
  }

  const alg = header.alg ?? "HS256";

  // ── RS256: use Supabase's JWKS endpoint ──────────────────────────────────
  if (alg === "RS256") {
    const kid = header.kid;
    if (!kid) {
      console.error("[auth] RS256 token missing 'kid' header — cannot fetch signing key");
      return null;
    }
    try {
      const publicKey = await getSigningKey(kid);
      return jwt.verify(token, publicKey, { algorithms: ["RS256"] }) as SupabaseJwtPayload;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.error(`[auth] RS256 JWT verification failed: ${reason}. Ensure SUPABASE_URL is set on Render (Supabase → Settings → API → URL).`);
      return null;
    }
  }

  // ── HS256: use Legacy JWT Secret ─────────────────────────────────────────
  if (SUPABASE_JWT_SECRET) {
    try {
      return jwt.verify(token, SUPABASE_JWT_SECRET, { algorithms: ["HS256"] }) as SupabaseJwtPayload;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.error(`[auth] HS256 JWT verification failed: ${reason}. Check that SUPABASE_JWT_SECRET matches your Supabase project's JWT Secret (Settings → API → JWT Settings → JWT Secret).`);
      return null;
    }
  }

  // ── Dev-only fallback: decode without signature verification ─────────────
  if (process.env.NODE_ENV !== "production") {
    try {
      const decoded = jwt.decode(token) as SupabaseJwtPayload | null;
      if (decoded?.sub) return decoded;
    } catch {
      // ignore
    }
  }

  return null;
}

export function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  // 1. Session-based auth (legacy — kept for backward-compat with any existing sessions)
  if (req.session?.userId) {
    req.userId = req.session.userId;
    req.userEmail = req.session.userEmail;
    return next();
  }

  // 2. Bearer JWT (Supabase token sent by the frontend)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    verifyJwt(token).then((payload) => {
      if (payload) {
        req.userId = payload.sub;
        req.userEmail = payload.email;
      }
      next();
    }).catch(() => {
      next();
    });
    return;
  }

  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  next();
}
