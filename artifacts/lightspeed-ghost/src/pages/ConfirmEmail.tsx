import { CheckCircle, AlertCircle } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";

export default function ConfirmEmail() {
  const { user } = useAuth();
  const status = user ? "done" : "error";
  const message = "Please sign in to confirm your account.";

  return (
    <div className="min-h-screen bg-[#04080f] flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-md">
        <Link href="/">
          <Logo size={32} className="mb-10 w-fit" />
        </Link>

        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-8 text-center">
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
