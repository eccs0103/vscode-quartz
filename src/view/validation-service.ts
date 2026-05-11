"use strict";

import "adaptive-extender/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { Diagnostic } from "vscode-languageserver/node.js";
import { DiagnosticRule } from "../models/diagnostic-rule.js";
import { NamingRule } from "./naming-rule.js";

//#region Validation service
export class ValidationService {
	#rules: DiagnosticRule[] = [new NamingRule()];

	validate(document: TextDocument): Diagnostic[] {
		return this.#rules.flatMap(rule => rule.diagnose(document));
	}
}
//#endregion
