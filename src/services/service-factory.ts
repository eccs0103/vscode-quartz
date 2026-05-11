"use strict";

import "adaptive-extender/node";
import { type WorkspaceFolder } from "vscode-languageserver/node.js";
import { SymbolService } from "./symbol-service.js";
import { CompletionService } from "./completion-service.js";
import { HoverService } from "./hover-service.js";
import { SignatureService } from "./signature-service.js";
import { ValidationService } from "../view/validation-service.js";
import { FormattingService } from "../view/formatting-service.js";
import { FoldingService } from "../view/folding-service.js";

//#region Service bundle
export class ServiceBundle {
	#symbolService: SymbolService;
	#completionService: CompletionService;
	#hoverService: HoverService;
	#signatureService: SignatureService;
	#validationService: ValidationService;
	#formattingService: FormattingService;
	#foldingService: FoldingService;

	constructor(symbolService: SymbolService, completionService: CompletionService, hoverService: HoverService, signatureService: SignatureService, validationService: ValidationService, formattingService: FormattingService, foldingService: FoldingService) {
		this.#symbolService = symbolService;
		this.#completionService = completionService;
		this.#hoverService = hoverService;
		this.#signatureService = signatureService;
		this.#validationService = validationService;
		this.#formattingService = formattingService;
		this.#foldingService = foldingService;
	}

	symbolService(): SymbolService { return this.#symbolService; }
	completionService(): CompletionService { return this.#completionService; }
	hoverService(): HoverService { return this.#hoverService; }
	signatureService(): SignatureService { return this.#signatureService; }
	validationService(): ValidationService { return this.#validationService; }
	formattingService(): FormattingService { return this.#formattingService; }
	foldingService(): FoldingService { return this.#foldingService; }

	initialize(workspaceFolders: WorkspaceFolder[]): void {
		this.#symbolService.initialize(workspaceFolders);
	}
}
//#endregion

//#region Service factory
export class ServiceFactory {
	static create(): ServiceBundle {
		const symbolService = new SymbolService();
		return new ServiceBundle(
			symbolService,
			new CompletionService(symbolService),
			new HoverService(symbolService),
			new SignatureService(symbolService),
			new ValidationService(),
			new FormattingService(),
			new FoldingService()
		);
	}
}
//#endregion
