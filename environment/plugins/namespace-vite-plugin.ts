"use strict";

import "adaptive-extender/node";
import { type PluginOption, type UserConfig } from "vite";
import { VitePlugin } from "./vite-plugin.js";

//#region Namespace Vite plugin
export class NamespaceVitePlugin extends VitePlugin {
	#packages: readonly string[];

	constructor(packages: readonly string[]) {
		super("namespace");
		this.#packages = packages;
	}

	#config(): UserConfig {
		const esmExternals: string[] = Array.from(this.#packages);
		return { build: { commonjsOptions: { esmExternals } } };
	}

	build(): PluginOption {
		const name: string = "namespace";
		const config = this.#config.bind(this);
		return { name, config };
	}
}
//#endregion
