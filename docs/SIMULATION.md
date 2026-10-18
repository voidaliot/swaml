# Reference simulation profile 1.3

This document specifies the **swaml-reference/1.3** execution binding. This profile executes unified components, inherited effective members, executable functions and pure calculations; each connector retains its independent effective policy and queues. The portable TypeScript [interpreter](../src/simulation/simulator.ts) and [value evaluator](../src/simulation/values.ts) execute valid SWAML 1.3 root components. The profile implements logical behavior with explicit resource bounds. It does not model instruction duration, operating-system scheduling, hardware or network deployment.

## Run a model

Build with `npm ci` and `npm run build`. Then run:

```sh
npm run simulate -- Commerce::Shop examples/simulation/03-service-pubsub.json examples/03-service-pubsub.swaml
npm run simulate -- Lifecycle::Product examples/simulation/04-stateful-function.json examples/04-stateful-function.swaml
node scripts/check-simulations.mjs
```

The command takes a qualified root component name, a JSON options file and all workspace model files. It validates the entire input before executing. JSON output contains the trace, final stores, machine states, effective deployments, exact source text and per-source SHA-256 digests. Redirect stdout to a file when collecting evidence. The direct `node out/src/cli/simulate.js ...` command emits only JSON to stdout on a valid invocation; `npm run` additionally prints its script banner.

The selected root may compose components inline or instantiate a component definition. A typed root's deployment body does not extend its topology. Instance paths, stores and deployment keys remain relative to the selected root without a root-name prefix. Root-owned functions use their local name, such as `initialize`, without a root prefix. Store/deployment output includes every expanded component, with the root represented by the empty-string path. Source deployment may explicitly name the root to establish its default location. The output names the selected architecture `root`, and identifies the binding as `swaml-reference/1.3`.

Exit status is 0 when no failure was observed, 1 for invalid models, a failed activation, a contract violation or a resource limit, and 2 for an invocation/configuration error. A bounded horizon with no observed failure is not proof of eventual success. Descriptive `case` declarations are not a second executable script and are not automatically proven by this command.

The [run catalog](../examples/simulation/runs.json) names the published roots, options and expected final values. The [hello trace](../examples/simulation/hello-trace.json) is a complete reproducible observation artifact, including its exact model source. CI reruns every catalog entry, compares final values, checks repeatability and detects a stale published trace.

Operator and test stimuli are named interface events published by ordinary functions in the model. Start behavior and finite state/timer sequences schedule those emissions. Their explicit routes use the same queues, QoS and latency as application messages. The simulator has no direct function-release or destination-event injection option; a generated driver must be validated and preserved as source. See [events and external inputs](EVENTS_AND_INPUTS.md).

## Binding parameters

All times and counts are safe integers. Times are nanoseconds. Unknown options and invalid numeric bounds are rejected.

| JSON property | Default / domain | Meaning |
| --- | --- | --- |
| `untilNs` | required; ≥ 0 | Process events at times ≤ this horizon. Start epoch is zero. |
| `maxSteps` | 100000; ≥ 1 | Fuel for expansion, events, statements, expressions and transition work. Stops explicitly on exhaustion; it is a resource count, not elapsed CPU time. |
| `maxPending` | 1024; ≥ 1 | Global bound on pending lifecycle/periodic/timer work, excluding active frames and connector queues. |
| `maxReentrant` | 64; ≥ 1 | Maximum simultaneous reentrant activation roots per component. Serial activation roots have their separate one-lock rule. |
| `latencyNs` | 0; ≥ 0 | Constant one-way transport delay for accepted request, response, data and event offers. |
| `faults` | empty list | Fault schedule keyed by the one-based `offer` ordinal shown in the trace. Each offer has at most one entry. |

Example options:

```json
{
  "untilNs": 3000000000,
  "latencyNs": 1000,
  "maxSteps": 100000,
  "maxPending": 1024,
  "maxReentrant": 64,
  "faults": [{ "offer": 1, "kind": "drop" }]
}
```

Driver publications follow ordinary source statement order and scheduler rules. Named events carry copied, typed payloads through their declared routes. Independent source activations retain the deterministic scheduling order described below; the simulator has no separate input-release list.

## Deterministic scheduling and time

The event ordering key is `(timeNs, phase, insertionOrdinal)`. At one timestamp, phase 0 processes request expiries; phase 1 processes lifecycle/timer releases and transport readiness; phase 2 advances execution; phase 3 checks deadlines/latency. Thus timeout wins an exactly simultaneous response, while an activation completing exactly at its deadline satisfies the bound. Each event is followed by a dispatch pass: pending lifecycle work in release order, then connector queues in first-offer order. Enabled work may acquire a lock during that pass; newly released work does not preempt an already held serial lock.

Execution advances between completed statements, local function steps, loop iterations and state transitions. Pure expressions and individual assignments are atomic. Root activations interleave through the stable event ordinal. FIFO delivery is maintained per connector/direction/member. `unordered` permits this FIFO choice too; the simulator does not randomize it. Independent queues have a deterministic tie-break for reproducibility, not a source-language happens-before relation.

All local CPU costs are abstracted to zero. Transport delay, timeout, period, timer residence, suspension and queue delay advance logical time. Deadline observation begins at lifecycle/timer release or input readiness, including a message awaiting a busy component. Helpers receive their own elapsed deadline watchdog at invocation. A detected deadline or latency violation stops this run and remains in the trace. Zero-cost execution cannot establish a physical WCET bound; external deployment destinations retain their identities and do not become simulated processors.

Serial activation roots retain their lock while awaiting RPC. Reentrant activation roots read a deep dispatch-time snapshot; their helpers share that snapshot and mode. Reentrant activation roots may coexist with the serial activation root, subject to the reentrant limit. A machine allows one reaction at a time. Input stays in its connector queue until the relevant dispatch limit/lock permits execution. Pending lifecycle capacity is checked before adding another release; overflow stops with `ActivationOverflow`.

The finite-fuel policy also bounds non-progressing or Zeno model executions. No fairness or liveness result beyond the observed finite trace is claimed. There is no randomness, wall-clock dependency or automatic restart.

## Transport and fault interpretation

Each connector occurrence, direction and member owns a separate queue. Delegation resolves boundary aliases to locally handled component ports without adding queues. Capacity includes messages waiting for transport readiness; dispatched handlers are excluded. A send/publish attempts every matching route before reporting rejection. Offers that succeeded remain committed.

| Fault `kind` | Meaning |
| --- | --- |
| `drop` | For bestEffort/atMostOnce, discard the admitted message observably. For atLeastOnce, lose the first attempt, retain the logical identity/timestamp and retry once after an additional `max(1, delayNs)`; the retry succeeds unless overflow, age or availability terminates its obligation. |
| `duplicate` | Only legal on atLeastOnce. Dispatch two attempts of the same logical message/correlation. The retained logical queue entry reserves capacity until both attempts have been dispatched, with both preceding the next FIFO message. Response duplicates are observed and ignored after terminal completion. |
| `transport` | Detect a failed route immediately at emission. Report `Transport` to the relevant producer/correlation. This is an interface transport outcome, not a free event. |

An entry may set `delayNs` to override the normal delay for that offer. Default transport is reliable with one attempt for every admitted offer; this is a permitted trace of each delivery policy. The finite injected loss/retry model exercises failure rules but does not simulate arbitrary networks or prove eventual delivery. An entry targeting an offer beyond the chosen horizon remains unused; inspect `emission.offer` to verify that the intended fault was exercised.

Queue reject fails a data/event producer after fanout. RPC admission rejection enters `otherwise` with `Rejected`. Drop policies do not fail the producer. Age is measured from original emission, inclusive at the declared maximum, with expiry on the next nanosecond. A timed-out request does not cancel server effects. Remote handler failure returns `RemoteFailure`; late/duplicate replies cannot resume a caller again. An optional unbound RPC reports `Unavailable`; an unbound optional data/event send succeeds without offers.

## Values, flow and state coverage

Every expression and statement in the grammar is interpreted: primitives, enums, nominal records, fixed arrays, field/index reads, calculations, local functions, copied parameters, lexical scopes, assignment, branches, bounded loops, assertions, returns, explicit failure, send, publish and awaited request. int arithmetic uses exact intermediate integer operations before range checks. real uses binary64. Scalar byte/uint/int/real widening preserves values. Checked assignment into uint or byte rejects values outside the destination domain. Payloads, parameters and results are copied values.

State initialization, entry/exit, event payloads, guards, priority, timer generations, self transitions, completion reactions and finality are interpreted. Entry/exit lack event payload scope. Stale timers and inputs to a terminated machine are observable discards. A return or failure terminates the machine without completing later transition phases. A guarded completion cycle fails before taking edge 1,025.

These rules have regression tests for both success and failure, including callback blocking, snapshots across suspension, fanout partial rejection, freshness boundaries, retry identity, duplicate RPC, exact-time timeout races, arithmetic/bounds failures, timer cancellation, backlog limits and queued-input deadlines. They exercise observable semantics rather than only mirroring parser implementation.

## Evidence and limitations

`status` reports why scheduling stopped: `quiescent` (no scheduled events), `horizon` (future events remain), `violation` (root contract/resource failure), or `limit` (fuel exhausted). `outcome` is `failed` when a failure/violation occurred and `no-failure-observed` otherwise. A failed ordinary activation need not stop unrelated components, so a quiescent run may still have a failed outcome. `timeNs` is the last processed event time, including inert expiry/deadline bookkeeping; it is not necessarily the horizon or last visible effect.

Trace records have monotonically increasing `ordinal`, nondecreasing `timeNs`, `kind`, and `subject`. Activation (`a`), correlation (`r`) and logical message (`m`) IDs are unique within a run; pair them with the evidence artifact's run identity when combining runs. Emissions carry producing activation, leaf endpoints, member, route, offer number and copied payload; source text preserves the boundary delegation provenance. Deliveries carry attempts and correlation where relevant. Statement records include source lines. Final stores and machine states remain available after limits and violations.

The CLI supplies SHA-256 per source; the portable library returns exact sources and leaves hashing/storage to its host. Keep those sources, digests, selected root, complete options, profile version and output together. Absolute source URIs may identify the local workspace; the published hello artifact uses stable repository-relative file URIs.

The implementation provides **reference simulation evidence with an explicit logical-time abstraction**. It is not a blanket E certification, model checker, production runtime, KerML exporter, AUTOSAR generator or graphical editor. Physical WCET/schedulability, distributed clock error, real serialization, middleware outages and independent conformance assessment still require separate evidence. A host can call the portable API after building and validating the entire referenced workspace.

## Extended control flow and interruption

The 1.3 profile executes while, counted for, copied-array forEach and post-test do loops with their documented scopes and bounds. An armed interruptible region receives typed data/events through its connector queue, transfers control in its current serial activation, cancels a pending caller continuation and preserves earlier effects. Available input outside the armed interval is discarded explicitly. Region and cancellation events retain activation/correlation identities. See the [control-flow guide](CONTROL_FLOW_AND_TIMING.md) for examples and the [operational contract](spec/06-execution-contract.md) for ties and late responses.

`projectFunctionTiming` derives observed ready/running/request-wait phases and markers from these traces. Declared timing values remain separate. Open horizon/stop intervals are retained, and zero-cost execution is never reported as physical CPU duration. Reproduce the four showcase traces with `node scripts/build-timing-demo.mjs`; the normal gate checks their exact generated projection.
