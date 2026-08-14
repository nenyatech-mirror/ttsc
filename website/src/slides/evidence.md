---
marp: true
theme: default
paginate: true
size: 16:9
title: "Evidence Graph"
description: "Enforce 100% specification coverage as compile errors so coding agents cannot skip an obligation."
url: "https://ttsc.dev/slides/evidence/"
image: "https://ttsc.dev/og-evidence.png"
style: |
  section {
    font-family: "Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif;
    font-size: 32px;
    line-height: 1.6;
    padding: 60px 70px;
    background: #ffffff;
    color: #14161a;
  }
  h1 {
    font-size: 50px;
    color: #0f1115;
    border-bottom: 4px solid #14284b;
    padding-bottom: 14px;
    margin-bottom: 34px;
  }
  ul, ol { margin-top: 10px; }
  li { margin-bottom: 22px; }
  strong { color: #14284b; }
  code { font-family: "D2Coding", "Consolas", "Menlo", monospace; }
  pre { font-size: 26px; line-height: 1.5; border-radius: 10px; }
  table { font-size: 30px; width: 100%; }
  th { background: #14284b; color: #ffffff; }
  td, th { padding: 14px 18px; }
  blockquote {
    border-left: 8px solid #ffb020;
    background: #fff8e8;
    color: #2b3038;
    padding: 18px 26px;
    font-size: 32px;
  }
  footer { color: #9aa4b2; font-size: 17px; }
  footer a { color: #9aa4b2; text-decoration: none; }
  section::after { color: #9aa4b2; font-size: 17px; }
  a { color: #1a5fb4; }
  a:hover { color: #0d3d7a; }

  /* Dark slides */
  section.dark {
    background: #0f1115;
    color: #f4f5f7;
    justify-content: center;
  }
  section.dark h1 { color: #ffffff; border-bottom: none; font-size: 60px; }
  section.dark h2 { color: #8ab4ff; font-size: 34px; font-weight: 600; }
  section.dark strong { color: #ffd479; }
  section.dark li { color: #f4f5f7; }
  section.dark code { background: #262b36; color: #ffd479; }
  section.dark .note { color: #a7b0be; }
  section.dark a { color: #8ab4ff; }
  section.divider {
    background: #14284b;
    color: #ffffff;
    justify-content: center;
    text-align: center;
  }
  section.divider h1 { color: #ffffff; border-bottom: none; font-size: 56px; }
  section.divider p { color: #b9c9e6; font-size: 30px; }
  section.divider .note { color: #b9c9e6; }

  /* Single-line emphasis */
  .punch { display: block; font-size: 46px; font-weight: 700; line-height: 1.45; color: #ffd479; }
  .punch-lead {
    display: block; font-size: 40px; font-weight: 600;
    line-height: 1.5; color: #e3e6ea; margin-bottom: 34px;
  }
  .note { font-size: 24px; color: #5b6674; }

  /* Cumulative narrative references */
  .narrative-graph { position: relative; height: 410px; margin-top: -12px; }
  .narrative-group {
    position: absolute;
    left: 0;
    top: 10px;
    width: 32%;
    height: 270px;
    z-index: 2;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0;
    box-sizing: border-box;
    padding: 12px;
    border: 3px solid #f08a24;
    border-radius: 14px;
  }
  .narrative-node {
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    height: 84px;
    background: #f3f6fb;
    border: 3px solid #4a76b8;
    border-radius: 10px;
    color: #14284b;
    font-size: 32px;
    font-weight: 700;
  }
  .narrative-group .narrative-node { flex: none; width: 100%; border-color: #f08a24; }
  .narrative-node.scenarios,
  .narrative-node.storylines,
  .narrative-node.manuscripts { position: absolute; width: 25%; }
  .narrative-node.scenarios { left: 41%; top: 25px; }
  .narrative-node.storylines { left: 41%; top: 181px; }
  .narrative-node.manuscripts { left: 72%; top: 316px; }
  .narrative-edge {
    position: absolute;
    z-index: 1;
    box-sizing: border-box;
    color: #4a76b8;
  }
  .narrative-edge.to-foundations {
    left: 32%;
    width: 9%;
    border-top: 3px solid currentColor;
  }
  .narrative-edge.to-foundations::after,
  .narrative-edge.manuscripts-scenarios::after,
  .narrative-edge.manuscripts-storylines::after {
    content: "";
    position: absolute;
    top: -8px;
    left: -1px;
    border-top: 7px solid transparent;
    border-right: 12px solid currentColor;
    border-bottom: 7px solid transparent;
  }
  .narrative-edge.scenarios-foundations { top: 67px; }
  .narrative-edge.storylines-foundations { top: 223px; }
  .narrative-edge.storylines-scenarios {
    left: 53.5%;
    top: 109px;
    height: 72px;
    border-left: 3px solid currentColor;
  }
  .narrative-edge.storylines-scenarios::after,
  .narrative-edge.manuscripts-foundations::after {
    content: "";
    position: absolute;
    top: -1px;
    left: -8px;
    border-right: 7px solid transparent;
    border-bottom: 12px solid currentColor;
    border-left: 7px solid transparent;
  }
  .narrative-edge.settings-principles {
    position: relative;
    left: auto;
    top: auto;
    flex: none;
    align-self: center;
    width: 0;
    height: 72px;
    color: #f08a24;
    border-left: 3px solid currentColor;
  }
  .narrative-edge.settings-principles::after {
    content: "";
    position: absolute;
    top: -1px;
    left: -8px;
    border-right: 7px solid transparent;
    border-bottom: 12px solid currentColor;
    border-left: 7px solid transparent;
  }
  .narrative-edge.manuscripts-scenarios {
    left: 66%;
    top: 67px;
    width: 18.5%;
    border-top: 3px solid currentColor;
  }
  .narrative-edge.manuscripts-storylines {
    left: 66%;
    top: 223px;
    width: 18.5%;
    border-top: 3px solid currentColor;
  }
  .narrative-edge.manuscripts-up {
    left: 84.5%;
    top: 67px;
    height: 249px;
    border-left: 3px solid currentColor;
  }
  .narrative-edge.manuscripts-foundations {
    left: 16%;
    top: 280px;
    width: 56%;
    height: 78px;
    border-bottom: 3px solid currentColor;
    border-left: 3px solid currentColor;
  }

  /* Cards */
  .cards { display: flex; gap: 22px; margin-top: 20px; }
  .card {
    flex: 1;
    background: #f3f6fb;
    border-top: 7px solid #4a76b8;
    border-radius: 10px;
    padding: 22px 24px;
    font-size: 27px;
    line-height: 1.5;
  }
  .card b { display: block; font-size: 40px; color: #14284b; margin-bottom: 8px; }
  .card .note { font-size: 22px; }
  .card.warm { border-top-color: #f08a24; }
  .card.warm b { color: #b35c00; }

  /* Bars */
  .track {
    display: inline-block; width: 240px; height: 20px;
    background: #e6eaf0; border-radius: 10px; overflow: hidden;
    vertical-align: middle; margin-left: 14px;
  }
  .track i { display: block; height: 100%; background: #4a76b8; }
  .track.on i { background: #f08a24; }
  .track i.w855 { width: 85.5%; }
  .track i.w803 { width: 80.3%; }
  .track i.w631 { width: 63.1%; }
  .track i.w516 { width: 51.6%; }
  .track i.w100 { width: 100%; }

  /* Development and review split bars */
  .split {
    display: inline-flex; width: 210px; height: 20px;
    border-radius: 10px; overflow: hidden;
    vertical-align: middle; margin-right: 12px;
  }
  .split i { display: block; height: 100%; background: #14284b; }
  .split i.rev { flex: 1; background: #c3d3ea; }
  .split.on i { background: #b35c00; }
  .split.on i.rev { background: #ffd6a5; }
  .d97 { width: 9.7%; }
  .d54 { width: 5.4%; }
  .d47 { width: 4.7%; }
  .d105 { width: 10.5%; }
  .d720 { width: 72%; }
  .d808 { width: 80.8%; }
  .d586 { width: 58.6%; }
  .d846 { width: 84.6%; }

  /* Token bars by subject */
  .rows { margin-top: 26px; }
  .row { display: flex; align-items: center; margin-bottom: 20px; }
  .row .lbl { width: 150px; font-size: 28px; }
  .row .bars { flex: 1; }
  .row .bars i { display: block; height: 18px; border-radius: 9px; margin: 4px 0; }
  .row .bars i.p { background: #4a76b8; }
  .row .bars i.e { background: #f08a24; }
  .row .val { width: 230px; text-align: right; font-size: 25px; color: #5b6674; }
  .b159 { width: 15.9%; }
  .b17 { width: 1.7%; }
  .b216 { width: 21.6%; }
  .b45 { width: 4.5%; }
  .b278 { width: 27.8%; }
  .b50 { width: 5%; }
  .b1000 { width: 100%; }
  .b75 { width: 7.5%; }
  .kp { color: #4a76b8; font-weight: 700; }
  .ke { color: #b35c00; font-weight: 700; }
---

<!-- _class: dark -->
<!-- _paginate: false -->

# Evidence Graph

## Enforcing 100% specification coverage with compile errors

<span class="note">https://github.com/samchon/ttsc/tree/master/packages/evidence</span>

---

<!-- _class: dark -->

<span class="punch-lead">
Write the specification, build to the specification, and verify against the specification.<br/>Spec Driven Development.
</span>

<span class="punch">
That specification becomes the compile error.
</span>

<span class="note">your spec as a compile error no coding agent can skip</span>

---

<!-- _class: dark -->

<span class="punch-lead">
One meeting note. One idea note.
</span>

<span class="punch">
That alone produces a full-stack, full-spec product.
</span>

<span class="note">The ultimate form of Goal Mode: provide only the goal, and the graph catches the rest.<br/>Requirement coverage from 51.6% to 100%, 13.3× fewer tokens, and 7.5× less time.</span>

---

<!-- _class: divider -->

# So what do humans do?

<span class="note">One document layer. Delegate everything else</span>

---

# First, divide the documents into layers

```
Meeting notes · Idea notes
      ↓
requirements      What is needed
      ↓
specifications    What to build
      ↓
Implementation · Tests
```

- A lower layer can exist **only on the evidence of the layer above it**
- Humans need to touch **only one layer**

---

# Method A: Humans write the requirements

- Humans **review `docs/requirements` directly**
- Specifications, implementation, and tests are **fully delegated**
- Film production automation solution: **about 450K LoC**, working as-is on its first run

> The four benchmark subjects use this method as well.

---

# Method B: Hand over only the raw material

- Hand over meeting notes and idea notes **as-is, without organizing them**
- **Delegate everything**, starting with writing the requirements
- If anything decided in the meeting is omitted, **the build breaks immediately**

> In either method, the graph protects the lower layers.<br/>Humans review only the one layer they chose.

---

# Even requirements cite their evidence

```md
## Coupon stacking limit {#coupon-stacking}

<!-- @evidence docs/meetings/2026-01-12.md#discount-policy
     Carries over the per-issuer limit agreed upon in that meeting. -->
```

- If anything decided in the meeting **is missing from the requirements, the build breaks**
- Idea notes, interview records, and existing internal documents occupy the same layer
- Citations are HTML comments, so **the rendered document stays clean**

---

# The backend and frontend work like this

```
requirements ─▶ specifications
     │                │
     └───────┬────────┘
             ├─▶ DB schema
             ├─▶ API operations ─▶ Generated SDK ─▶ Tests
             └─▶ Hooks ─▶ Screens ─▶ Journeys
```

- Specifications stand on requirements as evidence,<br/>and **both layers together** impose obligations downward
- **Both tests and hooks** discharge the generated SDK's obligations

**"The backend is done, but there is no screen" becomes a compile error.**

---

<!-- _class: divider -->

# So how does that work?

<span class="note">We attached a compiler to specifications, too</span>

---

# Code cites the specification

```tsx
/**
 * @evidence docs/discount.md#coupon-stacking
 *           Explains the stacking limit defined by this section.
 * @evidence POST:/orders/{orderId}/coupons
 *           Explains the rejection response from this endpoint.
 */
export function CouponStackingNotice(props: IProps): JSX.Element;
```

**`@evidence <target> <reason>`**: what it is responsible for, and why.

---

# Without a citation, the build stops

```bash
$ npx ttsc
error TS16411: [evidence/graph]
  Missing acknowledgement for 'docs/discount.md#coupon-stacking'
  (Markdown H2 'Coupon Stacking' at docs/discount.md:3)
```

- One error per requirement → **the error list is the task list**
- It appears alongside type errors. There is no additional check to attach

---

# There is only one thing an agent obeys

- When told to read documents, it **pretends to have read them**
- In a review, it **says everything is done**
- But it **cannot get past a compile error**

> Documents are good to read.<br/>Compile errors have to be read.

---

# The configuration is one sentence

```ts
type: "typescript",
files: ["src/components/**/*.tsx"],  // The side that discharges the obligation
symbol: "function",
reference: {
  type: "markdown",
  files: ["docs/**/*.md"],           // The targets whose obligations must be discharged
  symbol: ["h2", "h3"],
},
```

**Components implement documents. Therefore, every H2 and H3 must be cited.**

---

# Four kinds of citation targets

| Kind          | Unit                         |
| ------------- | ---------------------------- |
| 📄 Markdown   | file, H1-H4 section          |
| 🗄️ Prisma     | model, column, relation      |
| 🔤 TypeScript | type, function, property     |
| 🌐 Swagger    | each operation under `paths` |

<span class="note">Documents, schemas, code, and API specifications are connected by one grammar.</span>

---

# Who determines 100%?

<div class="cards">
<div class="card"><b>Denominator</b>The configuration declares it</div>
<div class="card"><b>Numerator</b>The developer records it with tags</div>
<div class="card warm"><b>Decision</b>The compiler makes it every time</div>
</div>

<br/>

Entrust any one of the three to diligence, and 100% is merely **self-reported**.

---

# It prevents a false 100%

| Option | What it prevents |
| --- | --- |
| `noEvidenceExclude` | Escaping with "not applicable" |
| `uniqueEvidence` | Multiple places passing responsibility to one another |
| `singleEvidencePerSymbol` | Piling every citation onto one place |
| `requireReview` | Letting the specification change after it was cited |

<span class="note">An exclusion requires a reason, and a review carries a fingerprint of the document content.</span>

---

<!-- _class: divider -->

# What if the product is a story?

<span class="note">Settings become build constraints</span>

---

# A fluent scene can still be false

- **Memory**: uses facts the character never learned
- **Invention**: breaks history, geography, or motive
- **Revision**: keeps scenes invalidated by an earlier edit

> Long-form failure is global, not local.

---

# Every layer cites all prior sources

<div class="narrative-graph">
<div class="narrative-group">
<div class="narrative-node principles">Principles</div>
<div class="narrative-edge settings-principles"></div>
<div class="narrative-node settings">Settings</div>
</div>
<div class="narrative-node scenarios">Scenarios</div>
<div class="narrative-node storylines">Storylines</div>
<div class="narrative-node manuscripts">Manuscripts</div>
<div class="narrative-edge to-foundations scenarios-foundations"></div>
<div class="narrative-edge to-foundations storylines-foundations"></div>
<div class="narrative-edge storylines-scenarios"></div>
<div class="narrative-edge manuscripts-foundations"></div>
<div class="narrative-edge manuscripts-up"></div>
<div class="narrative-edge manuscripts-storylines"></div>
<div class="narrative-edge manuscripts-scenarios"></div>
</div>

---

# Each edge blocks a different drift

- Every narrative layer → principles: literary purpose
- Every narrative unit → settings: facts, rules, knowledge
- Scene plan and manuscript → storyline: causes and consequences
- Manuscript → scene plan: exact execution
- Target changes → affected reviews expire

---

# Why it works

- Limited context → exact obligations for this scene
- Plausible invention → explicit lineage and review
- Revision drift → stale fingerprints
- Forgotten promise → 100% reverse coverage

**Creative freedom inside hard continuity.**

---

# One graph, any narrative

- **Settings**: history, world rules, character
- **Causality**: clues, motives, consequences
- **Continuity**: knowledge, arcs, revisions
- Historical fiction, fantasy, science fiction, mystery, drama
- **Napoleon**: one example with 25 principles, 350 settings commitments, and 742 scenes

---

<!-- _class: divider -->

# So how much does it change?

<span class="note">Same requirements · Same engine · Same model, with only the plugin changed</span>

---

# Coverage

| Subject | Plain | Evidence |
| --- | --- | --- |
| todo | 85.5% <span class="track"><i class="w855"></i></span> | 100% <span class="track on"><i class="w100"></i></span> |
| reddit | 80.3% <span class="track"><i class="w803"></i></span> | 100% <span class="track on"><i class="w100"></i></span> |
| shopping | 63.1% <span class="track"><i class="w631"></i></span> | 100% <span class="track on"><i class="w100"></i></span> |
| erp | 51.6% <span class="track"><i class="w516"></i></span> | 100% <span class="track on"><i class="w100"></i></span> |

The larger the project, the more it misses.<br/>**It does not even know that it missed something.**

---

# Yet it becomes cheaper

<div class="rows">
<div class="row"><span class="lbl">todo</span><span class="bars"><i class="p b159"></i><i class="e b17"></i></span><span class="val">866M → 92M</span></div>
<div class="row"><span class="lbl">reddit</span><span class="bars"><i class="p b216"></i><i class="e b45"></i></span><span class="val">1,179M → 245M</span></div>
<div class="row"><span class="lbl">shopping</span><span class="bars"><i class="p b278"></i><i class="e b50"></i></span><span class="val">1,516M → 271M</span></div>
<div class="row"><span class="lbl">erp</span><span class="bars"><i class="p b1000"></i><i class="e b75"></i></span><span class="val">5,449M → 411M</span></div>
</div>

Token consumption for <span class="kp">Plain</span> and <span class="ke">Evidence</span>.<br/>The gap widens as the project grows.

<span class="note">Original charts by phase: [https://ttsc.dev/docs/benchmark/evidence](https://ttsc.dev/docs/benchmark/evidence)</span>

---

# Cost and time decreased as well: erp

<div class="cards">
<div class="card"><b>13.3×</b>fewer tokens<br/><span class="note">5,449M → 411M</span></div>
<div class="card"><b>13.9×</b>lower cost<br/><span class="note">$68.72 → $4.96</span></div>
<div class="card warm"><b>7.5×</b>less time<br/><span class="note">102h → 14h</span></div>
</div>

<br/>

This was not a cost paid for quality.<br/>**It built more and finished for less.**

---

# What if it lies?

```ts
/**
 * @evidence docs/discount.md#coupon-stacking Explains the per-issuer limit.
 * @evidenceReview docs/discount.md#coupon-stacking #a1b2c3d4e5f6
 *                 Verified that the screen copy matches the limit in policy section 3.
 */
```

- Inexpensive models **sometimes write facts that do not exist**
- Requiring fingerprinted reviews makes this **converge toward zero**<br/>but takes more time

> A false tag removes the error, not the problem.

---

# Ultimately, the review must run

Review Loop until Dry

```
① Read everything again from the beginning
② If there is even one thing to fix → ①
③ Stop only after a round finds nothing
```

<span class="note">Both arms were measured under this discipline.</span>

---

# But the review consumes all the money

| Subject | Plain | Evidence |
| --- | --- | --- |
| todo | <span class="split"><i class="d97"></i><i class="rev"></i></span> Review 90% | <span class="split on"><i class="d720"></i><i class="rev"></i></span> Review 28% |
| reddit | <span class="split"><i class="d54"></i><i class="rev"></i></span> Review 95% | <span class="split on"><i class="d808"></i><i class="rev"></i></span> Review 19% |
| shopping | <span class="split"><i class="d47"></i><i class="rev"></i></span> Review 95% | <span class="split on"><i class="d586"></i><i class="rev"></i></span> Review 41% |
| erp | <span class="split"><i class="d105"></i><i class="rev"></i></span> Review 90% | <span class="split on"><i class="d846"></i><i class="rev"></i></span> Review 15% |

Plain **starts quickly, but its review never ends.**<br/>Evidence is the opposite.

<span class="note">Dark is development, light is review. Each cell represents 100% of its tokens.</span>

---

# In return, the review becomes narrower

|  | Plain | Evidence |
| --- | --- | --- |
| What to inspect | All code, documents, and tests | The truthfulness of citations |
| Scope | Start over in every round | The tag list is the checklist |
| What is missing | Humans and AI must search to find out | The compiler has already reported it |

**The compiler handles "omissions"; humans handle "falsehoods."**

---

<!-- _class: dark -->

# Summary

- Humans review **only one document layer**
- The **compiler protects everything below it**
- A specification can be **software requirements, historical canon, or the laws of a fictional world**
- 100% is not the goal, but **what remains after every error is closed**

---

<!-- _class: dark -->
<!-- _paginate: false -->

# Q & A

- [https://github.com/samchon/ttsc](https://github.com/samchon/ttsc)
- [https://github.com/wrtnlabs/novels](https://github.com/wrtnlabs/novels)
- [https://ttsc.dev/docs/evidence](https://ttsc.dev/docs/evidence)
- [https://ttsc.dev/docs/benchmark/evidence](https://ttsc.dev/docs/benchmark/evidence)
