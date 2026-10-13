import { inject, type Module } from 'langium';
import { createDefaultModule, createDefaultSharedModule, type DefaultSharedModuleContext, type LangiumServices, type PartialLangiumServices } from 'langium/lsp';
import { SwamlGeneratedModule, SwamlGeneratedSharedModule } from './generated/module.js';
import { SwamlScopeProvider } from './swaml-scope.js';
import { SwamlValidator } from './swaml-validator.js';
import { SwamlDocumentBuilder } from './swaml-document-builder.js';

export type SwamlServices = LangiumServices & { validation: { SwamlValidator: SwamlValidator } };
export const SwamlModule: Module<SwamlServices, PartialLangiumServices & { validation: { SwamlValidator: SwamlValidator } }> = {
    references: { ScopeProvider: services => new SwamlScopeProvider(services) },
    validation: { SwamlValidator: services => new SwamlValidator(services) }
};
export function createSwamlServices(context: DefaultSharedModuleContext) {
    const shared = inject(createDefaultSharedModule(context), SwamlGeneratedSharedModule, {
        workspace: { DocumentBuilder: services => new SwamlDocumentBuilder(services) }
    });
    const Swaml = inject(createDefaultModule({ shared }), SwamlGeneratedModule, SwamlModule);
    shared.ServiceRegistry.register(Swaml);
    Swaml.validation.ValidationRegistry.register({ Model: Swaml.validation.SwamlValidator.checkModel }, Swaml.validation.SwamlValidator);
    return { shared, Swaml };
}
