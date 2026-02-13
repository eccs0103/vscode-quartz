"use strict";

import { CompletionItem, CompletionItemKind } from 'vscode-languageserver/node';

//#region Completion items
export const KEYWORD_COMPLETIONS: ReadonlyArray<CompletionItem> = [
	{ label: 'if', kind: CompletionItemKind.Keyword, detail: 'If statement' },
	{ label: 'else', kind: CompletionItemKind.Keyword, detail: 'Else branch' },
	{ label: 'while', kind: CompletionItemKind.Keyword, detail: 'While loop' },
	{ label: 'break', kind: CompletionItemKind.Keyword, detail: 'Break statement' },
	{ label: 'continue', kind: CompletionItemKind.Keyword, detail: 'Continue statement' }
];

export const TYPE_COMPLETIONS: ReadonlyArray<CompletionItem> = [
	{ label: 'Number', kind: CompletionItemKind.Class, detail: 'Number type' },
	{ label: 'String', kind: CompletionItemKind.Class, detail: 'String type' },
	{ label: 'Boolean', kind: CompletionItemKind.Class, detail: 'Boolean type' },
	{ label: 'Any', kind: CompletionItemKind.Class, detail: 'Any type (polymorphic)' }
];

export const CONSTANT_COMPLETIONS: ReadonlyArray<CompletionItem> = [
	{ label: 'true', kind: CompletionItemKind.Value, detail: 'Boolean true' },
	{ label: 'false', kind: CompletionItemKind.Value, detail: 'Boolean false' },
	{ label: 'null', kind: CompletionItemKind.Value, detail: 'Null value' }
];

export const FUNCTION_COMPLETIONS: ReadonlyArray<CompletionItem> = [
	{ label: 'write', kind: CompletionItemKind.Function, detail: 'Write output to console', insertText: 'write(${1:value});' }
];

export const ALL_COMPLETIONS: ReadonlyArray<CompletionItem> = [
	...KEYWORD_COMPLETIONS,
	...TYPE_COMPLETIONS,
	...CONSTANT_COMPLETIONS,
	...FUNCTION_COMPLETIONS
];
//#endregion
