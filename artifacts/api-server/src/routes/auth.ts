import { Router, type Request, type Response } from "express";
import { sendEmail, welcomeEmail } from "../lib/email";

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
  const userEmail = req.userEmail;
  // Fire-and-forget welcome email — non-blocking
  if (userEmail) {
    sendEmail({
      to: userEmail,
      subject: "Welcome to LightSpeed Ghost 🚀",
      html: welcomeEmail({ firstName: userEmail.split("@")[0] }),
    }).catch(() => {/* non-fatal */});
  }
  res.json({ user: { id: req.userId, email: req.userEmail } });
});

export default router;
