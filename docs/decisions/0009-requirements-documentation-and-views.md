# ADR 0009 — Requirements, documentation and selected views

Status: accepted for SWAML 1.2.0. Date: 2026-10-16.

The language owner requested simple requirements without a subject, one formal documentation block per owner, ordinary lexical comments, two case kinds and composable view selections. This decision replaces the earlier string-only requirement, generic case and case-to-requirement satisfies clause.

`requirement` owns immutable typed `attribute` values and optional `doc /* ... */` text. It has no subject, behavior or private runtime store. `satisfy Requirement by Design.path;` records a design claim. `verificationCase` owns `verify Requirement;` links; `useCase` describes intended use. Neither relation establishes evidence by itself. Both case kinds share the existing routed, partially ordered exchange semantics.

Formal documentation is raw multiline text, attached to its declaration, with at most one block per owner. Ordinary line and block comments remain separate lexical annotations. They have no declared identity or executable effect. The source projection retains every comment and its owner; graphical notes and formal documentation compartments remain distinct.

The lexer consumes `doc` and its block as one DOC_COMMENT token. This makes multiline documentation unambiguous with hidden ordinary comments and preserves text exactly. The keyword inventory explicitly includes this lexical keyword. Unterminated blocks are syntax errors. The grammar identifies every permitted owner and position; body-bearing declarations put documentation first, leaf declarations put it before the terminating semicolon, and transitions use a prefix.

All reserved words use lower camel case. Primitive type words are `bool`, `byte`, `uint`, `int`, `real`, `string`, `void`; view kinds are `gv`, `iv`, `cv`, `sv`, `grv`, `fv`. Identifiers remain case-sensitive and may use capitals. Browser is a navigation surface, not a source keyword.

View blocks contain one or more `include` selections. Optional `recursive` expansion preserves occurrence paths; optional `where` predicates combine typed `name`, `kind` and `path` comparisons with `and`, `or`, `not` and parentheses. Selections form a stable union. Filters select model elements; they cannot execute model behavior or introduce communication routes.

The conceptual comparison is with the [official SysML 2.0 language](https://www.omg.org/spec/SysML/2.0). SWAML deliberately defines its own smaller syntax and semantics. This release does not add SysML interchange or kernel validation.
