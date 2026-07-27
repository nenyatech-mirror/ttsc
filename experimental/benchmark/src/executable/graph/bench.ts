// Benchmark @ttsc/graph on a real project: how long the resident Program takes
// to load, how cheap graph extraction is on top of that already-built Program,
// the node/edge counts, and the codegraph-style "fair coverage" (share of
// symbol-bearing source files with at least one resolved cross-file edge).
//
// Counts and coverage are deterministic. Timings are indicative and only
// trustworthy on a quiet host (see .agents/skills/benchmark/SKILL.md); CI
// numbers show the shape, not a publishable figure.
//
// Usage:
//   node --experimental-transform-types experimental/benchmark/src/executable/graph/bench.ts                       # default: packages/ttsc
//   node --experimental-transform-types experimental/benchmark/src/executable/graph/bench.ts --project=/abs/path --tsconfig=tsconfig.json --runs=5
import cp from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { TtscBenchmarkConstant } from "../../TtscBenchmarkConstant.ts";
import { TtscBenchmarkNumber } from "../../TtscBenchmarkNumber.ts";
import { TtscBenchmarkObject } from "../../TtscBenchmarkObject.ts";

const repoRoot = TtscBenchmarkConstant.REPOSITORY_ROOT;
const ttscDir = path.join(repoRoot, "packages", "ttsc");

const args = parseArgs(process.argv.slice(2));
const project = path.resolve(args.project ?? ttscDir);
const tsconfig = args.tsconfig ?? "tsconfig.json";
const runs = positiveInteger(args.runs ?? "5", "--runs");
const warmup = nonNegativeInteger(args.warmup ?? "1", "--warmup");

const goRoot = path.join(os.homedir(), "go-sdk", "go", "bin");
const env: NodeJS.ProcessEnv = {
  ...process.env,
  PATH: fs.existsSync(goRoot)
    ? `${goRoot}${path.delimiter}${process.env.PATH ?? ""}`
    : process.env.PATH,
};

const binary = path.join(
  os.tmpdir(),
  `graphbench-${process.pid}${process.platform === "win32" ? ".exe" : ""}`,
);

console.log("Building graphbench...");
runChecked("go", ["build", "-o", binary, "./cmd/graphbench"], ttscDir);

console.log(
  `Benchmarking @ttsc/graph on ${path.relative(repoRoot, project) || project} (${tsconfig}), ${runs} run(s) + ${warmup} warmup\n`,
);

for (let i = 0; i < warmup; i++) measure();
const samples: IGraphBenchmarkSample[] = [];
for (let i = 0; i < runs; i++) {
  const sample = measure();
  samples.push(sample);
  console.log(
    `  run ${i + 1}: load ${sample.loadMs.toFixed(0)}ms, build ${sample.buildMs.toFixed(0)}ms, ` +
      `${sample.nodes} nodes, ${sample.totalEdges} edges, coverage ${(sample.coverage * 100).toFixed(1)}%`,
  );
}

const first: IGraphBenchmarkSample = samples[0]!;
const report = {
  project: path.relative(repoRoot, project) || project,
  tsconfig,
  runs,
  sourceFiles: first.sourceFiles,
  nodes: first.nodes,
  externalNodes: first.externalNodes,
  edges: first.edges,
  totalEdges: first.totalEdges,
  symbolFiles: first.symbolFiles,
  coveredFiles: first.coveredFiles,
  coverage: first.coverage,
  loadMsMedian: TtscBenchmarkNumber.median(samples.map((s) => s.loadMs)),
  buildMsMedian: TtscBenchmarkNumber.median(samples.map((s) => s.buildMs)),
  buildShareMedian: TtscBenchmarkNumber.median(
    samples.map((s) => s.buildShareOfLoad),
  ),
};

console.log("\nResult (counts deterministic; timings indicative):");
console.log(`  source files:  ${report.sourceFiles}`);
console.log(
  `  nodes:         ${report.nodes} (${report.externalNodes} external boundary leaves)`,
);
console.log(
  `  edges:         ${report.totalEdges} (heritage ${report.edges.heritage}, ` +
    `value-call ${report.edges["value-call"]}, type-ref ${report.edges["type-ref"]})`,
);
console.log(
  `  fair coverage: ${(report.coverage * 100).toFixed(1)}% ` +
    `(${report.coveredFiles}/${report.symbolFiles} symbol-bearing files cross-linked)`,
);
console.log(
  `  load time:     ${report.loadMsMedian.toFixed(0)} ms (TtscBenchmarkNumber.median)`,
);
console.log(
  `  graph build:   ${report.buildMsMedian.toFixed(0)} ms (TtscBenchmarkNumber.median), ` +
    `${(report.buildShareMedian * 100).toFixed(1)}% on top of the load it rides`,
);

const reportPath = path.join(
  TtscBenchmarkConstant.WORK_ROOT,
  "graph",
  "structural",
  "report.json",
);
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`\nReport: ${path.relative(repoRoot, reportPath)}`);

try {
  fs.rmSync(binary, { force: true });
} catch {
  /* best effort */
}

function measure(): IGraphBenchmarkSample {
  const out = runChecked(
    binary,
    ["--cwd", project, "--tsconfig", tsconfig],
    ttscDir,
  );
  const parsed: unknown = JSON.parse(out.trim());
  if (isGraphBenchmarkSample(parsed) === false)
    throw new Error("graphbench returned an invalid measurement");
  return parsed;
}

function runChecked(
  command: string,
  commandArgs: readonly string[],
  cwd: string,
): string {
  const result = cp.spawnSync(command, commandArgs, {
    cwd,
    env,
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `${command} ${commandArgs.join(" ")} failed (${result.status})\n${result.stderr ?? ""}`,
    );
  }
  return result.stdout ?? "";
}

function parseArgs(argv: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const argument of argv) {
    const match: RegExpExecArray | null = /^--([^=]+)=(.*)$/.exec(argument);
    if (match !== null) out[match[1]!] = match[2]!;
  }
  return out;
}

interface IGraphBenchmarkSample {
  sourceFiles: number;
  nodes: number;
  externalNodes: number;
  edges: {
    heritage: number;
    "value-call": number;
    "type-ref": number;
  };
  totalEdges: number;
  symbolFiles: number;
  coveredFiles: number;
  coverage: number;
  loadMs: number;
  buildMs: number;
  buildShareOfLoad: number;
}

function isGraphBenchmarkSample(
  input: unknown,
): input is IGraphBenchmarkSample {
  if (
    TtscBenchmarkObject.isRecord(input) === false ||
    TtscBenchmarkObject.isRecord(input.edges) === false
  )
    return false;
  return [
    input.sourceFiles,
    input.nodes,
    input.externalNodes,
    input.edges.heritage,
    input.edges["value-call"],
    input.edges["type-ref"],
    input.totalEdges,
    input.symbolFiles,
    input.coveredFiles,
    input.coverage,
    input.loadMs,
    input.buildMs,
    input.buildShareOfLoad,
  ].every((value: unknown) => typeof value === "number");
}

function positiveInteger(value: string, label: string): number {
  const parsed: number = nonNegativeInteger(value, label);
  if (parsed === 0) throw new Error(`${label} must be greater than zero`);
  return parsed;
}

function nonNegativeInteger(value: string, label: string): number {
  const parsed: number = Number(value);
  if (Number.isInteger(parsed) === false || parsed < 0)
    throw new Error(`${label} must be a non-negative integer`);
  return parsed;
}
