"use strict";

export enum SymbolKind {
	Function,
	Variable,
	Class
}

export interface ParsedSymbol {
	name: string;
	kind: SymbolKind;
	detail: string;
	signature?: string;
}

export class QuartzParser {
	public static parse(text: string, sourceName: string = 'document'): ParsedSymbol[] {
		const symbols: ParsedSymbol[] = [];
		const added = new Set<string>();

		const addSymbol = (name: string, kind: SymbolKind, detail: string, signature?: string) => {
			if (!added.has(name) && !this.isKeyword(name)) {
				symbols.push({ name, kind, detail, signature });
				added.add(name);
			}
		};

		// 1. Lexical Scanner: Strip comments and strings, emit basic tokens
		const tokens: string[] = [];
		let i = 0;
		while (i < text.length) {
			// skip whitespace
			if (/\s/.test(text[i])) { i++; continue; }
			
			// skip line comments
			if (text[i] === '/' && text[i + 1] === '/') {
				while (i < text.length && text[i] !== '\n') i++;
				continue;
			}
			
			// skip block comments
			if (text[i] === '/' && text[i + 1] === '*') {
				i += 2;
				while (i < text.length - 1 && !(text[i] === '*' && text[i + 1] === '/')) i++;
				i += 2;
				continue;
			}
			
			// skip strings
			if (text[i] === '"' || text[i] === "'") {
				const quote = text[i++];
				while (i < text.length && text[i] !== quote) {
					if (text[i] === '\\') i++;
					i++;
				}
				i++;
				continue;
			}

			// identifiers/keywords
			if (/[a-zA-Z_]/.test(text[i])) {
				let start = i;
				while (i < text.length && /[a-zA-Z0-9_]/.test(text[i])) i++;
				tokens.push(text.substring(start, i));
				continue;
			}

			// other chars (punctuation etc)
			tokens.push(text[i]);
			i++;
		}

		// 2. Syntactic Parser: build symbol table
		for (let t = 0; t < tokens.length; t++) {
			const token = tokens[t];

			// Function rules
			if (token === 'function' && t + 1 < tokens.length) {
				const fnName = tokens[t + 1];
				let args = "()";
				// simple lookahead for arguments signature
				if (tokens[t + 2] === '(') {
					let end = t + 2;
					while (tokens[end] !== ')' && end < tokens.length) end++;
					if (end < tokens.length) {
						args = tokens.slice(t + 2, end + 1).join('');
					}
				}
				const signature = `function ${fnName}${args}`;
				addSymbol(fnName, SymbolKind.Function, `Function from ${sourceName}`, signature);
				t++; continue; // skip the name in next iteration
			}

			// Class rules
			if (token === 'class' && t + 1 < tokens.length) {
				const className = tokens[t + 1];
				addSymbol(className, SymbolKind.Class, `Class from ${sourceName}`, `class ${className}`);
				t++; continue;
			}

			// Variable rules (Identifier followed by a Type identifier starting with UpperCase)
			if (/^[a-z_][a-zA-Z0-9_]*$/.test(token) && t + 1 < tokens.length && /^[A-Z][a-zA-Z0-9_]*$/.test(tokens[t + 1])) {
				const typeName = tokens[t + 1];
				// Skip if the "uppercase" word is actually a keyword (which shouldn't happen by conventions, but just to be safe)
				if (!this.isKeyword(typeName)) {
					addSymbol(token, SymbolKind.Variable, `Variable pattern matched in ${sourceName}`, `${token} ${typeName}`);
				}
			}
		}

		return symbols;
	}

	private static isKeyword(word: string): boolean {
		const keywords = ["if", "else", "while", "for", "true", "false", "function", "return", "class", "namespace", "to", "as", "is"];
		return keywords.includes(word);
	}
}
