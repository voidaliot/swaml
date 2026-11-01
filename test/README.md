# Test editions

The active 2.1 suite is test/v2/. TypeScript compilation and npm test explicitly select it. Files directly under test/ are preserved 1.x regression sources referenced by immutable historical books; they are not compatibility tests for the current parser. Reproduce those suites with their pinned historical revision, never by enabling a legacy parser fallback in current development.
