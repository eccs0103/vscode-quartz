"use strict";

import { CompletionItem, CompletionItemKind, WorkspaceFolder } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { ALL_COMPLETIONS } from '../models/completion-items.js';
import * as fs from 'fs';
import * as path from 'path';

//#region Completion service
export class CompletionService {
	private dynamicCompletions: CompletionItem[] = [];

	public initialize(workspaceFolders: WorkspaceFolder[]) {
		for (const folder of workspaceFolders) {
			const uri = folder.uri;
			if (uri.startsWith('file://')) {
				const folderPath = new URL(uri).pathname;
				// On Windows, the pathname starts with a slash, e.g. /C:/path
				let parsedPath = decodeURIComponent(folderPath);
				if (process.platform === 'win32' && parsedPath.startsWith('/')) {
					parsedPath = parsedPath.slice(1);
				}

				const headerPath = path.join(parsedPath, 'runtime.header.qrz');
				if (fs.existsSync(headerPath)) {
					const content = fs.readFileSync(headerPath, 'utf-8');
					const parsed = this.parseDynamicCompletions(content, 'runtime.header');
					this.dynamicCompletions = this.dynamicCompletions.concat(parsed);
				}
			}
		}
	}

	private parseDynamicCompletions(text: string, context: string): CompletionItem[] {
		const items: CompletionItem[] = [];
		const added = new Set<string>();

		// Remove comments and strings to avoid false positives
		const cleanText = text
			.replace(/\/\*[\s\S]*?\*\//g, '') // block comments
			.replace(/\/\/.*/g, '')          // line comments
			.replace(/"[^"\\]*(?:\\.[^"\\]*)*"/g, '') // strings
			.replace(/'[^'\\]*(?:\\.[^'\\]*)*'/g, ''); // single quotes

		// Extract variables (assuming type identifier value form)
		const varPattern = /\b([a-z_][a-zA-Z0-9_]*)\s+[A-Z][a-zA-Z0-9_]*\b/g;
		let match;
		while ((match = varPattern.exec(cleanText)) !== null) {
			const varName = match[1];
			// skip known keywords
			if (["if", "else", "while", "for", "true", "false", "function", "return", "class", "namespace", "to", "as", "is"].includes(varName) || added.has(varName)) continue;

			items.push({
				label: varName,
				kind: CompletionItemKind.Variable,
				detail: `Variable from ${context}`
			});
			added.add(varName);
		}

		// Extract functions (function name(args))
		const funcPattern = /\bfunction\s+([a-zA-Z_][a-zA-Z0-9_]*)/g;
		while ((match = funcPattern.exec(cleanText)) !== null) {
			const funcName = match[1];
			if (added.has(funcName)) continue;

			items.push({
				label: funcName,
				kind: CompletionItemKind.Function,
				detail: `Function from ${context}`
			});
			added.add(funcName);
		}

		// Extract classes or types (capitalized word at start or after class)
		const typePattern = /\bclass\s+([A-Z][a-zA-Z0-9_]*)/g;
		while ((match = typePattern.exec(cleanText)) !== null) {
			const typeName = match[1];
			if (added.has(typeName)) continue;

			items.push({
				label: typeName,
				kind: CompletionItemKind.Class,
				detail: `Class from ${context}`
			});
			added.add(typeName);
		}

		return items;
	}

	getCompletions(document: TextDocument): CompletionItem[] {
		// Document-specific dynamic completions
		const text = document.getText();
		const docCompletions = this.parseDynamicCompletions(text, 'current document');

		return [
			...ALL_COMPLETIONS,
			...this.dynamicCompletions,
			...docCompletions
		];
	}
}
//#endregion
