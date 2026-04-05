import type { Request, Response, NextFunction } from "express";

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

/**
 * Decodes a JWT (without signature verification) and extracts
 * the `sub` claim and `email` — kept for backward-compat with legacy tokens.
 */
function decodeJwt(token: string): { sub?: string; email?: string; exp?: number } | null {
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
  // 1. Prefer session-based auth
  if (req.session?.userId) {
    req.userId = req.session.userId;
    req.userEmail = req.session.userEmail;
    return next();
  }

  // 2. Fall back to Bearer JWT (backward-compat / mobile clients)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const payload = decodeJwt(token);

    if (payload) {
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
