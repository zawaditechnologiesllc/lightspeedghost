import { useState } from "react";
import { useLocation, Link } from "wouter";
import { Mail, Lock, Eye, EyeOff, AlertCircle, Loader2, ArrowRight, CheckCircle } from "lucide-react";

// supabase is imported lazily inside each handler (not at module top) so this
// form can be pulled into the landing/prerender graph without eagerly loading
// the Supabase client — matching AuthContext's dynamic-import pattern.

// Shared auth form — the single source of truth for every login option we
// offer (Google OAuth, email + password sign-in / sign-up, forgot password).
// Deliberately plain so it drops into either the /auth page or the AuthModal
// popup without any marketing chrome.

const GOOGLE_ICON = (
  <svg width="18" height="18" viewBox="0 0 48 48" fill="none" aria-hidden="true">
    <path d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 5.1 29.6 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21c10.5 0 20-7.8 20-21 0-1.4-.2-2.7-.5-4z" fill="#FFC107"/>
    <path d="M6.3 14.7l7 5.1C15.1 16.1 19.2 13 24 13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 5.1 29.6 3 24 3c-7.6 0-14.2 4.3-17.7 10.7z" fill="#FF3D00"/>
    <path d="M24 45c5.5 0 10.5-2 14.3-5.3l-6.6-5.6C29.7 35.9 27 37 24 37c-6 0-10.6-3.9-11.8-9.2l-7 5.4C8 39.6 15.4 45 24 45z" fill="#4CAF50"/>
    <path d="M44.5 20H24v8.5h11.8c-.9 2.7-2.7 4.9-5.1 6.4l6.6 5.6C41.4 36.9 45 31 45 24c0-1.4-.2-2.7-.5-4z" fill="#1976D2"/>
  </svg>
);

export type AuthTab = "login" | "signup";

export function AuthForm({
  initialTab = "login",
  next: nextProp,
  onSuccess,
}: {
  initialTab?: AuthTab;
  /** Where to go after email/password auth. Defaults to ?next= or /app. */
  next?: string;
  /** Called after a successful email/password auth (e.g. to close a modal).
   *  If omitted, the form navigates to `next` itself. */
  onSuccess?: (dest: string) => void;
}) {
  const [tab, setTab] = useState<AuthTab>(initialTab);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const [forgot, setForgot] = useState(false);
  const [, navigate] = useLocation();

  const urlNext = (() => {
    try {
      const p = new URLSearchParams(window.location.search).get("next");
      return p && p.startsWith("/") && !p.startsWith("//") ? p : null;
    } catch { return null; }
  })();
  const next = nextProp ?? urlNext ?? "/app";

  const reset = () => { setError(""); setStatus("idle"); setConfirmPassword(""); };
  const switchTab = (t: AuthTab) => { setTab(t); setForgot(false); reset(); setPassword(""); };

  function done() {
    setStatus("done");
    if (onSuccess) onSuccess(next);
    else navigate(next);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setStatus("loading");
    const { supabase } = await import("@/lib/supabase");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setError(error.message); setStatus("error"); } else { done(); }
  }

  async function handleGoogleLogin() {
    setError(""); setStatus("loading");
    // OAuth leaves the site and returns via /auth/callback — stash the
    // destination so AppRedirect can honor it after the round-trip.
    if (next !== "/app") {
      try { sessionStorage.setItem("lsg_auth_next", next); } catch { /* non-fatal */ }
    }
    const { supabase } = await import("@/lib/supabase");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) { setError(error.message); setStatus("error"); }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }
    setStatus("loading");
    const { supabase } = await import("@/lib/supabase");
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) { setError(error.message); setStatus("error"); } else { done(); }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setStatus("loading");
    const { supabase } = await import("@/lib/supabase");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) { setError(error.message); setStatus("error"); } else { setStatus("done"); }
  }

  // Success screens (forgot-password confirmation; login/signup just redirect)
  if (status === "done" && forgot) {
    return (
      <div className="text-center py-6">
        <div className="w-12 h-12 bg-emerald-50 border border-emerald-200 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle size={24} className="text-emerald-600" />
        </div>
        <h2 className="text-lg font-bold text-[#131b2e] mb-1.5">Check your email</h2>
        <p className="text-[#45464d] text-sm mb-5">
          If an account exists for {email}, a password-reset link is on its way.
        </p>
        <button onClick={() => { setForgot(false); reset(); }} className="text-[#6b38d4] hover:text-[#5b2fc0] text-sm font-medium">
          ← Back to sign in
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5 text-center">
        <h2 className="text-xl font-bold text-[#131b2e] mb-1" style={{ letterSpacing: "-0.01em" }}>
          {forgot ? "Reset your password" : tab === "login" ? "Welcome back" : "Create your account"}
        </h2>
        <p className="text-[#45464d] text-[13px]">
          {forgot
            ? "We'll email you a link to set a new password."
            : tab === "login"
            ? "Sign in to your Light Speed Ghost account"
            : "Free plan included — no card required"}
        </p>
      </div>

      {!forgot && (
        <>
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={status === "loading"}
            className="w-full flex items-center justify-center gap-3 py-2.5 mb-4 bg-white hover:bg-[#f2f4f6] border border-[#c6c6cd] hover:border-[#76777d] rounded-lg text-[#191c1e] text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {GOOGLE_ICON}
            Continue with Google
          </button>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-[#e0e3e5]" />
            <span className="text-xs text-[#76777d] uppercase tracking-wide">or</span>
            <div className="flex-1 h-px bg-[#e0e3e5]" />
          </div>
        </>
      )}

      <form onSubmit={forgot ? handleForgot : tab === "login" ? handleLogin : handleSignup} className="space-y-3.5">
        <div>
          <label className="block text-sm font-medium text-[#45464d] mb-1.5">Email address</label>
          <div className="relative">
            <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#76777d]" />
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="name@email.com" required
              className="w-full pl-10 py-2.5 bg-white border border-[#c6c6cd] rounded-lg text-[#191c1e] placeholder-[#76777d] text-sm focus:outline-none focus:border-[#6b38d4] focus:ring-1 focus:ring-[#6b38d4] transition-colors"
            />
          </div>
        </div>

        {!forgot && (
          <>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-[#45464d]">Password</label>
                {tab === "login" && (
                  <button type="button" onClick={() => { setForgot(true); reset(); }} className="text-xs text-[#6b38d4] hover:text-[#5b2fc0] font-medium">
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#76777d]" />
                <input
                  type={showPw ? "text" : "password"} value={password}
                  onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
                  required minLength={8}
                  className="w-full pl-10 pr-10 py-2.5 bg-white border border-[#c6c6cd] rounded-lg text-[#191c1e] placeholder-[#76777d] text-sm focus:outline-none focus:border-[#6b38d4] focus:ring-1 focus:ring-[#6b38d4] transition-colors"
                />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#76777d] hover:text-[#191c1e] transition-colors">
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {tab === "signup" && (
              <div>
                <label className="block text-sm font-medium text-[#45464d] mb-1.5">Confirm password</label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#76777d]" />
                  <input
                    type={showPw ? "text" : "password"} value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" required
                    className={`w-full pl-10 pr-3 py-2.5 bg-white border rounded-lg text-[#191c1e] placeholder-[#76777d] text-sm focus:outline-none focus:ring-1 transition-colors ${
                      confirmPassword && confirmPassword !== password
                        ? "border-red-400 focus:border-red-500 focus:ring-red-500"
                        : "border-[#c6c6cd] focus:border-[#6b38d4] focus:ring-[#6b38d4]"
                    }`}
                  />
                </div>
                {confirmPassword && confirmPassword !== password && (
                  <p className="text-xs text-red-500 mt-1.5">Passwords do not match</p>
                )}
              </div>
            )}
          </>
        )}

        {error && (
          <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            <AlertCircle size={14} className="shrink-0" />
            {error}
          </div>
        )}

        <button
          type="submit" disabled={status === "loading"}
          className="w-full py-2.5 bg-[#6b38d4] hover:bg-[#5b2fc0] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2 text-sm shadow-md shadow-[#6b38d4]/20"
        >
          {status === "loading" ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}
          {status === "loading" ? "Please wait…" : forgot ? "Send reset link" : tab === "login" ? "Sign in" : "Create free account"}
        </button>
      </form>

      <p className="text-center text-sm text-[#45464d] mt-5">
        {forgot ? (
          <>Remembered it?{" "}
            <button onClick={() => { setForgot(false); reset(); }} className="text-[#6b38d4] hover:text-[#5b2fc0] font-semibold">Back to sign in</button>
          </>
        ) : tab === "login" ? (
          <>No account?{" "}
            <button onClick={() => switchTab("signup")} className="text-[#6b38d4] hover:text-[#5b2fc0] font-semibold">Create one free</button>
          </>
        ) : (
          <>Already have an account?{" "}
            <button onClick={() => switchTab("login")} className="text-[#6b38d4] hover:text-[#5b2fc0] font-semibold">Sign in</button>
          </>
        )}
      </p>

      <p className="text-center text-[11px] leading-relaxed text-[#76777d] max-w-[280px] mx-auto mt-4">
        By continuing, you agree to our{" "}
        <Link href="/terms"><span className="underline hover:text-[#45464d] cursor-pointer">Terms</span></Link>{" "}
        and{" "}
        <Link href="/privacy"><span className="underline hover:text-[#45464d] cursor-pointer">Privacy Policy</span></Link>.
      </p>
    </div>
  );
}
