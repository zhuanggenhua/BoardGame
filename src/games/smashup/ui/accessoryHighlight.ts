export const MUTED_ACCESSORY_CHROME_CLASS = 'border-0 ring-0 shadow-none outline-none';

export function getAccessoryChromeClass(muted: boolean, normalClass: string): string {
    return muted ? MUTED_ACCESSORY_CHROME_CLASS : normalClass;
}

export function getAccessorySurfaceClass(muted: boolean, mutedClass: string, normalClass: string): string {
    return muted ? mutedClass : normalClass;
}
