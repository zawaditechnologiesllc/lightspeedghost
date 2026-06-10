import { Router, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";
import { sendEmail } from "../lib/email";

const router = Router();

async function ensureTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS enterprise_leads (
      id            SERIAL PRIMARY KEY,
      institution   TEXT NOT NULL,
      name          TEXT NOT NULL,
      email         TEXT NOT NULL,
      role          TEXT NOT NULL,
      student_count TEXT NOT NULL,
      message       TEXT NOT NULL DEFAULT '',
      status        TEXT NOT NULL DEFAULT 'new',
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_enterprise_leads_status  ON enterprise_leads (status);
    CREATE INDEX IF NOT EXISTS idx_enterprise_leads_created ON enterprise_leads (created_at DESC);
  `);
}

ensureTable().catch((err) => {
  logger.error({ err }, "[contact] Failed to ensure enterprise_leads table");
});

// ── POST /contact/enterprise ──────────────────────────────────────────────────
router.post("/contact/enterprise", async (req: Request, res: Response) => {
  const { institution, name, email, role, studentCount, message } = req.body as {
    institution?: string;
    name?: string;
    email?: string;
    role?: string;
    studentCount?: string;
    message?: string;
  };

  if (!institution?.trim() || !name?.trim() || !email?.trim() || !role?.trim() || !studentCount?.trim()) {
    res.status(400).json({ error: "institution, name, email, role, and studentCount are required" });
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    res.status(400).json({ error: "Invalid email address" });
    return;
  }

  try {
    const { rows } = await pool.query<{ id: number }>(
      `INSERT INTO enterprise_leads (institution, name, email, role, student_count, message)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [institution.trim(), name.trim(), email.trim(), role.trim(), studentCount.trim(), (message ?? "").trim()]
    );
    const leadId = rows[0]?.id;

    const adminEmail = process.env["ADMIN_EMAIL"] ?? process.env["EMAIL_FROM"] ?? "hello@lightspeedghost.com";
    sendEmail({
      to: adminEmail,
      subject: `New enterprise enquiry — ${institution.trim()} (${studentCount.trim()} students)`,
      html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0a12;font-family:sans-serif;color:#e2e8f0">
  <div style="max-width:560px;margin:40px auto;padding:0 20px">
    <div style="background:#111827;border:1px solid #1e293b;border-radius:16px;padding:36px 32px">
      <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#3b82f6;text-transform:uppercase;letter-spacing:0.1em">New Enterprise Lead #${leadId}</p>
      <h1 style="margin:8px 0 20px;font-size:20px;font-weight:700;color:#f1f5f9">${institution.trim()}</h1>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <tr><td style="padding:6px 0;color:#64748b;width:130px">Contact</td><td style="padding:6px 0;color:#e2e8f0;font-weight:500">${name.trim()}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Email</td><td style="padding:6px 0"><a href="mailto:${email.trim()}" style="color:#3b82f6">${email.trim()}</a></td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Role</td><td style="padding:6px 0;color:#e2e8f0">${role.trim()}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Students</td><td style="padding:6px 0;color:#e2e8f0;font-weight:600">${studentCount.trim()}</td></tr>
      </table>
      ${(message ?? "").trim() ? `<div style="margin-top:16px;padding:14px;background:#0f172a;border:1px solid #1e293b;border-radius:8px;font-size:13px;color:#94a3b8">${(message ?? "").trim()}</div>` : ""}
    </div>
  </div>
</body></html>`,
    }).catch(() => {});

    sendEmail({
      to: email.trim(),
      subject: "We received your LightSpeed Ghost enterprise enquiry",
      html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0a12;font-family:sans-serif;color:#e2e8f0">
  <div style="max-width:560px;margin:40px auto;padding:0 20px">
    <div style="background:#111827;border:1px solid #1e293b;border-radius:16px;padding:36px 32px">
      <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#3b82f6;text-transform:uppercase;letter-spacing:0.1em">LightSpeed Ghost · Enterprise</p>
      <h1 style="margin:8px 0 16px;font-size:22px;font-weight:700;color:#f1f5f9">We've received your enquiry, ${name.trim()} 👋</h1>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#94a3b8">
        Thank you for reaching out about LightSpeed Ghost for <strong style="color:#e2e8f0">${institution.trim()}</strong>.
        We'll review your enquiry and get back to you within <strong style="color:#e2e8f0">one business day</strong>
        with a custom proposal for ${studentCount.trim()} students.
      </p>
      <p style="margin:0 0 20px;font-size:13px;color:#64748b">
        Need something sooner? Email us at <a href="mailto:enterprise@lightspeedghost.com" style="color:#3b82f6">enterprise@lightspeedghost.com</a>
      </p>
      <a href="https://lightspeedghost.com/enterprise" style="display:inline-block;background:#1e293b;border:1px solid #334155;color:#94a3b8;font-size:13px;padding:10px 20px;border-radius:8px;text-decoration:none">Back to Enterprise page →</a>
    </div>
  </div>
</body></html>`,
    }).catch(() => {});

    logger.info({ leadId, institution, email }, "[contact] Enterprise lead saved");
    res.json({ ok: true, leadId });
  } catch (err) {
    logger.error({ err }, "[contact] Failed to save enterprise lead");
    res.status(500).json({ error: "Failed to submit enquiry. Please try again or email enterprise@lightspeedghost.com directly." });
  }
});

// ── GET /contact/enterprise — admin only ─────────────────────────────────────
router.get("/contact/enterprise", async (req: Request, res: Response) => {
  if (!req.adminAuth?.authorized) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const { status, limit = "50", offset = "0" } = req.query as Record<string, string>;

  try {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (status) {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    params.push(Math.min(Number(limit) || 50, 200));
    params.push(Math.max(Number(offset) || 0, 0));

    const { rows } = await pool.query(
      `SELECT * FROM enterprise_leads ${where} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const { rows: countRows } = await pool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM enterprise_leads ${where}`,
      conditions.length > 0 ? params.slice(0, -2) : []
    );

    res.json({ leads: rows, total: parseInt(countRows[0]?.count ?? "0", 10) });
  } catch (err) {
    logger.error({ err }, "[contact] Failed to list enterprise leads");
    res.status(500).json({ error: "Failed to load leads" });
  }
});

// ── PATCH /contact/enterprise/:id/status — admin only ────────────────────────
router.patch("/contact/enterprise/:id/status", async (req: Request, res: Response) => {
  if (!req.adminAuth?.authorized) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const id = parseInt(req.params["id"] ?? "", 10);
  const { status } = req.body as { status?: string };
  const VALID_STATUSES = ["new", "contacted", "proposal_sent", "closed_won", "closed_lost"];

  if (isNaN(id) || !status || !VALID_STATUSES.includes(status)) {
    res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(", ")}` });
    return;
  }

  try {
    const { rowCount } = await pool.query(
      `UPDATE enterprise_leads SET status = $1 WHERE id = $2`,
      [status, id]
    );
    if (!rowCount) { res.status(404).json({ error: "Lead not found" }); return; }
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "[contact] Failed to update lead status");
    res.status(500).json({ error: "Failed to update status" });
  }
});

export default router;
