import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
// Supabase is imported dynamically (not at module top level) so its ~50 KB chunk
// loads after first paint instead of blocking the initial render.

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;

    import("@/lib/supabase")
      .then(({ supabase }) => {
        if (!active) return;
        // Get initial session
        supabase.auth.getSession().then(({ data }) => {
          if (!active) return;
          setSession(data.session);
          setLoading(false);
        });
        // Listen for auth state changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
          setSession(session);
          setLoading(false);
        });
        unsubscribe = () => subscription.unsubscribe();
      })
      .catch(() => {
        // Fail open: never leave the app stuck on the loading spinner if the
        // auth chunk can't load — treat the visitor as logged-out.
        if (active) setLoading(false);
      });

    return () => { active = false; unsubscribe?.(); };
  }, []);

  const signOut = async () => {
    const { supabase } = await import("@/lib/supabase");
    await supabase.auth.signOut();
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
