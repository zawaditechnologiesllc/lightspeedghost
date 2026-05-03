import { useState } from "react";
import { useLocation } from "wouter";
import { Mail, Lock, Eye, EyeOff, AlertCircle, Loader2, ArrowRight, CheckCircle, ArrowLeft } from "lucide-react";
import { Logo } from "@/components/Logo";
import { supabase } from "@/lib/supabase";
import { Link } from "wouter";
import { SUBSCRIPTION_PLANS } from "@/lib/pricing";

const _starterPlan = SUBSCRIPTION_PLANS.find(p => p.id === "starter_monthly")!;

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.2045C17.64 8.5664 17.5827 7.9527 17.4764 7.3636H9V10.845H13.8436C13.635 11.97 13.0009 12.9232 12.0477 13.5614V15.8195H14.9564C16.6582 14.2527 17.64 11.9455 17.64 9.2045Z" fill="#4285F4"/>
      <path d="M9 18C11.43 18 13.4673 17.1941 14.9564 15.8195L12.0477 13.5614C11.2418 14.1014 10.2109 14.4205 9 14.4205C6.65591 14.4205 4.67182 12.8373 3.96409 10.71H0.957275V13.0418C2.43818 15.9832 5.48182 18 9 18Z" fill="#34A853"/>
      <path d="M3.96409 10.71C3.78409 10.17 3.68182 9.5932 3.68182 9C3.68182 8.4068 3.78409 7.83 3.96409 7.29V4.9582H0.957275C0.347727 6.1732 0 7.5477 0 9C0 10.4523 0.347727 11.8268 0.957275 13.0418L3.96409 10.71Z" fill="#FBBC05"/>
      <path d="M9 3.5795C10.3214 3.5795 11.5077 4.0336 12.4405 4.9255L15.0218 2.3441C13.4632 0.8918 11.4259 0 9 0C5.48182 0 2.43818 2.0168 0.957275 4.9582L3.96409 7.29C4.67182 5.1627 6.65591 3.5795 9 3.5795Z" fill="#EA4335"/>
    </svg>
  );
}

type Tab = "login" | "signup";
type View = "auth" | "forgot";

export default function Auth() {
  const [view, setView] = useState<View>("auth");
  const [tab, setTab] = useState<Tab>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const [, navigate] = useLocation();

  const reset = () => {
    setError("");
    setStatus("idle");
    setConfirmPassword("");
  };

  const switchTab = (t: Tab) => {
    setTab(t);
    reset();
    setPassword("");
  };

  const openForgot = () => {
    reset();
    setView("forgot");
  };

  const backToLogin = () => {
    reset();
    setView("auth");
    setTab("login");
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

  return (
    <div className="min-h-screen bg-[#04080f] flex flex-col items-center justify-center px-6 py-16">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-blue-600/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="flex justify-center mb-10">
          <Link href="/">
            <Logo size={30} textSize="text-base" className="cursor-pointer" />
          </Link>
        </div>

        <div className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden shadow-2xl shadow-black/30">

          {view === "forgot" ? (
            <ForgotPasswordView email={email} setEmail={setEmail} onBack={backToLogin} />
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
                {status === "done" ? (
                  <div className="text-center py-4">
                    <div className="w-14 h-14 bg-green-500/10 border border-green-500/20 rounded-full flex items-center justify-center mx-auto mb-5">
                      <CheckCircle size={28} className="text-green-400" />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2">
                      {tab === "login" ? "Welcome back!" : "Account created!"}
                    </h2>
                    <p className="text-white/50 text-sm mb-6">Redirecting you to the app…</p>
                  </div>
                ) : (
                  <>
                    <h2 className="text-2xl font-bold text-white mb-1">
                      {tab === "login" ? "Welcome back" : "Create your account"}
                    </h2>
                    <p className="text-white/40 text-sm mb-6">
                      {tab === "login"
                        ? "Sign in to your Light Speed Ghost account"
                        : `Starter plan from ${_starterPlan.displayPrice} — cancel any time`}
                    </p>

                    <GoogleButton />

                    <div className="flex items-center gap-3 my-4">
                      <div className="flex-1 h-px bg-white/10" />
                      <span className="text-xs text-white/30">or continue with email</span>
                      <div className="flex-1 h-px bg-white/10" />
                    </div>

                    <form
                      onSubmit={tab === "login" ? handleLogin : handleSignup}
                      className="space-y-4"
                    >
                      <EmailInput email={email} setEmail={setEmail} />

                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-sm text-white/60">Password</label>
                          {tab === "login" && (
                            <button
                              type="button"
                              onClick={openForgot}
                              className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                            >
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

                      {error && <ErrorMsg text={error} />}

                      <SubmitBtn
                        status={status}
                        label={tab === "login" ? "Sign In" : "Create Free Account"}
                      />
                    </form>

                    <p className="text-center text-xs text-white/30 mt-6">
                      {tab === "login" ? (
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

function ForgotPasswordView({
  email,
  setEmail,
  onBack,
}: {
  email: string;
  setEmail: (v: string) => void;
  onBack: () => void;
}) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
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
      setStatus("done");
    }
  }

  return (
    <div className="p-8">
      {status === "done" ? (
        <div className="text-center py-4">
          <div className="w-14 h-14 bg-blue-500/10 border border-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-5">
            <Mail size={26} className="text-blue-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Check your inbox</h2>
          <p className="text-white/50 text-sm mb-6">
            We sent a password reset link to <span className="text-white/80">{email}</span>. Check your spam folder if you don't see it.
          </p>
          <button
            onClick={onBack}
            className="text-sm text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1.5 mx-auto"
          >
            <ArrowLeft size={14} /> Back to sign in
          </button>
        </div>
      ) : (
        <>
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors mb-6"
          >
            <ArrowLeft size={13} /> Back to sign in
          </button>

          <h2 className="text-2xl font-bold text-white mb-1">Forgot password?</h2>
          <p className="text-white/40 text-sm mb-6">
            Enter your email and we'll send you a reset link.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <EmailInput email={email} setEmail={setEmail} />

            {error && <ErrorMsg text={error} />}

            <button
              type="submit"
              disabled={status === "loading"}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 text-sm shadow-lg shadow-blue-600/20"
            >
              {status === "loading" ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Mail size={15} />
              )}
              {status === "loading" ? "Sending…" : "Send reset link"}
            </button>
          </form>
        </>
      )}
    </div>
  );
}

function GoogleButton() {
  const [loading, setLoading] = useState(false);

  async function handleGoogle() {
    setLoading(true);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setLoading(false);
  }

  return (
    <button
      type="button"
      onClick={handleGoogle}
      disabled={loading}
      className="w-full flex items-center justify-center gap-3 py-2.5 bg-white hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed text-gray-800 font-semibold rounded-xl transition-colors text-sm shadow-sm"
    >
      {loading ? <Loader2 size={18} className="animate-spin text-gray-500" /> : <GoogleIcon />}
      Continue with Google
    </button>
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
