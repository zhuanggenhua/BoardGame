import { isAndroidShellBuildMode, isNativeAndroidRuntime } from './mobile/androidRuntime';

export const HOME_V2_PREVIEW_PATH = '/dev/home-v2-preview';

const isHomeV2DraftEnvEnabled = import.meta.env.VITE_HOME_V2_DRAFT === '1';

function readHomeV2DraftParam(search: string | URLSearchParams) {
    const searchParams = typeof search === 'string' ? new URLSearchParams(search) : search;
    return searchParams.get('homeV2Draft') === '1';
}

const normalizePathname = (pathname: string) => pathname.replace(/\/+$/, '') || '/';

export function isHomeV2PreviewRoute(pathname: string) {
    return normalizePathname(pathname) === HOME_V2_PREVIEW_PATH;
}

export function isHomeV2DraftEnabled(search: string | URLSearchParams) {
    return isHomeV2DraftEnvEnabled || isAndroidShellBuildMode() || readHomeV2DraftParam(search) || isNativeAndroidRuntime();
}

export function isHomeV2DraftRoute(pathname: string, search: string | URLSearchParams) {
    return normalizePathname(pathname) === '/' && isHomeV2DraftEnabled(search);
}
