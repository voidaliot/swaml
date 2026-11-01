import argparse,json
from v2_scene import ROOT,STANDARD,scene,write_scene
p=argparse.ArgumentParser();p.add_argument('--check',action='store_true');args=p.parse_args()
figures=[('architecture','Directed ports and explicit connections','architecture','examples/02-realtime-controller.swaml','Control::Demo'),('forwarding','Forwarding preserves boundary direction','forwarding','examples/26-boundary-forwarding.swaml','Boundary::Demo'),('schedule','Schedule and success chaining','schedule','examples/25-function-completion.swaml','Chaining::Demo'),('states','Operation-owned ordered states','state','examples/04-stateful-function.swaml','States::Demo.lamp'),('deployment','Indexed placement on platform Nodes','deployment','examples/22-platform-deployment.swaml','Placement::Demo'),('timing','Declared contracts and observed intervals','timing','examples/17-function-timing.swaml','Timing::Demo.sample')]
manifest={'languageVersion':STANDARD,'examples':[]};text='# swa.ml '+STANDARD+' worked diagrams\n\nGenerated from original scene geometry; source subjects remain authoritative.\n\n'
for key,title,template,model,subject in figures:
    write_scene(ROOT/'docs/figures/2.0'/key,scene(title,template),args.check)
    manifest['examples'].append({'figure':key,'svg':'docs/figures/2.0/'+key+'.svg','scene':'docs/figures/2.0/'+key+'.scene.json','model':model,'subject':subject})
    text+='## '+title+'\n\n!['+title+'](figures/2.0/'+key+'.svg)\n\nSource: ['+subject+'](../'+model+').\n\n'
for path,value in [(ROOT/'spec/graphical-examples.json',json.dumps(manifest,indent=2)+'\n'),(ROOT/'docs/GRAPHICAL_EXAMPLES.md',text.rstrip()+'\n')]:
    if args.check:
        if path.read_text(encoding='utf-8')!=value:raise RuntimeError('Stale generated artifact '+str(path))
    else:path.write_text(value,encoding='utf-8')
print('Worked '+STANDARD+' diagrams '+('checked' if args.check else 'generated'))
