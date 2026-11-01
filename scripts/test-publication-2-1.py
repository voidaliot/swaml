"""Regression checks for the X.Y-named 2.1 edition: strict sources, tampering and versions."""
import copy
import json
from pathlib import Path
import tempfile
import unittest
from publication_archive import extract_sources, sha256
from publication_2_1_sources import verify_edition_sources


class EditionSourcesTests(unittest.TestCase):
    def fixture(self, root):
        sources = {'docs/SWAML-2.1-Reference.md': b'swa.ml 2.1 reference\n',
                   'docs/LANGUAGE_SPECIFICATION.md': b'swa.ml 2.1 language\n',
                   'spec/standard.json': b'{"version":"2.1"}',
                   'spec/keywords.json': b'{"languageVersion":"2.1","edition":"2.1"}',
                   'spec/notation.json': b'{"languageVersion":"2.1","edition":"2.1"}',
                   'package.json': b'{"version":"3.0.0"}',
                   'resources/fonts/font.ttf': b'\r\nbinary\r\n'}
        manifest = {'release': '2.1', 'specificationRevision': '2.1', 'languageVersion': '2.1', 'implementationRevision': '3.0.0',
                    'sources': [{'path': name, 'attachmentName': name.replace('/', '__'), 'sha256': sha256(raw)} for name, raw in sources.items()],
                    'sourceBundleSha256': sha256(b''.join(name.encode() + b'\0' + raw for name, raw in sources.items()))}
        attachments = {name.replace('/', '__'): [raw] for name, raw in sources.items()}
        extract_sources(sources, root)
        return manifest, attachments

    def test_strict_mode_requires_current_workspace_sources(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); manifest, attachments = self.fixture(root)
            verify_edition_sources(manifest, attachments, root, '2.1')
            # Text sources are compared as canonical LF bytes; binary assets byte-exact.
            (root/'docs/LANGUAGE_SPECIFICATION.md').write_bytes(b'swa.ml 2.1 language\r\n')
            verify_edition_sources(manifest, attachments, root, '2.1')
            (root/'docs/LANGUAGE_SPECIFICATION.md').write_bytes(b'later maintained language\n')
            with self.assertRaisesRegex(ValueError, 'Workspace source differs'):
                verify_edition_sources(manifest, attachments, root, '2.1')
            verify_edition_sources(manifest, attachments, None, '2.1')
            (root/'resources/fonts/font.ttf').write_bytes(b'\nbinary\n')
            with self.assertRaisesRegex(ValueError, 'Workspace source differs'):
                verify_edition_sources(manifest, attachments, root, '2.1')

    def test_tampered_extra_or_reordered_sources_are_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); manifest, attachments = self.fixture(root)
            for change in [lambda m, a: a.update({'unexpected': [b'extra']}),
                           lambda m, a: a.update({'docs__LANGUAGE_SPECIFICATION.md': [b'tampered']}),
                           lambda m, a: m.update(sourceBundleSha256='0'*64),
                           lambda m, a: m['sources'].reverse(),
                           lambda m, a: m['sources'].pop()]:
                m, a = copy.deepcopy(manifest), copy.deepcopy(attachments); change(m, a)
                with self.assertRaises(ValueError): verify_edition_sources(m, a, None, '2.1')

    def test_edition_and_implementation_versions_stay_separate(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); manifest, attachments = self.fixture(root)
            for change in [lambda m: m.update(release='2.1.0', specificationRevision='2.1.0'),
                           lambda m: m.update(languageVersion='2.0'),
                           lambda m: m.update(implementationRevision='2.1'),
                           lambda m: m.update(implementationRevision='3.0.1'),
                           lambda m: m.pop('implementationRevision')]:
                m = copy.deepcopy(manifest); change(m)
                with self.assertRaises(ValueError): verify_edition_sources(m, attachments, None, '2.1')
            with self.assertRaisesRegex(ValueError, 'MAJOR.MINOR'):
                verify_edition_sources(manifest, attachments, None, '2.1.0')

    def test_embedded_inventories_must_match_the_edition(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); manifest, attachments = self.fixture(root)
            for path, raw in [('spec/standard.json', b'{"version":"2.0"}'),
                              ('spec/keywords.json', b'{"languageVersion":"2.1","edition":"2.0"}')]:
                m, a = copy.deepcopy(manifest), copy.deepcopy(attachments)
                a[path.replace('/', '__')] = [raw]
                entry = next(e for e in m['sources'] if e['path'] == path); entry['sha256'] = sha256(raw)
                m['sourceBundleSha256'] = sha256(b''.join(e['path'].encode() + b'\0' + a[e['attachmentName']][0] for e in m['sources']))
                with self.assertRaises(ValueError): verify_edition_sources(m, a, None, '2.1')


class PublishedEditionTests(unittest.TestCase):
    def test_published_manifest_records_both_versions(self):
        root = Path(__file__).resolve().parents[1]
        manifest = json.loads((root/'output/pdf/SWAML-2.1-Specification.manifest.json').read_text(encoding='utf-8'))
        self.assertEqual((manifest['release'], manifest['specificationRevision'], manifest['languageVersion']), ('2.1', '2.1', '2.1'))
        self.assertEqual(manifest['simulationProfile'], 'swaml-reference/2.1')
        # The package may later receive patch versions; the publication keeps the one it was built from.
        self.assertEqual(manifest['implementationRevision'], '3.0.0')
        self.assertEqual(manifest['pdf'], 'SWAML-2.1-Specification.pdf')


if __name__ == '__main__': unittest.main()
