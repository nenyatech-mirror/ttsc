package linthost

import "testing"

// TestFormatSemiKeepsCommaSeparatedMemberUntouched verifies a member the
// author separated with `,` is left alone while its bare sibling is
// terminated.
//
// TypeScript accepts `,` as a type-member separator and the parser folds
// it into the member's range exactly as it folds a `;`, so an insert that
// looked only at "no `;` here" would emit `alpha: number,;`. Rewriting the
// comma to a semicolon is Prettier's separator normalization, which no
// ttsc pass owns yet; this rule only supplies the terminator a member is
// missing.
//
//  1. Parse an interface whose first member ends with `,` and whose last
//     member ends bare.
//  2. Apply format/semi through the disk-backed fixer.
//  3. Assert the comma survives and only the bare member gains a `;`.
func TestFormatSemiKeepsCommaSeparatedMemberUntouched(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/semi",
    "interface Shape {\n  alpha: number,\n  bravo: string\n}\n",
    "interface Shape {\n  alpha: number,\n  bravo: string;\n}\n",
  )
}
