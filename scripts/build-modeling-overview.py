#!/usr/bin/env python3
"""Export the shared modeling-overview graphs as reproducible flat SVG/PDF scenes."""
from pathlib import Path
import argparse
import html
import json
import math

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'spec/modeling-overview.json'
OUT = ROOT / 'docs/assets'
INK = '#17324d'
MUTED = '#516579'
TEAL = '#087f8c'
FILLS = {'definition': '#eaf1f8', 'instance': '#eef5fa', 'behavior': '#e7f3f2',
         'contract': '#f0eef9', 'value': '#f7f4e9', 'intent': '#f8f2e9',
         'evidence': '#f5f7f9', 'deployment': '#eef5fa', 'view': '#f0eef9',
         'route': '#edf4f7', 'failure': '#fcf0ed', 'decision': '#f7f4e9'}


def scene_for(graph):
    """The shapes match scripts/pdf-scene.py; graph positions remain unmodified."""
    shapes = []

    def rect(x, y, width, height, fill='white', stroke=INK, rx=0):
        shapes.append(dict(kind='rect', x=x, y=y, width=width, height=height,
                           fill=fill, stroke=stroke, rx=rx))

    def text(x, y, value, size=20, bold=False, color=INK):
        shapes.append(dict(kind='text', x=x, y=y, text=value, size=size,
                           bold=bold, color=color))

    def line(points, dashed=False, arrow=True, color=INK):
        shapes.append(dict(kind='line', points=points, color=color, dash=dashed, arrow=arrow))

    nodes = {n['id']: n for n in graph['nodes']}
    rect(0, 0, graph['width'], graph['height'], stroke='none')
    for edge in graph['edges']:
        points = edge.get('points')
        if points:
            points = [[p['x'], p['y']] for p in points]
        else:
            points = []
            for key, default in [('source', 'bottom'), ('target', 'top')]:
                n = nodes[edge[key]]
                side = edge.get(key + 'Side', default)
                points.append({'top': [n['x'] + n['width'] / 2, n['y']],
                               'bottom': [n['x'] + n['width'] / 2, n['y'] + n['height']],
                               'left': [n['x'], n['y'] + n['height'] / 2],
                               'right': [n['x'] + n['width'], n['y'] + n['height'] / 2]}[side])
        line(points, edge['kind'] == 'references', edge.get('arrow', True),
             TEAL if edge['kind'] == 'route' else INK)
        if edge.get('label'):
            x = edge.get('labelX', (points[0][0] + points[-1][0]) / 2 + 9)
            y = edge.get('labelY', (points[0][1] + points[-1][1]) / 2 - 8)
            # An opaque label background keeps routed crossings legible.
            label_width = len(edge['label']) * 10.9 + 12
            rect(x - 6, y - 21, label_width, 27, stroke='none')
            text(x, y, edge['label'])

    for node in graph['nodes']:
        x, y, width, height = [node[k] for k in ['x', 'y', 'width', 'height']]
        fill = FILLS.get(node['kind'], '#f5f7f9')
        if node['kind'] == 'decision':
            shapes.append(dict(kind='polygon', points=[[x + width / 2, y], [x + width, y + height / 2],
                                                       [x + width / 2, y + height], [x, y + height / 2]],
                               fill=fill, stroke=INK))
            text(x + width / 2 - len(node['title']) * 6.1, y + height / 2 + 7, node['title'], bold=True)
            for i, value in enumerate(node.get('lines', [])):
                text(x + 52, y + height / 2 + 24 + i * 27, value)
        else:
            rect(x, y, width, height, fill=fill, rx=4 if node['kind'] in ['behavior', 'failure'] else 0)
            text(x + 16, y + 32, node['title'], bold=True)
            if node.get('lines'):
                line([[x, y + 46], [x + width, y + 46]], arrow=False, color='#cad6df')
            for i, value in enumerate(node.get('lines', [])):
                text(x + 16, y + 75 + i * 28, value)

    # Ports are drawn last so they remain visible on occurrence card boundaries.
    for edge in graph['edges']:
        if edge['kind'] != 'route':
            continue
        for key, point in [('source', (edge.get('points') or [None])[0]),
                           ('target', (edge.get('points') or [None])[-1])]:
            if point:
                x, y = point['x'], point['y']
            else:
                n = nodes[edge[key]]
                side = edge.get(key + 'Side', 'bottom' if key == 'source' else 'top')
                x, y = {'top': [n['x'] + n['width'] / 2, n['y']],
                        'bottom': [n['x'] + n['width'] / 2, n['y'] + n['height']],
                        'left': [n['x'], n['y'] + n['height'] / 2],
                        'right': [n['x'] + n['width'], n['y'] + n['height'] / 2]}[side]
            rect(x - 6, y - 6, 12, 12, stroke=TEAL)

    return dict(width=graph['width'], height=graph['height'], title=graph['title'],
                description=graph['summary'], source='spec/modeling-overview.json',
                graph=graph['id'], shapes=shapes)


def svg_for(scene):
    shapes = []
    for s in scene['shapes']:
        kind = s['kind']
        if kind == 'text':
            shapes.append(f'<text x="{s["x"]}" y="{s["y"]}" font-size="{s["size"]}" font-weight="{700 if s["bold"] else 400}" fill="{s["color"]}">{html.escape(s["text"])}</text>')
        elif kind == 'rect':
            shapes.append(f'<rect x="{s["x"]}" y="{s["y"]}" width="{s["width"]}" height="{s["height"]}" rx="{s["rx"]}" fill="{s["fill"]}" stroke="{s["stroke"]}"/>')
        elif kind == 'polygon':
            coords = ' '.join(f'{x},{y}' for x, y in s['points'])
            shapes.append(f'<polygon points="{coords}" fill="{s["fill"]}" stroke="{s["stroke"]}"/>')
        elif kind == 'line':
            coords = ' '.join(f'{x},{y}' for x, y in s['points'])
            dash = ' stroke-dasharray="7 5"' if s['dash'] else ''
            shapes.append(f'<polyline points="{coords}" fill="none" stroke="{s["color"]}" stroke-width="2"{dash}/>')
            if s['arrow']:
                x, y = s['points'][-1]
                px, py = s['points'][-2]
                angle = math.atan2(y - py, x - px)
                arrow = [(x, y)] + [(x - 14 * math.cos(angle) + side * 6 * math.sin(angle),
                                     y - 14 * math.sin(angle) - side * 6 * math.cos(angle))
                                    for side in [-1, 1]]
                coords = ' '.join(f'{a:.3f},{b:.3f}' for a, b in arrow)
                shapes.append(f'<polygon points="{coords}" fill="{INK}"/>')
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{scene["width"]}" height="{scene["height"]}" '
            f'viewBox="0 0 {scene["width"]} {scene["height"]}" role="img" aria-labelledby="title desc">\n'
            f'<title id="title">{html.escape(scene["title"])}</title>\n<desc id="desc">{html.escape(scene["description"])}</desc>\n'
            '<g font-family="DejaVu Sans, sans-serif">\n' + '\n'.join(shapes) + '\n</g>\n</svg>\n')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='reject stale SVG or scene output')
    args = parser.parse_args()
    data = json.loads(SOURCE.read_text(encoding='utf-8'))
    for graph in [data['ontology'], *data['stages']]:
        scene = scene_for(graph)
        for extension, content in [('svg', svg_for(scene)), ('scene.json', json.dumps(scene, ensure_ascii=False, indent=2) + '\n')]:
            path = OUT / f'modeling-{graph["id"]}.{extension}'
            if args.check:
                if not path.exists() or path.read_text(encoding='utf-8') != content:
                    raise SystemExit(f'Stale modeling overview asset: {path.relative_to(ROOT)}')
            else:
                path.write_text(content, encoding='utf-8', newline='\n')
    print(f'Modeling overview: {len(data["stages"]) + 1} graphs {"verified" if args.check else "generated"}.')


if __name__ == '__main__':
    main()
