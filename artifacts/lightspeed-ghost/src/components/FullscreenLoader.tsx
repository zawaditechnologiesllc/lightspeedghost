import { useState, useEffect } from "react";
import { CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface FullscreenLoaderProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  steps: string[];
  stepInterval?: number;
}

export default function FullscreenLoader({
  icon,
  title,
  subtitle,
  steps,
  stepInterval = 1400,
}: FullscreenLoaderProps) {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    setActiveStep(0);
    const interval = setInterval(() => {
      setActiveStep(prev => (prev < steps.length - 1 ? prev + 1 : prev));
    }, stepInterval);
    return () => clearInterval(interval);
  }, [steps.length, stepInterval]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 bg-background min-h-0 overflow-y-auto">
      <div className="w-full max-w-md space-y-8">

        {/* Pulsing icon */}
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" style={{ animationDuration: "1.8s" }} />
            <div className="relative w-20 h-20 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              {icon}
            </div>
          </div>
          <div className="text-center">
            <h2 className="text-xl font-bold tracking-tight">{title}</h2>
            {subtitle && (
              <p className="text-sm text-muted-foreground mt-1 max-w-xs">{subtitle}</p>
            )}
          </div>
        </div>

        {/* Progressive steps */}
        <div className="space-y-2.5">
          {steps.map((step, i) => {
            const done = i < activeStep;
            const running = i === activeStep;
            const pending = i > activeStep;

            return (
              <div
                key={i}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-500",
                  done
                    ? "bg-green-500/5 border-green-500/20 opacity-80"
                    : running
                    ? "bg-primary/5 border-primary/25 shadow-sm"
                    : "bg-muted/20 border-border/40 opacity-35"
                )}
              >
                {/* Step indicator */}
                <div className="shrink-0 w-5 h-5 flex items-center justify-center">
                  {done ? (
                    <CheckCheck size={13} className="text-green-500" />
                  ) : running ? (
                    <div className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-muted-foreground/25" />
                  )}
                </div>

                {/* Label */}
                <span
                  className={cn(
                    "text-xs leading-snug transition-colors duration-300",
                    done
                      ? "text-green-700 dark:text-green-400"
                      : running
                      ? "text-foreground font-medium"
                      : "text-muted-foreground/50"
                  )}
                >
                  {step}
                </span>
              </div>
            );
          })}
        </div>

        {/* Subtle footer */}
        <p className="text-center text-[10px] text-muted-foreground/50 tracking-wide">
          LightSpeed AI is working — this usually takes a few seconds
        </p>
      </div>
    </div>
  );
}
