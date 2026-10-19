#!/usr/bin/env python3
"""Rebuild an immutable edition from its attachments and separately pinned tooling."""
from __future__ import annotations
import argparse
import ast
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
from importlib.metadata import version
from pypdf import PdfReader
from publication_archive import extract_sources, sha256, source_path, verify_pinned_blobs, verify_sources

ROOT = Path(__file__).resolve().parents[1]


def git_blobs(commit: str, paths: list[str]) -> dict[str, bytes]:
    if not re.fullmatch('[0-9a-f]{40}', commit): raise ValueError('Archive tooling must pin a full Git commit')
    queries = ''.join(f'{commit}:{source_path(path)}\n' for path in paths).encode()
    reply = subprocess.run(['git', 'cat-file', '--batch'], cwd=ROOT, input=queries, stdout=subprocess.PIPE, check=True).stdout
    result, cursor = {}, 0
    for path in paths:
        end = reply.index(b'\n', cursor); header = reply[cursor:end].split(); cursor = end + 1
        if len(header) != 3 or header[1] != b'blob':
            raise ValueError(f'Archive commit is unavailable/incomplete: {commit}:{path}; fetch the pinned commit first')
        size = int(header[2]); result[path] = reply[cursor:cursor+size]; cursor += size
        if reply[cursor:cursor+1] != b'\n': raise ValueError('Malformed Git blob response')
        cursor += 1
    if cursor != len(reply): raise ValueError('Unexpected Git blob response')
    return result


def builder_version(source: bytes, manifest: dict) -> None:
    values = {statement.targets[0].id: ast.literal_eval(statement.value) for statement in ast.parse(source).body
              if isinstance(statement, ast.Assign) and len(statement.targets) == 1 and isinstance(statement.targets[0], ast.Name)
              and statement.targets[0].id in {'RELEASE', 'REVISION', 'LANGUAGE', 'SIMULATION_PROFILE'}}
    expected = dict(RELEASE=manifest['release'], REVISION=manifest['specificationRevision'], LANGUAGE=manifest['languageVersion'], SIMULATION_PROFILE=manifest['simulationProfile'])
    if values != expected: raise ValueError('Pinned builder does not identify this archived edition')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pdf', type=Path, default=ROOT/'output/pdf/SWAML-1.3.1-Specification.pdf')
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--font-dir', type=Path, default=os.environ.get('SWAML_PDF_FONT_DIR', '/usr/share/fonts/truetype/dejavu'))
    args = parser.parse_args()
    original, output = args.pdf.resolve(), args.output.resolve()
    if output == original or output.is_relative_to((ROOT/'output/pdf').resolve()):
        raise ValueError('Archive rebuild output must not overwrite published artifacts; use tmp/pdfs/')
    manifest = json.loads(original.with_suffix('.manifest.json').read_text(encoding='utf-8'))
    if sha256(original.read_bytes()) != manifest['pdfSha256'] or original.with_suffix('.sha256').read_text().split()[0] != manifest['pdfSha256']:
        raise ValueError('Archive PDF/checksum does not match its source manifest')
    reader = PdfReader(original)
    sources = verify_sources(manifest, reader.attachments, ROOT, json.loads((ROOT/'package.json').read_text())['version'])
    pin = json.loads((ROOT/'scripts'/f'publication-tooling-{manifest["release"]}.json').read_text())
    if pin['release'] != manifest['release']: raise ValueError('Archive tooling release mismatch')
    expected = {source['path']: source['sha256'] for source in manifest['sources']}
    for path, digest in pin['files'].items():
        if path in expected and expected[path] != digest: raise ValueError(f'Archive/tooling input collision: {path}')
        expected[path] = digest
    blobs = git_blobs(pin['commit'], list(expected))
    # This also proves the tooling revision contains every byte of the edition,
    # rather than assuming an unrelated script version can rebuild the archive.
    verify_pinned_blobs(expected, blobs)
    builder_version(blobs['scripts/build-spec-pdf.py'], manifest)
    dependency_versions = {}
    for requirement in blobs['scripts/pdf-requirements.txt'].decode().splitlines():
        if not requirement.strip() or requirement.startswith('#'): continue
        package, expected_version = requirement.strip().split('==')
        dependency_versions[package] = version(package)
        if dependency_versions[package] != expected_version:
            raise ValueError(f'Archived build dependency {package} must be {expected_version}; install the pinned original requirements')
    temporary = ROOT/'tmp/pdfs'; temporary.mkdir(parents=True, exist_ok=True)
    extraction = Path(tempfile.mkdtemp(prefix=f'archive-{manifest["release"]}-', dir=temporary))
    extract_sources(sources, extraction)
    extract_sources({path: blobs[path] for path in pin['files']}, extraction)
    font_names = ['DejaVuSans.ttf', 'DejaVuSans-Bold.ttf', 'DejaVuSans-Oblique.ttf', 'DejaVuSans-BoldOblique.ttf', 'DejaVuSansMono.ttf']
    fonts = extraction/'build-fonts'; fonts.mkdir()
    font_digests = {}
    for name in font_names:
        pinned = blobs.get('resources/fonts/'+name)
        data = pinned if pinned is not None else (args.font_dir/name).read_bytes()
        (fonts/name).write_bytes(data); font_digests[name] = sha256(data)
    builder = extraction/'scripts/build-spec-pdf.py'
    inspection = subprocess.run([sys.executable, '-c', 'import json,runpy,sys; print(json.dumps(runpy.run_path(sys.argv[1])["SOURCES"]))', str(builder)],
                                cwd=extraction, check=True, stdout=subprocess.PIPE, text=True)
    static_inputs = json.loads(inspection.stdout)
    if set(static_inputs) != set(sources): raise ValueError('Original builder static source inventory differs from verified attachments')
    subprocess.run([sys.executable, str(builder), '--output', str(output), '--font-dir', str(fonts)], cwd=extraction, check=True)
    rebuilt_manifest = json.loads(output.with_suffix('.manifest.json').read_text())
    rebuilt = PdfReader(output)
    rebuilt_sources = verify_sources(rebuilt_manifest, rebuilt.attachments)
    if rebuilt_sources != sources: raise ValueError('Rebuild changed archived source bytes')
    normalized = lambda pdf: [re.sub(r'\s+', ' ', page.extract_text() or '').strip() for page in pdf.pages]
    if normalized(rebuilt) != normalized(reader): raise ValueError('Rebuild changed published page count or per-page textual content')
    evidence = dict(release=manifest['release'], originalPdfSha256=manifest['pdfSha256'], rebuiltPdfSha256=sha256(output.read_bytes()),
                    toolingCommit=pin['commit'], tooling=pin['files'], fonts=font_digests, dependencies=dependency_versions, python=sys.version, extraction=str(extraction),
                    sourceCount=len(sources), sourceBytesPreserved=True, pageTextAndCountPreserved=True,
                    note='PDF byte identity is not required: build metadata can differ. Font binaries are external dependencies, not PDF source attachments.')
    output.with_suffix('.rebuild.json').write_text(json.dumps(evidence, indent=2)+'\n', encoding='utf-8')
    print(f'Archived edition rebuilt from {len(sources)} verified attachments and pinned original tooling: {output}')


if __name__ == '__main__': main()
