const API_BASE = import.meta.env.VITE_API_URL ?? "";

export interface AuthUser {
  id: string;
  email: string;
}

async function apiFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API_BASE}/api${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error ?? `Request failed: ${res.status}`);
  }
  return data;
}

export async function getMe(): Promise<AuthUser | null> {
  try {
    const data = await apiFetch("/auth/me");
    return data.user ?? null;
  } catch {
    return null;
  }
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const data = await apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  return data.user;
}

export async function signup(email: string, password: string): Promise<AuthUser> {
  const data = await apiFetch("/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  return data.user;
}

export async function logout(): Promise<void> {
  await apiFetch("/auth/logout", { method: "POST" });
}

export async function updatePassword(password: string): Promise<void> {
  await apiFetch("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}
