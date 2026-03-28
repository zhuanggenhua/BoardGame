import { test, expect } from './framework';
import { mkdir } from 'fs/promises';
import path from 'path';
import { setupOnlineMatch, readCoreState, applyCoreStateDirect } from './helpers/cardia';
import type { CardInstance } from '../src/games/cardia/domain/core-types';

function createCard(overrides: Partial<CardInstance> = {}): CardInstance {
    return {
        uid: overrides.uid ?? `card_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        defId: overrides.defId ?? 'deck_i_card_01',
        ownerId: overrides.ownerId ?? '0',
        baseInfluence: overrides.baseInfluence ?? 1,
        faction: overrides.faction ?? 'guild',
        abilityIds: overrides.abilityIds ?? [],
        difficulty: overrides.difficulty ?? 1,
        modifiers: overrides.modifiers ?? { entries: [], nextOrder: 0 },
        tags: overrides.tags ?? { entries: [], nextOrder: 0 },
        signets: overrides.signets ?? 0,
        ongoingMarkers: overrides.ongoingMarkers ?? [],
        imageIndex: overrides.imageIndex ?? 0,
        imagePath: overrides.imagePath ?? '',
    };
}

async function saveEvidence(page: Parameters<typeof test>[1] extends never ? never : any, testInfo: any, name: string) {
    const evidenceDir = path.join(process.cwd(), 'test-results', 'evidence-screenshots');
    await mkdir(evidenceDir, { recursive: true });
    const filePath = path.join(evidenceDir, `${name}.png`);
    await page.screenshot({ path: filePath, fullPage: true });
    await testInfo.attach(name, { path: filePath, contentType: 'image/png' });
}

test.describe('Cardia - 弃牌堆可见性', () => {
    test('PC 端和移动端都应显示弃牌堆卡牌', async ({ browser }, testInfo) => {
        const tempPage = await browser.newPage();
        const setup = await setupOnlineMatch(tempPage);

        try {
            const core = await readCoreState(setup.player1Page);
            const players = core.players as Record<string, any>;

            players['0'].discard = [
                createCard({ uid: 'p1d1', ownerId: '0', defId: 'deck_i_card_02', baseInfluence: 2, faction: 'academy' }),
                createCard({ uid: 'p1d2', ownerId: '0', defId: 'deck_i_card_07', baseInfluence: 7, faction: 'guild' }),
            ];
            players['1'].discard = [
                createCard({ uid: 'p2d1', ownerId: '1', defId: 'deck_i_card_03', baseInfluence: 3, faction: 'academy' }),
                createCard({ uid: 'p2d2', ownerId: '1', defId: 'deck_i_card_09', baseInfluence: 9, faction: 'academy' }),
            ];

            await applyCoreStateDirect(setup.player1Page, core);
            await setup.player1Page.waitForTimeout(1000);

            await expect(setup.player1Page.locator('img[alt="Card 7"]').first()).toBeVisible({ timeout: 10000 });
            await expect(setup.player1Page.locator('img[alt="Card 9"]').first()).toBeVisible({ timeout: 10000 });
            await saveEvidence(setup.player1Page, testInfo, 'cardia-discard-pile-pc');

            await setup.player1Page.setViewportSize({ width: 390, height: 844 });
            await setup.player1Page.waitForTimeout(600);

            await expect(setup.player1Page.locator('img[alt="Card 7"]').first()).toBeVisible({ timeout: 10000 });
            await expect(setup.player1Page.locator('img[alt="Card 9"]').first()).toBeVisible({ timeout: 10000 });
            await saveEvidence(setup.player1Page, testInfo, 'cardia-discard-pile-mobile');
        } finally {
            await tempPage.close().catch(() => {});
            await setup.player1Context.close().catch(() => {});
            await setup.player2Context.close().catch(() => {});
        }
    });
});
