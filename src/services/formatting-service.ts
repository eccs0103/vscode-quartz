"use strict";

//#region Formatting service
export class FormattingService {
	formatCode(code: string): string {
		const lines = code.split('\n');
		const formatted: string[] = [];
		let indentLevel = 0;
		const indentChar = '\t';

		for (let i = 0; i < lines.length; i++) {
			let line = lines[i].trim();
			
			// Skip empty lines but preserve them
			if (line.length === 0) {
				formatted.push('');
				continue;
			}

			// Skip formatting for comments
			const isComment = line.startsWith('//') || line.startsWith('/*') || line.startsWith('*');

			// Decrease indent for closing braces
			if (line.startsWith('}')) {
				indentLevel = Math.max(0, indentLevel - 1);
			}

			// Add indentation
			const indentedLine = indentChar.repeat(indentLevel) + line;
			formatted.push(indentedLine);

			// Increase indent after opening braces
			if (line.endsWith('{') && !isComment) {
				indentLevel++;
			} else if (line.includes('{') && !line.includes('}') && !isComment) {
				indentLevel++;
			}
			
			// Handle closing brace on same line
			if (line.includes('}') && line.includes('{')) {
				// Handle } else { pattern
				const openCount = (line.match(/\{/g) || []).length;
				const closeCount = (line.match(/\}/g) || []).length;
				if (closeCount > openCount) {
					indentLevel = Math.max(0, indentLevel - (closeCount - openCount));
				}
			}
		}

		let result = formatted.join('\n');
		
		// Formatting improvements (avoiding strings and comments)
		const formattedLines = result.split('\n').map(line => {
			// Don't format comment lines
			const trimmed = line.trim();
			if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
				return line;
			}

			return this.#formatLine(line);
		});
		
		return formattedLines.join('\n');
	}

	#formatLine(line: string): string {
		const indent = line.match(/^\s*/)?.[0] || '';
		const content = line.trim();
		
		// Split by strings to avoid formatting inside them
		let inString = false;
		let stringChar = '';
		let result = '';
		
		for (let i = 0; i < content.length; i++) {
			const char = content[i];
			const prev = i > 0 ? content[i - 1] : '';
			const next = i < content.length - 1 ? content[i + 1] : '';
			
			// Handle string boundaries
			if ((char === '"' || char === "'") && (i === 0 || content[i - 1] !== '\\')) {
				if (!inString) {
					inString = true;
					stringChar = char;
				} else if (stringChar === char) {
					inString = false;
					stringChar = '';
				} else {
					result += char;
					continue;
				}
				result += char;
				continue;
			}
			
			// Don't format inside strings
			if (inString) {
				result += char;
				continue;
			}
			
			// Handle keywords before (
			if (char === '(' && i > 0) {
				const beforeParen = result.match(/\b(if|else|while|for|in)$/);
				if (beforeParen && result[result.length - 1] !== ' ') {
					result += ' ';
				}
			}
			
			// Handle commas
			if (char === ',') {
				result += char;
				if (next && next !== ' ') {
					result += ' ';
				}
				continue;
			}
			
			// Handle comments at the end of the line
			if (char === '/' && next === '/') {
				// Add space before comment if needed
				if (result.length > 0 && result[result.length - 1] !== ' ') {
					result += ' ';
				}
				result += content.substring(i);
				break;
			}
			
			// Handle operators - but distinguish unary from binary
			if (/[:=!&|<>]/.test(char) || (char === '+' || char === '-' || char === '*' || char === '/')) {
				const prevChar = result[result.length - 1];
				
				// Check if this is a unary operator
				const isUnary = (char === '+' || char === '-' || char === '!') && 
					(/[\s(,:]$/.test(result) || result.length === 0);
				
				// Check if this is inside generics < >
				const isGeneric = (char === '<' || char === '>') && 
					(/[A-Z][a-zA-Z0-9_]*$/.test(result) || /^[A-Z]/.test(next));
				
				if (isUnary) {
					// Don't add space before unary operators
					result += char;
				} else if (isGeneric) {
					// Don't add spaces around generics
					result += char;
				} else {
					// Binary operator - add spaces
					if (prevChar && prevChar !== ' ' && /[a-zA-Z0-9_)>]/.test(prevChar)) {
						result += ' ';
					}
					result += char;
					
					// Handle compound operators like <=, >=, !=, ==
					if ((char === '<' || char === '>' || char === '!' || char === '=') && next === '=') {
						result += next;
						i++;
						if (i < content.length - 1 && content[i + 1] !== ' ') {
							result += ' ';
						}
						continue;
					}
					
					if (next && next !== ' ' && /[a-zA-Z0-9_("<]/.test(next) && !isGeneric) {
						result += ' ';
					}
				}
				continue;
			}
			
			result += char;
		}
		
		// Clean up multiple spaces, but preserve spaces in comments
		const commentIndex = result.indexOf('//');
		if (commentIndex !== -1) {
			const codePart = result.substring(0, commentIndex);
			const commentPart = result.substring(commentIndex);
			result = codePart.replace(/\s+/g, ' ').replace(/\s+([;,)])/g, '$1') + commentPart;
		} else {
			result = result.replace(/\s+/g, ' ').replace(/\s+([;,)])/g, '$1');
		}
		
		return indent + result;
	}
}
//#endregion
