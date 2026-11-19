# Migrating to swa.ml 3.0

swa.ml 3.0 is a major edition: it removes the 2.2 state-machine syntax and the `when` keyword, and replaces them by states that are steps of the flow ([ADR 0026](decisions/0026-states-in-the-flow.md), chapters [3.6](spec/03-behavior.md) and [6.5](spec/06-execution-contract.md)). Everything else that was valid 2.2 stays valid with unchanged meaning. This guide says what changes for a 2.2 model, how `swaml migrate` rewrites it, which behaviour differences the migration accepts, and what a tool that consumes swa.ml must change.

## What changes for a 2.2 model

- **Models without a state machine** need no change. Their AST, references, diagnostics, types, projections, run results and traces are those of 2.2 (compatibility gates 1 and 2 and the extended 2.2 sets, in `npm run check`).
- **Models with a state machine** (`initial S;`, `state S { … }`, `final state`, transitions `on receive p.m(x) when (g) to T { … }` and `after D when (g) to T { … }`) are a syntax error in 3.0. The first error says so: `This is swa.ml 2.2 state-machine syntax (…), which 3.0 replaces by states that are steps of the flow; swaml migrate <file> rewrites it.` Run `swaml migrate`.
- **Names.** `initial`, `final` and `when` are basic names in 3.0; `view`, `state`, `in` and `out` are contextual words that may be written unquoted. A 2.2 spelling such as `'state'` stays valid and is the same name.
- **Hosts** select the edition, never the source: `--language-version 3.0` on the command line and `languageVersion` 3.0 in the language server; the reference profile is `swaml-reference/3.0`. A host that passes 2.2 is refused.

## swaml migrate

```text
swaml migrate [--write] file.swaml|directory [more files or directories...]
```

- A **dry run** by default: for every file it prints the machines it would rewrite (`line:column` of the machine, its operation and number of states), what it removes or renames, and the changed lines; it writes nothing.
- `--write` writes the migrated files. Nothing is written unless every file migrates and validates.
- A **directory** is walked for `.swaml` files (not into `node_modules`, `out` or hidden directories).
- Every migrated file is **validated** with the 3.0 language as one workspace with the other files given; a file that does not validate is reported with its errors.
- **Release guards** written `when (g)` (the spelling of an unreleased draft of this edition) are rewritten to `if (g)`.
- **Exit codes:** 0 when every file migrates or has nothing to migrate, 1 when a file is refused or does not validate, 2 on a usage error or a file that cannot be read. A refusal is printed as `file:line:column refused: reason`.

The recipe, for each 2.2 machine:

1. The states keep their names. The initial state comes first and final states last; the other states are ordered so that as many states as possible are followed by a state they go to.
2. Each state keeps its `on entry`. Timer transitions become lines `after D { effect; leave }`, sorted by duration; an unguarded timer not shorter than an earlier one was never taken and is removed (reported).
3. The receive transitions of one member become one line `on receive p.m(x) { … }` whose transitions are an `if` / `else if` chain in declaration order, the unguarded one as the final `else`. A transition after an unguarded one on the same member was never taken and is removed (reported). Bindings of later transitions are renamed to the first transition's names (reported), never inside strings, quoted names or comments.
4. A state whose `on exit` is not empty and that has a leaving transition with an effect writes its exit statements at the start of every leaving block, which keeps 2.2's order (exit, effect, entry).
5. A leave to the state written next is `exit;`, every other leave `to T;`; a body that is only the leave is written without braces.
6. Final states become ordinary states at the end; with several finals, `return;` follows each one but the last.
7. Nothing is written for unhandled input: 2.2 dropped it while a machine waited, and so does 3.0.
8. The migration keeps comments and every byte outside the machines, and gives an identity map from each new statement identity to its 2.2 identity (`migrateSource` in `src/migrate/machines.ts`), so old traces and overlays can be mapped.

## A worked example

The 2.2 machine:

```text
    operation control() {
      initial unlocked;
      state unlocked {
        on receive commands.lock() to locking { publish motor.pulse(1); }
      }
      state locking {
        on entry { pulses = pulses + 1; }
        after 50ms to isLocked { locked = true; }
      }
      state isLocked {
        on receive commands.unlock() when (locked) to unlocked { publish motor.pulse(-1); locked = false; }
      }
    }
```

`swaml migrate --write door.swaml` writes the operation below (shown in its complete model with a test that runs):

```swaml
package DoorLock {
  port def Commands {
    provides event lock();
    provides event unlock();
  }
  port def Motor {
    provides event pulse(direction: int);
  }
  component def Lock {
    reversed port commands: Commands;
    port motor: Motor;
    attribute locked: bool = false;
    attribute pulses: uint = 0;
    operation control() {
      state unlocked {
        on receive commands.lock() {
          publish motor.pulse(1);
          exit;
        }
      }
      state locking {
        on entry { pulses = pulses + 1; }
        after 50ms {
          locked = true;
          exit;
        }
      }
      state isLocked {
        on receive commands.unlock() {
          if (locked) {
            publish motor.pulse(-1);
            locked = false;
            to unlocked;
          }
        }
      }
    }
    schedule { on start control(); }
  }
  component def Body {
    port commands: Commands;
    reversed port motor: Motor;
  }
  component lock: Lock;
  component body: Body;
  connect (body.commands, lock.commands);
  connect (lock.motor, body.motor);
  associate body to 'Lock and unlock';
  test 'Lock and unlock' of lock {
    publish body.commands.lock();
    wait 60ms;
    assert lock.locked and lock.pulses == 1;
    publish body.commands.unlock();
    wait 1ms;
    assert not lock.locked;
  }
}
```

Read it as a flow: the operation starts in `unlocked`, which waits for `lock`; the lock line pulses the motor and leaves (`exit;`), so the flow reaches `locking`; its timer leaves after 50 ms into `isLocked`; there an `unlock` is taken only `if (locked)`, otherwise the message is dropped and the state waits on.

After migrating, rewrite where the new style reads better: a stop line shared by several states can move to a parent state; a check that 2.2 repeated in a self transition can stand in the state's braces, where it is looked at again whenever a value it reads changes; a periodic flag program can become a machine released `on every P`. The [door-controller showcase](../examples/showcase/autosar-classic-door-controller.swaml) shows all three (its window lifter with parents, its mirror heater and supply monitor as periodic machines).

## What the migration refuses

A refused file is left unchanged; the reason and location are printed.

- **A never-taken transition that holds the only publish of a member.** Removing it would leave the member without an emitting operation, so the migrated text does not validate (`… needs an emitting operation`). About 2 % of generated valid 2.2 machines (8 of 387) are of this kind. Delete the dead transition and the member, or make the transition reachable, then migrate again.
- **A binding that would be captured** by a name of a later transition, or a binding written before `.` (a port named like it): rename it by hand.
- **A non-final state without transitions** (it waited for ever in 2.2): give it the event it waits for, or make it final.
- **Forms of the unreleased draft** (completion transitions `when (g) to S`, internal transitions without `to`, guarded timers, `defer`): rewrite them by hand as an `if` in the state's braces, a line that does not leave, `after D { if (g) … }` and a variable.
- **A file that parses neither as 2.2 nor as 3.0**, such as a file that mixes a 2.2 machine with 3.0 forms: the first syntax error of the 3.0 grammar is reported.

## Accepted behaviour differences

A migrated machine gives the 2.2 results in 113 of the 114 recorded 2.2 runs and cases that contain a machine (gate B). Two differences are accepted and pinned by models in `test/fixtures/compatibility-2-2/accepted/`:

- **r10, delivery order.** Input queued for a waiting state is looked at in delivery order; 2.2 walked its queues in the order they were created. This can change which unnamed input is dropped and so a stored value. In generated 2.2 machines without `if`, 41 of 194 differ (12 in the final store).
- **C-3, an `if` test is no scheduling step.** An `if` in a migrated transition block is evaluated within the state's look. It can move a publish before or after another component's publish. With 2.2's queue order emulated, 2 of 794 generated machines differ in the final store, 7 in the order inside a component and 372 only in the order across components.

Review a migrated machine whose behaviour depends on the order of messages from different queues, and pin it with a test.

## For tools that consume swa.ml

- The AST has `StateStep`, `StateMember`, `EventLine` and `Leave` (`Exit`, `Jump`); `OperationBody.initial`, `states`, `State` and `Transition` are gone. A body without braces (`exit;`, `to S;`) is the same `Block` (`isShortBody`).
- A state's identity is its statement path (`Pkg::C.op/0`, inner states `…/0/2`), no longer `…/states/i`; the migration's identity map relates them.
- Trace: `state` (with `trigger`, `held`, `stay`), `wake`, `leave`, `periodicEnd`; `SimulationResult.machines["c.op"]` is the innermost current state, `''` outside every state.
- Libraries: the 3.0 library packages `Swaml::Numeric`, `Swaml::Text`, `Swaml::Time` and `Swaml::Os` are the built-in document `builtin:///swaml-3.0.swaml` (`LIBRARY_3_0_URI`); a host that assembles its own workspace loads it beside `swaml-2.0.swaml`.
- The full list of API, projection and trace changes is in the [release notes](RELEASE_3_0.md#consumers).
