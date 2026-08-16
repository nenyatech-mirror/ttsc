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

The build fails once per obligation, because one reference never covers another. An AI coding agent has to clear every one to finish, and clearing one means citing the target and writing down why its code answers for it. Coverage reaches 100% on its own, as the residue of the errors it closed.

![Coverage and token spend across all four subjects](https://raw.githubusercontent.com/samchon/ttsc/gh-pages/benchmark/png/evidence-summary.png)

One engine built the same four applications twice from the same frozen requirements, once with the graph and once without. Both arms reviewed by loop: read, fix, restart, stop after an empty round. A loop never counts what it did not look at, so it settles on a ceiling that drops as the project grows: 5,449M tokens and 51.6% coverage on the ERP subject, against 411M tokens and 100%.

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

Every arrow points at the evidence it cites.

### Documents

<picture><source media="(prefers-color-scheme: dark)" srcset="https://ttsc.dev/evidence/documents-dark.svg"><img alt="Idea notes grounding Requirements and Specifications, which ground Implementation and Test" src="https://ttsc.dev/evidence/documents-light.svg" width="100%"></picture>

A meeting decision never written into the requirements, a specification nobody asked for, a requirement no code implements, a feature never verified. Humans own one layer and delegate everything below it, so handing over raw idea notes delegates the requirements too.

### Backend

<picture><source media="(prefers-color-scheme: dark)" srcset="https://ttsc.dev/evidence/backend-dark.svg"><img alt="Requirements and Specifications grounding DB schema, API operation, API schema and Test" src="https://ttsc.dev/evidence/backend-light.svg" width="100%"></picture>

A table nobody asked for has nothing to cite, an endpoint with no model behind it fails against the schema, and an operation no test answers for is a compile error on the next build.

### Frontend

<picture><source media="(prefers-color-scheme: dark)" srcset="https://ttsc.dev/evidence/frontend-dark.svg"><img alt="Requirements and Specifications grounding Swagger, Hooks, Screens and Journeys" src="https://ttsc.dev/evidence/frontend-light.svg" width="100%"></picture>

The Swagger document is the backend's own output, so this graph starts from what another project publishes. An operation no hook calls, a hook no screen renders, and a screen no journey reaches are each an open obligation.

### Beyond code

<picture><source media="(prefers-color-scheme: dark)" srcset="https://ttsc.dev/evidence/novel-dark.svg"><img alt="Principles and Settings grounding Storylines, Scenarios and Manuscripts" src="https://ttsc.dev/evidence/novel-light.svg" width="100%"></picture>

The graph reads no meaning, only obligations and citations, so the rules hold wherever the artifacts are text. Here they block a scene that drifts from the work's purpose, a character using knowledge they never learned, a consequence with no cause, and a manuscript departing from the scene it was to execute. [`samchon/novels`](https://github.com/samchon/novels) runs one on 25 principles, 350 setting commitments, and 742 scenes.

## Claims and references

A claim is the population that owes a citation, a reference is what it owes, and every pair is its own 100% obligation. A citation toward one reference never counts toward another. All pairs join the same `claims` array.

| Kind | Units | Claim | Reference | Cites in |
| --- | --- | --- | --- | --- |
| Markdown | file, H1 to H4 sections | yes | yes | an HTML comment |
| Prisma | model, column, relation | yes | yes | a `///` comment |
| TypeScript | types, functions, properties | yes | yes | JSDoc |
| Swagger / OpenAPI | each operation under `paths` | no | yes | nothing, it cannot host a tag |

Every population takes glob patterns in `files`, resolved against the `ttsc` project root. `root` resolves against another directory instead, which is how a monorepo shares one requirements set.

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

A citation sits in an HTML comment, so rendered prose stays clean, and `{#id}` gives a heading its own anchor. A section citation sits under its heading, a whole-file citation at the top.

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

A model is addressed as `prisma:Sale` and a member as `prisma:Sale.price`, never through its file, so moving a model cannot break a citation. Every matched file is parsed as one schema.

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

An operation is cited as `POST:/orders`, one whitespace-free token. The singular `file` names one local path or one `http:` URL, never a glob.

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

`files` selects modules and the population is what they publish, addressed the way a consumer reaches it, so `export * as functional` nests a segment and `export { A as B }` answers to `B`. A `package` population is read from disk, because a symbol nothing imports is absent from the program and is exactly the one an obligation needs to name. Only TypeScript may cite TypeScript.

### Symbol selectors

`symbol` picks which units a reference materializes, and on a claim it restricts which declarations may host a tag.

| Kind | Values | Default on a claim | Default on a reference |
| --- | --- | --- | --- |
| Markdown | `file`, `h1`, `h2`, `h3`, `h4` | all five | all five |
| Prisma | `model`, `column`, `relation` | all three | `model` |
| TypeScript | `type`, `function`, `property` | all three | `type` |
| Swagger | none, every operation is selected | not applicable | every operation |

Units keep their hierarchy, so a target acknowledges itself and every selected descendant, and an ancestor stays addressable even when its own kind is not selected.

A class is a `type`, its methods are `function`, and its fields are `property`, with any member written as a callable joining the methods. Private members and declarations documented `@internal`, `@hidden`, or `@ignore` leave the population. [The guide](https://ttsc.dev/docs/evidence/claims) has the rest.

### Reviews

```ts
/**
 * @evidence docs/discount.md#coupon-stacking States the per-issuer limit.
 * @evidenceReview docs/discount.md#coupon-stacking #a1b2c3d4e5f6
 *                 Verified against policy section 3.
 */
```

100% coverage is not 100% truth, and an untrue tag removes the error rather than the problem, so a human reads the tag list instead of the codebase. A review names the same declaration and target as the citation it answers, and carries a fingerprint of the cited content, so editing that content expires the review.

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

`evidenceExcludeCarriers` confines them to one ledger file, so reviewing every exclusion means opening one file. An exclusion written anywhere else discharges nothing.

### Strict references

Ordinary coverage is permissive, which is too weak for a proof obligation, where one exclusion or one host citing everything discharges the whole population. Four properties tighten a single reference, and they never pool across references.

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
