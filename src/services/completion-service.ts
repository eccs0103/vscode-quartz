"use strict";

import { CompletionItem, CompletionItemKind, Position } from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { SymbolService } from "./symbol-service.js";
import { SymbolTable } from "./semantic/symbol-table.js";
import { KEYWORDS } from "../models/language-keywords.js";

//#region CompletionService
export class CompletionService {
	readonly #symService: SymbolService;

	constructor(symService: SymbolService) {
		this.#symService = symService;
	}

	getCompletions(document: TextDocument, position: Position, triggerChar?: string): CompletionItem[] {
		const text = document.getText();
		const offset = this.#lineColToOffset(text, position.line, position.character);
		const before = text.slice(0, offset);

		const docTable = this.#symService.parse(text);

		const dotMatch = /\.([A-Za-z_]\w*)?$/.exec(before);
		if (dotMatch) {
			const dotIndex = before.length - dotMatch[0].length;
			const receiverType = this.#symService.exprType(before, dotIndex, position.line, docTable);
			if (receiverType) return this.#getMembersOf(receiverType);
			return [];
		}

		return this.#getContextItems(position, docTable);
	}

	#getMembersOf(rawType: string): CompletionItem[] {
		const { base, args } = SymbolService.toGeneric(rawType);
		const rootCls = this.#symService.runtimeTable.classes.get(base);
		if (!rootCls) return [];

		const subst = SymbolService.toSubst(rootCls.typeParams, args);
		const { methods, fields } = this.#symService.getAllMembers(base);

		const items: CompletionItem[] = [];

		const methodOverloads = new Map<string, typeof methods>();
		for (const m of methods) {
			if (m.name.startsWith("[")) continue;
			const overloads = methodOverloads.get(m.name) ?? [];
			overloads.push(m);
			methodOverloads.set(m.name, overloads);
		}

		for (const [mName, overloads] of methodOverloads) {
			const first = overloads[0];
			const paramStr = first.params
				.map(p => `${p.name} ${SymbolService.mapWith(p.typeName, subst)}`)
				.join(", ");
			const retType = SymbolService.mapWith(first.retType, subst);
			const allSigs = overloads
				.map(o => {
					const ps = o.params
						.map(p => `${p.name} ${SymbolService.mapWith(p.typeName, subst)}`)
						.join(", ");
					return `${mName}(${ps}) ${SymbolService.mapWith(o.retType, subst)}`;
				})
				.join("\n");
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
				detail: SymbolService.mapWith(f.typeName, subst),
				documentation: `Field of ${base}`
			});
		}

		return items;
	}

	#getContextItems(position: Position, docTable: SymbolTable): CompletionItem[] {
		const items: CompletionItem[] = [];
		const added = new Set<string>();

		const add = (label: string, kind: CompletionItemKind, detail: string, documentation?: string) => {
			if (added.has(label)) return;
			added.add(label);
			items.push({ label, kind, detail, documentation });
		};

		for (const kw of KEYWORDS) add(kw, CompletionItemKind.Keyword, "keyword");

		for (const name of this.#symService.runtimeTable.classes.keys()) {
			if (name === "workspace") continue;
			add(name, CompletionItemKind.Class, `class ${name}`);
		}

		for (const [name, overloads] of this.#symService.runtimeTable.funcs) {
			const sigLines = overloads.map(o =>
				`${name}(${o.params.map(p => `${p.name} ${p.typeName}`).join(", ")}) ${o.retType}`
			);
			add(name, CompletionItemKind.Function, sigLines[0], sigLines.join("\n"));
		}

		for (const [name, overloads] of docTable.funcs) {
			const sigLines = overloads.map(o =>
				`${name}(${o.params.map(p => `${p.name} ${p.typeName}`).join(", ")}) ${o.retType}`
			);
			add(name, CompletionItemKind.Function, sigLines[0], sigLines.join("\n"));
		}

		for (const v of this.#symService.runtimeTable.getVarsAt(position.line)) {
			add(v.name, CompletionItemKind.Variable, v.typeName);
		}
		for (const v of docTable.getVarsAt(position.line)) {
			add(v.name, CompletionItemKind.Variable, v.typeName);
		}

		return items;
	}

	#lineColToOffset(text: string, line: number, col: number): number {
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
