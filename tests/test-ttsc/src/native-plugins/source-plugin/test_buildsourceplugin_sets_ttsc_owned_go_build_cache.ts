import { TestProject } from "@ttsc/testing";

import {
  assert,
  buildSourcePlugin,
  createFakeGoBinary,
  fs,
  path,
} from "../../internal/source-build";

/**
 * Verifies buildSourcePlugin sets ttsc-owned Go build cache.
 *
 * CI runners often restore the ttsc source-plugin cache but not Go's object
 * cache. When the user has not provided `GOCACHE`, ttsc should pass a stable
 * cache directory beside the plugin binary cache so one Actions cache entry can
 * persist both layers.
 *
 * 1. Build a source plugin through the fake Go executable with no user `GOCACHE`.
 * 2. Capture the environment received by `go build`.
 * 3. Assert `GOCACHE` points at `<cache-dir>/go-build`.
 * 4. Build through the managed default cache and assert post-build maintenance
 *    runs even when the pre-build daily marker was just written.
 * 5. Fail another cold build after it writes cache objects and assert the same
 *    forced post-build maintenance still runs without replacing the build
 *    error.
 */
export const test_buildsourceplugin_sets_ttsc_owned_go_build_cache = () => {
  const root = TestProject.tmpdir("ttsc-source-plugin-");
  const plugin = path.join(root, "plugin");
  writePluginSource(plugin);
  const cacheDir = path.join(root, "cache");
  const capture = path.join(root, "go-env.json");

  const fakeGo = createFakeGoBinary(root);
  const previousGo = process.env.TTSC_GO_BINARY;
  const previousGoCache = process.env.GOCACHE;
  const previousTtscGoCache = process.env.TTSC_GO_CACHE_DIR;
  const previousCapture = process.env.FAKE_GO_CAPTURE_ENV_FILE;
  const previousObjectCount = process.env.FAKE_GO_BUILD_CACHE_OBJECT_COUNT;
  const previousExitCode = process.env.FAKE_GO_BUILD_EXIT_CODE;
  process.env.TTSC_GO_BINARY = fakeGo;
  process.env.FAKE_GO_CAPTURE_ENV_FILE = capture;
  delete process.env.GOCACHE;
  delete process.env.TTSC_GO_CACHE_DIR;
  try {
    buildSourcePlugin({
      baseDir: root,
      cacheDir,
      overlayDirs: [],
      pluginName: "go-build-cache",
      source: plugin,
      quiet: true,
      ttscVersion: "1.0.0",
      tsgoVersion: "7.0.0-dev",
    });

    const captured = JSON.parse(fs.readFileSync(capture, "utf8")) as {
      GOCACHE: string | null;
    };
    assert.equal(captured.GOCACHE, path.join(cacheDir, "go-build"));

    const managedRoot = path.join(root, "managed");
    fs.mkdirSync(path.join(managedRoot, "node_modules"), { recursive: true });
    writePluginSource(managedRoot);
    process.env.FAKE_GO_BUILD_CACHE_OBJECT_COUNT = "3";
    const originalWrite = fs.writeFileSync;
    let markerWrites = 0;
    (fs as { writeFileSync: typeof fs.writeFileSync }).writeFileSync =
      function (this: unknown, ...args: Parameters<typeof fs.writeFileSync>) {
        if (path.basename(String(args[0])) === ".ttsc-gc") markerWrites += 1;
        return originalWrite.apply(this, args as never);
      } as typeof fs.writeFileSync;
    try {
      buildSourcePlugin({
        baseDir: managedRoot,
        overlayDirs: [],
        pluginName: "managed-post-build-gc",
        source: managedRoot,
        quiet: true,
        ttscVersion: "1.0.0",
        tsgoVersion: "7.0.0-dev",
      });
    } finally {
      (fs as { writeFileSync: typeof fs.writeFileSync }).writeFileSync =
        originalWrite;
    }
    const managedGoCache = path.join(
      managedRoot,
      "node_modules",
      ".cache",
      "ttsc",
      "go-build",
    );
    assert.equal(fs.existsSync(path.join(managedGoCache, ".ttsc-gc")), true);
    assert.equal(
      markerWrites,
      2,
      "managed cold builds must enforce GC both before and after go build",
    );

    const failedRoot = path.join(root, "failed-managed");
    fs.mkdirSync(path.join(failedRoot, "node_modules"), { recursive: true });
    writePluginSource(failedRoot);
    process.env.FAKE_GO_BUILD_EXIT_CODE = "17";
    (fs as { writeFileSync: typeof fs.writeFileSync }).writeFileSync =
      function (this: unknown, ...args: Parameters<typeof fs.writeFileSync>) {
        if (path.basename(String(args[0])) === ".ttsc-gc") markerWrites += 1;
        return originalWrite.apply(this, args as never);
      } as typeof fs.writeFileSync;
    try {
      assert.throws(
        () =>
          buildSourcePlugin({
            baseDir: failedRoot,
            overlayDirs: [],
            pluginName: "managed-failed-post-build-gc",
            source: failedRoot,
            quiet: true,
            ttscVersion: "1.0.0",
            tsgoVersion: "7.0.0-dev",
          }),
        /managed-failed-post-build-gc[\s\S]*fake go: build failed as directed/,
      );
    } finally {
      (fs as { writeFileSync: typeof fs.writeFileSync }).writeFileSync =
        originalWrite;
    }
    assert.equal(
      markerWrites,
      4,
      "failed managed cold builds must enforce post-build GC",
    );
  } finally {
    if (previousGo === undefined) delete process.env.TTSC_GO_BINARY;
    else process.env.TTSC_GO_BINARY = previousGo;
    if (previousGoCache === undefined) delete process.env.GOCACHE;
    else process.env.GOCACHE = previousGoCache;
    if (previousTtscGoCache === undefined) delete process.env.TTSC_GO_CACHE_DIR;
    else process.env.TTSC_GO_CACHE_DIR = previousTtscGoCache;
    if (previousCapture === undefined)
      delete process.env.FAKE_GO_CAPTURE_ENV_FILE;
    else process.env.FAKE_GO_CAPTURE_ENV_FILE = previousCapture;
    if (previousObjectCount === undefined)
      delete process.env.FAKE_GO_BUILD_CACHE_OBJECT_COUNT;
    else process.env.FAKE_GO_BUILD_CACHE_OBJECT_COUNT = previousObjectCount;
    if (previousExitCode === undefined)
      delete process.env.FAKE_GO_BUILD_EXIT_CODE;
    else process.env.FAKE_GO_BUILD_EXIT_CODE = previousExitCode;
  }
};

function writePluginSource(root: string): void {
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(
    path.join(root, "go.mod"),
    "module example.com/plugin\n\ngo 1.26\n",
    "utf8",
  );
  fs.writeFileSync(path.join(root, "main.go"), "package main\n", "utf8");
  for (const file of [
    "vendor/local/value.go",
    "lib/helper.go",
    "dist/generated.go",
    "build/generated.go",
  ]) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), "package main\n", "utf8");
  }
}
