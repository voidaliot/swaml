#!/usr/bin/env python3
"""Package reviewed graphical assets without changing the repository sources."""
import argparse
import hashlib
import json
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
inventory = json.loads((ROOT/'spec/notation.json').read_text())
edition = inventory['edition']
retained={artifact['path'] for artifact in inventory.get('retainedArtifacts',[])}
paths = ['LICENSE', 'spec/notation.json'] + sorted(
    path.relative_to(ROOT).as_posix()
    for directory in ['docs/notation', 'docs/figures']
    for path in (ROOT/directory).iterdir() if path.is_file() and path.relative_to(ROOT).as_posix() not in retained
)
files = {path: (ROOT/path).read_bytes() for path in paths}
files['README.txt'] = (
    f'SWAML {edition} canonical graphical assets\n\n'
    'docs/notation contains SVG, PNG and vector scene JSON for every catalog concept.\n'
    'docs/figures contains the worked view examples in the same formats.\n'
    'spec/notation.json records semantic context, constraints and grammar coverage.\n'
    'SVG and scene files are vectors; PNGs are matching raster exports.\n'
    'All assets are original SWAML material under the included MIT license.\n\n'
    f'Catalog: https://github.com/voidaliot/swaml/blob/v{edition}/docs/GRAPHICAL_CATALOG.md\n'
    f'Complete specification: https://github.com/voidaliot/swaml/releases/tag/v{edition}\n'
).encode()
files['SHA256SUMS'] = ''.join(
    f'{hashlib.sha256(data).hexdigest()}  {name}\n' for name, data in sorted(files.items())
).encode()
args.output.parent.mkdir(parents=True, exist_ok=True)
with ZipFile(args.output, 'w', compression=ZIP_DEFLATED, compresslevel=9) as archive:
    for name, data in sorted(files.items()):
        info = ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
        info.compress_type = ZIP_DEFLATED
        info.external_attr = 0o100644 << 16
        archive.writestr(info, data)
with ZipFile(args.output) as archive:
    assert archive.testzip() is None
    assert {name: archive.read(name) for name in archive.namelist()} == files
print(f'Packaged and verified {len(files)} files: {args.output}')
