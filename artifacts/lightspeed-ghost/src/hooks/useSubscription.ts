import { useState, useEffect, useCallback } from "react";

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
    outline:    null,
  },
  pro: {
    paper:      50,
    revision:   50,
    humanizer:  50,
    stem:       30,
    study:      null,
    plagiarism: null,
    outline:    null,
  },
  campus: {
    paper:      15,
    revision:   15,
    humanizer:  15,
    stem:       30,
    study:      null,
    plagiarism: null,
    outline:    null,
  },
};

export function useSubscription() {
  const [plan, setPlan] = useState<PlanTier>(null);
  const [usage, setUsage] = useState<Partial<UsageData>>({});
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/payments/usage`, {
        credentials: "include",
      });
      if (!res.ok) return;
      const data = await res.json() as { usage: Partial<UsageData>; plan: string };
      setUsage(data.usage ?? {});
      setPlan((data.plan as PlanTier) ?? "starter");
    } catch {
      setPlan("starter");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

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
