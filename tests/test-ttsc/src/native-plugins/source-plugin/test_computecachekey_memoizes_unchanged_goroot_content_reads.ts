import { TestProject } from "@ttsc/testing";

import {
  assert,
  computeCacheKey,
  createFakeGoBinary,
  fs,
  path,
} from "../../internal/source-build";

/**
 * Verifies computeCacheKey reuses an unchanged GOROOT content identity.
 *
 * A bundled toolchain contributes roughly 140 MiB to every source-plugin key.
 * Re-reading those bytes for every plugin dominates startup, while reusing a
 * stale identity after an in-place SDK patch would select the wrong binary.
 *
 * 1. Compute a key and assert the initial GOROOT contents were read.
 * 2. Recompute unchanged and assert no GOROOT content file was read again.
 * 3. Edit one stdlib file and assert content reads and a new key return.
 */
export const test_computecachekey_memoizes_unchanged_goroot_content_reads =
  () => {
    const root = TestProject.tmpdir("ttsc-source-plugin-");
    const plugin = path.join(root, "plugin");
    fs.mkdirSync(plugin, { recursive: true });
    fs.writeFileSync(
      path.join(plugin, "go.mod"),
      "module example.com/plugin\n\ngo 1.26\n",
      "utf8",
    );
    fs.writeFileSync(path.join(plugin, "main.go"), "package main\n", "utf8");
    const go = createFakeGoBinary(root);
    const goRoot = path.join(root, "go-root");
    const sourceFile = writeGoRoot(goRoot, "alpha");
    const previous = process.env.FAKE_GO_ENV_GOROOT;
    const originalRead = fs.readFileSync;
    let goRootReads = 0;
    (fs as { readFileSync: typeof fs.readFileSync }).readFileSync = function (
      this: unknown,
      ...args: Parameters<typeof fs.readFileSync>
    ) {
      const file = path.resolve(String(args[0]));
      const relative = path.relative(goRoot, file);
      if (
        relative !== "" &&
        relative !== ".." &&
        !relative.startsWith(`..${path.sep}`) &&
        !path.isAbsolute(relative)
      ) {
        goRootReads += 1;
      }
      return originalRead.apply(this, args as never);
    } as typeof fs.readFileSync;
    const key = () =>
      computeCacheKey({
        dir: plugin,
        entry: ".",
        goBinary: go,
        ttscVersion: "1.0.0",
        tsgoVersion: "7.0.0-dev",
      });

    try {
      process.env.FAKE_GO_ENV_GOROOT = goRoot;
      const first = key();
      assert.ok(goRootReads > 0, "the cold identity must read GOROOT content");

      goRootReads = 0;
      const second = key();
      assert.equal(second, first);
      assert.equal(goRootReads, 0);

      fs.writeFileSync(
        sourceFile,
        'package fmt\nconst marker = "bravo"\n',
        "utf8",
      );
      goRootReads = 0;
      const third = key();
      assert.notEqual(third, first);
      assert.ok(goRootReads > 0, "a changed manifest must re-read GOROOT");
    } finally {
      (fs as { readFileSync: typeof fs.readFileSync }).readFileSync =
        originalRead;
      if (previous === undefined) delete process.env.FAKE_GO_ENV_GOROOT;
      else process.env.FAKE_GO_ENV_GOROOT = previous;
    }
  };

function writeGoRoot(root: string, marker: string): string {
  fs.mkdirSync(path.join(root, "src", "fmt"), { recursive: true });
  fs.mkdirSync(path.join(root, "src", "runtime"), { recursive: true });
  fs.mkdirSync(path.join(root, "pkg", "tool", "linux_amd64"), {
    recursive: true,
  });
  fs.writeFileSync(path.join(root, "VERSION"), "go1.26.0\n", "utf8");
  fs.writeFileSync(path.join(root, "go.env"), "GOTOOLCHAIN=auto\n", "utf8");
  const sourceFile = path.join(root, "src", "fmt", "print.go");
  fs.writeFileSync(
    sourceFile,
    `package fmt\nconst marker = ${JSON.stringify(marker)}\n`,
    "utf8",
  );
  fs.writeFileSync(
    path.join(root, "src", "runtime", "runtime.go"),
    "package runtime\n",
    "utf8",
  );
  fs.writeFileSync(
    path.join(root, "pkg", "tool", "linux_amd64", "compile"),
    "compile\n",
    "utf8",
  );
  return sourceFile;
}
