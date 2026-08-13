import { TestProject } from "@ttsc/testing";
import childProcess from "node:child_process";

import { assert, fs, loadProjectPlugins, path } from "../../internal/project";
import { createFakeGoBinary } from "../../internal/source-build";

/**
 * Verifies a descriptor evaluated by Bun reports its static ESM dependencies.
 *
 * Bun resolves static imports outside Node's `Module._resolveFilename` path.
 * The isolated evaluator must therefore observe Bun's resolver as well, or a
 * persistent bundler generation can survive after an imported selection file
 * changes.
 */
export const test_loadprojectplugins_tracks_bun_esm_descriptor_dependencies =
  (): void => {
    const bunBinary = process.env.TTSC_BUN_BINARY ?? "bun";
    const bun = childProcess.spawnSync(bunBinary, ["--version"], {
      encoding: "utf8",
      windowsHide: true,
    });
    if (bun.status !== 0) return;

    const root = TestProject.tmpdir("ttsc-bun-esm-descriptor-input-");
    const project = path.join(root, "project");
    const source = path.join(root, "plugin-go");
    const selection = path.join(root, "selection.mjs");
    const descriptor = path.join(project, "plugin.mts");
    fs.mkdirSync(project, { recursive: true });
    fs.mkdirSync(source, { recursive: true });
    fs.writeFileSync(
      path.join(project, "package.json"),
      JSON.stringify({ private: true, type: "module" }),
      "utf8",
    );
    fs.writeFileSync(
      path.join(project, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: { plugins: [{ transform: descriptor }] },
      }),
      "utf8",
    );
    fs.writeFileSync(
      path.join(source, "go.mod"),
      "module example.com/bun-esm-descriptor\n\ngo 1.26\n",
      "utf8",
    );
    fs.writeFileSync(path.join(source, "main.go"), "package main\n", "utf8");
    for (const relative of [
      "vendor/local/value.go",
      "lib/helper.go",
      "dist/generated.go",
      "build/generated.go",
    ]) {
      const file = path.join(source, relative);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, "package generated\n", "utf8");
    }
    fs.writeFileSync(
      selection,
      `export default ${JSON.stringify(source)};\n`,
      "utf8",
    );
    fs.writeFileSync(
      descriptor,
      [
        `import source from ${JSON.stringify(selection)};`,
        `export default { name: "bun-esm", source };`,
        "",
      ].join("\n"),
      "utf8",
    );

    const fakeGo = path.join(root, "fake-go");
    fs.mkdirSync(fakeGo, { recursive: true });
    const loaded = loadProjectPlugins({
      binary: "",
      cacheDir: path.join(root, "cache"),
      cwd: project,
      env: {
        ...process.env,
        TTSC_GO_BINARY: createFakeGoBinary(fakeGo),
        TTSC_GO_CACHE_DIR: path.join(root, "go-cache"),
        TTSC_NODE_BINARY: bunBinary,
      },
      tsconfig: path.join(project, "tsconfig.json"),
    });

    assert.equal(loaded.nativePlugins[0]?.name, "bun-esm");
    assert.ok(loaded.hostInputs.includes(selection));
  };
