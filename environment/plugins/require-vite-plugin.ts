"use strict";

import "adaptive-extender/node";
import { type AliasOptions, type PluginOption, type UserConfig } from "vite";
import Module from "node:module";
import { VitePlugin } from "./vite-plugin.js";

//#region Require Vite plugin
export class RequireVitePlugin extends VitePlugin {
	#packages: readonly string[];

	constructor(packages: readonly string[]) {
		super("require");
		this.#packages = packages;
	}

	#config(): UserConfig {
		const require = Module.createRequire(import.meta.url);
		const alias: AliasOptions = Object.fromEntries(this.#packages.map(name => [name, require.resolve(name)]));
		return { resolve: { alias } };
	}

	build(): PluginOption {
		const name: string = "require";
		const config = this.#config.bind(this);
		return { name, config };
	}
}
//#endregion
