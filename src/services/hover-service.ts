"use strict";

import "adaptive-extender/node";
import { Hover, MarkupKind, Position, Range } from "vscode-languageserver/node.js";
import { TextDocument } from "vscode-languageserver-textdocument";
import { SymbolService } from "./symbol-service.js";
import { SymbolTable } from "./symbol-table.js";
import { TypeResolver } from "./type-resolver.js";
import { OverloadPicker } from "./overload-picker.js";
import { Lexer } from "./lexer.js";
import { Token, TokenRange, TokenType } from "../models/token.js";

//#region Hover service
export class HoverService {
	#symbolService: SymbolService;

	constructor(symbolService: SymbolService) {
		this.#symbolService = symbolService;
	}

	getHover(document: TextDocument, position: Position): Hover | null {
		const text = document.getText();
		const token = this.#getTokenAt(text, position);
		if (token === null) return null;

		const range = this.#toRange(token.range);
		const line = token.range.startLine;

		if (token.type === TokenType.String) return this.#toHover("```quartz\nString\n```", range);
		if (token.type === TokenType.Character) return this.#toHover("```quartz\nCharacter\n```", range);
		if (token.type === TokenType.Number) return this.#toHover("```quartz\nNumber\n```", range);

		if (token.type === TokenType.Operator && token.value !== ".") {
			const tokenStart = document.offsetAt({ line: token.range.startLine, character: token.range.startColumn });
			const tokenEnd = document.offsetAt({ line: token.range.endLine, character: token.range.endColumn });
			return this.#makeHoverForOperator(token.value, tokenStart, tokenEnd, line, text);
		}

		if (token.type !== TokenType.Identifier && token.type !== TokenType.Keyword) return null;

		const wordStart = document.offsetAt({ line: token.range.startLine, character: token.range.startColumn });
		const wordEnd = document.offsetAt({ line: token.range.endLine, character: token.range.endColumn });
		const documentTable = this.#symbolService.parse(text);

		if (wordStart > 0 && text[wordStart - 1] === ".") {
			const receiverType = this.#symbolService.typeAt(text, wordStart - 1, line, documentTable);
			if (receiverType === null) return null;
			return this.#makeHoverForMember(token.value, wordEnd, receiverType, text);
		}

		return this.#makeHover(token.value, wordEnd, line, text, documentTable);
	}

	#makeHoverForOperator(operator: string, start: number, end: number, line: number, text: string): Hover | null {
		const documentTable = this.#symbolService.parse(text);
		const methodName = `[${operator}]`;

		const leftType = this.#symbolService.typeAt(text, start, line, documentTable);
		if (leftType !== null) return this.#makeBinaryOpHover(operator, methodName, leftType, end, line, text, documentTable);

		const rightType = this.#typeRightOf(text, end, line, documentTable);
		if (rightType !== null) return this.#makeUnaryOpHover(operator, methodName, rightType);

		return null;
	}

	#makeBinaryOpHover(operator: string, methodName: string, leftType: string, rightStart: number, line: number, text: string, documentTable: SymbolTable): Hover | null {
		const { base, typeArgs } = TypeResolver.toGeneric(leftType);
		const typeDefinition = this.#symbolService.getType(base);
		if (typeDefinition === undefined) return null;
		const substitution = TypeResolver.toSubstitution(typeDefinition.typeParams, typeArgs);
		const { methods } = this.#symbolService.getAllMembers(base);
		const binaryMethods = methods.filter(method => method.name === methodName && method.params.length > 0);
		if (binaryMethods.length === 0) return null;

		let selected = binaryMethods;
		const rightType = this.#typeRightOf(text, rightStart, line, documentTable);
		if (rightType !== null) {
			const matched = binaryMethods.filter(method => TypeResolver.mapWith(method.params[0].typeName, substitution) === rightType);
			if (matched.length > 0) selected = matched;
		}

		const signature = `${leftType}.[${operator}](${selected[0].params.map(parameter => `${parameter.name} ${TypeResolver.mapWith(parameter.typeName, substitution)}`).join(", ")}) ${TypeResolver.mapWith(selected[0].retType, substitution)}`;
		const overloadNote = selected.length > 1 ? `\n_+${selected.length - 1} ${selected.length - 1 === 1 ? "overload" : "overloads"}_` : String.empty;
		return this.#toHover(`\`\`\`quartz\n${signature}\n\`\`\`${overloadNote}`);
	}

	#makeUnaryOpHover(operator: string, methodName: string, rightType: string): Hover | null {
		const { base, typeArgs } = TypeResolver.toGeneric(rightType);
		const typeDefinition = this.#symbolService.getType(base);
		if (typeDefinition === undefined) return null;
		const substitution = TypeResolver.toSubstitution(typeDefinition.typeParams, typeArgs);
		const { methods } = this.#symbolService.getAllMembers(base);
		const unary = methods.find(method => method.name === methodName && method.params.length === 0);
		if (unary === undefined) return null;
		return this.#toHover(`\`\`\`quartz\n${rightType}.[${operator}]() ${TypeResolver.mapWith(unary.retType, substitution)}\n\`\`\``);
	}

	#makeHoverForMember(memberName: string, wordEnd: number, typeName: string, text: string): Hover | null {
		const symbolService = this.#symbolService;
		const { base, typeArgs } = TypeResolver.toGeneric(typeName);
		const typeDefinition = symbolService.getType(base);
		if (typeDefinition === undefined) return null;

		const substitution = TypeResolver.toSubstitution(typeDefinition.typeParams, typeArgs);
		const { methods, fields } = symbolService.getAllMembers(base);

		const matching = methods.filter(entry => entry.name === memberName && !entry.name.startsWith("["));
		if (matching.length > 0) {
			const argCount = OverloadPicker.argsAt(text, wordEnd);
			const resolved = matching[OverloadPicker.pickFor(matching.map(method => method.params.length), argCount)];
			const prefix = (resolved.declType === base) ? typeName : (resolved.declType ?? base);
			const signature = `${prefix}.${memberName}(${resolved.params.map(parameter => `${parameter.name} ${TypeResolver.mapWith(parameter.typeName, substitution)}`).join(", ")}) ${TypeResolver.mapWith(resolved.retType, substitution)}`;
			const overloadNote = matching.length > 1 ? `\n_+${matching.length - 1} ${matching.length - 1 === 1 ? "overload" : "overloads"}_` : String.empty;
			return this.#toHover(`\`\`\`quartz\n${signature}\n\`\`\`${overloadNote}`);
		}

		const field = fields.find(entry => entry.name === memberName);
		if (field === undefined) return null;
		return this.#toHover(`\`\`\`quartz\n${memberName} ${TypeResolver.mapWith(field.typeName, substitution)}\n\`\`\``);
	}

	#makeHover(word: string, wordEnd: number, line: number, text: string, documentTable: SymbolTable): Hover | null {
		if (word === "true" || word === "false") return this.#toHover("```quartz\nBoolean\n```");
		if (word === "null") return this.#toHover("```quartz\nNull\n```");

		const symbolService = this.#symbolService;
		const typeDefinition = symbolService.getType(word) ?? documentTable.getType(word);
		if (typeDefinition !== undefined) {
			const memberLines: string[] = [];
			for (const { name, typeName } of typeDefinition.fields) memberLines.push(`  ${name} ${typeName}`);
			for (const { name, params, retType } of typeDefinition.methods) {
				if (name.startsWith("[")) continue;
				memberLines.push(`  ${name}(${params.map(parameter => `${parameter.name} ${parameter.typeName}`).join(", ")}) ${retType}`);
			}
			const typeParamString = typeDefinition.typeParams.length > 0 ? `<${typeDefinition.typeParams.join(", ")}>` : String.empty;
			const header = typeDefinition.parent !== undefined ? `${typeDefinition.name}${typeParamString} from ${typeDefinition.parent}` : `${typeDefinition.name}${typeParamString}`;
			const body = memberLines.length > 0 ? `\n${memberLines.join("\n")}\n` : String.empty;
			return this.#toHover(`\`\`\`quartz\n${header} {${body}}\n\`\`\``);
		}

		const runtime = symbolService.runtimeTable();
		const allOverloads = [...(runtime.getFunctions(word) ?? []), ...(documentTable.getFunctions(word) ?? [])];
		if (allOverloads.length > 0) {
			const argCount = OverloadPicker.argsAt(text, wordEnd);
			const resolved = allOverloads[OverloadPicker.pickFor(allOverloads.map(overload => overload.params.length), argCount)];
			const prefix = resolved.ownerType !== undefined ? `${resolved.ownerType}.` : '';
			const signature = `${prefix}${resolved.name}(${resolved.params.map(parameter => `${parameter.name} ${parameter.typeName}`).join(", ")}) ${resolved.retType}`;
			const overloadNote = allOverloads.length > 1 ? `\n_+${allOverloads.length - 1} ${allOverloads.length - 1 === 1 ? "overload" : "overloads"}_` : String.empty;
			return this.#toHover(`\`\`\`quartz\n${signature}\n\`\`\`${overloadNote}`);
		}

		const variable = [...runtime.getVariablesAt(line), ...documentTable.getVariablesAt(line)].find(entry => entry.name === word);
		if (variable !== undefined) return this.#toHover(`\`\`\`quartz\n${variable.name} ${variable.typeName}\n\`\`\``);

		return null;
	}

	#typeRightOf(text: string, start: number, line: number, documentTable: SymbolTable): string | null {
		let cursor = start;
		while (cursor < text.length && (text[cursor] === " " || text[cursor] === "\t")) cursor++;
		if (cursor >= text.length) return null;
		if (text[cursor] === '"') return "String";
		if (text[cursor] === "'") return "Character";
		if (text[cursor] >= "0" && text[cursor] <= "9") return "Number";
		if (text[cursor] === "(") {
			let depth = 1;
			cursor++;
			while (cursor < text.length && depth > 0) {
				if (text[cursor] === "(") depth++;
				else if (text[cursor] === ")") depth--;
				cursor++;
			}
			return this.#symbolService.typeAt(text, cursor, line, documentTable);
		}
		if (!/[A-Za-z_]/.test(text[cursor])) return null;
		const nameStart = cursor;
		while (cursor < text.length && /\w/.test(text[cursor])) cursor++;
		const name = text.slice(nameStart, cursor);
		if (name === "true" || name === "false") return "Boolean";
		if (name === "null") return "Null";
		const exprEnd = this.#scanExprEnd(text, nameStart);
		return this.#symbolService.typeAt(text, exprEnd, line, documentTable);
	}

	#scanExprEnd(text: string, start: number): number {
		let cursor = start;
		while (cursor < text.length) {
			const ch = text[cursor];
			if (/[\w.]/.test(ch)) { cursor++; continue; }
			if (ch === "(") {
				let depth = 1;
				cursor++;
				while (cursor < text.length && depth > 0) {
					if (text[cursor] === "(") depth++;
					else if (text[cursor] === ")") depth--;
					cursor++;
				}
				continue;
			}
			if (ch === "[") {
				let depth = 1;
				cursor++;
				while (cursor < text.length && depth > 0) {
					if (text[cursor] === "[") depth++;
					else if (text[cursor] === "]") depth--;
					cursor++;
				}
				continue;
			}
			break;
		}
		return cursor;
	}

	#toHover(value: string, range?: Range): Hover {
		return { contents: { kind: MarkupKind.Markdown, value }, range };
	}

	#toRange(tokenRange: TokenRange): Range {
		return {
			start: { line: tokenRange.startLine, character: tokenRange.startColumn },
			end: { line: tokenRange.endLine, character: tokenRange.endColumn }
		};
	}

	#getTokenAt(text: string, position: Position): Token | null {
		const { line, character } = position;
		for (const token of new Lexer(text).tokenize()) {
			const { range } = token;
			if (range.startLine > line) break;
			if (range.endLine < line) continue;
			if (range.startLine === line && character < range.startColumn) continue;
			if (range.endLine === line && character >= range.endColumn) continue;
			return token;
		}
		return null;
	}
}
//#endregion
