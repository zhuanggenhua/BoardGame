export const HOME_V2_PREVIEW_PATH = '/dev/home-v2-preview';

const normalizePathname = (pathname: string) => pathname.replace(/\/+$/, '') || '/';

export function isHomeV2PreviewRoute(pathname: string) {
    return normalizePathname(pathname) === HOME_V2_PREVIEW_PATH;
}
