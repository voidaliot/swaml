# swa.ml 3.0 language specification

**Edition:** 3.0 · **Parser:** 3.0 · **Reference profile:** swaml-reference/3.0 · **Status:** release edition, 19 November 2026. swa.ml 3.0 is a breaking edition: states are steps of an operation's flow (chapter 3.6), which replace the state machines of 2.2, and `when`, `initial` and `final` are no longer words of the language; [`swaml migrate`](TOOLING.md#migrating-22-state-machines) rewrites 2.2 machines. 3.0 also adds places and selector reads, the conditional expression, contextual words and association lists, the library packages Swaml::Numeric, Swaml::Text and Swaml::Time, computed durations, sampled reads and member policies, release guards and Swaml::Os deployment ([3.0 release notes](RELEASE_3_0.md)). The published 2.2 edition (10 November 2026), its [reference](SWAML-2.2-Reference.md) and the published 2.1 edition and their artifacts are unchanged. [2.2 release notes](RELEASE_2_2.md) describe syntax-preserving associated-component test access and normal primary-subject calls from both case kinds. [Release notes](RELEASE_2_1.md) describe the changes and the migration from 2.0; the published 2.0 edition remains under its legacy v2.0.0 tag.

swa.ml is the Software Architecture Modeling Language: a textual language for explicit software structure, communication and executable behavior. [ADR 0016](decisions/0016-swaml-2-0.md) accepts the clean restart; [ADR 0019](decisions/0019-package-context.md) adds the package context and executable cases of 2.1. The language has one component concept and one operation concept. It does not accept 1.x source. Published books and PDFs retain their original bytes.

## 1. Normative set

The [concrete grammar](../src/language/swaml.langium) defines tokens and parse structure. These chapters define validity and meaning:

1. [Structure and types](spec/01-structure-and-types.md)
2. [Ports and communication](spec/02-communication.md)
3. [Operations, schedules and states](spec/03-behavior.md)
4. [Deployment, cases, views and conformance](spec/04-systems-and-conformance.md)
5. [Proposed KerML mapping](spec/05-kerml-mapping.md)
6. [Execution contract](spec/06-execution-contract.md)
7. [Normalized model](spec/07-normalized-model.md)
8. [Conformance obligations](spec/08-conformance-obligations.md)
9. [Formal semantics](spec/09-formal-semantics.md)

[Graphical notation](GRAPHICAL_NOTATION.md), its [catalog](GRAPHICAL_CATALOG.md) and the [mapping inventory](../spec/kerml-mapping.json) complete the contract. [Usage](USER_GUIDE.md), [quick start](QUICK_START.md), [AI authoring](AI_GUIDE.md) and [examples](../examples/) are informative. [Implementation status](IMPLEMENTATION_STATUS.md) distinguishes implemented checks from contracts and future evidence.

## 2. Precedence and scope

MUST and MUST NOT state requirements; SHOULD requires a documented reason for deviation; MAY grants permission. Grammar acceptance is insufficient when prose constraints fail. Unknown syntax and unsupported editions MUST be rejected. The host selects parser 3.0 and pins its package revision; files are headerless. Formatting never changes validity.

The language is closed. No generic UML/SysML constructs, host code, dynamic topology, generics, overloading, multiple inheritance, recursion or global mutable values are implicit. Platform Nodes model placement identities rather than hardware execution. A simulator run does not prove schedulability, absence of races, universal verification, KerML conformance or graphical editability.

## 3. Invariants

- **I1 Boundary:** every exchange between different component occurrences crosses owned typed port members and an explicit connection/forwarding route.
- **I2 Ownership:** components own private attributes, children and operations. Operations own nested operations and flow or states. Nested operations never capture enclosing locals/parameters.
- **I3 Provenance:** every provided event/attribute has an emitting operation; every required event/attribute and provided operation has exactly one input owner. Forwarded boundaries have no local handler/emitter.
- **I4 Values:** payloads, arguments, results, out values and array iterations are copied. Definition identity never merges occurrence stores. Records/enums retain nominal identity.
- **I5 Policy:** each connection occurrence has a complete effective pinned policy and independent queues. Forwarding has neither. Attributes keep latest values regardless of event/request capacity.
- **I6 Presentation:** views select existing semantic identities; drawings do not create behavior or routes. Layout stays separate; declared timing and observed evidence remain distinguishable.

Local calls, startup, periodic releases, waits, state timers and same-owner after dependencies are local lifecycle/computation. Operator and test inputs use ordinary source components, emitting operations, ports and routes; no destination injection or simulator function-release API exists.

## 4. Inventory

| Family | Ownership and meaning |
| --- | --- |
| Package, import | Flat multi-segment namespace and explicit visibility |
| datatype, enum, arrays | Finite nominal records/enums and copied fixed arrays |
| Component definition/usage | Reusable structure or distinct occurrence; usage body is anonymous specialization |
| Attribute/local/parameter | Occurrence state, lexical local, copied in or success-only out |
| Port definition/usage/member | Directed typed boundary; optional and reversed prefixes |
| Connection/forwarding | Policy-bearing opposite directions or queue-free boundary alias |
| Operation definition/declaration/usage | Reusable signature/body or owned executable, nested without captures |
| Schedule/entry | Trigger binding, dispatch arguments, deadline and concurrency |
| States | States as steps of the flow: entry once, looks in written order, event lines, `exit;` and `to S;`, parents (chapters 3.6, 6.5) |
| Deployment/placement | Software occurrences placed on platform Node occurrences |
| Requirement/case/view | Immutable intent; package-owned use cases and tests with an optional top-level subject occurrence, package associate/satisfy/verify links; stable selection union |

Definitions have qualified declaration identity. Occurrences have root plus indexed child paths. Activations add unique run identity. All transformations preserve these distinctions and source provenance.
