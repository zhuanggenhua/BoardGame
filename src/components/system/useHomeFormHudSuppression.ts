import { useLayoutEffect, useState } from 'react';

/** Editing owns the narrow viewport; unmount the FAB owner so its portals leave too. */
export function useHomeFormHudSuppression(pathname: string, mobile: boolean) {
    const [suppressed, setSuppressed] = useState(false);
    useLayoutEffect(() => {
        if (pathname !== '/' || !mobile) { setSuppressed(false); return; }
        const update = () => setSuppressed(Boolean(document.querySelector('.platform-upload-workspace, .platform-profile-identity form')));
        update();
        const observer = new MutationObserver(update);
        observer.observe(document.body, { childList: true, subtree: true });
        return () => observer.disconnect();
    }, [pathname, mobile]);
    return suppressed;
}
