// @vitest-environment node
import { createServer, type Server } from 'node:http';
import { readFileSync } from 'node:fs';
import { chromium, type Browser, type Page } from '@playwright/test';
import ts from 'typescript';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// No game server, Mongo, external network or user data: two blank same-origin
// pages execute the actual compiled credential functions and native IndexedDB.
const compile = (path: string) => ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
} }).outputText;
const boot = `(() => {
 const load = (source, deps = {}) => { const module = {exports:{}}; new Function('module','exports','require', source)(module,module.exports,id => deps[id] || {}); return module.exports; };
 const transaction = load(${JSON.stringify(compile('src/hooks/match/matchCredentialTransaction.ts'))});
 const storage = load(${JSON.stringify(compile('src/lib/browserStorage.ts'))});
 window.writer = transaction;
 window.api = load(${JSON.stringify(compile('src/hooks/match/useMatchStatus.ts'))}, {'./matchCredentialTransaction':transaction, '../../lib/browserStorage':storage});
})()`;

let server: Server; let browser: Browser; let a: Page; let b: Page;
beforeAll(async () => {
    server = createServer((_req, res) => { res.end('<!doctype html><title>isolated credential test</title>'); });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address(); if (!address || typeof address === 'string') throw new Error('missing port');
    browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
    const context = await browser.newContext(); a = await context.newPage(); b = await context.newPage();
    await Promise.all([a.goto(`http://127.0.0.1:${address.port}`), b.goto(`http://127.0.0.1:${address.port}`)]);
    await Promise.all([a.evaluate(boot), b.evaluate(boot)]);
});
afterAll(async () => { await browser?.close(); await new Promise<void>(resolve => server?.close(() => resolve())); });
const evaluate = (page: Page, code: string) => page.evaluate(code);

describe('native cross-page IndexedDB exclusion for production credentials', () => {
    it('queues the second independent connection until the first real readwrite transaction completes', async () => {
        await evaluate(a, `new Promise((resolve,reject)=>{ const o=indexedDB.open('boardgame-match-credential-writes',1);o.onupgradeneeded=()=>o.result.createObjectStore('exclusive-writes');o.onerror=reject;o.onsuccess=()=>{ window.holdDb=o.result; const tx=o.result.transaction('exclusive-writes','readwrite');window.releaseHold=false; const s=tx.objectStore('exclusive-writes');function loop(){s.get('hold').onsuccess=()=>{if(!window.releaseHold)loop()}}loop();resolve(true);tx.oncomplete=()=>{window.holdComplete=true;window.holdDb.close()};};})`);
        await evaluate(b, `window.writeDone=false; window.pendingWrite=api.persistMatchCredentials('chosen',{matchID:'chosen',playerID:'1',credentials:'synthetic'}).then(()=>window.writeDone=true); true`);
        await new Promise(resolve => setTimeout(resolve, 80));
        expect(await evaluate(b, 'window.writeDone')).toBe(false);
        expect(await evaluate(b, "localStorage.getItem('match_creds_chosen')")).toBeNull();
        await evaluate(a, 'window.releaseHold=true');
        await evaluate(b, 'window.pendingWrite');
        expect(await evaluate(a, 'window.holdComplete')).toBe(true);
        expect(await evaluate(a, "api.readStoredMatchCredentials('chosen').credentials")).toBe('synthetic');
    });

    it('serializes actual rematch, selection and Home pruning across two pages', async () => {
        await evaluate(a, 'localStorage.clear()');
        await evaluate(a, "api.persistMatchCredentials('old',{matchID:'old',playerID:'0',credentials:'old'})");
        await Promise.all([
            evaluate(a, "api.persistRematchOwnerCredentials('old',{matchID:'next',playerID:'0',credentials:'next'}, {matchID:'next',gameName:'betrayal'})"),
            evaluate(b, "api.persistMatchCredentials('chosen',{matchID:'chosen',playerID:'1',credentials:'chosen'}, {owner:{matchID:'chosen',gameName:'betrayal'}})"),
        ]);
        await evaluate(a, 'api.pruneStoredMatchCredentials()');
        expect(await evaluate(b, 'api.listStoredMatchCredentials().map(c=>c.matchID)')).toEqual(['chosen']);
        expect(await evaluate(b, 'api.getOwnerActiveMatch().matchID')).toBe('chosen');
    });

    it('releases an abandoned tab native transaction without a stale lease or destructive retry', async () => {
        const closing = await a.context().newPage(); await closing.goto(a.url()); await closing.evaluate(boot);
        await evaluate(closing, `new Promise(resolve=>{const o=indexedDB.open('boardgame-match-credential-writes',1);o.onsuccess=()=>{const tx=o.result.transaction('exclusive-writes','readwrite');const s=tx.objectStore('exclusive-writes');function loop(){s.get('hold').onsuccess=loop}loop();resolve(true)}})`);
        await evaluate(b, `window.nextWrite=api.persistMatchCredentials('after-close',{matchID:'after-close',playerID:'1',credentials:'after-close'}); true`);
        await closing.close(); await evaluate(b, 'window.nextWrite');
        expect(await evaluate(a, "api.readStoredMatchCredentials('after-close').credentials")).toBe('after-close');
    });
});
