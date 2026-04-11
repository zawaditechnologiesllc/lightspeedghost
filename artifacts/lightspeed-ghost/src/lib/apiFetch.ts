import { supabase } from "./supabase";

const API_BASE = (import.meta.env.VITE_API_URL ?? "") + "/api";

async function getAuthHeader(): Promise<Record<string, string>> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) return { Authorization: `Bearer ${token}` };
  } catch {
    // Ignore — unauthenticated request
  }
  return {};
}

/**
 * Wraps `fetch` with:
 * - Automatic `Authorization: Bearer <supabase_token>` header
 * - Resolves relative /api paths against VITE_API_URL
 *
 * Use for all authenticated API calls instead of raw `fetch`.
 */
export async function apiFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const url = path.startsWith("http") ? path : `${API_BASE}${path.startsWith("/api") ? path.replace(/^\/api/, "") : path}`;
  const authHeader = await getAuthHeader();

  return fetch(url, {
    ...options,
    headers: {
      ...authHeader,
      ...(options.headers as Record<string, string> | undefined),
    },
  });
}

export { API_BASE };
