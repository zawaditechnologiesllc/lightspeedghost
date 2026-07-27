// Shared file-text extraction (used by the checker's "+" upload button and the
// FileUploadZone). Posts to the public /api/files/extract endpoint (no auth
// required). supabase is lazy-imported so this stays off the prerender path.

export interface ExtractedFile {
  text: string;
  filename: string;
  mimeType: string;
  wordCount: number;
  pageCount?: number;
  isImage: boolean;
  base64?: string;
}

export async function extractFile(file: File): Promise<ExtractedFile> {
  const API = import.meta.env.VITE_API_URL ?? "";
  const formData = new FormData();
  formData.append("file", file);

  const headers: HeadersInit = {};
  try {
    const { supabase } = await import("@/lib/supabase");
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) headers["Authorization"] = `Bearer ${session.access_token}`;
  } catch {
    /* guests / prerender: extraction endpoint is public, so no token is fine */
  }

  const res = await fetch(`${API}/api/files/extract`, { method: "POST", headers, body: formData });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Could not read that file (error ${res.status}).`);
  }
  return res.json();
}
