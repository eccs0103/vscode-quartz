"use strict";

import { CompletionItem, Position } from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { CompletionService } from "./completion-service.js";

//#region Completion provider
export class CompletionProvider {
	#completionService: CompletionService;

	constructor(completionService: CompletionService) {
		this.#completionService = completionService;
	}

	getItems(document: TextDocument, position: Position, triggerChar?: string): CompletionItem[] {
		return this.#completionService.getCompletions(document, position, triggerChar);
	}
}
//#endregion
