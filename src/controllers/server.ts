"use strict";

import { createConnection, TextDocuments, ProposedFeatures, TextDocumentSyncKind, DidChangeConfigurationNotification, type InitializeParams, type InitializeResult, type DocumentFormattingParams, type CompletionParams, type HoverParams, type FoldingRangeParams, type WorkspaceFolder } from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { SymbolService } from "../services/symbol-service.js";
import { ValidationService } from "../services/validation-service.js";
import { CompletionService } from "../services/completion-service.js";
import { HoverService } from "../services/hover-service.js";
import { FormattingService } from "../services/formatting-service.js";
import { FoldingService } from "../services/folding-service.js";

//#region LanguageServer
class LanguageServer {
	#connection = createConnection(ProposedFeatures.all);
	#documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);
	#hasConfigCapability = false;
	#workspaceFolders: WorkspaceFolder[] | null = null;
	#symbolService: SymbolService;
	#validationService: ValidationService;
	#completionService: CompletionService;
	#hoverService: HoverService;
	#formattingService: FormattingService;
	#foldingService: FoldingService;

	constructor() {
		this.#symbolService = new SymbolService();
		this.#validationService = new ValidationService();
		this.#completionService = new CompletionService(this.#symbolService);
		this.#hoverService = new HoverService(this.#symbolService);
		this.#formattingService = new FormattingService();
		this.#foldingService = new FoldingService();
	}

	start(): void {
		this.#connection.onInitialize(params => this.#onInitialize(params));
		this.#connection.onInitialized(() => this.#onInitialized());
		this.#documents.onDidOpen(event => this.#sendDiagnostics(event.document));
		this.#documents.onDidChangeContent(event => this.#sendDiagnostics(event.document));
		this.#connection.onCompletion(params => this.#onCompletion(params));
		this.#connection.onHover(params => this.#onHover(params));
		this.#connection.onDocumentFormatting(params => this.#onDocumentFormatting(params));
		this.#connection.onFoldingRanges(params => this.#onFoldingRanges(params));
		this.#documents.listen(this.#connection);
		this.#connection.listen();
	}

	#onInitialize(params: InitializeParams): InitializeResult {
		this.#workspaceFolders = params.workspaceFolders ?? null;
		this.#hasConfigCapability = !!(params.capabilities.workspace?.configuration);
		const hasWorkspaceFolders = !!(params.capabilities.workspace?.workspaceFolders);
		const result: InitializeResult = {
			capabilities: {
				textDocumentSync: TextDocumentSyncKind.Incremental,
				completionProvider: { resolveProvider: false, triggerCharacters: ["."] },
				documentFormattingProvider: true,
				hoverProvider: true,
				foldingRangeProvider: true
			}
		};
		if (hasWorkspaceFolders) result.capabilities.workspace = { workspaceFolders: { supported: true } };
		return result;
	}

	#onInitialized(): void {
		if (this.#hasConfigCapability) this.#connection.client.register(DidChangeConfigurationNotification.type, undefined);
		if (this.#workspaceFolders) this.#symbolService.initialize(this.#workspaceFolders);
	}

	#sendDiagnostics(document: TextDocument): void {
		this.#connection.sendDiagnostics({ uri: document.uri, diagnostics: this.#validationService.validate(document) });
	}

	#onCompletion(params: CompletionParams) {
		const document = this.#documents.get(params.textDocument.uri);
		if (!document) return [];
		return this.#completionService.getCompletions(document, params.position);
	}

	#onHover(params: HoverParams) {
		const document = this.#documents.get(params.textDocument.uri);
		if (!document) return null;
		return this.#hoverService.getHover(document, params.position);
	}

	#onDocumentFormatting(params: DocumentFormattingParams) {
		const document = this.#documents.get(params.textDocument.uri);
		if (!document) return [];
		return this.#formattingService.getEdits(document);
	}

	#onFoldingRanges(params: FoldingRangeParams) {
		const document = this.#documents.get(params.textDocument.uri);
		if (!document) return [];
		return this.#foldingService.getRanges(document);
	}
}
//#endregion

new LanguageServer().start();
