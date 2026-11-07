/**
 * One origin-wide write owner for room credentials. IndexedDB readwrite
 * transactions on an overlapping store serialize across tabs, including on
 * non-HTTPS origins / browsers without Web Locks. No credentials live here.
 *
 * Run only synchronous storage work in the callback. This is mutual exclusion,
 * not rollback for localStorage: write fresh proof before any destructive prune.
 */
const DATABASE = 'boardgame-match-credential-writes';
const STORE = 'exclusive-writes';

export class MatchCredentialStorageError extends Error {
    readonly code = 'ROOM_CREDENTIAL_STORAGE_UNAVAILABLE';
    constructor() { super('Room credentials could not be saved locally'); }
}

export function withMatchCredentialWrite<T>(write: () => T): Promise<T> {
    return new Promise((resolve, reject) => {
        let database: IDBDatabase | undefined;
        let settled = false;
        const fail = () => { settled = true; database?.close(); reject(new MatchCredentialStorageError()); };
        try {
            if (typeof indexedDB === 'undefined') { fail(); return; }
            const open = indexedDB.open(DATABASE, 1);
            open.onupgradeneeded = () => { open.result.createObjectStore(STORE); };
            open.onerror = fail;
            open.onblocked = fail;
            open.onsuccess = () => {
                database = open.result;
                if (settled) { database.close(); return; }
                database.onversionchange = () => database?.close();
                try {
                    const transaction = database.transaction(STORE, 'readwrite');
                    let result: T;
                    let completedWrite = false;
                    transaction.onabort = fail;
                    transaction.onerror = fail;
                    transaction.oncomplete = () => {
                        database?.close();
                        if (completedWrite && !settled) { settled = true; resolve(result); }
                        else fail();
                    };
                    transaction.objectStore(STORE).get('mutex').onsuccess = () => {
                        if (settled) { transaction.abort(); return; }
                        try {
                            result = write();
                            completedWrite = true;
                        } catch {
                            transaction.abort();
                        }
                    };
                } catch { fail(); }
            };
        } catch { fail(); }
    });
}

/** Background cleanup must not turn unavailable storage into an unhandled rejection. */
export function credentialWriteFailed(): false {
    console.warn('[matchCredentials] Local credential storage is unavailable');
    return false;
}
