// @ts-check
"use strict";

const fs = require("node:fs");
const path = require("node:path");

// Keys from the tsconfig plugin entry that @ttsc/strip accepts. All other keys
// are rejected so that stale inline options (calls, statements) surface as a
// clear error rather than silently falling back to defaults.
const ALLOWED_TSCONFIG_KEYS = new Set([
  "configFile",
  "enabled",
  "name",
  "stage",
  "transform",
]);

module.exports = function createTtscStrip(context) {
  const plugin =
    context && typeof context === "object" && context.plugin != null
      ? context.plugin
      : {};
  for (const key of Object.keys(plugin)) {
    if (!ALLOWED_TSCONFIG_KEYS.has(key)) {
      throw new Error(
        `@ttsc/strip: tsconfig plugin entry contains unsupported key ${JSON.stringify(key)}; ` +
          `strip configuration must be supplied via a strip.config.* file ` +
          `(use the "configFile" key to point at a custom path)`,
      );
    }
  }
  return {
    hostInputs: stripConfigInputs(context),
    name: "@ttsc/strip",
    // `context.dirname` is this descriptor's own directory in every load mode —
    // the ESM-safe replacement for `__dirname`.
    source: path.resolve(context.dirname, "..", "driver"),
    stage: "transform",
  };
};

const STRIP_CONFIG_FILENAMES = [
  "strip.config.ts",
  "strip.config.mts",
  "strip.config.cts",
  "strip.config.js",
  "strip.config.mjs",
  "strip.config.cjs",
  "strip.config.json",
];

function stripConfigInputs(context) {
  const configFile = context.plugin?.configFile;
  const base = path.resolve(
    context.pluginConfigDir ?? path.dirname(context.tsconfig),
  );
  if (typeof configFile === "string" && configFile.trim() !== "") {
    return [
      path.isAbsolute(configFile)
        ? path.resolve(configFile)
        : path.resolve(base, configFile),
    ];
  }
  const inputs = [];
  for (let directory = base; ; directory = path.dirname(directory)) {
    const candidates = STRIP_CONFIG_FILENAMES.map((name) =>
      path.join(directory, name),
    );
    inputs.push(...candidates);
    if (candidates.some(configCandidateExists)) break;
    const parent = path.dirname(directory);
    if (parent === directory) break;
  }
  return inputs;
}

/** Match the native discovery rule: a directory is never a config file. */
function configCandidateExists(file) {
  try {
    return !fs.statSync(file).isDirectory();
  } catch {
    return false;
  }
}
