package linthost

import (
  "os"
  "path/filepath"
  "testing"
)

// TestCommandFormatLeavesTokenSpacingUntouched verifies `ttsc format` rewrites
// none of the token gaps Prettier normalizes.
//
// This pins the boundary the format guide states under "Scope": the set is a
// collection of targeted passes and none of them has the whitespace between two
// tokens as its subject. The guide and the behavior have to agree, and only a
// case can keep them agreeing. When a token-spacing pass does land, this case
// fails first, and the guide is edited with it rather than after it.
//
// Every line here is already correct on every axis the set does cover: one
// statement per line, column zero, semicolons present, no strings, no trailing
// whitespace, one final newline, and every node fits printWidth flat, so the
// reflow's fast path leaves each one byte-identical.
//
//  1. Seed a project whose only defects are token gaps.
//  2. Run `ttsc format` with the default format block.
//  3. Assert the file is byte-identical.
func TestCommandFormatLeavesTokenSpacingUntouched(t *testing.T) {
  source := "const x = 1;\n" +
    "const a   =  1;\n" +
    "const b = 1+2;\n" +
    "const c = 1===1;\n" +
    "const i : number = 1;\n" +
    "const j = (n: number)=>n*2;\n" +
    "function run(v: number) {}\n" +
    "run (1);\n" +
    "if(x > 0) run(1);\n"
  root := seedLintProject(t, source)
  seedLintConfig(t, root, map[string]any{"format": map[string]any{}})

  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "format",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 0 || stdout != "" || stderr != "" {
    t.Fatalf("format command mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  got, err := os.ReadFile(filepath.Join(root, "src", "main.ts"))
  if err != nil {
    t.Fatalf("ReadFile: %v", err)
  }
  if string(got) != source {
    t.Fatalf(
      "format rewrote token spacing the guide says it leaves alone:\nwant %q\ngot  %q",
      source, string(got),
    )
  }
}
