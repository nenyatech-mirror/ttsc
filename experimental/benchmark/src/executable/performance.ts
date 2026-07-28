#!/usr/bin/env node
/**
 * Prepared-clone benchmark runner for the ttsc comparison matrix.
 *
 * The benchmark worktree is `experimental/benchmark/.work` by default. Each
 * measured repository is cloned once per branch into:
 *
 * .work/<repo>@legacy .work/<repo>@ttsc .work/<repo>@ttsc-lint
 *
 * Existing clone directories are preserved. Missing directories are cloned,
 * installed, prepared, and then measured. `ttsc prepare` runs before timings so
 * plugin/native binary build time is not included in compiler measurements.
 *
 * Useful modes:
 *
 * - `pnpm --dir experimental/benchmark performance -- --setup-only`
 * - `pnpm --dir experimental/benchmark performance -- --verify-only`
 * - `pnpm --dir experimental/benchmark performance -- --project vue --project
 *   rxjs`
 * - `pnpm --dir experimental/benchmark performance -- --project=vue
 *   --ttsc-build-only`
 * - `pnpm --dir experimental/benchmark performance -- --project=vue
 *   --only-ttsc-build --reset`
 * - `pnpm --dir experimental/benchmark performance -- --project=vue
 *   --only-ttsc-build --no-website`
 * - `pnpm --dir experimental/benchmark performance -- --project=vue --lint-only`
 * - `pnpm --dir experimental/benchmark performance --
 *   --cell-filter=':ttsc:build:' vue zod`
 *
 * Default output is milestone-only: phase timers, per-cell `run i: N ms`, and
 * short status lines ("Cloning X", "Installing X", "Reusing X"). Child process
 * stdio (pnpm/npm/yarn install, pack, per-step build output) is captured and
 * suppressed.
 *
 * Pass `--verbose` to surface everything — child stdio is teed live, and the
 * granular `[cmd] start/done`, `[step] start/done`, and `[timer] start` traces
 * are added back. This is the mode intended for AI/agent runs that need the
 * full command transcript for diagnosis; a human watching live progress usually
 * wants the default.
 */
import os from "node:os";
import path from "node:path";

import { TtscBenchmarkConstant } from "../TtscBenchmarkConstant.ts";
import { TtscBenchmarkObject } from "../TtscBenchmarkObject.ts";
import { TtscBenchmarkPerformanceCell } from "../performance/TtscBenchmarkPerformanceCell.ts";
import { TtscBenchmarkPerformanceConfiguration } from "../performance/TtscBenchmarkPerformanceConfiguration.ts";
import { TtscBenchmarkPerformanceConstant } from "../performance/TtscBenchmarkPerformanceConstant.ts";
import { TtscBenchmarkPerformanceMeasurement } from "../performance/TtscBenchmarkPerformanceMeasurement.ts";
import { TtscBenchmarkPerformanceOption } from "../performance/TtscBenchmarkPerformanceOption.ts";
import { TtscBenchmarkPerformancePackage } from "../performance/TtscBenchmarkPerformancePackage.ts";
import { TtscBenchmarkPerformanceProcess } from "../performance/TtscBenchmarkPerformanceProcess.ts";
import { TtscBenchmarkPerformanceReport } from "../performance/TtscBenchmarkPerformanceReport.ts";
import { TtscBenchmarkPerformanceRunner } from "../performance/TtscBenchmarkPerformanceRunner.ts";
import { TtscBenchmarkPerformanceSetup } from "../performance/TtscBenchmarkPerformanceSetup.ts";
import { TtscBenchmarkPerformanceVerifier } from "../performance/TtscBenchmarkPerformanceVerifier.ts";
import { TtscBenchmarkPerformanceWorktree } from "../performance/TtscBenchmarkPerformanceWorktree.ts";
import type { ITtscBenchmarkPerformanceProject } from "../performance/structures/ITtscBenchmarkPerformanceProject.ts";
import type { ITtscBenchmarkPerformanceTarball } from "../performance/structures/ITtscBenchmarkPerformanceTarball.ts";

type Project = ITtscBenchmarkPerformanceProject;
type LocalTarball = ITtscBenchmarkPerformanceTarball;

const { cellFilters, flags, projectArgs, positional } =
  TtscBenchmarkPerformanceOption.parse(process.argv.slice(2));
const REPO_ROOT = TtscBenchmarkConstant.REPOSITORY_ROOT;
const WORK = process.env.TTSC_BENCH_WORK ?? TtscBenchmarkConstant.WORK_ROOT;
const TGZ =
  process.env.TTSC_BENCH_TGZ ??
  path.join(
    os.tmpdir(),
    flags.has("--no-pack") ? "ttsc-tgz" : `ttsc-tgz-${process.pid}`,
  );
const OUT =
  process.env.TTSC_BENCH_OUT ??
  path.resolve(TtscBenchmarkConstant.WORK_ROOT, "report.md");
const WEBSITE_JSON = path.resolve(
  REPO_ROOT,
  "website",
  "public",
  "benchmark",
  "performance.json",
);
const REPORT_JSON = OUT.replace(/\.md$/, ".json");
const CHECKPOINT_JSON =
  process.env.TTSC_BENCH_CHECKPOINT ??
  path.resolve(WORK, "benchmark.checkpoint.json");
const TSCONFIG_FILES = path.join(import.meta.dirname, "tsconfig-files.ts");

const RUNS = TtscBenchmarkPerformanceOption.number("TTSC_BENCH_RUNS", 5);
const WARMUP = TtscBenchmarkPerformanceOption.number("TTSC_BENCH_WARMUP", 1, {
  allowZero: true,
});
const RETRIES = TtscBenchmarkPerformanceOption.number("TTSC_BENCH_RETRIES", 2);
// AI/debug knob — see the header comment. When set, child stdio is inherited
// (teed for runSteps so race detection still works) and granular start/done
// traces are written. Human runs leave it off and read milestone lines only.
const VERBOSE = flags.has("--verbose");
const performanceProcess = new TtscBenchmarkPerformanceProcess({
  tsconfigFiles: TSCONFIG_FILES,
  verbose: VERBOSE,
});
const performanceCellOptions: TtscBenchmarkPerformanceCell.IOptions = {
  cellFilters,
  flags,
};
const performanceWorktree = new TtscBenchmarkPerformanceWorktree({
  workRoot: WORK,
  cell: performanceCellOptions,
  process: performanceProcess,
});
const performanceMeasurement = new TtscBenchmarkPerformanceMeasurement({
  runs: RUNS,
  warmup: WARMUP,
  retries: RETRIES,
  process: performanceProcess,
  worktree: performanceWorktree,
});
const performanceVerifier = new TtscBenchmarkPerformanceVerifier({
  cell: performanceCellOptions,
  process: performanceProcess,
  worktree: performanceWorktree,
});
const TTSC_VERSION = TtscBenchmarkPerformancePackage.readRequiredVersion(
  path.join(REPO_ROOT, "packages/ttsc/package.json"),
);
// Pin the TypeScript-Go runtime to the repository lockfile, not whatever a
// fixture happened to resolve. Fixtures will be normalized later so every ttsc
// branch measures the same workspace runtime.
const TYPESCRIPT_GO_VERSION = TtscBenchmarkPerformancePackage.requireString(
  TtscBenchmarkPerformancePackage.readTypeScriptGoLockVersion(REPO_ROOT) ??
    TtscBenchmarkPerformancePackage.version(
      path.join(REPO_ROOT, "node_modules", "typescript"),
    ) ??
    TtscBenchmarkPerformancePackage.readTypeScriptGoCatalogVersion(REPO_ROOT),
  "unable to resolve the pinned TypeScript-Go version",
);
const PLATFORM_KEY = `${process.platform}-${process.arch}`;
const PLATFORM_PACKAGE = `@ttsc/${PLATFORM_KEY}`;
const LOCAL_TARBALLS: LocalTarball[] = [
  {
    dir: "packages/ttsc",
    file: `ttsc-${TTSC_VERSION}.tgz`,
    name: "ttsc",
  },
  {
    dir: "packages/lint",
    file: `ttsc-lint-${TTSC_VERSION}.tgz`,
    name: "@ttsc/lint",
  },
  {
    dir: `packages/ttsc-${PLATFORM_KEY}`,
    file: `ttsc-${PLATFORM_KEY}-${TTSC_VERSION}.tgz`,
    name: PLATFORM_PACKAGE,
  },
];
const performanceSetup = new TtscBenchmarkPerformanceSetup({
  paths: {
    repositoryRoot: REPO_ROOT,
    workRoot: WORK,
    tarballRoot: TGZ,
  },
  flags,
  tarballs: LOCAL_TARBALLS,
  version: {
    ttsc: TTSC_VERSION,
    typescriptGo: TYPESCRIPT_GO_VERSION,
  },
  platform: {
    packageName: PLATFORM_PACKAGE,
    packages: TtscBenchmarkPerformanceConstant.PLATFORM_PACKAGES,
    operatingSystem: process.platform,
  },
  process: performanceProcess,
  worktree: performanceWorktree,
});

const PROJECTS: Project[] = [...TtscBenchmarkPerformanceConfiguration.PROJECTS];
const performanceReport = new TtscBenchmarkPerformanceReport({
  checkpointJson: CHECKPOINT_JSON,
  legacyTypescriptDisplayVersion:
    TtscBenchmarkPerformanceConstant.LEGACY_TYPESCRIPT_DISPLAY_VERSION,
  outputMarkdown: OUT,
  projects: PROJECTS,
  publishWebsite: !flags.has("--no-website"),
  reportJson: REPORT_JSON,
  reset: flags.has("--reset"),
  runs: RUNS,
  ttscVersion: TTSC_VERSION,
  typescriptGoVersion: TYPESCRIPT_GO_VERSION,
  warmup: WARMUP,
  websiteJson: WEBSITE_JSON,
  worktree: performanceWorktree,
});

const projectSelection = [...projectArgs, ...positional];
const wantedProjects: Project[] = projectSelection.length
  ? projectSelection
      .map((project) => TtscBenchmarkPerformanceConfiguration.project(project))
      .filter(TtscBenchmarkObject.isDefined)
  : PROJECTS;
const performanceRunner = new TtscBenchmarkPerformanceRunner({
  flags,
  projects: wantedProjects,
  paths: {
    workRoot: WORK,
    tarballRoot: TGZ,
    outputMarkdown: OUT,
    websiteJson: WEBSITE_JSON,
  },
  cell: performanceCellOptions,
  measurement: performanceMeasurement,
  process: performanceProcess,
  report: performanceReport,
  setup: performanceSetup,
  verifier: performanceVerifier,
  worktree: performanceWorktree,
});

if (
  projectSelection.length &&
  wantedProjects.length !== projectSelection.length
) {
  const known = PROJECTS.map((p) => `${p.name} (${p.repoName})`).join(", ");
  throw new Error(`unknown project selection. Known: ${known}`);
}
if (flags.has("--list")) {
  performanceRunner.printConfig();
  process.exit(0);
}
performanceRunner.main();
