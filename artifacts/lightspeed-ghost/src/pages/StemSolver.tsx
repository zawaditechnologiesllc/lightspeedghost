import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSolveStem, useGetStemSubjects } from "@workspace/api-client-react";
import { Loader2, FlaskConical, CheckCircle } from "lucide-react";
import type { StemSolution } from "@workspace/api-client-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const schema = z.object({
  problem: z.string().min(5, "Please describe your problem"),
  subject: z.enum(["mathematics", "physics", "chemistry", "biology", "engineering", "computer_science", "statistics"]),
  showSteps: z.boolean().optional(),
  generateGraph: z.boolean().optional(),
});

type FormData = z.infer<typeof schema>;

export default function StemSolver() {
  const [result, setResult] = useState<StemSolution | null>(null);
  const solveStem = useSolveStem();
  const { data: subjects } = useGetStemSubjects();

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      subject: "mathematics",
      showSteps: true,
      generateGraph: false,
    },
  });

  const onSubmit = async (data: FormData) => {
    const res = await solveStem.mutateAsync(data);
    setResult(res);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">STEM Solver</h1>
        <p className="text-muted-foreground text-sm mt-1">Solve complex STEM problems with step-by-step explanations and visualizations</p>
      </div>

      {subjects && (
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {subjects.subjects.map((sub) => (
            <button
              key={sub.id}
              onClick={() => form.setValue("subject", sub.id as FormData["subject"])}
              className={`px-3 py-2 rounded-lg border text-xs font-medium transition-all text-center ${
                form.watch("subject") === sub.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/50"
              }`}
            >
              {sub.name}
            </button>
          ))}
        </div>
      )}

      <div className={`grid gap-6 ${result ? "xl:grid-cols-2" : ""}`}>
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Problem *</label>
              <textarea
                {...form.register("problem")}
                rows={5}
                placeholder="Enter your STEM problem here. e.g., 'Find the integral of x*sin(x) dx' or 'Calculate the velocity of a projectile launched at 45 degrees with v0 = 20 m/s after 2 seconds'"
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none font-mono leading-relaxed"
              />
              {form.formState.errors.problem && (
                <p className="text-destructive text-xs mt-1">{form.formState.errors.problem.message}</p>
              )}
            </div>

            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" {...form.register("showSteps")} className="accent-primary" />
                <span className="text-sm">Show step-by-step solution</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" {...form.register("generateGraph")} className="accent-primary" />
                <span className="text-sm">Generate graph visualization</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={solveStem.isPending}
              className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {solveStem.isPending ? (
                <><Loader2 size={16} className="animate-spin" /> Solving...</>
              ) : (
                <><FlaskConical size={16} /> Solve Problem</>
              )}
            </button>
          </form>
        </div>

        {result && (
          <div className="space-y-4">
            <div className="bg-card border border-primary/30 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle size={16} className="text-green-500" />
                <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Answer</span>
                <span className="ml-auto text-xs text-muted-foreground capitalize">{result.subject}</span>
              </div>
              <p className="text-sm text-foreground leading-relaxed">{result.answer}</p>
            </div>

            {result.graphData && (
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="font-semibold text-sm mb-3">{result.graphData.labels?.title ?? "Visualization"}</h3>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={result.graphData.data}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="x" className="text-xs" label={{ value: result.graphData.labels?.x ?? "x", position: "bottom" }} />
                      <YAxis className="text-xs" label={{ value: result.graphData.labels?.y ?? "y", angle: -90, position: "insideLeft" }} />
                      <Tooltip contentStyle={{ fontSize: "12px" }} />
                      <Line type="monotone" dataKey="y" stroke="hsl(211 100% 50%)" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {result.steps.length > 0 && (
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-border">
                  <h3 className="font-semibold text-sm">Step-by-Step Solution</h3>
                </div>
                <div className="divide-y divide-border">
                  {result.steps.map((step) => (
                    <div key={step.stepNumber} className="px-5 py-4">
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center shrink-0 mt-0.5">
                          <span className="text-xs font-bold text-primary-foreground">{step.stepNumber}</span>
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-semibold">{step.description}</div>
                          {step.expression && (
                            <div className="mt-1 px-3 py-1.5 bg-muted rounded font-mono text-xs border border-border">
                              {step.expression}
                            </div>
                          )}
                          <div className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{step.explanation}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
