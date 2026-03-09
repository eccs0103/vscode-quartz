"use strict";

import { CompletionItem } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { CompletionService } from '../services/completion-service.js';

//#region Completion provider
export class CompletionProvider {
	readonly #completionService: CompletionService;

	constructor(completionService: CompletionService) {
		this.#completionService = completionService;
	}

	provideCompletion(document: TextDocument): CompletionItem[] {
		return this.#completionService.getCompletions(document);
	}
}
//#endregion
