import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { resolveSafeCacheCleanupTargets } from "../../../../../packages/ttsc/lib/internal/resolveSafeCacheCleanupTargets.js";

/**
 * Verifies cache cleanup pins alias ancestors without following terminal links.
 *
 * Recursive removal must not re-resolve a mutable alias ancestor after target
 * validation. A terminal cache symlink is different: Node removes that link
 * itself rather than its destination, and physical pinning must preserve that
 * established behavior instead of leaving a dangling link behind.
 *
 * 1. Resolve a cache below an alias, retarget the alias, and remove the pinned
 *    target.
 * 2. Assert the original cache is removed while the new target survives.
 * 3. Resolve and remove a terminal cache link, then assert its destination
 *    survives.
 */
export const test_resolvesafecachecleanuptargets_pins_alias_ancestors_and_preserves_terminal_links =
  (): void => {
    const root = TestProject.tmpdir("ttsc-clean-target-alias-");
    const project = path.join(root, "project");
    const original = path.join(root, "original");
    const victim = path.join(root, "victim");
    const alias = path.join(root, "cache-parent");
    for (const directory of [project, original, victim]) {
      fs.mkdirSync(directory);
    }
    const originalCache = path.join(original, "cache");
    const victimCache = path.join(victim, "cache");
    fs.mkdirSync(originalCache);
    fs.mkdirSync(victimCache);
    fs.writeFileSync(path.join(victimCache, "keep.txt"), "victim", "utf8");
    fs.symlinkSync(
      original,
      alias,
      process.platform === "win32" ? "junction" : "dir",
    );

    const [pinned] = resolveSafeCacheCleanupTargets(project, [
      path.join(alias, "cache"),
    ]);
    assert.ok(pinned);
    assert.equal(pinned.exists, true);
    assert.equal(pinned.path, fs.realpathSync.native(originalCache));
    fs.rmSync(alias, { force: true, recursive: true });
    fs.symlinkSync(
      victim,
      alias,
      process.platform === "win32" ? "junction" : "dir",
    );
    fs.rmSync(pinned.path, { force: true, recursive: true });
    assert.equal(fs.existsSync(originalCache), false);
    assert.equal(
      fs.readFileSync(path.join(victimCache, "keep.txt"), "utf8"),
      "victim",
    );

    const terminalTarget = path.join(root, "terminal-target");
    const terminalLink = path.join(root, "terminal-link");
    fs.mkdirSync(terminalTarget);
    fs.writeFileSync(path.join(terminalTarget, "keep.txt"), "target", "utf8");
    fs.symlinkSync(
      terminalTarget,
      terminalLink,
      process.platform === "win32" ? "junction" : "dir",
    );
    const [terminal] = resolveSafeCacheCleanupTargets(project, [terminalLink]);
    assert.ok(terminal);
    assert.equal(terminal.exists, true);
    assert.equal(
      terminal.path,
      path.join(fs.realpathSync.native(root), path.basename(terminalLink)),
    );
    fs.rmSync(terminal.path, { force: true, recursive: true });
    assert.equal(fs.existsSync(terminalLink), false);
    assert.equal(
      fs.readFileSync(path.join(terminalTarget, "keep.txt"), "utf8"),
      "target",
    );
  };
