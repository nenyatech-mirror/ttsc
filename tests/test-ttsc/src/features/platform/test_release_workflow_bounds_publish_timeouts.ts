import { assert, fs, path, workspaceRoot } from "../../internal/toolchain";

/**
 * Verifies every release job and publish step carries an explicit timeout.
 *
 * Locks samchon/ttsc#1008: the release pipeline once deadlocked at the
 * Marketplace boundary (d90544084), and without `timeout-minutes` a stalled
 * publish would hold the tag's release for GitHub's 360-minute job default
 * while looking identical to the healthy ~21-minute build phase. The exact
 * budgets are pinned so a future edit cannot silently relax them back into a
 * multi-hour silent hold.
 *
 * 1. Read the release workflow and drop its comment lines.
 * 2. Slice the two publish steps and every job block out of the workflow.
 * 3. Assert each publish step's exact budget and one job-level timeout each.
 */
export const test_release_workflow_bounds_publish_timeouts = () => {
  const source = fs.readFileSync(
    path.join(workspaceRoot, ".github", "workflows", "release.yml"),
    "utf8",
  );
  // Timeout keys live on uncommented lines by construction; dropping comments
  // keeps prose about timeouts from counting as the key itself.
  const workflow = source
    .split("\n")
    .filter((line) => !/^\s*#/.test(line))
    .join("\n");

  for (const [step, budget] of [
    ["Publish VS Code Marketplace extension", "timeout-minutes: 10"],
    ["Publish to npm", "timeout-minutes: 20"],
  ] as Array<[string, string]>) {
    const start = workflow.indexOf(`- name: ${step}`);
    assert.notEqual(start, -1, `expected to find the ${step} step`);
    const end = workflow.indexOf("- name:", start + 1);
    const block = workflow.slice(start, end === -1 ? undefined : end);
    assert.ok(
      block.includes(budget),
      `the ${step} step must declare ${budget}, got:\n${block}`,
    );
  }

  const jobLevelTimeouts =
    workflow.match(/^ {4}timeout-minutes: \d+\r?$/gm) ?? [];
  assert.equal(
    jobLevelTimeouts.length,
    4,
    `every release job must declare one job-level timeout-minutes, found: ${jobLevelTimeouts.join(", ") || "none"}`,
  );
};
