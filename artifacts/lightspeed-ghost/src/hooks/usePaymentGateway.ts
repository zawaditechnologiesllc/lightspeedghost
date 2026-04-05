import { useState, useCallback } from "react";
import type { PaygTool, DocumentTier, PlanId } from "@/lib/pricing";

const API_BASE = (import.meta.env.VITE_API_URL ?? "") + "/api";

export interface GatewayInfo {
  gateway: string;
  reason: string;
  countryCode: string | null;
  stripePublishableKey: string | null;
  paystackPublicKey: string | null;
}

export interface PaymentSession {
  gateway: string;
  sessionId: string;
  checkoutUrl: string;
  amountCents: number;
  label: string;
}

export function usePaymentGateway() {
  const [gatewayInfo, setGatewayInfo] = useState<GatewayInfo | null>(null);
  const [session, setSession] = useState<PaymentSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detectGateway = useCallback(async (): Promise<GatewayInfo | null> => {
    try {
      const res = await fetch(`${API_BASE}/payments/gateway`, {
        credentials: "include",
      });
      const data = await res.json() as GatewayInfo;
      setGatewayInfo(data);
      return data;
    } catch {
      return null;
    }
  }, []);

  const createSubscriptionSession = useCallback(async (plan: PlanId, seats?: number): Promise<PaymentSession | null> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/payments/create`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "subscription", plan, seats }),
      });
      const data = await res.json() as PaymentSession & { error?: string };
      if (data.error) throw new Error(data.error);
      setSession(data);
      return data;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Payment failed";
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const createPaygSession = useCallback(async (tool: PaygTool, tier?: DocumentTier): Promise<PaymentSession | null> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/payments/create`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "payg", tool, tier }),
      });
      const data = await res.json() as PaymentSession & { error?: string };
      if (data.error) throw new Error(data.error);
      setSession(data);
      return data;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Payment failed";
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const verifyPayment = useCallback(async (gateway: string, ref: string): Promise<{
    confirmed: boolean;
    plan: string;
  }> => {
    try {
      const params = new URLSearchParams({ gateway, session_id: ref });
      const res = await fetch(`${API_BASE}/payments/verify?${params}`, {
        credentials: "include",
      });
      return await res.json() as { confirmed: boolean; plan: string };
    } catch {
      return { confirmed: false, plan: "free" };
    }
  }, []);

  return {
    gatewayInfo,
    session,
    loading,
    error,
    detectGateway,
    createSubscriptionSession,
    createPaygSession,
    verifyPayment,
  };
}
