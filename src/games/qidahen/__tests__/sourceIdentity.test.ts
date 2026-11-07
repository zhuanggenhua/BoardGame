// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Page, Response } from '@playwright/test';
import { requireCompleteQidahenSourceIdentity, trackQidahenSourceIdentity } from '../../../../e2e/qidahen/sourceIdentity';

const css = 'src/games/qidahen/qidahen-board.css';
const json = 'src/games/qidahen/data/runtime-region-mask-regions.json';
const image = 'src/games/qidahen/data/region-mask.png';
const testSource = 'e2e/qidahen/sourceIdentity.ts';

function fixture(required: string[] = [], externalMap?: string) {
    let onResponse: ((response: Response) => void) | undefined;
    const page = {
        on: (_event: string, handler: (response: Response) => void) => { onResponse = handler; },
        request: { get: async () => ({ ok: () => externalMap != null, text: async () => externalMap }) },
    } as unknown as Page;
    const verify = trackQidahenSourceIdentity(page, testSource, [], required);
    const emit = (path: string, contentType: string, body: string | Buffer) => onResponse!({
        url: () => `http://localhost/${path}`,
        headers: () => ({ 'content-type': contentType }),
        text: async () => String(body),
        body: async () => Buffer.isBuffer(body) ? body : Buffer.from(body),
    } as unknown as Response);
    return { verify, emit };
}

describe('七大恨页面源码身份', () => {
    it('直接核对Vite样式、JSON和图片的真实响应', async () => {
        const { verify, emit } = fixture([css, json, image]);
        emit(css, 'text/javascript', `const __vite__css = ${JSON.stringify(readFileSync(css, 'utf8'))};`);
        emit(json, 'application/json', readFileSync(json, 'utf8'));
        emit(image, 'image/png', readFileSync(image));
        const identity = requireCompleteQidahenSourceIdentity(await verify());
        expect(identity.status).toBe('COMPLETE');
        expect(identity.servedSources.map(source => source.mapping)).toEqual(['vite-css', 'raw-json', 'raw-asset']);
    });

    it('必需来源缺失或响应不匹配时拒绝', async () => {
        const missing = fixture([image]);
        await expect(missing.verify()).rejects.toThrow('Required served source is not mapped');
        const altered = fixture([json]);
        emitAlteredJson(altered.emit);
        await expect(altered.verify()).rejects.toThrow('Served source differs from working file');
    });

    it('存在未映射运行时响应时不允许验收方写入PASS', async () => {
        const { verify, emit } = fixture();
        emit(css, 'text/javascript', 'const transformed = true;');
        const identity = await verify();
        expect(identity.status).toBe('INCOMPLETE');
        expect(() => requireCompleteQidahenSourceIdentity(identity)).toThrow('Incomplete browser source identity');
    });

    it('外链 source map 必须包含对应的真实源码', async () => {
        const source = 'src/games/qidahen/annualTutorial.ts';
        const contents = readFileSync(source, 'utf8');
        const good = fixture([source], JSON.stringify({ sourcesContent: [contents] }));
        good.emit(source, 'text/javascript', 'export {};\n//# sourceMappingURL=annualTutorial.ts.map');
        expect(requireCompleteQidahenSourceIdentity(await good.verify()).servedSources[0].mapping).toBe('source-map');
        const wrong = fixture([source], JSON.stringify({ sourcesContent: ['different source'] }));
        wrong.emit(source, 'text/javascript', 'export {};\n//# sourceMappingURL=annualTutorial.ts.map');
        await expect(wrong.verify()).rejects.toThrow('Required served source is not mapped');
    });
});

function emitAlteredJson(emit: (path: string, contentType: string, body: string | Buffer) => void) {
    emit(json, 'application/json', `${readFileSync(json, 'utf8')} `);
}
