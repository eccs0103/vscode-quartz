# VS Code Quartz Extension - Developer Guide

## Project Structure

```
VSCode Quartz/
├── src/
│   ├── extension.ts      # Extension entry point, activates language client
│   └── server.ts         # Language server implementation
├── syntaxes/
│   └── qrz.tmLanguage.json  # TextMate grammar for syntax highlighting
├── snippets/
│   └── qrz.json         # Code snippets
├── images/
│   └── icon.png         # Extension icon
├── language-configuration.json  # Language configuration (brackets, comments, etc.)
├── package.json         # Extension manifest
├── tsconfig.json        # TypeScript configuration
└── README.md           # User documentation
```

## Features Implemented

### 1. Syntax Highlighting (syntaxes/qrz.tmLanguage.json)
- Keywords: if, else, while, break, continue
- Types: Number, String, Boolean, Any (PascalCase)
- Variables and functions (snake_case)
- Operators: arithmetic, logical, comparison, assignment
- Constants: true, false, null
- Comments: line (//) and block (/* */)
- Strings

### 2. Language Configuration (language-configuration.json)
- Bracket pairs: {}, (), []
- Auto-closing pairs
- Comment tokens
- Indentation rules
- Code folding markers (#region/#endregion)

### 3. Language Server (src/server.ts)

#### Diagnostics
- Naming convention validation:
  - Types must be PascalCase
  - Variables must be snake_case
  
#### Code Formatting
- Automatic indentation based on braces
- Spacing around operators
- Spacing after keywords
- Comma spacing
- Preserves strings and comments

#### Auto-completion
- Keywords and control flow
- Built-in types
- Constants (true, false, null)
- Built-in functions (write)

#### Hover Information
- Documentation tooltips for:
  - Keywords
  - Types
  - Constants
  - Functions

### 4. Code Snippets (snippets/qrz.json)
- Variable declarations (var, num, str, bool, any, opt)
- Control flow (if, ifelse, while)
- Function calls (write)
- Comments

## Building and Testing

### Compile
```bash
npm run compile
```

### Watch mode (during development)
```bash
npm run watch
```

### Testing
1. Press F5 in VS Code to launch Extension Development Host
2. Open a .qrz file
3. Test features:
   - Syntax highlighting
   - Type a keyword and see auto-completion (Ctrl+Space)
   - Hover over keywords to see documentation
   - Format document (Shift+Alt+F)
   - Use snippets (type prefix and press Tab)

## Quartz Language Grammar

Based on Grammar.ebnf:

- **Variables**: `name Type(value);`
- **Optional**: `name Type?;`
- **Assignment**: `name : value;`
- **If**: `if (condition) { ... } [else { ... }]`
- **While**: `while (condition) { ... }`
- **Types**: Number, String, Boolean, Any
- **Operators**: 
  - Arithmetic: +, -, *, /
  - Comparison: <, >, <=, >=, =, !=
  - Logical: &, |, !
  - Assignment: :

## Extension Development

### Adding New Features

#### 1. New Keyword
1. Add to KEYWORDS set in server.ts
2. Add to keywords pattern in qrz.tmLanguage.json
3. Add completion item in onCompletion handler
4. Add hover content in getHoverContent

#### 2. New Type
1. Add completion item with CompletionItemKind.Class
2. Add hover documentation
3. Already highlighted via PascalCase pattern

#### 3. New Snippet
Add to snippets/qrz.json with:
- prefix: trigger text
- body: template with placeholders ($1, $2, $0)
- description: shown in completion list

### Publishing
```bash
# Install vsce
npm install -g @vscode/vsce

# Package
vsce package

# Publish
vsce publish
```

## Version History

- **0.2.0**: Added formatting, IntelliSense, hover, snippets, comments
- **0.1.4**: Added naming convention validation
- **0.1.3**: Added control flow keywords
- **0.1.2**: Fixed boolean highlighting
- **0.1.1**: Initial release with basic syntax highlighting
