import { assert, fs, path, workspaceRoot } from "../../internal/toolchain";

/**
 * Verifies the nestia integration checks out a reviewed green revision.
 *
 * Locks the red CI discovered by samchon/ttsc#1009: cloning nestia master made
 * ttsc inherit an upstream `openapi_v2` failure that was already red in
 * nestia's own sdk lane. The pinned revision is the merge of nestia #1593,
 * whose complete upstream test run 29959327169 passed.
 *
 * 1. Select the named nestia checkout step.
 * 2. Assert its repository, revision, and destination exactly.
 * 3. Reject a moving `git clone` fallback.
 */
export const test_nestia_workflow_pins_verified_upstream_revision = () => {
  const source = fs.readFileSync(
    path.join(workspaceRoot, ".github", "workflows", "nestia.yml"),
    "utf8",
  );
  const marker = "      - name: Check out verified nestia integration revision";
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, "expected the pinned nestia checkout step");
  const next = source.indexOf("\n      - ", start + marker.length);
  const block = source.slice(start, next === -1 ? undefined : next);
  const blockLines = block.split(/\r?\n/);

  for (const expected of [
    "        uses: actions/checkout@v4",
    "          repository: samchon/nestia",
    "          ref: 3b27e69b69dea3f102315042dce87c18d81be74a",
    "          path: experimental/nestia",
  ]) {
    assert.equal(
      blockLines.filter((line) => line === expected).length,
      1,
      `expected exactly one checkout line: ${expected}`,
    );
  }
  assert.doesNotMatch(
    source.replace(/\\\r?\n\s*/g, " "),
    /git clone\b[^\n]*samchon\/nestia/,
  );
};
