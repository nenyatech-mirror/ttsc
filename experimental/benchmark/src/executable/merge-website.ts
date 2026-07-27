#!/usr/bin/env node
/**
 * Merge per-(project, branch) partial benchmark reports into
 * `website/public/benchmark/performance.json`.
 *
 * Used after collecting partial `experimental/benchmark/.work/report.json`
 * files into one directory. Each partial may live directly in that directory or
 * in its own subdirectory before this script is invoked:
 *
 * Node --experimental-transform-types src/executable/merge-website.ts
 * <partials-dir> <website-json>
 *
 * Semantics:
 *
 * - Each partial's measurements are inserted into the matching project of
 *   `website-json` by cell `id`. Existing measurements with the same id are
 *   replaced; ids not present in any partial are kept untouched. This lets a
 *   partial run (e.g. only `vue,rxjs` re-measured) refresh those cells without
 *   nuking history for the others.
 * - Project-level fields (`files`, `typescript`, `kind`, `repo`) are taken from
 *   the partial when present; otherwise the website's existing values are
 *   preserved.
 * - Top-level `date` / `host` / `runs` / `warmup` are taken from the freshest
 *   partial _that actually carries measurements_. Verify-only partials (no
 *   measurements anywhere) cannot rotate the host block and therefore cannot
 *   trigger a noisy "host metadata changed" commit.
 * - Partials missing a `report.json` are skipped with a warning so a single
 *   failed partial does not break the merge.
 */
import fs from "node:fs";
import path from "node:path";

import { TtscBenchmarkObject } from "../TtscBenchmarkObject.ts";

/**
 * One publishable benchmark measurement, keyed by its stable benchmark cell
 * identity.
 */
interface IMeasurement extends Record<string, unknown> {
  id: string;
  branch: "legacy" | "ttsc" | "ttsc-lint";
  tool:
    | "tsc"
    | "tsgo"
    | "ttsc"
    | "ttsc+@ttsc/lint"
    | "eslint"
    | "@ttsc/lint"
    | "ttsc-format"
    | "prettier";
  op: "build" | "noEmit" | "eslint" | "format";
  threading: "single" | "checkers2" | "checkers4" | "checkers8" | "multi";
  samples: number[];
  lintSamples?: number[];
  lintPluginSamples?: number[];
  transformHostSamples?: number[];
  raceRetries?: number;
  failure?: "race" | "error";
  exitStatus?: number | null;
}

/** Published measurements and source metadata for one benchmark fixture. */
interface IProjectReport extends Record<string, unknown> {
  name: string;
  repo: string;
  kind: string;
  files: number;
  typescript: string;
  tsgo: string;
  measurements: IMeasurement[];
}

/** Hardware and toolchain identity attached to a benchmark publication. */
interface IHostReport extends Record<string, unknown> {
  os: string;
  kernel: string;
  cpu: string;
  cores: number;
  ramGB: number;
  node: string;
  ttsc: string;
  typescript: string;
  tsgo: string;
}

/** Complete JSON contract consumed by the performance benchmark website. */
interface IBenchmarkReport extends Record<string, unknown> {
  date: string;
  host: IHostReport;
  runs: number;
  warmup: number;
  projects: IProjectReport[];
}

/** A validated partial report paired with its containing directory name. */
interface IPartialReport {
  name: string;
  data: IBenchmarkReport;
}

const [partialsDir, websiteJsonPath] = process.argv.slice(2);
if (!partialsDir || !websiteJsonPath) {
  console.error(
    "usage: merge-website.ts <partials-dir> <website-benchmark.json>",
  );
  process.exit(1);
}

/**
 * Loads JSON as untrusted data, returning `null` when the file cannot be read
 * or parsed so each caller can apply its own failure policy.
 */
const loadJson = (file: string): unknown => {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
};

const loadedWebsite: unknown = loadJson(websiteJsonPath);
if (!isBenchmarkReport(loadedWebsite)) {
  throw new Error(
    `[merge] ${websiteJsonPath}: existing website benchmark is invalid`,
  );
}
const website: IBenchmarkReport = loadedWebsite;

const partials: IPartialReport[] = [];
for (const entry of fs.readdirSync(partialsDir, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const reportPath = path.join(partialsDir, entry.name, "report.json");
  if (!fs.existsSync(reportPath)) {
    console.warn(`[merge] ${entry.name}: report.json missing, skipping`);
    continue;
  }
  const data = loadJson(reportPath);
  if (!isBenchmarkReport(data)) {
    console.warn(`[merge] ${entry.name}: not a valid report, skipping`);
    continue;
  }
  partials.push({ name: entry.name, data });
}

/** Counts the validated measurement cells carried by one report. */
const countMeasurements = (report: IBenchmarkReport): number =>
  report.projects.reduce(
    (sum: number, project: IProjectReport): number =>
      sum + project.measurements.length,
    0,
  );

const partialsWithData = partials.filter(
  (partial) => countMeasurements(partial.data) > 0,
);
const freshest: IPartialReport | null = partialsWithData.reduce(
  (best: IPartialReport | null, partial: IPartialReport) => {
    if (!best) return partial;
    const a = Date.parse(best.data.date ?? "") || 0;
    const b = Date.parse(partial.data.date ?? "") || 0;
    return b > a ? partial : best;
  },
  null,
);
if (freshest) {
  if (freshest.data.date) website.date = freshest.data.date;
  if (freshest.data.host) website.host = freshest.data.host;
  if (freshest.data.runs != null) website.runs = freshest.data.runs;
  if (freshest.data.warmup != null) website.warmup = freshest.data.warmup;
}

for (const { name, data } of partials) {
  for (const project of data.projects) {
    const idx: number = website.projects.findIndex(
      (candidate: IProjectReport) => candidate.name === project.name,
    );
    if (idx === -1) {
      website.projects.push(project);
      console.log(
        `[merge] ${name}: appended new project ${project.name} ` +
          `(${project.measurements?.length ?? 0} measurements)`,
      );
      continue;
    }
    const existing: IProjectReport = website.projects[idx]!;
    const freshById: Map<string, IMeasurement> = new Map(
      (project.measurements ?? []).map(
        (measurement: IMeasurement): [string, IMeasurement] => [
          measurement.id,
          measurement,
        ],
      ),
    );
    const measurements: IMeasurement[] = [];
    for (const old of existing.measurements ?? []) {
      const fresh = freshById.get(old.id);
      if (fresh) {
        measurements.push(fresh);
        freshById.delete(old.id);
      } else {
        measurements.push(old);
      }
    }
    measurements.push(...freshById.values());
    website.projects[idx] = {
      ...existing,
      ...project,
      measurements,
    };
    console.log(
      `[merge] ${name}: ${project.name} ` +
        `(${project.measurements?.length ?? 0} fresh, ` +
        `${measurements.length} total)`,
    );
  }
}

fs.writeFileSync(websiteJsonPath, JSON.stringify(website, null, 2) + "\n");
console.log(
  `[merge] wrote ${websiteJsonPath} (${website.projects.length} projects)`,
);

/**
 * Tests whether an unknown value satisfies the complete, internally unambiguous
 * website publication contract.
 */
function isBenchmarkReport(input: unknown): input is IBenchmarkReport {
  if (
    !TtscBenchmarkObject.isRecord(input) ||
    !isIsoDate(input.date) ||
    !isPositiveInteger(input.runs) ||
    !isNonNegativeInteger(input.warmup) ||
    !isHostReport(input.host) ||
    !Array.isArray(input.projects)
  ) {
    return false;
  }
  const projectNames: Set<string> = new Set();
  for (const project of input.projects) {
    if (!isProjectReport(project) || projectNames.has(project.name)) {
      return false;
    }
    projectNames.add(project.name);
  }
  return true;
}

/**
 * Tests whether an unknown value is one complete project publication and
 * rejects duplicate or semantically inconsistent cell identities.
 */
function isProjectReport(input: unknown): input is IProjectReport {
  if (
    !TtscBenchmarkObject.isRecord(input) ||
    !isNonEmptyString(input.name) ||
    !isNonEmptyString(input.repo) ||
    !isNonEmptyString(input.kind) ||
    !isNonNegativeInteger(input.files) ||
    !isNonEmptyString(input.typescript) ||
    !isNonEmptyString(input.tsgo) ||
    !Array.isArray(input.measurements)
  ) {
    return false;
  }
  const measurementIds: Set<string> = new Set();
  for (const measurement of input.measurements) {
    if (
      !isMeasurement(measurement, input.name) ||
      measurementIds.has(measurement.id)
    ) {
      return false;
    }
    measurementIds.add(measurement.id);
  }
  return true;
}

/**
 * Tests whether an unknown value is a complete benchmark measurement whose id
 * agrees with its project and benchmark axes.
 */
function isMeasurement(
  input: unknown,
  projectName: string,
): input is IMeasurement {
  if (
    !TtscBenchmarkObject.isRecord(input) ||
    !isBenchmarkBranch(input.branch) ||
    !isBenchmarkTool(input.tool) ||
    !isBenchmarkOperation(input.op) ||
    !isBenchmarkThreading(input.threading)
  ) {
    return false;
  }
  const expectedId: string = (
    input.tool === "tsgo"
      ? [projectName, input.branch, "tsgo", input.op, input.threading]
      : [projectName, input.branch, input.op, input.threading]
  ).join(":");
  return (
    input.id === expectedId &&
    isNumberArray(input.samples) &&
    isOptionalNumberArray(input.lintSamples) &&
    isOptionalNumberArray(input.lintPluginSamples) &&
    isOptionalNumberArray(input.transformHostSamples) &&
    (input.raceRetries === undefined ||
      isNonNegativeInteger(input.raceRetries)) &&
    (input.failure === undefined ||
      input.failure === "race" ||
      input.failure === "error") &&
    (input.exitStatus === undefined ||
      input.exitStatus === null ||
      Number.isInteger(input.exitStatus))
  );
}

/** Tests whether an unknown value contains every published host field. */
function isHostReport(input: unknown): input is IHostReport {
  return (
    TtscBenchmarkObject.isRecord(input) &&
    isNonEmptyString(input.os) &&
    isNonEmptyString(input.kernel) &&
    isNonEmptyString(input.cpu) &&
    isPositiveInteger(input.cores) &&
    isPositiveNumber(input.ramGB) &&
    isNonEmptyString(input.node) &&
    isNonEmptyString(input.ttsc) &&
    isNonEmptyString(input.typescript) &&
    isNonEmptyString(input.tsgo)
  );
}

/** Tests whether an unknown value is a supported benchmark branch. */
function isBenchmarkBranch(input: unknown): input is IMeasurement["branch"] {
  return input === "legacy" || input === "ttsc" || input === "ttsc-lint";
}

/** Tests whether an unknown value is a tool rendered by the benchmark website. */
function isBenchmarkTool(input: unknown): input is IMeasurement["tool"] {
  return (
    input === "tsc" ||
    input === "tsgo" ||
    input === "ttsc" ||
    input === "ttsc+@ttsc/lint" ||
    input === "eslint" ||
    input === "@ttsc/lint" ||
    input === "ttsc-format" ||
    input === "prettier"
  );
}

/** Tests whether an unknown value is a supported benchmark operation. */
function isBenchmarkOperation(input: unknown): input is IMeasurement["op"] {
  return (
    input === "build" ||
    input === "noEmit" ||
    input === "eslint" ||
    input === "format"
  );
}

/** Tests whether an unknown value is a supported benchmark threading mode. */
function isBenchmarkThreading(
  input: unknown,
): input is IMeasurement["threading"] {
  return (
    input === "single" ||
    input === "checkers2" ||
    input === "checkers4" ||
    input === "checkers8" ||
    input === "multi"
  );
}

/** Tests whether an unknown value is a finite, non-negative sample array. */
function isNumberArray(input: unknown): input is number[] {
  return (
    Array.isArray(input) &&
    input.every(
      (value: unknown): value is number =>
        typeof value === "number" && Number.isFinite(value) && value >= 0,
    )
  );
}

/** Tests whether an optional unknown value is a valid sample array. */
function isOptionalNumberArray(input: unknown): input is number[] | undefined {
  return input === undefined || isNumberArray(input);
}

/** Tests whether an unknown value is a non-empty string. */
function isNonEmptyString(input: unknown): input is string {
  return typeof input === "string" && input.length > 0;
}

/** Tests whether an unknown value is a finite positive number. */
function isPositiveNumber(input: unknown): input is number {
  return typeof input === "number" && Number.isFinite(input) && input > 0;
}

/** Tests whether an unknown value is a positive integer. */
function isPositiveInteger(input: unknown): input is number {
  return isPositiveNumber(input) && Number.isInteger(input);
}

/** Tests whether an unknown value is a finite non-negative integer. */
function isNonNegativeInteger(input: unknown): input is number {
  return (
    typeof input === "number" &&
    Number.isFinite(input) &&
    Number.isInteger(input) &&
    input >= 0
  );
}

/** Tests whether an unknown value is a canonical ISO publication timestamp. */
function isIsoDate(input: unknown): input is string {
  if (!isNonEmptyString(input)) return false;
  const timestamp: number = Date.parse(input);
  return (
    Number.isFinite(timestamp) && new Date(timestamp).toISOString() === input
  );
}
