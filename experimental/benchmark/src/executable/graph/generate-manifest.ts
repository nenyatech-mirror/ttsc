#!/usr/bin/env node
// Regenerate questions/manifest.json from the prompt files on disk.
//
// The manifest pins prompt text, repo, fixture branch, tsconfig, and the
// question SHA-256. It does not carry answer keys or scoring rules.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { TtscBenchmarkConstant } from "../../TtscBenchmarkConstant.ts";
import { TtscBenchmarkGraph } from "../../graph/TtscBenchmarkGraph.ts";

const qDir = TtscBenchmarkConstant.QUESTIONS_ROOT;

interface IRepository {
  tsconfig: string;
  fixtureBranch: "graph";
}

interface IQuestion {
  id: string;
  repo: string;
  family: "common" | "dedicated";
  file: string;
  fixtureBranch: "graph";
  tsconfig: string;
  questionSha256: string;
}

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
for (const [repo, repository] of Object.entries(
  TtscBenchmarkGraph.REPOSITORIES,
)) {
  const meta: IRepository = {
    fixtureBranch: "graph",
    tsconfig: repository.tsconfig,
  };
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
