"use strict";

import "adaptive-extender/node";
import { type URI } from "adaptive-extender/node";
import { type ExternalOption, type InputOption, type OutputOptions, type RollupOptions } from "rollup";
import { type BuildOptions, type SSROptions, type UserConfig } from "vite";
import { ViteConfig } from "./vite-config.js";
import { type VitePlugin } from "../plugins/vite-plugin.js";

//#region Node config
export class NodeConfig extends ViteConfig {
	static #lock: boolean = true;
	#inputs: readonly URI[];
	#source: URI;
	#externals: readonly string[];
	#maps: boolean;

	constructor(inputs: readonly URI[], source: URI, output: URI, externals: readonly string[], plugins: readonly VitePlugin[], maps: boolean) {
		super(output, plugins, "node22", "esnext");
		if (NodeConfig.#lock) throw new TypeError("Illegal constructor");
		this.#inputs = inputs;
		this.#source = source;
		this.#externals = externals;
		this.#maps = maps;
	}

	#normalizeInputs(): Record<string, string> {
		const root = this.#source.toPath().replace(/\\/g, "/");
		const entries: Record<string, string> = {};
		for (const uri of this.#inputs) {
			entries[ViteConfig.relative(uri, root)] = uri.toPath();
		}
		return entries;
	}

	#isExternal(id: string): boolean {
		return this.#externals.some(name => id === name || id.startsWith(`${name}/`));
	}

	#buildOutput(): OutputOptions {
		const format = "es" as const;
		const entryFileNames: string = "[name].js";
		const chunkFileNames: string = "chunks/[name].js";
		return { format, entryFileNames, chunkFileNames };
	}

	#buildRollupOptions(): RollupOptions {
		const input: InputOption = this.#normalizeInputs();
		const external: ExternalOption = this.#isExternal.bind(this);
		const output: OutputOptions = this.#buildOutput();
		return { input, external, output };
	}

	#buildEnvironment(): BuildOptions {
		const environment = this.buildEnvironment(this.#buildRollupOptions());
		const ssr: boolean = true;
		const sourcemap: boolean = this.#maps;
		const minify: boolean = false;
		return { ...environment, ssr, sourcemap, minify };
	}

	#buildSSR(): SSROptions {
		const target = "node" as const;
		const noExternal: boolean = true;
		return { target, noExternal };
	}

	build(): UserConfig {
		const { esbuild, plugins } = super.build();
		const build: BuildOptions = this.#buildEnvironment();
		const ssr: SSROptions = this.#buildSSR();
		return { build, ssr, esbuild, plugins };
	}

	static async construct(inputs: readonly URI[], source: URI, output: URI, externals: readonly string[] = [], plugins: readonly VitePlugin[] = [], maps: boolean = false): Promise<NodeConfig> {
		NodeConfig.#lock = false;
		const config = new NodeConfig(inputs, source, output, externals, plugins, maps);
		NodeConfig.#lock = true;
		return config;
	}
}
//#endregion
