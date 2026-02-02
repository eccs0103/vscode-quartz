import * as path from 'path';
import * as vscode from 'vscode';
import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	TransportKind
} from 'vscode-languageclient/node';

let client: LanguageClient;

export function activate(context: vscode.ExtensionContext) {
	// Server module path
	const serverModule = context.asAbsolutePath(
		path.join('out', 'server.js')
	);

	// Debug options for the server
	const debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };

	// Server options
	const serverOptions: ServerOptions = {
		run: { module: serverModule, transport: TransportKind.ipc },
		debug: {
			module: serverModule,
			transport: TransportKind.ipc,
			options: debugOptions
		}
	};

	// Client options
	const clientOptions: LanguageClientOptions = {
		documentSelector: [{ scheme: 'file', language: 'qrz' }],
		synchronize: {
			fileEvents: vscode.workspace.createFileSystemWatcher('**/.qrz')
		}
	};

	// Create the language client
	client = new LanguageClient(
		'quartzLanguageServer',
		'Quartz Language Server',
		serverOptions,
		clientOptions
	);

	// Start the client
	client.start();
}

export function deactivate(): Thenable<void> | undefined {
	if (!client) {
		return undefined;
	}
	return client.stop();
}
