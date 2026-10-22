"""Check frozen publication inputs without accepting manuscript drift for a new edition."""
from pathlib import Path
from publication_archive import sha256, verify_sources


def canonical(path: Path) -> bytes:
    raw = path.read_bytes()
    return raw if path.suffix in ('.png', '.ttf') else raw.replace(b'\r\n', b'\n')


def verify_2_0_sources(manifest, attachments, workspace: Path, archive=False):
    if manifest.get('release') != '2.0.0':
        raise ValueError('This checker requires edition 2.0.0')
    verified = verify_sources(manifest, attachments)
    bundle = b''.join(entry['path'].encode() + b'\0' + verified[entry['path']] for entry in manifest['sources'])
    if sha256(bundle) != manifest.get('sourceBundleSha256'):
        raise ValueError('Publication source bundle hash differs')
    if archive:
        book = 'docs/SWAML-2.0.0-Reference.md'
        if canonical(workspace / 'history/2.0.0' / book) != verified[book]:
            raise ValueError('Frozen reference differs from its publication')
    else:
        for name, raw in verified.items():
            if canonical(workspace / name) != raw:
                raise ValueError('Workspace source differs from its publication: ' + name)
    return verified
