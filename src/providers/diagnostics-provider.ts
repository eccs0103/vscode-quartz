"use strict";

import { TextDocument } from 'vscode-languageserver-textdocument';
import { Diagnostic } from 'vscode-languageserver/node';
import { ValidationService } from '../services/validation-service.js';

//#region Diagnostics provider
export class DiagnosticsProvider {
	readonly #validationService: ValidationService;

	constructor(validationService: ValidationService) {
		this.#validationService = validationService;
	}

	provideDiagnostics(textDocument: TextDocument): Diagnostic[] {
		return this.#validationService.validateDocument(textDocument);
	}
}
//#endregion
