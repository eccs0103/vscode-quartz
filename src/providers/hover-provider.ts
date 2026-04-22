"use strict";

import { TextDocument } from 'vscode-languageserver-textdocument';
import { Hover, Position } from 'vscode-languageserver/node';
import { HoverService } from '../services/hover-service.js';

//#region Hover provider
export class HoverProvider {
	readonly #hoverService: HoverService;

	constructor(hoverService: HoverService) {
		this.#hoverService = hoverService;
	}

	provideHover(document: TextDocument, position: Position): Hover | null {
		return this.#hoverService.getHover(document, position);
	}
}
//#endregion
