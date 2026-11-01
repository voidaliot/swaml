#!/usr/bin/env python3
"""Build the complete, navigable swa.ml 2.1 book from the current repository sources.

The 2.0 builder and its frozen publication stay untouched; this builder only
produces the X.Y-named 2.1 edition and refuses any other workspace standard."""
from __future__ import annotations
import argparse
import hashlib
import html
import json
import os
from pathlib import Path
import re
import textwrap
import importlib.metadata
import platform
import subprocess
from types import SimpleNamespace
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
RELEASE = '2.1'
REVISION = '2.1'
LANGUAGE = '2.1'
SIMULATION_PROFILE = 'swaml-reference/2.1'
PUBLICATION_DATE = '1 November 2026'
PUBLICATION_ISO = '2026-11-01'
STANDARD = json.loads((ROOT/'spec/standard.json').read_text(encoding='utf-8'))['version']
if STANDARD != REVISION:
    raise RuntimeError(f'This builder targets standard {REVISION}, but spec/standard.json is {STANDARD}. A new edition requires an explicitly versioned builder and publication review.')
# The reference implementation package has its own SemVer lifecycle (docs/VERSIONING.md).
IMPLEMENTATION = json.loads((ROOT/'package.json').read_text(encoding='utf-8'))['version']
EDITION_MODULE = (ROOT/'src/language/edition.ts').read_text(encoding='utf-8')
for constant, value in [('SWAML_LANGUAGE_VERSION', LANGUAGE), ('SWAML_REFERENCE_PROFILE', SIMULATION_PROFILE), ('SWAML_IMPLEMENTATION_VERSION', IMPLEMENTATION)]:
    if f"export const {constant} = '{value}'" not in EDITION_MODULE:
        raise RuntimeError(f'src/language/edition.ts does not select {constant} {value}')
REPO = f'https://github.com/voidaliot/swaml/blob/v{RELEASE}/'
REFERENCE = f'docs/SWAML-{RELEASE}-Reference.md'
NORMATIVE = ['docs/LANGUAGE_SPECIFICATION.md'] + [f'docs/spec/{name}' for name in [
    '01-structure-and-types.md', '02-communication.md', '03-behavior.md',
    '04-systems-and-conformance.md', '05-kerml-mapping.md', '06-execution-contract.md',
    '07-normalized-model.md', '08-conformance-obligations.md', '09-formal-semantics.md',
]] + ['docs/GRAPHICAL_NOTATION.md', 'docs/GRAPHICAL_CATALOG.md']
GUIDANCE = ['docs/'+p+'.md' for p in ['RELEASE_2_1','QUICK_START','USER_GUIDE','AI_GUIDE','ARCHITECTURE_PATTERNS','ONTOLOGY_AND_VIEWS','SIMULATION','REQUIREMENTS_AND_DOCUMENTATION','KEYWORD_REFERENCE','GRAPHICAL_EXAMPLES','IMPLEMENTATION_STATUS','TOOLING','VERSIONING','decisions/0016-swaml-2-0','decisions/0017-readable-names-and-use-cases','decisions/0019-package-context']]
EXAMPLES = sorted(p.relative_to(ROOT).as_posix() for p in (ROOT/'examples').glob('*.swaml')) + sorted(p.relative_to(ROOT).as_posix() for p in (ROOT/'libraries').glob('*.swaml'))
ATTACHMENTS = [REFERENCE,'spec/standard.json','spec/keywords.json','spec/notation.json','spec/graphical-examples.json','spec/modeling-overview.json','package.json','package-lock.json','tsconfig.json','scripts/build-spec-pdf-2.1.py','scripts/check-spec-pdf-2.1.py','scripts/publication_2_1_sources.py','scripts/publication_archive.py','scripts/ci-pdf-requirements.txt','scripts/v2_scene.py','scripts/build-notation.py','scripts/build-graphical-examples.py','scripts/build-reference.mjs','scripts/standard-version.mjs']
ATTACHMENTS += sorted(p.relative_to(ROOT).as_posix() for folder in ['docs/notation/2.0','docs/figures/2.0','resources/fonts','examples/simulation','examples/notation'] for p in (ROOT/folder).glob('*') if p.is_file())
ATTACHMENTS += sorted(p.relative_to(ROOT).as_posix() for p in (ROOT/'src').rglob('*.ts') if 'generated' not in p.parts and p.name!='standard-library.ts')
SOURCES = list(dict.fromkeys(NORMATIVE + GUIDANCE + ['src/language/swaml.langium','spec/kerml-mapping.json'] + EXAMPLES + ['LICENSE'] + ATTACHMENTS))
def source_bytes(path):
    raw=(ROOT/path).read_bytes()
    return raw if Path(path).suffix in ('.png','.ttf') else raw.replace(b'\r\n',b'\n')
ANCHORS = {p: 'file_' + hashlib.sha256(p.encode()).hexdigest()[:16] for p in SOURCES}
STYLES: dict[str, ParagraphStyle] = {}
EXTERNAL: dict[str, str] = {}
class VectorScene(Flowable):
    """Render original scene geometry as selectable text and PDF vectors."""
    def __init__(self,path,width):
        super().__init__();self.scene=json.loads(Path(path).read_text(encoding='utf-8'));self.width=width
        self.scale=width/self.scene['width'];self.height=self.scene['height']*self.scale
    def draw(self):
        c=self.canv;c.saveState();c.scale(self.scale,self.scale);h=self.scene['height']
        for e in self.scene['elements']:
            c.setStrokeColor(colors.HexColor('#171717'));c.setLineWidth(1);c.setDash(5,4) if e.get('dash') else c.setDash()
            if e['kind']=='text':
                c.setFillColor(colors.HexColor('#171717'));c.setFont('Body',e['size']);c.drawString(e['x'],h-e['y'],e['text'])
            elif e['kind']=='line':c.line(e['x1'],h-e['y1'],e['x2'],h-e['y2'])
            elif e['kind'] in ('rect','ellipse'):
                c.setFillColor(colors.HexColor(e['fill']));x,y,w,eh=e['x'],h-e['y']-e['h'],e['w'],e['h']
                if e['kind']=='rect':c.rect(x,y,w,eh,fill=1,stroke=1)
                else:c.ellipse(x,y,x+w,y+eh,fill=1,stroke=1)
            else:raise ValueError('Unsupported scene element '+e['kind'])
        c.restoreState()
SCENE=SimpleNamespace(VectorScene=VectorScene)
SECTION_ANCHORS = {}
def plain_heading(nodes):
    return ''.join(n.get('raw', '') if 'raw' in n else plain_heading(n.get('children', [])) for n in nodes)
for source in NORMATIVE + GUIDANCE:
    count=0
    for node in mistune.create_markdown(renderer='ast', plugins=['table'])((ROOT/source).read_text(encoding='utf-8')):
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
    base = dict(fontName='Body', textColor=INK, fontSize=9.3, leading=13.5, spaceAfter=6, allowWidows=0, allowOrphans=0)
    STYLES['body'] = ParagraphStyle('body', **base)
    STYLES['h1'] = ParagraphStyle('h1', fontName='BodyB', fontSize=23, leading=28, textColor=NAVY, spaceAfter=18, keepWithNext=True)
    STYLES['h2'] = ParagraphStyle('h2', fontName='BodyB', fontSize=13, leading=17, textColor=NAVY, spaceBefore=15, spaceAfter=8, keepWithNext=True)
    STYLES['h3'] = ParagraphStyle('h3', fontName='BodyB', fontSize=10.5, leading=15, textColor=TEAL, spaceBefore=10, spaceAfter=6, keepWithNext=True)
    STYLES['label'] = ParagraphStyle('label', fontName='BodyB', fontSize=8, leading=12, textColor=TEAL, spaceAfter=9, keepWithNext=True)
    STYLES['small'] = ParagraphStyle('small', fontName='Body', fontSize=8, leading=11.5, textColor=MUTED, spaceAfter=7)
    STYLES['caption'] = ParagraphStyle('caption', parent=STYLES['small'], fontName='BodyI', spaceBefore=4, spaceAfter=9)
    STYLES['cell'] = ParagraphStyle('cell', fontName='Body', fontSize=7.5, leading=10.5, textColor=INK, spaceAfter=0)
    STYLES['headcell'] = ParagraphStyle('headcell', parent=STYLES['cell'], fontName='BodyB', textColor=colors.white)
    STYLES['list'] = ParagraphStyle('list', parent=STYLES['body'], leftIndent=14, firstLineIndent=0, bulletIndent=0, bulletFontName='Body', bulletFontSize=9.3, spaceAfter=5)
    STYLES['toc0'] = ParagraphStyle('toc0', fontName='BodyB', fontSize=9.1, leading=13, leftIndent=0, firstLineIndent=0, spaceBefore=6, textColor=NAVY)
    STYLES['toc1'] = ParagraphStyle('toc1', fontName='Body', fontSize=8.3, leading=10.0, leftIndent=13, firstLineIndent=0, spaceBefore=0, textColor=INK)


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
        elif kind == 'emphasis':
            text = plain_heading(children)
            if text.startswith('/') or text.endswith('/'):
                # Comment markers such as /* */ written as prose would silently lose their asterisks.
                raise ValueError(f'Literal comment marker parsed as emphasis in {source}: {text[:60]!r}; use a code span')
            out += '<i>' + inline(children, source) + '</i>'
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
                if rel in ANCHORS and rel not in ATTACHMENTS:
                    if fragment and (rel,fragment) not in SECTION_ANCHORS:
                        raise ValueError(f'Unresolved section link {href} in {source}')
                    target = '#' + SECTION_ANCHORS.get((rel,fragment), ANCHORS[rel])
                else:
                    if not (ROOT/rel).exists(): raise ValueError(f'Broken repository link {href} in {source}')
                    target = REPO + quote(rel) + ('#'+fragment if fragment else '')
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
        # Avoid widow and orphan fragments: keep at least five rows on each side of a split.
        count = min(count, len(self.rows) - 5)
        if count < 5: return []
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


class Cover(Flowable):
    def __init__(self): super().__init__(); self.width=WIDTH; self.height=675
    def draw(self):
        c=self.canv
        c.setFillColor(TEAL);c.rect(0,628,62,5,fill=1,stroke=0)
        c.setFillColor(MUTED);c.setFont('BodyB',10);c.drawString(0,601,'SOFTWARE ARCHITECTURE MODELING LANGUAGE')
        c.setFillColor(NAVY);c.setFont('BodyB',60);c.drawString(-2,518,f'swa.ml {RELEASE}')
        c.setFont('Body',24);c.drawString(0,478,'Complete language specification')
        c.setFont('Body',12);c.setFillColor(TEAL);c.drawString(0,444,f'Standard {REVISION}  /  Parser {LANGUAGE}  /  Reference profile {SIMULATION_PROFILE}')
        c.setStrokeColor(LINE);c.line(0,412,WIDTH,412)
        labels=[('PACKAGE','A closed context of top-level occurrences and connections'),('COMPONENT','Children, private data, typed ports and operations'),('USE CASE AND TEST','Executable scripts acting through interface-only actors')]
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
        c.drawString(0,59,f'{PUBLICATION_DATE}  /  Standard {RELEASE}  /  Reference implementation {IMPLEMENTATION}  /  swa.ml contributors')
        c.drawString(0,39,'Independent language design on a proposed KerML semantic foundation.')
        c.linkURL('https://github.com/voidaliot/swaml',(0,12,300,27),relative=1)
        c.setFillColor(TEAL);c.drawString(0,17,'github.com/voidaliot/swaml')


class Book(BaseDocTemplate):
    def __init__(self, filename: str):
        super().__init__(filename,pagesize=A4,leftMargin=MARGIN,rightMargin=MARGIN,topMargin=48,bottomMargin=44,
                         title=f'swa.ml {RELEASE} Complete Language Specification',author='Catalin Ilie and swa.ml contributors',
                         subject=f'Software Architecture Modeling Language {RELEASE}: normative specification, grammar and examples',
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
        c.setFont('BodyB',7);c.setFillColor(TEAL);c.drawString(MARGIN,PAGE_H-22,f'SWA.ML {RELEASE} / COMPLETE LANGUAGE SPECIFICATION')
        c.setFont('Body',7);c.setFillColor(MUTED)
        title=self.section if len(self.section)<68 else self.section[:65]+'...'
        c.drawRightString(PAGE_W-MARGIN,PAGE_H-22,title)
        c.line(MARGIN,31,PAGE_W-MARGIN,31)
        c.drawString(MARGIN,19,f'Standard {RELEASE}  |  {PUBLICATION_DATE}  |  github.com/voidaliot/swaml')
        c.drawRightString(PAGE_W-MARGIN,19,str(self.page));c.restoreState()


class BookTable(Table):
    """A table split never strands a single body row at the bottom or top of a page."""
    def split(self, availWidth, availHeight):
        parts = super().split(availWidth, availHeight)
        if len(parts) != 2: return parts
        head = len(parts[0]._cellvalues) - self.repeatRows
        tail = len(parts[1]._cellvalues) - self.repeatRows
        if head < 2: return []
        if tail < 2 and head > 3:
            # Carry the last body row of the first part over so that two rows continue.
            moved = self._rowHeights[len(parts[0]._cellvalues) - 1]
            return super().split(availWidth, availHeight - moved - 0.5)
        return parts


def auto_widths(rows):
    """Share the width by text length so short ID/code columns do not waste space."""
    n=len(rows[0])
    def length(cell): return len(html.unescape(re.sub('<[^>]+>','',cell))) if isinstance(cell,str) else 40
    weights=[]
    for j in range(n):
        lengths=[length(row[j]) for row in rows]
        longest=max(lengths);average=sum(lengths)/len(lengths)
        # A column needs at least its longest word and header; long prose shares the rest.
        words=max(len(w) for row in rows for w in (re.sub('<[^>]+>',' ',row[j]) if isinstance(row[j],str) else 'x').split() or ['x'])
        weights.append(max(min(average*1.6+longest*.15,90),words*1.15,8))
    total=sum(weights)
    return [WIDTH*w/total for w in weights]


def table(rows: list[list[str]], widths=None):
    if widths is None:
        widths=auto_widths(rows)
    converted=[[Paragraph(cell,STYLES['headcell' if i==0 else 'cell']) if isinstance(cell,str) else cell for cell in row] for i,row in enumerate(rows)]
    t=BookTable(converted,colWidths=widths,repeatRows=1,hAlign='LEFT',splitByRow=1)
    t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),NAVY),('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,PALE]),
                          ('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),7),('RIGHTPADDING',(0,0),(-1,-1),7),
                          ('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7),
                          ('LINEBELOW',(0,0),(-1,0),.5,NAVY),('LINEBELOW',(0,1),(-1,-1),.35,LINE)]))
    t.spaceBefore=5;t.spaceAfter=12
    return t


def markdown(source: str, status: str):
    ast=mistune.create_markdown(renderer='ast',plugins=['table'])((ROOT/source).read_text(encoding='utf-8'))
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
                    output.append(Paragraph(esc(plain_heading(image.get('children',[]))),STYLES['caption']))
                else: output.append(Paragraph(inline(children,source),STYLES['body']))
            elif kind=='block_code':
                lang=n.get('attrs',{}).get('info','')
                if lang=='mermaid': raise ValueError('Use a versioned original scene for PDF diagrams')
                output.append(Code(n['raw'],label=lang.upper() or 'SOURCE'))
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
                widths=None
                if source=='docs/GRAPHICAL_CATALOG.md' and len(head)==3:
                    graphical=any(plain_heading(cell['children']).lower()=='graphical notation' for cell in head)
                    widths=[WIDTH*.16,WIDTH*.50,WIDTH*.34] if graphical else [WIDTH*.23,WIDTH*.18,WIDTH*.59]
                elif source=='docs/MODELING_OVERVIEW.md' and plain_heading(head[0]['children'])=='Modeling question':
                    widths=[WIDTH*.38,WIDTH*.44,WIDTH*.18]
                def cell_content(cell,index):
                    nodes=cell['children']
                    if len(nodes)==1 and nodes[0]['type']=='image':
                        if widths is None: raise ValueError('Image table requires explicit column widths')
                        path=(ROOT/Path(source).parent/nodes[0]['attrs']['url']).with_suffix('.scene.json')
                        return SCENE.VectorScene(path,widths[index]-14)
                    return inline(nodes,source)
                rows=[[inline(cell['children'],source) for cell in head]]
                rows.extend([[cell_content(cell,index) for index,cell in enumerate(row['children'])] for row in body])
                output.append(table(rows,widths))
            elif kind=='thematic_break': output.append(Spacer(1,10))
            else: raise ValueError(f'Unsupported block token {kind} in {source}')
        return output
    rendered = blocks(ast)
    if source == 'docs/GRAPHICAL_CATALOG.md':
        grouped=[];i=0
        while i<len(rendered):
            item=rendered[i]
            if getattr(item,'heading_level',None)==1:
                group=[item];i+=1
                while i<len(rendered) and not hasattr(rendered[i],'heading_level'):
                    group.append(rendered[i]);i+=1
                grouped.append(KeepTogether(group))
            else:grouped.append(item);i+=1
        rendered=grouped
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
    parser.add_argument('--output',type=Path,default=ROOT/f'output/pdf/SWAML-{RELEASE}-Specification.pdf')
    parser.add_argument('--font-dir',type=Path,default=ROOT/'resources/fonts')
    args=parser.parse_args();fonts(args.font_dir);args.output.parent.mkdir(parents=True,exist_ok=True)
    story=[Cover(),PageBreak(),heading('About this edition',1,'edition')]
    story.extend([Paragraph(f'STANDARD {RELEASE} / RELEASE EDITION, {PUBLICATION_DATE.upper()}',STYLES['label']),
        Paragraph(f'This book contains the complete swa.ml {RELEASE} language specification, every keyword in alphabetical order, formal execution rules, flat notation examples, an ontology and view guide, a reference simulation binding, the complete grammar, runnable model examples and the release notes with the migration from 2.0. Source files are headerless and begin with packages; hosts select and pin parser {LANGUAGE} and the reference profile {SIMULATION_PROFILE}. A package is a closed context: its top-level occurrences, package connections, executable use cases and tests, and requirement links live side by side.',STYLES['body']),
        Paragraph('Normative chapters define syntax, validity, interface isolation, operation/state behavior, case scripts and mapping obligations. Tutorials and figures illustrate these rules. This independently authored language is not an OMG UML release or an AUTOSAR implementation. KerML export remains a proposed semantic mapping contract.',STYLES['body']),
        Paragraph(f'The standard uses MAJOR.MINOR versions: this is standard {RELEASE}. The reference parser, validator, deterministic logical-time simulator and case runner of the reference implementation package {IMPLEMENTATION} provide executable evidence; the package version follows its own SemVer lifecycle. A passing case is bounded evidence of one deterministic run, not proof. Production timing, runtime and platform mappings require the target binding and evidence defined in the normative chapters.',STYLES['body']),
        table([['Navigation','How to use this PDF'],['Contents and bookmarks','Select a contents entry or use the PDF outline to open a chapter or section.'],['Cross-references',f'Links to included documents jump inside this book. Other repository links target the v{RELEASE} release tag.'],['Code and tables','Code is selectable, numbered and wrapped without omitting source text. Tables repeat their headers across pages.'],['Source record','The build manifest lists every included source and its SHA-256 digest. Original source files are embedded as PDF attachments. The release includes a PDF checksum.']]),
        Paragraph('Original text and code: MIT license, copyright 2026 Catalin Ilie. Referenced standards retain their own terms; no standards PDFs are redistributed. Full license text appears at the end.',STYLES['small']),
        PageBreak()])
    toc_title=Paragraph('Contents',STYLES['h1']);toc_title.running_title='Contents';story.append(toc_title)
    toc=TableOfContents();toc.levelStyles=[STYLES['toc0'],STYLES['toc1']];story.append(toc)
    for source in ['docs/KEYWORD_REFERENCE.md']: story.extend(markdown(source,'USER REFERENCE / CONCERN AND KEYWORD NAVIGATION'))
    for source in NORMATIVE: story.extend(markdown(source,'NORMATIVE / LANGUAGE CONTRACT'))
    grammar='src/language/swaml.langium'
    story.extend([PageBreak(),Paragraph('NORMATIVE APPENDIX',STYLES['label']),heading('A. Complete concrete grammar',1,ANCHORS[grammar]),
                  Paragraph('Authoritative Langium grammar, reproduced in full. Line wraps are typographic continuations; only numbered rows begin original source lines.',STYLES['body']),Code((ROOT/grammar).read_text(encoding='utf-8'),'LANGIUM GRAMMAR')])
    inventory='spec/kerml-mapping.json'
    story.extend([PageBreak(),Paragraph('NORMATIVE DESIGN INVENTORY',STYLES['label']),heading('B. Grammar-to-semantics inventory',1,ANCHORS[inventory]),
                  Paragraph('Every grammar rule/type name is represented. Proposed kernel bases identify the design target; they do not constitute an implemented or validated exporter. Empty bases indicate syntax normalized through its owner.',STYLES['body'])])
    entries=json.loads((ROOT/inventory).read_text(encoding='utf-8'))['mapping']
    rows=[['Rule / kind','Proposed kernel base','Meaning to preserve']]
    rows.extend([[f'<b>{esc(e["source"])}</b><br/>{esc(e["kind"])}',esc(', '.join(e['kernel']) or 'Owner representation'),esc(e['semantic'])] for e in entries])
    story.append(table(rows,[WIDTH*.28,WIDTH*.16,WIDTH*.56]))
    story.extend([PageBreak(),Paragraph('INFORMATIVE / COMPLETE MODELS',STYLES['label']),heading('C. Model and library sources',1,'examples')])
    for i,source in enumerate(EXAMPLES):
        # Short models share pages; a model starts a new page only when little room is left.
        if i: story.append(CondPageBreak(220))
        title=Path(source).stem.replace('-', ' ')
        title_flowable=heading(title,2,ANCHORS[source]);title_flowable.keepWithNext=False  # the preceding CondPageBreak keeps it with its first lines
        story.extend([title_flowable,Code((ROOT/source).read_text(encoding='utf-8'),'SWA.ML / '+Path(source).name)])
    for source in GUIDANCE:
        if source not in ['docs/KEYWORD_REFERENCE.md']: story.extend(markdown(source,'INFORMATIVE / GUIDANCE AND PROJECT STATUS'))
    if EXTERNAL:
        story.extend([PageBreak(),heading('D. External references',1,'references'),Paragraph('Primary-source and project links cited in the included text. The comparisons identify their research baseline; this list does not imply conformance to any external standard.',STYLES['body'])])
        for number,(url,label) in enumerate(EXTERNAL.items(),1):
            story.append(Paragraph(f'<b>{number}. {esc(html.unescape(label))}</b><br/><a href="{esc(url)}" color="#087F8C">{esc(url)}</a>',STYLES['small']))
    story.extend([PageBreak(),heading(('E' if EXTERNAL else 'D')+'. License',1,ANCHORS['LICENSE'])])
    for p in (ROOT/'LICENSE').read_text(encoding='utf-8').split('\n\n'): story.append(Paragraph(esc(p.replace('\n',' ')),STYLES['body']))
    book=Book(str(args.output));book.multiBuild(story)
    # Preserve the vector book, outlines and links while embedding exact source bytes.
    reader=PdfReader(args.output)
    writer=PdfWriter();writer.clone_document_from_reader(reader)
    for source in SOURCES:
        writer.add_attachment(source.replace('/', '__'), source_bytes(source))
    with args.output.open('wb') as stream: writer.write(stream)
    manifest={'release':RELEASE,'languageVersion':LANGUAGE,'specificationRevision':REVISION,'simulationProfile':SIMULATION_PROFILE,'implementationRevision':IMPLEMENTATION,'publicationDate':PUBLICATION_ISO,'pages':book.page,'pdf':args.output.name,
              'sources':[{'path':p,'attachmentName':p.replace('/', '__'),'sha256':hashlib.sha256(source_bytes(p)).hexdigest()} for p in SOURCES],
              'sourceBaseCommit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),
              'sourceBundleSha256':hashlib.sha256(b''.join(p.encode()+b'\0'+source_bytes(p) for p in SOURCES)).hexdigest(),
              'dependencies':{name:importlib.metadata.version(name) for name in ['reportlab','mistune','pypdf','pdfplumber','Pillow']},
              'python':platform.python_version(),
              'pdfSha256':hashlib.sha256(args.output.read_bytes()).hexdigest()}
    args.output.with_suffix('.manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8',newline='\n')
    args.output.with_suffix('.sha256').write_text(manifest['pdfSha256']+'  '+args.output.name+'\n',encoding='utf-8',newline='\n')
    print(f'Built {args.output}: {book.page} pages, {len(SOURCES)} complete source files')

if __name__=='__main__': main()
