# SWAML in five minutes

Model a contract, give each participant a typed port, then connect their occurrences in a root component. Functions own behavior and each component occurrence owns its private values. You can use the same workflow for embedded software, service applications and cloud systems.

## 1. Define the exchanged contract

Start with the information crossing a boundary. A `senderReceiver` interface carries data, `clientServer` carries requests and results, `publishSubscribe` carries events, and `service` combines functions with events. Every port names one versioned interface and a compatible role.

## 2. Give behavior an owner

A `component def` owns ports, private variables and functions. The sender's function emits through its own port; the receiver's function names that port member as its trigger. Declare `calc` blocks first inside a function for pure input-to-output expressions.

## 3. Compose and connect

A `component def` can combine local behavior with reusable child composition. A top-level `component` is a concrete root. A connector joins complementary ports and selects complete QoS values. Define a shared policy with `qos def` when several routes use the same values. Each route retains its own queues.

Save this complete model as `hello.swaml`:

```swaml
package QuickStart {
    interface senderReceiver Greeting version "1.0.0" {
        data text: string queued;
    }
    component def Speaker {
        port output: Greeting sender;
        function greet() on start {
            send output.text("Hello, SWAML");
        }
    }
    component def Listener {
        port input: Greeting receiver;
        var last: string = "";
        function hear(message: string) on receive input.text {
            last = message;
        }
    }
    qos def LocalQueue {
        delivery atMostOnce; ordering fifo; capacity 4; overflow reject;
    }
    component Demo {
        component speaker: Speaker;
        component listener: Listener;
        connect greeting: speaker.output -> listener.input qos LocalQueue;
    }
    view structure gv of Demo;
    view wiring iv of Demo;
    view behavior fv of Speaker.greet;
}
```

`Speaker` and `Listener` are definitions; `Demo.speaker` and `Demo.listener` are occurrences. `last` belongs to the listener occurrence. The connector permits the exchange; the view declarations select existing model subjects.

## 4. Validate the model

From a clone of this repository, with Node.js 22+ and npm 10.2.3+ installed:

```sh
npm ci
npm run build
node out/src/cli/main.js --language-version 1.3 hello.swaml
```

The validator checks syntax, contracts, ownership, routing, closure and applicable timing rules. Supply related files together when packages import declarations from other files. A successful validation establishes static acceptance; use the [reference simulator](SIMULATION.md) for bounded execution evidence.

## 5. Review through views

Functions can reuse local behavior with `call`, and calculations stay inside their owning function:

```swaml
package LocalBehavior {
    component Demo {
        var latest: int = 0;
        function doubled(input: int): int {
            calc scale { in value: int; return result: int = value * 2; }
            return scale(input);
        }
        function boot() on start {
            call doubled(21) as answer;
            latest = answer;
        }
    }
}
```

Use `var` for both private component data and mutable block locals. Local void calls use `call helper();`. Routed calls use `call api.member(...) as result within 1 s otherwise { return; };` through an owned port and an explicit connector. Only calculations use expression-call syntax.

The [graphical modeling overview](MODELING_OVERVIEW.md) connects a use case to its interaction flow, function logic, function owners and final software structure. Its ontology diagram shows the relationships between the concepts used below.

Use gv for composition and deployment, iv for ports and connections, cv for cases and requirement claims, sv for exchange dependencies, grv for properties, and fv for function flow or states. Browser navigation follows declarations and occurrence paths.

Run the [interactive showcase](../showcase/README.md) with `npm --prefix showcase ci` and `npm --prefix showcase run dev`. It contains a seven-view walkthrough, an interface reference and four domain architectures. Read the full model source alongside its diagram.

| Your architecture | Start with |
| --- | --- |
| AUTOSAR Classic software component | [Climate controller](../examples/11-autosar-classic.swaml): sampled inputs, client/server calibration, periodic acquisition and MCU allocation |
| AUTOSAR Adaptive application | [Adaptive diagnostics](../examples/12-autosar-adaptive.swaml): service functions/events and process allocation |
| Service-based web application | [Web shop](../examples/13-web-application.swaml): browser, backend, inventory and explicit event consumers |
| Cloud service | [Cloud telemetry](../examples/14-cloud-service.swaml): ingestion, explicit broker, analytics and archive consumers |

These examples model logical software architecture. Read their [architecture patterns and platform mappings](ARCHITECTURE_PATTERNS.md). Continue with the [user guide](USER_GUIDE.md), [UML transition guide](UML_GUIDE.md), or [complete specification](LANGUAGE_SPECIFICATION.md).


## Requirements and formal documentation

Requirements own typed attributes and one optional `doc /* ... */` specification. Design elements link through `satisfy`; verification cases link through `verify`. Use cases describe intent. Ordinary comments remain independent notes. View kinds use lower camel case, and view blocks combine multiple selections and Boolean filters. See the [guide](REQUIREMENTS_AND_DOCUMENTATION.md) and [complete model](../examples/16-requirements-and-views.swaml).
