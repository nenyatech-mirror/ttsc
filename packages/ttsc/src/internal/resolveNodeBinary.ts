import childProcess from "node:child_process";

export type JavaScriptRuntimeCapabilities = {
  bun: boolean;
  registerHooks: boolean;
};

const capabilityCache = new Map<string, JavaScriptRuntimeCapabilities>();

/** Probe an interpreter once instead of inferring its identity from the host. */
export function javascriptRuntimeCapabilities(
  runtime: string,
  env: NodeJS.ProcessEnv,
  cwd: string,
): JavaScriptRuntimeCapabilities {
  const effectiveEnv = { ...process.env, ...env };
  const key = `${runtime}\0${effectiveEnv.PATH ?? ""}`;
  const cached = capabilityCache.get(key);
  if (cached !== undefined) return cached;
  const result = childProcess.spawnSync(
    runtime,
    [
      "-e",
      `const Module = require("node:module"); process.stdout.write(JSON.stringify({ bun: typeof globalThis.Bun === "object", registerHooks: typeof Module.registerHooks === "function" }));`,
    ],
    {
      cwd,
      encoding: "utf8",
      env: effectiveEnv,
      windowsHide: true,
    },
  );
  let capabilities: JavaScriptRuntimeCapabilities = {
    bun: false,
    registerHooks: false,
  };
  if (result.status === 0) {
    try {
      const parsed = JSON.parse(
        result.stdout,
      ) as Partial<JavaScriptRuntimeCapabilities>;
      capabilities = {
        bun: parsed.bun === true,
        registerHooks: parsed.registerHooks === true,
      };
    } catch {
      // An incompatible executable is not a Node runtime candidate.
    }
  }
  capabilityCache.set(key, capabilities);
  return capabilities;
}

/**
 * Locate a real Node runtime for ttsx and native JavaScript config loaders.
 *
 * Bun can directly evaluate a descriptor, but it does not implement the
 * synchronous `module.registerHooks` contract used by those loaders.
 */
export function resolveNodeBinary(
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd(),
): string | undefined {
  const candidates = [
    env.TTSC_NODE_BINARY,
    process.env.TTSC_NODE_BINARY,
    process.execPath,
    "node",
  ];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (candidate === undefined || candidate.trim() === "") continue;
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    const capabilities = javascriptRuntimeCapabilities(candidate, env, cwd);
    if (!capabilities.bun && capabilities.registerHooks) return candidate;
  }
  return undefined;
}
