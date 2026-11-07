"use strict";

import { defineConfig, type UserConfig } from "vite";

export default defineConfig(async (env) => {
	void env;
	const config: UserConfig = {
		build: {
			ssr: true,
			target: "node22",
			outDir: "dist",
			emptyOutDir: true,
			sourcemap: true,
			minify: false,
			rollupOptions: {
				input: {
					extension: "src/controllers/extension.ts",
					server: "src/controllers/server.ts",
				},
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
