import { TestProject } from "@ttsc/testing";

import { assert, fs, path, spawnNodeWorker } from "../../internal/source-build";

/**
 * Verifies isolated TypeScript descriptor evaluation keeps the instance env,
 * stdout protocol, and factory side effects at their declared boundaries.
 *
 * The runtime hook can load a `.cts` descriptor before the ttsx fallback. That
 * child must receive the caller's effective environment, redirect arbitrary
 * descriptor stdout away from the host's protocol stream, and never interpret a
 * factory exception as a loader failure that should execute the factory a
 * second time through ttsx.
 */
export const test_loadprojectplugins_isolated_typescript_descriptor_preserves_process_boundaries =
  async () => {
    const root = TestProject.tmpdir("ttsc-isolated-ts-descriptor-");
    const descriptor = path.join(root, "plugin.cts");
    const counter = path.join(root, "factory-runs.txt");
    fs.writeFileSync(
      descriptor,
      [
        `const fs = require("node:fs");`,
        `enum Loaded { Value = "loaded" }`,
        `console.log("DESCRIPTOR_STDOUT_MARKER", Loaded.Value);`,
        `export = () => {`,
        `  fs.appendFileSync(${JSON.stringify(counter)}, "run\\n");`,
        `  throw new Error("factory-env:" + process.env.TTSC_DESC_MARKER);`,
        `};`,
        "",
      ].join("\n"),
      "utf8",
    );
    const tsconfig = path.join(root, "tsconfig.json");
    fs.writeFileSync(
      tsconfig,
      JSON.stringify({
        compilerOptions: { plugins: [{ transform: descriptor }] },
      }),
      "utf8",
    );

    const loadProjectPluginsPath = path.join(
      TestProject.WORKSPACE_ROOT,
      "packages",
      "ttsc",
      "lib",
      "plugin",
      "internal",
      "loadProjectPlugins.js",
    );
    const script = path.join(root, "load-worker.cjs");
    fs.writeFileSync(
      script,
      [
        `const { loadProjectPlugins } = require(${JSON.stringify(loadProjectPluginsPath)});`,
        "try {",
        "  loadProjectPlugins({",
        '    binary: "",',
        '    env: { ...process.env, TTSC_DESC_MARKER: "effective" },',
        `    tsconfig: ${JSON.stringify(tsconfig)},`,
        "  });",
        '} catch (error) { process.stderr.write(String(error?.message ?? error) + "\\n"); }',
        "",
      ].join("\n"),
      "utf8",
    );

    const result = await spawnNodeWorker({
      env: {
        TTSC_BINARY: TestProject.NATIVE_BINARY,
        TTSC_DESC_MARKER: "ambient",
        TTSC_TSGO_BINARY: TestProject.TSGO_BINARY,
      },
      script,
    });

    assert.equal(result.stdout, "");
    assert.match(result.stderr, /DESCRIPTOR_STDOUT_MARKER loaded/);
    assert.match(result.stderr, /factory-env:effective/);
    assert.equal(/factory-env:ambient/.test(result.stderr), false);
    assert.equal(fs.readFileSync(counter, "utf8"), "run\n");
  };
