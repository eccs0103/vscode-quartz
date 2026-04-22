"use strict";

import { TextDocument } from "vscode-languageserver-textdocument";
import { Hover, Position } from "vscode-languageserver/node";
import { HoverService } from "./hover-service.js";

//#region Hover provider
export class HoverProvider {
	#hoverService: HoverService;

	constructor(hoverService: HoverService) {
		this.#hoverService = hoverService;
	}

	getHover(document: TextDocument, position: Position): Hover | null {
		return this.#hoverService.getHover(document, position);
	}
}
//#endregion
