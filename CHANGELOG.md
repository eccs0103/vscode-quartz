# Change Log

All notable changes to the "quartz-language" extension will be documented in this file.

## 0.3.1 (14.02.2026)

### Changed - Major Refactoring
- **Project Restructure**: Reorganized codebase following clean architecture patterns
  - Created `models/` directory for data structures and constants
  - Created `services/` directory for business logic
  - Created `providers/` directory for LSP-specific implementations
- **Code Organization**:
  - `models/language-keywords.ts`: Language keywords, types, and functions
  - `models/naming-conventions.ts`: Naming convention rules (PascalCase, snake_case)
  - `models/hover-data.ts`: Hover documentation content
  - `models/completion-items.ts`: Completion item definitions
  - `services/validation-service.ts`: Code validation logic
  - `services/formatting-service.ts`: Code formatting logic (improved)
  - `services/completion-service.ts`: Completion generation logic
  - `services/hover-service.ts`: Hover information logic
  - `providers/diagnostics-provider.ts`: Diagnostics provider
  - `providers/formatting-provider.ts`: Formatting provider  
  - `providers/completion-provider.ts`: Completion provider
  - `providers/hover-provider.ts`: Hover provider
- **Formatting Improvements**:
  - Fixed: Unary operators (+, -, !) no longer get spaces after them
  - Fixed: Generic types (e.g., `Array<Number>`) no longer get spaces inside brackets
  - Improved binary operator spacing detection
  - Better handling of complex expressions

### Technical Improvements
- Added "use strict" directive to all modules
- Implemented clean separation of concerns
- Improved code maintainability and testability
- Added comprehensive JSDoc regions (#region/#endregion)
- Better TypeScript patterns following professional standards

## 0.2.0 (14.02.2026)

### Added
- **Code Formatting**: Document formatting provider with automatic indentation and spacing
- **IntelliSense**: Auto-completion for keywords, types, constants, and built-in functions
- **Hover Documentation**: Tooltips with information about language constructs
- **Code Snippets**: Quick snippets for variables, control flow, and common patterns
- **Comment Support**: Line (`//`) and block (`/* */`) comments
- **Enhanced Syntax Highlighting**:
  - Added support for `null` keyword
  - Added comment highlighting
  - Improved operator highlighting (arithmetic, logical, comparison)
  - Better categorization of language constructs
- **Indentation Rules**: Automatic indentation based on braces
- **Code Folding**: Support for region-based folding with `#region` comments

### Changed
- Updated language server capabilities to include formatting, completion, and hover
- Enhanced language configuration with comment definitions and folding markers
- Improved README with comprehensive feature documentation

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
