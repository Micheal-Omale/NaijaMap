/// <reference types="geojson" />

interface ImportMetaEnv {
	/** Set to "true" to include draft groups in a private preview build. Never on the public site. */
	readonly NIAJMAP_INCLUDE_DRAFTS?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}

declare module 'mapshaper' {
	const mapshaper: {
		applyCommands(commands: string, inputs?: Record<string, unknown>): Promise<Record<string, string | Uint8Array>>;
	};
	export default mapshaper;
}
