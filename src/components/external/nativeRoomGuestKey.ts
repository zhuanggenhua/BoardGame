import { readSessionStorageItem, writeSessionStorageItem } from '../../lib/browserStorage';

const storageKey = 'bg-external-room-guest-key';
let fallback: string | undefined;

export function getExternalRoomGuestKey() {
    const saved = readSessionStorageItem(storageKey) ?? fallback;
    if (saved && /^[a-f0-9]{64}$/.test(saved)) return saved;
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const key = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
    writeSessionStorageItem(storageKey, key);
    fallback = key;
    return key;
}
