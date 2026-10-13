# Graphical notation examples

These rendered vector figures illustrate the normative [view contract](GRAPHICAL_NOTATION.md). They are notation examples, not screenshots of a shipped extension. The same vector scene sources are rendered into the PDF so labels and lines remain sharp. Every figure has accessible text and a specific model source; the source model remains authoritative.

The first seven figures use the [service setting model](../examples/08-service-field.swaml). A provider owns the setting, two client components use its RPC/events, and private storage remains behind unit ports. The state figure uses the [lifecycle model](../examples/04-stateful-operation.swaml). The [figure manifest](../spec/graphical-examples.json) links each illustration to its model and semantic subject.

## Model Browser: actual ownership

![Model Browser showing Settings declarations, Cabin occurrences and selected settings.store.update operation](figures/browser.svg)

The tree distinguishes `SettingStore` as a unit definition from `Cabin.settings.store` as an occurrence. Selection of `update` retains its instance context. A declaration command navigates to the shared definition; an FV command opens the operation's body. There is no performer or separate action allocation node. Collapsed rows are presentation choices, not omitted semantics.

## GV: general structure and allocation

![General View of Cabin with settings, front and rear component occurrences and inherited deployments](figures/gv.svg)

`settings`, `front` and `rear` are component occurrences. Each owns its unit occurrence. Dashed `deploy` edges assign settings to controller and the panels to displays; descendant units inherit those locations. These are allocation edges, not communication lines. The two Panel occurrences have distinct private stores despite sharing one definition.

## IV: explicit interconnection and delegation

![Interconnect View showing required panel ports connected to the provided TemperatureSetting service and delegated unit ports](figures/iv.svg)

Both connectors are oriented from `requires` to `provides`. Each visible boundary port is a square and delegates to a child port with the same contract/role. The shared provided port can serve both clients. The arrows indicate connector orientation; member inspection exposes reverse provider-event and response directions. Every route has its own capacity-8 FIFO queue policy per member/direction. There is no line directly coupling panel data to store data.

## CV: cases and claimed requirement coverage

![Case View of Change in Cabin linked to VisibleSetting with satisfies claimed](figures/cv.svg)

The dashed `satisfies (claimed)` link records intended coverage. It does not assert that the case is executable or verified. A future tool may attach actual analysis/test evidence; it must retain evidence identity and assumptions before showing verified status.

## SV: interface exchanges and partial order

![Sequence View of Change showing a setPoint request, two changed notifications and one correlated reply with explicit causal dependencies](figures/sv.svg)

Lifelines are component occurrences; every message names its exposed port/member and connector. `adjust` precedes both notifications; `frontNotice` precedes `accepted`. `rearNotice` is unordered relative to `frontNotice` and `accepted`, even though the drawing places its row between them. The pale branch and explicit causal summary prevent vertical placement from inventing a total order. The reply retains the `adjust` correlation. This diagram depicts the case's partial order, not a simulator's chosen trace.

## GRV: inspect properties without changing semantics

![Grid View listing service and panel operation signatures, triggers, results and declared timing](figures/grv.svg)

The grid shows effective occurrence paths and source-declared contracts. A dash means the service-profile operation has no timing declaration; it never means zero physical execution time. `read` is reentrant; other roots use the serial default. The rear row summarizes the same three declarations in a different occurrence context. Sorting a grid does not reorder source statements, queues or case dependencies.

## FV: operation statement flow

![Flow View of SettingStore.update with bounds check, false return, private assignment, interface publication and true return](figures/fv-flow.svg)

The frame belongs directly to `SettingStore.update`. The decision tests the actual source condition. A valid value updates private state, emits `api.changed(currentValue)` through the provider port, then returns true to the correlated request. An invalid value returns false without mutation/publication. A connector is not drawn from this local flow node to another operation: the IV and port path describe the architectural exchange.

## FV: operation-owned states

![Flow View of Device.lifecycle with Idle, Running, Stopped final, interface event transitions and a 30-second timer](figures/fv-state.svg)

`Idle`, `Running` and `Stopped` belong directly to `Device.lifecycle`. Initial entry publishes idle status. The interface event `commands.begin` enters Running; entry increments cycles and publishes running. Either `commands.stop` or the local 30-second timer enters the final state. The timer edge first publishes timeout in its effect. Final entry publishes stopped and terminates the machine. Leaving Running cancels the old timer generation. Both state and statement projections are FV; no GEV, AFV, STV or performer layer is introduced.

## Reproduction and semantic checks

Run `python3 scripts/build-graphical-examples.py` to regenerate the eight SVG/scene pairs, and use `--check` to detect stale figures. `node scripts/check-graphical-examples.mjs` resolves every manifest subject against its validated source model and verifies that all view families have an illustration. The semantic test establishes subject/reference validity; it is not a graphical editor conformance certification. Publication QA additionally renders and visually inspects the figures in the PDF.
