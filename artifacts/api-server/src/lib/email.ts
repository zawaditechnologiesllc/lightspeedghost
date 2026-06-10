// Resend-backed transactional email — uses native fetch, no extra npm dep.
// All sends are fire-and-forget; callers use .catch(() => {})

const RESEND_API_KEY = process.env["RESEND_API_KEY"];
const EMAIL_FROM = process.env["EMAIL_FROM"] ?? "LightSpeed Ghost <hello@lightspeedghost.com>";

export async function sendEmail(opts: { to: string; subject: string; html: string }): Promise<void> {
  if (!RESEND_API_KEY) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({ from: EMAIL_FROM, to: opts.to, subject: opts.subject, html: opts.html }),
  });
}

export function welcomeEmail(opts: { firstName?: string } = {}): string {
  const name = opts.firstName ?? "there";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0a12;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e2e8f0">
  <div style="max-width:560px;margin:40px auto;padding:0 20px">
    <div style="background:#111827;border:1px solid #1e293b;border-radius:16px;padding:36px 32px">
      <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#3b82f6;text-transform:uppercase;letter-spacing:0.1em">LightSpeed Ghost</p>
      <h1 style="margin:8px 0 16px;font-size:22px;font-weight:700;color:#f1f5f9">Welcome, ${name} 👋</h1>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#94a3b8">
        Your account is ready. Start with the AI Paper Writer — give it your topic, subject, and word count, and it will produce a fully referenced, plagiarism-checked paper in minutes.
      </p>
      <a href="https://lightspeedghost.com/app" style="display:inline-block;background:#3b82f6;color:#fff;font-size:13px;font-weight:600;padding:12px 24px;border-radius:8px;text-decoration:none">Open LightSpeed Ghost →</a>
    </div>
  </div>
</body></html>`;
}

export function paygUpgradeEmail(opts: { firstName?: string; paperCount: number }): string {
  const name = opts.firstName ?? "there";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0a12;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e2e8f0">
  <div style="max-width:560px;margin:40px auto;padding:0 20px">
    <div style="background:#111827;border:1px solid #1e293b;border-radius:16px;padding:36px 32px">
      <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#f59e0b;text-transform:uppercase;letter-spacing:0.1em">Tip for you</p>
      <h1 style="margin:8px 0 16px;font-size:20px;font-weight:700;color:#f1f5f9">You've used ${opts.paperCount} pay-as-you-go papers</h1>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#94a3b8">
        At this rate a subscription saves you money. Student Pro at $19.99/month includes 8 papers — already cheaper than what you've spent on PAYG.
      </p>
      <a href="https://lightspeedghost.com/billing" style="display:inline-block;background:#f59e0b;color:#000;font-size:13px;font-weight:600;padding:12px 24px;border-radius:8px;text-decoration:none">See plans →</a>
    </div>
  </div>
</body></html>`;
}
