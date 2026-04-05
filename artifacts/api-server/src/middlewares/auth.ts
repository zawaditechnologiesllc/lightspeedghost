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

interface SupabaseJwtPayload {
  sub?: string;
  email?: string;
  exp?: number;
  iat?: number;
  role?: string;
}

/**
 * Verifies a Supabase JWT using the project's JWT secret.
 * Falls back to bare base64-decode if SUPABASE_JWT_SECRET is not set
 * (dev-only — production must always have the secret configured).
 */
function verifyJwt(token: string): SupabaseJwtPayload | null {
  if (SUPABASE_JWT_SECRET) {
    try {
      return jwt.verify(token, SUPABASE_JWT_SECRET) as SupabaseJwtPayload;
    } catch {
      return null;
    }
  }

  // Dev fallback: decode without verification (logs a warning once)
  if (process.env.NODE_ENV !== "test") {
    console.warn(
      "[auth] SUPABASE_JWT_SECRET not set — JWT signature is NOT verified. Set this env var in production.",
    );
  }
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = Buffer.from(parts[1], "base64url").toString("utf-8");
    const decoded = JSON.parse(payload) as SupabaseJwtPayload;
    if (decoded.exp && decoded.exp * 1000 <= Date.now()) return null;
    return decoded;
  } catch {
    return null;
  }
}

export function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  // 1. Prefer session-based auth (legacy — kept for backward-compat)
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
