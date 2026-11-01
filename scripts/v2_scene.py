"""Original swa.ml 2.0 vector scenes; SVG and PNG share exact geometry."""
from pathlib import Path
from xml.sax.saxutils import escape
import json, textwrap, io, math
from PIL import Image, ImageDraw, ImageFont
ROOT=Path(__file__).resolve().parents[1]
FONT=ROOT/'resources/fonts/DejaVuSans.ttf'

def scene(title, template):
    s={'width':920,'height':390,'elements':[]}
    def rect(x,y,w,h,fill='#ffffff',dash=False): s['elements'].append({'kind':'rect','x':x,'y':y,'w':w,'h':h,'fill':fill,'dash':dash})
    def text(x,y,t,size=14): s['elements'].append({'kind':'text','x':x,'y':y,'text':t,'size':size})
    def line(x1,y1,x2,y2,label='',dash=False):
        s['elements'].append({'kind':'line','x1':x1,'y1':y1,'x2':x2,'y2':y2,'dash':dash})
        if label: text((x1+x2)/2-55,(y1+y2)/2-12,label,12)
    def box(x,y,w,h,title,rows=()):
        rect(x,y,w,h);rect(x,y,w,34,'#eeeeee');text(x+12,y+23,title,14)
        for i,row in enumerate(rows):text(x+12,y+58+i*22,row,12)
    def port(x,y):rect(x-5,y-5,10,10)
    def dot(x,y,r=5):s['elements'].append({'kind':'ellipse','x':x-r,'y':y-r,'w':2*r,'h':2*r,'fill':'#171717'})
    rect(1,1,918,388,'#fafafa');text(26,36,title,21);line(26,54,894,54)
    if template=='port':
        box(45,105,230,215,'owning component',['boundary: Boundary'])
        rect(245,185,60,60)
        # Direction applies to members, never a whole-port category.
        line(254,215,296,215);line(254,215,261,209);line(254,215,261,221)
        line(296,215,289,209);line(296,215,289,221)
        line(305,198,355,120);line(355,120,410,120);line(410,120,402,115);line(410,120,402,125)
        text(430,125,'provides attribute value: real',14)
        line(305,208,355,170);line(355,170,410,170);line(355,170,363,165);line(355,170,363,175)
        text(430,175,'requires event reset()',14)
        line(305,224,370,230)
        s['elements'].append({'kind':'ellipse','x':370,'y':218,'w':24,'h':24,'fill':'#ffffff'})
        text(430,235,'provides operation read() returns real',14)
        line(305,237,370,285)
        # Open socket faces outward; shared straight segments render everywhere.
        points=[(382+12*math.cos(math.radians(a)),285+12*math.sin(math.radians(a))) for a in range(60,301,12)]
        for (x1,y1),(x2,y2) in zip(points,points[1:]):line(round(x1,3),round(y1,3),round(x2,3),round(y2,3))
        text(430,290,'requires operation acknowledge()',14)
        text(45,355,'One square boundary; arrows for data/events, ball/socket for operation members.',14)
        text(45,377,'Labels retain member identity. Reversed flips each direction and swaps each operation glyph.',13)
    elif template in ('connection','architecture'):
        names=['Sensor','Controller','Heater'] if template=='architecture' else ['Provider','Consumer']
        for i,name in enumerate(names):
            x=45+i*(280 if len(names)==3 else 490);box(x,120,250,155,name,['port reading', 'provides attribute temperature: real'] if i==0 else ['reversed port reading','requires attribute temperature: real','port command','provides event set(value: real)'] if i==1 else ['reversed port command','requires event set(value: real)']);
            if i<len(names)-1:port(x+250,205);line(x+255,205,x+(280 if len(names)==3 else 490)-5,205);text(x+80,301,'owned typed boundary',12)
            if i>0:port(x,205)
        text(45,345,'Direction belongs to each member. A connection owns an independent policy queue.',13)
    elif template=='forwarding':
        rect(45,95,810,230);text(65,123,'Composite boundary',16);port(45,210);box(440,155,300,125,'child: Sensor',['port reading: Temperature','provides attribute temperature: real']);port(440,210);line(50,210,435,210,'forwarding',True);text(95,250,'same member directions; no queue or policy',13)
    elif template=='multiplicity':
        for i in range(3):box(45+i*285,120,250,145,f'counters[{i}]: Counter',['attribute count: int = 1','separate private store'])
        text(45,320,'One shared definition; three distinct occurrence identities and stores.',15)
    elif template=='component':
        box(50,120,330,170,'component def Counter',['attribute count: int = 0','operation increment()','schedule { on start increment(); }']);box(535,120,330,170,'component left: Counter',['redefines attribute count: int = 10','private occurrence store']);line(380,205,535,205,'typed by',True)
    elif template=='namespace':
        rect(60,98,795,240);box(85,130,330,150,'package Hello',['port def Messages','component def Sender / Receiver']);box(490,130,330,150,'component Demo',['component sender: Sender','component receiver: Receiver','connect (sender.output, receiver.input);'])
    elif template in ('value','attribute','expression'):
        box(60,115,360,185,'component Demo',['attribute sum: int = 0','attribute mode: Mode = Mode.idle','var values: int[3] = [1, 2, 3]']);box(500,115,350,185,'copied nominal values',['datatype Reading','value: real; unit: string;','enum Mode { idle, active }']);text(60,345,'Types are explicit. Copies never alias another component\u2019s state.',14)
    elif template=='operation':
        box(50,105,340,200,'operation boot()',['nested operation double(v: real)','returns real { return v * 2.0; }','no enclosing-local capture']);box(530,105,340,200,'operation clamp: Clamp',['signature inherited from def','optional whole-body replacement','result = clamp(double(4.0), 0.0, 5.0)']);line(390,205,530,205,'local call')
    elif template=='schedule':
        box(55,105,370,215,'schedule',['on start load();','after load report();','deadline belongs to entry']);box(515,105,350,215,'activation lifecycle',['release / dispatch / running','wait unlocks component','success / unlock / fresh after']);line(425,215,515,215)
    elif template=='timing':
        text(40,90,'Declared: every 5ms, deadline 3ms',14)
        for x,n in [(170,0),(320,5),(470,10),(620,15),(770,20)]:line(x,110,x,330);text(x-10,355,str(n)+'ms',12)
        text(40,160,'release',13);text(40,240,'observed',13)
        for x in [320,470,620]:line(x,125,x,180);rect(x,205,30,34,'#dddddd');rect(x+30,205,60,34,'#ffffff',True)
        text(300,287,'wait / unlock',12);text(590,315,'deadline contract',12)
    elif template=='state':
        dot(55,205);box(110,135,220,140,'state Off',['after 2ms to On']);box(400,135,230,140,'state On',['on entry: lit = true','on exit: lit = false']);dot(805,205,14);line(60,205,110,205);line(330,205,400,205);line(630,205,790,205,'after 3ms');text(670,305,'final state Done',14);text(80,345,'Nested transitions are tested in source order. Final entry completes the operation.',13)
    elif template=='deployment':
        box(40,110,300,195,'software Demo',['workers[0]','workers[1]','workers[2]']);box(540,110,335,195,'Vehicle: Platform',['front: Ecu','rear[0]: Ecu','rear[1]: Ecu']);line(340,205,540,205,'deploy on',True);text(45,348,'Node targets own only const attributes and child Nodes; placement is separate.',13)
    elif template=='loop':
        box(45,125,250,150,'while / until',['optional n times','limit evaluated once']);box(335,125,250,150,'counted for',['initializer / test','body / update']);box(625,125,250,150,'for in',['copied fixed array','fresh iteration scope']);text(45,330,'Reaching a loop limit exits normally. Runtime step/deadline limits remain explicit.',13)
    elif template in ('interrupt','receive'):
        rect(45,105,510,220,'#ffffff',True);box(80,145,410,135,'interruptible body' if template=='interrupt' else 'on receive wait',['suspended continuation','serial lock released']);box(635,145,245,135,'handler / branch',['explicit bindings','same activation']);line(490,210,635,210,'receive');text(65,352,'Inactive region input is discarded.' if template=='interrupt' else 'Early input remains queued; optional after timeout selects a branch.',14)
    elif template=='try':
        box(40,140,235,140,'try(api.get(1), -1.0)',['evaluate expression','retain committed effects']);box(360,90,230,105,'success',['return copied result']);box(360,235,230,105,'runtime failure',['evaluate lazy fallback']);line(275,185,360,145);line(275,230,360,275);text(640,180,'Interruption, deadline',13);text(640,205,'and resources bypass try.',13)
    elif template in ('call','flow'):
        box(40,140,235,130,'entry',['typed arguments']);box(345,140,235,130,'operation',['local expression call','or owned port request']);box(650,140,225,130,'return',['copied result / out','copy-back on success']);line(275,205,345,205);line(580,205,650,205)
    elif template=='requirement':
        box(45,110,330,190,'requirement Delivery',['immutable typed attributes','one formal doc']);box(535,110,330,190,'test Startup of Demo',['package member','verify Delivery by Startup']);line(375,205,535,205,'«verify» intent',True);text(45,345,'satisfy and verify are package links that record intent; a witness requires separate evidence.',14)
    elif template=='case':
        def ellipse(cx,cy,w,h,name):
            s['elements'].append({'kind':'ellipse','x':cx-w/2,'y':cy-h/2,'w':w,'h':h,'fill':'#ffffff'});text(cx-len(name)*3.6,cy+5,name,13)
        def actor(cx,name):
            s['elements'].append({'kind':'ellipse','x':cx-11,'y':118,'w':22,'h':22,'fill':'#ffffff'})
            line(cx,140,cx,182);line(cx-22,154,cx+22,154);line(cx,182,cx-18,214);line(cx,182,cx+18,214);text(cx-len(name)*3.6,236,name,13)
        rect(290,72,360,250);text(302,94,"atm : 'ATM Controller'",12)
        ellipse(470,122,250,40,"'Withdraw cash'");ellipse(470,172,200,40,'Authenticate');ellipse(470,222,200,40,"'Print receipt'");ellipse(470,276,250,44,"«test» 'Limit honoured'")
        actor(120,'customer : Customer');actor(800,'bank : Bank')
        line(144,160,345,122);line(144,166,370,172);line(144,172,370,222);line(144,180,345,276);line(776,160,595,122);line(776,172,595,276)
        text(45,350,'The subject occurrence of the package is the boundary; associated occurrences stay outside and take part through ports.',13)
        text(45,372,'Solid lines show associate links; a case with statements runs as a script, otherwise it records intent only.',13)
    elif template=='script':
        heads=[(150,'customer : Customer'),(460,'atm : ATM'),(770,'bank : BankPeer')]
        for x,name in heads:
            rect(x-95,72,190,34,'#eeeeee');text(x-len(name)*3.6,94,name,12);line(x,106,x,318,'',True)
        rect(454,150,12,118)
        def message(x1,x2,y,label,dash=False):
            back=-1 if x2>x1 else 1
            line(x1,y,x2,y,'',dash);line(x2,y,x2+8*back,y-5);line(x2,y,x2+8*back,y+5);text(min(x1,x2)+14,y-7,label,12)
        message(150,454,140,'send amount(100)');message(150,454,170,'publish cashRequested()')
        message(466,770,198,'authorize(100) — on call');message(770,466,228,'return false',True)
        message(454,150,258,'refused() — on receive')
        rect(118,282,64,22,'#ffffff');text(126,298,'assert',12);text(196,298,'atm.dispenser.count == 0',12)
        text(45,350,"Script statements start on the lifeline of the interface-only actor whose port they use.",13)
        text(45,372,'on call answers a request with return; on receive or after D waits; a test may also read its subject.',13)
    elif template=='view':
        for i,name in enumerate(['General','Interconnect','Case','Sequence','Grid','Flow','Timing']):box(38+(i%4)*220,95+(i//4)*130,200,105,name,['source-backed selection'])
        text(40,370,'Browser navigates ownership. Views never execute behavior.',13)
    elif template=='note':
        box(70,115,775,200,'/** One named routed message reaches the receiver. */',['Formal doc belongs to one declaration.','Ordinary comments remain lexical annotations.','Documentation does not create behavior or proof.'])
    else:
        box(70,115,775,200,'Canonical source spelling',['Names, paths, punctuation and units stay in source captions.','No independent semantic node is invented for a lexical token.'])
    return s

def artifacts(s):
    w,h=s['width'],s['height']; image=Image.new('RGB',(w*2,h*2),'white');d=ImageDraw.Draw(image);svg=[f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" role="img"><title>swa.ml 2.0 original notation</title>']
    def stroke(x1,y1,x2,y2,dashed=False):
        length=math.hypot(x2-x1,y2-y1)
        if not dashed or length==0:
            d.line((x1*2,y1*2,x2*2,y2*2),fill='#171717',width=2)
            return
        for start in range(0,math.ceil(length),9):
            end=min(start+5,length)
            d.line(((x1+(x2-x1)*start/length)*2,(y1+(y2-y1)*start/length)*2,(x1+(x2-x1)*end/length)*2,(y1+(y2-y1)*end/length)*2),fill='#171717',width=2)
    for e in s['elements']:
        k=e['kind']; dash=' stroke-dasharray="5 4"' if e.get('dash') else ''
        if k=='text':
            x,y,t,z=e['x'],e['y'],e['text'],e['size'];font=ImageFont.truetype(str(FONT),z*2,layout_engine=ImageFont.Layout.BASIC)
            if x<0 or y<z or d.textlength(t,font=font)>2*(w-x-10): raise ValueError('Text outside scene: '+t)
            d.text((x*2,y*2),t,font=font,fill='#171717',anchor='ls');svg.append(f'<text x="{x}" y="{y}" font-family="DejaVu Sans, sans-serif" font-size="{z}" fill="#171717">{escape(t)}</text>')
        elif k in ('rect','ellipse'):
            x,y,ew,eh=e['x'],e['y'],e['w'],e['h'];fill=e.get('fill','#ffffff');bbox=(x*2,y*2,(x+ew)*2,(y+eh)*2)
            if k=='rect':
                d.rectangle(bbox,fill=fill)
                for x1,y1,x2,y2 in [(x,y,x+ew,y),(x+ew,y,x+ew,y+eh),(x+ew,y+eh,x,y+eh),(x,y+eh,x,y)]:stroke(x1,y1,x2,y2,e.get('dash',False))
                svg.append(f'<rect x="{x}" y="{y}" width="{ew}" height="{eh}" fill="{fill}" stroke="#171717"{dash}/>')
            else:d.ellipse(bbox,fill=fill,outline='#171717',width=2);svg.append(f'<ellipse cx="{x+ew/2}" cy="{y+eh/2}" rx="{ew/2}" ry="{eh/2}" fill="{fill}" stroke="#171717"/>')
        elif k=='line':
            x1,y1,x2,y2=[e[p] for p in ['x1','y1','x2','y2']];stroke(x1,y1,x2,y2,e.get('dash',False));svg.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="#171717"{dash}/>')
    svg.append('</svg>');buf=io.BytesIO();image.save(buf,format='PNG',compress_level=9)
    return ('\n'.join(svg)+'\n').encode(),buf.getvalue()

def write_scene(path,s,check=False):
    svg,png=artifacts(s); outputs={path.with_suffix('.svg'):svg,path.with_suffix('.png'):png,path.with_suffix('.scene.json'):(json.dumps(s,indent=2,ensure_ascii=False)+'\n').encode()}
    for p,b in outputs.items():
        if check:
            # PNG compression may differ with the platform's zlib. Pixel content,
            # dimensions and exact SVG/scene bytes define reproducibility.
            same=p.exists() and p.read_bytes()==b
            if not same and p.exists() and p.suffix=='.png':
                with Image.open(p) as existing, Image.open(io.BytesIO(b)) as generated:
                    same=existing.size==generated.size and existing.convert('RGB').tobytes()==generated.convert('RGB').tobytes()
            if not same:raise RuntimeError('Stale generated figure: '+str(p.relative_to(ROOT)))
        else:p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b)
