import { getSessionStorage, readSessionStorageItem, writeSessionStorageItem } from '../browserStorage';

const HANDOFF_KEY = 'bg-android-update-check-native-after-ota';

export const markNativeUpdateAfterOta = () => { writeSessionStorageItem(HANDOFF_KEY, '1'); };
export const clearNativeUpdateAfterOta = () => {
    try { getSessionStorage()?.removeItem(HANDOFF_KEY); } catch { /* storage unavailable */ }
};
export const consumeNativeUpdateAfterOta = () => {
    const pending = readSessionStorageItem(HANDOFF_KEY) === '1';
    clearNativeUpdateAfterOta();
    return pending;
};
