import { useEffect } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function AuthCallback() {
  const [, navigate] = useLocation();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        navigate("/app");
      } else {
        // Exchange code for session (PKCE flow)
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        if (code) {
          supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
            if (error) {
              navigate("/auth");
            } else {
              navigate("/app");
            }
          });
        } else {
          navigate("/auth");
        }
      }
    });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[#04080f] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 size={32} className="animate-spin text-blue-400" />
        <p className="text-white/50 text-sm">Completing sign in…</p>
      </div>
    </div>
  );
}
