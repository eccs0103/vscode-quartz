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
				const hoverContent = this.#hoverService.getHoverContent(word);
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
	}
}
//#endregion
