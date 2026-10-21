# ADR 0014 — Classes, operations and UML notation

> Superseded for development 2.0 by [ADR 0016](0016-swaml-2-0.md). Preserved as the historical 1.x decision.

Status: accepted for SWAML 1.3.1. Date: 2026-10-18.

This decision refines the vocabulary in ADR 0007 and ADR 0008. Their ownership, copied-value, calculation-purity and communication boundaries remain applicable. The 1.3 parser family and reference simulation profile remain unchanged; exact reproduction pins revision 1.3.1.

## Structural and executable hierarchy

The software metamodel has two explicit subtype relations: **Component specializes Class** and **Function specializes Operation**. Source uses lower camel case keywords. `class def` and `component def` define reusable types; `class` and `component` declare concrete usages or inline roots. `operation` and `function` declare executable members and interface signatures. These kinds remain distinguishable even though each pair shares an authoring AST representation.

Classes and components share composition, private values, ports, routes, deployment and execution rules. A component definition may specialize a class or component; a class definition may specialize only a class. A class usage accepts either definition kind; a component usage requires a component definition. Every usage has separate private state. A class introduces no shared heap, references, arbitrary object access or dynamic allocation.

Operations and functions share signatures, triggers, timing, local calculations, statement flow and directly owned states. Both may be called locally under the same lexical and lock rules; remote calls require typed ports and routes. Functions retain their specialized kind. An operation may be explicitly redefined as a compatible function, while a function cannot be widened to an operation. A class usage may likewise be narrowed to a compatible component usage. All other inherited-contract checks remain mandatory.

An interface operation signature accepts a compatible operation or function handler. An interface function signature requires a function handler. Interface signatures remain contracts, separate from owned executable implementations. Neither executable spelling creates an expression call: only function/operation-local `calc` declarations provide pure expression evaluation.

View filters test exact authored kinds. `kind == "class"` does not include components, and `kind == "operation"` does not include functions. Use explicit `or` predicates when both are wanted. FV and TV accept both executable kinds; IV accepts both structural kinds. Occurrence and declaration identities remain distinct.

## Flat notation

Classes use flat class frames and typed compartments. Components retain their component marker and explicit kind. Operation/function headers preserve their authored kind, signature and activation. Component-to-Class and Function-to-Operation are metamodel facts; a picture must not invent user-authored inheritance declarations to express them.

ClientServer and service connections use a ball at the server/provides port and a socket at the client/requires port. The square owned port, exact contract identity/version, named connector and complete QoS remain visible or inspectable. Ball/socket denotes the request-facing roles; service events and correlated results still travel in the reverse direction over the same typed route. SenderReceiver and publishSubscribe retain their existing directed notation.

## Transformation reassessment

The shared vocabulary reduces the renaming needed for a supported UML structural/behavioral subset. It does not establish UML execution equivalence or implement an importer/exporter. No XMI adapter is introduced by this decision. The [transformation table](../UML_COMPATIBILITY.md) assesses UML-to-SWAML and SWAML-to-UML meaning directly.

A future transformation must preserve source identities, structural and executable kinds, single ownership, nominal contracts, routes, QoS, triggers, copied values, cancellation and timing evidence. Unsupported constructs require an explicit redesign or a reported loss; familiar boxes cannot supply missing semantics. Standard UML alone does not carry all SWAML queue, snapshot, calculation-purity or trace-provenance rules, so an export needs explicit constrained metadata and a declared interpretation.

## Migration and evidence

Existing component/function models retain their meaning. The new class and operation tokens reserve those identifiers; conflicting names need migration. Parser, validator, runtime, reuse and handler-binding tests cover both alternatives and the invalid reverse subtype directions. Notation coverage includes flat class, operation and client/server/service ball/socket specimens. No passing parser or simulator run establishes general UML compatibility, a transformation implementation or production scheduling proof.
