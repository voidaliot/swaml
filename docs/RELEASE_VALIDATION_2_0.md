# SWAML 2.0.0 release validation

Validation performed on 22 October 2026 for the incremental fixes recorded in
[the review resolution](REVIEW_2_0.md). These checks establish the stated reference
implementation behavior; they are not universal verification or production timing
evidence.

- `npm run check`: 202 tests pass, including all fourteen review regressions,
  timer traces/final stores, examples, simulation fixtures, documentation,
  notation inventories, source projections and generated references.
- `npm run build --prefix showcase`: production build passes. Browser checks cover
  General (Box in box and Tree), Interconnect, Case, Sequence, Grid, Flow, and
  Timing (Declared and Observed), source selection/toggling, clipboard content,
  keyboard activation, and persisted themes. At a 636-pixel viewport the document
  has no horizontal overflow; the wide model diagram scrolls within its panel.
  The browser console contains no errors. All six local download resources return
  HTTP 200. No broader browser/device matrix is claimed.
- `python scripts/check-spec-pdf-2.0.py`: 116 pages, 221 exact canonical source
  attachments, 242 bookmarks, 873 links, PDF/source checksums and page bounds pass.
  All 116 pages were rendered with Poppler and visually inspected in contact
  sheets. Dense grammar, mapping, model and review tables and the mixed-port
  figure were additionally inspected at full resolution. Catalog headings stay
  with their figures; no clipping or overlapping content was found.
- `python scripts/test-publication-archive.py`: seven tests pass.
  `python scripts/check-spec-pdf.py`: the historical 326-page publication, 485
  embedded sources, 589 bookmarks and 2,975 links pass without changing its files.

The release PR additionally runs the Linux Node 22/24, Windows notation, Linux
publication and production showcase workflow jobs. The earlier Linux PNG check
failed byte comparison; the current gate compares exact decoded pixels
and dimensions while retaining byte-exact SVG and scene checks. Workflow results
are recorded on the PR rather than assumed here.

Only the SWAML language repository and its production showcase are included.
Uncommitted design mockups and adjacent editor changes are excluded.
