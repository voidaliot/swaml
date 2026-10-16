# Canonical graphical notation catalog

SWAML 1.2 · publication 1.2.0. This generated catalog defines the original monochrome notation for each authored concept and meaningful label group. All specimens derive from [the semantic inventory](../spec/notation.json); complete examples supply their validation context.

Each SVG, PNG and vector scene shares the same flat two-dimensional geometry, without perspective, extrusion, gradients or shadows. A graphical specimen is a projection of its textual model; it does not create additional ports, events, state owners or execution semantics. Labels such as QoS values and expression operators appear within their owning element rather than introducing independent nodes.

The following fragments are contextual notation samples, not standalone SWAML files. `def` identifies reusable component types; a root is an instance selected for execution.

## Concept index

- [Assertion](#notation-assert) — Function flow.
- [Assignment](#notation-assignment) — Function flow.
- [Boundary delegation](#notation-delegation) — Interfaces and connections.
- [Bounded loop](#notation-bounded-loop) — Function flow.
- [Browser](#notation-view-browser) — View projections.
- [Case causal order](#notation-case-causal-order) — Cases and evidence.
- [Case data exchange](#notation-case-data-exchange) — Cases and evidence.
- [Case event exchange](#notation-case-event-exchange) — Cases and evidence.
- [Case request](#notation-case-request) — Cases and evidence.
- [Case View](#notation-view-cv) — View projections.
- [Client–server interface](#notation-client-server-interface) — Interfaces and connections.
- [Completion transition](#notation-completion-transition) — Function states.
- [Component definition](#notation-component-definition) — Structure and values.
- [Component specialization](#notation-component-specialization) — Structure and values.
- [Component usage](#notation-component-usage) — Structure and values.
- [Concurrency mode](#notation-concurrency-mode) — Timing and deployment.
- [Conditional branch](#notation-conditional) — Function flow.
- [Correlated case reply](#notation-case-reply) — Cases and evidence.
- [Data member](#notation-data-member) — Interfaces and connections.
- [Data receiver port](#notation-port-receiver) — Interfaces and connections.
- [Data send](#notation-send) — Function flow.
- [Data sender port](#notation-port-sender) — Interfaces and connections.
- [Delivery policy](#notation-delivery-policy) — Interfaces and connections.
- [Deployment binding](#notation-deployment) — Timing and deployment.
- [Duration value](#notation-duration) — Timing and deployment.
- [Enumeration](#notation-enumeration) — Structure and values.
- [Enumeration value](#notation-enum-value) — Structure and values.
- [Event member](#notation-event-member) — Interfaces and connections.
- [Event publication](#notation-publish) — Function flow.
- [Event publisher port](#notation-port-publisher) — Interfaces and connections.
- [Event subscriber port](#notation-port-subscriber) — Interfaces and connections.
- [Executable function](#notation-function) — Function flow.
- [Expressions and value paths](#notation-expression) — Structure and values.
- [External deployment target](#notation-deployment-target) — Timing and deployment.
- [Failure](#notation-fail) — Function flow.
- [Filtered view selection](#notation-view-selection) — Cases and evidence.
- [Final state](#notation-final-state) — Function states.
- [Fixed array type and value](#notation-array-value) — Structure and values.
- [Flow View](#notation-view-fv) — View projections.
- [Formal documentation](#notation-formal-documentation) — Cases and evidence.
- [Function return](#notation-return) — Function flow.
- [Function timing contract](#notation-timing-contract) — Timing and deployment.
- [Function with states](#notation-stateful-function) — Function states.
- [General View](#notation-view-gv) — View projections.
- [Grid View](#notation-view-grv) — View projections.
- [Initial state reference](#notation-initial-state) — Function states.
- [Inline root composition](#notation-inline-root) — Structure and values.
- [Interconnect View](#notation-view-iv) — View projections.
- [Interface connector](#notation-connector) — Interfaces and connections.
- [Interface function signature](#notation-function-signature) — Interfaces and connections.
- [Local declaration](#notation-local-declaration) — Function flow.
- [Local function call](#notation-local-call) — Function flow.
- [Manual activation](#notation-trigger-manual) — Function flow.
- [Member redefinition](#notation-member-redefinition) — Structure and values.
- [Message freshness bound](#notation-freshness-bound) — Interfaces and connections.
- [Named connector policy](#notation-qos-policy-reference) — Interfaces and connections.
- [Occurrence lifeline](#notation-sequence-lifeline) — Cases and evidence.
- [Occurrence typing relationship](#notation-type-relationship) — Structure and values.
- [Optional port](#notation-optional-port) — Interfaces and connections.
- [Ordinary comment](#notation-ordinary-comment) — Cases and evidence.
- [Overflow behavior](#notation-overflow-policy) — Interfaces and connections.
- [Package](#notation-package) — Structure and values.
- [Package import](#notation-import) — Structure and values.
- [Parameter or record field](#notation-parameter) — Structure and values.
- [Periodic activation](#notation-trigger-periodic) — Function flow.
- [Port receive activation](#notation-trigger-receive) — Function flow.
- [Primitive types](#notation-primitive-types) — Structure and values.
- [Private component variable](#notation-private-variable) — Structure and values.
- [Publish–subscribe interface](#notation-publish-subscribe-interface) — Interfaces and connections.
- [Pure calculation](#notation-calculation) — Function flow.
- [Queue capacity](#notation-capacity-policy) — Interfaces and connections.
- [Queue ordering](#notation-ordering-policy) — Interfaces and connections.
- [Record construction](#notation-record-value) — Structure and values.
- [Record datatype](#notation-datatype) — Structure and values.
- [Requirement](#notation-requirement) — Cases and evidence.
- [Requirement attribute](#notation-requirement-attribute) — Cases and evidence.
- [Residence timer transition](#notation-timer-transition) — Function states.
- [Reusable QoS policy](#notation-qos-policy-definition) — Interfaces and connections.
- [Root component](#notation-root-component) — Structure and values.
- [Root execution profile](#notation-execution-profile) — Timing and deployment.
- [Routed function call](#notation-routed-call) — Function flow.
- [RPC client port](#notation-port-client) — Interfaces and connections.
- [RPC handler activation](#notation-trigger-call) — Function flow.
- [RPC server port](#notation-port-server) — Interfaces and connections.
- [Satisfaction relation](#notation-satisfies-link) — Cases and evidence.
- [Sender–receiver interface](#notation-sender-receiver-interface) — Interfaces and connections.
- [Sequence View](#notation-view-sv) — View projections.
- [Service consumer port](#notation-port-requires) — Interfaces and connections.
- [Service interface](#notation-service-interface) — Interfaces and connections.
- [Service provider port](#notation-port-provides) — Interfaces and connections.
- [Startup activation](#notation-trigger-start) — Function flow.
- [State](#notation-state) — Function states.
- [State entry behavior](#notation-state-entry) — Function states.
- [State exit behavior](#notation-state-exit) — Function states.
- [State transition](#notation-transition) — Function states.
- [Transition guard](#notation-transition-guard) — Function states.
- [Transition priority](#notation-transition-priority) — Function states.
- [Transport latency bound](#notation-latency-bound) — Interfaces and connections.
- [Use case](#notation-case) — Cases and evidence.
- [Verification case](#notation-verification-case) — Cases and evidence.
- [Verification relation](#notation-verification-link) — Cases and evidence.

## Cases and evidence

## Notation: case-causal-order

**Case causal order**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Case causal order (edge) | ![Case causal order](notation/case-causal-order.svg) | `after sent label answered` |

Case causal order. Draw an explicitly labeled after dependency between step labels, or show the predecessor in the arrow label.

**Context:** Dependency fragment of Rpc::Poll’s reply step. **Views:** cv, sv.

- Draw an explicitly labeled after dependency between step labels, or show the predecessor in the arrow label.
- Unrelated steps remain unordered; source order and vertical placement are layout choices, not happens-before edges.

[Complete model](../examples/07-client-server.swaml) · `Rpc::Poll`.

[SVG](notation/case-causal-order.svg) · [PNG](notation/case-causal-order.png) · [Vector scene](notation/case-causal-order.scene.json)

## Notation: case-data-exchange

**Case data exchange**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Case data exchange (edge) | ![Case data exchange](notation/case-data-exchange.svg) | `send source.output.value -> sink.input.value via counts label sent;` |

Case data exchange. Draw a sequence arrow between occurrence lifelines labeled send, port.member paths, connector and step label.

**Context:** Step in Notation::Observe; source and destination are immediate child port/member paths. **Views:** cv, sv.

- Draw a sequence arrow between occurrence lifelines labeled send, port.member paths, connector and step label.
- The arrow projects an existing sender–receiver route; it creates neither a free event nor a connector by itself.

[Complete model](../examples/notation/catalog.swaml) · `Notation::Observe`.

[SVG](notation/case-data-exchange.svg) · [PNG](notation/case-data-exchange.png) · [Vector scene](notation/case-data-exchange.scene.json)

## Notation: case-event-exchange

**Case event exchange**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Case event exchange (edge) | ![Case event exchange](notation/case-event-exchange.svg) | `publish settings.api.changed -> front.setting.changed via frontLink after adjust label frontNotice;` |

Case event exchange. Draw a publication arrow labeled publish and the exact connector/member, retaining its step identity.

**Context:** Step in Settings::Change, using the reverse event direction of a service route. **Views:** cv, sv.

- Draw a publication arrow labeled publish and the exact connector/member, retaining its step identity.
- For service contracts events travel provider-to-consumer; line orientation follows that role even when opposite the connector’s request orientation.

[Complete model](../examples/08-service-field.swaml) · `Settings::Change`.

[SVG](notation/case-event-exchange.svg) · [PNG](notation/case-event-exchange.png) · [Vector scene](notation/case-event-exchange.scene.json)

## Notation: case-request

**Case request**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Case request (edge) | ![Case request](notation/case-request.svg) | `call caller.health.check -> serviceUnit.health.check via healthCheck label sent;` |

Case request. Draw a request arrow between occurrence lifelines, labeled the member, connector and step identity.

**Context:** Routed call step in Rpc::Poll. **Views:** cv, sv.

- Draw a request arrow between occurrence lifelines, labeled the member, connector and step identity.
- Its later reply must be uniquely correlated by case ancestry and route/member; vertical spacing does not create that relationship.

[Complete model](../examples/07-client-server.swaml) · `Rpc::Poll`.

[SVG](notation/case-request.svg) · [PNG](notation/case-request.png) · [Vector scene](notation/case-request.scene.json)

## Notation: case-reply

**Correlated case reply**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Correlated case reply (edge) | ![Correlated case reply](notation/case-reply.svg) | `reply serviceUnit.health.check -> caller.health.check via healthCheck after sent label answered;` |

Correlated case reply. Draw a dashed reply arrow reversing the matching request route and label its step identity and correlation.

**Context:** Reply step in Rpc::Poll; after sent identifies its causal request ancestor. **Views:** cv, sv.

- Draw a dashed reply arrow reversing the matching request route and label its step identity and correlation.
- A reply cannot be matched by visual proximity alone; preserve the unique causal request ancestor.

[Complete model](../examples/07-client-server.swaml) · `Rpc::Poll`.

[SVG](notation/case-reply.svg) · [PNG](notation/case-reply.png) · [Vector scene](notation/case-reply.scene.json)

## Notation: view-selection

**Filtered view selection**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Filtered view selection (projection) | ![Filtered view selection](notation/view-selection.svg) | `include Demo recursive where kind == "component";` |

Show the selected occurrence paths within the named view frame. Combine include clauses as a stable union; filters do not alter model ownership or execution.

**Context:** Owned source element in the Assurance example. **Views:** gv, grv, cv.

- Show the selected occurrence paths within the named view frame.
- Combine include clauses as a stable union; filters do not alter model ownership or execution.

[Complete model](../examples/16-requirements-and-views.swaml) · `Assurance::assurance`.

[SVG](notation/view-selection.svg) · [PNG](notation/view-selection.png) · [Vector scene](notation/view-selection.scene.json)

## Notation: formal-documentation

**Formal documentation**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Formal documentation (compartment) | ![Formal documentation](notation/formal-documentation.svg) | `doc /* Every started worker shall store a result of 2. */` |

Draw one labeled doc compartment or one doc table cell for the owner. Keep multiline formal text distinct from ordinary comment notes.

**Context:** Owned source element in the Assurance example. **Views:** gv, grv, cv.

- Draw one labeled doc compartment or one doc table cell for the owner.
- Keep multiline formal text distinct from ordinary comment notes.

[Complete model](../examples/16-requirements-and-views.swaml) · `Assurance::BoundedResult`.

[SVG](notation/formal-documentation.svg) · [PNG](notation/formal-documentation.png) · [Vector scene](notation/formal-documentation.scene.json)

## Notation: sequence-lifeline

**Occurrence lifeline**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Occurrence lifeline (node) | ![Occurrence lifeline](notation/sequence-lifeline.svg) | `component caller: Caller;` |

Occurrence lifeline. Draw a lifeline headed by the occurrence name: Type and a dashed vertical line.

**Context:** Occurrence in Rpc::HealthCheck used as a sequence lifeline. **Views:** cv, sv.

- Draw a lifeline headed by the occurrence name: Type and a dashed vertical line.
- A lifeline identifies an existing component occurrence; an actor/performer glyph MUST NOT replace a modeled communication boundary.

[Complete model](../examples/07-client-server.swaml) · `Rpc::HealthCheck.caller`.

[SVG](notation/sequence-lifeline.svg) · [PNG](notation/sequence-lifeline.png) · [Vector scene](notation/sequence-lifeline.scene.json)

## Notation: ordinary-comment

**Ordinary comment**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Ordinary comment (node) | ![Ordinary comment](notation/ordinary-comment.svg) | `// Each instance has its own result.` |

Draw a plain rectangular note inside its owner or connected by a plain dashed line. Each line comment and each block comment remains separate; there is no comment keyword.

**Context:** Owned source element in the Assurance example. **Views:** gv, grv, cv.

- Draw a plain rectangular note inside its owner or connected by a plain dashed line.
- Each line comment and each block comment remains separate; there is no comment keyword.

[Complete model](../examples/16-requirements-and-views.swaml) · `Assurance::Worker`.

[SVG](notation/ordinary-comment.svg) · [PNG](notation/ordinary-comment.png) · [Vector scene](notation/ordinary-comment.scene.json)

## Notation: requirement

**Requirement**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Requirement (node) | ![Requirement](notation/requirement.svg) | `requirement LimitedDuty { doc /* Applied duty shall be at most 0.8. */ }` |

A named obligation with typed attributes and one optional formal specification.

**Context:** Requirement declaration in Control. **Views:** gv, cv, grv.

- Draw a flat requirement rectangle with its name, optional attributes and one doc compartment.
- A requirement has no subject; satisfaction and verification are separate relations.

[Complete model](../examples/02-realtime-controller.swaml) · `Control::LimitedDuty`.

[SVG](notation/requirement.svg) · [PNG](notation/requirement.png) · [Vector scene](notation/requirement.scene.json)

## Notation: requirement-attribute

**Requirement attribute**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Requirement attribute (compartment) | ![Requirement attribute](notation/requirement-attribute.svg) | `attribute priority: uint = 1;` |

Display immutable typed metadata in an attribute compartment or table cell. Names are unique within their requirement; metadata is not runtime state.

**Context:** Owned source element in the Assurance example. **Views:** gv, grv, cv.

- Display immutable typed metadata in an attribute compartment or table cell.
- Names are unique within their requirement; metadata is not runtime state.

[Complete model](../examples/16-requirements-and-views.swaml) · `Assurance::BoundedResult`.

[SVG](notation/requirement-attribute.svg) · [PNG](notation/requirement-attribute.png) · [Vector scene](notation/requirement-attribute.scene.json)

## Notation: satisfies-link

**Satisfaction relation**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Satisfaction relation (edge) | ![Satisfaction relation](notation/satisfies-link.svg) | `satisfy VisibleSetting by Cabin;` |

Design claims satisfaction of a requirement.

**Context:** Package-owned design-to-requirement relation. **Views:** cv, sv.

- Draw a dashed open arrow from the design element to the requirement, labeled satisfy.
- A satisfaction claim does not establish verification evidence.

[Complete model](../examples/08-service-field.swaml) · `Settings`.

[SVG](notation/satisfies-link.svg) · [PNG](notation/satisfies-link.png) · [Vector scene](notation/satisfies-link.scene.json)

## Notation: case

**Use case**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Use case (node) | ![Use case](notation/case.svg) | `useCase Change for Cabin` |

A use case describes intended use and routed exchanges.

**Context:** Scenario header in Settings; steps reference Cabin’s root-level connectors. **Views:** cv, sv.

- Draw a case frame labeled useCase with its name and selected root.
- The for relation references a root; enclosure never changes package ownership.

[Complete model](../examples/08-service-field.swaml) · `Settings::Change`.

[SVG](notation/case.svg) · [PNG](notation/case.png) · [Vector scene](notation/case.scene.json)

## Notation: verification-case

**Verification case**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Verification case (node) | ![Verification case](notation/verification-case.svg) | `verificationCase CheckResults for Demo` |

Draw a case frame labeled verificationCase with its name and root context. Documentation describes the procedure; verify links identify requirements without asserting a passed result.

**Context:** Owned source element in the Assurance example. **Views:** gv, grv, cv.

- Draw a case frame labeled verificationCase with its name and root context.
- Documentation describes the procedure; verify links identify requirements without asserting a passed result.

[Complete model](../examples/16-requirements-and-views.swaml) · `Assurance::CheckResults`.

[SVG](notation/verification-case.svg) · [PNG](notation/verification-case.png) · [Vector scene](notation/verification-case.scene.json)

## Notation: verification-link

**Verification relation**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Verification relation (edge) | ![Verification relation](notation/verification-link.svg) | `verify BoundedResult;` |

Draw a dashed open arrow from the verification case to the requirement, labeled verify. A relation expresses verification intent; evidence and outcome are recorded separately.

**Context:** Owned source element in the Assurance example. **Views:** gv, grv, cv.

- Draw a dashed open arrow from the verification case to the requirement, labeled verify.
- A relation expresses verification intent; evidence and outcome are recorded separately.

[Complete model](../examples/16-requirements-and-views.swaml) · `Assurance::CheckResults`.

[SVG](notation/verification-link.svg) · [PNG](notation/verification-link.png) · [Vector scene](notation/verification-link.scene.json)


## Function flow

## Notation: assert

**Assertion**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Assertion (node) | ![Assertion](notation/assert.svg) | `assert accepted;` |

Assertion. Draw an owned statement box with the exact statement label and directed control-flow succession.

**Context:** Statement inside the displayed owning function; the fv node is a projection. **Views:** fv.

- Draw an owned statement box with the exact statement label and directed control-flow succession.
- False fails the activation; this step is an execution check, not proof of a requirement.

[Complete model](../examples/08-service-field.swaml) · `Settings::Panel.adjust`.

[SVG](notation/assert.svg) · [PNG](notation/assert.png) · [Vector scene](notation/assert.scene.json)

## Notation: assignment

**Assignment**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Assignment (node) | ![Assignment](notation/assignment.svg) | `i = i + 1;` |

Assignment. Draw an owned statement box with the exact statement label and directed control-flow succession.

**Context:** Statement inside the displayed owning function; the fv node is a projection. **Views:** fv.

- Draw an owned statement box with the exact statement label and directed control-flow succession.
- Replaces an existing permitted whole value; a field path or another component is not an assignment target.

[Complete model](../examples/05-values-and-flow.swaml) · `Values::Producer.prepare`.

[SVG](notation/assignment.svg) · [PNG](notation/assignment.png) · [Vector scene](notation/assignment.scene.json)

## Notation: bounded-loop

**Bounded loop**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Bounded loop (node) | ![Bounded loop](notation/bounded-loop.svg) | `while (i < 3) bound 3` |

Bounded loop. Draw a loop frame with explicit while condition and positive bound label, and a return control edge for iteration.

**Context:** Loop header in Values::Producer.prepare; the body is rendered as the loop compartment. **Views:** fv.

- Draw a loop frame with explicit while condition and positive bound label, and a return control edge for iteration.
- The bound is semantic, not decoration; a still-true condition after the limit leads to failure rather than silent completion.

[Complete model](../examples/05-values-and-flow.swaml) · `Values::Producer.prepare`.

[SVG](notation/bounded-loop.svg) · [PNG](notation/bounded-loop.png) · [Vector scene](notation/bounded-loop.scene.json)

## Notation: conditional

**Conditional branch**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Conditional branch (node) | ![Conditional branch](notation/conditional.svg) | `if (duty > 0.8) { send output.duty(0.8); } else { send output.duty(duty); }` |

Conditional branch. Draw a decision diamond with the bool condition and distinct true/false control exits, followed by a merge when control continues.

**Context:** If/else statement in Control::Regulator.regulate. **Views:** fv.

- Draw a decision diamond with the bool condition and distinct true/false control exits, followed by a merge when control continues.
- Exactly one branch executes; the diamond is an if-statement projection, not an independent behavior definition.

[Complete model](../examples/02-realtime-controller.swaml) · `Control::Regulator.regulate`.

[SVG](notation/conditional.svg) · [PNG](notation/conditional.png) · [Vector scene](notation/conditional.scene.json)

## Notation: send

**Data send**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Data send (node) | ![Data send](notation/send.svg) | `send output.text("Hello, SWAML");` |

Data send. Draw an owned statement box with the exact statement label and directed control-flow succession.

**Context:** Statement inside the displayed owning function; the fv node is a projection. **Views:** fv.

- Draw an owned statement box with the exact statement label and directed control-flow succession.
- The text identifies the emitting function’s owned sender port and data member.

[Complete model](../examples/01-hello.swaml) · `Hello::Speaker.greet`.

[SVG](notation/send.svg) · [PNG](notation/send.png) · [Vector scene](notation/send.scene.json)

## Notation: publish

**Event publication**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Event publication (node) | ![Event publication](notation/publish.svg) | `publish api.changed(currentValue);` |

Event publication. Draw an owned statement box with the exact statement label and directed control-flow succession.

**Context:** Statement inside the displayed owning function; the fv node is a projection. **Views:** fv.

- Draw an owned statement box with the exact statement label and directed control-flow succession.
- The text identifies the emitting function’s owned publisher/provider port and event member.

[Complete model](../examples/08-service-field.swaml) · `Settings::SettingStore.update`.

[SVG](notation/publish.svg) · [PNG](notation/publish.png) · [Vector scene](notation/publish.scene.json)

## Notation: function

**Executable function**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Executable function (node) | ![Executable function](notation/function.svg) | `function greet() on start` |

Executable function. Draw an function frame or compartment with its name, ordered parameters, result and activation label.

**Context:** Header of Hello::Speaker.greet; its statement body is projected inside the function frame. **Views:** fv.

- Draw an function frame or compartment with its name, ordered parameters, result and activation label.
- Every fv step is an owned statement projection within this frame; it MUST NOT create an independently allocated action or performer.

[Complete model](../examples/01-hello.swaml) · `Hello::Speaker.greet`.

[SVG](notation/function.svg) · [PNG](notation/function.png) · [Vector scene](notation/function.scene.json)

## Notation: fail

**Failure**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Failure (node) | ![Failure](notation/fail.svg) | `fail "setting unavailable";` |

Failure. Draw an owned statement box with the exact statement label and directed control-flow succession.

**Context:** Statement inside the displayed owning function; the fv node is a projection. **Views:** fv.

- Draw an owned statement box with the exact statement label and directed control-flow succession.
- Failure unwinds the activation without rollback; it does not imply an unmodeled broadcast.

[Complete model](../examples/08-service-field.swaml) · `Settings::Panel.adjust`.

[SVG](notation/fail.svg) · [PNG](notation/fail.png) · [Vector scene](notation/fail.scene.json)

## Notation: return

**Function return**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Function return (node) | ![Function return](notation/return.svg) | `return true;` |

Function return. Show a labeled return terminal in the owning function flow; retain the returned expression when present.

**Context:** Return statement in Rpc::Server.checkHealth. **Views:** fv.

- Show a labeled return terminal in the owning function flow; retain the returned expression when present.
- Return from a helper resumes its local caller; return from a state body terminates the owning stateful function.

[Complete model](../examples/07-client-server.swaml) · `Rpc::Server.checkHealth`.

[SVG](notation/return.svg) · [PNG](notation/return.png) · [Vector scene](notation/return.scene.json)

## Notation: local-declaration

**Local declaration**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Local declaration (node) | ![Local declaration](notation/local-declaration.svg) | `var i: int = 0;` |

Local declaration. Draw an owned statement box with the exact statement label and directed control-flow succession.

**Context:** Statement inside the displayed owning function; the fv node is a projection. **Views:** fv.

- Draw an owned statement box with the exact statement label and directed control-flow succession.
- Creates a copied typed local value in the enclosing lexical block.

[Complete model](../examples/05-values-and-flow.swaml) · `Values::Producer.prepare`.

[SVG](notation/local-declaration.svg) · [PNG](notation/local-declaration.png) · [Vector scene](notation/local-declaration.scene.json)

## Notation: local-call

**Local function call**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Local function call (node) | ![Local function call](notation/local-call.svg) | `call prepare();` |

Local function invocation. Draw an owned statement box with the exact statement label and directed control-flow succession.

**Context:** Statement inside the displayed owning function; the fv node is a projection. **Views:** fv.

- Draw an owned statement box with the exact statement label and directed control-flow succession.
- Calls an untriggered flow function in the same component, borrowing its activation lock/snapshot. Bind a non-void result with as name; omit the binding for void.

[Complete model](../examples/05-values-and-flow.swaml) · `Values::Producer.boot`.

[SVG](notation/local-call.svg) · [PNG](notation/local-call.png) · [Vector scene](notation/local-call.scene.json)

## Notation: trigger-manual

**Manual activation**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Manual activation (label) | ![Manual activation](notation/trigger-manual.svg) | `function adjust() on manual` |

Manual activation. Attach the activation text to its function header; use no free event symbol or standalone trigger object.

**Context:** Activation annotation on the displayed function. **Views:** fv.

- Attach the activation text to its function header; use no free event symbol or standalone trigger object.
- Harness activation carries no modeled data; external commands still use ports.

[Complete model](../examples/08-service-field.swaml) · `Settings::Panel.adjust`.

[SVG](notation/trigger-manual.svg) · [PNG](notation/trigger-manual.png) · [Vector scene](notation/trigger-manual.scene.json)

## Notation: trigger-periodic

**Periodic activation**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Periodic activation (label) | ![Periodic activation](notation/trigger-periodic.svg) | `on every 10 ms` |

Periodic activation. Attach the activation text to its function header; use no free event symbol or standalone trigger object.

**Context:** Activation annotation on the displayed function. **Views:** fv.

- Attach the activation text to its function header; use no free event symbol or standalone trigger object.
- Release occurs at positive multiples of the declared period.

[Complete model](../examples/02-realtime-controller.swaml) · `Control::Sensor.sample`.

[SVG](notation/trigger-periodic.svg) · [PNG](notation/trigger-periodic.png) · [Vector scene](notation/trigger-periodic.scene.json)

## Notation: trigger-receive

**Port receive activation**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Port receive activation (label) | ![Port receive activation](notation/trigger-receive.svg) | `on receive input.text` |

Port receive activation. Attach the activation text to its function header; use no free event symbol or standalone trigger object.

**Context:** Activation annotation on the displayed function. **Views:** fv.

- Attach the activation text to its function header; use no free event symbol or standalone trigger object.
- The port/member label identifies the one incoming handler owner.

[Complete model](../examples/01-hello.swaml) · `Hello::Listener.hear`.

[SVG](notation/trigger-receive.svg) · [PNG](notation/trigger-receive.png) · [Vector scene](notation/trigger-receive.scene.json)

## Notation: calculation

**Pure calculation**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Pure calculation (compartment) | ![Pure calculation](notation/calculation.svg) | `calc twice { in x: real; return result: real = x * 2.0; }` |

A calculation maps named inputs to one named, typed output expression without mutable state or communication.

**Context:** Calculation declared at the start of Values::Producer.prepare. **Views:** fv.

- Draw a flat calculation compartment inside its owning function, headed calc and its name.
- List each input with in and its type; show return, the output name/type and expression in a separate row.
- A calculation call is local expression text such as twice(samples[i]); it is not a message or independent executable function.

[Complete model](../examples/05-values-and-flow.swaml) · `Values::Producer.prepare.twice`.

[SVG](notation/calculation.svg) · [PNG](notation/calculation.png) · [Vector scene](notation/calculation.scene.json)

## Notation: routed-call

**Routed function call**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Routed function call (node) | ![Routed function call](notation/routed-call.svg) | `call setting.get() as observed within 100 ms otherwise { return; };` |

RPC request and failure continuation. Draw one request step labeled port.member, result binding and timeout, with distinct success and otherwise continuations.

**Context:** Statement in Settings::Panel.refresh; successful completion binds observed. **Views:** fv.

- Draw one request step labeled port.member, result binding and timeout, with distinct success and otherwise continuations.
- The failure continuation remains explicit and terminating; request arrows outside this function must use the corresponding interface route.

[Complete model](../examples/08-service-field.swaml) · `Settings::Panel.refresh`.

[SVG](notation/routed-call.svg) · [PNG](notation/routed-call.png) · [Vector scene](notation/routed-call.scene.json)

## Notation: trigger-call

**RPC handler activation**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| RPC handler activation (label) | ![RPC handler activation](notation/trigger-call.svg) | `on call health.check` |

RPC handler activation. Attach the activation text to its function header; use no free event symbol or standalone trigger object.

**Context:** Activation annotation on the displayed function. **Views:** fv.

- Attach the activation text to its function header; use no free event symbol or standalone trigger object.
- Requests and correlated results remain on the originating interface route.

[Complete model](../examples/07-client-server.swaml) · `Rpc::Server.checkHealth`.

[SVG](notation/trigger-call.svg) · [PNG](notation/trigger-call.png) · [Vector scene](notation/trigger-call.scene.json)

## Notation: trigger-start

**Startup activation**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Startup activation (label) | ![Startup activation](notation/trigger-start.svg) | `function greet() on start` |

Startup activation. Attach the activation text to its function header; use no free event symbol or standalone trigger object.

**Context:** Activation annotation on the displayed function. **Views:** fv.

- Attach the activation text to its function header; use no free event symbol or standalone trigger object.
- Once after component initialization and route readiness.

[Complete model](../examples/01-hello.swaml) · `Hello::Speaker.greet`.

[SVG](notation/trigger-start.svg) · [PNG](notation/trigger-start.png) · [Vector scene](notation/trigger-start.scene.json)


## Function states

## Notation: completion-transition

**Completion transition**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Completion transition (edge) | ![Completion transition](notation/completion-transition.svg) | `transition finish: Active -> Done on completion when (count > 0) {}` |

Completion transition. Label the state edge on completion explicitly, with its guard if present.

**Context:** Completion transition in Notation::Controller.lifecycle. **Views:** fv.

- Label the state edge on completion explicitly, with its guard if present.
- Completion is local to the owning function and MUST NOT be drawn as an emitted global event.

[Complete model](../examples/notation/catalog.swaml) · `Notation::Controller.lifecycle.finish`.

[SVG](notation/completion-transition.svg) · [PNG](notation/completion-transition.png) · [Vector scene](notation/completion-transition.scene.json)

## Notation: final-state

**Final state**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Final state (node) | ![Final state](notation/final-state.svg) | `state Done final {}` |

Final state. Draw a named final-state symbol with a bullseye marker; preserve the declared name and any entry behavior.

**Context:** Named final state inside Notation::Controller.lifecycle. **Views:** fv.

- Draw a named final-state symbol with a bullseye marker; preserve the declared name and any entry behavior.
- No outgoing transition is permitted; finality occurs after entry finishes, so the marker MUST NOT hide an entry block.

[Complete model](../examples/notation/catalog.swaml) · `Notation::Controller.lifecycle.Done`.

[SVG](notation/final-state.svg) · [PNG](notation/final-state.png) · [Vector scene](notation/final-state.scene.json)

## Notation: stateful-function

**Function with states**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Function with states (node) | ![Function with states](notation/stateful-function.svg) | `function lifecycle() on start` |

Function with states. Draw the state graph inside the owning function frame, keeping the function name and on start label visible.

**Context:** Function header in Lifecycle::Device; its direct body begins with initial. **Views:** fv.

- Draw the state graph inside the owning function frame, keeping the function name and on start label visible.
- There is no machine box, performer, or separate authored state allocation; StateBody contributes only the function’s contents.

[Complete model](../examples/04-stateful-function.swaml) · `Lifecycle::Device.lifecycle`.

[SVG](notation/stateful-function.svg) · [PNG](notation/stateful-function.png) · [Vector scene](notation/stateful-function.scene.json)

## Notation: initial-state

**Initial state reference**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Initial state reference (node) | ![Initial state reference](notation/initial-state.svg) | `initial Idle;` |

Initial state reference. Draw a solid initial pseudonode with one outgoing unlabeled initialization edge to the named initial state.

**Context:** First clause of Lifecycle::Device.lifecycle. **Views:** fv.

- Draw a solid initial pseudonode with one outgoing unlabeled initialization edge to the named initial state.
- This projects the function’s unique initial reference; it is not a transmitted event or a second start function.

[Complete model](../examples/04-stateful-function.swaml) · `Lifecycle::Device.lifecycle`.

[SVG](notation/initial-state.svg) · [PNG](notation/initial-state.png) · [Vector scene](notation/initial-state.scene.json)

## Notation: timer-transition

**Residence timer transition**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Residence timer transition (edge) | ![Residence timer transition](notation/timer-transition.svg) | `transition elapsed: Active -> Done on after 1 s {}` |

Residence timer transition. Label the transition on after with an explicit duration and component.

**Context:** Timer transition in Notation::Controller.lifecycle. **Views:** fv.

- Label the transition on after with an explicit duration and component.
- The duration starts after state entry completes; leaving the state cancels that entry generation’s timers.

[Complete model](../examples/notation/catalog.swaml) · `Notation::Controller.lifecycle.elapsed`.

[SVG](notation/timer-transition.svg) · [PNG](notation/timer-transition.png) · [Vector scene](notation/timer-transition.scene.json)

## Notation: state

**State**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| State (node) | ![State](notation/state.svg) | `state Active {}` |

State. Draw a rounded state rectangle bearing the function-local state name, with optional entry/exit compartments.

**Context:** State declaration in Notation::Controller.lifecycle. **Views:** fv.

- Draw a rounded state rectangle bearing the function-local state name, with optional entry/exit compartments.
- State rectangles live inside one owning function; position does not allocate them to components or performers.

[Complete model](../examples/notation/catalog.swaml) · `Notation::Controller.lifecycle.Active`.

[SVG](notation/state.svg) · [PNG](notation/state.png) · [Vector scene](notation/state.scene.json)

## Notation: state-entry

**State entry behavior**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| State entry behavior (compartment) | ![State entry behavior](notation/state-entry.svg) | `entry { count = 0; }` |

State entry behavior. Show entry and its statements in a compartment inside the owning state.

**Context:** Entry block on Notation::Controller.lifecycle.Idle. **Views:** fv.

- Show entry and its statements in a compartment inside the owning state.
- Entry has no incoming payload bindings; its completion starts residence timers.

[Complete model](../examples/notation/catalog.swaml) · `Notation::Controller.lifecycle.Idle`.

[SVG](notation/state-entry.svg) · [PNG](notation/state-entry.png) · [Vector scene](notation/state-entry.scene.json)

## Notation: state-exit

**State exit behavior**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| State exit behavior (compartment) | ![State exit behavior](notation/state-exit.svg) | `exit { assert count >= 0; }` |

State exit behavior. Show exit and its statements in a compartment inside the owning state.

**Context:** Exit block on Notation::Controller.lifecycle.Idle. **Views:** fv.

- Show exit and its statements in a compartment inside the owning state.
- Exit precedes transition effect and state update, and does not inherit the incoming payload environment.

[Complete model](../examples/notation/catalog.swaml) · `Notation::Controller.lifecycle.Idle`.

[SVG](notation/state-exit.svg) · [PNG](notation/state-exit.png) · [Vector scene](notation/state-exit.scene.json)

## Notation: transition

**State transition**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| State transition (edge) | ![State transition](notation/transition.svg) | `transition begin: Idle -> Active on receive signal.pulse when (value > 0) priority 1 { count = value; }` |

State transition. Draw a directed edge between states in the same function; label its identity, stimulus, optional guard/priority and effect.

**Context:** Transition in Notation::Controller.lifecycle. **Views:** fv.

- Draw a directed edge between states in the same function; label its identity, stimulus, optional guard/priority and effect.
- Receive labels MUST include port.member; the transition edge is local control, not the interface connector carrying the message.

[Complete model](../examples/notation/catalog.swaml) · `Notation::Controller.lifecycle.begin`.

[SVG](notation/transition.svg) · [PNG](notation/transition.png) · [Vector scene](notation/transition.scene.json)

## Notation: transition-guard

**Transition guard**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Transition guard (label) | ![Transition guard](notation/transition-guard.svg) | `when (value > 0)` |

Transition guard. Show the bool guard in brackets or with its explicit when keyword on the transition label.

**Context:** Guard on Notation::Controller.lifecycle.begin. **Views:** fv.

- Show the bool guard in brackets or with its explicit when keyword on the transition label.
- A false guard disables that transition for the current stimulus; guard text is not a separate executable action.

[Complete model](../examples/notation/catalog.swaml) · `Notation::Controller.lifecycle.begin`.

[SVG](notation/transition-guard.svg) · [PNG](notation/transition-guard.png) · [Vector scene](notation/transition-guard.scene.json)

## Notation: transition-priority

**Transition priority**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Transition priority (label) | ![Transition priority](notation/transition-priority.svg) | `priority 1` |

Transition priority. Display priority as an explicit nonnegative integer on a transition label; omitted means zero.

**Context:** Priority on Notation::Controller.lifecycle.begin. **Views:** fv.

- Display priority as an explicit nonnegative integer on a transition label; omitted means zero.
- Larger wins only among enabled transitions for the same state and stimulus; it is not an function scheduler priority.

[Complete model](../examples/notation/catalog.swaml) · `Notation::Controller.lifecycle.begin`.

[SVG](notation/transition-priority.svg) · [PNG](notation/transition-priority.png) · [Vector scene](notation/transition-priority.scene.json)


## Interfaces and connections

## Notation: delegation

**Boundary delegation**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Boundary delegation (edge) | ![Boundary delegation](notation/delegation.svg) | `delegate api -> store.api;` |

Boundary delegation. Draw a solid unarrowed line labeled delegate from a boundary port to one immediate child port inside its owner.

**Context:** Boundary-to-immediate-child alias inside Settings::Service. **Views:** iv.

- Draw a solid unarrowed line labeled delegate from a boundary port to one immediate child port inside its owner.
- Both endpoints keep identical interface identity and role; this alias creates no queue, service call, adapter or extra message.

[Complete model](../examples/08-service-field.swaml) · `Settings::Service`.

[SVG](notation/delegation.svg) · [PNG](notation/delegation.png) · [Vector scene](notation/delegation.scene.json)

## Notation: client-server-interface

**Client–server interface**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Client–server interface (node) | ![Client–server interface](notation/client-server-interface.svg) | `interface clientServer Health version "1.0.0"` |

Client–server interface. Draw an interface classifier rectangle with the exact interface kind, nominal name and version in its heading.

**Context:** Interface declaration header; member rows occupy the contract body. **Views:** iv.

- Draw an interface classifier rectangle with the exact interface kind, nominal name and version in its heading.
- Keep member categories visible; a contract box is a reusable type and MUST NOT be mistaken for a runtime broker or component.

[Complete model](../examples/07-client-server.swaml) · `Rpc::Health`.

[SVG](notation/client-server-interface.svg) · [PNG](notation/client-server-interface.png) · [Vector scene](notation/client-server-interface.scene.json)

## Notation: data-member

**Data member**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Data member (compartment) | ![Data member](notation/data-member.svg) | `data temperature: real sampled;` |

Data member. Show data name: Type and sampled or queued on one interface-compartment row.

**Context:** Member of Control::Samples; queued is the alternative retention mode. **Views:** iv.

- Show data name: Type and sampled or queued on one interface-compartment row.
- Retention mode is explicit text, not color; sampled uses latest-value buffering while queued retains individual values under QoS.

[Complete model](../examples/02-realtime-controller.swaml) · `Control::Samples`.

[SVG](notation/data-member.svg) · [PNG](notation/data-member.png) · [Vector scene](notation/data-member.scene.json)

## Notation: port-receiver

**Data receiver port**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Data receiver port (node) | ![Data receiver port](notation/port-receiver.svg) | `port input: Greeting receiver;` |

Data receiver port. Draw a small square centered on the owning boundary and label its name: Interface and exact role.

**Context:** Port declaration on the displayed component boundary. **Views:** iv.

- Draw a small square centered on the owning boundary and label its name: Interface and exact role.
- Data flows inward to the owned receiving function. Do not infer direction only from left/right placement; role text remains mandatory.

[Complete model](../examples/01-hello.swaml) · `Hello::Listener.input`.

[SVG](notation/port-receiver.svg) · [PNG](notation/port-receiver.png) · [Vector scene](notation/port-receiver.scene.json)

## Notation: port-sender

**Data sender port**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Data sender port (node) | ![Data sender port](notation/port-sender.svg) | `port output: Greeting sender;` |

Data sender port. Draw a small square centered on the owning boundary and label its name: Interface and exact role.

**Context:** Port declaration on the displayed component boundary. **Views:** iv.

- Draw a small square centered on the owning boundary and label its name: Interface and exact role.
- Data flows outward from the owned port. Do not infer direction only from left/right placement; role text remains mandatory.

[Complete model](../examples/01-hello.swaml) · `Hello::Speaker.output`.

[SVG](notation/port-sender.svg) · [PNG](notation/port-sender.png) · [Vector scene](notation/port-sender.scene.json)

## Notation: delivery-policy

**Delivery policy**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Delivery policy (label) | ![Delivery policy](notation/delivery-policy.svg) | `delivery atLeastOnce;` |

Delivery policy. Attach a QoS property compartment to its connector; write the exact delivery value.

**Context:** QoS property on Rpc::HealthCheck.healthCheck; the signature is idempotent. **Views:** iv.

- Attach a QoS property compartment to its connector; write the exact delivery value.
- atLeastOnce, atMostOnce and bestEffort are textual alternatives, not three different edge shapes; atLeastOnce RPC requires idempotent signatures.

[Complete model](../examples/07-client-server.swaml) · `Rpc::HealthCheck.healthCheck`.

[SVG](notation/delivery-policy.svg) · [PNG](notation/delivery-policy.png) · [Vector scene](notation/delivery-policy.scene.json)

## Notation: event-member

**Event member**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Event member (compartment) | ![Event member](notation/event-member.svg) | `event changed(value: string);` |

Event member. Show event name(parameters) in its interface compartment; draw no free-floating event definition.

**Context:** Member of Lifecycle::Status. **Views:** iv.

- Show event name(parameters) in its interface compartment; draw no free-floating event definition.
- Every graphical emission or receive label identifies this member through an owned port and function.

[Complete model](../examples/04-stateful-function.swaml) · `Lifecycle::Status`.

[SVG](notation/event-member.svg) · [PNG](notation/event-member.png) · [Vector scene](notation/event-member.scene.json)

## Notation: port-publisher

**Event publisher port**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Event publisher port (node) | ![Event publisher port](notation/port-publisher.svg) | `port status: Status publisher;` |

Event publisher port. Draw a small square centered on the owning boundary and label its name: Interface and exact role.

**Context:** Port declaration on the displayed component boundary. **Views:** iv.

- Draw a small square centered on the owning boundary and label its name: Interface and exact role.
- Events leave this port through explicit subscription connectors. Do not infer direction only from left/right placement; role text remains mandatory.

[Complete model](../examples/04-stateful-function.swaml) · `Lifecycle::Device.status`.

[SVG](notation/port-publisher.svg) · [PNG](notation/port-publisher.png) · [Vector scene](notation/port-publisher.scene.json)

## Notation: port-subscriber

**Event subscriber port**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Event subscriber port (node) | ![Event subscriber port](notation/port-subscriber.svg) | `port status: Status subscriber;` |

Event subscriber port. Draw a small square centered on the owning boundary and label its name: Interface and exact role.

**Context:** Port declaration on the displayed component boundary. **Views:** iv.

- Draw a small square centered on the owning boundary and label its name: Interface and exact role.
- Events enter the declared handling function through this port. Do not infer direction only from left/right placement; role text remains mandatory.

[Complete model](../examples/04-stateful-function.swaml) · `Lifecycle::Monitor.status`.

[SVG](notation/port-subscriber.svg) · [PNG](notation/port-subscriber.png) · [Vector scene](notation/port-subscriber.scene.json)

## Notation: connector

**Interface connector**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Interface connector (edge) | ![Interface connector](notation/connector.svg) | `connect greeting: speaker.output -> listener.input qos { delivery atMostOnce; ordering fifo; capacity 4; overflow reject; };` |

Interface connector. Draw a solid directed connector between port squares, with connector identity and interface name visible.

**Context:** Connection between immediate child ports of Hello::Conversation. **Views:** iv.

- Draw a solid directed connector between port squares, with connector identity and interface name visible.
- The arrow follows declared source-to-target roles; replies/service events reverse that route rather than creating a second hidden channel.

[Complete model](../examples/01-hello.swaml) · `Hello::Conversation.greeting`.

[SVG](notation/connector.svg) · [PNG](notation/connector.png) · [Vector scene](notation/connector.scene.json)

## Notation: function-signature

**Interface function signature**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Interface function signature (compartment) | ![Interface function signature](notation/function-signature.svg) | `function check(): bool idempotent;` |

Interface function signature. Show function name(parameters): Result and idempotent when declared, inside the interface contract.

**Context:** RPC contract member of Rpc::Health. **Views:** iv.

- Show function name(parameters): Result and idempotent when declared, inside the interface contract.
- The signature is distinct from its component implementation; a contract row has no executable body.

[Complete model](../examples/07-client-server.swaml) · `Rpc::Health`.

[SVG](notation/function-signature.svg) · [PNG](notation/function-signature.png) · [Vector scene](notation/function-signature.scene.json)

## Notation: freshness-bound

**Message freshness bound**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Message freshness bound (label) | ![Message freshness bound](notation/freshness-bound.svg) | `maxAge 20 ms;` |

Message freshness bound. Write maxAge and its explicit component in the connector QoS compartment.

**Context:** QoS freshness bound on Control::Controller.measured. **Views:** iv.

- Write maxAge and its explicit component in the connector QoS compartment.
- Age is measured from original emission, including retries; show expiry as a trace observation only when supported by a run.

[Complete model](../examples/02-realtime-controller.swaml) · `Control::Controller.measured`.

[SVG](notation/freshness-bound.svg) · [PNG](notation/freshness-bound.png) · [Vector scene](notation/freshness-bound.scene.json)

## Notation: qos-policy-reference

**Named connector policy**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Named connector policy (label) | ![Named connector policy](notation/qos-policy-reference.svg) | `qos LocalLink` |

A connector explicitly selects a package-visible QoS declaration while keeping its own route and queue identity.

**Context:** Explicit policy selection on Settings::Cabin.frontLink. **Views:** iv, grv.

- Attach qos PolicyName to the existing typed connector; the name is a reference, not another communication edge.
- Inspection exposes the qualified policy identity, effective base fields and bounds. Do not merge connector queues or hide invalid policy uses.

[Complete model](../examples/08-service-field.swaml) · `Settings::Cabin.frontLink`.

[SVG](notation/qos-policy-reference.svg) · [PNG](notation/qos-policy-reference.png) · [Vector scene](notation/qos-policy-reference.scene.json)

## Notation: optional-port

**Optional port**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Optional port (label) | ![Optional port](notation/optional-port.svg) | `port notices: Notices publisher optional;` |

Optional port. Use the same square port symbol and append optional to its role label.

**Context:** Reusable component NotationOptions::Emitter; its outgoing member is tied to an function. **Views:** iv.

- Use the same square port symbol and append optional to its role label.
- Optionality only permits an unconnected route; it does not remove contract, provenance or receiving-handler obligations.

[Complete model](../examples/notation/catalog.swaml) · `NotationOptions::Emitter.notices`.

[SVG](notation/optional-port.svg) · [PNG](notation/optional-port.png) · [Vector scene](notation/optional-port.scene.json)

## Notation: overflow-policy

**Overflow behavior**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Overflow behavior (label) | ![Overflow behavior](notation/overflow-policy.svg) | `overflow dropNewest;` |

Overflow behavior. Write overflow plus dropNewest, dropOldest or reject in the connector QoS compartment.

**Context:** QoS property on Notation::Demo.events. **Views:** iv.

- Write overflow plus dropNewest, dropOldest or reject in the connector QoS compartment.
- The label determines retention/rejection semantics; no style variation may silently substitute another policy.

[Complete model](../examples/notation/catalog.swaml) · `Notation::Demo.events`.

[SVG](notation/overflow-policy.svg) · [PNG](notation/overflow-policy.png) · [Vector scene](notation/overflow-policy.scene.json)

## Notation: publish-subscribe-interface

**Publish–subscribe interface**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Publish–subscribe interface (node) | ![Publish–subscribe interface](notation/publish-subscribe-interface.svg) | `interface publishSubscribe Status version "1.0.0"` |

Publish–subscribe interface. Draw an interface classifier rectangle with the exact interface kind, nominal name and version in its heading.

**Context:** Interface declaration header; member rows occupy the contract body. **Views:** iv.

- Draw an interface classifier rectangle with the exact interface kind, nominal name and version in its heading.
- Keep member categories visible; a contract box is a reusable type and MUST NOT be mistaken for a runtime broker or component.

[Complete model](../examples/04-stateful-function.swaml) · `Lifecycle::Status`.

[SVG](notation/publish-subscribe-interface.svg) · [PNG](notation/publish-subscribe-interface.png) · [Vector scene](notation/publish-subscribe-interface.scene.json)

## Notation: capacity-policy

**Queue capacity**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Queue capacity (label) | ![Queue capacity](notation/capacity-policy.svg) | `capacity 4;` |

Queue capacity. Write the positive capacity value in the connector QoS compartment.

**Context:** QoS property on Hello::Conversation.greeting. **Views:** iv.

- Write the positive capacity value in the connector QoS compartment.
- Capacity counts pending logical messages for the route/direction/member; do not encode capacity as line thickness.

[Complete model](../examples/01-hello.swaml) · `Hello::Conversation.greeting`.

[SVG](notation/capacity-policy.svg) · [PNG](notation/capacity-policy.png) · [Vector scene](notation/capacity-policy.scene.json)

## Notation: ordering-policy

**Queue ordering**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Queue ordering (label) | ![Queue ordering](notation/ordering-policy.svg) | `ordering unordered;` |

Queue ordering. Write ordering fifo or ordering unordered in the connector QoS compartment.

**Context:** QoS property on Notation::Demo.events. **Views:** iv.

- Write ordering fifo or ordering unordered in the connector QoS compartment.
- Ordering applies per route, direction and member; line position or crossing MUST NOT imply a global order.

[Complete model](../examples/notation/catalog.swaml) · `Notation::Demo.events`.

[SVG](notation/ordering-policy.svg) · [PNG](notation/ordering-policy.png) · [Vector scene](notation/ordering-policy.scene.json)

## Notation: qos-policy-definition

**Reusable QoS policy**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Reusable QoS policy (node) | ![Reusable QoS policy](notation/qos-policy-definition.svg) | `qos def LocalLink { delivery atMostOnce; ordering fifo; capacity 8; overflow reject; }` |

Named complete connector policy, shown as a flat declaration card. It has no port, behavior, deployment or runtime queue of its own.

**Context:** Package-owned policy in Settings; selected independently by both Cabin connector occurrences. **Views:** gv, grv.

- Draw a flat contract rectangle labeled «qos def» and its name, with all four base fields in a property compartment.
- Expose optional latency/age bounds and declaration identity. Reuse shares values only; queues remain per connector occurrence, direction and member.

[Complete model](../examples/08-service-field.swaml) · `Settings::LocalLink`.

[SVG](notation/qos-policy-definition.svg) · [PNG](notation/qos-policy-definition.png) · [Vector scene](notation/qos-policy-definition.scene.json)

## Notation: port-client

**RPC client port**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| RPC client port (node) | ![RPC client port](notation/port-client.svg) | `port health: Health client;` |

RPC client port. Draw a small square centered on the owning boundary and label its name: Interface and exact role.

**Context:** Port declaration on the displayed component boundary. **Views:** iv.

- Draw a small square centered on the owning boundary and label its name: Interface and exact role.
- Requests leave and correlated results return through this same port. Do not infer direction only from left/right placement; role text remains mandatory.

[Complete model](../examples/07-client-server.swaml) · `Rpc::Client.health`.

[SVG](notation/port-client.svg) · [PNG](notation/port-client.png) · [Vector scene](notation/port-client.scene.json)

## Notation: port-server

**RPC server port**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| RPC server port (node) | ![RPC server port](notation/port-server.svg) | `port health: Health server;` |

RPC server port. Draw a small square centered on the owning boundary and label its name: Interface and exact role.

**Context:** Port declaration on the displayed component boundary. **Views:** iv.

- Draw a small square centered on the owning boundary and label its name: Interface and exact role.
- Requests enter and correlated results leave through this same port. Do not infer direction only from left/right placement; role text remains mandatory.

[Complete model](../examples/07-client-server.swaml) · `Rpc::Server.health`.

[SVG](notation/port-server.svg) · [PNG](notation/port-server.png) · [Vector scene](notation/port-server.scene.json)

## Notation: sender-receiver-interface

**Sender–receiver interface**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Sender–receiver interface (node) | ![Sender–receiver interface](notation/sender-receiver-interface.svg) | `interface senderReceiver Greeting version "1.0.0"` |

Sender–receiver interface. Draw an interface classifier rectangle with the exact interface kind, nominal name and version in its heading.

**Context:** Interface declaration header; member rows occupy the contract body. **Views:** iv.

- Draw an interface classifier rectangle with the exact interface kind, nominal name and version in its heading.
- Keep member categories visible; a contract box is a reusable type and MUST NOT be mistaken for a runtime broker or component.

[Complete model](../examples/01-hello.swaml) · `Hello::Greeting`.

[SVG](notation/sender-receiver-interface.svg) · [PNG](notation/sender-receiver-interface.png) · [Vector scene](notation/sender-receiver-interface.scene.json)

## Notation: port-requires

**Service consumer port**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Service consumer port (node) | ![Service consumer port](notation/port-requires.svg) | `port setting: TemperatureSetting requires;` |

Service consumer port. Draw a small square centered on the owning boundary and label its name: Interface and exact role.

**Context:** Port declaration on the displayed component boundary. **Views:** iv.

- Draw a small square centered on the owning boundary and label its name: Interface and exact role.
- RPC requests leave; results and provider events enter. Do not infer direction only from left/right placement; role text remains mandatory.

[Complete model](../examples/08-service-field.swaml) · `Settings::Panel.setting`.

[SVG](notation/port-requires.svg) · [PNG](notation/port-requires.png) · [Vector scene](notation/port-requires.scene.json)

## Notation: service-interface

**Service interface**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Service interface (node) | ![Service interface](notation/service-interface.svg) | `interface service TemperatureSetting version "1.0.0"` |

Service interface. Draw an interface classifier rectangle with the exact interface kind, nominal name and version in its heading.

**Context:** Interface declaration header; member rows occupy the contract body. **Views:** iv.

- Draw an interface classifier rectangle with the exact interface kind, nominal name and version in its heading.
- Keep member categories visible; a contract box is a reusable type and MUST NOT be mistaken for a runtime broker or component.

[Complete model](../examples/08-service-field.swaml) · `Settings::TemperatureSetting`.

[SVG](notation/service-interface.svg) · [PNG](notation/service-interface.png) · [Vector scene](notation/service-interface.scene.json)

## Notation: port-provides

**Service provider port**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Service provider port (node) | ![Service provider port](notation/port-provides.svg) | `port api: TemperatureSetting provides;` |

Service provider port. Draw a small square centered on the owning boundary and label its name: Interface and exact role.

**Context:** Port declaration on the displayed component boundary. **Views:** iv.

- Draw a small square centered on the owning boundary and label its name: Interface and exact role.
- RPC requests enter; results and provider events leave. Do not infer direction only from left/right placement; role text remains mandatory.

[Complete model](../examples/08-service-field.swaml) · `Settings::SettingStore.api`.

[SVG](notation/port-provides.svg) · [PNG](notation/port-provides.png) · [Vector scene](notation/port-provides.scene.json)

## Notation: latency-bound

**Transport latency bound**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Transport latency bound (label) | ![Transport latency bound](notation/latency-bound.svg) | `maxLatency 1 ms;` |

Transport latency bound. Write maxLatency and an explicitly component-bearing duration beside the corresponding connector.

**Context:** QoS bound on Control::Controller.measured. **Views:** iv.

- Write maxLatency and an explicitly component-bearing duration beside the corresponding connector.
- This bound ends at transport readiness; it MUST NOT be labeled as total execution or dispatch deadline.

[Complete model](../examples/02-realtime-controller.swaml) · `Control::Controller.measured`.

[SVG](notation/latency-bound.svg) · [PNG](notation/latency-bound.png) · [Vector scene](notation/latency-bound.scene.json)


## Structure and values

## Notation: component-definition

**Component definition**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Component definition (node) | ![Component definition](notation/component-definition.svg) | `component def Conversation` |

Component definition. Draw a sharp-corner classifier rectangle with the component double-tab marker and explicit «component def» heading above its type name.

**Context:** Reusable component type header inside package Hello. **Views:** gv, grv.

- Draw a sharp-corner classifier rectangle with the component double-tab marker and explicit «component def» heading above its type name.
- Separate the name from ports, child instances, private data and functions; definitions do not allocate singleton state.

[Complete model](../examples/01-hello.swaml) · `Hello::Conversation`.

[SVG](notation/component-definition.svg) · [PNG](notation/component-definition.png) · [Vector scene](notation/component-definition.scene.json)

## Notation: component-specialization

**Component specialization**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Component specialization (edge) | ![Component specialization](notation/component-specialization.svg) | `component def FastWorker specializes Worker` |

Single inheritance reuses the base component’s effective members while each instance keeps independent state.

**Context:** Reusable definition ComponentReuse::FastWorker specializes Worker. **Views:** gv, grv.

- Draw a solid generalization line from the derived definition to the base, ending in an unfilled triangle at the base and labeled specializes.
- The link connects definitions, not running instances. It does not create an extra component instance or shared private store.
- Inherited members may be replaced only through compatible explicit redefines declarations.

[Complete model](../examples/15-component-specialization.swaml) · `ComponentReuse::FastWorker`.

[SVG](notation/component-specialization.svg) · [PNG](notation/component-specialization.png) · [Vector scene](notation/component-specialization.scene.json)

## Notation: component-usage

**Component usage**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Component usage (node) | ![Component usage](notation/component-usage.svg) | `component conversation: Conversation;` |

Component usage. Draw a structural rectangle with the component double-tab marker, labeled conversation: Conversation with «component» visible; preserve occurrence and type names.

**Context:** Contained component occurrence in root Hello::Demo. **Views:** gv, grv.

- Draw a structural rectangle with the component double-tab marker, labeled conversation: Conversation with «component» visible; preserve occurrence and type names.
- Each occurrence has its own path context; two rectangles typed by the same definition MUST NOT merge private storage.

[Complete model](../examples/01-hello.swaml) · `Hello::Demo`.

[SVG](notation/component-usage.svg) · [PNG](notation/component-usage.png) · [Vector scene](notation/component-usage.scene.json)

## Notation: enumeration

**Enumeration**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Enumeration (node) | ![Enumeration](notation/enumeration.svg) | `enum Health { Good, Failed }` |

Enumeration. Draw a classifier rectangle headed «enum», with one literal per row in a literals compartment.

**Context:** Nominal enum declaration inside Values. **Views:** gv, grv.

- Draw a classifier rectangle headed «enum», with one literal per row in a literals compartment.
- The literal order is display order, not an implied integer encoding or state-transition order.

[Complete model](../examples/05-values-and-flow.swaml) · `Values::Health`.

[SVG](notation/enumeration.svg) · [PNG](notation/enumeration.png) · [Vector scene](notation/enumeration.scene.json)

## Notation: enum-value

**Enumeration value**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Enumeration value (label) | ![Enumeration value](notation/enum-value.svg) | `Health.Good` |

Enumeration value. Render the exact nominal value text Type.Literal, or Package::Type.Literal when qualification is needed.

**Context:** Expression inside Values::Producer.prepare. **Views:** gv, grv.

- Render the exact nominal value text Type.Literal, or Package::Type.Literal when qualification is needed.
- An accessible local first segment denotes a value-field read instead; the graphic MUST preserve the resolved identity rather than guessing from the dot.

[Complete model](../examples/05-values-and-flow.swaml) · `Values::Producer.prepare`.

[SVG](notation/enum-value.svg) · [PNG](notation/enum-value.png) · [Vector scene](notation/enum-value.scene.json)

## Notation: expression

**Expressions and value paths**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Expressions and value paths (label) | ![Expressions and value paths](notation/expression.svg) | `assert not false and (1 + 2 * 3 >= 7) or true;` |

Expressions and value paths. Keep literals, operators, parentheses and value paths as expression text in the owning label or compartment.

**Context:** Expression inside Notation::Sink.check. **Views:** gv, grv.

- Keep literals, operators, parentheses and value paths as expression text in the owning label or compartment.
- Expression layout MUST preserve precedence and short-circuit order; it does not add flow nodes for operators unless the fv is explicitly an explanatory expansion.

[Complete model](../examples/notation/catalog.swaml) · `Notation::Sink.check`.

[SVG](notation/expression.svg) · [PNG](notation/expression.png) · [Vector scene](notation/expression.scene.json)

## Notation: array-value

**Fixed array type and value**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Fixed array type and value (label) | ![Fixed array type and value](notation/array-value.svg) | `var samples: real[3] = [1.0, 2.0, 3.0];` |

Fixed array type and value. Display fixed extent in the type label T[n] and ordered elements in brackets within the owning expression.

**Context:** Local declaration in Values::Producer.prepare. **Views:** gv, grv.

- Display fixed extent in the type label T[n] and ordered elements in brackets within the owning expression.
- Array elements are copied values; no array icon may imply reference-valued payloads or dynamic multiplicity.

[Complete model](../examples/05-values-and-flow.swaml) · `Values::Producer.prepare`.

[SVG](notation/array-value.svg) · [PNG](notation/array-value.png) · [Vector scene](notation/array-value.scene.json)

## Notation: inline-root

**Inline root composition**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Inline root composition (node) | ![Inline root composition](notation/inline-root.svg) | `component Minimal { component counter: Counter; }` |

An inline top-level component directly owns its architecture and local behavior.

**Context:** Top-level inline component occurrence in Roots. **Views:** gv, grv.

- Draw a root component frame with its owned members: child components, private data, functions and typed routes.
- The root is a closed instance: owned ports participate only in explicit connections or delegation, with no implicit external peer.

[Complete model](../examples/09-component-roots.swaml) · `Roots::Minimal`.

[SVG](notation/inline-root.svg) · [PNG](notation/inline-root.png) · [Vector scene](notation/inline-root.scene.json)

## Notation: member-redefinition

**Member redefinition**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Member redefinition (label) | ![Member redefinition](notation/member-redefinition.svg) | `redefines function work() { ticks = ticks + 2; }` |

An explicit redefinition replaces an inherited member in the derived component’s effective feature set.

**Context:** Replacement function owned by ComponentReuse::FastWorker. **Views:** gv, grv, fv.

- Prefix the owned member label with redefines and preserve its member kind, name and compatible contract.
- Port, variable, child, function, connector and delegation replacements use their ordinary glyphs with this explicit label.
- Display one effective member for the derived instance; an override does not allocate another behavior or store.

[Complete model](../examples/15-component-specialization.swaml) · `ComponentReuse::FastWorker.work`.

[SVG](notation/member-redefinition.svg) · [PNG](notation/member-redefinition.png) · [Vector scene](notation/member-redefinition.scene.json)

## Notation: type-relationship

**Occurrence typing relationship**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Occurrence typing relationship (edge) | ![Occurrence typing relationship](notation/type-relationship.svg) | `component conversation: Conversation;` |

Occurrence typing relationship. A dashed type arrow points from the occurrence to its reusable definition.

**Context:** Occurrence typing in Hello::Demo; the same type identity is normally shown by the name: Type label. **Views:** gv, grv.

- When typing is shown as a separate relationship, draw a dashed line with a hollow triangular arrowhead pointing from the occurrence to its definition and label it type.
- This is a typing dependency, never inheritance, delegation or a communication route; the name: Type label remains authoritative.

[Complete model](../examples/01-hello.swaml) · `Hello::Demo.conversation`.

[SVG](notation/type-relationship.svg) · [PNG](notation/type-relationship.png) · [Vector scene](notation/type-relationship.scene.json)

## Notation: package

**Package**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Package (node) | ![Package](notation/package.svg) | `package Hello` |

Package. Draw a tabbed rectangular namespace frame; the tab contains the package name.

**Context:** Package header; declarations occupy its body. **Views:** gv, grv.

- Draw a tabbed rectangular namespace frame; the tab contains the package name.
- Nested compartments show owned declarations, not runtime instances created by package membership.

[Complete model](../examples/01-hello.swaml) · `Hello`.

[SVG](notation/package.svg) · [PNG](notation/package.png) · [Vector scene](notation/package.scene.json)

## Notation: import

**Package import**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Package import (edge) | ![Package import](notation/import.svg) | `import Shared::*;` |

Package import. Draw a dashed open-arrow dependency from the importing package to the imported package, labeled import Shared::*.

**Context:** Inside package Notation; the target package is loaded in the same workspace. **Views:** gv, grv.

- Draw a dashed open-arrow dependency from the importing package to the imported package, labeled import Shared::*.
- This is namespace visibility only; it MUST NOT resemble or create an interface communication route.

[Complete model](../examples/notation/catalog.swaml) · `Notation`.

[SVG](notation/import.svg) · [PNG](notation/import.png) · [Vector scene](notation/import.scene.json)

## Notation: parameter

**Parameter or record field**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Parameter or record field (compartment) | ![Parameter or record field](notation/parameter.svg) | `hear(message: string)` |

Parameter or record field. Show ordered parameters as name: Type within the function signature; show record fields as name: Type rows in their datatype.

**Context:** Function signature fragment inside Hello::Listener. **Views:** gv, grv.

- Show ordered parameters as name: Type within the function signature; show record fields as name: Type rows in their datatype.
- Parameter order is semantic; a graphical editor MUST retain it when reordering unrelated compartments.

[Complete model](../examples/01-hello.swaml) · `Hello::Listener.hear`.

[SVG](notation/parameter.svg) · [PNG](notation/parameter.png) · [Vector scene](notation/parameter.scene.json)

## Notation: primitive-types

**Primitive types**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Primitive types (label) | ![Primitive types](notation/primitive-types.svg) | `function acknowledge(): void;` |

Basic data types label values and signatures; fixed arrays, nominal records and enums build on them.

**Context:** void is shown as an interface result; other primitive types label fields/parameters/results. **Views:** gv, grv.

- Display bool, byte, uint, int, real, string or void as textual type labels in the owning compartment.
- byte is 0–255 and uint is a nonnegative safe integer. Integral narrowing checks the destination domain; real does not implicitly narrow.
- void labels function results only; an omitted function result means void.

[Complete model](../examples/notation/catalog.swaml) · `Notation::Completion`.

[SVG](notation/primitive-types.svg) · [PNG](notation/primitive-types.png) · [Vector scene](notation/primitive-types.scene.json)

## Notation: private-variable

**Private component variable**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Private component variable (compartment) | ![Private component variable](notation/private-variable.svg) | `var last: string = "";` |

Private component variable. Show a var name: Type = initializer row inside its component boundary.

**Context:** Private values compartment of Hello::Listener. **Views:** gv, grv.

- Show a var name: Type = initializer row inside its component boundary.
- Do not draw shared-storage connectors to this row; another component cannot read or write it directly.

[Complete model](../examples/01-hello.swaml) · `Hello::Listener.last`.

[SVG](notation/private-variable.svg) · [PNG](notation/private-variable.png) · [Vector scene](notation/private-variable.scene.json)

## Notation: record-value

**Record construction**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Record construction (label) | ![Record construction](notation/record-value.svg) | `record Measurement { value = twice(samples[i]); health = Health.Good; }` |

Record construction. Display record construction as expression text attached to its owning statement/field, with the nominal type visible.

**Context:** Initializer fragment inside Values::Producer.prepare; samples and i are local values. **Views:** gv, grv.

- Display record construction as expression text attached to its owning statement/field, with the nominal type visible.
- All declared fields are present exactly once; a record value MUST NOT be drawn as a mutable component occurrence.

[Complete model](../examples/05-values-and-flow.swaml) · `Values::Producer.prepare`.

[SVG](notation/record-value.svg) · [PNG](notation/record-value.png) · [Vector scene](notation/record-value.scene.json)

## Notation: datatype

**Record datatype**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Record datatype (node) | ![Record datatype](notation/datatype.svg) | `datatype Measurement { value: real; health: Health; }` |

Record datatype. Draw a classifier rectangle headed «datatype» and the nominal type name, followed by a field compartment.

**Context:** Nominal datatype declaration inside Values. **Views:** gv, grv.

- Draw a classifier rectangle headed «datatype» and the nominal type name, followed by a field compartment.
- Fields retain declared names/types; identical-looking declarations remain distinct nominal types.

[Complete model](../examples/05-values-and-flow.swaml) · `Values::Measurement`.

[SVG](notation/datatype.svg) · [PNG](notation/datatype.png) · [Vector scene](notation/datatype.scene.json)

## Notation: root-component

**Root component**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Root component (node) | ![Root component](notation/root-component.svg) | `component Demo: Pair;` |

Root component. Draw a containing component frame labeled «root component» and the selected occurrence name/type.

**Context:** Top-level named occurrence; its type is Roots::Pair. **Views:** gv, grv.

- Draw a containing component frame labeled «root component» and the selected occurrence name/type.
- Root selection is explicit; the frame is composition context and MUST NOT be drawn as an executable function or another authored system element.

[Complete model](../examples/09-component-roots.swaml) · `Roots::Demo`.

[SVG](notation/root-component.svg) · [PNG](notation/root-component.png) · [Vector scene](notation/root-component.scene.json)


## Timing and deployment

## Notation: concurrency-mode

**Concurrency mode**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Concurrency mode (label) | ![Concurrency mode](notation/concurrency-mode.svg) | `concurrency reentrant;` |

Concurrency mode. Write serial or reentrant in the function timing compartment; no color or parallel-lane icon substitutes for it.

**Context:** Timing property on Settings::SettingStore.read. **Views:** gv, grv.

- Write serial or reentrant in the function timing compartment; no color or parallel-lane icon substitutes for it.
- Reentrant activations read dispatch snapshots and cannot mutate component data; helper calls inherit the activation’s lock/snapshot context.

[Complete model](../examples/08-service-field.swaml) · `Settings::SettingStore.read`.

[SVG](notation/concurrency-mode.svg) · [PNG](notation/concurrency-mode.png) · [Vector scene](notation/concurrency-mode.scene.json)

## Notation: deployment

**Deployment binding**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Deployment binding (edge) | ![Deployment binding](notation/deployment.svg) | `deploy left on "sysml:Vehicle::leftComputer";` |

A deployment binds a component instance or root to an external system reference.

**Context:** Deployment of one component instance in ComponentReuse::Demo. **Views:** gv, grv.

- Draw a dashed open-arrow allocation link labeled deploy from the component instance to a flat external-system reference.
- Show the complete URI-like reference; deployment does not imply that a SysML or infrastructure model was loaded.
- Deployment inherits down the component tree unless a descendant supplies a more specific binding.

[Complete model](../examples/15-component-specialization.swaml) · `ComponentReuse::Demo`.

[SVG](notation/deployment.svg) · [PNG](notation/deployment.png) · [Vector scene](notation/deployment.scene.json)

## Notation: duration

**Duration value**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Duration value (label) | ![Duration value](notation/duration.svg) | `wcet 1 us;` |

Duration value. Render an integer and its explicit time unit together in timing, period, timeout or state-timer labels.

**Context:** Duration value in Roots::Counter.initialize; ns/us/ms/s are explicit alternatives. **Views:** gv, grv.

- Render an integer and its explicit time unit together in timing, period, timeout or state-timer labels.
- ns, us, ms and s are label components, not separate symbols; never imply a component from diagram scale.

[Complete model](../examples/09-component-roots.swaml) · `Roots::Counter.initialize`.

[SVG](notation/duration.svg) · [PNG](notation/duration.png) · [Vector scene](notation/duration.scene.json)

## Notation: deployment-target

**External deployment target**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| External deployment target (node) | ![External deployment target](notation/deployment-target.svg) | `deploy left on "sysml:Vehicle::leftComputer";` |

An external reference identifies the deployment system without introducing a hardware or execution-node definition into SWAML.

**Context:** An external system reference in ComponentReuse::Demo. **Views:** gv, grv.

- Draw a flat rectangle headed external system and show the exact reference as text.
- A sysml: reference may identify a separately modeled SysML part; SWAML does not resolve or validate that external model.
- This endpoint is placement metadata and never grants access to another component’s state.

[Complete model](../examples/15-component-specialization.swaml) · `ComponentReuse::Demo`.

[SVG](notation/deployment-target.svg) · [PNG](notation/deployment-target.png) · [Vector scene](notation/deployment-target.scene.json)

## Notation: timing-contract

**Function timing contract**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Function timing contract (label) | ![Function timing contract](notation/timing-contract.svg) | `timing { wcet 1 ms; deadline 3 ms; concurrency serial; }` |

Function timing contract. Attach a timing compartment to the function, listing wcet, deadline and concurrency explicitly.

**Context:** Contract on Control::Sensor.sample. **Views:** gv, grv.

- Attach a timing compartment to the function, listing wcet, deadline and concurrency explicitly.
- WCET counts active execution, deadline counts elapsed release-to-completion; the graphic alone supplies no schedulability proof.

[Complete model](../examples/02-realtime-controller.swaml) · `Control::Sensor.sample`.

[SVG](notation/timing-contract.svg) · [PNG](notation/timing-contract.png) · [Vector scene](notation/timing-contract.scene.json)

## Notation: execution-profile

**Root execution profile**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Root execution profile (label) | ![Root execution profile](notation/execution-profile.svg) | `component Product mixed` |

Root execution profile. Write the selected service, realtime or mixed profile in the root-component header or property compartment.

**Context:** Root header in Gateway; realtime and service are alternative profiles. **Views:** gv, grv.

- Write the selected service, realtime or mixed profile in the root-component header or property compartment.
- An omitted profile means service; suppressing a realtime/mixed label MUST NOT weaken the actual model’s timing obligations.

[Complete model](../examples/06-mixed-gateway.swaml) · `Gateway::Product`.

[SVG](notation/execution-profile.svg) · [PNG](notation/execution-profile.png) · [Vector scene](notation/execution-profile.scene.json)


## View projections

## Notation: view-browser

**Browser**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Browser (projection) | ![Browser](notation/view-browser.svg) | `package Roots` |

Browser. Draw a containment/navigation tree of existing packages, definitions, occurrences and owned members.

**Context:** Package header used as Browser navigation context, not a separate Browser declaration. **Views:** Browser.

- Draw a containment/navigation tree of existing packages, definitions, occurrences and owned members.
- Browser has no authored view keyword; navigation expansion does not create semantic containment or allocate behavior.

[Complete model](../examples/09-component-roots.swaml) · `Roots`.

[SVG](notation/view-browser.svg) · [PNG](notation/view-browser.png) · [Vector scene](notation/view-browser.scene.json)

## Notation: view-cv

**Case View**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Case View (projection) | ![Case View](notation/view-cv.svg) | `view cases cv of Shop;` |

Case View. Draw a framed projection titled cv with the semantic subject identity visible; use the canonical element symbols within it.

**Context:** View projection context; syntax refers to an existing semantic subject. **Views:** cv.

- Draw a framed projection titled cv with the semantic subject identity visible; use the canonical element symbols within it.
- The view adds presentation only. It MUST NOT introduce new routes, functions, performers or execution semantics.

[Complete model](../examples/03-service-pubsub.swaml) · `Commerce::cases`.

[SVG](notation/view-cv.svg) · [PNG](notation/view-cv.png) · [Vector scene](notation/view-cv.scene.json)

## Notation: view-fv

**Flow View**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Flow View (projection) | ![Flow View](notation/view-fv.svg) | `view lifecycle fv of Device.lifecycle;` |

Flow View. Draw a framed projection titled fv with the semantic subject identity visible; use the canonical element symbols within it.

**Context:** View projection context; syntax refers to an existing semantic subject. **Views:** fv.

- Draw a framed projection titled fv with the semantic subject identity visible; use the canonical element symbols within it.
- fv supports both statement flow and function-owned states. Keep the owning function frame and never reintroduce separate action/state views or a machine element.

[Complete model](../examples/04-stateful-function.swaml) · `Lifecycle::lifecycle`.

[SVG](notation/view-fv.svg) · [PNG](notation/view-fv.png) · [Vector scene](notation/view-fv.scene.json)

## Notation: view-gv

**General View**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| General View (projection) | ![General View](notation/view-gv.svg) | `view overview gv of Demo;` |

General View. Draw a framed projection titled gv with the semantic subject identity visible; use the canonical element symbols within it.

**Context:** View projection context; syntax refers to an existing semantic subject. **Views:** gv.

- Draw a framed projection titled gv with the semantic subject identity visible; use the canonical element symbols within it.
- The view adds presentation only. It MUST NOT introduce new routes, functions, performers or execution semantics.

[Complete model](../examples/01-hello.swaml) · `Hello::overview`.

[SVG](notation/view-gv.svg) · [PNG](notation/view-gv.png) · [Vector scene](notation/view-gv.scene.json)

## Notation: view-grv

**Grid View**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Grid View (projection) | ![Grid View](notation/view-grv.svg) | `view inventory grv of Demo;` |

Grid View. Draw a framed projection titled grv with the semantic subject identity visible; use the canonical element symbols within it.

**Context:** View projection context; syntax refers to an existing semantic subject. **Views:** grv.

- Draw a framed projection titled grv with the semantic subject identity visible; use the canonical element symbols within it.
- The view adds presentation only. It MUST NOT introduce new routes, functions, performers or execution semantics.

[Complete model](../examples/01-hello.swaml) · `Hello::inventory`.

[SVG](notation/view-grv.svg) · [PNG](notation/view-grv.png) · [Vector scene](notation/view-grv.scene.json)

## Notation: view-iv

**Interconnect View**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Interconnect View (projection) | ![Interconnect View](notation/view-iv.svg) | `view wiring iv of Conversation;` |

Interconnect View. Draw a framed projection titled iv with the semantic subject identity visible; use the canonical element symbols within it.

**Context:** View projection context; syntax refers to an existing semantic subject. **Views:** iv.

- Draw a framed projection titled iv with the semantic subject identity visible; use the canonical element symbols within it.
- The view adds presentation only. It MUST NOT introduce new routes, functions, performers or execution semantics.

[Complete model](../examples/01-hello.swaml) · `Hello::wiring`.

[SVG](notation/view-iv.svg) · [PNG](notation/view-iv.png) · [Vector scene](notation/view-iv.scene.json)

## Notation: view-sv

**Sequence View**

| Element | Graphical notation | Textual notation |
| --- | --- | --- |
| Sequence View (projection) | ![Sequence View](notation/view-sv.svg) | `view interaction sv of Poll;` |

Sequence View. Draw a framed projection titled sv with the semantic subject identity visible; use the canonical element symbols within it.

**Context:** View projection context; syntax refers to an existing semantic subject. **Views:** sv.

- Draw a framed projection titled sv with the semantic subject identity visible; use the canonical element symbols within it.
- The view adds presentation only. It MUST NOT introduce new routes, functions, performers or execution semantics.

[Complete model](../examples/07-client-server.swaml) · `Rpc::interaction`.

[SVG](notation/view-sv.svg) · [PNG](notation/view-sv.png) · [Vector scene](notation/view-sv.scene.json)

## Coverage and interpretation

The inventory explicitly assigns every current grammar production and keyword to a graphical concept or a justified text-only role. This is a notation coverage claim, not an assertion that an editor or layout engine is implemented. Run `node scripts/check-notation.mjs` for semantic coverage and context checks, and `python3 scripts/build-notation.py --check` for reproducible artifacts.

## Keyword coverage

| Term | Representation | Concept and rationale |
| --- | --- | --- |
| `after` | glyph | [Residence timer transition](#notation-timer-transition), [Case causal order](#notation-case-causal-order). Residence timer transition; Case causal order. |
| `and` | label | [Expressions and value paths](#notation-expression). Expressions and value paths. |
| `as` | glyph | [Routed function call](#notation-routed-call). Routed function call. |
| `assert` | glyph | [Assertion](#notation-assert). Assertion. |
| `atLeastOnce` | label | [Delivery policy](#notation-delivery-policy). Delivery policy. |
| `atMostOnce` | label | [Delivery policy](#notation-delivery-policy). Delivery policy. |
| `attribute` | label | [Requirement attribute](#notation-requirement-attribute). Requirement attribute. |
| `bestEffort` | label | [Delivery policy](#notation-delivery-policy). Delivery policy. |
| `bool` | label | [Primitive types](#notation-primitive-types). Primitive types. |
| `bound` | glyph | [Bounded loop](#notation-bounded-loop). Bounded loop. |
| `by` | glyph | [Satisfaction relation](#notation-satisfies-link). Satisfaction relation. |
| `byte` | label | [Primitive types](#notation-primitive-types). Primitive types. |
| `calc` | label | [Pure calculation](#notation-calculation). Pure calculation. |
| `call` | glyph | [RPC handler activation](#notation-trigger-call), [Local function call](#notation-local-call), [Routed function call](#notation-routed-call), [Case request](#notation-case-request). RPC handler activation; Local function call; Routed function call; Case request. |
| `capacity` | label | [Queue capacity](#notation-capacity-policy). Queue capacity. |
| `client` | glyph | [RPC client port](#notation-port-client). RPC client port. |
| `clientServer` | glyph | [Client–server interface](#notation-client-server-interface). Client–server interface. |
| `completion` | glyph | [Completion transition](#notation-completion-transition). Completion transition. |
| `component` | glyph | [Component definition](#notation-component-definition), [Component usage](#notation-component-usage), [Occurrence typing relationship](#notation-type-relationship), [Root component](#notation-root-component), [Inline root composition](#notation-inline-root). Component definition; Component usage; Occurrence typing relationship; Root component; Inline root composition. |
| `concurrency` | label | [Concurrency mode](#notation-concurrency-mode). Concurrency mode. |
| `connect` | glyph | [Interface connector](#notation-connector). Interface connector. |
| `cv` | glyph | [Case View](#notation-view-cv). Case View. |
| `data` | label | [Data member](#notation-data-member). Data member. |
| `datatype` | glyph | [Record datatype](#notation-datatype). Record datatype. |
| `deadline` | label | [Function timing contract](#notation-timing-contract). Function timing contract. |
| `def` | glyph | [Component definition](#notation-component-definition), [Reusable QoS policy](#notation-qos-policy-definition). Component definition; Reusable QoS policy. |
| `delegate` | glyph | [Boundary delegation](#notation-delegation). Boundary delegation. |
| `delivery` | label | [Delivery policy](#notation-delivery-policy). Delivery policy. |
| `deploy` | glyph | [Deployment binding](#notation-deployment). Deployment binding. |
| `doc` | label | [Formal documentation](#notation-formal-documentation). Formal documentation. |
| `dropNewest` | label | [Overflow behavior](#notation-overflow-policy). Overflow behavior. |
| `dropOldest` | label | [Overflow behavior](#notation-overflow-policy). Overflow behavior. |
| `else` | glyph | [Conditional branch](#notation-conditional). Conditional branch. |
| `entry` | label | [State entry behavior](#notation-state-entry). State entry behavior. |
| `enum` | glyph | [Enumeration](#notation-enumeration). Enumeration. |
| `event` | label | [Event member](#notation-event-member). Event member. |
| `every` | label | [Periodic activation](#notation-trigger-periodic). Periodic activation. |
| `exit` | label | [State exit behavior](#notation-state-exit). State exit behavior. |
| `fail` | glyph | [Failure](#notation-fail). Failure. |
| `false` | label | [Expressions and value paths](#notation-expression). Expressions and value paths. |
| `fifo` | label | [Queue ordering](#notation-ordering-policy). Queue ordering. |
| `final` | glyph | [Final state](#notation-final-state). Final state. |
| `for` | glyph | [Use case](#notation-case). Use case. |
| `function` | glyph | [Interface function signature](#notation-function-signature), [Executable function](#notation-function), [Function with states](#notation-stateful-function). Interface function signature; Executable function; Function with states. |
| `fv` | glyph | [Flow View](#notation-view-fv). Flow View. |
| `grv` | glyph | [Grid View](#notation-view-grv). Grid View. |
| `gv` | glyph | [General View](#notation-view-gv). General View. |
| `idempotent` | label | [Interface function signature](#notation-function-signature). Interface function signature. |
| `if` | glyph | [Conditional branch](#notation-conditional). Conditional branch. |
| `import` | glyph | [Package import](#notation-import). Package import. |
| `in` | label | [Pure calculation](#notation-calculation). Pure calculation. |
| `include` | glyph | [Filtered view selection](#notation-view-selection). Filtered view selection. |
| `initial` | glyph | [Function with states](#notation-stateful-function), [Initial state reference](#notation-initial-state). Function with states; Initial state reference. |
| `int` | label | [Primitive types](#notation-primitive-types). Primitive types. |
| `interface` | glyph | [Sender–receiver interface](#notation-sender-receiver-interface), [Client–server interface](#notation-client-server-interface), [Publish–subscribe interface](#notation-publish-subscribe-interface), [Service interface](#notation-service-interface). Sender–receiver interface; Client–server interface; Publish–subscribe interface; Service interface. |
| `iv` | glyph | [Interconnect View](#notation-view-iv). Interconnect View. |
| `label` | glyph | [Case data exchange](#notation-case-data-exchange), [Case event exchange](#notation-case-event-exchange), [Case request](#notation-case-request), [Correlated case reply](#notation-case-reply), [Case causal order](#notation-case-causal-order). Case data exchange; Case event exchange; Case request; Correlated case reply; Case causal order. |
| `manual` | label | [Manual activation](#notation-trigger-manual). Manual activation. |
| `maxAge` | label | [Message freshness bound](#notation-freshness-bound). Message freshness bound. |
| `maxLatency` | label | [Transport latency bound](#notation-latency-bound). Transport latency bound. |
| `mixed` | label | [Root execution profile](#notation-execution-profile). Root execution profile. |
| `ms` | label | [Duration value](#notation-duration). Duration value. |
| `not` | label | [Expressions and value paths](#notation-expression). Expressions and value paths. |
| `ns` | label | [Duration value](#notation-duration). Duration value. |
| `of` | glyph | [General View](#notation-view-gv), [Interconnect View](#notation-view-iv), [Case View](#notation-view-cv), [Sequence View](#notation-view-sv), [Grid View](#notation-view-grv), [Flow View](#notation-view-fv). General View; Interconnect View; Case View; Sequence View; Grid View; Flow View. |
| `on` | glyph | [Startup activation](#notation-trigger-start), [Manual activation](#notation-trigger-manual), [Periodic activation](#notation-trigger-periodic), [Port receive activation](#notation-trigger-receive), [RPC handler activation](#notation-trigger-call), [State transition](#notation-transition), [Deployment binding](#notation-deployment). Startup activation; Manual activation; Periodic activation; Port receive activation; RPC handler activation; State transition; Deployment binding. |
| `optional` | label | [Optional port](#notation-optional-port). Optional port. |
| `or` | label | [Expressions and value paths](#notation-expression). Expressions and value paths. |
| `ordering` | label | [Queue ordering](#notation-ordering-policy). Queue ordering. |
| `otherwise` | glyph | [Routed function call](#notation-routed-call). Routed function call. |
| `overflow` | label | [Overflow behavior](#notation-overflow-policy). Overflow behavior. |
| `package` | glyph | [Package](#notation-package). Package. |
| `port` | glyph | [Data sender port](#notation-port-sender), [Data receiver port](#notation-port-receiver), [RPC client port](#notation-port-client), [RPC server port](#notation-port-server), [Event publisher port](#notation-port-publisher), [Event subscriber port](#notation-port-subscriber), [Service provider port](#notation-port-provides), [Service consumer port](#notation-port-requires). Data sender port; Data receiver port; RPC client port; RPC server port; Event publisher port; Event subscriber port; Service provider port; Service consumer port. |
| `priority` | label | [Transition priority](#notation-transition-priority). Transition priority. |
| `provides` | glyph | [Service provider port](#notation-port-provides). Service provider port. |
| `publish` | glyph | [Event publication](#notation-publish), [Case event exchange](#notation-case-event-exchange). Event publication; Case event exchange. |
| `publisher` | glyph | [Event publisher port](#notation-port-publisher). Event publisher port. |
| `publishSubscribe` | glyph | [Publish–subscribe interface](#notation-publish-subscribe-interface). Publish–subscribe interface. |
| `qos` | glyph | [Delivery policy](#notation-delivery-policy), [Reusable QoS policy](#notation-qos-policy-definition), [Named connector policy](#notation-qos-policy-reference). Delivery policy; Reusable QoS policy; Named connector policy. |
| `queued` | label | [Data member](#notation-data-member). Data member. |
| `real` | label | [Primitive types](#notation-primitive-types). Primitive types. |
| `realtime` | label | [Root execution profile](#notation-execution-profile). Root execution profile. |
| `receive` | glyph | [Port receive activation](#notation-trigger-receive), [State transition](#notation-transition). Port receive activation; State transition. |
| `receiver` | glyph | [Data receiver port](#notation-port-receiver). Data receiver port. |
| `record` | label | [Record construction](#notation-record-value). Record construction. |
| `recursive` | glyph | [Filtered view selection](#notation-view-selection). Filtered view selection. |
| `redefines` | label | [Member redefinition](#notation-member-redefinition). Member redefinition. |
| `reentrant` | label | [Concurrency mode](#notation-concurrency-mode). Concurrency mode. |
| `reject` | label | [Overflow behavior](#notation-overflow-policy). Overflow behavior. |
| `reply` | glyph | [Correlated case reply](#notation-case-reply). Correlated case reply. |
| `requirement` | glyph | [Requirement](#notation-requirement). Requirement. |
| `requires` | glyph | [Service consumer port](#notation-port-requires). Service consumer port. |
| `return` | glyph | [Pure calculation](#notation-calculation), [Function return](#notation-return). Pure calculation; Function return. |
| `s` | label | [Duration value](#notation-duration). Duration value. |
| `sampled` | label | [Data member](#notation-data-member). Data member. |
| `satisfy` | glyph | [Satisfaction relation](#notation-satisfies-link). Satisfaction relation. |
| `send` | glyph | [Data send](#notation-send), [Case data exchange](#notation-case-data-exchange). Data send; Case data exchange. |
| `sender` | glyph | [Data sender port](#notation-port-sender). Data sender port. |
| `senderReceiver` | glyph | [Sender–receiver interface](#notation-sender-receiver-interface). Sender–receiver interface. |
| `serial` | label | [Concurrency mode](#notation-concurrency-mode). Concurrency mode. |
| `server` | glyph | [RPC server port](#notation-port-server). RPC server port. |
| `service` | glyph | [Service interface](#notation-service-interface), [Root execution profile](#notation-execution-profile). Service interface; Root execution profile. |
| `specializes` | glyph | [Component specialization](#notation-component-specialization). Component specialization. |
| `start` | label | [Startup activation](#notation-trigger-start). Startup activation. |
| `state` | glyph | [State](#notation-state), [Final state](#notation-final-state). State; Final state. |
| `string` | label | [Primitive types](#notation-primitive-types). Primitive types. |
| `subscriber` | glyph | [Event subscriber port](#notation-port-subscriber). Event subscriber port. |
| `sv` | glyph | [Sequence View](#notation-view-sv). Sequence View. |
| `timing` | label | [Function timing contract](#notation-timing-contract). Function timing contract. |
| `transition` | glyph | [State transition](#notation-transition). State transition. |
| `true` | label | [Expressions and value paths](#notation-expression). Expressions and value paths. |
| `uint` | label | [Primitive types](#notation-primitive-types). Primitive types. |
| `unordered` | label | [Queue ordering](#notation-ordering-policy). Queue ordering. |
| `us` | label | [Duration value](#notation-duration). Duration value. |
| `useCase` | glyph | [Use case](#notation-case). Use case. |
| `var` | glyph | [Private component variable](#notation-private-variable), [Local declaration](#notation-local-declaration). Private component variable; Local declaration. |
| `verificationCase` | glyph | [Verification case](#notation-verification-case). Verification case. |
| `verify` | glyph | [Verification relation](#notation-verification-link). Verification relation. |
| `version` | glyph | [Sender–receiver interface](#notation-sender-receiver-interface), [Client–server interface](#notation-client-server-interface), [Publish–subscribe interface](#notation-publish-subscribe-interface), [Service interface](#notation-service-interface). Sender–receiver interface; Client–server interface; Publish–subscribe interface; Service interface. |
| `via` | glyph | [Case data exchange](#notation-case-data-exchange), [Case event exchange](#notation-case-event-exchange), [Case request](#notation-case-request), [Correlated case reply](#notation-case-reply). Case data exchange; Case event exchange; Case request; Correlated case reply. |
| `view` | glyph | [General View](#notation-view-gv), [Interconnect View](#notation-view-iv), [Case View](#notation-view-cv), [Sequence View](#notation-view-sv), [Grid View](#notation-view-grv), [Flow View](#notation-view-fv). General View; Interconnect View; Case View; Sequence View; Grid View; Flow View. |
| `void` | label | [Primitive types](#notation-primitive-types). Primitive types. |
| `wcet` | label | [Function timing contract](#notation-timing-contract). Function timing contract. |
| `when` | label | [Transition guard](#notation-transition-guard). Transition guard. |
| `where` | glyph | [Filtered view selection](#notation-view-selection). Filtered view selection. |
| `while` | glyph | [Bounded loop](#notation-bounded-loop). Bounded loop. |
| `within` | glyph | [Routed function call](#notation-routed-call). Routed function call. |

## Grammar production coverage

| Term | Representation | Concept and rationale |
| --- | --- | --- |
| `AdditiveExpression` | text-only | Precedence grouping only; arithmetic text belongs to the expression label. |
| `AndExpression` | text-only | Precedence grouping only; operator text belongs to the expression label. |
| `Argument` | label | [Parameter or record field](#notation-parameter). Parameter or record field. |
| `ArrayLiteral` | label | [Fixed array type and value](#notation-array-value). Fixed array type and value. |
| `Assert` | glyph | [Assertion](#notation-assert). Assertion. |
| `Assign` | glyph | [Assignment](#notation-assignment). Assignment. |
| `Attribute` | label | [Requirement attribute](#notation-requirement-attribute). Requirement attribute. |
| `Block` | glyph | [Executable function](#notation-function), [State entry behavior](#notation-state-entry), [State exit behavior](#notation-state-exit). Executable function; State entry behavior; State exit behavior. |
| `Calculation` | label | [Pure calculation](#notation-calculation). Pure calculation. |
| `CalculationCall` | label | [Pure calculation](#notation-calculation). Pure calculation. |
| `Component` | glyph | [Component definition](#notation-component-definition), [Component specialization](#notation-component-specialization). Component definition; Component specialization. |
| `ComponentMember` | label | [Member redefinition](#notation-member-redefinition). Member redefinition. |
| `Connect` | glyph | [Interface connector](#notation-connector). Interface connector. |
| `DataMember` | label | [Data member](#notation-data-member). Data member. |
| `DataType` | glyph | [Record datatype](#notation-datatype). Record datatype. |
| `Delegate` | glyph | [Boundary delegation](#notation-delegation). Boundary delegation. |
| `Deployment` | glyph | [External deployment target](#notation-deployment-target), [Deployment binding](#notation-deployment). External deployment target; Deployment binding. |
| `DOC_COMMENT` | label | [Formal documentation](#notation-formal-documentation). Formal documentation. |
| `Documentation` | label | [Formal documentation](#notation-formal-documentation). Formal documentation. |
| `Duration` | glyph | [Transport latency bound](#notation-latency-bound), [Message freshness bound](#notation-freshness-bound), [Residence timer transition](#notation-timer-transition), [Duration value](#notation-duration). Transport latency bound; Message freshness bound; Residence timer transition; Duration value. |
| `Element` | text-only | Grammar union selecting a top-level element; each concrete alternative has its own notation. |
| `EnumType` | glyph | [Enumeration](#notation-enumeration). Enumeration. |
| `EqualityExpression` | text-only | Precedence grouping only; equality text belongs to the expression label. |
| `EventMember` | label | [Event member](#notation-event-member). Event member. |
| `Expression` | label | [Expressions and value paths](#notation-expression). Expressions and value paths. |
| `Fail` | glyph | [Failure](#notation-fail). Failure. |
| `FieldValue` | label | [Record construction](#notation-record-value). Record construction. |
| `FunctionDef` | glyph | [Executable function](#notation-function), [Function with states](#notation-stateful-function). Executable function; Function with states. |
| `FunctionFlow` | glyph | [Executable function](#notation-function). Executable function. |
| `ID` | text-only | Identifier token supplies names on shapes and labels; no independent glyph. |
| `If` | glyph | [Conditional branch](#notation-conditional). Conditional branch. |
| `Import` | glyph | [Package import](#notation-import). Package import. |
| `Instance` | glyph | [Component usage](#notation-component-usage), [Occurrence typing relationship](#notation-type-relationship), [Occurrence lifeline](#notation-sequence-lifeline). Component usage; Occurrence typing relationship; Occurrence lifeline. |
| `INT` | text-only | Integer literal token is rendered as exact expression/property text; no independent glyph. |
| `Interface` | glyph | [Sender–receiver interface](#notation-sender-receiver-interface), [Client–server interface](#notation-client-server-interface), [Publish–subscribe interface](#notation-publish-subscribe-interface), [Service interface](#notation-service-interface). Sender–receiver interface; Client–server interface; Publish–subscribe interface; Service interface. |
| `InterfaceMember` | label | [Data member](#notation-data-member), [Event member](#notation-event-member), [Interface function signature](#notation-function-signature). Data member; Event member; Interface function signature. |
| `Literal` | label | [Expressions and value paths](#notation-expression). Expressions and value paths. |
| `LocalCall` | glyph | [Local function call](#notation-local-call). Local function call. |
| `LocalVariable` | glyph | [Local declaration](#notation-local-declaration). Local declaration. |
| `MemberPath` | glyph | [Routed function call](#notation-routed-call). Routed function call. |
| `ML_COMMENT` | glyph | [Ordinary comment](#notation-ordinary-comment). Ordinary comment. |
| `Model` | text-only | A source/workspace container, shown by Browser/package context; it has no additional authored glyph. |
| `MultiplicativeExpression` | text-only | Precedence grouping only; arithmetic text belongs to the expression label. |
| `NUMBER` | text-only | real literal token is rendered as exact expression text; no independent glyph. |
| `Numeric` | text-only | Number conversion/lexical grouping; render the resulting value text in its owning label. |
| `OrExpression` | text-only | Precedence grouping only; operator text belongs to the expression label. |
| `Package` | glyph | [Package](#notation-package), [Browser](#notation-view-browser). Package; Browser. |
| `Parameter` | label | [Parameter or record field](#notation-parameter). Parameter or record field. |
| `Path` | text-only | Containment/member path text identifies diagram subjects or endpoints, not an independent shape. |
| `Port` | glyph | [Data sender port](#notation-port-sender), [Data receiver port](#notation-port-receiver), [RPC client port](#notation-port-client), [RPC server port](#notation-port-server), [Event publisher port](#notation-port-publisher), [Event subscriber port](#notation-port-subscriber), [Service provider port](#notation-port-provides), [Service consumer port](#notation-port-requires), [Optional port](#notation-optional-port). Data sender port; Data receiver port; RPC client port; RPC server port; Event publisher port; Event subscriber port; Service provider port; Service consumer port; Optional port. |
| `PrimaryExpression` | text-only | Grammar grouping of concrete expression forms; no separate authored semantic element. |
| `Qos` | label | [Delivery policy](#notation-delivery-policy), [Queue ordering](#notation-ordering-policy), [Queue capacity](#notation-capacity-policy), [Overflow behavior](#notation-overflow-policy), [Transport latency bound](#notation-latency-bound), [Message freshness bound](#notation-freshness-bound), [Named connector policy](#notation-qos-policy-reference). Delivery policy; Queue ordering; Queue capacity; Overflow behavior; Transport latency bound; Message freshness bound; Named connector policy. |
| `QosBody` | glyph | [Delivery policy](#notation-delivery-policy), [Queue ordering](#notation-ordering-policy), [Queue capacity](#notation-capacity-policy), [Overflow behavior](#notation-overflow-policy), [Transport latency bound](#notation-latency-bound), [Message freshness bound](#notation-freshness-bound), [Reusable QoS policy](#notation-qos-policy-definition). Delivery policy; Queue ordering; Queue capacity; Overflow behavior; Transport latency bound; Message freshness bound; Reusable QoS policy. |
| `QosPolicy` | glyph | [Reusable QoS policy](#notation-qos-policy-definition). Reusable QoS policy. |
| `QualifiedName` | text-only | Package-qualified declaration identity is text in the owning label. |
| `RecordLiteral` | label | [Record construction](#notation-record-value). Record construction. |
| `ReferenceExpression` | label | [Enumeration value](#notation-enum-value), [Expressions and value paths](#notation-expression). Enumeration value; Expressions and value paths. |
| `RelationalExpression` | text-only | Precedence grouping only; comparison text belongs to the expression label. |
| `RemoteCall` | glyph | [Routed function call](#notation-routed-call). Routed function call. |
| `Requirement` | glyph | [Requirement](#notation-requirement). Requirement. |
| `Return` | glyph | [Function return](#notation-return). Function return. |
| `RootComponent` | glyph | [Occurrence typing relationship](#notation-type-relationship), [Root component](#notation-root-component), [Inline root composition](#notation-inline-root), [Root execution profile](#notation-execution-profile). Occurrence typing relationship; Root component; Inline root composition; Root execution profile. |
| `RootMember` | glyph | [Root component](#notation-root-component), [Inline root composition](#notation-inline-root). Root component; Inline root composition. |
| `Satisfaction` | glyph | [Satisfaction relation](#notation-satisfies-link). Satisfaction relation. |
| `Scenario` | glyph | [Use case](#notation-case), [Verification case](#notation-verification-case). Use case; Verification case. |
| `ScenarioStep` | glyph | [Case data exchange](#notation-case-data-exchange), [Case event exchange](#notation-case-event-exchange), [Case request](#notation-case-request), [Correlated case reply](#notation-case-reply), [Case causal order](#notation-case-causal-order). Case data exchange; Case event exchange; Case request; Correlated case reply; Case causal order. |
| `Send` | glyph | [Data send](#notation-send), [Event publication](#notation-publish). Data send; Event publication. |
| `Signature` | label | [Interface function signature](#notation-function-signature). Interface function signature. |
| `SL_COMMENT` | glyph | [Ordinary comment](#notation-ordinary-comment). Ordinary comment. |
| `State` | glyph | [State](#notation-state), [Final state](#notation-final-state), [State entry behavior](#notation-state-entry), [State exit behavior](#notation-state-exit). State; Final state; State entry behavior; State exit behavior. |
| `StateBody` | glyph | [Function with states](#notation-stateful-function), [Initial state reference](#notation-initial-state). Function with states; Initial state reference. |
| `Statement` | glyph | [Executable function](#notation-function). Executable function. |
| `STRING` | text-only | string literal token supplies values/requirement text; preserve escaping in source notation. |
| `Timing` | label | [Function timing contract](#notation-timing-contract), [Concurrency mode](#notation-concurrency-mode). Function timing contract; Concurrency mode. |
| `Transition` | glyph | [State transition](#notation-transition), [Transition guard](#notation-transition-guard), [Transition priority](#notation-transition-priority), [Completion transition](#notation-completion-transition), [Residence timer transition](#notation-timer-transition). State transition; Transition guard; Transition priority; Completion transition; Residence timer transition. |
| `Trigger` | label | [Startup activation](#notation-trigger-start), [Manual activation](#notation-trigger-manual), [Periodic activation](#notation-trigger-periodic), [Port receive activation](#notation-trigger-receive), [RPC handler activation](#notation-trigger-call). Startup activation; Manual activation; Periodic activation; Port receive activation; RPC handler activation. |
| `TypeRef` | label | [Primitive types](#notation-primitive-types), [Fixed array type and value](#notation-array-value). Primitive types; Fixed array type and value. |
| `UnaryExpression` | label | [Expressions and value paths](#notation-expression). Expressions and value paths. |
| `ValuePath` | label | [Enumeration value](#notation-enum-value). Enumeration value. |
| `ValueType` | glyph | [Record datatype](#notation-datatype), [Enumeration](#notation-enumeration). Record datatype; Enumeration. |
| `Variable` | label | [Private component variable](#notation-private-variable). Private component variable. |
| `Verification` | glyph | [Verification relation](#notation-verification-link). Verification relation. |
| `View` | glyph | [General View](#notation-view-gv), [Interconnect View](#notation-view-iv), [Case View](#notation-view-cv), [Sequence View](#notation-view-sv), [Grid View](#notation-view-grv), [Flow View](#notation-view-fv). General View; Interconnect View; Case View; Sequence View; Grid View; Flow View. |
| `ViewSelection` | glyph | [Filtered view selection](#notation-view-selection). Filtered view selection. |
| `While` | glyph | [Bounded loop](#notation-bounded-loop). Bounded loop. |
| `WS` | text-only | Whitespace affects textual layout only; no semantic graphical representation. |
