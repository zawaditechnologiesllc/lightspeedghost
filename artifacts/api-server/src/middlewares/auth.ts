import type { Request, Response, NextFunction } from "express";
import { createRemoteJWKSet, jwtVerify, decodeJwt, decodeProtectedHeader } from "jose";

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
const SUPABASE_URL =
  process.env.SUPABASE_URL ??
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  process.env.VITE_SUPABASE_URL;

if (!SUPABASE_JWT_SECRET && !SUPABASE_URL) {
  console.error(
    "[auth] WARNING: Neither SUPABASE_JWT_SECRET nor SUPABASE_URL is set. " +
    "JWT authentication will not work until at least one is configured on Render.",
  );
}

// ── JWKS client — handles ES256, RS256, and any other asymmetric algorithm ───
// jose's createRemoteJWKSet caches keys and works with all JWK key types (EC, RSA).
let remoteJWKS: ReturnType<typeof createRemoteJWKSet> | null = null;

function getRemoteJWKS() {
  if (remoteJWKS) return remoteJWKS;
  if (!SUPABASE_URL) return null;
  remoteJWKS = createRemoteJWKSet(
    new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`),
  );
  return remoteJWKS;
}

interface SupabaseJwtPayload {
  sub?: string;
  email?: string;
  exp?: number;
  iat?: number;
  role?: string;
}

/**
 * Verifies a Supabase JWT using jose.
 *
 * Supports all Supabase signing modes:
 *   - HS256 (Legacy JWT Secret) — verified with SUPABASE_JWT_SECRET
 *   - RS256 / ES256 (JWT Signing Keys) — verified via Supabase JWKS endpoint
 *
 * Algorithm is detected automatically from the token header.
 */
async function verifyJwt(token: string): Promise<SupabaseJwtPayload | null> {
  // Peek at the token header to choose verification path
  let alg = "HS256";
  let hasKid = false;
  try {
    const header = decodeProtectedHeader(token);
    alg = header.alg ?? "HS256";
    hasKid = !!header.kid;
  } catch {
    console.error("[auth] Cannot decode JWT header — token is malformed.");
    return null;
  }

  // ── Asymmetric (ES256, RS256, etc.): use JWKS endpoint ───────────────────
  if (hasKid || alg !== "HS256") {
    const jwks = getRemoteJWKS();
    if (!jwks) {
      console.error(
        `[auth] Token uses ${alg} but SUPABASE_URL is not set on Render. ` +
        "Add SUPABASE_URL = your Supabase project URL (e.g. https://xxxx.supabase.co) " +
        "in Render → Environment Variables.",
      );
      return null;
    }
    try {
      const { payload } = await jwtVerify(token, jwks);
      return payload as SupabaseJwtPayload;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.error(`[auth] ${alg} JWT verification failed: ${reason}`);
      return null;
    }
  }

  // ── Symmetric (HS256): use Legacy JWT Secret ─────────────────────────────
  if (SUPABASE_JWT_SECRET) {
    try {
      const secret = new TextEncoder().encode(SUPABASE_JWT_SECRET);
      const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
      return payload as SupabaseJwtPayload;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.error(
        `[auth] HS256 JWT verification failed: ${reason}. ` +
        "Check that SUPABASE_JWT_SECRET on Render matches your Supabase project's " +
        "JWT Secret (Supabase → Settings → API → JWT Settings → JWT Secret).",
      );
      return null;
    }
  }

  // ── Dev-only fallback: decode without signature verification ─────────────
  if (process.env.NODE_ENV !== "production") {
    try {
      const payload = decodeJwt(token);
      if (payload?.sub) return payload as SupabaseJwtPayload;
    } catch {
      // ignore
    }
  }

  return null;
}

export function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  // 1. Session-based auth (legacy — kept for backward-compat)
  if (req.session?.userId) {
    req.userId = req.session.userId;
    req.userEmail = req.session.userEmail;
    return next();
  }

  // 2. Bearer JWT (Supabase token sent by the frontend)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    verifyJwt(token)
      .then((payload) => {
        if (payload) {
          req.userId = payload.sub;
          req.userEmail = payload.email;
        }
        next();
      })
      .catch(() => next());
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
