"""Deterministic flat monochrome scenes shared by SVG, PNG and PDF exports.

Scenes use the six primitive kinds understood by pdf-scene.py. Arrowheads are
explicit polygons/lines so SVG, raster and publication exports share geometry.
"""
from pathlib import Path
import html, io, math, os
from PIL import Image, ImageDraw, ImageFont

BLACK = '#111111'
WHITE = '#ffffff'
FONT_ROOTS = [
    Path(os.environ.get('SWAML_FONT_DIR', Path(__file__).resolve().parents[1] / 'resources/fonts')),
    Path('/usr/share/fonts/truetype/dejavu'),
    Path('/usr/share/fonts/dejavu'),
    Path.home() / '.cache/codex-runtimes/codex-primary-runtime/dependencies/native/libreoffice-headless/libreoffice/LibreOfficeDev.app/Contents/Resources/fonts/truetype',
]

def font_path(bold=False):
    name = 'DejaVuSans-Bold.ttf' if bold else 'DejaVuSans.ttf'
    for folder in FONT_ROOTS:
        if (folder / name).exists():
            return folder / name
    raise RuntimeError('Install DejaVu Sans or set SWAML_FONT_DIR to its font directory.')

FONTS = {}
def font(size, bold=False):
    key = (size, bold)
    if key not in FONTS:
        # Pillow's implicit default depends on optional RAQM support. Pin the
        # layout engine so macOS and Linux use identical advances and kerning.
        FONTS[key] = ImageFont.truetype(str(font_path(bold)), size, layout_engine=ImageFont.Layout.BASIC)
    return FONTS[key]

def wrapped(value, width, size=18, bold=False):
    result = []
    for line in str(value).splitlines() or ['']:
        words, current = line.split(' '), ''
        for word in words:
            if font(size,bold).getlength(word)>width:
                if current:result.append(current);current=''
                while font(size,bold).getlength(word)>width:
                    split=max(i for i in range(1,len(word)) if font(size,bold).getlength(word[:i])<=width)
                    preferred=max(word.rfind('.',0,split),word.rfind(':',0,split))
                    if preferred>split//2:split=preferred+1
                    result.append(word[:split]);word=word[split:]
            candidate = f'{current} {word}'.strip()
            if current and font(size, bold).getlength(candidate) > width:
                result.append(current); current = word
            else:
                current = candidate
        result.append(current)
    return result

class Scene:
    def __init__(self, concept, height=290):
        self.doc = {'width': 560, 'height': height, 'title': concept['title'], 'description': concept['description'], 'shapes': []}
        self.rect(0, 0, 560, height, stroke='none')
    def add(self, kind, **properties): self.doc['shapes'].append({'kind': kind, **properties})
    def rect(self, x, y, width, height, rx=0, fill=WHITE, stroke=BLACK):
        self.add('rect', x=x, y=y, width=width, height=height, rx=rx, fill=fill, stroke=stroke)
    def circle(self, x, y, r, fill=WHITE):
        self.add('circle', x=x, y=y, r=r, fill=fill, stroke=BLACK)
    def polygon(self, points, fill=WHITE, stroke=BLACK):
        self.add('polygon', points=points, fill=fill, stroke=stroke)
    def line(self, points, dash=False):
        self.add('line', points=points, color=BLACK, dash=dash, arrow=False)
    def arrow(self, points, dash=False, open=False):
        self.line(points, dash)
        x, y = points[-1]; px, py = points[-2]; angle = math.atan2(y-py, x-px)
        sides = [(x-12*math.cos(angle)+side*5*math.sin(angle), y-12*math.sin(angle)-side*5*math.cos(angle)) for side in (-1, 1)]
        if open: self.line([sides[0], (x, y), sides[1]])
        else: self.polygon([(x, y), *sides], fill=BLACK)
    def text(self, x, y, value, size=18, bold=False, width=None, center=False):
        lines = wrapped(value, width, size, bold) if width else str(value).splitlines()
        for i, line in enumerate(lines):
            tx = x - font(size, bold).getlength(line)/2 if center else x
            self.add('text', x=round(tx, 3), y=y+i*(size+7), text=line, size=size, bold=bold, color=BLACK)
        return y + len(lines)*(size+7)
    def labels(self, lines, x, y, width, size=18, bold=False):
        for value in lines: y = self.text(x, y, value, size, bold, width)
        return y
    def port(self, x, y): self.rect(x-7, y-7, 14, 14)
    def component_icon(self,x,y):
        self.rect(x,y,22,31);self.rect(x-7,y+4,13,7);self.rect(x-7,y+19,13,7)
    def final(self, x, y): self.circle(x, y, 12); self.circle(x, y, 7, BLACK)
    def box(self, x, y, width, height, label, rounded=False):
        self.rect(x, y, width, height, rx=12 if rounded else 0)
        count=len(wrapped(label,width-20))
        self.text(x+width/2, y+height/2+6-(count-1)*12.5, label, 18, width=width-20, center=True)
    def frame(self, kind, title='example'):
        self.rect(14, 14, 532, self.doc['height']-28)
        self.polygon([(14, 14), (174, 14), (174, 40), (158, 54), (14, 54)])
        self.text(27, 40, kind, 19, True)
        self.text(194, 40, title.split(': ',1)[-1], 18, width=330)
    def svg(self):
        parts=[]
        for shape in self.doc['shapes']:
            s=shape; k=s['kind']
            if k=='text': parts.append(f'<text x="{s["x"]}" y="{s["y"]}" font-size="{s["size"]}" font-weight="{700 if s["bold"] else 400}" fill="{s["color"]}">{html.escape(s["text"])}</text>')
            elif k=='rect': parts.append(f'<rect x="{s["x"]}" y="{s["y"]}" width="{s["width"]}" height="{s["height"]}" rx="{s["rx"]}" fill="{s["fill"]}" stroke="{s["stroke"]}"/>')
            elif k=='circle': parts.append(f'<circle cx="{s["x"]}" cy="{s["y"]}" r="{s["r"]}" fill="{s["fill"]}" stroke="{s["stroke"]}"/>')
            elif k=='polygon': parts.append(f'<polygon points="{" ".join(f"{x},{y}" for x,y in s["points"])}" fill="{s["fill"]}" stroke="{s["stroke"]}"/>')
            else: parts.append(f'<polyline points="{" ".join(f"{x},{y}" for x,y in s["points"])}" fill="none" stroke="{s["color"]}" stroke-width="2"'+(' stroke-dasharray="7 5"' if s['dash'] else '')+'/>')
        d=self.doc
        return f'<svg xmlns="http://www.w3.org/2000/svg" width="{d["width"]}" height="{d["height"]}" viewBox="0 0 {d["width"]} {d["height"]}" role="img" aria-labelledby="title desc">\n<title id="title">{html.escape(d["title"])}</title><desc id="desc">{html.escape(d["description"])}</desc>\n<g font-family="DejaVu Sans, sans-serif" stroke-width="1.5">\n'+ '\n'.join(parts)+'\n</g></svg>\n'
    def png(self):
        scale=4
        im=Image.new('RGB', (self.doc['width']*scale, self.doc['height']*scale), 'white')
        draw=ImageDraw.Draw(im)
        def point(p): return tuple(round(x*scale) for x in p)
        def line(points,dash=False,color=BLACK):
            if not dash: draw.line([point(p) for p in points],fill=color,width=2*scale,joint='curve'); return
            for start,end in zip(points,points[1:]):
                dx=end[0]-start[0];dy=end[1]-start[1];length=math.hypot(dx,dy)
                at=0
                while at<length:
                    finish=min(at+7,length)
                    draw.line([point((start[0]+dx*at/length,start[1]+dy*at/length)),point((start[0]+dx*finish/length,start[1]+dy*finish/length))],fill=color,width=2*scale)
                    at+=12
        for s in self.doc['shapes']:
            k=s['kind']; fill=None if s.get('fill')=='none' else s.get('fill'); stroke=None if s.get('stroke')=='none' else s.get('stroke')
            if k=='text': draw.text(point((s['x'],s['y'])),s['text'],font=font(s['size']*scale,s['bold']),fill=s['color'],anchor='ls')
            elif k=='line':
                line(s['points'],s['dash'],s['color'])
                if s.get('arrow'):
                    x,y=s['points'][-1];px,py=s['points'][-2];angle=math.atan2(y-py,x-px)
                    sides=[(x-14*math.cos(angle)+side*6*math.sin(angle),y-14*math.sin(angle)-side*6*math.cos(angle)) for side in (-1,1)]
                    draw.polygon([point((x,y)),*[point(p) for p in sides]],fill='#17324d')
            elif k=='rect': draw.rounded_rectangle([point((s['x'],s['y'])),point((s['x']+s['width'],s['y']+s['height']))],radius=s['rx']*scale,fill=fill,outline=stroke,width=6)
            elif k=='circle': draw.ellipse([point((s['x']-s['r'],s['y']-s['r'])),point((s['x']+s['r'],s['y']+s['r']))],fill=fill,outline=stroke,width=6)
            elif k=='polygon':
                points=[point(p) for p in s['points']];draw.polygon(points,fill=fill)
                if stroke: draw.line(points+[points[0]],fill=stroke,width=6,joint='curve')
        im=im.resize((self.doc['width']*2,self.doc['height']*2),Image.Resampling.LANCZOS)
        data=io.BytesIO();im.save(data,format='PNG',optimize=False)
        return data.getvalue()


def render(concept):
    d=concept['drawing'];t=d['template'];head=d.get('header',[concept['title']]);head=[head] if isinstance(head,str) else head
    lines=d.get('lines',[]); label=d.get('label','');left=d.get('from','source');right=d.get('to','target')
    s=Scene(concept,320 if t in ['browser','gv','iv','cv','sv','grv','fv','deployment','delegation','loop','request','transition'] else 280)
    if t=='function' and d.get('variant')=='state-body':
        s.doc['height']=320;s.doc['shapes'][0]['height']=320
        s.rect(25,25,510,270,rx=12);s.labels(head,43,61,470,20,True);s.line([(25,91),(535,91)]);s.text(43,118,'on start',18)
        s.circle(65,185,9,BLACK);s.arrow([(75,185),(130,185)])
        s.box(133,145,153,80,left,True);s.arrow([(287,185),(344,185)]);s.box(347,145,157,80,right,True)
        s.text(280,267,label,18,width=480,center=True)
    elif t=='note':
        s.rect(28,22,504,256);s.labels(head,46,56,468,20,True)
        s.rect(72,115,416,120);s.labels(lines,90,147,380)
        s.line([(280,75),(280,114)],dash=True)
    elif t in ['classifier','component','usage','interface','member','function']:
        x,y,w=36,24,488
        header=sum(len(wrapped(v,w-36,20,True)) for v in head)*27
        body=sum(len(wrapped(v,w-36)) for v in lines)*25
        h=max(190,header+body+42)
        if h+48>s.doc['height']: s.doc['height']=h+48;s.doc['shapes'][0]['height']=h+48
        s.rect(x,y,w,h,rx=12 if t=='function' else 0)
        s.labels(head,x+18,y+30,w-(86 if t=='component' else 36),20,True)
        bar=y+header+16;s.line([(x,bar),(x+w,bar)])
        s.labels(lines,x+18,bar+28,w-36)
        if t=='component' or d.get('variant')=='component':
            # UML-style component icon complements the explicit SWAML def label.
            s.component_icon(x+w-39,y+10)
    elif t=='calculation':
        s.rect(36,24,488,232);s.labels(head,54,58,452,20,True);s.line([(36,84),(524,84)])
        s.text(54,118,lines[0],18,width=452);s.line([(36,139),(524,139)])
        s.labels(lines[1:],54,175,452)
    elif t=='package':
        s.rect(30,55,500,200);s.rect(30,22,230,33)
        s.text(44,47,head[0],20,True,width=205)
        s.labels(head[1:]+lines,48,89,460)
    elif t=='port':
        role=d.get('role','sender'); outgoing=role in ['sender','publisher','client','requires']
        s.rect(28,32,290,210);s.labels(head,44,62,254,19,True)
        bidirectional=role in ['client','server','provides','requires'];s.port(318,174 if bidirectional else 158)
        s.text(350,88,'«'+role+'»',18,width=188)
        s.labels(lines,350,116,188)
        pts=[(326,174),(345,158),(520,158)] if bidirectional else [(326,158),(520,158)]
        if not outgoing:pts.reverse()
        s.arrow(pts)
        if bidirectional:
            response=[(326,174),(345,193),(520,193)]
            if outgoing:response.reverse()
            s.arrow(response,dash=True,open=True)
    elif t in ['connection','edge']:
        s.box(20,128,170,85,left);s.box(370,128,170,85,right)
        if t=='connection':s.port(190,171);s.port(370,171)
        pts=[(198 if t=='connection' else 190,171),(362 if t=='connection' else 370,171)]
        if d.get('direction')=='reverse':pts.reverse()
        if d.get('variant') in ['typing','specialization']:
            s.line(pts,dash=d.get('variant')=='typing');x,y=pts[-1];direction=1 if pts[-1][0]>pts[-2][0] else -1
            s.polygon([(x,y),(x-direction*16,y-8),(x-direction*16,y+8)])
        else:s.arrow(pts,dash=d.get('dashed',t=='edge'),open=t=='edge')
        s.labels(head,26,35,508,20,True);s.text(280,113,label,18,width=515,center=True)
        s.labels(lines,26,244,508)
    elif t=='delegation':
        s.rect(22,27,516,262);s.labels(head,40,58,475,20,True)
        s.box(258,143,235,110,right)
        s.port(22,187);s.port(258,187);s.line([(29,187),(251,187)])
        s.text(43,134,label or left,18,width=200)
        s.labels(lines,43,232,180)
    elif t=='flow':
        if d.get('variant')=='assert':
            s.doc['height']=320;s.doc['shapes'][0]['height']=320
            s.circle(230,25,7,BLACK);s.arrow([(230,33),(230,69)])
            s.rect(40,72,380,120,rx=13);s.labels(head,58,110,344,20,True);s.labels(lines,58,150,344)
            s.arrow([(420,132),(519,132)]);s.final(534,132);s.text(432,109,'false',18)
            s.arrow([(230,193),(230,285)]);s.text(248,250,'true',18)
            return validate(s,concept)
        s.circle(280,27,7,BLACK);s.arrow([(280,35),(280,75)])
        s.rect(45,78,470,135,rx=13);bottom=s.labels(head,64,111,432,20,True);s.labels(lines,64,max(145,bottom+3),432)
        if d.get('variant')=='fail':s.arrow([(280,214),(280,240)]);s.final(280,255)
        else:s.arrow([(280,214),(280,260)])
    elif t=='decision':
        s.doc['height']=370;s.doc['shapes'][0]['height']=370
        s.polygon([(280,35),(370,90),(280,145),(190,90)])
        s.text(280,96,label or head[0],18,width=155,center=True)
        s.arrow([(190,90),(140,90),(140,173)]);s.text(85,135,'true',18)
        s.arrow([(370,90),(420,90),(420,173)]);s.text(438,135,'false',18)
        s.box(40,176,200,60,'then { … }',True);s.box(320,176,200,60,'else { … }',True)
        s.arrow([(140,237),(140,285),(249,285)]);s.arrow([(420,237),(420,285),(311,285)])
        s.polygon([(280,263),(310,285),(280,307),(250,285)])
        s.arrow([(280,308),(280,351)])
    elif t=='loop':
        s.rect(60,30,418,230,rx=14);s.labels(head,80,61,374,20,True)
        s.polygon([(270,91),(340,132),(270,173),(200,132)])
        condition=label or head[0].removeprefix('while (').removesuffix(')')
        s.text(270,138,condition,18,width=110,center=True)
        s.box(156,199,230,48,lines[0] if lines else 'body',True)
        s.arrow([(270,174),(270,198)]);s.text(285,194,'true',18)
        s.arrow([(387,223),(442,223),(442,132),(341,132)])
        s.arrow([(200,132),(90,132),(90,289)]);s.text(101,156,'false',18)
        bound=d.get('bound','positive limit')
        s.text(273,294,f'bound {bound}; LoopBound on excess',18,width=480,center=True)
    elif t=='for-loop':
        s.doc['height']=555;s.doc['shapes'][0]['height']=555
        s.rect(40,22,480,458,rx=14);s.labels(head,59,54,440,20,True)
        s.box(155,83,250,54,d['initializer'],True);s.arrow([(280,138),(280,172)])
        s.polygon([(280,174),(355,219),(280,264),(205,219)])
        s.text(280,225,d['condition'],18,width=120,center=True)
        s.arrow([(280,265),(280,300)]);s.text(295,289,'true',18)
        s.box(145,303,270,67,lines[0],True)
        s.arrow([(280,371),(280,399)]);s.box(155,402,250,54,d['update'],True)
        s.arrow([(406,429),(478,429),(478,219),(356,219)])
        s.arrow([(204,219),(82,219),(82,500)]);s.text(94,243,'false',18)
        s.text(94,499,'normal exit',18)
        s.text(280,535,f'bound {d["bound"]}; LoopBound before an excess body',18,width=520,center=True)
    elif t=='for-each':
        s.doc['height']=490;s.doc['shapes'][0]['height']=490
        s.rect(35,22,490,402,rx=14);s.labels(head,53,57,454,20,True)
        s.box(100,86,360,63,'copy '+d['collection']+' once',True)
        s.arrow([(280,150),(280,185)])
        s.polygon([(280,188),(365,240),(280,292),(195,240)])
        s.text(280,234,'next',18,center=True);s.text(280,260,'item?',18,center=True)
        s.arrow([(280,293),(280,325)]);s.text(296,317,'yes',18)
        s.rect(135,328,290,78,rx=12);s.text(280,356,'fresh '+d['item'],18,True,center=True)
        s.text(280,384,lines[0],18,width=270,center=True)
        s.arrow([(426,367),(487,367),(487,240),(366,240)])
        s.arrow([(194,240),(72,240),(72,447)]);s.text(86,267,'no',18)
        s.text(86,447,'normal exit',18)
        s.text(280,478,'finite cardinality: '+d['cardinality']+' copied items',18,width=510,center=True)
    elif t=='do-while':
        s.doc['height']=450;s.doc['shapes'][0]['height']=450
        s.rect(35,22,490,348,rx=14);s.labels(head,53,55,454,20,True)
        s.box(118,82,324,69,lines[0],True);s.arrow([(280,152),(280,214)])
        s.text(55,183,'first body is mandatory',18,width=200)
        s.polygon([(280,217),(405,270),(280,323),(155,270)])
        s.text(280,276,d['condition'],18,width=218,center=True)
        s.arrow([(406,270),(491,270),(491,116),(443,116)]);s.text(443,296,'true',18)
        s.arrow([(280,324),(280,394)]);s.text(296,354,'false',18)
        s.text(280,416,f'bound {d["bound"]}; LoopBound before an excess body',18,width=520,center=True)
    elif t=='interruptible':
        s.doc['height']=555;s.doc['shapes'][0]['height']=555
        s.rect(36,24,488,271);s.labels(head,54,58,452,20,True)
        s.circle(73,151,8,BLACK);s.arrow([(82,151),(111,151)])
        s.box(114,105,315,92,lines[0],True)
        s.arrow([(272,198),(272,310),(155,310),(155,470)])
        s.text(175,345,'normal exit',18)
        s.arrow([(430,151),(494,151),(494,327),(407,327),(407,358)])
        member,payload=d['endpoint'].split('(',1)
        s.text(390,222,'on receive',18,True,width=190,center=True)
        s.text(390,249,member,18,width=190,center=True)
        s.text(390,276,payload.removesuffix(')'),18,width=190,center=True)
        s.box(287,361,242,78,lines[1],True)
        s.text(300,345,'interrupt',18)
        s.arrow([(407,440),(407,470),(220,470)])
        s.arrow([(155,470),(190,470)]);s.circle(205,470,10)
        s.arrow([(205,481),(205,512)]);s.text(226,505,'continue after region',18,width=300)
        s.text(280,544,'cooperative cancellation; no rollback',18,width=520,center=True)
    elif t=='function-timing':
        s.doc['height']=560;s.doc['shapes'][0]['height']=560
        s.rect(35,22,490,107);s.labels(head,54,55,452,20,True)
        s.text(54,88,lines[0],18,width=452)
        s.text(35,165,lines[1],18,width=490)
        # Exact values are checked against the source-backed trace projection.
        for n,activation in enumerate(d['observations']):
            y=238+n*99;x=lambda ms:120+50*ms
            released=x(activation['releasedMs']);dispatched=x(activation['dispatchedMs']);ended=x(activation['terminalMs'])
            s.text(43,y+6,activation['id'],18,True)
            if dispatched>released:
                s.rect(released,y-15,dispatched-released,30)
                s.text((released+dispatched)/2,y+6,'ready',18,center=True)
            s.rect(dispatched,y-15,ended-dispatched,30)
            s.text((dispatched+ended)/2,y+6,'request wait',18,center=True)
            s.polygon([(released,y-24),(released-7,y-35),(released+7,y-35)],fill=BLACK)
            s.line([(dispatched,y-22),(dispatched,y+22)])
            s.line([(ended,y-22),(ended,y+22)]);s.circle(ended,y,7)
        s.line([(120,394),(520,394)])
        for ms in [0,2,4,6,8]:
            x=120+50*ms;s.line([(x,394),(x,402)]);s.text(x,428,str(ms),18,center=True)
        s.text(320,461,'logical time (ms)',18,center=True)
        s.text(35,496,'▼ release; | zero-time running; ○ complete',18,width=500)
        s.text(35,523,'display 0–8 ms; quiescent boundary 31 ms',18,width=500)
        s.text(35,550,'declared deadlines 30 / 31 ms lie outside this window',18,width=510)
    elif t=='request':
        s.rect(25,23,510,106,rx=12);bottom=s.labels(head,43,54,472,20,True);s.labels(lines[:1],43,max(89,bottom+3),472)
        s.arrow([(170,130),(170,197)]);s.arrow([(390,130),(390,197)])
        s.text(82,169,'success',18);s.text(382,169,'failure',18)
        s.box(40,200,225,78,'continue',True);s.box(300,200,230,78,'otherwise: return / fail',True)
        s.text(280,308,label or 'within timeout',18,center=True)
    elif t=='return':
        s.rect(55,35,450,120,rx=12);s.labels(head+lines,75,70,410,20,True)
        s.arrow([(280,155),(280,221)]);s.final(280,237)
    elif t in ['state','final']:
        s.rect(65,25,430,225,rx=18);s.labels(head,86,60,365,20,True)
        if t=='final':s.final(466,52)
        bar=max(91,25+sum(len(wrapped(v,365,20,True)) for v in head)*27+18)
        s.line([(65,bar),(495,bar)]);s.labels(lines,85,bar+32,387)
    elif t=='initial':
        s.circle(70,142,12,BLACK);s.arrow([(83,142),(215,142)])
        s.box(218,87,296,112,right if right!='target' else head[-1],True)
        s.labels(lines,28,241,500)
    elif t=='transition':
        s.box(18,209,190,82,left,True);s.box(352,209,190,82,right,True)
        s.arrow([(208,250),(352,250)]);s.labels(head,25,34,510,20,True)
        s.text(280,94,label,18,width=500,center=True);s.labels(lines,25,120,510)
    elif t=='trigger':
        s.rect(35,30,490,220,rx=12);bottom=s.labels(head,55,67,450,20,True)
        bar=max(100,bottom+4);s.line([(35,bar),(525,bar)])
        bottom=s.text(55,bar+34,label,18,width=450)
        s.labels([value for value in lines if value!=label],55,bottom+5,450)
    elif t=='constraint':
        s.polygon([(35,25),(495,25),(525,55),(525,252),(35,252)])
        s.line([(495,25),(495,55),(525,55)])
        bottom=s.labels(head,55,61,423,20,True);s.labels(lines,55,max(105,bottom+4),442)
        if label:s.text(55,217,label,18,width=442)
    elif t=='deployment-target':
        s.rect(45,35,470,210);bottom=s.labels(head,65,73,430,20,True)
        bar=max(99,bottom+6);s.line([(45,bar),(515,bar)])
        s.labels(lines,65,bar+33,430)
    elif t=='deployment':
        s.box(29,42,215,91,left)
        s.box(325,42,205,91,right)
        s.arrow([(244,88),(325,88)],dash=True,open=True)
        s.text(280,188,label or '«deploy»',18,center=True)
        s.labels(head+lines,29,222,501)
    elif t=='case':
        context=next((value.removeprefix('of ') for value in lines if value.startswith('of ')),'root context')
        s.rect(25,26,510,229);s.text(44,59,'case context: '+context,20,True,width=472)
        s.rect(95,106,370,102,rx=50);s.text(280,164,label or head[0],20,True,width=332,center=True)
        s.labels([value for value in lines if not value.startswith('of ')],115,190,325)
    elif t=='lifeline':
        s.box(128,24,304,73,head[-1]);s.line([(280,98),(280,255)],dash=True)
        s.labels(lines,312,151,220)
    elif t=='message':
        header_count=sum(len(wrapped(value,500)) for value in head)
        label_y=112+header_count*25+8
        arrow_y=label_y+len(wrapped(label or head[-1],500))*25+12
        height=max(320,arrow_y+60+sum(len(wrapped(value,500)) for value in lines)*25)
        s.doc['height']=height;s.doc['shapes'][0]['height']=height
        s.box(28,26,206,65,left);s.box(326,26,206,65,right)
        s.line([(131,92),(131,height-20)],dash=True);s.line([(429,92),(429,height-20)],dash=True)
        pts=[(131,arrow_y),(429,arrow_y)];
        if d.get('direction')=='reverse':pts.reverse()
        s.arrow(pts,dash=d.get('dashed',False),open=d.get('dashed',False))
        y=112
        for value in head:y=s.text(280,y,value,18,width=500,center=True)
        s.text(280,label_y,label or head[-1],18,width=500,center=True);s.labels(lines,29,arrow_y+42,500)
    elif t=='browser':
        s.frame('Browser',head[-1]);rows=lines or ['package P','  component def C','  component demo: C','    component child: C']
        parents={}
        for i,row in enumerate(rows[:6]):
            depth=(len(row)-len(row.lstrip()))//2;y=90+i*34;x=44+depth*34
            if depth and depth-1 in parents:
                px,py=parents[depth-1];s.line([(px+7,py+8),(px+7,y-7),(x-7,y-7)])
            s.text(x,y,row.strip(),18,width=490-depth*34);parents[depth]=(x,y)
    elif t=='gv':
        s.frame('gv',head[-1]);s.rect(44,84,472,193);s.text(61,111,label or '«root component» '+head[-1].split(': ',1)[-1],18,True)
        s.component_icon(478,94);s.text(61,137,'profile: service (default)',18)
        if len(lines)==1:s.box(95,158,370,91,lines[0]);s.component_icon(429,167)
        elif len(lines)==2:s.box(66,147,185,91,lines[0]);s.box(306,147,185,91,lines[1])
        else:s.box(66,147,185,91,left);s.box(306,147,185,91,right)
    elif t=='iv':
        if len(lines)>1 and '→' in lines[1]:left,right=[part.strip() for part in lines[1].split('→',1)]
        s.frame('iv',head[-1]);s.box(39,122,173,118,left);s.box(348,122,173,118,right)
        s.port(212,179);s.port(348,179);s.arrow([(219,179),(341,179)])
        s.text(280,101,label or 'typed connector',18,width=480,center=True);s.labels(lines[:1],40,278,480)
    elif t=='cv':
        if len(lines)>1 and '→' in lines[1]:left,right=[part.strip() for part in lines[1].split('→',1)]
        s.frame('cv',head[-1]);s.rect(35,86,220,186);s.text(53,113,'context: '+head[-1].split(': ',1)[-1],18)
        s.rect(53,149,182,77,rx=38);s.text(144,191,left,18,width=163,center=True)
        s.box(353,142,178,100,right);s.arrow([(235,190),(352,190)],dash=True,open=True)
        s.text(280,76,label or 'satisfy',18,center=True)
    elif t=='sv':
        s.frame('sv',head[-1]);s.box(39,75,186,54,left);s.box(335,75,186,54,right)
        s.line([(132,130),(132,286)],dash=True);s.line([(428,130),(428,286)],dash=True)
        s.arrow([(132,181),(428,181)]);s.text(280,165,lines[0] if lines else 'request via port',18,width=505,center=True)
        s.arrow([(428,253),(132,253)],dash=True,open=True);s.text(280,235,lines[1] if len(lines)>1 else 'reply after request',18,width=505,center=True)
    elif t=='grv':
        s.frame('grv',head[-1]);columns=[31,208,377,529]
        for i in range(4):s.line([(columns[i],91),(columns[i],276)])
        for y in [91,134,181,228,276]:s.line([(31,y),(529,y)])
        for i,value in enumerate(['Element','Type','Concern']):s.text(columns[i]+10,119,value,18,True)
        rows=lines or ['c | Component | private data','fn | Function | behavior','p | Port | interface']
        for n,row in enumerate(rows[:3]):
            for i,value in enumerate(row.split('|')[:3]):s.text(columns[i]+8,165+n*47,value.strip(),18,width=columns[i+1]-columns[i]-16)
    elif t=='fv':
        s.frame('fv',head[-1]);s.circle(80,173,10,BLACK);s.arrow([(91,173),(143,173)])
        s.box(146,124,152,100,left if left!='source' else 'function',True)
        s.arrow([(298,173),(360,173)]);s.box(363,124,157,100,right if right!='target' else 'state',True)
        s.text(280,278,label or 'flow and states share fv',18,width=495,center=True)
    else: raise ValueError(f'Unknown notation template {t}: {concept["id"]}')
    return validate(s,concept)

def validate(s,concept):
    # A canonical figure never hides overflow outside its viewBox.
    for shape in s.doc['shapes']:
        if shape['kind']=='text':
            assert shape['x']>=0 and shape['y']-shape['size']>=0, (concept['id'],shape)
            assert shape['x']+font(shape['size'],shape['bold']).getlength(shape['text'])<=560.5, (concept['id'],shape)
            assert shape['y']+font(shape['size'],shape['bold']).getmetrics()[1]<=s.doc['height'], (concept['id'],shape)
        else:
            if shape['kind']=='rect':xs=[shape['x'],shape['x']+shape['width']];ys=[shape['y'],shape['y']+shape['height']]
            elif shape['kind']=='circle':xs=[shape['x']-shape['r'],shape['x']+shape['r']];ys=[shape['y']-shape['r'],shape['y']+shape['r']]
            else:xs,ys=zip(*shape['points'])
            assert min(xs)>=0 and max(xs)<=560 and min(ys)>=0 and max(ys)<=s.doc['height'],(concept['id'],shape)
    return s
