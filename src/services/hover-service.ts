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
		const word = this.wordAt(text, offset);
		if (!word) return null;

		const docTable = this.#symService.parse(text);
		return this.makeHover(word, position.line, docTable);
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
			const header = cls.parent ? `${cls.name} from ${cls.parent}` : cls.name;
			const body = memberLines.length > 0 ? `\n${memberLines.join('\n')}\n` : '';
			return this.md(`\`\`\`quartz\n${header} {${body}}\n\`\`\``);
		}

		// Function / method
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

	private wordAt(text: string, offset: number): string | null {
		const ident = /[A-Za-z_]\w*/g;
		let m: RegExpExecArray | null;
		while ((m = ident.exec(text)) !== null) {
			if (m.index <= offset && offset <= m.index + m[0].length) return m[0];
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
