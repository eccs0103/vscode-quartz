# Quartz language support

Provides comprehensive language support for the [Quartz](https://github.com/eccs0103/quartz) (`.qrz`) programming language.

This extension provides support for **Quartz v0.4.2+**.

## Features

- **Syntax Highlighting**: Full syntax highlighting for Quartz keywords, types, functions, operators, and comments
- **Code Formatting**: Automatic code formatting with proper indentation and spacing
- **IntelliSense**: Auto-completion for keywords, types, and built-in functions
- **Hover Information**: Documentation tooltips for language constructs
- **Code Snippets**: Quick snippets for common patterns (variables, loops, conditionals)
- **Bracket Matching**: Auto-closing and auto-surrounding for brackets and quotes
- **Commenting**: Line (`//`) and block (`/* */`) comment support
- **Naming Convention Linting**: Automatic checks for PascalCase (types) and snake_case (variables)

## Language Features

### Syntax Highlighting
Highlights all Quartz language constructs including:
- Keywords: `if`, `else`, `while`, `break`, `continue`
- Types: `Number`, `String`, `Boolean`, `Any`
- Constants: `true`, `false`, `null`
- Operators: arithmetic, comparison, logical, assignment
- Comments: line and block comments

### Code Formatting
Format your code with proper indentation:
- Right-click and select "Format Document"
- Or use keyboard shortcut: `Shift+Alt+F` (Windows/Linux) or `Shift+Option+F` (Mac)

### Code Snippets
Quick snippets for common patterns:
- `var` - Variable declaration
- `num` - Number variable
- `str` - String variable
- `bool` - Boolean variable
- `any` - Any variable
- `opt` - Optional (nullable) variable
- `if` - If statement
- `ifelse` - If-else statement
- `while` - While loop
- `write` - Write to console

### IntelliSense
Auto-completion suggestions for:
- Language keywords and control flow
- Built-in types
- Boolean and null constants
- Built-in functions

### Naming Conventions
The extension automatically warns about naming convention violations:
- **Types** should use PascalCase (e.g., `Number`, `MyType`)
- **Variables** should use snake_case (e.g., `my_variable`, `counter`)

## Requirements

- Visual Studio Code 1.80.0 or higher

## Extension Settings

This extension currently does not add any VS Code settings.

## Known Issues

None at this time. Please report issues on [GitHub](https://github.com/eccs0103/vscode-quartz/issues).

## Release Notes

### 0.2.0

- Added code formatting support
- Added IntelliSense completion
- Added hover documentation
- Added code snippets
- Added comment support (line and block)
- Enhanced syntax highlighting (null, comments, improved operators)
- Added indentation rules
- Added code folding support

### 0.1.4

- Initial release with basic syntax highlighting
- Bracket auto-closing
- Naming convention linting

---

## For More Information

- [Quartz Language Repository](https://github.com/eccs0103/quartz)
- [VS Code Extension Repository](https://github.com/eccs0103/vscode-quartz)

**Enjoy coding in Quartz!**
