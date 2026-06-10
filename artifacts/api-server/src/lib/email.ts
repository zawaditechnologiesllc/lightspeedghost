// Email delivery via Resend. Set RESEND_API_KEY in env to enable.
// Without the key all sends are no-ops logged at warn level.

import { logger } from "./logger";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_ADDRESS = process.env.EMAIL_FROM ?? "LightSpeed Ghost <hello@lightspeedghost.com>";

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  if (!RESEND_API_KEY) {
    logger.warn({ to: opts.to, subject: opts.subject }, "[email] RESEND_API_KEY not set — email not sent");
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      logger.error({ status: res.status, body }, "[email] Resend API error");
    }
  } catch (err) {
    logger.error({ err }, "[email] Failed to send email");
  }
}

export function welcomeEmail(opts: { firstName?: string }): string {
  const name = opts.firstName ?? "there";
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a12;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e2e8f0">
  <div style="max-width:560px;margin:40px auto;padding:0 20px">
    <div style="background:#111827;border:1px solid #1e293b;border-radius:16px;padding:36px 32px">
      <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#3b82f6;text-transform:uppercase;letter-spacing:0.1em">LightSpeed Ghost</p>
      <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#f1f5f9">Welcome, ${name} 👋</h1>
      <p style="margin:0 0 20px;font-size:14px;line-height:1.7;color:#94a3b8">
        You now have access to every academic tool you need — AI paper writer, humanizer, STEM solver, plagiarism checker, and a study assistant that remembers your progress.
      </p>
      <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#e2e8f0">Start here:</p>
      <ul style="margin:0 0 24px;padding-left:18px;font-size:13px;line-height:2;color:#94a3b8">
        <li>Write your first paper — upload your rubric and brief</li>
        <li>Run a plagiarism + AI check on anything you've written</li>
        <li>Try the STEM solver — photograph a problem set</li>
      </ul>
      <a href="https://lightspeedghost.com/app" style="display:inline-block;background:#3b82f6;color:#fff;font-size:14px;font-weight:600;padding:12px 24px;border-radius:10px;text-decoration:none">Go to your workspace →</a>
      <p style="margin:24px 0 0;font-size:11px;color:#475569">
        LightSpeed Ghost · Academic AI Platform · <a href="https://lightspeedghost.com/terms" style="color:#475569">Terms</a> · <a href="https://lightspeedghost.com/privacy" style="color:#475569">Privacy</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

export function paygUpgradeEmail(opts: { firstName?: string; paperCount: number }): string {
  const name = opts.firstName ?? "there";
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0a12;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e2e8f0">
  <div style="max-width:560px;margin:40px auto;padding:0 20px">
    <div style="background:#111827;border:1px solid #1e293b;border-radius:16px;padding:36px 32px">
      <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#f59e0b;text-transform:uppercase;letter-spacing:0.1em">💡 Quick tip</p>
      <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#f1f5f9">You've generated ${opts.paperCount} papers — have you considered subscribing?</h1>
      <p style="margin:0 0 20px;font-size:14px;line-height:1.7;color:#94a3b8">
        At pay-as-you-go rates you've already spent more than one month of Starter ($9.99/mo). A subscription gives you 3 papers, revisions, STEM solves, and more — every month.
      </p>
      <a href="https://lightspeedghost.com/#pricing" style="display:inline-block;background:#3b82f6;color:#fff;font-size:14px;font-weight:600;padding:12px 24px;border-radius:10px;text-decoration:none">See subscription plans →</a>
    </div>
  </div>
</body>
</html>`;
}

export function gradeProofEmail(opts: { firstName?: string }): string {
  const name = opts.firstName ?? "there";
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0a12;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e2e8f0">
  <div style="max-width:560px;margin:40px auto;padding:0 20px">
    <div style="background:#111827;border:1px solid #1e293b;border-radius:16px;padding:36px 32px">
      <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#10b981;text-transform:uppercase;letter-spacing:0.1em">Grade results</p>
      <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#f1f5f9">Students are hitting 92%+ — here's how</h1>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#94a3b8">
        The key isn't just generating a paper — it's uploading your rubric first. When our system knows your A-grade criteria before writing starts, it targets them directly.
      </p>
      <div style="background:#0f172a;border:1px solid #1e293b;border-radius:10px;padding:16px;margin-bottom:20px">
        <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#e2e8f0">Two things that make the difference:</p>
        <ul style="margin:0;padding-left:18px;font-size:13px;line-height:2;color:#94a3b8">
          <li>Upload your rubric PDF before generating — the AI extracts only A-grade criteria</li>
          <li>Use the Revision tool on any existing draft — paste your current grade + rubric</li>
        </ul>
      </div>
      <a href="https://lightspeedghost.com/write" style="display:inline-block;background:#10b981;color:#fff;font-size:14px;font-weight:600;padding:12px 24px;border-radius:10px;text-decoration:none">Write a paper now →</a>
    </div>
  </div>
</body>
</html>`;
}
