import { TestProject } from "@ttsc/testing";

import {
  assert,
  createFakeGoBinary,
  fs,
  path,
  spawnNodeWorker,
} from "../../internal/source-build";

/**
 * Verifies the ttsx descriptor fallback reports the source/config graph that
 * actually produced the descriptor, including missing higher-priority module
 * candidates that can redirect a later extensionless resolution.
 *
 * The isolated fallback previously returned only its root file. A selected ESM
 * dependency, its owning tsconfig, or an absent candidate could therefore
 * change without invalidating a persistent transform generation.
 *
 * 1. Load a TypeScript descriptor that imports extensionless ESM source.
 * 2. Capture its descriptor inputs through the real isolated ttsx fallback.
 * 3. Assert the selected source, owning tsconfig, and missing `.mts` candidate
 *    carry evaluation-time fingerprints.
 */
export const test_loadprojectplugins_ttsx_descriptor_tracks_runtime_inputs =
  async () => {
    const root = TestProject.tmpdir("ttsc-ttsx-descriptor-inputs-");
    const source = root;
    fs.writeFileSync(path.join(root, "go.mod"), "module example/plugin\n");
    for (const file of [
      "vendor/local/value.go",
      "lib/helper.go",
      "dist/generated.go",
      "build/generated.go",
    ]) {
      const target = path.join(source, file);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, "package plugin\n", "utf8");
    }
    fs.writeFileSync(
      path.join(source, "plugin.go"),
      "package main\n\nfunc main() {}\n",
    );

    const descriptor = path.join(root, "descriptor");
    fs.mkdirSync(descriptor, { recursive: true });
    fs.writeFileSync(
      path.join(descriptor, "package.json"),
      JSON.stringify({ private: true, type: "module" }),
    );
    const descriptorConfig = path.join(descriptor, "tsconfig.json");
    fs.writeFileSync(
      descriptorConfig,
      JSON.stringify({
        compilerOptions: {
          allowJs: true,
          module: "nodenext",
          moduleResolution: "nodenext",
          skipLibCheck: true,
          target: "es2022",
        },
        include: ["*.ts", "*.mjs"],
      }),
    );
    const selection = path.join(descriptor, "selection.mjs");
    fs.writeFileSync(
      selection,
      `export const source = ${JSON.stringify(source)};\n`,
      "utf8",
    );
    const entry = path.join(descriptor, "index.ts");
    fs.writeFileSync(
      entry,
      [
        `import { source } from "./selection";`,
        `export default () => ({ name: "ttsx-inputs", source });`,
        "",
      ].join("\n"),
      "utf8",
    );

    const projectConfig = path.join(root, "tsconfig.json");
    fs.writeFileSync(
      projectConfig,
      JSON.stringify({
        compilerOptions: { plugins: [{ transform: entry }] },
      }),
    );
    const worker = path.join(root, "load-worker.cjs");
    fs.writeFileSync(
      worker,
      [
        `const { loadProjectPlugins } = require(${JSON.stringify(path.join(TestProject.WORKSPACE_ROOT, "packages", "ttsc", "lib", "plugin", "internal", "loadProjectPlugins.js"))});`,
        `const loaded = loadProjectPlugins({ binary: "", cacheDir: ${JSON.stringify(path.join(root, "cache"))}, tsconfig: ${JSON.stringify(projectConfig)} });`,
        `process.stdout.write(JSON.stringify({ hostInputHashes: loaded.hostInputHashes, hostInputs: loaded.hostInputs }));`,
        "",
      ].join("\n"),
      "utf8",
    );
    const result = await spawnNodeWorker({
      env: {
        TTSC_BINARY: TestProject.NATIVE_BINARY,
        TTSC_GO_BINARY: createFakeGoBinary(root),
        TTSC_GO_CACHE_DIR: path.join(root, "go-cache"),
        TTSC_TSGO_BINARY: TestProject.TSGO_BINARY,
      },
      script: worker,
    });
    assert.equal(result.status, 0, result.stderr);
    const loaded = JSON.parse(result.stdout) as {
      hostInputHashes: Record<string, string | null>;
      hostInputs: string[];
    };
    const inputs = loaded.hostInputs;
    const canonicalSelection = fs.realpathSync(selection);
    assert.ok(inputs.includes(canonicalSelection));
    assert.ok(
      inputs.some((input) => sameExistingFile(input, descriptorConfig)),
    );
    const missingMts = `${canonicalSelection.slice(0, -path.extname(canonicalSelection).length)}.mts`;
    assert.ok(inputs.includes(missingMts), JSON.stringify(inputs));
    assert.equal(loaded.hostInputHashes[missingMts], null);
    assert.ok(
      Object.entries(loaded.hostInputHashes).some(
        ([input, hash]) =>
          typeof hash === "string" && sameExistingFile(input, descriptorConfig),
      ),
    );
  };

function sameExistingFile(left: string, right: string): boolean {
  try {
    const leftStats = fs.statSync(left);
    const rightStats = fs.statSync(right);
    return leftStats.dev === rightStats.dev && leftStats.ino === rightStats.ino;
  } catch {
    return false;
  }
}
