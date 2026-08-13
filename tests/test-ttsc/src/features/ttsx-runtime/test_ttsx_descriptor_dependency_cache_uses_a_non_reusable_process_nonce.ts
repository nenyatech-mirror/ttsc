import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";

/**
 * Verifies descriptor dependency emits cannot alias after an OS reuses a PID.
 *
 * The dependency cache outlives evaluator processes. Its descriptor lane must
 * therefore key on a per-process nonce rather than the recyclable numeric PID,
 * while ordinary ttsx workers retain their cross-process sharing key.
 */
export const test_ttsx_descriptor_dependency_cache_uses_a_non_reusable_process_nonce =
  () => {
    const mod = TestProject.REQUIRE_FROM_TEST(
      path.join(
        TestProject.WORKSPACE_ROOT,
        "packages",
        "ttsc",
        "lib",
        "launcher",
        "internal",
        "runtimeHooks.js",
      ),
    );
    const tsconfig = path.join(TestProject.WORKSPACE_ROOT, "tsconfig.json");
    const ordinaryA = mod.dependencyCacheKey(tsconfig, {
      descriptorLoad: false,
      descriptorNonce: "process-a",
    });
    const ordinaryB = mod.dependencyCacheKey(tsconfig, {
      descriptorLoad: false,
      descriptorNonce: "process-b",
    });
    const descriptorA = mod.dependencyCacheKey(tsconfig, {
      descriptorLoad: true,
      descriptorNonce: "process-a",
    });
    const descriptorB = mod.dependencyCacheKey(tsconfig, {
      descriptorLoad: true,
      descriptorNonce: "process-b",
    });

    assert.equal(ordinaryA, ordinaryB);
    assert.notEqual(descriptorA, descriptorB);
    assert.notEqual(descriptorA, ordinaryA);
  };
