import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { attachPageDiagnostics, assertNoFatalFrontendErrors, disableAudio, setChineseLocale } from '../helpers/common';
import { QIDAHEN_ANNUAL_TUTORIAL } from '../../src/games/qidahen/annualTutorial';
import { clickVisibleButton } from './tutorialPointer';

// 七大恨的图集地图与物理骰子按正常浏览器GPU呈现；不继承Windows软件光栅化测试开关。
test.use({ channel: 'chromium', launchOptions: { args: [] } });

// 新对局的回合日志按真实时钟生成新身份；规则状态和日志内容仍逐字段比较。
const restartComparable = (core: QidahenCore) => ({ ...core, actionLog: core.actionLog.map(({ id: _logIdentity, ...entry }) => entry) });
const route = '/play/qidahen/tutorial/basic-opening';
const seed = 'tutorial-progress:v1:qidahen:basic-opening:r' + QIDAHEN_ANNUAL_TUTORIAL.revision;
const key = 'local_match_snapshot_v1:qidahen:' + seed;
const read = (page: Page) => page.evaluate(() => {
    const state = (window as any).__BG_TEST_HARNESS__.state.get();
    return { core: state.core, step: state.sys.tutorial.step?.id, revision: state.sys.tutorial.manifestRevision };
});

test('qidahen tutorial 真实刷新继续、回退、重新开始和旧版进度失效', async ({ page }) => {
    test.setTimeout(360_000); page.setDefaultTimeout(15_000);
    await setChineseLocale(page); await disableAudio(page);
    await page.addInitScript(() => { (window as any).__E2E_TEST_MODE__ = true; });
    const diagnostics = attachPageDiagnostics(page);
    const records: object[] = [];
    const waitStep = async (id: string) => {
        await expect(page.locator(`[data-tutorial-step="${id}"]`)).toBeVisible({ timeout: 90_000 });
        await page.waitForFunction(expected => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            return harness?.state?.get()?.sys?.tutorial?.step?.id === expected;
        }, id, { timeout: 90_000 });
    };
    await page.goto(route, { waitUntil: 'domcontentloaded' }); await waitStep('frontier-goal');
    const initial = await read(page);
    await clickVisibleButton(page, 'tutorial-next-button'); await waitStep('opening-move');
    await page.getByTestId('qidahen-wheel-move-target-move-1-free').click(); await waitStep('prepare-hand');
    const beforeReload = await read(page);
    await expect.poll(() => page.evaluate(k => JSON.parse(localStorage.getItem(k) ?? '{}').state?.sys?.tutorial?.step?.id, key)).toBe('prepare-hand');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: '从上次继续', exact: true })).toBeVisible({ timeout: 90_000 });
    await page.getByRole('button', { name: '从上次继续', exact: true }).click(); await waitStep('prepare-hand');
    expect((await read(page)).core).toEqual(beforeReload.core);
    records.push({ id: 'reload-continue', before: beforeReload, after: await read(page), assertions: [{ name: 'same-authoritative-match', actual: true, expected: true }] });
    await clickVisibleButton(page, 'tutorial-previous-button'); await waitStep('opening-move');
    expect((await read(page)).core.actionWheelPosition).toBe(initial.core.actionWheelPosition);
    await page.getByTestId('qidahen-wheel-move-target-move-1-free').click(); await waitStep('prepare-hand');
    expect((await read(page)).core).toEqual(beforeReload.core);
    records.push({ id: 'previous-and-redo', after: await read(page), assertions: [{ name: 'no-duplicate-move-or-payment', actual: true, expected: true }] });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: '重头开始', exact: true }).click({ timeout: 90_000 }); await waitStep('frontier-goal');
    expect(restartComparable((await read(page)).core)).toEqual(restartComparable(initial.core));
    records.push({ id: 'restart', after: await read(page), assertions: [{ name: 'fresh-legal-opening', actual: true, expected: true }] });
    await clickVisibleButton(page, 'tutorial-next-button'); await waitStep('opening-move');
    await expect.poll(() => page.evaluate(k => JSON.parse(localStorage.getItem(k) ?? '{}').state?.sys?.tutorial?.step?.id, key)).toBe('opening-move');
    // 构造旧版本的真实持久化快照，只验证版本拒绝恢复；不改当前对局规则结果。
    await page.evaluate(k => { const old = JSON.parse(localStorage.getItem(k)!); old.state.sys.tutorial.manifestRevision -= 1; localStorage.setItem(k, JSON.stringify(old)); location.reload(); }, key);
    await waitStep('frontier-goal');
    expect(restartComparable((await read(page)).core)).toEqual(restartComparable(initial.core));
    await expect(page.getByRole('button', { name: '从上次继续', exact: true })).toHaveCount(0);
    records.push({ id: 'outdated-progress', after: await read(page), assertions: [{ name: 'old-revision-not-resumed', actual: true, expected: true }] });
    await assertNoFatalFrontendErrors([{ label: 'tutorial-lifecycle', diagnostics }]);
    const dir = resolve(process.env.QIDAHEN_ANNUAL_EVIDENCE_ROOT ?? 'test-results/qidahen-annual-current', 'lifecycle'); mkdirSync(dir, { recursive: true });
    writeFileSync(resolve(dir, 'lifecycle-verification.json'), JSON.stringify({ gameId: 'qidahen', evidenceCategory: 'tutorial', status: 'PASS', revision: QIDAHEN_ANNUAL_TUTORIAL.revision, records }, null, 2));
});
