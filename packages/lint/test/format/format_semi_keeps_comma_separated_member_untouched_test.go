package linthost

import "testing"

// TestFormatSemiKeepsCommaSeparatedMemberUntouched verifies a member the
// author separated with `,` is left alone while its bare sibling is
// terminated.
//
// TypeScript accepts `,` as a type-member separator and the parser folds
// it into the member's range exactly as it folds a `;`, so an insert that
// looked only at "no `;` here" would emit `alpha: number,;`.
//
// Prettier 3.8.3 rewrites this input to `alpha: number;` and
// `bravo: string;`, so the expectation below is deliberately short of the
// oracle: normalizing an authored separator is a rewrite no ttsc pass
// owns, while supplying a missing terminator is this rule's. The half
// this rule owns still lands, and the result stays valid TypeScript,
// which accepts the two separators in one member list.
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
