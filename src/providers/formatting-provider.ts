"use strict";

import { TextDocument } from 'vscode-languageserver-textdocument';
import { TextEdit, Range, Position } from 'vscode-languageserver/node';
import { FormattingService } from '../services/formatting-service.js';

//#region Formatting provider
export class FormattingProvider {
	readonly #formattingService: FormattingService;

	constructor(formattingService: FormattingService) {
		this.#formattingService = formattingService;
	}

	provideFormatting(textDocument: TextDocument): TextEdit[] {
		const text = textDocument.getText();
		const formatted = this.#formattingService.formatCode(text);
		
		if (formatted === text) {
			return [];
		}

		const lastLine = textDocument.lineCount - 1;
		const lastChar = textDocument.getText({
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
	}
}
//#endregion
