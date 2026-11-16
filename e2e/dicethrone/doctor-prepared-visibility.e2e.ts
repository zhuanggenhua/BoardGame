import { test, expect } from '../framework';
import { captureEvidenceSourceIdentity } from '../framework/sourceIdentity';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createEvidenceScreenshotRun, promoteEvidenceScreenshotRun, type EvidenceScreenshotIndexEntry } from '../framework/evidenceScreenshots';
import { initHeroState } from '../../src/games/dicethrone/domain/characters';
import { DOCTOR_STRANGE_CARDS } from '../../src/games/dicethrone/heroes/doctor_strange/cards';

test('奇异博士准备法术遮盖层收起与恢复', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    const run = await createEvidenceScreenshotRun(testInfo);
    const contractPath = resolve('e2e/dicethrone/doctor-strange-required-ui-states.json');
    const contractBytes = readFileSync(contractPath);
    const output = resolve('temp/doctor-prepared-runs', run.runId);
    mkdirSync(output, { recursive: true });
    const random = { shuffle: <T>(a: T[]) => a, random: () => 0.5, d: (_n: number) => 1, range: (n: number, _m: number) => n };
    const ids = ['spell-flames-of-faltine', 'spell-rings-of-raggadorr', 'spell-vapors-of-valtorr'];
    await page.setViewportSize({ width: 1920, height: 1080 });
    await game.openTestGame('dicethrone', { playerID: '0', disableLocalAiAutomation: true, seat0: 'human', seat1: 'human' });
    const media: Array<{ label: string; file: string; sha256: string }> = [];
    const coreMedia: EvidenceScreenshotIndexEntry[] = [];
    const coreSteps: Array<object> = [];
    for (const [label, width, height, count] of [['桌面单张', 1920, 1080, 1], ['桌面多张', 1920, 1080, 3], ['桌面1440', 1440, 900, 1], ['横屏单张', 812, 375, 1], ['横屏多张', 812, 375, 3]] as const) {
        await page.setViewportSize({ width, height });
        const player = initHeroState('0', 'doctor_strange', random);
        const opponent = initHeroState('1', 'monk', random);
        Object.assign(player.resources, { CP: 3, cp: 3, HP: 50, hp: 50 });
        Object.assign(opponent.resources, { CP: 3, cp: 3, HP: 50, hp: 50 });
        player.preparedSpells = ids.slice(0, count).map(id => structuredClone(DOCTOR_STRANGE_CARDS.find(card => card.id === id)!));
        player.deck = DOCTOR_STRANGE_CARDS.filter(card => !ids.slice(0, count).includes(card.id)).map(card => structuredClone(card));
        player.hand = [];
        await game.setupScene({ gameId: 'dicethrone', currentPlayer: '0', phase: 'main1', extra: { players: { '0': player, '1': opponent }, selectedCharacters: { '0': 'doctor_strange', '1': 'monk' }, hostStarted: true, readyPlayers: { '0': true, '1': true } } });
        const zone = page.locator('[data-prepared-spell-zone="public"]');
        const cards = zone.locator('[data-prepared-spell-card]');
        const toggle = page.getByTestId('dt-prepared-spells-visibility');
        const toggleBounds = await toggle.boundingBox();
        for (const resource of ['health', 'cp']) {
            const resourceBounds = await page.locator(`[data-dicethrone-resource="${resource}"]`).first().boundingBox();
            expect(toggleBounds && resourceBounds && (
                toggleBounds.x + toggleBounds.width <= resourceBounds.x || resourceBounds.x + resourceBounds.width <= toggleBounds.x
                || toggleBounds.y + toggleBounds.height <= resourceBounds.y || resourceBounds.y + resourceBounds.height <= toggleBounds.y
            ), `${label} 法术显示按钮不得遮挡 ${resource}: ${JSON.stringify({ toggleBounds, resourceBounds })}`).toBeTruthy();
        }
        await expect(cards).toHaveCount(count);
        await zone.locator('[data-card-atlas-img]').first().waitFor({ state: 'attached', timeout: 30000 });
        const tipToggle = page.locator('[data-tutorial-id="tip-board"] > button').first();
        for (let i = 0; i < 2; i++) {
            await tipToggle.click();
            await page.evaluate(async () => { await Promise.all(document.getAnimations().filter(a => Number.isFinite(a.effect?.getComputedTiming().endTime)).map(a => a.finished.catch(() => {}))); });
            await expect.poll(async () => {
                const anchor = await zone.boundingBox();
                const control = await toggle.boundingBox();
                return anchor && control ? Math.abs(control.x + control.width - anchor.x) : Infinity;
            }).toBeLessThan(1);
        }
        if (count > 1) {
            const scroll = zone.locator('.overflow-x-auto');
            await scroll.evaluate(node => { node.scrollLeft = 0; });
            await expect(zone.locator('[data-prepared-spell-direction="next"]')).toBeEnabled();
            await zone.locator('[data-prepared-spell-direction="next"]').click();
            await zone.locator('[data-prepared-spell-direction="next"]').click();
            await expect.poll(() => scroll.evaluate(node => node.scrollLeft)).toBeGreaterThan(0);
        }
        const zoneBox = await zone.boundingBox();
        const toggleBox = await toggle.boundingBox();
        expect(zoneBox && toggleBox && toggleBox.x + toggleBox.width <= zoneBox.x + 0.5).toBeTruthy();
        const response = page.getByTestId('auto-response-toggle');
        const responseBefore = await response.getAttribute('aria-pressed');
        await response.click();
        await expect(response).not.toHaveAttribute('aria-pressed', responseBefore!);
        await response.click();
        await expect(response).toHaveAttribute('aria-pressed', responseBefore!);
        const handToggle = page.getByTestId('dicethrone-hand-visibility-toggle');
        const handBefore = await handToggle.getAttribute('aria-pressed');
        await handToggle.click();
        await expect(handToggle).not.toHaveAttribute('aria-pressed', handBefore!);
        await handToggle.click();
        await expect(handToggle).toHaveAttribute('aria-pressed', handBefore!);
        const scrollPosition = await zone.locator('.overflow-x-auto').evaluate(node => node.scrollLeft);
        const saved = (await game.getState()).core.players['0'].preparedSpells.map((card: { id: string }) => card.id);
        const capture = async (state: string) => {
            await page.mouse.move(0, 0);
            await page.evaluate(async () => { await document.fonts.ready; await Promise.all(document.getAnimations().filter(a => Number.isFinite(a.effect?.getComputedTiming().endTime)).map(a => a.finished.catch(() => {}))); });
            const file = resolve(output, `${label}-${state}.png`);
            const bytes = await page.screenshot({ path: file });
            media.push({ label: `${label}-${state}`, file, sha256: createHash('sha256').update(bytes).digest('hex') });
            if (label === '桌面单张' && state !== '恢复法术') {
                const name = `${label}-${state}.png`;
                writeFileSync(join(run.stagingDir, name), bytes);
                coreMedia.push({ path: name, chainId: '准备法术隐藏与恢复', chainStep: state === '法术显示' ? 1 : 2, stage: '独特界面态', role: 'main-flow',
                    uiStateId: state === '法术显示' ? 'doctor-prepared-visible' : 'doctor-prepared-hidden',
                    behaviorStepId: 'hide-prepared-spells', uiChange: 'interaction-mode',
                    uiChangeReason: state === '法术显示' ? '法术覆盖准备槽' : '隐藏法术露出被动',
                    viewport: 'desktop', description: state === '法术显示' ? '准备槽显示法术和隐藏按钮。' : '法术收起后露出被动和恢复按钮。' });
            }
        };
        const snapshot = async () => ({
            visible: { pressed: await toggle.getAttribute('aria-pressed'), cardVisible: await cards.first().isVisible() },
            authoritative: { preparedSpells: (await game.getState()).core.players['0'].preparedSpells.map((card: { id: string }) => card.id) },
        });
        await expect(toggle).toHaveAttribute('aria-pressed', 'false');
        await capture('法术显示');
        const beforeHide = label === '桌面单张' ? await snapshot() : undefined;
        await toggle.click({ timeout: 5000 });
        await expect(toggle).toHaveAttribute('aria-pressed', 'true');
        await expect(cards.first()).toBeHidden();
        expect((await game.getState()).core.players['0'].preparedSpells.map((card: { id: string }) => card.id)).toEqual(saved);
        await capture('露出被动');
        const afterHide = label === '桌面单张' ? await snapshot() : undefined;
        await toggle.click({ timeout: 5000 });
        await expect(toggle).toHaveAttribute('aria-pressed', 'false');
        await expect(cards.last()).toBeVisible();
        await expect.poll(() => zone.locator('.overflow-x-auto').evaluate(node => node.scrollLeft)).toBe(scrollPosition);
        expect((await game.getState()).core.players['0'].preparedSpells.map((card: { id: string }) => card.id)).toEqual(saved);
        await capture('恢复法术');
        if (beforeHide && afterHide) {
            const afterRestore = await snapshot();
            coreSteps.push({ id: 'hide-prepared-spells', action: '点击槽外按钮隐藏法术', before: beforeHide, after: afterHide,
                assertions: [{ name: '隐藏按钮状态', actual: afterHide.visible.pressed, expected: 'true' }, { name: '法术隐藏', actual: afterHide.visible.cardVisible, expected: false }, { name: '准备法术保持', actual: afterHide.authoritative.preparedSpells, expected: saved }] });
            coreSteps.push({ id: 'restore-prepared-spells', action: '再次点击按钮恢复法术', before: afterHide, after: afterRestore,
                assertions: [{ name: '恢复按钮状态', actual: afterRestore.visible.pressed, expected: 'false' }, { name: '法术恢复', actual: afterRestore.visible.cardVisible, expected: true }, { name: '准备法术保持', actual: afterRestore.authoritative.preparedSpells, expected: saved }] });
        }
    }
    const identity = await captureEvidenceSourceIdentity(page, 'dicethrone');
    writeFileSync(resolve(output, 'capture.json'), JSON.stringify({ identity, media }, null, 2));
    expect(readFileSync(contractPath).equals(contractBytes), '必要截图合同在采集期间不得改变').toBe(true);
    expect(coreMedia).toHaveLength(2);
    const enriched = coreMedia.map(entry => ({ ...entry, sourceRevision: identity.sourceRevision, requirements: ['准备法术显示与隐藏'] }));
    const trace = { gameId: 'dicethrone', evidenceCategory: 'independent', chainId: '准备法术隐藏与恢复', sourceRun: run.runId,
        sourceRevision: identity.sourceRevision, status: 'PASS', outcome: '真实点击隐藏和恢复法术，准备区内容保持。', steps: coreSteps,
        captureContract: { sha256: createHash('sha256').update(contractBytes).digest('hex') },
        uiStates: enriched.map(entry => ({ id: entry.uiStateId, stepId: entry.behaviorStepId, change: entry.uiChange,
            viewport: entry.viewport, sha256: createHash('sha256').update(readFileSync(join(run.stagingDir, entry.path))).digest('hex') })) };
    writeFileSync(join(run.stagingDir, '准备法术隐藏与恢复.trace.json'), JSON.stringify(trace, null, 2));
    writeFileSync(join(run.stagingDir, '.source-identity.json'), JSON.stringify(identity, null, 2));
    await promoteEvidenceScreenshotRun(run, { version: 2, gameId: 'dicethrone', evidenceCategory: 'independent', capturePolicy: 'distinct-ui-state', media: enriched });
});
