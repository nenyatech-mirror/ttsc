---
marp: true
theme: ttsc
paginate: true
size: 16:9
title: "Evidence Graph"
description: "Turn requirements into compiler-enforced obligations so coding agents cannot finish with missing code, tests, screens, or documentation."
author: "Jeongho Nam"
keywords: "ttsc, evidence graph, spec-driven development, coding agents"
url: "https://ttsc.dev/slides/evidence/"
image: "https://ttsc.dev/og-evidence.png"
footer: "@ttsc/evidence · ttsc.dev/docs/evidence"
---

<!-- _class: lead evidence -->
<!-- _paginate: false -->

<div class="eyebrow">@ttsc/evidence</div>

# Evidence Graph

## Turn every missing obligation into a compile error

<p class="lede">Requirements become named graph nodes. Code, tests, schemas, APIs, screens, and documents must acknowledge the nodes they answer for.</p>

---

<!-- _class: lead evidence -->

<span class="punch">A coding agent can only fix what it notices.</span>

<p class="lede">A requirement omitted from the implementation creates no failing test, no type error, and no search result.</p>

---

# The four omissions left to review

- A requirement exists, but nobody implemented it.
- A feature exists, but nobody verified it.
- A capability exists, but no screen reaches it.
- A document changed, but the code depending on it did not.

> These are coverage failures without a denominator.

---

# Retrieval cannot supply the denominator

<div class="cols">
<div>

## Retrieval

- Answers the query it was given
- Finds relevant passages
- Never returns the section nobody asked about

</div>
<div>

## Coverage

- Starts from every declared unit
- Tracks who owes each answer
- Fails while any obligation is open

</div>
</div>

---

<!-- _class: divider -->

# Make the specification executable

## The graph owns the lower layers

---

# One graph, many artifact kinds

<div class="flow">
  <span>Requirements</span><i>→</i><span>Prisma</span><i>→</i><span>API</span><i>→</i><span>SDK</span><i>→</i><span>Tests</span>
</div>

<div class="flow">
  <span>Requirements</span><i>→</i><span>Screens</span><i>→</i><span>Journeys</span>
</div>

<p class="note center">Each arrow is an independently complete claim-reference obligation.</p>

---

# Declare who owes what

```ts
export default {
  claims: [{
    type: "typescript",
    files: ["src/components/**/*.tsx"],
    symbol: "function",
    reference: {
      type: "markdown",
      files: ["docs/requirements/**/*.md"],
      symbol: ["h2", "h3"],
    },
  }],
};
```

**Every selected component must answer every selected requirement section.**

---

# Code cites the exact unit it answers

```tsx
/**
 * @evidence docs/discount.md#coupon-stacking
 *           Shows the per-issuer stacking limit defined by this section.
 * @evidence POST:/orders/{orderId}/coupons
 *           Renders the refusal returned by this API operation.
 */
export function CouponStackingNotice(props: IProps): JSX.Element;
```

`@evidence <target> <reason>` records responsibility and rationale.

---

# No citation, no build

```text
$ npx ttsc
error TS16411: [evidence/graph]
  Missing acknowledgement for
  'docs/discount.md#coupon-stacking'
  (Markdown H2 'Coupon Stacking' at docs/discount.md:3)
```

- The compiler reports the exact missing unit.
- The agent must build the artifact or record a justified exclusion.

---

# Four artifact kinds

| Artifact          | Units                             | Citation host  |
| ----------------- | --------------------------------- | -------------- |
| Markdown          | file, H1 to H4 section            | HTML comment   |
| Prisma            | model, column, relation           | `///` comment  |
| TypeScript        | exported type, function, property | JSDoc          |
| Swagger / OpenAPI | operation under `paths`           | reference-only |

<p class="note">Documents, schemas, code, and API contracts share one addressable grammar.</p>

---

# Hierarchy makes one citation useful

```text
docs/discount.md
└─ # pricing
   ├─ ## coupon-stacking
   └─ ## issuer-limits
```

- Citing a scope acknowledges its selected descendants.
- The denominator still contains each selected leaf.
- Structural identity, not a dotted-name guess, defines ancestry.

---

# Obligations never pool

<div class="cards">
<div class="card"><b>Backend</b>Implements the pricing rule.</div>
<div class="card warm"><b>Frontend</b>Forgets to expose the rule.</div>
<div class="card accent"><b>Result</b>The frontend claim still fails.</div>
</div>

<br />

One implementation cannot hide another consumer's omission.

---

# A recorded “no” is also an answer

```ts
/**
 * @evidenceExclude docs/discount.md#internal-ledger
 * The public screen never exposes the settlement ledger;
 * finance operations own it in the admin application.
 */
export function CustomerDiscountPanel(): JSX.Element;
```

- The reason is mandatory.
- The exclusion belongs to one claim only.
- `noEvidenceExclude` can prohibit this path entirely.

---

# Policies prevent fake coverage

| Policy                    | What it stops                               |
| ------------------------- | ------------------------------------------- |
| `noEvidenceExclude`       | Dismissing an obligation as out of scope    |
| `uniqueEvidence`          | Reusing one semantic host several times     |
| `singleEvidencePerSymbol` | Parking an entire spec on one declaration   |
| `requireReview`           | Keeping a citation after its target changes |

---

# Reviews expire when evidence changes

```ts
/**
 * @evidence docs/discount.md#coupon-stacking Explains the limit.
 * @evidenceReview docs/discount.md#coupon-stacking #a1b2c3d4e5f6
 *                 Checked the copy against policy section 3.
 */
```

- The fingerprint covers the cited unit and its structural subtree.
- A changed requirement, API operation, schema, or symbol invalidates the review.
- The compiler reports the expected replacement fingerprint.

---

# What the agent experiences

<div class="flow">
  <span>Build</span><i>→</i><span>Named errors</span><i>→</i><span>Implement</span><i>→</i><span>Cite</span><i>→</i><span>Green</span>
</div>

The graph turns an open-ended search for omissions into a finite error list.

> The agent does not aim at 100%. It reaches 100% as the residue of closing every error.

---

<!-- _class: divider -->

# Does it change the result?

## Same engine, same requirements, one changed arm

---

# Benchmark design

- One coding engine built four applications from frozen requirements.
- Plain and Evidence arms used the same template, model, effort, and instruction sequence.
- Plain coverage was counted over thirteen provenance edges.
- Evidence coverage is **100% by construction** after a successful compile.

<p class="note">Repository aggregate generated 2026-08-12. One bounded cohort, not a universal estimate.</p>

---

# Provenance coverage

| Subject  | Plain | Evidence |
| -------- | ----: | -------: |
| Todo     | 85.5% | **100%** |
| Reddit   | 80.3% | **100%** |
| Shopping | 63.1% | **100%** |
| ERP      | 50.0% | **100%** |

The gap grows with the consequence surface.

---

# Token use fell with the search space

<div class="bar-row"><b>Todo</b><span class="bar"><i style="width: 100%"></i></span><span>866M → 92M</span></div>
<div class="bar-row"><b>Reddit</b><span class="bar"><i style="width: 100%"></i></span><span>1,179M → 245M</span></div>
<div class="bar-row"><b>Shopping</b><span class="bar"><i style="width: 100%"></i></span><span>1,516M → 271M</span></div>
<div class="bar-row"><b>ERP</b><span class="bar"><i style="width: 100%"></i></span><span>2,795M → 411M</span></div>

<p class="note">Labels show Plain → Evidence total tokens. Bar length is illustrative; use the labels for comparison.</p>

---

# ERP: more complete, less expensive

<div class="cards">
<div class="card"><span class="metric">6.8×</span>fewer tokens<br /><span class="note">2,795M → 411M</span></div>
<div class="card"><span class="metric">7.0×</span>lower API cost<br /><span class="note">$34.65 → $4.96</span></div>
<div class="card accent"><span class="metric">4.4×</span>less work time<br /><span class="note">60.5h → 13.6h</span></div>
</div>

<br />

The graph replaces repeated rediscovery with a compiler-owned work queue.

---

# Start with one valuable edge

1. Install `ttsc`, `@ttsc/lint`, and `@ttsc/evidence`.
2. Choose one claim population and one reference population.
3. Run `ttsc --noEmit` and inspect the first missing obligations.
4. Add true citations only after the corresponding artifact exists.
5. Expand the graph when the first edge is stable.

---

# What it does not do

- It does not judge whether prose is sincere.
- It does not prove runtime behavior without tests.
- It does not auto-exclude, auto-retarget, or delete obligations.
- It does not replace review; it gives review a complete, named surface.

---

<!-- _class: lead evidence -->

# Evidence Graph

- Humans own the requirements.
- The compiler owns the denominator.
- Agents close named obligations until none remain.

<span class="punch">Coverage becomes a build property.</span>

---

<!-- _class: lead evidence -->
<!-- _paginate: false -->

# Q & A

- [ttsc.dev/docs/evidence](https://ttsc.dev/docs/evidence)
- [ttsc.dev/docs/benchmark/evidence](https://ttsc.dev/docs/benchmark/evidence)
- [github.com/samchon/ttsc](https://github.com/samchon/ttsc)
