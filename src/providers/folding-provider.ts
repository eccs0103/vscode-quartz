"use strict";

import { TextDocument } from 'vscode-languageserver-textdocument';
import { FoldingRange, FoldingRangeKind } from 'vscode-languageserver/node';

export class FoldingProvider {
	provideFoldingRanges(document: TextDocument): FoldingRange[] {
		const ranges: FoldingRange[] = [];
		const text = document.getText();
		const lines = text.split(/\r?\n/);

		const stack: number[] = [];
		// Keep track of the opening brace characters if available
		const startChars: number[] = [];

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			const trimmed = line.trim();

			// Skip empty lines
			if (trimmed.length === 0) continue;

			// If we see an opening brace
			let openIndex = line.indexOf('{');
			if (openIndex !== -1) {
				// We want to hide the opening brace. So start folding exactly at the brace index!
				stack.push(i);
				startChars.push(openIndex);
			} else if (/^(function|class|if|else|while|for)\b/.test(trimmed)) {
				// Sometimes the '{' is on the next line. We can start fold at the end of the header
				stack.push(i);
				startChars.push(line.length);
			}

			// If we see a closing brace
			let closeIndex = line.indexOf('}');
			if (closeIndex !== -1 && stack.length > 0) {
				const startLine = stack.pop();
				const startChar = startChars.pop();
				
				if (startLine !== undefined) {
					// We want to fold UP TO the closing brace inclusive to hide it!
					// Or at least try to format it so it collapses both braces
					ranges.push({
						startLine: startLine,
						startCharacter: startChar,
						endLine: i,
						endCharacter: closeIndex + 1,
						kind: FoldingRangeKind.Region
					});
				}
			}

			// Also support #region / #endregion
			if (trimmed.startsWith('//') && trimmed.includes('#region')) {
				stack.push(i);
				startChars.push(line.indexOf('#region') + 7);
			} else if (trimmed.startsWith('//') && trimmed.includes('#endregion')) {
				const startLine = stack.pop();
				const startChar = startChars.pop();
				if (startLine !== undefined) {
					ranges.push({
						startLine: startLine,
						startCharacter: startChar,
						endLine: i,
						kind: FoldingRangeKind.Region
					});
				}
			}
		}

		return ranges;
	}
}
