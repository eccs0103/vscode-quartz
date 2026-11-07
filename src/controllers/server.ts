"use strict";

import "adaptive-extender/node";
import { Controller } from "adaptive-extender/node";
import { createConnection, TextDocuments, ProposedFeatures, TextDocumentSyncKind, DidChangeConfigurationNotification, type InitializeParams, type InitializeResult, type DocumentFormattingParams, type CompletionParams, type HoverParams, type FoldingRangeParams, type SignatureHelpParams, type WorkspaceFolder, CompletionItem, Hover, FoldingRange, type SignatureHelp } from "vscode-languageserver/node.js";
import { TextDocument, type TextEdit } from "vscode-languageserver-textdocument";
import { ServiceFactory, ServiceBundle } from "../services/service-factory.js";

//#region Language server
class LanguageServer extends Controller {
	#connection = createConnection(ProposedFeatures.all);
	#documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);
	#hasConfigCapability = false;
	#folders: WorkspaceFolder[] | null = null;
	#services: ServiceBundle;

	constructor() {
		super();
		this.#services = ServiceFactory.create();
	}

	async run(): Promise<void> {
		const connection = this.#connection;
		const documents = this.#documents;
		connection.onInitialize(event => this.#onInitialize(event));
		connection.onInitialized(event => this.#onInitialized());
		documents.onDidOpen(event => this.#sendDiagnostics(event.document));
		documents.onDidChangeContent(event => this.#sendDiagnostics(event.document));
		connection.onCompletion(event => this.#onCompletion(event));
		connection.onSignatureHelp(event => this.#onSignatureHelp(event));
		connection.onHover(event => this.#onHover(event));
		connection.onDocumentFormatting(event => this.#onDocumentFormatting(event));
		connection.onFoldingRanges(event => this.#onFoldingRanges(event));
		documents.listen(connection);
		connection.listen();
	}

	#onInitialize(params: InitializeParams): InitializeResult {
		this.#folders = params.workspaceFolders ?? null;
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
		const folders = this.#folders;
		if (this.#hasConfigCapability) connection.client.register(DidChangeConfigurationNotification.type, undefined);
		if (folders !== null) this.#services.initialize(folders);
	}

	#sendDiagnostics(document: TextDocument): void {
		const connection = this.#connection;
		const uri = document.uri;
		const diagnostics = this.#services.validation.validate(document);
		connection.sendDiagnostics({ uri, diagnostics });
	}

	#onCompletion(params: CompletionParams): CompletionItem[] {
		const document = this.#documents.get(params.textDocument.uri);
		if (document === undefined) return [];
		return this.#services.completion.getCompletions(document, params.position);
	}

	#onSignatureHelp(params: SignatureHelpParams): SignatureHelp | null {
		const document = this.#documents.get(params.textDocument.uri);
		if (document === undefined) return null;
		return this.#services.signature.getSignatureHelp(document, params.position);
	}

	#onHover(params: HoverParams): Hover | null {
		const document = this.#documents.get(params.textDocument.uri);
		if (document === undefined) return null;
		return this.#services.hover.getHover(document, params.position);
	}

	#onDocumentFormatting(params: DocumentFormattingParams): TextEdit[] {
		const document = this.#documents.get(params.textDocument.uri);
		if (document === undefined) return [];
		return this.#services.formatting.getEdits(document);
	}

	#onFoldingRanges(params: FoldingRangeParams): FoldingRange[] {
		const document = this.#documents.get(params.textDocument.uri);
		if (document === undefined) return [];
		return this.#services.folding.getRanges(document);
	}
}
//#endregion

void LanguageServer.launch();
