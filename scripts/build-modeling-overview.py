import argparse,json
from v2_scene import ROOT,STANDARD,scene,write_scene
p=argparse.ArgumentParser();p.add_argument('--check',action='store_true');args=p.parse_args()
manifest=json.loads((ROOT/'spec/graphical-examples.json').read_text(encoding='utf-8'))
data={'languageVersion':STANDARD,'stages':[{'id':e['figure'],'source':e['model'],'subject':e['subject'],'diagram':e['svg']} for e in manifest['examples']]}
text=json.dumps(data,indent=2)+'\n';path=ROOT/'spec/modeling-overview.json'
if args.check:
    if path.read_text(encoding='utf-8')!=text:raise RuntimeError('Stale modeling overview inventory')
else:path.write_text(text,encoding='utf-8')
write_scene(ROOT/'docs/figures/2.0/modeling-overview',scene('A source model and its explicit software boundaries','architecture'),args.check)
print(STANDARD+' modeling overview '+('checked' if args.check else 'generated'))
