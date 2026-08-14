/**
 * Reproduces the @ttsc/unplugin per-module cache cost on a synthetic project.
 *
 * The real Rollup plugin object (`unplugin.rollup(...)`) is driven directly
 * over a generated `N`-file project, mirroring how Rollup invokes `buildStart`
 * once and `transform` once per module. We count native plugin spawns
 * (whole-project re-transforms) and `fs.readFileSync` traffic to expose the
 * super-linear cost.
 */
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

const experimentRoot = path.resolve(import.meta.dirname, "..");
const root = path.resolve(experimentRoot, "../..");
const tmpRoot = path.join(experimentRoot, ".tmp");
const requireFromTtsc = createRequire(
  path.join(root, "packages", "ttsc", "package.json"),
);

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    fs.rmSync(tmpRoot, { force: true, recursive: true });
  });

async function main(): Promise<void> {
  fs.rmSync(tmpRoot, { force: true, recursive: true });
  fs.mkdirSync(tmpRoot, { recursive: true });

  // Native toolchain + shared plugin-build cache, mirroring the unit fixtures.
  process.env.TTSC_TSGO_BINARY ??= resolveTscBinary();
  process.env.TTSC_CACHE_DIR ??= path.join(tmpRoot, "cache");

  const adapter = await loadAdapter();
  const failures: string[] = [];

  console.log("Scenario A — output keys under project root (cache hits):");
  console.log("  invariant: plugin runs == 1 (one whole-project compile)\n");
  for (const count of [10, 25, 50, 100]) {
    recordFailure(
      failures,
      await measure(adapter, { count, emitExternalKey: false }),
    );
  }

  console.log(
    "\nScenario B — one output key outside the validator walk (node_modules):",
  );
  console.log(
    "  invariant: plugin runs == 1 (cache must hit despite the out-of-walk key)\n",
  );
  for (const count of [10, 25, 50]) {
    recordFailure(
      failures,
      await measure(adapter, { count, emitExternalKey: true }),
    );
  }

  console.log(
    "\nScenario C — graph-bearing envelope (typia >= 13.1.19 shape):",
  );
  console.log(
    "  invariant: plugin runs == 1 and macOS fs probes stay bounded per module;",
  );
  console.log(
    "  per-delivery watch-input derivation must not re-walk the whole graph\n",
  );
  for (const graphFanout of [25, 50, 100]) {
    recordFailure(
      failures,
      await measureGraphBuild(adapter, {
        count: 100,
        emitExternalKey: false,
        graphFanout,
      }),
    );
  }

  console.log(
    "\nScenario D — graph envelope without a build boundary (Vite serve):",
  );
  console.log(
    "  invariant: validation reads and synchronous stats stay bounded per module,",
  );
  console.log("  not the whole input union or project directory count\n");
  recordFailure(
    failures,
    await measureServeValidation(adapter, {
      count: 50,
      emitExternalKey: false,
      graphFanout: 50,
      partitionExternalInputs: true,
      unrelatedDirectoryCount: 100,
    }),
  );

  if (failures.length !== 0) {
    console.error(
      `\nFAIL: a scenario violated its invariant:\n  ${failures.join("\n  ")}`,
    );
    process.exitCode = 1;
    return;
  }
  console.log(
    "\nOK: every build ran exactly one whole-project transform and watch-input" +
      " derivation stayed bounded per module.",
  );
}

function recordFailure(failures: string[], failure: string | undefined): void {
  if (failure !== undefined) {
    failures.push(failure);
  }
}

interface Adapter {
  rollup: (options: unknown) => {
    buildStart: (this: unknown) => void | Promise<void>;
    transformInclude: (this: unknown, id: string) => boolean;
    transform: (
      this: unknown,
      code: string,
      id: string,
    ) => unknown | Promise<unknown>;
  };
}

/**
 * Bundle the real adapter source with esbuild (keeping `ttsc`/`unplugin`
 * external) so the production transform pipeline runs unmodified without a
 * rebuilt `lib`.
 */
async function loadAdapter(): Promise<Adapter> {
  const esbuild = requireFromUnplugin("esbuild") as typeof import("esbuild");
  // Emit inside packages/unplugin so the external `ttsc`/`unplugin` imports
  // resolve through that package's node_modules (ttsc is a workspace symlink).
  const outfile = path.join(
    root,
    "packages",
    "unplugin",
    ".tmp-perf-adapter.mjs",
  );
  await esbuild.build({
    entryPoints: [
      path.join(root, "packages", "unplugin", "src", "core", "index.ts"),
    ],
    outfile,
    bundle: true,
    format: "esm",
    platform: "node",
    external: ["ttsc", "unplugin", "node:*"],
  });
  const mod = await import(pathToFileURL(outfile).href);
  fs.rmSync(outfile, { force: true });
  return mod.default as Adapter;
}

function requireFromUnplugin(specifier: string): unknown {
  return createRequire(path.join(root, "packages", "unplugin", "package.json"))(
    specifier,
  );
}

interface MeasureOptions {
  count: number;
  emitExternalKey: boolean;
  /**
   * Number of external `node_modules/dep{j}/index.d.ts` targets each module's
   * graph edges and consulted-dependency list carry. Zero keeps the envelope
   * graph-free (the typia 13.1.1 shape); a positive value stamps the
   * graph-bearing shape typia >= 13.1.19 produces.
   */
  graphFanout?: number;
  /** Give each module one disjoint external edge instead of the whole union. */
  partitionExternalInputs?: boolean;
  /** Unrelated nested project directories used to gate membership-stat cost. */
  unrelatedDirectoryCount?: number;
}

async function measure(
  adapter: Adapter,
  options: MeasureOptions,
): Promise<string | undefined> {
  const project = createProject(options);
  const plugin = adapter.rollup({
    project: path.join(project, "tsconfig.json"),
  });
  const runLog = pluginRunLog(project);

  // Warm-up build: pays the one-time Go plugin compile + native program load so
  // the timed run reflects steady-state per-module cost, not toolchain startup.
  await runBuild(plugin, project, runLog);

  const counter = instrumentReadFileSync();
  fs.writeFileSync(runLog, "");
  const started = process.hrtime.bigint();
  await runBuild(plugin, project, runLog);
  const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
  counter.restore();

  const pluginRuns = fs.existsSync(runLog)
    ? fs.readFileSync(runLog, "utf8").length
    : 0;
  const perFileReads = (counter.calls / options.count).toFixed(1);
  console.log(
    `  N=${String(options.count).padStart(3)}  ` +
      `pluginRuns=${String(pluginRuns).padStart(3)}  ` +
      `reads=${String(counter.calls).padStart(7)}  ` +
      `reads/file=${perFileReads.padStart(7)}  ` +
      `readMiB=${(counter.bytes / 1048576).toFixed(1).padStart(6)}  ` +
      `${elapsedMs.toFixed(0).padStart(6)}ms`,
  );

  const scenario = options.emitExternalKey ? "B" : "A";
  return pluginRuns === 1
    ? undefined
    : `scenario ${scenario} N=${options.count}: pluginRuns=${pluginRuns} (expected 1)`;
}

/**
 * An fs probe pair (`existsSync` + `realpathSync.native`) is what one
 * `pathIdentityKey` call costs on macOS. A bounded watch-input derivation pays
 * that once per distinct graph path per generation, so the amortized budget
 * below is per module: well above the fixed point, far below the
 * O(edges)-per-delivery defect this scenario reproduces.
 */
const GRAPH_PROBES_PER_MODULE_BUDGET = 64;

/**
 * Drive a build-scoped run over a graph-bearing envelope and count the fs
 * probes a macOS host would pay for watch-input derivation. The first module
 * delivery compiles; the remaining deliveries are pure cache hits. The shared
 * path-identity resolver performs a physical-path probe on every supported
 * host, so the counter observes the real platform without mutating global
 * process identity after a Windows binary has already been selected.
 */
async function measureGraphBuild(
  adapter: Adapter,
  options: MeasureOptions,
): Promise<string | undefined> {
  const project = createProject(options);
  const plugin = adapter.rollup({
    project: path.join(project, "tsconfig.json"),
  });
  const runLog = pluginRunLog(project);

  await runBuild(plugin, project, runLog);

  const modules = projectModules(project);
  const context = {
    addWatchFile: () => undefined,
    error: (message: unknown) => {
      throw message instanceof Error ? message : new Error(String(message));
    },
  };
  fs.writeFileSync(runLog, "");
  process.env.PLUGIN_RUN_LOG = runLog;
  await plugin.buildStart.call(context);
  const [first, ...rest] = modules;
  await plugin.transform.call(context, fs.readFileSync(first!, "utf8"), first!);

  const probes = instrumentFsProbes();
  const started = process.hrtime.bigint();
  try {
    for (const id of rest) {
      await plugin.transform.call(context, fs.readFileSync(id, "utf8"), id);
    }
  } finally {
    probes.restore();
  }
  const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;

  const pluginRuns = fs.existsSync(runLog)
    ? fs.readFileSync(runLog, "utf8").length
    : 0;
  const edges = options.count * (options.graphFanout ?? 0) + options.count - 1;
  const probesPerModule = probes.calls / rest.length;
  console.log(
    `  N=${String(options.count).padStart(3)}  ` +
      `E=${String(edges).padStart(6)}  ` +
      `pluginRuns=${String(pluginRuns).padStart(3)}  ` +
      `probes=${String(probes.calls).padStart(9)}  ` +
      `probes/file=${probesPerModule.toFixed(1).padStart(9)}  ` +
      `${elapsedMs.toFixed(0).padStart(7)}ms`,
  );

  if (pluginRuns !== 1) {
    return `scenario C N=${options.count} K=${options.graphFanout}: pluginRuns=${pluginRuns} (expected 1)`;
  }
  return probesPerModule <= GRAPH_PROBES_PER_MODULE_BUDGET
    ? undefined
    : `scenario C N=${options.count} K=${options.graphFanout}: probes/file=${probesPerModule.toFixed(1)} exceeds the bounded-derivation budget of ${GRAPH_PROBES_PER_MODULE_BUDGET} (per-delivery derivation re-walks the whole graph)`;
}

/**
 * Gate the serve-mode path: with no `buildStart` boundary the cache stays in
 * persistent-validation mode. Each module owns one disjoint external graph
 * input, so rereading the envelope union is visible as linear reads per module
 * while per-file validation stays under a fixed budget.
 */
async function measureServeValidation(
  adapter: Adapter,
  options: MeasureOptions,
): Promise<string | undefined> {
  const project = createProject(options);
  const plugin = adapter.rollup({
    project: path.join(project, "tsconfig.json"),
  });
  const runLog = pluginRunLog(project);
  const context = {
    addWatchFile: () => undefined,
    error: (message: unknown) => {
      throw message instanceof Error ? message : new Error(String(message));
    },
  };

  // No buildStart anywhere: the cache never becomes build-scoped, which is
  // exactly the state Vite's development server leaves it in.
  process.env.PLUGIN_RUN_LOG = runLog;
  const modules = projectModules(project);
  for (const id of modules) {
    await plugin.transform.call(context, fs.readFileSync(id, "utf8"), id);
  }
  await new Promise<void>((resolve) => setImmediate(resolve));

  const counter = instrumentReadFileSync();
  const statCounter = instrumentStatSync();
  const started = process.hrtime.bigint();
  try {
    for (const id of modules) {
      await plugin.transform.call(context, fs.readFileSync(id, "utf8"), id);
    }
  } finally {
    counter.restore();
    statCounter.restore();
  }
  const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
  const pluginRuns = fs.existsSync(runLog)
    ? fs.readFileSync(runLog, "utf8").length
    : 0;

  console.log(
    `  N=${String(options.count).padStart(3)}  ` +
      `externals=${String(options.graphFanout ?? 0).padStart(4)}  ` +
      `pluginRuns=${String(pluginRuns).padStart(3)}  ` +
      `reads=${String(counter.calls).padStart(8)}  ` +
      `reads/file=${(counter.calls / options.count).toFixed(1).padStart(8)}  ` +
      `stats/file=${(statCounter.calls / options.count).toFixed(1).padStart(6)}  ` +
      `${elapsedMs.toFixed(0).padStart(7)}ms`,
  );
  const readsPerFile = counter.calls / options.count;
  const statsPerFile = statCounter.calls / options.count;
  if (pluginRuns !== 1) {
    return `scenario D N=${options.count} K=${options.graphFanout}: pluginRuns=${pluginRuns} (expected 1)`;
  }
  if (readsPerFile > 16) {
    return `scenario D N=${options.count} K=${options.graphFanout}: reads/file=${readsPerFile.toFixed(1)} exceeds the per-file validation budget of 16`;
  }
  return statsPerFile <= 8
    ? undefined
    : `scenario D N=${options.count} dirs=${options.unrelatedDirectoryCount}: stats/file=${statsPerFile.toFixed(1)} exceeds the shared membership budget of 8`;
}

/**
 * Wrap the two fs calls the macOS `pathIdentityKey` branch pays per call
 * (`existsSync` and `realpathSync.native`) with pass-through counters.
 */
function instrumentFsProbes(): { calls: number; restore: () => void } {
  const counter = { calls: 0, restore: () => undefined };
  const originalExists = fs.existsSync;
  const originalRealpath = fs.realpathSync.native;
  (fs as { existsSync: typeof fs.existsSync }).existsSync = function (
    this: unknown,
    ...args: Parameters<typeof fs.existsSync>
  ) {
    counter.calls += 1;
    return originalExists.apply(this, args as never);
  } as typeof fs.existsSync;
  (fs.realpathSync as { native: typeof fs.realpathSync.native }).native =
    function (
      this: unknown,
      ...args: Parameters<typeof fs.realpathSync.native>
    ) {
      counter.calls += 1;
      return originalRealpath.apply(this, args as never);
    } as typeof fs.realpathSync.native;
  counter.restore = () => {
    (fs as { existsSync: typeof fs.existsSync }).existsSync = originalExists;
    (fs.realpathSync as { native: typeof fs.realpathSync.native }).native =
      originalRealpath;
  };
  return counter;
}

/**
 * Drive the real Rollup plugin like the bundler would: `buildStart` once, then
 * `transform` for every included module, in module order.
 */
async function runBuild(
  plugin: ReturnType<Adapter["rollup"]>,
  project: string,
  runLog: string,
): Promise<void> {
  const context = {
    addWatchFile: () => undefined,
    error: (message: unknown) => {
      throw message instanceof Error ? message : new Error(String(message));
    },
  };
  process.env.PLUGIN_RUN_LOG = runLog;
  await plugin.buildStart.call(context);
  for (const id of projectModules(project)) {
    if (!plugin.transformInclude.call(context, id)) {
      continue;
    }
    await plugin.transform.call(context, fs.readFileSync(id, "utf8"), id);
  }
}

function projectModules(project: string): string[] {
  const srcDir = path.join(project, "src");
  return fs
    .readdirSync(srcDir)
    .filter((name) => name.endsWith(".ts"))
    .sort()
    .map((name) => path.join(srcDir, name));
}

/** Keep the observer outside the project snapshot it is measuring. */
function pluginRunLog(project: string): string {
  return path.join(tmpRoot, `${path.basename(project)}.plugin-runs`);
}

/** Wrap `fs.readFileSync` to count calls and bytes for one timed build. */
function instrumentReadFileSync(): {
  calls: number;
  bytes: number;
  restore: () => void;
} {
  const original = fs.readFileSync;
  const counter = { calls: 0, bytes: 0, restore: () => undefined };
  (fs as { readFileSync: typeof fs.readFileSync }).readFileSync = function (
    this: unknown,
    ...args: Parameters<typeof fs.readFileSync>
  ) {
    counter.calls += 1;
    const result = original.apply(this, args as never);
    // `.length` is bytes for a Buffer and characters for a string; either is a
    // fine order-of-magnitude signal for this experiment.
    counter.bytes += result.length;
    return result;
  } as typeof fs.readFileSync;
  counter.restore = () => {
    (fs as { readFileSync: typeof fs.readFileSync }).readFileSync = original;
  };
  return counter;
}

/** Wrap `fs.statSync` to gate synchronous validation work per module. */
function instrumentStatSync(): { calls: number; restore: () => void } {
  const original = fs.statSync;
  const counter = { calls: 0, restore: () => undefined };
  (fs as { statSync: typeof fs.statSync }).statSync = function (
    this: unknown,
    ...args: Parameters<typeof fs.statSync>
  ) {
    counter.calls += 1;
    return original.apply(this, args as never);
  } as typeof fs.statSync;
  counter.restore = () => {
    (fs as { statSync: typeof fs.statSync }).statSync = original;
  };
  return counter;
}

function createProject(options: MeasureOptions): string {
  const project = fs.mkdtempSync(path.join(tmpRoot, "project-"));
  const srcDir = path.join(project, "src");
  fs.mkdirSync(srcDir, { recursive: true });
  for (let index = 0; index < options.count; index += 1) {
    fs.writeFileSync(
      path.join(srcDir, `mod${index}.ts`),
      `export const value${index}: string = "${index}";\n`,
      "utf8",
    );
  }
  fs.writeFileSync(
    path.join(project, "package.json"),
    JSON.stringify({ private: true, type: "commonjs" }, null, 2),
    "utf8",
  );
  for (
    let index = 0;
    index < (options.unrelatedDirectoryCount ?? 0);
    index += 1
  ) {
    const directory = path.join(
      project,
      "fixtures",
      `unused-${index}`,
      "nested",
    );
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, "asset.txt"), "fixture\n", "utf8");
  }
  fs.writeFileSync(
    path.join(project, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          rootDir: "src",
          outDir: "dist",
          plugins: [{ transform: "./plugin.cjs", name: "perf-fixture" }],
        },
        include: ["src"],
      },
      null,
      2,
    ),
    "utf8",
  );
  fs.writeFileSync(
    path.join(project, "plugin.cjs"),
    [
      'const path = require("node:path");',
      "",
      "module.exports = (context) => ({",
      '  name: "perf-fixture",',
      '  source: path.resolve(context.dirname, "go-plugin"),',
      "});",
      "",
    ].join("\n"),
    "utf8",
  );
  writeGoPlugin(project);
  if (options.emitExternalKey) {
    // The store-time hash overlay reads this file, so it must exist; the
    // validator's directory walk skips node_modules, which is the whole point.
    const depDir = path.join(project, "node_modules", "dep");
    fs.mkdirSync(depDir, { recursive: true });
    fs.writeFileSync(path.join(depDir, "index.d.ts"), "export {};\n", "utf8");
  }
  const graphFanout = options.graphFanout ?? 0;
  if (graphFanout > 0) {
    // The graph envelope's external targets must exist: the store-time
    // snapshot hashes every recorded external input.
    for (let index = 0; index < graphFanout; index += 1) {
      const depDir = path.join(project, "node_modules", `dep${index}`);
      fs.mkdirSync(depDir, { recursive: true });
      fs.writeFileSync(
        path.join(depDir, "index.d.ts"),
        `export declare const dep${index}: number;\n`,
        "utf8",
      );
    }
  }
  // The Go sidecar keys its extra output entry only when asked.
  process.env.TTSC_PERF_EMIT_EXTERNAL = options.emitExternalKey ? "1" : "0";
  process.env.TTSC_PERF_GRAPH_FANOUT = String(graphFanout);
  process.env.TTSC_PERF_PARTITION_EXTERNAL = options.partitionExternalInputs
    ? "1"
    : "0";
  return project;
}

/**
 * A minimal `package main` transform sidecar: it echoes every `src/*.ts` file
 * back as the transform output (identity), appends one byte to `PLUGIN_RUN_LOG`
 * per invocation so the harness can count whole-project re-transforms, and
 * optionally emits one out-of-walk output key to trigger the cache-miss bug.
 */
function writeGoPlugin(project: string): void {
  const dir = path.join(project, "go-plugin");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "go.mod"),
    "module example.com/ttscunpluginperf\n\ngo 1.26\n",
    "utf8",
  );
  fs.writeFileSync(
    path.join(dir, "main.go"),
    [
      "package main",
      "",
      "import (",
      '  "crypto/sha256"',
      '  "encoding/json"',
      '  "flag"',
      '  "fmt"',
      '  "os"',
      '  "path/filepath"',
      '  "sort"',
      '  "strconv"',
      '  "strings"',
      ")",
      "",
      "type referenceGraph struct {",
      '  Edges      map[string][]string `json:"edges"`',
      '  Globals    []string            `json:"globals"`',
      '  Configs    []string            `json:"configs"`',
      '  Candidates map[string][]string `json:"candidates,omitempty"`',
      '  InputHashes map[string]*string `json:"inputHashes,omitempty"`',
      '  InputRealpaths map[string]*string `json:"inputRealpaths,omitempty"`',
      "}",
      "",
      "type transformResult struct {",
      '  TypeScript   map[string]string   `json:"typescript"`',
      '  Dependencies map[string][]string `json:"dependencies,omitempty"`',
      '  Graph        *referenceGraph     `json:"graph,omitempty"`',
      "}",
      "",
      "func main() { os.Exit(run(os.Args[1:])) }",
      "",
      "func run(args []string) int {",
      "  if len(args) == 0 { return 2 }",
      "  switch args[0] {",
      '  case "transform":',
      "    return transform(args[1:])",
      '  case "check", "version", "build":',
      "    return 0",
      "  default:",
      '    fmt.Fprintf(os.Stderr, "perf-fixture: unknown command %q\\n", args[0])',
      "    return 2",
      "  }",
      "}",
      "",
      "func transform(args []string) int {",
      '  fs := flag.NewFlagSet("transform", flag.ContinueOnError)',
      "  fs.SetOutput(os.Stderr)",
      '  cwd := fs.String("cwd", "", "")',
      '  fs.String("tsconfig", "", "")',
      '  fs.String("plugins-json", "", "")',
      "  if err := fs.Parse(args); err != nil { return 2 }",
      "  root := *cwd",
      '  if root == "" { root, _ = os.Getwd() }',
      "",
      '  if logPath := os.Getenv("PLUGIN_RUN_LOG"); logPath != "" {',
      "    if f, err := os.OpenFile(logPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644); err == nil {",
      '      f.WriteString("x")',
      "      f.Close()",
      "    }",
      "  }",
      "",
      "  ts := map[string]string{}",
      '  srcDir := filepath.Join(root, "src")',
      "  entries, err := os.ReadDir(srcDir)",
      "  if err != nil { fmt.Fprintln(os.Stderr, err); return 2 }",
      "  names := []string{}",
      "  for _, e := range entries {",
      '    if e.IsDir() || !strings.HasSuffix(e.Name(), ".ts") { continue }',
      "    names = append(names, e.Name())",
      "  }",
      "  sort.Strings(names)",
      "  for _, name := range names {",
      "    data, err := os.ReadFile(filepath.Join(srcDir, name))",
      "    if err != nil { fmt.Fprintln(os.Stderr, err); return 2 }",
      '    ts["src/"+name] = string(data)',
      "  }",
      '  if os.Getenv("TTSC_PERF_EMIT_EXTERNAL") == "1" {',
      '    ts["node_modules/dep/index.d.ts"] = "export {};\\n"',
      "  }",
      "",
      "  result := transformResult{TypeScript: ts}",
      '  fanout, _ := strconv.Atoi(os.Getenv("TTSC_PERF_GRAPH_FANOUT"))',
      "  if fanout > 0 {",
      "    externals := make([]string, 0, fanout)",
      "    for j := 0; j < fanout; j++ {",
      '      externals = append(externals, fmt.Sprintf("node_modules/dep%d/index.d.ts", j))',
      "    }",
      "    edges := map[string][]string{}",
      "    deps := map[string][]string{}",
      "    candidates := map[string][]string{}",
      "    for i, name := range names {",
      '      key := "src/" + name',
      "      targets := []string{}",
      '      if os.Getenv("TTSC_PERF_PARTITION_EXTERNAL") == "1" {',
      "        targets = append(targets, externals[i%len(externals)])",
      "      } else {",
      "        if i+1 < len(names) {",
      '          targets = append(targets, "src/"+names[i+1])',
      "        }",
      "        targets = append(targets, externals...)",
      "      }",
      "      edges[key] = targets",
      "      deps[key] = targets",
      "      // A missing superseding probe, mirroring an unsuccessful",
      "      // module-resolution candidate the compiler records.",
      '      candidates[key] = []string{fmt.Sprintf("node_modules/dep%d/index.ts", i%fanout)}',
      "    }",
      "    result.Dependencies = deps",
      "    result.Graph = &referenceGraph{",
      "      Edges:      edges,",
      "      Globals:    []string{},",
      '      Configs:    []string{"tsconfig.json"},',
      "      Candidates: candidates,",
      "      InputHashes: map[string]*string{},",
      "      InputRealpaths: map[string]*string{},",
      "    }",
      "    addGraphInputProofs(result.Graph, root)",
      "  }",
      "",
      "  data, _ := json.Marshal(result)",
      "  fmt.Fprintln(os.Stdout, string(data))",
      "  return 0",
      "}",
      "",
      "func addGraphInputProofs(graph *referenceGraph, root string) {",
      "  inputs := map[string]struct{}{}",
      "  for source, targets := range graph.Edges {",
      "    inputs[source] = struct{}{}",
      "    for _, target := range targets { inputs[target] = struct{}{} }",
      "  }",
      "  for _, input := range graph.Globals { inputs[input] = struct{}{} }",
      "  for _, input := range graph.Configs { inputs[input] = struct{}{} }",
      "  for source, candidates := range graph.Candidates {",
      "    inputs[source] = struct{}{}",
      "    for _, candidate := range candidates { inputs[candidate] = struct{}{} }",
      "  }",
      "  for input := range inputs { addGraphInputProof(graph, root, input) }",
      "}",
      "",
      "func addGraphInputProof(graph *referenceGraph, root, input string) {",
      "  file := filepath.FromSlash(input)",
      "  if !filepath.IsAbs(file) { file = filepath.Join(root, file) }",
      "  data, err := os.ReadFile(file)",
      "  if err != nil {",
      "    info, statErr := os.Stat(file)",
      "    if statErr != nil || !info.IsDir() {",
      "      graph.InputHashes[input] = nil",
      "      graph.InputRealpaths[input] = nil",
      "      return",
      "    }",
      '    data = []byte("ttsc:host-input:directory\\x00")',
      "  }",
      "  realpath, err := filepath.EvalSymlinks(file)",
      "  if err != nil { return }",
      "  absolute, err := filepath.Abs(realpath)",
      "  if err != nil { return }",
      "  digest := sha256.Sum256(data)",
      '  hash := fmt.Sprintf("%x", digest[:])',
      "  graph.InputHashes[input] = &hash",
      "  graph.InputRealpaths[input] = &absolute",
      "}",
      "",
    ].join("\n"),
    "utf8",
  );
}

/** Resolve the native `tsc` binary the in-process transform path expects. */
function resolveTscBinary(): string {
  const packageJson = requireFromTtsc.resolve("typescript/package.json");
  const platformPackageJson = createRequire(packageJson).resolve(
    `@typescript/typescript-${process.platform}-${process.arch}/package.json`,
  );
  return path.join(
    path.dirname(platformPackageJson),
    "lib",
    process.platform === "win32" ? "tsc.exe" : "tsc",
  );
}
