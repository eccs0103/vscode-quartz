"use strict";

import "adaptive-extender/node";
import { type WorkspaceFolder } from "vscode-languageserver-types";
import { SymbolService } from "./symbol-service.js";
import { CompletionService } from "./completion-service.js";
import { HoverService } from "./hover-service.js";
import { SignatureService } from "./signature-service.js";
import { ValidationService } from "../view/validation-service.js";
import { FormattingService } from "../view/formatting-service.js";
import { FoldingService } from "../view/folding-service.js";

//#region Service bundle
export class ServiceBundle {
	#symbols: SymbolService;
	#completion: CompletionService;
	#hover: HoverService;
	#signature: SignatureService;
	#validation: ValidationService;
	#formatting: FormattingService;
	#folding: FoldingService;

	constructor(symbols: SymbolService, completion: CompletionService, hover: HoverService, signature: SignatureService, validation: ValidationService, formatting: FormattingService, folding: FoldingService) {
		this.#symbols = symbols;
		this.#completion = completion;
		this.#hover = hover;
		this.#signature = signature;
		this.#validation = validation;
		this.#formatting = formatting;
		this.#folding = folding;
	}

	get symbols(): SymbolService { return this.#symbols; }
	get completion(): CompletionService { return this.#completion; }
	get hover(): HoverService { return this.#hover; }
	get signature(): SignatureService { return this.#signature; }
	get validation(): ValidationService { return this.#validation; }
	get formatting(): FormattingService { return this.#formatting; }
	get folding(): FoldingService { return this.#folding; }

	initialize(folders: WorkspaceFolder[]): void {
		this.#symbols.initialize(folders);
	}
}
//#endregion

//#region Service factory
export class ServiceFactory {
	static create(): ServiceBundle {
		const symbols = new SymbolService();
		return new ServiceBundle(
			symbols,
			new CompletionService(symbols),
			new HoverService(symbols),
			new SignatureService(symbols),
			new ValidationService(),
			new FormattingService(),
			new FoldingService()
		);
	}
}
//#endregion
