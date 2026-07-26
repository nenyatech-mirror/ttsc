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
  assertPinnedNestiaCheckout(source);
  assertNoMovingNestiaClone(source);

  const normalized = source.replace(/\r\n/g, "\n");
  const marker = "      - name: Check out verified nestia integration revision";
  assert.throws(
    () =>
      assertPinnedNestiaCheckout(
        normalized.replace(
          "        with:\n          repository: samchon/nestia",
          "        env:\n          repository: samchon/nestia",
        ),
      ),
    /expected the exact pinned nestia checkout mapping/,
  );
  assert.throws(
    () =>
      assertNoMovingNestiaClone(
        normalized.replace(
          marker,
          [
            "      - name: Moving nestia clone probe",
            "        run: >",
            "          git clone",
            "          https://github.com/samchon/nestia.git experimental/nestia",
            marker,
          ].join("\n"),
        ),
      ),
    /moving nestia clone/,
  );
};

/** Assert the complete checkout action input mapping as one owned structure. */
function assertPinnedNestiaCheckout(source: string): void {
  const normalized = source.replace(/\r\n/g, "\n");
  const marker = "      - name: Check out verified nestia integration revision";
  assert.equal(
    normalized.split(marker).length - 1,
    1,
    "expected exactly one pinned nestia checkout step",
  );
  const start = normalized.indexOf(marker);
  const next = normalized.indexOf("\n      - ", start + marker.length);
  const block = normalized.slice(start, next === -1 ? undefined : next);
  const expected = [
    marker,
    "        uses: actions/checkout@v4",
    "        with:",
    "          repository: samchon/nestia",
    "          ref: 3b27e69b69dea3f102315042dce87c18d81be74a",
    "          path: experimental/nestia",
  ].join("\n");
  assert.equal(
    block.trimEnd(),
    expected,
    "expected the exact pinned nestia checkout mapping",
  );
}

/** Reject an active shell command that replaces the pin with a moving clone. */
function assertNoMovingNestiaClone(source: string): void {
  for (const command of selectWorkflowRunCommands(source)) {
    assert.doesNotMatch(
      command,
      /\bgit\s+clone\b/,
      "release integration must not use a moving nestia clone",
    );
  }
}

/**
 * Extract GitHub Actions `run:` values, folding `>` blocks and joining shell
 * backslash continuations in `|` blocks the same way the command runner does.
 */
function selectWorkflowRunCommands(source: string): string[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const output: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!;
    const match = /^(\s*)(?:-\s+)?run:\s*(.*?)\s*$/.exec(line);
    if (match === null) {
      continue;
    }
    const indent = match[1]!.length;
    const value = match[2]!;
    const indicator = /^[>|]/.exec(value)?.[0];
    if (indicator === undefined) {
      output.push(value);
      continue;
    }

    const body: string[] = [];
    while (index + 1 < lines.length) {
      const next = lines[index + 1]!;
      if (
        next.trim().length !== 0 &&
        next.length - next.trimStart().length <= indent
      ) {
        break;
      }
      body.push(next);
      index += 1;
    }
    const command =
      indicator === ">"
        ? body.map((entry) => entry.trim()).join(" ")
        : body.join("\n");
    output.push(command.replace(/\\\n\s*/g, " "));
  }
  return output;
}
