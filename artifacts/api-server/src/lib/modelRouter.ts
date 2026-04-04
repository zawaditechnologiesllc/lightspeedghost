/**
 * Multi-model routing logic — inspired by OpenClaw's ClawRouter.
 * Routes tasks to the most capable and cost-appropriate model:
 *   - Claude 3.5 Sonnet  → high-reasoning (STEM, writing, tutoring)
 *   - GPT-4o             → vision / OCR tasks
 *   - GPT-4o-mini        → cheap tasks (formatting, bibliography, detection)
 */

export type TaskType =
  | "reasoning"
  | "writing"
  | "stem"
  | "tutoring"
  | "revision"
  | "ocr"
  | "formatting"
  | "detection"
  | "summary"
  | "humanize"
  | "critique";

export interface ModelConfig {
  provider: "anthropic" | "openai";
  model: string;
  maxTokens: number;
}

export function routeTask(task: TaskType): ModelConfig {
  switch (task) {
    case "reasoning":
    case "stem":
    case "tutoring":
    case "critique":
      return { provider: "anthropic", model: "claude-sonnet-4-5", maxTokens: 4000 };

    case "writing":
    case "revision":
    case "humanize":
      return { provider: "anthropic", model: "claude-sonnet-4-5", maxTokens: 8000 };

    case "ocr":
      return { provider: "openai", model: "gpt-4o", maxTokens: 4000 };

    case "formatting":
    case "summary":
    case "detection":
      return { provider: "openai", model: "gpt-4o-mini", maxTokens: 2000 };

    default:
      return { provider: "anthropic", model: "claude-sonnet-4-5", maxTokens: 4000 };
  }
}
