package banner_test

import (
  "path/filepath"
  "testing"
)

// TestResolveConfigTsgoResolvesTheProjectCompilerWithoutTheEnvironment verifies
// @ttsc/banner's config evaluator finds its compiler in the project being
// compiled.
//
// The evaluator used to read TTSC_TSGO_BINARY and nothing else, so it worked
// only by inheritance from a `ttsx`-launched host: the shipped `ttscserver`
// binary invoked with `--tsgo <path>` exports nothing, and evaluation aborted
// with `ttsc: typescript is required` before a line of the config was read.
// The case sheds both variables first, because the Go runners hand `go test`
// an environment that already carries them and that is exactly what masked the
// defect.
//
//  1. Seed a project holding `typescript` and its platform package.
//  2. Shed TTSC_TSGO_BINARY and TTSC_TTSX_BINARY.
//  3. Assert the resolution names the project's own `lib/tsc`.
func TestResolveConfigTsgoResolvesTheProjectCompilerWithoutTheEnvironment(t *testing.T) {
  shedConfigToolEnvironment(t)
  root := bannerRealpathIfPossible(t.TempDir())
  want := seedProjectTypeScript(t, root)
  config := filepath.Join(root, "banner.config.ts")
  writeFile(t, config, "export default { text: \"from ts\" };\n")

  if got := bannerResolveConfigTsgo(bannerConfigToolAnchors(config, root)); got != want {
    t.Fatalf("resolveConfigTsgo = %q, want the project compiler %q", got, want)
  }
}
