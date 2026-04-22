"use strict";

import { TextDocument } from "vscode-languageserver-textdocument";
import { FoldingRange, FoldingRangeKind } from "vscode-languageserver/node";

//#region Folding provider
export class FoldingProvider {
	getRanges(document: TextDocument): FoldingRange[] {
		const ranges: FoldingRange[] = [];
		const lines = document.getText().split(/\r?\n/);

		const stack: number[] = [];

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			const trimmed = line.trim();

			if (trimmed.length === 0) continue;

			if (trimmed.startsWith("//") && trimmed.includes("#region")) {
				stack.push(i);
				continue;
			}

			if (trimmed.startsWith("//") && trimmed.includes("#endregion")) {
				const startLine = stack.pop();
				if (startLine !== undefined) {
					ranges.push({ startLine, endLine: i, kind: FoldingRangeKind.Region });
				}
				continue;
			}

			if (line.includes("{")) {
				stack.push(i);
				continue;
			}

			if (line.includes("}") && stack.length > 0) {
				const startLine = stack.pop();
				if (startLine !== undefined) {
					ranges.push({ startLine, endLine: i, kind: FoldingRangeKind.Region });
				}
			}
		}

		return ranges;
	}
}
//#endregion
