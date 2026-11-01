# swa.ml 2.1 release

2 November 2026 (intended publication date). Standard 2.1, parser 2.1, reference profile swaml-reference/2.1, reference implementation package 3.0.0.

swa.ml 2.1 makes the package the context in which a system, its surroundings and the scenarios that exercise them live side by side, and makes use cases and tests executable. [ADR 0019](decisions/0019-package-context.md) records the design; it supersedes [ADR 0018](decisions/0018-cases-belong-to-their-subject.md), which was never published, and the case clauses of [ADR 0016](decisions/0016-swaml-2-0.md) and [ADR 0017](decisions/0017-readable-names-and-use-cases.md). The edition also includes the quoted names of ADR 0017.

This is an incompatible edition. The owner approved it as 2.1 because swa.ml has no external adopters. There is no compatibility parser, alias or deprecation period: removed forms are ordinary parse or validation errors, and a host selecting 2.1 rejects --language-version 2.0. The published 2.0 edition, its legacy v2.0.0 tag, PDF, manifest, checksum and [frozen reference](../history/2.0.0/docs/SWAML-2.0.0-Reference.md) remain unchanged.

The release includes the [reference book](SWAML-2.1-Reference.md). The PDF, per-source manifest and SHA-256 checksum use the names SWAML-2.1-Specification.pdf, SWAML-2.1-Specification.manifest.json and SWAML-2.1-Specification.sha256 under output/pdf and are produced by the [publication gate](PDF_PUBLICATION.md).

## What is new

### Package context

A package is a closed context. connect may be a package member that joins ports of top-level component occurrences of the same package, with the existing forms connect (a.p, b.q);, connect name (a.p, b.q); and connect name: Policy (a.p, b.q);. Occurrences are never connected across packages; definitions may still be imported. Closure of top-level ports is checked per package: every required port of a top-level occurrence needs a peer through the package connections, and the existing compatibility, variance, duplicate and peer-count rules apply across the whole package.

### Interface-only components

A component with ports but no operations, schedule entries or parts is interface-only. It needs no implementation, so the emitter and input-owner rules of SW2005 do not apply to it, and it does nothing on its own in a run. Actors (external systems) and test stubs are written as interface-only components.

### Executable use cases and tests

use case X of y { … } and test X of y { … } are package members; test replaces verification case. The optional subject y is a top-level occurrence of the same package. A case without of, or without statements, records intent only.

After its documentation, a case body may contain statements: a script that acts as its associated interface-only actors through occurrence.port.member endpoints (send, publish, calls, on receive … or after D), answers requests at actor ports with on call actor.port.op(bindings) { return v; } branches, and, in a test only, reads and calls into its subject and the single parts inside it (atm.fee(20, 10), atm.dispenser.count) without assigning them. Statements require of.

Each case with statements runs in its own fresh deterministic package run. The script starts after the on start entries, and the run stops when the script completes or fails. Results are pass, fail (the first failure in the run, with its statement identity, message, time and trace), inconclusive (horizon, step limit or a stalled script) and no checks. A passing case is bounded evidence of one deterministic run, not proof.

swaml test [--package P] [--case X] [--json] [--options file | --until-ns N] runs the cases of the given sources, prints one line per case and a summary, and exits 1 when a case fails. See [the simulation guide](SIMULATION.md).

### Links live in the package

associate Z to X; associates a top-level occurrence Z with a use case or test X of the same package. satisfy R by X; claims that a component definition or a component occurrence path declared in the package satisfies R. verify R by T; links R to a test T of the package, never to a use case. Duplicate pairs and bad references are reported with SW2010 at the offending reference. Requirements and links remain intent, not proof.

### Run targets and statement identities

A run targets a whole package, with its top-level software occurrences, package connections and deployments, or one top-level component alone, with its package connections absent and its ports open. A top-level occurrence has at most one deployment (SW2009), and every run applies it. swaml simulate [--target Package|Package::component] (--options file | --until-ns N) selects the target and defaults to the package of single-package sources.

Every trace event carries source, the statement identity of the statement, state, transition or schedule entry that caused it, such as Banking::Controller.withdraw/1 or a case statement path. Offers record sourcePort and targetPort and deliveries targetPort; asserts are observed with their outcome.

### Readable names

Names may be quoted, such as 'Withdraw cash', 'Bestellübersicht' or 'state', for spaces, letters outside ASCII and reserved words. Quoted names exclude path separators and untidy spaces, and rename writes quoted names where required. test, associate, by, name, kind, path and the duration units ns, us, ms and s are contextual words. verification, actor, extend, request, reply, via and from are no longer keywords.

### Views

Case views draw the subject occurrence as the boundary with associated occurrences outside it; a selected package contributes its cases. Sequence views select cases, components, packages and operations; Flow and Timing views select use cases and tests.

## Removed forms

- useCase and verificationCase (2.0), verification case (ADR 0018) and the of root form of 2.0 cases.
- Declarative case steps: send, publish, request and reply with from, to, via and after.
- verify R; inside a case.
- Cases inside components, actor roles (actor customer: Customer;), and include and extend between cases.
- satisfy R of path (2.0) and satisfy R; inside a component (ADR 0018).
- SW2015 and the deprecated 2.0 case spellings it reported.

## Migration from 2.0 and ADR 0018 syntax

Components, operations, ports, schedules, states, deployments and views keep their 2.0 meaning. A concrete root component that owns and wires its parts remains valid. Only models with cases, requirement links or actors need changes:

1. Declare the system and its surroundings as top-level occurrences of the package and join them with package connections.
2. Write each actor or external system as an interface-only component: keep its ports and remove the behavior that only played a scenario.
3. Move every case into the package as use case X of subject or test X of subject. Replace verificationCase or verification case by test.
4. Replace actor roles by associate actor to X; and rewrite steps as a script, or keep the case as documentation-only intent. include and extend have no replacement; describe the relationship in documentation.
5. Rewrite satisfy R of path; as satisfy R by path; and verify R; inside a case as verify R by T; in the package.
6. Select parser 2.1 (--language-version 2.1, or initializationOptions languageVersion 2.1) and the profile swaml-reference/2.1.

### From 2.0

In 2.0 the actor had to emit its own scenario, the case was a list of declarative steps on a concrete root, and satisfy and verify used of and a nested verify:

```text
component def Visitor {
  port panel: Panel;
  operation arrive() {
    publish panel.order("tea");
  }
  schedule {
    on start arrive();
  }
}
component Demo {
  component visitor: Visitor;
  component counter: Counter;
  connect (visitor.panel, counter.panel);
}
satisfy Service of Demo.counter;
verificationCase Served of Demo {
  verify Service;
  publish order from visitor.panel.order to counter.panel.order;
  publish served from counter.panel.served to visitor.panel.served after order;
}
```

In 2.1 the visitor is interface-only, the occurrences and their connection are package members, and the test is a script that acts as the visitor and checks the result:

```swaml
package Kiosk {
  port def Panel {
    provides event order(item: string);
    requires event served(item: string);
  }
  component def Visitor {
    /** Actor: interface-only; a case script acts through its panel. */
    port panel: Panel;
  }
  component def Counter {
    reversed port panel: Panel;
    operation serve(item: string) {
      publish panel.served(item);
    }
    schedule {
      on receive panel.order(item) serve(item);
    }
  }
  requirement Service {
    /** Every order is served. */
    attribute description: string = "Serve each order";
  }
  component visitor: Visitor;
  component counter: Counter;
  connect (visitor.panel, counter.panel);
  test Served of counter {
    /** One order is served within a second. */
    publish visitor.panel.order("tea");
    on receive visitor.panel.served(item) {
      assert item == "tea";
    } or after 1s {
      fail "not served";
    }
  }
  associate visitor to Served;
  satisfy Service by counter;
  verify Service by Served;
}
```

swaml test reports pass Kiosk::Served. [Example 16](../examples/16-requirements-and-views.swaml) shows the same migration of the 2.0 traceability example.

### From ADR 0018

Development builds after 2.0 placed cases inside their subject component with typed actor roles, include and extend:

```text
component def 'ATM Controller' {
  reversed port panel: Panel;
  port bank: Authorization;
  use case 'Withdraw cash' {
    actor customer: Customer;
    actor issuer: Bank;
    include Authenticate;
    publish 'insert card' from customer.panel.cardInserted to panel.cardInserted;
    publish 'ask for cash' from customer.panel.cashRequested to panel.cashRequested after 'insert card';
  }
}
component def Bank {
  reversed port link: Authorization;
  satisfy 'Cash limit';
}
```

In 2.1 the case is a package member with a subject, the actors are associated top-level occurrences and the claim is a package link:

```text
component customer: Customer;
component atm: 'ATM Controller';
component bank: Bank;
connect (customer.panel, atm.panel);
connect (atm.bank, bank.link);
use case 'Withdraw cash' of atm {
  /** The customer inserts a card, asks for cash and receives it. */
  publish customer.panel.cardInserted("4711");
  publish customer.panel.cashRequested(100);
  on receive customer.panel.cashDispensed(amount) {
    assert amount == 100;
  } or after 2s {
    fail "no cash dispensed";
  }
}
associate customer to 'Withdraw cash';
associate bank to 'Withdraw cash';
satisfy 'Cash limit' by Bank;
```

[Example 28](../examples/28-use-cases.swaml) is the complete model. [Example 29](../examples/29-executable-cases.swaml) adds an isolation package with an interface-only bank stub answered by on call and white-box reads in tests.

### Hosts and programs

The reference implementation package is 3.0.0 because its exported API changed incompatibly:

| 2.0 (package 2.0.0) | 2.1 (package 3.0.0) |
| --- | --- |
| SimulationResult.root | target with kind package or component and its identity |
| simulate(models, root, options) | simulate(models, target, options), with a package or Package::component target |
| SimulationOptions.deployment | removed; each top-level occurrence has at most one deployment and every run applies it |
| offer and deliver fields source and target (port paths) | sourcePort and targetPort; source is the statement identity on every event |
| profile swaml-reference/2.0 | swaml-reference/2.1 (REFERENCE_PROFILE) |
| languageVersion 2.0 in CLI, LSP and projections | 2.1 (SWAML_LANGUAGE_VERSION) |
| Scenario root, steps, verifications and actors | Scenario subject and statements; Package connections, associations, satisfactions and verifications |

New exports include runCase, runTests, workspaceCases, runTarget, runTargets, statementIdentity and resolveStatement. [The implementation status](IMPLEMENTATION_STATUS.md) lists tested scope and limits.
