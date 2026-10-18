# SWAML for UML architects

SWAML 1.3 supports familiar structural and behavioral modeling with explicit software boundaries. Start with classes or components and their contracts, compose named usages, then inspect operations/functions and interaction. Component specializes Class; Function specializes Operation. Both pairs retain the same bounded ownership and execution rules. The reference for UML terminology is [OMG UML 2.5.1](https://www.omg.org/spec/UML/2.5.1). The correspondences below are modeling guidance, not a UML import format or conformance claim.

The [UML transformation reassessment](UML_COMPATIBILITY.md) distinguishes current notation from semantic conversion. Flat class/component frames, operation/function compartments and clientServer/service ball/socket are SWAML notation. No UML importer, exporter or XMI adapter is implemented or proposed by this release. [ADR 0014](decisions/0014-classes-operations-and-uml-notation.md) records the language hierarchy.

## Translate the modeling concepts

| Familiar UML concept | SWAML representation | Boundary to keep in mind |
| --- | --- | --- |
| Package | `package` and explicit imports | Package declarations form namespaces; imports are not transitive. |
| Class / component type | `class def` / `component def` | Component specializes Class; both own composition, ports, private values and operations/functions. |
| Part / typed occurrence | `class name: Type;` / `component name: Type;` | Class accepts either definition kind; component requires component type. Every usage has separate private state. |
| Generalization / redefinition | `specializes` and `redefines` | Single specialization with compatible member replacement; class cannot inherit component, and component/function kinds cannot be widened by redefinition. |
| Interface | Versioned interface with member signatures | Exact nominal identity; structural similarity does not establish compatibility. |
| Provided / required interface | Ball at server/provides; socket at client/requires, attached to typed ports | Applies to clientServer and service; reverse replies/events retain their route. Other kinds keep their own directed notation. |
| Assembly connector | Named `connect` between child ports | Select a complete QoS policy; the arrow identifies the contract orientation. |
| Delegation connector | `delegate outer -> child.port` | Same role and contract; no conversion, additional queue or independent behavior. |
| Local operation implementation | Untriggered operation/function invoked with local `call` | Calls remain inside the owning component; parameters and results are copied. |
| Provided operation implementation | Operation/function bound with `on call port.member` | Signature and implementation have distinct owners; function signatures require function handlers, while operation signatures permit either kind. Remote calls need a typed route. |
| Signal reception | Interface event and `on receive port.member` | Events are contract members; there are no free signals or hidden event buses. |
| Activity | Operation/function statement body, shown in fv | Structured conditionals and bounded loops; no fork/join tokens or activity allocation. |
| State machine | States directly inside an operation/function, shown in fv | Flat states, entry/exit, guarded transitions; no orthogonal or hierarchical regions. |
| Interaction / sequence diagram | Exchanges in `useCase` or `verificationCase`, shown in sv | Explicit partial order and routes; a case is not automatically executed as a test. |
| Use case | `useCase Name of Root` and Case View (cv) | Describes intended use of one root, with optional routed exchanges; actors, include and extend are absent. |
| Verification case | `verificationCase Name of Root` and explicit `verify` links | Records verification intent and optional exchanges; links do not establish passed verification. |
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

Begin with [the complete greeting model](../examples/01-hello.swaml), then compare [reusable policy syntax](../examples/10-reusable-qos.swaml). Headerless files require an explicitly selected 1.3 parser/host. Reproducible runs also pin the package revision; revision 1.3.1 retains parser family 1.3. The [user guide](USER_GUIDE.md) contains validation commands.

## Read Browser and the seven views

| Surface | Architectural question | UML reading aid |
| --- | --- | --- |
| Browser | What is declared, owned or instantiated? | Model explorer; definition and occurrence paths are separate. |
| gv | Which parts compose this architecture? | Structural overview and containment. |
| iv | Which contracts connect the parts? | Ports, assembly and delegation. |
| cv | Which use and verification cases describe this root? | Case intent and explicit verification claims; narrower than UML use-case modeling. |
| sv | Which exchanges depend on which others? | Lifelines and typed messages; visual height alone adds no order. |
| grv | What are the exact properties and bindings? | Model table and property inspection. |
| fv | How does this operation/function execute? | Structured flow or a flat state machine owned by the function. |
| tv | What timing is declared or observed for this operation/function? | Declared contracts are separate from observations in an identified execution trace. |

## Choosing the vocabulary

Use `class` for a general software type or usage and `component` when the specialized architectural boundary is intended. Both may own private data, child usages, ports and executable behavior. Use `operation` for general executable behavior and `function` for its specialized kind. Both may own calculations, flow or states; both use local calls and typed remote routes. Function does not mean pure: use `calc` for a pure input-only expression.

A component definition may specialize a class or component; class definitions specialize classes only. An operation may be redefined as a compatible function, and a class usage may be narrowed to a compatible component usage. Reverse widening is invalid. The authored kinds remain visible in diagrams, Browser and properties.

View kind filters are exact. To select both executable alternatives, use `kind == "operation" or kind == "function"`; to select both structural alternatives, use `kind == "class" or kind == "component"`. IV accepts both structural kinds, and FV/TV accept both executable kinds.

## Deliberate language limits

SWAML classes have separate stores and explicit single ownership. They do not add shared heap objects, association classes, arbitrary multiplicities, dynamic creation, generics or cross-owner attribute access. A usage declaration denotes one occurrence; repeated usages are explicit declarations. Class instances remain distinct from copied `datatype` values. All communication between owners retains ports, nominal interfaces and explicit routes.

Operations and functions share serial locks, snapshots, copied parameters/results, event provenance and timing obligations. Named `qos def` reuse, default service profiles and omitted void results reduce repetition. Existing component/function models retain their meaning; the new vocabulary does not silently import UML token flow, object references or unrestricted OCL. The [implementation matrix](IMPLEMENTATION_STATUS.md) separates current validation and simulation from future graphical authoring, KerML export and UML transformation.
