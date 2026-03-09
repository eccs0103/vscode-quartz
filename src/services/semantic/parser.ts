import { Token, TokenType, Range } from './lexer.js';

export interface Symbol {
    name: string;
    kind: 'variable' | 'function' | 'class';
    type?: string;
    range: Range;
    documentation?: string;
}

export class Scope {
    public parent: Scope | null;
    public children: Scope[] = [];
    public symbols: Map<string, Symbol> = new Map();
    public range: Range;

    constructor(parent: Scope | null, range: Range) {
        this.parent = parent;
        this.range = range;
        if (parent) {
            parent.children.push(this);
        }
    }

    public define(symbol: Symbol) {
        this.symbols.set(symbol.name, symbol);
    }

    public resolve(name: string): Symbol | undefined {
        if (this.symbols.has(name)) {
            return this.symbols.get(name);
        }
        return this.parent?.resolve(name);
    }
}

export class Parser {
    private tokens: Token[];
    private cursor: number = 0;
    public rootScope: Scope;
    public currentScope: Scope;

    constructor(tokens: Token[]) {
        this.tokens = tokens;
        this.rootScope = new Scope(null, { startLine: 0, startCol: 0, endLine: Number.MAX_SAFE_INTEGER, endCol: 0 });
        this.currentScope = this.rootScope;
    }

    private get current(): Token {
        return this.tokens[this.cursor] || { type: TokenType.EOF, value: '', range: { startLine: 0, startCol: 0, endLine: 0, endCol: 0 } };
    }

    private advance(): Token {
        const token = this.current;
        if (this.cursor < this.tokens.length) {
            this.cursor++;
        }
        return token;
    }

    private match(type: TokenType, value?: string): boolean {
        if (this.current.type === type && (value === undefined || this.current.value === value)) {
            this.advance();
            return true;
        }
        return false;
    }

    private expect(type: TokenType, value?: string): Token | null {
        if (this.current.type === type && (value === undefined || this.current.value === value)) {
            return this.advance();
        }
        return null; // Graceful failure for IDE
    }

    public parse() {
        while (this.current.type !== TokenType.EOF) {
            if (this.current.type === TokenType.Keyword) {
                if (this.current.value === 'function') {
                    this.parseFunction();
                } else if (this.current.value === 'class') {
                    this.parseClass();
                } else if (['if', 'else', 'while', 'for'].includes(this.current.value)) {
                    this.parseControlFlow();
                } else {
                    this.advance();
                }
            } else if (this.current.type === TokenType.Identifier) {
                // Peek ahead to detect variable declaration like `name Type`
                if (this.cursor + 1 < this.tokens.length) {
                    const next = this.tokens[this.cursor + 1];
                    if (next.type === TokenType.Identifier) {
                        this.parseVariable();
                    } else if (next.value === '(' || next.value === '=' || next.value === ':') {
                        // Just an expression or assignment skip over
                        this.advance();
                    } else {
                        // Might be unassigned type? Let's skip over
                        this.advance();
                    }
                } else {
                    this.advance();
                }
            } else if (this.current.type === TokenType.Bracket && this.current.value === '{') {
                this.enterScope();
                this.advance();
            } else if (this.current.type === TokenType.Bracket && this.current.value === '}') {
                this.leaveScope();
                this.advance();
            } else {
                this.advance();
            }
        }
    }

    private enterScope() {
        const newScope = new Scope(this.currentScope, { startLine: this.current.range.startLine, startCol: this.current.range.startCol, endLine: Number.MAX_SAFE_INTEGER, endCol: 0 });
        this.currentScope = newScope;
    }

    private leaveScope() {
        if (this.currentScope.parent) {
            this.currentScope.range.endLine = this.current.range.endLine;
            this.currentScope.range.endCol = this.current.range.endCol;
            this.currentScope = this.currentScope.parent;
        }
    }

    private parseFunction() {
        this.expect(TokenType.Keyword, 'function');
        const nameToken = this.expect(TokenType.Identifier);
        if (nameToken) {
            this.currentScope.define({
                name: nameToken.value,
                kind: 'function',
                range: nameToken.range,
                documentation: `Function ${nameToken.value}`
            });
        }
    }

    private parseClass() {
        this.expect(TokenType.Keyword, 'class');
        const nameToken = this.expect(TokenType.Identifier);
        if (nameToken) {
            this.currentScope.define({
                name: nameToken.value,
                kind: 'class',
                range: nameToken.range,
                documentation: `Class ${nameToken.value}`
            });
        }
    }

    private parseVariable() {
        const nameToken = this.advance(); // The identifier
        if (this.current.type === TokenType.Identifier) {
            const typeToken = this.advance(); // The type
            this.currentScope.define({
                name: nameToken.value,
                kind: 'variable',
                type: typeToken.value,
                range: nameToken.range,
                documentation: `Variable ${nameToken.value} of type ${typeToken.value}`
            });
        }
    }

    private parseControlFlow() {
        this.advance(); // Skip if/while/for
        // Condition usually follows in ()
        if (this.current.value === '(') {
            // We just let the main loop naturally process contents
        }
    }
}
