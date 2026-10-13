#!/usr/bin/env python3
"""Build the complete, navigable SWAML book from the versioned repository sources."""
from __future__ import annotations
import argparse
import hashlib
import html
import json
import os
from pathlib import Path
import re
import textwrap
import importlib.util
from urllib.parse import quote, urlparse

import mistune
from pypdf import PdfReader, PdfWriter
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate, CondPageBreak, Flowable, Frame, PageBreak, PageTemplate,
    Paragraph, Spacer, Table, TableStyle, KeepTogether,
)
from reportlab.platypus.tableofcontents import TableOfContents

ROOT = Path(__file__).resolve().parents[1]
NAVY = colors.HexColor('#102A43')
TEAL = colors.HexColor('#087F8C')
INK = colors.HexColor('#243746')
MUTED = colors.HexColor('#526777')
PALE = colors.HexColor('#F1F5F8')
LINE = colors.HexColor('#CBD5DF')
PAGE_W, PAGE_H = A4
MARGIN = 44
WIDTH = PAGE_W - 2 * MARGIN
RELEASE = '1.0.0'
REVISION = '1.0.0'
REPO = f'https://github.com/voidaliot/swaml/blob/v{RELEASE}/'
NORMATIVE = ['docs/LANGUAGE_SPECIFICATION.md'] + [f'docs/spec/{name}' for name in [
    '01-structure-and-types.md', '02-communication.md', '03-behavior.md',
    '04-systems-and-conformance.md', '05-kerml-mapping.md', '06-execution-contract.md',
    '07-normalized-model.md', '08-conformance-obligations.md', '09-formal-semantics.md',
]] + ['docs/GRAPHICAL_NOTATION.md']
GUIDANCE = ['docs/CONCERN_GUIDE.md', 'docs/KEYWORD_REFERENCE.md', 'docs/GRAPHICAL_EXAMPLES.md', 'docs/SIMULATION.md', 'docs/MIGRATION_1_0.md', 'docs/USER_GUIDE.md', 'docs/ARCHITECTURE_COMPARISON.md', 'docs/TOOLING.md',
            'docs/IMPLEMENTATION_STATUS.md', 'docs/RELEASE_1_0.md',
            'docs/decisions/0001-language-boundaries.md', 'docs/decisions/0002-auditable-semantics.md', 'docs/decisions/0003-reference-execution-and-publication.md',
            'docs/PDF_PUBLICATION.md', 'CONTRIBUTING.md', 'AGENTS.md']
EXAMPLES = sorted(p.relative_to(ROOT).as_posix() for p in (ROOT / 'examples').glob('*.swaml'))
ATTACHMENTS = ['docs/SWAML-1.0.0-Reference.md', 'spec/keywords.json', 'spec/graphical-examples.json'] + sorted(p.relative_to(ROOT).as_posix() for p in (ROOT/'docs/figures').glob('*')) + sorted(p.relative_to(ROOT).as_posix() for p in (ROOT/'examples/simulation').glob('*.json'))
SOURCES = NORMATIVE + GUIDANCE + ['src/language/swaml.langium', 'spec/kerml-mapping.json'] + EXAMPLES + ['LICENSE'] + ATTACHMENTS
ANCHORS = {p: 'file_' + hashlib.sha256(p.encode()).hexdigest()[:16] for p in SOURCES}
STYLES: dict[str, ParagraphStyle] = {}
EXTERNAL: dict[str, str] = {}
MODULE = importlib.util.spec_from_file_location('pdf_scene', ROOT/'scripts/pdf-scene.py')
SCENE = importlib.util.module_from_spec(MODULE)
MODULE.loader.exec_module(SCENE)
SECTION_ANCHORS = {}
def plain_heading(nodes):
    return ''.join(n.get('raw', '') if 'raw' in n else plain_heading(n.get('children', [])) for n in nodes)
for source in NORMATIVE + GUIDANCE:
    count=0
    for node in mistune.create_markdown(renderer='ast', plugins=['table'])((ROOT/source).read_text()):
        if node['type'] != 'heading': continue
        count+=1
        slug=re.sub(r'[^\w\s-]', '', plain_heading(node['children']).lower()).replace(' ', '-')
        SECTION_ANCHORS[(source,slug)] = ANCHORS[source] if count==1 else ANCHORS[source]+f'_h{count}'


def normalize(text: str) -> str:
    # Portable publication punctuation; semantic arrows and mathematical symbols remain.
    return text.translate(str.maketrans({'\u2011': '-', '\u2013': '-', '\u2014': ' - ', '\u2212': '-'}))


def fonts(directory: Path) -> None:
    for name, file in [('Body', 'DejaVuSans.ttf'), ('BodyB', 'DejaVuSans-Bold.ttf'),
                       ('BodyI', 'DejaVuSans-Oblique.ttf'), ('BodyBI', 'DejaVuSans-BoldOblique.ttf'),
                       ('Mono', 'DejaVuSansMono.ttf')]:
        pdfmetrics.registerFont(TTFont(name, str(directory / file)))
    pdfmetrics.registerFontFamily('Body', normal='Body', bold='BodyB', italic='BodyI', boldItalic='BodyBI')
    base = dict(fontName='Body', textColor=INK, fontSize=9.3, leading=14.2, spaceAfter=7, allowWidows=0, allowOrphans=0)
    STYLES['body'] = ParagraphStyle('body', **base)
    STYLES['h1'] = ParagraphStyle('h1', fontName='BodyB', fontSize=23, leading=28, textColor=NAVY, spaceAfter=18, keepWithNext=True)
    STYLES['h2'] = ParagraphStyle('h2', fontName='BodyB', fontSize=13, leading=17, textColor=NAVY, spaceBefore=15, spaceAfter=8, keepWithNext=True)
    STYLES['h3'] = ParagraphStyle('h3', fontName='BodyB', fontSize=10.5, leading=15, textColor=TEAL, spaceBefore=10, spaceAfter=6, keepWithNext=True)
    STYLES['label'] = ParagraphStyle('label', fontName='BodyB', fontSize=8, leading=12, textColor=TEAL, spaceAfter=9, keepWithNext=True)
    STYLES['small'] = ParagraphStyle('small', fontName='Body', fontSize=8, leading=11.5, textColor=MUTED, spaceAfter=7)
    STYLES['cell'] = ParagraphStyle('cell', fontName='Body', fontSize=7.5, leading=10.5, textColor=INK, spaceAfter=0)
    STYLES['headcell'] = ParagraphStyle('headcell', parent=STYLES['cell'], fontName='BodyB', textColor=colors.white)
    STYLES['list'] = ParagraphStyle('list', parent=STYLES['body'], leftIndent=14, firstLineIndent=0, bulletIndent=0, bulletFontName='Body', bulletFontSize=9.3, spaceAfter=5)
    STYLES['toc0'] = ParagraphStyle('toc0', fontName='BodyB', fontSize=9.1, leading=13, leftIndent=0, firstLineIndent=0, spaceBefore=6, textColor=NAVY)
    STYLES['toc1'] = ParagraphStyle('toc1', fontName='Body', fontSize=8.3, leading=10.7, leftIndent=13, firstLineIndent=0, spaceBefore=0, textColor=INK)


def esc(text: str) -> str:
    return html.escape(normalize(text), quote=True)


def inline(nodes: list[dict], source: str) -> str:
    out = ''
    for node in nodes:
        kind = node['type']
        children = node.get('children', [])
        if kind == 'text': out += esc(node['raw'])
        elif kind == 'codespan': out += '<font name="Mono" size="8">' + esc(node['raw']) + '</font>'
        elif kind == 'strong': out += '<b>' + inline(children, source) + '</b>'
        elif kind == 'emphasis': out += '<i>' + inline(children, source) + '</i>'
        elif kind in ('softbreak', 'linebreak'): out += ' ' if kind == 'softbreak' else '<br/>'
        elif kind == 'link':
            href = node['attrs']['url']
            label = inline(children, source)
            if href.startswith(('https://', 'http://')):
                EXTERNAL.setdefault(href, re.sub('<[^>]+>', '', label))
                target = href
            else:
                file, _, fragment = href.partition('#')
                local = (ROOT / Path(source).parent / file).resolve() if file else ROOT/source
                rel = local.relative_to(ROOT).as_posix()
                target = '#' + SECTION_ANCHORS.get((rel,fragment), ANCHORS[rel]) if rel in ANCHORS and rel not in ATTACHMENTS else REPO + quote(rel) + ('#'+fragment if fragment else '')
            out += f'<a href="{html.escape(target, quote=True)}" color="#087F8C">{label}</a>'
        else:
            raise ValueError(f'Unsupported inline token {kind} in {source}')
    return out


def heading(text: str, level: int, anchor: str) -> Paragraph:
    p = Paragraph(esc(text), STYLES[f'h{min(level, 3)}'])
    p.bookmark_key = anchor
    p.heading_level = level - 1
    p.heading_text = normalize(text)
    return p


class Code(Flowable):
    """Splittable numbered code; physical line wraps preserve every source character."""
    def __init__(self, text: str = '', label: str = 'SOURCE', rows=None, continued=False):
        super().__init__()
        self.label, self.continued = label, continued
        self.rows = rows
        self.text = normalize(text).expandtabs(4)
        self.size, self.leading = 7.25, 10.6
        self.spaceBefore, self.spaceAfter = 6, 11

    def wrap(self, availWidth, availHeight):
        self.width = availWidth
        if self.rows is None:
            chars = int((availWidth - 51) / pdfmetrics.stringWidth('M', 'Mono', self.size))
            self.rows = []
            for number, line in enumerate(self.text.splitlines(), 1):
                chunks = textwrap.wrap(line, width=chars, replace_whitespace=False, drop_whitespace=False,
                                       break_long_words=True, break_on_hyphens=False) or ['']
                self.rows.extend((str(number) if i == 0 else '', part) for i, part in enumerate(chunks))
        self.height = 31 + self.leading * len(self.rows)
        return self.width, self.height

    def split(self, availWidth, availHeight):
        self.wrap(availWidth, availHeight)
        count = int((availHeight - 31) / self.leading)
        if count < 3: return []
        return [Code(label=self.label, rows=self.rows[:count], continued=self.continued),
                Code(label=self.label, rows=self.rows[count:], continued=True)]

    def draw(self):
        c = self.canv
        c.setFillColor(PALE); c.roundRect(0, 0, self.width, self.height, 4, fill=1, stroke=0)
        c.setFillColor(TEAL); c.rect(0, self.height - 3, self.width, 3, fill=1, stroke=0)
        c.setFont('BodyB', 6.5); c.setFillColor(MUTED)
        c.drawString(10, self.height - 15, self.label + (' / CONTINUED' if self.continued else ''))
        y = self.height - 30
        for number, text in self.rows:
            c.setFont('Mono', 6.3); c.setFillColor(MUTED); c.drawRightString(29, y, number)
            c.setFont('Mono', self.size); c.setFillColor(NAVY); c.drawString(38, y, text)
            y -= self.leading


class Diagram(Flowable):
    """Vector illustrations for the three Mermaid figures in the notation source."""
    def __init__(self, kind: str):
        super().__init__(); self.kind = kind; self.width = WIDTH; self.height = 176 if kind == 'service' else 115
        self.spaceBefore, self.spaceAfter = 8, 14

    def draw(self):
        c = self.canv
        def box(x, y, w, h, title, sub='', fill=PALE):
            c.setStrokeColor(LINE); c.setFillColor(fill); c.roundRect(x, y, w, h, 5, fill=1, stroke=1)
            c.setFillColor(NAVY); c.setFont('BodyB', 9); c.drawCentredString(x+w/2, y+h/2+(4 if sub else -3), title)
            if sub:
                c.setFont('Body', 7.5); c.setFillColor(MUTED); c.drawCentredString(x+w/2, y+h/2-9, sub)
        def arrow(x1,y1,x2,y2,label=''):
            c.setStrokeColor(TEAL); c.setLineWidth(1.3); c.line(x1,y1,x2,y2)
            import math
            a=math.atan2(y2-y1,x2-x1)
            p=c.beginPath(); p.moveTo(x2,y2)
            p.lineTo(x2-6*math.cos(a-.45),y2-6*math.sin(a-.45)); p.moveTo(x2,y2)
            p.lineTo(x2-6*math.cos(a+.45),y2-6*math.sin(a+.45)); c.drawPath(p)
            if label:
                c.setFillColor(MUTED);c.setFont('Body',7);c.drawCentredString((x1+x2)/2,(y1+y2)/2+7,label)
        if self.kind=='service':
            box(4,70,123,50,'Web', 'orders : Orders / requires')
            box(230,8,270,158,'',fill=colors.white)
            c.setFillColor(NAVY);c.setFont('BodyB',10);c.drawString(242,147,'Backend / component')
            box(252,86,222,42,'api : Orders', 'provides / component boundary')
            box(278,19,178,45,'serviceUnit', 'api / on call api.submit')
            arrow(127,95,252,107,'Orders @ 1.0.0')
            arrow(360,86,360,64,'delegate')
        elif self.kind=='flow':
            box(0,44,70,38,'Start');box(103,44,167,38,'Request orders.submit','timeout 2 s')
            box(324,67,174,36,'Assert accepted');box(324,5,174,36,'Fail unavailable')
            arrow(70,63,103,63);arrow(270,66,324,85,'success');arrow(270,55,324,23,'failure')
        else:
            box(8,46,102,43,'Idle');box(199,46,108,43,'Running');box(400,46,100,43,'Stopped','final')
            arrow(110,68,199,68,'commands.begin');arrow(307,68,400,68,'commands.stop')
            c.setStrokeColor(TEAL); c.line(253,46,253,18);c.line(253,18,450,18);arrow(450,18,450,46)
            c.setFont('Body',7.5);c.setFillColor(MUTED);c.drawCentredString(351,24,'after 30 s')


class Cover(Flowable):
    def __init__(self): super().__init__(); self.width=WIDTH; self.height=675
    def draw(self):
        c=self.canv
        c.setFillColor(TEAL);c.rect(0,628,62,5,fill=1,stroke=0)
        c.setFillColor(MUTED);c.setFont('BodyB',10);c.drawString(0,601,'SOFTWARE ARCHITECTURE MODELING LANGUAGE')
        c.setFillColor(NAVY);c.setFont('BodyB',60);c.drawString(-2,518,'SWAML')
        c.setFont('Body',24);c.drawString(0,478,'Complete language specification')
        c.setFont('Body',12);c.setFillColor(TEAL);c.drawString(0,444,'Specification 1.0.0  /  Language 1.0  /  Reference simulation 1.0')
        c.setStrokeColor(LINE);c.line(0,412,WIDTH,412)
        labels=[('COMPONENT','Composition and boundary ports'),('UNIT','Private data, functions and operations'),('OPERATION','Structured flow or owned states')]
        for i,(title,sub) in enumerate(labels):
            x=16+i*24;y=330-i*76;w=WIDTH-32-i*48
            c.setFillColor(PALE);c.setStrokeColor(LINE);c.roundRect(x,y,w,58,5,fill=1,stroke=1)
            c.setFillColor(TEAL);c.rect(x-4,y+22,8,12,fill=1,stroke=0)
            c.setFillColor(NAVY);c.setFont('BodyB',11);c.drawString(x+18,y+34,title)
            c.setFont('Body',9);c.setFillColor(MUTED);c.drawString(x+18,y+17,sub)
        c.setFont('Body',10);c.setFillColor(INK)
        c.drawString(0,130,'Typed interfaces at every software boundary.')
        c.drawString(0,111,'Embedded realtime systems, services and event-driven architectures.')
        c.setFont('Body',9);c.setFillColor(MUTED)
        c.drawString(0,59,'14 October 2026  /  Catalin Ilie and SWAML contributors')
        c.drawString(0,39,'Independent language design on a proposed KerML semantic foundation.')
        c.linkURL('https://github.com/voidaliot/swaml',(0,12,300,27),relative=1)
        c.setFillColor(TEAL);c.drawString(0,17,'github.com/voidaliot/swaml')


class Book(BaseDocTemplate):
    def __init__(self, filename: str):
        super().__init__(filename,pagesize=A4,leftMargin=MARGIN,rightMargin=MARGIN,topMargin=48,bottomMargin=44,
                         title='SWAML Complete Language Specification - Version 1.0.0',author='Catalin Ilie and SWAML contributors',
                         subject='Software architecture modeling on KerML: normative specification, grammar and examples',
                         pageCompression=1)
        self.addPageTemplates(PageTemplate(id='book',frames=[Frame(MARGIN,44,WIDTH,PAGE_H-92,leftPadding=0,rightPadding=0,topPadding=0,bottomPadding=0)],onPageEnd=self.decorate))
        self.section=''
    def beforeDocument(self): self.section=''
    def afterFlowable(self, item):
        if hasattr(item, 'running_title'): self.section = item.running_title
        if hasattr(item,'bookmark_key'):
            self.canv.bookmarkPage(item.bookmark_key)
            if item.heading_level <= 1:
                self.canv.addOutlineEntry(item.heading_text,item.bookmark_key,item.heading_level,closed=item.heading_level==0)
                self.notify('TOCEntry',(item.heading_level,esc(item.heading_text),self.page,item.bookmark_key))
            if item.heading_level==0: self.section=item.heading_text
    def decorate(self, c, doc):
        if self.page==1: return
        c.saveState();c.setStrokeColor(LINE);c.setLineWidth(.5)
        c.line(MARGIN,PAGE_H-30,PAGE_W-MARGIN,PAGE_H-30)
        c.setFont('BodyB',7);c.setFillColor(TEAL);c.drawString(MARGIN,PAGE_H-22,'SWAML 1.0 / SPECIFICATION 1.0.0')
        c.setFont('Body',7);c.setFillColor(MUTED)
        title=self.section if len(self.section)<68 else self.section[:65]+'...'
        c.drawRightString(PAGE_W-MARGIN,PAGE_H-22,title)
        c.line(MARGIN,31,PAGE_W-MARGIN,31)
        c.drawString(MARGIN,19,'Specification revision 1.0.0  |  github.com/voidaliot/swaml')
        c.drawRightString(PAGE_W-MARGIN,19,str(self.page));c.restoreState()


def table(rows: list[list[str]], widths=None):
    if widths is None:
        n=len(rows[0]); widths=[WIDTH/n]*n
        if n==2: widths=[WIDTH*.29,WIDTH*.71]
        elif n==3: widths=[WIDTH*.22,WIDTH*.30,WIDTH*.48]
    converted=[[Paragraph(cell,STYLES['headcell' if i==0 else 'cell']) for cell in row] for i,row in enumerate(rows)]
    t=Table(converted,colWidths=widths,repeatRows=1,hAlign='LEFT',splitByRow=1)
    t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),NAVY),('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,PALE]),
                          ('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),7),('RIGHTPADDING',(0,0),(-1,-1),7),
                          ('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7),
                          ('LINEBELOW',(0,0),(-1,0),.5,NAVY),('LINEBELOW',(0,1),(-1,-1),.35,LINE)]))
    t.spaceBefore=5;t.spaceAfter=12
    return t


def markdown(source: str, status: str):
    ast=mistune.create_markdown(renderer='ast',plugins=['table'])((ROOT/source).read_text())
    result=[PageBreak(),Paragraph(status,STYLES['label'])]
    counter=0; figures=0
    def blocks(nodes,indent=0):
        nonlocal counter, figures
        output=[]
        for n in nodes:
            kind=n['type'];children=n.get('children',[])
            if kind=='blank_line': continue
            if kind=='heading':
                counter+=1;level=n['attrs']['level'];text=re.sub('<[^>]+>','',inline(children,source))
                # Decode inline entities before escaping the plain heading once.
                text=html.unescape(text)
                output.append(heading(text,level,ANCHORS[source] if counter==1 else ANCHORS[source]+f'_h{counter}'))
            elif kind in ('paragraph','block_text'):
                if len(children)==1 and children[0]['type']=='image':
                    image=children[0]; path=(ROOT/Path(source).parent/image['attrs']['url']).with_suffix('.scene.json')
                    output.append(SCENE.VectorScene(path, WIDTH))
                    output.append(Paragraph(esc(plain_heading(image.get('children',[]))),STYLES['small']))
                else: output.append(Paragraph(inline(children,source),STYLES['body']))
            elif kind=='block_code':
                lang=n.get('attrs',{}).get('info','')
                if lang=='mermaid':
                    figures+=1;output.append(Diagram(['service','flow','state'][figures-1]))
                    output.append(Paragraph(f'Figure {figures}. '+['Delegated service contract and direct operation ownership.','Request flow with explicit success and failure continuations.','State behavior owned by one operation.'][figures-1],STYLES['small']))
                else: output.append(Code(n['raw'],label=lang.upper() or 'SOURCE'))
            elif kind=='list':
                ordered=n.get('attrs',{}).get('ordered',False)
                for number,item in enumerate(children,n.get('attrs',{}).get('start',1)):
                    parts=item.get('children',[])
                    for j,child in enumerate(parts):
                        if child['type'] in ('block_text','paragraph'):
                            bullet=f'{number}.' if ordered else '•'
                            output.append(Paragraph(inline(child['children'],source),STYLES['list'],bulletText=bullet if j==0 else None))
                        else: output.extend(blocks([child],indent+1))
            elif kind=='table':
                head=children[0]['children'];body=children[1]['children'] if len(children)>1 else []
                rows=[[inline(cell['children'],source) for cell in head]]
                rows.extend([[inline(cell['children'],source) for cell in row['children']] for row in body])
                output.append(table(rows))
            elif kind=='thematic_break': output.append(Spacer(1,10))
            else: raise ValueError(f'Unsupported block token {kind} in {source}')
        return output
    rendered = blocks(ast)
    if source == 'docs/KEYWORD_REFERENCE.md':
        grouped=[]; i=0
        while i < len(rendered):
            item=rendered[i]
            if getattr(item, 'heading_text', '').startswith('Keyword: '):
                group=[item];i+=1
                while i < len(rendered) and not hasattr(rendered[i], 'heading_level'):
                    group.append(rendered[i]);i+=1
                grouped.append(KeepTogether(group))
            else: grouped.append(item);i+=1
        rendered=grouped
    for i, item in enumerate(rendered):
        if hasattr(item, 'heading_level') and i + 1 < len(rendered) and isinstance(rendered[i + 1], Table):
            # Keep the heading with several rows, not with an entire multipage table.
            item.keepWithNext = False
            result.append(CondPageBreak(130))
        result.append(item)
    return result


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--output',type=Path,default=ROOT/'output/pdf/SWAML-1.0.0-Specification.pdf')
    parser.add_argument('--font-dir',type=Path,default=os.environ.get('SWAML_PDF_FONT_DIR','/usr/share/fonts/truetype/dejavu'))
    args=parser.parse_args();fonts(args.font_dir);args.output.parent.mkdir(parents=True,exist_ok=True)
    story=[Cover(),PageBreak(),heading('About this edition',1,'edition')]
    story.extend([Paragraph('VERSION 1.0.0 / COMPLETE LANGUAGE REFERENCE',STYLES['label']),
        Paragraph('This book contains the complete SWAML 1.0 language specification, a concern guide and all 129 keywords in alphabetical order, formal execution rules, rendered notation examples, a reference simulation binding, the complete grammar and runnable model examples. The specification and package revision is 1.0.0; source models use <font name="Mono">swaml "1.0";</font>.',STYLES['body']),
        Paragraph('Normative chapters define syntax, validity, interface isolation, operation/state behavior and mapping obligations. Tutorials and figures illustrate these rules. This independently authored language is not an OMG UML release or an AUTOSAR implementation. KerML export remains a proposed semantic mapping contract.',STYLES['body']),
        Paragraph('A working Langium parser/validator and deterministic logical-time simulator provide executable evidence. Physical timing proof, a kernel exporter, production runtime and graphical editor require separate implementations. VS Code extension development is outside this repository.',STYLES['body']),
        table([['Navigation','How to use this PDF'],['Contents and bookmarks','Select a contents entry or use the PDF outline to open a chapter or section.'],['Cross-references','Links to included documents jump inside this book. Other repository links target version v1.0.0.'],['Code and tables','Code is selectable, numbered and wrapped without omitting source text. Tables repeat their headers across pages.'],['Source record','The build manifest lists every included source and its SHA-256 digest. Original source files are embedded as PDF attachments. The release includes a PDF checksum.']]),
        Paragraph('Original text and code: MIT license, copyright 2026 Catalin Ilie. Referenced standards retain their own terms; no standards PDFs are redistributed. Full license text appears at the end.',STYLES['small']),
        PageBreak()])
    toc_title=Paragraph('Contents',STYLES['h1']);toc_title.running_title='Contents';story.append(toc_title)
    toc=TableOfContents();toc.levelStyles=[STYLES['toc0'],STYLES['toc1']];story.append(toc)
    for source in ['docs/CONCERN_GUIDE.md','docs/KEYWORD_REFERENCE.md']: story.extend(markdown(source,'USER REFERENCE / CONCERN AND KEYWORD NAVIGATION'))
    for source in NORMATIVE: story.extend(markdown(source,'NORMATIVE / LANGUAGE CONTRACT'))
    grammar='src/language/swaml.langium'
    story.extend([PageBreak(),Paragraph('NORMATIVE APPENDIX',STYLES['label']),heading('A. Complete concrete grammar',1,ANCHORS[grammar]),
                  Paragraph('Authoritative Langium grammar, reproduced in full. Line wraps are typographic continuations; only numbered rows begin original source lines.',STYLES['body']),Code((ROOT/grammar).read_text(),'LANGIUM GRAMMAR')])
    inventory='spec/kerml-mapping.json'
    story.extend([PageBreak(),Paragraph('NORMATIVE DESIGN INVENTORY',STYLES['label']),heading('B. Grammar-to-semantics inventory',1,ANCHORS[inventory]),
                  Paragraph('Every grammar rule/type name is represented. Proposed kernel bases identify the design target; they do not constitute an implemented or validated exporter. Empty bases indicate syntax normalized through its owner.',STYLES['body'])])
    entries=json.loads((ROOT/inventory).read_text())['mapping']
    rows=[['Rule / kind','Proposed kernel base','Meaning to preserve']]
    rows.extend([[f'<b>{esc(e["source"])}</b><br/>{esc(e["kind"])}',esc(', '.join(e['kernel']) or 'Owner representation'),esc(e['semantic'])] for e in entries])
    story.append(table(rows))
    story.extend([PageBreak(),Paragraph('INFORMATIVE / COMPLETE MODELS',STYLES['label']),heading('C. Model examples',1,'examples')])
    for i,source in enumerate(EXAMPLES):
        if i: story.append(PageBreak())
        title=Path(source).stem.replace('-', ' ')
        story.extend([heading(title,2,ANCHORS[source]),Code((ROOT/source).read_text(),'SWAML / '+Path(source).name)])
    for source in GUIDANCE:
        if source not in ['docs/CONCERN_GUIDE.md','docs/KEYWORD_REFERENCE.md']: story.extend(markdown(source,'INFORMATIVE / GUIDANCE AND PROJECT STATUS'))
    story.extend([PageBreak(),heading('D. External references',1,'references'),Paragraph('Primary-source and project links cited in the included text. The comparisons identify their research baseline; this list does not imply conformance to any external standard.',STYLES['body'])])
    for number,(url,label) in enumerate(EXTERNAL.items(),1):
        story.append(Paragraph(f'<b>{number}. {esc(html.unescape(label))}</b><br/><a href="{esc(url)}" color="#087F8C">{esc(url)}</a>',STYLES['small']))
    story.extend([PageBreak(),heading('E. License',1,ANCHORS['LICENSE'])])
    for p in (ROOT/'LICENSE').read_text().split('\n\n'): story.append(Paragraph(esc(p.replace('\n',' ')),STYLES['body']))
    book=Book(str(args.output));book.multiBuild(story)
    # Preserve the vector book, outlines and links while embedding exact source bytes.
    reader=PdfReader(args.output)
    writer=PdfWriter();writer.clone_document_from_reader(reader)
    for source in SOURCES:
        writer.add_attachment(source.replace('/', '__'), (ROOT/source).read_bytes())
    with args.output.open('wb') as stream: writer.write(stream)
    manifest={'release':RELEASE,'languageVersion':'1.0','specificationRevision':REVISION,'pages':book.page,'pdf':args.output.name,
              'sources':[{'path':p,'attachmentName':p.replace('/', '__'),'sha256':hashlib.sha256((ROOT/p).read_bytes()).hexdigest()} for p in SOURCES],
              'pdfSha256':hashlib.sha256(args.output.read_bytes()).hexdigest()}
    args.output.with_suffix('.manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    args.output.with_suffix('.sha256').write_text(manifest['pdfSha256']+'  '+args.output.name+'\n')
    print(f'Built {args.output}: {book.page} pages, {len(SOURCES)} complete source files')

if __name__=='__main__': main()
