# PROTOTYPE P5: the door showcase with the window lifter of proposal 1.6 (parents moving and driven) written in, the
# other machines as migrated. python p4/hand/make-door.py <migrated door> <out door> [statement written in moving]
import sys
src, out = sys.argv[1], sys.argv[2]
s = open(src, encoding='utf8').read()
hand = open('E:/t/sw-p4/p4/hand/window-lifter-parents.txt', encoding='utf8').read().rstrip('\n')
if len(sys.argv) > 3:  # probe: a statement written in the parent moving runs at every look of a state inside it
    w = s.index('    reversed port requests: WindowRequests;', s.index('component def WindowLifter'))
    s = s[:w] + '    attribute looks: uint = 0;\n' + s[w:]
    hand = hand.replace("        on receive supervision.sensorFault() { to idle; }", "        " + sys.argv[3] + "\n        on receive supervision.sensorFault() { to idle; }", 1)
i = s.index('component def WindowLifter')
a = s.index('    operation control() {', i)
depth, j = 0, a
while True:
    c = s[j]
    if c == '{': depth += 1
    elif c == '}':
        depth -= 1
        if depth == 0: break
    j += 1
s = s[:a] + '    ' + hand.lstrip(' ') + s[j + 1:]
open(out, 'w', encoding='utf8', newline='\n').write(s)
