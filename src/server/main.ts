import { createConnection, ProposedFeatures } from 'vscode-languageserver/node';
import { NodeFileSystem } from 'langium/node';
import { startLanguageServer } from 'langium/lsp';
import { createSwamlServices } from '../language/swaml-module.js';
const connection = createConnection(ProposedFeatures.all);
const { shared } = createSwamlServices({ connection, ...NodeFileSystem });
startLanguageServer(shared);
