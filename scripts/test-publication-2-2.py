"""Regression checks for the X.Y-named 2.2 edition: strict sources, tampering and versions."""
import copy
import json
from pathlib import Path
import tempfile
import unittest
from publication_archive import extract_sources, sha256
from publication_2_2_sources import prose_escapes, publication_inventory, verify_edition_sources


class EditionSourcesTests(unittest.TestCase):
    def fixture(self, root):
        contents = {'docs/SWAML-2.2-Reference.md': b'swa.ml 2.2 reference\n',
                   'docs/LANGUAGE_SPECIFICATION.md': b'swa.ml 2.2 language\n',
                   'spec/standard.json': b'{"version":"2.2"}',
                   'spec/keywords.json': b'{"languageVersion":"2.2","edition":"2.2"}',
                   'spec/notation.json': b'{"languageVersion":"2.2","edition":"2.2"}',
                   'package.json': b'{"version":"3.1.0"}',
                   'resources/fonts/font.ttf': b'\r\nbinary\r\n',
                   'src/simulation/simulator.ts': b'export const runtime = true;\n',
                   'src/language/core.ts': b'export const language = true;\n',
                   'examples/probe.swaml': b'package Probe { }\n'}
        # Seed dynamic source directories, then build the same complete inventory
        # that the real builder and strict gate use. Static fixture bytes need not
        # be real book prose; versioned inventories below retain their real shape.
        extract_sources(contents, root)
        sources = {path: contents.get(path, ('fixture '+path+'\n').encode())
                   for path in publication_inventory(root).sources}
        manifest = {'release': '2.2', 'specificationRevision': '2.2', 'languageVersion': '2.2', 'implementationRevision': '3.1.0',
                    'sources': [{'path': name, 'attachmentName': name.replace('/', '__'), 'sha256': sha256(raw)} for name, raw in sources.items()],
                    'sourceBundleSha256': sha256(b''.join(name.encode() + b'\0' + raw for name, raw in sources.items()))}
        attachments = {name.replace('/', '__'): [raw] for name, raw in sources.items()}
        extract_sources(sources, root)
        return manifest, attachments

    def resign(self, manifest, attachments):
        manifest['sourceBundleSha256'] = sha256(b''.join(entry['path'].encode() + b'\0' + attachments[entry['attachmentName']][0]
                                                       for entry in manifest['sources']))

    def test_strict_mode_requires_current_workspace_sources(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); manifest, attachments = self.fixture(root)
            verify_edition_sources(manifest, attachments, root, '2.2')
            # Text sources are compared as canonical LF bytes; binary assets byte-exact.
            (root/'docs/LANGUAGE_SPECIFICATION.md').write_bytes(b'swa.ml 2.2 language\r\n')
            verify_edition_sources(manifest, attachments, root, '2.2')
            (root/'docs/LANGUAGE_SPECIFICATION.md').write_bytes(b'later maintained language\n')
            with self.assertRaisesRegex(ValueError, 'Workspace source differs'):
                verify_edition_sources(manifest, attachments, root, '2.2')
            verify_edition_sources(manifest, attachments, None, '2.2')
            (root/'docs/LANGUAGE_SPECIFICATION.md').write_bytes(attachments['docs__LANGUAGE_SPECIFICATION.md'][0])
            (root/'resources/fonts/font.ttf').write_bytes(b'\nbinary\n')
            with self.assertRaisesRegex(ValueError, 'Workspace source differs.*font.ttf'):
                verify_edition_sources(manifest, attachments, root, '2.2')

    def test_strict_mode_rejects_a_self_consistent_incomplete_bundle(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); manifest, attachments = self.fixture(root)
            omitted = 'src/simulation/simulator.ts'
            manifest['sources'] = [entry for entry in manifest['sources'] if entry['path'] != omitted]
            del attachments[omitted.replace('/', '__')]
            self.resign(manifest, attachments)
            # All remaining per-file hashes and the recomputed bundle hash agree;
            # completeness must be checked independently of this forged manifest.
            with self.assertRaisesRegex(ValueError, 'complete current-source inventory.*src/simulation/simulator.ts'):
                verify_edition_sources(manifest, attachments, root, '2.2')

    def test_strict_mode_rejects_extra_sources_and_resigned_reordering(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); manifest, attachments = self.fixture(root)
            (root/'README.md').write_bytes(b'current but not a publication source\n')
            extra = {'path': 'README.md', 'attachmentName': 'README.md', 'sha256': sha256((root/'README.md').read_bytes())}
            augmented, payloads = copy.deepcopy(manifest), copy.deepcopy(attachments)
            augmented['sources'].append(extra); payloads[extra['attachmentName']] = [(root/'README.md').read_bytes()]
            self.resign(augmented, payloads)
            with self.assertRaisesRegex(ValueError, "complete current-source inventory.*extra=\\['README.md'\\]"):
                verify_edition_sources(augmented, payloads, root, '2.2')
            manifest['sources'].reverse(); self.resign(manifest, attachments)
            with self.assertRaisesRegex(ValueError, 'noncanonical source order'):
                verify_edition_sources(manifest, attachments, root, '2.2')

    def test_archive_inventory_stays_independent_of_later_workspace_sources(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); manifest, attachments = self.fixture(root)
            (root/'src/later.ts').write_bytes(b'export const later = true;\n')
            with self.assertRaisesRegex(ValueError, 'complete current-source inventory.*src/later.ts'):
                verify_edition_sources(manifest, attachments, root, '2.2')
            verify_edition_sources(manifest, attachments, None, '2.2')

    def test_tampered_extra_or_reordered_sources_are_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); manifest, attachments = self.fixture(root)
            for change in [lambda m, a: a.update({'unexpected': [b'extra']}),
                           lambda m, a: a.update({'docs__LANGUAGE_SPECIFICATION.md': [b'tampered']}),
                           lambda m, a: m.update(sourceBundleSha256='0'*64),
                           lambda m, a: m['sources'].reverse(),
                           lambda m, a: m['sources'].pop()]:
                m, a = copy.deepcopy(manifest), copy.deepcopy(attachments); change(m, a)
                with self.assertRaises(ValueError): verify_edition_sources(m, a, None, '2.2')

    def test_edition_and_implementation_versions_stay_separate(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); manifest, attachments = self.fixture(root)
            for change in [lambda m: m.update(release='2.2.0', specificationRevision='2.2.0'),
                           lambda m: m.update(languageVersion='2.0'),
                           lambda m: m.update(implementationRevision='2.2'),
                           lambda m: m.update(implementationRevision='3.1.1'),
                           lambda m: m.pop('implementationRevision')]:
                m = copy.deepcopy(manifest); change(m)
                with self.assertRaises(ValueError): verify_edition_sources(m, attachments, None, '2.2')
            with self.assertRaisesRegex(ValueError, 'MAJOR.MINOR'):
                verify_edition_sources(manifest, attachments, None, '2.2.0')

    def test_embedded_inventories_must_match_the_edition(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); manifest, attachments = self.fixture(root)
            for path, raw in [('spec/standard.json', b'{"version":"2.0"}'),
                              ('spec/keywords.json', b'{"languageVersion":"2.2","edition":"2.0"}')]:
                m, a = copy.deepcopy(manifest), copy.deepcopy(attachments)
                a[path.replace('/', '__')] = [raw]
                entry = next(e for e in m['sources'] if e['path'] == path); entry['sha256'] = sha256(raw)
                m['sourceBundleSha256'] = sha256(b''.join(e['path'].encode() + b'\0' + a[e['attachmentName']][0] for e in m['sources']))
                with self.assertRaises(ValueError): verify_edition_sources(m, a, None, '2.2')


class ProseEscapeTests(unittest.TestCase):
    def test_backslash_escapes_in_prose_are_reported(self):
        self.assertEqual(prose_escapes("Inside quotes, \\' writes a quote and \\\\ a backslash."), ["\\'", '\\\\'])
        self.assertEqual(prose_escapes('| a \\| b |'), ['\\|'])

    def test_code_spans_fences_and_plain_backslashes_are_accepted(self):
        self.assertEqual(prose_escapes("Inside quotes, `\\'` writes a quote and `\\\\` a backslash."), [])
        self.assertEqual(prose_escapes("Use ``a `\\'` b`` here."), [])
        self.assertEqual(prose_escapes("```text\nname: 'it\\'s'\n```\nafter"), [])
        self.assertEqual(prose_escapes('~~~\n\\*\n~~~'), [])
        self.assertEqual(prose_escapes('A path C:\\data or \\n stays literal.'), [])

    def test_maintained_book_sources_have_no_prose_escapes(self):
        root = Path(__file__).resolve().parents[1]
        for path in [root/'docs/LANGUAGE_SPECIFICATION.md', *sorted((root/'docs/spec').glob('*.md')), root/'docs/RELEASE_2_2.md']:
            self.assertEqual(prose_escapes(path.read_text(encoding='utf-8')), [], path.name)


class PublishedEditionTests(unittest.TestCase):
    def test_published_manifest_records_both_versions(self):
        root = Path(__file__).resolve().parents[1]
        manifest = json.loads((root/'output/pdf/SWAML-2.2-Specification.manifest.json').read_text(encoding='utf-8'))
        self.assertEqual((manifest['release'], manifest['specificationRevision'], manifest['languageVersion']), ('2.2', '2.2', '2.2'))
        self.assertEqual(manifest['simulationProfile'], 'swaml-reference/2.2')
        # The package may later receive patch versions; the publication keeps the one it was built from.
        self.assertEqual(manifest['implementationRevision'], '3.1.0')
        self.assertEqual(manifest['pdf'], 'SWAML-2.2-Specification.pdf')


if __name__ == '__main__': unittest.main()
