import { Router, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

const router = Router();

const JWT_SECRET_RAW = process.env.SESSION_SECRET ?? "lsg-dev-secret-change-in-prod";
const JWT_SECRET = new TextEncoder().encode(JWT_SECRET_RAW);
const JWT_ISSUER = "lightspeed-ghost";
const JWT_AUDIENCE = "lightspeed-ghost-app";
const JWT_TTL = "30d";

async function signToken(sub: string, email: string): Promise<string> {
  return new SignJWT({ email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(sub)
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(JWT_TTL)
    .sign(JWT_SECRET);
}

router.get("/auth/me", (req: Request, res: Response) => {
  if (!req.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  res.json({ user: { id: req.userId, email: req.userEmail } });
});

router.post("/auth/signup", async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required." });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters." });
    return;
  }

  try {
    const existing = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
    if (existing.length > 0) {
      res.status(409).json({ error: "An account with that email already exists." });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const uid = uuidv4();

    const [user] = await db.insert(usersTable).values({
      uid,
      email: email.toLowerCase(),
      passwordHash,
      emailVerified: false,
    }).returning();

    const token = await signToken(user.uid, user.email);

    req.session.userId = user.uid;
    req.session.userEmail = user.email;

    res.status(201).json({ token, user: { id: user.uid, email: user.email } });
  } catch (err) {
    console.error("[auth/signup]", err);
    res.status(500).json({ error: "Signup failed. Please try again." });
  }
});

router.post("/auth/login", async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required." });
    return;
  }

  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
    if (!user) {
      res.status(401).json({ error: "Invalid email or password." });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid email or password." });
      return;
    }

    const token = await signToken(user.uid, user.email);

    req.session.userId = user.uid;
    req.session.userEmail = user.email;

    res.json({ token, user: { id: user.uid, email: user.email } });
  } catch (err) {
    console.error("[auth/login]", err);
    res.status(500).json({ error: "Login failed. Please try again." });
  }
});

router.post("/auth/logout", (req: Request, res: Response) => {
  req.session.destroy(() => {});
  res.json({ ok: true });
});

router.post("/auth/reset-password", async (req: Request, res: Response) => {
  if (!req.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const { password } = req.body as { password?: string };
  if (!password || password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters." });
    return;
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.uid, req.userId));
    res.json({ ok: true });
  } catch (err) {
    console.error("[auth/reset-password]", err);
    res.status(500).json({ error: "Password update failed. Please try again." });
  }
});

export { signToken, JWT_SECRET, JWT_ISSUER, JWT_AUDIENCE };
export default router;
