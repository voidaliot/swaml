#!/usr/bin/env python3
"""Reproducible vector notation scenes from the worked model examples."""
from pathlib import Path
import json, html, sys, math
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/figures'
OUT.mkdir(exist_ok=True)
CHECK = '--check' in sys.argv
NAVY, TEAL, GRAY, PALE = '#17324d', '#087f8c', '#516579', '#eef4f8'
class Scene:
    def __init__(self, name, title, description, height=680):
        self.name=name; self.doc=dict(width=1000,height=height,title=title,description=description,shapes=[])
        self.rect(0,0,1000,height,fill='#ffffff',stroke='none')
        self.text(32,47,title,30,True)
        self.text(32,80,description,17,color=GRAY)
        self.line([(32,99),(968,99)],color='#ccd9e2')
    def add(self,kind,**kw): self.doc['shapes'].append(dict(kind=kind,**kw))
    def rect(self,x,y,w,h,fill=PALE,stroke=NAVY,rx=8): self.add('rect',x=x,y=y,width=w,height=h,fill=fill,stroke=stroke,rx=rx)
    def text(self,x,y,text,size=20,bold=False,color=NAVY): self.add('text',x=x,y=y,text=text,size=size,bold=bold,color=color)
    def line(self,points,color=NAVY,dash=False,arrow=False,open=False):
        self.add('line',points=points,color=color,dash=dash,arrow=arrow and not open)
        if arrow and open:
            x,y=points[-1];px,py=points[-2];angle=math.atan2(y-py,x-px)
            sides=[(x-14*math.cos(angle)+side*6*math.sin(angle),y-14*math.sin(angle)-side*6*math.cos(angle)) for side in (-1,1)]
            self.add('line',points=[sides[0],(x,y),sides[1]],color=color,dash=False,arrow=False)
    def circle(self,x,y,r,fill=NAVY): self.add('circle',x=x,y=y,r=r,fill=fill,stroke=NAVY)
    def diamond(self,x,y,w,h): self.add('polygon',points=[(x+w/2,y),(x+w,y+h/2),(x+w/2,y+h),(x,y+h/2)],fill=PALE,stroke=NAVY)
    def port(self,x,y,label,tx=None,ty=None,role=None,outward=1):
        self.rect(x-6,y-6,12,12,fill='white',rx=0)
        if role in ['client','server','requires','provides']:
            self.line([(x+outward*7,y),(x+outward*16,y)])
            cx=x+outward*24
            if role in ['server','provides']: self.circle(cx,y,7,fill='white')
            else:self.line([(cx-outward*9*math.cos(a),y+9*math.sin(a)) for a in [-math.pi/2+i*math.pi/16 for i in range(17)]])
        if label: self.text(tx if tx is not None else x+13, ty if ty is not None else y-12,label,17,True,color=TEAL)
    def component(self,x,y,w,h,title):
        self.rect(x,y,w,h,fill='#ffffff'); self.text(x+16,y+31,title,21,True)
        self.rect(x+w-33,y+13,17,24,fill=PALE,rx=0)
        self.rect(x+w-39,y+16,11,6,fill='white',rx=0); self.rect(x+w-39,y+27,11,6,fill='white',rx=0)
    def save(self):
        shapes=[]
        for s in self.doc['shapes']:
            k=s['kind']
            if k=='text': shapes.append(f'<text x="{s["x"]}" y="{s["y"]}" font-size="{s["size"]}" font-weight="{700 if s["bold"] else 400}" fill="{s["color"]}">{html.escape(s["text"])}</text>')
            elif k=='rect': shapes.append(f'<rect x="{s["x"]}" y="{s["y"]}" width="{s["width"]}" height="{s["height"]}" rx="{s["rx"]}" fill="{s["fill"]}" stroke="{s["stroke"]}"/>')
            elif k=='circle': shapes.append(f'<circle cx="{s["x"]}" cy="{s["y"]}" r="{s["r"]}" fill="{s["fill"]}" stroke="{s["stroke"]}"/>')
            elif k=='polygon': shapes.append(f'<polygon points="{" ".join(f"{x},{y}" for x,y in s["points"])}" fill="{s["fill"]}" stroke="{s["stroke"]}"/>')
            elif k=='line': shapes.append(f'<polyline points="{" ".join(f"{x},{y}" for x,y in s["points"])}" fill="none" stroke="{s["color"]}" stroke-width="2"'+(' stroke-dasharray="7 5"' if s['dash'] else '')+(' marker-end="url(#arrow)"' if s['arrow'] else '')+'/>')
        svg=f'<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="{self.doc["height"]}" viewBox="0 0 1000 {self.doc["height"]}" role="img" aria-labelledby="title desc">\n<title id="title">{html.escape(self.doc["title"])}</title><desc id="desc">{html.escape(self.doc["description"])}</desc>\n<defs><marker id="arrow" markerWidth="9" markerHeight="9" refX="8" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 Z" fill="{NAVY}"/></marker></defs>\n<g font-family="DejaVu Sans, sans-serif">\n'+ '\n'.join(shapes)+'\n</g></svg>\n'
        for ext,data in [('svg',svg),('scene.json',json.dumps(self.doc,ensure_ascii=False,indent=2)+'\n')]:
            p=OUT/f'{self.name}.{ext}'
            if CHECK: assert p.read_text(encoding='utf-8')==data, f'Stale graphical example: {p}'
            elif not p.exists() or p.read_text(encoding='utf-8')!=data: p.write_text(data,encoding='utf-8',newline='\n')

s=Scene('browser','Model Browser · ownership and instance context','Settings example: declarations and usages have distinct badges.',700)
s.rect(32,123,560,532,fill='#f7fafc');s.rect(615,123,352,532,fill='white')
rows=[(0,'Settings  [package]'),(1,'TemperatureSetting  [interface]'),(1,'SettingStore  [component def]'),(2,'api  [port: provides]'),(2,'currentValue  [var: int]'),(2,'read / update  [functions]'),(1,'Cabin  [component root]'),(2,'panelInput / driveInputs  [port / function]'),(2,'settings : Service  [instance]'),(3,'store : SettingStore  [instance]'),(4,'api  [port: provides]'),(4,'update  [function instance]'),(2,'front : Client  [instance]'),(2,'rear : Client  [instance]')]
for i,(depth,label) in enumerate(rows):
 y=156+i*36
 if i==11:s.rect(40,y-24,544,33,fill='#d5edf0',stroke='none',rx=3)
 s.text(52+depth*22,y,('▸ ' if i in (1,5,12,13) else '  ')+label,18,bold=i in (0,6,11))
s.text(637,158,'Selected function',22,True)
for i,t in enumerate(['Instance context:','Cabin.settings.store.update','','Shared declaration:','SettingStore.update','','Trigger: on call api.setPoint','Parameters: desired: int','Result: bool','','Open declaration → gv','Open behavior → fv','Up → store instance']):s.text(637,202+i*30,t,17,color=TEAL if i in (1,4) else NAVY)
s.save()

s=Scene('gv','gv · General View','Cabin shows instance ownership and explicit deployment; types are shared declarations.',720)
s.rect(32,122,935,390,fill='#f7fafc');s.text(50,156,'«component» Cabin · root',24,True)
s.text(50,183,'function driveInputs() · on start',18,True)
s.text(50,207,'publish panelInput.adjust(22)',17,color=TEAL)
for x,name,typ in [(55,'settings','Service'),(360,'front','Client'),(665,'rear','Client')]:
 s.component(x,238,280,205,f'{name} : {typ}')
 s.text(x+16,301,'«component instance»',17,color=GRAY)
 s.rect(x+18,325,244,82,fill=PALE)
 s.text(x+32,348,'«component» '+('store' if name=='settings' else 'panel'),17,True)
 s.text(x+32,373,': '+('SettingStore' if name=='settings' else 'Panel'),17)
 s.text(x+32,396,'Private store per instance',13)
s.rect(60,576,285,80);s.text(80,608,'system:controller',22,True);s.text(80,635,'«external target»',18)
s.rect(565,576,300,80);s.text(585,608,'system:displays',22,True);s.text(585,635,'«external target»',18)
s.line([(194,444),(194,570)],dash=True,arrow=True,open=True);s.text(207,545,'deploy',17)
s.line([(500,444),(620,570)],dash=True,arrow=True,open=True);s.text(518,540,'deploy',17)
s.line([(803,444),(803,570)],dash=True,arrow=True,open=True);s.text(817,545,'deploy',17)
s.save()

s=Scene('iv','iv · Interconnect View','Cabin: service routes and a named operator event use explicit ports and delegation.',880)
s.component(32,125,282,205,'front : Client');s.component(32,385,282,205,'rear : Client');s.component(680,173,287,380,'settings : Service')
for y in (125,385):
 s.text(49,y+66,'setting [Req]',18,color=TEAL)
 s.rect(57,y+112,185,66);s.text(68,y+138,'panel : Panel',17,True);s.text(68,y+162,'setting [Req]',16)
 s.line([(314,y+80),(303,y+80),(303,y+145),(266,y+145)],color=TEAL)
 s.text(66,y+199,'delegate setting → panel.setting',15,color=TEAL)
 s.port(314,y+80,'',role='requires');s.port(242,y+145,'',role='requires')
 s.port(32,y+86,'');s.text(49,y+89,'control [Sub]'+(' optional' if y==385 else ''),16,color=TEAL)
 s.line([(32,y+86),(44,y+86),(44,y+149),(57,y+149)],color=TEAL);s.port(57,y+149,'')
s.rect(717,328,224,119);s.text(730,360,'store',21,True);s.text(730,388,': SettingStore',19);s.text(739,423,'api [Prov]',17,color=TEAL)
s.line([(680,293),(699,293),(699,411),(717,411)],color=TEAL);s.port(680,293,'api [Prov]',702,274,role='provides',outward=-1);s.port(717,411,'',role='provides',outward=-1)
s.text(704,483,'delegate api → store.api',17,color=TEAL)
s.line([(338,205),(450,205),(450,293),(649,293)]);s.text(346,181,'frontLink «service»',18,True)
s.line([(338,465),(526,465),(526,309),(641,309),(649,293)]);s.text(338,500,'rearLink «service»',18,True)
s.rect(32,624,935,92,fill=PALE,stroke='none');s.text(50,655,'Contract: TemperatureSetting @ 1.0.0',21,True)
s.text(50,684,'Both links: atMostOnce · fifo · capacity 8 · reject. Requests → provider; events/replies reverse.',17)
s.component(32,747,935,99,'Cabin · root input driver')
s.text(51,804,'driveInputs() on start · publish panelInput.adjust(22)',19)
s.text(51,830,'adjustCommand: panelInput → front.control; control delegates to panel.control.',17,color=TEAL)
s.port(60,747,'panelInput [Pub]',83,736)
s.line([(60,741),(16,741),(16,211),(26,211)],arrow=True,color=TEAL)
s.save()

s=Scene('cv','cv · Case View','Claimed coverage is explicit; no verification checkmark appears without evidence.',570)
s.rect(35,134,443,318,fill='#f7fafc');s.text(55,170,'«component» Cabin',24,True)
s.rect(93,248,327,116,fill='#e3f2f3',rx=35);s.text(123,286,'«useCase» Change',24,True);s.text(123,323,'of Cabin',20)
s.rect(623,225,337,162,fill='white',rx=0);s.text(641,257,'«requirement»',19,color=TEAL);s.text(641,291,'VisibleSetting',23,True);s.text(641,326,'Both panels can observe',18);s.text(641,354,'accepted setting updates.',18)
s.line([(478,301),(616,301)],dash=True,arrow=True,open=True);s.text(498,261,'satisfy',18);s.text(493,282,'(claimed)',18)
s.text(55,510,'Evidence status: design claim. Simulation results are separate artifacts.',19,color=GRAY)
s.save()

s=Scene('sv','sv · Sequence View','Change: causality follows after labels. Rear notification is unordered with front notice/reply.',750)
for x,title in [(65,'front : Client'),(400,'settings : Service'),(757,'rear : Client')]:
 s.rect(x,127,205,57,fill=PALE);s.text(x+10,161,title,18,True)
 s.line([(x+102,185),(x+102,603)],dash=True)
s.line([(169,229),(499,229)],arrow=True);s.text(179,213,'adjust: setting.setPoint → api.setPoint',16)
s.text(188,252,'request via frontLink · correlation adjust',16,color=TEAL)
s.rect(318,290,635,250,fill='#f7fafc',stroke='#ccd9e2');s.text(340,320,'Independent branch after adjust',17,True)
# Redraw life lines across the pale branch panel.
s.line([(502,325),(502,585)],dash=True);s.line([(859,325),(859,585)],dash=True)
s.line([(500,369),(175,369)],arrow=True);s.text(41,351,'frontNotice: api.changed → setting.changed',16);s.text(43,392,'publish via frontLink · after adjust',16,color=TEAL)
s.line([(508,439),(851,439)],arrow=True);s.text(536,414,'rearNotice: api.changed → setting.changed',15);s.text(536,463,'publish via rearLink · after adjust',16,color=TEAL)
s.line([(499,573),(175,573)],dash=True,arrow=True,open=True);s.text(50,554,'accepted: api.setPoint → setting.setPoint',16);s.text(52,601,'reply via frontLink · after frontNotice · correlation adjust',16,color=TEAL)
s.text(36,662,'The rearNotice row is positioned for readability: it may occur before or after accepted.',18,color=GRAY)
s.text(36,694,'Causal chains: adjust → frontNotice → accepted; adjust → rearNotice.',18,True)
s.save()

s=Scene('grv','grv · Grid View','Function inventory from Cabin; blank timing means no declared contract in service profile.',580)
columns=[32,254,426,683,798,866,968];headers=['Instance','Function','Trigger','Result','WCET','Deadline']
for i in range(6):s.rect(columns[i],131,columns[i+1]-columns[i],48,fill=NAVY,stroke='white',rx=0);s.text(columns[i]+10,162,headers[i],16,True,color='white')
rows=[['Cabin (root)','driveInputs()','start; publish adjust(22)','void','-','-'],['settings.store','read()','call api.get','int','1 ms','5 ms'],['settings.store','update(desired)','call api.setPoint','bool','-','-'],['front.panel','adjust(desired)','receive control.adjust','void','-','-'],['front.panel','refresh()','local call','void','-','-'],['front.panel','display(current)','receive setting.changed','void','-','-'],['rear.panel','(same functions)','distinct instance','void','-','-']]
for row,data in enumerate(rows):
 y=179+row*43
 for i,value in enumerate(data):s.rect(columns[i],y,columns[i+1]-columns[i],43,fill=PALE if row%2==0 else 'white',stroke='#ccd9e2',rx=0);s.text(columns[i]+9,y+28,value,15)
s.text(35,530,'read is reentrant; other functions default to serial. Sorting this grid changes no execution order.',17,color=GRAY)
s.save()

s=Scene('fv-flow','fv · Function flow','SettingStore.update(desired: int): bool · on call api.setPoint · directly owned by the component.',780)
s.rect(32,121,935,620,fill='#f7fafc');s.text(52,153,'function update · serial by default',20,True)
s.circle(382,182,9);s.line([(382,192),(382,212)],arrow=True)
s.diamond(182,217,400,130);s.text(270,276,'desired < 10 or',21,True);s.text(278,303,'desired > 30',21,True)
s.line([(582,282),(745,282),(745,338)],arrow=True);s.text(602,259,'true',18)
s.rect(635,344,220,57,rx=25);s.text(676,381,'return false',21,True)
s.line([(382,347),(382,375)],arrow=True);s.text(397,356,'false',18)
s.rect(202,381,360,63);s.text(220,420,'currentValue = desired',20,True)
s.line([(382,444),(382,484)],arrow=True)
s.rect(172,490,420,63);s.text(190,528,'publish api.changed(currentValue)',19,True)
s.line([(382,553),(382,593)],arrow=True)
s.rect(271,599,222,58,rx=25);s.text(314,636,'return true',21,True)
s.text(55,709,'The publish node names an interface member. It creates no free event or remote action.',17,color=GRAY)
s.save()

s=Scene('fv-state','fv · Function states','Device.lifecycle(): void · on start · states and transitions belong to this function.',740)
s.rect(32,125,936,562,fill='#f7fafc');s.text(50,158,'function lifecycle',22,True)
s.circle(82,229,9);s.line([(94,229),(140,229)],arrow=True)
s.rect(145,186,270,133,fill='white',rx=18);s.text(166,219,'state Idle',22,True);s.line([(145,235),(415,235)]);s.text(164,264,'entry: publish status.changed',16);s.text(165,291,'("idle")',17)
s.rect(592,186,330,153,fill='white',rx=18);s.text(612,219,'state Running',22,True);s.line([(592,235),(922,235)]);s.text(610,263,'entry: cycles = cycles + 1;',16);s.text(610,291,'publish status.changed("running")',16)
s.line([(415,252),(585,252)],arrow=True);s.text(428,220,'on receive',16);s.text(425,241,'commands.begin',15)
s.rect(577,521,347,130,fill='white',rx=18);s.text(598,553,'state Stopped «final»',21,True);s.circle(899,545,9,fill='white');s.circle(899,545,5);s.line([(577,568),(924,568)]);s.text(596,597,'entry: publish status.changed',16);s.text(596,624,'("stopped")',17)
s.line([(757,339),(757,515)],arrow=True);s.text(773,392,'on receive',17);s.text(773,418,'commands.stop',17)
s.line([(592,308),(483,308),(483,586),(570,586)],arrow=True)
s.text(67,403,'Alternative: on after 30 s',20,True);s.text(67,435,'effect: publish status.changed("timeout")',17)
s.text(67,481,'Leaving Running cancels its timer.',17,color=GRAY)
s.text(67,627,'Initial/final markers are local control,',16,color=GRAY);s.text(67,649,'not interface messages.',16,color=GRAY)
s.save()
s=Scene('gv-tree','gv · Tree layout','Cabin ownership: the same seven component occurrences as the Box in box layout.',790)
s.component(260,126,480,108,'Cabin · root')
s.text(276,195,'function driveInputs() · on start',18)
s.text(276,219,'publish panelInput.adjust(22)',17,color=TEAL)
for x,name,typ,child,child_type in [(40,'settings','Service','store','SettingStore'),(360,'front','Client','panel','Panel'),(680,'rear','Client','panel','Panel')]:
 s.line([(500,234),(500,249),(x+140,249),(x+140,275)],arrow=True)
 s.text(x+155,263,'owns',17)
 s.component(x,281,280,84,f'{name} : {typ}')
 s.text(x+16,347,'Cabin.'+name,16,color=GRAY)
 s.line([(x+140,365),(x+140,431)],arrow=True);s.text(x+155,405,'owns',17)
 s.component(x,437,280,110,child)
 s.text(x+16,493,': '+child_type,19)
 s.text(x+16,523,f'Cabin.{name}.{child}',16,color=GRAY)
s.line([(32,563),(968,563)],color='#ccd9e2',dash=True)
s.text(40,599,'External deployment references',21,True)
s.rect(40,623,410,87);s.text(55,655,'settings → system:controller',20,True);s.text(55,685,'store inherits this location',17)
s.rect(510,623,450,87);s.text(525,655,'front, rear → system:displays',20,True);s.text(525,685,'each panel inherits its parent location',17)
s.text(40,752,'Ownership arrows do not imply communication, activation order or shared private state.',17,color=GRAY)
s.save()

# Reuse the canonical timing scene and its checked trace-backed observations.
# This keeps the worked TV specimen and canonical drawing pixel-identical.
from notation_scene import render
concept=next(c for c in json.loads((ROOT/'spec/notation.json').read_text(encoding='utf-8'))['concepts'] if c['id']=='function-timing-diagram')
timing=render(concept)
for suffix,data in [('svg',timing.svg()),('scene.json',json.dumps(timing.doc,ensure_ascii=False,indent=2)+'\n')]:
 path=OUT/f'tv.{suffix}'
 if CHECK: assert path.read_text(encoding='utf-8')==data,f'Stale figure: {path}'
 else: path.write_text(data,encoding='utf-8')
print(('Verified' if CHECK else 'Built')+' 10 SVG and vector-scene examples.')
