interface ImportMetaEnv {
    readonly DEV: boolean;
    readonly PROD: boolean;
    readonly MODE: string;
    readonly VITE_AUTH_API_URL?: string;
    readonly VITE_GAME_SERVER_URL?: string;
    readonly VITE_ASSETS_BASE_URL?: string;
    readonly VITE_ANDROID_ASSETS_BASE_URL?: string;
    readonly VITE_ANDROID_CONTROL_ASSETS_BASE_URL?: string;
    readonly VITE_ANDROID_DOWNLOAD_ASSETS_BASE_URL?: string;
    readonly VITE_ASSET_SOURCE?: string;
    readonly VITE_DEV_REMOTE_ASSETS?: string;
    readonly VITE_APP_VERSION?: string;
    readonly VITE_APP_COMMIT_SHA?: string;
    readonly VITE_APP_BUILD_TIME?: string;
    readonly VITE_APP_RELEASE_CHANNEL?: string;
    readonly VITE_MOBILE_OTA_ENABLED?: string;
    readonly VITE_MOBILE_OTA_ALLOW_DEBUG_APP?: string;
    readonly VITE_MOBILE_OTA_MANIFEST_URL?: string;
    readonly VITE_MOBILE_OTA_MANIFEST_FALLBACK_URLS?: string;
    readonly VITE_MOBILE_OTA_CHANNEL?: string;
    readonly VITE_MOBILE_OTA_APP_READY_TIMEOUT_MS?: string;
    readonly VITE_IOS_OTA_ENABLED?: string;
    readonly VITE_IOS_OTA_ALLOW_DEBUG_APP?: string;
    readonly VITE_IOS_OTA_MANIFEST_URL?: string;
    readonly VITE_IOS_OTA_MANIFEST_FALLBACK_URLS?: string;
    readonly VITE_IOS_OTA_CHANNEL?: string;
    readonly VITE_IOS_OTA_APP_READY_TIMEOUT_MS?: string;
    readonly VITE_ANDROID_OTA_ENABLED?: string;
    readonly VITE_ANDROID_OTA_ALLOW_DEBUG_APP?: string;
    readonly VITE_ANDROID_OTA_MANIFEST_URL?: string;
    readonly VITE_ANDROID_OTA_MANIFEST_FALLBACK_URLS?: string;
    readonly VITE_ANDROID_OTA_CHANNEL?: string;
    readonly VITE_ANDROID_OTA_APP_READY_TIMEOUT_MS?: string;
    readonly VITE_ANDROID_NATIVE_UPDATE_ENABLED?: string;
    readonly VITE_ANDROID_NATIVE_UPDATE_ALLOW_DEBUG_APP?: string;
    readonly VITE_ANDROID_NATIVE_UPDATE_MANIFEST_URL?: string;
    readonly VITE_ANDROID_NATIVE_UPDATE_MANIFEST_FALLBACK_URLS?: string;
    readonly VITE_ANDROID_NATIVE_UPDATE_CHANNEL?: string;
    readonly VITE_ANDROID_APP_DOWNLOAD_URL?: string;
    readonly VITE_AI_REPO_WORKBENCH_DEFAULT_PROJECT_PATH?: string;
    readonly VITE_AI_REPO_WORKBENCH_DEFAULT_BRANCH?: string;
    readonly VITE_CAPACITOR_APP_ID?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}

/** 构建时注入的 locale JSON content hash 映射（由 vite-locale-hash 插件生成） */
declare const __LOCALE_HASHES__: Record<string, string>;
/** 构建时注入的 public/assets content hash 映射（由 vite-asset-hash 插件生成） */
declare const __ASSET_HASHES__: Record<string, string>;
/** 构建时注入的语言化图片存在索引（由 vite-asset-hash 插件生成） */
declare const __LOCALIZED_IMAGE_INDEX__: Record<string, 1>;
/** 构建时注入的 public 根目录静态文件 content hash 映射（fonts/logos/game-data） */
declare const __PUBLIC_FILE_HASHES__: Record<string, string>;

declare module '*.yaml?raw' {
    const content: string;
    export default content;
}

declare module '*.yml?raw' {
    const content: string;
    export default content;
}
