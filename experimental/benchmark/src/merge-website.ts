#!/usr/bin/env node
/**
 * Merge per-(project, branch) partial benchmark reports into
 * `website/public/benchmark/performance.json`.
 *
 * Used after collecting partial `experimental/benchmark/.work/report.json`
 * files into one directory. Each partial may live directly in that directory or
 * in its own subdirectory before this script is invoked:
 *
 * Node --experimental-strip-types src/merge-website.ts <partials-dir>
 * <website-json>
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

import { isRecord } from "./utils/isRecord.ts";

interface IMeasurement extends Record<string, unknown> {
  id: string;
}

interface IProjectReport extends Record<string, unknown> {
  name: string;
  measurements?: IMeasurement[];
}

interface IBenchmarkReport extends Record<string, unknown> {
  date?: string;
  host?: unknown;
  runs?: number;
  warmup?: number;
  projects: IProjectReport[];
}

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

const loadJson = (file: string): unknown => {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
};

const loadedWebsite: unknown = loadJson(websiteJsonPath);
const website: IBenchmarkReport = isBenchmarkReport(loadedWebsite)
  ? loadedWebsite
  : { projects: [] };

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

const countMeasurements = (report: IBenchmarkReport): number =>
  report.projects.reduce(
    (sum: number, project: IProjectReport): number =>
      sum +
      (Array.isArray(project.measurements) ? project.measurements.length : 0),
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

function isBenchmarkReport(input: unknown): input is IBenchmarkReport {
  return (
    isRecord(input) &&
    Array.isArray(input.projects) &&
    input.projects.every(
      (project: unknown): project is IProjectReport =>
        isRecord(project) &&
        typeof project.name === "string" &&
        (project.measurements === undefined ||
          (Array.isArray(project.measurements) &&
            project.measurements.every(
              (measurement: unknown): measurement is IMeasurement =>
                isRecord(measurement) && typeof measurement.id === "string",
            ))),
    )
  );
}
