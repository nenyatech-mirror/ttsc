import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TTSX_REGISTER, linkTtscPackage } from "../../internal/ttsx-register";

/**
 * Verifies ttsx register stops diagnostics before entry effects.
 *
 * Installing the private runtime hook alone would compile a newly discovered
 * source through the dependency lane, whose diagnostics are deliberately
 * skipped. The public preload must instead establish the same checked entry
 * gate as the ttsx CLI before any user statement can execute.
 *
 * 1. Create an included entry with a type error before a marker write.
 * 2. Run it through `node --require ttsc/register` with an explicit cache.
 * 3. Assert the diagnostic, absent marker, and cleaned runtime directory.
 */
export const test_ttsx_register_stops_diagnostics_before_entry_effects = () => {
  const root = TestProject.commonJsProject({
    "src/main.ts": [
      `import fs from "node:fs";`,
      `const marker = process.env.TTSX_REGISTER_MARKER!;`,
      `const invalid: string = 123;`,
      `fs.writeFileSync(marker, invalid);`,
      "",
    ].join("\n"),
  });
  linkTtscPackage(root);
  const marker = path.join(root, "executed.txt");
  const cacheDir = path.join(root, "node_modules", ".cache", "ttsc", "ttsx");

  const result = TestProject.spawn(
    process.execPath,
    ["--require", TTSX_REGISTER, "src/main.ts"],
    {
      cwd: root,
      env: {
        TTSX_REGISTER_MARKER: marker,
      },
    },
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /project check failed/);
  assert.match(
    result.stderr,
    /Type 'number' is not assignable to type 'string'/,
  );
  assert.equal(fs.existsSync(marker), false);
  const runtimeRoot = path.join(cacheDir, "project");
  assert.deepEqual(
    fs.existsSync(runtimeRoot) ? fs.readdirSync(runtimeRoot) : [],
    [],
  );
};
