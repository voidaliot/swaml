"""Check the swa.ml 2.1 publication, its source bundle, navigation and page bounds.

By default every embedded source must equal the current workspace (the strict
current-source gate for preparing and releasing the edition). --archive checks
the published PDF against its own manifest after the maintained sources move on."""
import argparse, hashlib, json, re
from pathlib import Path
from pypdf import PdfReader
import pdfplumber
from publication_2_1_sources import verify_edition_sources
ROOT=Path(__file__).resolve().parents[1]
EDITION='2.1'
p=argparse.ArgumentParser();p.add_argument('--pdf',type=Path,default=ROOT/f'output/pdf/SWAML-{EDITION}-Specification.pdf')
p.add_argument('--archive',action='store_true',help='Verify the published edition against its embedded manifest only; default checks every current workspace source')
args=p.parse_args()
pdf=args.pdf;manifest=json.loads(pdf.with_suffix('.manifest.json').read_text(encoding='utf-8'));reader=PdfReader(pdf)
assert manifest['release']==manifest['specificationRevision']==manifest['languageVersion']==EDITION
assert manifest['simulationProfile']==f'swaml-reference/{EDITION}'
assert re.fullmatch(r'\d{4}-\d{2}-\d{2}',manifest['publicationDate'])
assert manifest['pdf']==pdf.name==f'SWAML-{EDITION}-Specification.pdf'
assert len(reader.pages)==manifest['pages'] and len(reader.pages)>50
assert hashlib.sha256(pdf.read_bytes()).hexdigest()==manifest['pdfSha256']==pdf.with_suffix('.sha256').read_text().split()[0]
assert pdf.with_suffix('.sha256').read_text()==manifest['pdfSha256']+'  '+pdf.name+'\n'
assert len(manifest['sourceBaseCommit'])==40
sources=manifest['sources']
verified=verify_edition_sources(manifest,reader.attachments,None if args.archive else ROOT,EDITION)
paths={s['path'] for s in sources}
assert {'docs/LANGUAGE_SPECIFICATION.md','docs/RELEASE_2_1.md','docs/decisions/0019-package-context.md','docs/SWAML-2.1-Reference.md',
        'src/language/swaml.langium','src/language/edition.ts','libraries/swaml-2.0.swaml','examples/29-executable-cases.swaml',
        'scripts/build-spec-pdf-2.1.py','scripts/check-spec-pdf-2.1.py','resources/fonts/DejaVuSans.ttf'}.issubset(paths)
# The frozen 2.0 reference and its pointer belong to the 2.0 publication, not to this edition.
assert not any(path.startswith('history/') or path=='docs/SWAML-2.0.0-Reference.md' for path in paths)
edition=verified['src/language/edition.ts'].decode()
assert f"SWAML_LANGUAGE_VERSION = '{EDITION}'" in edition and f"SWAML_REFERENCE_PROFILE = 'swaml-reference/{EDITION}'" in edition
assert f"SWAML_IMPLEMENTATION_VERSION = '{manifest['implementationRevision']}'" in edition
def destinations(items):
    for item in items:
        if isinstance(item,list):yield from destinations(item)
        else:yield item
outlines=list(destinations(reader.outline));assert len(outlines)>100
for item in outlines:assert reader.get_destination_page_number(item) is not None
titles={str(item.title) for item in outlines}
assert {'Keyword: '+e['keyword'] for e in json.loads(verified['spec/keywords.json'])['entries']}.issubset(titles)
assert {c['title'] for c in json.loads(verified['spec/notation.json'])['concepts']}.issubset(titles)
assert {'swa.ml 2.1 release','A. Complete concrete grammar','B. Grammar-to-semantics inventory','C. Model and library sources'}.issubset(titles)
page_ids={page.indirect_reference.idnum for page in reader.pages};links=internal=0
for page in reader.pages:
    for ref in page.get('/Annots',[]):
        links+=1;annotation=ref.get_object()
        if '/Dest' in annotation:internal+=1;assert annotation['/Dest'][0].idnum in page_ids
        uri=annotation.get('/A',{}).get('/URI')
        if uri and 'github.com/voidaliot/swaml/blob/' in uri:assert f'/blob/v{EDITION}/' in uri,uri
assert links>100 and internal>100
text='\n'.join(page.extract_text() or '' for page in reader.pages)
for fragment in ['Package context','Interface-only components','Executable use cases and tests','Migration from 2.0',
                 'white-box call may only target an operation that neither communicates nor suspends',
                 'retained under the connection policy','A failure caught by try does not fail a case','swaml-reference/2.1']:
    assert fragment in text.replace('\n',' '),fragment
with pdfplumber.open(pdf) as doc:
    for i,page in enumerate(doc.pages,1):
        assert len(page.chars)>30,('Empty page',i)
        for c in page.chars:
            if c['text'].strip():
                assert c['x0']>=34 and c['x1']<=page.width-34 and c['top']>=8 and c['bottom']<=page.height-8,(i,c['text'],c['x0'],c['x1'],c['top'])
                # Readable text: the smallest typography is the 6.3 pt code line number.
                assert c['size']>=6.2,('Tiny text',i,c['text'],c['size'])
mode='published edition' if args.archive else 'current workspace'
print(f'{EDITION} PDF checked against the {mode}: {len(reader.pages)} pages, {len(sources)} exact canonical sources, {len(outlines)} bookmarks, {links} links ({internal} internal).')
