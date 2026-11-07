import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import * as ts from 'typescript';

export const QIDAHEN_VISUAL_SOURCE_PATHS = [
    'src/games/qidahen/qidahen-board.css',
    'src/games/qidahen/data/region-mask.png',
    'src/games/qidahen/data/runtime-region-mask-regions.json',
];

export function requireCompleteQidahenSourceIdentity<T extends { status: string; unmapped: unknown[] }>(identity: T): T {
    if (identity.status !== 'COMPLETE') throw new Error(`Incomplete browser source identity: ${JSON.stringify(identity.unmapped)}`);
    return identity;
}

/** 记录真实页面加载的源码，并拒绝运行期间的源码漂移。 */
export function trackQidahenSourceIdentity(page: Page, testSourcePath: string, additionalPaths: string[] = [], requiredPaths: string[] = []) {
    const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
    const textHash = (value: string) => hash(value.replace(/\r\n/g, '\n'));
    const files = new Map<string, string>();
    for (const path of [testSourcePath, ...additionalPaths]) files.set(path, hash(readFileSync(path)));
    const seen = new Set<string>();
    const pending: Promise<void>[] = [];
    const errors: string[] = [];
    const servedSources: Array<{ path: string; url: string; responseHash: string; sourceHash?: string; mapping: string }> = [];
    page.on('response', response => {
        const url = new URL(response.url());
        const path = decodeURIComponent(url.pathname).replace(/^\//, '');
        const file = path.startsWith('src/') ? path : path.startsWith('locales/') ? `public/${path}` : null;
        if (!file || !existsSync(file) || seen.has(response.url())) return;
        seen.add(response.url());
        if (!files.has(file)) files.set(file, hash(readFileSync(file)));
        pending.push((async () => {
            const url = response.url();
            const contentType = response.headers()['content-type'] ?? '';
            if (/^(?:image|audio|video)\//.test(contentType)) {
                const responseHash = hash(await response.body());
                if (responseHash !== files.get(file)) errors.push(`Served asset differs from working file: ${file}`);
                servedSources.push({ path: file, url, responseHash, sourceHash: responseHash, mapping: 'raw-asset' });
                return;
            }
            const body = await response.text();
            const local = readFileSync(file, 'utf8');
            let original: string | undefined;
            let mapping = 'unmapped';
            if (contentType.includes('application/json') || file.startsWith('public/locales/')) {
                original = body; mapping = 'raw-json';
            } else if (file.endsWith('.css')) {
                const css = body.match(/(?:const|let)\s+__vite__css\s*=\s*("(?:\\.|[^"\\])*")/);
                if (css) { original = JSON.parse(css[1]); mapping = 'vite-css'; }
                else if (contentType.includes('text/css')) { original = body; mapping = 'raw-css'; }
            }
            const mapRef = body.match(/sourceMappingURL=([^\s*]+)/)?.[1];
            if (original == null && mapRef) {
                let mapBody: string | undefined;
                if (mapRef.startsWith('data:application/json') && mapRef.includes(';base64,')) mapBody = Buffer.from(mapRef.split(';base64,')[1], 'base64').toString('utf8');
                else if (!mapRef.startsWith('data:')) {
                    const mapResponse = await page.request.get(new URL(mapRef, url).toString());
                    if (mapResponse.ok()) mapBody = await mapResponse.text();
                }
                if (mapBody) {
                    const contents = JSON.parse(mapBody).sourcesContent as Array<string | null> | undefined;
                    original = contents?.find(content => content != null && textHash(content) === textHash(local)) ?? undefined;
                    if (original != null) mapping = 'source-map';
                }
            }
            if (original == null && /\.[cm]?tsx?$/.test(file) && !body.trim()) {
                const compiled = ts.transpileModule(local, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, removeComments: true } }).outputText;
                if (!compiled.replace(/\bexport\s*\{\s*\}\s*;?/g, '').trim()) mapping = 'type-only-empty';
            }
            if (original != null && textHash(original) !== textHash(local)) {
                if (mapping === 'vite-css') { original = undefined; mapping = 'transformed-css-unmapped'; }
                else errors.push(`Served source differs from working file: ${file}`);
            }
            servedSources.push({ path: file, url, responseHash: textHash(body), sourceHash: original == null ? undefined : textHash(original), mapping });
        })().catch(error => { errors.push(`${file}: ${String(error)}`); }));
    });
    return async () => {
        await Promise.all(pending);
        for (const [path, expected] of files) {
            if (!existsSync(path) || hash(readFileSync(path)) !== expected) errors.push(`Source changed during run: ${path}`);
        }
        for (const path of requiredPaths) {
            if (!servedSources.some(source => source.path === path && source.sourceHash)) errors.push(`Required served source is not mapped: ${path}`);
        }
        if (errors.length) throw new Error(errors.join('\n'));
        const unmapped = servedSources.filter(source => !source.sourceHash && source.mapping !== 'type-only-empty');
        return { status: unmapped.length ? 'INCOMPLETE' : 'COMPLETE', method: 'test-source-and-actual-browser-responses', files: [...files].map(([path, fileHash]) => ({ path, hash: fileHash })), servedSources, unmapped };
    };
}
