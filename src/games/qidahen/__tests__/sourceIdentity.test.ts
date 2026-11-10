// @vitest-environment node
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Page, Response } from '@playwright/test';
import postcss from 'postcss';
import autoprefixer from 'autoprefixer';
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

    it('用项目的浏览器前缀转换核对 Vite 样式', async () => {
        const output = (await postcss([autoprefixer()]).process(readFileSync(css, 'utf8'), { from: css, map: false })).css;
        const { verify, emit } = fixture([css]);
        emit(css, 'text/javascript', `const __vite__css = ${JSON.stringify(output)};`);
        expect(requireCompleteQidahenSourceIdentity(await verify()).servedSources[0].mapping).toBe('vite-css-autoprefixer');
    });

    it('必需来源缺失或响应不匹配时拒绝', async () => {
        const missing = fixture([image]);
        await expect(missing.verify()).rejects.toThrow('Required served source is not mapped');
        const altered = fixture([json]);
        emitAlteredJson(altered.emit);
        await expect(altered.verify()).rejects.toThrow('Served source differs from working file');
    });

    it('图片 URL 模块必须与随后接收的真实图片字节对应', async () => {
        const { verify, emit } = fixture([image]);
        emit(`${image}?import&url`, 'text/javascript', `export default "/${image}";`);
        emit(image, 'image/png', readFileSync(image));
        const identity = requireCompleteQidahenSourceIdentity(await verify());
        expect(identity.servedSources.map(source => source.mapping)).toEqual(['asset-url-module', 'raw-asset']);
    });

    it('核对放大查看用高分辨率图集的实际字节', async () => {
        const path = `assets/i18n/zh-CN/qidahen/cards/inspect/compressed/identity-fixture-${process.pid}-${Date.now()}.webp`;
        const local = `public/${path}`;
        mkdirSync('public/assets/i18n/zh-CN/qidahen/cards/inspect/compressed', { recursive: true });
        const bytes = Buffer.from('fixture atlas bytes'); writeFileSync(local, bytes, { flag: 'wx' });
        try {
            const good = fixture([local]);
            good.emit(path, 'image/webp', bytes);
            expect(requireCompleteQidahenSourceIdentity(await good.verify()).servedSources[0].mapping).toBe('raw-asset');
            const bad = fixture([local]);
            bad.emit(path, 'image/webp', Buffer.from('not the atlas'));
            await expect(bad.verify()).rejects.toThrow('Served asset differs from working file');
        } finally { unlinkSync(local); }
    });

    it('安全核对 Vite JSON 模块的默认值，不执行额外语句', async () => {
        const data = JSON.parse(readFileSync(json, 'utf8')) as Record<string, unknown>;
        const entries = Object.entries(data);
        const module = `${entries.map(([key, value]) => `export const ${key} = ${JSON.stringify(value)};`).join('\n')}\nexport default {${entries.map(([key]) => key).join(',')}};`;
        const good = fixture([json]);
        good.emit(json, 'text/javascript', module);
        expect(requireCompleteQidahenSourceIdentity(await good.verify()).servedSources[0].mapping).toBe('vite-json-module');
        const altered = fixture([json]);
        altered.emit(json, 'text/javascript', `${module}\nconsole.log('unexpected');`);
        await expect(altered.verify()).rejects.toThrow('Unexpected executable JSON module statement');
        const badValue = fixture([json]);
        badValue.emit(json, 'text/javascript', 'export default {"width": 0};');
        await expect(badValue.verify()).rejects.toThrow('JSON module content differs');
    });

    it('核对 Vite 为数组生成的未加引号对象属性', async () => {
        const source = 'src/games/qidahen/data/region-authoritative-guides.json';
        const data = JSON.parse(readFileSync(source, 'utf8')) as unknown;
        const module = `export default ${JSON.stringify(data, null, 2).replace(/"([A-Za-z_$][\w$]*)":/g, '$1:')};`;
        const result = fixture([source]);
        result.emit(source, 'text/javascript', module);
        expect(requireCompleteQidahenSourceIdentity(await result.verify()).servedSources[0].mapping).toBe('vite-json-module');
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

    it('切换页面前等待正在读取的响应体', async () => {
        let handler: ((response: Response) => void) | undefined;
        const page = { on: (_event: string, callback: (response: Response) => void) => { handler = callback; } } as unknown as Page;
        const verify = trackQidahenSourceIdentity(page, testSource, [], [json]);
        let release!: () => void;
        const ready = new Promise<void>(resolve => { release = resolve; });
        handler!({ url: () => `http://localhost/${json}`, headers: () => ({ 'content-type': 'application/json' }),
            text: async () => { await ready; return readFileSync(json, 'utf8'); } } as unknown as Response);
        let flushed = false;
        const pending = verify.flush().then(() => { flushed = true; });
        await Promise.resolve();
        expect(flushed).toBe(false);
        release();
        await pending;
        expect(requireCompleteQidahenSourceIdentity(await verify()).status).toBe('COMPLETE');
    });
});

function emitAlteredJson(emit: (path: string, contentType: string, body: string | Buffer) => void) {
    emit(json, 'application/json', `${readFileSync(json, 'utf8')} `);
}
