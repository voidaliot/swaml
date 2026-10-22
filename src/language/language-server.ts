import { DefaultLanguageServer, type LangiumSharedServices } from 'langium/lsp';
import { ResponseError, ErrorCodes, type InitializeParams, type InitializeResult } from 'vscode-languageserver-protocol';
export class SwamlLanguageServer extends DefaultLanguageServer {
    constructor(services: LangiumSharedServices) { super(services); }
    override async initialize(params: InitializeParams): Promise<InitializeResult> {
        const options = params.initializationOptions as {
            languageVersion?: string;
            swaml?: {
                languageVersion?: string;
            };
        } | undefined;
        for (const version of [options?.languageVersion, options?.swaml?.languageVersion])
            if (version !== undefined && version !== '2.0')
                throw new ResponseError(ErrorCodes.InvalidParams, `Unsupported language version ${version}; this host selects swa.ml 2.0.`);
        const result = await super.initialize(params);
        return { ...result, serverInfo: { name: 'swa.ml', version: '2.0.0' }, capabilities: { ...result.capabilities, experimental: { swaml: { languageVersion: '2.0', profile: 'swaml-reference/2.0' } } } };
    }
}
