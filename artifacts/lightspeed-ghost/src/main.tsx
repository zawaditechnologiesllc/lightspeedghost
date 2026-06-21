import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setBaseUrl, setAuthTokenGetter } from "@workspace/api-client-react";

const apiUrl = import.meta.env.VITE_API_URL;
if (apiUrl) {
  setBaseUrl(apiUrl as string);
}

// Attach the Supabase JWT to all API requests automatically. Supabase is
// imported lazily here so its ~50 KB chunk stays off the initial critical path
// (it loads in the background once auth is first needed, not before first paint).
setAuthTokenGetter(async () => {
  const { supabase } = await import("@/lib/supabase");
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
});

createRoot(document.getElementById("root")!).render(<App />);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
