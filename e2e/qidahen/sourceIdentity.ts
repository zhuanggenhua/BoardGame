import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import type { Page } from '@playwright/test';
import * as ts from 'typescript';
import postcss from 'postcss';
import autoprefixer from 'autoprefixer';

export const QIDAHEN_VISUAL_SOURCE_PATHS = [
    'src/games/qidahen/qidahen-board.css',
    'src/games/qidahen/data/region-mask.png',
    'src/games/qidahen/data/runtime-region-mask-regions.json',
    'src/games/qidahen/data/printed-map-occlusions.json',
];

export function requireCompleteQidahenSourceIdentity<T extends { status: string; unmapped: unknown[] }>(identity: T): T {
    if (identity.status !== 'COMPLETE') throw new Error(`Incomplete browser source identity: ${JSON.stringify(identity.unmapped)}`);
    return identity;
}

/** 只接受 Vite JSON 模块的静态字面量，不执行页面返回的代码。 */
function readViteJsonModule(body: string): unknown {
    const source = ts.createSourceFile('response.js', body, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS);
    const named = new Map<string, unknown>();
    const readValue = (node: ts.Expression): unknown => {
        if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
            && node.expression.expression.getText(source) === 'JSON' && node.expression.name.text === 'parse'
            && node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0])) return JSON.parse(node.arguments[0].text);
        if (ts.isArrayLiteralExpression(node)) return node.elements.map(element => {
            if (ts.isSpreadElement(element) || ts.isOmittedExpression(element)) throw new Error('Invalid JSON array item');
            return readValue(element);
        });
        if (ts.isObjectLiteralExpression(node)) {
            const value: Record<string, unknown> = {};
            for (const property of node.properties) {
                if (!ts.isPropertyAssignment(property) || !(ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))) throw new Error('Invalid JSON object property');
                Object.defineProperty(value, property.name.text, { value: readValue(property.initializer), enumerable: true, configurable: true, writable: true });
            }
            return value;
        }
        try { return JSON.parse(node.getText(source)); }
        catch (error) { throw new Error(`Unsupported JSON value ${node.getText(source).slice(0, 240)}: ${String(error)}`); }
    };
    let result: unknown;
    let hasDefault = false;
    for (const statement of source.statements) {
        if (ts.isVariableStatement(statement) && statement.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
            for (const declaration of statement.declarationList.declarations) {
                if (!ts.isIdentifier(declaration.name) || !declaration.initializer || named.has(declaration.name.text)) throw new Error('Invalid JSON module export');
                named.set(declaration.name.text, readValue(declaration.initializer));
            }
        } else if (ts.isExportAssignment(statement) && !statement.isExportEquals && !hasDefault) {
            hasDefault = true;
            if (!ts.isObjectLiteralExpression(statement.expression)) result = readValue(statement.expression);
            else {
                const value: Record<string, unknown> = {};
                for (const property of statement.expression.properties) {
                    if (ts.isShorthandPropertyAssignment(property) && named.has(property.name.text)) Object.defineProperty(value, property.name.text, { value: named.get(property.name.text), enumerable: true, configurable: true, writable: true });
                    else if (ts.isPropertyAssignment(property) && (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))) Object.defineProperty(value, property.name.text, { value: readValue(property.initializer), enumerable: true, configurable: true, writable: true });
                    else throw new Error('Invalid JSON module default export');
                }
                result = value;
            }
        } else throw new Error('Unexpected executable JSON module statement');
    }
    if (!hasDefault) throw new Error('Missing JSON module default export');
    return result;
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
    let viteServerPromise: ReturnType<typeof import('vite').createServer> | undefined;
    const verifyViteCss = async (file: string, actual: string) => {
        if (!viteServerPromise) {
            for (const path of ['vite.config.ts', 'postcss.config.js', 'src/fonts.css', 'package-lock.json']) {
                if (existsSync(path) && !files.has(path)) files.set(path, hash(readFileSync(path)));
            }
            viteServerPromise = import('vite').then(({ createServer }) => createServer({ server: { middlewareMode: true, watch: { ignored: ['**/*'] } }, cacheDir: `.tmp/vite-source-identity-${process.pid}`, logLevel: 'error' }));
        }
        const viteServer = await viteServerPromise;
        const transformed = await viteServer.transformRequest(`/${file}`);
        const match = transformed?.code.match(/(?:const|let)\s+__vite__css\s*=\s*("(?:\\.|[^"\\])*")/);
        return !!match && textHash(JSON.parse(match[1])) === textHash(actual);
    };
    page.on('response', response => {
        const url = new URL(response.url());
        const path = decodeURIComponent(url.pathname).replace(/^\//, '');
        const file = path.startsWith('src/') ? path
            : path.startsWith('locales/') ? `public/${path}`
                : /^assets\/i18n\/[^/]+\/qidahen\/cards\/inspect\/compressed\/[^/]+\.webp$/.test(path) ? `public/${path}` : null;
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
            if (/\.(?:png|jpe?g|webp|svg|gif|woff2?)$/i.test(file) && /(?:javascript|ecmascript)/.test(contentType)) {
                const module = ts.createSourceFile('asset.js', body, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS);
                const statement = module.statements[0];
                if (module.statements.length === 1 && ts.isExportAssignment(statement) && !statement.isExportEquals && ts.isStringLiteral(statement.expression)
                    && decodeURIComponent(new URL(statement.expression.text, url).pathname).replace(/^\//, '') === file) mapping = 'asset-url-module';
            }
            if (contentType.includes('application/json') || file.startsWith('public/locales/')) {
                original = body; mapping = 'raw-json';
            } else if (file.endsWith('.json') && /(?:javascript|ecmascript)/.test(contentType)) {
                try {
                    if (!isDeepStrictEqual(readViteJsonModule(body), JSON.parse(local))) throw new Error('JSON module content differs');
                    original = local; mapping = 'vite-json-module';
                } catch (error) { errors.push(`Served JSON module cannot be matched: ${file}: ${String(error)}`); }
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
                if (mapping === 'vite-css') {
                    const transformed = (await postcss([autoprefixer()]).process(local, { from: file, map: false })).css;
                    if (textHash(original) === textHash(transformed)) { original = local; mapping = 'vite-css-autoprefixer'; }
                    else if (await verifyViteCss(file, original)) { original = local; mapping = 'vite-css-recompiled'; }
                    else {
                        const offset = [...original].findIndex((character, index) => character !== local[index]);
                        mapping = `transformed-css-unmapped(local=${local.length},served=${original.length},offset=${offset})`;
                        original = undefined;
                    }
                }
                else errors.push(`Served source differs from working file: ${file}`);
            }
            servedSources.push({ path: file, url, responseHash: textHash(body), sourceHash: original == null ? undefined : textHash(original), mapping });
        })().catch(error => { errors.push(`${file}: ${String(error)}`); }));
    });
    const flush = async () => {
        let completed = 0;
        while (completed < pending.length) {
            const batch = pending.slice(completed);
            completed += batch.length;
            await Promise.all(batch);
        }
        if (errors.length) throw new Error(errors.join('\n'));
    };
    const verify = async () => {
        try { await Promise.all(pending); } finally { if (viteServerPromise) await (await viteServerPromise).close(); }
        for (const [path, expected] of files) {
            if (!existsSync(path) || hash(readFileSync(path)) !== expected) errors.push(`Source changed during run: ${path}`);
        }
        for (const path of requiredPaths) {
            if (!servedSources.some(source => source.path === path && source.sourceHash)) errors.push(`Required served source is not mapped: ${path}; responses: ${JSON.stringify(servedSources.filter(source => source.path === path).map(source => source.mapping))}`);
        }
        if (errors.length) throw new Error(errors.join('\n'));
        const unmapped = servedSources.filter(source => !source.sourceHash && source.mapping !== 'type-only-empty'
            && !(source.mapping === 'asset-url-module' && servedSources.some(mapped => mapped.path === source.path && mapped.mapping === 'raw-asset' && mapped.sourceHash)));
        return { status: unmapped.length ? 'INCOMPLETE' : 'COMPLETE', method: 'test-source-and-actual-browser-responses', files: [...files].map(([path, fileHash]) => ({ path, hash: fileHash })), servedSources, unmapped };
    };
    return Object.assign(verify, { flush });
}
