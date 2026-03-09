export enum TokenType {
    Number = 'Number',
    Character = 'Character',
    String = 'String',
    Identifier = 'Identifier',
    Keyword = 'Keyword',
    Operator = 'Operator',
    Bracket = 'Bracket',
    Separator = 'Separator',
    EOF = 'EOF'
}

export interface Range {
    startLine: number;
    startCol: number;
    endLine: number;
    endCol: number;
}

export interface Token {
    type: TokenType;
    value: string;
    range: Range;
}

export class Lexer {
    private code: string;
    private cursor: number = 0;
    private line: number = 0;
    private col: number = 0;

    private readonly patterns: { regex: RegExp, type: TokenType | null }[] = [
        { regex: /^\s+/, type: null },
        { regex: /^\/\/[^\n\r]*/, type: null },
        { regex: /^\/\*[\s\S]*?\*\//, type: null },
        { regex: /^\d+(\.\d+)?/, type: TokenType.Number },
        { regex: /^"([^"\\]|\\.)*"/, type: TokenType.String },
        { regex: /^'([^'\\]|\\.)'/, type: TokenType.Character },
        { regex: /^(>=?|<=?|!=|=|\+|-|\*|\/|%|:|\?|&|\||!|\.)/, type: TokenType.Operator },
        { regex: /^[A-Za-z_]\w*/, type: TokenType.Identifier },
        { regex: /^[(){}[\]]/, type: TokenType.Bracket },
        { regex: /^[;,]/, type: TokenType.Separator }
    ];

    private readonly keywords = new Set([
        "if", "else", "while", "for", "true", "false", "function", "return", "class", "namespace", "to", "as", "is"
    ]);

    constructor(code: string) {
        this.code = code;
    }

    public tokenize(): Token[] {
        const tokens: Token[] = [];
        
        while (this.cursor < this.code.length) {
            const remaining = this.code.slice(this.cursor);
            let matched = false;

            for (const { regex, type } of this.patterns) {
                const match = regex.exec(remaining);
                if (match) {
                    const value = match[0];
                    const startLine = this.line;
                    const startCol = this.col;

                    // Update cursor and lines
                    for (const char of value) {
                        if (char === '\n') {
                            this.line++;
                            this.col = 0;
                        } else {
                            this.col++;
                        }
                    }

                    if (type !== null) {
                        let finalType = type;
                        if (type === TokenType.Identifier && this.keywords.has(value)) {
                            finalType = TokenType.Keyword;
                        }
                        
                        tokens.push({
                            type: finalType,
                            value,
                            range: { startLine, startCol, endLine: this.line, endCol: this.col }
                        });
                    }

                    this.cursor += value.length;
                    matched = true;
                    break;
                }
            }

            if (!matched) {
                // Skip unknown character to recover gracefully in IDE
                const char = this.code[this.cursor];
                if (char === '\n') {
                    this.line++;
                    this.col = 0;
                } else {
                    this.col++;
                }
                this.cursor++;
            }
        }
        
        tokens.push({
            type: TokenType.EOF,
            value: '',
            range: { startLine: this.line, startCol: this.col, endLine: this.line, endCol: this.col }
        });

        return tokens;
    }
}
