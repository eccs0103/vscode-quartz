"use strict";

//#region Hover data
export interface HoverInfo {
	readonly keyword: string;
	readonly documentation: string;
}

export const HOVER_CONTENT: ReadonlyMap<string, HoverInfo> = new Map([
	['if', {
		keyword: 'if',
		documentation: '```quartz\nif (condition) { ... }\n```\n---\nConditional statement.'
	}],
	['else', {
		keyword: 'else',
		documentation: '```quartz\nelse { ... }\n```\n---\nAlternative branch for an `if` statement.'
	}],
	['while', {
		keyword: 'while',
		documentation: '```quartz\nwhile (condition) { ... }\n```\n---\nLoop statement that executes while the condition is true.'
	}],
	['for', {
		keyword: 'for',
		documentation: '```quartz\nfor (item Type in collection) { ... }\n```\n---\nLoop statement that iterates over a collection.'
	}],
	['in', {
		keyword: 'in',
		documentation: '```quartz\nin\n```\n---\nKeyword used in `for` loops to specify the collection.'
	}],
	['break', {
		keyword: 'break',
		documentation: '```quartz\nbreak;\n```\n---\nExits from the current loop.'
	}],
	['continue', {
		keyword: 'continue',
		documentation: '```quartz\ncontinue;\n```\n---\nSkips the rest of the current loop iteration and moves to the next one.'
	}],
	['Number', {
		keyword: 'Number',
		documentation: '```quartz\nNumber\n```\n---\nNumeric type. Can hold integer and floating-point values.\n\n*Example:*\n```quartz\nvalue Number(42);\n```'
	}],
	['String', {
		keyword: 'String',
		documentation: '```quartz\nString\n```\n---\nString type. Represents a sequence of characters.\n\n*Example:*\n```quartz\ntext String("hello");\n```'
	}],
	['Boolean', {
		keyword: 'Boolean',
		documentation: '```quartz\nBoolean\n```\n---\nBoolean type. Can be `true` or `false`.\n\n*Example:*\n```quartz\nflag Boolean(true);\n```'
	}],
	['Any', {
		keyword: 'Any',
		documentation: '```quartz\nAny\n```\n---\nPolymorphic type that can hold any value.'
	}],
	['Character', {
		keyword: 'Character',
		documentation: '```quartz\nCharacter\n```\n---\nCharacter type. Represents a single character.\n\n*Example:*\n```quartz\nchar Character(\'a\');\n```'
	}],
	['Sequence', {
		keyword: 'Sequence',
		documentation: '```quartz\nSequence<T>\n```\n---\nSequence type representing an array or list of elements of type `T`.\n\n*Example:*\n```quartz\nseq Sequence<Number>(range(5));\n```'
	}],
	['true', {
		keyword: 'true',
		documentation: '```quartz\ntrue\n```\n---\nBoolean true value.'
	}],
	['false', {
		keyword: 'false',
		documentation: '```quartz\nfalse\n```\n---\nBoolean false value.'
	}],
	['null', {
		keyword: 'null',
		documentation: '```quartz\nnull\n```\n---\nRepresents the intentional absence of any value.'
	}],
	['write', {
		keyword: 'write',
		documentation: '```quartz\nfunction write(value: Any)\n```\n---\nOutput function.\n\nWrites the given value to the console.'
	}],
	['read', {
		keyword: 'read',
		documentation: '```quartz\nfunction read(message: String): String\n```\n---\nInput function.\n\nReads user input from the console.'
	}],
	['range', {
		keyword: 'range',
		documentation: '```quartz\nfunction range(max: Number): Sequence<Number>\nfunction range(min: Number, max: Number): Sequence<Number>\n```\n---\nSequence generator.\n\nCreates a sequence of numbers.'
	}]
]);
//#endregion
