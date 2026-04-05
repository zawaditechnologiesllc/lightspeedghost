import { useState, useCallback } from "react";
import { useSubscription } from "./useSubscription";
import type { PaygTool, DocumentTier } from "@/lib/pricing";

export type PaywallState =
  | { open: false }
  | { open: true; tool: PaygTool; tier?: DocumentTier; mode: "subscription" | "payg" };

export function usePaywallGuard() {
  const { isAtLimit, loading } = useSubscription();
  const [paywallState, setPaywallState] = useState<PaywallState>({ open: false });

  const guard = useCallback(
    (tool: PaygTool, fn: () => void, tier?: DocumentTier): void => {
      if (loading) { fn(); return; }
      if (!isAtLimit(tool)) { fn(); return; }
      setPaywallState({ open: true, tool, tier, mode: "subscription" });
    },
    [isAtLimit, loading],
  );

  function closePaywall() {
    setPaywallState({ open: false });
  }

  function switchToPayg() {
    setPaywallState((prev) =>
      prev.open ? { ...prev, mode: "payg" } : prev,
    );
  }

  return { guard, paywallState, closePaywall, switchToPayg, isAtLimit };
}
