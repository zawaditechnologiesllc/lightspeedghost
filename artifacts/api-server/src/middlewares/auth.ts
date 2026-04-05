import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

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

/**
 * Verifies a Supabase JWT using the project's JWT secret (HS256).
 * Returns null if the secret is not configured or the token is invalid/expired.
 * Never falls back to unverified decoding — forged tokens are always rejected.
 */
function verifyJwt(token: string): SupabaseJwtPayload | null {
  if (!SUPABASE_JWT_SECRET) {
    return null;
  }
  try {
    return jwt.verify(token, SUPABASE_JWT_SECRET) as SupabaseJwtPayload;
  } catch {
    return null;
  }
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
    const payload = verifyJwt(token);
    if (payload) {
      req.userId = payload.sub;
      req.userEmail = payload.email;
    }
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
