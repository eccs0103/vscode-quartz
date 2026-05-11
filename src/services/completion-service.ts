"use strict";

import "adaptive-extender/node";
import { CompletionItem, CompletionItemKind, Position } from "vscode-languageserver/node.js";
import { TextDocument } from "vscode-languageserver-textdocument";
import { SymbolService } from "./symbol-service.js";
import { SymbolTable } from "./symbol-table.js";
import { TypeResolver } from "./type-resolver.js";
import { LanguageKeywords } from "../models/language-keywords.js";

//#region Completion builder
class CompletionBuilder {
	#items: CompletionItem[] = [];
	#added: Set<string> = new Set();

	add(label: string, kind: CompletionItemKind, detail: string, documentation?: string): void {
		if (this.#added.has(label)) return;
		this.#added.add(label);
		this.#items.push({ label, kind, detail, documentation });
	}

	build(): CompletionItem[] {
		return this.#items;
	}
}
//#endregion

//#region Completion service
export class CompletionService {
	static #patternMemberAccess: RegExp = /\.([A-Za-z_]\w*)?$/;

	#symbolService: SymbolService;

	constructor(symbolService: SymbolService) {
		this.#symbolService = symbolService;
	}

	getCompletions(document: TextDocument, position: Position): CompletionItem[] {
		const symbolService = this.#symbolService;
		const text = document.getText();
		const offset = document.offsetAt(position);
		const before = text.slice(0, offset);

		const documentTable = symbolService.getDocumentTable(document);

		const dotMatch = CompletionService.#patternMemberAccess.exec(before);
		if (dotMatch !== null) {
			const dotIndex = before.length - dotMatch[0].length;
			const receiverType = symbolService.typeAt(before, dotIndex, position.line, documentTable);
			if (receiverType !== null) return this.#getMembersOf(receiverType);
			return [];
		}

		return this.#getContextItems(position, documentTable);
	}

	#getMembersOf(rawType: string): CompletionItem[] {
		const symbolService = this.#symbolService;
		const { base, typeArgs } = TypeResolver.toGeneric(rawType);
		const rootType = symbolService.getType(base);
		if (rootType === undefined) return [];

		const substitution = TypeResolver.toSubstitution(rootType.typeParams, typeArgs);
		const { methods, fields } = symbolService.getAllMembers(base);
		const builder = new CompletionBuilder();

		const methodOverloads = new Map<string, typeof methods>();
		for (const method of methods) {
			if (method.name.startsWith("[")) continue;
			methodOverloads.add(method.name, []);
			methodOverloads.get(method.name)?.push(method);
		}

		for (const [label, overloads] of methodOverloads) {
			const first = overloads[0];
			const prefix = (first.declaringType === base) ? rawType : (first.declaringType ?? base);
			const detail = `${prefix}.${label}(${first.parameters.map(parameter => `${parameter.name} ${TypeResolver.mapWith(parameter.typeName, substitution)}`).join(", ")}) ${TypeResolver.mapWith(first.returnType, substitution)}`;
			builder.add(label, CompletionItemKind.Method, detail);
		}

		for (const { name: label, typeName } of fields) builder.add(label, CompletionItemKind.Field, TypeResolver.mapWith(typeName, substitution));

		return builder.build();
	}

	#getContextItems(position: Position, documentTable: SymbolTable): CompletionItem[] {
		const symbolService = this.#symbolService;
		const runtime = symbolService.runtimeTable;
		const builder = new CompletionBuilder();

		for (const keyword of LanguageKeywords.values()) builder.add(keyword, CompletionItemKind.Keyword, "keyword");

		for (const name of runtime.typeNames()) {
			if (name === "Workspace") continue;
			builder.add(name, CompletionItemKind.Class, `class ${name}`);
		}

		this.#addFunctionItems(builder, runtime);
		this.#addFunctionItems(builder, documentTable);

		for (const { name, typeName, declaringType } of runtime.getVariablesAt(position.line)) builder.add(name, CompletionItemKind.Variable, declaringType !== undefined ? `${declaringType}.${name} ${typeName}` : typeName);
		for (const { name, typeName } of documentTable.getVariablesAt(position.line)) builder.add(name, CompletionItemKind.Variable, typeName);

		return builder.build();
	}

	#addFunctionItems(builder: CompletionBuilder, table: SymbolTable): void {
		for (const [name, overloads] of table.functionEntries()) {
			const first = overloads[0];
			const prefix = first.declaringType !== undefined ? `${first.declaringType}.` : '';
			const detail = `${prefix}${name}(${first.parameters.map(parameter => `${parameter.name} ${parameter.typeName}`).join(", ")}) ${first.returnType}`;
			builder.add(name, CompletionItemKind.Function, detail);
		}
	}
}
//#endregion
