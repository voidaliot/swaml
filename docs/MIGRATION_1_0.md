# Migrating to SWAML 1.0

SWAML 1.0.0 stabilizes the closed architecture language introduced in 0.1. The source header is now `swaml "1.0";`; the reference parser rejects old and unknown headers. Change the header in every loaded file together. Interface versions remain independently chosen contract versions: do not change them merely to match the language version.

The 0.1 constructs, ownership rules, port roles, direct operations/states and six view IDs remain. Version 1.0 adds an explicit formal rule chapter, a reproducible reference execution profile, a complete concern/keyword reference and rendered notation examples. These make existing semantic obligations executable and reviewable; they do not add a host-language escape, remote field access, separate performer, dynamic subscription or implicit event channel.

Revalidate the entire workspace using `npm run check` or the CLI. Exercise the selected system with the reference simulator; fix assertion, arithmetic, queue, loop, timeout and machine failures uncovered by actual execution. A formerly accepted model was never a guarantee that all its runs would succeed. Do not suppress a runtime failure simply because the source parses.

The v0.1.0 Git tag and its published PDF remain historical, immutable artifacts. That release packaged draft/core revision 0.1.1 with header 0.1. From this release forward, package, specification and release use the same semantic version (1.0.0); the source header identifies the compatible major/minor language (1.0). Patch errata cannot silently change valid-model meaning. A later incompatible semantic or syntax change requires a new header version and a migration document.

VS Code extension implementation is maintained separately. This repository owns the language definition, parser/validator foundation, reference semantics, examples and publication artifacts. An extension must declare which language versions and conformance obligations it supports.
