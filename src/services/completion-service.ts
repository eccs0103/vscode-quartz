"use strict";

import { CompletionItem } from 'vscode-languageserver/node';
import { ALL_COMPLETIONS } from '../models/completion-items.js';

//#region Completion service
export class CompletionService {
	getCompletions(): CompletionItem[] {
		return [...ALL_COMPLETIONS];
	}
}
//#endregion
