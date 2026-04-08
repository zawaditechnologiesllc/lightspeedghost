const API_BASE = (import.meta.env.VITE_API_URL ?? "") + "/api";

/**
 * Wraps `fetch` with:
 * - Automatic `credentials: "include"` for session cookie auth
 * - Resolves relative /api paths against VITE_API_URL
 */
export async function apiFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const url = path.startsWith("http") ? path : `${API_BASE}${path.startsWith("/api") ? path.replace(/^\/api/, "") : path}`;

  return fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.headers as Record<string, string> | undefined),
    },
  });
}

export { API_BASE };
