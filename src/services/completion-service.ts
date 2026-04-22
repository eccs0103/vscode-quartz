"use strict";

import { CompletionItem, CompletionItemKind, Position } from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { SymbolService } from "./symbol-service.js";
import { FuncDef, SymbolTable } from "./symbol-table.js";
import { LanguageKeywords } from "../models/language-keywords.js";

//#region CompletionService
export class CompletionService {
	#symbolService: SymbolService;

	constructor(symbolService: SymbolService) {
		this.#symbolService = symbolService;
	}

	getCompletions(document: TextDocument, position: Position): CompletionItem[] {
		const text = document.getText();
		const offset = document.offsetAt(position);
		const before = text.slice(0, offset);

		const docTable = this.#symbolService.parse(text);

		const dotMatch = /\.([A-Za-z_]\w*)?$/.exec(before);
		if (dotMatch) {
			const dotIndex = before.length - dotMatch[0].length;
			const receiverType = this.#symbolService.exprType(before, dotIndex, position.line, docTable);
			if (receiverType) return this.#getMembersOf(receiverType);
			return [];
		}

		return this.#getContextItems(position, docTable);
	}

	#getMembersOf(rawType: string): CompletionItem[] {
		const { base, typeArgs } = SymbolService.toGeneric(rawType);
		const rootType = this.#symbolService.getClass(base);
		if (!rootType) return [];

		const substitution = SymbolService.toSubstitution(rootType.typeParams, typeArgs);
		const { methods, fields } = this.#symbolService.getAllMembers(base);

		const items: CompletionItem[] = [];

		const methodOverloads = new Map<string, typeof methods>();
		for (const method of methods) {
			if (method.name.startsWith("[")) continue;
			const overloads = methodOverloads.get(method.name) ?? [];
			overloads.push(method);
			methodOverloads.set(method.name, overloads);
		}

		for (const [label, overloads] of methodOverloads) {
			const first = overloads[0];
			const detail = `(${first.params.map(parameter => `${parameter.name} ${SymbolService.mapWith(parameter.typeName, substitution)}`).join(", ")}) ${SymbolService.mapWith(first.retType, substitution)}`;
			const documentation = overloads.map(overload => `${label}(${overload.params.map(parameter => `${parameter.name} ${SymbolService.mapWith(parameter.typeName, substitution)}`).join(", ")}) ${SymbolService.mapWith(overload.retType, substitution)}`).join("\n");
			items.push({ label, kind: CompletionItemKind.Method, detail, documentation });
		}

		for (const { name: label, typeName } of fields) items.push({ label, kind: CompletionItemKind.Field, detail: SymbolService.mapWith(typeName, substitution), documentation: `Field of ${base}` });

		return items;
	}

	#getContextItems(position: Position, docTable: SymbolTable): CompletionItem[] {
		const items: CompletionItem[] = [];
		const added = new Set<string>();

		for (const keyword of LanguageKeywords.values()) this.#addItem(items, added, keyword, CompletionItemKind.Keyword, "keyword");

		for (const name of this.#symbolService.typeNames()) {
			if (name === "workspace") continue;
			this.#addItem(items, added, name, CompletionItemKind.Class, `class ${name}`);
		}

		this.#addFuncItems(items, added, this.#symbolService.libFuncs());
		this.#addFuncItems(items, added, docTable.funcs);

		for (const { name, typeName } of this.#symbolService.libVarsAt(position.line)) this.#addItem(items, added, name, CompletionItemKind.Variable, typeName);
		for (const { name, typeName } of docTable.getVarsAt(position.line)) this.#addItem(items, added, name, CompletionItemKind.Variable, typeName);

		return items;
	}

	#addFuncItems(items: CompletionItem[], added: Set<string>, funcs: ReadonlyMap<string, FuncDef[]>): void {
		for (const [name, overloads] of funcs) {
			const signatures = overloads.map(overload => `${name}(${overload.params.map(parameter => `${parameter.name} ${parameter.typeName}`).join(", ")}) ${overload.retType}`);
			this.#addItem(items, added, name, CompletionItemKind.Function, signatures[0], signatures.join("\n"));
		}
	}

	#addItem(items: CompletionItem[], added: Set<string>, label: string, kind: CompletionItemKind, detail: string, documentation?: string): void {
		if (added.has(label)) return;
		added.add(label);
		items.push({ label, kind, detail, documentation });
	}
}
//#endregion
