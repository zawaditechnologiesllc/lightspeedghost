import { Router, type Request, type Response } from "express";
import crypto from "node:crypto";
import Stripe from "stripe";
import { maybeRecordReferralCommission, maybeApplyReferralDiscount, markFirstPendingDiscountApplied } from "./referral";
import { pool } from "@workspace/db";
import {
  resolveGateway,
  detectCountry,
  getClientIp,
  type GatewayName,
} from "../lib/geoGateway";
import { ensureUsageTable, getUsage, getUserPlan } from "../lib/usageTracker";
import {
  getPaygPrice,
  getPaygLabel,
  SUBSCRIPTION_PLANS,
  type PlanId,
  type PaygTool,
  type DocumentTier,
} from "../lib/pricingConfig";
import { logger } from "../lib/logger";

const router = Router();

// ── Admin auth helper (timing-safe — mirrors admin.ts) ────────────────────────
function verifyAdminToken(req: Request): boolean {
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
  if (!ADMIN_PASSWORD) return false;
  const token = req.headers["x-admin-password"] as string | undefined;
  if (!token) return false;
  const aBuf = Buffer.from(token, "utf8");
  const bBuf = Buffer.from(ADMIN_PASSWORD, "utf8");
  const maxLen = Math.max(aBuf.length, bBuf.length);
  const aPadded = Buffer.alloc(maxLen);
  const bPadded = Buffer.alloc(maxLen);
  aBuf.copy(aPadded);
  bBuf.copy(bPadded);
  return crypto.timingSafeEqual(aPadded, bPadded) && aBuf.length === bBuf.length;
}

// ── DB bootstrap ─────────────────────────────────────────────────────────────

async function initTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS payments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT NOT NULL,
      gateway TEXT NOT NULL,
      gateway_session_id TEXT NOT NULL,
      type TEXT NOT NULL,
      plan TEXT,
      tool TEXT,
      tier TEXT,
      amount_cents INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      status TEXT NOT NULL DEFAULT 'pending',
      metadata TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMPTZ
    );
    CREATE TABLE IF NOT EXISTS user_credits (
      user_id TEXT PRIMARY KEY,
      balance_cents INTEGER NOT NULL DEFAULT 0,
      lifetime_earned_cents INTEGER NOT NULL DEFAULT 0,
      lifetime_spent_cents INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS credit_transactions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      type TEXT NOT NULL,
      description TEXT,
      reference_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS user_subscriptions (
      user_id TEXT PRIMARY KEY,
      plan TEXT NOT NULL DEFAULT 'free',
      billing TEXT,
      gateway TEXT,
      gateway_subscription_id TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      current_period_end TIMESTAMPTZ,
      seats INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS gateway_settings (
      gateway TEXT PRIMARY KEY,
      paused BOOLEAN NOT NULL DEFAULT FALSE,
      notes TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS user_risk (
      user_id TEXT PRIMARY KEY,
      risk_level TEXT NOT NULL DEFAULT 'low',
      reason TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    INSERT INTO gateway_settings (gateway) VALUES
      ('stripe'),('paddle'),('lemon_squeezy'),('paystack'),('intasend')
    ON CONFLICT (gateway) DO NOTHING;
  `);
}

async function init() {
  await initTables();
  await ensureUsageTable();
}
init().catch((e) => logger.error({ err: e }, "Failed to init payment tables"));

// ── Helpers ───────────────────────────────────────────────────────────────────

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

async function getPausedGateways(): Promise<Partial<Record<GatewayName, boolean>>> {
  try {
    const rows = await pool.query<{ gateway: string; paused: boolean }>(
      "SELECT gateway, paused FROM gateway_settings"
    );
    const result: Partial<Record<GatewayName, boolean>> = {};
    for (const row of rows.rows) {
      result[row.gateway as GatewayName] = row.paused;
    }
    return result;
  } catch {
    return {};
  }
}

async function getUserRisk(userId: string): Promise<"low" | "medium" | "high"> {
  try {
    const row = await pool.query<{ risk_level: string }>(
      "SELECT risk_level FROM user_risk WHERE user_id = $1",
      [userId]
    );
    return (row.rows[0]?.risk_level ?? "low") as "low" | "medium" | "high";
  } catch {
    return "low";
  }
}

// ── Stripe helpers ────────────────────────────────────────────────────────────

async function createStripeSession(params: {
  type: "subscription" | "payg";
  plan?: PlanId;
  tool?: PaygTool;
  tier?: DocumentTier;
  userId: string;
  userEmail: string;
  amountCents: number;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ sessionId: string; checkoutUrl: string }> {
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe not configured");

  const metadata = { userId: params.userId, type: params.type };

  let session: Stripe.Checkout.Session;

  if (params.type === "subscription" && params.plan) {
    const priceId = process.env[`STRIPE_PRICE_${params.plan.toUpperCase()}`];
    if (!priceId) throw new Error(`Stripe price ID not configured for plan: ${params.plan}`);
    session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: params.userEmail,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata,
    });
  } else {
    session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: params.userEmail,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: params.amountCents,
          product_data: {
            name: params.plan
              ? SUBSCRIPTION_PLANS[params.plan]?.label ?? "LightSpeed Ghost"
              : getPaygLabel(params.tool!, params.tier),
          },
        },
      }],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata,
    });
  }

  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return { sessionId: session.id, checkoutUrl: session.url };
}

// ── Paystack helpers ──────────────────────────────────────────────────────────

async function createPaystackSession(params: {
  amountCents: number;
  userEmail: string;
  userId: string;
  label: string;
  callbackUrl: string;
}): Promise<{ sessionId: string; checkoutUrl: string }> {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) throw new Error("Paystack not configured");

  const res = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: params.userEmail,
      amount: params.amountCents,
      currency: "USD",
      callback_url: params.callbackUrl,
      metadata: { userId: params.userId, label: params.label },
    }),
  });

  const data = await res.json() as {
    status: boolean;
    data?: { reference: string; authorization_url: string };
    message?: string;
  };

  if (!data.status || !data.data) {
    throw new Error(`Paystack error: ${data.message ?? "unknown"}`);
  }

  return {
    sessionId: data.data.reference,
    checkoutUrl: data.data.authorization_url,
  };
}

// ── IntaSend helpers ──────────────────────────────────────────────────────────

async function createIntaSendSession(params: {
  amountCents: number;
  userId: string;
  label: string;
  redirectUrl: string;
}): Promise<{ sessionId: string; checkoutUrl: string }> {
  const apiKey = process.env.INTASEND_API_KEY;
  if (!apiKey) throw new Error("IntaSend not configured");

  const isSandbox = process.env.NODE_ENV !== "production";
  const baseUrl = isSandbox
    ? "https://sandbox.intasend.com"
    : "https://payment.intasend.com";

  const res = await fetch(`${baseUrl}/api/v1/checkout/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      public_key: process.env.INTASEND_PUBLISHABLE_KEY ?? "",
      currency: "KES",
      amount: Math.round(params.amountCents * 0.13),
      name: "LightSpeed Ghost",
      email: "",
      comment: params.label,
      redirect_url: params.redirectUrl,
      metadata: { userId: params.userId },
    }),
  });

  const data = await res.json() as {
    url?: string;
    invoice?: { invoice_id?: string; state?: string };
    detail?: string;
  };

  if (!data.url) {
    throw new Error(`IntaSend error: ${data.detail ?? JSON.stringify(data)}`);
  }

  return {
    sessionId: data.invoice?.invoice_id ?? crypto.randomUUID(),
    checkoutUrl: data.url,
  };
}

// ── Paddle helpers ────────────────────────────────────────────────────────────

async function createPaddleSession(params: {
  type: "subscription" | "payg";
  plan?: PlanId;
  amountCents: number;
  label: string;
  userId: string;
  userEmail: string;
  successUrl: string;
}): Promise<{ sessionId: string; checkoutUrl: string }> {
  const apiKey = process.env.PADDLE_API_KEY;
  if (!apiKey) throw new Error("Paddle not configured");

  const isSandbox = process.env.NODE_ENV !== "production";
  const baseUrl = isSandbox
    ? "https://sandbox-api.paddle.com"
    : "https://api.paddle.com";

  const priceId = params.plan
    ? process.env[`PADDLE_PRICE_${params.plan.toUpperCase()}`]
    : undefined;

  const body = priceId
    ? {
        items: [{ price_id: priceId, quantity: 1 }],
        customer: { email: params.userEmail },
        success_url: params.successUrl,
        custom_data: { userId: params.userId },
      }
    : {
        items: [{
          quantity: 1,
          price: {
            description: params.label,
            billing_cycle: null,
            trial_period: null,
            product: {
              name: "LightSpeed Ghost",
              tax_category: "digital-goods",
            },
            unit_price: { amount: String(params.amountCents), currency_code: "USD" },
          },
        }],
        customer: { email: params.userEmail },
        success_url: params.successUrl,
        custom_data: { userId: params.userId },
      };

  const res = await fetch(`${baseUrl}/checkouts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json() as {
    data?: { id: string; url: string };
    error?: { detail: string };
  };

  if (!data.data?.url) {
    throw new Error(`Paddle error: ${data.error?.detail ?? JSON.stringify(data)}`);
  }

  return { sessionId: data.data.id, checkoutUrl: data.data.url };
}

// ── Lemon Squeezy helpers ─────────────────────────────────────────────────────

async function createLemonSqueezySession(params: {
  type: "subscription" | "payg";
  plan?: PlanId;
  amountCents: number;
  label: string;
  userId: string;
  userEmail: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ sessionId: string; checkoutUrl: string }> {
  const apiKey = process.env.LEMONSQUEEZY_API_KEY;
  const storeId = process.env.LEMONSQUEEZY_STORE_ID;
  if (!apiKey || !storeId) throw new Error("Lemon Squeezy not configured");

  const variantId = params.plan
    ? process.env[`LEMONSQUEEZY_VARIANT_${params.plan.toUpperCase()}`]
    : process.env.LEMONSQUEEZY_VARIANT_PAYG;

  if (!variantId) throw new Error("Lemon Squeezy variant ID not configured");

  const res = await fetch("https://api.lemonsqueezy.com/v1/checkouts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
    },
    body: JSON.stringify({
      data: {
        type: "checkouts",
        attributes: {
          checkout_options: {
            embed: false,
            media: false,
            logo: true,
          },
          checkout_data: {
            email: params.userEmail,
            custom: { userId: params.userId, label: params.label },
          },
          product_options: {
            redirect_url: params.successUrl,
          },
          preview: false,
        },
        relationships: {
          store: { data: { type: "stores", id: storeId } },
          variant: { data: { type: "variants", id: variantId } },
        },
      },
    }),
  });

  const data = await res.json() as {
    data?: { id: string; attributes?: { url: string } };
    errors?: Array<{ detail: string }>;
  };

  const url = data.data?.attributes?.url;
  if (!url) {
    throw new Error(`Lemon Squeezy error: ${data.errors?.[0]?.detail ?? JSON.stringify(data)}`);
  }

  return { sessionId: data.data!.id, checkoutUrl: url };
}

// ── Route: detect gateway ─────────────────────────────────────────────────────

router.get("/payments/gateway", async (req: Request, res: Response) => {
  try {
    const ip = getClientIp(req.headers as Record<string, string | string[] | undefined>, req.socket.remoteAddress);
    const countryCode = await detectCountry(ip);
    const paused = await getPausedGateways();
    const risk = req.userId ? await getUserRisk(req.userId) : "low";
    const isHighRisk = risk === "high";
    const route = resolveGateway(countryCode, isHighRisk, paused);

    res.json({
      gateway: route.primary,
      reason: route.reason,
      countryCode,
      isMobileMoney: route.isMobileMoney,
      momoProvider: route.momoProvider,
      cardFallbackGateway: route.cardFallback,
      stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY ?? null,
      paystackPublicKey: process.env.PAYSTACK_PUBLIC_KEY ?? null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gateway detection failed";
    res.status(503).json({ error: message });
  }
});

// ── Route: usage stats for current user ───────────────────────────────────────

router.get("/payments/usage", async (req: Request, res: Response) => {
  const userId = req.userId;
  if (!userId) {
    res.json({ usage: {}, plan: "starter" });
    return;
  }
  try {
    const [usage, plan] = await Promise.all([getUsage(userId), getUserPlan(userId)]);
    res.json({ usage, plan });
  } catch {
    res.json({ usage: {}, plan: "starter" });
  }
});

// ── Credits helpers ───────────────────────────────────────────────────────────

async function getCreditBalance(userId: string): Promise<number> {
  try {
    const row = await pool.query<{ balance_cents: number }>(
      "SELECT balance_cents FROM user_credits WHERE user_id = $1",
      [userId]
    );
    return row.rows[0]?.balance_cents ?? 0;
  } catch {
    return 0;
  }
}

async function adjustCredits(
  userId: string,
  amountCents: number,
  type: "purchase" | "spend" | "bonus" | "refund",
  description: string,
  referenceId?: string
): Promise<{ newBalance: number; ok: boolean }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`
      INSERT INTO user_credits (user_id, balance_cents, lifetime_earned_cents, lifetime_spent_cents)
      VALUES ($1, 0, 0, 0)
      ON CONFLICT (user_id) DO NOTHING
    `, [userId]);

    const earns = amountCents > 0 ? amountCents : 0;
    const spends = amountCents < 0 ? Math.abs(amountCents) : 0;

    const updated = await client.query<{ balance_cents: number }>(`
      UPDATE user_credits SET
        balance_cents = balance_cents + $2,
        lifetime_earned_cents = lifetime_earned_cents + $3,
        lifetime_spent_cents = lifetime_spent_cents + $4,
        updated_at = NOW()
      WHERE user_id = $1
      RETURNING balance_cents
    `, [userId, amountCents, earns, spends]);

    const newBalance = updated.rows[0]?.balance_cents ?? 0;
    if (newBalance < 0) {
      await client.query("ROLLBACK");
      return { newBalance: 0, ok: false };
    }

    await client.query(`
      INSERT INTO credit_transactions (user_id, amount_cents, type, description, reference_id)
      VALUES ($1, $2, $3, $4, $5)
    `, [userId, amountCents, type, description, referenceId ?? null]);

    await client.query("COMMIT");
    return { newBalance, ok: true };
  } catch {
    await client.query("ROLLBACK");
    return { newBalance: 0, ok: false };
  } finally {
    client.release();
  }
}

// ── Route: get credit balance ─────────────────────────────────────────────────

router.get("/payments/credits", async (req: Request, res: Response) => {
  const userId = req.userId;
  if (!userId) {
    res.json({ balanceCents: 0 });
    return;
  }
  const balanceCents = await getCreditBalance(userId);
  res.json({ balanceCents });
});

// ── Route: spend credits for a PAYG purchase ──────────────────────────────────

router.post("/payments/credits/spend", async (req: Request, res: Response) => {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const { tool, tier, amountCents, description } = req.body as {
    tool: PaygTool;
    tier?: DocumentTier;
    amountCents: number;
    description?: string;
  };
  if (!tool || !amountCents || amountCents <= 0) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  const expectedAmount = getPaygPrice(tool, tier);
  if (amountCents !== expectedAmount) {
    res.status(400).json({ error: "Amount mismatch" });
    return;
  }
  const balance = await getCreditBalance(userId);
  if (balance < amountCents) {
    res.status(402).json({ error: "Insufficient credits", balanceCents: balance, required: amountCents });
    return;
  }
  const desc = description ?? `${getPaygLabel(tool, tier)} (credits)`;
  const result = await adjustCredits(userId, -amountCents, "spend", desc);
  if (!result.ok) {
    res.status(402).json({ error: "Insufficient credits" });
    return;
  }
  res.json({ success: true, newBalanceCents: result.newBalance });
});

// ── Route: create payment session ─────────────────────────────────────────────

router.post("/payments/create", async (req: Request, res: Response) => {
  const userId = req.userId;
  const userEmail = req.userEmail;

  if (!userId || !userEmail) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const { type, plan, tool, tier, seats, preferredGateway } = req.body as {
    type: "subscription" | "payg";
    plan?: PlanId;
    tool?: PaygTool;
    tier?: DocumentTier;
    seats?: number;
    preferredGateway?: GatewayName;
  };

  try {
    // Calculate amount
    let amountCents: number;
    let label: string;

    if (type === "subscription") {
      if (!plan || !SUBSCRIPTION_PLANS[plan]) {
        res.status(400).json({ error: "Invalid plan" });
        return;
      }
      amountCents = SUBSCRIPTION_PLANS[plan].amountCents;
      if (plan === "campus_annual") {
        const numSeats = Math.max(5, seats ?? 5);
        amountCents = amountCents * numSeats * 12;
      }
      label = SUBSCRIPTION_PLANS[plan].label;

      // Apply referral discount (10% off next subscription) if pending
      const disc = await maybeApplyReferralDiscount(userId, amountCents);
      if (disc.discountApplied) {
        amountCents = disc.discountedAmount;
        logger.info({ userId, original: SUBSCRIPTION_PLANS[plan].amountCents, discounted: amountCents }, "[referral] 10% discount applied at checkout");
      }
    } else {
      if (!tool) {
        res.status(400).json({ error: "Tool required for PAYG" });
        return;
      }
      amountCents = getPaygPrice(tool, tier);
      label = getPaygLabel(tool, tier);
    }

    // Detect gateway — allow explicit override (e.g. card fallback from MoMo)
    const ip = getClientIp(req.headers as Record<string, string | string[] | undefined>, req.socket.remoteAddress);
    const countryCode = await detectCountry(ip);
    const paused = await getPausedGateways();
    const risk = await getUserRisk(userId);
    const route = resolveGateway(countryCode, risk === "high", paused);
    const gateway: GatewayName =
      preferredGateway && !paused[preferredGateway] ? preferredGateway : route.primary;

    const origin = process.env.FRONTEND_URL ?? "https://lightspeedghost.com";
    const successUrl = `${origin}/payment/success?gateway=${gateway}`;
    const cancelUrl = `${origin}/pricing`;

    let sessionId: string;
    let checkoutUrl: string;

    switch (gateway) {
      case "stripe": {
        const r = await createStripeSession({
          type,
          plan: plan as PlanId | undefined,
          tool: tool as PaygTool | undefined,
          tier: tier as DocumentTier | undefined,
          userId,
          userEmail,
          amountCents,
          successUrl: `${successUrl}&session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl,
        });
        sessionId = r.sessionId;
        checkoutUrl = r.checkoutUrl;
        break;
      }
      case "paystack": {
        const r = await createPaystackSession({
          amountCents,
          userEmail,
          userId,
          label,
          callbackUrl: `${origin}/payment/success?gateway=paystack`,
        });
        sessionId = r.sessionId;
        checkoutUrl = r.checkoutUrl;
        break;
      }
      case "intasend": {
        const r = await createIntaSendSession({
          amountCents,
          userId,
          label,
          redirectUrl: successUrl,
        });
        sessionId = r.sessionId;
        checkoutUrl = r.checkoutUrl;
        break;
      }
      case "paddle": {
        const r = await createPaddleSession({
          type,
          plan: plan as PlanId | undefined,
          amountCents,
          label,
          userId,
          userEmail,
          successUrl,
        });
        sessionId = r.sessionId;
        checkoutUrl = r.checkoutUrl;
        break;
      }
      case "lemon_squeezy": {
        const r = await createLemonSqueezySession({
          type,
          plan: plan as PlanId | undefined,
          amountCents,
          label,
          userId,
          userEmail,
          successUrl,
          cancelUrl,
        });
        sessionId = r.sessionId;
        checkoutUrl = r.checkoutUrl;
        break;
      }
      default:
        res.status(503).json({ error: "No payment gateway available" });
        return;
    }

    // Record pending payment
    await pool.query(
      `INSERT INTO payments
         (user_id, gateway, gateway_session_id, type, plan, tool, tier, amount_cents, currency, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'USD','pending')`,
      [userId, gateway, sessionId, type, plan ?? null, tool ?? null, tier ?? null, amountCents]
    );

    res.json({ gateway, sessionId, checkoutUrl, amountCents, label });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Payment creation failed";
    logger.error({ err }, "Payment creation error");
    res.status(500).json({ error: message });
  }
});

// ── Route: verify payment (polling after redirect) ────────────────────────────

router.get("/payments/verify", async (req: Request, res: Response) => {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const { gateway, session_id, reference } = req.query as {
    gateway?: string;
    session_id?: string;
    reference?: string;
  };

  const ref = session_id ?? reference;
  if (!ref || !gateway) {
    res.status(400).json({ error: "Missing gateway or reference" });
    return;
  }

  try {
    let confirmed = false;

    if (gateway === "stripe") {
      const stripe = getStripe();
      if (stripe) {
        const session = await stripe.checkout.sessions.retrieve(ref);
        confirmed = session.payment_status === "paid";
      }
    } else if (gateway === "paystack") {
      const secret = process.env.PAYSTACK_SECRET_KEY;
      if (secret) {
        const r = await fetch(`https://api.paystack.co/transaction/verify/${ref}`, {
          headers: { Authorization: `Bearer ${secret}` },
        });
        const d = await r.json() as { data?: { status: string } };
        confirmed = d.data?.status === "success";
      }
    } else {
      const row = await pool.query<{ status: string }>(
        "SELECT status FROM payments WHERE gateway_session_id = $1 AND user_id = $2",
        [ref, userId]
      );
      confirmed = row.rows[0]?.status === "completed";
    }

    if (confirmed) {
      await pool.query(
        `UPDATE payments SET status='completed', completed_at=NOW()
         WHERE gateway_session_id=$1 AND user_id=$2 AND status='pending'`,
        [ref, userId]
      );

      const row = await pool.query<{ type: string; plan: string | null }>(
        "SELECT type, plan FROM payments WHERE gateway_session_id=$1 AND user_id=$2",
        [ref, userId]
      );
      const payment = row.rows[0];

      if (payment?.type === "subscription" && payment.plan) {
        const billing = payment.plan.endsWith("annual") ? "annual" : "monthly";
        const planName = payment.plan.startsWith("campus") ? "campus" : "pro";
        const periodEnd = billing === "annual"
          ? new Date(Date.now() + 365 * 86400000)
          : new Date(Date.now() + 31 * 86400000);

        await pool.query(
          `INSERT INTO user_subscriptions (user_id, plan, billing, gateway, gateway_subscription_id, status, current_period_end)
           VALUES ($1,$2,$3,$4,$5,'active',$6)
           ON CONFLICT (user_id) DO UPDATE SET
             plan=EXCLUDED.plan, billing=EXCLUDED.billing, gateway=EXCLUDED.gateway,
             gateway_subscription_id=EXCLUDED.gateway_subscription_id,
             status='active', current_period_end=EXCLUDED.current_period_end, updated_at=NOW()`,
          [userId, planName, billing, gateway, ref, periodEnd]
        );
        await markFirstPendingDiscountApplied(userId);
      }
    }

    const sub = await pool.query<{ plan: string; status: string }>(
      "SELECT plan, status FROM user_subscriptions WHERE user_id=$1",
      [userId]
    );

    res.json({
      confirmed,
      plan: sub.rows[0]?.plan ?? "free",
      planStatus: sub.rows[0]?.status ?? null,
    });
  } catch (err: unknown) {
    logger.error({ err }, "Payment verification error");
    res.status(500).json({ error: "Verification failed" });
  }
});

// ── Route: get subscription status ───────────────────────────────────────────

router.get("/payments/subscription", async (req: Request, res: Response) => {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  try {
    const row = await pool.query(
      "SELECT plan, billing, status, current_period_end, gateway FROM user_subscriptions WHERE user_id=$1",
      [userId]
    );
    res.json(row.rows[0] ?? { plan: "free", status: "active" });
  } catch {
    res.json({ plan: "free", status: "active" });
  }
});

// ── Route: transaction history ────────────────────────────────────────────────

router.get("/payments/transactions", async (req: Request, res: Response) => {
  const userId = req.userId;
  if (!userId) { res.status(401).json({ error: "Authentication required" }); return; }
  try {
    const { rows } = await pool.query<{
      id: string; gateway: string; type: string; plan: string | null;
      tool: string | null; tier: string | null; amount_cents: number;
      currency: string; status: string; created_at: string; completed_at: string | null;
    }>(
      `SELECT id, gateway, type, plan, tool, tier, amount_cents, currency, status, created_at, completed_at
       FROM payments
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 100`,
      [userId],
    );
    res.json({ transactions: rows });
  } catch (err) {
    logger.error({ err }, "[payments] transactions error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Webhook: Stripe ───────────────────────────────────────────────────────────

router.post("/payments/webhook/stripe", async (req: Request, res: Response) => {
  const sig = req.headers["stripe-signature"] as string;
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripe = getStripe();

  if (!stripe || !secret) {
    res.status(200).send("OK");
    return;
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body as Buffer, sig, secret);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Invalid signature";
    res.status(400).json({ error: msg });
    return;
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      if (userId && session.payment_status === "paid") {
        await pool.query(
          `UPDATE payments SET status='completed', completed_at=NOW()
           WHERE gateway_session_id=$1`,
          [session.id]
        );
        await maybeRecordReferralCommission(userId, session.amount_total ?? 0);
        await markFirstPendingDiscountApplied(userId);
      }
    } else if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;
      await pool.query(
        `UPDATE user_subscriptions SET status='cancelled', updated_at=NOW()
         WHERE gateway_subscription_id=$1`,
        [sub.id]
      );
    }
  } catch (err) {
    logger.error({ err }, "Stripe webhook processing error");
  }

  res.json({ received: true });
});

// ── Webhook: Paystack ─────────────────────────────────────────────────────────

router.post("/payments/webhook/paystack", async (req: Request, res: Response) => {
  const secret = process.env.PAYSTACK_SECRET_KEY ?? "";
  const signature = req.headers["x-paystack-signature"] as string ?? "";
  const body = req.body as Buffer;

  const hash = crypto.createHmac("sha512", secret).update(body).digest("hex");
  if (hash !== signature) {
    res.status(400).json({ error: "Invalid signature" });
    return;
  }

  try {
    const event = JSON.parse(body.toString()) as {
      event: string;
      data?: { reference?: string; status?: string };
    };

    if (event.event === "charge.success" && event.data?.reference) {
      const pRes = await pool.query<{ user_id: string }>(
        `UPDATE payments SET status='completed', completed_at=NOW()
         WHERE gateway_session_id=$1 RETURNING user_id`,
        [event.data.reference]
      );
      const uid = pRes.rows[0]?.user_id;
      if (uid) await markFirstPendingDiscountApplied(uid);
    }
  } catch (err) {
    logger.error({ err }, "Paystack webhook error");
  }

  res.json({ received: true });
});

// ── Webhook: IntaSend ─────────────────────────────────────────────────────────

router.post("/payments/webhook/intasend", async (req: Request, res: Response) => {
  // Optional HMAC signature check — activate by setting INTASEND_WEBHOOK_SECRET on Render.
  // IntaSend sends the signature in the x-intasend-signature header.
  const intasendSecret = process.env.INTASEND_WEBHOOK_SECRET ?? "";
  if (intasendSecret) {
    const sig = req.headers["x-intasend-signature"] as string ?? "";
    const body = req.body as Buffer;
    const expected = crypto.createHmac("sha256", intasendSecret).update(body).digest("hex");
    if (!sig || expected !== sig) {
      res.status(400).json({ error: "Invalid signature" });
      return;
    }
  }
  try {
    const raw = req.body as Buffer | Record<string, unknown>;
    const payload = (Buffer.isBuffer(raw) ? JSON.parse(raw.toString()) : raw) as { invoice_id?: string; state?: string };
    if (payload.state === "COMPLETE" && payload.invoice_id) {
      const pRes = await pool.query<{ user_id: string }>(
        `UPDATE payments SET status='completed', completed_at=NOW()
         WHERE gateway_session_id=$1 RETURNING user_id`,
        [payload.invoice_id]
      );
      const uid = pRes.rows[0]?.user_id;
      if (uid) await markFirstPendingDiscountApplied(uid);
    }
  } catch (err) {
    logger.error({ err }, "IntaSend webhook error");
  }
  res.json({ received: true });
});

// ── Webhook: Paddle ───────────────────────────────────────────────────────────

router.post("/payments/webhook/paddle", async (req: Request, res: Response) => {
  const secret = process.env.PADDLE_WEBHOOK_SECRET ?? "";
  const sig = req.headers["paddle-signature"] as string ?? "";
  const body = req.body as Buffer;

  if (secret) {
    const parts = sig.split(";").reduce<Record<string, string>>((acc, part) => {
      const [k, v] = part.split("=");
      if (k && v) acc[k] = v;
      return acc;
    }, {});
    const ts = parts["ts"] ?? "";
    const h1 = parts["h1"] ?? "";
    const signed = crypto.createHmac("sha256", secret).update(`${ts}:${body.toString()}`).digest("hex");
    if (signed !== h1) {
      res.status(400).json({ error: "Invalid signature" });
      return;
    }
  }

  try {
    const event = JSON.parse(body.toString()) as {
      event_type?: string;
      data?: { id?: string; status?: string };
    };

    if (event.event_type === "transaction.completed" && event.data?.id) {
      const pRes = await pool.query<{ user_id: string }>(
        `UPDATE payments SET status='completed', completed_at=NOW()
         WHERE gateway_session_id=$1 RETURNING user_id`,
        [event.data.id]
      );
      const uid = pRes.rows[0]?.user_id;
      if (uid) await markFirstPendingDiscountApplied(uid);
    }
  } catch (err) {
    logger.error({ err }, "Paddle webhook error");
  }

  res.json({ received: true });
});

// ── Webhook: Lemon Squeezy ────────────────────────────────────────────────────

router.post("/payments/webhook/lemon-squeezy", async (req: Request, res: Response) => {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET ?? "";
  const sig = req.headers["x-signature"] as string ?? "";
  const body = req.body as Buffer;

  if (secret) {
    const hash = crypto.createHmac("sha256", secret).update(body).digest("hex");
    if (hash !== sig) {
      res.status(400).json({ error: "Invalid signature" });
      return;
    }
  }

  try {
    const event = JSON.parse(body.toString()) as {
      meta?: { event_name?: string; custom_data?: { userId?: string } };
      data?: { id?: string; attributes?: { status?: string } };
    };

    const evName = event.meta?.event_name ?? "";
    if ((evName === "order_created" || evName === "subscription_created") && event.data?.id) {
      const lsUserId = event.meta?.custom_data?.userId;
      const pRes = await pool.query<{ user_id: string }>(
        `UPDATE payments SET status='completed', completed_at=NOW()
         WHERE gateway_session_id=$1 RETURNING user_id`,
        [event.data.id]
      );
      const uid = lsUserId ?? pRes.rows[0]?.user_id;
      if (uid) await markFirstPendingDiscountApplied(uid);
    }
  } catch (err) {
    logger.error({ err }, "Lemon Squeezy webhook error");
  }

  res.json({ received: true });
});

// ── Admin: gateway management ─────────────────────────────────────────────────

router.get("/admin/gateways", async (req: Request, res: Response) => {
  if (!verifyAdminToken(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const rows = await pool.query("SELECT * FROM gateway_settings ORDER BY gateway");
    const stats = await pool.query<{ gateway: string; count: string; revenue: string }>(
      `SELECT gateway, COUNT(*) as count,
              COALESCE(SUM(amount_cents) FILTER (WHERE status='completed'),0) as revenue
       FROM payments GROUP BY gateway`
    );

    const statsMap = Object.fromEntries(
      stats.rows.map((r) => [r.gateway, { count: Number(r.count), revenue: Number(r.revenue) }])
    );

    res.json({
      gateways: rows.rows.map((r) => ({
        ...r,
        configured: isGatewayConfigured(r.gateway as GatewayName),
        stats: statsMap[r.gateway] ?? { count: 0, revenue: 0 },
      })),
    });
  } catch (err) {
    logger.error({ err }, "Admin gateways error");
    res.status(500).json({ error: "Failed to load gateway settings" });
  }
});

function isGatewayConfigured(g: GatewayName): boolean {
  switch (g) {
    case "stripe":       return !!(process.env.STRIPE_SECRET_KEY);
    case "paddle":       return !!(process.env.PADDLE_API_KEY);
    case "lemon_squeezy":return !!(process.env.LEMONSQUEEZY_API_KEY);
    case "paystack":     return !!(process.env.PAYSTACK_SECRET_KEY);
    case "intasend":     return !!(process.env.INTASEND_API_KEY);
    default:             return false;
  }
}

router.patch("/admin/gateways/:name", async (req: Request, res: Response) => {
  if (!verifyAdminToken(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { name } = req.params;
  const { paused, notes } = req.body as { paused?: boolean; notes?: string };

  try {
    await pool.query(
      `UPDATE gateway_settings SET
         paused = COALESCE($1, paused),
         notes  = COALESCE($2, notes),
         updated_at = NOW()
       WHERE gateway = $3`,
      [paused ?? null, notes ?? null, name]
    );
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Admin gateway update error");
    res.status(500).json({ error: "Failed to update gateway" });
  }
});

router.get("/admin/payments", async (req: Request, res: Response) => {
  if (!verifyAdminToken(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const { limit = "50", offset = "0", status, gateway } = req.query as {
      limit?: string;
      offset?: string;
      status?: string;
      gateway?: string;
    };

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (status) { conditions.push(`status=$${params.length + 1}`); params.push(status); }
    if (gateway) { conditions.push(`gateway=$${params.length + 1}`); params.push(gateway); }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const rows = await pool.query(
      `SELECT * FROM payments ${where} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, Number(limit), Number(offset)]
    );
    const total = await pool.query(
      `SELECT COUNT(*) as total FROM payments ${where}`,
      params
    );

    res.json({ payments: rows.rows, total: Number(total.rows[0]?.total ?? 0) });
  } catch (err) {
    logger.error({ err }, "Admin payments list error");
    res.status(500).json({ error: "Failed to load payments" });
  }
});

router.get("/admin/subscriptions", async (req: Request, res: Response) => {
  if (!verifyAdminToken(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const rows = await pool.query(
      "SELECT * FROM user_subscriptions ORDER BY updated_at DESC LIMIT 100"
    );
    res.json({ subscriptions: rows.rows });
  } catch (err) {
    logger.error({ err }, "Admin subscriptions error");
    res.status(500).json({ error: "Failed to load subscriptions" });
  }
});

router.patch("/admin/user-risk/:userId", async (req: Request, res: Response) => {
  if (!verifyAdminToken(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { userId } = req.params;
  const { riskLevel, reason } = req.body as { riskLevel: "low" | "medium" | "high"; reason?: string };

  try {
    await pool.query(
      `INSERT INTO user_risk (user_id, risk_level, reason)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE SET risk_level=$2, reason=$3, updated_at=NOW()`,
      [userId, riskLevel, reason ?? null]
    );
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Admin user-risk update error");
    res.status(500).json({ error: "Failed to update risk" });
  }
});

export default router;
