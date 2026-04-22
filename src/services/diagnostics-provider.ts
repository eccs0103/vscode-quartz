"use strict";

import { TextDocument } from "vscode-languageserver-textdocument";
import { Diagnostic } from "vscode-languageserver/node";
import { ValidationService } from "./validation-service.js";

//#region Diagnostics provider
export class DiagnosticsProvider {
	#validationService: ValidationService;

	constructor(validationService: ValidationService) {
		this.#validationService = validationService;
	}

	getDiagnostics(textDocument: TextDocument): Diagnostic[] {
		return this.#validationService.validate(textDocument);
	}
}
//#endregion
