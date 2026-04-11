import { auth } from "./auth";

const API_BASE = (import.meta.env.VITE_API_URL ?? "") + "/api";

async function getAuthHeader(): Promise<Record<string, string>> {
  const token = auth.getAccessToken();
  if (token) return { Authorization: `Bearer ${token}` };
  return {};
}

/**
 * Wraps `fetch` with:
 * - Automatic `Authorization: Bearer <token>` header
 * - Resolves relative /api paths against VITE_API_URL
 */
export async function apiFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const url = path.startsWith("http") ? path : `${API_BASE}${path.startsWith("/api") ? path.replace(/^\/api/, "") : path}`;
  const authHeader = await getAuthHeader();

  return fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      ...authHeader,
      ...(options.headers as Record<string, string> | undefined),
    },
  });
}

export { API_BASE };
