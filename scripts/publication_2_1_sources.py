"""Verify the sources embedded in an X.Y-named edition such as swa.ml 2.1.

The 1.x/2.0.0 helpers expect three-part revisions and stay unchanged for the
archived publications. A new edition always uses the strict current-source
gate: every embedded source must equal the canonical workspace bytes."""
from __future__ import annotations
import json
import re
from pathlib import Path, PurePosixPath
from publication_archive import sha256, source_path


def canonical(path: Path) -> bytes:
    raw = path.read_bytes()
    return raw if path.suffix in ('.png', '.ttf') else raw.replace(b'\r\n', b'\n')


def verify_edition_sources(manifest, attachments, workspace: Path | None, edition: str):
    if not re.fullmatch(r'(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)', edition):
        raise ValueError('An edition uses MAJOR.MINOR only')
    if manifest.get('release') != edition or manifest.get('specificationRevision') != edition or manifest.get('languageVersion') != edition:
        raise ValueError(f'This checker requires edition {edition}')
    implementation = manifest.get('implementationRevision')
    if not isinstance(implementation, str) or not re.fullmatch(r'\d+\.\d+\.\d+', implementation):
        raise ValueError('The implementation package revision must be recorded separately as SemVer')
    sources = manifest.get('sources')
    if not isinstance(sources, list) or not sources:
        raise ValueError('Publication source manifest is empty')
    verified, names, folded = {}, set(), set()
    for entry in sources:
        path = source_path(entry['path'])
        name = entry['attachmentName']
        if path.casefold() in folded or name in names or name != path.replace('/', '__'):
            raise ValueError(f'Duplicate or noncanonical publication source: {path}')
        folded.add(path.casefold()); names.add(name)
        digest = entry['sha256']
        if not isinstance(digest, str) or not re.fullmatch('[0-9a-f]{64}', digest):
            raise ValueError(f'Invalid source digest: {path}')
        payload = attachments.get(name)
        if not isinstance(payload, list) or len(payload) != 1 or not isinstance(payload[0], bytes) or sha256(payload[0]) != digest:
            raise ValueError(f'Embedded source does not match its manifest: {path}')
        verified[path] = payload[0]
    if set(attachments) != names:
        raise ValueError('PDF attachments and source manifest differ')
    bundle = b''.join(entry['path'].encode() + b'\0' + verified[entry['path']] for entry in sources)
    if sha256(bundle) != manifest.get('sourceBundleSha256'):
        raise ValueError('Publication source bundle hash differs')
    reference = f'docs/SWAML-{edition}-Reference.md'
    for required in ('spec/standard.json', 'spec/keywords.json', 'spec/notation.json', 'package.json', reference):
        if required not in verified:
            raise ValueError(f'Missing publication inventory/reference: {required}')
    if json.loads(verified['spec/standard.json']).get('version') != edition:
        raise ValueError('Embedded standard version differs from the edition')
    if json.loads(verified['package.json']).get('version') != implementation:
        raise ValueError('Embedded package version differs from the recorded implementation revision')
    for path in ('spec/keywords.json', 'spec/notation.json'):
        data = json.loads(verified[path])
        if data.get('languageVersion') != edition or data.get('edition') != edition:
            raise ValueError(f'Embedded inventory edition mismatch: {path}')
    if workspace is not None:
        for name, raw in verified.items():
            local = workspace.joinpath(*PurePosixPath(name).parts)
            if not local.is_file() or canonical(local) != raw:
                raise ValueError('Workspace source differs from its publication: ' + name)
    return verified
