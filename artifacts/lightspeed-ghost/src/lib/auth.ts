const TOKEN_KEY = "lsg_auth_token";

export interface AuthUser {
  id: string;
  email: string;
}

export interface AuthSession {
  access_token: string;
  user: AuthUser;
}

function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function setToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {}
}

function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {}
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(payload) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function isTokenExpired(token: string): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== "number") return true;
  return Date.now() / 1000 >= payload.exp;
}

function sessionFromToken(token: string): AuthSession | null {
  const payload = decodeJwtPayload(token);
  if (!payload) return null;
  const sub = payload.sub as string | undefined;
  const email = payload.email as string | undefined;
  if (!sub || !email) return null;
  return { access_token: token, user: { id: sub, email } };
}

type AuthStateChangeCallback = (session: AuthSession | null) => void;
const listeners: AuthStateChangeCallback[] = [];

function notifyListeners(session: AuthSession | null) {
  for (const cb of listeners) cb(session);
}

const API_BASE = (import.meta.env.VITE_API_URL ?? "") + "/api";

async function apiPost(path: string, body: unknown): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export const auth = {
  getSession(): AuthSession | null {
    const token = getToken();
    if (!token || isTokenExpired(token)) {
      clearToken();
      return null;
    }
    return sessionFromToken(token);
  },

  onAuthStateChange(cb: AuthStateChangeCallback): { unsubscribe: () => void } {
    listeners.push(cb);
    return {
      unsubscribe() {
        const idx = listeners.indexOf(cb);
        if (idx !== -1) listeners.splice(idx, 1);
      },
    };
  },

  async signInWithPassword(credentials: { email: string; password: string }): Promise<{
    data: { session: AuthSession | null } | null;
    error: { message: string } | null;
  }> {
    try {
      const res = await apiPost("/auth/login", credentials);
      const json = await res.json() as { token?: string; user?: AuthUser; error?: string };
      if (!res.ok || json.error) {
        return { data: null, error: { message: json.error ?? "Login failed." } };
      }
      const token = json.token!;
      setToken(token);
      const session = sessionFromToken(token)!;
      notifyListeners(session);
      return { data: { session }, error: null };
    } catch {
      return { data: null, error: { message: "Network error. Please try again." } };
    }
  },

  async signUp(credentials: { email: string; password: string }): Promise<{
    data: { session: AuthSession | null } | null;
    error: { message: string } | null;
  }> {
    try {
      const res = await apiPost("/auth/signup", credentials);
      const json = await res.json() as { token?: string; user?: AuthUser; error?: string };
      if (!res.ok || json.error) {
        return { data: null, error: { message: json.error ?? "Signup failed." } };
      }
      const token = json.token!;
      setToken(token);
      const session = sessionFromToken(token)!;
      notifyListeners(session);
      return { data: { session }, error: null };
    } catch {
      return { data: null, error: { message: "Network error. Please try again." } };
    }
  },

  async signOut(): Promise<void> {
    try {
      await apiPost("/auth/logout", {});
    } catch {}
    clearToken();
    notifyListeners(null);
  },

  async updateUser(updates: { password: string }): Promise<{
    data: unknown;
    error: { message: string } | null;
  }> {
    const token = getToken();
    if (!token) return { data: null, error: { message: "Not authenticated." } };
    try {
      const res = await fetch(`${API_BASE}/auth/reset-password`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ password: updates.password }),
      });
      const json = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || json.error) {
        return { data: null, error: { message: json.error ?? "Password update failed." } };
      }
      return { data: { ok: true }, error: null };
    } catch {
      return { data: null, error: { message: "Network error. Please try again." } };
    }
  },

  getAccessToken(): string | null {
    const token = getToken();
    if (!token || isTokenExpired(token)) return null;
    return token;
  },
};
