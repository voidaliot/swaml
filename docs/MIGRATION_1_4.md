# Migrating to SWAML 1.4 development

SWAML 1.4.0 is an unpublished development revision. It adds same-owner executable completion activation. Published 1.3.1 Markdown/PDF editions and profile `swaml-reference/1.3` remain historical artifacts.

Pin the 1.4 parser/host and exact package revision before loading source. For bounded execution select `swaml-reference/1.4`. Headerless files do not infer an edition from their contents; a 1.3 host must reject the new trigger instead of guessing its meaning.

Existing valid 1.3.1 source needs no syntax conversion for this additive trigger. The reserved word `completion` already existed for state transitions. Source that needs the new dependency writes `on completion A` on a parameterless void flow executable:

```swaml
package Completion {
    component Demo {
        var stage: int = 0;
        function first() on start { stage = 1; }
        operation second() on completion first {
            assert stage == 1;
            stage = 2;
        }
        function third() on completion second { assert stage == 2; }
    }
    view flow fv {
        include Demo recursive where kind == "operation" or kind == "function";
    }
}
```

`A` must resolve to a triggered effective operation/function in the same owner. The dependent cannot have arguments, a non-void result or a state body. It cannot be invoked as an untriggered local helper. Completion dependencies must form an acyclic graph, including through inherited redefinitions. Missing and cross-component names are linking errors; invalid contracts use SW066 and cycles use SW067.

The dependent is a fresh activation after successful whole completion, with its own dispatch, snapshot/lock and timing. No result is forwarded and failure releases nothing. A state reaction reaching quiescence is not whole function completion. Distinct dependents have no implicit join or fanout order. Cross-component coordination still requires a typed port/member and explicit route.

See [the behavior rules](spec/03-behavior.md#37-local-completion-activation), [operational contract](spec/06-execution-contract.md#completion-triggered-releases) and [ADR 0015](decisions/0015-local-executable-completion.md). The current generated development reference is [SWAML 1.4.0](SWAML-1.4.0-Reference.md); it is not a published PDF edition.
