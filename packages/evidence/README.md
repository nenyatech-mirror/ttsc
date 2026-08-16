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

`@evidence <target> <reason>` names one unit of the spec and why this declaration answers for it. A target is one of four kinds:

- **Markdown**: a file, or a section of one.
- **Prisma**: a model, a column, or a relation.
- **Swagger**: an operation, method and path together.
- **TypeScript**: a type, a function, or a property, written as an inline link.

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

One error per obligation, so the error list is the task list.

An AI coding agent cannot finish while one is open, and closing one means citing the target and writing down why its code answers for it. Nobody aims at 100% coverage. It is what is left once the errors are gone.

![Coverage and token spend across all four subjects](https://raw.githubusercontent.com/samchon/ttsc/gh-pages/benchmark/png/evidence-summary.png)

One engine built the same four applications twice from the same frozen requirements.

- **Plain**: no graph. Review runs as a loop, reading the codebase, fixing every finding, restarting, and stopping after an empty round. A loop cannot count what it never looked at, so it stops at a ceiling instead of at zero, and that ceiling falls as the project grows.
- **Evidence**: the graph in the workspace. The build does not finish while an obligation is open.

On the ERP subject, the largest of the four, Plain reached 51.6% coverage for 5,449M tokens and Evidence 100% for 411M.

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

The components under `src` implement the docs, so every H2 and H3 under `docs` must be cited by a component. Run `npx ttsc` and the error count is the backlog, in the same stream as the type errors.

### Rules

| Rule | Takes | What it does |
| --- | --- | --- |
| `evidence/graph` | [`ITtscEvidenceGraphConfig`](https://github.com/samchon/ttsc/blob/master/packages/evidence/src/structures/ITtscEvidenceGraphConfig.ts) | The graph itself. Project-scoped, so its entry declares no `files`. |
| `evidence/documented` | [`ITtscEvidenceDocumentedConfig`](https://github.com/samchon/ttsc/blob/master/packages/evidence/src/structures/ITtscEvidenceDocumentedConfig.ts) | Requires a JSDoc block on every selected export, since a block is the only place a citation can live. Members need their own. |
| `evidence/singular` | nothing | Keeps one public identity per file, named after the file. |
| `evidence/todo` | nothing | Fails on every remaining JSDoc `@todo`, with its own text. |
| `evidence/review` | nothing | Requires an `@evidenceReview` beside every `@evidence` and an `@evidenceExcludeReview` beside every `@evidenceExclude`. |

Each takes `"error"`, `"warning"`, or `"off"`.

## Graphs in practice

Every arrow points at the evidence it cites. The shape changes per project, the review split does not:

- **Humans read** the top layer, and the reason written on each tag.
- **The compiler reads** everything below it, and fails the build on any obligation nobody answered.

### Documents

<picture><source media="(prefers-color-scheme: dark)" srcset="https://ttsc.dev/evidence/documents-dark.svg"><img alt="Idea notes grounding Requirements and Specifications, which ground Implementation and Test" src="https://ttsc.dev/evidence/documents-light.svg" width="100%"></picture>

Humans own one layer and delegate everything under it. Hand over the requirements, and the agent writes the specifications; hand over raw idea notes, and it writes the requirements too.

### Backend

<picture><source media="(prefers-color-scheme: dark)" srcset="https://ttsc.dev/evidence/backend-dark.svg"><img alt="Requirements and Specifications grounding DB schema, API operation, API schema and Test" src="https://ttsc.dev/evidence/backend-light.svg" width="100%"></picture>

The DB schema is Prisma and everything else is TypeScript, so one graph spans two artifact kinds without either side knowing about the other.

### Frontend

<picture><source media="(prefers-color-scheme: dark)" srcset="https://ttsc.dev/evidence/frontend-dark.svg"><img alt="Requirements and Specifications grounding Swagger, Hooks, Screens and Journeys" src="https://ttsc.dev/evidence/frontend-light.svg" width="100%"></picture>

The Swagger document is the backend's own output, so this graph starts from what another project publishes.

### Beyond code

<picture><source media="(prefers-color-scheme: dark)" srcset="https://ttsc.dev/evidence/novel-dark.svg"><img alt="Principles and Settings grounding Storylines, Scenarios and Manuscripts" src="https://ttsc.dev/evidence/novel-light.svg" width="100%"></picture>

The graph reads no meaning, only obligations and citations, so the rules hold wherever the artifacts are text. In a novel the same edges hold a character to what they have learned, a consequence to its cause, and a manuscript to the scene it was meant to execute. [`samchon/novels`](https://github.com/samchon/novels) runs one on 25 principles, 350 setting commitments, and 742 scenes.

## Claims and references

A claim is the set of declarations that owe a citation, and a reference is what they owe.

Every claim and reference pair is its own 100% obligation, so a citation toward one never counts toward another. All pairs go in the same `claims` array.

| Kind | Units | Claim | Reference | Cites in |
| --- | --- | --- | --- | --- |
| Markdown | file, H1 to H4 sections | yes | yes | an HTML comment |
| Prisma | model, column, relation | yes | yes | a `///` comment |
| TypeScript | types, functions, properties | yes | yes | JSDoc |
| Swagger / OpenAPI | each operation under `paths` | no | yes | nothing, it cannot host a tag |

Both sides take glob patterns in `files`, resolved against the `ttsc` project root. Set `root` to resolve against another directory instead, which is how a monorepo shares one requirements set.

### Markdown

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

- A citation sits in an HTML comment, so the rendered document stays clean.
- `{#id}` gives a heading its own anchor.
- A section citation sits under its heading, a whole-file citation at the top.

### Prisma

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

- A model is `prisma:Sale` and a member is `prisma:Sale.price`, never addressed through its file, so moving a model cannot break a citation.
- Every matched file is parsed as one schema.

### Swagger

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

- An operation is cited as `POST:/orders`, one token with no whitespace.
- `file` names one local path or one `http:` URL, never a glob. Use an array of references for several documents.

### TypeScript

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

- `files` picks the modules, and the units are whatever those modules publish.
- A unit is addressed the way a consumer reaches it, so `export * as functional` nests a segment and `export { A as B }` answers to `B`.
- `package` reads the units from disk instead of from the program, because a symbol nothing imports never enters the program and is exactly the one an obligation needs to name.
- Only TypeScript may cite TypeScript, since `{@link}` resolves through the citing module's imports and a document has none.

### Symbol selectors

`symbol` picks which units a reference produces, and on a claim it restricts which declarations may host a tag.

| Kind | Values | Default on a claim | Default on a reference |
| --- | --- | --- | --- |
| Markdown | `file`, `h1`, `h2`, `h3`, `h4` | all five | all five |
| Prisma | `model`, `column`, `relation` | all three | `model` |
| TypeScript | `type`, `function`, `property` | all three | `type` |
| Swagger | none, every operation is selected | not applicable | every operation |

- Units keep their hierarchy, so a target answers for itself and every selected descendant. Citing a heading covers its subsections, and `prisma:Sale` covers the columns beneath it.
- An ancestor stays addressable even when its own kind is not selected.
- A class is a `type`, its methods are `function`, and its fields are `property`. Any member written as a callable counts as a method.
- Private members, and declarations marked `@internal`, `@hidden`, or `@ignore`, leave the set entirely.

[The guide](https://ttsc.dev/docs/evidence/claims) has the rest.

### Reviews

```ts
/**
 * @evidence docs/discount.md#coupon-stacking States the per-issuer limit.
 * @evidenceReview docs/discount.md#coupon-stacking #a1b2c3d4e5f6
 *                 Verified against policy section 3.
 */
```

100% coverage is not 100% truth. A false tag removes the error, not the problem, so this list is what a human reads instead of the codebase.

A review answers one citation: the same declaration, the same target, and a fingerprint of the cited content. Editing that content expires the review and asks for it again.

### Exclusions

```md
<!-- @evidenceExclude docs/requirements/pricing.md#coupon-stacking
     This release ships a single coupon. Stacking waits for the settlement policy. -->
```

`@evidenceExclude <target> <reason>` records that a claim intentionally does not use a scope. It is the only acknowledgement that settles an obligation with nothing built, so it exists to be vetoed, and "not applicable" is a conclusion rather than a reason.

```ts
{
  type: "typescript",
  files: ["src/components/**/*.tsx", "src/components/EXCLUSIONS.ts"],
  evidenceExcludeCarriers: ["src/components/EXCLUSIONS.ts"],
  symbol: "function",
  reference: { type: "markdown", files: ["docs/**/*.md"], symbol: "h2" },
}
```

`evidenceExcludeCarriers` confines them to one ledger file, so reading every exclusion means opening one file. An exclusion written anywhere else discharges nothing.

### Strict references

Coverage is loose by default, which suits a document that several modules honor. It is too loose for a proof obligation, where one exclusion or one host citing everything discharges the whole set. Four properties tighten a single reference, and they never pool across references.

| Property | Effect |
| --- | --- |
| `noEvidenceExclude` | Refuses exclusions, so the target still owes positive evidence. |
| `uniqueEvidence` | Allows at most one host per unit, so one host is answerable rather than several. |
| `singleEvidencePerSymbol` | Requires exactly one unit from every selected host, so a host citing nothing and a host citing everything both fail. |
| `requireReview` | Makes every acknowledgement owe a matching review, which fails again once the cited content changes. |

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
