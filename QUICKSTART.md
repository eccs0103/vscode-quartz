# Quartz Extension - Quick Start

## Installation (For Development)

1. Clone or copy the VSCode Quartz extension folder
2. Open the folder in VS Code
3. Run `npm install` to install dependencies
4. Press F5 to launch Extension Development Host
5. Open a `.qrz` file to test the extension

## Features Overview

### 1. Syntax Highlighting
All Quartz language elements are highlighted:
- **Keywords**: `if`, `else`, `while`, `break`, `continue`
- **Types**: `Number`, `String`, `Boolean`, `Any`
- **Constants**: `true`, `false`, `null`
- **Comments**: `//` and `/* */`

### 2. Auto-Completion (IntelliSense)
Press `Ctrl+Space` to trigger completions:
- Keywords and control structures
- Built-in types
- Constants and built-in functions

### 3. Code Formatting
Format your code with proper indentation:
- **Windows/Linux**: `Shift+Alt+F`
- **Mac**: `Shift+Option+F`
- Or right-click → "Format Document"

### 4. Code Snippets
Type these prefixes and press `Tab`:
- `var` → Variable declaration
- `num` → Number variable
- `str` → String variable  
- `bool` → Boolean variable
- `any` → Any variable
- `opt` → Optional variable
- `if` → If statement
- `ifelse` → If-else statement
- `while` → While loop
- `write` → Write to console

### 5. Hover Documentation
Hover over keywords, types, or functions to see documentation.

### 6. Naming Convention Linting
The extension automatically checks:
- **Types** should use PascalCase (e.g., `MyType`, `Number`)
- **Variables** should use snake_case (e.g., `my_var`, `counter`)

Violations show as warnings with suggestions.

## Example Code

```quartz
// Variables
counter Number(0);
message String("Hello!");
is_ready Boolean(true);

// Optional
optional_value Number?;
optional_value : 42;

// Control flow
if (counter < 10) {
	counter : counter + 1;
	write(counter);
}

// Loops
while (counter > 0) {
	counter : counter - 1;
}
```

## Keyboard Shortcuts

- `Ctrl+Space` - Trigger IntelliSense
- `Ctrl+/` - Toggle line comment
- `Shift+Alt+A` - Toggle block comment
- `Shift+Alt+F` - Format document
- `Ctrl+K Ctrl+C` - Add line comment
- `Ctrl+K Ctrl+U` - Remove line comment

## File Association

Files with `.qrz` extension are automatically recognized as Quartz files.

## Troubleshooting

### Extension not working?
1. Reload VS Code (`Ctrl+R`)
2. Check if `.qrz` file is opened
3. Look at Output panel (View → Output → Quartz Language Server)

### Formatting not working?
1. Ensure document is saved
2. Check that file has `.qrz` extension
3. Try formatting selection instead of whole document

### Completions not showing?
1. Manually trigger with `Ctrl+Space`
2. Check if IntelliSense is enabled in settings

## More Information

- [GitHub Repository](https://github.com/eccs0103/vscode-quartz)
- [Quartz Language](https://github.com/eccs0103/quartz)
- See `DEVELOPER.md` for development info
- See `CHANGELOG.md` for version history
