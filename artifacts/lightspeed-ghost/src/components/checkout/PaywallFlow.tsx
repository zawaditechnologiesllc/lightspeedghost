import { PaywallPicker } from "./PaywallPicker";
import { CheckoutModal } from "./CheckoutModal";
import type { PickerState, CheckoutState } from "@/hooks/usePaywallGuard";
import type { PaygTool, DocumentTier } from "@/lib/pricing";

interface PaywallFlowProps {
  pickerState: PickerState;
  checkoutState: CheckoutState;
  plan?: string | null;
  closePicker: () => void;
  closeCheckout: () => void;
  chooseSubscription: () => void;
  choosePayg: (tool: PaygTool, tier?: DocumentTier) => void;
}

export function PaywallFlow({
  pickerState,
  checkoutState,
  plan,
  closePicker,
  closeCheckout,
  chooseSubscription,
  choosePayg,
}: PaywallFlowProps) {
  return (
    <>
      {pickerState.open && (
        <PaywallPicker
          open={pickerState.open}
          onClose={closePicker}
          tool={pickerState.tool}
          tier={pickerState.tier}
          currentPlan={plan}
          onChooseSubscription={chooseSubscription}
          onChoosePayg={(tier) => choosePayg(pickerState.tool, tier)}
        />
      )}
      {checkoutState.open && (
        <CheckoutModal
          open={checkoutState.open}
          onClose={closeCheckout}
          mode={checkoutState.mode}
          plan={checkoutState.mode === "subscription" ? "pro_monthly" : undefined}
          tool={checkoutState.mode === "payg" ? checkoutState.tool : undefined}
          tier={checkoutState.mode === "payg" ? checkoutState.tier : undefined}
        />
      )}
    </>
  );
}
