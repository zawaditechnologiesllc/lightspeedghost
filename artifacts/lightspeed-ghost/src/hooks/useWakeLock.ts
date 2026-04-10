import { useEffect, useRef } from "react";

export function useWakeLock(active: boolean) {
  const lockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!active) return;
    if (!("wakeLock" in navigator)) return;

    let released = false;

    const acquire = async () => {
      if (released) return;
      try {
        lockRef.current = await navigator.wakeLock.request("screen");
      } catch {
        // Not supported or denied — graceful no-op
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") acquire();
    };

    acquire();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      released = true;
      document.removeEventListener("visibilitychange", onVisibility);
      lockRef.current?.release().catch(() => {});
      lockRef.current = null;
    };
  }, [active]);
}
