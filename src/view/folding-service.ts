"use strict";

import "adaptive-extender/core";
import { TextDocument } from "vscode-languageserver-textdocument";
import { FoldingRange, FoldingRangeKind } from "vscode-languageserver-types";

//#region Folding service
export class FoldingService {
	static #newline: RegExp = /\r?\n/;

	getRanges(document: TextDocument): FoldingRange[] {
		const ranges: FoldingRange[] = [];
		const lines = document.getText().split(FoldingService.#newline);
		const stack: number[] = [];

		for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
			const line = lines[lineIndex];
			const trimmed = line.trim();

			if (String.isEmpty(trimmed)) continue;

			if (trimmed.startsWith("//") && trimmed.includes("#region")) {
				stack.push(lineIndex);
				continue;
			}

			if (trimmed.startsWith("//") && trimmed.includes("#endregion")) {
				const startLine = stack.pop();
				if (startLine !== undefined) ranges.push({ startLine, endLine: lineIndex, kind: FoldingRangeKind.Region });
				continue;
			}

			if (line.includes("{")) {
				stack.push(lineIndex);
				continue;
			}

			if (line.includes("}") && stack.length > 0) {
				const startLine = stack.pop();
				if (startLine !== undefined) ranges.push({ startLine, endLine: lineIndex, kind: FoldingRangeKind.Region });
			}
		}

		return ranges;
	}
}
//#endregion
