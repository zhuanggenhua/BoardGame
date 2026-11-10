import { test, expect } from '../framework';
import { captureEvidenceSourceIdentity } from '../framework/sourceIdentity';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { initHeroState } from '../../src/games/dicethrone/domain/characters';
import { DOCTOR_STRANGE_CARDS } from '../../src/games/dicethrone/heroes/doctor_strange/cards';

test('奇异博士准备法术遮盖层收起与恢复', async ({ page, game }) => {
    test.setTimeout(120000);
    const output = resolve('temp/doctor-outside-current-20261104');
    mkdirSync(output, { recursive: true });
    const random = { shuffle: <T>(a: T[]) => a, random: () => 0.5, d: (_n: number) => 1, range: (n: number, _m: number) => n };
    const ids = ['spell-flames-of-faltine', 'spell-rings-of-raggadorr', 'spell-vapors-of-valtorr'];
    await page.setViewportSize({ width: 1920, height: 1080 });
    await game.openTestGame('dicethrone', { playerID: '0', disableLocalAiAutomation: true, seat0: 'human', seat1: 'human' });
    const media: Array<{ label: string; file: string; sha256: string }> = [];
    for (const [label, width, height, count] of [['桌面单张', 1920, 1080, 1], ['桌面多张', 1920, 1080, 3], ['横屏单张', 812, 375, 1], ['横屏多张', 812, 375, 3]] as const) {
        await page.setViewportSize({ width, height });
        const player = initHeroState('0', 'doctor_strange', random);
        const opponent = initHeroState('1', 'monk', random);
        player.preparedSpells = ids.slice(0, count).map(id => structuredClone(DOCTOR_STRANGE_CARDS.find(card => card.id === id)!));
        player.deck = DOCTOR_STRANGE_CARDS.filter(card => !ids.slice(0, count).includes(card.id)).map(card => structuredClone(card));
        player.hand = [];
        await game.setupScene({ gameId: 'dicethrone', currentPlayer: '0', phase: 'main1', extra: { players: { '0': player, '1': opponent }, selectedCharacters: { '0': 'doctor_strange', '1': 'monk' }, hostStarted: true, readyPlayers: { '0': true, '1': true } } });
        const zone = page.locator('[data-prepared-spell-zone="public"]');
        const cards = zone.locator('[data-prepared-spell-card]');
        const toggle = page.getByTestId('dt-prepared-spells-visibility');
        await expect(cards).toHaveCount(count);
        await zone.locator('[data-card-atlas-img]').first().waitFor({ state: 'attached', timeout: 30000 });
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
        };
        await expect(toggle).toHaveAttribute('aria-pressed', 'false');
        await capture('法术显示');
        await toggle.click({ timeout: 5000 });
        await expect(toggle).toHaveAttribute('aria-pressed', 'true');
        await expect(cards.first()).toBeHidden();
        expect((await game.getState()).core.players['0'].preparedSpells.map((card: { id: string }) => card.id)).toEqual(saved);
        await capture('露出被动');
        await toggle.click({ timeout: 5000 });
        await expect(toggle).toHaveAttribute('aria-pressed', 'false');
        await expect(cards.last()).toBeVisible();
        await expect.poll(() => zone.locator('.overflow-x-auto').evaluate(node => node.scrollLeft)).toBe(scrollPosition);
        expect((await game.getState()).core.players['0'].preparedSpells.map((card: { id: string }) => card.id)).toEqual(saved);
        await capture('恢复法术');
    }
    const identity = await captureEvidenceSourceIdentity(page, 'dicethrone');
    writeFileSync(resolve(output, 'capture.json'), JSON.stringify({ identity, media }, null, 2));
});


