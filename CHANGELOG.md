## 0.4.0 (25.02.2026)
- Improved auto-completion: more relevant and contextual suggestions, expanded built-ins and types.
- Richer hover tooltips: clearer descriptions and examples for functions, types and constants.
- Formatting fixes and improvements: smarter spacing around operators, better generic/type formatting, and more stable expression formatting.
- Syntax highlighting updates: improved keyword/operator/token highlighting and bracket handling.
- Language configuration tweaks: better comment, folding and indentation behaviour.
- Package and metadata updates: small dependency and packaging fixes.
- Misc: several bug fixes and stability improvements.

## 0.3.2 (14.02.2026)
- Reorganized codebase following clean architecture patterns (moved code into `models/`, `services/`, `providers/`).
- Split language data and behavior into dedicated modules (keywords, hover data, completion items, naming conventions).
- Improved formatting logic and fixes for spacing around unary/binary operators and generic type brackets.
- Added providers for diagnostics, formatting, completion and hover.
- Added "use strict" across modules and improved TypeScript patterns and JSDoc regions.

## 0.2.0 (14.02.2026)
- Added document formatting provider with automatic indentation and spacing.
- Added auto-completion for keywords, types, constants, and built-in functions.
- Added hover tooltips with information about language constructs.
- Added code snippets for common patterns and comment support (`//`, `/* */`).
- Improved syntax highlighting (including `null`), operator highlighting, indentation rules and region folding (`#region`).
- Updated language server capabilities and enhanced language configuration and README.

## 0.1.4 (03.02.2026)
- Added naming convention validation (PascalCase for types, snake_case for variables).
- Warning diagnostics for naming convention violations.

## 0.1.3 (18.11.2025)
- Added `while`, `repeat`, `for`, `in`, `break`, `continue` highlighting.

## 0.1.2 (17.11.2025)
- Added `[`, `]`.
- Fixed `true` / `false` highlighting.

## 0.1.1 (15.11.2025)
*Initial release*
