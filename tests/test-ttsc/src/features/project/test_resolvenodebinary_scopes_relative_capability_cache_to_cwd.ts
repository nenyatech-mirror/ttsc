import { TestProject } from "@ttsc/testing";

import { assert, fs, path, resolveNodeBinary } from "../../internal/project";

/**
 * Verifies relative runtime capability probes are cached per working directory.
 *
 * Two embedders can use the same `./node` spelling from different roots. A
 * successful probe in one root must not authorize a missing or incompatible
 * executable in another root.
 */
export const test_resolvenodebinary_scopes_relative_capability_cache_to_cwd =
  (): void => {
    const root = TestProject.tmpdir("ttsc-relative-node-capability-");
    const first = path.join(root, "first");
    const second = path.join(root, "second");
    fs.mkdirSync(first, { recursive: true });
    fs.mkdirSync(second, { recursive: true });
    const name =
      process.platform === "win32" ? "candidate-node.exe" : "candidate-node";
    const candidate = path.join(first, name);
    try {
      fs.linkSync(process.execPath, candidate);
    } catch {
      fs.copyFileSync(process.execPath, candidate);
    }
    if (process.platform !== "win32") fs.chmodSync(candidate, 0o755);
    const relative = `./${name}`;
    const env = { ...process.env, TTSC_NODE_BINARY: relative };

    assert.equal(resolveNodeBinary(env, first), relative);
    assert.equal(resolveNodeBinary(env, second), process.execPath);
  };
