"use strict";

import "adaptive-extender/node";
import { Hover, MarkupKind, Position } from "vscode-languageserver/node.js";
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
	#symbolService: SymbolService;

	constructor(symbolService: SymbolService) {
		this.#symbolService = symbolService;
	}

	getHover(document: TextDocument, position: Position): Hover | null {
		const text = document.getText();
		const token = this.#getTokenAt(text, position);
		if (token === null) return null;

		const line = token.span.begin.line;

		if (token.type === TokenType.string) return this.#toHover("```quartz\nString\n```", token.span);
		if (token.type === TokenType.character) return this.#toHover("```quartz\nCharacter\n```", token.span);
		if (token.type === TokenType.number) return this.#toHover("```quartz\nNumber\n```", token.span);

		const documentTable = this.#symbolService.getDocumentTable(document);

		if (token.type === TokenType.operator && token.value !== ".") {
			const tokenStart = document.offsetAt(token.span.begin.toPosition());
			const tokenEnd = document.offsetAt(token.span.end.toPosition());
			return this.#makeHoverForOperator(token.value, tokenStart, tokenEnd, line, text, documentTable);
		}

		if (token.type !== TokenType.identifier && token.type !== TokenType.keyword) return null;

		const wordStart = document.offsetAt(token.span.begin.toPosition());
		const wordEnd = document.offsetAt(token.span.end.toPosition());

		if (wordStart > 0 && text[wordStart - 1] === ".") {
			const receiverType = this.#symbolService.typeAt(text, wordStart - 1, line, documentTable);
			if (receiverType === null) return null;
			return this.#makeHoverForMember(token.value, wordEnd, receiverType, text);
		}

		return this.#makeHover(token.value, wordEnd, line, text, documentTable);
	}

	#makeHoverForOperator(operator: string, start: number, end: number, line: number, text: string, documentTable: SymbolTable): Hover | null {
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
		const binaryMethods = methods.filter(method => method.name === methodName && method.parameters.length > 0);
		if (binaryMethods.length === 0) return null;

		const rightType = this.#typeRightOf(text, rightStart, line, documentTable);
		if (rightType === null) return null;
		const matched = binaryMethods.filter(method => TypeResolver.mapWith(method.parameters[0].typeName, substitution) === rightType);
		if (matched.length === 0) return null;

		const signature = `${leftType}.[${operator}](${HoverService.#fmtParams(matched[0].parameters, substitution)}) ${TypeResolver.mapWith(matched[0].result, substitution)}`;
		return this.#toHover(`\`\`\`quartz\n${signature}\n\`\`\``);
	}

	#makeUnaryOpHover(operator: string, methodName: string, rightType: string): Hover | null {
		const { base, typeArgs } = TypeResolver.toGeneric(rightType);
		const typeDefinition = this.#symbolService.getType(base);
		if (typeDefinition === undefined) return null;
		const substitution = TypeResolver.toSubstitution(typeDefinition.typeParams, typeArgs);
		const { methods } = this.#symbolService.getAllMembers(base);
		const unary = methods.find(method => method.name === methodName && method.parameters.length === 0);
		if (unary === undefined) return null;
		return this.#toHover(`\`\`\`quartz\n${rightType}.[${operator}]() ${TypeResolver.mapWith(unary.result, substitution)}\n\`\`\``);
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
			const resolved = matching[OverloadPicker.pickFor(matching.map(method => method.parameters.length), argCount)];
			const prefix = (resolved.owner === base) ? typeName : (resolved.owner ?? base);
			const signature = `${prefix}.${memberName}(${HoverService.#fmtParams(resolved.parameters, substitution)}) ${TypeResolver.mapWith(resolved.result, substitution)}`;
			return this.#toHover(`\`\`\`quartz\n${signature}\n\`\`\`${HoverService.#noteOverload(matching.length)}`);
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
			for (const field of typeDefinition.fields) memberLines.push(`  ${field.format()}`);
			for (const { name, parameters, result: returnType } of typeDefinition.methods) {
				if (name.startsWith("[")) continue;
				memberLines.push(`  ${name}(${parameters.map(parameter => parameter.format()).join(", ")}) ${returnType}`);
			}
			const typeParamString = typeDefinition.typeParams.length > 0 ? `<${typeDefinition.typeParams.join(", ")}>` : String.empty;
			const header = typeDefinition.parent !== undefined ? `${typeDefinition.name}${typeParamString} from ${typeDefinition.parent}` : `${typeDefinition.name}${typeParamString}`;
			const body = memberLines.length > 0 ? `\n${memberLines.join("\n")}\n` : String.empty;
			return this.#toHover(`\`\`\`quartz\n${header} {${body}}\n\`\`\``);
		}

		const runtime = symbolService.runtimeTable;
		const allOverloads = [...(runtime.getFunctions(word) ?? []), ...(documentTable.getFunctions(word) ?? [])];
		if (allOverloads.length > 0) {
			const argCount = OverloadPicker.argsAt(text, wordEnd);
			const resolved = allOverloads[OverloadPicker.pickFor(allOverloads.map(overload => overload.parameters.length), argCount)];
			const prefix = resolved.owner !== undefined ? `${resolved.owner}.` : '';
			const signature = `${prefix}${resolved.name}(${resolved.parameters.map(parameter => parameter.format()).join(", ")}) ${resolved.result}`;
			return this.#toHover(`\`\`\`quartz\n${signature}\n\`\`\`${HoverService.#noteOverload(allOverloads.length)}`);
		}

		const variable = [...runtime.getVariablesAt(line), ...documentTable.getVariablesAt(line)].find(entry => entry.name === word);
		if (variable !== undefined) return this.#toHover(`\`\`\`quartz\n${variable.name} ${variable.typeName}\n\`\`\``);

		return null;
	}

	#typeRightOf(text: string, start: number, line: number, documentTable: SymbolTable): string | null {
		let cursor = start;
		while (cursor < text.length && (text[cursor] === " " || text[cursor] === "\t" || text[cursor] === "\n" || text[cursor] === "\r")) cursor++;
		if (cursor >= text.length) return null;
		if (text[cursor] === '"') return "String";
		if (text[cursor] === "'") return "Character";
		if (text[cursor] >= "0" && text[cursor] <= "9") return "Number";
		if (text[cursor] === "-" || text[cursor] === "+" || text[cursor] === "!") {
			const unaryOp = text[cursor];
			cursor++;
			const operandType = this.#typeRightOf(text, cursor, line, documentTable);
			if (operandType === null) return null;
			const { base, typeArgs } = TypeResolver.toGeneric(operandType);
			const typeDefinition = this.#symbolService.getType(base);
			if (typeDefinition === undefined) return null;
			const substitution = TypeResolver.toSubstitution(typeDefinition.typeParams, typeArgs);
			const { methods } = this.#symbolService.getAllMembers(base);
			const unaryMethod = methods.find(m => m.name === `[${unaryOp}]` && m.parameters.length === 0);
			if (unaryMethod === undefined) return operandType;
			return TypeResolver.mapWith(unaryMethod.result, substitution);
		}
		if (text[cursor] === "(") {
			const exprEnd = this.#scanExprEnd(text, cursor);
			return this.#symbolService.typeAt(text, exprEnd, line, documentTable);
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

	static #noteOverload(count: number): string {
		if (count <= 1) return String.empty;
		const extra = count - 1;
		return `\n_+${extra} ${extra === 1 ? "overload" : "overloads"}_`;
	}

	static #fmtParams(parameters: ParameterDefinition[], substitution: Map<string, string>): string {
		return parameters.map(p => new ParameterDefinition(p.name, TypeResolver.mapWith(p.typeName, substitution)).format()).join(", ");
	}

	#toHover(value: string, range?: Span): Hover {
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
