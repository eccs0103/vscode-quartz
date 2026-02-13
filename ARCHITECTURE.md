# Quartz Extension Architecture

## Overview

This extension follows a **clean architecture** pattern with clear separation of concerns:

```
┌─────────────────────────────────────────────┐
│         Language Server Protocol            │
│            (VSCode API)                     │
└──────────────┬──────────────────────────────┘
               │
┌──────────────▼──────────────────────────────┐
│          Providers Layer                    │
│  (LSP-specific implementations)             │
│  - DiagnosticsProvider                      │
│  - FormattingProvider                       │
│  - CompletionProvider                       │
│  - HoverProvider                            │
└──────────────┬──────────────────────────────┘
               │
┌──────────────▼──────────────────────────────┐
│         Services Layer                      │
│  (Business logic, framework-agnostic)       │
│  - ValidationService                        │
│  - FormattingService                        │
│  - CompletionService                        │
│  - HoverService                             │
└──────────────┬──────────────────────────────┘
               │
┌──────────────▼──────────────────────────────┐
│          Models Layer                       │
│  (Pure data, constants, utilities)          │
│  - language-keywords                        │
│  - naming-conventions                       │
│  - hover-data                               │
│  - completion-items                         │
└─────────────────────────────────────────────┘
```

## Layer Responsibilities

### Models Layer (`src/models/`)
**Purpose**: Pure data structures, constants, and utility functions
**Dependencies**: None (completely independent)
**Rules**:
- No business logic
- No external dependencies
- Pure functions only
- Exported constants and interfaces

**Files**:
- `language-keywords.ts`: Keywords, built-in types, functions
- `naming-conventions.ts`: Naming rules (PascalCase, snake_case)
- `hover-data.ts`: Static hover documentation content
- `completion-items.ts`: Completion item definitions

### Services Layer (`src/services/`)
**Purpose**: Business logic and core functionality
**Dependencies**: Models only
**Rules**:
- No LSP-specific code
- Framework-agnostic
- Testable in isolation
- Single responsibility

**Files**:
- `validation-service.ts`: Validates code (naming conventions)
- `formatting-service.ts`: Formats Quartz code
- `completion-service.ts`: Generates completion items
- `hover-service.ts`: Provides hover information

### Providers Layer (`src/providers/`)
**Purpose**: Bridge between Services and LSP
**Dependencies**: Services and LSP types
**Rules**:
- Thin adapters
- LSP-specific implementations
- Delegate logic to services

**Files**:
- `diagnostics-provider.ts`: Wraps ValidationService
- `formatting-provider.ts`: Wraps FormattingService
- `completion-provider.ts`: Wraps CompletionService
- `hover-provider.ts`: Wraps HoverService

### Server (`src/server.ts`)
**Purpose**: Wire everything together
**Dependencies**: All layers
**Rules**:
- Creates instances
- Sets up LSP handlers
- Minimal logic

## Code Style

### Private Fields
Use `#` for private fields (not `private` keyword):
```typescript
export class SomeService {
	readonly #dependency: OtherService;
	
	constructor(dependency: OtherService) {
		this.#dependency = dependency;
	}
}
```

### Regions
Use `#region` comments for code organization:
```typescript
//#region Service name
export class MyService {
	// ...
}
//#endregion
```

### Strict Mode
All files start with:
```typescript
"use strict";
```

### Imports
Use `.js` extensions in imports (for ES modules):
```typescript
import { Something } from './models/something.js';
```

## Benefits of This Architecture

1. **Testability**: Services can be tested independently
2. **Maintainability**: Clear responsibilities
3. **Scalability**: Easy to add new features
4. **Reusability**: Services can be used outside LSP context
5. **Type Safety**: Strong TypeScript typing throughout

## Adding New Features

### 1. Add a new completion item
- Add to `models/completion-items.ts`
- Service automatically picks it up

### 2. Add a new validation rule
- Update `services/validation-service.ts`
- Provider automatically uses it

### 3. Add a new formatting rule
- Update `services/formatting-service.ts`
- Provider automatically applies it

## Testing Approach

Each layer can be tested independently:

```typescript
// Test service (no LSP mocking needed)
const service = new FormattingService();
const result = service.formatCode("unformatted code");
assert.equal(result, "formatted code");

// Test provider (with mock document)
const provider = new FormattingProvider(service);
const edits = provider.provideFormatting(mockDocument);
```

## Patterns Inspired By

This architecture is inspired by:
- **Clean Architecture** (Robert C. Martin)
- **Hexagonal Architecture** (Ports and Adapters)
- **eccs0103's TypeScript projects** (adaptive-extender patterns)

The goal is professional, maintainable, enterprise-grade code structure.
