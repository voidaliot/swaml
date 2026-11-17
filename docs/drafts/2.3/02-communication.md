# 2. Ports and communication: 2.3 changes (draft)

**Draft for the unreleased standard 2.3; see [the draft index](README.md).** Target: [chapter 2](../../spec/02-communication.md). Examples are `text` fences until their work package lands. Decisions: [ADR 0024](../../decisions/0024-communication-and-package-links.md), and [ADR 0022](../../decisions/0022-values-places-and-expressions.md) for policy settings.

## 2.1 Directed port members

| ID | Rule |
| --- | --- |
| WP6-S02 | **Initial value.** An attribute member may declare an initial value, `provides attribute ajar: bool = false;`. The expression is pure (SW2006) and assignable to the member type (SW2002). Event and operation members have none (grammar). |
| WP6-S03 | **Mandatory when sampled.** When any component samples a member (chapter 2.6), the sampling port's effective member declaration, after reversal, has an initial value (SW2004, port shape). The provider side's initial value, if any, has no runtime meaning in 2.3. |
| WP6-S04 | **Ownership.** The owner sentence becomes: "Every required event and provided operation, and every required attribute that is not sampled, MUST have exactly one owner … A sampled required attribute has zero or one consuming owner; sampling is not ownership." |

## 2.3 Connectors and closure

| ID | Rule |
| --- | --- |
| WP6-S05 | **Member policies.** A connection may end in a body of member policies, `connect bodyCan: BodyCanFrames (bcm.bus, dcu.canBus) { crash: CanEvent; }`. Each names a member present, by name, in both connected ports and routed by this connection. A member is named at most once per connection. A body on a derived forwarding is an error. Package connections may carry member policies. All are SW2004. |
| WP6-S06 | **Redefinition.** `redefines connect` replaces the whole inherited connection, including all its member policies; nothing is merged. |

## 2.4 Versioned policies and queues

| ID | Rule |
| --- | --- |
| WP6-S07 | Replace "Inline policies and per-use overrides do not exist." with "Member policies select a named policy per member; inline policies and field overrides do not exist." The effective policy of a member route is its member policy, else the connection policy, else `Swaml::Qos::Default`. Every completeness and idempotency check (SW2013) applies per member route. |
| WP4-S02 | **Policy setting values.** A setting is `name = Expression;`. `requestTimeout`, `maxLatency` and `maxAge` must be a duration literal; computed values are rejected. Any other setting must not be a duration literal (`capacity = 5ms;` stays invalid). Both are SW2013. |
| WP4-M01 | `semantic.ts` `effectiveQos` and the validator read the duration from `value.duration`. Effective policies of 2.2 sources are unchanged (gate 1, normalization N1). |

## 2.5 Requests, replies and failure

No rule changes.

## 2.6 Sampled reads (new section)

```text
port def DoorState { provides attribute ajar: bool = false; }
component def ComMain {
  reversed port door: DoorState;
  operation txMainFunction() {
    send tx.doorStatus(record DoorStatusPdu { ajar = door.ajar; … });
  }
}
```

| ID | Rule |
| --- | --- |
| WP6-S01 | **Form.** In an operation body, or in a transition, completion, timer or release guard of the owning component, `p.m` is a sampled read. `p` is an owned port of the executing component and `m` is a required attribute member of `p` after reversal. The value is the member's type and the effect class is *reads state*. |
| WP6-S08 | **Forbidden ports and positions.** Sampling a forwarded boundary port is an error (SW2005). `p.m` on a child's port remains an error (SW2006). Sampled reads are not allowed in attribute or member initializers (SW2006) or in the constant sublanguage of chapter 3.5 (SW2007). Case scripts do not sample (WP6-S09). |
| WP6-R01 | **Cell.** Each port occurrence holds one sample cell per sampled member, initialized to the member's initial value (WP6-S03) before startup work is released. A read never fails. |
| WP6-R02 | **Update instant.** A cell takes a value at the instant the value is delivered to the port: the message's delivery time after the route's latency and fault delay. This is independent of whether a receive owner consumes it. A dropped offer does not update the cell. Each duplicate copy updates it at its own delivery instant. Within one logical instant, events run in the deterministic event order (time, phase, insertion ordinal). An activation sees the cell updates ordered before its reading step in that order. A delivery produced later in the same instant, for example by a zero-latency send from an activation that runs in that instant, is seen only by reads ordered after it. Worked example: at t = 20 ms a periodic `producer.tick` sends `level.value(v)` over a zero-latency connection, and a periodic `consumer.slot() when (level.value > 0)` of another component is released at the same instant. If the consumer's first step is ordered before the producer's step, its guard reads the previous value; the new value is delivered later in the same instant and is seen by the next read ordered after that delivery, at the latest by the release at t = 40 ms. If the producer's step and the delivery come first, the guard reads the new value. |
| WP6-R03 | **Live reads.** Every read of a cell, serial or concurrent, is live. Cells are not part of a concurrent dispatch snapshot. A guard and the body of one activation see the same value unless the body suspends in between; a body read after a suspension sees the newer value. |
| WP6-R04 | **No consumer.** A sampled member without a consuming owner has no pending-value queue observation. Its cell is the only store, and its offers and drops remain observable. |

Sampled reads serve level-triggered use. Edge reactions, such as resetting on a mode change, switching outputs off on entering sleep or detecting wake-up, keep receive handlers.

B21 (service discovery) is rejected. A team models each binding as a static, optionally `optional`, connection, exposes availability as `provides attribute available: bool = false;` and samples it.
