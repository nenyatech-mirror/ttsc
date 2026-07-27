import path from "node:path";

export const BENCHMARK_ROOT = path.resolve(import.meta.dirname, "..");
export const BENCHMARK_WORK_ROOT = path.join(BENCHMARK_ROOT, ".work");
export const QUESTIONS_ROOT = path.join(
  BENCHMARK_ROOT,
  "assets",
  "graph",
  "questions",
);
export const REPOSITORY_ROOT = path.resolve(BENCHMARK_ROOT, "..", "..");

export const nodeTypescriptArguments = (
  script: string,
  arguments_: readonly string[] = [],
): string[] => ["--experimental-strip-types", script, ...arguments_];
