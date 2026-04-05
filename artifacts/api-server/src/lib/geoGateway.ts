export type GatewayName = "stripe" | "paddle" | "lemon_squeezy" | "paystack" | "intasend";

export interface GatewayRoute {
  primary: GatewayName;
  reason: string;
}

const EAST_AFRICA = new Set(["KE", "UG", "TZ"]);

const AFRICA = new Set([
  "NG", "GH", "ZA", "CM", "SN", "RW", "ET", "CI", "ZM", "ZW", "MW",
  "MZ", "AO", "EG", "MA", "TN", "DZ", "LY", "SD", "BF", "ML", "NE",
  "TD", "SS", "SO", "MG", "MU", "SC", "CV", "SL", "LR", "GW", "GM",
  "BJ", "TG", "GQ", "GA", "CG", "CD", "CF", "BI", "DJ", "ER", "GN",
  "ST", "KM", "LS", "SZ", "NA", "BW",
]);

const STRIPE_ZONE = new Set([
  "US", "CA", "GB", "AU", "NZ", "IE", "DE", "FR", "NL", "BE", "SE",
  "NO", "DK", "FI", "AT", "CH", "LU", "SG", "JP", "KR", "HK", "IS",
  "LI", "MC", "SM", "AD", "IT", "ES", "PT", "GR", "CY", "MT", "SI",
  "SK", "CZ", "PL", "HU", "EE", "LV", "LT", "IL", "AE", "QA", "SA",
  "KW", "BH", "OM", "TW", "MX", "CL", "CO", "PE", "AR", "BR",
  "IN", "PH", "ID", "MY", "TH", "VN",
]);

export function resolveGateway(
  countryCode: string | null,
  isHighRisk: boolean,
  paused: Partial<Record<GatewayName, boolean>>,
): GatewayRoute {
  const cc = (countryCode ?? "").toUpperCase();

  if (isHighRisk && !paused.paystack) {
    return { primary: "paystack", reason: "risk" };
  }

  if (EAST_AFRICA.has(cc) && !paused.intasend) {
    return { primary: "intasend", reason: "region" };
  }

  if ((EAST_AFRICA.has(cc) || AFRICA.has(cc)) && !paused.paystack) {
    return { primary: "paystack", reason: "region" };
  }

  if (STRIPE_ZONE.has(cc) && !paused.stripe) {
    return { primary: "stripe", reason: "region" };
  }

  if (!paused.paddle) return { primary: "paddle", reason: "fallback" };
  if (!paused.lemon_squeezy) return { primary: "lemon_squeezy", reason: "fallback" };
  if (!paused.paystack) return { primary: "paystack", reason: "fallback" };
  if (!paused.stripe) return { primary: "stripe", reason: "fallback" };

  throw new Error("All payment gateways are currently paused");
}

export async function detectCountry(ip: string): Promise<string | null> {
  if (!ip || ip === "127.0.0.1" || ip === "::1" || ip.startsWith("192.168") || ip.startsWith("10.")) {
    return null;
  }
  try {
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=countryCode&lang=en`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const data = await res.json() as { countryCode?: string };
    return data.countryCode ?? null;
  } catch {
    return null;
  }
}

export function getClientIp(headers: Record<string, string | string[] | undefined>, remoteAddress?: string): string {
  const xff = headers["x-forwarded-for"];
  if (xff) {
    const first = Array.isArray(xff) ? xff[0] : xff.split(",")[0];
    return (first ?? "").trim();
  }
  return remoteAddress ?? "";
}
