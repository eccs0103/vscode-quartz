"use strict";

import "adaptive-extender/core";
import { TextDocument } from "vscode-languageserver-textdocument";
import { Diagnostic } from "vscode-languageserver-types";
import { type DiagnosticRule } from "../models/diagnostic-rule.js";
import { NamingRule } from "./naming-rule.js";

//#region Validation service
export class ValidationService {
	#rules: DiagnosticRule[] = [new NamingRule()];

	validate(document: TextDocument): Diagnostic[] {
		return this.#rules.flatMap(rule => rule.diagnose(document));
	}
}
//#endregion
