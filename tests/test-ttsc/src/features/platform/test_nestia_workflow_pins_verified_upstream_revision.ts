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
 * 2. Assert its repository, revision, and destination exactly and uniquely across
 *    the workflow.
 * 3. Prove wrong ownership and a cross-job duplicate cannot satisfy the test.
 */
export const test_nestia_workflow_pins_verified_upstream_revision = () => {
  const source = fs.readFileSync(
    path.join(workspaceRoot, ".github", "workflows", "nestia.yml"),
    "utf8",
  );
  assertPinnedNestiaCheckout(parseWorkflow(source));

  const normalized = source.replace(/\r\n/g, "\n");
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
  const duplicated = parseWorkflow(source);
  duplicated.jobs.probe = {
    steps: [
      {
        name: "Check out verified nestia integration revision",
        uses: "actions/checkout@v4",
        with: {
          repository: "samchon/nestia",
          ref: "3b27e69b69dea3f102315042dce87c18d81be74a",
          path: "experimental/nestia",
        },
      },
    ],
  };
  assert.throws(
    () => assertPinnedNestiaCheckout(duplicated),
    /expected exactly one pinned nestia checkout step/,
  );
};

interface IWorkflow {
  jobs: Record<string, IWorkflowJob>;
}

interface IWorkflowJob {
  steps?: IWorkflowStep[];
}

interface IWorkflowStep {
  name?: unknown;
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
  const owners = selectWorkflowSteps(workflow).filter(
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
  assert.ok(
    nestia.steps.some((step) => Object.is(step, owners[0])),
    "expected the pinned checkout to belong to the nestia job",
  );
}

/** Flatten valid parsed step mappings across the complete workflow. */
function selectWorkflowSteps(workflow: IWorkflow): IWorkflowStep[] {
  return Object.values(workflow.jobs).flatMap((job) =>
    Array.isArray(job.steps) ? job.steps.filter(isRecord) : [],
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
