import { useEffect } from "react";
import { AssistantPanel } from "@/components/FloatingWidget";

export default function FloatingAssistant() {
  useEffect(() => {
    document.title = "AI Assistant — LightSpeed Ghost";
  }, []);

  return (
    <div className="h-screen w-screen bg-[#0c0f1a] overflow-hidden">
      <AssistantPanel standalone />
    </div>
  );
}
