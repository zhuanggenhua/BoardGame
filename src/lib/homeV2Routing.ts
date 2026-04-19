const isHomeV2DraftEnvEnabled = import.meta.env.VITE_HOME_V2_DRAFT === '1';

function readHomeV2DraftParam(search: string | URLSearchParams) {
    const searchParams = typeof search === 'string' ? new URLSearchParams(search) : search;
    return searchParams.get('homeV2Draft') === '1';
}

export function isHomeV2DraftEnabled(search: string | URLSearchParams) {
    return isHomeV2DraftEnvEnabled || readHomeV2DraftParam(search);
}

export function isHomeV2DraftRoute(pathname: string, search: string | URLSearchParams) {
    return pathname === '/' && isHomeV2DraftEnabled(search);
}
