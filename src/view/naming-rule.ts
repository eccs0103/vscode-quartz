"use strict";

import "adaptive-extender/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver/node.js";
import { LanguageKeywords } from "../models/language-keywords.js";
import { NamingConventions } from "../models/naming-conventions.js";
import { DiagnosticRule } from "../models/diagnostic-rule.js";

//#region Naming rule
export class NamingRule implements DiagnosticRule {
	static #patternIdentifier: RegExp = /\b([A-Za-z_][A-Za-z0-9_]*)\b/g;
	static #patternLeadingUpper: RegExp = /^[A-Z]/;

	diagnose(document: TextDocument): Diagnostic[] {
		const text = document.getText();
		const diagnostics: Diagnostic[] = [];
		const pattern = NamingRule.#patternIdentifier;
		pattern.lastIndex = 0;
		let match: RegExpExecArray | null;

		while ((match = pattern.exec(text)) !== null) {
			const identifier = match[1];
			const offset = match.index;
			if (LanguageKeywords.has(identifier)) continue;

			const isUpper = NamingRule.#patternLeadingUpper.test(identifier);
			const isInvalid = isUpper ? !NamingConventions.isPascalCase(identifier) : !NamingConventions.isSnakeCase(identifier);
			if (!isInvalid) continue;

			const message = isUpper
				? `Type "${identifier}" must be in PascalCase (e.g. ${NamingConventions.toPascalCase(identifier)})`
				: `Variable "${identifier}" must be in snake_case (e.g. ${NamingConventions.toSnakeCase(identifier)})`;
			const start = document.positionAt(offset);
			const end = document.positionAt(offset + identifier.length);
			diagnostics.push({ severity: DiagnosticSeverity.Warning, range: { start, end }, message, source: "quartz-naming" });
		}

		return diagnostics;
	}
}
//#endregion
