# Decision 0002: Complete semantics before claiming complete tooling

**Status:** accepted for the 0.1.1 draft revision, 2026-10-14.

The specification audit found implementation gaps and ambiguous operational details. The language remains a bounded 0.1 design with direct ownership and interface-only boundaries. This revision keeps the syntax/header and clarifies interpretation while tightening previously incomplete validation.

- A reentrant root and all local helpers use one dispatch-time private-state snapshot and cannot write unit state. Static analysis follows helper calls.
- Initialization installs all handlers/routes before startup dispatch. Lifecycle backlog has an explicit bounded target contract; overflow is observable and stops execution.
- All fanout offers are attempted; a rejected offer cannot undo successful ones. Request timeout wins a response observed at the exact expiry instant.
- State timers start at entry completion and belong to a state-entry generation. Completion is processed before the next external stimulus, with a defined microstep bound.
- Replies infer correlation from one unique unanswered request ancestor. The current grammar has no explicit correlation selector; ambiguous partial traces must be split or ordered rather than guessed.
- Required port status survives every delegation level. Normalized routes reject duplicate leaf pairs.
- Every grammar production has a normative home and a mapping-design entry. These entries do not stand in for an implemented KerML library/exporter.
- Static validity, runtime failures, analysis evidence and IDE work have separate conformance obligations. The tool continues to claim S and partial V honestly.

The stricter lexer rejects raw controls/unknown escapes; Void completions cannot be read; imported names are ambiguous even across target kinds. Models accepted accidentally by 0.1.0 may now receive errors. No valid example from the initial draft requires semantic migration. Keeping the 0.1 header is a draft clarification policy, not permission for silent breaking changes after stabilization.

See [issues 1–5 and evidence](../SPECIFICATION_AUDIT.md), the [operational contract](../spec/06-execution-contract.md) and [normalized model](../spec/07-normalized-model.md).
