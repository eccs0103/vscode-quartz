"use strict";

import { TextDocument } from 'vscode-languageserver-textdocument';
import { Hover, MarkupKind, Position } from 'vscode-languageserver/node';
import { HoverService } from '../services/hover-service.js';

//#region Hover provider
export class HoverProvider {
	readonly #hoverService: HoverService;

	constructor(hoverService: HoverService) {
		this.#hoverService = hoverService;
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

				// If no static hover found, infer from document text simple declarations
				const documentText = textDocument.getText();
				
				// Very basic regex to see if it's a function declaration
				const funcRegex = new RegExp(`function\\s+${word}\\s*\\([^)]*\\)`, 'g');
				const funcMatch = funcRegex.exec(documentText);
				if (funcMatch) {
					return {
						contents: {
							kind: MarkupKind.Markdown,
							value: ["```quartz", funcMatch[0], "```", "---", "User defined function."].join('\\n')
						}
					};
				}

				// Basic check for variable/type
				const varRegex = new RegExp(`\\\\b${word}\\\\s+([A-Z][a-zA-Z0-9_]*)\\\\b`, 'g');
				const varMatch = varRegex.exec(documentText);
				if (varMatch) {
					return {
						contents: {
							kind: MarkupKind.Markdown,
							value: ["```quartz", `${word} ${varMatch[1]}`, "```", "---", `Variable of type \`${varMatch[1]}\`.`].join('\\n')
						}
					};
				}
				
				// Standard variable fallback if capitalized vs lowercase
				if (/^[A-Z]/.test(word)) {
					return {
						contents: {
							kind: MarkupKind.Markdown,
							value: ["```quartz", `class ${word}`, "```", "---", "Custom type or class."].join('\\n')
						}
					};
				} else {
					return {
						contents: {
							kind: MarkupKind.Markdown,
							value: ["```quartz", `${word}`, "```", "---", "Variable or identifier."].join('\\n')
						}
					};
				}
			}
		}
		
		return null;
	}
}
//#endregion
