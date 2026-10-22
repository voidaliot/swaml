# Control flow and timing

swa.ml 2.0.

Use operation-owned flow for sequential work and states for an explicit lifecycle. A schedule owns startup, periodic, receive, call and after bindings; operation headers carry only signature information. Entry deadlines include backlog and suspension. Every entries default to their period. WCET belongs to a target binding with identified evidence.

while tests before its body; until tests afterward. Optional n times evaluates once and exits normally. Counted for scopes its initializer; for in copies a fixed array before iterating. There is no bound/do/forEach syntax. See [all loop forms](../examples/18-control-loops.swaml).

wait, requests and receive release serial locks. Resuming work reads live attributes, so recheck predicates before writing. Concurrent entries are transitively non-writing and retain a dispatch snapshot throughout. try catches expression failures without rolling back prior effects; deadlines, interruption and resources bypass it.

Receive statements queue early input and can select a timeout. Interrupt regions are armed only over their body/callees, cancel protected continuation in the same activation, and discard inactive input observably. [Interrupt example](../examples/19-interruptible-function.swaml).

States own ordered receive/timer transitions, optional entry/exit and finality. A stateful operation is parameterless void with exactly one on start entry. Whole final completion can release after dependents; idle state reactions cannot. [State example](../examples/04-stateful-function.swaml).

Timing views use Swaml::Views::Timing. Declared mode shows schedule/deadlines/waits; observed mode adds identified trace phases, lock gaps and message latency. Horizon intervals stay open and zero-cost logical steps are never measured WCET. [Timing model](../examples/17-function-timing.swaml).
