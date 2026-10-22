# SWAML 2.0 review resolution

The 22 October 2026 source review of revision 46044b5 identified the following defects. Each row records implemented corrections and evidence; pending rows are not acceptance claims. The reference interpreter remains bounded evidence under its recorded assumptions.

| Finding | Resolution and regression evidence |
| --- | --- |
| F01 Package operation out writes bypass concurrency validation | Fixed: resolve package callees and preserve the caller's out-target write effect; imported/transitive negative cases and serial/local positive cases in review-validation.test.ts |
| F02 Package calls capture component helpers | Pending runtime correction |
| F03 Rename changes reference binding | Pending authoring correction |
| F04 Request out variance crashes | Pending runtime correction |
| F05 Port payloads bypass numeric domains | Pending runtime correction |
| F06 Negative computed loop limits succeed | Pending runtime correction |
| F07 Initializer failure escapes evidence | Pending runtime correction |
| F08 QoS capacity accepts duration | Fixed: capacity is a positive integer count; duration/boolean/string/fraction/zero rejection in review-validation.test.ts |
| F09 Enum token indexing is ambiguous | Pending authoring correction |
| F10 Inherited case via references are missing | Pending authoring correction |
| F11 Projection drops package containment | Pending projection correction |
| F12 Ownerless redefines is accepted | Fixed: replacement requires a containing component's inherited member; package/nested negative and valid replacement tests |
| F13 Duplicate delivery exceeds queue capacity | Pending runtime correction |
| F14 Linking diagnostics have missing/wrong code | Fixed: shared DocumentValidator assigns SW2001 to linking and SW2000 to syntax; CLI and malformed-recovery regression checks |

Validation after the first correction group: npm run check passes, including 185 tests and all configured example, simulation, documentation and inventory gates. Subsequent groups will update this record with their actual validation. No universal verification, production scheduling or kernel conformance is implied.
