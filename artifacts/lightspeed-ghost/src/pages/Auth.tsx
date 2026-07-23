import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/Logo";
import { AuthForm } from "@/components/auth/AuthForm";

// Standalone auth route (used when AuthGuard redirects a deep link). Same clean
// form as the AuthModal popup — no marketing chrome — just centered on the page.
// ?next= is read by AuthForm to return the user where they were headed.
export default function Auth() {
  return (
    <div className="min-h-screen bg-[#f7f9fb] text-[#191c1e] antialiased flex flex-col">
      <header className="w-full border-b border-[#e0e3e5] bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/">
            <Logo size={30} textSize="text-base" variant="light" className="cursor-pointer select-none" />
          </Link>
          <Link href="/">
            <span className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-[#45464d] hover:text-[#6b38d4] rounded-lg hover:bg-[#f2f4f6] transition-colors cursor-pointer">
              <ArrowLeft size={15} /> Back to home
            </span>
          </Link>
        </div>
      </header>

      <main className="flex-grow flex items-center justify-center p-6">
        <div className="w-full max-w-sm bg-white rounded-2xl border border-[#e0e3e5] shadow-sm p-6 sm:p-7">
          <AuthForm initialTab="login" />
        </div>
      </main>
    </div>
  );
}
