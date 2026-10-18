# Architecture patterns

SWAML 1.3 uses the same architecture model for embedded control, Adaptive applications, service-oriented systems and cloud services: reusable definitions, owned ports, typed contracts, explicit connectors, local behavior and deployment occurrences. Start from the example closest to your system, then replace its contracts and behavior with your own.

These models are executable logical examples. Their platform names describe the intended architecture context. A target binding supplies middleware, operating-system and infrastructure configuration; SWAML does not generate those artifacts. See [execution bindings](spec/06-execution-contract.md) for the contract and [implementation status](IMPLEMENTATION_STATUS.md) for delivered capabilities.

| Architecture | Complete model | Root | Main interactions |
| --- | --- | --- | --- |
| AUTOSAR Classic climate SW-C | [11-autosar-classic.swaml](../examples/11-autosar-classic.swaml) | `ClassicClimate::Vehicle` | Sampled temperature, client/server calibration, sampled actuator command |
| AUTOSAR Adaptive diagnostic application | [12-autosar-adaptive.swaml](../examples/12-autosar-adaptive.swaml) | `AdaptiveDiagnostics::Vehicle` | Service methods, changed notification, audit publication |
| Service-based web application | [13-web-application.swaml](../examples/13-web-application.swaml) | `WebShop::Production` | Checkout request, inventory reservation, receipt publication |
| Cloud telemetry service | [14-cloud-service.swaml](../examples/14-cloud-service.swaml) | `CloudTelemetry::Production` | Ingestion, explicit broker, independent analytics/archive subscriptions |

Each model declares gv for composition, iv for contracts and wiring, cv for intended requirement coverage, sv for a representative interaction, grv for deployment and fv for a function. gv supports Box in box and Tree layouts. The separate [function timing model](../examples/17-function-timing.swaml) demonstrates tv with identified simulation observations and separately labeled declared contracts. Browser navigation follows the same definition and occurrence ownership. The [interactive showcase](../showcase/README.md) presents these four architectures alongside the interface reference.

## AUTOSAR Classic: a climate software component

AUTOSAR Classic separates application software, the runtime environment and basic software on a microcontroller. SWAML can describe the application responsibilities and their communication before a target integration supplies the RTE and basic-software configuration. [AUTOSAR Classic overview](https://www.autosar.org/standards/classic-platform/).

The example gives the climate controller three explicit boundary ports. A sensor emits 28 °C every 10 ms; the controller requests a 22 °C setpoint, calculates a bounded fan duty and sends 0.6 to the actuator. A missing calibration response selects duty 0.0 through an explicit timeout branch. The root's components are allocated to the external identity `system:bodyEcu`; a SysML integration can bind an equivalent `sysml:` part identity.

| SWAML subject | Architecture responsibility |
| --- | --- |
| `controller: ClimateController` | SW-C boundary with temperature, calibration and fan ports |
| `controller.control: ClimateLogic` | Internal behavior and private controller values |
| `regulate` function | Runnable-like reaction to received temperature |
| `CabinTemperature`, `FanCommand` | Sender/receiver data contracts |
| `Setpoint` | Client/server calibration query |
| `measured`, `calibrated`, `commanded` | Explicit assembly communication routes |

This is a modeling correspondence. AUTOSAR's Software Component Template defines its own component, port, internal-behavior and runnable metamodel. A SWAML component is useful for grouping owned data and runnable-like functions; it is not an additional AUTOSAR component forced into the implementation. Preserve that grouping in an explicit mapping. [AUTOSAR Software Component Template, R24-11](https://www.autosar.org/fileadmin/standards/R24-11/CP/AUTOSAR_CP_TPS_SoftwareComponentTemplate.pdf).

The `realtime` profile requires timing contracts and connector bounds. In this example each sampled route has capacity 1, `dropOldest`, `maxLatency 1 ms` and `maxAge 20 ms`. The logical simulation checks the declared timeouts and transfers. RTE generation, ECU extract, OS task/event assignment, runnable scheduling, E2E protection and physical WCET evidence remain target integration work. A SWAML sampled receive activates a handler with a copied value; an AUTOSAR integration must choose a compatible read/activation strategy explicitly.

## AUTOSAR Adaptive: an ARA application

The Adaptive Platform provides the AUTOSAR Runtime for Adaptive Applications (ARA), with platform services and APIs. Its communication management uses service providers and consumers, including discovery during runtime. [AUTOSAR Adaptive overview](https://www.autosar.org/standards/adaptive-platform/).

The diagnostic application requires the `VehicleHealth` service. It invokes `runCheck`, obtains a correlated bool response, and queries `getSummary` for a `HealthReport`. The provider publishes `changed(report)` on the same service contract and independently publishes `DiagnosticAudit.checked` to an audit subscriber. Each application/service has its own external deployment identity, resolved by the target binding.

| SWAML subject | ARA-oriented interpretation |
| --- | --- |
| `application: DiagnosticApplication` | Consumer application boundary |
| `application.health` with role `requires` | Consumer-side service contract, suitable for a proxy binding |
| `health.api` with role `provides` | Provider-side service contract, suitable for a skeleton binding |
| `getSummary`, `runCheck` | Service methods |
| `changed` | Provider-to-consumer notification |
| `healthLink` | One selected service-instance relationship |

These are application-level correspondences to the proxy/skeleton, method and event concepts in [AUTOSAR Communication Management, R25-11](https://www.autosar.org/fileadmin/standards/R25-11/AP/AUTOSAR_AP_SWS_CommunicationManagement.pdf). A field can be represented explicitly by getter, optional setter and changed-event members; [the setting-service example](../examples/08-service-field.swaml) demonstrates that pattern.

The example records the topology after service selection. Model known provider variants as separate roots or explicit adapters. Dynamic discovery, service-offer/subscription lifecycle, execution and service manifests, SOME/IP or other network bindings, and generated `ara::com` C++ APIs belong in the target binding. The name `Application` carries architecture intent and does not imply a generated executable or manifest.

## Service-oriented web application: checkout and inventory

The web example separates a browser client, application service, inventory service and receipt worker. The browser is a modeled component so that its requests obey the same typed-boundary rules as server-to-server communication.

`Checkout.submit` first requests `Inventory.reserve`. The stock service validates quantity and updates its own private `available` value. Only a successful reservation lets checkout publish acceptance and a receipt. The response is correlated to its request; notifications are separate events on the declared routes. The example rejects an order for 99 items after accepting an order for 2 items from initial stock 10.

| Contract | Choice and reason |
| --- | --- |
| `Checkout` — service | Combines a request/result with provider notifications |
| `Inventory` — clientServer | Reservation uses a request/result without subscription traffic |
| `Receipts` — publishSubscribe | Receipt processing has independent activation and owned data |

HTTP routes, status codes, cookies, authorization, serialization and browser delivery mechanisms are deployment decisions. For example, a target may bind the request to HTTP and the service event to server-sent events while retaining the same modeled contract. Choose an adapter when that target uses different nominal contracts. The sample keeps its stores in memory; persistence and atomic order/reservation guarantees require an explicit storage/transaction design.

## Cloud service: ingestion and event distribution

The telemetry example accepts a typed `Sample` from one ordered device stream. Ingestion checks the device identity, sequence and temperature range before publishing accepted data. An explicit broker receives that contract and forwards a `Measurements` contract to two independent subscribers. Analytics owns its aggregate values; archive owns its record count and latest device identity. There is one edge process and four container allocations.

The three event connectors select the same `EventQueue` policy with `atLeastOnce`, FIFO ordering and capacity 32. Each connector still has its own queue. The broker and consumers retain a private sequence high watermark, so repeated delivery of an already processed sequence creates no repeated local effect in this single-stream example. The simulator tests duplicate delivery independently on all three event routes.

The source sends sequences 1 and 2, retries sequence 2, then submits an invalid temperature for sequence 3. Expected results are two accepted samples, two broker forwards, two analytics updates and two archive records. The retry succeeds without another publication; the invalid sample returns false.

An ingestion result of true confirms admission at ingestion; it does not acknowledge downstream processing. If a broker publication fails on one route, other routes may already have accepted the sample. Their effects remain committed, and the failed broker handler is not automatically retried. The adverse test injects a transport failure on the first publication to analytics: ingestion still accepts both samples and archive records both, while analytics processes only the second and the trace reports the broker failure. Recovery requires an explicit acknowledgment/replay protocol.

This policy is intentionally scoped to one monotonically ordered device stream. A multi-device system needs per-device state; an out-of-order stream needs a different deduplication strategy. The sample's high watermarks and effects are in memory. Recovery, durable broker acknowledgements, transactional publication, replay and exactly-once business effects require a separate persistence/failure design. Container declarations identify locations; an infrastructure binding maps explicitly modeled replica occurrences to resources and supplies service addresses, topics, storage and orchestration configuration.

## Validate and run the models

After `npm ci` and `npm run build`, validate all four examples:

```sh
node out/src/cli/main.js examples/11-autosar-classic.swaml examples/12-autosar-adaptive.swaml examples/13-web-application.swaml examples/14-cloud-service.swaml
```

Run each logical deployment with its checked-in options:

```sh
npm run simulate -- ClassicClimate::Vehicle examples/simulation/11-autosar-classic.json examples/11-autosar-classic.swaml
npm run simulate -- AdaptiveDiagnostics::Vehicle examples/simulation/12-autosar-adaptive.json examples/12-autosar-adaptive.swaml
npm run simulate -- WebShop::Production examples/simulation/13-web-application.json examples/13-web-application.swaml
npm run simulate -- CloudTelemetry::Production examples/simulation/14-cloud-service.json examples/14-cloud-service.swaml
```

| Root | Evidence checked by the run catalog |
| --- | --- |
| `ClassicClimate::Vehicle` | Received temperature 28; commanded/applied duty 0.6; calibration 22 |
| `AdaptiveDiagnostics::Vehicle` | One completed check, one notification, one audit entry; observed healthy/code 200 |
| `WebShop::Production` | One accepted order and receipt; remaining stock 8; oversized order rejected |
| `CloudTelemetry::Production` | Two effects per stage; retry accepted; invalid sample rejected; latest temperature 28.5 |

`node scripts/check-simulations.mjs` verifies those final stores and repeatability. [Architecture-pattern regressions](../test/architecture-patterns.test.ts) additionally inspect timeout, transport failure, partial fanout and duplicate-delivery traces. The `case` declarations describe intended exchange dependencies; simulation results supply bounded evidence for function behavior, and are not automatic proofs that every case or target execution is satisfied.
