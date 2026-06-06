const SYSTEM_ERRORS = new Set(['stale_state']);
const ONLINE_TRANSPORT_ERRORS = new Set(['unauthorized', 'match_not_found', 'sync_timeout']);

export const TUTORIAL_SILENT_ERRORS = new Set(['tutorial_command_blocked', 'tutorial_step_locked']);
export const ONLINE_MATCH_TRANSPORT_ERRORS = ONLINE_TRANSPORT_ERRORS;

export function isTutorialRoutePath(pathname: string): boolean {
    return /^\/play\/[^/]+\/tutorial(?:\/[^/]+)?\/?$/.test(pathname);
}

export function shouldShowOnlineGameErrorToast(error: string): boolean {
    if (ONLINE_TRANSPORT_ERRORS.has(error)) return false;
    if (SYSTEM_ERRORS.has(error)) return false;
    return true;
}
