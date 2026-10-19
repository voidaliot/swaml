"""Pure integrity and path checks shared by publication checking and rebuilding."""
from __future__ import annotations
import hashlib
import json
import re
from pathlib import Path, PurePosixPath
from urllib.parse import unquote


def source_path(value: str) -> str:
    if not isinstance(value, str) or not value or '\\' in value or ':' in value or unquote(value) != value:
        raise ValueError(f'Unsafe publication source path: {value!r}')
    path = PurePosixPath(value)
    reserved = {'con', 'prn', 'aux', 'nul', *[f'com{i}' for i in range(1, 10)], *[f'lpt{i}' for i in range(1, 10)]}
    if value == '.' or path.is_absolute() or path.as_posix() != value or any(p in ('', '.', '..') or p.endswith(('.', ' ')) or p.split('.')[0].casefold() in reserved for p in path.parts) or any(ord(c) < 32 or ord(c) == 127 for c in value):
        raise ValueError(f'Unsafe publication source path: {value!r}')
    return value


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def verify_sources(manifest: dict, attachments, workspace: Path | None = None, current_version: str | None = None) -> dict[str, bytes]:
    revision = manifest.get('specificationRevision')
    if not isinstance(revision, str) or not re.fullmatch(r'\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?', revision):
        raise ValueError('Publication requires an explicit specification revision')
    if manifest.get('release') != revision:
        raise ValueError('Publication release must equal its validated specification revision')
    sources = manifest.get('sources')
    if not isinstance(sources, list) or not sources:
        raise ValueError('Publication source manifest is empty')
    result, names, folded = {}, set(), set()
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
        result[path] = payload[0]
        # Maintained sources may evolve after an edition. Its published complete
        # reference remains immutable; a current edition requires all bytes.
        historical_book = path == f'docs/SWAML-{revision}-Reference.md'
        if workspace is not None and (current_version == revision or historical_book):
            local = workspace.joinpath(*PurePosixPath(path).parts)
            if not local.is_file() or local.read_bytes() != payload[0]:
                raise ValueError(f'Workspace source differs from its publication: {path}')
    if set(attachments) != names:
        raise ValueError('PDF attachments and source manifest differ')
    for required in ('spec/keywords.json', 'spec/notation.json', f'docs/SWAML-{revision}-Reference.md'):
        if required not in result:
            raise ValueError(f'Missing publication inventory/reference: {required}')
    for path in ('spec/keywords.json', 'spec/notation.json'):
        if json.loads(result[path]).get('languageVersion') != manifest['languageVersion']:
            raise ValueError(f'Embedded inventory language mismatch: {path}')
    return result


def extract_sources(sources: dict[str, bytes], target: Path) -> None:
    root = target.resolve()
    root.mkdir(parents=True, exist_ok=True)
    for name, content in sources.items():
        path = root.joinpath(*PurePosixPath(source_path(name)).parts)
        if not path.resolve().is_relative_to(root):
            raise ValueError(f'Publication source escapes extraction root: {name}')
        path.parent.mkdir(parents=True, exist_ok=True)
        if path.is_symlink():
            raise ValueError(f'Publication source is a symlink: {name}')
        path.write_bytes(content)


def verify_pinned_blobs(expected: dict[str, str], blobs: dict[str, bytes]) -> None:
    for path, digest in expected.items():
        source_path(path)
        if path not in blobs or sha256(blobs[path]) != digest:
            raise ValueError(f'Trusted archive commit differs from recorded input: {path}')
