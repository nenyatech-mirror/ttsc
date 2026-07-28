// Publish the @ttsc/graph benchmark results into the website.
//
// The three graph benchmarks each write a local, git-ignored report:
//   - bench.ts            -> structural/report.json      (counts + coverage)
//   - agent-ab.ts         -> agent-ab-report.json        (Claude agent-cost A/B)
//   - agent-ab-codex.ts   -> agent-ab-codex-report.json  (codex / GPT agent-cost A/B)
//
// This script folds whichever of those exist into the committed, served
// `website/public/benchmark/graph.json`, the graph sibling of the performance
// dashboard's `performance.json`. Like `merge-website.ts`, it merges in place:
// each agent cell is keyed by `TtscBenchmarkGraphWebsiteCell.key` and upserted, so running one
// repo/model at a time accumulates cells across separate quiet-host runs instead
// of clobbering the others. The structural block is replaced whole.
//
// Only raw per-run samples are stored; medians and saved-percentages are left
// for the reader to derive, so the published JSON never carries a derived
// statistic that could drift out of sync with the prose at
// https://ttsc.dev/docs/benchmark#code-graph-mcp.
//
// Usage:
//   pnpm --dir experimental/benchmark graph:publish
//   pnpm --dir experimental/benchmark graph:publish -- --from <dir>
//   pnpm --dir experimental/benchmark graph:publish -- --reset
//   pnpm --dir experimental/benchmark graph:publish -- --dry-run
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { TtscBenchmarkConstant } from "../../TtscBenchmarkConstant.ts";
import { TtscBenchmarkGraphWebsiteCell } from "../../graph/TtscBenchmarkGraphWebsiteCell.ts";
import { ITtscBenchmarkGraphWebsiteAgentCell } from "../../graph/structures/ITtscBenchmarkGraphWebsiteAgentCell.ts";

interface IPublishedSample {
  tokens: number;
  cached?: number;
  reasoning?: number;
  tokensWithReasoning?: number;
  turns?: number;
  tools?: number;
  reads?: number;
  grep?: number;
  shell?: number;
  web?: number;
  graph?: number;
  other?: number;
  sourceTouches?: number;
  shellSource?: number;
  cost?: number;
  durMs?: number;
  run?: number;
  attempts?: number;
}

interface IBenchmarkSamples {
  baseline: IPublishedSample[];
  graph: IPublishedSample[];
}

interface IStoredSamples {
  baseline?: unknown[];
  graph?: unknown[];
}

interface IStoredWebsiteAgentCell extends ITtscBenchmarkGraphWebsiteAgentCell {
  [key: string]: unknown;
  samples?: IStoredSamples;
}

interface IPublishedAgentCell extends IStoredWebsiteAgentCell {
  samples: IBenchmarkSamples;
}

interface IWebsiteDocument {
  [key: string]: unknown;
  schemaVersion: number;
  generatedAt: string;
  structural: unknown;
  agent: {
    cells: IStoredWebsiteAgentCell[];
  };
  index?: unknown;
}

interface IStructuralReport extends Record<string, unknown> {
  coverage: number;
  nodes: number;
  project: string;
  totalEdges: number;
}

interface ISuiteCell extends Record<string, unknown> {
  report: string;
}

interface ISuiteReport extends Record<string, unknown> {
  cells: ISuiteCell[];
}

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = TtscBenchmarkConstant.REPOSITORY_ROOT;
const websiteJson = path.resolve(
  repoRoot,
  "website",
  "public",
  "benchmark",
  "graph.json",
);

const args = process.argv.slice(2);
const reset = args.includes("--reset");
const dryRun = args.includes("--dry-run");
const sourceDirs = parseSourceDirs(args);

const priorData = fs.existsSync(websiteJson)
  ? parseJsonFile(websiteJson)
  : { schemaVersion: 1, structural: null, agent: { cells: [] } };
if (!isRecord(priorData)) {
  throw new TypeError(`invalid graph website report: ${websiteJson}`);
}
const prior = priorData;

// Every block the document carries survives a publish that does not write it.
// This one rebuilt `out` from `structural` and `agent` alone, so a run that
// folded agent cells silently deleted the `index` axis — the cold build time,
// one cell per tool per repository, and the two charts that read it stopped
// being generated at all. The site went on serving the SVGs left on disk from
// the last build, which is worse than serving none, because a missing chart is
// visible and a stale one is not.
const out: IWebsiteDocument = {
  ...prior,
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  structural: prior.structural ?? null,
  agent: { cells: reset ? [] : storedWebsiteCells(prior) },
};
const PUBLISHED_SAMPLE_KEYS = [
  "tokens",
  "cached",
  "reasoning",
  "tokensWithReasoning",
  "turns",
  "tools",
  "reads",
  "grep",
  "shell",
  "web",
  "graph",
  "other",
  "sourceTouches",
  "shellSource",
  "cost",
  "durMs",
  "run",
  "attempts",
] as const satisfies readonly (keyof IPublishedSample)[];

for (const sourceDir of sourceDirs) {
  foldSourceDir(sourceDir);
}

if (!dryRun) {
  fs.mkdirSync(path.dirname(websiteJson), { recursive: true });
  fs.writeFileSync(websiteJson, `${JSON.stringify(out)}\n`);
}
console.log(
  `\n${dryRun ? "Would write" : "Wrote"} ${path.relative(repoRoot, websiteJson)} ` +
    `(${out.agent.cells.length} agent cell(s)).`,
);

function foldSourceDir(sourceDir: string): void {
  const mainReportPath = path.join(sourceDir, "report.json");
  const mainReport = readJson(mainReportPath);
  let structuralReport: IStructuralReport | null = null;
  if (mainReport !== null && isSuiteReport(mainReport)) {
    foldSuite(mainReport, sourceDir);
  } else if (mainReport !== null && isStructuralReport(mainReport)) {
    structuralReport = mainReport;
  } else if (mainReport !== null) {
    throw new TypeError(`invalid graph benchmark report: ${mainReportPath}`);
  }

  const nestedStructuralPath = path.join(
    sourceDir,
    "structural",
    "report.json",
  );
  const nestedStructural = readJson(nestedStructuralPath);
  if (nestedStructural !== null) {
    if (!isStructuralReport(nestedStructural)) {
      throw new TypeError(
        `invalid graph structural report: ${nestedStructuralPath}`,
      );
    }
    if (structuralReport !== null) {
      throw new Error(
        `duplicate graph structural reports: ${mainReportPath}, ${nestedStructuralPath}`,
      );
    }
    structuralReport = nestedStructural;
  }
  if (structuralReport !== null) foldStructural(structuralReport);

  // Agent cells: upsert each available report by harness/tool/repo/model.
  foldAgentFile(path.join(sourceDir, "agent-ab-report.json"), "claude-code");
  foldAgentFile(path.join(sourceDir, "agent-ab-codex-report.json"), "codex");
}

function foldStructural(structural: IStructuralReport): void {
  structural.project = structural.project.split(path.sep).join("/");
  out.structural = structural;
  console.log(
    `structural: ${structural.nodes} nodes, ${structural.totalEdges} edges, ` +
      `coverage ${(structural.coverage * 100).toFixed(1)}%`,
  );
}

function foldSuite(report: ISuiteReport, sourceDir: string): void {
  const seenReports = new Set<string>();
  for (const cell of report.cells) {
    const sourceReportPath = resolveReportPath(cell.report, sourceDir);
    const reportKey = pathIdentity(sourceReportPath);
    if (seenReports.has(reportKey)) {
      throw new Error(`duplicate suite cell report: ${cell.report}`);
    }
    seenReports.add(reportKey);
    const sourceReport = readJson(sourceReportPath);
    if (sourceReport === null) {
      throw new Error(`missing suite cell report: ${cell.report}`);
    }
    if (!isAgentReport(sourceReport)) {
      throw new TypeError(`invalid graph agent report: ${sourceReportPath}`);
    }
    const rawModel =
      stringValue(sourceReport.modelVersion) ??
      stringValue(sourceReport.model) ??
      stringValue(cell.modelVersion) ??
      stringValue(cell.model);
    const harness = ITtscBenchmarkGraphWebsiteAgentCell.parseHarness(
      stringValue(cell.harness) ?? "",
    );
    const stableModel = stableAgentModel(
      harness,
      stringValue(cell.model),
      rawModel,
    );
    const version = modelVersionId(rawModel);
    const samples = sanitizeSamples(sourceReport.samples);
    if (samples.baseline.length === 0 && samples.graph.length === 0) {
      continue;
    }
    const toolSetupMs =
      numberValueOrUndefined(cell.toolSetupMs) ??
      numberValueOrUndefined(sourceReport.toolSetupMs);
    const effort = stringValue(sourceReport.effort);
    const promptId = stringValue(sourceReport.promptId);
    const promptFamily =
      stringValue(sourceReport.promptFamily) ?? stringValue(cell.promptFamily);
    const tool = ITtscBenchmarkGraphWebsiteAgentCell.parseTool(
      stringValue(cell.tool) ?? stringValue(sourceReport.tool) ?? "ttsc-graph",
    );
    const repo = ITtscBenchmarkGraphWebsiteAgentCell.parseRepo(
      stringValue(sourceReport.repo) ?? stringValue(cell.project) ?? "",
    );
    const websitePromptFamily =
      promptFamily === undefined
        ? undefined
        : ITtscBenchmarkGraphWebsiteAgentCell.parsePromptFamily(promptFamily);
    const questionSha256 = stringValue(sourceReport.questionSha256);
    const fixtureBranch =
      stringValue(sourceReport.fixtureBranch) ?? stringValue(cell.branch);
    const daemon =
      typeof sourceReport.daemon === "boolean"
        ? sourceReport.daemon
        : undefined;
    upsertAgentCell({
      harness,
      tool,
      ...(toolSetupMs !== undefined ? { toolSetupMs } : {}),
      repo,
      model: stableModel,
      ...(version ? { modelVersion: version } : {}),
      ...(effort ? { effort } : {}),
      ...(promptId ? { promptId } : {}),
      ...(websitePromptFamily ? { promptFamily: websitePromptFamily } : {}),
      ...(questionSha256 ? { questionSha256 } : {}),
      ...(fixtureBranch ? { fixtureBranch } : {}),
      ...(daemon !== undefined ? { daemon } : {}),
      runs: sourceReport.runs,
      question: sourceReport.question,
      samples,
    });
  }
  console.log(
    `suite: ${path.relative(repoRoot, sourceDir)} (${report.cells.length} cell(s))`,
  );
}

function foldAgentFile(file: string, harness: string): void {
  const report = readJson(file);
  if (report === null) return;
  if (!isAgentReport(report)) {
    throw new TypeError(`invalid graph agent report: ${file}`);
  }
  foldAgent(report, harness);
}

function foldAgent(report: Record<string, unknown>, harness: string): void {
  const samples = sanitizeSamples(report.samples);
  if (samples.baseline.length === 0 && samples.graph.length === 0) return;
  const rawModel =
    stringValue(report.modelVersion) ?? stringValue(report.model) ?? "unknown";
  const websiteHarness =
    ITtscBenchmarkGraphWebsiteAgentCell.parseHarness(harness);
  const stableModel = stableAgentModel(websiteHarness, undefined, rawModel);
  const version = modelVersionId(rawModel);
  const tool = ITtscBenchmarkGraphWebsiteAgentCell.parseTool(
    stringValue(report.tool) ?? "ttsc-graph",
  );
  const repo = ITtscBenchmarkGraphWebsiteAgentCell.parseRepo(
    stringValue(report.repo) ?? "",
  );
  const effort = stringValue(report.effort);
  const promptId = stringValue(report.promptId);
  const promptFamily = ITtscBenchmarkGraphWebsiteAgentCell.parsePromptFamily(
    stringValue(report.promptFamily) ?? "project-specific",
  );
  const questionSha256 = stringValue(report.questionSha256);
  const fixtureBranch = stringValue(report.fixtureBranch);
  const daemon = typeof report.daemon === "boolean" ? report.daemon : undefined;
  const toolSetupMs = numberValueOrUndefined(report.toolSetupMs);
  upsertAgentCell({
    harness: websiteHarness,
    tool,
    repo,
    model: stableModel,
    ...(version ? { modelVersion: version } : {}),
    ...(effort ? { effort } : {}),
    ...(promptId ? { promptId } : {}),
    promptFamily,
    ...(questionSha256 ? { questionSha256 } : {}),
    ...(fixtureBranch ? { fixtureBranch } : {}),
    ...(daemon !== undefined ? { daemon } : {}),
    ...(toolSetupMs !== undefined ? { toolSetupMs } : {}),
    runs: report.runs,
    question: report.question,
    samples,
  });
  const n =
    isRecord(report.samples) && Array.isArray(report.samples.graph)
      ? report.samples.graph.length
      : 0;
  console.log(
    `agent: ${harness} / ${tool} / ${repo} / ${promptFamily} / ${
      stringValue(report.model) ?? rawModel
    } (${n} graph runs)`,
  );
}

function stableAgentModel(
  harness: string,
  stableModel: string | undefined,
  rawModel: string | undefined,
): string {
  if (
    stableModel?.startsWith("codex-") ||
    stableModel?.startsWith("claude-code-")
  )
    return stableModel;
  if (rawModel?.startsWith("codex-") || rawModel?.startsWith("claude-code-"))
    return rawModel;
  if (rawModel === "sonnet" || rawModel?.startsWith("claude-sonnet-"))
    return "claude-code-sonnet";
  if (rawModel === "opus" || rawModel?.startsWith("claude-opus-"))
    return "claude-code-opus";
  if (rawModel?.startsWith("gpt-")) return agentLabel(rawModel);
  if (harness === "claude-code") return `claude-code-${rawModel ?? "unknown"}`;
  return rawModel ?? "unknown";
}

function modelVersionId(rawModel: string | undefined): string | undefined {
  if (rawModel?.startsWith("claude-") || rawModel?.startsWith("gpt-"))
    return rawModel;
  return undefined;
}

function agentLabel(resolvedModel: string): string {
  const tier = resolvedModel
    .split("-")
    .filter((token) => token && !/^[0-9.]+$/.test(token))
    .join("-");
  return `codex-${tier}`;
}

function upsertAgentCell(cell: IPublishedAgentCell): void {
  // A manifest promptId narrows the cell within a family, so two prompt variants
  // of the same family upsert separately instead of clobbering. Plain --repo
  // runs (no promptId) keep keying by family, as before.
  const at = out.agent.cells.findIndex(
    (c) =>
      TtscBenchmarkGraphWebsiteCell.key(c) ===
      TtscBenchmarkGraphWebsiteCell.key(cell),
  );
  if (at >= 0) {
    const existing = out.agent.cells[at]!;
    const existingBaseline = existing.samples?.baseline?.length ?? 0;
    const existingGraph = existing.samples?.graph?.length ?? 0;
    const nextBaseline = cell.samples?.baseline?.length ?? 0;
    const nextGraph = cell.samples?.graph?.length ?? 0;
    if (nextBaseline < existingBaseline || nextGraph < existingGraph) {
      console.warn(
        `skip thinner agent cell: ${cell.tool ?? "ttsc-graph"} / ${
          cell.repo
        } / ${cell.modelVersion ?? cell.model} / ${
          cell.promptFamily ?? "project-specific"
        } (${nextBaseline}/${nextGraph} < ${existingBaseline}/${existingGraph})`,
      );
      return;
    }
    out.agent.cells[at] = { ...existing, ...cell };
  } else out.agent.cells.push(cell);
}

function sanitizeSamples(samples: unknown): IBenchmarkSamples {
  const source = isRecord(samples) ? samples : {};
  return {
    baseline: (Array.isArray(source.baseline) ? source.baseline : [])
      .filter(validMeasuredSample)
      .map(sanitizeSample),
    graph: (Array.isArray(source.graph) ? source.graph : [])
      .filter(validMeasuredSample)
      .map(sanitizeSample),
  };
}

function validMeasuredSample(sample: unknown): sample is IPublishedSample {
  if (!isRecord(sample) || !(Number(sample.tokens ?? 0) > 0)) return false;
  return PUBLISHED_SAMPLE_KEYS.every(
    (key) => sample[key] === undefined || typeof sample[key] === "number",
  );
}

function sanitizeSample(sample: IPublishedSample): IPublishedSample {
  const out: Partial<Record<keyof IPublishedSample, number>> = {};
  for (const key of PUBLISHED_SAMPLE_KEYS) {
    if (sample[key] !== undefined) out[key] = sample[key];
  }
  return { ...out, tokens: sample.tokens };
}

function readJson(file: string): unknown | null {
  if (!fs.existsSync(file)) return null;
  return parseJsonFile(file);
}

function resolveReportPath(reportPath: string, sourceDir: string): string {
  if (!reportPath) return "";
  if (path.isAbsolute(reportPath)) return reportPath;
  const fromRoot = path.resolve(repoRoot, reportPath);
  if (fs.existsSync(fromRoot)) return fromRoot;
  return path.resolve(sourceDir, reportPath);
}

function parseSourceDirs(argv: readonly string[]): string[] {
  const dirs: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--from" || arg === "--source") {
      const next = argv[++i];
      if (!next) throw new Error(`${arg} requires a directory`);
      dirs.push(path.resolve(repoRoot, next));
    } else if (arg.startsWith("--from=")) {
      dirs.push(path.resolve(repoRoot, arg.slice("--from=".length)));
    } else if (arg.startsWith("--source=")) {
      dirs.push(path.resolve(repoRoot, arg.slice("--source=".length)));
    }
  }
  const selected =
    dirs.length > 0
      ? dirs
      : [path.join(TtscBenchmarkConstant.WORK_ROOT, "graph")];
  const unique = new Set(selected.map(pathIdentity));
  if (unique.size !== selected.length) {
    throw new Error("duplicate graph benchmark source directory");
  }
  return selected;
}

function parseJsonFile(file: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
  } catch (error) {
    const detail = error instanceof Error ? `: ${error.message}` : "";
    throw new SyntaxError(`invalid JSON in ${file}${detail}`);
  }
}

function storedWebsiteCells(data: unknown): IStoredWebsiteAgentCell[] {
  if (
    !isRecord(data) ||
    !isRecord(data.agent) ||
    !Array.isArray(data.agent.cells) ||
    !data.agent.cells.every(isStoredWebsiteAgentCell)
  ) {
    throw new TypeError(`invalid graph website report: ${websiteJson}`);
  }
  return data.agent.cells;
}

function isStoredWebsiteAgentCell(
  cell: unknown,
): cell is IStoredWebsiteAgentCell {
  if (
    !isRecord(cell) ||
    typeof cell.harness !== "string" ||
    !ITtscBenchmarkGraphWebsiteAgentCell.isHarness(cell.harness) ||
    typeof cell.repo !== "string" ||
    !ITtscBenchmarkGraphWebsiteAgentCell.isRepo(cell.repo) ||
    typeof cell.model !== "string" ||
    (cell.tool !== undefined &&
      (typeof cell.tool !== "string" ||
        !ITtscBenchmarkGraphWebsiteAgentCell.isTool(cell.tool))) ||
    (cell.promptId !== undefined && typeof cell.promptId !== "string") ||
    (cell.promptFamily !== undefined &&
      (typeof cell.promptFamily !== "string" ||
        !ITtscBenchmarkGraphWebsiteAgentCell.isPromptFamily(
          cell.promptFamily,
        ))) ||
    (cell.daemon !== undefined && typeof cell.daemon !== "boolean")
  ) {
    return false;
  }
  if (cell.samples === undefined) return true;
  return (
    isRecord(cell.samples) &&
    (cell.samples.baseline === undefined ||
      Array.isArray(cell.samples.baseline)) &&
    (cell.samples.graph === undefined || Array.isArray(cell.samples.graph))
  );
}

function numberValueOrUndefined(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function pathIdentity(value: string): string {
  const normalized = path.normalize(value);
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

function isStructuralReport(value: unknown): value is IStructuralReport {
  return (
    isRecord(value) &&
    typeof value.project === "string" &&
    typeof value.nodes === "number" &&
    typeof value.totalEdges === "number" &&
    typeof value.coverage === "number"
  );
}

function isSuiteReport(value: unknown): value is ISuiteReport {
  return (
    isRecord(value) &&
    Array.isArray(value.cells) &&
    value.cells.every(
      (cell): cell is ISuiteCell =>
        isRecord(cell) && typeof cell.report === "string",
    )
  );
}

function isAgentReport(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value) || !isRecord(value.samples)) return false;
  const optionalStrings = [
    "effort",
    "fixtureBranch",
    "harness",
    "model",
    "modelVersion",
    "promptFamily",
    "promptId",
    "question",
    "questionSha256",
    "repo",
    "tool",
  ] as const;
  return (
    optionalStrings.every(
      (key) => value[key] === undefined || typeof value[key] === "string",
    ) &&
    (value.runs === undefined || typeof value.runs === "number") &&
    (value.toolSetupMs === undefined ||
      typeof value.toolSetupMs === "number") &&
    (value.daemon === undefined || typeof value.daemon === "boolean") &&
    Array.isArray(value.samples.baseline) &&
    value.samples.baseline.every(isAgentSample) &&
    Array.isArray(value.samples.graph) &&
    value.samples.graph.every(isAgentSample)
  );
}

function isAgentSample(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const requiredNumbers = [
    "durMs",
    "graph",
    "shell",
    "tokens",
    "tools",
    "web",
  ] as const;
  const optionalNumbers = [
    "attempts",
    "cached",
    "cost",
    "grep",
    "other",
    "reads",
    "reasoning",
    "run",
    "shellSource",
    "sourceTouches",
    "tokensWithReasoning",
    "turns",
  ] as const;
  return (
    requiredNumbers.every((key) => typeof value[key] === "number") &&
    optionalNumbers.every(
      (key) => value[key] === undefined || typeof value[key] === "number",
    ) &&
    typeof value.ok === "boolean" &&
    typeof value.answer === "string" &&
    typeof value.error === "string" &&
    Array.isArray(value.shellCommands) &&
    value.shellCommands.every((command) => typeof command === "string")
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
