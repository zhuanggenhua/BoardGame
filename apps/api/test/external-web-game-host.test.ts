// @vitest-environment node
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import express from 'express';
import { strToU8, zipSync } from 'fflate';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountSandboxedWebGames, storeWebGameZip } from '../src/modules/ugc/external-web-game-host';

describe('网页游戏 ZIP 托管', () => {
    let storage: string;

    beforeEach(async () => {
        storage = await mkdtemp(join(tmpdir(), 'boardgame-web-game-test-'));
        vi.stubEnv('EXTERNAL_WEB_GAME_ROOT', storage);
        vi.stubEnv('EXTERNAL_WEB_GAME_ORIGIN', 'http://127.0.0.1');
        vi.stubEnv('EXTERNAL_WEB_GAME_PORT', '');
        vi.stubEnv('EXTERNAL_WEB_GAME_FRAME_ANCESTORS', '');
    });

    afterEach(async () => {
        vi.unstubAllEnvs();
        await rm(storage, { recursive: true, force: true });
    });

    it.each(['', '.游戏/'])('通过托管地址读取点开头的文件和目录（入口目录 %s）', async (prefix) => {
        const id = randomUUID();
        const html = '<link rel="stylesheet" href=".theme.css"><script src=".assets/main.js"></script>';
        const css = 'body { color: red; }';
        const script = 'console.log("started");';
        const zip = Buffer.from(zipSync({
            [prefix + '.nojekyll']: new Uint8Array(),
            [prefix + 'index.html']: strToU8(html),
            [prefix + '.theme.css']: strToU8(css),
            [prefix + '.assets/main.js']: strToU8(script),
        }));

        const app = express();
        const server = app.listen(0, '127.0.0.1');
        try {
            await once(server, 'listening');
            const address = server.address();
            if (!address || typeof address === 'string') throw new Error('未取得测试托管地址');
            vi.stubEnv('EXTERNAL_WEB_GAME_ORIGIN', `http://127.0.0.1:${address.port}`);
            mountSandboxedWebGames(app);

            const url = await storeWebGameZip(id, zip);
            expect(decodeURIComponent(url)).toContain('/' + prefix + 'index.html');
            for (const [file, contents] of [['index.html', html], ['.theme.css', css], ['.assets/main.js', script]]) {
                const response = await fetch(new URL(file, url));
                expect(response.status).toBe(200);
                expect(response.headers.get('content-security-policy')).toContain('sandbox');
                expect(await response.text()).toBe(contents);
            }
            expect((await fetch(new URL('.nojekyll', url))).status).toBe(404);
        } finally {
            await new Promise<void>((resolve) => server.close(() => resolve()));
        }
    });

    it('仍拒绝不合法的父目录', async () => {
        const zip = Buffer.from(zipSync({
            'index.html': strToU8('<title>游戏</title>'),
            'aux/.theme.css': new Uint8Array(),
        }));

        await expect(storeWebGameZip(randomUUID(), zip)).rejects.toThrow('ZIP 包含不受支持的路径');
    });

    it('单独报告条目超限', async () => {
        const zip = Buffer.from(zipSync({
            'index.html': strToU8('<title>游戏</title>'),
            ...Object.fromEntries(Array.from({ length: 3000 }, (_, index) => [`assets/${index}.txt`, new Uint8Array()])),
        }));

        await expect(storeWebGameZip(randomUUID(), zip)).rejects.toThrow('ZIP 条目超过 3000 个');
    });
});
