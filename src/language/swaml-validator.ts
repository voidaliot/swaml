import { AstUtils, CstUtils, DocumentState, GrammarUtils, WorkspaceCache, type AstNode, type ValidationAcceptor } from 'langium';
import type { Range } from 'vscode-languageserver';
import type { LangiumServices } from 'langium/lsp';
import * as a from './generated/ast.js';
import { associatedOccurrences, associationOccurrences, associationPairs, associationTargets, isAssociationList, caseRead, conditionalType, caseTarget, isPlace, pathSteps, placeRoot, valueSteps, walkParts, type PartProblem, type Step, testCanAccess, caseCallAccess, caseCallRestriction, allowsSuspendingCall, connectionRoutes, designComponent, interfaceOnly, packageEndpoint, packageOccurrences, expressionTypes, OCCURRENCE_LIMIT, occurrenceCount, workspaceModels, assignable, body, compatibility, constantNumber, direction, effectiveQos, effects, endpoint, entryKey, identity, integral, isExecutable, isNode, localOperation, memberEndpoint, members, nanos, nodes, numeric, occurrences, owner, resolve, schedule, signature, typeKey, type Executable, type Node, type Structure, portMembers } from './semantic.js';
import { selectView, viewCandidates, type ViewSubject } from './presentation.js';
import { MESSAGE_SPELLING, decodeQuotedName, formatName, formatPath, formatQualifiedName, nameProblem } from './names.js';
import { staleWrite, STALE_READ_WORK_LIMIT, type StaleReadBudget, type Summary } from './stale-read.js';
const EXPRESSION_TYPES = new Set(['ConditionalExpression', 'BinaryExpression', 'UnaryExpression', 'Literal', 'CallExpression', 'TryExpression', 'ReferenceExpression', 'RecordLiteral', 'ArrayLiteral']);
/** Whether an expression is inside a conditional expression (WP2-S04). */
const insideConditional = (e: AstNode): boolean => { for (let n = e.$container; n && (isExpression(n) || a.isFieldValue(n) || a.isSelector(n)); n = n.$container) if (a.isConditionalExpression(n)) return true; return false; };
/** The name of the attribute, requirement attribute or policy setting whose initializer contains e. */
const initialized = (e: AstNode): string => { for (let n: AstNode | undefined = e; n; n = n.$container) if (a.isAttribute(n) || a.isPolicySetting(n) || a.isPortMember(n)) return n.name; return ''; };
const isExpression = (n: unknown): n is a.Expression => !!n && typeof n === 'object' && EXPRESSION_TYPES.has((n as AstNode).$type);
import { flowStates, innerStates, stateItems, forwardedPorts, isSampledMember, memberPolicy, memberQos, optsIn, sampledMembers, sampledReadForm, sampledReads, useEffectCache, isClockRead, declaredIntrinsic, LIBRARY_3_0_URI, container, constantValue, displayText, entryDeadline, entryPeriod, representableDuration, settingDuration, triggerIdentity, type ConstantProblem } from './semantic.js';
import { ambiguousNameMessage } from './swaml-scope.js';
import type { Occurrence } from './semantic.js';
import { coreText, deploymentPlan, durationText, entryLabel, pathText, predecessors, statementText, suspendSite, type DeploymentPlan, type EntryPlacement, type OsTask } from './placement.js';
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
    /** Statement visits of the stale-read analysis per document; a reference validation limit (tests may lower it). */
    static staleReadWorkLimit = STALE_READ_WORK_LIMIT;
    /** Test-only: analyse SW2011 without merging summary records, as the reference for the merged analysis. */
    static staleReadUnmerged = false;
    /** SW2011 summaries and work of one validation pass. */
    private staleSummaries = new Map<Structure, Map<Executable, Summary>>();
    private staleBudget: StaleReadBudget = { work: 0 };
    private staleLimitReported = false;
    /** Errors reported so far, so that a rule can tell whether a node it checks already has one (WP5-D08). */
    private errorCount = 0;
    private report(n: AstNode, code: string, message: string, warning = false, extra: { range?: Range; edits?: { range: Range; newText: string }[]; declaration?: AstNode; related?: AstNode[] } = {}): void { if (!warning) this.errorCount++; const declarationDoc=AstUtils.getDocument(n),currentDoc=AstUtils.getDocument(this.currentModel),foreign=declarationDoc!==currentDoc;
        // Inherited members are checked for their definition and every usage; report each finding once.
        const reportKey=[code,message,declarationDoc.uri.toString(),JSON.stringify(extra.range??n.$cstNode?.range)].join('|');if(this.reported.has(reportKey))return;this.reported.add(reportKey);
        const declarationOwner=owner(n,(x):x is Structure=>a.isComponentDef(x)||a.isComponentUsage(x));
        const primary=foreign?this.currentModel.packages.flatMap(p=>p.elements.filter(a.isComponentUsage)).find(root=>occurrenceCount(root)<=OCCURRENCE_LIMIT&&occurrences(root).some(o=>o.structure===declarationOwner||o.definition===declarationOwner))??this.currentModel.packages[0]??this.currentModel:n;
        this.accept(warning ? 'warning' : 'error', message, { node: primary, ...(extra.range&&!foreign?{range:extra.range}:{}), code, relatedInformation:foreign?[{location:{uri:declarationDoc.uri.toString(),range:n.$cstNode!.range},message:'Declaration '+identity(n)}]:extra.related?extra.related.filter(x=>x.$cstNode).map(x=>({location:{uri:AstUtils.getDocument(x).uri.toString(),range:x.$cstNode!.range},message:'Declaration '+formatQualifiedName(identity(x),MESSAGE_SPELLING)})):extra.declaration?[{location:{uri:AstUtils.getDocument(extra.declaration).uri.toString(),range:extra.declaration.$cstNode!.range},message:'Declaration '+identity(extra.declaration)}]:undefined, data: { declaration: identity(extra.declaration ?? n), occurrencePaths: this.models.flatMap(m => m.packages.flatMap(p => p.elements.filter(a.isComponentUsage))).filter(root => occurrenceCount(root) <= OCCURRENCE_LIMIT).flatMap(root => occurrences(root).filter(o => o.structure === n || o.structure === owner(n, (x): x is Structure => a.isComponentDef(x) || a.isComponentUsage(x)) || o.definition === owner(n, a.isComponentDef)).map(o => identity(root) + o.path.slice(root.name.length))), ...(!foreign && code === 'SW2003' && message.includes('needs redefines') && n.$cstNode ? { suggestedEdits: [{ uri: AstUtils.getDocument(n).uri.toString(), range: { start: n.$cstNode.range.start, end: n.$cstNode.range.start }, newText: 'redefines ' }] } : !foreign && extra.edits ? { suggestedEdits: extra.edits.map(edit => ({ uri: declarationDoc.uri.toString(), ...edit })) } : {}) } }); }
    checkModel = (model: a.Model, accept: ValidationAcceptor): void => {
        this.accept = accept;
        this.currentModel=model;
        this.reported.clear();
        this.durationFindings.clear();
        const d = AstUtils.getDocument(model);
        if (d.parseResult.parserErrors.length || d.parseResult.lexerErrors.length)
            return;
        this.models = this.services.shared.workspace.LangiumDocuments.all.map(d => d.parseResult.value).filter(a.isModel).toArray();
        if (!this.models.includes(model))
            this.models.push(model);
        for (const item of this.models)
            workspaceModels.set(item, this.models);
        useEffectCache(this.models);
        this.staleSummaries = new Map();
        this.staleBudget = { work: 0, limit: SwamlValidator.staleReadWorkLimit };
        this.staleLimitReported = false;
        this.checkExpressionDepth(model);
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
                if (a.isComponentUsage(e))
                    this.occurrenceDurations(e);
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
            for (const s of p.elements.filter(a.isScenario))
                this.caseScript(s, p);
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
            // A duration literal in a 2.2 position (wait 5ms, every, deadline, after, a policy setting) is positive; in
            // any other expression it is a uint value that must only be representable (WP4-S01).
            if (a.isDuration(n) && (!Number.isSafeInteger(nanos(n)) || nanos(n) <= 0 && (!a.isLiteral(n.$container) || a.isPolicySetting(n.$container.$container))))
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
            return !!p && !!q && typeKey(p.result) === typeKey(q.result) && p.parameters.length === q.parameters.length && p.parameters.every((v, i) => typeKey(v.type) === typeKey(q.parameters[i].type) && (v.direction ?? 'in') === (q.parameters[i].direction ?? 'in')) && (flowStates(x).length > 0) === (flowStates(y).length > 0);
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
            this.memberPolicies(link, forward, [l.port, r.port]);
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
                // Per member route (WP6-S07, WP6-D07): without member policies every member has the connection's policy.
                for (const ep of [l, r])
                    for (const m of portMembers(ep.port))
                        if (m.kind === 'operation' && direction(ep.port, m) === 'provides' && !m.idempotent && memberQos(link, m.name).delivery === 'atLeastOnce')
                            this.report(link, 'SW2013', `atLeastOnce requires idempotent provided operation ${ep.path}.${m.name}.`);
            }
        }
        for (const [path, count] of counts) {
            const ep = endpoint(c, path)!;
            if (count > 1 && portMembers(ep.port).some(m => direction(ep.port, m) === 'requires' && m.kind !== 'event'))
                this.report(ep.port, 'SW2004', `${path} requires attributes or operations and needs one peer.`);
        }
        const sampledInherited = this.inheritedSamples(c);
        this.schedules(c, sampledInherited.explained);
        this.ownership(c, forwarded, sampledInherited.paths);
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
            // WP6-S02, WP6-D04: an initial value is pure and assignable to the member type (the initializer messages),
            // checked where the members are declared rather than once per typed port usage.
            if (m.initial && m.kind === 'attribute' && m.type && (a.isPortDef(n) || a.isPortUsage(n) && !n.definition))
                this.value(m.initial, typeKey(m.type), new Map());
        }
    }
    /** The connection as diagnostics name it: its name, or connect (source, target). */
    private connectionText(link: a.Connect): string {
        return link.name !== undefined ? formatName(link.name, MESSAGE_SPELLING) : `connect (${formatPath(link.source, MESSAGE_SPELLING)}, ${formatPath(link.target, MESSAGE_SPELLING)})`;
    }
    /**
     * WP6-S05, WP6-D06 (SW2004): member policies are not allowed on a forwarding; each names a member present, by name,
     * in both connected ports, at most once. Completeness of the named policy is the policy's own SW2013 (WP6-D07).
     */
    private memberPolicies(link: a.Connect, forward: boolean, ports: [a.PortUsage, a.PortUsage]): void {
        if (!link.memberPolicies.length)
            return;
        if (forward) {
            this.report(link, 'SW2004', `Member policies are not allowed on forwarding ${this.connectionText(link)}.`, false, this.at(link.memberPolicies[0], 'member'));
            return;
        }
        const seen = new Set<string>();
        // An unfinished member policy in another document of the workspace (this one would not be validated) is skipped.
        for (const mp of link.memberPolicies.filter(x => x.member !== undefined)) {
            const at = this.at(mp, 'member');
            if (seen.has(mp.member))
                this.report(mp, 'SW2004', `${formatName(mp.member, MESSAGE_SPELLING)} has two policies in ${this.connectionText(link)}.`, false, at);
            else if (!ports.every(p => portMembers(p).some(m => m.name === mp.member)))
                this.report(mp, 'SW2004', `${formatName(mp.member, MESSAGE_SPELLING)} is not a member of both ports of ${this.connectionText(link)}.`, false, at);
            seen.add(mp.member);
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
            // A duration literal value is the 2.2 duration setting and keeps its 2.2 rules and messages (WP4-M01). Only a
            // value that contains a duration literal inside a larger expression is new in 3.0 (WP4-S02, WP4-D01).
            const literal = settingDuration(s), computed = !literal && nodes(s.value).some(a.isDuration), timeout = ['requestTimeout', 'maxLatency', 'maxAge'].includes(s.name);
            if (timeout && computed)
                this.report(s, 'SW2013', `${s.name} must be a duration literal such as 1s.`);
            else if (timeout && !literal)
                this.report(s, 'SW2013', `${s.name} needs a duration.`);
            else if (!timeout && computed)
                this.report(s, 'SW2013', `${s.name} is not a duration setting.`);
            if (s.name === 'capacity' && !computed && (literal || !a.isLiteral(s.value) || s.value.number === undefined))
                this.report(s, 'SW2013', 'capacity needs a positive integer count, not a duration.');
            if (s.value && !literal && !computed && ['delivery', 'ordering', 'overflow'].includes(s.name))
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
        if (!c && !identity(op).startsWith('Swaml::Math::') && !declaredIntrinsic(op) && Object.values(effects(op)).some(Boolean))
            this.report(op, 'SW2006', 'Package definitions may use only parameters and nested operations.');
        // Depth-first search with a finished set, so shared callees are explored once rather than once per path.
        const finished = new Set<Executable>();
        const cycle = (x: Executable, stack: Set<Executable>): boolean => { if (stack.has(x))
            return true; if (finished.has(x))
            return false; stack.add(x); const found = (body(x) ? nodes(body(x)!) : []).filter(a.isCallExpression).some(call => { const t = this.callTarget(call, c); return t && isExecutable(t) && cycle(t, stack); }); stack.delete(x); if (!found)
            finished.add(x); return found; };
        if (cycle(op, new Set()))
            this.report(op, 'SW2006', 'Operation calls must be acyclic; recursion is forbidden.');
        if (flowStates(op).length)
            this.flowOperation(op, b);
        this.block(b, env, c, op);
        // Host intrinsics have documentation-only bodies (WP3-M01).
        if (typeKey(sig.result) !== 'void' && !this.terminates(b) && !identity(sig).startsWith('Swaml::Math::') && !declaredIntrinsic(op))
            this.report(op, 'SW2006', 'A non-void operation must return or fail on every path.');
        if (sig.parameters.some(p => p.direction === 'out')) this.outFlow(op,c);
        if (c && effects(op, c).writes && effects(op, c).suspends) {
            const summaries = this.staleSummaries.get(c) ?? this.staleSummaries.set(c, new Map()).get(c)!;
            const limit = SwamlValidator.staleReadWorkLimit;
            const result = this.staleBudget.work > limit ? { limit: true } : staleWrite(op, { attributes: new Set(members(c).filter(a.isAttribute).map(x => x.name)), target: call => this.callTarget(call, c), effects: x => effects(x, c), summaries, budget: this.staleBudget, unmerged: SwamlValidator.staleReadUnmerged });
            if (result.write)
                this.report(result.write, 'SW2011', 'A read before suspension may influence this write. Recheck live attributes after resuming.', true);
            if (result.limit && !this.staleLimitReported) {
                // A reference resource boundary, not a stale read: stop the analysis and say so once per document.
                this.staleLimitReported = true;
                this.report(op, 'SW2013', `The stale-read analysis of this document reached the reference validation limit of ${limit} statement visits at operation ${op.name}; SW2011 is not checked for ${op.name} or for the operations validated after it in this document. Other validation is unaffected.`, true, this.at(op, 'name'));
            }
        }
    }
    /**
     * Definite assignment of out parameters, or of the out bindings of an on call branch of a case script
     * (binding). For a binding only the 3.0 checks apply (WP1-S07): a place write, and a read with
     * selectors, need the whole binding assigned first; 2.2 reads and replies keep their 2.2 rules.
     */
    private outFlow(op: Executable | undefined, c?: Structure, binding?: { outs: string[]; body: a.Block }): void {
        const outs = binding ? binding.outs : signature(op!)!.parameters.filter(p => p.direction === 'out').map(p => p.name), check = (at: AstNode, assigned: Set<string>) => { if (binding) return; for (const name of outs)
            if (!assigned.has(name))
                this.report(at, 'SW2006', 'Out parameter ' + name + ' must be assigned before successful return.'); };
        const what = binding ? 'Out binding' : 'Out parameter';
        const read = (e: a.Expression | undefined, assigned: Set<string>): void => {
            if (!e)
                return;
            if (a.isReferenceExpression(e) && outs.includes(e.path.split('.')[0]) && !assigned.has(e.path.split('.')[0])) {
                if (!binding)
                    this.report(e, 'SW2006', 'Out parameter is read before assignment.');
                else if ((e.selectors ?? []).length)
                    this.report(e, 'SW2006', `${what} ${e.path.split('.')[0]} must be assigned before ${this.placeText(e)} is read.`);
            }
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
            if (a.isConditionalExpression(e)) {
                read(e.condition, assigned);
                read(e.then, assigned);
                read(e.otherwise, assigned);
            }
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
            if (a.isReferenceExpression(e))
                (e.selectors ?? []).forEach(x => read(x.index, assigned));
        };
        const written = (e: a.Expression): Set<string> => { if (a.isTryExpression(e)) {
            const left = written(e.expression), right = e.fallback ? written(e.fallback) : new Set<string>();
            return new Set([...left].filter(x => right.has(x)));
        } if (!a.isCallExpression(e))
            return new Set(); const target = this.callTarget(e, c), params = target ? (isExecutable(target) ? signature(target)?.parameters : target.parameters) : []; return new Set(e.args.flatMap((arg, i) => params?.[i]?.direction === 'out' && a.isReferenceExpression(arg) && outs.includes(arg.path) ? [arg.path] : [])); };
        const join = (branches: (Set<string> | undefined)[]): Set<string> | undefined => { const live = branches.filter((x): x is Set<string> => !!x); return live.length ? new Set([...live[0]].filter(x => live.every(s => s.has(x)))) : undefined; };
        const flow = (b: a.Block | a.ElseIf | a.OperationBody, input: Set<string>): Set<string> | undefined => {
            let assigned = new Set(input);
            for (const stmt of b.statements) {
                if (a.isReturn(stmt)) {
                    read(stmt.value, assigned);
                    check(stmt, assigned);
                    return undefined;
                }
                if (a.isFail(stmt))
                    return undefined;
                if (a.isAssign(stmt) && isPlace(stmt)) {
                    // A place write updates its root, so an out root must already be assigned (WP1-S07).
                    read(stmt.index, assigned);
                    stmt.selectors.forEach(x => read(x.index, assigned));
                    read(stmt.value, assigned);
                    const root = placeRoot(stmt.target);
                    if (outs.includes(root) && !assigned.has(root))
                        this.report(stmt, 'SW2006', `${what} ${root} must be assigned before ${this.placeText(stmt)} is assigned.`, false, this.at(stmt, 'target'));
                }
                else if (a.isAssign(stmt)) {
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
        const end = flow(binding ? binding.body : body(op!)!, new Set());
        if (end && op)
            check(op, end);
    }
    /**
     * The visible declarations of an unresolved short call name when several share it and one of them is a 3.0 library
     * declaration (WP3-L04). A 2.2 source cannot import the 3.0 packages, so it never gets this.
     */
    private libraryAmbiguity(call: a.CallExpression): AstNode[] | undefined {
        const pkg = owner(call, a.isPackage);
        if (!pkg || call.target.includes('.') || call.target.includes('::') || localOperation(call, call.target, container(call)))
            return undefined;
        // The linker's order: the own package, then the imports in source order (SwamlLinker.createLinkingError).
        const packages = this.models.flatMap(m => m.packages), visible = [pkg.name, ...pkg.imports.map(i => i.namespace).filter(n => n !== pkg.name)];
        const clashing = [...new Set(visible.flatMap(name => packages.filter(p => p.name === name).flatMap(p => p.elements.filter(x => x.name === call.target))))];
        return clashing.length > 1 && clashing.some(x => AstUtils.getDocument(x).uri.toString() === LIBRARY_3_0_URI) ? clashing : undefined;
    }
    private callTarget(call: a.CallExpression, c?: Structure): Executable | a.PortMember | undefined {
        if (this.script && call.target.includes('.')) {
            const t = caseTarget(this.script.scenario, call.target);
            return t?.kind === 'port' ? t.member : t?.kind === 'operation' ? t.operation : undefined;
        }
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
        if (!op && !this.script)
            for (const call of nodes(e).filter(a.isCallExpression)) {
                const t = this.callTarget(call, c);
                // The clock reads state (WP3-S01); its message names it and the initialized member (WP3-D01).
                if (t && isClockRead(t))
                    this.report(e, 'SW2006', `Initializer of ${formatName(initialized(e), MESSAGE_SPELLING)} must be pure; now() reads state.`);
                else if (t && (!isExecutable(t) || Object.values(effects(t, c)).some(Boolean)))
                    this.report(e, 'SW2006', 'Attribute initializers must be pure.');
            }
    }
    /**
     * A sampled read p.m (WP6-S01, WP6-S08) in component c: the member type, '?' after reporting an error, or undefined
     * when the reference is not the 3.0 form, because member m of the owned port p declares no initial value (optsIn),
     * so that every 2.2 source keeps its 2.2 diagnostics. Errors: not a required attribute (SW2006, WP6-D05), a
     * forwarded boundary (SW2005, WP6-D01) and an initializer (SW2006, WP6-D05). In the constant sublanguage (period
     * and deadline expressions) the constant check reports it (SW2007, WP6-D05).
     */
    private sampledRead(e: a.ReferenceExpression, c: Structure, op: Executable | undefined): string | undefined {
        const form = sampledReadForm(e, c);
        if (!form)
            return undefined;
        const text = formatPath(form.port.name + '.' + form.member.name, MESSAGE_SPELLING);
        if (!isSampledMember(form.port, form.member)) {
            this.report(e, 'SW2006', `${text} is not a required attribute of an owned port.`);
            return '?';
        }
        if (forwardedPorts(c).has(form.port.name)) {
            this.report(e, 'SW2005', `${text} cannot be sampled: ${formatName(form.port.name, MESSAGE_SPELLING)} is a forwarded boundary.`);
            return '?';
        }
        if (!op && !this.constantDivision) {
            this.report(e, 'SW2006', 'A sampled read is not allowed in an initializer.');
            return '?';
        }
        return typeKey(form.member.type);
    }
    /** occurrence.port.member in a case script, of a member of a package occurrence's port that opts in to sampling (WP6-S09). */
    private scriptSample(e: a.ReferenceExpression): string | undefined {
        const parts = e.path.split('.'), p = owner(this.script!.scenario, a.isPackage);
        if (parts.length < 3 || parts[0].includes('::') || !p)
            return undefined;
        const occurrence = packageOccurrences(p).find(o => o.name === parts[0]), port = occurrence && members(occurrence).filter(a.isPortUsage).find(x => x.name === parts[1]);
        return port && optsIn(portMembers(port).find(m => m.name === parts[2])) ? formatPath(parts[1] + '.' + parts[2], MESSAGE_SPELLING) : undefined;
    }
    /**
     * WP6-S03 (WP6-D02) and WP6-S08 (WP6-D01) for inherited behaviour: a sampled read of an inherited executable or
     * schedule entry, valid where it is declared, stays a sampled read of c. A port redefinition of c that removes the
     * initial value of a member it samples is SW2004 at the redefinition; a forwarding of c that makes its port a
     * forwarded boundary is SW2005 at the forwarding; each is reported once per member. Returns the port.member paths
     * that a base of c samples in behaviour c inherits: they keep the ownership rule of sampled members (WP6-S04), so a
     * read that one of these errors already explains is not also reported as a member without an owner. Also returns
     * the inherited schedule entries with such a read: their arguments, checked where they are declared, are not typed
     * again in c, so the valid base gets no unknown-value error for a read the error at c explains (review V1).
     */
    private inheritedSamples(c: Structure): { paths: Set<string>, explained: Set<a.ScheduleEntry> } {
        const paths = new Set<string>(), reported = new Set<string>(), seen = new Set<AstNode>(), reads = new Map<a.ScheduleEntry, string[]>(), broken = new Set<string>();
        if (this.baseCycle(c, new Set()))
            return { paths, explained: new Set() };
        const executables = members(c).filter(isExecutable), entries = new Set(schedule(c)), forwarded = forwardedPorts(c);
        for (let base = a.isComponentDef(c) ? c.specializes?.ref : c.definition?.ref; base; base = base.specializes?.ref)
            for (const read of sampledReads(base)) {
                // Only reads that c inherits: from an executable or schedule entry that c does not replace.
                const entry = owner(read.node, a.isScheduleEntry), site = entry ? undefined : executables.find(x => { const b = body(x); return !!b && AstUtils.hasContainerOfType(read.node, n => n === b); });
                if (seen.has(read.node) || (entry ? !entries.has(entry) : !site))
                    continue;
                seen.add(read.node);
                const path = read.port.name + '.' + read.member.name, text = formatPath(path, MESSAGE_SPELLING);
                paths.add(path);
                if (entry)
                    reads.set(entry, [...reads.get(entry) ?? [], path]);
                if (reported.has(path))
                    continue;
                const who = entry ? 'an inherited schedule entry' : `inherited ${formatName(site!.name, MESSAGE_SPELLING)}`;
                const port = members(c).filter(a.isPortUsage).find(x => x.name === read.port.name);
                const member = port && portMembers(port).find(m => m.name === read.member.name);
                const definition = port && formatName(port.definition?.ref?.name ?? port.name, MESSAGE_SPELLING);
                // A read the effective port no longer samples as typed; its error is at the redefinition, here or in a base of c.
                if (member && (!optsIn(member) || typeKey(member.type) !== typeKey(read.member.type)))
                    broken.add(path);
                if (port && c.members.includes(port) && member && !optsIn(member)) {
                    this.report(port, 'SW2004', `Sampled attribute ${formatName(member.name, MESSAGE_SPELLING)} of ${definition} needs an initial value: ${who} samples ${text}.`);
                    reported.add(path);
                }
                // The inherited read was typed with the base's member type; a redefinition may not change it.
                else if (port && c.members.includes(port) && member && typeKey(member.type) !== typeKey(read.member.type)) {
                    this.report(port, 'SW2004', `Sampled attribute ${formatName(member.name, MESSAGE_SPELLING)} of ${definition} must keep type ${typeKey(read.member.type)}: ${who} samples ${text}.`);
                    reported.add(path);
                }
                const link = forwarded.has(read.port.name) ? c.members.filter(a.isConnect).find(l => l.source === read.port.name || l.target === read.port.name) : undefined;
                if (link && !reported.has(path)) {
                    this.report(link, 'SW2005', `${text} cannot be sampled: ${formatName(read.port.name, MESSAGE_SPELLING)} is a forwarded boundary; ${who} samples it.`);
                    reported.add(path);
                }
                if (reported.has(path))
                    broken.add(path);
            }
        return { paths, explained: new Set([...reads].filter(([, p]) => p.some(x => broken.has(x))).map(([entry]) => entry)) };
    }
    /** Expressions nested deeper than this are reported instead of inferred, so validation cannot exhaust the stack. */
    private static readonly EXPRESSION_DEPTH_LIMIT = 1000;
    private readonly tooDeep = new Set<AstNode>();
    private checkExpressionDepth(model: a.Model): void {
        this.tooDeep.clear();
        for (const root of AstUtils.streamAst(model).filter(n => isExpression(n) && !isExpression(n.$container))) {
            let deepest = 0;
            const stack: [AstNode, number][] = [[root, 1]];
            while (stack.length && deepest <= SwamlValidator.EXPRESSION_DEPTH_LIMIT) {
                const [n, depth] = stack.pop()!;
                deepest = Math.max(deepest, depth);
                for (const child of AstUtils.streamContents(n))
                    stack.push([child, depth + 1]);
            }
            if (deepest > SwamlValidator.EXPRESSION_DEPTH_LIMIT) {
                this.tooDeep.add(root);
                this.report(root, 'SW2013', `Expression nesting exceeds the reference validation limit of ${SwamlValidator.EXPRESSION_DEPTH_LIMIT} levels; split it into local variables.`);
            }
        }
    }
    private infer(e: a.Expression | undefined, env: Env, c?: Structure, op?: Executable, allow = false): string { if (e && this.tooDeep.has(e)) return '?'; const t=this.inferValue(e,env,c,op,allow);if(e)expressionTypes.set(e,t);return t;}
    private inferValue(e: a.Expression | undefined, env: Env, c?: Structure, op?: Executable, allow = false): string {
        if (!e)
            return 'void';
        if (a.isLiteral(e)) {
            // A duration literal is a uint value in nanoseconds (WP4-S01).
            if (e.duration)
                return 'uint';
            if (e.number !== undefined) {
                if (!Number.isFinite(e.number) || !e.$cstNode?.text.includes('.') && !Number.isSafeInteger(e.number))
                    this.report(e, 'SW2002', 'Numeric literal is outside its domain.');
                return e.$cstNode?.text.includes('.') ? 'real' : 'int';
            }
            return e.boolean !== undefined ? 'bool' : 'string';
        }
        if (a.isReferenceExpression(e)) {
            const [head, ...path] = e.path.split('.');
            // The 2.2 form path[index] keeps its typing and messages; selectors after an index are typed by select (WP1-S02).
            const selected = (e.selectors ?? []).length > 0;
            let t = env.get(head)?.type, fields = path, steps: Step[] = valueSteps(e);
            if (!t) {
                const en = resolve(e, head, this.models);
                if (a.isEnumType(en) && fields.length === 1 && en.literals.includes(fields[0]))
                    // An enum literal has no fields or elements, so selectors after it are reported (WP1-D04).
                    return selected ? this.select(identity(en), steps.slice(1), env, c, op, e) : identity(en);
                // WP6-S01: p.m on an owned port that opts in to sampling reads its sample cell; fields and selectors follow.
                const sampled = !this.script && c ? this.sampledRead(e, c, op) : undefined;
                if (sampled === '?')
                    return '?';
                if (sampled !== undefined) {
                    t = sampled as string;
                    fields = path.slice(1);
                    steps = valueSteps(e).slice(1);
                }
                // WP6-S09, WP6-D08: a case script does not sample; it keeps on receive at actor ports.
                const scriptSample = this.script && this.scriptSample(e);
                if (scriptSample) {
                    this.report(e, 'SW2010', `A case script cannot sample ${scriptSample}; use on receive.`);
                    return '?';
                }
                // A test may read attributes of its subject and of parts inside it, indexing part families with literals (WP1-S06).
                const read = sampled === undefined && this.script ? caseRead(this.script.scenario, e) : undefined;
                if (read?.kind === 'problem') {
                    if (this.script!.scenario.kind === 'test')
                        this.partProblem(e, 'path', read.problem);
                    else
                        this.whiteBox(e, 'path', read.problem.path, 'read');
                    for (const step of steps)
                        if (step.index !== undefined)
                            this.infer(step.index as a.Expression, env, c, op);
                    return '?';
                }
                if (read && read.kind === 'attribute') {
                    this.whiteBox(e, 'path', read.path, 'read');
                    t = typeKey(read.attribute.type);
                    fields = read.steps.flatMap(x => x.field !== undefined ? [x.field] : []);
                    steps = read.steps;
                }
                else if (!sampled) {
                    this.report(e, 'SW2002', this.script ? (selected
                        // A 3.0 read names the whole path; a 2.2 read keeps its 2.2 message (review F3, F5).
                        ? `Unknown value ${this.placeText(e)}${this.failingSegment(e, steps)}; a case reads its locals and bindings, and a test may also read attributes of its subject, explicitly associated software components and their parts (a part family member by a literal index, as in twins[0]).`
                        : `Unknown value ${e.path}; a case reads its locals and bindings, and a test may also read attributes of its subject, explicitly associated software components and their single parts.`) : this.unknownLocal(e, e.path));
                    return '?';
                }
            }
            if (t === undefined)
                return '?';
            if (selected)
                return this.select(t, steps, env, c, op, e);
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
            // A call path with a literal component index belongs to a test (WP1-S06, WP1-S08).
            if (e.target.includes('[')) {
                const inspect = () => { for (const arg of e.args) this.infer(arg, env, c, op); return '?'; };
                if (this.script?.scenario.kind !== 'test') {
                    this.report(e, 'SW2006', `${e.target}: an indexed call path is allowed only in a test.`, false, this.at(e, 'target'));
                    return inspect();
                }
                const [head, ...rest] = e.target.split('.'), p = owner(this.script.scenario, a.isPackage), occurrence = p && packageOccurrences(p).find(o => o.name === head);
                const walked = occurrence && walkParts(occurrence, head, pathSteps(rest));
                if (walked?.problem) {
                    this.partProblem(e, 'target', walked.problem);
                    return inspect();
                }
            }
            const t = this.callTarget(e, c);
            if (!t) {
                const clashing = this.libraryAmbiguity(e);
                if (clashing)
                    // A short call name shared with a 3.0 library operation (WP3-L04); never in a 2.2 source.
                    this.report(e, 'SW2001', ambiguousNameMessage(e.target, clashing, owner(e, a.isPackage)!, x => a.isOperation(x) && clashing.filter(y => owner(y, a.isPackage) === owner(x, a.isPackage)).length === 1), false, { ...this.at(e, 'target'), related: clashing });
                else
                    this.report(e, 'SW2006', `Unknown operation ${e.target}; remote calls require an owned port.`);
                return '?';
            }
            if (isExecutable(t) && flowStates(t).length)
                this.report(e, 'SW2008', `${formatName(t.name, MESSAGE_SPELLING)} contains states, so it keeps its place and is released only by its schedule entry; it is never called (SIF-S01).`);
            const sig = isExecutable(t) ? signature(t) : t;
            if (!sig)
                return '?';
            const scripted = this.script && e.target.includes('.') ? caseTarget(this.script.scenario, e.target) : undefined;
            if (scripted?.kind === 'port')
                this.scriptPort(e, 'target', e.target, ['operation'], 'requires', 'A call', 'SW2004');
            else if (scripted?.kind === 'operation') {
                const restriction = caseCallRestriction(this.script!.scenario, scripted.path, scripted.operation, scripted.structure);
                if (restriction === 'scope')
                    this.report(e, 'SW2010', this.script!.scenario.kind === 'test'
                        ? `A test may call its primary subject, or eligible helpers of its ${scripted.path.includes('[') ? 'parts (a part family member by a literal index)' : 'single parts'} and explicitly associated software components; ${scripted.path} is not accessible.`
                        : `A use case may call operations of its primary subject only; ${scripted.path} is not that subject. Use associated actor ports to interact with other components.`, false, this.at(e, 'target'));
                if (restriction === 'effects')
                    this.report(e, 'SW2006', `A test's private helper calls neither communicate nor suspend; ${e.target} does. Use a primary-subject operation or an actor port for that behavior.`, false, this.at(e, 'target'));
            }
            else if (a.isPortMember(t)) {
                const ep = c && memberEndpoint(c, e.target);
                if (!ep || t.kind !== 'operation' || direction(ep.port, t) !== 'requires')
                    this.report(e, 'SW2004', 'Remote calls need an owned required operation member.');
            }
            const suspends = scripted?.kind === 'operation'
                ? caseCallAccess(this.script!.scenario, scripted.path) === 'subject' && effects(scripted.operation, scripted.structure).suspends
                : !isExecutable(t) || effects(t, c).suspends;
            if (suspends && insideConditional(e))
                // A conditional never suspends, wherever the call is inside it (WP2-S04, WP2-D02).
                this.report(e, 'SW2006', 'A suspending call cannot appear in a conditional expression.');
            else if (suspends && (!allow || !allowsSuspendingCall(e)))
                this.report(e, 'SW2006', 'Suspending calls must be standalone statements or whole values of ordinary variable declarations or assignments, optionally in try. Store their result before using it in an expression or loop header.');
            this.arguments(e, sig.parameters, e.args, env, c, op);
            if (sig.parameters.some(x => x.direction === 'out') && !a.isExpressionStatement(e.$container) && !(a.isTryExpression(e.$container) && a.isExpressionStatement(e.$container.$container)))
                this.report(e, 'SW2006', 'A call with out arguments must be a statement.');
            return typeKey(sig.result);
        }
        if (a.isConditionalExpression(e))
            return this.conditional(e, env, c, op);
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
        // In the constant sublanguage of periods and deadlines, / on integral operands is exact integral division (WP4-S05).
        return e.operator === '/' && !(this.constantDivision && integral(l) && integral(r)) || l === 'real' || r === 'real' ? 'real' : 'int';
    }
    /** True while a period or deadline expression is typed: / on integral operands is integral there (WP4-S05). */
    private constantDivision = false;
    /**
     * A computed wait, receive timeout or state timer (WP4-S01, WP4-S03, WP4-S08): an integral expression (SW2002,
     * WP4-D02) without suspending calls (SW2006, reported by the call rules), with the unit warning (WP4-D06).
     */
    private computedDuration(e: a.Expression, env: Env, c: Structure | undefined, op: Executable | undefined): void {
        const t = this.infer(e, env, c, op);
        if (t !== '?' && !integral(t))
            this.report(e, 'SW2002', `A duration must be integral, found ${t}.`);
        this.unitWarning(e, c);
    }
    /**
     * SW2016 (WP4-D06): a computed duration with no duration literal, no now() call and no reference to a const
     * attribute whose effective initializer, followed through const references, contains one counts nanoseconds.
     */
    private unitWarning(e: a.Expression, c: Structure | undefined): void {
        if (!this.carriesUnit(e, c, new Set()))
            this.report(e, 'SW2016', `${displayText(e)} has no time unit and counts nanoseconds; multiply by a unit such as 1ms.`, true);
    }
    private carriesUnit(e: a.Expression, c: Structure | undefined, seen: Set<a.Attribute>): boolean {
        for (const n of nodes(e)) {
            if (a.isDuration(n))
                return true;
            if (a.isCallExpression(n)) {
                const t = this.callTarget(n, c);
                if (t && isExecutable(t) && isClockRead(t))
                    return true;
            }
            if (a.isReferenceExpression(n) && c && !n.path.includes('.')) {
                const attribute = members(c).filter(a.isAttribute).find(x => x.name === n.path && x.constant);
                if (attribute && !seen.has(attribute)) {
                    seen.add(attribute);
                    if (this.carriesUnit(attribute.value, c, seen))
                        return true;
                }
            }
        }
        return false;
    }
    /**
     * A period or deadline expression where it is written (WP4-S04, WP4-S05): integral when / is exact integral
     * division (SW2002, WP4-D02), in the constant sublanguage with the const values of its owner (SW2007, WP4-D03) and
     * with the unit warning (WP4-D06). Its values are checked per expanded occurrence (occurrenceDurations).
     */
    private constantDuration(e: a.Expression, c: Structure): void {
        this.constantDivision = true;
        const t = this.infer(e, this.env(c), c);
        this.constantDivision = false;
        if (t !== '?' && !integral(t))
            this.report(e, 'SW2002', `A duration must be integral, found ${t}.`);
        const result = constantValue(e, c);
        if (result.problem)
            this.constantProblem(e, result.problem, c);
        this.unitWarning(e, c);
    }
    /** Reports a membership problem of a period or deadline expression (WP4-D03); value problems are per occurrence. */
    private constantProblem(e: a.Expression, problem: ConstantProblem, c?: Structure): boolean {
        // A sampled read is state that changes without a write (WP6-S08, WP6-D05).
        if (problem.kind === 'value' && c && a.isReferenceExpression(problem.node) && sampledReadForm(problem.node, c)) {
            this.report(e, 'SW2007', 'A sampled read is not allowed in a constant duration.');
            return true;
        }
        const category = problem.kind === 'call' ? problem.clock ? 'now()' : 'calls' : problem.kind === 'state' ? 'mutable state' : problem.kind === 'value' ? 'values other than integers, durations and booleans' : problem.kind === 'cycle' ? 'cyclic const attributes' : undefined;
        if (category)
            this.report(e, 'SW2007', `${displayText(e)} is not a constant duration: ${category} are not allowed.`);
        return !!category;
    }
    /**
     * WP4-S06: for every expanded occurrence of a top-level occurrence, each computed period and deadline is a positive
     * representable duration (SW2013, WP4-D04), exact in every division (SW2013, WP4-D07), and an every entry's deadline
     * does not exceed its period (SW2007, WP4-D05). Each expression reports each finding once, for the first occurrence
     * where it fails, in the order of the package's top-level occurrences and their expansion.
     */
    private occurrenceDurations(root: a.ComponentUsage): void {
        if (occurrenceCount(root) > OCCURRENCE_LIMIT)
            return;
        const done = this.durationFindings;
        const once = (n: AstNode, kind: string, report: () => void) => { const key = kind + '@' + (n.$cstNode?.offset ?? -1) + ':' + AstUtils.getDocument(n).uri.toString(); if (!done.has(key)) { done.add(key); report(); } };
        for (const occurrence of occurrences(root)) {
            const entries = schedule(occurrence.structure);
            this.equalPeriods(entries, occurrence.path, occurrence.structure, once);
            for (const e of entries) {
                if (!e.periodValue && !e.deadlineValue)
                    continue;
                const value = (expression: a.Expression | undefined, what: 'period' | 'deadline'): bigint | undefined => {
                    if (!expression)
                        return undefined;
                    const result = constantValue(expression, occurrence.structure);
                    if (result.problem?.kind === 'division') {
                        const problem = result.problem;
                        // A zero divisor of % has its own wording (WP4-D07).
                        once(problem.node, 'division', () => this.report(expression, 'SW2013', problem.node.operator === '%'
                            ? `${displayText(problem.node)} takes the remainder of ${problem.left} by ${problem.right} in ${occurrence.path}, which is not defined for a zero divisor.`
                            : `${displayText(problem.node)} divides ${problem.left} by ${problem.right} in ${occurrence.path}, which is not an exact integral division.`));
                        return undefined;
                    }
                    if (result.problem) {
                        once(expression, 'member', () => this.constantProblem(expression, result.problem, occurrence.structure));
                        return undefined;
                    }
                    if (typeof result.value !== 'bigint')
                        return undefined;
                    if (!representableDuration(result.value)) {
                        once(expression, 'range', () => this.report(expression, 'SW2013', `${what} of ${this.entryText(e)} is ${result.value} ns in ${occurrence.path}; it must be a positive representable duration.`));
                        return undefined;
                    }
                    return result.value;
                };
                // Problems are reported above; the comparison reads the same helpers as the simulator and the projection.
                const problems = [e.periodValue && value(e.periodValue, 'period') === undefined, e.deadlineValue && value(e.deadlineValue, 'deadline') === undefined].some(Boolean);
                const period = entryPeriod(e, occurrence.structure), deadline = entryDeadline(e, occurrence.structure);
                if (!problems && e.kind === 'every' && (e.deadline || e.deadlineValue) && period !== undefined && deadline !== undefined && deadline > period)
                    once(e, 'deadline', () => this.report(e, 'SW2007', `Periodic deadline cannot exceed its period in ${occurrence.path}.`));
            }
        }
    }
    /**
     * SW2019 (WP4-D08, warning): two effective every entries of one occurrence release the same operation with equal
     * periods but different trigger identities, so neither replaces the other and the operation is released twice per
     * period. Literal periods are identified by their nanoseconds as in 2.2, so at least one of the two is computed and
     * a 2.2 source never gets this warning. Reported once, at the later entry, for the first occurrence.
     */
    private equalPeriods(entries: readonly a.ScheduleEntry[], path: string, structure: Structure, once: (n: AstNode, kind: string, report: () => void) => void): void {
        const periodic = entries.filter(e => e.kind === 'every' && (e.period || e.periodValue));
        if (!periodic.some(e => e.periodValue))
            return;
        periodic.forEach((later, i) => {
            const period = entryPeriod(later, structure);
            const earlier = periodic.slice(0, i).find(x => x.operation === later.operation && triggerIdentity(x) !== triggerIdentity(later) && period !== undefined && entryPeriod(x, structure) === period);
            if (earlier)
                once(later, 'equalPeriod', () => this.report(later, 'SW2019', `${this.entryText(later)} and ${this.entryText(earlier)} have the same period in ${path} but different triggers, so neither replaces the other and ${later.operation} is released twice per period; write the same trigger to replace an entry.`, true));
        });
    }
    /** The per-occurrence duration findings of the current document check, each reported once (WP4-S06). */
    private readonly durationFindings = new Set<string>();
    /** An entry as diagnostics name it: its trigger and operation, such as every (periodMs * 1ms) poll (WP4-D04). */
    private entryText(e: a.ScheduleEntry): string {
        const trigger = e.kind === 'every' ? `every ${e.periodValue ? `(${displayText(e.periodValue)})` : e.period ? `${e.period.value}${e.period.unit}` : ''}` : e.kind === 'after' ? `after ${e.predecessor}` : e.kind === 'start' ? 'start' : `${e.kind} ${e.endpoint}`;
        return `on ${trigger} ${e.operation}`.replace('on after', 'after');
    }
    /**
     * The conditional if (c) a else b (WP2-S02, WP2-D01): a bool condition and branches with a common type under
     * scalar widening (byte, uint, int, real); records, enums and arrays must be identical. No branch may be void,
     * and no suspending call may appear anywhere inside it (WP2-S04, reported at the call).
     */
    private conditional(e: a.ConditionalExpression, env: Env, c?: Structure, op?: Executable): string {
        const condition = this.infer(e.condition, env, c, op), then = this.infer(e.then, env, c, op), otherwise = this.infer(e.otherwise, env, c, op);
        if (condition !== 'bool' && condition !== '?')
            this.report(e.condition, 'SW2002', `Condition must be bool, found ${condition}.`);
        if (then === 'void' || otherwise === 'void') {
            this.report(then === 'void' ? e.then : e.otherwise, 'SW2002', 'Void completion is not an expression value.');
            return '?';
        }
        const common = conditionalType(then, otherwise);
        if (common === undefined)
            this.report(e, 'SW2002', `Conditional branches have no common type: ${then} and ${otherwise}.`);
        return common ?? '?';
    }
    private arguments(n: AstNode, params: a.Argument[], args: a.Expression[], env: Env, c?: Structure, op?: Executable): void {
        if (params.length !== args.length)
            this.report(n, 'SW2002', `Expected ${params.length} arguments, received ${args.length}.`);
        params.forEach((p, i) => { const v = args[i]; if (!v)
            return; if (p.direction === 'out') {
            // A place is not an out argument in 3.0 (WP1-S04); out arguments stay bare names.
            // A 2.2 form (r.f, a[i]) keeps the 2.2 message.
            if (a.isReferenceExpression(v) && env.has(placeRoot(v.path)) && (v.selectors ?? []).length)
                this.report(v, 'SW2006', `An out argument must be a name; ${this.placeText(v)} is a place.`);
            else if (!a.isReferenceExpression(v) || v.path.includes('.') || v.index || !env.get(v.path)?.mutable || !assignable(typeKey(p.type), env.get(v.path)?.type ?? '?'))
                this.report(v, 'SW2006', 'An out argument needs a mutable compatible local, out parameter or attribute.');
        }
        else
            this.value(v, typeKey(p.type), env, c, op); });
    }
    private block(b: a.Block | a.ElseIf | a.OperationBody | a.Scenario, inherited: Env, c: Structure | undefined, op: Executable | undefined, into?: Env): void {
        // into: the scope the statements declare into (the look scope of a state's statements); otherwise a fresh copy.
        const env = into ?? new Map(inherited);
        for (const s of b.statements) {
            if (a.isLocalVariable(s)) {
                this.value(s.value, typeKey(s.type), env, c, op, true);
                if (env.has(s.name))
                    this.report(s, 'SW2001', `Local ${s.name} shadows a live name.`);
                env.set(s.name, { type: typeKey(s.type), mutable: true });
            }
            else if (a.isAssign(s) && isPlace(s))
                this.place(s, env, c, op);
            else if (a.isAssign(s)) {
                const cell = env.get(s.target);
                if (!cell?.mutable)
                    this.report(s, 'SW2006', this.script ? `Cannot assign ${s.target}; a case script assigns only its own locals and the out bindings of on call, and a test never assigns its subject.` : `Cannot assign ${s.target}; inputs and const attributes are immutable.`);
                this.value(s.value, cell?.type ?? '?', env, c, op, true);
            }
            else if (a.isExpressionStatement(s)) {
                const t = this.infer(s.expression, env, c, op, true), target = a.isCallExpression(s.expression) && this.callTarget(s.expression, c), out = target && (isExecutable(target) ? signature(target)?.parameters : target.parameters)?.some(x => x.direction === 'out');
                // A half-typed jump, to; in a state's braces, reads a value named to (an attribute, say): say what is missing.
                const halfJump = s.expression.$cstNode?.text === 'to' && !!owner(s, a.isStateStep);
                if (halfJump)
                    this.report(s, 'SW2008', 'to needs the state it goes to, as in to S; (to alone reads a value named to).');
                else if (t !== 'void' && t !== '?')
                    this.report(s, 'SW2006', 'A non-void result cannot be discarded.');
                if (!halfJump && !a.isCallExpression(s.expression) && !a.isTryExpression(s.expression))
                    this.report(s, 'SW2006', 'Expression statements must call an operation or try.');
            }
            else if (a.isReturn(s)) {
                if (owner(s, a.isStateStep))
                    this.report(s, 'SW2008', 'return does not stand in a state; leave the state with exit; and return after it (SIF-S04).');
                // In a case, return inside on call is the reply; any other return ends the case.
                const t = this.script ? this.script.reply ?? 'void' : typeKey(op && signature(op)?.result);
                if (!s.value && t !== 'void' || s.value && t === 'void')
                    this.report(s, 'SW2002', this.script && this.script.reply === undefined ? 'A return outside on call ends the case and has no value.' : this.script ? 'Return does not match the result of the answered operation.' : 'Return does not match the result.');
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
            else if (a.isWait(s) && s.delay)
                this.computedDuration(s.delay, env, c, op);
            else if (a.isSend(s)) {
                const ep = this.script ? this.scriptPort(s, 'endpoint', s.endpoint, [s.kind === 'send' ? 'attribute' : 'event'], 'provides', s.kind, 'SW2004') : c && memberEndpoint(c, s.endpoint);
                if (!this.script && s.endpoint.split('.').length === 3)
                    this.report(s, 'SW2004', 'occurrence.port.member endpoints belong to case scripts; an operation emits through its own port as port.member.', false, this.at(s, 'endpoint'));
                else if (!ep) {
                    if (!this.script)
                        this.report(s, 'SW2004', 'Emission needs a matching owned provided member.');
                }
                else if (!this.script && (direction(ep.port, ep.member) !== 'provides' || ep.member.kind !== (s.kind === 'send' ? 'attribute' : 'event')))
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
                // A computed timeout is evaluated when the statement starts waiting, in the statement's scope (WP4-S03).
                if (s.timeoutValue)
                    this.computedDuration(s.timeoutValue, env, c, op);
                for (const br of s.branches) {
                    const call = br.kind === 'call';
                    if (call && !this.script) {
                        this.report(br, 'SW2006', 'on call branches answer requests at actor ports and belong to case scripts; a component serves a provided operation with a schedule on call entry.');
                        continue;
                    }
                    const input = this.inputEnv(br, env, c, call);
                    if (!call || !this.script) {
                        this.block(br.body, input, c, op);
                        continue;
                    }
                    // Inside on call, return is the reply, exactly like a served operation.
                    const answered = caseTarget(this.script.scenario, br.endpoint), saved = this.script.reply, result = answered?.kind === 'port' ? typeKey(answered.member.result) : '?';
                    this.script.reply = result;
                    this.block(br.body, input, c, op);
                    // An on call out binding is a place root only after a whole assignment (WP1-S07).
                    const outs = answered?.kind === 'port' ? answered.member.parameters.flatMap((p, i) => p.direction === 'out' && br.bindings[i] ? [br.bindings[i]] : []) : [];
                    if (outs.length)
                        this.outFlow(undefined, c, { outs, body: br.body });
                    this.script.reply = saved;
                    if (result !== 'void' && result !== '?' && !this.terminates(br.body))
                        this.report(br, 'SW2006', `An on call branch for ${br.endpoint} must return a ${result} reply or fail on every path.`);
                }
                if (s.timeoutBody)
                    this.block(s.timeoutBody, env, c, op);
            }
            else if (a.isInterruptible(s) && this.script)
                this.report(s, 'SW2006', 'Case scripts have no interrupt regions; wait with on receive or after D instead.');
            else if (a.isStateStep(s))
                this.stateStep(s, env, c, op);
            else if (a.isExit(s) || a.isJump(s))
                this.leaveRule(s, op);
            else if (a.isInterruptible(s)) {
                if (op && flowStates(op).length)
                    this.report(s, 'SW2008', 'An operation with states contains no interrupt region; write a state with an event line instead (SIF-S01).');
                this.block(s.body, env, c, op);
                this.block(s.handler, this.inputEnv(s, env, c), c, op);
                this.report(s, 'SW2012', `Input ${s.endpoint} is discarded while this region is inactive.`, true);
            }
        }
    }
    /** The source text of a place, such as statuses[i].confirmed, with decoded names (WP1-D01 to WP1-D03). */
    private placeText(n: a.Assign | a.ReferenceExpression): string {
        const text = (e?: a.Expression) => e?.$cstNode?.text.replace(/\s+/g, ' ').trim() ?? '?';
        return (a.isAssign(n) ? n.target : n.path) + (n.index ? `[${text(n.index)}]` : '') + (n.selectors ?? []).map(x => x.field !== undefined ? '.' + x.field : `[${text(x.index)}]`).join('');
    }
    /**
     * A place assignment (WP1-S05): its root is a mutable local, an out parameter or a non-const attribute of
     * the executing component, or in a case script one of its own locals or on call out bindings. The place is
     * typed by its selectors (WP1-S02, WP1-S03) and the right side must be assignable to it.
     */
    private place(s: a.Assign, env: Env, c: Structure | undefined, op: Executable | undefined): void {
        const root = placeRoot(s.target), cell = env.get(root), text = this.placeText(s);
        let problem: string | undefined;
        if (root.includes('::'))
            problem = 'a qualified name';
        else if (!cell) {
            const member = c && (members(c) as Node[]).find(m => m.name === root), p = this.script && owner(this.script.scenario, a.isPackage);
            problem = a.isPortUsage(member) ? 'a port' : a.isComponentUsage(member) ? 'a child component' : p && packageOccurrences(p).some(o => o.name === root) ? 'a component occurrence; a case script assigns only its own locals and on call out bindings' : 'not a local, out parameter or attribute';
        }
        else if (!cell.mutable) {
            const parameter = op && signature(op)?.parameters.find(x => x.name === root), attribute = c && members(c).filter(a.isAttribute).find(x => x.name === root);
            problem = parameter ? 'an in parameter' : attribute?.constant ? 'a const attribute' : 'an immutable binding';
        }
        if (problem)
            this.report(s, 'SW2006', `Cannot assign to ${text}: ${root} is ${problem}.`, false, this.at(s, 'target'));
        const type = this.select(cell?.type ?? '?', valueSteps(s), env, c, op, s);
        this.value(s.value, type, env, c, op, true);
    }
    /**
     * Types the selectors after a value of type t (WP1-S02): .f selects a field of a record, [i] an element of
     * a fixed array with an integral index; a literal index outside the extent is a static error at every
     * position (WP1-S03). Every index expression is inferred, also after an error.
     */
    private select(t: string, steps: readonly Step[], env: Env, c: Structure | undefined, op: Executable | undefined, at: AstNode): string {
        for (const step of steps) {
            const range = (n: AstNode | undefined) => n === at || !n ? this.at(at, a.isAssign(at) ? 'target' : 'path') : {};
            if (step.field !== undefined) {
                if (t === '?')
                    continue;
                const record = /\[\d+\]$/.test(t) ? undefined : this.models.flatMap(m => m.packages.flatMap(p => p.elements)).find(x => identity(x) === t), f = a.isDataType(record) ? record.fields.find(x => x.name === step.field) : undefined;
                if (!f) {
                    this.report(step.node && step.node !== at ? step.node : at, 'SW2002', `${t} has no field ${step.field}.`, false, range(step.node));
                    t = '?';
                }
                else
                    t = typeKey(f.type);
                continue;
            }
            const index = step.index as a.Expression, it = this.infer(index, env, c, op), match = /^(.*)\[(\d+)\]$/.exec(t), n = constantNumber(index);
            if (!integral(it) && it !== '?')
                this.report(index, 'SW2002', `Index must be integral, found ${it}.`);
            if (t === '?')
                continue;
            if (!match) {
                this.report(index, 'SW2002', `${t} is not an array and cannot be indexed.`);
                t = '?';
                continue;
            }
            if (n !== undefined && (n < 0 || n >= Number(match[2])))
                this.report(index, 'SW2002', `Index ${index.$cstNode?.text.replace(/\s+/g, '') ?? n} is outside ${t}.`);
            t = match[1];
        }
        return t;
    }
    /** The first segment of a 3.0 test read that names no attribute or part, for the unknown-value message (review F5). */
    private failingSegment(e: a.ReferenceExpression, steps: readonly Step[]): string {
        const head = placeRoot(e.path), p = this.script && owner(this.script.scenario, a.isPackage), occurrence = p && packageOccurrences(p).find(o => o.name === head);
        if (!occurrence)
            return '';
        const walked = walkParts(occurrence, head, steps), step = steps[walked.next];
        if (step?.field === undefined)
            return '';
        const family = members(walked.structure).filter(a.isComponentUsage).find(x => x.name === step.field && x.size !== undefined);
        return family ? `: ${walked.path}.${step.field} is a part family and takes a literal index` : `: ${walked.path} has no attribute or part ${step.field}`;
    }
    /** A component index of a test path (WP1-S06): literal (SW2010), inside the multiplicity (SW2002), and only on a part family. */
    private partProblem(n: AstNode, property: string, problem: PartProblem): void {
        // A literal of a call path is printed as written, so a huge index is not rounded (review F5).
        const written = typeof problem.index === 'number' ? [...(GrammarUtils.findNodeForProperty(n.$cstNode, property)?.text ?? '').matchAll(/\[\s*(\d+)\s*\]/gu)].map(m => m[1]).find(x => Number(x) === problem.index) : undefined;
        const index = typeof problem.index === 'number' ? written ?? String(problem.index) : problem.index.$cstNode?.text ?? '?', node = typeof problem.index === 'number' ? n : problem.index, range = typeof problem.index === 'number' ? this.at(n, property) : {};
        if (problem.problem === 'literal')
            this.report(node, 'SW2010', `Component index in ${problem.path}[${index}] must be a literal.`, false, range);
        else if (problem.problem === 'range')
            this.report(node, 'SW2002', `Index ${index} is outside the multiplicity ${problem.child.size} of ${problem.path}.`, false, range);
        else
            this.report(node, 'SW2002', `${problem.path} is a single part and takes no index.`, false, range);
    }
    private inputEnv(n: {
        endpoint?: string;
        bindings: string[];
    } & AstNode, env: Env, c?: Structure, operation = false): Env {
        const result = new Map(env);
        if (this.script && a.isReceiveBranch(n)) {
            const ep = this.scriptPort(n, 'endpoint', n.endpoint, operation ? ['operation'] : ['attribute', 'event'], operation ? 'provides' : 'requires', operation ? 'on call' : 'on receive', 'SW2005');
            return ep ? this.bindings(n, ep.member, env, result, operation) : result;
        }
        if (n.endpoint?.split('.').length === 3) {
            this.report(n, 'SW2005', 'occurrence.port.member endpoints belong to case scripts; an operation receives through its own port as port.member.', false, this.at(n, 'endpoint'));
            return result;
        }
        const ep = c && n.endpoint && memberEndpoint(c, n.endpoint);
        if (!ep || (ep.member.kind === 'operation') !== operation || direction(ep.port, ep.member) !== (operation ? 'provides' : 'requires')) {
            this.report(n, 'SW2005', 'Input needs the matching owned member direction/kind.');
            return result;
        }
        return this.bindings(n, ep.member, env, result, operation);
    }
    private bindings(n: { bindings: string[] } & AstNode, member: a.PortMember, env: Env, result: Env, operation: boolean): Env {
        const ep = { member };
        const types = ep.member.kind === 'attribute' ? [typeKey(ep.member.type)] : ep.member.parameters.map(x => typeKey(x.type));
        if (types.length !== n.bindings.length || new Set(n.bindings).size !== n.bindings.length)
            this.report(n, 'SW2002', 'Input bindings must uniquely match every parameter.');
        n.bindings.forEach((name, i) => { if (env.has(name))
            this.report(n, 'SW2001', `Input ${name} shadows a live name.`); result.set(name, { type: types[i] ?? '?', mutable: operation && ep.member.parameters[i]?.direction === 'out' }); });
        return result;
    }
    private terminates(b: a.Block | a.ElseIf | a.OperationBody): boolean { return b.statements.some(s => a.isReturn(s) || a.isFail(s) || a.isIf(s) && !!s.otherwise && this.terminates(s.then) && this.terminates(s.otherwise) || a.isInterruptible(s) && this.terminates(s.body) && this.terminates(s.handler) || a.isUntil(s) && this.terminates(s.body) && (!s.limit||(constantNumber(s.limit)??0)>0) || a.isForEach(s) && /\[[1-9]\d*\]$/.test(expressionTypes.get(s.collection)??'') && this.terminates(s.body)); }
    private schedules(c: Structure, explained: ReadonlySet<a.ScheduleEntry>): void {
        const entries = schedule(c), keys = new Set<string>();
        for (const e of c.members.filter(a.isSchedule).flatMap(s => s.entries)) {
            // Computed periods and deadlines where they are written: typing, membership and the unit (WP4-S04, WP4-S05).
            for (const expression of [e.periodValue, e.deadlineValue])
                if (expression)
                    this.constantDuration(expression, c);
            // A release guard belongs to every, receive and after entries (WP7-S01, WP7-D01); reported once, where written.
            if (e.guard && (e.kind === 'start' || e.kind === 'call'))
                this.report(e.guard, 'SW2007', 'A release guard is allowed only on every, receive and after entries.');
            else
                this.guardWarnings(e, c);
            // The guard is not part of entry identity (WP7-S03): entries that differ only in their guard are duplicates.
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
            if (!explained.has(e)) {
                this.arguments(e, sig.parameters, e.args, env, c, op);
                if (e.guard && e.kind !== 'start' && e.kind !== 'call')
                    this.releaseGuard(e.guard, env, c, op);
            }
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
            const flow = flowStates(op).length > 0;
            if (flow)
                this.flowEntry(op, e, entries, c);
            if (!flow && e.concurrent && effects(op, c).writes)
                this.report(e, 'SW2006', 'Concurrent entries cannot write state through any callee or be stateful.');
            if (e.kind === 'every' && e.deadline && e.period && nanos(e.deadline) > nanos(e.period))
                this.report(e, 'SW2007', 'Periodic deadline cannot exceed its period.');
            if (e.kind === 'after') {
                if (!ops.some(x => x.name === e.predecessor) || !entries.some(x => x.operation === e.predecessor))
                    this.report(e, 'SW2007', 'after needs a scheduled same-owner predecessor.');
                if (!flow && (sig.parameters.length || typeKey(sig.result) !== 'void'))
                    this.report(e, 'SW2007', 'after targets are parameterless void flow operations.');
                graph.set(e.predecessor!, [...(graph.get(e.predecessor!) ?? []), op.name]);
            }
        }
        const cyclic = (name: string, seen: Set<string>): boolean => seen.has(name) || (graph.get(name) ?? []).some(x => cyclic(x, new Set([...seen, name])));
        for (const name of graph.keys())
            if (cyclic(name, new Set())) {
                this.report(c, 'SW2007', 'after dependencies must be acyclic.');
                break;
            }
        for (const op of ops)
            if (flowStates(op).length && !entries.some(e => e.operation === op.name))
                this.report(op, 'SW2008', `${formatName(op.name, MESSAGE_SPELLING)} contains states, so it keeps its place and needs exactly one on start or one on every entry, not concurrent (SIF-S01).`);
    }
    /**
     * SIF-S01 for one schedule entry of an operation with states (SIF-D01): exactly one effective entry, on start or on
     * every, never concurrent. The other entry kinds get a message that says how to write what they mean.
     */
    private flowEntry(op: Executable, e: a.ScheduleEntry, entries: readonly a.ScheduleEntry[], c: Structure): void {
        const name = formatName(op.name, MESSAGE_SPELLING), keeps = `${name} contains states, so it keeps its place`, released = `${keeps} and can only be released by one on start or one on every entry.`;
        if (e.kind === 'receive')
            this.report(e, 'SW2008', `${released} To react to ${formatPath(e.endpoint ?? '', MESSAGE_SPELLING)}, write on receive ${formatPath(e.endpoint ?? '', MESSAGE_SPELLING)}(…) { … } in its states.`);
        else if (e.kind === 'after')
            this.report(e, 'SW2008', `${released} To start after ${formatName(e.predecessor ?? '', MESSAGE_SPELLING)}, release ${name} on start and let its first state wait for a value that ${formatName(e.predecessor ?? '', MESSAGE_SPELLING)} sets.`);
        else if (e.kind === 'call')
            this.report(e, 'SW2008', `${released} An operation with states cannot answer calls; answer in a plain operation and let it set an attribute that a state reads.`);
        else if (e.concurrent)
            this.report(e, 'SW2008', `${keeps} and needs exactly one on start or one on every entry, not concurrent (SIF-S01).`);
        else {
            // Schedules accumulate: a derived definition that writes an entry for an inherited machine gives it a second one.
            // Reported at the entry written in the definition being checked, naming it and the inherited entry (review 4 P6).
            const all = entries.filter(x => x.operation === op.name), here = (x: a.ScheduleEntry) => owner(x, a.isSchedule)?.$container === c;
            const inherited = all.filter(x => !here(x));
            if (all.length !== 1 && here(e))
                this.report(e, 'SW2008', inherited.length && c.name !== undefined
                    ? `${keeps} and needs exactly one on start or one on every entry; ${formatName(c.name, MESSAGE_SPELLING)} adds ${e.$cstNode?.text.trim().replace(/;$/, '')} to the inherited ${inherited[0].$cstNode?.text.trim().replace(/;$/, '')}: the entry of an inherited machine cannot be changed (SIF-S01).`
                    : `${keeps} and needs exactly one on start or one on every entry, not concurrent (SIF-S01).`);
        }
    }
    /** SIF-S01 (parameterless void, no plain receive statement) and SIF-S02 (state names unique in the operation): SIF-D01, SIF-D03. */
    private flowOperation(op: Executable, b: a.OperationBody): void {
        const sig = signature(op);
        if (sig && (sig.parameters.length || typeKey(sig.result) !== 'void'))
            this.report(op, 'SW2008', `${formatName(op.name, MESSAGE_SPELLING)} contains states, so it is parameterless and returns void (SIF-S01).`);
        // A nested operation has no schedule entry of its own; it could only be called, which an operation with states never is.
        if (a.isOperationBody(op.$container))
            this.report(op, 'SW2008', `${formatName(op.name, MESSAGE_SPELLING)} contains states, so it is directly owned by a component definition and released by its schedule, never nested in an operation (SIF-S01).`, false, this.at(op, 'name'));
        const seen = new Set<string>();
        for (const s of flowStates(op)) {
            if (seen.has(s.name))
                this.report(s, 'SW2008', `Two states are named ${formatName(s.name, MESSAGE_SPELLING)} in ${formatName(op.name, MESSAGE_SPELLING)} (SIF-S02).`, false, this.at(s, 'name'));
            seen.add(s.name);
        }
        for (const n of nodes(b))
            if (a.isReceive(n) && owner(n, isExecutable) === op)
                this.report(n, 'SW2008', 'An operation with states contains no plain receive statement; write a state with an event line, for example state waitGo { on receive cmd.go(v) { ok = v; exit; } } (SIF-S01).');
    }
    /**
     * The message for a name that is no visible local. In an operation with states, a var declared in some state's braces is
     * a local of that state's looks (SIF-R10): the message says who sees it instead of speaking of nested operations.
     */
    private unknownLocal(e: AstNode, path: string): string {
        const head = path.split('.')[0], op = owner(e, isExecutable);
        const declared = op && body(op) ? flowStates(op).find(s => s.statements.some(x => a.isLocalVariable(x) && x.name === head)) : undefined;
        if (declared)
            return `Unknown local value ${path}; ${formatName(head, MESSAGE_SPELLING)} is declared in the braces of state ${formatName(declared.name, MESSAGE_SPELLING)}, a local of its looks: its later items and the items of its inner states see it, on entry, on exit and other states do not (SIF-R10).`;
        return `Unknown local value ${path}; nested operations never capture enclosing locals and component attributes are private.`;
    }
    /**
     * A state statement (SIF-S02 to SIF-S04, SIF-S07, SIF-S08; SIF-D03): where it may stand, its entry and exit actions,
     * items before inner states, event lines with their bindings and timers. Statements standing in the state are typed as
     * one list: a local declared there is a local of the look, seen by later items and by the items of inner states; entry
     * and exit actions see the enclosing scope only.
     */
    private stateStep(s: a.StateStep, env: Env, c: Structure | undefined, op: Executable | undefined, lookEnv: Env = env): void {
        const name = formatName(s.name, MESSAGE_SPELLING);
        if (!op || this.script) {
            this.report(s, 'SW2008', 'Case scripts contain no states (SIF-S01).');
            return;
        }
        // SIF-S04: a state stands in the flow, in a block of the flow, or directly in a parent's braces.
        for (let p: AstNode | undefined = s.$container; p && !isExecutable(p); p = p.$container) {
            if (a.isStateAction(p) || a.isEventLine(p) || a.isInterruptible(p) || a.isReceiveBranch(p) || a.isStateStep(p) && p !== s.$container) {
                this.report(s, 'SW2008', `State ${name} stands in the flow or directly in a parent's braces, never in on entry, on exit, an event line, an interrupt region or a statement of a state (SIF-S04).`, false, this.at(s, 'name'));
                break;
            }
            if (a.isStateStep(p))
                break;
        }
        for (const kind of ['entry', 'exit'] as const)
            if (s.statements.filter(x => a.isStateAction(x) && x.kind === kind).length > 1)
                this.report(s, 'SW2008', `Duplicate on ${kind} in ${name} (SIF-S02).`, false, this.at(s, 'name'));
        const first = s.statements.findIndex(a.isStateStep);
        if (first >= 0 && s.statements.slice(first).some(x => !a.isStateStep(x)))
            this.report(s, 'SW2008', `${name} has inner states; only states may follow the first one (SIF-S03).`, false, this.at(s, 'name'));
        // A local declared in the braces is a local of the look: later items and the items of inner states see it (SIF-R10);
        // on entry and on exit, of this state and of inner states, see the flow's scope only.
        const look = new Map(lookEnv);
        for (const item of s.statements) {
            if (a.isStateAction(item))
                this.block(item.body, env, c, op);
            else if (a.isEventLine(item))
                this.eventLine(item, look, c, op);
            else if (a.isStateStep(item))
                this.stateStep(item, env, c, op, look);
            else {
                this.block({ statements: [item] } as unknown as a.Block, look, c, op, look);
                if (a.isIf(item) && !(c && schedule(c).some(e => e.operation === op.name && e.kind === 'every')))
                    this.unannounced(item, s, c);
            }
        }
    }
    /**
     * SIF-S05 (SIF-D04): an if standing directly in a state of a waiting machine tests its conditions (the else if ones too)
     * at every look, and a waiting state looks only when something happens to it; time passing wakes nothing, so a condition
     * that reads now(), directly or through a called operation, would not be tested when the time it waits for comes. now()
     * in plain statements, in event line blocks and in a periodic machine (which looks at every release) is allowed.
     */
    private unannounced(item: a.If, s: a.StateStep, c: Structure | undefined): void {
        const visited = new Set<AstNode>();
        const clock = (root: AstNode): boolean => nodes(root).filter(a.isCallExpression).some(call => {
            const t = this.callTarget(call, c);
            if (!t || !isExecutable(t))
                return false;
            if (isClockRead(t))
                return true;
            const b = body(t);
            return !!b && !visited.has(b) && (visited.add(b), clock(b));
        });
        for (let x: a.If | undefined = item; x; x = a.isElseIf(x.otherwise) && a.isIf(x.otherwise.statements[0]) ? x.otherwise.statements[0] : undefined)
            if (x.condition && clock(x.condition)) {
                this.report(x, 'SW2006', `if (${x.condition.$cstNode?.text ?? '…'}) in ${formatName(s.name, MESSAGE_SPELLING)} reads now(); a waiting state tests it only when something wakes it and time passing wakes nothing, so write after D instead (SIF-D04).`, false, this.at(x, 'condition'));
                return;
            }
    }
    /** An event line (SIF-S07): its input (events and attributes only), its timer, and its block with the bindings. */
    private eventLine(line: a.EventLine, env: Env, c: Structure | undefined, op: Executable): void {
        const input = line.endpoint !== undefined ? this.inputEnv(line, env, c) : env;
        // A computed timer is evaluated once, when the state's entry actions finish; it is pure or reads state (WP4-S08).
        if (line.delayValue) {
            this.computedDuration(line.delayValue, env, c, op);
            for (const call of nodes(line.delayValue).filter(a.isCallExpression)) {
                const target = this.callTarget(call, c);
                if (target && (!isExecutable(target) || effects(target, c).writes || effects(target, c).communicates || effects(target, c).suspends))
                    this.report(line.delayValue, 'SW2008', 'State timers may only be pure or read state.');
            }
        }
        if (line.body)
            this.block(line.body, input, c, op);
    }
    /**
     * SIF-S04 and SIF-S06 (SIF-D02): exit; and to S; stand inside a state's braces, directly or in if/else blocks standing
     * there or in an event line's block; a jump names a state of a list that contains the jump's state or an enclosing list,
     * or a state inside parents standing directly in such a list, and never skips a declaration used at or after it.
     */
    private leaveRule(n: a.Exit | a.Jump, op: Executable | undefined): void {
        const word = a.isJump(n) ? `to ${formatName(n.target ?? '', MESSAGE_SPELLING)}` : 'exit';
        if (!op || this.script) {
            this.report(n, 'SW2008', `${word} leaves a state; case scripts contain no states (SIF-S04).`);
            return;
        }
        let state: a.StateStep | undefined;
        for (let p: AstNode | undefined = n.$container; p && !isExecutable(p); p = p.$container) {
            if (a.isStateAction(p) || a.isWhile(p) || a.isUntil(p) || a.isFor(p) || a.isForEach(p) || a.isInterruptible(p) || a.isReceiveBranch(p) || a.isReceive(p)) {
                this.report(n, 'SW2008', `${word} cannot stand in on entry, on exit, a loop body or an interrupt region; it stands in a state's braces, their if blocks or an event line's block (SIF-S04).`);
                return;
            }
            if (a.isStateStep(p)) {
                state = p;
                break;
            }
        }
        if (!state) {
            this.report(n, 'SW2008', `${word} leaves a state and stands only inside a state's braces (SIF-S04).`);
            return;
        }
        if (!a.isJump(n) || n.target === undefined)
            return;
        const target = n.target, within = (x: AstNode): boolean => a.isStateStep(x) && (x.name === target || innerStates(x).some(within));
        let found: { list: readonly AstNode[]; at: number; to: number } | undefined;
        for (let child: AstNode = n, p: AstNode | undefined = n.$container; p && !isExecutable(p); child = p, p = p.$container)
            if ((a.isBlock(p) || a.isOperationBody(p) || a.isStateStep(p) || a.isElseIf(p)) && child.$containerProperty === 'statements') {
                const to = p.statements.findIndex(within);
                if (to >= 0) {
                    found = { list: p.statements, at: child.$containerIndex ?? 0, to };
                    break;
                }
            }
        if (!found) {
            this.report(n, 'SW2008', `${word}: no state ${formatName(target, MESSAGE_SPELLING)} in this list, an enclosing one, or inside a parent standing in one; a jump never enters an if branch or a loop (SIF-S06).`, false, this.at(n, 'target'));
            return;
        }
        // A forward jump over a declaration that is used at or after the target (SIF-S06, SIF-R10).
        for (const skipped of found.list.slice(found.at + 1, found.to).filter(a.isLocalVariable)) {
            const uses = (x: AstNode) => nodes(x).some(r => a.isReferenceExpression(r) && r.path.split('.')[0] === skipped.name || a.isAssign(r) && placeRoot(r.target) === skipped.name);
            if (found.list.slice(found.to).some(uses)) {
                const local = formatName(skipped.name, MESSAGE_SPELLING);
                this.report(n, 'SW2008', `\`${word}\` skips the declaration of \`${local}\`, which \`${formatName(target, MESSAGE_SPELLING)}\` uses. Declare \`${local}\` before the jump (SIF-S06).`, false, this.at(n, 'target'));
                return;
            }
        }
    }
    /**
     * A release guard (WP7-S02, WP7-D02): bool, pure or reading state, typed in the scope of the entry's arguments, the
     * component's attributes, its sampled ports, now() and the entry's receive bindings, never the operation's
     * parameters (an unresolved name keeps its existing message). A call that writes or communicates is reported here;
     * an unresolved, remote or suspending call is reported by the call rules only (one diagnostic per cause). Like the
     * arguments, an inherited entry's guard is typed in every effective structure, so a derived definition that
     * redefines an attribute the guard reads gets a deterministic result before any run.
     */
    private releaseGuard(guard: a.Expression, env: Env, c: Structure, op: Executable): void {
        // An inherited guard from a document that does not parse is not typed in another one: its own document reports
        // only the syntax errors, and a valid file that specializes it gets no error for the unfinished guard.
        const declared = AstUtils.getDocument(guard).parseResult;
        if (declared.parserErrors.length || declared.lexerErrors.length)
            return;
        const type = this.infer(guard, env, c, op);
        if (type !== 'bool' && type !== '?')
            this.report(guard, 'SW2007', `Release guard must be bool, found ${type}.`);
        for (const call of nodes(guard).filter(a.isCallExpression)) {
            const target = this.callTarget(call, c);
            if (!target || !isExecutable(target) || effects(target, c).suspends)
                continue;
            if (effects(target, c).writes || effects(target, c).communicates)
                this.report(call, 'SW2007', 'Release guard must be pure or read state.');
        }
    }
    /**
     * SW2020 (warnings) on an entry where it is written in c. WP7-D03: its release guard folds to false in c, so the
     * entry never runs its operation; a guard that names a const attribute some specialization or usage redefines (the
     * same declaration) folds per occurrence and is left alone, as for WP6-D10. WP7-D04: an entry without a guard
     * replaces an inherited entry that has one (WP7-S03), from c's base or, for a part redefinition, from the usage it
     * redefines, which silently drops a safety condition; a replacement with any guard, if (true) included, states its
     * own condition and is not reported. The two messages start with fixed texts, `Release guard if (` and
     * `Replacing entry `, so a consumer tells them apart without a second code.
     */
    private guardWarnings(e: a.ScheduleEntry, c: Structure): void {
        if (e.kind === 'start' || e.kind === 'call')
            return;
        if (e.guard) {
            if (constantValue(e.guard, c).value === false && !this.redefinedConstant(e.guard, c))
                this.report(e.guard, 'SW2020', `Release guard if (${displayText(e.guard, MESSAGE_SPELLING)}) of ${this.guardEntryText(e)} is always false; the entry never runs ${formatName(e.operation, MESSAGE_SPELLING)}.`, true);
            return;
        }
        const base = a.isComponentDef(c) ? c.specializes?.ref : c.definition?.ref, key = entryKey(e);
        // The entries c replaces: those of its base and, for a part redefinition, those of the usage it redefines
        // (the effective schedule of that usage, which a redefinition replaces as a whole; review V1).
        const replaced = this.redefinedUsage(c);
        const inherited = [base, replaced].flatMap(s => s ? [schedule(s).find(x => entryKey(x) === key)] : []).find(x => x?.guard);
        // An inherited guard in a document that does not parse is not reported elsewhere (as in releaseGuard).
        const document = inherited?.guard && AstUtils.getDocument(inherited.guard).parseResult;
        if (!inherited?.guard || !document || document.parserErrors.length || document.lexerErrors.length)
            return;
        // An inherited guard that folds to true (if (true)) in c constrains nothing, so dropping it changes nothing.
        // The fold is evaluated in c, the replacing structure, where a const redefinition may change its value.
        if (constantValue(inherited.guard, c).value === true)
            return;
        const declared = container(inherited);
        const where = declared ? formatName(declared.name, MESSAGE_SPELLING) : 'its base';
        this.report(e, 'SW2020', `Replacing entry ${this.guardEntryText(e)} drops the inherited release guard if (${displayText(inherited.guard, MESSAGE_SPELLING)}) of ${where}, so it runs ${formatName(e.operation, MESSAGE_SPELLING)} whatever the guard says; repeat the guard, or write if (true) to remove it deliberately.`, true, { related: [inherited] });
    }
    /** The usage a `redefines component` usage replaces: the member of that name in its owner's base, if any. */
    private redefinedUsage(c: Structure): a.ComponentUsage | undefined {
        if (!a.isComponentUsage(c) || !c.redefines || !c.name)
            return undefined;
        const owner = c.$container;
        const base = a.isComponentDef(owner) ? owner.specializes?.ref : a.isComponentUsage(owner) ? owner.definition?.ref : undefined;
        if (!base || this.baseCycle(base, new Set()))
            return undefined;
        return members(base).find((m): m is a.ComponentUsage => a.isComponentUsage(m) && m.name === c.name);
    }
    /** An entry's trigger and operation for a message, with names spelled as in 2.2 (on every 10ms slot, after a b). */
    private guardEntryText(e: a.ScheduleEntry): string {
        const name = (x: string) => formatName(x, MESSAGE_SPELLING);
        const trigger = e.kind === 'every' ? `on every ${e.periodValue ? `(${displayText(e.periodValue, MESSAGE_SPELLING)})` : e.period ? `${e.period.value}${e.period.unit}` : ''}` : e.kind === 'after' ? `after ${name(e.predecessor!)}` : `on ${e.kind} ${formatPath(e.endpoint!, MESSAGE_SPELLING)}`;
        return `${trigger} ${name(e.operation)}`;
    }
    /**
     * Whether an expression names a const attribute of c that an attribute redefinition in a specialization or usage
     * replaces: the redefinition's base has that very declaration among its members (WP7-D03, as WP6 review N1).
     */
    private redefinedConstant(e: a.Expression, c: Structure): boolean {
        const names = new Set(nodes(e).filter(a.isReferenceExpression).map(r => r.path.split('.')[0]));
        const constants = new Set<AstNode>(members(c).filter(a.isAttribute).filter(x => x.constant && names.has(x.name)));
        return constants.size > 0 && this.models.some(m => nodes(m).some(n => {
            if (!a.isAttribute(n) || !n.redefines || !names.has(n.name))
                return false;
            const s = container(n), base = s && (a.isComponentDef(s) ? s.specializes?.ref : s.definition?.ref);
            return !!base && members(base).some(x => constants.has(x));
        }));
    }
    private ownership(c: Structure, forwarded: Set<string>, inheritedSampled: ReadonlySet<string>): void {
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
                if (a.isEventLine(n) && n.endpoint)
                    add(n.endpoint, op);
            }
        }
        // WP6-S04, WP6-D03: sampling is not ownership; a sampled required attribute has zero or one consuming owner.
        const sampled = new Set([...sampledMembers(c), ...inheritedSampled]);
        for (const p of members(c).filter(a.isPortUsage))
            for (const m of portMembers(p)) {
                const path = `${p.name}.${m.name}`, input = direction(p, m) === (m.kind === 'operation' ? 'provides' : 'requires');
                if (forwarded.has(p.name)) {
                    if (owners.has(path) || emitted.has(path))
                        this.report(p, 'SW2005', `Forwarded port ${p.name} cannot be locally handled/emitted.`);
                    continue;
                }
                if (input && (sampled.has(path) ? (owners.get(path)?.size ?? 0) > 1 : owners.get(path)?.size !== 1))
                    this.report(p, 'SW2005', `${path} needs exactly one input owner.`);
                if (!input && m.kind !== 'operation' && !emitted.has(path))
                    this.report(p, 'SW2005', `${path} needs an emitting operation.`);
            }
    }
    private deployment(d: a.Deployment): void {
        const root = d.root.ref, platform = d.platform.ref;
        // A run applies each top-level occurrence's deployment, so an occurrence has at most one.
        // A stable order, independent of document loading: the root's own package first, then document URI, then offset.
        const home = root && owner(root, a.isPackage), rank = (x: a.Deployment) => [owner(x, a.isPackage) === home ? 0 : 1, AstUtils.getDocument(x).uri.toString(), x.$cstNode?.offset ?? 0] as const;
        const earlier = root && this.models.flatMap(m => m.packages.flatMap(p => p.elements.filter(a.isDeployment))).filter(x => x.root.ref === root).sort((x, y) => { const [p, q] = [rank(x), rank(y)]; return p[0] - q[0] || (p[1] < q[1] ? -1 : p[1] > q[1] ? 1 : 0) || p[2] - q[2]; });
        if (earlier && earlier.length > 1 && earlier[0] !== d)
            this.report(d, 'SW2009', `At most one deployment per top-level occurrence: ${root!.name} is already deployed by ${identity(earlier[0])}.`, false, this.at(d, 'root'));
        if (!root || !platform || occurrenceCount(root) > OCCURRENCE_LIMIT || occurrenceCount(platform) > OCCURRENCE_LIMIT)
            return;
        if (!isNode(platform))
            this.report(d, 'SW2009', 'The platform root must specialize Swaml::Platform::Node.');
        const software = occurrences(root), targets = new Map(occurrences(platform).map(o => [o.path, o])), seen = new Set<string>(), plan = deploymentPlan(d);
        const known = plan ? undefined : new Set(software.flatMap(o => { const family = /^(.*)\[\d+\]$/u.exec(o.path)?.[1]; return family !== undefined ? [o.path, family] : [o.path]; }));
        d.placements.forEach((p, i) => {
            const path = p.target ? `${root.name}.${p.target}` : root.name;
            // WP8-D09: exact paths, operation paths included, are unique within one deployment.
            if (seen.has(path))
                this.report(p, 'SW2009', 'Duplicate exact deployment path.');
            seen.add(path);
            const placed = plan?.placements[i];
            // WP8-S01: a path may end at an operation that an effective entry of the addressed occurrence releases.
            // WP8-D01 names an unreleased operation only on a Swaml::Os platform; elsewhere a path that is neither an
            // occurrence nor a released operation keeps its 2.2 message (owner decision WP8-A).
            if (placed?.unreleased && plan!.coreRule)
                this.report(p, 'SW2009', `${pathText(placed.path)} names operation ${formatName(placed.unreleased.operation, MESSAGE_SPELLING)}, which no schedule entry of ${pathText(placed.unreleased.occurrence)} releases.`);
            else if (placed ? placed.kind === 'unknown' : !known!.has(path))
                this.report(p, 'SW2009', `Unknown software occurrence ${path}.`);
            const target = targets.get(`${platform.name}.${p.node}`);
            if (!target || !isNode(target.structure))
                this.report(p, 'SW2009', `Target ${p.node} must be a Node occurrence.`);
            // WP8-D12: without a Swaml::Os Task an operation placement changes no run; only T7 uses it.
            else if (placed?.kind === 'operation' && !plan!.taskRules && !plan!.rootTask)
                this.report(p, 'SW2021', `Operation placement ${pathText(placed.path)} on ${pathText(target.path)} does not change the run on a platform without a Swaml::Os task: the run records and orders occurrence placements only, and only the one-core rule T7 uses it.`, true);
        });
        if (plan)
            this.taskRules(plan);
    }
    /**
     * The static task rules of a deployment on a Swaml::Os platform (WP8-S04 to WP8-S10, WP8-D13): T1 to T5 for the
     * Tasks of the platform and the entries on them, T6 for the entries of occurrences deployed in a Core that has
     * Tasks, T7 when the platform contains a Core or a Task. A platform with neither keeps its 2.2 meaning. Findings
     * about a Task are reported at the platform reference, findings about entries at the deploy statement that
     * places them, unplaced entries (T6) at the deployed root; each message is reported once per range.
     */
    private taskRules(plan: DeploymentPlan): void {
        const d = plan.deployment, reported = new Set<string>();
        const once = (n: AstNode, message: string, range: { range?: Range } = {}) => {
            const key = `${n.$cstNode?.offset}:${range.range ? JSON.stringify(range.range) : ''}:${message}`;
            if (!reported.has(key)) {
                reported.add(key);
                this.report(n, 'SW2009', message, false, range);
            }
        };
        const platformRange = this.at(d, 'platform'), task = (t: OsTask) => pathText(t.path);
        // WP8-D13: a Task needs a Core or Node above it; the root of a platform cannot be one.
        if (plan.rootTask) {
            once(d, `The platform root ${pathText(plan.platform.name)} is a Swaml::Os task; a task runs on a core or node, so declare the task inside a Node or Core platform and deploy on it.`, platformRange);
            return;
        }
        if (plan.taskRules) {
            for (const t of plan.tasks) {
                // WP8-D11: every Task attribute is a constant of its type in that occurrence.
                for (const p of t.problems)
                    once(d, `${p.attribute} of task ${task(t)} must be a constant ${p.attribute === 'kind' ? 'TaskKind literal' : p.attribute === 'preemptive' ? 'bool' : 'uint'} value${p.tooLarge ? ` up to ${Number.MAX_SAFE_INTEGER}` : ''}.`, platformRange);
                // T3 (WP8-D04): an isr Task has periodNs = 0 and is preemptive.
                if (t.kind === 'isr' && t.periodNs !== undefined && t.periodNs !== 0n)
                    once(d, `ISR task ${task(t)} must have periodNs = 0.`, platformRange);
                if (t.kind === 'isr' && t.preemptive === false)
                    once(d, `ISR task ${task(t)} must be preemptive.`, platformRange);
            }
            // T1 (WP8-D02): unique priorities among the Tasks of one Core.
            const family = (path: string) => /^(.*)\[\d+\]$/u.exec(path)?.[1];
            for (const [i, t] of plan.tasks.entries()) {
                const other = plan.tasks.slice(0, i).find(x => x.core === t.core && x.priority !== undefined && x.priority === t.priority);
                if (other)
                    once(d, `Tasks ${task(other)} and ${task(t)} of ${coreText(plan, t.core)} share priority ${t.priority}${family(other.path) !== undefined && family(other.path) === family(t.path) ? `; the members of a task family share their definition's priority, so declare the tasks of one core separately` : ''}.`, platformRange);
            }
            for (const e of plan.entries) {
                const at = e.placement?.node, what = `${entryLabel(e.entry)} of ${pathText(e.occurrence.path)}`;
                if (!e.task) {
                    // T6 (WP8-D07, WP8-S04): an occurrence deployed in a Core that has Tasks, or an entry placed in one, needs a
                    // Task of that Core; else one deployed on (or placed on) a Node in no Core with tasked Cores below it, such
                    // as an ECU, or left on such a platform root, needs a Task of one of those Cores. Only a Node without a
                    // tasked Core below it is outside the task rules.
                    const core = [plan.occurrenceCore.get(e.occurrence), e.core].find(c => c !== undefined && plan.taskedCores.has(c));
                    const region = core === undefined ? plan.occurrenceRegion.get(e.occurrence) ?? e.region : undefined;
                    if (core !== undefined || region !== undefined)
                        once(d, this.unplacedMessage(plan, e, core !== undefined ? { core } : { region: region! }), this.at(d, 'root'));
                    continue;
                }
                const t = e.task;
                if (!at || t.problems.length)
                    continue;
                // T2 (WP8-D03) and T3 (WP8-D04): entry kinds per Task. An after successor runs on its predecessor's Task, on
                // every Task kind; a successor whose predecessor is not on a Task is left to T6.
                const before = predecessors(plan, e);
                if (e.entry.kind === 'after') {
                    const other = before.every(p => p.task) ? before.find(p => p.task !== t) : undefined;
                    if (other?.task)
                        once(at, `${what} cannot run on task ${task(t)}: its predecessor runs on ${task(other.task)}, and an after successor runs on the task of its predecessor.`);
                }
                else if (t.kind === 'isr' && e.entry.kind !== 'receive')
                    once(at, `ISR task ${task(t)} accepts only receive entries and their after successors; ${what} is not one.`);
                else if (t.kind !== 'isr' && t.periodNs && e.entry.kind === 'every' && !this.periodFits(e, t))
                    once(at, `${what} cannot run on periodic task ${task(t)}: its period ${durationText(entryPeriod(e.entry, e.occurrence.structure) ?? 0)} is not a multiple of ${durationText(t.periodNs)}.`);
                else if (t.kind !== 'isr' && t.periodNs && e.entry.kind !== 'every')
                    once(at, `${what} cannot run on periodic task ${task(t)}: event entries need a task with periodNs = 0.`);
                // T4 (WP8-D05): an activation that may suspend runs on an extended Task.
                const site = t.kind !== 'extended' ? this.suspends(e) : undefined;
                if (site)
                    once(at, `${what} may suspend in ${statementText(site)} and needs an extended task; ${task(t)} is ${t.kind}.`);
                // T5 (WP8-D06): an explicit deadline is not shorter than the Task's response bound; an implicit one is not checked.
                const deadline = e.entry.deadline || e.entry.deadlineValue ? entryDeadline(e.entry, e.occurrence.structure) : undefined;
                if (t.responseNs && deadline !== undefined && BigInt(deadline) < t.responseNs)
                    once(at, `Deadline ${durationText(deadline)} of ${what} is shorter than the response bound ${durationText(t.responseNs)} of ${task(t)}.`);
            }
        }
        // T7 (WP8-D08): the entries of one component occurrence reach at most one Core.
        if (plan.coreRule)
            for (const o of plan.software) {
                const reached = (plan.byOccurrence.get(o) ?? []).filter(e => e.core !== undefined);
                const second = reached.find(e => e.core !== reached[0].core);
                if (second)
                    once(second.placement!.node, `${pathText(o.path)} runs on ${coreText(plan, reached[0].core!)} and ${coreText(plan, second.core!)}; all its operations must run on one core.`);
            }
    }
    /** T2: the evaluated period of an every entry is a positive multiple of a periodic Task's period. */
    private periodFits(e: EntryPlacement, t: OsTask): boolean {
        const period = entryPeriod(e.entry, e.occurrence.structure);
        return period !== undefined && !!t.periodNs && BigInt(period) % t.periodNs === 0n;
    }
    /** T4: where an activation of the entry's operation may suspend, if anywhere. */
    private suspends(e: EntryPlacement): AstNode | undefined {
        const op = members(e.occurrence.structure).filter(isExecutable).find(x => x.name === e.entry.operation);
        return op ? suspendSite(op, e.occurrence.structure) : undefined;
    }
    /** What any entry on Task t needs apart from its kind: T4, T5, and no attribute problem of t (WP8-D11). */
    private suits(e: EntryPlacement, t: OsTask): boolean {
        if (t.problems.length || t.kind !== 'extended' && this.suspends(e))
            return false;
        const deadline = e.entry.deadline || e.entry.deadlineValue ? entryDeadline(e.entry, e.occurrence.structure) : undefined;
        return !(t.responseNs && deadline !== undefined && BigInt(deadline) < t.responseNs);
    }
    /**
     * T2 to T5 for entry e on Task t. An after successor runs on its predecessor's Task, so t must also accept the
     * predecessor's entries (T2 and T3 admit a successor wherever its predecessor is).
     */
    private accepts(plan: DeploymentPlan, e: EntryPlacement, t: OsTask, seen = new Set<EntryPlacement>()): boolean {
        if (seen.has(e))
            return true;
        seen.add(e);
        if (!this.suits(e, t))
            return false;
        if (e.entry.kind === 'after')
            return predecessors(plan, e).every(p => this.accepts(plan, p, t, seen));
        return t.kind === 'isr' ? e.entry.kind === 'receive' : t.periodNs ? e.entry.kind === 'every' && this.periodFits(e, t) : true;
    }
    /**
     * T6 (WP8-D07): an entry that is not on a Task although its occurrence (or its own placement) is in Core core, which
     * has Tasks, or on Node region, which is in no Core but has Cores with Tasks below it (WP8-S04). The example gives
     * deploy lines that satisfy T2 to T5 and T7: a Task of that Core (for a region, of the Core the occurrence already
     * reaches, else of any tasked Core below the region) that accepts the entry, preferring a Task that is no ISR, then
     * the Task that already hosts an entry of the occurrence or of its nearest ancestor, then one that accepts every
     * unplaced entry of the occurrence, then declaration rank. An after successor names its predecessor's Task when that
     * Task accepts it, else a Task for both. A line whose exact path already has a deploy statement is shown as a change
     * of that statement (WP8-D09). Without a suitable Task the message says so.
     */
    private unplacedMessage(plan: DeploymentPlan, e: EntryPlacement, scope: { core: string } | { region: string }): string {
        const operation = formatName(e.entry.operation, MESSAGE_SPELLING), occurrence = pathText(e.occurrence.path);
        const where = 'core' in scope ? coreText(plan, scope.core) : pathText(scope.region);
        const head = `${entryLabel(e.entry)} of ${occurrence} is not placed on a task of ${where}`;
        // A deploy line for operation op of this occurrence on Task t; an existing line for that exact path is changed.
        const line = (op: string, t: OsTask) => {
            const relative = e.occurrence.path === plan.root.name ? '' : pathText(e.occurrence.path.slice(plan.root.name.length + 1)) + '.';
            const target = `${relative}${formatName(op, MESSAGE_SPELLING)}`, on = pathText(t.path.slice(plan.platform.name.length + 1));
            const existing = plan.placements.find(p => p.path === `${e.occurrence.path}.${op}`);
            return existing ? `change deploy ${target} on ${pathText(existing.node.node ?? '')}; to deploy ${target} on ${on};` : `deploy ${target} on ${on};`;
        };
        const example = (t: OsTask) => `${head}; place ${operation} or ${occurrence} on a task, for example: ${line(e.entry.operation, t)}`;
        const own = plan.byOccurrence.get(e.occurrence) ?? [];
        const reached = own.map(x => x.core).find(c => c !== undefined && plan.taskedCores.has(c));
        const below = (region: string, core: string) => core.startsWith(`${region}.`) || core.startsWith(`${region}[`);
        const inScope = (t: OsTask) => 'core' in scope ? t.core === scope.core : reached !== undefined ? t.core === reached : below(scope.region, t.core);
        const unplaced = own.filter(x => !x.task);
        // How near the Task is: the nearest occurrence (this one, then its ancestors) with an entry on it, then that
        // entry's schedule order.
        const nearness = (t: OsTask): [number, number] => {
            let n = 0;
            for (let o: Occurrence | undefined = e.occurrence; o; o = o.parent !== undefined ? plan.occurrenceAt.get(o.parent) : undefined, n++) {
                const i = plan.byOccurrence.get(o)?.findIndex(x => x.task === t) ?? -1;
                if (i >= 0)
                    return [n, i];
            }
            return [Infinity, 0];
        };
        const choose = (fits: (t: OsTask) => boolean) => plan.tasks.filter(t => inScope(t) && fits(t))
            .map(t => ({ t, key: [t.kind === 'isr' ? 1 : 0, ...nearness(t), unplaced.every(x => this.accepts(plan, x, t)) ? 0 : 1, t.rank] }))
            .sort((x, y) => { for (let i = 0; i < x.key.length; i++) if (x.key[i] !== y.key[i]) return x.key[i] < y.key[i] ? -1 : 1; return 0; })[0]?.t;
        const deadline = e.entry.deadline || e.entry.deadlineValue ? entryDeadline(e.entry, e.occurrence.structure) : undefined;
        const extra = `${this.suspends(e) ? ', of kind extended' : ''}${deadline !== undefined ? `, with responseNs = 0 or at most ${durationText(deadline)}` : ''}`;
        if (e.entry.kind === 'after') {
            const before = predecessors(plan, e), host = before[0]?.task;
            const predecessor = formatName(e.entry.predecessor ?? '', MESSAGE_SPELLING);
            if (host && inScope(host) && before.every(p => p.task === host) && this.suits(e, host))
                return example(host);
            const both = choose(t => this.accepts(plan, e, t));
            if (both) {
                const first = before.some(p => p.task) ? `move ${predecessor} to a task that also accepts ${operation}` : `place ${predecessor} on a task first`;
                return `${head}; an after successor runs on the task of its predecessor, so ${first} and place ${operation} with it, for example: ${line(e.entry.predecessor ?? '', both)} ${line(e.entry.operation, both)}`;
            }
            return `${head}; ${where} has no task that accepts it (it needs a task that also accepts its predecessor ${predecessor}${extra}), so add one and place ${operation} or ${occurrence} on it.`;
        }
        const host = choose(t => this.accepts(plan, e, t));
        if (host)
            return example(host);
        const need = e.entry.kind === 'every' ? `a task that is no ISR, with periodNs = 0 or a period that divides ${durationText(entryPeriod(e.entry, e.occurrence.structure) ?? 0)}` : e.entry.kind === 'receive' ? 'a task with periodNs = 0' : 'a task with periodNs = 0 that is no ISR';
        return `${head}; ${where} has no task that accepts it (it needs ${need}${extra}), so add one and place ${operation} or ${occurrence} on it.`;
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
            // Flow and Timing show executables, operations and cases; Sequence also starts from an operation.
            if (['Flow', 'Timing'].includes(kind) && !isExecutable(item.node) && !a.isScenario(item.node) || kind === 'Interconnect' && !a.isComponentUsage(item.node) && !a.isComponentDef(item.node) || ['Case', 'Sequence'].includes(kind) && !a.isScenario(item.node) && !a.isComponentUsage(item.node) && !a.isComponentDef(item.node) && !a.isPackage(item.node) && !(kind === 'Sequence' && isExecutable(item.node)))
                this.report(v, 'SW2010', `Subject ${item.path} is not valid for ${kind}.`);
    }
    /** The range of one property of a node, for diagnostics on the offending reference. */
    private at(n: AstNode, property: string): { range?: Range } { return { range: GrammarUtils.findNodeForProperty(n.$cstNode, property)?.range }; }
    /** Package connections join ports of top-level occurrences declared in the same package. */
    private packageConnections(p: a.Package): void {
        const pairs = new Set<string>(), duplicates = new Set<a.Connect>();
        for (const link of p.connections) {
            const ends = [link.source, link.target].map(path => packageEndpoint(p, path));
            if (!ends[0] || !ends[1]) {
                for (const property of (['source', 'target'] as const).filter((_, i) => !ends[i])) {
                    const path = link[property], head = path.split(/[.[]/)[0], found = resolve(p, head, this.models);
                    this.report(link, 'SW2004', found && !p.elements.includes(found)
                        ? `Occurrences cannot be connected across packages: ${head} is not declared in package ${p.name}. Declare a top-level occurrence here.`
                        : `Package connection end ${path} must name a port of a top-level component occurrence of package ${p.name}.`, false, this.at(link, property));
                }
                continue;
            }
            const pair = [link.source, link.target].sort().join('|');
            if (link.source === link.target || pairs.has(pair)) {
                this.report(link, 'SW2004', 'Duplicate or self connector.');
                duplicates.add(link);
            }
            pairs.add(pair);
            for (const issue of compatibility(ends[0].port, ends[1].port))
                this.report(link, 'SW2004', `Connection: ${issue}.`);
            this.memberPolicies(link, false, [ends[0].port, ends[1].port]);
            for (const ep of ends)
                for (const m of portMembers(ep!.port))
                    if (m.kind === 'operation' && direction(ep!.port, m) === 'provides' && !m.idempotent && memberQos(link, m.name).delivery === 'atLeastOnce')
                        this.report(link, 'SW2013', `atLeastOnce requires idempotent provided operation ${ep!.path}.${m.name}.`);
        }
        // Closure is per package: each required port of every occurrence needs a peer, either inside
        // its component or, for a port of a top-level occurrence, through a package connection.
        // A top-level occurrence with a containment cycle or above the reference limit is reported elsewhere and skipped here.
        const roots = packageOccurrences(p).filter(r => !this.containmentCycle(r, new Set()) && occurrenceCount(r) <= OCCURRENCE_LIMIT), checked = new Set(roots.map(r => r.name));
        const { occurrences: occ, links, leaf } = connectionRoutes(p), counts = new Map<string, number>(), routes = new Set<string>();
        for (const link of links) {
            const pair = [...link.ends].sort().join('|');
            // An exact duplicate package connection was already reported above.
            if (routes.has(pair) && !(link.owner === undefined && duplicates.has(link.node)))
                this.report(link.owner === undefined ? link.node : roots.find(r => r.name === link.owner!.split('.')[0]) ?? p, 'SW2004', 'Duplicate connection after forwarding resolution.');
            routes.add(pair);
            for (const end of link.ends)
                counts.set(end, (counts.get(end) ?? 0) + 1);
        }
        for (const o of occ.filter(o => checked.has(o.path.split('.')[0])))
            for (const port of members(o.structure).filter(a.isPortUsage)) {
                const path = o.path + '.' + port.name, count = counts.get(leaf(path)) ?? 0;
                // A top-level port is closed by the package, so its finding belongs to that occurrence, where a
                // package connection is missing or repeated; a nested port is closed inside its component.
                const top = roots.find(r => r.name === o.path), node = top ?? port, range = top ? { ...this.at(top, 'name'), declaration: port } : {};
                if (!port.optional && !count)
                    this.report(node, 'SW2004', `Unconnected required port ${path} in package ${p.name}.`, false, range);
                if (count > 1 && portMembers(port).some(m => direction(port, m) === 'requires' && m.kind !== 'event'))
                    this.report(node, 'SW2004', `Port ${path} requires exactly one peer after forwarding.`, false, range);
            }
    }
    /** The case script being validated: its case and, inside on call, the answered result type. */
    private script?: { scenario: a.Scenario; reply?: string };
    /**
     * A case with statements is a script (ADR 0019): it needs a subject, acts as associated
     * interface-only components through their ports and may call its primary subject.
     * Tests also have private read/helper access to their permitted occurrence roots.
     */
    private caseScript(s: a.Scenario, p: a.Package): void {
        if (!s.statements.length)
            return;
        if (!s.subject)
            this.report(s, 'SW2010', `Statements of ${s.name} require of: name the top-level occurrence of package ${p.name} that the case exercises.`, false, this.at(s, 'name'));
        else if (s.subject.ref && (isNode(s.subject.ref) || s.subject.ref.size !== undefined))
            this.report(s, 'SW2010', 'An executable case subject must be one software occurrence; platform roots do not execute and multiplicity families require an indexed identity that case subjects cannot express.', false, this.at(s, 'subject'));
        this.script = { scenario: s };
        try {
            this.block(s, new Map(), undefined, undefined);
        }
        finally {
            this.script = undefined;
        }
    }
    /** Resolves occurrence.port.member in a case script and checks the environment role, kind and direction. */
    private scriptPort(n: AstNode, property: string, path: string, kinds: string[], expected: 'provides' | 'requires', what: string, code: string): { port: a.PortUsage; member: a.PortMember } | undefined {
        const s = this.script!.scenario, range = this.at(n, property), p = owner(s, a.isPackage)!;
        const t = path.split('.').length === 3 ? caseTarget(s, path) : undefined;
        if (!t || t.kind !== 'port') {
            this.report(n, code, `Endpoints in case scripts are occurrence.port.member, naming a port member of a top-level component occurrence of package ${p.name}; ${path} is not one.`, false, range);
            return undefined;
        }
        const o = t.occurrence;
        if (o === s.subject?.ref) {
            this.report(n, 'SW2010', `${s.name} acts as the environment of its subject ${o.name}; act through the port of an associated interface-only component connected to it.`, false, range);
            return undefined;
        }
        if (!associatedOccurrences(s).includes(o))
            this.report(n, 'SW2010', `${o.name} takes part in ${s.name} only when associated: write associate ${formatName(o.name, MESSAGE_SPELLING)} to ${formatName(s.name, MESSAGE_SPELLING)}; in package ${p.name}.`, false, range);
        if (!interfaceOnly(o))
            this.report(n, 'SW2010', `A case acts only as interface-only components (ports without operations, schedule entries or parts); ${o.name} has behavior of its own.`, false, range);
        if (!kinds.includes(t.member.kind) || direction(t.port, t.member) !== expected) {
            this.report(n, code, `${what} needs a ${expected} ${kinds.join(' or ')} of ${o.name}.${t.port.name}; ${t.member.name} is a ${direction(t.port, t.member)} ${t.member.kind}.`, false, range);
            return undefined;
        }
        return { port: t.port, member: t.member };
    }
    /** Private state access: only a test, into its subject or explicitly associated software roots. */
    private whiteBox(n: AstNode, property: string, path: string, what: 'read' | 'call'): void {
        const s = this.script!.scenario;
        if (s.kind !== 'test')
            this.report(n, 'SW2010', `Private attribute access belongs to tests. A use case calls its primary subject or interacts through associated actor ports; it cannot ${what} ${path}.`, false, this.at(n, property));
        else if (!testCanAccess(s, path))
            this.report(n, 'SW2010', `A test may ${what} only its subject, explicitly associated software components and their ${path.includes('[') ? 'parts (a part family member by a literal index)' : 'single parts'}; ${path} is not an accessible occurrence. Associate its top-level software component with ${formatName(s.name, MESSAGE_SPELLING)}.`, false, this.at(n, property));
    }
    /** Cases, associations, satisfy and verify claims are package members that record intent. */
    private links(p: a.Package): void {
        const local = (n: AstNode | undefined) => !!n && n.$container === p;
        const at = (n: AstNode, property: string) => this.at(n, property);
        for (const s of p.elements.filter(a.isScenario)) {
            const subject = s.subject?.ref;
            if (subject && !local(subject))
                this.report(s, 'SW2010', `The subject of ${s.name} must be a top-level component occurrence of package ${p.name}; write the case in the package that declares ${subject.name}.`, false, at(s, 'subject'));
        }
        // A single 2.2 statement keeps its 2.2 checks, ranges and messages; a list statement (WP2-G03) applies
        // the same rules to every listed reference and pair (WP2-S06).
        const associated = new Set<string>(), pairs = new Map<string, a.Association>();
        // The reference range of the listed occurrence or case at a list position.
        const listed = (x: a.Association, kind: 'occurrence' | 'target', index: number) => index === 0 ? at(x, kind)
            : { range: GrammarUtils.findNodeForProperty(x.$cstNode, kind === 'occurrence' ? 'moreOccurrences' : 'moreTargets', index - 1)?.range };
        for (const x of p.associations) {
            associationOccurrences(x).forEach((o, i) => {
                if (o.ref && !local(o.ref))
                    this.report(x, 'SW2010', `associate names a top-level component occurrence of package ${p.name}; ${o.ref.name} is declared elsewhere.`, false, listed(x, 'occurrence', i));
            });
            associationTargets(x).forEach((t, j) => {
                if (t.ref && !local(t.ref))
                    this.report(x, 'SW2010', `associate names a use case or test of package ${p.name}; ${t.ref.name} is declared elsewhere.`, false, listed(x, 'target', j));
            });
            for (const pair of associationPairs(x)) {
                const occurrence = pair.occurrence.ref, target = pair.target.ref;
                if (occurrence && target && target.subject?.ref === occurrence)
                    this.report(x, 'SW2010', `${occurrence.name} is the subject of ${target.name}; associate names another participant.`, false, listed(x, 'occurrence', pair.occurrenceIndex));
            }
            if (!isAssociationList(x)) {
                const key = x.occurrence.$refText + '|' + x.target.$refText;
                if (associated.has(key)) {
                    this.report(x, 'SW2010', `Duplicate associate ${x.occurrence.$refText} to ${x.target.$refText}.`);
                    continue;
                }
                associated.add(key);
            }
            // A pair repeated within one statement or across statements is reported at the later reference
            // (WP2-S06, WP2-D03): the repeated occurrence or case of a list, or else the later pair's occurrence.
            const seen = new Set<string>();
            for (const pair of associationPairs(x)) {
                const occurrence = pair.occurrence.ref, target = pair.target.ref;
                if (!occurrence || !target)
                    continue;
                const key = identity(occurrence) + '|' + identity(target), earlier = pairs.get(key);
                if (earlier && !(earlier !== x && !isAssociationList(earlier) && !isAssociationList(x))) {
                    const repeatedCase = earlier === x && seen.has(identity(occurrence) + '|' + pair.occurrenceIndex + '|' + identity(target));
                    this.report(x, 'SW2010', `${occurrence.name} is already associated with ${target.name}.`, false, repeatedCase ? listed(x, 'target', pair.targetIndex) : listed(x, 'occurrence', pair.occurrenceIndex));
                }
                pairs.set(key, earlier ?? x);
                seen.add(identity(occurrence) + '|' + pair.occurrenceIndex + '|' + identity(target));
            }
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
