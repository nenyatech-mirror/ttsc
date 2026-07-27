/**
 * The graph benchmark corpus, as a single source of truth shared by every graph
 * runner (`graph.ts` cells, `index-time.ts` cold builds).
 *
 * Each fixture is the `graph` branch of its benchmark repo, cloned into a work
 * directory OUTSIDE this repository (`../graph-benchmark-work` by default): the
 * measured agent's cwd is the fixture clone, and both Claude Code and Codex
 * walk the parent chain for `CLAUDE.md` / `AGENTS.md`, so a fixture under this
 * repo would hand the agent ttsc's own instructions.
 *
 * The tsconfigs differ per fixture and this is the trap: guessing one wrong
 * gives "tsconfig not found" and a silently failed cell. `zod`, `rxjs`, `vue`,
 * `nestjs`, and `shopping-backend` carry a dedicated `tsconfig.graph.json` (the
 * sources AND their tests — the program an editor's language server holds
 * open); `excalidraw` and `typeorm` use their stock `tsconfig.json`; `vscode`
 * uses `src/tsconfig.json`.
 */
import path from "node:path";

export interface IGraphBenchmarkProject {
  repoName: string;
  sourceRepo: string;
  sourceBranch: "graph";
  tsconfig: string;
}

export const PROJECTS = {
  excalidraw: graphFixture("excalidraw", "ttsc-benchmark-excalidraw", {
    tsconfig: "tsconfig.json",
  }),
  vue: graphFixture("vue", "ttsc-benchmark-vue"),
  rxjs: graphFixture("rxjs", "ttsc-benchmark-rxjs"),
  typeorm: graphFixture("typeorm", "ttsc-benchmark-typeorm", {
    tsconfig: "tsconfig.json",
  }),
  zod: graphFixture("zod", "ttsc-benchmark-zod"),
  nestjs: graphFixture("nestjs", "ttsc-benchmark-nestjs"),
  vscode: graphFixture("vscode", "ttsc-benchmark-vscode", {
    tsconfig: "src/tsconfig.json",
  }),
  "shopping-backend": graphFixture("shopping-backend", "shopping-backend"),
} satisfies Record<string, IGraphBenchmarkProject>;

export type GraphBenchmarkProjectName = keyof typeof PROJECTS;

function graphFixture(
  name: string,
  repo: string,
  { tsconfig = "tsconfig.graph.json" }: { tsconfig?: string } = {},
): IGraphBenchmarkProject {
  return {
    repoName: name,
    sourceRepo: `https://github.com/samchon/${repo}.git`,
    sourceBranch: "graph",
    tsconfig,
  };
}

/** Resolve the fixture work directory beside the repository root. */
export function resolveWorkDir(repoRoot: string): string {
  return (
    process.env.TTSC_GRAPH_BENCH_WORK ??
    path.resolve(repoRoot, "..", "graph-benchmark-work")
  );
}

/**
 * The fixture clone directory for a corpus entry. The folder an agent sees is
 * `<name>@graph`, never `ttsc-benchmark-<name>@…` — the prefix makes an agent
 * hunt for harness code instead of touring the source.
 */
export function projectDir(
  workDir: string,
  spec: IGraphBenchmarkProject,
): string {
  return path.join(workDir, `${spec.repoName}@${spec.sourceBranch}`);
}
