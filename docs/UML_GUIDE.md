# SWAML for UML architects

SWAML 1.3 supports familiar structural and behavioral modeling with explicit software boundaries. Start with components and their contracts, compose named parts, then inspect interaction and behavior. The reference for UML terminology is [OMG UML 2.5.1](https://www.omg.org/spec/UML/2.5.1). The correspondences below are modeling guidance, not a UML import format or conformance claim.

## Translate the modeling concepts

| Familiar UML concept | SWAML representation | Boundary to keep in mind |
| --- | --- | --- |
| Package | `package` and explicit imports | Package declarations form namespaces; imports are not transitive. |
| Component type | `component def` | Owns child composition, ports, private values and functions; functions own calculations. |
| Part / typed occurrence | `component name: Type;` | Each expanded component occurrence owns separate private state. |
| Generalization / redefinition | `specializes` and `redefines` | Single component specialization with explicit compatible member replacement. |
| Interface | Versioned interface with member signatures | Exact nominal identity; structural similarity does not establish compatibility. |
| Provided / required interface | Service ports with `provides` / `requires` | Other interface kinds use sender/receiver, client/server or publisher/subscriber. |
| Assembly connector | Named `connect` between child ports | Select a complete QoS policy; the arrow identifies the contract orientation. |
| Delegation connector | `delegate outer -> child.port` | Same role and contract; no conversion, additional queue or independent behavior. |
| Operation implementation | Component function bound with `on call port.member` | Signature declaration and implementation have distinct owners. |
| Signal reception | Interface event and `on receive port.member` | Events are contract members; there are no free signals or hidden event buses. |
| Activity | Function statement body, shown in fv | Structured conditionals and bounded loops; no fork/join tokens or activity allocation. |
| State machine | States directly inside a function, shown in fv | Flat states, entry/exit, guarded transitions; no orthogonal or hierarchical regions. |
| Interaction / sequence diagram | `case` exchanges shown in sv | Explicit dependency order and routes; a case is not automatically executed as a test. |
| Use case | Case View (cv) is the nearest navigation surface | A SWAML case specifies exchanges for one root; actors, include and extend are absent. |
| Datatype / enumeration | `datatype` / `enum` | Copied nominal values; neither classes nor references to remote objects. |
| Deployment | External system/part references in `deploy` bindings | Allocation metadata does not prove physical schedulability. |

The diagram labels `«component def»`, `«component»` and `«interface»` name SWAML concepts. They do not declare UML stereotypes. Rectangular compartments, typed names, square boundary ports, explicit connectors, sequence lifelines, decisions and states provide a familiar reading vocabulary. All drawings are flat. The [notation chapter](GRAPHICAL_NOTATION.md) defines the exact vocabulary.

## Choose the interface by interaction

| Architectural need | Kind and roles | Example |
| --- | --- | --- |
| Retain individual accepted values | senderReceiver: sender → receiver; queued member | [Greeting](../examples/01-hello.swaml) |
| Retain the latest pending measurement | senderReceiver: sender → receiver; sampled member | [Controller](../examples/02-realtime-controller.swaml) |
| Call a function and await a result | clientServer: client → server | [Health check](../examples/07-client-server.swaml) |
| Publish typed events to explicit subscribers | publishSubscribe: publisher → subscriber | [Audit publication](../examples/03-service-pubsub.swaml) |
| Expose functions and notifications together | service: requires → provides | [Temperature setting](../examples/08-service-field.swaml) |

The [interactive interface reference](../showcase/README.md) displays all five patterns from these exact sources. A source/target arrow is not a statement that all traffic is one-way: RPC replies return on the correlated route, and service events travel from provides to requires. Sampled data is a queued value transfer with capacity one and dropOldest, not shared-memory access. The full direction and cardinality rules are in [chapter 2](spec/02-communication.md).

Separate contracts when parts need different membership, policies or lifecycles. An interface containing sampled and queued members applies the same capacity-one policy to both. A consumer of a service must implement all of its incoming events; there is no implicit partial implementation. Use an adapter component to translate between contracts and versions.

## Build the model incrementally

1. Declare value types and interface signatures. Contract-only packages are valid reusable libraries.
2. Define component boundaries and implement their handlers and emitters. Every incoming member needs one handler owner; an empty implementation stub is not evidence of behavior.
3. Compose components into reusable component definitions. Expose boundaries through same-role delegation. A library definition can leave ports awaiting its eventual context.
4. Instantiate an inline or typed root. Closure is checked for each concrete root, including expanded library parts. Every nonoptional port must be connected; optionality does not waive handlers or provenance.
5. Select a named complete QoS policy for each connector. Choose delivery and overflow deliberately; reliability does not establish handler success or exactly-once effects.
6. Add cases and views to explain the architecture. Add deployment and timing when the target question requires them; distinguish declared bounds from execution evidence.

Begin with [the complete greeting model](../examples/01-hello.swaml), then compare [reusable policy syntax](../examples/10-reusable-qos.swaml). Headerless files require a host explicitly pinned to 1.2. The [user guide](USER_GUIDE.md) contains validation commands.

## Read the seven surfaces

| Surface | Architectural question | UML reading aid |
| --- | --- | --- |
| Browser | What is declared, owned or instantiated? | Model explorer; definition and occurrence paths are separate. |
| gv | Which parts compose this architecture? | Structural overview and containment. |
| iv | Which contracts connect the parts? | Ports, assembly and delegation. |
| cv | Which cases claim requirement coverage? | Scenario navigation; narrower than use-case modeling. |
| sv | Which exchanges depend on which others? | Lifelines and typed messages; visual height alone adds no order. |
| grv | What are the exact properties and bindings? | Model table and property inspection. |
| fv | How does this function execute? | Structured flow or a flat state machine owned by the function. |

## Deliberate language limits

SWAML 1.3 supports single component specialization and compatible explicit member redefinition. It has no separate class construct, association classes, arbitrary multiplicities, dynamic creation, generics or cross-component attribute access. A part declaration denotes one occurrence; multiple instances are explicit declarations. These omissions keep ownership, closure and queue identity checkable. Do not emulate missing constructs by drawing untyped association lines or treating the same definition as shared state.

The core uses components for both composition and local behavior, functions for executable flow/states, and calculations for pure expressions. Complete-value `qos def` reuse, default service profiles and omitted void results reduce repetition. Additional aliases such as class, signal or machine would need semantics and migration rules; they are not introduced merely for familiar spelling. The [implementation matrix](IMPLEMENTATION_STATUS.md) separates implemented validation and simulation from future graphical authoring, KerML mapping and production execution.
