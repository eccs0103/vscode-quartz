"use strict";

import { CompletionItem, CompletionItemKind } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { Position } from 'vscode-languageserver/node';
import { SymbolService } from './symbol-service.js';
import { SymbolTable } from './semantic/symbol-table.js';

// Actual Quartz keywords from Quartz.Domain/Definitions.cs
const KEYWORDS = ['if', 'else', 'while', 'for', 'in', 'break', 'continue', 'return', 'true', 'false', 'null'];

//#region CompletionService
export class CompletionService {
	readonly #symService: SymbolService;

	constructor(symService: SymbolService) {
		this.#symService = symService;
	}

	getCompletions(document: TextDocument, position: Position, triggerChar?: string): CompletionItem[] {
		const text = document.getText();
		const offset = this.lineColToOffset(text, position.line, position.character);
		const before = text.slice(0, offset);

		const docTable = this.#symService.parse(text);

		// Member completion: triggered by '.' or typing after 'identifier.'
		const memberMatch = /\b([A-Za-z_]\w*)\.([A-Za-z_]\w*)?$/.exec(before);
		if (memberMatch || triggerChar === '.') {
			const targetName = memberMatch ? memberMatch[1] : this.identBefore(before);
			if (targetName) {
				const typeName = this.findType(targetName, position.line, docTable);
				if (typeName) return this.getMembersOf(typeName);
			}
		}

		return this.getContextItems(position, docTable);
	}

	// Find the last identifier token just before the dot in raw text
	private identBefore(before: string): string | null {
		const m = /\b([A-Za-z_]\w*)\s*\.$/.exec(before);
		return m ? m[1] : null;
	}

	// Resolve the declared type of a name in scope
	private findType(name: string, line: number, docTable: SymbolTable): string | null {
		const candidates = [
			...this.#symService.runtimeTable.getVarsAt(line),
			...docTable.getVarsAt(line)
		];
		const v = candidates.find(c => c.name === name);
		if (v) return v.typeName;

		// Function call site: the name is a function — return its return type
		const rFns = this.#symService.runtimeTable.funcs.get(name);
		const dFns = docTable.funcs.get(name);
		const overloads = rFns ?? dFns;
		if (overloads && overloads.length > 0) return overloads[0].retType;

		return null;
	}

	// Return CompletionItems for all accessible members of the given type
	private getMembersOf(typeName: string): CompletionItem[] {
		// Strip generics and nullable suffix to get base class name
		const base = typeName.replace(/^Nullable<(.+)>$/, '$1').split('<')[0];
		const cls = this.#symService.runtimeTable.classes.get(base);
		if (!cls) return [];

		const items: CompletionItem[] = [];
		for (const m of cls.methods) {
			if (m.name.startsWith('[')) continue; // operator overloads not shown in dot-completion
			const paramStr = m.params.map(p => `${p.name} ${p.typeName}`).join(', ');
			items.push({
				label: m.name,
				kind: CompletionItemKind.Method,
				detail: `(${paramStr}) ${m.retType}`,
				documentation: `Method of ${base}`
			});
		}
		for (const f of cls.fields) {
			items.push({
				label: f.name,
				kind: CompletionItemKind.Field,
				detail: f.typeName,
				documentation: `Field of ${base}`
			});
		}
		return items;
	}

	// General context completion: keywords + types + functions + visible variables
	private getContextItems(position: Position, docTable: SymbolTable): CompletionItem[] {
		const items: CompletionItem[] = [];
		const added = new Set<string>();

		const add = (label: string, kind: CompletionItemKind, detail: string) => {
			if (added.has(label)) return;
			added.add(label);
			items.push({ label, kind, detail });
		};

		// Keywords
		for (const kw of KEYWORDS) add(kw, CompletionItemKind.Keyword, 'keyword');

		// Built-in types (excluding internal workspace singleton)
		for (const name of this.#symService.runtimeTable.classes.keys()) {
			if (name === 'workspace') continue;
			add(name, CompletionItemKind.Class, `class ${name}`);
		}

		// Global runtime functions (promoted from workspace)
		for (const [name, overloads] of this.#symService.runtimeTable.funcs) {
			const detail = overloads
				.map(o => `${name}(${o.params.map(p => p.typeName).join(', ')}) ${o.retType}`)
				.join(' | ');
			add(name, CompletionItemKind.Function, detail);
		}

		// User-defined top-level functions
		for (const [name, overloads] of docTable.funcs) {
			const o = overloads[0];
			const detail = `${name}(${o.params.map(p => `${p.name} ${p.typeName}`).join(', ')}) ${o.retType}`;
			add(name, CompletionItemKind.Function, detail);
		}

		// Variables visible at the cursor line (runtime globals + doc locals)
		for (const v of this.#symService.runtimeTable.getVarsAt(position.line)) {
			add(v.name, CompletionItemKind.Variable, v.typeName);
		}
		for (const v of docTable.getVarsAt(position.line)) {
			add(v.name, CompletionItemKind.Variable, v.typeName);
		}

		return items;
	}

	private lineColToOffset(text: string, line: number, col: number): number {
		let curLine = 0;
		let i = 0;
		while (i < text.length && curLine < line) {
			if (text[i] === '\n') curLine++;
			i++;
		}
		return i + col;
	}
}
//#endregion
