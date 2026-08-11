package linthost

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimscanner "github.com/microsoft/typescript-go/shim/scanner"
)

// formatSemi controls trailing-semicolon style on ASI statements.
// Mirrors prettier's `semi` option:
//
//   - `prefer: "always"` (default) inserts a missing terminator.
//   - `prefer: "never"`  strips a trailing terminator from the same
//     statement kinds.
//
// The rule scans only statement kinds where TypeScript inserts an
// optional semicolon. Body-shaped declarations (functions, classes,
// namespaces, enums) and control-flow statements (if/for/while/try)
// are out of scope because they parse correctly without a terminator.
//
// Interface, type-literal, and class members do not take the statement
// path. Both directions route through member-specific code
// (stripMemberSemicolon, insertMemberSemicolon) that reads the written
// line structure and the list's own wrap rather than the member kind,
// because Prettier prints a member's `;` between two members in either
// layout and after the last one only where the list breaks.
//
// One consequence is worth stating rather than leaving to be inferred: a
// type member of a body still written on one line is never terminated, so
// `interface D { (a: number): void }` keeps its bare call signature.
// Prettier reaches its own terminator by breaking the body first, and
// breaking it is format/indent's decision, which today covers property,
// method, and index signatures but not a call or construct signature.
// Terminating a one-line member here instead would be a layout decision
// this rule does not own, and would emit a shape Prettier never does.
type formatSemi struct{ optionsRule }

// formatSemiOptions is the Go mirror of `TtscLintRuleOptions.Semi`. The
// JSON tag matches the TypeScript field name so users get the same key
// in both layers.
type formatSemiOptions struct {
  Prefer string `json:"prefer"`
}

func (formatSemi) Name() string   { return "format/semi" }
func (formatSemi) IsFormat() bool { return true }

func (formatSemi) Visits() []shimast.Kind {
  return []shimast.Kind{
    shimast.KindVariableStatement,
    shimast.KindExpressionStatement,
    shimast.KindReturnStatement,
    shimast.KindThrowStatement,
    shimast.KindBreakStatement,
    shimast.KindContinueStatement,
    shimast.KindDoStatement,
    shimast.KindDebuggerStatement,
    shimast.KindImportDeclaration,
    shimast.KindImportEqualsDeclaration,
    shimast.KindExportDeclaration,
    shimast.KindExportAssignment,
    shimast.KindPropertyDeclaration,
    shimast.KindTypeAliasDeclaration,
    // Interface / type-literal members, plus the class-member spellings
    // the accessor and index-signature kinds share. Prettier's `;` here
    // is a separator between two members and a trailing terminator only
    // where the list breaks; see stripMemberSemicolon and
    // insertMemberSemicolon for the per-direction rules.
    shimast.KindPropertySignature,
    shimast.KindMethodSignature,
    shimast.KindIndexSignature,
    shimast.KindCallSignature,
    shimast.KindConstructSignature,
    shimast.KindGetAccessor,
    shimast.KindSetAccessor,
  }
}

func (formatSemi) Check(ctx *Context, node *shimast.Node) {
  if ctx == nil || ctx.File == nil || node == nil {
    return
  }
  var opts formatSemiOptions
  _ = ctx.DecodeOptions(&opts)
  preferNever := opts.Prefer == "never"

  src := ctx.File.Text()
  end := node.End()
  if end <= 0 || end > len(src) {
    return
  }
  // Interface / type-literal members and class fields carry their own
  // ASI rules, distinct from top-level statements, so each direction
  // routes through a dedicated member path. A class field keeps its
  // existing always-direction insertion by falling through to the
  // statement branch below: its body always breaks in Prettier, so it
  // needs no line-structure test.
  isClassField := node.Kind == shimast.KindPropertyDeclaration
  isTypeMember := isTypeMemberKind(node.Kind)
  if preferNever && (isClassField || isTypeMember) {
    stripMemberSemicolon(ctx, src, node, isClassField)
    return
  }
  if isTypeMember {
    insertMemberSemicolon(ctx, src, node, end)
    return
  }
  hasSemi := src[end-1] == ';'
  if preferNever {
    if !hasSemi {
      return
    }
    if !preferNeverSafeKind(node.Kind) {
      // Dropping the `;` after a class field or a type alias can
      // change parse, e.g. `class A { x: number; [k](): void {} }`
      // would reparse `[k]` as a computed index access on `number`.
      // Keep the terminator on those kinds even in prefer:"never"
      // mode.
      return
    }
    if nextStatementHasASIHazard(src, end) {
      // Stripping `;` here would let ASI fail. Prettier defends with a
      // leading-`;` on the next statement; this rule conservatively
      // refuses to strip rather than synthesizing an edit on a node
      // it didn't visit.
      return
    }
    pos := end - 1
    if pos < 0 {
      pos = 0
    }
    ctx.ReportRangeFix(
      pos,
      end,
      "Unexpected trailing semicolon.",
      TextEdit{Pos: end - 1, End: end, Text: ""},
    )
    return
  }
  if hasSemi {
    return
  }
  // Diagnostic anchors on the last character of the statement so the
  // banner underlines "the place a semicolon should follow". The fix
  // itself is a zero-width insertion at node.End(), keeping the edit
  // disjoint from any other rule's edits on the same statement.
  pos := end - 1
  if pos < 0 {
    pos = 0
  }
  ctx.ReportRangeFix(
    pos,
    end,
    "Missing semicolon.",
    TextEdit{Pos: end, End: end, Text: ";"},
  )
}

// nextStatementHasASIHazard reports whether removing the trailing `;`
// at `end-1` could change the parse, judged by the next significant
// byte after `end` and the line structure between them.
//
// ASI only inserts a semicolon at a line terminator, end of input, or
// before `}`. So the `;` is removable in exactly two shapes:
//
//   - end of input or a same-line `}` follows (ASI's closing-brace and
//     end-of-input rules apply), or
//   - a line terminator separates the statement from the next token AND
//     that token is not a continuation hazard.
//
// Any other same-line successor (`else`, `while` of a do-loop, another
// statement after a gap comment) makes the `;` a REQUIRED separator:
// no line terminator means ASI cannot fire, so stripping would be a
// syntax error, not a style change.
//
// Hazard tokens per the ASI spec:
//
//   - `[`: bracket access continues an expression
//   - `(`: call expression continues
//   - “ ` “: tagged template literal continues
//   - `+`, `-`, `*`: binary operator continues
//   - `,`: comma operator continues
//   - `/`: division operator or regex literal continues (a leading `//`
//     or `/*` is trivia consumed by scanPastTrivia; a bare `/` is a
//     hazard).
func nextStatementHasASIHazard(src string, end int) bool {
  i, sawNewline := scanPastTrivia(src, end)
  if i >= len(src) {
    return false
  }
  c := src[i]
  if c == '}' {
    // ASI applies before a closing brace regardless of line
    // structure: `{ a(); }` → `{ a() }` stays valid.
    return false
  }
  if !sawNewline {
    // Next token on the same line: ASI cannot fire without a line
    // terminator, so the `;` separates the two constructs
    // (`if (a) b(); else c();`, `do f(); while (x);`,
    // `a = 1; /* note */ b = 2`). Keep it.
    return true
  }
  if c == '/' {
    // bare `/` starts a regex literal or division, hazard.
    return true
  }
  switch c {
  // If the next significant byte is one of these, dropping the terminator
  // could let the following line re-associate with the prior expression.
  // `( [`, a unary `+ -`, and a tagged-template backtick are the cases
  // actually reachable from a valid statement start; `<` matters in .tsx
  // (a leading `<` opens a JSX element). The remaining infix bytes cannot
  // begin a valid statement on their own, but are listed defensively so
  // the strip always cedes rather than risk a parse-changing edit.
  case '[', '(', '`', '+', '-', '*', ',', '.', '<', '>', '=', '?', '%', '&', '|', '^':
    return true
  }
  return false
}

// scanPastTrivia advances from `pos` past whitespace and comments,
// returning the index of the next significant byte (len(src) at end of
// input) and whether a line terminator was crossed on the way. Both
// semicolon scanners (statement and member) share it so the ASI line
// rules cannot drift apart.
//
// A block comment that spans lines counts as a crossed line: per
// ECMA-262 (Comments), a multi-line comment containing a line
// terminator is treated as a line terminator for ASI, so the decision
// keys on comment content, not comment kind. `\r` counts as a line
// terminator on its own, which also covers CRLF sources.
func scanPastTrivia(src string, pos int) (next int, sawNewline bool) {
  i := pos
  for i < len(src) {
    c := src[i]
    if c == '\n' || c == '\r' {
      sawNewline = true
      i++
      continue
    }
    if c == ' ' || c == '\t' {
      i++
      continue
    }
    if c == '/' && i+1 < len(src) {
      if src[i+1] == '/' {
        for i < len(src) && src[i] != '\n' && src[i] != '\r' {
          i++
        }
        continue
      }
      if src[i+1] == '*' {
        i += 2
        for i+1 < len(src) && !(src[i] == '*' && src[i+1] == '/') {
          if src[i] == '\n' || src[i] == '\r' {
            sawNewline = true
          }
          i++
        }
        if i+1 < len(src) {
          i += 2 // step past '*/'
        } else {
          i = len(src) // unterminated block comment swallows the rest
        }
        continue
      }
    }
    return i, sawNewline
  }
  return len(src), sawNewline
}

// preferNeverSafeKind reports whether stripping the trailing semicolon
// is safe for `kind`. Statement kinds end at a line break or `}` in
// practice; declaration-style kinds (PropertyDeclaration,
// TypeAliasDeclaration) live next to other class/module members where
// the explicit terminator disambiguates the next token. The
// prefer:"never" branch refuses to touch those.
func preferNeverSafeKind(kind shimast.Kind) bool {
  switch kind {
  case
    shimast.KindVariableStatement,
    shimast.KindExpressionStatement,
    shimast.KindReturnStatement,
    shimast.KindThrowStatement,
    shimast.KindBreakStatement,
    shimast.KindContinueStatement,
    shimast.KindDoStatement,
    shimast.KindDebuggerStatement,
    shimast.KindImportDeclaration,
    shimast.KindImportEqualsDeclaration,
    shimast.KindExportDeclaration,
    shimast.KindExportAssignment,
    // `type T = …;` is a statement-position declaration; Prettier drops
    // its terminator under semi:false. The nextStatementHasASIHazard
    // guard keeps it whenever removal would let ASI mis-associate the
    // following statement (e.g. a leading `(`/`[`).
    shimast.KindTypeAliasDeclaration:
    return true
  }
  return false
}

// isTypeMemberKind reports whether `kind` is an interface or
// object-type-literal member: the kinds whose trailing `;` Prettier
// strips under semi:false and inserts under semi:true.
//
// All seven take the same answer in both directions, which is measured
// rather than assumed from symmetry. The `format/semi` conformance cases
// run a property, method, index, call, and construct signature plus both
// accessors through pinned Prettier 3.8.3, and every one of them comes
// back terminated once its body is broken across lines.
// GetAccessor and SetAccessor also spell a class or object-literal
// accessor, which is not a type member at all; the context test in
// memberTakesSemicolonTerminator, not this predicate, separates those.
//
// Class fields (KindPropertyDeclaration) are handled separately because
// their initializer is an expression and so they carry the full
// expression-ASI hazard set, while type members only risk a
// call/construct-signature (`(`) or generic-call-signature (`<`)
// continuation.
func isTypeMemberKind(kind shimast.Kind) bool {
  switch kind {
  case
    shimast.KindPropertySignature,
    shimast.KindMethodSignature,
    shimast.KindIndexSignature,
    shimast.KindCallSignature,
    shimast.KindConstructSignature,
    shimast.KindGetAccessor,
    shimast.KindSetAccessor:
    return true
  }
  return false
}

// stripMemberSemicolon removes a redundant trailing `;` from an
// interface / type-literal member or a class field under semi:false.
//
// The member-terminating `;` is located robustly. typescript-go consumes
// it as a separate token before closing the node (parseTypeMemberSemicolon
// and parseSemicolonAfterPropertyName both run ahead of finishNode), so
// End() normally sits just past it; an error-recovery path that returns
// without consuming leaves it outside instead. Accept either a `;`
// already at End()-1 or the first `;` reached scanning horizontal
// whitespace forward from End().
//
// The `;` is dropped only when it is redundant, see
// memberSemicolonRedundant, so single-line separators stay intact and
// ASI-hazardous continuations keep their terminator. Idempotent: once
// removed, no `;` remains for the rule to act on.
func stripMemberSemicolon(ctx *Context, src string, node *shimast.Node, isClassField bool) {
  end := node.End()
  semiPos := -1
  if end-1 >= 0 && src[end-1] == ';' {
    semiPos = end - 1
  } else {
    i := end
    for i < len(src) && (src[i] == ' ' || src[i] == '\t') {
      i++
    }
    if i < len(src) && src[i] == ';' {
      semiPos = i
    }
  }
  if semiPos < 0 {
    return
  }
  if !memberSemicolonRedundant(src, semiPos+1, isClassField) {
    return
  }
  ctx.ReportRangeFix(
    semiPos,
    semiPos+1,
    "Unexpected trailing semicolon.",
    TextEdit{Pos: semiPos, End: semiPos + 1, Text: ""},
  )
}

// memberSemicolonRedundant reports whether the member terminator `;`
// whose following byte is at `after` can be dropped without changing the
// parse. It scans past trivia (whitespace + comments, via
// scanPastTrivia) to the next significant byte and applies Prettier's
// semi:false member rules:
//
//   - The closing `}` (or end of file) always makes the `;` redundant.
//   - A next member on the SAME line (no newline crossed) keeps the `;`
//     as a required separator, the rule never inserts the newline that
//     would let ASI take over, so dropping it here would corrupt the
//     source.
//   - A newline-separated next member drops the `;` unless its lead token
//     would re-associate with the prior member: the full expression-ASI
//     hazard set for class fields (`[ ( ` + - * / ,`), or just a
//     call/construct/generic signature (`(` / `<`) for type members
//     (a leading `[` is an index signature there, not a continuation).
func memberSemicolonRedundant(src string, after int, isClassField bool) bool {
  i, sawNewline := scanPastTrivia(src, after)
  if i >= len(src) {
    return true
  }
  c := src[i]
  if c == '}' {
    return true
  }
  if !sawNewline {
    return false
  }
  if isClassField {
    switch c {
    case '[', '(', '`', '+', '-', '*', '/', ',':
      return false
    }
  } else {
    switch c {
    case '(', '<':
      return false
    }
  }
  return true
}

// insertMemberSemicolon appends the `;` Prettier prints after an
// interface, type-literal, or class member that ends its physical line.
//
// A member's `;` plays two roles in Prettier's object printer, and the
// insert answers them separately:
//
//   - BETWEEN two members it is a separator, printed in both layouts. So
//     a member with another member below it takes the `;` whether or not
//     the list ends up broken.
//   - AFTER the last member it is a trailing terminator, printed inside
//     an `ifBreak` and therefore only when the list breaks. That is why
//     `type T = { a: number }` is Prettier's own output for that input,
//     and why memberListBreaks decides this case rather than the line
//     structure at the member itself.
//
// Both roles need the member to end its line: a `;` the author did not
// write between two same-line members is one Prettier would print only
// after inserting the line break this rule never inserts.
//
// memberSemicolonRedundant reads the same oracle rule from the other end,
// which is why the two are complementary rather than opposite: a `;`
// before a same-line `}` closes a flat list, where Prettier prints no
// trailing separator at all, so the strip drops it and this never adds
// one back.
//
// The edit is a zero-width insertion at the member's End(), so it stays
// disjoint from the format/statement-split, format/indent, and
// format/print-width edits that may land on the same lines; the applier
// keeps one finding per contested range, so an overlap would cost a whole
// cascade pass. It cannot change the parse either: the parser already
// ended the member at that offset (parseTypeMemberSemicolon runs before
// finishNode), so the inserted `;` only spells out a boundary the parse
// had already made.
//
// Idempotent: a re-parse folds the inserted `;` into the member's range,
// so the next pass reads it at End()-1 and abstains.
func insertMemberSemicolon(ctx *Context, src string, node *shimast.Node, end int) {
  if !memberTakesSemicolonTerminator(node) {
    return
  }
  switch src[end-1] {
  case ';':
    // Already terminated. Also the idempotency guard.
    return
  case ',':
    // TypeScript accepts `,` as a member separator and the parser folds
    // it into the member exactly as it folds a `;`. Prettier rewrites
    // such a separator to `;`, but that normalization belongs to whoever
    // owns the separator rather than to the terminator rule; appending
    // here would emit `a: number,;`.
    return
  }
  // Trivia is crossed with scanPastTrivia, so a trailing line comment and
  // a block comment carrying a line terminator both count as the break
  // ECMA-262 says they are, and both member scanners keep one notion of
  // "a line was crossed". Reaching end of input means the body has no
  // closing `}`; that source is too broken to reason about, so abstain.
  next, sawNewline := scanPastTrivia(src, end)
  if next >= len(src) || !sawNewline {
    return
  }
  // The list's `}` is the only thing that can follow the last member, so
  // this is the trailing-terminator case and the list has to be one
  // Prettier breaks.
  if src[next] == '}' && !memberListBreaks(src, node.Parent) {
    return
  }
  // Anchored on the member's last character for the same reason the
  // statement branch is: the banner underlines "the place a semicolon
  // should follow", while the fix stays zero-width at End().
  ctx.ReportRangeFix(
    end-1,
    end,
    "Missing semicolon.",
    TextEdit{Pos: end, End: end, Text: ";"},
  )
}

// memberTakesSemicolonTerminator reports whether Prettier terminates
// `node` with a `;` at all. It decides on the member's own shape and on
// the member list holding it, not on its kind, because one kind spells
// members of both a `;`-separated and a `,`-separated list:
//
//   - A member carrying a body ends in `}`, and Prettier never follows a
//     braced member with a terminator. The reachable case is an accessor:
//     GetAccessor and SetAccessor spell both a bodiless interface
//     accessor and a class accessor with a body.
//   - Interface and type-literal bodies are `;`-separated. So is a class
//     body, whose index signatures and bodiless (`declare` / `abstract`)
//     accessors take the same terminator as their type-member spellings,
//     and are broken onto their own lines by the same format/indent pass.
//   - An object literal is `,`-separated. Its accessors arrive here as
//     the same two kinds, and a `;` after one is a syntax error.
func memberTakesSemicolonTerminator(node *shimast.Node) bool {
  if node.Body() != nil {
    return false
  }
  parent := node.Parent
  if parent == nil {
    return false
  }
  switch parent.Kind {
  case shimast.KindInterfaceDeclaration,
    shimast.KindTypeLiteral,
    shimast.KindClassDeclaration,
    shimast.KindClassExpression:
    return true
  }
  return false
}

// memberListBreaks reports whether Prettier lays `parent`'s member list
// out across lines. Only the last member has to ask: its `;` is the
// trailing terminator Prettier prints inside an `ifBreak`, while the `;`
// between two members is printed in either layout.
//
// The caller has already narrowed `parent` to the four `;`-separated
// owners. Three of them are an interface body or a class body, which
// always break once they hold a member, so the source's own line structure
// does not enter into it.
//
// An object type is the exception: it preserves the author's wrap
// (Prettier's `objectWrap: "preserve"`), breaking when a line terminator
// separates its `{` from the first member and otherwise staying on one
// line however the source placed the closing `}`. Prettier 3.8.3 returns
// `type T = { a: number\n};` as the one-line `type T = { a: number };`,
// with nothing after `number`, so reading where the `}` landed would
// insert a `;` the oracle never prints.
//
// The width half of Prettier's break decision (a flat list that overflows
// its budget breaks) is deliberately absent: no ttsc pass reflows an
// object type, so a flat one stays flat and a trailing terminator would be
// one this formatter's own output never justifies. A pass that ever breaks
// them writes the line terminator this reads.
func memberListBreaks(src string, parent *shimast.Node) bool {
  if parent == nil {
    return false
  }
  if parent.Kind != shimast.KindTypeLiteral {
    return true
  }
  open := shimscanner.SkipTrivia(src, parent.Pos())
  if open < 0 || open >= len(src) || src[open] != '{' {
    // Not the shape this reads. Keep the author's bytes.
    return false
  }
  _, sawNewline := scanPastTrivia(src, open+1)
  return sawNewline
}

func init() {
  Register(formatSemi{})
}
