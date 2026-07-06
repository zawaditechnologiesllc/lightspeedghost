import { useState } from "react";
import { useLocation } from "wouter";
import { Mail, Lock, Eye, EyeOff, AlertCircle, Loader2, ArrowRight, CheckCircle, ShieldCheck, Sparkles, Database } from "lucide-react";
import { Logo } from "@/components/Logo";
import { supabase } from "@/lib/supabase";
import { Link } from "wouter";

const GOOGLE_ICON = (
  <svg width="18" height="18" viewBox="0 0 48 48" fill="none">
    <path d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 5.1 29.6 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21c10.5 0 20-7.8 20-21 0-1.4-.2-2.7-.5-4z" fill="#FFC107"/>
    <path d="M6.3 14.7l7 5.1C15.1 16.1 19.2 13 24 13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 5.1 29.6 3 24 3c-7.6 0-14.2 4.3-17.7 10.7z" fill="#FF3D00"/>
    <path d="M24 45c5.5 0 10.5-2 14.3-5.3l-6.6-5.6C29.7 35.9 27 37 24 37c-6 0-10.6-3.9-11.8-9.2l-7 5.4C8 39.6 15.4 45 24 45z" fill="#4CAF50"/>
    <path d="M44.5 20H24v8.5h11.8c-.9 2.7-2.7 4.9-5.1 6.4l6.6 5.6C41.4 36.9 45 31 45 24c0-1.4-.2-2.7-.5-4z" fill="#1976D2"/>
  </svg>
);

type Tab = "login" | "signup";

export default function Auth() {
  const [tab, setTab] = useState<Tab>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const [forgot, setForgot] = useState(false);
  const [, navigate] = useLocation();

  const reset = () => {
    setError("");
    setStatus("idle");
    setConfirmPassword("");
  };

  const switchTab = (t: Tab) => {
    setTab(t);
    setForgot(false);
    reset();
    setPassword("");
  };

  const openForgot = () => { setForgot(true); reset(); };
  const closeForgot = () => { setForgot(false); reset(); };

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setStatus("loading");

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setStatus("error");
    } else {
      setStatus("done");
      navigate("/app");
    }
  }

  async function handleGoogleLogin() {
    setError("");
    setStatus("loading");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setError(error.message);
      setStatus("error");
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setStatus("loading");

    const { error } = await supabase.auth.signUp({ email, password });

    if (error) {
      setError(error.message);
      setStatus("error");
    } else {
      setStatus("done");
      navigate("/app");
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setStatus("loading");
    // Supabase sends the reset email; the link returns the user to
    // /reset-password (a recovery session is established there) where the
    // existing ResetPassword page lets them set a new password.
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      setError(error.message);
      setStatus("error");
    } else {
      setStatus("done");
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f9fb] text-[#191c1e] antialiased flex flex-col">
      {/* ─── Top bar ─── */}
      <header className="w-full border-b border-[#e0e3e5] bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/">
            <Logo size={30} textSize="text-base" variant="light" className="cursor-pointer select-none" />
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={() => switchTab("login")}
              className={`px-4 py-2 text-sm rounded-lg transition-colors ${tab === "login" && !forgot ? "text-[#6b38d4] font-semibold" : "text-[#45464d] hover:bg-[#f2f4f6]"}`}
            >
              Log In
            </button>
            <button
              onClick={() => switchTab("signup")}
              className="px-5 py-2 text-sm bg-[#6b38d4] hover:bg-[#5b2fc0] text-white font-semibold rounded-lg transition-colors shadow-md shadow-[#6b38d4]/20"
            >
              Sign Up
            </button>
          </div>
        </div>
      </header>

      {/* ─── Split-screen main ─── */}
      <main className="flex-grow grid grid-cols-1 lg:grid-cols-2">
        {/* Brand / visual side — hidden on mobile */}
        <div className="hidden lg:flex relative bg-[#131b2e] overflow-hidden items-center justify-center p-12">
          <div
            className="absolute inset-0 opacity-40 pointer-events-none"
            style={{
              background:
                "radial-gradient(at 20% 20%, rgba(107, 56, 212, 0.35) 0px, transparent 50%), radial-gradient(at 80% 80%, rgba(76, 215, 246, 0.18) 0px, transparent 50%)",
            }}
          />
          <div className="relative z-10 w-full max-w-lg">
            <span className="inline-block px-3 py-1 bg-white/10 text-[#c4b5fd] rounded-full text-xs font-bold uppercase tracking-wider mb-6">Writes from real papers — not from memory</span>
            <h1 className="text-3xl xl:text-4xl font-bold text-white mb-5 leading-[1.15]" style={{ letterSpacing: "-0.02em" }}>
              Every other AI writes from memory.{" "}
              <span className="text-[#c4b5fd]">Light Speed Ghost writes from real academic papers.</span>
            </h1>
            <p className="text-base text-[#9aa3bd] leading-relaxed mb-10">
              35+ databases, 10 billion+ indexed papers. Upload your rubric, your notes, your materials — your paper is built on actual research, cross-checked against your A-grade criteria, targeting 92% and above. High school to PhD. One subscription.
            </p>

            {/* Decorative feature card */}
            <div className="bg-white/5 border border-white/10 backdrop-blur-md rounded-xl p-5 shadow-xl space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#6b38d4]/30 flex items-center justify-center">
                  <Sparkles size={16} className="text-[#c4b5fd]" />
                </div>
                <div className="h-2 w-32 bg-white/20 rounded-full" />
              </div>
              <div className="space-y-2.5">
                <div className="h-3 w-full bg-white/10 rounded-full" />
                <div className="h-3 w-3/4 bg-white/10 rounded-full" />
              </div>
            </div>

            {/* Trust points */}
            <div className="mt-8 space-y-3">
              {[
                { icon: Database, text: "Real, clickable citations — never fabricated" },
                { icon: ShieldCheck, text: "Cross-checked to A-grade criteria, plagiarism under 8%" },
                { icon: CheckCircle, text: "4M+ students · 200+ universities worldwide" },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-3 text-sm text-white/70">
                  <Icon size={15} className="text-[#4cd7f6] shrink-0" />
                  {text}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Form side */}
        <div className="flex items-center justify-center p-6 sm:p-10 lg:p-12">
          <div className="w-full max-w-sm">
            {status === "done" ? (
              <div className="text-center py-8">
                <div className="w-14 h-14 bg-emerald-50 border border-emerald-200 rounded-full flex items-center justify-center mx-auto mb-5">
                  <CheckCircle size={28} className="text-emerald-600" />
                </div>
                <h2 className="text-2xl font-bold text-[#131b2e] mb-2">
                  {forgot ? "Check your email" : tab === "login" ? "Welcome back!" : "Account created!"}
                </h2>
                <p className="text-[#45464d] text-sm mb-6">
                  {forgot
                    ? `If an account exists for ${email}, a password reset link is on its way. The link opens a page where you can set a new password.`
                    : "Redirecting you to the app…"}
                </p>
                {forgot && (
                  <button onClick={closeForgot} className="text-[#6b38d4] hover:text-[#5b2fc0] text-sm font-medium transition-colors">
                    ← Back to sign in
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="mb-8 text-center lg:text-left">
                  <div className="flex justify-center lg:hidden mb-6">
                    <Logo size={28} textSize="text-base" variant="light" />
                  </div>
                  <h2 className="text-3xl font-bold text-[#131b2e] mb-2" style={{ letterSpacing: "-0.01em" }}>
                    {forgot ? "Reset your password" : tab === "login" ? "Welcome back" : "Create your account"}
                  </h2>
                  <p className="text-[#45464d] text-sm">
                    {forgot
                      ? "Enter your account email and we'll send you a link to set a new password."
                      : tab === "login"
                      ? "Sign in to your Light Speed Ghost account"
                      : "Starter plan from $9.99/month — cancel any time"}
                  </p>
                </div>

                {/* Google OAuth — hidden during password reset */}
                {!forgot && (
                  <>
                    <button
                      type="button"
                      onClick={handleGoogleLogin}
                      disabled={status === "loading"}
                      className="w-full flex items-center justify-center gap-3 py-3 mb-6 bg-white hover:bg-[#f2f4f6] border border-[#c6c6cd] hover:border-[#76777d] rounded-lg text-[#191c1e] text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                    >
                      {GOOGLE_ICON}
                      Continue with Google
                    </button>

                    <div className="flex items-center gap-3 mb-6">
                      <div className="flex-1 h-px bg-[#e0e3e5]" />
                      <span className="text-xs text-[#76777d] uppercase tracking-wide">or</span>
                      <div className="flex-1 h-px bg-[#e0e3e5]" />
                    </div>
                  </>
                )}

                <form
                  onSubmit={forgot ? handleForgot : tab === "login" ? handleLogin : handleSignup}
                  className="space-y-4"
                >
                  <EmailInput email={email} setEmail={setEmail} />

                  {/* Password — hidden during password reset */}
                  {!forgot && (
                  <>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-sm font-medium text-[#45464d]">Password</label>
                      {tab === "login" && (
                        <button type="button" onClick={openForgot}
                          className="text-xs text-[#6b38d4] hover:text-[#5b2fc0] font-medium transition-colors">
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#76777d]" />
                      <input
                        type={showPw ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        minLength={8}
                        className="w-full pl-10 pr-10 py-3 bg-white border border-[#c6c6cd] rounded-lg text-[#191c1e] placeholder-[#76777d] text-sm focus:outline-none focus:border-[#6b38d4] focus:ring-1 focus:ring-[#6b38d4] transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw(!showPw)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#76777d] hover:text-[#191c1e] transition-colors"
                      >
                        {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm password — signup only */}
                  {tab === "signup" && (
                    <div>
                      <label className="block text-sm font-medium text-[#45464d] mb-1.5">Confirm Password</label>
                      <div className="relative">
                        <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#76777d]" />
                        <input
                          type={showConfirmPw ? "text" : "password"}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="••••••••"
                          required
                          className={`w-full pl-10 pr-10 py-3 bg-white border rounded-lg text-[#191c1e] placeholder-[#76777d] text-sm focus:outline-none focus:ring-1 transition-colors ${
                            confirmPassword && confirmPassword !== password
                              ? "border-red-400 focus:border-red-500 focus:ring-red-500"
                              : confirmPassword && confirmPassword === password
                              ? "border-emerald-400 focus:border-emerald-500 focus:ring-emerald-500"
                              : "border-[#c6c6cd] focus:border-[#6b38d4] focus:ring-[#6b38d4]"
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPw(!showConfirmPw)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#76777d] hover:text-[#191c1e] transition-colors"
                        >
                          {showConfirmPw ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                      {confirmPassword && confirmPassword !== password && (
                        <p className="text-xs text-red-500 mt-1.5">Passwords do not match</p>
                      )}
                      {confirmPassword && confirmPassword === password && (
                        <p className="text-xs text-emerald-600 mt-1.5 flex items-center gap-1">
                          <CheckCircle size={11} /> Passwords match
                        </p>
                      )}
                    </div>
                  )}
                  </>
                  )}

                  {error && <ErrorMsg text={error} />}

                  <SubmitBtn
                    status={status}
                    label={forgot ? "Send reset link" : tab === "login" ? "Sign In" : "Create Free Account"}
                  />
                </form>

                <p className="text-center text-sm text-[#45464d] mt-6">
                  {forgot ? (
                    <>Remembered your password?{" "}
                      <button onClick={closeForgot} className="text-[#6b38d4] hover:text-[#5b2fc0] font-semibold transition-colors">
                        Back to sign in
                      </button>
                    </>
                  ) : tab === "login" ? (
                    <>No account?{" "}
                      <button onClick={() => switchTab("signup")} className="text-[#6b38d4] hover:text-[#5b2fc0] font-semibold transition-colors">
                        Create one free
                      </button>
                    </>
                  ) : (
                    <>Already have an account?{" "}
                      <button onClick={() => switchTab("login")} className="text-[#6b38d4] hover:text-[#5b2fc0] font-semibold transition-colors">
                        Sign in
                      </button>
                    </>
                  )}
                </p>

                <p className="text-center text-[11px] leading-relaxed text-[#76777d] max-w-[280px] mx-auto mt-6">
                  By continuing, you agree to our{" "}
                  <Link href="/terms"><span className="underline hover:text-[#45464d] transition-colors cursor-pointer">Terms of Service</span></Link>{" "}
                  and{" "}
                  <Link href="/privacy"><span className="underline hover:text-[#45464d] transition-colors cursor-pointer">Privacy Policy</span></Link>.
                </p>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function EmailInput({ email, setEmail }: { email: string; setEmail: (v: string) => void }) {
  return (
    <div>
      <label className="block text-sm font-medium text-[#45464d] mb-1.5">Email Address</label>
      <div className="relative">
        <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#76777d]" />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@email.com"
          required
          className="w-full pl-10 py-3 bg-white border border-[#c6c6cd] rounded-lg text-[#191c1e] placeholder-[#76777d] text-sm focus:outline-none focus:border-[#6b38d4] focus:ring-1 focus:ring-[#6b38d4] transition-colors"
        />
      </div>
    </div>
  );
}

function ErrorMsg({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
      <AlertCircle size={14} className="shrink-0" />
      {text}
    </div>
  );
}

function SubmitBtn({ status, label }: { status: string; label: string }) {
  return (
    <button
      type="submit"
      disabled={status === "loading"}
      className="w-full py-3 bg-[#6b38d4] hover:bg-[#5b2fc0] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2 text-sm shadow-md shadow-[#6b38d4]/20"
    >
      {status === "loading" ? (
        <Loader2 size={15} className="animate-spin" />
      ) : (
        <ArrowRight size={15} />
      )}
      {status === "loading" ? "Please wait…" : label}
    </button>
  );
}
