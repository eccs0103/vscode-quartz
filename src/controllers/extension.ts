"use strict";

import "adaptive-extender/node";
import Path from "node:path";
import { type ExtensionContext, workspace } from "vscode";
import { LanguageClient, type LanguageClientOptions, type ServerOptions, TransportKind } from "vscode-languageclient/node.js";

//#region Extension controller
class ExtensionController {
	static #instance: ExtensionController | null = null;
	#client: LanguageClient | null = null;

	static get instance(): ExtensionController {
		if (ExtensionController.#instance === null) {
			ExtensionController.#instance = new ExtensionController();
		}
		return ExtensionController.#instance;
	}

	start(context: ExtensionContext): void {
		const module = context.asAbsolutePath(Path.join("dist", "controllers", "server.js"));
		const serverOptions: ServerOptions = {
			run: { module, transport: TransportKind.ipc },
			debug: { module, transport: TransportKind.ipc, options: { execArgv: ["--nolazy", "--inspect=6009"] } }
		};
		const clientOptions: LanguageClientOptions = {
			documentSelector: [{ scheme: "file", language: "qrz" }],
			synchronize: { fileEvents: workspace.createFileSystemWatcher("**/.qrz") }
		};
		const client = this.#client = new LanguageClient("quartzLanguageServer", "Quartz Language Server", serverOptions, clientOptions);
		void client.start();
	}

	async stop(): Promise<void> {
		const client = this.#client;
		if (client === null) return;
		await client.stop();
	}
}
//#endregion

export function activate(context: ExtensionContext): void {
	ExtensionController.instance.start(context);
}

export function deactivate(): Promise<void> {
	return ExtensionController.instance.stop();
}
