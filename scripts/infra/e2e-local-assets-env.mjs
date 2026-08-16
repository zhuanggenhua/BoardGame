export const E2E_LOCAL_ASSET_ENV = Object.freeze({
    VITE_ASSETS_BASE_URL: '/assets',
    VITE_ASSET_SOURCE: 'local',
    VITE_DEV_REMOTE_ASSETS: 'false',
    VITE_E2E_LOCAL_ASSETS_ONLY: 'true',
});

export function withE2ELocalAssetEnv(env = {}) {
    return {
        ...env,
        ...E2E_LOCAL_ASSET_ENV,
    };
}

export function applyE2ELocalAssetEnv(env = process.env) {
    Object.assign(env, E2E_LOCAL_ASSET_ENV);
    return env;
}
