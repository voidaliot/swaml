# Architecture comparison

SWAML 2.0.

| Pattern | SWAML 2.0 representation | Separate target evidence |
| --- | --- | --- |
| Periodic controller | Component attributes, operations, every schedule, latest sensor attributes and command events | Physical task/transport/WCET and schedulability |
| Service | Directed operation members, on call handlers, request policy, try and correlated replies | Middleware reliability and measured latency |
| Publish/subscribe | Named event members and explicit fanout connections with independent queues | Broker/discovery mapping if required |
| Composite subsystem | Child usages and queue-free boundary forwarding | Target partition/allocation |
| Stateful protocol | Operation-owned ordered states and input/timer transitions | Protocol reachability analysis beyond bounded runs |
| Deployment | Separate software/platform roots and Node placements | Core/task/bus/OS translation |

All patterns retain private occurrence state, copied values and explicit routes. The [examples](../examples/) illustrate software models rather than production platform bindings. Start with [architecture patterns](ARCHITECTURE_PATTERNS.md) and the [usage guide](USER_GUIDE.md).
