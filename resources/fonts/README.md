# Fonts for reproducible notation

The notation renderer uses these unchanged **DejaVu Sans 2.37** font files by
default so that SVG text measurements and PNG pixels do not depend on a host's
font package. They were copied from the bundled LibreOffice distribution used
to prepare this edition; the embedded font metadata identifies version 2.37.
They are third-party assets, not original SWAML work or covered by its MIT
license.

Upstream: [DejaVu Fonts](https://dejavu-fonts.github.io/),
[2.37 source tree](https://github.com/dejavu-fonts/dejavu-fonts/tree/version_2_37).
The unmodified [upstream license](https://raw.githubusercontent.com/dejavu-fonts/dejavu-fonts/version_2_37/LICENSE)
is included as [LICENSE-DejaVu.txt](LICENSE-DejaVu.txt), preserving the copyright,
trademark and permission notices. DejaVu changes are public domain; the
Bitstream Vera and Arev portions retain their accompanying licenses.

| File | SHA-256 |
| --- | --- |
| DejaVuSans.ttf | `7da195a74c55bef988d0d48f9508bd5d849425c1770dba5d7bfc6ce9ed848954` |
| DejaVuSans-Bold.ttf | `e6476c1b80502924294eed40894c5b18e06c181444ca953e5334262df9c27724` |

`scripts/build-notation.py` uses Pillow 12.3.0, these exact font bytes and
`ImageFont.Layout.BASIC` explicitly. Pillow's implicit layout engine can change
when the optional RAQM library is available, changing glyph positioning even
with identical fonts; the explicit engine prevents that host-dependent choice.
`--check` compares decoded PNG pixels, independent of PNG compression, and exact
SVG/vector-scene text. `--font-dir` (or `SWAML_FONT_DIR`) is an explicit override
for a deliberate font migration; different font metrics require regeneration
and visual review. The PDF publication may additionally require the system's
DejaVu oblique and monospace faces, as documented in its build guide.

CI passes `--diagnostics tmp/pdfs/notation-raster` to retain renderer and FreeType
versions, font hashes, per-image pixel statistics, expected/committed PNGs and
amplified difference images when a check fails. These diagnostics do not relax
the exact comparison; they make platform differences and stale assets inspectable.
