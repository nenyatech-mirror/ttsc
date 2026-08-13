import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies the lint descriptor retains every higher-priority discovery probe.
 *
 * A monorepo package can inherit `lint.config.*` from an ancestor outside its
 * project walk. Creating a nearer config later must invalidate a persistent
 * bundler generation even though the previously selected ancestor file did not
 * change. A directory carrying a candidate filename is not a config and must
 * not stop the input walk before that selected ancestor.
 */
export const test_ttsc_lint_descriptor_tracks_external_discovery_candidates =
  () => {
    const workspace = TestProject.tmpdir("ttsc-lint-host-inputs-");
    const project = path.join(workspace, "packages", "app");
    fs.mkdirSync(project, { recursive: true });
    fs.mkdirSync(path.join(project, "lint.config.ts"));
    const selected = path.join(workspace, "lint.config.json");
    fs.writeFileSync(selected, "{}\n", "utf8");

    const mod = TestProject.REQUIRE_FROM_TEST(
      path.join(TestProject.WORKSPACE_ROOT, "packages", "lint"),
    );
    const factory = mod.createTtscPlugin ?? mod.default ?? mod;
    const filename = TestProject.REQUIRE_FROM_TEST.resolve(
      path.join(TestProject.WORKSPACE_ROOT, "packages", "lint"),
    );
    const context = {
      binary: "",
      cwd: project,
      dirname: path.dirname(filename),
      filename,
      plugin: { transform: "@ttsc/lint" },
      pluginConfigDir: project,
      projectRoot: project,
      tsconfig: path.join(project, "tsconfig.json"),
    };
    const descriptor = factory(context);

    assert.ok(descriptor.hostInputs.includes(selected));
    assert.ok(
      descriptor.hostInputs.includes(path.join(project, "lint.config.ts")),
    );
    assert.ok(
      descriptor.hostInputs.includes(
        path.join(workspace, "packages", "ttsc-lint.config.cjs"),
      ),
    );
    assert.equal(
      descriptor.hostInputs.includes(
        path.join(path.dirname(workspace), "lint.config.json"),
      ),
      false,
    );

    fs.writeFileSync(path.join(project, "lint.config.json"), "{}\n", "utf8");
    fs.writeFileSync(
      path.join(project, "ttsc-lint.config.json"),
      "{}\n",
      "utf8",
    );
    assert.throws(
      () => factory(context),
      /multiple lint config files found.*lint\.config\.json, ttsc-lint\.config\.json/,
    );
  };
