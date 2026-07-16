import { useState, useEffect } from "react";
import { RefreshCw, Loader2, Users, TrendingUp, DollarSign, CheckCircle2, Clock } from "lucide-react";

interface InfluencerSummary {
  totalInfluencers: number;
  totalViews: number;
  totalOwedCents: number;
  eligibleCount: number;
  ratePer1kCents: number;
  minPayoutCents: number;
  payoutDays: number;
}

interface InfluencerRow {
  userId: string;
  code: string;
  totalViews: number;
  earnedCents: number;
  paidCents: number;
  balanceCents: number;
  payoutMethod: string;
  payoutDetails: string;
  createdAt: string;
  lastPayoutAt: string | null;
  eligible: boolean;
}

interface InfluencerData {
  summary: InfluencerSummary;
  influencers: InfluencerRow[];
}

function SectionHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <div>
      <h2 className="text-lg font-bold text-white">{title}</h2>
      <p className="text-xs text-white/35 mt-1">{sub}</p>
    </div>
  );
}

function money(cents: number) {
  const d = cents / 100;
  return Number.isInteger(d) ? `$${d}` : `$${d.toFixed(2)}`;
}

export function AdminInfluencerTab({ password }: { password: string }) {
  const [loading, setLoading] = useState(false);
  const [influencerData, setInfluencerData] = useState<InfluencerData | null>(null);
  const [payingOutId, setPayingOutId] = useState<string | null>(null);

  async function adminFetch(path: string, options?: RequestInit) {
    const response = await fetch((import.meta.env.VITE_API_URL ?? "") + "/api" + path, {
      ...options,
      headers: { ...options?.headers, "x-admin-password": password },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  async function loadInfluencers() {
    setLoading(true);
    try {
      const data = await adminFetch("/admin/influencers");
      setInfluencerData(data);
    } catch {
      setInfluencerData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInfluencers();
  }, []);

  async function markPaid(userId: string) {
    setPayingOutId(userId);
    try {
      await adminFetch(`/admin/influencers/${userId}/mark-paid`, { method: "POST" });
      await loadInfluencers();
    } catch {
      /* non-fatal */
    } finally {
      setPayingOutId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SectionHeader
          title="Influencer Program"
          sub={influencerData
            ? `Creators earn ${money(influencerData.summary.ratePer1kCents)} per 1,000 views · ${money(influencerData.summary.minPayoutCents)} minimum payout · every ${influencerData.summary.payoutDays} days`
            : "Creators earn per 1,000 views on their tracked link. Track payouts and payout methods here."}
        />
        <button
          onClick={loadInfluencers}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white/40 hover:text-white/70 hover:bg-white/5 border border-white/8 rounded-lg transition-all"
        >
          <RefreshCw size={11} /> Refresh
        </button>
      </div>

      {loading && !influencerData && (
        <div className="flex items-center justify-center h-40 text-white/30">
          <Loader2 size={20} className="animate-spin" />
        </div>
      )}

      {influencerData && (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                label: "Active Influencers",
                value: influencerData.summary.totalInfluencers.toString(),
                icon: Users,
                color: "text-blue-400",
              },
              {
                label: "Total Views",
                value: influencerData.summary.totalViews.toLocaleString(),
                icon: TrendingUp,
                color: "text-violet-400",
              },
              {
                label: "Total Owed",
                value: money(influencerData.summary.totalOwedCents),
                icon: DollarSign,
                color: "text-amber-400",
              },
              {
                label: "Ready for Payout",
                value: influencerData.summary.eligibleCount.toString(),
                icon: CheckCircle2,
                color: "text-emerald-400",
              },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="bg-white/[0.02] border border-white/8 rounded-xl p-4">
                <Icon size={14} className={`${color} mb-2`} />
                <div className="text-xl font-bold text-white tabular-nums">{value}</div>
                <div className="text-xs text-white/35 mt-0.5">{label}</div>
              </div>
            ))}
          </div>

          {/* Program settings info */}
          <div className="bg-white/[0.02] border border-white/8 rounded-xl p-4">
            <p className="text-xs text-white/40 mb-3">
              <strong>Current Program Settings:</strong> ${influencerData.summary.ratePer1kCents / 100} per 1,000 views · Minimum
              payout: {money(influencerData.summary.minPayoutCents)} · Paid every {influencerData.summary.payoutDays} days
            </p>
            <p className="text-[10px] text-white/30">
              Edit rates in Settings → Influencer Program. Changes take effect immediately.
            </p>
          </div>

          {/* Influencers leaderboard */}
          <div className="bg-white/[0.02] border border-white/8 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/8 flex items-center gap-2">
              <TrendingUp size={13} className="text-violet-400" />
              <span className="text-sm font-semibold text-white/70">Creator Leaderboard</span>
              <span className="ml-auto text-xs text-white/25">
                {influencerData.influencers.length} creators
              </span>
            </div>

            {influencerData.influencers.length === 0 ? (
              <div className="px-4 py-10 text-center text-white/25 text-sm">
                No influencers yet — they'll appear here after they create an account
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/5 text-white/30">
                      <th className="text-left px-4 py-2.5 font-medium">Code</th>
                      <th className="text-left px-4 py-2.5 font-medium">User ID</th>
                      <th className="text-right px-4 py-2.5 font-medium">Views</th>
                      <th className="text-right px-4 py-2.5 font-medium">Earned</th>
                      <th className="text-right px-4 py-2.5 font-medium">Paid</th>
                      <th className="text-right px-4 py-2.5 font-medium">Balance</th>
                      <th className="text-left px-4 py-2.5 font-medium">Method</th>
                      <th className="text-left px-4 py-2.5 font-medium">Joined</th>
                      <th className="px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {influencerData.influencers.map((inf) => (
                      <tr key={inf.code} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-2.5 font-mono font-bold text-lime-300">{inf.code}</td>
                        <td className="px-4 py-2.5 text-white/40 font-mono truncate max-w-[100px]">
                          {inf.userId.slice(0, 10)}…
                        </td>
                        <td className="px-4 py-2.5 text-right text-white/70 tabular-nums">
                          {inf.totalViews.toLocaleString()}
                        </td>
                        <td className="px-4 py-2.5 text-right text-emerald-400 font-semibold tabular-nums">
                          {money(inf.earnedCents)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-white/70 tabular-nums">
                          {money(inf.paidCents)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {inf.balanceCents > 0 ? (
                            <span className={inf.eligible ? "text-lime-300 font-semibold" : "text-amber-300"}>
                              {money(inf.balanceCents)}
                            </span>
                          ) : (
                            <span className="text-white/30">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-white/50 text-[10px]">
                          {inf.payoutMethod || <span className="text-white/20">not set</span>}
                        </td>
                        <td className="px-4 py-2.5 text-white/30 text-[10px]">
                          {new Date(inf.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-2.5">
                          {inf.eligible && (
                            <button
                              disabled={payingOutId === inf.userId}
                              onClick={() => markPaid(inf.userId)}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30 disabled:opacity-50 disabled:cursor-wait transition-all"
                            >
                              {payingOutId === inf.userId ? (
                                <Loader2 size={10} className="animate-spin" />
                              ) : (
                                <CheckCircle2 size={10} />
                              )}
                              Pay
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Help text */}
          <div className="bg-white/[0.02] border border-white/8 rounded-xl p-4">
            <h3 className="text-xs font-semibold text-white/70 mb-2">How it works:</h3>
            <ul className="text-[10px] text-white/40 space-y-1">
              <li>
                • Each creator receives a unique code (e.g., <code className="bg-black/40 px-1 rounded">4A2F</code>) which
                tracks their shared link
              </li>
              <li>• Views accumulate daily: ${influencerData.summary.ratePer1kCents / 100} per 1,000 views</li>
              <li>
                • Once balance reaches {money(influencerData.summary.minPayoutCents)}, they're eligible for payout
              </li>
              <li>
                • Click <strong>Pay</strong> above to record a payout (usually automated monthly)
              </li>
              <li>• Creators set their payout method in their Influencer dashboard</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
