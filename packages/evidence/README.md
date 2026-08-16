# `@ttsc/evidence`

![banner of @ttsc/evidence](https://ttsc.dev/og-evidence.png)

[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/samchon/ttsc/blob/master/LICENSE) [![NPM Version](https://img.shields.io/npm/v/@ttsc/evidence.svg)](https://www.npmjs.com/package/@ttsc/evidence) [![NPM Downloads](https://img.shields.io/npm/dm/@ttsc/evidence.svg)](https://www.npmjs.com/package/@ttsc/evidence) [![Build Status](https://github.com/samchon/ttsc/actions/workflows/build.yml/badge.svg)](https://github.com/samchon/ttsc/actions/workflows/build.yml) [![Guide Documents](https://img.shields.io/badge/Guide-Documents-forestgreen)](https://ttsc.dev/docs/evidence) [![Discord Badge](https://img.shields.io/badge/discord-samchon-d91965?style=flat&labelColor=5866f2&logo=discord&logoColor=white&link=https://discord.gg/E94XhzrUCZ)](https://discord.gg/E94XhzrUCZ)

Evidence Graph, your spec as a compile error no coding agent can skip.

```tsx
/**
 * @evidence docs/discount.md#coupon-stacking
 *           States the per-issuer stacking limit
 *           this section defines, in the buyer's words.
 * @evidence POST:/orders/{orderId}/coupons
 *           Explains the rejection this endpoint returns
 *           for an over-stacked coupon set.
 * @evidence {@link hooks.useCouponStacking} Renders the limit this hook resolves.
 */
export function CouponStackingNotice(props: IProps): JSX.Element;
```

`@evidence <target> <reason>` names one unit of the spec and why this declaration answers for it. A target is a document section, an API operation, a database schema model, or a TypeScript symbol as an inline link.

```bash
$ npx ttsc
error TS16411: [evidence/graph] Missing acknowledgement for 'docs/discount.md#coupon-stacking'
  (Markdown H2 'Coupon Stacking' at docs/discount.md:3)
  in Claim 1 reference 1 (markdown, symbols: h2, h3).

  Cite the artifact that answers for this unit with @evidence on a selected
  typescript host, building that artifact first when none does, or write
  @evidenceExclude on an eligible carrier when nothing here owes it. Never
  leave an untrue tag standing just to pass this check; it removes the error,
  not the problem.

...

Found 3 errors.
```

Without those tags, the build fails once per obligation, because one reference never covers another. The endpoint and the hook above raise their own errors in the same shape.

An AI coding agent has to clear them to finish, and clearing them means citing each target and writing down why its code answers for it. Coverage reaches 100% on its own, as the residue of the errors it closed.

![Coverage and token spend across all four subjects](https://raw.githubusercontent.com/samchon/ttsc/gh-pages/benchmark/png/evidence-summary.png)

One coding engine built the same four applications twice from the same frozen requirements, once with the graph in the workspace and once without.

Both arms reviewed the same way, by loop: read the codebase, fix every finding, restart, and stop after a round comes back empty. That loop finds most of what it will ever find in its first rounds and never counts what it did not look at, so it settles on a ceiling that drops as the project grows. On the ERP subject it took nine of every ten tokens the run spent, 5,449M in total, and stopped at 51.6% of the requirements. The other arm finished the same subject at 100% on 411M tokens, because the build does not complete while an obligation is open.

## Setup

### Install

```bash
npm install -D typescript ttsc @ttsc/lint
npm install -D @ttsc/evidence
```

This is a rule contributor to [`@ttsc/lint`](https://github.com/samchon/ttsc/tree/master/packages/lint) 0.22 or newer, so it runs on [`ttsc`](https://github.com/samchon/ttsc) rather than on stock `tsc` with ESLint.

### Configure

```ts
// lint.config.ts
import { evidence, type ITtscEvidenceGraphConfig } from "@ttsc/evidence";
import type { ITtscLintConfig } from "@ttsc/lint";

const graph: ITtscEvidenceGraphConfig = {
  claims: [
    {
      type: "typescript",
      files: ["src/components/**/*.tsx"],
      symbol: "function",
      reference: {
        type: "markdown",
        files: ["docs/**/*.md"],
        symbol: ["h2", "h3"],
      },
    },
  ],
};

export default {
  plugins: { evidence },
  rules: { "evidence/graph": ["error", graph] },
} satisfies ITtscLintConfig;
```

One sentence: the components under `src` implement the docs, so every H2 and H3 under `docs` must be cited by a component. Run `npx ttsc` and the error count is the backlog. Violations arrive in the same stream as type errors, so there is no CI job to add.

### Rules

| Rule | Takes | What it does |
| --- | --- | --- |
| `evidence/graph` | [`ITtscEvidenceGraphConfig`](https://github.com/samchon/ttsc/blob/master/packages/evidence/src/structures/ITtscEvidenceGraphConfig.ts) | The graph itself. Project-scoped, so its entry declares no `files`. |
| `evidence/documented` | [`ITtscEvidenceDocumentedConfig`](https://github.com/samchon/ttsc/blob/master/packages/evidence/src/structures/ITtscEvidenceDocumentedConfig.ts) | Requires a JSDoc block on every selected export, since a block is the only place a citation can live. Members count, so a class field, a method, a parameter property, and an interface member each need their own. |
| `evidence/singular` | nothing | Keeps one public identity per file, named after the file. |
| `evidence/todo` | nothing | Fails on every remaining JSDoc `@todo`, with its own text. |
| `evidence/review` | nothing | Requires an `@evidenceReview` beside every `@evidence` and an `@evidenceExcludeReview` beside every `@evidenceExclude`, naming the same target and stating what was checked. |

Each takes `"error"`, `"warning"`, or `"off"`.

## Graphs in practice

Every arrow points at the evidence it cites, so it runs from the artifact that owes to the artifact that grounds it.

### Documents

<picture><source media="(prefers-color-scheme: dark)" srcset="https://ttsc.dev/evidence/documents-dark.svg"><img alt="Idea notes grounding Requirements and Specifications, which ground Implementation and Test" src="https://ttsc.dev/evidence/documents-light.svg" width="100%"></picture>

Each edge closes an omission nothing else catches. A decision taken in a meeting and never written into the requirements. A specification nobody asked for. A requirement the documents state and no code implements. A feature implemented and never verified.

Humans own one layer and delegate the rest. Hand over the requirements and the agent writes the specifications below them; hand over raw idea notes and it writes the requirements too, with the build breaking the moment anything in those notes goes missing.

### Backend

<picture><source media="(prefers-color-scheme: dark)" srcset="https://ttsc.dev/evidence/backend-dark.svg"><img alt="Requirements and Specifications grounding DB schema, API operation, API schema and Test" src="https://ttsc.dev/evidence/backend-light.svg" width="100%"></picture>

A table nobody asked for has nothing to cite. An endpoint with no model behind it fails against the schema. An operation the documents describe and nobody implemented is a compile error on the next build, and so is one that no test answers for.

### Frontend

<picture><source media="(prefers-color-scheme: dark)" srcset="https://ttsc.dev/evidence/frontend-dark.svg"><img alt="Requirements and Specifications grounding Swagger, Hooks, Screens and Journeys" src="https://ttsc.dev/evidence/frontend-light.svg" width="100%"></picture>

The Swagger document is the backend's own output, so the frontend graph starts from an artifact another project publishes. An operation no hook calls, a hook no screen renders, and a screen no journey reaches are each an open obligation rather than a diff nobody read.

### Beyond code

<picture><source media="(prefers-color-scheme: dark)" srcset="https://ttsc.dev/evidence/novel-dark.svg"><img alt="Principles and Settings grounding Storylines, Scenarios and Manuscripts" src="https://ttsc.dev/evidence/novel-light.svg" width="100%"></picture>

The graph never reads meaning, only obligations and citations, so the same rules hold wherever the artifacts are text. In a novel the edges block a scene that drifts from the work's purpose, a character who uses knowledge they never learned, a consequence with no cause, and a manuscript that departs from the scene it was supposed to execute. [`samchon/novels`](https://github.com/samchon/novels) runs one on 25 principles, 350 setting commitments, and 742 scenes.

## Claims and references

A claim is the population that owes a citation, a reference is what it owes, and every claim and reference pair is its own 100% obligation. Listing two references means both must be satisfied, and a citation toward one never counts toward the other. They all join the same `claims` array.

| Kind | Units | Claim | Reference | Cites in |
| --- | --- | --- | --- | --- |
| Markdown | file, H1 to H4 sections | yes | yes | an HTML comment |
| Prisma | model, column, relation | yes | yes | a `///` comment |
| TypeScript | types, functions, properties | yes | yes | JSDoc |
| Swagger / OpenAPI | each operation under `paths` | no | yes | nothing, it cannot host a tag |

Every population takes glob patterns in `files`, resolved against the `ttsc` project root. Add `root` to resolve against another directory instead, which is how several packages in a monorepo share one requirements set.

### Documents

```ts
{
  type: "markdown",
  files: ["docs/requirements/**/*.md"],
  reference: {
    type: "markdown",
    files: ["docs/meetings/**/*.md"],
    symbol: ["h2", "h3"],
  },
}
```

```md
## Coupon Stacking {#coupon-stacking}

<!-- @evidence docs/meetings/2026-01-12.md#discount-policy Carries the limit agreed in that meeting. -->
```

A citation sits in an HTML comment, so rendered prose stays clean, and a heading declares its own anchor with the `{#id}` suffix. A section citation sits under its heading, a whole-file citation sits at the top.

### Database schema

```ts
{
  type: "prisma",
  files: ["prisma/schema/**/*.prisma"],
  symbol: "model",
  reference: {
    type: "markdown",
    files: ["docs/requirements/**/*.md"],
    symbol: "h2",
  },
}
```

```prisma
/// @evidence docs/requirements/pricing.md#discount-policy Discount columns exist for this policy.
model Sale {
  /// @evidence docs/requirements/pricing.md#coupon-stacking The stacking limit is stored here.
  coupon_limit Int
}
```

A model is addressed as `prisma:Sale` and a member as `prisma:Sale.price`, never through the file it sits in, so moving a model between files cannot break a citation. Every matched file is parsed as one schema.

### API operations

```ts
{
  type: "typescript",
  files: ["src/controllers/**/*.ts"],
  reference: {
    type: "swagger",
    file: "https://raw.githubusercontent.com/samchon/shopping/refs/heads/master/packages/api/swagger.json",
  },
}
```

An operation is cited as `POST:/orders`, one whitespace-free token, so the method and the path stay one target. The singular `file` names one local path or one `http:` URL, never a glob; use a `reference` array for several documents.

### Symbols

```ts
{
  type: "typescript",
  files: ["src/lib/*/hooks.ts"],
  symbol: "function",
  reference: {
    type: "typescript",
    package: "@ORGANIZATION/PROJECT-api",
    files: ["src/functional/**/*.ts"],
    symbol: ["function"],
  },
}
```

`files` selects modules and the population is what those modules publish, so a barrel carries in the surface it forwards. A unit is addressed the way a consumer reaches it, so `export * as functional` nests a segment and `export { A as B }` answers to `B`.

A `package` population is read from disk rather than from the program, because a symbol nothing imports is absent from the program and is exactly the one an obligation needs to name. Only TypeScript may cite TypeScript, since `{@link}` resolves through the citing module's own imports and no document has an import scope to resolve in.

### Symbol selectors

`symbol` picks which units a reference materializes, and on a claim it restricts which declarations may host a tag.

| Kind | Values | Default on a claim | Default on a reference |
| --- | --- | --- | --- |
| Markdown | `file`, `h1`, `h2`, `h3`, `h4` | all five | all five |
| Prisma | `model`, `column`, `relation` | all three | `model` |
| TypeScript | `type`, `function`, `property` | all three | `type` |
| Swagger | none, every operation is selected | not applicable | every operation |

Units keep their hierarchy, so a target acknowledges itself and every selected descendant: citing a heading covers its subsections, an interface or a class covers the members it declares, and `prisma:Sale` covers the columns beneath it. An ancestor stays addressable even when its own kind is not selected.

A class is a `type`, its methods are `function`, and its fields are `property`. A member written as a callable joins the methods, so `handler = () => {}` and `charge: () => void` are both `function`. The test is on how the member is written rather than on what its type resolves to, because this rule reads no type checker. Private and protected members materialize no unit, and a declaration documented with `@internal`, `@hidden`, or `@ignore` leaves the population entirely. [The guide](https://ttsc.dev/docs/evidence/claims) has the rest, including parameter properties and overloads.

### Reviews

```ts
/**
 * @evidence docs/discount.md#coupon-stacking States the per-issuer limit.
 * @evidenceReview docs/discount.md#coupon-stacking #a1b2c3d4e5f6
 *                 Verified against policy section 3.
 */
```

100% coverage is not 100% truth. An inexpensive model sometimes writes a reason for a fact the cited section never states, and an untrue tag removes the error rather than the problem, so the tag list is what a human reads instead of the codebase. A review names the same declaration and target as the citation it answers, and it carries a fingerprint of the cited content, so editing that content expires the review and asks for it again.

### Exclusions

```md
<!-- @evidenceExclude docs/requirements/pricing.md#coupon-stacking
     This release ships a single coupon. Stacking waits for the settlement policy. -->
```

`@evidenceExclude <target> <reason>` records that a claim intentionally does not use a scope. It follows the same hierarchy as `@evidence`, affects only the claim it is written in, and one obligation may exclude a scope only once.

It is the only acknowledgement that settles an obligation without anything being built, so it exists to be vetoed. "Not applicable" is a conclusion rather than a reason.

```ts
{
  type: "typescript",
  files: ["src/components/**/*.tsx", "src/components/EXCLUSIONS.ts"],
  evidenceExcludeCarriers: ["src/components/EXCLUSIONS.ts"],
  symbol: "function",
  reference: { type: "markdown", files: ["docs/**/*.md"], symbol: "h2" },
}
```

`evidenceExcludeCarriers` confines them to a named ledger, so reviewing every exclusion means opening one file rather than reading the population. An exclusion written anywhere else is reported where it sits and discharges nothing.

### Strict references

Ordinary coverage is permissive, which is right for a document several modules honor and too weak for a proof obligation, where one exclusion or one host citing everything discharges the whole population. Four properties tighten a single reference, and they never pool across references.

| Property | Effect |
| --- | --- |
| `noEvidenceExclude` | Refuses exclusions, so the target still owes positive evidence. A published accessor no hook consumes is an omission rather than a decision. |
| `uniqueEvidence` | Allows at most one host per unit, so one host is answerable for it rather than several. |
| `singleEvidencePerSymbol` | Requires exactly one unit from every selected host, so a host citing nothing and a host citing everything both fail. |
| `requireReview` | Makes every acknowledgement owe a matching review carrying a fingerprint of the cited content, so the review fails again once that content changes. |

```ts
{
  type: "typescript",
  package: "@ORGANIZATION/PROJECT-api",
  files: ["src/functional/**/*.ts"],
  symbol: ["function"],
  noEvidenceExclude: true,
  singleEvidencePerSymbol: true,
}
```

Counting is by identity rather than by text. Repeated tags for one unit count once, an overload set stays one host, and citing a parent of two selected units counts as two.

## Sponsors

[![Sponsors](https://raw.githubusercontent.com/samchon/sponsor-images/refs/heads/master/public/circle.svg)](https://github.com/sponsors/samchon)

Thanks for your support.

Your [donation](https://github.com/sponsors/samchon) encourages `@ttsc/evidence` development.

## References

- [`ttsc`](https://github.com/samchon/ttsc): the TypeScript-Go toolchain this plugin runs on.
- [`@ttsc/lint`](https://github.com/samchon/ttsc/tree/master/packages/lint): the lint engine that links this rule into the compiler.
- [Guide Documents](https://ttsc.dev/docs/evidence)
- [Benchmark Diagram](https://ttsc.dev/docs/benchmark/evidence)
- [`samchon/evidence-benchmark-results`](https://github.com/samchon/evidence-benchmark-results)
