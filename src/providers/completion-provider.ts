"use strict";

import { CompletionItem, Position } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { CompletionService } from '../services/completion-service.js';

//#region Completion provider
export class CompletionProvider {
	readonly #completionService: CompletionService;

	constructor(completionService: CompletionService) {
		this.#completionService = completionService;
	}

	provideCompletion(document: TextDocument, position: Position, triggerChar?: string): CompletionItem[] {
		return this.#completionService.getCompletions(document, position, triggerChar);
	}
}
//#endregion
