import { useState } from "react";
import { useLocation } from "wouter";
import { Mail, Lock, Eye, EyeOff, AlertCircle, Loader2, ArrowRight, CheckCircle } from "lucide-react";
import { Logo } from "@/components/Logo";
import { supabase } from "@/lib/supabase";
import { Link } from "wouter";

type Tab = "login" | "signup";

export default function Auth() {
  const [tab, setTab] = useState<Tab>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [, navigate] = useLocation();

  const reset = () => {
    setError("");
    setStatus("idle");
    setEmailSent(false);
  };

  const switchTab = (t: Tab) => {
    setTab(t);
    reset();
    setForgotMode(false);
  };

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

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setStatus("loading");

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/confirm-email`,
      },
    });

    if (error) {
      setError(error.message);
      setStatus("error");
    } else {
      setEmailSent(true);
      setStatus("done");
    }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setStatus("loading");

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setError(error.message);
      setStatus("error");
    } else {
      setEmailSent(true);
      setStatus("done");
    }
  }

  async function handleGoogleSignIn() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/app` },
    });
  }

  return (
    <div className="min-h-screen bg-[#04080f] flex flex-col items-center justify-center px-6 py-16">
      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-blue-600/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative w-full max-w-md">
        <Link href="/">
          <Logo size={30} textSize="text-base" className="mb-10 w-fit cursor-pointer" />
        </Link>

        <div className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden shadow-2xl shadow-black/30">
          {/* Forgot password flow */}
          {forgotMode ? (
            <div className="p-8">
              {emailSent ? (
                <div className="text-center py-4">
                  <div className="w-14 h-14 bg-green-500/10 border border-green-500/20 rounded-full flex items-center justify-center mx-auto mb-5">
                    <CheckCircle size={28} className="text-green-400" />
                  </div>
                  <h2 className="text-xl font-bold text-white mb-2">Check your inbox</h2>
                  <p className="text-white/50 text-sm mb-6">
                    We sent a reset link to <span className="text-white/70">{email}</span>
                  </p>
                  <button
                    onClick={() => { setForgotMode(false); reset(); }}
                    className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    Back to sign in
                  </button>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => { setForgotMode(false); reset(); }}
                    className="text-xs text-white/40 hover:text-white/60 mb-6 flex items-center gap-1 transition-colors"
                  >
                    ← Back to sign in
                  </button>
                  <h2 className="text-xl font-bold text-white mb-1">Reset your password</h2>
                  <p className="text-white/45 text-sm mb-6">We'll send a reset link to your email.</p>
                  <form onSubmit={handleForgotPassword} className="space-y-4">
                    <EmailInput email={email} setEmail={setEmail} />
                    {error && <ErrorMsg text={error} />}
                    <SubmitBtn status={status} label="Send reset link" />
                  </form>
                </>
              )}
            </div>
          ) : (
            <>
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
                {/* Email confirmed / signup done */}
                {emailSent && tab === "signup" ? (
                  <div className="text-center py-4">
                    <div className="w-14 h-14 bg-blue-500/10 border border-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-5">
                      <Mail size={28} className="text-blue-400" />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2">Check your inbox</h2>
                    <p className="text-white/50 text-sm mb-6">
                      We sent a confirmation link to{" "}
                      <span className="text-white/70">{email}</span>. Click it to activate your account.
                    </p>
                    <button
                      onClick={() => { switchTab("login"); }}
                      className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      Back to sign in
                    </button>
                  </div>
                ) : (
                  <>
                    <h2 className="text-2xl font-bold text-white mb-1">
                      {tab === "login" ? "Welcome back" : "Get started free"}
                    </h2>
                    <p className="text-white/40 text-sm mb-6">
                      {tab === "login"
                        ? "Sign in to your Light Speed Ghost account"
                        : "No credit card required"}
                    </p>

                    {/* Google OAuth */}
                    <button
                      type="button"
                      onClick={handleGoogleSignIn}
                      className="w-full flex items-center justify-center gap-2.5 py-2.5 border border-white/15 hover:border-white/30 rounded-xl text-white/70 hover:text-white text-sm font-medium transition-all hover:bg-white/5 mb-5"
                    >
                      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                      Continue with Google
                    </button>

                    <div className="flex items-center gap-3 mb-5">
                      <div className="flex-1 border-t border-white/10" />
                      <span className="text-white/25 text-xs">or continue with email</span>
                      <div className="flex-1 border-t border-white/10" />
                    </div>

                    <form
                      onSubmit={tab === "login" ? handleLogin : handleSignup}
                      className="space-y-4"
                    >
                      <EmailInput email={email} setEmail={setEmail} />

                      <div>
                        <label className="block text-sm text-white/60 mb-1.5">Password</label>
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

                      {tab === "login" && (
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => { setForgotMode(true); reset(); }}
                            className="text-xs text-blue-400/70 hover:text-blue-400 transition-colors"
                          >
                            Forgot password?
                          </button>
                        </div>
                      )}

                      {error && <ErrorMsg text={error} />}

                      <SubmitBtn
                        status={status}
                        label={tab === "login" ? "Sign In" : "Create Free Account"}
                      />
                    </form>

                    <p className="text-center text-xs text-white/30 mt-6">
                      {tab === "login" ? (
                        <>No account? <button onClick={() => switchTab("signup")} className="text-blue-400 hover:text-blue-300 transition-colors">Create one free</button></>
                      ) : (
                        <>Already have an account? <button onClick={() => switchTab("login")} className="text-blue-400 hover:text-blue-300 transition-colors">Sign in</button></>
                      )}
                    </p>
                  </>
                )}
              </div>
            </>
          )}
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
          placeholder="you@university.edu"
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
