import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rename, rm, stat, writeFile } from 'node:fs/promises';
import { extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { isIP } from 'node:net';
import express from 'express';
import { unzipSync } from 'fflate';
import { hasControlCharacters, MAX_WEB_ZIP_BYTES, SANDBOXED_WEB_GAME_PATH, WEB_GAME_SANDBOX } from '../../../../../src/shared/externalGames';

const GAME_ID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const MAX_WEB_ZIP_ENTRIES = 3000;
const WEB_EXTENSIONS = new Set('.html .htm .js .mjs .css .json .map .wasm .xml .txt .md .png .jpg .jpeg .webp .gif .svg .ico .avif .bmp .mp3 .ogg .wav .m4a .aac .webm .mp4 .woff .woff2 .ttf .otf .eot .bin .data .unityweb .glb .gltf .ktx2 .webmanifest'.split(' '));
const WEB_STATIC_OPTIONS = { dotfiles: 'allow', index: false, redirect: false, immutable: true, maxAge: '1y' } as const;

function isInvalidWebPathPart(part: string) {
    return !part || /[. ]$|[\\:*?"<>|]/.test(part) || hasControlCharacters(part)
        || /^(con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i.test(part);
}

function isWebAssetRequestPath(path: string) {
    try {
        const decoded = decodeURIComponent(path);
        return !decoded.slice(1).split('/').some(isInvalidWebPathPart)
            && WEB_EXTENSIONS.has(extname(decoded).toLowerCase());
    } catch {
        return false;
    }
}

function getHostConfig() {
    const { EXTERNAL_WEB_GAME_ROOT, EXTERNAL_WEB_GAME_ORIGIN, EXTERNAL_WEB_GAME_PORT, EXTERNAL_WEB_GAME_FRAME_ANCESTORS } = process.env;
    if (!EXTERNAL_WEB_GAME_ROOT && !EXTERNAL_WEB_GAME_ORIGIN && !EXTERNAL_WEB_GAME_PORT && !EXTERNAL_WEB_GAME_FRAME_ANCESTORS) return null;
    const origin = EXTERNAL_WEB_GAME_ORIGIN ?? '';
    const port = Number(EXTERNAL_WEB_GAME_PORT);
    const ancestors = EXTERNAL_WEB_GAME_FRAME_ANCESTORS?.trim().split(/\s+/) ?? [];
    const host = new URL(origin.replace('{id}', 'game-id'));
    if (isIP(host.hostname.replace(/^\[|\]$/g, '')) && origin === host.origin && ['http:', 'https:'].includes(host.protocol)
        && EXTERNAL_WEB_GAME_ROOT && !EXTERNAL_WEB_GAME_PORT && !EXTERNAL_WEB_GAME_FRAME_ANCESTORS) {
        return { mode: 'sandbox' as const, origin, root: resolve(EXTERNAL_WEB_GAME_ROOT) };
    }
    if (!EXTERNAL_WEB_GAME_ROOT || !Number.isInteger(port) || port < 1 || port > 65535 || !ancestors.length
        || !host.hostname.startsWith('game-id.') || origin !== host.origin.replace('game-id.', '{id}.')
        || !(host.protocol === 'https:' || (host.protocol === 'http:' && host.hostname.endsWith('.localhost')))
        || ancestors.some(value => {
            const parent = new URL(value);
            return parent.origin !== value || !['http:', 'https:'].includes(parent.protocol)
                || parent.hostname.endsWith(host.hostname.slice('game-id'.length));
        })) {
        throw new Error('网页游戏托管需要独立域名、存储位置、监听端口和允许嵌入的平台来源');
    }
    return { mode: 'separate-origin' as const, origin, port, ancestors, root: resolve(EXTERNAL_WEB_GAME_ROOT), suffix: host.hostname.slice('game-id'.length) };
}

function browserFiles(buffer: Buffer) {
    const names = new Set<string>();
    let entries = 0;
    let totalBytes = 0;
    let files: Record<string, Uint8Array>;
    try {
        files = unzipSync(buffer, { filter: ({ name, originalSize, compression }) => {
            if (++entries > MAX_WEB_ZIP_ENTRIES) {
                throw new BadRequestException(`ZIP 条目超过 ${MAX_WEB_ZIP_ENTRIES} 个`);
            }
            const directory = name.endsWith('/');
            const children = name.replace(/\/$/, '').split('/');
            if (children.some(isInvalidWebPathPart)) {
                throw new BadRequestException('ZIP 包含不受支持的路径，请检查特殊字符或目录名');
            }
            const key = children.join('/').normalize('NFC').toLowerCase();
            if (names.has(key)) throw new BadRequestException('ZIP 包含重复路径');
            names.add(key);
            if (directory || !WEB_EXTENSIONS.has(extname(name).toLowerCase())) return false;
            totalBytes += originalSize;
            if (totalBytes > 128 * 1024 * 1024 || originalSize > 64 * 1024 * 1024 || ![0, 8].includes(compression)) {
                throw new BadRequestException('ZIP 解压大小超限或使用了不支持的压缩格式');
            }
            return true;
        } });
    } catch (error) {
        if (error instanceof BadRequestException) throw error;
        throw new BadRequestException('ZIP 无法读取，请重新压缩后上传');
    }
    const rootEntry = Object.keys(files).find(name => name.toLowerCase() === 'index.html');
    const entriesByDepth = Object.keys(files).filter(name => /(?:^|\/)index\.html$/i.test(name))
        .sort((left, right) => left.split('/').length - right.split('/').length);
    const [first, second] = entriesByDepth;
    const entry = rootEntry ?? (first && first.split('/').length !== second?.split('/').length ? first : undefined);
    if (!entry) throw new BadRequestException('请在 ZIP 根目录或唯一的游戏目录放置 index.html');
    return { files, entry };
}

export async function storeWebGameZip(gameId: string, buffer: Buffer) {
    const config = getHostConfig();
    if (!config) throw new ServiceUnavailableException('网页 ZIP 托管尚未配置');
    if (!GAME_ID.test(gameId) || !buffer.length || buffer.length > MAX_WEB_ZIP_BYTES) {
        throw new BadRequestException('请选择符合大小限制的网页 ZIP');
    }
    const { files, entry } = browserFiles(buffer);
    const revision = createHash('sha256').update(buffer).digest('hex');
    const gameRoot = join(config.root, gameId);
    await mkdir(gameRoot, { recursive: true });
    const latest = join(gameRoot, revision);
    if (!(await stat(latest).catch(() => null))) {
        const staging = await mkdtemp(join(config.root, 'stage-'));
        try {
            for (const [name, contents] of Object.entries(files)) {
                const destination = join(staging, ...name.split('/'));
                await mkdir(resolve(destination, '..'), { recursive: true });
                await writeFile(destination, contents, { flag: 'wx' });
            }
            try {
                await rename(staging, latest);
            } catch (error) {
                if (!(await stat(latest).catch(() => null))?.isDirectory()) throw error;
            }
        } finally {
            const target = relative(config.root, staging);
            if (target.startsWith('stage-') && !target.includes(sep) && !isAbsolute(target)) {
                await rm(staging, { recursive: true, force: true });
            }
        }
    }
    const target = config.mode === 'sandbox' ? `${config.origin}${SANDBOXED_WEB_GAME_PATH}/${gameId}` : config.origin.replace('{id}', gameId);
    return `${target}/${revision}/${entry.split('/').map(encodeURIComponent).join('/')}`;
}

export function mountSandboxedWebGames(app: express.Application) {
    const config = getHostConfig();
    if (config?.mode !== 'sandbox') return;
    const serve = express.static(config.root, WEB_STATIC_OPTIONS);
    app.use(SANDBOXED_WEB_GAME_PATH, (request, response) => {
        // 直接打开包内 HTML 或 SVG 时也始终使用不透明来源。
        response.setHeader('Content-Security-Policy', `sandbox ${WEB_GAME_SANDBOX}; frame-ancestors 'self'; object-src 'none'`);
        response.setHeader('X-Content-Type-Options', 'nosniff');
        response.setHeader('Referrer-Policy', 'no-referrer');
        response.removeHeader('Access-Control-Allow-Credentials');
        response.setHeader('Access-Control-Allow-Origin', '*');
        const [, id, revision] = request.path.split('/');
        if (!GAME_ID.test(id ?? '') || !/^[a-f0-9]{64}$/.test(revision ?? '') || !isWebAssetRequestPath(request.path)) {
            response.sendStatus(404);
            return;
        }
        serve(request, response, () => { response.sendStatus(404); });
    });
}

export async function startWebGameHost() {
    const config = getHostConfig();
    if (config?.mode !== 'separate-origin') return;
    const app = express();
    app.disable('x-powered-by');
    app.use((request, response, next) => {
        const host = request.hostname?.toLowerCase() ?? '';
        const id = host.slice(0, -config.suffix.length);
        if (!host.endsWith(config.suffix) || !GAME_ID.test(id)
            || !/^\/[a-f0-9]{64}\//.test(request.path) || !isWebAssetRequestPath(request.path)) {
            response.sendStatus(404);
            return;
        }
        response.setHeader('Content-Security-Policy', `frame-ancestors ${config.ancestors.join(' ')}; object-src 'none'; base-uri 'self'`);
        response.setHeader('X-Content-Type-Options', 'nosniff');
        response.setHeader('Referrer-Policy', 'no-referrer');
        express.static(join(config.root, id), WEB_STATIC_OPTIONS)(request, response, next);
    });
    return await new Promise<ReturnType<typeof app.listen>>((resolveServer, reject) => {
        const server = app.listen(config.port, '127.0.0.1', () => resolveServer(server));
        server.once('error', reject);
    });
}
