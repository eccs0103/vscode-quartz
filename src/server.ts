import {
	createConnection,
	TextDocuments,
	Diagnostic,
	DiagnosticSeverity,
	ProposedFeatures,
	InitializeParams,
	DidChangeConfigurationNotification,
	CompletionItem,
	CompletionItemKind,
	TextDocumentSyncKind,
	InitializeResult,
	DocumentFormattingParams,
	TextEdit,
	Range,
	Position,
	Hover,
	MarkupKind
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

// Completion Provider
connection.onCompletion((_textDocumentPosition) => {
	const completions: CompletionItem[] = [
		// Keywords
		{ label: 'if', kind: CompletionItemKind.Keyword, detail: 'If statement' },
		{ label: 'else', kind: CompletionItemKind.Keyword, detail: 'Else branch' },
		{ label: 'while', kind: CompletionItemKind.Keyword, detail: 'While loop' },
		{ label: 'break', kind: CompletionItemKind.Keyword, detail: 'Break statement' },
		{ label: 'continue', kind: CompletionItemKind.Keyword, detail: 'Continue statement' },
		
		// Built-in types
		{ label: 'Number', kind: CompletionItemKind.Class, detail: 'Number type' },
		{ label: 'String', kind: CompletionItemKind.Class, detail: 'String type' },
		{ label: 'Boolean', kind: CompletionItemKind.Class, detail: 'Boolean type' },
		{ label: 'Any', kind: CompletionItemKind.Class, detail: 'Any type (polymorphic)' },
		
		// Constants
		{ label: 'true', kind: CompletionItemKind.Value, detail: 'Boolean true' },
		{ label: 'false', kind: CompletionItemKind.Value, detail: 'Boolean false' },
		{ label: 'null', kind: CompletionItemKind.Value, detail: 'Null value' },
		
		// Built-in functions
		{ label: 'write', kind: CompletionItemKind.Function, detail: 'Write output to console', insertText: 'write(${1:value});' }
	];
	return completions;
});

// Hover Provider
connection.onHover((params) => {
	const document = documents.get(params.textDocument.uri);
	if (!document) {
		return null;
	}

	const text = document.getText();
	const offset = document.offsetAt(params.position);
	
	// Find word at position
	const wordPattern = /\b[A-Za-z_][A-Za-z0-9_]*\b/g;
	let match: RegExpExecArray | null;
	
	while ((match = wordPattern.exec(text))) {
		if (match.index <= offset && offset <= match.index + match[0].length) {
			const word = match[0];
			const hoverContent = getHoverContent(word);
			if (hoverContent) {
				return {
					contents: {
						kind: MarkupKind.Markdown,
						value: hoverContent
					}
				};
			}
		}
	}
	
	return null;
});

function getHoverContent(word: string): string | null {
	const keywords: Record<string, string> = {
		'if': '`if` - Conditional statement\n\nSyntax: `if (condition) { ... }`',
		'else': '`else` - Alternative branch\n\nSyntax: `if (condition) { ... } else { ... }`',
		'while': '`while` - Loop statement\n\nSyntax: `while (condition) { ... }`',
		'break': '`break` - Exit from loop',
		'continue': '`continue` - Skip to next iteration',
		'Number': '`Number` - Numeric type\n\nExample: `value Number(42);`',
		'String': '`String` - String type\n\nExample: `text String("hello");`',
		'Boolean': '`Boolean` - Boolean type\n\nExample: `flag Boolean(true);`',
		'Any': '`Any` - Polymorphic type\n\nCan hold any value type.',
		'true': '`true` - Boolean true value',
		'false': '`false` - Boolean false value',
		'null': '`null` - Null value',
		'write': '`write(value)` - Output function\n\nWrites value to console.'
	};
	
	return keywords[word] || null;
}

// Document Formatting Provider
connection.onDocumentFormatting((params: DocumentFormattingParams): TextEdit[] => {
	const document = documents.get(params.textDocument.uri);
	if (!document) {
		return [];
	}

	const text = document.getText();
	const formatted = formatQuartzCode(text);
	
	if (formatted === text) {
		return [];
	}

	const lastLine = document.lineCount - 1;
	const lastChar = document.getText({
		start: { line: lastLine, character: 0 },
		end: { line: lastLine, character: Number.MAX_VALUE }
	}).length;

	return [
		TextEdit.replace(
			Range.create(
				Position.create(0, 0),
				Position.create(lastLine, lastChar)
			),
			formatted
		)
	];
});

function formatQuartzCode(code: string): string {
	const lines = code.split('\n');
	const formatted: string[] = [];
	let indentLevel = 0;
	const indentChar = '\t';

	for (let i = 0; i < lines.length; i++) {
		let line = lines[i].trim();
		
		// Skip empty lines but preserve them
		if (line.length === 0) {
			formatted.push('');
			continue;
		}

		// Skip formatting for comments
		const isComment = line.startsWith('//') || line.startsWith('/*') || line.startsWith('*');

		// Decrease indent for closing braces
		if (line.startsWith('}')) {
			indentLevel = Math.max(0, indentLevel - 1);
		}

		// Add indentation
		const indentedLine = indentChar.repeat(indentLevel) + line;
		formatted.push(indentedLine);

		// Increase indent after opening braces
		if (line.endsWith('{') && !isComment) {
			indentLevel++;
		} else if (line.includes('{') && !line.includes('}') && !isComment) {
			indentLevel++;
		}
		
		// Handle closing brace on same line
		if (line.includes('}') && line.includes('{')) {
			// Handle } else { pattern
			const openCount = (line.match(/\{/g) || []).length;
			const closeCount = (line.match(/\}/g) || []).length;
			if (closeCount > openCount) {
				indentLevel = Math.max(0, indentLevel - (closeCount - openCount));
			}
		}
	}

	let result = formatted.join('\n');
	
	// Formatting improvements (avoiding strings and comments)
	const formattedLines = result.split('\n').map(line => {
		// Don't format comment lines
		const trimmed = line.trim();
		if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
			return line;
		}

		let formatted = line;
		
		// Add space after keywords before (
		formatted = formatted.replace(/\b(if|else|while|for|in)\(/g, '$1 (');
		
		// Add space after commas
		formatted = formatted.replace(/,([^\s])/g, ', $1');
		
		// Add space around operators (excluding strings)
		// This is a simplified approach - a full implementation would need proper parsing
		const indent = line.match(/^\s*/)?.[0] || '';
		const content = line.trim();
		
		// Split by strings to avoid formatting inside them
		const parts: string[] = [];
		let inString = false;
		let current = '';
		
		for (let i = 0; i < content.length; i++) {
			const char = content[i];
			if (char === '"' && (i === 0 || content[i-1] !== '\\')) {
				inString = !inString;
				current += char;
			} else if (!inString && /[:+\-*/<>=!&|]/.test(char)) {
				// Check if we need spaces around this operator
				const prev = current[current.length - 1];
				const next = content[i + 1];
				
				if (prev && prev !== ' ' && /[a-zA-Z0-9_)]/.test(prev)) {
					current += ' ';
				}
				current += char;
				if (next && next !== ' ' && next !== '=' && /[a-zA-Z0-9_("]/.test(next)) {
					current += ' ';
				}
			} else {
				current += char;
			}
		}
		
		formatted = indent + current.replace(/\s+/g, ' ').replace(/\s+([;,)])/g, '$1');
		
		return formatted;
	});
	
	return formattedLines.join('\n');
}

documents.listen(connection);
connection.listen();
