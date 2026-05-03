import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import type { PaygTool, DocumentTier } from "@/lib/pricing";

const API_BASE = (import.meta.env.VITE_API_URL ?? "") + "/api";

export interface CreditsState {
  balanceCents: number;
  loading: boolean;
  refresh: () => Promise<void>;
  spendCredits: (tool: PaygTool, tier: DocumentTier | undefined, amountCents: number) => Promise<{ ok: boolean; newBalanceCents: number; error?: string }>;
}

export function useCredits(): CreditsState {
  const { session, loading: authLoading } = useAuth();
  const [balanceCents, setBalanceCents] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const token = session?.access_token;
      if (!token) {
        setBalanceCents(0);
        return;
      }
      const res = await fetch(`${API_BASE}/payments/credits`, {
        credentials: "include",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { setBalanceCents(0); return; }
      const data = await res.json() as { balanceCents: number };
      setBalanceCents(data.balanceCents ?? 0);
    } catch {
      setBalanceCents(0);
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    if (!authLoading) refresh();
  }, [refresh, authLoading]);

  const spendCredits = useCallback(async (
    tool: PaygTool,
    tier: DocumentTier | undefined,
    amountCents: number
  ): Promise<{ ok: boolean; newBalanceCents: number; error?: string }> => {
    const token = session?.access_token;
    if (!token) return { ok: false, newBalanceCents: balanceCents, error: "Not authenticated" };
    try {
      const res = await fetch(`${API_BASE}/payments/credits/spend`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ tool, tier, amountCents }),
      });
      const data = await res.json() as { success?: boolean; newBalanceCents?: number; error?: string };
      if (!res.ok || !data.success) {
        return { ok: false, newBalanceCents: balanceCents, error: data.error ?? "Failed to spend credits" };
      }
      const newBal = data.newBalanceCents ?? 0;
      setBalanceCents(newBal);
      return { ok: true, newBalanceCents: newBal };
    } catch {
      return { ok: false, newBalanceCents: balanceCents, error: "Network error" };
    }
  }, [session?.access_token, balanceCents]);

  return { balanceCents, loading, refresh, spendCredits };
}
