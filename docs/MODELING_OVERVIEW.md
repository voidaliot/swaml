# SWAML at a glance

SWAML models software composition, typed communication, function behavior, timing, deployment and traceable requirements. Follow one example from a buyer’s goal to the final software structure below. The [interactive landing page](https://voidaliot.github.io/swaml/#modeling-overview) presents the same graphs with selectable source details.

## The graphical ontology

Definitions describe reusable types; occurrences identify their use in a concrete assembly. Components own child components, private state and functions. Functions own calculations and their flow or states; calculations turn typed inputs into a named pure result. Every cross-component exchange follows a typed port and explicit route.

![SWAML graphical ontology: definitions, occurrences, owned behavior, values, contracts, routes and traceable views](assets/modeling-ontology.svg)

Solid ontology arrows indicate ownership or expansion; dashed arrows indicate references. The cards group related concepts for a quick introduction. The [complete ontology and view guide](ONTOLOGY_AND_VIEWS.md) and [canonical notation catalog](GRAPHICAL_CATALOG.md) provide the full inventory.

| Modeling question | SWAML elements | Useful view |
| --- | --- | --- |
| What software exists, and what owns it? | component definitions and occurrences | Browser, gv |
| What crosses a boundary? | interfaces, ports, connectors, delegation, QoS | iv |
| Which outcome and scenario matter? | requirements, cases and routed exchange steps | cv, sv |
| What does the software do? | component-owned functions, statement flow or owned states | fv |
| What runs where, and under which constraints? | external system/part references, timing and concurrency | gv, grv |

## 1. Begin with the use case

**Buyer goal:** place an order, reserve available stock, receive confirmation and a receipt. This user story motivates the named requirement `ReserveBeforeAccept`. The `Purchase` case references the `Production` root and claims coverage of that requirement.

![Buyer goal, ReserveBeforeAccept requirement, Purchase case and Production root](assets/modeling-intent.svg)

The buyer is explanatory context. `browser : BrowserClient` models the communicating client through an owned port. The `satisfy` relation records intent; supporting evidence is assessed separately.

## 2. Describe the message flow

The successful `Purchase` scenario requests checkout, reserves stock, receives the reservation result, publishes two events and returns the checkout result. Each step names its interface member and route; `after` labels define the intended order.

![Six Purchase exchanges connected by their explicit after dependencies](assets/modeling-interactions.svg)

These arrows connect scenario steps. The architectural connectors are `checkoutLink`, `inventoryLink` and `receiptLink`. Replies stay correlated with their requests; receipt and confirmation have their own receiving functions.

## 3. Open the function flow

`Production.application.checkout.submit` implements checkout. It requests inventory with a 200 ms timeout and returns `false` on request failure or refused stock. On acceptance, it updates its private counter, publishes acceptance, publishes a receipt and returns `true`.

![Checkout function control flow with reservation refusal, request failure and publication failure](assets/modeling-flow.svg)

Publication admission can fail after earlier effects have committed. The example has no distributed rollback. A timed-out inventory request also does not cancel stock changes that may already have occurred.

## 4. Assign clear software ownership

Four behavior-owning component instances contain six functions. `application` and `inventory` are component boundaries around their respective `checkout` and `stock` components; their boundary ports delegate to those components.

![Component occurrence compartments listing owned functions, triggers and private data](assets/modeling-functions.svg)

| Scenario concern | Actual behavior owner |
| --- | --- |
| Start the purchase | `Production.browser.buy` |
| Decide acceptance and emit both events | `Production.application.checkout.submit` |
| Check and decrement stock | `Production.inventory.stock.reserve` |
| Record the acceptance event | `Production.browser.confirmation` |
| Process the receipt event | `Production.mailer.prepareReceipt` |
| Exercise an oversized-order rejection | `Production.browser.overOrder` |

The case references exchanges; it does not call these functions. Their declared triggers and routed messages activate them. For example, the browser’s serial `buy` function can delay its `confirmation` handler until the checkout request completes.

## 5. Inspect the final structure

`WebShop::Production` contains four immediate child components. The application and inventory components each contain one further component, for six descendants in total. Three named connectors and four external deployment references complete the architecture.

![Production software structure with browser, application and checkout, inventory and stock, receipt worker and three connectors](assets/modeling-structure.svg)

| Connector | Port route | Contract and policy |
| --- | --- | --- |
| `checkoutLink` | `browser.checkout` → `application.api` | `Checkout` service; `RequestQueue` |
| `inventoryLink` | `application.inventory` → `inventory.api` | `Inventory` client–server; `RequestQueue` |
| `receiptLink` | `application.receipts` → `mailer.input` | `Receipts` publish–subscribe; `ReceiptQueue` |

Both policies use at-most-once delivery, FIFO ordering and rejecting overflow; capacities are 16 and 32 respectively. Selecting the same `RequestQueue` values leaves the two connectors’ queues independent. Service events and RPC replies travel back over their existing route.

## Try the complete model

Open the [complete WebShop source](../examples/13-web-application.swaml), [simulation configuration](../examples/simulation/13-web-application.json) and [expected final stores](../examples/simulation/runs.json). The configured run accepts two items from stock 10, rejects an order for 99, records one accepted order and one receipt, and leaves stock at 8. This is bounded reference-simulation evidence; the descriptive case is not automatically a verified execution trace.

The same modeling steps apply to the [Classic, Adaptive and cloud examples](ARCHITECTURE_PATTERNS.md). Use the [quick start](QUICK_START.md) for authoring and validation commands. These original flat graphs share one [source inventory](../spec/modeling-overview.json) with the interactive presentation and reproducible SVG/PDF scenes.

## Requirements and formal documentation

Requirements own typed attributes and one optional `doc /* ... */` specification. Design elements link through `satisfy`; verification cases link through `verify`. Use cases describe intent. Ordinary comments remain independent notes. View kinds use lower camel case, and view blocks combine multiple selections and Boolean filters. See the [guide](REQUIREMENTS_AND_DOCUMENTATION.md) and [complete model](../examples/16-requirements-and-views.swaml).
