import { SHARED_PLUGIN_CACHE_DIR } from "../../internal/plugin-cache";
import {
  assert,
  copyProject,
  goPath,
  spawn,
} from "../../internal/plugin-corpus";
import { TTSX_REGISTER, linkTtscPackage } from "../../internal/ttsx-register";

/**
 * Verifies plugin corpus: ttsx register executes source plugin output.
 *
 * Plain TypeScript execution cannot prove the preload reused ttsx's compiler
 * preparation. This fixture's Go-source transform rewrites the runtime value,
 * so its output pins the complete plugin build and transformed-emit path.
 *
 * 1. Copy the native Go-source plugin fixture and link the workspace package.
 * 2. Run its TypeScript entry with `node --require ttsc/register`.
 * 3. Assert the transformed uppercase value is the code that executes.
 */
export const test_plugin_corpus_ttsx_register_executes_source_plugin_output_end_to_end =
  () => {
    const root = copyProject("go-source-plugin");
    linkTtscPackage(root);
    const result = spawn(
      process.execPath,
      ["--require", TTSX_REGISTER, "src/main.ts"],
      {
        cwd: root,
        env: {
          PATH: goPath(),
          TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
        },
      },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "PLUGIN");
  };
