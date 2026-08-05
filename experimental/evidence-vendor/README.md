# Evidence vendoring tools

`@ttsc/evidence`, its benchmark, and its two feature suites are vendored from `samchon/evidence` (published upstream as `@samchon/lint-plugin-evidence`). Upstream keeps moving, so the copy has to be repeatable rather than hand-made.

These scripts are branch-local tooling for the migration pull request. They are not part of any build, lane, or published package.

## Refreshing the vendored trees

Upstream is expected at `D:/github/samchon/evidence` (edit the constants if it lives elsewhere).

```bash
# 1. Copy. Never exclude a directory named `lib` — the benchmark template ships
#    frontend sources in `src/lib`, and excluding it silently delivers a
#    workspace whose entry cannot resolve `@/lib/client`.
robocopy <upstream>/benchmark/src            experimental/benchmark/evidence/src        /MIR /XD node_modules .git
robocopy <upstream>/benchmark/template       experimental/benchmark/evidence/template   /MIR /XD node_modules .git
robocopy <upstream>/benchmark/requirements   experimental/benchmark/evidence/requirements /MIR /XD node_modules .git
robocopy <upstream>/benchmark/instructions   experimental/benchmark/evidence/instructions /MIR /XD node_modules .git
robocopy <upstream>/packages/evidence/src    packages/evidence/src                      /MIR /XD node_modules .git
robocopy <upstream>/packages/evidence/native packages/evidence/native                   /MIR /XD node_modules .git
robocopy <upstream>/tests/test-evidence/src  tests/test-evidence/src                    /MIR /XD node_modules .git
robocopy <upstream>/tests/test-benchmark/src tests/test-evidence-benchmark/src          /MIR /XD node_modules .git

# 2. Re-apply every adaptation. Idempotent; ends in a measurement.
node experimental/evidence-vendor/readapt.cjs

# 3. Re-flatten the benchmark operation skill and repair its sibling links.
node experimental/evidence-vendor/flatten-skill.cjs
node experimental/evidence-vendor/fix-skill-links.cjs

# 4. Formatters. Go first, because upstream Go is tab-indented and this
#    repository pins two spaces and checks it.
bash ./.vscode/gofmt-2spaces.sh -w packages/evidence/native/*.go
npx prettier --write "packages/evidence/src/**/*.ts" \
  "experimental/benchmark/evidence/src/**/*.ts" \
  "tests/test-evidence/src/**/*.ts" \
  "tests/test-evidence-benchmark/src/**/*.ts" \
  ".agents/skills/evidence-*/*.md"

# 5. Sweep for assumptions the copy carried over.
node experimental/evidence-vendor/audit.cjs
```

Do not run Prettier over `experimental/benchmark/evidence/{template,requirements,instructions}`. `.prettierignore` exempts them, and the reason is in that file.

## What `readapt.cjs` does

0. Normalizes CRLF to LF, because robocopy preserves upstream line endings and a text anchor written with `\n` does not match a file carrying `\r\n`.
1. Renames identifiers and package names (`IEvidence` → `ITtscEvidence`, `@samchon/lint-plugin-evidence` → `@ttsc/evidence`, …), qualifies upstream issue numbers, and rewrites two comments that name documents this repository does not have.
2. Renames the files whose basenames carry those identifiers.
3. Writes `EvidenceBenchmarkLayout` and re-roots every benchmark path through it. Upstream sits at `<repository>/benchmark`, so one value answered both "which repository" and "where are the benchmark's own files". Here it cannot.
4. Restores `workspacePackageVersions`, which upstream deleted. See below.
5. Applies the suite-local adaptations (`benchmarkRoot`, manifest-driven dependency linking, re-based import paths, corrected prose).
6. Resolves every relative specifier in all five trees and prints the count.

### The one deletion that must not be taken

Upstream removed `workspacePackageVersions` from `EvidenceBenchmarkWorkspace`, and that is correct **for upstream**: it lists `ttsc`, `@ttsc/lint`, and `@ttsc/unplugin` in its own pnpm catalog, because there they are external dependencies, so a catalog lookup answers every `{{version:…}}` token.

Here they are the workspace itself, and a workspace never lists itself in a catalog. Without the manifest fallback, `{{version:ttsc}}` is unanswerable and `prepareWorkspace` throws before a cell writes anything. The script re-adds it.

This is the shape to watch for on every refresh: a blanket copy cannot tell an upstream change from an adaptation this workspace requires.

## `audit.cjs`

Sweeps the vendored trees for the classes of defect this migration has actually produced: repository-relative path literals that resolve to nothing, bare import specifiers no manifest declares, package scripts invoking a bin that `install` cannot create, cross-references to skills or wiki documents this repository does not have, broken skill links, and TypeScript no suite reads.

Expect one standing false positive: `@org/api`, a package name inside a fixture string. Most `path` hits are the benchmark describing the workspace it generates (`packages/api`, `packages/backend`) and are correct as written — rewriting those to this repository's layout would break the benchmark.
