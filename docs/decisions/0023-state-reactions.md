# ADR 0023: State reactions

Status: **superseded** (never released) by states in the flow ([specification](../proposals/STATES_IN_FLOW_PROPOSAL.md), chapters 3.6 and 6.5): 3.0 has no completion, guarded-timer or internal transitions and no deferral; the 2.2 machine syntax itself is replaced. The text below is kept as the record of the decision. Previously: accepted for the unreleased standard 3.0, 18 November 2026. Owner approval of the 3.0 scope and decisions D3 and D8 of the [2.3 proposal](../proposals/NEXT_MINOR_PROPOSAL.md), with the warning codes allocated by the owner. Not implemented: each rule lands with the work package named in the [2.3 chapter drafts](../design/3.0-drafts/README.md). This ADR is normative where it differs from the proposal. It reverses the exclusion of completion transitions in [the 2.0 transition design](../SWAML_2_0_TRANSITION.md) and [ADR 0016](0016-swaml-2-0.md), for guard-only completion only. Published editions remain unchanged.

Items: B7 completion transitions and B10 guarded timers (together), B8 internal transitions, B9 deferral. Work package: WP5, after WP4 (computed state timers). WP6 revisits the completion-guard warning when sampled reads land.

## Context

Showcase evidence at `showcase/all` `cc16c25`:

- **Decisions spread over a second component.** v2x `UplinkSessionManager.session` (1470–1481, 1492–1503) cannot decide on a value its own entry action just computed. It publishes `ctl.openRequested`, and the separate `UplinkTransfer.openSession`/`backoff` (1572–1606) performs the request and answers with `ctl.opened`, `ctl.refused` or `ctl.backoffElapsed`. Six control events exist only to return a decision to the machine that needed it. Door B10 is the same need: an entry action writes an attribute and the next state depends on it.
- **Self transitions that restart timers.** Cloud `PersistenceWriter.circuit` (1254–1276) handles an arrival in `Closed` by `to Closed`, which re-enters the state. In `Open` it must leave arrivals unhandled ("a self-transition would restart the cool-down timer"), so they appear only as discards.
- **Lost requests.** In door `LockControl.control` (1924–1944), a lock or unlock request that arrives during the 250 ms pulse has no transition and is discarded.

2.2 states have only receive and timer transitions, each with a target, and no deferral. The review found five traps in the first design (finding 6) and one ordering bug (finding 8):

- **Guards never re-evaluated.** A completion guard on `now()` or on an external value can wait forever.
- **Loops end as `limit`.** A completion loop ends as a step-limit stop, so a case becomes inconclusive instead of failing.
- **Discard behaviour unstated.** Whether completion is evaluated after a discard was not said.
- **Suspending internal effects unstated.** Their effect on state timers was not said.
- **Queued input changes state first.** Queued input is taken in the next state.
- **Wrong deferral order (finding 8).** "Oldest retained input first" does not match the interpreter, which walks queues in creation order.

## Decision

### Transition forms

```text
on receive p.m(b) [when (g)] [to S] { effect }    receive transition; internal without to
after D [when (g)] [to S] { effect }              timer transition; D is a literal or (e); internal without to
when (g) to S { effect }                          completion transition; to is required
defer p.m, q.n;                                   state member: retain input for these members
```

`defer` is a contextual word and stays usable as a name.

### Completion transitions (B7, B10)

**Static rules (SW2008).**
- A completion transition has a target and no trigger.
- Its guard is pure or reads state, and it does not call `now()`.
- A final state has no completion transitions.
- Reachability from the initial state includes completion edges.
- A cycle of states connected only by completion transitions whose guard is the literal `true` (after removing parentheses) is an error, unless an entry action, exit action or effect on the cycle can suspend (a wait, a receive, an interrupt region, a request, or a call to an operation that does). Such a cycle restarts its chain in every round (`CompletionLoop` below), so `state A { on entry { n = n + 1; wait 1ms; } when (true) to A { } }` is a retry, not an error.

**SW2017**, a new stable warning: a completion guard that reads nothing written by the stateful operation's own entry actions, exit actions or transition effects, or by their transitive callees, cannot change while the machine waits. It is not raised for a guard that folds to true (such as `true`, `1 == 1` or `not false`), for a guard that already has an error, or in a state that re-enters itself through its own receive or timer transition (polling: the guard is evaluated again after each wait). WP5 implements it for component attributes. WP6 confirms that it reports guards reading only sampled cells, which the machine never writes and on whose updates completion is not re-evaluated, and adds WP6-D10: a guard that folds to false gets SW2017 `Completion guard of {state} is always false; the transition is never taken.` (owner decision on WP5 review N3). WP6-D09 narrows the polling exemption to a self receive or timer transition, or an internal receive, that can fire, and to guards on an attribute some executable writes or on a sample cell (WP5 review N2; revocable while the owner reviews WP5-R03).

**Runtime.**
- **Selection order.** After the entry actions of a state finish, and after every internal reaction, the completion transitions of the current state are evaluated in declaration order. The first enabled one is taken at once: exit, effect, state update, entry. The total order of candidates in a state is:
  1. completion transitions, in declaration order;
  2. elapsed timers, earliest expiry first and declaration order on equal expiry;
  3. retained input, in global offer-ordinal order;
  4. other queued input, in the 2.2 order.

  If nothing is selectable, the machine waits without the lock.
- **Input during a chain.** Input queued while entry actions run, or during a chain of completion reactions, is selected in whatever state the chain reaches. If that state neither handles nor defers it, it is discarded there (`inactiveOwner`).
- **No completion after discards.** Completion is not evaluated after `discardInput` (no enabled receive transition) or `discardTimer` (a timer guard was false). Neither changes anything the machine owns.
- **Suspended effects.** If an entry action or an internal effect suspends, the state's timers keep their epoch. On resumption, completion is evaluated first, then elapsed timers, then input, as after entry actions.
- **`CompletionLoop`.** A completion chain starts when the activation starts. It restarts at every consumption of input or a timer, and at every suspension of an entry action, exit action or effect. A completion reaction that enters a state already entered in the current chain is the contract violation `CompletionLoop`. Like the other violations it stops the reference run and bypasses `try`, so a case fails instead of ending inconclusive at the step limit.
  - A retry state whose entry makes a request and re-enters itself through a completion transition suspends in every round, so it is a bounded loop, not a violation.
  - A counting loop through completion transitions that never suspends is rejected even when it is bounded. Such a loop belongs in a loop statement of an entry action, or behind a timer.

### Guarded timers (B10)

`after D when (g) …` carries a guard that is pure or reads state (SW2008).
- When the timer expires, its guard is evaluated. If the guard is false, the timer is consumed for this state entry: the trace records `discardTimer` with reason `guard`, and the next timer with the same expiry is tried in declaration order.
- Later timers stay armed.

### Internal transitions (B8)

A receive or timer transition without `to` is internal. It runs only its effect: no exit, no entry, no state update, and the state's timers keep their epoch.
- An internal timer fires at most once per state entry. Its reaction leaves the state's other timers armed. Another timer that has already elapsed, including one with the same expiry, is selected after the completion evaluation that follows the reaction.
- Completion transitions are evaluated after each internal reaction.
- An internal transition does not add a reachability edge.
- Explicit self transitions (`to` the same state) keep their 2.2 meaning: exit, effect, state update, entry, with timers restarted.
- **Trace.** An internal reaction is a `state` observation with `internal: true`, the unchanged `state` and the transition as `source`.

### Deferral (B9)

**Static rules (SW2008).**
- Each deferred endpoint is a required event or attribute that this stateful operation owns through its transitions.
- Some state of the machine has a transition on it.
- A state cannot both defer a member and have a transition on it (D8).
- A member is deferred at most once per state.
- A final state defers nothing.
- A deferral is a member of this machine's single input ownership (SW2005), never a second owner.

**SW2018**, a new stable warning, on the `defer` endpoint: the member's effective policy on some route into this occurrence has `overflow = reject`. A full queue then fails the sender's offer.

**Runtime.**
- **Retention.** While the current state defers member `m`, input for `m` stays in its connection queue. Capacity, overflow, ordering and `maxAge` apply to it observably. A retained attribute keeps only its latest value, as before. A message is retained from the first instant at which it is deliverable while the current state defers its member, whether the machine waits at its selection or runs an entry action, exit action or effect of that state; so the order does not depend on whether the deferring state ever waits (an entry action that outlasts the state's timer, or an entry followed by `when (true)`).
- **Evidence.** Each retained message produces exactly one `defer` observation, at its first retention. It records the state and the message origin.
- **Consumption order.** In a state that handles retained members, retained input precedes other input, but comes after completion transitions and elapsed timers (the total order above). Retained input is consumed in global offer-ordinal order across all of the machine's queues. Input that was never retained follows in the existing 2.2 order. A machine without deferrals therefore behaves exactly as in 2.2. The interpreter's queue walk (`simulator.ts` `consume()`, which uses queue-creation order) changes for retained input only.
- **Discard.** On entering a state that neither handles nor defers `m`, retained input for `m` is discarded at the next wait with `discardInput` reason `inactiveOwner`, the 2.2 rule for unhandled input.

## Alternatives rejected

- **Timer guards and internal transitions only (D3 alternative).** This leaves the v2x decision traffic and the door B10 pattern in place.
- **Completion transitions without the extra rules.** Allowing `now()` or external reads without a warning, ending loops at the step limit, and leaving discards and suspended effects unspecified were the traps of review finding 6.
- **Re-evaluating completion guards whenever any read value changes.** This needs change tracking of every attribute and sampled cell and makes the reaction order depend on unrelated writes. Keeping guards local to the machine's own reactions, with SW2017, is predictable.
- **A UML-style deferred-event pool with guard re-evaluation (D8 alternative).** Retained input would have a second ordering domain beside the connection queues, and a state could both defer and accept a member depending on guards. Disjoint deferral keeps one owner and one queue.
- **Consuming retained input in queue-creation order.** This is the current interpreter walk, and it reorders messages across members. Counterexample: `b.y`'s queue created at t=0, `a.x` offered at t=1 and `b.y` at t=2 would deliver `b.y` first (finding 8).
- **A completion chain that restarts only at input or timer consumption** (first WP0 draft). It rejected bounded retry loops whose entry suspends on a request, because a reply is neither input nor a timer (WP0 review finding 5).
- **Global offer order for all queued input.** This would change 2.2 runs that never defer, and gate 2 forbids that.
- **Removing the cloud `AlertRouter` waiting ring by deferral** (proposal revision 1). The router also drops waiting pages for alerts that resolved meanwhile (`stillOpen`, 1384–1390). The claim is withdrawn.

## Consequences

- **Grammar.** `State` gains `deferrals`. `Transition` makes `to` optional, admits `when (g)` alone and a guard on `after`, and takes `(e)` delays (WP4). `Deferral` is new. `defer` joins the contextual words. Inventories are regenerated in WP5.
- **AST.** `Transition.target` becomes optional, which is part of the 4.0.0 reasoning of ADR 0022.
- **Validator.** SW2008 rules above; SW2017 and SW2018; reachability and finality with completion edges; SW2005 ownership counting deferrals as the machine.
- **Simulator** (`machine()`): completion selection, guarded timers, `discardTimer`, internal reactions, `CompletionLoop`, retention and the offer-ordinal order for retained input, and the `defer` observation.
- **Formatter** (A1): prints the new forms.
- **Projection.** Internal transitions are not edges to a target (core `projection.ts` currently builds an edge to `…undefined`). Completion transitions are edges labelled with their guard. Deferrals are state annotations.
- **Consuming tools.** Tools must accept transitions without `to` and completion transitions without a trigger, and must show deferrals.
- **Showcase (WP5 proof).** v2x session (one machine with `when (sessionId > 0) to Connected`), cloud breaker (internal arrivals, a completion trip and the intended counter change in the test `'Store outage trips the breaker and recovers'`), door `LockControl` (`defer requests.request;` in `locking` and `unlocking`; SW2018 asks whether `lockRequests: RteQueued` and `keyFob: CrossCore` keep `reject`).

## Compatibility

All three forms are new syntax, so no valid 2.2 source contains them. A 2.2 machine has no completion transitions, internal transitions, timer guards or deferrals, and none of the new runtime rules apply to it. Retained-input ordering applies only to retained input. Release gates: corpus AST identity, unchanged simulation results and a warning-free grammar (ADR 0022). Gate 2 compares the complete traces of the 2.2 corpus with the frozen 3.1.0 fixture.

## Open items

- WP6 confirms SW2017 for guards that read only sampled cells. Re-evaluating completion guards on cell updates is not part of 3.0.
- Hierarchical and orthogonal states remain outside the language.
