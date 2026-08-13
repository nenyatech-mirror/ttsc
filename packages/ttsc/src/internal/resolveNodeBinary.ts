import childProcess from "node:child_process";
import path from "node:path";

export type JavaScriptRuntimeCapabilities = {
  bun: boolean;
  executable?: string;
  registerHooks: boolean;
};

/** Probe an interpreter instead of inferring its identity from the host. */
export function javascriptRuntimeCapabilities(
  runtime: string,
  env: NodeJS.ProcessEnv,
  cwd: string,
): JavaScriptRuntimeCapabilities {
  const effectiveEnv = { ...process.env, ...env };
  const result = childProcess.spawnSync(
    runtime,
    [
      "-e",
      `const Module = require("node:module"); process.stdout.write(JSON.stringify({ bun: typeof globalThis.Bun === "object", executable: process.execPath, registerHooks: typeof Module.registerHooks === "function" }));`,
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
        ...(typeof parsed.executable === "string" &&
        path.isAbsolute(parsed.executable)
          ? { executable: path.resolve(parsed.executable) }
          : {}),
        registerHooks: parsed.registerHooks === true,
      };
    } catch {
      // An incompatible executable is not a Node runtime candidate.
    }
  }
  // Do not cache this result. A relative candidate can appear after a failed
  // probe, and an existing executable can be replaced between long-lived API
  // or LSP requests. The child-reported absolute identity is authoritative for
  // this invocation only.
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
    if (
      !capabilities.bun &&
      capabilities.registerHooks &&
      capabilities.executable !== undefined
    ) {
      return capabilities.executable;
    }
  }
  return undefined;
}
