"use strict";

import "adaptive-extender/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { Diagnostic } from "vscode-languageserver/node.js";

//#region Diagnostic rule
export interface DiagnosticRule {
	diagnose(document: TextDocument): Diagnostic[];
}
//#endregion
