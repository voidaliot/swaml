"""Regression checks for frozen 2.0 sources, current manuscript drift and tampering."""
import copy
import json
from pathlib import Path
import tempfile
import unittest
from publication_archive import extract_sources, sha256
from publication_2_0_sources import verify_2_0_sources


class EditionSourcesTests(unittest.TestCase):
    def fixture(self, root):
        sources = {'docs/SWAML-2.0.0-Reference.md': b'published SWAML reference\n',
                   'docs/LANGUAGE_SPECIFICATION.md': b'published language\n',
                   'spec/keywords.json': b'{"languageVersion":"2.0"}',
                   'spec/notation.json': b'{"languageVersion":"2.0"}'}
        manifest = {'release': '2.0.0', 'specificationRevision': '2.0.0', 'languageVersion': '2.0',
                    'sources': [{'path': name, 'attachmentName': name.replace('/', '__'), 'sha256': sha256(raw)} for name, raw in sources.items()],
                    'sourceBundleSha256': sha256(b''.join(name.encode() + b'\0' + raw for name, raw in sources.items()))}
        attachments = {name.replace('/', '__'): [raw] for name, raw in sources.items()}
        extract_sources(sources, root)
        extract_sources({'docs/SWAML-2.0.0-Reference.md': sources['docs/SWAML-2.0.0-Reference.md']}, root/'history/2.0.0')
        return manifest, attachments

    def test_current_drift_requires_archive_mode(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); manifest, attachments = self.fixture(root)
            verify_2_0_sources(manifest, attachments, root)
            (root/'docs/LANGUAGE_SPECIFICATION.md').write_bytes(b'current swa.ml language\n')
            with self.assertRaisesRegex(ValueError, 'Workspace source differs'):
                verify_2_0_sources(manifest, attachments, root)
            verify_2_0_sources(manifest, attachments, root, archive=True)
            (root/'history/2.0.0/docs/SWAML-2.0.0-Reference.md').write_bytes(b'changed archive')
            with self.assertRaisesRegex(ValueError, 'Frozen reference differs'):
                verify_2_0_sources(manifest, attachments, root, archive=True)

    def test_tampered_extra_or_reordered_sources_are_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); manifest, attachments = self.fixture(root)
            for change in [lambda m, a: a.update({'unexpected': [b'extra']}),
                           lambda m, a: a.update({'docs__LANGUAGE_SPECIFICATION.md': [b'tampered']}),
                           lambda m, a: m.update(sourceBundleSha256='0'*64),
                           lambda m, a: m['sources'].reverse()]:
                m, a = copy.deepcopy(manifest), copy.deepcopy(attachments); change(m, a)
                with self.assertRaises(ValueError): verify_2_0_sources(m, a, root, archive=True)


if __name__ == '__main__': unittest.main()
