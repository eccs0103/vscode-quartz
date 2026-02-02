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

const connection = createConnection(ProposedFeatures.all);
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

const PASCAL_CASE_REGEX = /^[A-Z][a-zA-Z0-9]*$/;
const SNAKE_CASE_REGEX = /^[a-z_][a-z0-9_]*$/;

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

	const identifierRegex = /\b([A-Za-z_][A-Za-z0-9_]*)\b/g;

	let match: RegExpExecArray | null;

	while ((match = identifierRegex.exec(text))) {
		const identifier = match[1];
		const position = match.index;

		if (isKeyword(identifier)) {
			continue;
		}

		const startsWithUppercase = /^[A-Z]/.test(identifier);

		if (startsWithUppercase) {
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

documents.onDidOpen((e) => {
	validateDocument(e.document);
});

documents.onDidChangeContent((change) => {
	validateDocument(change.document);
});

documents.listen(connection);
connection.listen();
