import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { disableAudio, setChineseLocale } from '../helpers/common';
import { encodeLocalMatchSnapshot } from '../../src/engine/transport/localSessionCodec';
import { qidahenTutorialProgressIdentity } from './tutorialPersistence';
import { QIDAHEN_ANNUAL_TUTORIAL } from '../../src/games/qidahen/annualTutorial';

const directory = resolve('test-results/qidahen-feedback-dice-capture');
const openFeedback = async (page: Page) => {
    if (!(await page.locator('[data-fab-id="feedback"]').isVisible())) await page.getByTestId('fab-menu').locator('button').first().click();
    await page.locator('[data-fab-id="feedback"]').click();
    await expect(page.getByTestId('feedback-modal')).toBeVisible();
};
const saveFeedback = async (page: Page, name: string) => {
    const button = page.getByTestId('feedback-capture-screenshot');
    const preview = page.getByTestId('feedback-image-preview').locator('img');
    const previous = await preview.count() ? await preview.getAttribute('src') : null;
    await button.click();
    await expect(button).toBeDisabled({ timeout: 10_000 });
    await expect(button).toBeEnabled({ timeout: 60_000 });
    if (await page.getByTestId('feedback-modal').getByText('截图失败，请重试或粘贴图片').count()) {
        const body = await page.locator('body').innerText();
        writeFileSync(resolve(directory, `${name}-failure.txt`), body);
        writeFileSync(resolve(directory, `${name}-failure-clicks.json`), JSON.stringify(await page.evaluate(() => (window as any).__feedbackCaptureClicks), null, 2));
        throw new Error(`截图失败：${body.slice(-1600)}`);
    }
    await expect(preview).toHaveAttribute('src', /^data:image\/jpeg;base64,/, { timeout: 60_000 });
    if (previous) await expect(preview).not.toHaveAttribute('src', previous);
    const data = (await preview.getAttribute('src'))!;
    writeFileSync(resolve(directory, `${name}.jpg`), Buffer.from(data.split(',')[1], 'base64'));
};

test('正式反馈界面手动截图：战斗骰子与终局 portal', async ({ page }) => {
    test.setTimeout(240_000); mkdirSync(directory, { recursive: true });
    await setChineseLocale(page); await disableAudio(page); await page.setViewportSize({ width: 1920, height: 1080 });
    const saved = JSON.parse(readFileSync('test-results/.tmp-qidahen-branch-diagnostic/battle-roll.json', 'utf8'));
    // 历史 r28 战斗代表态仅用于当前运行时的局部截图诊断，不是 r30 自然流程证据。
    saved.seed = qidahenTutorialProgressIdentity.seed;
    saved.state.sys.tutorial.manifestRevision = 30;
    saved.state.sys.tutorial.stepIndex = QIDAHEN_ANNUAL_TUTORIAL.steps.findIndex(step => step.id === 'battle-roll');
    const encoded = encodeLocalMatchSnapshot(saved);
    await page.addInitScript(({ encoded, seed }) => {
        (window as any).__E2E_TEST_MODE__ = true;
        localStorage.setItem(`local_match_snapshot_v1:qidahen:${seed}`, encoded);
        document.addEventListener('click', event => {
            if (!(event.target as Element)?.closest?.('[data-testid="feedback-capture-screenshot"]')) return;
            const sequence = document.querySelector('[data-battle-roll-phase]');
            (window as any).__feedbackCaptureClicks = [...((window as any).__feedbackCaptureClicks ?? []), {
                phase: sequence?.getAttribute('data-battle-roll-phase') ?? null,
                state: sequence?.getAttribute('data-battle-roll-state') ?? null,
                dice: [...document.querySelectorAll('[data-dice-physics-source="dice-box-threejs"] canvas')].map(el => el.getAttribute('data-testid')),
                wrappers: [...document.querySelectorAll('[data-dice-physics-source="dice-box-threejs"]')].map(el => ({ id: el.getAttribute('data-testid'), outer: el.outerHTML.slice(0, 600), ignored: !!el.closest('[data-html2canvas-ignore]') })),
                at: Date.now(),
            }];
        }, true);
    }, { encoded, seed: qidahenTutorialProgressIdentity.seed });
    await page.goto('/play/qidahen/tutorial/basic-opening', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: '从上次继续', exact: true }).click({ timeout: 90_000 });
    await expect(page.locator('[data-tutorial-step="battle-roll"]')).toBeVisible({ timeout: 60_000 });
    await page.getByTestId('qidahen-resolve-pending-action').click({ timeout: 15_000 });
    await expect(page.locator('[data-dice-physics-source="dice-box-threejs"] canvas').first()).toBeVisible({ timeout: 30_000 });
    await openFeedback(page);
    await saveFeedback(page, 'battle-manual');
    const clicks = await page.evaluate(() => (window as any).__feedbackCaptureClicks);
    writeFileSync(resolve(directory, 'battle-clicks.json'), JSON.stringify({ flow: 'representative-state', clicks }, null, 2));
    expect(clicks[0]?.dice.length, '必须在骰子实际显示时点击截图').toBeGreaterThan(0);
    await page.getByTestId('feedback-modal').getByRole('button', { name: /关闭|close/i }).click();
    await expect(page.getByTestId('feedback-modal')).toHaveCount(0);
    await expect(page.getByTestId('qidahen-battle-roll-sequence')).toHaveCount(0, { timeout: 60_000 });
    await expect(page.getByTestId('qidahen-post-battle-selection')).toBeVisible({ timeout: 30_000 });
    await page.evaluate(async () => {
        const api = (window as any).__BG_TEST_HARNESS__.state; const next = structuredClone(api.get());
        next.sys = { ...next.sys, phase: 'end', gameover: { winner: '0' } }; await api.set(next);
    });
    await expect(page.getByTestId('endgame-overlay')).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(1200);
    await openFeedback(page);
    await expect(page.getByTestId('endgame-overlay')).toBeVisible();
    await saveFeedback(page, 'endgame-manual');
    await expect(page.getByTestId('endgame-overlay')).toBeVisible();
});
