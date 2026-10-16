"""Render the shared SVG scene vocabulary as PDF vectors, preserving baseline geometry."""
import json, math
from pathlib import Path
from reportlab.lib.colors import toColor
from reportlab.platypus import Flowable
class VectorScene(Flowable):
    def __init__(self, path, width):
        super().__init__()
        self.scene=json.loads(Path(path).read_text(encoding='utf-8')); self.width=width
        self.scale=width/self.scene['width'];self.height=self.scene['height']*self.scale
    def draw(self):
        c=self.canv;c.saveState();c.scale(self.scale,self.scale);h=self.scene['height']
        for s in self.scene['shapes']:
            kind=s['kind'];c.setLineWidth(1.5);c.setDash()
            if kind=='text':
                c.setFont('BodyB' if s['bold'] else 'Body',s['size']);c.setFillColor(toColor(s['color']));c.drawString(s['x'],h-s['y'],s['text'])
            elif kind=='line':
                c.setStrokeColor(toColor(s['color']));c.setLineWidth(2)
                if s['dash']:c.setDash(7,5)
                points=s['points'];p=c.beginPath();p.moveTo(points[0][0],h-points[0][1])
                for x,y in points[1:]:p.lineTo(x,h-y)
                c.drawPath(p)
                if s['arrow']:
                    x,y=points[-1];px,py=points[-2];angle=math.atan2(y-py,x-px)
                    p=c.beginPath();p.moveTo(x,h-y)
                    for side in (-1,1):
                        bx=x-14*math.cos(angle)+side*6*math.sin(angle);by=y-14*math.sin(angle)-side*6*math.cos(angle)
                        p.lineTo(bx,h-by)
                    p.close();c.setFillColor(toColor('#17324d'));c.drawPath(p,fill=1,stroke=0)
            else:
                fill=s['fill']!='none';stroke=s['stroke']!='none'
                if fill:c.setFillColor(toColor(s['fill']))
                if stroke:c.setStrokeColor(toColor(s['stroke']))
                if kind=='rect':c.roundRect(s['x'],h-s['y']-s['height'],s['width'],s['height'],s['rx'],fill=fill,stroke=stroke)
                elif kind=='circle':c.circle(s['x'],h-s['y'],s['r'],fill=fill,stroke=stroke)
                elif kind=='polygon':
                    p=c.beginPath();p.moveTo(s['points'][0][0],h-s['points'][0][1])
                    for x,y in s['points'][1:]:p.lineTo(x,h-y)
                    p.close();c.drawPath(p,fill=fill,stroke=stroke)
        c.restoreState()
