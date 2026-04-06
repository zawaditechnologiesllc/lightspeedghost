import { useState, useEffect } from "react";
import { WifiOff, Wifi } from "lucide-react";

export default function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [showRestored, setShowRestored] = useState(false);

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
      setShowRestored(true);
      const t = setTimeout(() => setShowRestored(false), 3000);
      return () => clearTimeout(t);
    }
    function handleOffline() {
      setIsOnline(false);
      setShowRestored(false);
    }
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (isOnline && !showRestored) return null;

  if (showRestored) {
    return (
      <div className="flex items-center justify-center gap-2 px-4 py-1.5 bg-green-500/10 border-b border-green-500/20 text-green-700 dark:text-green-400 text-xs font-medium shrink-0 animate-in fade-in duration-300">
        <Wifi size={12} />
        Connection restored
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-2 px-4 py-1.5 bg-amber-500/10 border-b border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs font-medium shrink-0">
      <WifiOff size={12} />
      You&apos;re offline — some features may not be available
    </div>
  );
}
