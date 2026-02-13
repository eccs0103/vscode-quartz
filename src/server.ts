"use strict";

import {
	createConnection,
	TextDocuments,
	ProposedFeatures,
	InitializeParams,
	DidChangeConfigurationNotification,
	TextDocumentSyncKind,
	InitializeResult,
	DocumentFormattingParams,
	CompletionParams,
	HoverParams
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';

import { ValidationService } from './services/validation-service.js';
import { FormattingService } from './services/formatting-service.js';
import { CompletionService } from './services/completion-service.js';
import { HoverService } from './services/hover-service.js';

import { DiagnosticsProvider } from './providers/diagnostics-provider.js';
import { FormattingProvider } from './providers/formatting-provider.js';
import { CompletionProvider } from './providers/completion-provider.js';
import { HoverProvider } from './providers/hover-provider.js';

//#region Connection
const connection = createConnection(ProposedFeatures.all);
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
//#endregion

//#region Services
const validationService = new ValidationService();
const formattingService = new FormattingService();
const completionService = new CompletionService();
const hoverService = new HoverService();
//#endregion

//#region Providers
const diagnosticsProvider = new DiagnosticsProvider(validationService);
const formattingProvider = new FormattingProvider(formattingService);
const completionProvider = new CompletionProvider(completionService);
const hoverProvider = new HoverProvider(hoverService);
//#endregion

//#region Initialization
connection.onInitialize((params: InitializeParams) => {
	const capabilities = params.capabilities;

	hasConfigurationCapability = !!(
		capabilities.workspace && !!capabilities.workspace.configuration
	);
	hasWorkspaceFolderCapability = !!(
		capabilities.workspace && !!capabilities.workspace.workspaceFolders
	);

	const result: InitializeResult = {
		capabilities: {
			textDocumentSync: TextDocumentSyncKind.Incremental,
			completionProvider: {
				resolveProvider: false,
				triggerCharacters: ['.']
			},
			documentFormattingProvider: true,
			hoverProvider: true
		}
	};
	
	if (hasWorkspaceFolderCapability) {
		result.capabilities.workspace = {
			workspaceFolders: {
				supported: true
			}
		};
	}
	
	return result;
});

connection.onInitialized(() => {
	if (hasConfigurationCapability) {
		connection.client.register(DidChangeConfigurationNotification.type, undefined);
	}
});
//#endregion

//#region Document validation
function validateDocument(textDocument: TextDocument): void {
	const diagnostics = diagnosticsProvider.provideDiagnostics(textDocument);
	connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

documents.onDidOpen((e) => {
	validateDocument(e.document);
});

documents.onDidChangeContent((change) => {
	validateDocument(change.document);
});
//#endregion

//#region Completion provider
connection.onCompletion((params: CompletionParams) => {
	return completionProvider.provideCompletion();
});
//#endregion

//#region Hover provider
connection.onHover((params: HoverParams) => {
	const document = documents.get(params.textDocument.uri);
	if (!document) {
		return null;
	}

	return hoverProvider.provideHover(document, params.position);
});
//#endregion

//#region Formatting provider
connection.onDocumentFormatting((params: DocumentFormattingParams) => {
	const document = documents.get(params.textDocument.uri);
	if (!document) {
		return [];
	}

	return formattingProvider.provideFormatting(document);
});
//#endregion

//#region Listen
documents.listen(connection);
connection.listen();
//#endregion
