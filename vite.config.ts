"use strict";

import "adaptive-extender/node";
import { URI } from "adaptive-extender/node";
import { defineConfig } from "vite";
import { type ViteConfig } from "./environment/configs/vite-config.js";
import { NodeConfig } from "./environment/configs/node-config.js";
import { type VitePlugin } from "./environment/plugins/vite-plugin.js";
import { RequireVitePlugin } from "./environment/plugins/require-vite-plugin.js";
import { NamespaceVitePlugin } from "./environment/plugins/namespace-vite-plugin.js";

export default defineConfig(async (env) => {
	const root: URI = new URI(import.meta.url);
	const inputs: URI[] = [
		new URI("./src/controllers/extension.ts", root),
		new URI("./src/controllers/server.ts", root),
	];
	const source: URI = new URI("./src/", root);
	const output: URI = new URI("./dist", root);
	const externals: string[] = ["vscode"];
	const plugins: VitePlugin[] = [new RequireVitePlugin(["vscode-languageserver-types"]), new NamespaceVitePlugin(externals)];
	const config: ViteConfig = await NodeConfig.construct(inputs, source, output, externals, plugins, true);
	return config.build();
});
