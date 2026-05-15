"use strict";

import "adaptive-extender/node";
import { Controller } from "adaptive-extender/node";
import { createConnection, TextDocuments, ProposedFeatures, TextDocumentSyncKind, DidChangeConfigurationNotification, type InitializeParams, type InitializeResult, type DocumentFormattingParams, type CompletionParams, type HoverParams, type FoldingRangeParams, type SignatureHelpParams, type WorkspaceFolder, CompletionItem, Hover, FoldingRange, SignatureHelp } from "vscode-languageserver/node.js";
import { TextDocument, TextEdit } from "vscode-languageserver-textdocument";
import { ServiceFactory, ServiceBundle } from "../services/service-factory.js";

//#region Language server
class LanguageServer extends Controller {
	#connection = createConnection(ProposedFeatures.all);
	#documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);
	#hasConfigCapability = false;
	#workspaceFolders: WorkspaceFolder[] | null = null;
	#services: ServiceBundle;

	constructor() {
		super();
		this.#services = ServiceFactory.create();
	}

	async run(): Promise<void> {
		const connection = this.#connection;
		const documents = this.#documents;
		connection.onInitialize(params => this.#onInitialize(params));
		connection.onInitialized(_ => this.#onInitialized());
		documents.onDidOpen(event => this.#sendDiagnostics(event.document));
		documents.onDidChangeContent(event => this.#sendDiagnostics(event.document));
		connection.onCompletion(params => this.#onCompletion(params));
		connection.onSignatureHelp(params => this.#onSignatureHelp(params));
		connection.onHover(params => this.#onHover(params));
		connection.onDocumentFormatting(params => this.#onDocumentFormatting(params));
		connection.onFoldingRanges(params => this.#onFoldingRanges(params));
		documents.listen(connection);
		connection.listen();
	}

	#onInitialize(params: InitializeParams): InitializeResult {
		this.#workspaceFolders = params.workspaceFolders ?? null;
		this.#hasConfigCapability = params.capabilities.workspace?.configuration !== undefined;
		const hasWorkspaceFolders = params.capabilities.workspace?.workspaceFolders !== undefined;
		const result: InitializeResult = {
			capabilities: {
				textDocumentSync: TextDocumentSyncKind.Incremental,
				completionProvider: { resolveProvider: false, triggerCharacters: ["."] },
				signatureHelpProvider: { triggerCharacters: ["(", ","], retriggerCharacters: [","] },
				documentFormattingProvider: true,
				hoverProvider: true,
				foldingRangeProvider: true
			}
		};
		if (hasWorkspaceFolders) result.capabilities.workspace = { workspaceFolders: { supported: true } };
		return result;
	}

	#onInitialized(): void {
		const connection = this.#connection;
		const workspaceFolders = this.#workspaceFolders;
		if (this.#hasConfigCapability) connection.client.register(DidChangeConfigurationNotification.type, undefined);
		if (workspaceFolders !== null) this.#services.initialize(workspaceFolders);
	}

	#sendDiagnostics(document: TextDocument): void {
		const connection = this.#connection;
		const uri = document.uri;
		const diagnostics = this.#services.validationService.validate(document);
		connection.sendDiagnostics({ uri, diagnostics });
	}

	#onCompletion(params: CompletionParams): CompletionItem[] {
		const document = this.#documents.get(params.textDocument.uri);
		if (document === undefined) return [];
		return this.#services.completionService.getCompletions(document, params.position);
	}

	#onSignatureHelp(params: SignatureHelpParams): SignatureHelp | null {
		const document = this.#documents.get(params.textDocument.uri);
		if (document === undefined) return null;
		return this.#services.signatureService.getSignatureHelp(document, params.position);
	}

	#onHover(params: HoverParams): Hover | null {
		const document = this.#documents.get(params.textDocument.uri);
		if (document === undefined) return null;
		return this.#services.hoverService.getHover(document, params.position);
	}

	#onDocumentFormatting(params: DocumentFormattingParams): TextEdit[] {
		const document = this.#documents.get(params.textDocument.uri);
		if (document === undefined) return [];
		return this.#services.formattingService.getEdits(document);
	}

	#onFoldingRanges(params: FoldingRangeParams): FoldingRange[] {
		const document = this.#documents.get(params.textDocument.uri);
		if (document === undefined) return [];
		return this.#services.foldingService.getRanges(document);
	}
}
//#endregion

LanguageServer.launch();
