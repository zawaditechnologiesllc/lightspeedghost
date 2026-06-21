# Email setup — move everything to Resend (off Zoho SMTP)

There are **two** kinds of email LightspeedGhost sends. Only one of them was still
on Zoho:

| Email | Sent by | Status |
|-------|---------|--------|
| Welcome, contact replies, enterprise leads | **the app** (`lib/email.ts` → Resend API) | ✅ already Resend — just needs the env keys set (below) |
| Sign-up confirmation, password reset, magic link, email change | **Supabase Auth** (its configured SMTP) | ⛔ this is the Zoho one — switch its SMTP to Resend + paste the branded templates below |

Do the three steps once and nothing leaves Zoho again.

---

## Step 1 — Verify your domain in Resend (required for both)

1. Resend → **Domains** → **Add Domain** → `lightspeedghost.com`.
2. Add the DNS records Resend shows you at your registrar (SPF/`MX`, DKIM `resend._domainkey`, and the DMARC record). Wait for **Verified**.
3. Resend → **API Keys** → create a key with **Sending** access. Copy it.

> Until the domain is verified, Resend will only let you send to your own address.

---

## Step 2 — Set the app's env vars in Render (turns on app emails)

The app emails (welcome, contact, enterprise) are **no-ops right now** because the
key isn't set — your startup logs show `optional env var not set: RESEND_API_KEY`.
In **Render → your service → Environment**, add:

| Var | Value |
|-----|-------|
| `RESEND_API_KEY` | the key from Step 1 |
| `EMAIL_FROM` | `LightSpeed Ghost <hello@lightspeedghost.com>` (must be on the verified domain) |

Save → Render redeploys → welcome/contact/enterprise emails now send via Resend.

---

## Step 3 — Point Supabase Auth at Resend (kills the Zoho path)

**Supabase Dashboard → Project → Authentication → Emails → SMTP Settings →
Enable Custom SMTP:**

| Field | Value |
|-------|-------|
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | your **Resend API key** (same one from Step 1) |
| Sender email | `hello@lightspeedghost.com` (on the verified domain) |
| Sender name | `LightSpeed Ghost` |

Save. From now on every Supabase auth email is delivered by Resend, not Zoho. You
can delete the Zoho SMTP credentials.

> Tip: also set **Authentication → URL Configuration → Site URL** to
> `https://lightspeedghost.com` and add `https://lightspeedghost.com/**` to the
> redirect allowlist, so the links in these emails resolve correctly.

---

## Step 4 — Paste the branded templates

**Supabase → Authentication → Emails → Templates.** For each tab, set the
**Subject** and replace the **Message body (HTML)** with the matching block below.
The `{{ .ConfirmationURL }}` / `{{ .Token }}` placeholders are Supabase variables —
leave them exactly as written.

All six share one dark, on-brand style (matching the app's transactional emails).

### Confirm sign-up
**Subject:** `Confirm your LightSpeed Ghost account`

```html
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a12;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e2e8f0">
  <div style="max-width:560px;margin:40px auto;padding:0 20px">
    <div style="background:#111827;border:1px solid #1e293b;border-radius:16px;padding:36px 32px">
      <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#3b82f6;text-transform:uppercase;letter-spacing:0.1em">LightSpeed Ghost</p>
      <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#f1f5f9">Confirm your email ✉️</h1>
      <p style="margin:0 0 24px;font-size:14px;line-height:1.7;color:#94a3b8">
        Welcome! Tap the button below to confirm your address and unlock the AI paper writer, humanizer, STEM solver, plagiarism checker, and study assistant.
      </p>
      <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#3b82f6;color:#fff;font-size:14px;font-weight:600;padding:13px 26px;border-radius:10px;text-decoration:none">Confirm my account →</a>
      <p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#64748b">
        If the button doesn't work, copy and paste this link:<br>
        <a href="{{ .ConfirmationURL }}" style="color:#3b82f6;word-break:break-all">{{ .ConfirmationURL }}</a>
      </p>
      <p style="margin:20px 0 0;font-size:11px;color:#475569">
        Didn't create an account? You can safely ignore this email.<br>
        LightSpeed Ghost · <a href="https://lightspeedghost.com/terms" style="color:#475569">Terms</a> · <a href="https://lightspeedghost.com/privacy" style="color:#475569">Privacy</a>
      </p>
    </div>
  </div>
</body>
</html>
```

### Reset password
**Subject:** `Reset your LightSpeed Ghost password`

```html
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a12;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e2e8f0">
  <div style="max-width:560px;margin:40px auto;padding:0 20px">
    <div style="background:#111827;border:1px solid #1e293b;border-radius:16px;padding:36px 32px">
      <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#3b82f6;text-transform:uppercase;letter-spacing:0.1em">LightSpeed Ghost</p>
      <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#f1f5f9">Reset your password 🔑</h1>
      <p style="margin:0 0 24px;font-size:14px;line-height:1.7;color:#94a3b8">
        We received a request to reset your password. Tap below to choose a new one. This link expires in 60 minutes.
      </p>
      <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#3b82f6;color:#fff;font-size:14px;font-weight:600;padding:13px 26px;border-radius:10px;text-decoration:none">Choose a new password →</a>
      <p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#64748b">
        If the button doesn't work, copy and paste this link:<br>
        <a href="{{ .ConfirmationURL }}" style="color:#3b82f6;word-break:break-all">{{ .ConfirmationURL }}</a>
      </p>
      <p style="margin:20px 0 0;font-size:11px;color:#475569">
        Didn't request this? Your password is unchanged — you can ignore this email.<br>
        LightSpeed Ghost · <a href="https://lightspeedghost.com/terms" style="color:#475569">Terms</a> · <a href="https://lightspeedghost.com/privacy" style="color:#475569">Privacy</a>
      </p>
    </div>
  </div>
</body>
</html>
```

### Magic link
**Subject:** `Your LightSpeed Ghost sign-in link`

```html
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a12;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e2e8f0">
  <div style="max-width:560px;margin:40px auto;padding:0 20px">
    <div style="background:#111827;border:1px solid #1e293b;border-radius:16px;padding:36px 32px">
      <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#3b82f6;text-transform:uppercase;letter-spacing:0.1em">LightSpeed Ghost</p>
      <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#f1f5f9">Your sign-in link ⚡</h1>
      <p style="margin:0 0 24px;font-size:14px;line-height:1.7;color:#94a3b8">
        Tap below to sign in to LightSpeed Ghost. This link works once and expires shortly.
      </p>
      <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#3b82f6;color:#fff;font-size:14px;font-weight:600;padding:13px 26px;border-radius:10px;text-decoration:none">Sign in →</a>
      <p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#64748b">
        If the button doesn't work, copy and paste this link:<br>
        <a href="{{ .ConfirmationURL }}" style="color:#3b82f6;word-break:break-all">{{ .ConfirmationURL }}</a>
      </p>
      <p style="margin:20px 0 0;font-size:11px;color:#475569">
        Didn't try to sign in? Ignore this email.<br>
        LightSpeed Ghost · <a href="https://lightspeedghost.com/privacy" style="color:#475569">Privacy</a>
      </p>
    </div>
  </div>
</body>
</html>
```

### Change email address
**Subject:** `Confirm your new LightSpeed Ghost email`

```html
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a12;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e2e8f0">
  <div style="max-width:560px;margin:40px auto;padding:0 20px">
    <div style="background:#111827;border:1px solid #1e293b;border-radius:16px;padding:36px 32px">
      <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#3b82f6;text-transform:uppercase;letter-spacing:0.1em">LightSpeed Ghost</p>
      <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#f1f5f9">Confirm your new email</h1>
      <p style="margin:0 0 24px;font-size:14px;line-height:1.7;color:#94a3b8">
        Tap below to confirm this address as the new email on your LightSpeed Ghost account.
      </p>
      <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#3b82f6;color:#fff;font-size:14px;font-weight:600;padding:13px 26px;border-radius:10px;text-decoration:none">Confirm new email →</a>
      <p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#64748b">
        If the button doesn't work, copy and paste this link:<br>
        <a href="{{ .ConfirmationURL }}" style="color:#3b82f6;word-break:break-all">{{ .ConfirmationURL }}</a>
      </p>
      <p style="margin:20px 0 0;font-size:11px;color:#475569">
        Didn't request this change? Contact support immediately.<br>
        LightSpeed Ghost · <a href="https://lightspeedghost.com/contact" style="color:#475569">Contact</a>
      </p>
    </div>
  </div>
</body>
</html>
```

### Invite user
**Subject:** `You've been invited to LightSpeed Ghost`

```html
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a12;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e2e8f0">
  <div style="max-width:560px;margin:40px auto;padding:0 20px">
    <div style="background:#111827;border:1px solid #1e293b;border-radius:16px;padding:36px 32px">
      <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#3b82f6;text-transform:uppercase;letter-spacing:0.1em">LightSpeed Ghost</p>
      <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#f1f5f9">You're invited 🎓</h1>
      <p style="margin:0 0 24px;font-size:14px;line-height:1.7;color:#94a3b8">
        You've been invited to join LightSpeed Ghost — the academic AI platform for writing, humanizing, solving STEM, and more. Accept your invite to get started.
      </p>
      <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#3b82f6;color:#fff;font-size:14px;font-weight:600;padding:13px 26px;border-radius:10px;text-decoration:none">Accept invitation →</a>
      <p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#64748b">
        If the button doesn't work, copy and paste this link:<br>
        <a href="{{ .ConfirmationURL }}" style="color:#3b82f6;word-break:break-all">{{ .ConfirmationURL }}</a>
      </p>
      <p style="margin:20px 0 0;font-size:11px;color:#475569">
        LightSpeed Ghost · <a href="https://lightspeedghost.com/terms" style="color:#475569">Terms</a> · <a href="https://lightspeedghost.com/privacy" style="color:#475569">Privacy</a>
      </p>
    </div>
  </div>
</body>
</html>
```

### Reauthentication (OTP code)
**Subject:** `Your LightSpeed Ghost verification code`

```html
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a12;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e2e8f0">
  <div style="max-width:560px;margin:40px auto;padding:0 20px">
    <div style="background:#111827;border:1px solid #1e293b;border-radius:16px;padding:36px 32px;text-align:center">
      <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#3b82f6;text-transform:uppercase;letter-spacing:0.1em">LightSpeed Ghost</p>
      <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#f1f5f9">Your verification code</h1>
      <p style="margin:0 0 20px;font-size:14px;line-height:1.7;color:#94a3b8">Enter this code to continue:</p>
      <p style="margin:0 0 20px;font-size:34px;font-weight:800;letter-spacing:0.3em;color:#f1f5f9">{{ .Token }}</p>
      <p style="margin:0;font-size:11px;color:#475569">This code expires shortly. Didn't request it? Ignore this email.</p>
    </div>
  </div>
</body>
</html>
```

---

## After setup — quick test

- **App email:** trigger a contact/enterprise form, or sign up, and confirm the
  welcome email arrives from `hello@lightspeedghost.com` via Resend (check Resend →
  **Logs**).
- **Auth email:** use "forgot password" on `/auth` — the reset email should arrive
  branded and via Resend (not Zoho). Resend → Logs will show it.

Everything now goes through Resend on your verified domain. Zoho can be removed.
