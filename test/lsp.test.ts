import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('LSP initializes, publishes semantic diagnostics and shuts down', async () => {
    const server = spawn(process.execPath, [fileURLToPath(new URL('../src/server/main.js', import.meta.url)), '--stdio'], { stdio: 'pipe' });
    let buffer = Buffer.alloc(0), stderr = '', id = 0;
    type Message = { id?: number; method?: string; params?: { diagnostics?: { code?: string }[] }; result?: unknown; error?: unknown };
    const pending = new Map<number, (m: Message) => void>();
    let diagnosticResolve: (m: Message) => void = () => {};
    const published = new Promise<Message>(resolve => { diagnosticResolve = resolve; });
    server.stderr.on('data', chunk => { stderr += String(chunk); });
    server.stdout.on('data', (chunk: Buffer) => {
        buffer = Buffer.concat([buffer, chunk]);
        while (true) {
            const headerEnd = buffer.indexOf('\r\n\r\n');
            if (headerEnd < 0) break;
            const length = Number(/Content-Length: (\d+)/i.exec(buffer.subarray(0, headerEnd).toString())?.[1]);
            if (buffer.length < headerEnd + 4 + length) break;
            const message = JSON.parse(buffer.subarray(headerEnd + 4, headerEnd + 4 + length).toString()) as Message;
            buffer = buffer.subarray(headerEnd + 4 + length);
            if (message.id !== undefined) { pending.get(message.id)?.(message); pending.delete(message.id); }
            if (message.method === 'textDocument/publishDiagnostics' && message.params?.diagnostics?.length) diagnosticResolve(message);
        }
    });
    const send = (message: unknown) => {
        const json = JSON.stringify(message);
        server.stdin.write(`Content-Length: ${Buffer.byteLength(json)}\r\n\r\n${json}`);
    };
    const request = (method: string, params: unknown) => new Promise<Message>(resolve => {
        const next = ++id; pending.set(next, resolve); send({ jsonrpc: '2.0', id: next, method, params });
    });
    let timer: NodeJS.Timeout;
    const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(`LSP timeout: ${stderr}`)), 10000); });
    try {
        const initialized = await Promise.race([request('initialize', { processId: null, rootUri: null, capabilities: {} }), timeout]);
        assert.ok(initialized.result && !initialized.error, JSON.stringify(initialized));
        send({ jsonrpc: '2.0', method: 'initialized', params: {} });
        send({ jsonrpc: '2.0', method: 'textDocument/didOpen', params: { textDocument: {
            uri: 'file:///lsp-test.swaml', languageId: 'swaml', version: 1,
            text: 'swaml "1.0"; package P { unit def U { operation run(): Void { publish foreign.output.eventName(); return; } } }'
        } } });
        const message = await Promise.race([published, timeout]);
        assert.ok(message.params?.diagnostics?.some(d => d.code === 'SW050'), JSON.stringify(message));
        const shutdown = await Promise.race([request('shutdown', null), timeout]);
        assert.equal(shutdown.error, undefined);
        send({ jsonrpc: '2.0', method: 'exit' });
    } finally { clearTimeout(timer!); server.kill(); }
});

test('CLI exits distinguish valid model, invalid model and invocation error', () => {
    const main = fileURLToPath(new URL('../src/cli/main.js', import.meta.url));
    const run = (args: string[]) => spawnSync(process.execPath, [main, ...args], { encoding: 'utf8', timeout: 10000 });
    assert.equal(run(['examples/01-hello.swaml']).status, 0);
    const invalid = run(['examples/invalid/bypass-port.swaml']);
    assert.equal(invalid.status, 1, invalid.stderr);
    assert.match(invalid.stdout, /SW050/);
    assert.equal(run([]).status, 2);
});
