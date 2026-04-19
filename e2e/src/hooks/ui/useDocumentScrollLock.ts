import { useEffect } from 'react';

interface ScrollLockSnapshot {
    htmlOverflow: string;
    htmlOverscrollBehavior: string;
    bodyOverflow: string;
    bodyOverscrollBehavior: string;
    bodyPaddingRight: string;
}

let activeScrollLockCount = 0;
let scrollLockSnapshot: ScrollLockSnapshot | null = null;

const captureScrollLockSnapshot = (): ScrollLockSnapshot => ({
    htmlOverflow: document.documentElement.style.overflow,
    htmlOverscrollBehavior: document.documentElement.style.overscrollBehavior,
    bodyOverflow: document.body.style.overflow,
    bodyOverscrollBehavior: document.body.style.overscrollBehavior,
    bodyPaddingRight: document.body.style.paddingRight,
});

const applyDocumentScrollLock = () => {
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.overscrollBehavior = 'none';
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    document.body.style.paddingRight = scrollbarWidth > 0 ? `${scrollbarWidth}px` : '';
};

const restoreDocumentScrollLock = (snapshot: ScrollLockSnapshot) => {
    document.documentElement.style.overflow = snapshot.htmlOverflow;
    document.documentElement.style.overscrollBehavior = snapshot.htmlOverscrollBehavior;
    document.body.style.overflow = snapshot.bodyOverflow;
    document.body.style.overscrollBehavior = snapshot.bodyOverscrollBehavior;
    document.body.style.paddingRight = snapshot.bodyPaddingRight;
};

export const useDocumentScrollLock = (locked: boolean) => {
    useEffect(() => {
        if (!locked || typeof document === 'undefined') {
            return undefined;
        }

        activeScrollLockCount += 1;
        if (activeScrollLockCount === 1) {
            scrollLockSnapshot = captureScrollLockSnapshot();
            applyDocumentScrollLock();
        }

        return () => {
            activeScrollLockCount = Math.max(0, activeScrollLockCount - 1);
            if (activeScrollLockCount === 0 && scrollLockSnapshot) {
                restoreDocumentScrollLock(scrollLockSnapshot);
                scrollLockSnapshot = null;
            }
        };
    }, [locked]);
};
