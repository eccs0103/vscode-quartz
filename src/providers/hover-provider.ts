"use strict";

import { TextDocument } from 'vscode-languageserver-textdocument';
import { Hover, MarkupKind, Position } from 'vscode-languageserver/node';
import { HoverService } from '../services/hover-service.js';
import { Lexer } from '../services/semantic/lexer.js';
import { Parser, Scope } from '../services/semantic/parser.js';

//#region Hover provider
export class HoverProvider {
	readonly #hoverService: HoverService;

	constructor(hoverService: HoverService) {
		this.#hoverService = hoverService;
	}

	private findInnermostScope(scope: Scope, line: number, col: number): Scope {
		for (const child of scope.children) {
			if (line >= child.range.startLine && line <= child.range.endLine) {
				return this.findInnermostScope(child, line, col);
			}
		}
		return scope;
	}

	provideHover(textDocument: TextDocument, position: Position): Hover | null {
		const text = textDocument.getText();
		const offset = textDocument.offsetAt(position);

		// Find word at position
		const wordPattern = /\b[A-Za-z_][A-Za-z0-9_]*\b/g;
		let match: RegExpExecArray | null;

		while ((match = wordPattern.exec(text))) {
			if (match.index <= offset && offset <= match.index + match[0].length) {
				const word = match[0];

				// Try to provide generic hover if not found in HOVER_CONTENT
				const hoverContent = this.#hoverService.getHoverContent(word);
				if (hoverContent) {
					return {
						contents: {
							kind: MarkupKind.Markdown,
							value: hoverContent
						}
					};
				}

				// If no static hover found, infer from document using semantic parser
				try {
					const lexer = new Lexer(text);
					const tokens = lexer.tokenize();
					const parser = new Parser(tokens);
					parser.parse();

					// Find the innermost scope at the cursor position
					const cursorLine = position.line;
					const cursorCol = position.character;
					const scope = this.findInnermostScope(parser.rootScope, cursorLine, cursorCol);

					// Resolve symbol
					const sym = scope.resolve(word);
					if (sym) {
						let detail = "";
						if (sym.kind === 'function') {
							detail = ["```quartz", `function ${sym.name}()`, "```", "---", sym.documentation || "User defined function."].join('\n');
						} else if (sym.kind === 'class') {
							detail = ["```quartz", `class ${sym.name}`, "```", "---", sym.documentation || "User defined class."].join('\n');
						} else {
							detail = ["```quartz", `${sym.name} ${sym.type || ''}`, "```", "---", sym.documentation || "Variable or identifier."].join('\n');
						}

						return {
							contents: {
								kind: MarkupKind.Markdown,
								value: detail
							}
						};
					}
				} catch (e) {
					// Fallback to basic if parsing fails
				}

				// Standard variable fallback if capitalized vs lowercase
				if (/^[A-Z]/.test(word)) {
					return {
						contents: {
							kind: MarkupKind.Markdown,
							value: ["```quartz", `class ${word}`, "```", "---", "Custom type or class."].join('\n')
						}
					};
				} else {
					return {
						contents: {
							kind: MarkupKind.Markdown,
							value: ["```quartz", `${word}`, "```", "---", "Variable or identifier."].join('\n')
						}
					};
				}
			}
		}

		return null;
	}
}
//#endregion
