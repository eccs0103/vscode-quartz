import {
	createConnection,
	TextDocuments,
	Diagnostic,
	DiagnosticSeverity,
	ProposedFeatures,
	InitializeParams,
	DidChangeConfigurationNotification,
	TextDocumentSyncKind,
	InitializeResult
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';

// Create a connection for the server
const connection = createConnection(ProposedFeatures.all);

// Create a document manager
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;

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
			textDocumentSync: TextDocumentSyncKind.Incremental
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

// Regular expressions for naming conventions
const PASCAL_CASE_REGEX = /^[A-Z][a-zA-Z0-9]*$/;
const SNAKE_CASE_REGEX = /^[a-z_][a-z0-9_]*$/;

// Keywords that should be ignored
const KEYWORDS = new Set([
	'if', 'else', 'while', 'repeat', 'for', 'in', 'break', 'continue',
	'return', 'use', 'from', 'this', 'true', 'false'
]);

function isPascalCase(name: string): boolean {
	return PASCAL_CASE_REGEX.test(name);
}

function isSnakeCase(name: string): boolean {
	return SNAKE_CASE_REGEX.test(name);
}

function isKeyword(name: string): boolean {
	return KEYWORDS.has(name);
}

function validateDocument(textDocument: TextDocument): void {
	const text = textDocument.getText();
	const diagnostics: Diagnostic[] = [];

	// Regular expression to find all identifiers
	// Match types (start with uppercase) and variables (start with lowercase/underscore)
	const identifierRegex = /\b([A-Za-z_][A-Za-z0-9_]*)\b/g;

	let match: RegExpExecArray | null;

	while ((match = identifierRegex.exec(text))) {
		const identifier = match[1];
		const position = match.index;

		// Skip keywords
		if (isKeyword(identifier)) {
			continue;
		}

		// Check if identifier starts with uppercase (type)
		const startsWithUppercase = /^[A-Z]/.test(identifier);

		if (startsWithUppercase) {
			// This should be a type - must be PascalCase
			if (!isPascalCase(identifier)) {
				const diagnostic: Diagnostic = {
					severity: DiagnosticSeverity.Warning,
					range: {
						start: textDocument.positionAt(position),
						end: textDocument.positionAt(position + identifier.length)
					},
					message: `Тип "${identifier}" должен быть в PascalCase (например: ${toPascalCase(identifier)})`,
					source: 'quartz-naming'
				};
				diagnostics.push(diagnostic);
			}
		} else {
			// This should be a variable/function - must be snake_case
			if (!isSnakeCase(identifier)) {
				const diagnostic: Diagnostic = {
					severity: DiagnosticSeverity.Warning,
					range: {
						start: textDocument.positionAt(position),
						end: textDocument.positionAt(position + identifier.length)
					},
					message: `Переменная "${identifier}" должна быть в snake_case (например: ${toSnakeCase(identifier)})`,
					source: 'quartz-naming'
				};
				diagnostics.push(diagnostic);
			}
		}
	}

	// Send the computed diagnostics to VS Code
	connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

function toPascalCase(str: string): string {
	return str
		.split(/[_\s]+/)
		.map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
		.join('');
}

function toSnakeCase(str: string): string {
	return str
		.replace(/([A-Z])/g, '_$1')
		.toLowerCase()
		.replace(/^_/, '')
		.replace(/[_\s]+/g, '_');
}

// Validate document on open
documents.onDidOpen((e) => {
	validateDocument(e.document);
});

// Validate document on change
documents.onDidChangeContent((change) => {
	validateDocument(change.document);
});

// Listen on the connection
documents.listen(connection);
connection.listen();
