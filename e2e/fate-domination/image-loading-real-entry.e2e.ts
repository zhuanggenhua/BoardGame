import {expect, test} from '@playwright/test';
import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {initContext} from '../helpers/common';
import {createEvidenceScreenshotRun, promoteEvidenceScreenshotRun} from '../framework/evidenceScreenshots';
import {captureEvidenceSourceIdentity, releaseSourceSession, startSourceSession} from '../framework/sourceIdentity';

test.use({viewport: {width: 1920, height: 1080}});
test.afterEach(async ({context}) => { await releaseSourceSession(context); });

test('真实牌桌独立卡图加载与恢复：合法牌库顺序代表态保留扫光牌框', async ({page, context, baseURL}, testInfo) => {
    test.setTimeout(150000);
    await initContext(context, {skipTutorial: false, skipImageGate: false});
    await startSourceSession(context, baseURL!);
    const run = await createEvidenceScreenshotRun(testInfo, {requireChineseName: true});
    await mkdir(run.stagingDir, {recursive: true});
    let releaseImages!: () => void;
    const heldImages = new Promise<void>(resolve => { releaseImages = resolve; });
    const requests: string[] = [];
    // 只延迟真实资源请求，不改变游戏状态或图片组件。
    await context.route(/fate-domination\/cards\/(?:compressed\/)?attack-[^/?]+\.(?:webp|png|avif)/, async route => {
        requests.push(route.request().url());
        await heldImages;
        await route.continue();
    });
    try {
        await page.goto(`${baseURL}/play/fate-domination/tutorial`, {waitUntil: 'domcontentloaded'});
        await expect(page.getByTestId('tutorial-overlay-card')).toBeVisible({timeout: 45000});
        await page.getByRole('button', {name: '下一步', exact: true}).click();
        await expect(page.getByTestId('tutorial-overlay-card')).toContainText('将他们的手牌补充到上限');
        await page.getByRole('button', {name: '下一步', exact: true}).click();
        await page.getByTestId('fate-domination-primary-action').click();
        const slot = page.locator('.fd-runtime-deployment-slot:not(:disabled)').first();
        await expect(slot).toBeVisible({timeout: 20000});
        await slot.click();
        await expect.poll(()=>page.evaluate(()=>(window as any).__BG_TEST_HARNESS__.state.get().core.players['0'].locationId)).toBe('workshop');
        const fixture = await page.evaluate(async () => {
            const harness = (window as any).__BG_TEST_HARNESS__, state = harness.state.get();
            const player = state.core.players['0'], before = player.deck.map((card: any) => card.id);
            if (!state.core.initialAttackHandDealtPlayerIds.includes('0')) throw new Error('必须先由正式准备完成初始洗牌和抽牌');
            const card = player.deck.find((candidate: any) => candidate.definitionId === 'cardB1');
            if (!card) throw new Error('正式牌库缺少真实追击实例');
            const deck = [card, ...player.deck.filter((candidate: any) => candidate.id !== card.id)];
            await harness.state.patch({core: {...state.core, players: {...state.core.players, '0': {...player, deck}}}});
            return {before, after: harness.state.get().core.players['0'].deck.map((candidate: any) => candidate.id)};
        });
        expect([...fixture.before].sort()).toEqual([...fixture.after].sort());
        await page.getByRole('button', {name: '发动战略部署', exact: true}).click();
        // 图集和独立卡图owner不同；代表态只改变未抽的合法牌库顺序，不补牌或预置加载结果。
        const pendingCards = page.locator('.fd-attack-hand-zone .fd-runtime-card img[alt=""]');
        const cards = page.locator('.fd-attack-hand-zone .fd-runtime-card img');
        await expect.poll(() => requests.length, {timeout: 30000}).toBeGreaterThan(0);
        await expect(pendingCards.first()).toBeVisible({timeout: 30000});
        const loading = await pendingCards.evaluateAll(images => images.map(element => {
            const image = element as HTMLImageElement, style = getComputedStyle(image), rect = image.getBoundingClientRect();
            return {alt: image.alt, label: image.getAttribute('aria-label'), loaded: image.complete && image.naturalWidth > 0,
                animation: style.animationName, background: style.backgroundImage, width: rect.width, height: rect.height};
        }));
        expect(loading.length).toBeGreaterThan(0);
        expect(loading.every(image => !image.loaded && image.alt === '' && image.label && image.animation.includes('img-shimmer') && image.height > 100)).toBe(true);
        await page.screenshot({path: path.join(run.stagingDir, '01-真实手牌请求延迟时保留扫光牌框.png')});
        releaseImages();
        await expect.poll(() => cards.evaluateAll(images => images.every(element => {
            const image = element as HTMLImageElement;
            return image.complete && image.naturalWidth > 0 && image.alt.length > 0 && !getComputedStyle(image).animationName.includes('img-shimmer');
        })), {timeout: 45000}).toBe(true);
        const decoded = await cards.evaluateAll(images => images.map(element => {
            const image = element as HTMLImageElement, rect = image.getBoundingClientRect();
            return {label: image.getAttribute('aria-label'), width: rect.width, height: rect.height};
        }));
        for (const item of loading) {
            const result = decoded.find(image => image.label === item.label);
            expect(result?.width).toBe(item.width);
            // 原图比例略有差别；保留原图完整性，不把占位比误当成逐像素等高合同。
            expect(result?.height).toBeGreaterThan(100);
        }
        await page.screenshot({path: path.join(run.stagingDir, '02-真实资源返回后完整卡面替代扫光.png')});
        const identity = await captureEvidenceSourceIdentity(page, 'fate-domination');
        await writeFile(path.join(run.stagingDir, 'source-identity.json'), JSON.stringify(identity, null, 2));
        await writeFile(path.join(run.stagingDir, 'behavior-trace.json'), JSON.stringify({
            gameId: 'fate-domination', evidenceCategory: 'independent', sourceRun: run.runId, sourceRevision: identity.sourceRevision,
            status: 'PASS', visualStatus: 'PENDING', boundary: '合法牌库顺序代表态：正式准备和部署完成后，只将本人未抽牌库的追击实例置顶；再由战略部署真实抽牌并恢复资源请求。不补牌，不代表自然教程主线、生产断网或所有候选耗尽。',
            fixture, requests, loading, decoded, steps: [
                {id: 'cards-loading', action: '正式准备及部署后，战略部署抽取未抽牌库顶部的真实独立卡图', assertions: [{name: 'shimmer-with-empty-visual-alt', actual: true, expected: true}]},
                {id: 'cards-loaded', action: '放行原资源请求，保持同一牌桌', assertions: [{name: 'decoded-images-replace-shimmer', actual: true, expected: true}]},
            ],
        }, null, 2));
        await promoteEvidenceScreenshotRun(run, {gameId: 'fate-domination', evidenceCategory: 'independent', capturePolicy: 'distinct-ui-state', media: [
            ['01-真实手牌请求延迟时保留扫光牌框.png', 'cards-loading', '真实抽牌的图片请求暂未返回，扫光和原生文字分离'],
            ['02-真实资源返回后完整卡面替代扫光.png', 'cards-loaded', '同一手牌真实资源返回并解码，恢复完整卡面'],
        ].map(([filename, id, description], index) => ({path: path.join(run.stableDir, filename).split(path.sep).join('/'), chainId: 'fate-real-card-image-loading',
            chainStep: index + 1, stage: '独特界面态', role: 'main-flow', uiStateId: id, uiChange: 'layout', uiChangeReason: description,
            behaviorStepId: id, sourceRevision: identity.sourceRevision, description, transition: description, viewport: 'desktop'}))});
    } finally {
        releaseImages();
        await context.unrouteAll({behavior: 'ignoreErrors'});
    }
});
