import { Router, type Request, type Response } from "express";

const router = Router();

/**
 * GET /auth/me
 * Returns the authenticated user's id and email as resolved by the
 * auth middleware (Supabase Bearer JWT).  Useful for health-checks
 * and debugging; returns 401 when no valid token is present.
 */
router.get("/auth/me", (req: Request, res: Response) => {
  if (!req.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  res.json({ user: { id: req.userId, email: req.userEmail } });
});

export default router;
