import path from "node:path";

/** Shared filesystem and Node execution constants for every benchmark runner. */
export namespace TtscBenchmarkConstant {
  /** Absolute path of the experimental benchmark package. */
  export const ROOT = path.resolve(import.meta.dirname, "..");

  /** Default directory for reports and run-local state retained for inspection. */
  export const WORK_ROOT = path.join(ROOT, ".work");

  /** Directory containing the tool-neutral graph benchmark prompt corpus. */
  export const QUESTIONS_ROOT = path.join(ROOT, "assets", "graph", "questions");

  /** Absolute path of the ttsc repository containing the benchmark package. */
  export const REPOSITORY_ROOT = path.resolve(ROOT, "..", "..");

  /**
   * Builds Node arguments that execute a TypeScript entrypoint with namespace
   * transformation enabled.
   */
  export function nodeTypeScriptArguments(
    script: string,
    arguments_: readonly string[] = [],
  ): string[] {
    return ["--experimental-transform-types", script, ...arguments_];
  }
}
