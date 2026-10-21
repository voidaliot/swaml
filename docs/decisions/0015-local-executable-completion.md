# ADR 0015 — Local executable completion activation

> Superseded for development 2.0 by [ADR 0016](0016-swaml-2-0.md). Preserved as the historical 1.x decision.

Status: accepted for SWAML 1.4 development. Date: 2026-10-19. This is not a published edition.

## Decision

An operation/function can declare `on completion A`, where `A` names one effective, triggered executable in the same owning class/component. The dependent executable is a parameterless void flow body. The predecessor can be a flow or stateful operation/function, including an inherited effective member. Names are local IDs; qualified and component paths are not alternative spellings. Missing or cross-owner references remain errors. The effective dependency graph must be acyclic, including after specialization.

Each successful whole predecessor activation completion releases one fresh dependent activation after the predecessor relinquishes its serial lock. The dependent acquires its own lock or dispatch-time snapshot, timing contract, deadline and lifecycle-backlog slot. No parameters or result are forwarded. Shared component values may communicate local state under the existing serial/reentrant rules; a release does not freeze those values or guarantee immediate dispatch. There is no same-stack continuation, implicit join, ordering among fanout dependents or cross-component event channel.

A predecessor failure releases nothing. Successful RPC handler completion is a local event independent of later response delivery or requester timeout. Every successful periodic/reentrant activation can release another dependent activation. A stateful predecessor releases dependents only once when its whole executable succeeds through final-entry completion or bare return; quiescent states, ordinary reactions and `on completion` state transitions are distinct events. A dependent's later failure cannot retroactively fail its predecessor or roll back effects.

## Versioning and presentation

Select parser family 1.4 and reference profile `swaml-reference/1.4`; pin the exact 1.4.0 development package revision. The existing reserved word `completion` gains this trigger use, so no new reserved identifier is introduced. Published 1.3.1 artifacts retain their grammar/profile and are not rewritten.

FV may draw a dotted, labeled `on completion` activation-dependency arrow between selected same-owner executable occurrences. Its executable endpoints, label and source trigger distinguish this dependency from statement control flow, synchronous local calls and state completion transitions; other control-flow line styles need not change. Unselected endpoints are not silently added. TV can annotate observed releases with predecessor activation/function identity; a source dependency alone is not an observed completion or a scheduling proof.

## Evidence boundary

Static checking covers the target signature/body, a triggered same-owner predecessor and effective dependency cycles (SW066/SW067). Reference execution must cover repeated releases, failure suppression, inherited dispatch, stateful whole completion, RPC transport independence, fresh activation context and bounded resources. Static acceptance and bounded logical-time traces remain S/partial V and reference evidence, not production E, KerML K, graphical G certification or physical schedulability.
