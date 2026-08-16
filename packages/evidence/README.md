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

Leave one uncited and the build stops.

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

One error per obligation, because a citation toward one reference never counts toward another. The error list is the task list, and an AI coding agent has to clear every entry to finish.

![Coverage and token spend across all four subjects](https://raw.githubusercontent.com/samchon/ttsc/gh-pages/benchmark/png/evidence-summary.png)

One engine built the same four applications twice from the same frozen requirements.

- **Plain**: review is a loop until dry.
  - Read everything from the beginning, fix every finding, start over.
  - Stop only after a round turns up nothing.
  - The loop reports what it happened to read, so it settles at a ceiling instead of at zero.
- **Evidence**: the build does not finish while an obligation is open.
  - Coverage is not a target, it is what is left once the errors are gone.
  - The compiler owns every omission.
  - A human reviews one thing, whether each citation is true.

## Setup

```bash
npm install -D typescript ttsc @ttsc/lint
npm install -D @ttsc/evidence
```

This is a rule contributor to [`@ttsc/lint`](https://github.com/samchon/ttsc/tree/master/packages/lint) 0.22 or newer, so it runs on [`ttsc`](https://github.com/samchon/ttsc) rather than on stock `tsc` with ESLint.

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

One claim: the components under `src` implement the docs, so every H2 and H3 under `docs` must be cited by a component. Run `npx ttsc` and the error count is the backlog, in the same stream as the type errors.

Four more rules ship beside `evidence/graph`, asking for a JSDoc block on every export, one public identity per file, no leftover `@todo`, and a review beside every tag. [The rule reference](https://ttsc.dev/docs/evidence/rules) has all five, and [the claim reference](https://ttsc.dev/docs/evidence/claims) has the full option surface: symbol selectors, external packages, monorepo roots, exclusion carriers, and the policies that tighten a single reference.

## How a project is wired

One claim is one edge. Chain them and a project has a graph, where every arrow points at the evidence it cites. The shape changes per project, the review split does not:

- **Humans read** the top layer, and the reason written on each tag.
- **The compiler reads** everything below it, and fails the build on any obligation nobody answered.

### Layers

<picture><source media="(prefers-color-scheme: dark)" srcset="https://ttsc.dev/evidence/documents-dark.svg"><img alt="Idea notes grounding Requirements and Specifications, which ground Implementation and Test" src="https://ttsc.dev/evidence/documents-light.svg" width="100%"></picture>

Humans own one layer and delegate everything under it. Hand over the requirements, and the agent writes the specifications; hand over raw idea notes, and it writes the requirements too.

### Backend

<picture><source media="(prefers-color-scheme: dark)" srcset="https://ttsc.dev/evidence/backend-dark.svg"><img alt="Requirements and Specifications grounding DB schema, API operation, API schema and Test" src="https://ttsc.dev/evidence/backend-light.svg" width="100%"></picture>

The DB schema is Prisma and everything else is TypeScript, so one graph spans two artifact kinds without either side knowing about the other.

### Frontend

<picture><source media="(prefers-color-scheme: dark)" srcset="https://ttsc.dev/evidence/frontend-dark.svg"><img alt="Requirements and Specifications grounding Swagger, Hooks, Screens and Journeys" src="https://ttsc.dev/evidence/frontend-light.svg" width="100%"></picture>

The Swagger document is the backend's own output, so this graph starts from what another project publishes.

## Beyond code

<picture><source media="(prefers-color-scheme: dark)" srcset="https://ttsc.dev/evidence/novel-dark.svg"><img alt="Principles and Settings grounding Storylines, Scenarios and Manuscripts" src="https://ttsc.dev/evidence/novel-light.svg" width="100%"></picture>

The graph reads no meaning, only obligations and citations, so the rules hold wherever the artifacts are text. In a novel the same edges hold a character to what they have learned, a consequence to its cause, and a manuscript to the scene it was meant to execute. [`samchon/novels`](https://github.com/samchon/novels) runs one on 25 principles, 350 setting commitments, and 742 scenes.

## Tags

Whatever the shape, a graph is written with three tags. `@evidence` cites, `@evidenceReview` verifies, and `@evidenceExclude` declines. The configuration is written once, these are written forever.

| Kind | Address a target as | Write a tag in |
| --- | --- | --- |
| Markdown | `docs/pricing.md`, or `docs/pricing.md#coupon-stacking` | an HTML comment |
| Prisma | `prisma:Sale`, or `prisma:Sale.coupon_limit` | a `///` comment |
| Swagger | `POST:/orders`, one token with no whitespace | nothing, it cannot host a tag |
| TypeScript | `{@link hooks.useCouponStacking}`, resolved through the citing module's imports | JSDoc |

A citation sits in a comment, so a rendered document stays clean, and `{#id}` gives a heading its own anchor.

```md
## Coupon Stacking {#coupon-stacking}

<!-- @evidence docs/meetings/2026-01-12.md#discount-policy Carries the limit agreed in that meeting. -->
```

### `@evidenceReview`

100% coverage is not 100% truth. A false tag removes the error, not the problem, so the tag list is what a human reads instead of the codebase.

```ts
/**
 * @evidence docs/discount.md#coupon-stacking States the per-issuer limit.
 * @evidenceReview docs/discount.md#coupon-stacking #a1b2c3d4e5f6
 *                 Verified against policy section 3.
 */
```

A review answers one citation: the same declaration, the same target, and a fingerprint of the cited content. Editing that content expires the review and asks for it again.

### `@evidenceExclude`

Not every requirement belongs to every layer, so an exclusion settles an obligation with nothing built. It is the only acknowledgement that does, which is why it exists to be vetoed.

```md
<!-- @evidenceExclude docs/requirements/pricing.md#coupon-stacking
     This release ships a single coupon. Stacking waits for the settlement policy. -->
```

"Not applicable" is a conclusion rather than a reason. [The tag reference](https://ttsc.dev/docs/evidence/tags) has the rest, including hierarchy, overlap, and where an exclusion may sit.

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
