#!/usr/bin/env node
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

interface IDiagnostic {
  messageText: unknown;
}

interface ITypeScript {
  sys: {
    readFile(path: string): string | undefined;
  };
  readConfigFile(
    path: string,
    readFile: (path: string) => string | undefined,
  ): {
    config: unknown;
    error?: IDiagnostic;
  };
  parseJsonConfigFileContent(
    config: unknown,
    host: ITypeScript["sys"],
    basePath: string,
    existingOptions: undefined,
    configPath: string,
  ): {
    errors: IDiagnostic[];
    fileNames: string[];
  };
  flattenDiagnosticMessageText(message: unknown, newLine: string): string;
}

const args: string[] = process.argv.slice(2);
const projects: string[] = [];
let cwd = process.cwd();
let typescriptRoot = cwd;
let hasTypescriptRoot = false;
let shell = false;
let json = false;

for (let i = 0; i < args.length; i++) {
  const arg: string = args[i]!;
  if (arg === "--project" || arg === "-p") {
    projects.push(requireArgument(args, ++i, arg));
  } else if (arg === "--cwd") {
    cwd = path.resolve(requireArgument(args, ++i, arg));
    if (!hasTypescriptRoot) typescriptRoot = cwd;
  } else if (arg === "--typescript-root") {
    typescriptRoot = path.resolve(requireArgument(args, ++i, arg));
    hasTypescriptRoot = true;
  } else if (arg === "--shell") {
    shell = true;
  } else if (arg === "--json") {
    json = true;
  } else {
    throw new Error(`unknown argument: ${arg}`);
  }
}

if (projects.length === 0)
  throw new Error("at least one --project is required");

const ts = loadTypescript(typescriptRoot);
const files = [...new Set(projects.flatMap((project) => readProject(project)))];

if (json) {
  process.stdout.write(`${JSON.stringify(files, null, 2)}\n`);
} else if (shell) {
  process.stdout.write(files.join(" "));
} else {
  process.stdout.write(`${files.join("\n")}\n`);
}

function readProject(project: string): string[] {
  const configPath = path.resolve(cwd, project);
  const loaded = ts.readConfigFile(configPath, ts.sys.readFile);
  if (loaded.error) {
    const message = ts.flattenDiagnosticMessageText(
      loaded.error.messageText,
      "\n",
    );
    throw new Error(`${configPath}: ${message}`);
  }
  const parsed = ts.parseJsonConfigFileContent(
    loaded.config,
    ts.sys,
    path.dirname(configPath),
    undefined,
    configPath,
  );
  if (parsed.errors.length !== 0) {
    const message = parsed.errors
      .map((error) => ts.flattenDiagnosticMessageText(error.messageText, "\n"))
      .join("\n");
    throw new Error(`${configPath}: ${message}`);
  }
  return parsed.fileNames
    .map((file) => path.relative(cwd, file).replaceAll(path.sep, "/"))
    .filter(
      (file: string) =>
        file && !file.startsWith("..") && isLintFormatSourceFileName(file),
    )
    .sort();
}

function isLintFormatSourceFileName(file: string): boolean {
  return [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"].some(
    (extension) => file.toLowerCase().endsWith(extension),
  );
}

function loadTypescript(root: string): ITypeScript {
  let dir: string = root;
  while (true) {
    const manifest = path.join(dir, "package.json");
    if (fs.existsSync(manifest)) {
      try {
        return createRequire(manifest)("typescript") as ITypeScript;
      } catch {
        // Try the parent package.
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return createRequire(import.meta.url)("typescript") as ITypeScript;
}

function requireArgument(
  arguments_: readonly string[],
  index: number,
  option: string,
): string {
  const value: string | undefined = arguments_[index];
  if (value === undefined) throw new Error(`${option} requires a value`);
  return value;
}
