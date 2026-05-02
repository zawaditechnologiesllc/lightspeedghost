import { useEffect, useState } from "react";
import { CheckCircle, AlertCircle, Loader2, ArrowRight, MailOpen } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Link, useLocation } from "wouter";
import { supabase } from "@/lib/supabase";

type Status = "verifying" | "confirmed" | "already_confirmed" | "error";

export default function ConfirmEmail() {
  const [status, setStatus] = useState<Status>("verifying");
  const [errorMsg, setErrorMsg] = useState("");
  const [, navigate] = useLocation();

  useEffect(() => {
    async function verify() {
      // ── PKCE flow: Supabase sends ?token_hash=...&type=email ──────────────
      const params = new URLSearchParams(window.location.search);
      const tokenHash = params.get("token_hash");
      const type = params.get("type") as "email" | "signup" | null;

      if (tokenHash && type) {
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
        if (error) {
          setErrorMsg(error.message);
          setStatus("error");
        } else {
          setStatus("confirmed");
          setTimeout(() => navigate("/app"), 2500);
        }
        return;
      }

      // ── Implicit flow: Supabase puts #access_token=...&type=signup in hash ─
      // The Supabase client auto-processes the hash; we just wait for the session.
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setStatus("already_confirmed");
        return;
      }

      // Listen for auth state change triggered by the hash token
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === "SIGNED_IN" && session) {
          setStatus("confirmed");
          setTimeout(() => navigate("/app"), 2500);
          subscription.unsubscribe();
        }
        if (event === "USER_UPDATED" && session) {
          setStatus("confirmed");
          setTimeout(() => navigate("/app"), 2500);
          subscription.unsubscribe();
        }
      });

      // Timeout: if no session in 6 s, show error
      const timeout = setTimeout(() => {
        subscription.unsubscribe();
        setErrorMsg("This confirmation link has expired or already been used.");
        setStatus("error");
      }, 6000);

      return () => {
        clearTimeout(timeout);
        subscription.unsubscribe();
      };
    }

    verify();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[#04080f] flex flex-col items-center justify-center px-6">
      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[350px] bg-blue-600/10 rounded-full blur-[100px]" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="flex justify-center mb-10">
          <Link href="/">
            <Logo size={30} textSize="text-base" className="cursor-pointer" />
          </Link>
        </div>

        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-8 text-center shadow-2xl shadow-black/30">

          {status === "verifying" && (
            <>
              <div className="w-14 h-14 bg-blue-500/10 border border-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-5">
                <Loader2 size={26} className="text-blue-400 animate-spin" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Confirming your email…</h2>
              <p className="text-white/45 text-sm">Just a moment while we verify your link.</p>
            </>
          )}

          {status === "confirmed" && (
            <>
              <div className="w-14 h-14 bg-green-500/10 border border-green-500/20 rounded-full flex items-center justify-center mx-auto mb-5">
                <CheckCircle size={28} className="text-green-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Email confirmed!</h2>
              <p className="text-white/50 text-sm mb-6">
                Your account is active. Taking you to the app…
              </p>
              <Link href="/app">
                <span className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-colors cursor-pointer">
                  Open Light Speed Ghost <ArrowRight size={14} />
                </span>
              </Link>
            </>
          )}

          {status === "already_confirmed" && (
            <>
              <div className="w-14 h-14 bg-blue-500/10 border border-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-5">
                <MailOpen size={26} className="text-blue-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Already confirmed</h2>
              <p className="text-white/50 text-sm mb-6">
                Your email is already verified. You're signed in and ready to go.
              </p>
              <Link href="/app">
                <span className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-colors cursor-pointer">
                  Open Light Speed Ghost <ArrowRight size={14} />
                </span>
              </Link>
            </>
          )}

          {status === "error" && (
            <>
              <div className="w-14 h-14 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center mx-auto mb-5">
                <AlertCircle size={28} className="text-red-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Link expired</h2>
              <p className="text-white/50 text-sm mb-6">
                {errorMsg || "This confirmation link has expired or already been used. Request a new one by signing up again."}
              </p>
              <div className="flex flex-col items-center gap-3">
                <Link href="/auth">
                  <span className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-colors cursor-pointer">
                    Back to sign in
                  </span>
                </Link>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
