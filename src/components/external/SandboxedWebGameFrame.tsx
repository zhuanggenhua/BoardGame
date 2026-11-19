import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { readLocalStorageItem, writeLocalStorageItem } from '../../lib/browserStorage';
import { WEB_GAME_SANDBOX } from '../../shared/externalGames';
import { EXTERNAL_ROOM_CONNECT, EXTERNAL_ROOM_VERSION } from '../../shared/externalRoom';

const STORAGE_MESSAGE = 'boardgame:web-game-storage';
const MAX_STORAGE_LENGTH = 1024 * 1024;
type StorageUpdate =
    | { type: string; action: 'set'; key: string; value: string }
    | { type: string; action: 'remove'; key: string }
    | { type: string; action: 'clear' };

function readGameStorage(storageKey: string): [string, string][] {
    try {
        const saved: unknown = JSON.parse(readLocalStorageItem(storageKey) ?? '[]');
        return Array.isArray(saved)
            ? saved.filter(entry => Array.isArray(entry) && entry.length === 2 && entry.every(value => typeof value === 'string'))
            : [];
    } catch {
        return [];
    }
}

function installGameStorage(entries: [string, string][], origin: string, type: string) {
    const storage = new Map(entries);
    const update = (message: Omit<StorageUpdate, 'type'> & { key?: string; value?: string }) => {
        parent.postMessage({ type, ...message }, origin);
    };
    Object.defineProperty(window, 'localStorage', {
        value: {
            get length() { return storage.size; },
            key(index: number) { return [...storage.keys()][index] ?? null; },
            getItem(key: string) { return storage.get(String(key)) ?? null; },
            setItem(key: string, value: string) {
                storage.set(String(key), String(value));
                update({ action: 'set', key: String(key), value: String(value) });
            },
            removeItem(key: string) {
                storage.delete(String(key));
                update({ action: 'remove', key: String(key) });
            },
            clear() {
                storage.clear();
                update({ action: 'clear' });
            },
        },
    });
}

function escapeAttribute(value: string) {
    return value.replace(/[&"<]/g, character => ({ '&': '&amp;', '"': '&quot;', '<': '&lt;' })[character]!);
}

function launchDocument(html: string, entry: string, storageKey: string) {
    const base = escapeAttribute(entry);
    const args = [readGameStorage(storageKey), window.location.origin, STORAGE_MESSAGE]
        .map(value => JSON.stringify(value).replace(/</g, '\\u003c')).join(',');
    const doctype = html.match(/^\s*<!doctype[^>]*>/i)?.[0] ?? '';
    return `${doctype}<base href="${base}"><meta name="boardgame-platform-origin" content="${escapeAttribute(window.location.origin)}"><script>(${installGameStorage.toString()})(${args});</script>${html.slice(doctype.length)}`;
}

export function SandboxedWebGameFrame({ gameId, entry, title, onRoomConnect }: {
    gameId: string; entry: string; title: string; onRoomConnect?: (port: MessagePort) => void;
}) {
    const { t } = useTranslation('lobby');
    const frame = useRef<HTMLIFrameElement>(null);
    const [documentSource, setDocumentSource] = useState<string>();
    const [error, setError] = useState(false);
    const storageKey = `bg-web-game-storage:${gameId}`;
    useEffect(() => {
        const controller = new AbortController();
        const receive = (event: MessageEvent<(StorageUpdate & { version?: number }) | undefined>) => {
            const data = event.data;
            if (event.source !== frame.current?.contentWindow || event.origin !== 'null') return;
            if (data?.type === EXTERNAL_ROOM_CONNECT && data.version === EXTERNAL_ROOM_VERSION && event.ports.length === 1) {
                if (onRoomConnect) onRoomConnect(event.ports[0]);
                else event.ports[0].postMessage({ type: 'close', reason: '独立游玩' });
                return;
            }
            if (data?.type !== STORAGE_MESSAGE) return;
            const saved = new Map(readGameStorage(storageKey));
            if (data.action === 'clear') saved.clear();
            else if (data.action === 'remove' && typeof data.key === 'string') saved.delete(data.key);
            else if (data.action === 'set' && typeof data.key === 'string' && typeof data.value === 'string'
                && data.key.length + data.value.length <= MAX_STORAGE_LENGTH) saved.set(data.key, data.value);
            else return;
            const encoded = JSON.stringify([...saved]);
            if (encoded.length <= MAX_STORAGE_LENGTH) writeLocalStorageItem(storageKey, encoded);
        };
        window.addEventListener('message', receive);
        void fetch(entry, { signal: controller.signal, credentials: 'omit', redirect: 'error' })
            .then(response => {
                if (!response.ok || !/^text\/html\b/i.test(response.headers.get('content-type') ?? '')) throw new Error('Game HTML unavailable');
                return response.text();
            })
            .then(html => { if (!controller.signal.aborted) setDocumentSource(launchDocument(html, entry, storageKey)); })
            .catch(() => { if (!controller.signal.aborted) setError(true); });
        return () => {
            controller.abort();
            window.removeEventListener('message', receive);
        };
    }, [entry, storageKey, onRoomConnect]);

    if (error) return <p role="alert" className="external-game-message">{t('platform.externalGamePage.loadFailed', { message: t('platform.retry') })}</p>;
    return <iframe ref={frame} title={title} data-entry-url={entry} sandbox={WEB_GAME_SANDBOX} srcDoc={documentSource} referrerPolicy="no-referrer" />;
}
