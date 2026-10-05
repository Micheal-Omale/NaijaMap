/// <reference types="geojson" />

interface ImportMetaEnv {
	/** Set to "true" to include draft groups in a private preview build. Never on the public site. */
	readonly NIAJMAP_INCLUDE_DRAFTS?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
