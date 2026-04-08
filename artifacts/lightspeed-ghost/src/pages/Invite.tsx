import { CheckCircle } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Link } from "wouter";

export default function Invite() {
  return (
    <div className="min-h-screen bg-[#04080f] flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-md">
        <Link href="/">
          <Logo size={32} className="mb-10 w-fit" />
        </Link>

        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-8 text-center">
          <div className="w-14 h-14 bg-blue-500/10 border border-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle size={28} className="text-blue-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Create your account</h2>
          <p className="text-white/50 text-sm mb-6">Sign up to get started with Light Speed Ghost.</p>
          <Link href="/auth">
            <span className="inline-block px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition-colors cursor-pointer">
              Go to sign up
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
