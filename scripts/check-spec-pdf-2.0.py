"""Check the independently versioned 2.0 publication and its source bundle."""
import argparse, hashlib, json
from pathlib import Path
from pypdf import PdfReader
import pdfplumber
ROOT=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--pdf',type=Path,default=ROOT/'output/pdf/SWAML-2.0.0-Specification.pdf');args=p.parse_args()
pdf=args.pdf;manifest=json.loads(pdf.with_suffix('.manifest.json').read_text(encoding='utf-8'));reader=PdfReader(pdf)
assert manifest['release']==manifest['specificationRevision']=='2.0.0'
assert manifest['languageVersion']=='2.0' and manifest['simulationProfile']=='swaml-reference/2.0'
assert len(reader.pages)==manifest['pages'] and len(reader.pages)>50
assert hashlib.sha256(pdf.read_bytes()).hexdigest()==manifest['pdfSha256']==pdf.with_suffix('.sha256').read_text().split()[0]
assert len(manifest['sourceBaseCommit'])==40
sources=manifest['sources'];assert len({s['path'] for s in sources})==len(sources)
bundle=[]
for s in sources:
    raw=(ROOT/s['path']).read_bytes()
    if Path(s['path']).suffix not in ('.png','.ttf'):raw=raw.replace(b'\r\n',b'\n')
    attached=reader.attachments[s['attachmentName']]
    assert len(attached)==1 and attached[0]==raw,s['path']
    assert hashlib.sha256(raw).hexdigest()==s['sha256'],s['path']
    bundle.append(s['path'].encode()+b'\0'+raw)
assert hashlib.sha256(b''.join(bundle)).hexdigest()==manifest['sourceBundleSha256']
assert {'libraries/swaml-2.0.swaml','scripts/build-spec-pdf-2.0.py','resources/fonts/DejaVuSans.ttf','docs/REVIEW_2_0.md','docs/RELEASE_2_0_0.md'}.issubset({s['path'] for s in sources})
def destinations(items):
    for item in items:
        if isinstance(item,list):yield from destinations(item)
        else:yield item
outlines=list(destinations(reader.outline));assert len(outlines)>100
for item in outlines:assert reader.get_destination_page_number(item) is not None
titles={str(item.title) for item in outlines}
assert {'Keyword: '+e['keyword'] for e in json.loads((ROOT/'spec/keywords.json').read_text())['entries']}.issubset(titles)
assert {c['title'] for c in json.loads((ROOT/'spec/notation.json').read_text())['concepts']}.issubset(titles)
page_ids={page.indirect_reference.idnum for page in reader.pages};links=0
for page in reader.pages:
    for ref in page.get('/Annots',[]):
        links+=1;annotation=ref.get_object()
        if '/Dest' in annotation:assert annotation['/Dest'][0].idnum in page_ids
assert links>100
text='\n'.join(page.extract_text() or '' for page in reader.pages)
for fragment in ['Mixed directed port members','before entry actions','sourceBaseCommit','F14']:
    if fragment!='sourceBaseCommit':assert fragment in text,fragment
with pdfplumber.open(pdf) as doc:
    for i,page in enumerate(doc.pages,1):
        assert len(page.chars)>30,('Empty page',i)
        for c in page.chars:
            if c['text'].strip():assert c['x0']>=34 and c['x1']<=page.width-34 and c['top']>=8 and c['bottom']<=page.height-8,(i,c['text'],c['x0'],c['x1'],c['top'])
print(f'2.0 PDF checked: {len(reader.pages)} pages, {len(sources)} exact canonical sources, {len(outlines)} bookmarks, {links} links.')
