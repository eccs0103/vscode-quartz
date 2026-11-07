"use strict";

import "adaptive-extender/node";
import { Hover, MarkupKind, Position } from "vscode-languageserver-types";
import { TextDocument } from "vscode-languageserver-textdocument";
import { SymbolService } from "./symbol-service.js";
import { SymbolTable } from "./symbol-table.js";
import { TypeResolver } from "./type-resolver.js";
import { OverloadPicker } from "./overload-picker.js";
import { Lexer } from "./lexer.js";
import { Token, TokenType } from "../models/token.js";
import { Span } from "../models/span.js";
import { ParameterDefinition } from "../models/symbol-definitions.js";

//#region Hover service
export class HoverService {
	#symbols: SymbolService;

	constructor(symbols: SymbolService) {
		this.#symbols = symbols;
	}

	getHover(document: TextDocument, position: Position): Hover | null {
		const symbols = this.#symbols;
		const text = document.getText();
		const token = this.#getTokenAt(text, position);
		if (token === null) return null;

		const line = token.span.begin.line;

		if (token.type === TokenType.string) return this.#toHover("```quartz\nString\n```", token.span);
		if (token.type === TokenType.character) return this.#toHover("```quartz\nCharacter\n```", token.span);
		if (token.type === TokenType.number) return this.#toHover("```quartz\nNumber\n```", token.span);

		const table = symbols.getDocumentTable(document);

		if (token.type === TokenType.operator && token.value !== ".") {
			const tokenStart = document.offsetAt(token.span.begin.toPosition());
			const tokenEnd = document.offsetAt(token.span.end.toPosition());
			return this.#makeHoverForOperator(token.value, tokenStart, tokenEnd, line, text, table);
		}

		if (token.type !== TokenType.identifier && token.type !== TokenType.keyword) return null;

		const wordStart = document.offsetAt(token.span.begin.toPosition());
		const wordEnd = document.offsetAt(token.span.end.toPosition());

		if (wordStart > 0 && text[wordStart - 1] === ".") {
			const receiver = symbols.typeAt(text, wordStart - 1, line, table);
			if (receiver === null) return null;
			return this.#makeHoverForMember(token.value, wordEnd, receiver, text);
		}

		return this.#makeHover(token.value, wordEnd, line, text, table);
	}

	#makeHoverForOperator(operator: string, start: number, end: number, line: number, text: string, table: SymbolTable): Hover | null {
		const methodName = `[${operator}]`;

		const leftType = this.#symbols.typeAt(text, start, line, table);
		if (leftType !== null) return this.#makeBinaryHover(operator, methodName, leftType, end, line, text, table);

		const rightType = this.#typeRightOf(text, end, line, table);
		if (rightType !== null) return this.#makeUnaryHover(operator, methodName, rightType);

		return null;
	}

	#makeBinaryHover(operator: string, methodName: string, leftType: string, rightStart: number, line: number, text: string, table: SymbolTable): Hover | null {
		const symbols = this.#symbols;
		const { base, typeArgs } = TypeResolver.toGeneric(leftType);
		const typeDefinition = symbols.getType(base);
		if (typeDefinition === null) return null;
		const substitution = TypeResolver.toSubstitution(typeDefinition.typeParams, typeArgs);
		const { methods } = symbols.getAllMembers(base);
		const binaryMethods = methods.filter(method => method.name === methodName && method.parameters.length > 0);
		if (binaryMethods.length === 0) return null;

		const rightType = this.#typeRightOf(text, rightStart, line, table);
		if (rightType === null) return null;
		const matched = binaryMethods.filter(method => TypeResolver.mapWith(method.parameters[0].typeName, substitution) === rightType);
		if (matched.length === 0) return null;

		const signature = `${leftType}.[${operator}](${HoverService.#formatParameters(matched[0].parameters, substitution)}) ${TypeResolver.mapWith(matched[0].result, substitution)}`;
		return this.#toHover(`\`\`\`quartz\n${signature}\n\`\`\``);
	}

	#makeUnaryHover(operator: string, methodName: string, rightType: string): Hover | null {
		const symbols = this.#symbols;
		const { base, typeArgs } = TypeResolver.toGeneric(rightType);
		const typeDefinition = symbols.getType(base);
		if (typeDefinition === null) return null;
		const substitution = TypeResolver.toSubstitution(typeDefinition.typeParams, typeArgs);
		const { methods } = symbols.getAllMembers(base);
		const unary = methods.find(method => method.name === methodName && method.parameters.length === 0);
		if (unary === undefined) return null;
		return this.#toHover(`\`\`\`quartz\n${rightType}.[${operator}]() ${TypeResolver.mapWith(unary.result, substitution)}\n\`\`\``);
	}

	#makeHoverForMember(member: string, wordEnd: number, typeName: string, text: string): Hover | null {
		const symbols = this.#symbols;
		const { base, typeArgs } = TypeResolver.toGeneric(typeName);
		const typeDefinition = symbols.getType(base);
		if (typeDefinition === null) return null;

		const substitution = TypeResolver.toSubstitution(typeDefinition.typeParams, typeArgs);
		const { methods, fields } = symbols.getAllMembers(base);

		const matching = methods.filter(entry => entry.name === member && !entry.name.startsWith("["));
		if (matching.length > 0) {
			const count = OverloadPicker.countAt(text, wordEnd);
			const resolved = matching[OverloadPicker.pickFor(matching.map(method => method.parameters.length), count)];
			const prefix = (resolved.owner === base) ? typeName : (resolved.owner ?? base);
			const signature = `${prefix}.${member}(${HoverService.#formatParameters(resolved.parameters, substitution)}) ${TypeResolver.mapWith(resolved.result, substitution)}`;
			return this.#toHover(`\`\`\`quartz\n${signature}\n\`\`\`${HoverService.#noteOverload(matching.length)}`);
		}

		const field = fields.find(entry => entry.name === member);
		if (field === undefined) return null;
		return this.#toHover(`\`\`\`quartz\n${member} ${TypeResolver.mapWith(field.typeName, substitution)}\n\`\`\``);
	}

	#makeHover(word: string, wordEnd: number, line: number, text: string, table: SymbolTable): Hover | null {
		if (word === "true" || word === "false") return this.#toHover("```quartz\nBoolean\n```");
		if (word === "null") return this.#toHover("```quartz\nNull\n```");

		const symbols = this.#symbols;
		const typeDefinition = symbols.getType(word) ?? table.getType(word);
		if (typeDefinition !== null) {
			const memberLines: string[] = [];
			for (const field of typeDefinition.fields) memberLines.push(`  ${field.format()}`);
			for (const { name, parameters, result } of typeDefinition.methods) {
				if (name.startsWith("[")) continue;
				memberLines.push(`  ${name}(${parameters.map(parameter => parameter.format()).join(", ")}) ${result}`);
			}
			const { typeParams, parent } = typeDefinition;
			const generics = typeParams.length > 0 ? `<${typeParams.join(", ")}>` : String.empty;
			const title = `${typeDefinition.name}${generics}`;
			const header = parent !== null ? `${title} from ${parent}` : title;
			const body = memberLines.length > 0 ? `\n${memberLines.join("\n")}\n` : String.empty;
			return this.#toHover(`\`\`\`quartz\n${header} {${body}}\n\`\`\``);
		}

		const { runtime } = symbols;
		const overloads = [...(runtime.getFunctions(word) ?? []), ...(table.getFunctions(word) ?? [])];
		if (overloads.length > 0) {
			const count = OverloadPicker.countAt(text, wordEnd);
			const resolved = overloads[OverloadPicker.pickFor(overloads.map(overload => overload.parameters.length), count)];
			const prefix = resolved.owner !== null ? `${resolved.owner}.` : '';
			const signature = `${prefix}${resolved.name}(${resolved.parameters.map(parameter => parameter.format()).join(", ")}) ${resolved.result}`;
			return this.#toHover(`\`\`\`quartz\n${signature}\n\`\`\`${HoverService.#noteOverload(overloads.length)}`);
		}

		const variable = [...runtime.getVariablesAt(line), ...table.getVariablesAt(line)].find(entry => entry.name === word);
		if (variable !== undefined) return this.#toHover(`\`\`\`quartz\n${variable.name} ${variable.typeName}\n\`\`\``);

		return null;
	}

	#typeRightOf(text: string, start: number, line: number, table: SymbolTable): string | null {
		const symbols = this.#symbols;
		let cursor = start;
		while (cursor < text.length && (text[cursor] === " " || text[cursor] === "\t" || text[cursor] === "\n" || text[cursor] === "\r")) cursor++;
		if (cursor >= text.length) return null;
		if (text[cursor] === '"') return "String";
		if (text[cursor] === "'") return "Character";
		if (text[cursor] >= "0" && text[cursor] <= "9") return "Number";
		if (text[cursor] === "-" || text[cursor] === "+" || text[cursor] === "!") {
			const unary = text[cursor];
			cursor++;
			const operand = this.#typeRightOf(text, cursor, line, table);
			if (operand === null) return null;
			const { base, typeArgs } = TypeResolver.toGeneric(operand);
			const typeDefinition = symbols.getType(base);
			if (typeDefinition === null) return null;
			const substitution = TypeResolver.toSubstitution(typeDefinition.typeParams, typeArgs);
			const { methods } = symbols.getAllMembers(base);
			const unaryMethod = methods.find(method => method.name === `[${unary}]` && method.parameters.length === 0);
			if (unaryMethod === undefined) return operand;
			return TypeResolver.mapWith(unaryMethod.result, substitution);
		}
		if (text[cursor] === "(") return symbols.typeAt(text, this.#endOf(text, cursor), line, table);
		if (!/[A-Za-z_]/.test(text[cursor])) return null;
		const nameStart = cursor;
		while (cursor < text.length && /\w/.test(text[cursor])) cursor++;
		const name = text.slice(nameStart, cursor);
		if (name === "true" || name === "false") return "Boolean";
		if (name === "null") return "Null";
		return symbols.typeAt(text, this.#endOf(text, nameStart), line, table);
	}

	#endOf(text: string, start: number): number {
		let cursor = start;
		while (cursor < text.length) {
			const char = text[cursor];
			if (/[\w.]/.test(char)) { cursor++; continue; }
			if (char === "(") {
				let depth = 1;
				cursor++;
				while (cursor < text.length && depth > 0) {
					if (text[cursor] === "(") depth++;
					else if (text[cursor] === ")") depth--;
					cursor++;
				}
				continue;
			}
			if (char === "[") {
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

	static #noteOverload(count: number): string {
		if (count <= 1) return String.empty;
		const extra = count - 1;
		return `\n_+${extra} ${extra === 1 ? "overload" : "overloads"}_`;
	}

	static #formatParameters(parameters: ParameterDefinition[], substitution: Map<string, string>): string {
		return parameters.map(parameter => new ParameterDefinition(parameter.name, TypeResolver.mapWith(parameter.typeName, substitution)).format()).join(", ");
	}

	#toHover(value: string, range: Span | null = null): Hover {
		return { contents: { kind: MarkupKind.Markdown, value }, range: range?.toRange() };
	}

	#getTokenAt(text: string, position: Position): Token | null {
		const { line, character } = position;
		for (const token of new Lexer().tokenize(text)) {
			const { span } = token;
			if (span.begin.line > line) break;
			if (span.end.line < line) continue;
			if (span.begin.line === line && character < span.begin.column) continue;
			if (span.end.line === line && character >= span.end.column) continue;
			return token;
		}
		return null;
	}
}
//#endregion
