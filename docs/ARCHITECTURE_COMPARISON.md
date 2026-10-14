# Architecture analysis and SWAML design rationale

This is an original design comparison, not a declaration of compatibility with the referenced standards. Research checked on 2026-10-14. The detailed AUTOSAR comparisons use the accessible R21-11/R19-11 specification material as a stable conceptual baseline; they are not a feature-by-feature review of the latest release.

## Comparison

| Concern | AUTOSAR Classic | AUTOSAR Adaptive | UML 2.5.1 / SysML 2.0 | SWAML decision |
| --- | --- | --- | --- | --- |
| Architectural focus | Embedded software components, RTE and BSW | Service-oriented adaptive applications | General software / systems modeling | Software units and components with separate deployment |
| Contract style | Sender–receiver and client–server interfaces | Methods, events and fields | Interfaces, ports, connectors and behavioral constructs | Four explicit interface kinds; fields expand to operations/events |
| Behavior ownership | Runnable entities and activation events | Application behavior behind service APIs | UML behaviors/operations; SysML actions, states and usages | Operations own flow/states directly in their unit |
| Exchange boundary | Ports and runtime integration | Service communication | General-purpose mechanisms can be used in several modeling styles | Cross-unit communication must always use ports/interfaces |
| Timing | Strong embedded integration context | Distributed execution and communication concerns | Expressible constraints; target analyses vary | Period, WCET, deadline, latency and age; no implied scheduling proof |
| Deployment | ECU/BSW/RTE integration | Processes/machines and middleware | Deployment/allocation abstractions | Logical nodes and separate target binding |
| Graphics | Tool-specific architecture views | Tool-specific service views | Broad diagram/view families | Browser + GV/IV/CV/SV/GRV/FV |

The table's SWAML column is our design judgment. The following paragraphs identify the source concepts and the choices drawn from them.

## AUTOSAR Classic

Classic's application, RTE and basic-software layers separate application software from its integration infrastructure. Its virtual functional bus uses dedicated ports. The software-component template distinguishes sender–receiver data and operation-oriented client–server communication; runnable activation links interface activity to executable behavior. [Classic Platform overview](https://www.autosar.org/standards/classic-platform/), [Software Component Template, R21-11](https://www.autosar.org/fileadmin/standards/R21-11/CP/AUTOSAR_TPS_SoftwareComponentTemplate.pdf), [R19-11 runnable/operation specification](https://www.autosar.org/fileadmin/standards/R19-11/CP/AUTOSAR_TPS_SoftwareComponentTemplate.pdf).

**SWAML inference:** retain strict port contracts and explicit activation, but make them platform-neutral. A unit is not automatically a runnable, and a component is not automatically an AUTOSAR atomic SWC. A Classic backend could map a suitable unit operation to a runnable, `on every` to timing activation and `on call` to operation activation, subject to target restrictions. WCET and queue semantics must survive the mapping.

**Do not infer:** SWAML does not supply RTE generation, ECU extract completeness, BSW configuration or ARXML conformance. A valid SWAML model may need additional target constraints before export.

## AUTOSAR Adaptive

Adaptive communication management distinguishes service methods, events and fields, with proxy/skeleton roles and subscription behavior. That separation is useful for a contract that contains both RPC and asynchronous notification. [Communication Management, R21-11](https://www.autosar.org/fileadmin/standards/R21-11/AP/AUTOSAR_SWS_CommunicationManagement.pdf), [Communication Management, R19-11](https://www.autosar.org/fileadmin/standards/R19-11/AP/AUTOSAR_SWS_CommunicationManagement.pdf).

**SWAML inference:** a `service` interface combines operation and event members; requires/provides ports capture consumer/provider roles. A field is explicitly represented by getter, setter and changed-event members, with storage private to the provider. Separate `publishSubscribe` contracts also support event-only architecture without forcing an RPC service.

**Do not infer:** a combined service connector is not automatically SOME/IP, DDS, ara::com, discovery configuration or an Adaptive manifest. Dynamic discovery and subscription lifecycle are deferred rather than approximated by undocumented behavior. Adapter units provide explicit mappings between Classic-style data and service events.

## UML

UML supplies rich structural and behavioral modeling: components, interfaces, ports, operations, activities, state machines and interactions. Its breadth permits many modeling styles; a software-architecture discipline must choose which relationships constitute legal runtime exchange. [OMG UML 2.5.1](https://www.omg.org/spec/UML/2.5.1).

**SWAML inference:** preserve familiar components, operation signatures, state/flow and sequence concepts while making the communication boundary a language invariant. Replace free signals and arbitrary cross-object access with interface-member paths. Keep simple value types rather than importing the full UML class/object feature set.

“Unofficial UML 3.0” is a useful aspiration—modern textual software modeling on KerML—but not a version or compliance claim. SWAML is named independently and does not reuse UML certification marks.

## SysML 2.0 and KerML 1.0

SysML 2.0 uses KerML as its foundation and provides definition/usage modeling, typed features and behavior constructs. KerML offers general modeling elements suitable for a separate domain language. [SysML 2.0](https://www.omg.org/spec/SysML/2.0), [KerML 1.0](https://www.omg.org/spec/KerML/1.0).

**SWAML inference:** keep type versus occurrence and a common semantic foundation, but scope the authoring language to software. Operations and states live where they are used, removing a separate performer allocation from the user model. The [mapping contract](spec/05-kerml-mapping.md) states what kernel normalization must preserve; the reference Langium AST is not advertised as a conforming kernel implementation.

The existing Aliot view family supplies the navigation vocabulary. Its public guide describes Browser navigation and structural/behavioral views. SWAML preserves General, Interconnect, Case, Sequence and Grid views, removes geometry and combines flow/state views into FV. [Existing Aliot documentation](https://github.com/voidaliot/sysml-v2-vscext-release/blob/main/README.md).

SWAML 1.1 retains `component def` and `unit def` so reusable types remain visibly distinct from occurrences. A top-level component usage also supplies the closed execution root; no second `system` concept is needed. States remain directly inside their owning operation, distinguished by its initial-state declaration, rather than an extra authored `machine` wrapper. This reduces authoring vocabulary without changing interface boundaries or runtime state semantics.

## Additional architecture lessons

AADL emphasizes architecture-level analysis of performance-critical properties and real-time embedded systems. [SEI introduction to AADL](https://www.sei.cmu.edu/library/the-architecture-analysis-design-language-aadl-an-introduction/), [SEI control-systems modeling guide](https://www.sei.cmu.edu/library/developing-aadl-models-for-control-systems-a-practitioners-guide/).

**SWAML inference:** timing and deployment need first-class declarations, but an operation deadline is not evidence of schedulability. Keep the logical architecture and platform execution assumptions separate. A backend can translate suitable subsets to an analysis model rather than claim the small reference validator performs scheduling analysis.

For service and event-driven software, our design additionally makes queue capacity, overflow, duplicate delivery, partial publication and timeout uncertainty explicit. These are original SWAML semantic choices. An event broker is a modeled intermediary when its behavior matters. Local shared-memory coupling, hidden topic names and transport-specific callbacks cannot erase the interface boundary.

## Mapping examples and limits

| Source concept | Candidate SWAML representation | Additional evidence needed for an exporter |
| --- | --- | --- |
| Classic SW component composition | component definitions and instances | supported target categories and composition rules |
| Runnable | unit operation | activation, argument, task and scheduling mapping |
| S/R data element | sampled or queued data member | precise buffering and freshness correspondence |
| Client/server operation | interface operation + handler | error/result mapping, timeout and invocation policy |
| Adaptive method | service operation member | target method signature and middleware binding |
| Adaptive event | service event + publishing/receiving operation | subscription/delivery behavior |
| Service field | explicit read/write/change members | coherent state and notification protocol |
| UML activity | operation statement flow | subset restrictions and exception/concurrency mapping |
| UML state machine | stateful operation | flattening or rejection of unsupported hierarchy/regions |
| SysML part definition/usage | component/unit definition and instance | software-specific ownership interpretation |
| Physical/external endpoint | adapter unit with typed ports | how actual I/O enters the implementation |

## Decisions retained in 1.1

1. Unit is the smallest interface-protected software boundary. Pure local computation does not require a port.
2. Components compose; units execute. Do not make both own independent execution semantics.
3. Interface signatures are contracts; unit operations provide their implementation.
4. All message/data/event exchange names a local port and interface member.
5. Definitions are reusable, but behavior is owned directly where used. No performers.
6. Publish/subscribe is explicit and supports fan-out without assuming a particular broker.
7. A service can combine requests and events, but implicit fields are avoided.
8. State and flow share FV because both belong to operations.
9. A complete, bounded 1.1 language is preferable to undefined syntax for advanced features. Deferred constructs are listed in the implementation/roadmap documents.
10. Tool claims must distinguish parsing, validation, kernel mapping, execution and graphical editing.

## Source handling

Links point to the primary standards/publisher sources. Some AUTOSAR PDF endpoints intermittently failed full downloads during research; their official indexed material and platform pages were available. No standard PDF or proprietary template content is redistributed in this repository. The comparison intentionally focuses on the concepts described above rather than claiming exhaustive standard coverage.
