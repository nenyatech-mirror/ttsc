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
 * 2. Slice each exact job and publish-step mapping by YAML indentation.
 * 3. Assert every mapping owns exactly its intended timeout budget.
 */
export const test_release_workflow_bounds_publish_timeouts = () => {
  const source = fs.readFileSync(
    path.join(workspaceRoot, ".github", "workflows", "release.yml"),
    "utf8",
  );
  // Timeout keys live on uncommented lines by construction; dropping comments
  // keeps prose about timeouts from counting as the key itself.
  const lines = source.split(/\r?\n/).filter((line) => !/^\s*#/.test(line));

  for (const [step, budget] of [
    ["Publish VS Code Marketplace extension", 10],
    ["Publish to npm", 20],
  ] as Array<[string, number]>) {
    const block = selectYamlMapping(lines, `- name: ${step}`, 6);
    assert.deepEqual(
      block.filter((line) => /^ {8}timeout-minutes:/.test(line)),
      [`        timeout-minutes: ${budget}`],
      `the ${step} step must own exactly timeout-minutes: ${budget}`,
    );
  }

  for (const [job, budget] of [
    ["publish", 60],
    ["wasm-smoke", 15],
    ["vscode-smoke", 15],
    ["release", 15],
  ] as Array<[string, number]>) {
    const block = selectYamlMapping(lines, `${job}:`, 2);
    assert.deepEqual(
      block.filter((line) => /^ {4}timeout-minutes:/.test(line)),
      [`    timeout-minutes: ${budget}`],
      `the ${job} job must own exactly timeout-minutes: ${budget}`,
    );
  }

  const jobNames = lines
    .slice(lines.findIndex((line) => line === "jobs:") + 1)
    .filter((line) => /^ {2}\S[^:]*:\r?$/.test(line))
    .map((line) => line.trim().slice(0, -1));
  assert.deepEqual(jobNames, [
    "publish",
    "wasm-smoke",
    "vscode-smoke",
    "release",
  ]);
};

/**
 * Select one YAML mapping whose header has exactly `indent` leading spaces. The
 * block ends at the next non-empty line at the same or a shallower level.
 */
function selectYamlMapping(
  lines: string[],
  header: string,
  indent: number,
): string[] {
  const prefix = " ".repeat(indent);
  const start = lines.findIndex((line) => line === `${prefix}${header}`);
  assert.notEqual(start, -1, `expected to find ${header}`);
  let end = start + 1;
  while (end < lines.length) {
    const line = lines[end]!;
    if (
      line.trim().length !== 0 &&
      line.length - line.trimStart().length <= indent
    ) {
      break;
    }
    end += 1;
  }
  return lines.slice(start + 1, end);
}
