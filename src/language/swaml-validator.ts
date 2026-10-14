import { AstUtils, type AstNode, type ValidationAcceptor, type LangiumCoreServices } from 'langium';
import * as a from './generated/ast.js';
import { owner } from './swaml-scope.js';
import { container, endpoint, members, named, nanos, resolvePath, resolveEnumLiteral, typeKey, type Container } from './semantic.js';

type Env = Map<string, string>;
export class SwamlValidator {
    constructor(private services: LangiumCoreServices) {}
    checkModel(model: a.Model, accept: ValidationAcceptor): void {
        const parseResult = AstUtils.getDocument(model).parseResult;
        if (parseResult.lexerErrors.length || parseResult.parserErrors.length) return;
        const error = (node: AstNode, code: string, message: string) => accept('error', message, { node, code });
        const nodes = [model, ...AstUtils.streamAllContents(model)];
        const packages = [...this.services.shared.workspace.LangiumDocuments.all].flatMap(d => a.isModel(d.parseResult.value) ? d.parseResult.value.packages : []);
        for (const pkg of model.packages) if (packages.filter(p => p.name === pkg.name).length > 1) error(pkg, 'SW002', 'Package names must be unique across the workspace.');
        
        for (const node of nodes) {
            const children = [...AstUtils.streamContents(node)].filter((n): n is AstNode & { name: string } => 'name' in n);
            const names = new Set<string>();
            for (const child of children) {
                if (names.has(child.name)) error(child, 'SW002', `Duplicate name '${child.name}' in this scope.`);
                names.add(child.name);
            }
            if (a.isImport(node)) {
                const packages = [...this.services.shared.workspace.LangiumDocuments.all].flatMap(d => a.isModel(d.parseResult.value) ? d.parseResult.value.packages : []);
                if (!packages.some(p => p.name === node.namespace)) error(node, 'SW004', 'Imported package does not exist in the loaded workspace.');
            }
            if (a.isLiteral(node) && node.number !== undefined && (!Number.isFinite(node.number) || (!node.$cstNode?.text.includes('.') && !Number.isSafeInteger(node.number)))) error(node, 'SW025', 'Numeric literal exceeds the supported range.');
            if (a.isEnumType(node) && new Set(node.literals).size !== node.literals.length) error(node, 'SW002', 'Enum literals must be unique.');
            if (a.isInterface(node)) {
                if (!/^\d+\.\d+\.\d+$/.test(node.version)) error(node, 'SW003', 'Interface version must be major.minor.patch.');
                for (const m of node.members) {
                    const allowed = node.kind === 'senderReceiver' ? a.isDataMember(m) : node.kind === 'clientServer' ? a.isSignature(m) : node.kind === 'publishSubscribe' ? a.isEventMember(m) : a.isSignature(m) || a.isEventMember(m);
                    if (!allowed) error(m, 'SW010', `Member is not valid in a ${node.kind} interface.`);
                }
                if (!node.members.length) error(node, 'SW010', 'An interface must declare at least one member.');
            }
            if (a.isPort(node) && node.interface.ref) {
                const roles = { senderReceiver: ['sender', 'receiver'], clientServer: ['client', 'server'], publishSubscribe: ['publisher', 'subscriber'], service: ['provides', 'requires'] };
                if (!roles[node.interface.ref.kind].includes(node.role)) error(node, 'SW011', 'Port role does not match interface kind.');
            }
            if (a.isRootComponent(node) && node.definition?.ref) {
                for (const member of node.members) {
                    if (!a.isNode(member) && !a.isDeployment(member)) error(member, 'SW012', 'A typed root may bind nodes and deployment only; change topology in its component definition.');
                    if ('name' in member && node.definition.ref.members.some(m => 'name' in m && m.name === member.name)) error(member, 'SW002', `Root binding name '${member.name}' duplicates a member of its definition.`);
                }
            }
            if (a.isInstance(node) && node.definition.ref) {
                if ((node.kind === 'unit') !== a.isUnit(node.definition.ref)) error(node, 'SW012', 'Instance kind must match its definition.');
                const visit = (d: a.Definition, seen: Set<a.Definition>): boolean => {
                    if (seen.has(d)) return true;
                    const next = new Set(seen).add(d);
                    return a.isComponent(d) && d.members.filter(a.isInstance).some(i => i.definition.ref && visit(i.definition.ref, next));
                };
                if (visit(node.definition.ref, new Set())) error(node, 'SW013', 'Recursive component containment is not allowed.');
            }
            if (a.isTypeRef(node)) {
                if (node.size !== undefined && (!Number.isSafeInteger(node.size) || node.size <= 0)) error(node, 'SW020', 'Array size must be positive.');
                if (node.primitive === 'Void' && !(a.isOperation(node.$container!) || a.isSignature(node.$container!) || a.isFunctionDef(node.$container!))) error(node, 'SW020', 'Void is allowed only as a result type.');
                if (node.primitive === 'Void' && node.size !== undefined) error(node, 'SW020', 'Void cannot be an array.');
            }
            if (a.isDuration(node) && (!Number.isSafeInteger(nanos(node)) || node.value <= 0)) error(node, 'SW040', 'Duration must be positive and exactly representable in nanoseconds.');
            if (a.isQos(node) && (!Number.isSafeInteger(node.capacity) || node.capacity <= 0)) error(node, 'SW041', 'Queue capacity must be a positive safe integer.');
            if (a.isTiming(node) && nanos(node.wcet) > nanos(node.deadline)) error(node, 'SW042', 'WCET must not exceed deadline.');
            if (a.isConnect(node)) this.checkConnect(node, error);
            if (a.isDelegate(node)) {
                const c = owner(node, a.isComponent);
                const target = c && resolvePath(c, node.target);
                const outer = node.outer.ref;
                if (node.target.split('.').length !== 2 || !target || !a.isPort(target)) error(node, 'SW030', 'Delegate to one immediate child port: child.port.');
                else if (outer && (outer.interface.ref !== target.interface.ref || outer.role !== target.role)) error(node, 'SW032', 'Delegation preserves interface identity and port role.');
            }
            if (a.isComponent(node) || a.isRootComponent(node)) {
                const links = node.members.filter(a.isConnect);
                for (const link of links) if (links.some(other => other !== link && other.source === link.source && other.target === link.target)) error(link, 'SW035', 'Duplicate connector endpoints are not allowed.');
                if (a.isComponent(node)) {
                    const delegates = node.members.filter(a.isDelegate);
                    for (const d of delegates) if (delegates.some(other => other !== d && other.target === d.target)) error(d, 'SW033', 'A child port cannot have multiple boundary aliases.');
                }
            }
            if (a.isComponent(node)) for (const port of node.members.filter(a.isPort)) {
                if (node.members.filter(a.isDelegate).filter(d => d.outer.ref === port).length !== 1) error(port, 'SW033', 'Each component boundary port must delegate to exactly one child port.');
            }
            if (a.isUnit(node)) this.checkUnit(node, error);
            if (a.isRootComponent(node)) this.checkRoot(node, error);
            if (a.isStateBody(node)) this.checkStateBody(node, error);
            if (a.isScenario(node)) this.checkScenario(node, error);
            if (a.isView(node)) {
                const pkg = owner(node, a.isPackage);
                const [root, ...rest] = node.subject.split('.');
                if (root === pkg?.name && pkg.elements.some(e => e.name === root)) error(node, 'SW080', 'View subject is ambiguous between its package and a declaration.');
                let subject: AstNode | undefined = root === pkg?.name ? pkg : pkg?.elements.find(e => e.name === root);
                if (subject && rest.length && (a.isUnit(subject) || a.isComponent(subject) || a.isRootComponent(subject))) subject = resolvePath(subject, rest.join('.'));
                else if (rest.length) subject = undefined;
                if (!subject) error(node, 'SW080', 'View subject must resolve in its package.');
                if (subject && a.isInstance(subject)) subject = subject.definition.ref;
                if (subject && a.isView(subject)) error(node, 'SW080', 'A view cannot use another view as its semantic subject.');
                if (subject && node.kind === 'IV' && !a.isComponent(subject) && !a.isRootComponent(subject)) error(node, 'SW080', 'IV subject must be a component or root.');
                if (subject && node.kind === 'FV' && !a.isOperation(subject)) error(node, 'SW080', 'FV subject must be an operation.');
                if (subject && ['SV', 'CV'].includes(node.kind) && !a.isScenario(subject) && !a.isRootComponent(subject)) error(node, 'SW080', 'SV/CV subject must be a case or root.');
            }
        }
        for (const d of nodes.filter(a.isDataType)) {
            const visit = (t: a.DataType, seen: Set<a.DataType>): boolean => {
                if (seen.has(t)) return true;
                return t.fields.some(f => f.type.type?.ref && a.isDataType(f.type.type.ref) && visit(f.type.type.ref, new Set(seen).add(t)));
            };
            if (visit(d, new Set())) error(d, 'SW021', 'Recursive value datatypes are not supported.');
        }
    }
    private checkConnect(n: a.Connect, error: Reporter): void {
        const c = container(n);
        if (!c) return;
        const source = resolvePath(c, n.source), target = resolvePath(c, n.target);
        if (n.source.split('.').length !== 2 || n.target.split('.').length !== 2 || !source || !target || !a.isPort(source) || !a.isPort(target)) {
            error(n, 'SW030', 'Connect immediate child ports only: child.port -> child.port.'); return;
        }
        if (source.interface.ref !== target.interface.ref) error(n, 'SW031', 'Connected ports must reference the same nominal interface and version.');
        const pairs: Record<string, string> = { sender: 'receiver', client: 'server', publisher: 'subscriber', requires: 'provides' };
        if (pairs[source.role] !== target.role) error(n, 'SW032', 'Incompatible connector direction or port roles.');
        if (!n.qos) error(n, 'SW041', 'Every connector must declare explicit QoS.');
        if (n.qos && source.interface.ref?.members.some(m => a.isDataMember(m) && m.mode === 'sampled') && (n.qos.capacity !== 1 || n.qos.overflow !== 'dropOldest')) error(n, 'SW041', 'Sampled interfaces use capacity 1 and dropOldest.');
        if (n.qos?.delivery === 'atLeastOnce' && source.interface.ref?.members.some(m => a.isSignature(m) && !m.idempotent)) error(n, 'SW043', 'At-least-once RPC requires idempotent operations.');
    }
    private checkUnit(unit: a.Unit, error: Reporter): void {
        const vars = unit.members.filter(a.isVariable);
        const base: Env = new Map(vars.map(v => [v.name, typeKey(v.type)]));
        for (const v of vars) this.expect(v.value, typeKey(v.type), new Map(), error);
        for (const fn of unit.members.filter(a.isFunctionDef)) {
            if (typeKey(fn.result) === 'Void') error(fn, 'SW020', 'Pure functions must return a value.');
            for (const p of fn.parameters) if (base.has(p.name)) error(p, 'SW002', 'A parameter cannot shadow unit data.');
            const env = new Map(fn.parameters.map(p => [p.name, typeKey(p.type)]));
            this.expect(fn.value, typeKey(fn.result), env, error);
        }
        const operations = unit.members.filter(a.isOperation);
        for (const op of operations) {
            const env: Env = new Map(base);
            for (const p of op.parameters) {
                if (env.has(p.name)) error(p, 'SW002', 'A parameter cannot shadow unit data.');
                env.set(p.name, typeKey(p.type));
            }
            if (op.trigger?.endpoint) {
                const ep = endpoint(op, op.trigger.endpoint);
                if (!ep) error(op.trigger, 'SW050', 'Trigger must identify a member of this unit’s port.');
                else {
                    const isCall = op.trigger.kind === 'call';
                    const valid = isCall ? a.isSignature(ep.member) && ['server', 'provides'].includes(ep.port.role) : !a.isSignature(ep.member) && ['receiver', 'subscriber', 'requires'].includes(ep.port.role);
                    if (!valid) error(op.trigger, 'SW051', 'Trigger member or port direction is incompatible.');
                    const types = a.isDataMember(ep.member) ? [typeKey(ep.member.type)] : ep.member.parameters.map(p => typeKey(p.type));
                    if (types.join('|') !== op.parameters.map(p => typeKey(p.type)).join('|')) error(op, 'SW052', 'Handler parameters must match the interface member in order and type.');
                    const result = a.isSignature(ep.member) ? typeKey(ep.member.result) : 'Void';
                    if (typeKey(op.result) !== result) error(op, 'SW052', 'Handler result must match the interface member.');
                }
            } else if (op.trigger && op.parameters.length) error(op, 'SW052', 'Start, manual and periodic operations have no parameters.');
            if (op.trigger && op.trigger.kind !== 'call' && typeKey(op.result) !== 'Void') error(op, 'SW052', 'Non-call activations return Void.');
            if (op.trigger?.period && op.timing && nanos(op.timing.deadline) > nanos(op.trigger.period)) error(op, 'SW042', 'Periodic deadline must not exceed period.');
            if (op.body) this.block(op.body, env, typeKey(op.result), error);
            if (op.body && typeKey(op.result) !== 'Void' && !this.terminates(op.body)) error(op, 'SW053', 'Every path of a value-returning operation must return or fail.');
            if (op.stateBody) {
                if (typeKey(op.result) !== 'Void' || op.parameters.length || op.trigger?.kind !== 'start') error(op, 'SW060', 'Stateful operations must have no parameters, return Void and start on start.');
                for (const state of op.stateBody.states) {
                    if (state.entry) this.block(state.entry, new Map(env), 'Void', error);
                    if (state.exit) this.block(state.exit, new Map(env), 'Void', error);
                }
                for (const t of op.stateBody.transitions) {
                    const local = new Map(env);
                    if (t.endpoint) {
                        const ep = endpoint(t, t.endpoint);
                        if (!ep || a.isSignature(ep.member) || !['receiver', 'subscriber', 'requires'].includes(ep.port.role)) error(t, 'SW051', 'State transition receives data/events through an input port.');
                        else if (a.isDataMember(ep.member)) {
                            if (local.has('payload')) error(t, 'SW002', 'Transition payload cannot shadow unit data.');
                            local.set('payload', typeKey(ep.member.type));
                        }
                        else for (const p of ep.member.parameters) {
                            if (local.has(p.name)) error(t, 'SW002', 'Transition payload parameters cannot shadow unit data.');
                            local.set(p.name, typeKey(p.type));
                        }
                    }
                    if (t.guard) this.expect(t.guard, 'Bool', local, error);
                    this.block(t.effect, local, 'Void', error);
                }
            }
            const mutates = (current: a.Operation, seen = new Set<a.Operation>()): boolean => {
                if (seen.has(current)) return false;
                seen.add(current);
                return [...AstUtils.streamAllContents(current)].some(n =>
                    (a.isAssign(n) && base.has(n.target)) || (a.isInvoke(n) && !!n.operation.ref && mutates(n.operation.ref, seen)));
            };
            if (op.timing?.concurrency === 'reentrant' && mutates(op)) error(op, 'SW054', 'Reentrant operations may not mutate unit data, including through local helpers.');
        }
        for (const port of unit.members.filter(a.isPort)) {
            if (['sender', 'publisher', 'provides'].includes(port.role)) {
                for (const member of port.interface.ref?.members ?? []) {
                    if (a.isSignature(member)) continue;
                    const path = `${port.name}.${member.name}`;
                    if (!operations.some(op => [...AstUtils.streamAllContents(op)].some(n => a.isSend(n) && n.endpoint === path))) error(port, 'SW050', `Outgoing member '${path}' must be tied to an emitting operation.`);
                }
            }
            if (!['server', 'provides', 'receiver', 'subscriber', 'requires'].includes(port.role)) continue;
            for (const member of port.interface.ref?.members ?? []) {
                if (port.role === 'requires' && a.isSignature(member)) continue;
                if (port.role === 'provides' && a.isEventMember(member)) continue;
                const path = `${port.name}.${member.name}`;
                const handlers = operations.filter(op => op.trigger?.endpoint === path).length;
                const machines = operations.filter(op => op.stateBody?.transitions.some(t => t.endpoint === path)).length;
                if (handlers + machines !== 1) error(port, 'SW055', `Member '${path}' requires exactly one receiving operation (or one stateful operation).`);
            }
        }
        const visiting = new Set<AstNode>(), visited = new Set<AstNode>();
        const walk = (node: a.Operation | a.FunctionDef): void => {
            if (visiting.has(node)) { error(node, 'SW056', 'Recursive local call cycles are not supported in 1.1.'); return; }
            if (visited.has(node)) return;
            visiting.add(node);
            for (const n of AstUtils.streamAllContents(node)) {
                if (a.isInvoke(n) && n.operation.ref) walk(n.operation.ref);
                if (a.isFunctionCall(n) && n.function.ref) walk(n.function.ref);
            }
            visiting.delete(node); visited.add(node);
        };
        for (const node of unit.members) if (a.isOperation(node) || a.isFunctionDef(node)) walk(node);
    }
    private block(block: a.Block, inherited: Env, result: string, error: Reporter): void {
        const env = new Map(inherited);
        for (const s of block.statements) {
            if (a.isLet(s)) {
                if (env.has(s.name)) error(s, 'SW002', 'Local variables may not shadow an existing value.');
                this.expect(s.value, typeKey(s.type), env, error); env.set(s.name, typeKey(s.type));
            } else if (a.isAssign(s)) {
                const t = env.get(s.target);
                if (!t) error(s, 'SW022', 'Assignment target is not local data.');
                else this.expect(s.value, t, env, error);
            } else if (a.isReturn(s)) {
                if (s.value && result === 'Void') error(s, 'SW023', 'Void operations must use a bare return.');
                else if (s.value) this.expect(s.value, result, env, error);
                else if (result !== 'Void') error(s, 'SW023', 'Return value is required.');
            } else if (a.isSend(s) || a.isRequest(s)) {
                const ep = endpoint(s, s.endpoint);
                if (!ep) error(s, 'SW050', 'Communication must use a member of a port owned by this unit.');
                else {
                    const valid = a.isRequest(s) ? a.isSignature(ep.member) && ['client', 'requires'].includes(ep.port.role) : s.kind === 'send' ? a.isDataMember(ep.member) && ep.port.role === 'sender' : a.isEventMember(ep.member) && ['publisher', 'provides'].includes(ep.port.role);
                    if (!valid) error(s, 'SW051', 'Communication verb, member and port role do not agree.');
                    const types = a.isDataMember(ep.member) ? [typeKey(ep.member.type)] : ep.member.parameters.map(p => typeKey(p.type));
                    this.args(s, s.args, types, env, error);
                }
                if (a.isRequest(s)) {
                    if (env.has('failure')) error(s, 'SW002', 'The implicit request failure binding cannot shadow an existing value.');
                    this.block(s.failure, new Map(env).set('failure', 'String'), result, error);
                    if (!this.terminates(s.failure)) error(s.failure, 'SW057', 'Request failure path must return or fail.');
                    if (env.has(s.name)) error(s, 'SW002', 'Request result may not shadow local data.');
                    env.set(s.name, ep && a.isSignature(ep.member) ? typeKey(ep.member.result) : '?');
                }
            } else if (a.isInvoke(s)) {
                if (s.operation.ref) {
                    this.args(s, s.args, s.operation.ref.parameters.map(p => typeKey(p.type)), env, error);
                    if (s.operation.ref.trigger || s.operation.ref.stateBody || typeKey(s.operation.ref.result) !== 'Void') error(s, 'SW058', 'invoke targets an untriggered local Void operation; call a pure function for results.');
                }
            } else if (a.isIf(s)) {
                this.expect(s.condition, 'Bool', env, error); this.block(s.then, env, result, error);
                if (s.otherwise) this.block(s.otherwise, env, result, error);
            } else if (a.isWhile(s)) {
                if (!Number.isSafeInteger(s.bound) || s.bound <= 0) error(s, 'SW059', 'Loop bound must be positive.');
                this.expect(s.condition, 'Bool', env, error); this.block(s.body, env, result, error);
            } else if (a.isAssert(s)) this.expect(s.condition, 'Bool', env, error);
        }
    }
    private terminates(b: a.Block): boolean {
        return b.statements.some(s => a.isReturn(s) || a.isFail(s) || (a.isIf(s) && !!s.otherwise && this.terminates(s.then) && this.terminates(s.otherwise)));
    }
    private args(n: AstNode, args: a.Expression[], types: string[], env: Env, error: Reporter): void {
        if (args.length !== types.length) error(n, 'SW024', 'Argument count does not match the contract.');
        args.forEach((arg, i) => this.expect(arg, types[i] ?? '?', env, error));
    }
    private expect(e: a.Expression, expected: string, env: Env, error: Reporter): void {
        const actual = this.expression(e, env, error);
        if (actual !== '?' && expected !== '?' && actual !== expected && !(actual === 'Int' && expected === 'Real')) error(e, 'SW023', `Expected ${expected}, found ${actual}.`);
    }
    private expression(e: a.Expression, env: Env, error: Reporter): string {
        if (a.isLiteral(e)) return e.boolean !== undefined ? 'Bool' : e.text !== undefined ? 'String' : e.$cstNode?.text.includes('.') ? 'Real' : 'Int';
        if (a.isReferenceExpression(e)) {
            const parts = e.path.split('.');
            let t = env.get(parts[0]);
            const models = [...this.services.shared.workspace.LangiumDocuments.all].map(d => d.parseResult.value).filter(a.isModel);
            const enumLiteral = resolveEnumLiteral(e, models, env);
            if (enumLiteral) {
                if (!enumLiteral.type.literals.includes(enumLiteral.literal)) error(e, 'SW027', 'Unknown enum literal.');
                if (e.index) error(e, 'SW023', 'Only arrays can be indexed.');
                return `${owner(enumLiteral.type, a.isPackage)?.name}::${enumLiteral.type.name}`;
            }
            if (!t) { error(e, 'SW022', `Unknown local value or enum type '${parts[0]}'. Cross-unit data access is forbidden.`); return '?'; }
            if (t === 'Void') { error(e, 'SW022', 'A Void request result names completion only and cannot be read as a value.'); return '?'; }
            for (const field of parts.slice(1)) {
                const all = [...this.services.shared.workspace.LangiumDocuments.all].flatMap(d => a.isModel(d.parseResult.value) ? d.parseResult.value.packages.flatMap(p => p.elements) : []);
                const dtype = all.find(d => a.isDataType(d) && typeKey({ type: { ref: d } } as a.TypeRef) === t);
                const f = dtype && a.isDataType(dtype) ? dtype.fields.find(p => p.name === field) : undefined;
                if (!f) { error(e, 'SW022', `Unknown record field '${field}'.`); return '?'; }
                t = typeKey(f.type);
            }
            if (e.index) {
                this.expect(e.index, 'Int', env, error);
                const match = /^(.*)\[(\d+)\]$/.exec(t);
                if (!match) { error(e, 'SW023', 'Only arrays can be indexed.'); return '?'; }
                const constant = this.constantNumber(e.index);
                if (constant !== undefined && (constant < 0 || constant >= Number(match[2]))) error(e, 'SW025', 'Array index is out of bounds.');
                return match[1];
            }
            return t;
        }
        if (a.isRecordLiteral(e)) {
            const d = e.type.ref;
            if (!d) return '?';
            for (const field of d.fields) {
                const value = e.fields.find(v => v.name === field.name);
                if (!value) error(e, 'SW026', `Missing record field '${field.name}'.`);
                else this.expect(value.value, typeKey(field.type), env, error);
            }
            for (const value of e.fields) if (!d.fields.some(f => f.name === value.name)) error(value, 'SW026', 'Unknown record field.');
            return `${owner(d, a.isPackage)?.name}::${d.name}`;
        }
        if (a.isArrayLiteral(e)) {
            if (!e.values.length) { error(e, 'SW028', 'Fixed-size arrays cannot be empty.'); return '?'; }
            const types = e.values.map(v => this.expression(v, env, error));
            const t = types.every(t => ['Int', 'Real'].includes(t)) && types.includes('Real') ? 'Real' : types[0];
            for (const value of e.values) this.expect(value, t, env, error);
            return `${t}[${types.length}]`;
        }
        if (a.isFunctionCall(e)) {
            if (e.function.ref) {
                this.args(e, e.args, e.function.ref.parameters.map(p => typeKey(p.type)), env, error);
                return typeKey(e.function.ref.result);
            }
            return '?';
        }
        if (a.isUnaryExpression(e)) {
            const t = e.operand ? this.expression(e.operand, env, error) : '?';
            if (e.operator === 'not' ? t !== 'Bool' : !['Int', 'Real', '?'].includes(t)) error(e, 'SW023', 'Invalid unary operand.');
            return e.operator === 'not' ? 'Bool' : t;
        }
        if (a.isBinaryExpression(e)) {
            const l = this.expression(e.left, env, error), r = this.expression(e.right, env, error);
            const numeric = ['Int', 'Real'].includes(l) && ['Int', 'Real'].includes(r);
            if (['and', 'or'].includes(e.operator)) {
                if (l !== 'Bool' || r !== 'Bool') error(e, 'SW023', 'Boolean operands required.');
                return 'Bool';
            }
            if (['==', '!='].includes(e.operator)) {
                if (l !== r && !numeric) error(e, 'SW023', 'Equality operands must have compatible types.');
                return 'Bool';
            }
            if (!numeric) error(e, 'SW023', 'Numeric operands required.');
            if (e.operator === '%' && (l !== 'Int' || r !== 'Int')) error(e, 'SW023', 'Remainder requires Int operands.');
            if (['<', '<=', '>', '>='].includes(e.operator)) return 'Bool';
            return l === 'Real' || r === 'Real' || e.operator === '/' ? 'Real' : 'Int';
        }
        return '?';
    }
    private constantNumber(e: a.Expression): number | undefined {
        if (a.isLiteral(e)) return e.number;
        if (a.isUnaryExpression(e) && e.operator === '-') {
            const operand = this.constantNumber(e.operand);
            return operand === undefined ? undefined : -operand;
        }
        return undefined;
    }
    private checkStateBody(m: a.StateBody, error: Reporter): void {
        for (const t of m.transitions) {
            if (t.priority !== undefined && !Number.isSafeInteger(t.priority)) error(t, 'SW062', 'Transition priority must be a nonnegative safe integer.');
            if (t.from.ref?.final) error(t, 'SW061', 'Final states have no outgoing transitions.');
            const peers = m.transitions.filter(x => x !== t && x.from.ref === t.from.ref && x.kind === t.kind && x.endpoint === t.endpoint && (x.delay ? nanos(x.delay) : 0) === (t.delay ? nanos(t.delay) : 0));
            if (peers.some(x => (x.priority ?? 0) === (t.priority ?? 0))) error(t, 'SW062', 'Competing transitions require distinct priorities.');
        }
        const reached = new Set<a.State>();
        if (m.initial.ref) reached.add(m.initial.ref);
        let changed = true;
        while (changed) {
            changed = false;
            for (const t of m.transitions) if (t.from.ref && reached.has(t.from.ref) && t.to.ref && !reached.has(t.to.ref)) { reached.add(t.to.ref); changed = true; }
        }
        for (const s of m.states) if (!reached.has(s)) error(s, 'SW063', 'State is unreachable from initial state.');
        const cycle = (s: a.State, path: Set<a.State>): boolean => {
            if (path.has(s)) return true;
            return m.transitions.filter(t => t.from.ref === s && t.kind === 'completion' && !t.guard).some(t => t.to.ref && cycle(t.to.ref, new Set(path).add(s)));
        };
        if (m.states.some(s => cycle(s, new Set()))) error(m, 'SW064', 'Unconditional completion cycles cause zero-time livelock.');
    }
    private checkRoot(root: a.RootComponent, report: Reporter): void {
        // This acceptor belongs to the selecting root's document. A definition in
        // another document must not lend its range to a diagnostic with this URI.
        const error: Reporter = (node, code, message) => {
            if (AstUtils.getDocument(node) === AstUtils.getDocument(root)) report(node, code, message);
            else {
                const path: string[] = [];
                let current: AstNode | undefined = node;
                while (current && !a.isPackage(current)) {
                    if ('name' in current && typeof current.name === 'string') path.unshift(current.name);
                    current = current.$container;
                }
                const identity = `${current && a.isPackage(current) ? current.name : '?'}::${path.join('.')}`;
                report(root, code, `${message} Affected imported element: '${identity}'.`);
            }
        };
        const ports = new Map<string, a.Port>(), aliases = new Map<string, string>();
        const connections: { n: a.Connect; s: string; t: string }[] = [];
        const instances = new Set<string>();
        const expand = (c: Container, prefix: string, seen: Set<a.Definition>) => {
            for (const m of members(c)) {
                if (a.isPort(m)) ports.set(prefix + m.name, m);
                if (a.isConnect(m)) connections.push({ n: m, s: prefix + m.source, t: prefix + m.target });
                if (a.isDelegate(m)) aliases.set(prefix + m.outer.$refText, prefix + m.target);
                if (a.isInstance(m) && m.definition.ref && !seen.has(m.definition.ref)) {
                    instances.add(prefix + m.name);
                    expand(m.definition.ref, prefix + m.name + '.', new Set(seen).add(m.definition.ref));
                }
            }
        };
        expand(root, '', new Set());
        const resolve = (p: string): string => {
            const seen = new Set<string>();
            while (aliases.has(p) && !seen.has(p)) { seen.add(p); p = aliases.get(p)!; }
            return p;
        };
        const uses = new Map<string, number>();
        const routes = new Set<string>();
        for (const { n, s, t } of connections) {
            const route = `${resolve(s)}->${resolve(t)}`;
            if (routes.has(route)) error(n, 'SW035', 'Duplicate connector route after delegation expansion.');
            routes.add(route);
            for (const endpoint of [s, t]) {
                // Connector use flows inward through delegation, never outward from a leaf.
                const seen = new Set<string>();
                for (let p: string | undefined = endpoint; p !== undefined && !seen.has(p); p = aliases.get(p)) {
                    seen.add(p);
                    uses.set(p, (uses.get(p) ?? 0) + 1);
                }
            }
            if (root.profile === 'realtime' || root.profile === 'mixed') {
                if (!n.qos?.maxLatency) error(n, 'SW044', 'Realtime/mixed roots require connector maxLatency.');
                const port = ports.get(resolve(s));
                if (port?.interface.ref?.members.some(m => a.isDataMember(m) && m.mode === 'sampled') && !n.qos?.maxAge) error(n, 'SW044', 'Sampled realtime data requires maxAge.');
            }
        }
        for (const [path, port] of ports) {
            const count = uses.get(path) ?? 0;
            if (!port.optional && count === 0) error(root, 'SW034', `Required port '${path}' is unconnected.`);
            if (!aliases.has(path) && ['receiver', 'client', 'requires'].includes(port.role) && count > 1) error(root, 'SW035', `Port '${path}' requires a single source/provider.`);
        }
        const deployed = new Set<string>();
        for (const d of root.members.filter(a.isDeployment)) {
            if (!instances.has(d.target)) error(d, 'SW070', 'Deployment must name an instance path.');
            if (deployed.has(d.target)) error(d, 'SW070', 'An instance cannot be deployed twice.');
            deployed.add(d.target);
        }
        if ((root.profile ?? 'service') !== 'service') {
            const units = new Set([...ports.values()].map(p => owner(p, a.isUnit)).filter(Boolean));
            // Include port-free units too.
            const walk = (c: Container, seen: Set<a.Definition>) => {
                for (const i of members(c).filter(a.isInstance)) if (i.definition.ref && !seen.has(i.definition.ref)) {
                    if (a.isUnit(i.definition.ref)) units.add(i.definition.ref);
                    else walk(i.definition.ref, new Set(seen).add(i.definition.ref));
                }
            };
            walk(root, new Set());
            for (const unit of units) for (const op of unit!.members.filter(a.isOperation)) if (!op.timing) error(op, 'SW045', 'Operations used in realtime/mixed roots require timing contracts.');
        }
    }
    private checkScenario(n: a.Scenario, error: Reporter): void {
        const root = n.root.ref;
        if (!root) return;
        const labels = new Map<string, a.ScenarioStep>();
        const replies = new Map<a.ScenarioStep, a.ScenarioStep>();
        for (const step of n.steps) {
            if (step.predecessor && !labels.has(step.predecessor)) error(step, 'SW081', 'after must reference an earlier step label.');
            const ancestors = new Set<a.ScenarioStep>();
            let predecessor = step.predecessor && labels.get(step.predecessor);
            while (predecessor && !ancestors.has(predecessor)) {
                ancestors.add(predecessor);
                predecessor = predecessor.predecessor && labels.get(predecessor.predecessor);
            }
            labels.set(step.name, step);
            const link = members(root).filter(a.isConnect).find(c => c.name === step.connector);
            const sourcePortPath = step.source.split('.').slice(0, -1).join('.');
            const targetPortPath = step.target.split('.').slice(0, -1).join('.');
            const source = resolvePath(root, step.source), target = resolvePath(root, step.target);
            if (!link || !source || !target) { error(step, 'SW082', 'Scenario members and connector must resolve.'); continue; }
            const sourcePort = resolvePath(root, sourcePortPath);
            const reverse = step.kind === 'reply' || (step.kind === 'publish' && sourcePort && a.isPort(sourcePort) && sourcePort.role === 'provides');
            if ((reverse ? link.target !== sourcePortPath || link.source !== targetPortPath : link.source !== sourcePortPath || link.target !== targetPortPath)) error(step, 'SW082', 'Scenario exchange must follow its connector (responses reverse it).');
            if (source !== target) error(step, 'SW082', 'Scenario endpoints must identify the same interface member.');
            if (step.kind === 'send' ? !a.isDataMember(source) : step.kind === 'publish' ? !a.isEventMember(source) : !a.isSignature(source)) error(step, 'SW082', 'Scenario verb must match member kind.');
            if (step.kind === 'reply') {
                // A reply in a different causal branch must not close a request merely
                // because it is printed earlier. Source order is not happens-before.
                const requests = [...ancestors].filter(prior => prior.kind === 'request' && prior.connector === step.connector && prior.source === step.target && prior.target === step.source && !(replies.has(prior) && ancestors.has(replies.get(prior)!)));
                if (requests.length !== 1) error(step, 'SW083', 'Reply requires exactly one causally preceding, unanswered request on the same route/member.');
                else if (replies.has(requests[0])) error(step, 'SW083', 'A request cannot have multiple replies, including on independent causal branches.');
                else replies.set(requests[0], step);
            }
        }
    }
}
type Reporter = (node: AstNode, code: string, message: string) => void;
