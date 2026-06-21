import { useState } from "react";
import { useLocation } from "wouter";
import { Mail, Lock, Eye, EyeOff, AlertCircle, Loader2, ArrowRight, CheckCircle } from "lucide-react";
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
    <div className="min-h-screen bg-[#04080f] flex flex-col items-center justify-center px-6 py-16">
      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-blue-600/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Centered logo */}
        <div className="flex justify-center mb-10">
          <Link href="/">
            <Logo size={30} textSize="text-base" className="cursor-pointer" />
          </Link>
        </div>

        <div className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden shadow-2xl shadow-black/30">
          {/* Tab switcher */}
          <div className="flex border-b border-white/10">
            {(["login", "signup"] as const).map((t) => (
              <button
                key={t}
                onClick={() => switchTab(t)}
                className={`flex-1 py-4 text-sm font-semibold transition-all ${
                  tab === t
                    ? "text-white border-b-2 border-blue-500 bg-blue-500/5"
                    : "text-white/40 hover:text-white/60"
                }`}
              >
                {t === "login" ? "Sign In" : "Create Account"}
              </button>
            ))}
          </div>

          <div className="p-8">
            {status === "done" ? (
              <div className="text-center py-4">
                <div className="w-14 h-14 bg-green-500/10 border border-green-500/20 rounded-full flex items-center justify-center mx-auto mb-5">
                  <CheckCircle size={28} className="text-green-400" />
                </div>
                <h2 className="text-xl font-bold text-white mb-2">
                  {forgot ? "Check your email" : tab === "login" ? "Welcome back!" : "Account created!"}
                </h2>
                <p className="text-white/50 text-sm mb-6">
                  {forgot
                    ? `If an account exists for ${email}, a password reset link is on its way. The link opens a page where you can set a new password.`
                    : "Redirecting you to the app…"}
                </p>
                {forgot && (
                  <button onClick={closeForgot} className="text-blue-400 hover:text-blue-300 text-sm transition-colors">
                    ← Back to sign in
                  </button>
                )}
              </div>
            ) : (
              <>
                <h2 className="text-2xl font-bold text-white mb-1">
                  {forgot ? "Reset your password" : tab === "login" ? "Welcome back" : "Create your account"}
                </h2>
                <p className="text-white/40 text-sm mb-6">
                  {forgot
                    ? "Enter your account email and we'll send you a link to set a new password."
                    : tab === "login"
                    ? "Sign in to your Light Speed Ghost account"
                    : "Starter plan from $9.99/month — cancel any time"}
                </p>

                {/* Google OAuth — hidden during password reset */}
                {!forgot && (
                  <>
                    <button
                      type="button"
                      onClick={handleGoogleLogin}
                      disabled={status === "loading"}
                      className="w-full flex items-center justify-center gap-3 py-2.5 mb-5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {GOOGLE_ICON}
                      Continue with Google
                    </button>

                    <div className="flex items-center gap-3 mb-5">
                      <div className="flex-1 h-px bg-white/10" />
                      <span className="text-xs text-white/25">or</span>
                      <div className="flex-1 h-px bg-white/10" />
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
                      <label className="block text-sm text-white/60">Password</label>
                      {tab === "login" && (
                        <button type="button" onClick={openForgot}
                          className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
                      <input
                        type={showPw ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        minLength={8}
                        className="w-full pl-10 pr-10 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/20 text-sm focus:outline-none focus:border-blue-500/50 focus:bg-white/8 transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw(!showPw)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                      >
                        {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm password — signup only */}
                  {tab === "signup" && (
                    <div>
                      <label className="block text-sm text-white/60 mb-1.5">Confirm Password</label>
                      <div className="relative">
                        <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
                        <input
                          type={showConfirmPw ? "text" : "password"}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="••••••••"
                          required
                          className={`w-full pl-10 pr-10 py-2.5 bg-white/5 border rounded-xl text-white placeholder-white/20 text-sm focus:outline-none focus:bg-white/8 transition-colors ${
                            confirmPassword && confirmPassword !== password
                              ? "border-red-500/40 focus:border-red-500/60"
                              : confirmPassword && confirmPassword === password
                              ? "border-green-500/40 focus:border-green-500/60"
                              : "border-white/10 focus:border-blue-500/50"
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPw(!showConfirmPw)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                        >
                          {showConfirmPw ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                      {confirmPassword && confirmPassword !== password && (
                        <p className="text-xs text-red-400/80 mt-1.5">Passwords do not match</p>
                      )}
                      {confirmPassword && confirmPassword === password && (
                        <p className="text-xs text-green-400/80 mt-1.5 flex items-center gap-1">
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

                <p className="text-center text-xs text-white/30 mt-6">
                  {forgot ? (
                    <>Remembered your password?{" "}
                      <button onClick={closeForgot} className="text-blue-400 hover:text-blue-300 transition-colors">
                        Back to sign in
                      </button>
                    </>
                  ) : tab === "login" ? (
                    <>No account?{" "}
                      <button onClick={() => switchTab("signup")} className="text-blue-400 hover:text-blue-300 transition-colors">
                        Create one free
                      </button>
                    </>
                  ) : (
                    <>Already have an account?{" "}
                      <button onClick={() => switchTab("login")} className="text-blue-400 hover:text-blue-300 transition-colors">
                        Sign in
                      </button>
                    </>
                  )}
                </p>
              </>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-white/20 mt-6">
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}

function EmailInput({ email, setEmail }: { email: string; setEmail: (v: string) => void }) {
  return (
    <div>
      <label className="block text-sm text-white/60 mb-1.5">Email</label>
      <div className="relative">
        <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
          required
          className="w-full pl-10 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/20 text-sm focus:outline-none focus:border-blue-500/50 focus:bg-white/8 transition-colors"
        />
      </div>
    </div>
  );
}

function ErrorMsg({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
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
      className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 text-sm shadow-lg shadow-blue-600/20"
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
