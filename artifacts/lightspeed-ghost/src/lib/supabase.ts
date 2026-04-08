const API_BASE = (import.meta.env.VITE_API_URL ?? "") + "/api";

export interface AuthUser {
  id: string;
  email: string;
}

export interface AuthSession {
  user: AuthUser;
  access_token: string;
}

async function apiPost(path: string, body: unknown) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

async function apiGet(path: string) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
  });
  if (!res.ok) return null;
  return res.json();
}

type AuthStateCallback = (event: string, session: AuthSession | null) => void;
const listeners: AuthStateCallback[] = [];

let _currentSession: AuthSession | null = null;

function notify(event: string, session: AuthSession | null) {
  _currentSession = session;
  listeners.forEach((cb) => cb(event, session));
}

export const supabase = {
  auth: {
    getSession: async () => {
      try {
        const data = await apiGet("/auth/me");
        if (data?.user) {
          const session: AuthSession = {
            user: { id: data.user.id, email: data.user.email },
            access_token: "",
          };
          _currentSession = session;
          return { data: { session } };
        }
      } catch {
        /* ignore */
      }
      _currentSession = null;
      return { data: { session: null } };
    },

    signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
      try {
        const data = await apiPost("/auth/login", { email, password });
        const session: AuthSession = {
          user: { id: data.user.id, email: data.user.email },
          access_token: "",
        };
        notify("SIGNED_IN", session);
        return { data: { session }, error: null };
      } catch (err) {
        return { data: { session: null }, error: err as Error };
      }
    },

    signUp: async ({ email, password }: { email: string; password: string; options?: unknown }) => {
      try {
        const data = await apiPost("/auth/register", { email, password });
        const session: AuthSession = {
          user: { id: data.user.id, email: data.user.email },
          access_token: "",
        };
        notify("SIGNED_IN", session);
        return { data: { session }, error: null };
      } catch (err) {
        return { data: { session: null }, error: err as Error };
      }
    },

    signOut: async () => {
      try {
        await apiPost("/auth/logout", {});
      } catch {
        /* ignore */
      }
      notify("SIGNED_OUT", null);
      return { error: null };
    },

    resetPasswordForEmail: async (_email: string, _opts?: unknown) => {
      return { data: {}, error: null };
    },

    updateUser: async (updates: { password?: string; data?: unknown }) => {
      if (!updates.password) return { data: {}, error: null };
      try {
        await apiPost("/auth/change-password", {
          currentPassword: "",
          newPassword: updates.password,
        });
        return { data: {}, error: null };
      } catch (err) {
        return { data: {}, error: err as Error };
      }
    },

    onAuthStateChange: (callback: AuthStateCallback) => {
      listeners.push(callback);
      return {
        data: {
          subscription: {
            unsubscribe: () => {
              const idx = listeners.indexOf(callback);
              if (idx !== -1) listeners.splice(idx, 1);
            },
          },
        },
      };
    },
  },
};
