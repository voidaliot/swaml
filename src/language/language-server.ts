import { DefaultLanguageServer, type LangiumSharedServices } from 'langium/lsp';
import { ResponseError, ErrorCodes, type InitializeParams, type InitializeResult } from 'vscode-languageserver-protocol';
import { SWAML_IMPLEMENTATION_VERSION, SWAML_LANGUAGE_VERSION, SWAML_REFERENCE_PROFILE } from './edition.js';
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
            if (version !== undefined && version !== SWAML_LANGUAGE_VERSION)
                throw new ResponseError(ErrorCodes.InvalidParams, `Unsupported language version ${version}; this host selects swa.ml ${SWAML_LANGUAGE_VERSION}.`);
        const result = await super.initialize(params);
        return { ...result, serverInfo: { name: 'swa.ml', version: SWAML_IMPLEMENTATION_VERSION }, capabilities: { ...result.capabilities, experimental: { swaml: { languageVersion: SWAML_LANGUAGE_VERSION, profile: SWAML_REFERENCE_PROFILE } } } };
    }
}
