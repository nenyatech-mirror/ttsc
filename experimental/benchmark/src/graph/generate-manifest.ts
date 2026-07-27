#!/usr/bin/env node
// Regenerate questions/manifest.json from the prompt files on disk.
//
// The manifest pins prompt text, repo, fixture branch, tsconfig, and the
// question SHA-256. It does not carry answer keys or scoring rules.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { QUESTIONS_ROOT } from "../constants.ts";

const qDir = QUESTIONS_ROOT;

interface IRepository {
  tsconfig: string;
  fixtureBranch: "ttsc";
}

interface IQuestion {
  id: string;
  repo: string;
  family: "common" | "dedicated";
  file: string;
  fixtureBranch: "ttsc";
  tsconfig: string;
  questionSha256: string;
}

const REPOS = {
  excalidraw: { tsconfig: "tsconfig.json", fixtureBranch: "ttsc" },
  vscode: { tsconfig: "src/tsconfig.json", fixtureBranch: "ttsc" },
  nestjs: { tsconfig: "tsconfig.json", fixtureBranch: "ttsc" },
  vue: { tsconfig: "tsconfig.json", fixtureBranch: "ttsc" },
  zod: { tsconfig: "tsconfig.json", fixtureBranch: "ttsc" },
  typeorm: { tsconfig: "tsconfig.json", fixtureBranch: "ttsc" },
  rxjs: { tsconfig: "tsconfig.graph.json", fixtureBranch: "ttsc" },
  "shopping-backend": { tsconfig: "tsconfig.json", fixtureBranch: "ttsc" },
} satisfies Record<string, IRepository>;

const has = (relativePath: string): boolean =>
  fs.existsSync(path.join(qDir, relativePath));
const sha = (relativePath: string): string =>
  crypto
    .createHash("sha256")
    .update(fs.readFileSync(path.join(qDir, relativePath)))
    .digest("hex");

const prompt = (
  repo: string,
  family: IQuestion["family"],
  file: string,
  meta: IRepository,
): IQuestion => ({
  id: `${repo}-${family}-v1`,
  repo,
  family,
  file,
  fixtureBranch: meta.fixtureBranch,
  tsconfig: meta.tsconfig,
  questionSha256: sha(file),
});

const prompts: IQuestion[] = [];
for (const [repo, meta] of Object.entries(REPOS)) {
  const dedicated = `${repo}.md`;
  if (has(dedicated)) prompts.push(prompt(repo, "dedicated", dedicated, meta));
  else console.warn(`warning: ${repo} has no ${dedicated}; skipped`);

  prompts.push(prompt(repo, "common", "common.md", meta));
}

const manifest = { schemaVersion: 1, prompts };
fs.writeFileSync(
  path.join(qDir, "manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
console.log(`manifest.json: ${prompts.length} prompts`);
for (const item of prompts)
  console.log(`  ${item.id.padEnd(34)} ${item.family.padEnd(10)} ${item.file}`);
