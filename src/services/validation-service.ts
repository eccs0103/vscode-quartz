"use strict";

import { TextDocument } from 'vscode-languageserver-textdocument';
import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/node';
import { KEYWORDS } from '../models/language-keywords.js';
import { isPascalCase, isSnakeCase, toPascalCase, toSnakeCase } from '../models/naming-conventions.js';

//#region Validation service
export class ValidationService {
	validateDocument(textDocument: TextDocument): Diagnostic[] {
		const text = textDocument.getText();
		const diagnostics: Diagnostic[] = [];

		const identifierRegex = /\b([A-Za-z_][A-Za-z0-9_]*)\b/g;

		let match: RegExpExecArray | null;

		while ((match = identifierRegex.exec(text))) {
			const identifier = match[1];
			const position = match.index;

			if (this.#isKeyword(identifier)) {
				continue;
			}

			const startsWithUppercase = /^[A-Z]/.test(identifier);

			if (startsWithUppercase) {
				if (!isPascalCase(identifier)) {
					const diagnostic: Diagnostic = {
						severity: DiagnosticSeverity.Warning,
						range: {
							start: textDocument.positionAt(position),
							end: textDocument.positionAt(position + identifier.length)
						},
						message: `Тип "${identifier}" должен быть в PascalCase (например: ${toPascalCase(identifier)})`,
						source: 'quartz-naming'
					};
					diagnostics.push(diagnostic);
				}
			} else {
				if (!isSnakeCase(identifier)) {
					const diagnostic: Diagnostic = {
						severity: DiagnosticSeverity.Warning,
						range: {
							start: textDocument.positionAt(position),
							end: textDocument.positionAt(position + identifier.length)
						},
						message: `Переменная "${identifier}" должна быть в snake_case (например: ${toSnakeCase(identifier)})`,
						source: 'quartz-naming'
					};
					diagnostics.push(diagnostic);
				}
			}
		}

		return diagnostics;
	}

	#isKeyword(name: string): boolean {
		return KEYWORDS.has(name);
	}
}
//#endregion
