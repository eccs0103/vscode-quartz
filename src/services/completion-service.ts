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
			// Dot-context but type unresolvable — show nothing rather than all keywords
			return [];
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
		return this.#symService.resolveType(name, line, docTable);
	}

	// Returns CompletionItems for all accessible members of rawType, including inherited
	// members from the parent chain and with generic type arguments substituted.
	private getMembersOf(rawType: string): CompletionItem[] {
		const { base, args } = SymbolService.parseGeneric(rawType);
		const rootCls = this.#symService.runtimeTable.classes.get(base);
		if (!rootCls) return [];

		const subst = SymbolService.buildSubstitution(rootCls.typeParams, args);
		const { methods, fields } = this.#symService.getAllMembers(base);

		const items: CompletionItem[] = [];

		// Group overloads by method name; operator methods are excluded from dot-completion
		const methodOverloads = new Map<string, typeof methods>();
		for (const m of methods) {
			if (m.name.startsWith('[')) continue;
			const overloads = methodOverloads.get(m.name) ?? [];
			overloads.push(m);
			methodOverloads.set(m.name, overloads);
		}

		for (const [mName, overloads] of methodOverloads) {
			const first = overloads[0];
			const paramStr = first.params
				.map(p => `${p.name} ${SymbolService.substituteGenerics(p.typeName, subst)}`)
				.join(', ');
			const retType = SymbolService.substituteGenerics(first.retType, subst);
			const allSigs = overloads
				.map(o => {
					const ps = o.params
						.map(p => `${p.name} ${SymbolService.substituteGenerics(p.typeName, subst)}`)
						.join(', ');
					return `${mName}(${ps}) ${SymbolService.substituteGenerics(o.retType, subst)}`;
				})
				.join('\n');
			items.push({
				label: mName,
				kind: CompletionItemKind.Method,
				detail: `(${paramStr}) ${retType}`,
				documentation: allSigs
			});
		}

		const fieldSeen = new Set<string>();
		for (const f of fields) {
			if (fieldSeen.has(f.name)) continue;
			fieldSeen.add(f.name);
			items.push({
				label: f.name,
				kind: CompletionItemKind.Field,
				detail: SymbolService.substituteGenerics(f.typeName, subst),
				documentation: `Field of ${base}`
			});
		}

		return items;
	}

	// General context completion: keywords + types + functions + visible variables
	private getContextItems(position: Position, docTable: SymbolTable): CompletionItem[] {
		const items: CompletionItem[] = [];
		const added = new Set<string>();

		const add = (label: string, kind: CompletionItemKind, detail: string, documentation?: string) => {
			if (added.has(label)) return;
			added.add(label);
			items.push({ label, kind, detail, documentation });
		};

		// Keywords
		for (const kw of KEYWORDS) add(kw, CompletionItemKind.Keyword, 'keyword');

		// Built-in types (excluding internal workspace singleton)
		for (const name of this.#symService.runtimeTable.classes.keys()) {
			if (name === 'workspace') continue;
			add(name, CompletionItemKind.Class, `class ${name}`);
		}

		// Global runtime functions (promoted from workspace) — show all overloads in docs
		for (const [name, overloads] of this.#symService.runtimeTable.funcs) {
			const sigLines = overloads.map(o =>
				`${name}(${o.params.map(p => `${p.name} ${p.typeName}`).join(', ')}) ${o.retType}`
			);
			add(name, CompletionItemKind.Function, sigLines[0], sigLines.join('\n'));
		}

		// User-defined top-level functions — show all overloads in docs
		for (const [name, overloads] of docTable.funcs) {
			const sigLines = overloads.map(o =>
				`${name}(${o.params.map(p => `${p.name} ${p.typeName}`).join(', ')}) ${o.retType}`
			);
			add(name, CompletionItemKind.Function, sigLines[0], sigLines.join('\n'));
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
