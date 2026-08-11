package linthost

import (
  "path/filepath"
  "testing"

  shimchecker "github.com/microsoft/typescript-go/shim/checker"
)

// TestTypeInstantiationMappersReachRuntimeEndpoints is a shim-completeness
// probe, not a lint test: it runs a real Checker over a ttsc-owned fixture and
// asserts the newly exposed type-instantiation surface
// (Checker_instantiateType, Checker_newSimpleTypeMapper,
// Checker_combineTypeMappers) actually substitutes a generic class's type
// parameters at runtime.
//
// The closure auditor (tools/shim_audit) and the compile-time guards can only
// see whether a symbol is NAMEABLE or whether a composition COMPILES — never
// whether a traversal or substitution actually COMPLETES at runtime. A type
// transform plugin instantiates a generic class's constructor type with the
// reference's type arguments so a type parameter nested inside a container
// (`A[]`, `[A, B]`) is substituted for free; if the mapper helpers dead-end or
// the instantiation silently returns the unsubstituted type, the plugin's
// reflection output is wrong and no compile-time check catches it.
//
//  1. Compile a fixture with a generic class `Box<T>` and a reference
//     `Box<string>`.
//  2. Obtain the construct signature's type parameter and the reference's type
//     argument through the exposed shim surface.
//  3. Build a simple mapper, instantiate the constructor's return type, and
//     assert the type parameter is substituted for the concrete argument.
//  4. Combine two mappers and assert the merged mapper substitutes both pairs.
func TestTypeInstantiationMappersReachRuntimeEndpoints(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true,
    "rootDir": "src",
    "outDir": "dist"
  },
  "files": ["src/main.ts"]
}
`)
  writeFile(t, filepath.Join(root, "src", "main.ts"), `export class Box<T> {
  value!: T;
}
export class Pair<A, B> {
  first!: A;
  second!: B;
}
export class Holder {
  box!: Box<string>;
  pair!: Pair<number, boolean>;
}
`)

  prog, diags, err := loadProgram(root, "tsconfig.json", loadProgramOptions{
    needsRuleChecker: true,
  })
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected diagnostics: %#v", diags)
  }
  defer prog.close()

  if prog.checker == nil {
    t.Fatal("loadProgram did not acquire a checker")
  }

  // --- Single-pair mapper: Box<T> instantiated with string ---
  // Construct signatures live on the static (constructor) side of the class
  // symbol, so obtain them through getTypeOfSymbol, matching the existing
  // signature-introspection probe.
  boxType := shimchecker.Checker_getTypeOfSymbol(prog.checker, classSymbol(t, prog, "Box"))
  if boxType == nil {
    t.Fatal("Checker_getTypeOfSymbol returned nil for the Box class symbol")
  }
  boxCtor := shimchecker.Checker_getSignaturesOfType(prog.checker, boxType, shimchecker.SignatureKindConstruct)
  if len(boxCtor) != 1 {
    t.Fatalf("Box construct signatures = %d, want 1", len(boxCtor))
  }
  boxParams := boxCtor[0].TypeParameters()
  if len(boxParams) != 1 {
    t.Fatalf("Box type parameters = %d, want 1", len(boxParams))
  }

  // The reference Box<string> carries the concrete type argument. Obtain it
  // through the Holder.box property type (an instance member, so use the
  // declared instance type of Holder).
  holderType := shimchecker.Checker_getDeclaredTypeOfSymbol(prog.checker, classSymbol(t, prog, "Holder"))
  boxRef := shimchecker.Checker_getTypeOfPropertyOfType(prog.checker, holderType, "box")
  boxArgs := shimchecker.Checker_getTypeArguments(prog.checker, boxRef)
  if len(boxArgs) != 1 {
    t.Fatalf("Box<string> type arguments = %d, want 1", len(boxArgs))
  }

  mapper := shimchecker.Checker_newSimpleTypeMapper(boxParams[0], boxArgs[0])
  if mapper == nil {
    t.Fatal("Checker_newSimpleTypeMapper returned nil for a valid pair")
  }
  if mapper.Kind() != shimchecker.TypeMapperKindSimple {
    t.Fatalf("simple mapper kind = %v, want TypeMapperKindSimple", mapper.Kind())
  }

  // Instantiate the constructor's return type (Box<T>) and assert T -> string.
  boxCtorReturn := shimchecker.Checker_getReturnTypeOfSignature(prog.checker, boxCtor[0])
  instantiated := shimchecker.Checker_instantiateType(prog.checker, boxCtorReturn, mapper)
  if instantiated == nil {
    t.Fatal("Checker_instantiateType returned nil for a valid mapper")
  }
  if got := prog.checker.TypeToString(instantiated); got != "Box<string>" {
    t.Fatalf("instantiated Box<T> = %q, want %q", got, "Box<string>")
  }

  // --- Combined mapper: Pair<A, B> instantiated with number and boolean ---
  pairType := shimchecker.Checker_getTypeOfSymbol(prog.checker, classSymbol(t, prog, "Pair"))
  pairCtor := shimchecker.Checker_getSignaturesOfType(prog.checker, pairType, shimchecker.SignatureKindConstruct)
  if len(pairCtor) != 1 {
    t.Fatalf("Pair construct signatures = %d, want 1", len(pairCtor))
  }
  pairParams := pairCtor[0].TypeParameters()
  if len(pairParams) != 2 {
    t.Fatalf("Pair type parameters = %d, want 2", len(pairParams))
  }
  pairRef := shimchecker.Checker_getTypeOfPropertyOfType(prog.checker, holderType, "pair")
  pairArgs := shimchecker.Checker_getTypeArguments(prog.checker, pairRef)
  if len(pairArgs) != 2 {
    t.Fatalf("Pair<number, boolean> type arguments = %d, want 2", len(pairArgs))
  }

  m1 := shimchecker.Checker_newSimpleTypeMapper(pairParams[0], pairArgs[0])
  m2 := shimchecker.Checker_newSimpleTypeMapper(pairParams[1], pairArgs[1])
  merged := shimchecker.Checker_combineTypeMappers(prog.checker, m1, m2)
  if merged == nil {
    t.Fatal("Checker_combineTypeMappers returned nil for two valid mappers")
  }
  // combineTypeMappers builds a CompositeTypeMapper, whose Kind() reports
  // TypeMapperKindUnknown; the observable contract is that it substitutes both
  // pairs, which the instantiation below asserts.

  pairCtorReturn := shimchecker.Checker_getReturnTypeOfSignature(prog.checker, pairCtor[0])
  instantiatedPair := shimchecker.Checker_instantiateType(prog.checker, pairCtorReturn, merged)
  if instantiatedPair == nil {
    t.Fatal("Checker_instantiateType returned nil for the merged mapper")
  }
  if got := prog.checker.TypeToString(instantiatedPair); got != "Pair<number, boolean>" {
    t.Fatalf("instantiated Pair<A, B> = %q, want %q", got, "Pair<number, boolean>")
  }
}
