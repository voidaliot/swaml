#!/usr/bin/env python3
"""Validate complete sources, embedded attachments, navigation and page bounds."""
import argparse
import hashlib
import json
import re
from pathlib import Path
from pypdf import PdfReader
import pdfplumber

ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser()
parser.add_argument('--pdf',type=Path,default=ROOT/'output/pdf/SWAML-1.3.0-Specification.pdf')
PDF=parser.parse_args().pdf
manifest=json.loads(PDF.with_suffix('.manifest.json').read_text(encoding='utf-8'))
reader=PdfReader(PDF)
assert manifest['release']=='1.3.0' and manifest['languageVersion']=='1.3'
assert manifest['specificationRevision']=='1.3.0' and manifest['simulationProfile']=='1.3'
assert len(reader.pages)==manifest['pages'] and len(reader.pages)>100
assert hashlib.sha256(PDF.read_bytes()).hexdigest()==manifest['pdfSha256']
assert PDF.with_suffix('.sha256').read_text(encoding='utf-8').split()[0]==manifest['pdfSha256']
assert len(reader.attachments)==len(manifest['sources'])
for source in manifest['sources']:
    original=(ROOT/source['path']).read_bytes()
    assert hashlib.sha256(original).hexdigest()==source['sha256'],source['path']
    assert reader.attachments[source['attachmentName']]==[original],source['path']

def destinations(items):
    for item in items:
        if isinstance(item,list): yield from destinations(item)
        else: yield item
outlines=list(destinations(reader.outline))
assert len(outlines)>100
for item in outlines: assert reader.get_destination_page_number(item) is not None,item.title
keyword_titles={'Keyword: '+e['keyword'] for e in json.loads((ROOT/'spec/keywords.json').read_text(encoding='utf-8'))['entries']}
assert keyword_titles.issubset({str(o.title) for o in outlines}), 'Missing keyword navigation'
notation=json.loads((ROOT/'spec/notation.json').read_text(encoding='utf-8'))
concept_titles={'Notation: '+concept['id'] for concept in notation['concepts']}
assert concept_titles.issubset({str(o.title) for o in outlines}), 'Missing concept navigation'
attached_paths={source['path'] for source in manifest['sources']}
assert {'docs/QUICK_START.md','docs/ARCHITECTURE_PATTERNS.md','docs/ONTOLOGY_AND_VIEWS.md','docs/RELEASE_1_3_0.md','docs/MIGRATION_1_2.md','docs/decisions/0006-reusable-qos-and-flat-showcase.md','docs/decisions/0007-component-functions-and-calculations.md','docs/SWAML-1.3.0-Reference.md'}.issubset(attached_paths), 'Missing 1.2 edition guidance'
assert {'docs/MODELING_OVERVIEW.md', 'spec/modeling-overview.json'}.issubset(attached_paths), 'Missing visual modeling guide'
assert {'docs/CONTROL_FLOW_AND_TIMING.md','docs/MIGRATION_1_3.md','docs/decisions/0011-loops-interrupts-and-function-timing.md','spec/function-timing-demo.json'}.issubset(attached_paths), 'Missing 1.3 behavior/timing sources'
assert 'docs/decisions/0010-consistent-subject-relations.md' in attached_paths, 'Missing 1.3.0 relation decision'
for graph in ['ontology', 'intent', 'interactions', 'flow', 'functions', 'structure']:
    for suffix in ['svg', 'scene.json']:
        assert f'docs/assets/modeling-{graph}.{suffix}' in attached_paths, (graph, suffix)
for concept in notation['concepts']:
    for suffix in ['svg','png','scene.json']:
        assert f'docs/notation/{concept["id"]}.{suffix}' in attached_paths, (concept['id'],suffix)
links=sum(len(page.get('/Annots',[])) for page in reader.pages)
assert links>200
page_ids={page.indirect_reference.idnum for page in reader.pages}
for page in reader.pages:
    for ref in page.get('/Annots',[]):
        annotation=ref.get_object()
        if '/Dest' in annotation:
            dest=annotation['/Dest']
            assert dest[0].idnum in page_ids
text='\n'.join(page.extract_text() or '' for page in reader.pages)
disallowed = re.compile(r'\bvs[\s-]+code\b|\bvisual[\s-]+studio[\s-]+code\b|\bvoidaliot/(?!swaml(?:[/#?\s)"`\x27<>]|$))[\w.-]+|\bextension (?:package|repository|development|boundary)\b', re.I)
assert not disallowed.search(text), 'Editor-product/private-companion reference in PDF text'
for item in outlines:
    assert not disallowed.search(str(item.title)), 'Editor-product/private-companion reference in PDF navigation'
for page in reader.pages:
    for ref in page.get('/Annots', []):
        assert not disallowed.search(str(ref.get_object())), 'Editor-product/private-companion reference in PDF link'
for name in reader.attachments:
    for attachment in reader.attachments[name]:
        assert not disallowed.search(attachment.decode('utf-8', errors='ignore')), f'Editor-product/private-companion reference in attachment {name}'
for title in ['Complete concrete grammar','Grammar-to-semantics inventory','Operational contract','Normalized semantic model','Conformance obligations','Model examples','Software architecture rationale','Contributing to SWAML','MIT License','Alphabetical keyword reference','Language reference by concern','Formal core and simulation relation','Graphical notation examples','Reference simulation profile','Canonical graphical notation catalog','SWAML ontology and flat views','Migrating to SWAML 1.3','Reusable QoS and flat architecture views']:
    assert title in text,title
with pdfplumber.open(PDF) as doc:
    for i,page in enumerate(doc.pages,1):
        assert len(page.chars)>50,f'Empty page {i}'
        for c in page.chars:
            if not c['text'].strip(): continue
            assert c['x0']>=37 and c['x1']<=page.width-37 and c['top']>=8 and c['bottom']<=page.height-8, (i,c['text'],c['x0'],c['x1'])
print(f'PDF verified: {len(reader.pages)} pages, {len(outlines)} bookmarks, {links} links, {len(notation["concepts"])} illustrated concepts, {len(manifest["sources"])} exact source attachments; page bounds pass.')
