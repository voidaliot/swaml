"""Focused publication tamper, current/archive and safe extraction regressions."""
import copy
import json
import importlib.util
from pathlib import Path
import tempfile
import unittest
from publication_archive import extract_sources, sha256, source_path, verify_pinned_blobs, verify_sources

TMP = Path(__file__).resolve().parents[1]/'tmp/pdf-archive-tests'
TMP.mkdir(parents=True, exist_ok=True)
spec = importlib.util.spec_from_file_location('archive_builder', Path(__file__).with_name('rebuild-archived-pdf.py'))
archive_builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(archive_builder)


class PublicationArchiveTests(unittest.TestCase):
    def fixture(self):
        sources = {'docs/spec/03-behavior.md': b'original behavior', 'docs/SWAML-1.3.1-Reference.md': b'original complete reference',
                   'spec/keywords.json': json.dumps({'languageVersion': '1.3'}).encode(),
                   'spec/notation.json': json.dumps({'languageVersion': '1.3'}).encode()}
        manifest = {'release': '1.3.1', 'specificationRevision': '1.3.1', 'languageVersion': '1.3', 'sources': [
            {'path': path, 'attachmentName': path.replace('/', '__'), 'sha256': sha256(data)} for path, data in sources.items()]}
        attachments = {path.replace('/', '__'): [data] for path, data in sources.items()}
        return sources, manifest, attachments

    def test_archive_uses_verified_embedded_sources_while_current_requires_exact_workspace(self):
        sources, manifest, attachments = self.fixture()
        with tempfile.TemporaryDirectory(dir=TMP) as directory:
            workspace = Path(directory); extract_sources(sources, workspace)
            self.assertEqual(verify_sources(manifest, attachments, workspace, '1.3.1'), sources)
            (workspace/'docs/spec/03-behavior.md').write_bytes(b'development behavior')
            self.assertEqual(verify_sources(manifest, attachments, workspace, '1.4.0'), sources)
            with self.assertRaisesRegex(ValueError, 'Workspace source differs'):
                verify_sources(manifest, attachments, workspace, '1.3.1')
            (workspace/'docs/SWAML-1.3.1-Reference.md').write_bytes(b'changed archive')
            with self.assertRaisesRegex(ValueError, 'Workspace source differs'):
                verify_sources(manifest, attachments, workspace, '1.4.0')

    def test_attachment_tampering_extra_and_duplicate_payloads_are_rejected(self):
        _, manifest, attachments = self.fixture()
        for mutate in [lambda a: a.update({'docs__spec__03-behavior.md': [b'tampered']}),
                       lambda a: a.update({'unexpected': [b'extra']}),
                       lambda a: a['docs__spec__03-behavior.md'].append(b'duplicate')]:
            broken = copy.deepcopy(attachments); mutate(broken)
            with self.assertRaises(ValueError): verify_sources(manifest, broken)

    def test_manifest_tampering_or_duplicate_paths_are_rejected(self):
        _, manifest, attachments = self.fixture()
        for mutate in [lambda m: m['sources'][0].update(sha256='0'*64),
                       lambda m: m['sources'].append(m['sources'][0]),
                       lambda m: m['sources'][0].update(attachmentName='unexpected'),
                       lambda m: m.update(languageVersion='1.4')]:
            broken = copy.deepcopy(manifest); mutate(broken)
            with self.assertRaises(ValueError): verify_sources(broken, attachments)

    def test_unsafe_paths_are_rejected_and_safe_bytes_extract(self):
        for path in ['.', '../escape', '/absolute', 'C:/drive', 'a\\..\\escape', 'a/../escape', './a', 'a//b', '%2e%2e/escape', 'a\nnext', 'docs/CON', 'docs/COM1.txt', 'foo./source', 'foo /source']:
            with self.subTest(path=path), self.assertRaises(ValueError): source_path(path)
        with tempfile.TemporaryDirectory(dir=TMP) as directory:
            extract_sources({'safe/source.md': b'ok'}, Path(directory))
            self.assertEqual((Path(directory)/'safe/source.md').read_bytes(), b'ok')

    def test_pinned_tooling_and_every_static_input_require_recorded_bytes(self):
        verify_pinned_blobs({'scripts/original.py': sha256(b'original')}, {'scripts/original.py': b'original'})
        for blobs in [{}, {'scripts/original.py': b'current helper'}]:
            with self.assertRaises(ValueError): verify_pinned_blobs({'scripts/original.py': sha256(b'original')}, blobs)

    def test_original_builder_must_identify_the_archived_release_and_profile(self):
        source = b"RELEASE='1.3.1'\nREVISION='1.3.1'\nLANGUAGE='1.3'\nSIMULATION_PROFILE='1.3'\n"
        manifest = dict(release='1.3.1', specificationRevision='1.3.1', languageVersion='1.3', simulationProfile='1.3')
        archive_builder.builder_version(source, manifest)
        with self.assertRaises(ValueError): archive_builder.builder_version(source.replace(b"LANGUAGE='1.3'", b"LANGUAGE='1.4'"), manifest)

    def test_release_is_validated_before_tooling_paths_or_extraction_prefixes(self):
        _, manifest, attachments = self.fixture()
        for release in ['../escape', '1.3.0', None, 'C:/outside']:
            with self.subTest(release=release), self.assertRaisesRegex(ValueError, 'Publication release'):
                verify_sources({**manifest, 'release': release}, attachments)


if __name__ == '__main__': unittest.main()
