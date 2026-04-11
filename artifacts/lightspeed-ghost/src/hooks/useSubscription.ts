import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";

const API_BASE = (import.meta.env.VITE_API_URL ?? "") + "/api";

export type PlanTier = "starter" | "pro" | "campus" | "payg" | null;

export interface UsageData {
  paper: number;
  revision: number;
  humanizer: number;
  stem: number;
  study: number;
  plagiarism: number;
  outline: number;
}

const PLAN_LIMITS: Record<string, Partial<Record<keyof UsageData, number | null>>> = {
  starter: {
    paper:      3,
    revision:   1,
    humanizer:  1,
    stem:       10,
    study:      10,
    plagiarism: 5,
    outline:    5,
  },
  pro: {
    paper:      50,
    revision:   50,
    humanizer:  50,
    stem:       30,
    study:      300,
    plagiarism: 50,
    outline:    50,
  },
  campus: {
    paper:      15,
    revision:   15,
    humanizer:  15,
    stem:       30,
    study:      150,
    plagiarism: 25,
    outline:    25,
  },
};

export function useSubscription() {
  const { session, loading: authLoading } = useAuth();
  const [plan, setPlan] = useState<PlanTier>(null);
  const [usage, setUsage] = useState<Partial<UsageData>>({});
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const token = session?.access_token;
      const headers: HeadersInit = token
        ? { Authorization: `Bearer ${token}` }
        : {};
      const res = await fetch(`${API_BASE}/payments/usage`, {
        credentials: "include",
        headers,
      });
      if (!res.ok) {
        setPlan("starter");
        setUsage({});
        return;
      }
      const data = await res.json() as { usage: Partial<UsageData>; plan: string };
      setUsage(data.usage ?? {});
      setPlan((data.plan as PlanTier) ?? "starter");
    } catch {
      setPlan("starter");
      setUsage({});
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    if (!authLoading) {
      refresh();
    }
  }, [refresh, authLoading]);

  function getLimit(tool: keyof UsageData): number | null {
    if (!plan || plan === "payg") return 0;
    const limits = PLAN_LIMITS[plan];
    if (!limits) return 0;
    const val = limits[tool];
    return val === undefined ? 0 : val;
  }

  function isAtLimit(tool: keyof UsageData): boolean {
    const limit = getLimit(tool);
    if (limit === null) return false;
    if (limit === 0) return true;
    return (usage[tool] ?? 0) >= limit;
  }

  function remaining(tool: keyof UsageData): number | null {
    const limit = getLimit(tool);
    if (limit === null) return null;
    return Math.max(0, limit - (usage[tool] ?? 0));
  }

  return { plan, usage, loading, isAtLimit, remaining, getLimit, refresh };
}
