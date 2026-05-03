import { useState, useCallback } from "react";
import { useSubscription } from "./useSubscription";
import type { PaygTool, DocumentTier } from "@/lib/pricing";

export type PickerState =
  | { open: false }
  | { open: true; tool: PaygTool; tier?: DocumentTier; pickerMode: "paywall" | "buy" };

export type CheckoutState =
  | { open: false }
  | { open: true; mode: "subscription" | "payg"; tool?: PaygTool; tier?: DocumentTier };

export function usePaywallGuard() {
  const { plan, isAtLimit, loading } = useSubscription();
  const [pickerState,  setPickerState]  = useState<PickerState>({ open: false });
  const [checkoutState, setCheckoutState] = useState<CheckoutState>({ open: false });

  const guard = useCallback(
    (tool: PaygTool, fn: () => void, tier?: DocumentTier): void => {
      if (loading) { fn(); return; }
      if (!isAtLimit(tool)) { fn(); return; }
      setPickerState({ open: true, tool, tier, pickerMode: "paywall" });
    },
    [isAtLimit, loading],
  );

  function closePicker() {
    setPickerState({ open: false });
  }

  function closeCheckout() {
    setCheckoutState({ open: false });
  }

  function chooseSubscription() {
    setPickerState({ open: false });
    setCheckoutState({ open: true, mode: "subscription" });
  }

  function choosePayg(tool: PaygTool, tier?: DocumentTier) {
    setPickerState({ open: false });
    setCheckoutState({ open: true, mode: "payg", tool, tier });
  }

  function openBuy(tool: PaygTool, tier?: DocumentTier) {
    setPickerState({ open: true, tool, tier, pickerMode: "buy" });
  }

  return {
    guard,
    openBuy,
    plan,
    isAtLimit,
    pickerState,
    checkoutState,
    closePicker,
    closeCheckout,
    chooseSubscription,
    choosePayg,
  };
}
