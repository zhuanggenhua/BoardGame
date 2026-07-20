import type { Page } from '@playwright/test';
import { test, expect } from '../framework';
import { setChineseLocale } from '../helpers/common';
import { clickHandCard } from './smashup-helpers';

const ITTY_POD_ATLAS_ID = 'smashup:itty-critters-pod-cards';
const TIME_POD_ATLAS_ID = 'smashup:time-travelers-pod-cards';

async function waitForFactionSelection(page: Page): Promise<void> {
    await expect(page.locator('[data-tutorial-id="su-faction-select"]')).toBeVisible({ timeout: 20000 });
}

async function waitForDraftTurn(page: Page, playerId: string, selectedCount: number): Promise<void> {
    await page.waitForFunction(
        ({ playerId, selectedCount }) => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            const selection = state?.core?.factionSelection;
            if (!selection) return false;
            const currentPlayerId = state.core.turnOrder?.[state.core.currentPlayerIndex];
            const picks = selection.playerSelections?.[playerId] ?? [];
            return currentPlayerId === playerId && picks.length === selectedCount;
        },
        { playerId, selectedCount },
        { timeout: 20000, polling: 200 },
    );
}

async function assertAtlasLoaded(page: Page, atlasId: string, expectedCardCount: number): Promise<void> {
    await expect.poll(async () => page.evaluate((expectedAtlasId) => {
        const nodes = Array.from(document.querySelectorAll<HTMLElement>(
            `[data-card-atlas-id="${expectedAtlasId}"]`,
        ));
        return {
            count: nodes.length,
            shimmerCount: nodes.filter(node => node.classList.contains('atlas-shimmer')).length,
            loadedCount: nodes.filter(node => Boolean(node.style.backgroundImage)).length,
        };
    }, atlasId), { timeout: 20000 }).toEqual({
        count: expectedCardCount,
        shimmerCount: 0,
        loadedCount: expectedCardCount,
    });
}

async function assertNoAtlasShimmer(page: Page, timeout = 90000): Promise<void> {
    await expect.poll(async () => page.evaluate(() => (
        Array.from(document.querySelectorAll<HTMLElement>('.atlas-shimmer')).map(node => ({
            atlasId: node.dataset.cardAtlasId ?? null,
            atlasIndex: node.dataset.cardAtlasIndex ?? null,
            title: node.title || null,
        }))
    )), { timeout }).toEqual([]);
}

async function pickFaction(
    page: Page,
    options: {
        playerId: string;
        selectedCountBeforePick: number;
        groupId: string;
        expectedFactionId: string;
        pod?: boolean;
        atlasId?: string;
        atlasCardCount?: number;
        beforeConfirm?: () => Promise<void>;
    },
): Promise<void> {
    await waitForDraftTurn(page, options.playerId, options.selectedCountBeforePick);
    await page.getByTestId(`faction-option-${options.groupId}`).click();
    await expect(page.getByTestId('faction-detail-panel')).toBeVisible({ timeout: 10000 });

    if (options.pod) {
        const podButton = page.getByTestId('faction-variant-pod');
        await expect(podButton).toBeVisible({ timeout: 10000 });
        await podButton.click();
    }

    if (options.atlasId && options.atlasCardCount !== undefined) {
        await assertAtlasLoaded(page, options.atlasId, options.atlasCardCount);
    }

    await options.beforeConfirm?.();

    const confirmButton = page.getByTestId('faction-confirm-button');
    await expect(confirmButton).toBeVisible({ timeout: 10000 });
    await expect(confirmButton).toBeEnabled({ timeout: 10000 });
    await confirmButton.click();

    await page.waitForFunction(
        ({ playerId, expectedFactionId }) => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            const selected = state?.core?.factionSelection?.playerSelections?.[playerId] ?? [];
            const finalFactions = state?.core?.players?.[playerId]?.factions ?? [];
            return selected.includes(expectedFactionId) || finalFactions.includes(expectedFactionId);
        },
        { playerId: options.playerId, expectedFactionId: options.expectedFactionId },
        { timeout: 20000, polling: 200 },
    );
}

async function playOnlyHandCard(page: Page): Promise<void> {
    await clickHandCard(page, 0);
    await clickHandCard(page, 0);
    await page.waitForTimeout(500);

    const spotlightQueue = page.getByTestId('card-spotlight-queue');
    if (await spotlightQueue.isVisible({ timeout: 300 }).catch(() => false)) {
        await spotlightQueue.getByRole('button', { name: /^(关闭特写|Close spotlight)$/i }).click({ force: true });
        await expect(spotlightQueue).toBeHidden({ timeout: 5000 });
    }
}

async function clickPromptCard(page: Page, defId: string): Promise<void> {
    const option = page.locator(`[data-testid^="prompt-card-"][data-card-def-id="${defId}"]`).first();
    await expect(option).toBeVisible({ timeout: 10000 });
    await option.click();
}

async function clickBaseByDefId(page: Page, defId: string): Promise<void> {
    const baseIndex = await page.evaluate((expectedDefId) => {
        const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
        return state?.core?.bases?.findIndex((base: { defId?: string }) => base?.defId === expectedDefId) ?? -1;
    }, defId);
    expect(baseIndex, `未在棋盘上找到基地 ${defId}`).toBeGreaterThanOrEqual(0);

    const base = page.locator(`[data-base-index="${baseIndex}"]`).first();
    await expect(base).toBeVisible({ timeout: 10000 });
    await base.click();
}

async function clickSkip(page: Page): Promise<void> {
    const skipButton = page.getByRole('button', {
        name: /跳过|让过|放弃这次额外随从|Skip|Pass/i,
    }).last();
    await expect(skipButton).toBeVisible({ timeout: 10000 });
    await skipButton.click();
}

test.describe('大杀四方迷你萌宠与时间旅行者 POD 真实入口', () => {
    test('真实选秀后渲染两张 POD 图集并完成代表玩法链', async ({ page, game }, testInfo) => {
        test.setTimeout(240000);
        await setChineseLocale(page.context());
        await game.openTestGame('smashup', {
            seed: 20260710,
            seat1ManualSetup: true,
        }, 30000);
        await waitForFactionSelection(page);

        await pickFaction(page, {
            playerId: '0',
            selectedCountBeforePick: 0,
            groupId: 'itty_critters',
            expectedFactionId: 'itty_critters_pod',
            pod: true,
            atlasId: ITTY_POD_ATLAS_ID,
            atlasCardCount: 16,
            beforeConfirm: () => game.screenshot('01-迷你萌宠POD-派系预览', testInfo),
        });

        await pickFaction(page, {
            playerId: '1',
            selectedCountBeforePick: 0,
            groupId: 'aliens',
            expectedFactionId: 'aliens',
        });
        await pickFaction(page, {
            playerId: '1',
            selectedCountBeforePick: 1,
            groupId: 'pirates',
            expectedFactionId: 'pirates',
        });
        await pickFaction(page, {
            playerId: '0',
            selectedCountBeforePick: 1,
            groupId: 'time_travelers',
            expectedFactionId: 'time_travelers_pod',
            pod: true,
            atlasId: TIME_POD_ATLAS_ID,
            atlasCardCount: 12,
            beforeConfirm: () => game.screenshot('02-时间旅行者POD-派系预览', testInfo),
        });

        await expect(page.getByTestId('su-hand-area')).toBeVisible({ timeout: 30000 });
        await expect.poll(async () => {
            const state = await game.getState();
            return [...(state?.core?.players?.['0']?.factions ?? [])].sort();
        }, { timeout: 20000 }).toEqual(['itty_critters_pod', 'time_travelers_pod']);
        await assertNoAtlasShimmer(page);
        await game.screenshot('03-双POD派系-开局完成', testInfo);

        await game.setupScene({
            gameId: 'smashup',
            currentPlayer: '0',
            phase: 'playCards',
            player0: {
                hand: [
                    { uid: 'itty-select-pod', defId: 'itty_critters_i_select_you_pod', type: 'action', owner: '0' },
                ],
                deck: [
                    { uid: 'itty-small-pod', defId: 'itty_critters_flooffairy_pod', type: 'minion', owner: '0' },
                    { uid: 'itty-big-pod', defId: 'itty_critters_critter_coach_pod', type: 'minion', owner: '0' },
                ],
                discard: [],
                factions: ['itty_critters_pod', 'time_travelers_pod'],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            player1: {
                hand: [],
                deck: [],
                discard: [],
                factions: ['aliens', 'pirates'],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            bases: [
                { defId: 'base_itty_city_pod', minions: [] },
                { defId: 'base_critter_combat_club_pod', minions: [] },
            ],
        });

        await assertNoAtlasShimmer(page);
        await game.screenshot('04-我选择你-触发前', testInfo);
        await playOnlyHandCard(page);
        await game.waitForInteraction('itty_critters_i_select_you', 10000);
        await game.screenshot('05-我选择你-随从选择中', testInfo);
        await clickPromptCard(page, 'itty_critters_flooffairy_pod');

        await game.waitForInteraction('itty_critters_i_select_you_base', 10000);
        await clickBaseByDefId(page, 'base_critter_combat_club_pod');
        await game.waitForInteraction('itty_critters_flooffairy', 10000);
        await clickSkip(page);
        await game.waitForNoInteraction(10000);

        let state = await game.getState();
        expect(state.core.bases[1].minions.map((minion: any) => minion.uid)).toContain('itty-small-pod');
        expect(state.core.players['0'].deck.map((card: any) => card.uid)).not.toContain('itty-small-pod');
        await game.screenshot('06-我选择你-结算后', testInfo);

        await game.setupScene({
            gameId: 'smashup',
            currentPlayer: '0',
            phase: 'playCards',
            player0: {
                hand: [
                    { uid: 'do-over-pod', defId: 'time_travelers_do_over_pod', type: 'action', owner: '0' },
                ],
                deck: [],
                discard: [],
                factions: ['itty_critters_pod', 'time_travelers_pod'],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            player1: {
                hand: [],
                deck: [],
                discard: [],
                factions: ['aliens', 'pirates'],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            bases: [
                {
                    defId: 'base_portal_room_pod',
                    minions: [
                        {
                            uid: 'jumper-pod',
                            defId: 'time_travelers_jumper_pod',
                            owner: '0',
                            controller: '0',
                            powerCounters: 0,
                            tempPowerModifier: 0,
                        },
                    ],
                },
            ],
        });

        await assertNoAtlasShimmer(page);
        await game.screenshot('07-从头来过-触发前', testInfo);
        await game.playCard('time_travelers_do_over_pod', {
            targetBaseIndex: 0,
            targetMinionUid: 'jumper-pod',
        });
        await game.waitForInteraction('smashup_immediate_extra_minion', 10000);
        await game.screenshot('08-从头来过-额外随从选择', testInfo);
        await clickSkip(page);
        await game.waitForInteraction('smashup_reaction_choose', 10000);
        await game.screenshot('09-时间盒子-反应让过', testInfo);
        await clickSkip(page);
        await game.waitForNoInteraction(10000);

        state = await game.getState();
        expect(state.core.bases[0].minions.map((minion: any) => minion.uid)).not.toContain('jumper-pod');
        expect(state.core.players['0'].hand.map((card: any) => card.uid)).toContain('jumper-pod');
        expect(state.sys.interaction?.current).toBeUndefined();
        await assertNoAtlasShimmer(page);
        await game.screenshot('10-从头来过-让过后收口', testInfo);
    });
});
