"use strict";

//#region Hover data
export interface HoverInfo {
	readonly keyword: string;
	readonly documentation: string;
}

export const HOVER_CONTENT: ReadonlyMap<string, HoverInfo> = new Map([
	['if', {
		keyword: 'if',
		documentation: '`if` - Conditional statement\n\nSyntax: `if (condition) { ... }`'
	}],
	['else', {
		keyword: 'else',
		documentation: '`else` - Alternative branch\n\nSyntax: `if (condition) { ... } else { ... }`'
	}],
	['while', {
		keyword: 'while',
		documentation: '`while` - Loop statement\n\nSyntax: `while (condition) { ... }`'
	}],
	['break', {
		keyword: 'break',
		documentation: '`break` - Exit from loop'
	}],
	['continue', {
		keyword: 'continue',
		documentation: '`continue` - Skip to next iteration'
	}],
	['Number', {
		keyword: 'Number',
		documentation: '`Number` - Numeric type\n\nExample: `value Number(42);`'
	}],
	['String', {
		keyword: 'String',
		documentation: '`String` - String type\n\nExample: `text String("hello");`'
	}],
	['Boolean', {
		keyword: 'Boolean',
		documentation: '`Boolean` - Boolean type\n\nExample: `flag Boolean(true);`'
	}],
	['Any', {
		keyword: 'Any',
		documentation: '`Any` - Polymorphic type\n\nCan hold any value type.'
	}],
	['true', {
		keyword: 'true',
		documentation: '`true` - Boolean true value'
	}],
	['false', {
		keyword: 'false',
		documentation: '`false` - Boolean false value'
	}],
	['null', {
		keyword: 'null',
		documentation: '`null` - Null value'
	}],
	['write', {
		keyword: 'write',
		documentation: '`write(value)` - Output function\n\nWrites value to console.'
	}]
]);
//#endregion
