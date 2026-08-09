---
name: review
description: Defines the review of every @evidence and @evidenceExclude for citations that are not true of their host, for cited requirements the code contradicts, and for exclusions standing in for work this layer owes; the review statement each judgement is recorded as; the configuration this scope may change and the differences that are findings; and the compiler and runtime gates each scope must pass. Read only for a review objective; backend.md and frontend.md carry the per-scope carriers, configuration, and gates.
---

# Review

The compiler owns target resolution, host eligibility, overlap, coverage, and, once this scope raises `evidence/review`, whether every acknowledgement carries a review at all. What it cannot own is whether a cited requirement was obeyed, because that is a question about behavior rather than about the graph.

Review inspects the full acknowledgement population for citations that are not true of their host, for cited requirements the code contradicts, and for exclusions standing in for work this layer owes. Each judgement is written down as that acknowledgement's review, so the inspection leaves a record rather than only corrections. Then it proves the gates its scope names.

Two scopes and no third. Read the per-scope document for the current objective before beginning:

- Backend Review: [backend.md](backend.md)
- Frontend Review: [frontend.md](frontend.md)

Frontend Review is the last one, so the checks that need both layers finished belong there rather than to a scope of their own.

## Tag Inspection

Before review, confirm every claim for the current phase is enabled. If an earlier stage left a prescribed `disabled` property, delete it before reviewing.

Then set `evidence/review` to `"error"` in the configurations the scope document names. Every acknowledgement now reports itself as unreviewed, and that report is the worklist: an acknowledgement still reporting is one this review has not reached.

For every `@evidence`, read the target, reason, and complete current host. A citation is justified only when the artifact actually implements, represents, or proves the target and the reason states that specific relation; mere relevance is not enough. Correct every fake citation.

Reading the target means reading what it requires, then checking the host against it. A disagreement between the two is the finding this inspection exists to make.

Which of the three is wrong decides what you correct, and the requirement is not one of them — it is a frozen input and it is right by definition:

- **The code.** The host is genuinely answerable for this target and does not do what it says. Correct the code.
- **The reason.** The relation is real but the sentence misstates it, so the tag asserts a conformance nobody claimed. Correct the reason.
- **The target.** The host was never answerable for this requirement and the anchor was reached for to satisfy coverage. Correct the tag, and check whether the artifact this target actually needs was ever built.

Decide which by asking what the requirement obliges and whether this host is the thing obliged to deliver it. Do not correct the code on a target that was never its own; that repairs a citation error by writing to the wrong file.

Where two artifacts cite one target — a type and the provider behind it, an operation and the test that proves it — read them against the target together. A published contract that promises what its implementation refuses is a finding on both.

Several hosts may truthfully cite one target; do not consolidate them. A clean compiler gate does not prove a tag truthful.

Write the review as you finish each acknowledgement, naming what you read or ran. That statement is the record of this inspection, and it is what a later reader has instead of your presence. A review that restates the reason, or that concludes without naming what was read or run, states nothing and is a finding on the same footing as a fake citation.

An exclusion's review answers a different question. A citation is checked against this host; an exclusion is checked by finding what does own the unit, so its review names that owner rather than anything about the declaration the tag sits on.

A host carrying several acknowledgements is read as one decision about that host. Reviews that cannot be written separately, or that a single check would have to be stretched to cover, mean the citations are not one responsibility. Split the host along the line they expose. Consolidating the reviews instead hides the seam the rule surfaced.

Continue after each finding until the complete active-phase population is inspected. Correct every fake tag, then pass the scope's gates.

## Exclusion Carriers

An exclusion is the one tag that turns a missing artifact into a green build, so its carriers are read as a population of their own. Open every carrier the scope document names, in full, and take each entry one at a time. An entry the compiler accepted is an entry someone still has to justify.

Judge each against three questions, and record a finding on any one of them:

1. **Is it genuine?** The claim must not cover the target, the reason must name what handles it instead, and the reason must name the condition that would make the decision false. A reason that concludes — "not applicable", "internal", "future work", "not implemented" — states nothing that could be checked.
2. **Does this layer in fact owe the target?** If the requirement needs a model, an operation, a test, a screen, or a journey here, the exclusion is standing in for work nobody did. Delete it and build the thing. This is the failure the graph exists to prevent, and a green gate is exactly what it looks like.
3. **Was it written to clear a diagnostic?** Compare the entry with the state the workspace was in when it appeared. An exclusion whose target the compiler had just demanded, written instead of the artifact that would have satisfied it, is fake however well its sentence reads.

Then check the placement in the other direction: an `@evidenceExclude` written on a working model, DTO, controller, test, screen, or journey belongs in that claim's carrier instead. The compiler accepts it there because the host is selected, which is why review has to catch it.

For every remaining `@evidenceExclude`, read the target and reason. Correct every fake exclusion.

## Configuration

Compare every configuration the scope document names with the baseline commit. The one permitted edit is deleting a predeclared `disabled` property with the comment that marks it. A reintroduced `disabled`, a changed claim, a changed selector, a lowered severity, or any other difference is a finding to report and restore, whatever it unblocks.
