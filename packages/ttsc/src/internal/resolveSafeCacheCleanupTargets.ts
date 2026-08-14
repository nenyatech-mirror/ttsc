import fs from "node:fs";
import path from "node:path";

import {
  createFilesystemPathIdentityContext,
  isFilesystemPathIdentityWithin,
  resolveFilesystemPath,
} from "./projectInputPathIdentity";

export interface SafeCacheCleanupTarget {
  exists: boolean;
  path: string;
  requestedPath: string;
}

/**
 * Resolve one cache-clean transaction to physical deletion targets.
 *
 * Every target is proved before the caller removes the first one. Existing
 * aliases are pinned to their physical spelling, while a missing suffix keeps
 * the identity of its nearest existing parent. Identity errors other than a
 * genuinely missing path fail closed.
 */
export function resolveSafeCacheCleanupTargets(
  projectRoot: string,
  cacheDirectories: readonly string[],
): SafeCacheCleanupTarget[] {
  const identities = createFilesystemPathIdentityContext();
  const project = identities.resolve(projectRoot);
  return cacheDirectories.map((cacheDirectory) => {
    const requestedCache = resolveFilesystemPath(cacheDirectory);
    const cache = identities.resolve(requestedCache);
    if (
      requestedCache === path.parse(requestedCache).root ||
      cache.path === path.parse(cache.path).root
    ) {
      throw new Error(
        `ttsc: refusing to clean cache directory ${JSON.stringify(requestedCache)} because filesystem roots are never valid cache directories`,
      );
    }
    if (isFilesystemPathIdentityWithin(cache.key, project.key)) {
      throw new Error(
        `ttsc: refusing to clean cache directory ${JSON.stringify(requestedCache)} because it equals or contains project root ${JSON.stringify(project.path)}; choose a dedicated cache directory`,
      );
    }
    const status = lstatIfPresent(requestedCache);
    // Recursive rm removes a terminal symlink or junction itself rather than
    // following it. Preserve that behavior while pinning any mutable alias in
    // its ancestors to the physical parent selected by this transaction.
    const deletionPath = status?.isSymbolicLink()
      ? path.join(
          identities.resolve(path.dirname(requestedCache)).path,
          path.basename(requestedCache),
        )
      : cache.path;
    return {
      exists: status !== undefined,
      path: deletionPath,
      requestedPath: requestedCache,
    };
  });
}

function lstatIfPresent(location: string): fs.Stats | undefined {
  try {
    return fs.lstatSync(location);
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error.code === "ENOENT" || error.code === "ENOTDIR")
    ) {
      return undefined;
    }
    throw error;
  }
}
