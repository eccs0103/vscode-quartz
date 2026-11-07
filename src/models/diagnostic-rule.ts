"use strict";

import "adaptive-extender/core";
import { TextDocument } from "vscode-languageserver-textdocument";
import { Diagnostic } from "vscode-languageserver-types";

//#region Diagnostic rule
export interface DiagnosticRule {
	diagnose(document: TextDocument): Diagnostic[];
}
//#endregion
