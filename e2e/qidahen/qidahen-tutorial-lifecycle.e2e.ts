import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { attachPageDiagnostics, assertNoFatalFrontendErrors, disableAudio, setChineseLocale } from '../helpers/common';
import { QIDAHEN_ANNUAL_TUTORIAL } from '../../src/games/qidahen/annualTutorial';
import type { QidahenCore } from '../../src/games/qidahen/domain/types';
import { clickVisibleButton } from './tutorialPointer';
import { waitForQidahenVisualReady } from './visualReady';
import { qidahenTutorialProgressIdentity as progressIdentity, readQidahenStoredTutorialStep as storedStep } from './tutorialPersistence';
import { QIDAHEN_VISUAL_SOURCE_PATHS, requireCompleteQidahenSourceIdentity, trackQidahenSourceIdentity } from './sourceIdentity';

// 七大恨的图集地图与物理骰子按正常浏览器GPU呈现；不继承Windows软件光栅化测试开关。
test.use({ channel: 'chromium', launchOptions: { args: [] } });

// 新对局的回合日志按真实时钟生成新身份；规则状态和日志内容仍逐字段比较。
const restartComparable = (core: QidahenCore) => ({ ...core, actionLog: core.actionLog.map(({ id: _logIdentity, ...entry }) => entry) });
const route = '/play/qidahen/tutorial/basic-opening';
const read = (page: Page) => page.evaluate(() => {
    const state = (window as any).__BG_TEST_HARNESS__.state.get();
    return { core: state.core, step: state.sys.tutorial.step?.id, revision: state.sys.tutorial.manifestRevision };
});

test('qidahen tutorial 真实刷新继续、回退、重开、旧版失效及退出清理', async ({ page }) => {
    test.setTimeout(360_000); page.setDefaultTimeout(15_000);
    await setChineseLocale(page); await disableAudio(page);
    await page.addInitScript(() => { (window as any).__E2E_TEST_MODE__ = true; });
    const diagnostics = attachPageDiagnostics(page);
    const verifySourceIdentity = trackQidahenSourceIdentity(page, 'e2e/qidahen/qidahen-tutorial-lifecycle.e2e.ts', ['e2e/qidahen/sourceIdentity.ts'], QIDAHEN_VISUAL_SOURCE_PATHS);
    const records: object[] = [];
    const waitStep = async (id: string) => {
        await expect(page.locator(`[data-tutorial-step="${id}"]`)).toBeVisible({ timeout: 90_000 });
        await page.waitForFunction(expected => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            return harness?.state?.get()?.sys?.tutorial?.step?.id === expected;
        }, id, { timeout: 90_000 });
        await waitForQidahenVisualReady(page);
    };
    await page.goto(route, { waitUntil: 'domcontentloaded' }); await waitStep('frontier-goal');
    const initial = await read(page);
    await clickVisibleButton(page, 'tutorial-next-button'); await waitStep('frontier-target');
    await clickVisibleButton(page, 'tutorial-next-button'); await waitStep('opening-move');
    await page.getByTestId('qidahen-wheel-move-target-move-1-free').click(); await waitStep('farm-action');
    const beforeReload = await read(page);
    await expect.poll(() => storedStep(page)).toBe('farm-action');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: '从上次继续', exact: true })).toBeVisible({ timeout: 90_000 });
    await page.getByRole('button', { name: '从上次继续', exact: true }).click(); await waitStep('farm-action');
    expect((await read(page)).core).toEqual(beforeReload.core);
    records.push({ id: 'reload-continue', before: beforeReload, after: await read(page), assertions: [{ name: 'same-authoritative-match', actual: true, expected: true }] });
    await clickVisibleButton(page, 'tutorial-previous-button'); await waitStep('opening-move');
    expect((await read(page)).core.actionWheelPosition).toBe(initial.core.actionWheelPosition);
    await page.getByTestId('qidahen-wheel-move-target-move-1-free').click(); await waitStep('farm-action');
    expect((await read(page)).core).toEqual(beforeReload.core);
    records.push({ id: 'previous-and-redo', after: await read(page), assertions: [{ name: 'no-duplicate-move-or-payment', actual: true, expected: true }] });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: '重头开始', exact: true }).click({ timeout: 90_000 }); await waitStep('frontier-goal');
    expect(restartComparable((await read(page)).core)).toEqual(restartComparable(initial.core));
    records.push({ id: 'restart', after: await read(page), assertions: [{ name: 'fresh-legal-opening', actual: true, expected: true }] });
    await clickVisibleButton(page, 'tutorial-next-button'); await waitStep('frontier-target');
    await clickVisibleButton(page, 'tutorial-next-button'); await waitStep('opening-move');
    await expect.poll(() => storedStep(page)).toBe('opening-move');
    // 构造旧版本的真实持久化快照，只验证版本拒绝恢复；不改当前对局规则结果。
    await page.evaluate(async identity => {
        const path = '/src/engine/transport/localSession.ts';
        const { readLocalMatchSnapshot, persistLocalMatchSnapshot } = await import(path);
        const old = readLocalMatchSnapshot(identity)!;
        old.state.sys.tutorial.manifestRevision -= 1;
        persistLocalMatchSnapshot(old);
        location.reload();
    }, progressIdentity);
    await waitStep('frontier-goal');
    expect(restartComparable((await read(page)).core)).toEqual(restartComparable(initial.core));
    await expect(page.getByRole('button', { name: '从上次继续', exact: true })).toHaveCount(0);
    records.push({ id: 'outdated-progress', after: await read(page), assertions: [{ name: 'old-revision-not-resumed', actual: true, expected: true }] });
    await page.getByTestId('fab-menu').locator('button[data-fab-id]').first().click();
    await page.getByRole('button', { name: '离开', exact: true }).click();
    await page.getByTestId('fab-panel-exit').getByRole('button', { name: /返回大厅/ }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('[data-tutorial-step]')).toHaveCount(0);
    await expect(page.getByTestId('tutorial-highlight-ring')).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => (window as any).__BG_TUTORIAL_CONTEXT_DIAGNOSTICS__?.active)).toBe(false);
    records.push({ id: 'exit-through-real-menu', assertions: [{ name: 'tutorial-overlay-highlight-and-context-cleared', actual: true, expected: true }] });
    // 大厅仍会异步加载模块；离开前收完真实响应，避免导航销毁尚在读取的响应体。
    await page.waitForLoadState('networkidle', { timeout: 30_000 });
    await verifySourceIdentity.flush();
    await page.goto('/play/qidahen', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('qidahen-board')).toBeVisible({ timeout: 90_000 });
    await expect.poll(() => page.evaluate(() => Boolean((window as any).__BG_TEST_HARNESS__?.state.get()?.sys?.tutorial?.active))).toBe(false);
    await expect(page.locator('[data-tutorial-step]')).toHaveCount(0);
    await expect(page.getByTestId('tutorial-highlight-ring')).toHaveCount(0);
    records.push({ id: 'ordinary-room-after-exit', assertions: [{ name: 'ordinary-game-does-not-reactivate-old-tutorial', actual: true, expected: true }] });
    await assertNoFatalFrontendErrors([{ label: 'tutorial-lifecycle', diagnostics }]);
    const sourceIdentity = await verifySourceIdentity();
    requireCompleteQidahenSourceIdentity(sourceIdentity);
    const dir = resolve(process.env.QIDAHEN_ANNUAL_EVIDENCE_ROOT ?? 'test-results/qidahen-annual-current', 'lifecycle'); mkdirSync(dir, { recursive: true });
    writeFileSync(resolve(dir, 'lifecycle-verification.json'), JSON.stringify({ gameId: 'qidahen', evidenceCategory: 'tutorial', status: 'PASS', revision: QIDAHEN_ANNUAL_TUTORIAL.revision, sourceIdentity, records }, null, 2));
});
