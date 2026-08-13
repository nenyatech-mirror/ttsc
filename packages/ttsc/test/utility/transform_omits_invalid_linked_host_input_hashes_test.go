package ttsc_test

import (
  "encoding/json"
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
  "github.com/samchon/ttsc/packages/ttsc/utility"
)

type invalidHostInputHashPlugin struct {
  input string
}

func (plugin invalidHostInputHashPlugin) SourcePreamble(ctx driver.PluginContext) (string, error) {
  ctx.ReportHostInputHash(plugin.input, stringPointer("NOT-A-SHA256"))
  return "", nil
}

// TestUtilityTransformOmitsInvalidLinkedHostInputHashes verifies the public Go
// reporting seam cannot publish malformed fingerprint evidence.
//
// Third-party linked plugins call this API directly. An invalid value must keep
// the path as a watch input while withholding proof, so JavaScript adapters
// fall back conservatively instead of trusting non-SHA metadata.
//
//  1. Register a linked plugin that reports a malformed digest.
//  2. Run the real utility transform entrypoint.
//  3. Assert the path remains and its fingerprint is omitted.
func TestUtilityTransformOmitsInvalidLinkedHostInputHashes(t *testing.T) {
  resetLinkedPluginRegistry()
  root := t.TempDir()
  input := filepath.Join(root, "banner.config.cjs")
  driver.RegisterPlugin(invalidHostInputHashPlugin{input: input})
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": { "module": "commonjs", "target": "es2020" },
  "files": ["index.ts"]
}
`)
  writeProjectFile(t, root, "index.ts", "export const value = 1;\n")

  code, out, errOut := captureUtilityOutput(t, func() int {
    return utility.RunTransform([]string{
      "--cwd", root,
      "--plugins-json", `[{"name":"invalid","stage":"transform","config":{}}]`,
    })
  })
  if code != 0 || errOut != "" {
    t.Fatalf("RunTransform mismatch: code=%d stdout=%q stderr=%q", code, out, errOut)
  }
  var result utilityTransformResult
  if err := json.Unmarshal([]byte(strings.TrimSpace(out)), &result); err != nil {
    t.Fatal(err)
  }
  if len(result.HostInputs) != 1 || result.HostInputs[0] != input {
    t.Fatalf("host inputs mismatch: %#v", result.HostInputs)
  }
  if _, ok := result.HostInputHashes[input]; ok {
    t.Fatalf("invalid hash must be omitted: %#v", result.HostInputHashes)
  }
}
