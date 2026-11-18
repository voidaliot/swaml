import { inject, prepareLangiumParser, URI, type Module } from 'langium';
import { createDefaultModule, createDefaultSharedModule, type DefaultSharedModuleContext, type LangiumServices, type PartialLangiumServices } from 'langium/lsp';
import { SwamlGeneratedModule, SwamlGeneratedSharedModule } from './generated/module.js';
import { SwamlScopeProvider, SwamlLinker } from './swaml-scope.js';
import { SwamlValidator } from './swaml-validator.js';
import { SwamlLanguageServer } from './language-server.js';
import { SwamlDocumentBuilder, SwamlDocumentValidator } from './swaml-document-builder.js';
import { SwamlPathServices } from './path-services.js';
import { SwamlFormatter } from './formatter.js';
import { STANDARD_LIBRARY, STANDARD_LIBRARY_2_3 } from './standard-library.js';
import { applyStatementRecovery, guardParserStack, SwamlLexer, SwamlLexerErrorMessageProvider, SwamlParserErrorMessageProvider, SwamlValueConverter } from './swaml-syntax.js';
export { effectiveQos } from './semantic.js';
export { documentationText, modelComments, selectView, viewCandidates } from './presentation.js';
export { SWAML_IMPLEMENTATION_VERSION, SWAML_LANGUAGE_VERSION, SWAML_REFERENCE_PROFILE } from './edition.js';
export type SwamlServices = LangiumServices & {
    validation: {
        SwamlValidator: SwamlValidator;
    };
};
export const SwamlModule: Module<SwamlServices, PartialLangiumServices & {
    validation: {
        SwamlValidator: SwamlValidator;
    };
}> = {
    parser: {
        // Statement recovery (swaml-syntax.ts): the adaptive lookahead keeps a statement list going while a place is typed.
        // A parse that overflows the host stack becomes an SW2013 diagnostic instead of an exception (WP2-D05).
        LangiumParser: services => { const parser = prepareLangiumParser(services); applyStatementRecovery(parser); parser.finalize(); guardParserStack(parser); return parser; },
        Lexer: services => new SwamlLexer(services), ValueConverter: () => new SwamlValueConverter(), ParserErrorMessageProvider: () => new SwamlParserErrorMessageProvider(), LexerErrorMessageProvider: () => new SwamlLexerErrorMessageProvider() },
    lsp: { Formatter: services => new SwamlFormatter(services.parser.Lexer), RenameProvider: services => new SwamlPathServices(services), DefinitionProvider: services => new SwamlPathServices(services), ReferencesProvider: services => new SwamlPathServices(services) },
    references: { ScopeProvider: services => new SwamlScopeProvider(services), Linker: services => new SwamlLinker(services) },
    validation: { SwamlValidator: services => new SwamlValidator(services), DocumentValidator: services => new SwamlDocumentValidator(services) }
};
export function createSwamlServices(context: DefaultSharedModuleContext, ...hostModules: Module<SwamlServices, PartialLangiumServices & { validation?: { SwamlValidator?: SwamlValidator } }>[]) {
    const shared = inject(createDefaultSharedModule(context), SwamlGeneratedSharedModule, { workspace: { DocumentBuilder: services => new SwamlDocumentBuilder(services) }, lsp: { LanguageServer: services => new SwamlLanguageServer(services) } });
    const Swaml = inject(createDefaultModule({ shared }), SwamlGeneratedModule, SwamlModule, ...hostModules);
    shared.ServiceRegistry.register(Swaml);
    Swaml.validation.ValidationRegistry.register({ Model: Swaml.validation.SwamlValidator.checkModel }, Swaml.validation.SwamlValidator);
    const library = shared.workspace.LangiumDocumentFactory.fromString(STANDARD_LIBRARY, URI.parse('builtin:///swaml-2.0.swaml'));
    shared.workspace.LangiumDocuments.addDocument(library);
    // The 2.3 packages Swaml::Numeric, Swaml::Text and Swaml::Time are a separate built-in document (WP3-M01),
    // so the 2.2 library keeps its bytes, document URI and source ranges.
    shared.workspace.LangiumDocuments.addDocument(shared.workspace.LangiumDocumentFactory.fromString(STANDARD_LIBRARY_2_3, URI.parse('builtin:///swaml-2.3.swaml')));
    return { shared, Swaml };
}
