import { TestProject } from "@ttsc/testing";

import {
  assert,
  fs,
  path,
  pruneGoBuildCacheRoot,
  resolvePluginCacheRoot,
  withGoBuildCacheLease,
} from "../../internal/source-build";

/**
 * Verifies Go object-cache LRU pruning yields to active builds and user caches.
 *
 * The ttsc-owned cache must converge toward its size target without deleting
 * objects under a concurrent Go build. An ambient `GOCACHE` remains wholly
 * user-owned and must not receive ttsc maintenance metadata or pruning.
 *
 * 1. Seed three old object files and prove an active build lease blocks GC.
 * 2. Release the lease, prune toward one object, and assert the newest survives.
 * 3. Seed four recent objects and assert the newest target-sized cohort is protected.
 * 4. Resolve user and explicitly named cache layouts and assert their objects
 *    and maintenance metadata remain untouched.
 */
export const test_gobuildcache_prunes_lru_objects_outside_active_build_leases =
  () => {
    const root = TestProject.tmpdir("ttsc-go-cache-gc-");
    const goCache = path.join(root, "go-build");
    const now = Date.now();
    const files = [
      writeObject(goCache, "00", "old-a", now - 30_000),
      writeObject(goCache, "01", "old-b", now - 20_000),
      writeObject(goCache, "02", "newest", now - 10_000),
    ];
    const maintain = () =>
      pruneGoBuildCacheRoot(goCache, {
        force: true,
        maxBytes: 8,
        now,
        protectedAgeMs: 0,
        targetBytes: 4,
      });

    withGoBuildCacheLease(goCache, true, () => {
      maintain();
      assert.ok(files.every((file) => fs.existsSync(file)));
    });

    maintain();
    assert.equal(fs.existsSync(files[0]!), false);
    assert.equal(fs.existsSync(files[1]!), false);
    assert.equal(fs.existsSync(files[2]!), true);

    const recentCache = path.join(root, "recent-go-build");
    const recent = [
      writeObject(recentCache, "10", "recent-a", now - 4_000),
      writeObject(recentCache, "11", "recent-b", now - 3_000),
      writeObject(recentCache, "12", "recent-c", now - 2_000),
      writeObject(recentCache, "13", "recent-d", now - 1_000),
    ];
    pruneGoBuildCacheRoot(recentCache, {
      force: true,
      maxBytes: 12,
      now,
      protectedAgeMs: 60_000,
      targetBytes: 8,
    });
    assert.deepEqual(
      recent.map((file) => fs.existsSync(file)),
      [false, false, true, true],
    );

    const project = path.join(root, "project");
    fs.mkdirSync(path.join(project, "node_modules"), { recursive: true });
    const userCache = path.join(root, "user-gocache");
    const userObject = writeObject(userCache, "03", "user", now - 30_000);
    resolvePluginCacheRoot(project, undefined, { GOCACHE: userCache });
    assert.equal(fs.existsSync(userObject), true);
    assert.equal(fs.existsSync(path.join(userCache, ".ttsc-gc")), false);
    assert.equal(
      fs.existsSync(path.join(userCache, ".ttsc-maintenance")),
      false,
    );

    for (const layout of [
      {
        cacheDir: path.join(root, "explicit-cache-dir"),
        cacheRoot: path.join(root, "explicit-cache-dir"),
        env: {},
        label: "cache-dir",
      },
      {
        cacheDir: undefined,
        cacheRoot: path.join(root, "explicit-env-cache"),
        env: { TTSC_CACHE_DIR: path.join(root, "explicit-env-cache") },
        label: "TTSC_CACHE_DIR",
      },
    ]) {
      const object = writeObject(
        path.join(layout.cacheRoot, "go-build"),
        "04",
        layout.label,
        now - 30_000,
      );
      resolvePluginCacheRoot(project, layout.cacheDir, layout.env);
      assert.equal(fs.existsSync(object), true);
      assert.equal(
        fs.existsSync(path.join(layout.cacheRoot, "go-build", ".ttsc-gc")),
        false,
      );
    }
  };

function writeObject(
  root: string,
  bucket: string,
  name: string,
  mtimeMs: number,
): string {
  const directory = path.join(root, bucket);
  fs.mkdirSync(directory, { recursive: true });
  const file = path.join(directory, name);
  fs.writeFileSync(file, "data", "utf8");
  const modified = new Date(mtimeMs);
  fs.utimesSync(file, modified, modified);
  return file;
}
