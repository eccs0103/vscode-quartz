"use strict";

import { CompletionItem } from 'vscode-languageserver/node';
import { CompletionService } from '../services/completion-service.js';

//#region Completion provider
export class CompletionProvider {
	readonly #completionService: CompletionService;

	constructor(completionService: CompletionService) {
		this.#completionService = completionService;
	}

	provideCompletion(): CompletionItem[] {
		return this.#completionService.getCompletions();
	}
}
//#endregion
