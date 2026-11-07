"use strict";

import "adaptive-extender/node";
import { URI } from "adaptive-extender/node";
import { defineConfig, type UserConfig } from "vite";

export default defineConfig(async (env) => {
	const root: URI = new URI(import.meta.url);
	const inputs: Record<string, string> = {
		extension: new URI("./src/controllers/extension.ts", root).toPath(),
		server: new URI("./src/controllers/server.ts", root).toPath(),
	};
	const output: URI = new URI("./dist", root);
	const config: UserConfig = {
		build: {
			ssr: true,
			target: "node22",
			outDir: output.toPath(),
			emptyOutDir: true,
			sourcemap: true,
			minify: false,
			rollupOptions: {
				input: inputs,
				external: ["vscode"],
				output: {
					format: "es",
					entryFileNames: "controllers/[name].js",
					chunkFileNames: "chunks/[name].js",
				},
			},
		},
		ssr: {
			target: "node",
			noExternal: true,
		},
	};
	return config;
});
