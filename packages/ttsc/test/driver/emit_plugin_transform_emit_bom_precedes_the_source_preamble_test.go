package driver_test

import (
  "path/filepath"
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
  shimprinter "github.com/microsoft/typescript-go/shim/printer"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// preambleHashbangSource is a hashbang file, the shape whose first bytes are
// already contested before `emitBOM` adds to them: ApplySourcePreamble inserts
// the preamble AFTER the `#!` line so the shebang stays executable, and the
// printer re-emits that shebang first.
const preambleHashbangSource = "#!/usr/bin/env node\nexport const a = 0;\nexport const b = 1;\n"

const preambleHashbangLine = "#!/usr/bin/env node"

// TestEmitPluginTransformEmitBOMPrecedesTheSourcePreamble verifies that the
// plugin-transform emit lane's `emitBOM` mark stays the emitted file's first
// bytes when a source-level preamble and a hashbang also compete for the front
// of the output.
//
// `emitBOM` is applied by `printSourceFile` to the finished text, after
// everything the printer wrote — so a lane that instead prepended the mark
// somewhere inside its own assembly, or applied it before the preamble-shift
// correction rewrote the text, could easily leave it second. The three
// producers of leading bytes are independent here (the byte order mark from the
// compiler option, the shebang from the printer, the preamble comment from a
// linked SourcePreamblePlugin), and only their order proves the mark was
// applied last and to the whole text.
//
//  1. Register a SourcePreamblePlugin and compile a hashbang fixture through
//     EmitWithPluginTransformer with an identity transform, once with `emitBOM`
//     and once without it.
//  2. With `emitBOM`, assert the mark is the first bytes and the shebang
//     immediately follows it, with the injected preamble still in the output.
//  3. Without it, assert the same file starts with the shebang and carries no
//     mark anywhere (the negative twin).
func TestEmitPluginTransformEmitBOMPrecedesTheSourcePreamble(t *testing.T) {
  t.Run("emit_bom_marks_the_file_ahead_of_the_shebang", func(t *testing.T) {
    js := emitHashbangWithPreamble(t, `"emitBOM": true`)
    if !strings.HasPrefix(js, utf8BOM) {
      t.Fatalf("emitted JavaScript does not begin with the byte order mark:\n%q", js)
    }
    if !strings.HasPrefix(js[len(utf8BOM):], preambleHashbangLine) {
      t.Fatalf("the byte order mark is not immediately followed by the shebang:\n%q", js)
    }
    if strings.Count(js, utf8BOM) != 1 {
      t.Fatalf("the byte order mark appears %d times; it belongs only at the front:\n%q", strings.Count(js, utf8BOM), js)
    }
    if !strings.Contains(js, "preamble 1") {
      t.Fatalf("the injected source preamble is missing, so this case does not exercise the interaction it names:\n%q", js)
    }
  })

  t.Run("no_emit_bom_leaves_the_shebang_first", func(t *testing.T) {
    js := emitHashbangWithPreamble(t, `"emitBOM": false`)
    if strings.Contains(js, utf8BOM) {
      t.Fatalf("emitted JavaScript carries a byte order mark without emitBOM:\n%q", js)
    }
    if !strings.HasPrefix(js, preambleHashbangLine) {
      t.Fatalf("emitted JavaScript does not begin with the shebang:\n%q", js)
    }
    if !strings.Contains(js, "preamble 1") {
      t.Fatalf("the injected source preamble is missing, so this case does not exercise the interaction it names:\n%q", js)
    }
  })
}

// emitHashbangWithPreamble compiles the hashbang fixture with a linked
// SourcePreamblePlugin and the given extra compiler options, emitting through
// the hand-assembled plugin-transform lane, and returns the emitted JavaScript.
func emitHashbangWithPreamble(t *testing.T, options string) string {
  t.Helper()
  resetLinkedPluginRegistry()
  driver.RegisterPlugin(preambleEmitPlugin{})
  t.Setenv(driver.LinkedPluginsEnv, `[{"name":"preamble","stage":"transform","config":{}}]`)

  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2020",
    "outDir": "bin",
    "strict": true,
    `+options+`
  },
  "files": ["index.ts"]
}
`)
  writeProjectFile(t, root, "index.ts", preambleHashbangSource)
  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{ForceEmit: true})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected config diagnostics: %#v", diags)
  }
  defer prog.Close()
  if prog.SourcePreamble == "" {
    t.Fatal("source preamble was not applied to the program")
  }

  identity := func(_ *shimprinter.EmitContext, sf *shimast.SourceFile) *shimast.SourceFile {
    return sf
  }
  emitted := map[string]string{}
  if _, err := prog.EmitWithPluginTransformer(identity, func(fileName, text string, _ *shimcompiler.WriteFileData) error {
    emitted[filepath.Base(fileName)] = text
    return nil
  }); err != nil {
    t.Fatal(err)
  }
  js, ok := emitted["index.js"]
  if !ok {
    t.Fatalf("index.js was not emitted; got %v", sortedKeys(emitted))
  }
  return js
}
