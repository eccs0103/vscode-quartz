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
	HoverParams,
	FoldingRangeParams,
	WorkspaceFolder
} from "vscode-languageserver/node";

import { TextDocument } from "vscode-languageserver-textdocument";

import { ValidationService } from "../services/validation-service.js";
import { FormattingService } from "../services/formatting-service.js";
import { CompletionService } from "../services/completion-service.js";
import { HoverService } from "../services/hover-service.js";
import { SymbolService } from "../services/symbol-service.js";

import { DiagnosticsProvider } from "../services/diagnostics-provider.js";
import { FormattingProvider } from "../services/formatting-provider.js";
import { CompletionProvider } from "../services/completion-provider.js";
import { HoverProvider } from "../services/hover-provider.js";
import { FoldingProvider } from "../services/folding-provider.js";

//#region Connection
const connection = createConnection(ProposedFeatures.all);
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let workspaceFolders: WorkspaceFolder[] | null = null;
//#endregion

//#region Services
const validationService = new ValidationService();
const formattingService = new FormattingService();
const symbolService = new SymbolService();
const completionService = new CompletionService(symbolService);
const hoverService = new HoverService(symbolService);
//#endregion

//#region Providers
const diagnosticsProvider = new DiagnosticsProvider(validationService);
const formattingProvider = new FormattingProvider(formattingService);
const completionProvider = new CompletionProvider(completionService);
const hoverProvider = new HoverProvider(hoverService);
const foldingProvider = new FoldingProvider();
//#endregion

//#region Initialization
connection.onInitialize((params: InitializeParams) => {
	const capabilities = params.capabilities;
	workspaceFolders = params.workspaceFolders || null;

	hasConfigurationCapability = !!(capabilities.workspace && !!capabilities.workspace.configuration);
	hasWorkspaceFolderCapability = !!(capabilities.workspace && !!capabilities.workspace.workspaceFolders);

	const result: InitializeResult = {
		capabilities: {
			textDocumentSync: TextDocumentSyncKind.Incremental,
			completionProvider: {
				resolveProvider: false,
				triggerCharacters: ['.']
			},
			documentFormattingProvider: true,
			hoverProvider: true,
			foldingRangeProvider: true
		}
	};
	
	if (hasWorkspaceFolderCapability) result.capabilities.workspace = { workspaceFolders: { supported: true } };
	return result;
});

connection.onInitialized(() => {
	if (hasConfigurationCapability) connection.client.register(DidChangeConfigurationNotification.type, undefined);
	if (workspaceFolders) symbolService.initialize(workspaceFolders);
});
//#endregion

//#region Document validation
function sendDiagnostics(textDocument: TextDocument): void {
	const diagnostics = diagnosticsProvider.getDiagnostics(textDocument);
	connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

documents.onDidOpen((event) => {
	sendDiagnostics(event.document);
});

documents.onDidChangeContent((event) => {
	sendDiagnostics(event.document);
});
//#endregion

//#region Completion provider
connection.onCompletion((params: CompletionParams) => {
	const document = documents.get(params.textDocument.uri);
	if (!document) return [];
	return completionProvider.getItems(document, params.position, params.context?.triggerCharacter);
});
//#endregion

//#region Hover provider
connection.onHover((params: HoverParams) => {
	const document = documents.get(params.textDocument.uri);
	if (!document) return null;
	return hoverProvider.getHover(document, params.position);
});
//#endregion

//#region Formatting provider
connection.onDocumentFormatting((params: DocumentFormattingParams) => {
	const document = documents.get(params.textDocument.uri);
	if (!document) return [];
	return formattingProvider.getEdits(document);
});
//#endregion

//#region Folding provider
connection.onFoldingRanges((params: FoldingRangeParams) => {
	const document = documents.get(params.textDocument.uri);
	if (!document) return [];
	return foldingProvider.getRanges(document);
});
//#endregion

//#region Listen
documents.listen(connection);
connection.listen();
//#endregion
