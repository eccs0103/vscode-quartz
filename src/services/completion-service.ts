"use strict";

import "adaptive-extender/node";
import { CompletionItem, CompletionItemKind, Position } from "vscode-languageserver-types";
import { TextDocument } from "vscode-languageserver-textdocument";
import { SymbolService } from "./symbol-service.js";
import { SymbolTable } from "./symbol-table.js";
import { TypeResolver } from "./type-resolver.js";
import { LanguageKeywords } from "../models/language-keywords.js";

//#region Completion builder
class CompletionBuilder {
	#items: CompletionItem[] = [];
	#added: Set<string> = new Set();

	add(label: string, kind: CompletionItemKind, detail: string): void {
		const added = this.#added;
		if (added.has(label)) return;
		added.add(label);
		this.#items.push({ label, kind, detail });
	}

	build(): CompletionItem[] {
		return this.#items;
	}
}
//#endregion

//#region Completion service
export class CompletionService {
	static #access: RegExp = /\.([A-Za-z_]\w*)?$/;

	#symbols: SymbolService;

	constructor(symbols: SymbolService) {
		this.#symbols = symbols;
	}

	getCompletions(document: TextDocument, position: Position): CompletionItem[] {
		const symbols = this.#symbols;
		const text = document.getText();
		const offset = document.offsetAt(position);
		const before = text.slice(0, offset);

		const table = symbols.getDocumentTable(document);

		const dotMatch = CompletionService.#access.exec(before);
		if (dotMatch !== null) {
			const dotIndex = before.length - dotMatch[0].length;
			const receiver = symbols.typeAt(before, dotIndex, position.line, table);
			if (receiver !== null) return this.#getMembersOf(receiver);
			return [];
		}

		return this.#getContextItems(position, table);
	}

	#getMembersOf(rawType: string): CompletionItem[] {
		const symbols = this.#symbols;
		const { base, typeArgs } = TypeResolver.toGeneric(rawType);
		const rootType = symbols.getType(base);
		if (rootType === null) return [];

		const substitution = TypeResolver.toSubstitution(rootType.typeParams, typeArgs);
		const { methods, fields } = symbols.getAllMembers(base);
		const builder = new CompletionBuilder();

		const methodOverloads = new Map<string, typeof methods>();
		for (const method of methods) {
			if (method.name.startsWith("[")) continue;
			methodOverloads.add(method.name, []);
			methodOverloads.get(method.name)?.push(method);
		}

		for (const [label, overloads] of methodOverloads) {
			const first = overloads[0];
			const prefix = (first.owner === base) ? rawType : (first.owner ?? base);
			const detail = `${prefix}.${label}(${first.parameters.map(parameter => `${parameter.name} ${TypeResolver.mapWith(parameter.typeName, substitution)}`).join(", ")}) ${TypeResolver.mapWith(first.result, substitution)}`;
			builder.add(label, CompletionItemKind.Method, detail);
		}

		for (const { name: label, typeName } of fields) builder.add(label, CompletionItemKind.Field, TypeResolver.mapWith(typeName, substitution));

		return builder.build();
	}

	#getContextItems(position: Position, table: SymbolTable): CompletionItem[] {
		const { runtime } = this.#symbols;
		const builder = new CompletionBuilder();

		for (const keyword of LanguageKeywords.values()) builder.add(keyword, CompletionItemKind.Keyword, "keyword");

		for (const name of runtime.typeNames()) {
			if (name === "Workspace") continue;
			builder.add(name, CompletionItemKind.Class, `class ${name}`);
		}

		this.#addFunctionItems(builder, runtime);
		this.#addFunctionItems(builder, table);

		for (const { name, typeName, owner } of runtime.getVariablesAt(position.line)) builder.add(name, CompletionItemKind.Variable, owner !== null ? `${owner}.${name} ${typeName}` : typeName);
		for (const { name, typeName } of table.getVariablesAt(position.line)) builder.add(name, CompletionItemKind.Variable, typeName);

		return builder.build();
	}

	#addFunctionItems(builder: CompletionBuilder, table: SymbolTable): void {
		for (const [name, overloads] of table.functionEntries()) {
			const first = overloads[0];
			const prefix = first.owner !== null ? `${first.owner}.` : '';
			const detail = `${prefix}${name}(${first.parameters.map(parameter => `${parameter.name} ${parameter.typeName}`).join(", ")}) ${first.result}`;
			builder.add(name, CompletionItemKind.Function, detail);
		}
	}
}
//#endregion
