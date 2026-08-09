import { assert, fs, path, workspaceRoot } from "../../internal/toolchain";

/**
 * Verifies release preflight precedes publication without a Marketplace gate.
 *
 * Locks the ordering in `.github/workflows/release.yml`. Deterministic tag and
 * package validation must precede build and credential use, while eventual
 * consistency in the public Marketplace index must not block the independent
 * npm release channel.
 *
 * Order is a property of what the workflow runs, so the comments come out
 * first. #726 documented the runner's disk reclaim in prose that names `pnpm
 * run build`, several lines above the step that invokes it, and a raw text scan
 * read that sentence as the build itself and reported it running before the
 * preflight. The workflow was correct and this gate was not. Prose about a
 * command is not the command, and a gate that cannot tell them apart fails on
 * the next comment that mentions one.
 *
 * Publication order is not a dependency. The extension leads the release, but
 * v0.26.0 answered 401 at the Marketplace and took the whole npm release down
 * with it, publishing the compiler, the runtime, and seven platform binaries
 * nowhere. Both recorded Marketplace failures were the gallery's own, so the
 * step tolerates its rejection and `marketplace-report` annotates the run
 * without failing it.
 *
 * 1. Read the release workflow and drop its comment lines.
 * 2. Locate deterministic preflight, build, credentials, and both publications.
 * 3. Assert preflight precedes every mutation and no Marketplace probe is wired
 *    into the release path.
 * 4. Assert releases serialize, and that a Marketplace rejection neither blocks
 *    npm, nor fails the release, nor passes unreported.
 */
export const test_release_workflow_runs_preflight_before_publication = () => {
  const source = fs.readFileSync(
    path.join(workspaceRoot, ".github", "workflows", "release.yml"),
    "utf8",
  );
  // A `#` opening a line is a YAML comment; one inside a value is not, and no
  // step this gate looks for is written on a commented line.
  const workflow = source
    .split("\n")
    .filter((line) => !/^\s*#/.test(line))
    .join("\n");

  const preflight = workflow.indexOf("scripts/release-preflight.cjs");
  assert.notEqual(preflight, -1, "release-preflight.cjs step is missing");
  assert.equal(
    workflow.lastIndexOf("scripts/release-preflight.cjs"),
    preflight,
    "release-preflight.cjs must be invoked exactly once",
  );

  assert.equal(
    workflow.indexOf("scripts/assert-marketplace-version.cjs"),
    -1,
    "public Marketplace indexing must not gate the release workflow",
  );

  const marketplacePublish = workflow.indexOf("publish-vscode-marketplace.sh");
  const npmPublish = workflow.indexOf("package:latest:publish");
  const credential = workflow.indexOf("VSCE_PAT");
  const build = workflow.indexOf("pnpm run build");

  for (const [label, index] of [
    ["build", build],
    ["Marketplace publish", marketplacePublish],
    ["npm publish", npmPublish],
    ["credential use", credential],
  ] as Array<[string, number]>) {
    assert.notEqual(index, -1, `expected to find ${label} step`);
    assert.ok(
      preflight < index,
      `preflight (index ${preflight}) must run before ${label} (index ${index})`,
    );
  }
  assert.ok(
    marketplacePublish < npmPublish,
    "Marketplace publication must run before npm publication",
  );

  // Two tags pushed together once put two publish jobs on one npm account and
  // one Marketplace extension at the same moment, and neither version shipped.
  assert.match(
    workflow,
    /^concurrency:\n {2}group: release\n {2}cancel-in-progress: false$/m,
    "releases must serialize without cancelling a publish already in flight",
  );

  // Ordering keeps the extension first; tolerance keeps npm out of its blast
  // radius. Both halves have to hold, or the pairing is not what it claims.
  // Slice from the step header, not from the script path: `continue-on-error`
  // precedes `run`, and the recovery hint in marketplace-gate names the script
  // again further down.
  const stepHeader = workflow.indexOf(
    "      - name: Publish VS Code Marketplace extension\n",
  );
  assert.notEqual(stepHeader, -1, "Marketplace publish step is missing");
  const marketplaceStep = workflow.slice(stepHeader, npmPublish);
  assert.match(
    marketplaceStep,
    /^ {8}continue-on-error: true$/m,
    "a Marketplace rejection must not withhold the npm release",
  );

  // Tolerated, reported, and still not fatal. Both recorded Marketplace
  // failures were the gallery's own — a 401 and a request timeout — so the
  // report annotates the run and must never exit non-zero.
  // Bound the slice at the next job: `exit 1` anywhere downstream is somebody
  // else's business, and reading to end-of-file would borrow it.
  const reportStart = workflow.indexOf("\n  marketplace-report:\n");
  assert.notEqual(reportStart, -1, "marketplace-report job is missing");
  const reportEnd = workflow.indexOf("\n  wasm-smoke:\n", reportStart);
  assert.notEqual(reportEnd, -1, "marketplace-report must precede wasm-smoke");
  const report = workflow.slice(reportStart, reportEnd);
  assert.match(
    workflow,
    /^ {2}marketplace-report:$/m,
    "a tolerated Marketplace failure needs a job that reports it",
  );
  assert.match(
    report,
    /^ {4}if: needs\.publish\.outputs\.marketplace != 'success'$/m,
    "the report must key off the Marketplace step's own outcome",
  );
  assert.equal(
    report.includes("exit 1"),
    false,
    "reporting a Marketplace failure must not fail the release",
  );
  assert.match(
    workflow,
    /^ {6}marketplace: \$\{\{ steps\.marketplace\.outcome \}\}$/m,
    "the publish job must export the Marketplace outcome for that report",
  );
};
