import {
  TestProject,
  TestUnpluginProject,
  TestUnpluginRuntime,
} from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Shared scenarios for utility-plugin config discovery through the generated
 * alias tsconfig.
 *
 * Any bundler alias makes `transformTtsc` compile through a generated tsconfig
 * in the system temp directory that `extends` the project one. These scenarios
 * pin that `@ttsc/strip` / `@ttsc/banner` config-file discovery and relative
 * `configFile` resolution still anchor at the real project (via the launcher's
 * `TTSC_PLUGIN_CONFIG_DIR` channel), not at the temp directory.
 */

/** Source whose `logger.trace` call is stripped only by the project config. */
const STRIP_SOURCE = [
  "const logger = { trace(message: string): void { void message; } };",
  'logger.trace("drop");',
  'console.log("kept");',
  'export const value: string = "kept";',
  "",
].join("\n");

/**
 * Custom strip config: strips `logger.trace` (which the built-in defaults do
 * not) and nothing else (the defaults would strip `console.log`). Both
 * directions of the assertion therefore distinguish "project config honored"
 * from "silently fell back to defaults".
 */
const STRIP_CONFIG = JSON.stringify({
  calls: ["logger.trace"],
  statements: [],
});

/** A bundler alias entry; its only job is to force the generated tsconfig. */
function aliasFor(root: string): Record<string, string> {
  return { "@lib": path.join(root, "src", "modules") };
}

/**
 * Symlinks `packages/<name>` into `<root>/node_modules/@ttsc/<name>` so the
 * real utility plugin package is resolvable from the temporary project without
 * a full install. Mirrors the seeding the per-plugin suites use.
 */
function seedUtilityPlugin(root: string, name: "banner" | "strip"): void {
  const linkDir = path.join(root, "node_modules", "@ttsc");
  fs.mkdirSync(linkDir, { recursive: true });
  const target = path.join(TestProject.WORKSPACE_ROOT, "packages", name);
  const link = path.join(linkDir, name);
  try {
    fs.symlinkSync(target, link, "junction");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
  }
}

/** Create a fixture project wired to one utility plugin. */
function createUtilityPluginProject(props: {
  files?: Record<string, string>;
  plugin: "banner" | "strip";
  pluginEntry?: Record<string, unknown>;
  source: string;
}): string {
  const root = TestUnpluginProject.createProject({
    plugins: [
      { transform: `@ttsc/${props.plugin}`, ...(props.pluginEntry ?? {}) },
    ],
    source: props.source,
  });
  for (const [name, text] of Object.entries(props.files ?? {})) {
    const file = path.join(root, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text, "utf8");
  }
  seedUtilityPlugin(root, props.plugin);
  return root;
}

/**
 * Asserts that a bundler alias does not detach `@ttsc/strip` from the project's
 * `strip.config.json`: the configured call list is honored and the built-in
 * defaults are NOT applied.
 */
async function assertAliasOverlayHonorsProjectStripConfig() {
  const { resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = createUtilityPluginProject({
    files: { "strip.config.json": STRIP_CONFIG },
    plugin: "strip",
    source: STRIP_SOURCE,
  });
  const result = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    resolveOptions(),
    aliasFor(root),
  );

  assert.ok(result);
  assert.doesNotMatch(result.code, /logger\.trace\("drop"\)/);
  // The defaults strip console.log; the project config must win instead.
  assert.match(result.code, /console\.log\("kept"\)/);
}

/**
 * Asserts the positive twin: with and without the alias, the strip output is
 * byte-identical, so the generated-tsconfig lane and the passthrough lane agree
 * on the project's strip config.
 */
async function assertAliasOverlayMatchesNoAliasStripOutput() {
  const { resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = createUtilityPluginProject({
    files: { "strip.config.json": STRIP_CONFIG },
    plugin: "strip",
    source: STRIP_SOURCE,
  });
  const withAlias = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    resolveOptions(),
    aliasFor(root),
  );
  const withoutAlias = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    resolveOptions(),
  );

  assert.ok(withAlias);
  assert.ok(withoutAlias);
  assert.doesNotMatch(withoutAlias.code, /logger\.trace\("drop"\)/);
  assert.equal(withAlias.code, withoutAlias.code);
}

/**
 * Asserts that a bundler alias does not make `@ttsc/banner` fail with "no
 * banner.config found": the project's config file is discovered and its banner
 * text lands in the transformed source.
 */
async function assertAliasOverlayDiscoversProjectBannerConfig() {
  const { resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = createUtilityPluginProject({
    files: {
      "banner.config.json": JSON.stringify({ text: "Fixture Banner Text" }),
    },
    plugin: "banner",
    source: 'export const value: string = "kept";\n',
  });
  const result = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    resolveOptions(),
    aliasFor(root),
  );

  assert.ok(result);
  assert.match(result.code, /Fixture Banner Text/);
}

/** Assert a persistent generation reloads an implicitly discovered config. */
async function assertPersistentBannerConfigEditInvalidatesTransform() {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = createUtilityPluginProject({
    files: {
      "banner.config.json": JSON.stringify({ text: "OLD BANNER" }),
    },
    plugin: "banner",
    source: 'export const value: string = "kept";\n',
  });
  const file = TestUnpluginProject.mainFile(root);
  const source = TestUnpluginProject.mainSource(root);
  const cache = createTtscTransformCache();
  const first = await transformTtsc(
    file,
    source,
    resolveOptions(),
    undefined,
    cache,
  );
  assert.ok(first);
  assert.match(first.code, /OLD BANNER/);

  fs.writeFileSync(
    path.join(root, "banner.config.json"),
    JSON.stringify({ text: "NEW BANNER" }),
    "utf8",
  );
  const second = await transformTtsc(
    file,
    source,
    resolveOptions(),
    undefined,
    cache,
  );
  assert.ok(second);
  assert.match(second.code, /NEW BANNER/);
  assert.doesNotMatch(second.code, /OLD BANNER/);
}

/**
 * Asserts that a relative `configFile` on a tsconfig-declared plugin entry
 * resolves against the project even when the compile runs through the generated
 * alias tsconfig in the temp directory.
 */
async function assertAliasOverlayResolvesRelativeConfigFile() {
  const { resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = createUtilityPluginProject({
    files: {
      "config/banner.config.json": JSON.stringify({
        text: "Relative ConfigFile Banner",
      }),
    },
    plugin: "banner",
    pluginEntry: { configFile: "./config/banner.config.json" },
    source: 'export const value: string = "kept";\n',
  });
  const result = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    resolveOptions(),
    aliasFor(root),
  );

  assert.ok(result);
  assert.match(result.code, /Relative ConfigFile Banner/);
}

/**
 * Asserts the temp-walk hazard guard: a `strip.config.json` planted in the
 * directory that holds the generated tsconfig's temp tree must NOT be honored —
 * the project's own config wins.
 */
async function assertAliasOverlayIgnoresStripConfigPlantedInTempDir() {
  const { resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = createUtilityPluginProject({
    files: { "strip.config.json": STRIP_CONFIG },
    plugin: "strip",
    source: STRIP_SOURCE,
  });
  // Redirect the OS temp dir so the generated tsconfig lands under a
  // directory we control, with a hostile strip config planted one level
  // above the generated tree (i.e. exactly on the old discovery walk).
  const plantedTemp = TestProject.tmpdir("ttsc-unplugin-planted-");
  fs.writeFileSync(
    path.join(plantedTemp, "strip.config.json"),
    JSON.stringify({ calls: ["console.log"], statements: [] }),
    "utf8",
  );
  const previous = {
    TEMP: process.env.TEMP,
    TMP: process.env.TMP,
    TMPDIR: process.env.TMPDIR,
  };
  process.env.TMPDIR = plantedTemp;
  process.env.TEMP = plantedTemp;
  process.env.TMP = plantedTemp;
  try {
    const result = await transformTtsc(
      TestUnpluginProject.mainFile(root),
      TestUnpluginProject.mainSource(root),
      resolveOptions(),
      aliasFor(root),
    );

    assert.ok(result);
    // The planted config strips console.log; the project config keeps it and
    // strips logger.trace instead.
    assert.doesNotMatch(result.code, /logger\.trace\("drop"\)/);
    assert.match(result.code, /console\.log\("kept"\)/);
  } finally {
    restoreEnv("TEMP", previous.TEMP);
    restoreEnv("TMP", previous.TMP);
    restoreEnv("TMPDIR", previous.TMPDIR);
  }
}

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

export {
  assertAliasOverlayDiscoversProjectBannerConfig,
  assertAliasOverlayHonorsProjectStripConfig,
  assertAliasOverlayIgnoresStripConfigPlantedInTempDir,
  assertAliasOverlayMatchesNoAliasStripOutput,
  assertAliasOverlayResolvesRelativeConfigFile,
  assertPersistentBannerConfigEditInvalidatesTransform,
};
