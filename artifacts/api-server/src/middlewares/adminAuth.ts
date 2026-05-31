/**
 * Shared admin authentication middleware.
 * Resolves req.adminAuth for ANY route — use this in app.ts as an app-level
 * middleware so seoRouter and any future router get auth resolution for free.
 *
 * Super admin:  x-admin-password header matches ADMIN_PASSWORD env var (sync, constant-time).
 * Sector admin: x-admin-email + x-admin-password → DB lookup + bcrypt compare.
 */
import type { Request, Response, NextFunction } from "express";
import { pool } from "@workspace/db";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

function timingSafeCompare(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  const maxLen = Math.max(aBuf.length, bBuf.length);
  const aPadded = Buffer.alloc(maxLen);
  const bPadded = Buffer.alloc(maxLen);
  aBuf.copy(aPadded);
  bBuf.copy(bPadded);
  return crypto.timingSafeEqual(aPadded, bPadded) && aBuf.length === bBuf.length;
}

export async function resolveAdminAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  // Skip if already resolved (e.g. by admin router's own middleware on overlapping paths)
  if (req.adminAuth !== undefined) return next();

  const token = req.headers["x-admin-password"] as string | undefined;
  if (!token) {
    req.adminAuth = { authorized: false, isSuperAdmin: false };
    return next();
  }

  // 1. Super admin — env var check (constant-time, no DB)
  if (ADMIN_PASSWORD && timingSafeCompare(token, ADMIN_PASSWORD)) {
    req.adminAuth = { authorized: true, isSuperAdmin: true };
    return next();
  }

  // 2. Sector admin — DB lookup by email + bcrypt compare
  const adminEmail = (req.headers["x-admin-email"] as string | undefined)?.trim().toLowerCase();
  if (adminEmail) {
    try {
      const { rows } = await pool.query<{
        id: number; name: string; email: string; sectors: string[]; password_hash: string;
      }>(
        "SELECT id, name, email, sectors, password_hash FROM admin_users WHERE email = $1 AND active = true LIMIT 1",
        [adminEmail],
      );
      if (rows.length > 0 && await bcrypt.compare(token, rows[0].password_hash)) {
        const { password_hash: _h, ...admin } = rows[0];
        void _h;
        req.adminAuth = { authorized: true, isSuperAdmin: false, sectorAdmin: admin };
        return next();
      }
    } catch { /* DB error — fall through to unauthorized */ }
  }

  req.adminAuth = { authorized: false, isSuperAdmin: false };
  next();
}
