import { inject, URI, type Module } from 'langium';
import { createDefaultModule, createDefaultSharedModule, type DefaultSharedModuleContext, type LangiumServices, type PartialLangiumServices } from 'langium/lsp';
import { SwamlGeneratedModule, SwamlGeneratedSharedModule } from './generated/module.js';
import { SwamlScopeProvider } from './swaml-scope.js';
import { SwamlValidator } from './swaml-validator.js';
import { SwamlLanguageServer } from './language-server.js';
import { SwamlDocumentBuilder } from './swaml-document-builder.js';
import { SwamlPathServices } from './path-services.js';
import { SwamlFormatter } from './formatter.js';
import { STANDARD_LIBRARY } from './standard-library.js';
export { effectiveQos } from './semantic.js';
export { documentationText, modelComments, selectView, viewCandidates } from './presentation.js';
export const SWAML_LANGUAGE_VERSION = '2.0' as const;
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
    lsp: { Formatter: () => new SwamlFormatter(), RenameProvider: services => new SwamlPathServices(services), DefinitionProvider: services => new SwamlPathServices(services), ReferencesProvider: services => new SwamlPathServices(services) },
    references: { ScopeProvider: services => new SwamlScopeProvider(services) },
    validation: { SwamlValidator: services => new SwamlValidator(services) }
};
export function createSwamlServices(context: DefaultSharedModuleContext, ...hostModules: Module<SwamlServices, PartialLangiumServices & { validation?: { SwamlValidator?: SwamlValidator } }>[]) {
    const shared = inject(createDefaultSharedModule(context), SwamlGeneratedSharedModule, { workspace: { DocumentBuilder: services => new SwamlDocumentBuilder(services) }, lsp: { LanguageServer: services => new SwamlLanguageServer(services) } });
    const Swaml = inject(createDefaultModule({ shared }), SwamlGeneratedModule, SwamlModule, ...hostModules);
    shared.ServiceRegistry.register(Swaml);
    Swaml.validation.ValidationRegistry.register({ Model: Swaml.validation.SwamlValidator.checkModel }, Swaml.validation.SwamlValidator);
    const library = shared.workspace.LangiumDocumentFactory.fromString(STANDARD_LIBRARY, URI.parse('builtin:///swaml-2.0.swaml'));
    shared.workspace.LangiumDocuments.addDocument(library);
    return { shared, Swaml };
}
