import { parse } from "yaml";

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
  assertPinnedNestiaCheckout(parseWorkflow(source));
  assertNoMovingNestiaClone(parseWorkflow(source));

  const normalized = source.replace(/\r\n/g, "\n");
  const marker = "      - name: Check out verified nestia integration revision";
  assert.throws(
    () =>
      assertPinnedNestiaCheckout(
        parseWorkflow(
          normalized.replace(
            "        with:\n          repository: samchon/nestia",
            "        env:\n          repository: samchon/nestia",
          ),
        ),
      ),
    /expected the exact pinned nestia checkout mapping/,
  );
  for (const run of [
    [
      "      - name: Folded moving nestia clone probe",
      "        run: >",
      "          git clone",
      "          https://github.com/samchon/nestia.git experimental/nestia",
    ],
    [
      "      - name: Plain moving nestia clone probe",
      "        run: git",
      "          clone https://github.com/samchon/nestia.git experimental/nestia",
    ],
  ]) {
    assert.throws(
      () =>
        assertNoMovingNestiaClone(
          parseWorkflow(
            normalized.replace(marker, [...run, marker].join("\n")),
          ),
        ),
      /moving nestia clone/,
    );
  }
};

interface IWorkflow {
  jobs: Record<string, IWorkflowJob>;
}

interface IWorkflowJob {
  steps?: IWorkflowStep[];
}

interface IWorkflowStep {
  name?: unknown;
  run?: unknown;
  uses?: unknown;
  with?: unknown;
}

/** Parse a workflow and prove the mappings needed by this regression test. */
function parseWorkflow(source: string): IWorkflow {
  const workflow: unknown = parse(source);
  assert.ok(isRecord(workflow), "expected a workflow mapping");
  assert.ok(isRecord(workflow.jobs), "expected a jobs mapping");
  return workflow as unknown as IWorkflow;
}

/** Assert the complete checkout action input mapping as one owned structure. */
function assertPinnedNestiaCheckout(workflow: IWorkflow): void {
  const nestia = workflow.jobs.nestia;
  assert.ok(isRecord(nestia), "expected the nestia job");
  assert.ok(Array.isArray(nestia.steps), "expected nestia job steps");
  assert.ok(nestia.steps.every(isRecord), "expected step mappings");

  const expected: IWorkflowStep = {
    name: "Check out verified nestia integration revision",
    uses: "actions/checkout@v4",
    with: {
      repository: "samchon/nestia",
      ref: "3b27e69b69dea3f102315042dce87c18d81be74a",
      path: "experimental/nestia",
    },
  };
  const owners = nestia.steps.filter(
    (step) =>
      step.name === expected.name ||
      (isRecord(step.with) &&
        (step.with.repository === "samchon/nestia" ||
          step.with.path === "experimental/nestia")),
  );
  assert.equal(
    owners.length,
    1,
    "expected exactly one pinned nestia checkout step",
  );
  assert.deepEqual(
    owners[0],
    expected,
    "expected the exact pinned nestia checkout mapping",
  );
}

/** Reject an active shell command that replaces the pin with a moving clone. */
function assertNoMovingNestiaClone(workflow: IWorkflow): void {
  for (const job of Object.values(workflow.jobs)) {
    if (!Array.isArray(job.steps)) {
      continue;
    }
    for (const step of job.steps) {
      if (isRecord(step) && typeof step.run === "string") {
        assert.doesNotMatch(
          step.run,
          /\bgit\s+clone\b/,
          "release integration must not use a moving nestia clone",
        );
      }
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
