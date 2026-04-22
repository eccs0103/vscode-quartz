"use strict";

import { Hover, MarkupKind } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { Position } from 'vscode-languageserver/node';
import { SymbolService } from './symbol-service.js';
import { SymbolTable } from './semantic/symbol-table.js';

//#region HoverService
export class HoverService {
	readonly #symService: SymbolService;

	constructor(symService: SymbolService) {
		this.#symService = symService;
	}

	getHover(document: TextDocument, position: Position): Hover | null {
		const text = document.getText();
		const offset = this.lineColToOffset(text, position.line, position.character);
		const found = this.wordAtWithStart(text, offset);
		if (!found) return null;

		const { word, start } = found;
		const docTable = this.#symService.parse(text);

		// Dot-access context: e.g. obj.method or obj.field
		if (start > 0 && text[start - 1] === '.') {
			const objFound = this.wordAtWithStart(text, start - 2);
			if (!objFound) return null;
			const objType = this.#symService.resolveType(objFound.word, position.line, docTable);
			if (!objType) return null;
			return this.makeHoverForMember(word, objType);
		}

		return this.makeHover(word, position.line, docTable);
	}

	private makeHoverForMember(memberName: string, typeName: string): Hover | null {
		const { base, args } = SymbolService.parseGeneric(typeName);
		const cls = this.#symService.runtimeTable.classes.get(base);
		if (!cls) return null;

		const subst = SymbolService.buildSubstitution(cls.typeParams, args);
		const { methods, fields } = this.#symService.getAllMembers(base);

		const matchMethods = methods.filter(m => m.name === memberName && !m.name.startsWith('['));
		if (matchMethods.length > 0) {
			const sigs = matchMethods.map(m => {
				const paramStr = m.params
					.map(p => `${p.name} ${SymbolService.substituteGenerics(p.typeName, subst)}`)
					.join(', ');
				return `${memberName}(${paramStr}) ${SymbolService.substituteGenerics(m.retType, subst)}`;
			}).join('\n');
			return this.md(`\`\`\`quartz\n${sigs}\n\`\`\``);
		}

		const field = fields.find(f => f.name === memberName);
		if (field) return this.md(`\`\`\`quartz\n${memberName} ${SymbolService.substituteGenerics(field.typeName, subst)}\n\`\`\``);

		return null;
	}

	private makeHover(word: string, line: number, docTable: SymbolTable): Hover | null {
		// Class / built-in type
		const cls = this.#symService.runtimeTable.classes.get(word) ?? docTable.classes.get(word);
		if (cls) {
			const memberLines: string[] = [];
			for (const f of cls.fields) memberLines.push(`  ${f.name} ${f.typeName}`);
			for (const m of cls.methods) {
				if (m.name.startsWith('[')) continue;
				const paramStr = m.params.map(p => `${p.name} ${p.typeName}`).join(', ');
				memberLines.push(`  ${m.name}(${paramStr}) ${m.retType}`);
			}
			const typeParamStr = cls.typeParams.length > 0 ? `<${cls.typeParams.join(', ')}>` : '';
			const header = cls.parent
				? `${cls.name}${typeParamStr} from ${cls.parent}`
				: `${cls.name}${typeParamStr}`;
			const body = memberLines.length > 0 ? `\n${memberLines.join('\n')}\n` : '';
			return this.md(`\`\`\`quartz\n${header} {${body}}\n\`\`\``);
		}

		// Global function (runtime + user-defined) — show all overloads
		const rOverloads = this.#symService.runtimeTable.funcs.get(word) ?? [];
		const dOverloads = docTable.funcs.get(word) ?? [];
		const allOverloads = [...rOverloads, ...dOverloads];
		if (allOverloads.length > 0) {
			const sigs = allOverloads
				.map(o => `${o.name}(${o.params.map(p => `${p.name} ${p.typeName}`).join(', ')}) ${o.retType}`)
				.join('\n');
			return this.md(`\`\`\`quartz\n${sigs}\n\`\`\``);
		}

		// Variable in scope
		const allVars = [
			...this.#symService.runtimeTable.getVarsAt(line),
			...docTable.getVarsAt(line)
		];
		const v = allVars.find(x => x.name === word);
		if (v) return this.md(`\`\`\`quartz\n${v.name} ${v.typeName}\n\`\`\``);

		return null;
	}

	private md(value: string): Hover {
		return { contents: { kind: MarkupKind.Markdown, value } };
	}

	private wordAtWithStart(text: string, offset: number): { word: string; start: number } | null {
		const ident = /[A-Za-z_]\w*/g;
		let m: RegExpExecArray | null;
		while ((m = ident.exec(text)) !== null) {
			if (m.index <= offset && offset <= m.index + m[0].length) return { word: m[0], start: m.index };
		}
		return null;
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
