import { test, expect } from '../framework';
import { captureEvidenceSourceIdentity } from '../framework/sourceIdentity';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { initHeroState } from '../../src/games/dicethrone/domain/characters';
import { DOCTOR_STRANGE_CARDS } from '../../src/games/dicethrone/heroes/doctor_strange/cards';
const output = resolve('temp/doctor-prepared-capture-20261103');
const random = { shuffle: <T>(a: T[]) => a, random: () => 0.5, d: (_n: number) => 1, range: (n: number, _m: number) => n };
const ids = ['spell-flames-of-faltine', 'spell-rings-of-raggadorr', 'spell-vapors-of-valtorr'];
test('奇异博士准备区覆盖与多牌浏览截图取证', async ({ page, game }) => {
    test.setTimeout(120000);
    mkdirSync(output, { recursive: true });
    await page.setViewportSize({ width: 1920, height: 1080 });
        await game.openTestGame('dicethrone', { playerID: '0', disableLocalAiAutomation: true, seat0: 'human', seat1: 'human' });
        const media = [];
        for (const [label, width, height, count] of [['桌面单张', 1920, 1080, 1], ['桌面两张', 1920, 1080, 2], ['桌面三张', 1920, 1080, 3], ['横屏三张', 812, 375, 3], ['横屏换牌两张', 812, 375, 2], ['横屏恢复三张', 812, 375, 3]] as const) {
            await page.setViewportSize({ width, height });
            const player = initHeroState('0', 'doctor_strange', random);
            const opponent = initHeroState('1', 'monk', random);
            player.preparedSpells = ids.slice(0, count).map(id => structuredClone(DOCTOR_STRANGE_CARDS.find(card => card.id === id)!));
            player.deck = DOCTOR_STRANGE_CARDS.filter(card => !ids.slice(0, count).includes(card.id)).map(card => structuredClone(card));
            player.hand = [];
            await game.setupScene({ gameId: 'dicethrone', currentPlayer: '0', phase: 'main1', extra: { players: { '0': player, '1': opponent }, selectedCharacters: { '0': 'doctor_strange', '1': 'monk' }, hostStarted: true, readyPlayers: { '0': true, '1': true } } });
            const zone = page.locator('[data-prepared-spell-zone="public"]');
            await expect(zone.locator('[data-prepared-spell-card]')).toHaveCount(count);
            if (count > 1) {
                const list = zone.locator('.overflow-x-auto');
                if (label === '横屏三张') await list.evaluate(node => { node.scrollLeft = 0; });
                await expect.poll(() => list.evaluate(node => node.scrollLeft)).toBe(0);
                await expect(zone.locator('[data-prepared-spell-direction="previous"]')).toBeDisabled();
                await expect(zone.locator('[data-prepared-spell-direction="next"]')).toBeEnabled();
            }
            await page.locator('[data-prepared-spell-card] [data-card-atlas-img]').first().waitFor({ state: 'attached', timeout: 30000 });
            await page.evaluate(async () => { await document.fonts.ready; await Promise.all(document.getAnimations().filter(a => Number.isFinite(a.effect?.getComputedTiming().endTime)).map(a => a.finished.catch(() => {}))); });
            const file = resolve(output, label + '.png');
            const bytes = await page.screenshot({ path: file });
            const geometry = await zone.evaluate(node => { const zoneRect = node.getBoundingClientRect(); const list = node.querySelector('.overflow-x-auto') as HTMLElement; return { zone: zoneRect.toJSON(), scrollWidth: list.scrollWidth, clientWidth: list.clientWidth, cards: Array.from(node.querySelectorAll('[data-prepared-spell-card]')).map(card => card.getBoundingClientRect().toJSON()) }; });
            media.push({ label, file, sha256: createHash('sha256').update(bytes).digest('hex'), geometry });
            if (count > 1) {
                const scroll = zone.locator('.overflow-x-auto');
                await zone.locator('[data-prepared-spell-direction="next"]').click();
                await expect.poll(() => scroll.evaluate(node => node.scrollLeft)).toBeGreaterThan(0);
                await zone.locator('[data-prepared-spell-direction="previous"]').click();
                await expect.poll(() => scroll.evaluate(node => node.scrollLeft)).toBe(0);
                await scroll.hover(); await page.mouse.wheel(600, 0);
                await expect.poll(() => scroll.evaluate(node => node.scrollLeft)).toBeGreaterThan(0);
                await page.waitForTimeout(500);
                const lastFile = resolve(output, label + '-浏览末张.png');
                const lastBytes = await page.screenshot({ path: lastFile });
                media.push({ label: label + '浏览末张', file: lastFile, sha256: createHash('sha256').update(lastBytes).digest('hex'), geometry });
                await zone.locator(`[data-prepared-spell-card="${ids[count - 1]}"]`).click();
                await expect(page.getByTestId('board-magnify-overlay')).toBeVisible();
                await page.getByTestId('board-magnify-overlay-close').click();
            }
        }
        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.getByTestId('debug-toggle').click();
        await page.getByRole('button', { name: /开启布局编辑/ }).click();
        await expect(page.locator('[data-prepared-spell-zone="public"]')).toHaveCount(0);
        await page.getByRole('button', { name: /退出布局编辑/ }).click();
        const restoredZone = page.locator('[data-prepared-spell-zone="public"]');
        await expect(restoredZone.locator('[data-prepared-spell-direction="previous"]')).toBeDisabled();
        await expect.poll(() => restoredZone.locator('.overflow-x-auto').evaluate(node => node.scrollLeft)).toBe(0);
        const identity = await captureEvidenceSourceIdentity(page, 'dicethrone');
        writeFileSync(resolve(output, 'capture.json'), JSON.stringify({ productAcceptance: 'not-claimed', baseURL: page.url(), identity, media }, null, 2));
        console.log(JSON.stringify({ status: 'PASS', media: media.length, sourceRevision: identity.sourceRevision }));
});
