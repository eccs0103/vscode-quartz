"use strict";

import { CompletionItem, CompletionItemKind, WorkspaceFolder } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { ALL_COMPLETIONS } from '../models/completion-items.js';
import * as fs from 'fs';
import * as path from 'path';
import { Lexer } from './semantic/lexer.js';
import { Parser, Scope } from './semantic/parser.js';

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

private extractSymbolsFromScope(scope: Scope, items: CompletionItem[], added: Set<string>, context: string) {
                for (const [name, sym] of scope.symbols.entries()) {
                        if (added.has(name)) continue;

                        let kind: CompletionItemKind = CompletionItemKind.Variable;
                        if (sym.kind === 'function') kind = CompletionItemKind.Function;
                        else if (sym.kind === 'class') kind = CompletionItemKind.Class;

                        items.push({
                                label: name,
                                kind: kind,
                                detail: sym.documentation ? `[${context}] ${sym.documentation}` : `[${context}] ${sym.kind}`
                        });
                        added.add(name);
                }

                for (const child of scope.children) {
                        this.extractSymbolsFromScope(child, items, added, context);
                }
        }

        private parseDynamicCompletions(text: string, context: string): CompletionItem[] {
                const items: CompletionItem[] = [];
                const added = new Set<string>();

                try {
                        const lexer = new Lexer(text);
                        const tokens = lexer.tokenize();
                        const parser = new Parser(tokens);
                        parser.parse();

                        this.extractSymbolsFromScope(parser.rootScope, items, added, context);
                } catch (e) {
                        // ignore parsing error
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
