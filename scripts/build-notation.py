from pathlib import Path
import argparse,json
from v2_scene import ROOT,scene,write_scene
p=argparse.ArgumentParser();p.add_argument('--check',action='store_true');p.add_argument('--diagnostics');args=p.parse_args()
inv=json.loads((ROOT/'spec/notation.json').read_text(encoding='utf-8-sig'))
text='# SWAML 2.0 canonical graphical catalog\n\nGenerated from spec/notation.json. Original monochrome notation; no OMG notation-conformance claim. Every drawing preserves source ownership and identity.\n\n'
for c in inv['concepts']:
    write_scene(ROOT/'docs/notation/2.0'/c['id'],scene(c['title'],c['template']),args.check)
    text+='## '+c['title']+'\n\n'+c['context']+'.\n\n!['+c['title']+'](notation/2.0/'+c['id']+'.svg)\n\n**Source:** ['+c['subject']+'](../'+c['model']+'). **Grammar:** '+', '.join(c['productions'])+'.\n\n'+' '.join(c['constraints'])+' '+c['rationale']+'\n\n'
path=ROOT/'docs/GRAPHICAL_CATALOG.md'
text=text.rstrip()+'\n'
if args.check:
    if path.read_text(encoding='utf-8')!=text:raise RuntimeError('Stale graphical catalog')
else:path.write_text(text,encoding='utf-8')
print('Canonical 2.0 SVG/PNG/scenes checked' if args.check else 'Canonical 2.0 SVG/PNG/scenes generated')
