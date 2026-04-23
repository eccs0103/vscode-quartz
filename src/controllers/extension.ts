"use strict";

import * as path from "path";
import * as vscode from "vscode";
import { LanguageClient, type LanguageClientOptions, type ServerOptions, TransportKind } from "vscode-languageclient/node";

//#region Extension controller
class ExtensionController {
	#client: LanguageClient | undefined;

	start(context: vscode.ExtensionContext): void {
		const module = context.asAbsolutePath(path.join("out", "controllers", "server.js"));
		const serverOptions: ServerOptions = {
			run: { module, transport: TransportKind.ipc },
			debug: { module, transport: TransportKind.ipc, options: { execArgv: ["--nolazy", "--inspect=6009"] } }
		};
		const clientOptions: LanguageClientOptions = {
			documentSelector: [{ scheme: "file", language: "qrz" }],
			synchronize: { fileEvents: vscode.workspace.createFileSystemWatcher("**/.qrz") }
		};
		this.#client = new LanguageClient("quartzLanguageServer", "Quartz Language Server", serverOptions, clientOptions);
		this.#client.start();
	}

	stop(): Thenable<void> | undefined {
		return this.#client?.stop();
	}
}
//#endregion

const controller = new ExtensionController();

export function activate(context: vscode.ExtensionContext): void {
	controller.start(context);
}

export function deactivate(): Thenable<void> | undefined {
	return controller.stop();
}
