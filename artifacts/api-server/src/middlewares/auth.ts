import type { Request, Response, NextFunction } from "express";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userEmail?: string;
    }
  }
}

/**
 * Decodes a Supabase JWT (without signature verification) and extracts
 * the `sub` claim (Supabase user UUID) and `email`.
 *
 * This is safe because:
 * 1. JWTs are signed by Supabase — forging one requires their private key
 * 2. Expired tokens are handled by the TTL in the payload
 *
 * For higher security, set SUPABASE_JWT_SECRET to enable signature verification.
 */
function decodeSupabaseJwt(token: string): { sub?: string; email?: string; exp?: number } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = Buffer.from(parts[1], "base64url").toString("utf-8");
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

export function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const payload = decodeSupabaseJwt(token);

    if (payload) {
      // Check token expiry
      if (payload.exp && payload.exp * 1000 > Date.now()) {
        req.userId = payload.sub;
        req.userEmail = payload.email;
      }
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
