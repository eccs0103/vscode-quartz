"use strict";

import { TextDocument } from "vscode-languageserver-textdocument";
import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver/node";
import { LanguageKeywords } from "../models/language-keywords.js";
import { NamingConventions } from "../models/naming-conventions.js";

//#region Validation service
export class ValidationService {
	validate(textDocument: TextDocument): Diagnostic[] {
		const text = textDocument.getText();
		const diagnostics: Diagnostic[] = [];
		const identifierRegex = /\b([A-Za-z_][A-Za-z0-9_]*)\b/g;
		let match: RegExpExecArray | null;

		while ((match = identifierRegex.exec(text)) !== null) {
			const identifier = match[1];
			const offset = match.index;

			if (LanguageKeywords.has(identifier)) continue;

			const isUpper = /^[A-Z]/.test(identifier);
			const isInvalid = isUpper ? !NamingConventions.isPascalCase(identifier) : !NamingConventions.isSnakeCase(identifier);
			if (!isInvalid) continue;

			const message = isUpper
				? `Type "${identifier}" must be in PascalCase (e.g. ${NamingConventions.toPascalCase(identifier)})`
				: `Variable "${identifier}" must be in snake_case (e.g. ${NamingConventions.toSnakeCase(identifier)})`;
			const start = textDocument.positionAt(offset);
			const end = textDocument.positionAt(offset + identifier.length);
			const range = { start, end };
			diagnostics.push({ severity: DiagnosticSeverity.Warning, range, message, source: "quartz-naming" });
		}

		return diagnostics;
	}
}
//#endregion
