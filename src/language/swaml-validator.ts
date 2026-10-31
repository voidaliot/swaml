import { AstUtils, CstUtils, DocumentState, GrammarUtils, WorkspaceCache, type AstNode, type ValidationAcceptor } from 'langium';
import type { Range } from 'vscode-languageserver';
import type { LangiumServices } from 'langium/lsp';
import * as a from './generated/ast.js';
import { connectionRoutes, designComponent, interfaceOnly, packageEndpoint, packageOccurrences, expressionTypes, OCCURRENCE_LIMIT, occurrenceCount, workspaceModels, assignable, body, compatibility, constantNumber, direction, effectiveQos, effects, endpoint, entryKey, identity, integral, isExecutable, isNode, localOperation, memberEndpoint, members, nanos, nodes, numeric, occurrences, owner, resolve, schedule, signature, typeKey, type Executable, type Node, type Structure, portMembers } from './semantic.js';
import { selectView, viewCandidates, type ViewSubject } from './presentation.js';
import { decodeQuotedName, nameProblem } from './names.js';
type Env = Map<string, {
    type: string;
    mutable: boolean;
}>;
export class SwamlValidator {
    private models: a.Model[] = [];
    private accept!: ValidationAcceptor;
    private currentModel!: a.Model;
    private readonly viewSubjects: WorkspaceCache<string, ViewSubject[]>;
    constructor(private services: LangiumServices) {
        this.viewSubjects = new WorkspaceCache(services.shared);
        // Explicit in-memory builds also link new models without onUpdate.
        services.shared.workspace.DocumentBuilder.onBuildPhase(DocumentState.Linked, () => this.viewSubjects.clear());
    }
    private selectView(view: a.View): ViewSubject[] {
        return selectView(view, this.models, this.viewSubjects.get('subjects', () => viewCandidates(this.models)));
    }
    private reported = new Set<string>();
    private report(n: AstNode, code: string, message: string, warning = false, extra: { range?: Range; edits?: { range: Range; newText: string }[] } = {}): void { const declarationDoc=AstUtils.getDocument(n),currentDoc=AstUtils.getDocument(this.currentModel),foreign=declarationDoc!==currentDoc;
        // Inherited members are checked for their definition and every usage; report each finding once.
        const reportKey=[code,message,declarationDoc.uri.toString(),JSON.stringify(extra.range??n.$cstNode?.range)].join('|');if(this.reported.has(reportKey))return;this.reported.add(reportKey);
        const declarationOwner=owner(n,(x):x is Structure=>a.isComponentDef(x)||a.isComponentUsage(x));
        const primary=foreign?this.currentModel.packages.flatMap(p=>p.elements.filter(a.isComponentUsage)).find(root=>occurrenceCount(root)<=OCCURRENCE_LIMIT&&occurrences(root).some(o=>o.structure===declarationOwner||o.definition===declarationOwner))??this.currentModel.packages[0]??this.currentModel:n;
        this.accept(warning ? 'warning' : 'error', message, { node: primary, ...(extra.range&&!foreign?{range:extra.range}:{}), code, relatedInformation:foreign?[{location:{uri:declarationDoc.uri.toString(),range:n.$cstNode!.range},message:'Declaration '+identity(n)}]:undefined, data: { declaration: identity(n), occurrencePaths: this.models.flatMap(m => m.packages.flatMap(p => p.elements.filter(a.isComponentUsage))).filter(root => occurrenceCount(root) <= OCCURRENCE_LIMIT).flatMap(root => occurrences(root).filter(o => o.structure === n || o.structure === owner(n, (x): x is Structure => a.isComponentDef(x) || a.isComponentUsage(x)) || o.definition === owner(n, a.isComponentDef)).map(o => identity(root) + o.path.slice(root.name.length))), ...(!foreign && code === 'SW2003' && message.includes('needs redefines') && n.$cstNode ? { suggestedEdits: [{ uri: AstUtils.getDocument(n).uri.toString(), range: { start: n.$cstNode.range.start, end: n.$cstNode.range.start }, newText: 'redefines ' }] } : !foreign && extra.edits ? { suggestedEdits: extra.edits.map(edit => ({ uri: declarationDoc.uri.toString(), ...edit })) } : {}) } }); }
    checkModel = (model: a.Model, accept: ValidationAcceptor): void => {
        this.accept = accept;
        this.currentModel=model;
        this.reported.clear();
        const d = AstUtils.getDocument(model);
        if (d.parseResult.parserErrors.length || d.parseResult.lexerErrors.length)
            return;
        this.models = this.services.shared.workspace.LangiumDocuments.all.map(d => d.parseResult.value).filter(a.isModel).toArray();
        if (!this.models.includes(model))
            this.models.push(model);
        for (const item of this.models)
            workspaceModels.set(item, this.models);
        if (model.$cstNode)
            for (const leaf of CstUtils.flattenCst(model.$cstNode).filter(l => l.tokenType.name === 'UNRESTRICTED_NAME')) {
                const problem = nameProblem(decodeQuotedName(leaf.text));
                if (problem)
                    this.report(leaf.astNode, 'SW2001', problem, false, { range: leaf.range });
            }
        const packages = this.models.flatMap(m => m.packages);
        for (const p of model.packages) {
            if (packages.filter(x => x.name === p.name).length > 1)
                this.report(p, 'SW2001', `Duplicate package ${p.name}.`);
            for (const i of p.imports)
                if (!packages.some(x => x.name === i.namespace))
                    this.report(i, 'SW2001', `Unknown imported package ${i.namespace}.`);
            this.unique([...p.elements, ...p.connections], p);
            for (const e of p.elements) {
                if (a.isOperation(e)) {
                    if (!e.definition)
                        this.report(e, 'SW2006', 'A package operation must be an operation def.');
                    this.operation(e);
                }
                if (a.isComponentDef(e) || a.isComponentUsage(e))
                    this.structure(e);
                if (a.isPortDef(e))
                    this.port(e.members, e);
                if (a.isViewDef(e) && p.name !== 'Swaml::Views')
                    this.report(e, 'SW2010', 'The seven standard view definitions supply the supported projections.');
                if (a.isQosPolicy(e))
                    this.policy(e);
                if (a.isRequirement(e)) {
                    this.unique(e.attributes, e);
                    for (const v of e.attributes) {
                        if (v.redefines)
                            this.report(v, 'SW2003', 'Requirement attributes cannot redefine a member.');
                    }
                    for (const v of e.attributes)
                        this.value(v.value, typeKey(v.type), new Map());
                }
                if (a.isDataType(e)) {
                    this.unique(e.fields, e);
                    if (this.typeCycle(e, new Set()))
                        this.report(e, 'SW2002', 'Record containment must be finite and acyclic.');
                }
                if (a.isEnumType(e) && new Set(e.literals).size !== e.literals.length)
                    this.report(e, 'SW2001', 'Enum literals must be unique.');
                if (a.isDeployment(e))
                    this.deployment(e);
                if (a.isView(e))
                    this.view(e);
            }
            this.packageConnections(p);
            this.links(p);
        }
        for (const n of nodes(model)) {
            if (n.redefines && !a.isComponentDef(n.$container) && !a.isComponentUsage(n.$container) && !a.isAttribute(n))
                this.report(n, 'SW2003', 'redefines requires an inherited member of the containing component.');
            if (a.isTypeRef(n)) {
                if (n.size !== undefined && (!Number.isSafeInteger(n.size) || n.size <= 0))
                    this.report(n, 'SW2002', 'Array extent must be a positive safe integer.');
                if (n.primitive === 'void' && (n.size !== undefined || !((a.isOperation(n.$container) || a.isPortMember(n.$container)) && n.$containerProperty === 'result')))
                    this.report(n, 'SW2002', 'void is only an operation result.');
            }
            if (a.isDuration(n) && (!Number.isSafeInteger(nanos(n)) || nanos(n) <= 0))
                this.report(n, 'SW2013', 'Duration must be positive safe integer nanoseconds.');
        }
    };
    private unique(items: readonly AstNode[], n: AstNode): void { const seen = new Set<string>(); for (const x of items as Node[])
        if (x.name) {
            if (seen.has(x.name))
                this.report(x, 'SW2001', `Duplicate name ${x.name} in ${identity(n)}.`);
            seen.add(x.name);
        } }
    private typeCycle(d: a.DataType, seen: Set<a.DataType>): boolean { if (seen.has(d))
        return true; return d.fields.some(f => a.isDataType(f.type.type?.ref) && this.typeCycle(f.type.type.ref, new Set([...seen, d]))); }
    private baseCycle(c: Structure, seen: Set<Structure>): boolean { if (seen.has(c))
        return true; const b = a.isComponentDef(c) ? c.specializes?.ref : c.definition?.ref; return !!b && this.baseCycle(b, new Set([...seen, c])); }
    private containmentCycle(c: Structure, seen: Set<Structure>): boolean { const d = a.isComponentUsage(c) ? c.definition?.ref ?? c : c; if (seen.has(d))
        return true; return members(c).filter(a.isComponentUsage).some(ch => this.containmentCycle(ch, new Set([...seen, d]))); }
    private subtype(c: a.ComponentDef, b: a.ComponentDef, seen = new Set<a.ComponentDef>()): boolean { if (c === b)
        return true; if (seen.has(c))
        return false; seen.add(c); return !!c.specializes?.ref && this.subtype(c.specializes.ref, b, seen); }
    private replacement(x: Node, y: Node): boolean {
        if (isExecutable(x) && isExecutable(y)) {
            const p = signature(x), q = signature(y);
            return !!p && !!q && typeKey(p.result) === typeKey(q.result) && p.parameters.length === q.parameters.length && p.parameters.every((v, i) => typeKey(v.type) === typeKey(q.parameters[i].type) && (v.direction ?? 'in') === (q.parameters[i].direction ?? 'in')) && !!body(x)?.states.length === !!body(y)?.states.length;
        }
        if (x.$type !== y.$type)
            return false;
        if (a.isAttribute(x) && a.isAttribute(y))
            return typeKey(x.type) === typeKey(y.type) && x.constant === y.constant;
        if (a.isPortUsage(x) && a.isPortUsage(y))
            return x.optional === y.optional && !compatibility(x, y, true).length;
        if (a.isComponentUsage(x) && a.isComponentUsage(y))
            return x.size === y.size && (x.definition?.ref === y.definition?.ref || !!x.definition?.ref && !!y.definition?.ref && this.subtype(y.definition.ref, x.definition.ref));
        return true;
    }
    private structure(c: Structure, stack = new Set<Structure>()): void {
        if (this.baseCycle(c, new Set())) {
            this.report(c, 'SW2003', 'Specialization must be acyclic.');
            return;
        }
        if (stack.has(c))
            return;
        const base = a.isComponentDef(c) ? c.specializes?.ref : c.definition?.ref;
        if (a.isComponentUsage(c) && !c.definition && (!a.isPackage(c.$container) || c.$cstNode?.text.trim().endsWith(';')))
            this.report(c, 'SW2003', 'A child usage requires a component definition.');
        if (a.isComponentUsage(c) && c.size !== undefined && (!Number.isSafeInteger(c.size) || c.size < 1 || a.isPackage(c.$container)))
            this.report(c, 'SW2003', 'Multiplicity must be a positive safe integer on a child usage.');
        this.unique(c.members, c);
        if (c.members.filter(a.isSchedule).length > 1)
            this.report(c, 'SW2007', 'A component owns at most one schedule.');
        const inherited = base ? members(base) : [];
        for (const m of c.members as Node[]) {
            const old = m.name && inherited.find(x => (x as Node).name === m.name);
            if (old && !m.redefines)
                this.report(m, 'SW2003', `Inherited member ${m.name} needs redefines.`);
            if (m.redefines && !old)
                this.report(m, 'SW2003', `No inherited member ${m.name} to redefine.`);
            if (old && !this.replacement(old as Node, m))
                this.report(m, 'SW2003', `Redefinition of ${m.name} must preserve category, signature and type.`);
            if (a.isAttribute(m))
                this.value(m.value, typeKey(m.type), new Map(), c);
            if (isExecutable(m))
                this.operation(m, c);
            if (a.isPortUsage(m))
                this.port(portMembers(m), m);
            if (a.isComponentUsage(m))
                this.structure(m, new Set([...stack, c]));
        }
        const eff = members(c);
        if (this.containmentCycle(c, new Set()))
            this.report(c, 'SW2003', 'Component containment must be finite and acyclic.');
        if (isNode(c) && (eff.some(m => a.isComponentUsage(m) ? !isNode(m) : !(a.isAttribute(m) && m.constant)) || schedule(c).length))
            this.report(c, 'SW2009', 'A Node owns only const attributes and child Nodes.');
        const pairs = new Set<string>(), counts = new Map<string, number>(), forwarded = new Set<string>();
        for (const link of eff.filter(a.isConnect)) {
            const l = endpoint(c, link.source), r = endpoint(c, link.target);
            if (!l || !r) {
                this.report(link, 'SW2004', 'Endpoints must be owned ports or indexed ports of immediate children.');
                continue;
            }
            const pair = [link.source, link.target].sort().join('|');
            if (link.source === link.target || pairs.has(pair))
                this.report(link, 'SW2004', 'Duplicate or self connector.');
            pairs.add(pair);
            const forward = l.child !== r.child, boundary = l.child ? r : l, child = l.child ? l : r;
            for (const issue of compatibility(forward ? boundary.port : l.port, forward ? child.port : r.port, forward))
                this.report(link, 'SW2004', `${forward ? 'Forwarding' : 'Connection'}: ${issue}.`);
            if (forward) {
                if (link.policy)
                    this.report(link, 'SW2004', 'Forwarding cannot have a policy.');
                for (const path of [link.source, link.target]) {
                    if (forwarded.has(path))
                        this.report(link, 'SW2004', `Port ${path} is forwarded more than once.`);
                    forwarded.add(path);
                }
            }
            else {
                for (const path of [link.source, link.target])
                    counts.set(path, (counts.get(path) ?? 0) + 1);
                if (effectiveQos(link).delivery === 'atLeastOnce')
                    for (const ep of [l, r])
                        for (const m of portMembers(ep.port))
                            if (m.kind === 'operation' && direction(ep.port, m) === 'provides' && !m.idempotent)
                                this.report(link, 'SW2013', `atLeastOnce requires idempotent provided operation ${ep.path}.${m.name}.`);
            }
        }
        for (const [path, count] of counts) {
            const ep = endpoint(c, path)!;
            if (count > 1 && portMembers(ep.port).some(m => direction(ep.port, m) === 'requires' && m.kind !== 'event'))
                this.report(ep.port, 'SW2004', `${path} requires attributes or operations and needs one peer.`);
        }
        this.schedules(c);
        this.ownership(c, forwarded);
        if (a.isPackage(c.$container) && a.isComponentUsage(c) && occurrenceCount(c) > OCCURRENCE_LIMIT)
            this.report(c, 'SW2013', 'Expanded root exceeds the reference validation limit of ' + OCCURRENCE_LIMIT + ' component occurrences.');
    }
    private port(ms: a.PortMember[], n: AstNode): void {
        this.unique(ms, n);
        for (const m of ms) {
            if (m.kind === 'attribute' ? !m.type || m.parameters.length > 0 || !!m.result : !!m.type)
                this.report(m, 'SW2004', 'Attributes use a type; events and operations use parameter lists.');
            if (m.kind !== 'operation' && (m.idempotent || m.result || m.parameters.some(p => p.direction === 'out')))
                this.report(m, 'SW2004', 'Only operations have out parameters, results or idempotent.');
            this.unique(m.parameters, m);
        }
    }
    private policy(q: a.QosPolicy): void {
        if (identity(q) === 'Swaml::Qos::Policy')
            return;
        const base = q.base && resolve(q, q.base, this.models);
        const derived = (q: a.QosPolicy, seen = new Set<a.QosPolicy>()): boolean => { if (identity(q) === 'Swaml::Qos::Policy')
            return true; if (seen.has(q) || !q.base)
            return false; seen.add(q); const parent = resolve(q, q.base, this.models); return a.isQosPolicy(parent) && derived(parent, seen); };
        if (!a.isQosPolicy(base) || !derived(base))
            this.report(q, 'SW2013', 'A QoS definition must be typed by Swaml::Qos::Policy.');
        this.unique(q.settings, q);
        const p = effectiveQos(q);
        if (!['bestEffort', 'atMostOnce', 'atLeastOnce'].includes(p.delivery) || !['fifo', 'unordered'].includes(p.ordering) || !['dropOldest', 'dropNewest', 'reject'].includes(p.overflow) || !Number.isSafeInteger(p.capacity) || p.capacity <= 0 || !Number.isSafeInteger(p.requestTimeout) || p.requestTimeout <= 0)
            this.report(q, 'SW2013', 'A policy needs complete valid delivery, ordering, capacity, overflow and requestTimeout.');
        for (const s of q.settings) {
            if (!['delivery', 'ordering', 'capacity', 'overflow', 'requestTimeout', 'maxLatency', 'maxAge'].includes(s.name))
                this.report(s, 'SW2013', `Unknown setting ${s.name}.`);
            if (['requestTimeout', 'maxLatency', 'maxAge'].includes(s.name) && !s.duration)
                this.report(s, 'SW2013', `${s.name} needs a duration.`);
            if (s.name === 'capacity' && (s.duration || !a.isLiteral(s.value) || s.value.number === undefined))
                this.report(s, 'SW2013', 'capacity needs a positive integer count, not a duration.');
            if (s.value && ['delivery', 'ordering', 'overflow'].includes(s.name))
                this.value(s.value, 'Swaml::Qos::' + ({ delivery: 'Delivery', ordering: 'Ordering', overflow: 'Overflow' } as Record<string, string>)[s.name], new Map());
        }
    }
    private env(c?: Structure): Env { return new Map(c ? members(c).filter(a.isAttribute).map(v => [v.name, { type: typeKey(v.type), mutable: !v.constant }]) : []); }
    private operation(op: Executable, c?: Structure): void {
        const sig = signature(op), b = body(op);
        if (!sig || !b)
            return;
        if (a.isOperationUsage(op) && !sig.definition)
            this.report(op, 'SW2006', 'An operation usage must reference an operation def.');
        if (a.isOperation(op) && op.definition && !a.isPackage(op.$container))
            this.report(op, 'SW2006', 'operation def is package-owned.');
        const env = this.env(c);
        this.unique(sig.parameters, op);
        for (const p of sig.parameters) {
            if (env.has(p.name))
                this.report(p, 'SW2001', `Parameter ${p.name} shadows a live attribute.`);
            env.set(p.name, { type: typeKey(p.type), mutable: p.direction === 'out' });
        }
        this.unique([...sig.parameters, ...b.operations], op);
        for (const nested of b.operations)
            this.operation(nested, c);
        if (!c && !identity(op).startsWith('Swaml::Math::') && Object.values(effects(op)).some(Boolean))
            this.report(op, 'SW2006', 'Package definitions may use only parameters and nested operations.');
        const cycle = (x: Executable, stack: Set<Executable>): boolean => { if (stack.has(x))
            return true; return (body(x) ? nodes(body(x)!) : []).filter(a.isCallExpression).some(call => { const t = this.callTarget(call, c); return t && isExecutable(t) && cycle(t, new Set([...stack, x])); }); };
        if (cycle(op, new Set()))
            this.report(op, 'SW2006', 'Operation calls must be acyclic; recursion is forbidden.');
        if(b.states.length&&owner(op,isExecutable))this.report(op,'SW2008','A stateful operation must be directly component-owned with one on start entry.');
        if (b.states.length)
            this.states(op, c, env);
        else {
            this.block(b, env, c, op);
            if (typeKey(sig.result) !== 'void' && !this.terminates(b) && !identity(sig).startsWith('Swaml::Math::'))
                this.report(op, 'SW2006', 'A non-void operation must return or fail on every path.');
        }
        if (sig.parameters.some(p => p.direction === 'out')) this.outFlow(op,c);
        if (c && effects(op, c).writes && effects(op, c).suspends) {
            const attrs = new Set(members(c).filter(a.isAttribute).map(x => x.name));
            let suspended = false, read = false;
            for (const n of nodes(b)) {
                if (a.isReferenceExpression(n) && attrs.has(n.path.split('.')[0]) && !suspended)
                    read = true;
                if (a.isWait(n) || a.isReceive(n) || a.isCallExpression(n) && (!this.callTarget(n, c) || !isExecutable(this.callTarget(n, c)!) || effects(this.callTarget(n, c) as Executable, c).suspends))
                    suspended = true;
                if (read && suspended && a.isAssign(n) && attrs.has(n.target)) {
                    this.report(n, 'SW2011', 'A read before suspension may influence this write. Recheck live attributes after resuming.', true);
                    break;
                }
            }
        }
    }
    private outFlow(op: Executable, c?: Structure): void {
        const outs = signature(op)!.parameters.filter(p => p.direction === 'out').map(p => p.name), check = (at: AstNode, assigned: Set<string>) => { for (const name of outs)
            if (!assigned.has(name))
                this.report(at, 'SW2006', 'Out parameter ' + name + ' must be assigned before successful return.'); };
        const read = (e: a.Expression | undefined, assigned: Set<string>): void => {
            if (!e)
                return;
            if (a.isReferenceExpression(e) && outs.includes(e.path.split('.')[0]) && !assigned.has(e.path.split('.')[0]))
                this.report(e, 'SW2006', 'Out parameter is read before assignment.');
            if (a.isCallExpression(e)) {
                const target = this.callTarget(e, c), params = target ? (isExecutable(target) ? signature(target)?.parameters : target.parameters) : [];
                e.args.forEach((arg, i) => { if (params?.[i]?.direction !== 'out')
                    read(arg, assigned); });
                return;
            }
            if (a.isBinaryExpression(e)) {
                read(e.left, assigned);
                read(e.right, assigned);
            }
            if (a.isUnaryExpression(e))
                read(e.operand, assigned);
            if (a.isTryExpression(e)) {
                read(e.expression, assigned);
                read(e.fallback, assigned);
            }
            if (a.isArrayLiteral(e))
                e.values.forEach(x => read(x, assigned));
            if (a.isRecordLiteral(e))
                e.fields.forEach(x => read(x.value, assigned));
            if (a.isReferenceExpression(e) && e.index)
                read(e.index, assigned);
        };
        const written = (e: a.Expression): Set<string> => { if (a.isTryExpression(e)) {
            const left = written(e.expression), right = e.fallback ? written(e.fallback) : new Set<string>();
            return new Set([...left].filter(x => right.has(x)));
        } if (!a.isCallExpression(e))
            return new Set(); const target = this.callTarget(e, c), params = target ? (isExecutable(target) ? signature(target)?.parameters : target.parameters) : []; return new Set(e.args.flatMap((arg, i) => params?.[i]?.direction === 'out' && a.isReferenceExpression(arg) && outs.includes(arg.path) ? [arg.path] : [])); };
        const join = (branches: (Set<string> | undefined)[]): Set<string> | undefined => { const live = branches.filter((x): x is Set<string> => !!x); return live.length ? new Set([...live[0]].filter(x => live.every(s => s.has(x)))) : undefined; };
        const flow = (b: a.Block | a.OperationBody, input: Set<string>): Set<string> | undefined => {
            let assigned = new Set(input);
            for (const stmt of b.statements) {
                if (a.isReturn(stmt)) {
                    read(stmt.value, assigned);
                    check(stmt, assigned);
                    return undefined;
                }
                if (a.isFail(stmt))
                    return undefined;
                if (a.isAssign(stmt)) {
                    read(stmt.value, assigned);
                    if (outs.includes(stmt.target))
                        assigned.add(stmt.target);
                }
                else if (a.isLocalVariable(stmt))
                    read(stmt.value, assigned);
                else if (a.isExpressionStatement(stmt)) {
                    read(stmt.expression, assigned);
                    for (const name of written(stmt.expression))
                        assigned.add(name);
                }
                else if (a.isIf(stmt)) {
                    read(stmt.condition, assigned);
                    const merged = join([flow(stmt.then, assigned), stmt.otherwise ? flow(stmt.otherwise, assigned) : assigned]);
                    if (!merged)
                        return undefined;
                    assigned = merged;
                }
                else if (a.isWhile(stmt) || a.isUntil(stmt)) {
                    read(stmt.limit, assigned);
                    const after = flow(stmt.body, assigned);
                    if (a.isUntil(stmt) && (!stmt.limit || (constantNumber(stmt.limit) ?? 0) > 0)) {
                        if (!after)
                            return undefined;
                        assigned = after;
                    }
                    read(stmt.condition, assigned);
                }
                else if (a.isFor(stmt)) {
                    read(stmt.initializer.value, assigned);
                    read(stmt.condition, assigned);
                    flow(stmt.body, assigned);
                    read(stmt.update.value, assigned);
                }
                else if (a.isForEach(stmt)) {
                    read(stmt.collection, assigned);
                    const after=flow(stmt.body,assigned),extent=/\[(\d+)\]$/.exec(expressionTypes.get(stmt.collection)??'');if(extent&&Number(extent[1])>0){if(!after)return undefined;assigned=after;}
                }
                else if (a.isReceive(stmt)) {
                    const merged = join([...stmt.branches.map(br => flow(br.body, assigned)), ...(stmt.timeoutBody ? [flow(stmt.timeoutBody, assigned)] : [])]);
                    if (!merged)
                        return undefined;
                    assigned = merged;
                }
                else if (a.isInterruptible(stmt)) {
                    const merged = join([flow(stmt.body, assigned), flow(stmt.handler, assigned)]);
                    if (!merged)
                        return undefined;
                    assigned = merged;
                }
                else if (a.isAssert(stmt))
                    read(stmt.condition, assigned);
                else if (a.isSend(stmt))
                    stmt.args.forEach(e => read(e, assigned));
            }
            return assigned;
        };
        const end = flow(body(op)!, new Set());
        if (end)
            check(op, end);
    }
    private callTarget(call: a.CallExpression, c?: Structure): Executable | a.PortMember | undefined {
        if (call.target.includes('.'))
            return c && memberEndpoint(c, call.target)?.member;
        const t = localOperation(call, call.target, c) ?? resolve(call, call.target, this.models);
        return t && isExecutable(t) ? t : undefined;
    }
    private value(e: a.Expression, expected: string, env: Env, c?: Structure, op?: Executable, suspend = false): void {
        const actual = this.infer(e, env, c, op, suspend), match = /^(.*)\[(\d+)\]$/.exec(expected);
        if (a.isArrayLiteral(e) && match) {
            if (e.values.length !== Number(match[2]))
                this.report(e, 'SW2002', `Expected ${expected}, received ${actual}.`);
            for (const v of e.values)
                this.value(v, match[1], env, c, op);
        }
        else if (!(integral(actual) && integral(expected) && constantNumber(e) === undefined) && !assignable(actual, expected, constantNumber(e)))
            this.report(e, 'SW2002', `Expected ${expected}, received ${actual}.`);
        if (!op)
            for (const call of nodes(e).filter(a.isCallExpression)) {
                const t = this.callTarget(call, c);
                if (t && (!isExecutable(t) || Object.values(effects(t, c)).some(Boolean)))
                    this.report(e, 'SW2006', 'Attribute initializers must be pure.');
            }
    }
    private infer(e: a.Expression | undefined, env: Env, c?: Structure, op?: Executable, allow = false): string { const t=this.inferValue(e,env,c,op,allow);if(e)expressionTypes.set(e,t);return t;}
    private inferValue(e: a.Expression | undefined, env: Env, c?: Structure, op?: Executable, allow = false): string {
        if (!e)
            return 'void';
        if (a.isLiteral(e)) {
            if (e.number !== undefined) {
                if (!Number.isFinite(e.number) || !e.$cstNode?.text.includes('.') && !Number.isSafeInteger(e.number))
                    this.report(e, 'SW2002', 'Numeric literal is outside its domain.');
                return e.$cstNode?.text.includes('.') ? 'real' : 'int';
            }
            return e.boolean !== undefined ? 'bool' : 'string';
        }
        if (a.isReferenceExpression(e)) {
            const [head, ...fields] = e.path.split('.');
            let t = env.get(head)?.type;
            if (!t) {
                const en = resolve(e, head, this.models);
                if (a.isEnumType(en) && fields.length === 1 && en.literals.includes(fields[0]))
                    return identity(en);
                this.report(e, 'SW2002', `Unknown local value ${e.path}; nested operations never capture enclosing locals and component attributes are private.`);
                return '?';
            }
            for (const field of fields) {
                const record = this.models.flatMap(m => m.packages.flatMap(p => p.elements)).find(x => identity(x) === t);
                const f: a.Field | undefined = a.isDataType(record) ? record.fields.find(x => x.name === field) : undefined;
                if (!f) {
                    this.report(e, 'SW2002', `No field ${field} on ${t}.`);
                    return '?';
                }
                t = typeKey(f.type);
            }
            if (e.index) {
                if (!integral(this.infer(e.index, env, c, op)))
                    this.report(e.index, 'SW2002', 'Array index must be integral.');
                const match = /^(.*)\[(\d+)\]$/.exec(t), idx = constantNumber(e.index);
                if (!match || idx !== undefined && (idx < 0 || idx >= Number(match[2])))
                    this.report(e, 'SW2002', 'Array index is outside its extent.');
                return match?.[1] ?? '?';
            }
            return t;
        }
        if (a.isArrayLiteral(e)) {
            const ts = e.values.map(v => this.infer(v, env, c, op)), t = new Set(ts).size===1?ts[0]:ts.every(numeric)?ts.includes('real')?'real':'int':ts[0]??'?';
            if(!ts.length||ts.includes('void'))this.report(e,'SW2002','An array literal needs non-void values and a positive extent.');
            if (!ts.every(x => assignable(x, t)))
                this.report(e, 'SW2002', 'Array elements need compatible types.');
            return `${t}[${ts.length}]`;
        }
        if (a.isRecordLiteral(e)) {
            const d = e.type.ref;
            if (!d)
                return '?';
            this.unique(e.fields, e);
            for (const f of d.fields) {
                const v = e.fields.find(x => x.name === f.name);
                if (!v)
                    this.report(e, 'SW2002', `Missing field ${f.name}.`);
                else
                    this.value(v.value, typeKey(f.type), env, c, op);
            }
            for (const f of e.fields)
                if (!d.fields.some(x => x.name === f.name))
                    this.report(f, 'SW2002', `Unknown field ${f.name}.`);
            return identity(d);
        }
        if (a.isTryExpression(e)) {
            const t = this.infer(e.expression, env, c, op, allow);
            if (!e.fallback && t !== 'void')
                this.report(e, 'SW2002', 'A value try needs a fallback.');
            if (e.fallback) {
                const ft = this.infer(e.fallback, env, c, op, allow);
                if (!(integral(ft)&&integral(t)&&constantNumber(e.fallback)===undefined) && !assignable(ft, t, constantNumber(e.fallback)))
                    this.report(e, 'SW2002', `Fallback ${ft} is not assignable to ${t}.`);
            }
            return t;
        }
        if (a.isCallExpression(e)) {
            const t = this.callTarget(e, c);
            if (!t) {
                this.report(e, 'SW2006', `Unknown operation ${e.target}; remote calls require an owned port.`);
                return '?';
            }
            if (isExecutable(t) && body(t)?.states.length)
                this.report(e, 'SW2006', 'Stateful operations are activated only by their on start entry.');
            const sig = isExecutable(t) ? signature(t) : t;
            if (!sig)
                return '?';
            if (a.isPortMember(t)) {
                const ep = c && memberEndpoint(c, e.target);
                if (!ep || t.kind !== 'operation' || direction(ep.port, t) !== 'requires')
                    this.report(e, 'SW2004', 'Remote calls need an owned required operation member.');
            }
            if ((!isExecutable(t) || effects(t, c).suspends) && !allow)
                this.report(e, 'SW2006', 'Suspending calls must be the whole initializer, assignment value or statement, optionally in try.');
            this.arguments(e, sig.parameters, e.args, env, c, op);
            if (sig.parameters.some(x => x.direction === 'out') && !a.isExpressionStatement(e.$container) && !(a.isTryExpression(e.$container) && a.isExpressionStatement(e.$container.$container)))
                this.report(e, 'SW2006', 'A call with out arguments must be a statement.');
            return typeKey(sig.result);
        }
        if (a.isUnaryExpression(e)) {
            const t = this.infer(e.operand, env, c, op);
            if (e.operator === 'not') {
                if (t !== 'bool' && t !== '?')
                    this.report(e, 'SW2002', 'not needs bool.');
                return 'bool';
            }
            if (!numeric(t) && t !== '?')
                this.report(e, 'SW2002', 'Minus needs a number.');
            return t === 'real' ? 'real' : 'int';
        }
        const l = this.infer(e.left, env, c, op), r = this.infer(e.right, env, c, op);
        if (['and', 'or'].includes(e.operator)) {
            if (![l, r].every(x => x === 'bool' || x === '?'))
                this.report(e, 'SW2002', 'Boolean operators need bool.');
            return 'bool';
        }
        if (['==', '!=', '<', '<=', '>', '>='].includes(e.operator)) {
            if(l==='void'||r==='void')this.report(e,'SW2002','Void completion is not an expression value.');
            if (['==', '!='].includes(e.operator) ? !(l === r || numeric(l) && numeric(r)) : !(numeric(l) && numeric(r)))
                this.report(e, 'SW2002', 'Incompatible comparison.');
            return 'bool';
        }
        if (e.operator === '+' && l === 'string' && r === 'string')
            return 'string';
        if (!numeric(l) || !numeric(r) || e.operator === '%' && (!integral(l) || !integral(r)))
            this.report(e, 'SW2002', 'Arithmetic needs compatible numbers.');
        return e.operator === '/' || l === 'real' || r === 'real' ? 'real' : 'int';
    }
    private arguments(n: AstNode, params: a.Argument[], args: a.Expression[], env: Env, c?: Structure, op?: Executable): void {
        if (params.length !== args.length)
            this.report(n, 'SW2002', `Expected ${params.length} arguments, received ${args.length}.`);
        params.forEach((p, i) => { const v = args[i]; if (!v)
            return; if (p.direction === 'out') {
            if (!a.isReferenceExpression(v) || v.path.includes('.') || v.index || !env.get(v.path)?.mutable || !assignable(typeKey(p.type), env.get(v.path)?.type ?? '?'))
                this.report(v, 'SW2006', 'An out argument needs a mutable compatible local, out parameter or attribute.');
        }
        else
            this.value(v, typeKey(p.type), env, c, op); });
    }
    private block(b: a.Block | a.OperationBody, inherited: Env, c: Structure | undefined, op: Executable): void {
        const env = new Map(inherited);
        for (const s of b.statements) {
            if (a.isLocalVariable(s)) {
                this.value(s.value, typeKey(s.type), env, c, op, true);
                if (env.has(s.name))
                    this.report(s, 'SW2001', `Local ${s.name} shadows a live name.`);
                env.set(s.name, { type: typeKey(s.type), mutable: true });
            }
            else if (a.isAssign(s)) {
                const cell = env.get(s.target);
                if (!cell?.mutable)
                    this.report(s, 'SW2006', `Cannot assign ${s.target}; inputs and const attributes are immutable.`);
                this.value(s.value, cell?.type ?? '?', env, c, op, true);
            }
            else if (a.isExpressionStatement(s)) {
                const t = this.infer(s.expression, env, c, op, true), target = a.isCallExpression(s.expression) && this.callTarget(s.expression, c), out = target && (isExecutable(target) ? signature(target)?.parameters : target.parameters)?.some(x => x.direction === 'out');
                if (t !== 'void' && t !== '?')
                    this.report(s, 'SW2006', 'A non-void result cannot be discarded.');
                if (!a.isCallExpression(s.expression) && !a.isTryExpression(s.expression))
                    this.report(s, 'SW2006', 'Expression statements must call an operation or try.');
            }
            else if (a.isReturn(s)) {
                if (body(op)?.states.length)
                    this.report(s, 'SW2008', 'A stateful operation completes by reaching final state, not return.');
                const t = typeKey(signature(op)?.result);
                if (!s.value && t !== 'void' || s.value && t === 'void')
                    this.report(s, 'SW2002', 'Return does not match the result.');
                if (s.value)
                    this.value(s.value, t, env, c, op);
            }
            else if (a.isIf(s)) {
                this.value(s.condition, 'bool', env, c, op);
                this.block(s.then, env, c, op);
                if (s.otherwise)
                    this.block(s.otherwise, env, c, op);
            }
            else if (a.isWhile(s) || a.isUntil(s)) {
                this.value(s.condition, 'bool', env, c, op);
                if (s.limit)
                    this.value(s.limit, 'uint', env, c, op);
                this.block(s.body, env, c, op);
            }
            else if (a.isFor(s)) {
                const loop = new Map(env);
                this.value(s.initializer.value, typeKey(s.initializer.type), env, c, op);
                if (env.has(s.initializer.name))
                    this.report(s, 'SW2001', 'Loop local shadows a live name.');
                loop.set(s.initializer.name, { type: typeKey(s.initializer.type), mutable: true });
                this.value(s.condition, 'bool', loop, c, op);
                if (!loop.get(s.update.target)?.mutable)
                    this.report(s.update, 'SW2006', 'Invalid loop update.');
                this.value(s.update.value, loop.get(s.update.target)?.type ?? '?', loop, c, op);
                this.block(s.body, loop, c, op);
            }
            else if (a.isForEach(s)) {
                const t = this.infer(s.collection, env, c, op), match = /^(.*)\[(\d+)\]$/.exec(t);
                if (!match || !assignable(match[1], typeKey(s.variable.type)))
                    this.report(s, 'SW2002', 'for in needs a compatible fixed array.');
                const loop = new Map(env);
                if (env.has(s.variable.name))
                    this.report(s, 'SW2001', 'Element shadows a live name.');
                loop.set(s.variable.name, { type: typeKey(s.variable.type), mutable: false });
                this.block(s.body, loop, c, op);
            }
            else if (a.isAssert(s))
                this.value(s.condition, 'bool', env, c, op);
            else if (a.isSend(s)) {
                const ep = c && memberEndpoint(c, s.endpoint);
                if (!ep || direction(ep.port, ep.member) !== 'provides' || ep.member.kind !== (s.kind === 'send' ? 'attribute' : 'event'))
                    this.report(s, 'SW2004', 'Emission needs a matching owned provided member.');
                else if (ep.member.kind === 'attribute') {
                    if (s.args.length !== 1)
                        this.report(s, 'SW2002', 'send needs one value.');
                    if (s.args[0])
                        this.value(s.args[0], typeKey(ep.member.type), env, c, op);
                }
                else
                    this.arguments(s, ep.member.parameters, s.args, env, c, op);
            }
            else if (a.isReceive(s)) {
                for (const br of s.branches)
                    this.block(br.body, this.inputEnv(br, env, c), c, op);
                if (s.timeoutBody)
                    this.block(s.timeoutBody, env, c, op);
            }
            else if (a.isInterruptible(s)) {
                if (body(op)?.states.length)
                    this.report(s, 'SW2006', 'Interrupt regions cannot occur in stateful operations.');
                this.block(s.body, env, c, op);
                this.block(s.handler, this.inputEnv(s, env, c), c, op);
                this.report(s, 'SW2012', `Input ${s.endpoint} is discarded while this region is inactive.`, true);
            }
        }
    }
    private inputEnv(n: {
        endpoint?: string;
        bindings: string[];
    } & AstNode, env: Env, c?: Structure, operation = false): Env {
        const result = new Map(env), ep = c && n.endpoint && memberEndpoint(c, n.endpoint);
        if (!ep || (ep.member.kind === 'operation') !== operation || direction(ep.port, ep.member) !== (operation ? 'provides' : 'requires')) {
            this.report(n, 'SW2005', 'Input needs the matching owned member direction/kind.');
            return result;
        }
        const types = ep.member.kind === 'attribute' ? [typeKey(ep.member.type)] : ep.member.parameters.map(x => typeKey(x.type));
        if (types.length !== n.bindings.length || new Set(n.bindings).size !== n.bindings.length)
            this.report(n, 'SW2002', 'Input bindings must uniquely match every parameter.');
        n.bindings.forEach((name, i) => { if (env.has(name))
            this.report(n, 'SW2001', `Input ${name} shadows a live name.`); result.set(name, { type: types[i] ?? '?', mutable: operation && ep.member.parameters[i]?.direction === 'out' }); });
        return result;
    }
    private terminates(b: a.Block | a.OperationBody): boolean { return b.statements.some(s => a.isReturn(s) || a.isFail(s) || a.isIf(s) && !!s.otherwise && this.terminates(s.then) && this.terminates(s.otherwise) || a.isInterruptible(s) && this.terminates(s.body) && this.terminates(s.handler) || a.isUntil(s) && this.terminates(s.body) && (!s.limit||(constantNumber(s.limit)??0)>0) || a.isForEach(s) && /\[[1-9]\d*\]$/.test(expressionTypes.get(s.collection)??'') && this.terminates(s.body)); }
    private schedules(c: Structure): void {
        const entries = schedule(c), keys = new Set<string>();
        for (const e of c.members.filter(a.isSchedule).flatMap(s => s.entries)) {
            const k = entryKey(e);
            if (keys.has(k))
                this.report(e, 'SW2007', 'Duplicate (trigger, operation) entry.');
            keys.add(k);
        }
        const ops = members(c).filter(isExecutable), graph = new Map<string, string[]>();
        for (const e of entries) {
            const op = ops.find(x => x.name === e.operation), sig = op && signature(op);
            if (!op || !sig) {
                this.report(e, 'SW2007', `Unknown same-owner operation ${e.operation}.`);
                continue;
            }
            const env = e.endpoint ? this.inputEnv(e, this.env(c), c, e.kind === 'call') : this.env(c);
            this.arguments(e, sig.parameters, e.args, env, c, op);
            if (e.kind !== 'call' && (typeKey(sig.result) !== 'void' || sig.parameters.some(p => p.direction === 'out')))
                this.report(e, 'SW2007', 'Only on call entries may bind results/out parameters.');
            if (e.kind === 'call') {
                const ep = memberEndpoint(c, e.endpoint!);
                if (ep) {
                    if (!assignable(typeKey(sig.result), typeKey(ep.member.result)) || sig.parameters.length !== ep.member.parameters.length || sig.parameters.some((p, i) => (p.direction ?? 'in') !== (ep.member.parameters[i]?.direction ?? 'in')))
                        this.report(e, 'SW2007', 'Serving signature/result must match the provided operation.');
                    const outBindings = new Set(ep.member.parameters.flatMap((p, i) => p.direction === 'out' ? [e.bindings[i]] : []));
                    const targets = sig.parameters.flatMap((p, i) => p.direction === 'out' && a.isReferenceExpression(e.args[i]) ? [(e.args[i] as a.ReferenceExpression).path] : []);
                    if (targets.length !== outBindings.size || new Set(targets).size !== targets.length || targets.some(x => !outBindings.has(x)))
                        this.report(e, 'SW2007', 'Serving out arguments must assign every provided out binding exactly once.');
                    sig.parameters.forEach((p, i) => { if (p.direction !== 'out' && e.args[i])
                        for (const n of nodes(e.args[i]).filter(a.isReferenceExpression))
                            if (outBindings.has(n.path.split('.')[0]))
                                this.report(n, 'SW2006', 'A provided out binding cannot be read before its serving operation returns.'); });
                }
            }
            if (e.concurrent)
                for (const arg of e.args)
                    for (const call of nodes(arg).filter(a.isCallExpression)) {
                        const target = this.callTarget(call, c);
                        if (target && isExecutable(target) && effects(target, c).writes)
                            this.report(e, 'SW2006', 'Concurrent dispatch arguments cannot write state.');
                    }
            if (e.concurrent && (effects(op, c).writes || body(op)?.states.length))
                this.report(e, 'SW2006', 'Concurrent entries cannot write state through any callee or be stateful.');
            if (e.kind === 'every' && e.deadline && nanos(e.deadline) > nanos(e.period!))
                this.report(e, 'SW2007', 'Periodic deadline cannot exceed its period.');
            if (e.kind === 'after') {
                if (!ops.some(x => x.name === e.predecessor) || !entries.some(x => x.operation === e.predecessor))
                    this.report(e, 'SW2007', 'after needs a scheduled same-owner predecessor.');
                if (sig.parameters.length || typeKey(sig.result) !== 'void' || body(op)?.states.length)
                    this.report(e, 'SW2007', 'after targets are parameterless void flow operations.');
                graph.set(e.predecessor!, [...(graph.get(e.predecessor!) ?? []), op.name]);
            }
            if (body(op)?.states.length && (entries.filter(x => x.operation === op.name).length !== 1 || e.kind !== 'start'))
                this.report(e, 'SW2008', 'A stateful operation needs exactly one on start entry.');
        }
        const cyclic = (name: string, seen: Set<string>): boolean => seen.has(name) || (graph.get(name) ?? []).some(x => cyclic(x, new Set([...seen, name])));
        for (const name of graph.keys())
            if (cyclic(name, new Set())) {
                this.report(c, 'SW2007', 'after dependencies must be acyclic.');
                break;
            }
        for (const op of ops)
            if (body(op)?.states.length && !entries.some(e => e.operation === op.name))
                this.report(op, 'SW2008', 'A stateful operation needs an on start entry.');
    }
    private states(op: Executable, c: Structure | undefined, env: Env): void {
        const b = body(op)!, sig = signature(op)!;
        if (sig.parameters.length || typeKey(sig.result) !== 'void')
            this.report(op, 'SW2008', 'A stateful operation is parameterless void.');
        this.unique(b.states, op);
        if (!b.states.some(s => s.name === b.initial))
            this.report(op, 'SW2008', 'Unknown initial state.');
        const reachable = new Set<string>(), visit = (name: string) => { if (reachable.has(name))
            return; reachable.add(name); for (const t of b.states.find(s => s.name === name)?.transitions ?? [])
            visit(t.target); };
        visit(b.initial!);
        for (const state of b.states) {
            if (!reachable.has(state.name))
                this.report(state, 'SW2008', `Unreachable state ${state.name}.`);
            if (state.final && (state.transitions.length || state.actions.some(x => x.kind === 'exit')))
                this.report(state, 'SW2008', 'Final states have no transitions or exit action.');
            for (const kind of ['entry', 'exit'])
                if (state.actions.filter(x => x.kind === kind).length > 1)
                    this.report(state, 'SW2008', `Duplicate on ${kind} action.`);
            for (const ac of state.actions)
                this.block(ac.body, env, c, op);
            for (const t of state.transitions) {
                if (!b.states.some(s => s.name === t.target))
                    this.report(t, 'SW2008', `Unknown state ${t.target}.`);
                const input = t.endpoint ? this.inputEnv(t, env, c) : env;
                if (t.guard) {
                    this.value(t.guard, 'bool', input, c, op);
                    for (const call of nodes(t.guard).filter(a.isCallExpression)) {
                        const target = this.callTarget(call, c);
                        if (!target || !isExecutable(target) || effects(target, c).writes || effects(target, c).communicates || effects(target, c).suspends)
                            this.report(t.guard, 'SW2006', 'State guards may only be pure or read state.');
                    }
                }
                this.block(t.effect, input, c, op);
            }
        }
    }
    private ownership(c: Structure, forwarded: Set<string>): void {
        // An interface-only component needs no implementation: it neither emits nor owns inputs.
        if (interfaceOnly(c))
            return;
        const owners = new Map<string, Set<AstNode>>(), emitted = new Set<string>();
        const add = (path: string, n: AstNode) => { const set = owners.get(path) ?? new Set(); set.add(n); owners.set(path, set); };
        for (const e of schedule(c))
            if (e.endpoint)
                add(e.endpoint, e);
        for (const op of members(c).filter(isExecutable)) {
            const b = body(op);
            if (!b)
                continue;
            for (const n of nodes(b)) {
                if (a.isSend(n))
                    emitted.add(n.endpoint);
                if (a.isReceiveBranch(n) || a.isInterruptible(n))
                    add(n.endpoint, n);
                if (a.isTransition(n) && n.endpoint)
                    add(n.endpoint, op);
            }
        }
        for (const p of members(c).filter(a.isPortUsage))
            for (const m of portMembers(p)) {
                const path = `${p.name}.${m.name}`, input = direction(p, m) === (m.kind === 'operation' ? 'provides' : 'requires');
                if (forwarded.has(p.name)) {
                    if (owners.has(path) || emitted.has(path))
                        this.report(p, 'SW2005', `Forwarded port ${p.name} cannot be locally handled/emitted.`);
                    continue;
                }
                if (input && owners.get(path)?.size !== 1)
                    this.report(p, 'SW2005', `${path} needs exactly one input owner.`);
                if (!input && m.kind !== 'operation' && !emitted.has(path))
                    this.report(p, 'SW2005', `${path} needs an emitting operation.`);
            }
    }
    private deployment(d: a.Deployment): void {
        const root = d.root.ref, platform = d.platform.ref;
        if (!root || !platform || occurrenceCount(root) > OCCURRENCE_LIMIT || occurrenceCount(platform) > OCCURRENCE_LIMIT)
            return;
        if (!isNode(platform))
            this.report(d, 'SW2009', 'The platform root must specialize Swaml::Platform::Node.');
        const software = occurrences(root), targets = occurrences(platform), seen = new Set<string>();
        for (const p of d.placements) {
            const path = p.target ? `${root.name}.${p.target}` : root.name;
            if (seen.has(path))
                this.report(p, 'SW2009', 'Duplicate exact deployment path.');
            seen.add(path);
            if (!software.some(o => o.path === path || p.target && o.path.startsWith(`${path}[`)))
                this.report(p, 'SW2009', `Unknown software occurrence ${path}.`);
            const target = targets.find(o => o.path === `${platform.name}.${p.node}`);
            if (!target || !isNode(target.structure))
                this.report(p, 'SW2009', `Target ${p.node} must be a Node occurrence.`);
        }
    }
    private view(v: a.View): void {
        const kind = v.definition.ref?.name;
        if (!kind)
            return;
        for (const sel of v.subject ? [{ subject: v.subject }] : v.selections)
            if (!this.selectView({ ...v, subject: sel.subject, selections: [] }).length)
                this.report(v, 'SW2010', 'Unknown or ambiguous view subject ' + sel.subject + '.');
        const selected = this.selectView(v);
        if (!selected.length)
            this.report(v, 'SW2010', 'View selects no subjects.');
        for (const item of selected)
            if (['Flow', 'Timing'].includes(kind) && !isExecutable(item.node) || kind === 'Interconnect' && !a.isComponentUsage(item.node) && !a.isComponentDef(item.node) || ['Case', 'Sequence'].includes(kind) && !a.isScenario(item.node) && !a.isComponentUsage(item.node) && !a.isComponentDef(item.node) && !a.isPackage(item.node))
                this.report(v, 'SW2010', `Subject ${item.path} is not valid for ${kind}.`);
    }
    /** Package connections join ports of top-level occurrences declared in the same package. */
    private packageConnections(p: a.Package): void {
        const pairs = new Set<string>();
        for (const link of p.connections) {
            const ends = [link.source, link.target].map(path => packageEndpoint(p, path));
            if (!ends[0] || !ends[1]) {
                for (const path of [link.source, link.target].filter((_, i) => !ends[i])) {
                    const head = path.split(/[.[]/)[0], found = resolve(p, head, this.models);
                    this.report(link, 'SW2004', found && !p.elements.includes(found)
                        ? `Occurrences cannot be connected across packages: ${head} is not declared in package ${p.name}. Declare a top-level occurrence here.`
                        : `Package connection end ${path} must name a port of a top-level component occurrence of package ${p.name}.`);
                }
                continue;
            }
            const pair = [link.source, link.target].sort().join('|');
            if (link.source === link.target || pairs.has(pair))
                this.report(link, 'SW2004', 'Duplicate or self connector.');
            pairs.add(pair);
            for (const issue of compatibility(ends[0].port, ends[1].port))
                this.report(link, 'SW2004', `Connection: ${issue}.`);
            if (effectiveQos(link).delivery === 'atLeastOnce')
                for (const ep of ends)
                    for (const m of portMembers(ep!.port))
                        if (m.kind === 'operation' && direction(ep!.port, m) === 'provides' && !m.idempotent)
                            this.report(link, 'SW2013', `atLeastOnce requires idempotent provided operation ${ep!.path}.${m.name}.`);
        }
        // Closure is per package: each required port of every occurrence needs a peer, either inside
        // its component or, for a port of a top-level occurrence, through a package connection.
        // A top-level occurrence with a containment cycle or above the reference limit is reported elsewhere and skipped here.
        const roots = packageOccurrences(p).filter(r => !this.containmentCycle(r, new Set()) && occurrenceCount(r) <= OCCURRENCE_LIMIT), checked = new Set(roots.map(r => r.name));
        const { occurrences: occ, links, leaf } = connectionRoutes(p), counts = new Map<string, number>(), routes = new Set<string>();
        for (const link of links) {
            const pair = [...link.ends].sort().join('|');
            if (routes.has(pair))
                this.report(link.owner === undefined ? link.node : roots.find(r => r.name === link.owner!.split('.')[0]) ?? p, 'SW2004', 'Duplicate connection after forwarding resolution.');
            routes.add(pair);
            for (const end of link.ends)
                counts.set(end, (counts.get(end) ?? 0) + 1);
        }
        for (const o of occ.filter(o => checked.has(o.path.split('.')[0])))
            for (const port of members(o.structure).filter(a.isPortUsage)) {
                const path = o.path + '.' + port.name, count = counts.get(leaf(path)) ?? 0;
                if (!port.optional && !count)
                    this.report(port, 'SW2004', `Unconnected required port ${path} in package ${p.name}.`);
                if (count > 1 && portMembers(port).some(m => direction(port, m) === 'requires' && m.kind !== 'event'))
                    this.report(port, 'SW2004', `Port ${path} requires exactly one peer after forwarding.`);
            }
    }
    /** Cases, associations, satisfy and verify claims are package members that record intent. */
    private links(p: a.Package): void {
        const local = (n: AstNode | undefined) => !!n && n.$container === p;
        const at = (n: AstNode, property: string) => ({ range: GrammarUtils.findNodeForProperty(n.$cstNode, property)?.range });
        for (const s of p.elements.filter(a.isScenario)) {
            const subject = s.subject?.ref;
            if (subject && !local(subject))
                this.report(s, 'SW2010', `The subject of ${s.name} must be a top-level component occurrence of package ${p.name}; write the case in the package that declares ${subject.name}.`, false, at(s, 'subject'));
        }
        const associated = new Set<string>();
        for (const x of p.associations) {
            const occurrence = x.occurrence.ref, target = x.target.ref;
            if (occurrence && !local(occurrence))
                this.report(x, 'SW2010', `associate names a top-level component occurrence of package ${p.name}; ${occurrence.name} is declared elsewhere.`, false, at(x, 'occurrence'));
            if (target && !local(target))
                this.report(x, 'SW2010', `associate names a use case or test of package ${p.name}; ${target.name} is declared elsewhere.`, false, at(x, 'target'));
            if (occurrence && target && target.subject?.ref === occurrence)
                this.report(x, 'SW2010', `${occurrence.name} is the subject of ${target.name}; associate names another participant.`, false, at(x, 'occurrence'));
            const key = x.occurrence.$refText + '|' + x.target.$refText;
            if (associated.has(key))
                this.report(x, 'SW2010', `Duplicate associate ${x.occurrence.$refText} to ${x.target.$refText}.`);
            associated.add(key);
        }
        const claims = new Set<string>();
        for (const x of p.satisfactions) {
            const head = x.design.split(/[.[]/)[0], found = resolve(p, head, this.models);
            if (!designComponent(p, x.design))
                this.report(x, 'SW2010', found && !p.elements.includes(found)
                    ? `satisfy names a component declared in package ${p.name}; write this claim in the package that declares ${head}.`
                    : `satisfy by names a component definition or component occurrence path of package ${p.name}; ${x.design} is not one.`, false, at(x, 'design'));
            const key = (x.requirement.ref ? identity(x.requirement.ref) : x.requirement.$refText) + '|' + x.design;
            if (claims.has(key))
                this.report(x, 'SW2010', `Duplicate satisfy ${x.requirement.$refText} by ${x.design}.`);
            claims.add(key);
        }
        const verified = new Set<string>();
        for (const x of p.verifications) {
            const test = x.test.ref;
            if (test && !local(test))
                this.report(x, 'SW2010', `verify names a test of package ${p.name}; ${test.name} is declared elsewhere.`, false, at(x, 'test'));
            else if (test && test.kind !== 'test')
                this.report(x, 'SW2010', `verify names a test; ${test.name} is a use case.`, false, at(x, 'test'));
            const key = (x.requirement.ref ? identity(x.requirement.ref) : x.requirement.$refText) + '|' + x.test.$refText;
            if (verified.has(key))
                this.report(x, 'SW2010', `Duplicate verify ${x.requirement.$refText} by ${x.test.$refText}.`);
            verified.add(key);
        }
    }
}
