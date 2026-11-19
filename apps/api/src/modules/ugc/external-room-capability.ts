import { readFile, stat } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { EXTERNAL_ROOM_CONNECT, EXTERNAL_ROOM_VERSION } from '../../../../../src/shared/externalRoom';
import { SANDBOXED_WEB_GAME_PATH, type ExternalGame } from '../../../../../src/shared/externalGames';

const GAME_DIRECTORY = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const REVISION = /^[a-f0-9]{64}$/;
type RoomSupport = Pick<ExternalGame, 'roomProtocol' | 'roomAdapter'>;
const detected = new Map<string, Promise<RoomSupport>>();

// 仅检查本机托管的不可变版本。已上线的 ZIP 同样可识别，无需重新投稿。
export async function detectExternalRoomProtocol(item: Pick<ExternalGame, 'url' | 'webZipName'>) {
    const { EXTERNAL_WEB_GAME_ROOT: root, EXTERNAL_WEB_GAME_ORIGIN: origin } = process.env;
    if (!root || !origin || !item.webZipName) return undefined;
    let url: URL;
    try { url = new URL(item.url); } catch { return undefined; }
    const prefix = SANDBOXED_WEB_GAME_PATH + '/';
    if (url.origin !== origin || !url.pathname.startsWith(prefix)) return undefined;
    const [directory, revision, ...entry] = url.pathname.slice(prefix.length).split('/');
    if (!GAME_DIRECTORY.test(directory) || !REVISION.test(revision)) return undefined;
    const path = join(root, directory, revision);
    const key = path + '/' + entry.join('/');
    let check = detected.get(key);
    if (!check) {
        if (detected.size >= 256) detected.delete(detected.keys().next().value!);
        check = inspectRoomSupport(path, entry.join('/')).catch(() => ({}));
        detected.set(key, check);
    }
    return check;
}

async function inspectRoomSupport(directory: string, entry: string): Promise<RoomSupport> {
    const packageOrigin = 'https://package.invalid';
    const pending = [new URL(entry, packageOrigin)];
    const seen = new Set<string>();
    let sdk = false;
    let nativeLobby = false;
    let nativeMatch = false;
    while (pending.length && seen.size < 256) {
        const url = pending.shift()!;
        if (url.origin !== packageOrigin || seen.has(url.pathname)) continue;
        seen.add(url.pathname);
        const path = resolve(directory, '.' + decodeURIComponent(url.pathname));
        const localPath = relative(directory, path);
        if (!localPath || localPath === '..' || localPath.startsWith('..' + sep) || isAbsolute(localPath)) continue;
        const file = await stat(path).catch(() => null);
        if (!file?.isFile() || file.size > 8 * 1024 * 1024) continue;
        const text = await readFile(path, 'utf8');
        sdk ||= text.includes(EXTERNAL_ROOM_CONNECT) && text.includes('MessageChannel');
        nativeLobby ||= text.includes('id="oh-create"') && text.includes('id="oh-start"') && text.includes('onlineHost(body, prof)');
        nativeMatch ||= text.includes('hostInit(total, name)') && text.includes('guestConnect(offer, name)') && text.includes('hostAccept(i, code)');
        if (sdk && nativeLobby && nativeMatch) return { roomProtocol: EXTERNAL_ROOM_VERSION, roomAdapter: 'vale-webrtc' };
        // HTML 的脚本地址和 JS 的静态或延迟导入均相对当前文件解析。
        for (const match of text.matchAll(/['"]([^'"\n\r]+\.m?js(?:[?#][^'"\n\r]*)?)['"]/g)) {
            if (pending.length >= 256) break;
            try { pending.push(new URL(match[1], url)); } catch { /* 无效的脚本引用 */ }
        }
    }
    return sdk ? { roomProtocol: EXTERNAL_ROOM_VERSION } : {};
}
