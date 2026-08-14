import { assertFilesystemOperationsAreCacheLocal } from "../../internal/transform-project-cache";

export async function test_transformttsc_filesystem_operations_are_cache_local(): Promise<void> {
  await assertFilesystemOperationsAreCacheLocal();
}
