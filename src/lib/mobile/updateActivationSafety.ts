let nativeShellVisible = true;

if (typeof window !== 'undefined') {
    window.addEventListener('bg-shell-app-hidden', () => { nativeShellVisible = false; });
    window.addEventListener('bg-shell-app-visible', () => { nativeShellVisible = true; });
}

/** 只有前台且不在本站或外站对局时才允许自动激活或打开安装器。 */
export const canActivateMobileUpdate = () => nativeShellVisible && document.visibilityState !== 'hidden'
    && !window.location.pathname.startsWith('/play/') && !window.location.pathname.startsWith('/external/');
