import type { Request, Response, NextFunction } from "express";
import { jwtVerify } from "jose";

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

const JWT_SECRET_RAW = process.env.SESSION_SECRET ?? "lsg-dev-secret-change-in-prod";
const JWT_SECRET = new TextEncoder().encode(JWT_SECRET_RAW);
const JWT_ISSUER = "lightspeed-ghost";
const JWT_AUDIENCE = "lightspeed-ghost-app";

interface JwtPayload {
  sub?: string;
  email?: string;
  exp?: number;
}

async function verifyJwt(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      algorithms: ["HS256"],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
    return payload as JwtPayload;
  } catch {
    // Token invalid or expired
    return null;
  }
}

export function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  // 1. Session-based auth
  if (req.session?.userId) {
    req.userId = req.session.userId;
    req.userEmail = req.session.userEmail;
    return next();
  }

  // 2. Bearer JWT
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    verifyJwt(token)
      .then((payload) => {
        if (payload?.sub) {
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
