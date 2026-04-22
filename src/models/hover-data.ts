"use strict";

//#region Hover data
export const HOVER_CONTENT: ReadonlyMap<string, string> = new Map([
	["if", "```quartz\nif (condition) { ... }\n```\n---\nConditional statement."],
	["else", "```quartz\nelse { ... }\n```\n---\nAlternative branch for an `if` statement."],
	["while", "```quartz\nwhile (condition) { ... }\n```\n---\nLoop statement that executes while the condition is true."],
	["for", "```quartz\nfor (item Type in collection) { ... }\n```\n---\nLoop statement that iterates over a collection."],
	["in", "```quartz\nin\n```\n---\nKeyword used in `for` loops to specify the collection."],
	["break", "```quartz\nbreak;\n```\n---\nExits from the current loop."],
	["continue", "```quartz\ncontinue;\n```\n---\nSkips the rest of the current loop iteration and moves to the next one."],
	["true", "```quartz\ntrue\n```\n---\nBoolean true value."],
	["false", "```quartz\nfalse\n```\n---\nBoolean false value."],
	["null", "```quartz\nnull\n```\n---\nRepresents the intentional absence of any value."],
]);
//#endregion
