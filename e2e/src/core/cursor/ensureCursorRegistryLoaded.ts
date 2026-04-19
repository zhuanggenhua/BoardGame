let cursorRegistryPromise: Promise<void> | null = null;
let cursorRegistryLoaded = false;

export function isCursorRegistryLoaded(): boolean {
    return cursorRegistryLoaded;
}

export function ensureCursorRegistryLoaded(): Promise<void> {
    if (cursorRegistryLoaded) {
        return Promise.resolve();
    }
    if (!cursorRegistryPromise) {
        cursorRegistryPromise = import('../../games/cursorRegistry').then(() => {
            cursorRegistryLoaded = true;
        });
    }
    return cursorRegistryPromise;
}
