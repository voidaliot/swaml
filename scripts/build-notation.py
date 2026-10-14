#!/usr/bin/env python3
"""Build the canonical concept catalogue from the reviewed semantic inventory.

Pillow and DejaVu Sans rasterize the same geometry used by SVG/PDF. --check
compares vector/source bytes and decoded PNG pixels, ignoring PNG compression.
"""
from pathlib import Path
import argparse, hashlib, io, json, math, os, platform, re
from PIL import Image, ImageChops, features

ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--check',action='store_true');parser.add_argument('--font-dir');parser.add_argument('--diagnostics',type=Path,help='Write renderer metadata and mismatch images for CI investigation.');args=parser.parse_args()
if args.font_dir:os.environ['SWAML_FONT_DIR']=args.font_dir
from notation_scene import render, Scene, font, font_path
inventory=json.loads((ROOT/'spec/notation.json').read_text())
out=ROOT/'docs/notation'
if not args.check:out.mkdir(parents=True,exist_ok=True)
concepts=inventory['concepts']
failures=[]
diagnostics={'platform':platform.platform(),'python':platform.python_version(),'pillow':Image.__version__,
    'freetype':features.version('freetype2'),'raqmAvailable':features.check('raqm'),
    'layoutEngine':font(20).layout_engine.name,
    'fonts':{font_path(bold).name:hashlib.sha256(font_path(bold).read_bytes()).hexdigest() for bold in [False,True]},
    'mismatches':[]}

def save_diagnostic(path,data,kind='expected'):
    if args.diagnostics:
        destination=args.diagnostics/kind/path.relative_to(ROOT)
        destination.parent.mkdir(parents=True,exist_ok=True);destination.write_bytes(data)

def mismatch(path,detail):
    failures.append(str(path.relative_to(ROOT)))
    diagnostics['mismatches'].append({'path':str(path.relative_to(ROOT)),**detail})

def write(path,data):
    if args.check:
        if path.read_bytes()!=data:
            mismatch(path,{'kind':'exact-source'});save_diagnostic(path,data)
    else:path.write_bytes(data)

def write_png(path,png):
    if args.check:
        actual=Image.open(path).convert('RGB');expected=Image.open(io.BytesIO(png)).convert('RGB')
        if actual.size!=expected.size or actual.tobytes()!=expected.tobytes():
            detail={'kind':'pixels','actualSize':actual.size,'expectedSize':expected.size}
            if actual.size==expected.size:
                difference=ImageChops.difference(actual,expected)
                maximum=ImageChops.lighter(ImageChops.lighter(*difference.split()[:2]),difference.split()[2])
                histogram=maximum.histogram();pixels=actual.width*actual.height
                rgb=difference.histogram();channels=3*pixels
                detail.update(changedPixels=pixels-histogram[0],changedFraction=(pixels-histogram[0])/pixels,
                    maxChannelDelta=max(i for i,count in enumerate(histogram) if count),
                    meanAbsoluteChannelDelta=sum((i%256)*count for i,count in enumerate(rgb))/channels,
                    rmsChannelDelta=math.sqrt(sum((i%256)**2*count for i,count in enumerate(rgb))/channels))
                masks=[image.convert('L').point(lambda v:255 if v<128 else 0) for image in [actual,expected]]
                detail['threshold128ChangedPixels']=pixels-ImageChops.difference(*masks).histogram()[0]
                data=io.BytesIO();maximum.point(lambda v:min(255,v*4)).save(data,format='PNG');save_diagnostic(path,data.getvalue(),'difference-x4')
            mismatch(path,detail);save_diagnostic(path,png);save_diagnostic(path,path.read_bytes(),'committed')
    else:path.write_bytes(png)

for concept in concepts:
    scene=render(concept)
    write(out/f'{concept["id"]}.svg',scene.svg().encode())
    write(out/f'{concept["id"]}.scene.json',(json.dumps(scene.doc,ensure_ascii=False,indent=2)+'\n').encode())
    write_png(out/f'{concept["id"]}.png',scene.png())

worked=sorted((ROOT/'docs/figures').glob('*.scene.json'))
for path in worked:
    scene=Scene.__new__(Scene);scene.doc=json.loads(path.read_text())
    write_png(path.with_name(path.name.replace('.scene.json','.png')),scene.png())

expected={f'{c["id"]}.{ext}' for c in concepts for ext in ['svg','png','scene.json']}
assert {p.name for p in out.iterdir() if p.is_file()}==expected, 'Unlisted/missing notation artifacts; remove stale concept files deliberately.'

lines=['# Canonical graphical notation catalog','',f'SWAML {inventory["languageVersion"]} · publication {inventory["edition"]}. This generated catalog defines the original monochrome notation for each authored concept and meaningful label group. All specimens derive from [the semantic inventory](../spec/notation.json); complete examples supply their validation context.','',
'Each SVG, PNG and vector scene shares the same geometry. A graphical specimen is a projection of its textual model; it does not create additional ports, events, state owners or execution semantics. Labels such as QoS values and expression operators appear within their owning element rather than introducing independent nodes.','',
'The following fragments are contextual notation samples, not standalone SWAML files. `def` identifies reusable component/unit types; a root is an occurrence selected for execution.','',
'## Concept index','']
for c in sorted(concepts,key=lambda c:c['title'].casefold()):lines.append(f'- [{c["title"]}](#notation-{c["id"]}) — {c["concern"]}.')
for concern in sorted({c['concern'] for c in concepts},key=str.casefold):
    lines+=['',f'## {concern}','']
    for c in sorted((c for c in concepts if c['concern']==concern),key=lambda c:c['title'].casefold()):
        syntax=re.sub(r'\s+', ' ', c['syntax']).replace('|', '\\|').strip()
        lines += [f'## Notation: {c["id"]}','',f'**{c["title"]}**','',
            '| Element | Graphical notation | Textual notation |','| --- | --- | --- |',
            f'| {c["title"]} ({c["kind"]}) | ![{c["title"]}](notation/{c["id"]}.svg) | `{syntax}` |','',
            c['description'],'',f'**Context:** {c["context"]} **Views:** {", ".join(c["views"])}.','']
        lines += [f'- {rule}' for rule in c['rules']]
        if c.get('source'):
            source=c['source'];identity=f' · `{source["path"]}`' if source.get('path') else ''
            lines += ['',f'[Complete model](../{source["model"]}){identity}.']
        lines += ['',f'[SVG](notation/{c["id"]}.svg) · [PNG](notation/{c["id"]}.png) · [Vector scene](notation/{c["id"]}.scene.json)','']
lines += ['## Coverage and interpretation','',
'The inventory explicitly assigns every current grammar production and keyword to a graphical concept or a justified text-only role. This is a notation coverage claim, not an assertion that an editor or layout engine is implemented. Run `node scripts/check-notation.mjs` for semantic coverage and context checks, and `python3 scripts/build-notation.py --check` for reproducible artifacts.','']
by_id={c['id']:c for c in concepts}
for key,title in [('keywords','Keyword coverage'),('productions','Grammar production coverage')]:
    lines += [f'## {title}','','| Term | Representation | Concept and rationale |','| --- | --- | --- |']
    for item in sorted(inventory['coverage'][key],key=lambda i:i['term'].casefold()):
        links=', '.join(f'[{by_id[id]["title"]}](#notation-{id})' for id in item['concepts'])
        detail=(links+'. ' if links else '')+item.get('rationale','')
        lines += [f'| `{item["term"]}` | {item["mode"]} | {detail.replace("|", "&#124;")} |']
    lines.append('')
write(ROOT/'docs/GRAPHICAL_CATALOG.md','\n'.join(lines).encode())
if args.diagnostics:
    args.diagnostics.mkdir(parents=True,exist_ok=True)
    (args.diagnostics/'report.json').write_text(json.dumps(diagnostics,indent=2)+'\n')
assert not failures, 'Stale notation artifacts: '+', '.join(failures)+(f'; diagnostics: {args.diagnostics}/report.json' if args.diagnostics else '')
print(('Verified' if args.check else 'Built')+f' {len(concepts)} canonical SVG/PNG/vector-scene triples, {len(worked)} worked-view PNGs and the graphical catalog.')
