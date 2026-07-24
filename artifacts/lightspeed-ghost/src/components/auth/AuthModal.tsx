import { X } from "lucide-react";
import { useLocation } from "wouter";
import { Logo } from "@/components/Logo";
import { AuthForm, type AuthTab } from "@/components/auth/AuthForm";

// Sign-in / sign-up as a plain popup — every login option we offer, no
// marketing chrome. Opened from the landing (Start for free / Upgrade / a
// chosen plan) so returning users and new users never leave the page.

export function AuthModal({
  open,
  onClose,
  initialTab = "login",
  next = "/app",
}: {
  open: boolean;
  onClose: () => void;
  initialTab?: AuthTab;
  next?: string;
}) {
  const [, navigate] = useLocation();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-[#131b2e]/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-[#e0e3e5] p-6 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between mb-4">
          <Logo size={24} textSize="text-sm" variant="light" />
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg text-[#76777d] hover:text-[#191c1e] hover:bg-[#e8f3ed] transition-colors">
            <X size={18} />
          </button>
        </div>
        {/* key forces a fresh form (and tab) each time the modal is opened */}
        <AuthForm key={initialTab} initialTab={initialTab} next={next} onSuccess={(dest) => { onClose(); navigate(dest); }} />
      </div>
    </div>
  );
}
