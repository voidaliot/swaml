import { AstUtils, type AstNode, type ValidationAcceptor, type LangiumCoreServices } from 'langium';
import * as a from './generated/ast.js';
import { owner } from './swaml-scope.js';
import { container, effectiveQos, endpoint, members, named, nanos, resolvePath, resolveEnumLiteral, typeKey, type Container, specializes, effectiveFunction, isIntegralType, isNumericType, numericAssignable, integralInRange } from './semantic.js';

import { resolvePresentationPath, selectView, validViewFilter } from './presentation.js';

type Env = Map<string, string>;
export class SwamlValidator {
    private context?: Container;
    constructor(private services: LangiumCoreServices) {}
    checkModel(model: a.Model, accept: ValidationAcceptor): void {
        const parseResult = AstUtils.getDocument(model).parseResult;
        if (parseResult.lexerErrors.length || parseResult.parserErrors.length) return;
        const error = (node: AstNode, code: string, message: string) => accept('error', message, { node, code });
        const nodes = [model, ...AstUtils.streamAllContents(model)];
        const packages = [...this.services.shared.workspace.LangiumDocuments.all].flatMap(d => a.isModel(d.parseResult.value) ? d.parseResult.value.packages : []);
        for (const pkg of model.packages) if (packages.filter(p => p.name === pkg.name).length > 1) error(pkg, 'SW002', 'Package names must be unique across the workspace.');

        for (const node of nodes) {
            if ('name' in node && node.name === 'doc') error(node, 'SW003', 'doc is reserved for formal documentation.');
            if (a.isEnumType(node) && node.literals.includes('doc')) error(node, 'SW003', 'doc is reserved for formal documentation.');
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
                if (!roles[node.interface.ref.kind].includes(node.role)) error(node, 'SW011', `Interface '${node.interface.ref.name}' has kind ${node.interface.ref.kind}; use port role ${roles[node.interface.ref.kind].join(' or ')}.`);
            }
            if (a.isRootComponent(node) && node.definition?.ref) {
                for (const member of node.members) {
                    if (!a.isDeployment(member)) error(member, 'SW012', 'A typed root may bind deployment only; change topology in its component definition.');
                    if ('name' in member && node.definition.ref.members.some(m => 'name' in m && m.name === member.name)) error(member, 'SW002', `Root binding name '${member.name}' duplicates a member of its definition.`);
                }
            }
            if ((a.isInstance(node) || a.isRootComponent(node)) && node.definition?.ref && node.kind === 'component' && node.definition.ref.kind !== 'component') error(node, 'SW016', 'A component usage requires a component definition; a class usage may instantiate a class or component definition.');
            if (a.isInstance(node) && node.definition.ref) {
                const visit = (d: a.Component, seen: Set<a.Component>): boolean => {
                    if (seen.has(d)) return true;
                    const next = new Set(seen).add(d);
                    return members(d).filter(a.isInstance).some(i => i.definition.ref && visit(i.definition.ref, next));
                };
                if (visit(node.definition.ref, new Set())) error(node, 'SW013', 'Recursive component containment is not allowed.');
            }
            if (a.isTypeRef(node)) {
                if (node.size !== undefined && (!Number.isSafeInteger(node.size) || node.size <= 0)) error(node, 'SW020', 'Array size must be positive.');
                if (node.primitive === 'void' && !(a.isFunctionDef(node.$container!) || a.isSignature(node.$container!) || a.isCalculation(node.$container!))) error(node, 'SW020', 'void is allowed only as a result type.');
                if (node.primitive === 'void' && node.size !== undefined) error(node, 'SW020', 'void cannot be an array.');
            }
            if (a.isDuration(node) && (!Number.isSafeInteger(nanos(node)) || node.value <= 0)) error(node, 'SW040', 'Duration must be positive and exactly representable in nanoseconds.');
            if (a.isQosBody(node) && (!Number.isSafeInteger(node.capacity) || node.capacity <= 0)) error(node, 'SW041', 'Queue capacity must be a positive safe integer.');
            if (a.isTiming(node) && nanos(node.wcet) > nanos(node.deadline)) error(node, 'SW042', 'WCET must not exceed deadline.');
            if (a.isDelegate(node)) {
                const c = container(node);
                const target = c && resolvePath(c, node.target);
                const outer = node.outer.ref;
                if (node.target.split('.').length !== 2 || !target || !a.isPort(target)) error(node, 'SW030', 'Delegate to one immediate child port: child.port.');
                else if (outer && (outer.interface.ref !== target.interface.ref || outer.role !== target.role)) error(node, 'SW032', 'Delegation preserves interface identity and port role.');
            }
            if (a.isComponent(node) || a.isRootComponent(node)) {
                const links = members(node).filter(a.isConnect);
                for (const link of links) if (links.some(other => other !== link && other.source === link.source && other.target === link.target)) error(link, 'SW035', 'Duplicate connector endpoints are not allowed.');
                const delegates = members(node).filter(a.isDelegate);
                for (const d of delegates) if (delegates.some(other => other !== d && other.target === d.target)) error(d, 'SW033', 'A child port cannot have multiple boundary aliases.');
            }
            if (a.isComponent(node)) this.checkInheritance(node, error);
            if (a.isComponent(node) || (a.isRootComponent(node) && !node.definition)) this.checkComponent(node, error);
            if (a.isRootComponent(node)) this.checkRoot(node, error);
            if (a.isStateBody(node)) this.checkStateBody(node, error);
            if (a.isScenario(node)) this.checkScenario(node, error);
            if (a.isAttribute(node)) this.expect(node.value, typeKey(node.type), new Map(), error);
            if (a.isSatisfaction(node)) {
                const pkg = owner(node, a.isPackage);
                const target = pkg && resolvePresentationPath(pkg, node.source);
                if (!target || a.isRequirement(target.node) || a.isScenario(target.node) || a.isPackage(target.node)) error(node, 'SW090', 'Satisfaction source must resolve to a design element in its package.');
                if (target && pkg?.satisfactions.some(other => other !== node && resolvePresentationPath(pkg, other.source)?.path === target.path && other.requirement.ref === node.requirement.ref)) error(node, 'SW090', 'Duplicate satisfaction relation.');
            }
            if (a.isVerification(node)) {
                const scenario = owner(node, a.isScenario);
                if (scenario?.kind !== 'verificationCase') error(node, 'SW091', 'Only a verificationCase can own verify relations.');
                if (scenario?.verifications.some(other => other !== node && other.requirement.ref === node.requirement.ref)) error(node, 'SW091', 'Duplicate verification relation.');
            }
            if (a.isView(node)) {
                const pkg = owner(node, a.isPackage)!;
                for (const selection of node.subject ? [{subject:node.subject, filter:undefined}] : node.selections) {
                    if (!resolvePresentationPath(pkg,selection.subject)) error(node, 'SW080', 'View selection must resolve unambiguously in its package; views cannot select views.');
                    if (selection.filter) {
                        if (!validViewFilter(selection.filter)) error(selection.filter, 'SW080', 'Filters use name, kind or path, string/Boolean literals, ==, !=, and, or, not and parentheses.');
                        else this.expect(selection.filter, 'bool', new Map([['name','string'],['kind','string'],['path','string']]), error);
                    }
                }
                for (const selection of selectView(node)) {
                    const subject = selection.node;
                    if (node.kind === 'iv' && !a.isComponent(subject) && !a.isRootComponent(subject) && !a.isInstance(subject)) error(node, 'SW080', 'iv selects classes or components.');
                    if ((node.kind === 'fv' || node.kind === 'tv') && !a.isFunctionDef(subject)) error(node, 'SW080', `${node.kind} selects executable operations or functions.`);
                    if (['sv','cv'].includes(node.kind) && !a.isScenario(subject) && !a.isRootComponent(subject)) error(node, 'SW080', 'sv/cv select cases or roots.');
                }
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
    private checkInheritance(component: a.Component, error: Reporter): void {
        if (component.kind === 'class' && component.specializes?.ref?.kind === 'component') error(component, 'SW016', 'A class may specialize only a class; a component may specialize a class or component.');
        const seen = new Set<a.Component>([component]);
        let ancestor = component.specializes?.ref;
        while (ancestor) {
            if (seen.has(ancestor)) { error(component, 'SW015', 'Component specialization must be acyclic.'); break; }
            seen.add(ancestor); ancestor = ancestor.specializes?.ref;
        }
        const inherited = component.specializes?.ref ? members(component.specializes.ref) : [];
        const signature = (fn: a.FunctionDef) => `${fn.parameters.map(p => `${p.name}:${typeKey(p.type)}`).join(',')}):${typeKey(fn.result)}`;
        const trigger = (fn: a.FunctionDef) => `${fn.trigger?.kind ?? ''}:${fn.trigger?.endpoint ?? ''}:${fn.trigger?.period ? nanos(fn.trigger.period) : ''}:${fn.trigger?.predecessor?.$refText ?? ''}`;
        for (const member of component.members) {
            const base = inherited.find(n => a.isDelegate(member) ? a.isDelegate(n) && n.outer.$refText === member.outer.$refText : 'name' in member && 'name' in n && member.name === n.name);
            if (!base) { if (member.redefines) error(member, 'SW014', 'redefines requires an inherited member with the same name.'); continue; }
            if (!member.redefines) { error(member, 'SW014', 'An inherited member can only be replaced with redefines.'); continue; }
            let compatible = member.$type === base.$type;
            if (a.isPort(member) && a.isPort(base)) compatible &&= member.interface.ref === base.interface.ref && member.role === base.role && member.optional === base.optional;
            if (a.isVariable(member) && a.isVariable(base)) compatible &&= typeKey(member.type) === typeKey(base.type);
            if (a.isInstance(member) && a.isInstance(base)) compatible &&= (base.kind === 'class' || member.kind === 'component') && !!member.definition.ref && !!base.definition.ref && specializes(member.definition.ref, base.definition.ref);
            if (a.isFunctionDef(member) && a.isFunctionDef(base)) {
                compatible &&= base.kind === 'operation' || member.kind === 'function';
                compatible &&= signature(member) === signature(base) && trigger(member) === trigger(base) && !!member.stateBody === !!base.stateBody;
                if (base.timing) compatible &&= !!member.timing && member.timing.concurrency === base.timing.concurrency && nanos(member.timing.wcet) <= nanos(base.timing.wcet) && nanos(member.timing.deadline) <= nanos(base.timing.deadline);
                else compatible &&= !member.timing || member.timing.concurrency === 'serial';
            }
            if (a.isConnect(member) && a.isConnect(base)) compatible &&= member.source === base.source && member.target === base.target;
            if (a.isDelegate(member) && a.isDelegate(base)) compatible &&= member.outer.$refText === base.outer.$refText && member.target === base.target;
            if (!compatible) error(member, 'SW014', 'Redefinition must preserve the inherited feature contract, signature and endpoint paths; child definitions may specialize the original type.');
        }
    }
    private checkConnect(n: a.Connect, error: Reporter, c = container(n)): void {
        if (!c) return;
        const source = resolvePath(c, n.source), target = resolvePath(c, n.target);
        if (![1, 2].includes(n.source.split('.').length) || ![1, 2].includes(n.target.split('.').length) || !source || !target || !a.isPort(source) || !a.isPort(target)) {
            error(n, 'SW030', 'Connect an owned port or immediate child port: port or child.port.'); return;
        }
        if (source.interface.ref !== target.interface.ref) error(n, 'SW031', 'Connected ports must reference the same nominal interface and version.');
        const pairs: Record<string, string> = { sender: 'receiver', client: 'server', publisher: 'subscriber', requires: 'provides' };
        if (pairs[source.role] !== target.role) error(n, 'SW032', 'Connect sender -> receiver, client -> server, publisher -> subscriber, or requires -> provides. Replies and service events use the reverse route.');
        if (!n.qos) error(n, 'SW041', 'Select a complete connector policy: qos PolicyName or qos { delivery ...; ordering ...; capacity ...; overflow ...; }.');
        const qos = effectiveQos(n.qos);
        if (qos && source.interface.ref?.members.some(m => a.isDataMember(m) && m.mode === 'sampled') && (qos.capacity !== 1 || qos.overflow !== 'dropOldest')) error(n, 'SW041', 'Sampled interfaces use capacity 1 and dropOldest.');
        if (qos?.delivery === 'atLeastOnce' && source.interface.ref?.members.some(m => a.isSignature(m) && !m.idempotent)) error(n, 'SW043', 'At-least-once RPC requires idempotent functions.');
    }
    private checkComponent(component: Container, error: Reporter): void {
        const previous = this.context; this.context = component;
        const report = error;
        error = (node, code, message) => report(AstUtils.getDocument(node) === AstUtils.getDocument(component) ? node : component, code, message);
        if (a.isRootComponent(component)) for (const member of component.members) if ('redefines' in member && member.redefines) error(member, 'SW014', 'An inline root has no inherited members to redefine.');
        for (const connection of members(component).filter(a.isConnect)) this.checkConnect(connection, error, component);
        for (const delegation of members(component).filter(a.isDelegate)) {
            const outer = named(component, delegation.outer.$refText), target = resolvePath(component, delegation.target);
            if (!outer || !a.isPort(outer) || !target || !a.isPort(target) || outer.interface.ref !== target.interface.ref || outer.role !== target.role) error(delegation, 'SW032', 'Effective delegation preserves interface identity and port role.');
        }
        const vars = members(component).filter(a.isVariable);
        const base: Env = new Map(vars.map(v => [v.name, typeKey(v.type)]));
        for (const v of vars) this.expect(v.value, typeKey(v.type), new Map(), error);
        const functions = members(component).filter(a.isFunctionDef);
        for (const op of functions) {
            if (op.trigger?.kind === 'completion') {
                if (op.parameters.length || typeKey(op.result) !== 'void' || op.stateBody) error(op.trigger, 'SW066', 'A completion-triggered executable must be a parameterless void flow operation or function.');
                const predecessor = op.trigger.predecessor?.ref;
                const effective = predecessor && effectiveFunction(predecessor, component);
                if (effective && (!functions.includes(effective) || !effective.trigger)) error(op.trigger, 'SW066', 'Completion depends on a triggered executable owned by this same class/component, not a local helper.');
            }
            const regions = [...AstUtils.streamAllContents(op)].filter(a.isInterruptible);
            for (const region of regions) {
                if (!op.trigger || op.stateBody || op.timing?.concurrency === 'reentrant') error(region, 'SW065', 'Interruptible regions require a triggered serial flow function.');
                if (regions.some(other => other !== region && other.name === region.name)) error(region, 'SW002', 'Interruptible region names must be unique within a function.');
                if (regions.some(other => other !== region && other.endpoint === region.endpoint) || op.trigger?.endpoint === region.endpoint) error(region, 'SW065', 'An interrupt member must have one region and cannot also activate its function.');
            }
            for (const fn of op.calculations) {
                if (typeKey(fn.result) === 'void') error(fn, 'SW020', 'Calculations must return a value.');
                if (fn.parameters.some(p => p.name === fn.outputName)) error(fn, 'SW002', 'A calculation output must have a distinct name from its inputs.');
                for (const p of fn.parameters) if (base.has(p.name)) error(p, 'SW002', 'A parameter cannot shadow component data.');
                const env = new Map(fn.parameters.map(p => [p.name, typeKey(p.type)]));
                this.expect(fn.value, typeKey(fn.result), env, error);
            }

            const env: Env = new Map(base);
            for (const p of op.parameters) {
                if (env.has(p.name)) error(p, 'SW002', 'A parameter cannot shadow component data.');
                env.set(p.name, typeKey(p.type));
            }
            if (op.trigger?.endpoint) {
                const ep = endpoint(op, op.trigger.endpoint, component);
                if (!ep) error(op.trigger, 'SW050', 'Trigger must identify a member of this component’s port.');
                else {
                    const isCall = op.trigger.kind === 'call';
                    const valid = isCall ? a.isSignature(ep.member) && ['server', 'provides'].includes(ep.port.role) : !a.isSignature(ep.member) && ['receiver', 'subscriber', 'requires'].includes(ep.port.role);
                    if (!valid) error(op.trigger, 'SW051', 'Trigger member or port direction is incompatible.');
                    const types = a.isDataMember(ep.member) ? [typeKey(ep.member.type)] : ep.member.parameters.map(p => typeKey(p.type));
                    if (types.join('|') !== op.parameters.map(p => typeKey(p.type)).join('|')) error(op, 'SW052', 'Handler parameters must match the interface member in order and type.');
                    const result = a.isSignature(ep.member) ? typeKey(ep.member.result) : 'void';
                    if (typeKey(op.result) !== result) error(op, 'SW052', 'Handler result must match the interface member.');
                    if (a.isSignature(ep.member) && ep.member.kind === 'function' && op.kind !== 'function') error(op, 'SW052', 'A function signature requires a function handler; an operation signature permits an operation or function handler.');
                }
            } else if (op.trigger && op.parameters.length) error(op, 'SW052', 'Start and periodic functions have no parameters.');
            if (op.trigger && op.trigger.kind !== 'call' && typeKey(op.result) !== 'void') error(op, 'SW052', 'Non-call activations return void.');
            if (op.trigger?.period && op.timing && nanos(op.timing.deadline) > nanos(op.trigger.period)) error(op, 'SW042', 'Periodic deadline must not exceed period.');
            if (op.body) this.block(op.body, env, typeKey(op.result), error);
            if (!op.stateBody && typeKey(op.result) !== 'void' && (!op.body || !this.terminates(op.body))) error(op, 'SW053', 'Every path of a value-returning function must return or fail.');
            if (op.stateBody) {
                if (typeKey(op.result) !== 'void' || op.parameters.length || op.trigger?.kind !== 'start') error(op, 'SW060', 'Stateful functions must have no parameters, return void and start on start.');
                for (const state of op.stateBody.states) {
                    if (state.entry) this.block(state.entry, new Map(env), 'void', error);
                    if (state.exit) this.block(state.exit, new Map(env), 'void', error);
                }
                for (const t of op.stateBody.transitions) {
                    const local = new Map(env);
                    if (t.endpoint) {
                        const ep = endpoint(t, t.endpoint, component);
                        if (!ep || a.isSignature(ep.member) || !['receiver', 'subscriber', 'requires'].includes(ep.port.role)) error(t, 'SW051', 'State transition receives data/events through an input port.');
                        else if (a.isDataMember(ep.member)) {
                            if (local.has('payload')) error(t, 'SW002', 'Transition payload cannot shadow component data.');
                            local.set('payload', typeKey(ep.member.type));
                        }
                        else for (const p of ep.member.parameters) {
                            if (local.has(p.name)) error(t, 'SW002', 'Transition payload parameters cannot shadow component data.');
                            local.set(p.name, typeKey(p.type));
                        }
                    }
                    if (t.guard) this.expect(t.guard, 'bool', local, error);
                    this.block(t.effect, local, 'void', error);
                }
            }
            const mutates = (current: a.FunctionDef, seen = new Set<a.FunctionDef>()): boolean => {
                if (seen.has(current)) return false;
                seen.add(current);
                return [...AstUtils.streamAllContents(current)].some(n =>
                    (a.isAssign(n) && base.has(n.target)) || (a.isLocalCall(n) && !!n.function.ref && mutates(effectiveFunction(n.function.ref, component), seen)));
            };
            if (op.timing?.concurrency === 'reentrant' && mutates(op)) error(op, 'SW054', 'Reentrant functions may not mutate component data, including through local helpers.');
        }
        for (const port of members(component).filter(a.isPort)) {
            const delegation = members(component).filter(a.isDelegate).filter(d => d.outer.$refText === port.name);
            if (delegation.length > 1) error(port, 'SW033', 'A component port can delegate to at most one immediate child.');
            if (delegation.length) {
                if (functions.some(op => [...AstUtils.streamAllContents(op)].some(n => ((a.isSend(n) || a.isRemoteCall(n) || a.isTransition(n) || a.isTrigger(n) || a.isInterruptible(n)) && n.endpoint?.startsWith(`${port.name}.`))))) error(port, 'SW033', 'A delegated port cannot also be handled or used by local functions.');
                continue;
            }
            if (['sender', 'publisher', 'provides'].includes(port.role)) {
                for (const member of port.interface.ref?.members ?? []) {
                    if (a.isSignature(member)) continue;
                    const path = `${port.name}.${member.name}`;
                    if (!functions.some(op => [...AstUtils.streamAllContents(op)].some(n => a.isSend(n) && n.endpoint === path))) error(port, 'SW050', `Outgoing member '${path}' must be tied to an emitting function.`);
                }
            }
            if (!['server', 'provides', 'receiver', 'subscriber', 'requires'].includes(port.role)) continue;
            for (const member of port.interface.ref?.members ?? []) {
                if (port.role === 'requires' && a.isSignature(member)) continue;
                if (port.role === 'provides' && a.isEventMember(member)) continue;
                const path = `${port.name}.${member.name}`;
                const handlers = functions.filter(op => op.trigger?.endpoint === path).length;
                const machines = functions.filter(op => op.stateBody?.transitions.some(t => t.endpoint === path)).length;
                const interrupts = functions.filter(op => [...AstUtils.streamAllContents(op)].some(n => a.isInterruptible(n) && n.endpoint === path)).length;
                if (handlers + machines + interrupts !== 1) error(port, 'SW055', `Member '${path}' requires exactly one receiving function, stateful function or interruptible-region owner.`);
            }
        }
        const visiting = new Set<AstNode>(), visited = new Set<AstNode>();
        const walk = (node: a.FunctionDef | a.Calculation): void => {
            if (visiting.has(node)) { error(node, 'SW056', 'Recursive local call cycles are not supported.'); return; }
            if (visited.has(node)) return;
            visiting.add(node);
            for (const n of AstUtils.streamAllContents(node)) {
                if (a.isLocalCall(n) && n.function.ref) walk(effectiveFunction(n.function.ref, component));
                if (a.isCalculationCall(n) && n.calculation.ref) walk(n.calculation.ref);
            }
            visiting.delete(node); visited.add(node);
        };
        for (const node of members(component)) if (a.isFunctionDef(node)) walk(node);
        // A completion edge releases a new activation root; it is not a local
        // call. Check the effective dependency graph separately for each owner.
        const completionVisiting = new Set<a.FunctionDef>(), completionVisited = new Set<a.FunctionDef>();
        const completion = (fn: a.FunctionDef): void => {
            if (completionVisiting.has(fn)) { error(fn.trigger!, 'SW067', 'Completion dependencies must be acyclic, including effective inherited redefinitions.'); return; }
            if (completionVisited.has(fn)) return;
            completionVisiting.add(fn);
            const predecessor = fn.trigger?.predecessor?.ref;
            if (fn.trigger?.kind === 'completion' && predecessor) completion(effectiveFunction(predecessor, component));
            completionVisiting.delete(fn); completionVisited.add(fn);
        };
        for (const fn of functions) completion(fn);
        this.context = previous;
    }
    private block(block: a.Block, inherited: Env, result: string, error: Reporter): void {
        const env = new Map(inherited);
        for (const s of block.statements) {
            if (a.isLocalVariable(s)) {
                if (env.has(s.name)) error(s, 'SW002', 'Local variables may not shadow an existing value.');
                this.expect(s.value, typeKey(s.type), env, error); env.set(s.name, typeKey(s.type));
            } else if (a.isAssign(s)) {
                const t = env.get(s.target);
                if (!t) error(s, 'SW022', 'Assignment target is not local data.');
                else this.expect(s.value, t, env, error);
            } else if (a.isReturn(s)) {
                if (s.value && result === 'void') error(s, 'SW023', 'void functions must use a bare return.');
                else if (s.value) this.expect(s.value, result, env, error);
                else if (result !== 'void') error(s, 'SW023', 'Return value is required.');
            } else if (a.isSend(s) || a.isRemoteCall(s)) {
                const ep = endpoint(s, s.endpoint, this.context);
                if (!ep) error(s, 'SW050', 'Communication must use a member of a port owned by this component.');
                else {
                    const valid = a.isRemoteCall(s) ? a.isSignature(ep.member) && ['client', 'requires'].includes(ep.port.role) : s.kind === 'send' ? a.isDataMember(ep.member) && ep.port.role === 'sender' : a.isEventMember(ep.member) && ['publisher', 'provides'].includes(ep.port.role);
                    if (!valid) error(s, 'SW051', 'Communication verb, member and port role do not agree.');
                    const types = a.isDataMember(ep.member) ? [typeKey(ep.member.type)] : ep.member.parameters.map(p => typeKey(p.type));
                    this.args(s, s.args, types, env, error);
                }
                if (a.isRemoteCall(s)) {
                    if (env.has('failure')) error(s, 'SW002', 'The implicit request failure binding cannot shadow an existing value.');
                    this.block(s.failure, new Map(env).set('failure', 'string'), result, error);
                    if (!this.terminates(s.failure)) error(s.failure, 'SW057', 'Request failure path must return or fail.');
                    if (env.has(s.name)) error(s, 'SW002', 'Request result may not shadow local data.');
                    env.set(s.name, ep && a.isSignature(ep.member) ? typeKey(ep.member.result) : '?');
                }
            } else if (a.isLocalCall(s)) {
                if (s.function.ref) {
                    this.args(s, s.args, s.function.ref.parameters.map(p => typeKey(p.type)), env, error);
                    if (s.function.ref.trigger || s.function.ref.stateBody) error(s, 'SW058', 'A local call targets an untriggered flow function owned by this component.');
                    const type = typeKey(s.function.ref.result);
                    if (type === 'void' && s.name) error(s, 'SW058', 'A local void call has no result binding.');
                    if (type !== 'void' && !s.name) error(s, 'SW058', 'Bind a value-returning local call with as name.');
                    if (s.name) {
                        if (env.has(s.name)) error(s, 'SW002', 'Call result may not shadow an existing value.');
                        env.set(s.name, type);
                    }
                }
            } else if (a.isIf(s)) {
                this.expect(s.condition, 'bool', env, error); this.block(s.then, env, result, error);
                if (s.otherwise) this.block(s.otherwise, env, result, error);
            } else if (a.isWhile(s)) {
                if (!Number.isSafeInteger(s.bound) || s.bound <= 0) error(s, 'SW059', 'Loop bound must be positive.');
                this.expect(s.condition, 'bool', env, error); this.block(s.body, env, result, error);
            } else if (a.isFor(s)) {
                if (!Number.isSafeInteger(s.bound) || s.bound <= 0) error(s, 'SW059', 'Loop bound must be positive.');
                const local = new Map(env), initial = s.initializer;
                if (local.has(initial.name)) error(initial, 'SW002', 'Loop variables may not shadow an existing value.');
                this.expect(initial.value, typeKey(initial.type), env, error); local.set(initial.name, typeKey(initial.type));
                this.expect(s.condition, 'bool', local, error);
                const target = local.get(s.update.target);
                if (!target) error(s.update, 'SW022', 'Assignment target is not local data.');
                else this.expect(s.update.value, target, local, error);
                this.block(s.body, local, result, error);
            } else if (a.isForEach(s)) {
                const collection = this.expression(s.collection, env, error), array = /^(.*)\[(\d+)\]$/.exec(collection);
                const itemType = typeKey(s.variable.type);
                if (array) {
                    if (a.isArrayLiteral(s.collection)) for (const value of s.collection.values) this.expect(value, itemType, env, error);
                    else if (array[1] !== itemType && !numericAssignable(array[1], itemType)) error(s.collection, 'SW023', `Expected array elements assignable to ${itemType}, found ${array[1]}.`);
                } else if (collection !== '?') error(s.collection, 'SW023', 'forEach requires a fixed-size array.');
                if (env.has(s.variable.name)) error(s.variable, 'SW002', 'Loop variables may not shadow an existing value.');
                this.block(s.body, new Map(env).set(s.variable.name, itemType), result, error);
            } else if (a.isDoWhile(s)) {
                if (!Number.isSafeInteger(s.bound) || s.bound <= 0) error(s, 'SW059', 'Loop bound must be positive.');
                this.block(s.body, env, result, error); this.expect(s.condition, 'bool', env, error);
            } else if (a.isInterruptible(s)) {
                this.block(s.body, env, result, error);
                const ep = endpoint(s, s.endpoint, this.context), local = new Map(env);
                if (!ep || a.isSignature(ep.member) || !['receiver', 'subscriber', 'requires'].includes(ep.port.role)) error(s, 'SW051', 'An interrupt receives data or events through a port owned by its component.');
                else {
                    const inputs = a.isDataMember(ep.member) ? [{ name: 'payload', type: ep.member.type }] : ep.member.parameters;
                    for (const input of inputs) {
                        if (local.has(input.name)) error(s, 'SW002', 'Interrupt payload bindings cannot shadow values in the enclosing scope.');
                        local.set(input.name, typeKey(input.type));
                    }
                }
                this.block(s.handler, local, result, error);
            } else if (a.isAssert(s)) this.expect(s.condition, 'bool', env, error);
        }
    }
    private terminates(b: a.Block): boolean {
        return b.statements.some(s => a.isReturn(s) || a.isFail(s) || ((a.isDoWhile(s) || a.isForEach(s)) && this.terminates(s.body)) || (a.isInterruptible(s) && this.terminates(s.body) && this.terminates(s.handler)) || (a.isIf(s) && !!s.otherwise && this.terminates(s.then) && this.terminates(s.otherwise)));
    }
    private args(n: AstNode, args: a.Expression[], types: string[], env: Env, error: Reporter): void {
        if (args.length !== types.length) error(n, 'SW024', 'Argument count does not match the contract.');
        args.forEach((arg, i) => this.expect(arg, types[i] ?? '?', env, error));
    }
    private expect(e: a.Expression, expected: string, env: Env, error: Reporter): void {
        const actual = this.expression(e, env, error);
        if (a.isArrayLiteral(e)) {
            const target = /^(.*)\[(\d+)\]$/.exec(expected);
            if (target && e.values.length === Number(target[2])) {
                for (const value of e.values) this.expect(value, target[1], env, error);
                return;
            }
        }
        if (actual !== '?' && expected !== '?' && actual !== expected && !numericAssignable(actual, expected)) error(e, 'SW023', `Expected ${expected}, found ${actual}.`);
        const constant = this.constantNumber(e);
        if (constant !== undefined && isIntegralType(expected) && !integralInRange(constant, expected)) error(e, 'SW025', `Value is outside the ${expected} range.`);
    }
    private expression(e: a.Expression, env: Env, error: Reporter): string {
        if (a.isLiteral(e)) return e.boolean !== undefined ? 'bool' : e.text !== undefined ? 'string' : e.$cstNode?.text.includes('.') ? 'real' : 'int';
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
            if (!t) { error(e, 'SW022', `Unknown local value or enum type '${parts[0]}'. Cross-component data access is forbidden.`); return '?'; }
            if (t === 'void') { error(e, 'SW022', 'A void request result names completion only and cannot be read as a value.'); return '?'; }
            for (const field of parts.slice(1)) {
                const all = [...this.services.shared.workspace.LangiumDocuments.all].flatMap(d => a.isModel(d.parseResult.value) ? d.parseResult.value.packages.flatMap(p => p.elements) : []);
                const dtype = all.find(d => a.isDataType(d) && typeKey({ type: { ref: d } } as a.TypeRef) === t);
                const f = dtype && a.isDataType(dtype) ? dtype.fields.find(p => p.name === field) : undefined;
                if (!f) { error(e, 'SW022', `Unknown record field '${field}'.`); return '?'; }
                t = typeKey(f.type);
            }
            if (e.index) {
                this.expect(e.index, 'int', env, error);
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
            const t = types.every(isNumericType) ? types.includes('real') ? 'real' : types.includes('int') ? 'int' : types.every(t => t === 'byte') ? 'byte' : 'uint' : types[0];
            for (const value of e.values) this.expect(value, t, env, error);
            return `${t}[${types.length}]`;
        }
        if (a.isCalculationCall(e)) {
            if (e.calculation.ref) {
                this.args(e, e.args, e.calculation.ref.parameters.map(p => typeKey(p.type)), env, error);
                return typeKey(e.calculation.ref.result);
            }
            return '?';
        }
        if (a.isUnaryExpression(e)) {
            const t = e.operand ? this.expression(e.operand, env, error) : '?';
            if (e.operator === 'not' ? t !== 'bool' : !isNumericType(t) && t !== '?') error(e, 'SW023', 'Invalid unary operand.');
            return e.operator === 'not' ? 'bool' : isIntegralType(t) ? 'int' : t;
        }
        if (a.isBinaryExpression(e)) {
            const l = this.expression(e.left, env, error), r = this.expression(e.right, env, error);
            const numeric = isNumericType(l) && isNumericType(r);
            if (['and', 'or'].includes(e.operator)) {
                if (l !== 'bool' || r !== 'bool') error(e, 'SW023', 'Boolean operands required.');
                return 'bool';
            }
            if (['==', '!='].includes(e.operator)) {
                if (l !== r && !numeric) error(e, 'SW023', 'Equality operands must have compatible types.');
                return 'bool';
            }
            if (!numeric) error(e, 'SW023', 'Numeric operands required.');
            if (e.operator === '%' && (!isIntegralType(l) || !isIntegralType(r))) error(e, 'SW023', 'Remainder requires integral operands.');
            if (['<', '<=', '>', '>='].includes(e.operator)) return 'bool';
            return l === 'real' || r === 'real' || e.operator === '/' ? 'real' : 'int';
        }
        return '?';
    }
    private constantNumber(e: a.Expression): number | undefined {
        if (a.isLiteral(e)) return e.number;
        if (a.isUnaryExpression(e) && e.operator === '-') {
            const operand = this.constantNumber(e.operand);
            return operand === undefined ? undefined : -operand;
        }
        if (a.isBinaryExpression(e)) {
            const left = this.constantNumber(e.left), right = this.constantNumber(e.right);
            if (left === undefined || right === undefined) return undefined;
            switch (e.operator) {
                case '+': return left + right;
                case '-': return left - right;
                case '*': return left * right;
                case '/': return left / right;
                case '%': return left % right;
            }
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
        const expand = (c: Container, prefix: string, seen: Set<a.Component>) => {
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
                const qos = effectiveQos(n.qos);
                if (!qos?.maxLatency) error(n, 'SW044', 'Realtime/mixed roots require connector maxLatency.');
                const port = ports.get(resolve(s));
                if (port?.interface.ref?.members.some(m => a.isDataMember(m) && m.mode === 'sampled') && !qos?.maxAge) error(n, 'SW044', 'Sampled realtime data requires maxAge.');
            }
        }
        for (const [path, port] of ports) {
            const count = uses.get(path) ?? 0;
            if (!port.optional && count === 0) error(root, 'SW034', `Required port '${path}' is unconnected.`);
            if (!aliases.has(path) && ['receiver', 'client', 'requires'].includes(port.role) && count > 1) error(root, 'SW035', `Port '${path}' requires a single source/provider.`);
        }
        const deployed = new Set<string>();
        for (const d of root.members.filter(a.isDeployment)) {
            if (d.target !== root.name && !instances.has(d.target)) error(d, 'SW070', 'Deployment must name an instance path.');
            if (d.target === root.name && instances.has(d.target)) error(d, 'SW070', 'Deployment is ambiguous between the root and an immediate child with the same name. Rename that child.');
            if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:[^\s]+$/.test(d.system)) error(d, 'SW070', 'Deployment requires a nonempty external system reference, for example sysml:Vehicle::ecu.');
            if (deployed.has(d.target)) error(d, 'SW070', 'An instance cannot be deployed twice.');
            deployed.add(d.target);
        }
        if ((root.profile ?? 'service') !== 'service') {
            const walk = (c: Container, seen: Set<a.Component>) => {
                for (const fn of members(c).filter(a.isFunctionDef)) if (!fn.timing) error(fn, 'SW045', 'Functions used in realtime/mixed roots require timing contracts.');
                for (const i of members(c).filter(a.isInstance)) if (i.definition.ref && !seen.has(i.definition.ref)) walk(i.definition.ref, new Set(seen).add(i.definition.ref));
            };
            walk(root, new Set());
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
                const requests = [...ancestors].filter(prior => prior.kind === 'call' && prior.connector === step.connector && prior.source === step.target && prior.target === step.source && !(replies.has(prior) && ancestors.has(replies.get(prior)!)));
                if (requests.length !== 1) error(step, 'SW083', 'Reply requires exactly one causally preceding, unanswered request on the same route/member.');
                else if (replies.has(requests[0])) error(step, 'SW083', 'A request cannot have multiple replies, including on independent causal branches.');
                else replies.set(requests[0], step);
            }
        }
    }
}
type Reporter = (node: AstNode, code: string, message: string) => void;
