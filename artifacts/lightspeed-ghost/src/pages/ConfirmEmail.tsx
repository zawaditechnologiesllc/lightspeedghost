import { useState, useEffect } from "react";
import { Ghost, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Link } from "wouter";

export default function ConfirmEmail() {
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function verify() {
      const params = new URLSearchParams(window.location.search);
      const tokenHash = params.get("token_hash");
      const type = params.get("type") as "email" | "signup" | null;

      if (tokenHash && type) {
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type === "signup" ? "signup" : "email" });
        if (error) {
          setMessage(error.message);
          setStatus("error");
        } else {
          setStatus("done");
        }
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setStatus("done");
      } else {
        setMessage("This confirmation link has expired or already been used.");
        setStatus("error");
      }
    }

    verify();
  }, []);

  return (
    <div className="min-h-screen bg-[#04080f] flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-md">
        <Link href="/">
          <div className="flex items-center gap-2.5 mb-10 cursor-pointer w-fit">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Ghost size={16} className="text-white" />
            </div>
            <span className="font-bold text-white">Light Speed <span className="text-blue-400">Ghost</span></span>
          </div>
        </Link>

        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-8 text-center">
          {status === "loading" && (
            <>
              <div className="w-14 h-14 bg-blue-500/10 border border-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-5">
                <Loader2 size={28} className="text-blue-400 animate-spin" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Confirming your email…</h2>
              <p className="text-white/40 text-sm">Just a moment.</p>
            </>
          )}

          {status === "done" && (
            <>
              <div className="w-14 h-14 bg-green-500/10 border border-green-500/20 rounded-full flex items-center justify-center mx-auto mb-5">
                <CheckCircle size={28} className="text-green-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Email confirmed</h2>
              <p className="text-white/50 text-sm mb-6">Your account is active. You're good to go.</p>
              <Link href="/app">
                <span className="inline-block px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition-colors cursor-pointer">
                  Open Light Speed Ghost
                </span>
              </Link>
            </>
          )}

          {status === "error" && (
            <>
              <div className="w-14 h-14 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center mx-auto mb-5">
                <AlertCircle size={28} className="text-red-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Confirmation failed</h2>
              <p className="text-white/50 text-sm mb-6">{message || "This link has expired or already been used."}</p>
              <Link href="/app">
                <span className="inline-block px-6 py-2.5 border border-white/15 hover:border-white/30 text-white/70 hover:text-white text-sm font-medium rounded-xl transition-colors cursor-pointer">
                  Back to sign in
                </span>
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
