"use strict";

import { HOVER_CONTENT } from '../models/hover-data.js';

//#region Hover service
export class HoverService {
	getHoverContent(word: string): string | null {
		const hoverInfo = HOVER_CONTENT.get(word);
		return hoverInfo ? hoverInfo.documentation : null;
	}
}
//#endregion
