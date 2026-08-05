# Intervention

This is your view as this repository's agent: what you may change, how you warn a cell, and how you recover one. Whether a cell's own edit still counts is a measurement question, and [measurement-integrity.md](measurement-integrity.md) owns it.

Diagnose before acting. Never blind-retry, never edit retained state, and never substitute a session.

Every remedy lands outside the measured workspace or in this repository.

## Triage

| What you observed | Remedy |
| --- | --- |
| A cell edited a frozen configuration file | Confirm it against [measurement-integrity.md](measurement-integrity.md) first, then [warn it](intervention-warning.md) and resume. A prescribed `disabled` deletion or a new dependency is not a violation |
| A cell stopped, a process died, or a launch or resume failed | [Diagnose](intervention-recovery.md), then resume the same run |
| A cell's ports have a listener but no live runner of its own | [Free the ports](intervention-recovery.md), then resume |
| A Plain cell sits at `awaiting-review-verdict` | Resume to retry the inspection. [plain-review.md](measurement-plain-review.md) owns the loop |
| The dashboard disagrees with `state.json` | Regenerate it. [dashboard.md](measurement-dashboard.md) owns the commands |
| A template, instruction, or runner defect | Fix it where [boundary.md](intervention-boundary.md) permits |
| Anything else | Record it in the pull-request prose and change nothing |

## Topics

- **[Boundary](intervention-boundary.md)** — what you may never change, when to stop and ask the user, and where a benchmark defect may be corrected.
- **[Warning](intervention-warning.md)** — the operator's one channel into a running cell.
- **[Recovery](intervention-recovery.md)** — diagnosis, cell ports, resume, checkpoint-derived runs, and cancellation.
