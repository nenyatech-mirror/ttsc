import { TestProject } from "@ttsc/testing";

import {
  assert,
  child_process,
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
 * 3. Seed four recent objects and assert the newest target-sized cohort is
 *    protected.
 * 4. Prove a future-dated GC marker cannot suppress maintenance after a clock
 *    rollback or restored cache.
 * 5. Prove completed, stale, and future-dated intents cannot poison a live process
 *    while fresh orphan leases retain their conservative grace.
 * 6. Deny Worker permission and prove the IPC heartbeat fallback cleans up its
 *    lease after running the callback.
 * 7. Resolve user and explicitly named cache layouts and assert their objects and
 *    maintenance metadata remain untouched at the exact resolved roots.
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

    const futureMarkerCache = path.join(root, "future-marker-go-build");
    const futureMarkerObject = writeObject(
      futureMarkerCache,
      "14",
      "future-marker",
      now - 30_000,
    );
    fs.writeFileSync(
      path.join(futureMarkerCache, ".ttsc-gc"),
      `${now + 24 * 60 * 60 * 1000}\n`,
      "utf8",
    );
    pruneGoBuildCacheRoot(futureMarkerCache, {
      maxBytes: 0,
      now,
      protectedAgeMs: 0,
      targetBytes: 0,
    });
    assert.equal(fs.existsSync(futureMarkerObject), false);

    const staleIntent = writeCoordinationRecord(
      goCache,
      ".ttsc-maintenance",
      process.pid,
      now - 2 * 60 * 60 * 1000,
    );
    let staleIntentYielded = false;
    withGoBuildCacheLease(goCache, true, () => {
      staleIntentYielded = true;
    });
    assert.equal(staleIntentYielded, true);
    assert.equal(fs.existsSync(staleIntent), false);

    const completedCache = path.join(root, "completed-maintenance");
    const originalRm = fs.rmSync;
    (fs as { rmSync: typeof fs.rmSync }).rmSync = function (
      this: unknown,
      ...args: Parameters<typeof fs.rmSync>
    ) {
      const target = String(args[0]);
      if (
        path.basename(path.dirname(target)) === ".ttsc-maintenance" &&
        target.endsWith(".json")
      ) {
        const error = new Error("synthetic maintenance unlink failure");
        (error as NodeJS.ErrnoException).code = "EPERM";
        throw error;
      }
      return originalRm.apply(this, args as never);
    } as typeof fs.rmSync;
    try {
      pruneGoBuildCacheRoot(completedCache, {
        force: true,
        maxBytes: 0,
        now,
        protectedAgeMs: 0,
        targetBytes: 0,
      });
    } finally {
      (fs as { rmSync: typeof fs.rmSync }).rmSync = originalRm;
    }
    const completedIntent = fs
      .readdirSync(path.join(completedCache, ".ttsc-maintenance"))
      .map((entry) =>
        path.join(completedCache, ".ttsc-maintenance", entry),
      )[0]!;
    assert.equal(
      JSON.parse(fs.readFileSync(completedIntent, "utf8")).status,
      "complete",
    );
    let completedIntentYielded = false;
    withGoBuildCacheLease(completedCache, true, () => {
      completedIntentYielded = true;
    });
    assert.equal(completedIntentYielded, true);
    assert.equal(fs.existsSync(completedIntent), false);

    const futureIntent = writeCoordinationRecord(
      goCache,
      ".ttsc-maintenance",
      process.pid,
      now + 24 * 60 * 60 * 1000,
    );
    let futureIntentYielded = false;
    withGoBuildCacheLease(goCache, true, () => {
      futureIntentYielded = true;
    });
    assert.equal(futureIntentYielded, true);
    assert.equal(fs.existsSync(futureIntent), false);

    const orphanCache = path.join(root, "orphan-go-build");
    const orphanObject = writeObject(
      orphanCache,
      "20",
      "orphan-protected",
      now - 30_000,
    );
    const orphanLease = writeCoordinationRecord(
      orphanCache,
      ".ttsc-build-leases",
      2_147_483_647,
      now,
    );
    pruneGoBuildCacheRoot(orphanCache, {
      force: true,
      maxBytes: 0,
      now,
      protectedAgeMs: 0,
      targetBytes: 0,
    });
    assert.equal(fs.existsSync(orphanObject), true);
    const expired = new Date(now - 2 * 60 * 60 * 1000);
    fs.utimesSync(orphanLease, expired, expired);
    pruneGoBuildCacheRoot(orphanCache, {
      force: true,
      maxBytes: 0,
      now,
      protectedAgeMs: 0,
      targetBytes: 0,
    });
    assert.equal(fs.existsSync(orphanObject), false);

    if (process.allowedNodeEnvironmentFlags.has("--permission")) {
      const permissionCache = path.join(root, "permission-heartbeat");
      const permissionMarker = path.join(root, "permission-callback.txt");
      const library = path.join(
        TestProject.WORKSPACE_ROOT,
        "packages",
        "ttsc",
        "lib",
        "plugin",
        "internal",
        "buildSourcePlugin.js",
      );
      const permissionRun = child_process.spawnSync(
        process.execPath,
        [
          "--permission",
          "--allow-fs-read=*",
          "--allow-fs-write=*",
          "--allow-child-process",
          "-e",
          [
            'const fs = require("node:fs");',
            "const { withGoBuildCacheLease } = require(process.argv[1]);",
            "withGoBuildCacheLease(process.argv[2], true, () => {",
            '  fs.writeFileSync(process.argv[3], "ran\\n", "utf8");',
            "});",
          ].join("\n"),
          library,
          permissionCache,
          permissionMarker,
        ],
        { encoding: "utf8" },
      );
      assert.equal(
        permissionRun.status,
        0,
        `${permissionRun.stdout}\n${permissionRun.stderr}`,
      );
      assert.equal(fs.readFileSync(permissionMarker, "utf8"), "ran\n");
      assert.deepEqual(
        fs.readdirSync(path.join(permissionCache, ".ttsc-build-leases")),
        [],
      );
    }

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
        goBuildRoot: path.join(root, "explicit-cache-dir", "go-build"),
        env: {},
        label: "cache-dir",
      },
      {
        cacheDir: undefined,
        goBuildRoot: path.join(root, "explicit-env-cache", "go-build"),
        env: { TTSC_CACHE_DIR: path.join(root, "explicit-env-cache") },
        label: "TTSC_CACHE_DIR",
      },
      {
        cacheDir: undefined,
        goBuildRoot: path.join(root, "explicit-go-cache"),
        env: { TTSC_GO_CACHE_DIR: path.join(root, "explicit-go-cache") },
        label: "TTSC_GO_CACHE_DIR",
      },
    ]) {
      const object = writeObject(
        layout.goBuildRoot,
        "04",
        layout.label,
        now - 30_000,
      );
      resolvePluginCacheRoot(project, layout.cacheDir, layout.env);
      assert.equal(fs.existsSync(object), true);
      assert.equal(
        fs.existsSync(path.join(layout.goBuildRoot, ".ttsc-gc")),
        false,
      );
    }
  };

function writeCoordinationRecord(
  root: string,
  directoryName: string,
  pid: number,
  mtimeMs: number,
): string {
  const directory = path.join(root, directoryName);
  fs.mkdirSync(directory, { recursive: true });
  const file = path.join(directory, `synthetic-${pid}.json`);
  fs.writeFileSync(
    file,
    `${JSON.stringify({ hostname: "localhost", pid, startedAt: mtimeMs })}\n`,
    "utf8",
  );
  const modified = new Date(mtimeMs);
  fs.utimesSync(file, modified, modified);
  return file;
}

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
