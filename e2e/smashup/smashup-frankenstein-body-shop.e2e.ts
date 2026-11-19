import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Page, TestInfo } from '@playwright/test';
import { test, expect } from '../framework';
import { getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';

const SMASHUP_BODY_SHOP_QUERY = {
    p0: 'frankenstein,pirates',
    p1: 'zombies,robots',
    skipFactionSelect: true,
    skipInitialization: false,
    seed: 12345,
};

async function saveEvidenceScreenshot(page: Page, testInfo: TestInfo, subdir: string, filename: string): Promise<void> {
    const path = getEvidenceScreenshotPath(testInfo, filename, { subdir, filename });
    mkdirSync(dirname(path), { recursive: true });
    await page.screenshot({ path, fullPage: true });
}

async function openBodyShopScene(game: any): Promise<void> {
    await game.openTestGame('smashup', SMASHUP_BODY_SHOP_QUERY, 20000);
    await game.setupScene({
        gameId: 'smashup',
        player0: {
            hand: ['frankenstein_body_shop'],
            deck: [],
            discard: [],
            factions: ['frankenstein', 'pirates'],
            actionsPlayed: 0,
            actionLimit: 1,
            minionsPlayed: 0,
            minionLimit: 1,
        },
        player1: {
            hand: [],
            deck: [],
            discard: [],
            factions: ['zombies', 'robots'],
        },
        bases: [
            {
                defId: 'base_tortuga',
                minions: [
                    {
                        uid: 'target-buccaneer',
                        defId: 'pirate_buccaneer',
                        owner: '0',
                        controller: '0',
                        power: 4,
                        powerCounters: 0,
                    },
                ],
                ongoingActions: [],
            },
            {
                defId: 'base_the_mothership',
                minions: [
                    {
                        uid: 'recipient-monster',
                        defId: 'frankenstein_the_monster',
                        owner: '0',
                        controller: '0',
                        power: 5,
                        powerCounters: 0,
                    },
                    {
                        uid: 'recipient-assistant',
                        defId: 'frankenstein_lab_assistant',
                        owner: '0',
                        controller: '0',
                        power: 2,
                        powerCounters: 0,
                    },
                ],
                ongoingActions: [],
            },
        ],
        currentPlayer: '0',
        phase: 'playCards',
    });
}

async function waitForNoInteraction(game: any): Promise<void> {
    await expect.poll(async () => {
        const state = await game.getState();
        return state.sys.interaction?.current?.data?.sourceId ?? null;
    }).toBe(null);
}

async function getRequiredOption(game: any, predicate: (option: any) => boolean, description: string): Promise<any> {
    const options = await game.getInteractionOptions();
    const option = options.find(predicate);
    expect(option, `交互中未找到 ${description} 选项`).toBeTruthy();
    return option;
}

async function clickVisibleMinion(page: Page, uid: string): Promise<void> {
    const minion = page.locator(`[data-minion-uid="${uid}"]`).first();
    await expect(minion).toBeVisible();
    const point = await minion.evaluate(element => {
        const rect = element.getBoundingClientRect();
        for (const y of [0.5, 0.25, 0.75]) {
            for (const x of [0.5, 0.25, 0.75]) {
                const point = { x: rect.left + rect.width * x, y: rect.top + rect.height * y };
                const hit = document.elementFromPoint(point.x, point.y);
                if (hit && (hit === element || element.contains(hit))) return point;
            }
        }
        return null;
    });
    expect(point, `${uid} 必须有未遮挡的点击位置`).not.toBeNull();
    await page.mouse.click(point!.x, point!.y);
}

test.describe('SmashUp - 尸体商店', () => {
    for (const prevent of [true, false]) {
        test(`预置场景：雄蜂${prevent ? '防止' : '不防止'}消灭后尸体商店仍可分配指示物`, async ({ page, game }, testInfo) => {
            test.setTimeout(90000);
            const pageErrors: string[] = [];
            page.on('pageerror', error => pageErrors.push(error.message));
            await game.openTestGame('smashup', { skipInitialization: true, playerID: '0', disableLocalAiAutomation: true }, 45000);
            await game.setupScene({
                gameId: 'smashup', currentPlayer: '0', phase: 'playCards',
                player0: { factions: ['frankenstein_pod', 'giant_ants_pod'], hand: ['frankenstein_body_shop_pod'], deck: [], discard: [], actionsPlayed: 0, actionLimit: 1, minionsPlayed: 0, minionLimit: 1 },
                player1: { factions: ['pirates', 'robots'], hand: [], deck: [], discard: [] },
                bases: [
                    { defId: 'base_tortuga', minions: [{ uid: 'body-shop-target', defId: 'frankenstein_herr_doktor_pod', owner: '0', controller: '0', basePower: 2, powerCounters: 0 }], ongoingActions: [] },
                    { defId: 'base_the_mothership', minions: [
                        { uid: 'body-shop-monster', defId: 'frankenstein_the_monster_pod', owner: '0', controller: '0', basePower: 4, powerCounters: 0 },
                        { uid: 'body-shop-drone', defId: 'giant_ant_drone_pod', owner: '0', controller: '0', basePower: 3, powerCounters: 1 },
                    ], ongoingActions: [] },
                ],
            });
            await game.playCard('frankenstein_body_shop_pod');
            await game.waitForInteraction('frankenstein_body_shop', 10000);
            await clickVisibleMinion(page, 'body-shop-target');
            await game.waitForInteraction('giant_ant_drone_prevent_destroy', 10000);
            await saveEvidenceScreenshot(page, testInfo, '雄蜂与尸体商店', `预置场景-${prevent ? '防止' : '跳过'}-雄蜂选择.png`);
            if (prevent) {
                await clickVisibleMinion(page, 'body-shop-drone');
            } else {
                await page.getByRole('button', { name: /不防止消灭|Do not prevent/i }).click();
            }
            await game.waitForInteraction('frankenstein_body_shop_distribute', 10000);
            const monster = page.locator('[data-minion-uid="body-shop-monster"]').first();
            await expect(monster).toBeVisible();
            await saveEvidenceScreenshot(page, testInfo, '雄蜂与尸体商店', `预置场景-${prevent ? '防止' : '跳过'}-分配指示物.png`);
            await clickVisibleMinion(page, 'body-shop-monster');
            await game.waitForInteraction('frankenstein_body_shop_distribute', 10000);
            await clickVisibleMinion(page, 'body-shop-monster');
            await waitForNoInteraction(game);
            const finalState = await game.getState();
            expect(finalState.core.bases[0].minions.some((minion: any) => minion.uid === 'body-shop-target')).toBe(prevent);
            expect(finalState.core.bases[1].minions.find((minion: any) => minion.uid === 'body-shop-monster')?.powerCounters).toBe(2);
            expect(pageErrors).toEqual([]);
        });
    }

    test('尸体商店以海盗派系 4 力量随从为目标时，应先触发移动并继续完成 4 次指示物分配', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);

        await openBodyShopScene(game);

        await page.waitForFunction(
            () => {
                const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
                return state?.sys?.phase === 'playCards'
                    && state?.core?.players?.['0']?.hand?.some((card: any) => card.defId === 'frankenstein_body_shop')
                    && state?.core?.bases?.[0]?.minions?.some((minion: any) => minion.uid === 'target-buccaneer')
                    && state?.core?.bases?.[1]?.minions?.some((minion: any) => minion.uid === 'recipient-monster');
            },
            { timeout: 5000, polling: 200 },
        );

        await game.playCard('frankenstein_body_shop');
        await game.waitForInteraction('frankenstein_body_shop', 10000);

        await expect(page.getByText(/选择你要消灭的随从/)).toBeVisible({ timeout: 5000 });
        const destroyTargetOption = await getRequiredOption(
            game,
            (option: any) => option?.value?.minionUid === 'target-buccaneer',
            '海盗派系 4 力量随从',
        );
        expect(String(destroyTargetOption.label ?? '')).toContain('力量 4');
        await expect(page.locator('[data-minion-uid="target-buccaneer"]').first()).toBeVisible({ timeout: 5000 });
        await game.screenshot('01-body-shop-target-prompt', testInfo);
        await saveEvidenceScreenshot(page, testInfo, 'smashup-body-shop', '01-body-shop-target-prompt.png');

        await page.locator('[data-minion-uid="target-buccaneer"]').first().click({ force: true });

        await game.waitForInteraction('pirate_buccaneer_move', 10000);
        await expect(page.getByText(/海盗：选择移动到哪个基地/)).toBeVisible({ timeout: 5000 });
        const moveTargetOption = await getRequiredOption(
            game,
            (option: any) => option?.value?.toBaseIndex === 2,
            'Buccaneer 移动到基地 2',
        );
        await game.screenshot('02-buccaneer-move-prompt', testInfo);
        await saveEvidenceScreenshot(page, testInfo, 'smashup-body-shop', '02-buccaneer-move-prompt.png');
        await game.selectOption(moveTargetOption.id);

        await game.waitForInteraction('frankenstein_body_shop_distribute', 10000);
        await expect(page.getByText(/剩余 4 个/)).toBeVisible({ timeout: 5000 });
        await getRequiredOption(
            game,
            (option: any) => option?.value?.minionUid === 'recipient-monster',
            '第一段分配目标 recipient-monster',
        );
        await expect(page.locator('[data-minion-uid="recipient-monster"]').first()).toBeVisible({ timeout: 5000 });
        await game.screenshot('03-body-shop-distribute-remaining-4', testInfo);
        await saveEvidenceScreenshot(page, testInfo, 'smashup-body-shop', '03-body-shop-distribute-remaining-4.png');

        await page.locator('[data-minion-uid="recipient-monster"]').first().click({ force: true });

        await game.waitForInteraction('frankenstein_body_shop_distribute', 10000);
        await expect(page.getByText(/剩余 3 个/)).toBeVisible({ timeout: 5000 });
        await game.screenshot('04-body-shop-distribute-remaining-3', testInfo);
        await saveEvidenceScreenshot(page, testInfo, 'smashup-body-shop', '04-body-shop-distribute-remaining-3.png');

        for (let remaining = 3; remaining >= 1; remaining -= 1) {
            await getRequiredOption(
                game,
                (option: any) => option?.value?.minionUid === 'recipient-monster',
                `剩余 ${remaining} 个时的 recipient-monster`,
            );
            await page.locator('[data-minion-uid="recipient-monster"]').first().click({ force: true });
            if (remaining > 1) {
                await game.waitForInteraction('frankenstein_body_shop_distribute', 10000);
            }
        }

        await waitForNoInteraction(game);

        const finalState = await game.getState();
        expect(finalState.core.bases[0].minions.some((minion: any) => minion.uid === 'target-buccaneer')).toBe(false);
        expect(finalState.core.bases[2].minions.some((minion: any) => minion.uid === 'target-buccaneer')).toBe(true);
        expect(finalState.core.bases[1].minions.find((minion: any) => minion.uid === 'recipient-monster')?.powerCounters).toBe(4);
        expect(finalState.core.bases[1].minions.find((minion: any) => minion.uid === 'recipient-assistant')?.powerCounters ?? 0).toBe(0);
        expect(finalState.core.players['0'].discard.map((card: any) => card.defId)).toEqual(expect.arrayContaining(['frankenstein_body_shop']));
        expect(finalState.core.players['0'].discard.map((card: any) => card.defId)).not.toContain('pirate_buccaneer');

        await game.screenshot('05-body-shop-final-state', testInfo);
        await saveEvidenceScreenshot(page, testInfo, 'smashup-body-shop', '05-body-shop-final-state.png');
    });
});
