import { useState, useEffect } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isIOS(): boolean {
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function isInStandaloneMode(): boolean {
  return (
    ("standalone" in window.navigator && (window.navigator as { standalone?: boolean }).standalone === true) ||
    window.matchMedia("(display-mode: standalone)").matches
  );
}

export type InstallState =
  | { type: "idle" }
  | { type: "android"; prompt: () => void }
  | { type: "ios" }
  | { type: "installed" };

export function useInstallPrompt() {
  const [state, setState] = useState<InstallState>({ type: "idle" });
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try { return sessionStorage.getItem("pwa-install-dismissed") === "1"; } catch { return false; }
  });

  useEffect(() => {
    if (isInStandaloneMode()) {
      setState({ type: "installed" });
      return;
    }

    if (isIOS()) {
      setState({ type: "ios" });
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      const deferredPrompt = e as BeforeInstallPromptEvent;
      setState({
        type: "android",
        prompt: async () => {
          await deferredPrompt.prompt();
          const { outcome } = await deferredPrompt.userChoice;
          if (outcome === "accepted") {
            setState({ type: "installed" });
          } else {
            dismiss();
          }
        },
      });
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  function dismiss() {
    try { sessionStorage.setItem("pwa-install-dismissed", "1"); } catch {}
    setDismissed(true);
  }

  const visible =
    !dismissed &&
    (state.type === "android" || state.type === "ios");

  return { state, visible, dismiss };
}
