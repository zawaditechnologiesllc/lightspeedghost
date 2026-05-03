import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiFetch";
import { Receipt, CheckCircle2, Clock, Tag } from "lucide-react";

interface Transaction {
  id: string;
  gateway: string;
  type: string;
  plan: string | null;
  tool: string | null;
  tier: string | null;
  amount_cents: number;
  currency: string;
  status: string;
  created_at: string;
  completed_at: string | null;
}

interface Discount {
  hasDiscount: boolean;
  discountPct?: number;
  createdAt?: string;
}

function formatAmount(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase() || "USD",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
  });
}

function describeTransaction(tx: Transaction): string {
  if (tx.type === "subscription") {
    const plan = tx.plan ?? "subscription";
    const label = plan.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    return `${label} Plan`;
  }
  if (tx.type === "payg") {
    const tool = tx.tool ?? "Tool";
    return `Pay-As-You-Go — ${tool.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}`;
  }
  return tx.type;
}

function gatewayLabel(gateway: string) {
  const map: Record<string, string> = {
    stripe: "Stripe",
    paystack: "Paystack",
    intasend: "IntaSend",
    paddle: "Paddle",
    "lemon-squeezy": "Lemon Squeezy",
  };
  return map[gateway] ?? gateway;
}

export default function Billing() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [discount, setDiscount] = useState<Discount | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [txRes, discRes] = await Promise.all([
          apiFetch("/payments/transactions"),
          apiFetch("/referral/my-discount"),
        ]);
        if (!txRes.ok) throw new Error("Failed to load transactions");
        const txData = await txRes.json() as { transactions: Transaction[] };
        setTransactions(txData.transactions ?? []);

        if (discRes.ok) {
          const discData = await discRes.json() as Discount;
          setDiscount(discData);
        }
      } catch {
        setError("Could not load billing history. Please try again.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Receipt size={20} className="text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Billing</h1>
          <p className="text-sm text-muted-foreground">Your payment history</p>
        </div>
      </div>

      {/* Referral discount banner */}
      {discount?.hasDiscount && (
        <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <Tag size={16} className="text-emerald-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-emerald-400">
              {discount.discountPct}% referral discount pending
            </p>
            <p className="text-xs text-emerald-400/70 mt-0.5">
              Your next subscription renewal will automatically be reduced by {discount.discountPct}%.
              Earned {discount.createdAt ? formatDate(discount.createdAt) : ""}.
            </p>
          </div>
        </div>
      )}

      {/* Transaction list */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
            Loading…
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-16 text-red-400 text-sm">{error}</div>
        ) : transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
            <Receipt size={32} className="opacity-30" />
            <p className="text-sm">No transactions yet</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/60">
              <span>Description</span>
              <span className="hidden sm:block text-right">Gateway</span>
              <span className="text-right">Amount</span>
              <span className="text-right">Date</span>
            </div>
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center px-4 py-3.5 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {tx.status === "completed" ? (
                    <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                  ) : (
                    <Clock size={14} className="text-amber-400 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {describeTransaction(tx)}
                    </p>
                    <p className="text-[11px] text-muted-foreground capitalize">{tx.status}</p>
                  </div>
                </div>
                <span className="hidden sm:block text-right text-xs text-muted-foreground">
                  {gatewayLabel(tx.gateway)}
                </span>
                <span className="text-right text-sm font-semibold tabular-nums text-foreground">
                  {formatAmount(tx.amount_cents, tx.currency)}
                </span>
                <span className="text-right text-xs text-muted-foreground whitespace-nowrap">
                  {formatDate(tx.created_at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground/50 text-center">
        Showing up to 100 most recent transactions
      </p>
    </div>
  );
}
