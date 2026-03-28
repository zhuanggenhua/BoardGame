/**
 * 大杀四方 - 阶段切换与行动卡特写回归
 */

import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Page, TestInfo } from '@playwright/test';
import { test, expect } from './framework';
import { getEvidenceScreenshotPath } from './framework/evidenceScreenshots';
import { waitForSmashUpUI } from './helpers/smashup';
import { setupSmashUpMatchSkipSetup } from './helpers/smashup-skip-setup';
import { getMatchState, injectMatchState } from './helpers/state-injection';

async function saveEvidenceScreenshot(page: Page, testInfo: TestInfo, name: string): Promise<void> {
    const path = getEvidenceScreenshotPath(testInfo, name);
    await mkdir(dirname(path), { recursive: true });
    await page.screenshot({ path, fullPage: true });
}

async function applyOnlineMatchState(
    matchId: string,
    page: Page,
    updater: (state: any) => any,
): Promise<void> {
    const currentState = await getMatchState(matchId, page);
    const nextState = updater(currentState);
    await injectMatchState(matchId, nextState, page);
    await page.waitForTimeout(800);
}

async function waitForTurnTracker(page: Page, side: 'YOU' | 'OPP'): Promise<void> {
    await expect(
        page.locator('[data-tutorial-id="su-turn-tracker"]').filter({ hasText: new RegExp(side, 'i') }),
    ).toBeVisible({ timeout: 8000 });
}

async function getPlayerActionUid(page: Page, playerId: '0' | '1', defId: string): Promise<string | null> {
    return page.evaluate(({ currentPlayerId, targetDefId }) => {
        const harness = (window as any).__BG_TEST_HARNESS__;
        const state = harness?.state?.get?.();
        const hand = state?.core?.players?.[currentPlayerId]?.hand ?? [];
        return hand.find((card: any) => card.defId === targetDefId)?.uid ?? null;
    }, { currentPlayerId: playerId, targetDefId: defId });
}

async function getCurrentInteraction(page: Page): Promise<any> {
    return page.evaluate(() => {
        const harness = (window as any).__BG_TEST_HARNESS__;
        return harness?.state?.get?.()?.sys?.interaction?.current ?? null;
    });
}

async function getCurrentInteractionOptions(page: Page): Promise<any[]> {
    return page.evaluate(() => {
        const harness = (window as any).__BG_TEST_HARNESS__;
        return harness?.state?.get?.()?.sys?.interaction?.current?.data?.options ?? [];
    });
}

async function findCurrentInteractionOption(
    page: Page,
    predicate: (option: any) => boolean,
): Promise<any | undefined> {
    const options = await getCurrentInteractionOptions(page);
    return options.find(predicate);
}

async function respondCurrentInteraction(
    page: Page,
    payload: { optionId?: string; optionIds?: string[]; mergedValue?: unknown },
): Promise<void> {
    await page.evaluate((responsePayload) => {
        const harness = (window as any).__BG_TEST_HARNESS__;
        const interaction = harness?.state?.get?.()?.sys?.interaction?.current;
        if (!interaction) {
            throw new Error('当前没有可响应的交互');
        }
        harness.command.dispatch({
            type: 'SYS_INTERACTION_RESPOND',
            playerId: interaction.playerId,
            payload: responsePayload,
        });
    }, payload);
    await page.waitForTimeout(300);
}

async function dispatchHarnessCommand(
    page: Page,
    playerId: '0' | '1',
    type: string,
    payload: Record<string, unknown>,
): Promise<void> {
    await page.evaluate(({ commandType, commandPayload, commandPlayerId }) => {
        const harness = (window as any).__BG_TEST_HARNESS__;
        harness.command.dispatch({
            type: commandType,
            playerId: commandPlayerId,
            payload: commandPayload,
        });
    }, {
        commandType: type,
        commandPayload: payload,
        commandPlayerId: playerId,
    });
    await page.waitForTimeout(300);
}

async function waitForSelectableMinion(page: Page, minionUid: string): Promise<void> {
    await expect.poll(async () => {
        return page.evaluate((uid) => {
            const node = document.querySelector(`[data-minion-uid="${uid}"]`);
            if (!(node instanceof HTMLElement)) return { exists: false, selectable: false, className: '' };
            return {
                exists: true,
                selectable: node.className.includes('ring-purple-400') || node.className.includes('ring-green-400'),
                className: node.className,
            };
        }, minionUid);
    }, {
        timeout: 8000,
        message: `随从 ${minionUid} 未进入可选态`,
    }).toMatchObject({
        exists: true,
        selectable: true,
    });
}

async function clickSelectableMinion(page: Page, minionUid: string): Promise<void> {
    await waitForSelectableMinion(page, minionUid);
    await page.locator(`[data-minion-uid="${minionUid}"]`).click({ force: true });
    await page.waitForTimeout(300);
}

const makeSmashUpCard = (uid: string, defId: string, type: 'action' | 'minion', owner: '0' | '1') => ({
    uid,
    defId,
    type,
    owner,
});

function buildActionSpotlightState(baseState: any, currentPlayerIndex: 0 | 1) {
    const nextState = JSON.parse(JSON.stringify(baseState));

    nextState.core.currentPlayerIndex = currentPlayerIndex;
    nextState.core.phase = 'playCards';
    nextState.core.factionSelection = undefined;
    nextState.core.players['0'] = {
        ...nextState.core.players['0'],
        hand: [makeSmashUpCard('p0-action-1', 'wizard_mystic_studies', 'action', '0')],
        deck: [
            makeSmashUpCard('p0-deck-1', 'wizard_neophyte', 'minion', '0'),
            makeSmashUpCard('p0-deck-2', 'wizard_apprentice', 'minion', '0'),
        ],
        discard: [],
        actionsPlayed: 0,
        actionLimit: 1,
        minionsPlayed: 0,
        minionLimit: 1,
        minionsPlayedPerBase: {},
        sameNameMinionDefId: null,
        factions: ['wizards', 'steampunks'],
    };
    nextState.core.players['1'] = {
        ...nextState.core.players['1'],
        hand: [makeSmashUpCard('p1-action-1', 'wizard_mystic_studies', 'action', '1')],
        deck: [
            makeSmashUpCard('p1-deck-1', 'wizard_chronomage', 'minion', '1'),
            makeSmashUpCard('p1-deck-2', 'wizard_archmage', 'minion', '1'),
        ],
        discard: [],
        actionsPlayed: 0,
        actionLimit: 1,
        minionsPlayed: 0,
        minionLimit: 1,
        minionsPlayedPerBase: {},
        sameNameMinionDefId: null,
        factions: ['wizards', 'steampunks'],
    };

    nextState.sys = {
        ...nextState.sys,
        turnOrder: Array.isArray(nextState.core.turnOrder) ? [...nextState.core.turnOrder] : nextState.sys.turnOrder,
        currentPlayerIndex,
        phase: 'playCards',
        interaction: nextState.sys.interaction
            ? { ...nextState.sys.interaction, current: undefined, queue: [], isBlocked: false }
            : nextState.sys.interaction,
        responseWindow: nextState.sys.responseWindow
            ? { ...nextState.sys.responseWindow, current: undefined }
            : nextState.sys.responseWindow,
        eventStream: nextState.sys.eventStream
            ? { ...nextState.sys.eventStream, entries: [], nextId: 1 }
            : nextState.sys.eventStream,
    };

    return nextState;
}

function buildFactionSelectStuckState(baseState: any) {
    const nextState = JSON.parse(JSON.stringify(baseState));

    nextState.core.currentPlayerIndex = 0;
    nextState.core.turnNumber = 1;
    nextState.core.factionSelection = undefined;
    nextState.core.players['0'] = {
        ...nextState.core.players['0'],
        factions: ['tricksters_pod', 'steampunks_pod'],
    };
    nextState.core.players['1'] = {
        ...nextState.core.players['1'],
        factions: ['vampires_pod', 'bear_cavalry_pod'],
    };

    nextState.sys = {
        ...nextState.sys,
        phase: 'factionSelect',
        interaction: {
            current: {
                id: 'starting_hand_mulligan_0_test',
                kind: 'simple-choice',
                playerId: '0',
                data: {
                    title: '起手无随从：是否重抽一次？（只能重抽一次）',
                    options: [
                        { id: 'keep', label: '保留手牌', value: { choice: 'keep' }, displayMode: 'button' },
                        { id: 'mulligan', label: '重抽一次', value: { choice: 'mulligan' }, displayMode: 'button' },
                    ],
                    sourceId: 'starting_hand_mulligan',
                    targetType: 'generic',
                },
            },
            queue: [],
            isBlocked: false,
        },
    };

    return nextState;
}

test('简单阶段转换 - 点击结束回合', async ({ page, game }, testInfo) => {
    test.setTimeout(60000);

    await page.goto('/play/smashup');
    await page.waitForFunction(
        () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered(),
        { timeout: 15000 },
    );

    await game.setupScene({
        gameId: 'smashup',
        player0: {
            hand: [{ uid: 'card-1', defId: 'wizard_portal', type: 'action' }],
        },
        player1: {},
        bases: [{ breakpoint: 25, power: 0 }],
        currentPlayer: '0',
        phase: 'playCards',
    });

    await page.waitForTimeout(2000);
    await game.screenshot('01-initial-state', testInfo);

    const initialPhase = await page.evaluate(() => {
        const harness = (window as any).__BG_TEST_HARNESS__;
        return harness.state.get().sys.phase;
    });
    console.log('[TEST] 初始阶段:', initialPhase);

    await game.advancePhase();

    await game.screenshot('02-after-finish-turn', testInfo);

    await expect.poll(async () => {
        const state = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            return harness.state.get();
        });
        return {
            phase: state.sys.phase,
            currentPlayerIndex: state.core.currentPlayerIndex,
        };
    }, { timeout: 10000 }).toEqual({
        phase: 'playCards',
        currentPlayerIndex: 1,
    });
});

test('Oops 四派系在派系选择与注入场景中都能显示资源', async ({ page, game }, testInfo) => {
    test.setTimeout(90000);

    await game.openTestGame('smashup');

    const factionHeading = page.locator('h1').filter({ hasText: /Draft Your Factions|选择你的派系/i });
    await expect(factionHeading).toBeVisible({ timeout: 15000 });

    const factionNames = [
        /Ancient Egyptians|古埃及人/i,
        /Cowboys|牛仔/i,
        /Samurai|武士/i,
        /Vikings|维京人/i,
    ];

    for (const namePattern of factionNames) {
        const card = page.getByText(namePattern).first();
        await card.scrollIntoViewIfNeeded();
        await expect(card).toBeVisible({ timeout: 10000 });
    }
    await expect.poll(async () => page.locator('.atlas-shimmer').count(), {
        timeout: 10000,
        message: 'Oops 四派系在派系选择界面中不应停留在 shimmer 占位态',
    }).toBe(0);

    await game.screenshot('oops-faction-selection-visible', testInfo);

    await game.setupScene({
        gameId: 'smashup',
        player0: {
            factions: ['vikings', 'samurai'],
            hand: [
                { uid: 'p0-viking-minion', defId: 'vikings_huscarl', type: 'minion' },
                { uid: 'p0-samurai-action', defId: 'samurai_yokai_attack', type: 'action' },
            ],
            deck: [
                { uid: 'p0-deck-1', defId: 'vikings_raider', type: 'minion' },
                { uid: 'p0-deck-2', defId: 'samurai_shogun', type: 'minion' },
            ],
            discard: [],
            minionsPlayed: 0,
            minionLimit: 1,
            actionsPlayed: 0,
            actionLimit: 1,
        },
        player1: {
            factions: ['ancient_egyptians', 'cowboys'],
            hand: [],
            deck: [
                { uid: 'p1-deck-1', defId: 'ancient_egyptians_mummy', type: 'minion' },
                { uid: 'p1-deck-2', defId: 'cowboys_deputy', type: 'minion' },
            ],
            discard: [],
            minionsPlayed: 0,
            minionLimit: 1,
            actionsPlayed: 0,
            actionLimit: 1,
        },
        currentPlayer: '0',
        phase: 'playCards',
        bases: [
            { defId: 'base_drakkar' },
            { defId: 'base_shoguns_palace' },
            { defId: 'base_pyramids' },
        ],
        extra: {
            core: {
                turnOrder: ['0', '1'],
                turnNumber: 1,
                nextUid: 5000,
                baseDeck: ['base_longhouse', 'base_saloon', 'base_sakura_garden'],
            },
        },
    });

    await waitForSmashUpUI(page);

    await expect(page.locator('[data-base-index="0"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-base-index="1"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-base-index="2"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-card-uid="p0-viking-minion"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-card-uid="p0-samurai-action"]')).toBeVisible({ timeout: 10000 });

    await expect.poll(async () => page.locator('.atlas-shimmer').count(), {
        timeout: 10000,
        message: 'Oops 四派系接入后的卡图/基地图不应停留在 shimmer 占位态',
    }).toBe(0);

    const state = await page.evaluate(() => (window as any).__BG_TEST_HARNESS__?.state?.get?.() ?? null);
    expect(state).toBeTruthy();
    expect(state.core.players['0'].factions).toEqual(['vikings', 'samurai']);
    expect(state.core.players['1'].factions).toEqual(['ancient_egyptians', 'cowboys']);
    expect(state.core.bases.map((base: any) => base.defId)).toEqual([
        'base_drakkar',
        'base_shoguns_palace',
        'base_pyramids',
    ]);

    await game.screenshot('oops-faction-intake-board', testInfo);
});

test('Oops Ancient Egyptians 埋葬条带与翻开交互应在浏览器中可完成', async ({ page, game }, testInfo) => {
    test.setTimeout(60000);

    await game.openTestGame('smashup');
    await game.setupScene({
        gameId: 'smashup',
        player0: {
            factions: ['ancient_egyptians', 'robots'],
            hand: [
                { uid: 'seal-1', defId: 'ancient_egyptians_seal_the_tomb', type: 'action' },
            ],
            deck: [
                { uid: 'draw-1', defId: 'robot_microbot_alpha', type: 'minion' },
                { uid: 'draw-2', defId: 'robot_zapbot', type: 'minion' },
                { uid: 'draw-3', defId: 'robot_warbot', type: 'minion' },
            ],
            discard: [],
            minionsPlayed: 0,
            minionLimit: 1,
            actionsPlayed: 0,
            actionLimit: 1,
        },
        player1: {
            factions: ['vikings', 'samurai'],
            hand: [],
            deck: [],
            discard: [],
            minionsPlayed: 0,
            minionLimit: 1,
            actionsPlayed: 0,
            actionLimit: 1,
        },
        currentPlayer: '0',
        phase: 'playCards',
        bases: [
            { defId: 'base_pyramids' },
            { defId: 'base_a' },
        ],
        extra: {
            core: {
                turnOrder: ['0', '1'],
                turnNumber: 1,
                nextUid: 5000,
                bases: [
                    {
                        defId: 'base_pyramids',
                        minions: [
                            {
                                uid: 'guard-1',
                                defId: 'robot_microbot_alpha',
                                owner: '0',
                                controller: '0',
                                basePower: 1,
                                counters: 0,
                                talentUsed: false,
                                attachedActions: [],
                            },
                        ],
                        ongoingActions: [],
                        buriedCards: [
                            {
                                uid: 'buried-yk',
                                defId: 'ancient_egyptians_you_can_take_it_with_you',
                                trueOwnerId: '0',
                                controllerId: '0',
                                buriedFrom: 'hand',
                            },
                        ],
                    },
                    {
                        defId: 'base_a',
                        minions: [],
                        ongoingActions: [],
                    },
                ],
            },
        },
    });

    await waitForSmashUpUI(page);
    await expect(page.locator('[data-buried-count="1"]').first()).toBeVisible({ timeout: 8000 });
    await saveEvidenceScreenshot(page, testInfo, 'oops-bury-strip-before-uncover');

    await page.evaluate(() => {
        const harness = (window as any).__BG_TEST_HARNESS__;
        harness.state.patch({
            sys: {
                interaction: {
                    current: {
                        id: 'seal-the-tomb-uncover-test',
                        kind: 'simple-choice',
                        playerId: '0',
                        data: {
                            title: '封印墓穴：翻开同一基地至多两张你的埋葬牌',
                            options: [
                                {
                                    id: 'buried-buried-yk',
                                    label: 'You Can Take It With You @ Pyramids',
                                    value: { cardUid: 'buried-yk', baseIndex: 0 },
                                    displayMode: 'button',
                                },
                            ],
                            sourceId: 'ancient_egyptians_seal_the_tomb_uncover',
                            targetType: 'generic',
                            multi: { min: 0, max: 1 },
                        },
                    },
                    queue: [],
                    isBlocked: false,
                },
            },
        });
    });
    await page.waitForTimeout(300);
    await expect.poll(async () => (await getCurrentInteraction(page))?.data?.sourceId ?? null).toBe('ancient_egyptians_seal_the_tomb_uncover');
    const uncoverOptions = await getCurrentInteractionOptions(page);
    const buriedOption = uncoverOptions.find((option: any) => option?.value?.cardUid === 'buried-yk');
    expect(buriedOption).toBeTruthy();
    await respondCurrentInteraction(page, { optionIds: [buriedOption.id] });

    await expect.poll(async () => {
        const state = await game.getState();
        return state.core.bases[0].buriedCards?.length ?? 0;
    }, { timeout: 8000 }).toBe(0);

    await expect.poll(async () => {
        const state = await game.getState();
        return state.core.players['0'].hand.length;
    }, { timeout: 8000 }).toBe(4);

    await expect.poll(async () => {
        const state = await game.getState();
        return state.core.players['0'].discard.some((card: any) => card.defId === 'ancient_egyptians_you_can_take_it_with_you');
    }, { timeout: 8000 }).toBe(true);

    await saveEvidenceScreenshot(page, testInfo, 'oops-bury-strip-after-uncover');
});

test('Oops Cowboys 决斗交互应按官方链路完成 Pinkerton/决斗牌/Deputy/结算', async ({ page, game }, testInfo) => {
    test.setTimeout(60000);
    const duelBannerText = /决斗进行中|Duel in progress/i;
    const duelCardPromptText = /决斗：从手牌选择 1 张决斗牌|Duel: choose 1 duel card from hand/i;
    const deputyPromptText = /Deputy：你可以弃掉一张 Deputy|Deputy: you may discard a Deputy/i;

    await game.openTestGame('smashup');
    await game.setupScene({
        gameId: 'smashup',
        player0: {
            factions: ['cowboys', 'robots'],
            hand: [
                { uid: 'gun-1', defId: 'cowboys_gunfighter', type: 'minion' },
                { uid: 'deputy-1', defId: 'cowboys_deputy', type: 'minion' },
            ],
            deck: [],
            discard: [],
            field: [
                { uid: 'pink-1', defId: 'cowboys_pinkerton', baseIndex: 0, owner: '0', controller: '0', power: 4 },
            ],
            minionsPlayed: 0,
            minionLimit: 1,
            actionsPlayed: 0,
            actionLimit: 1,
        },
        player1: {
            factions: ['samurai', 'vikings'],
            hand: [],
            deck: [],
            discard: [],
            field: [
                { uid: 'enemy-1', defId: 'robot_microbot_alpha', baseIndex: 0, owner: '1', controller: '1', power: 2 },
            ],
            minionsPlayed: 0,
            minionLimit: 1,
            actionsPlayed: 0,
            actionLimit: 1,
        },
        currentPlayer: '0',
        phase: 'playCards',
        bases: [{ defId: 'base_a' }],
        extra: {
            core: {
                turnOrder: ['0', '1'],
                turnNumber: 1,
                nextUid: 6000,
            },
        },
    });

    await waitForSmashUpUI(page);
    await game.playCard('cowboys_gunfighter', { targetBaseIndex: 0 });
    await expect.poll(async () => (await getCurrentInteraction(page))?.data?.sourceId ?? null).toBe('cowboys_gunfighter');

    await waitForSelectableMinion(page, 'enemy-1');
    await clickSelectableMinion(page, 'enemy-1');

    await expect.poll(async () => (await getCurrentInteraction(page))?.data?.sourceId ?? null).toBe('smashup_duel_pinkerton');
    await expect(page.getByText(duelBannerText)).toBeVisible({ timeout: 8000 });
    await saveEvidenceScreenshot(page, testInfo, 'oops-duel-pinkerton-prompt');
    await page.getByRole('button', { name: /放置 1 个指示物|Place 1 counter/i }).click();

    await expect.poll(async () => (await getCurrentInteraction(page))?.data?.sourceId ?? null).toBe('smashup_duel_card');
    await expect(page.getByText(duelCardPromptText)).toBeVisible({ timeout: 8000 });
    await saveEvidenceScreenshot(page, testInfo, 'oops-duel-card-prompt');
    await page.getByRole('button', { name: /跳过（不放决斗牌）|Skip \(play no duel card\)/i }).click();

    await expect.poll(async () => {
        const interaction = await getCurrentInteraction(page);
        return interaction ? { sourceId: interaction.data?.sourceId ?? null, playerId: interaction.playerId ?? null } : null;
    }, { timeout: 8000 }).toEqual({ sourceId: 'smashup_duel_card', playerId: '1' });
    const enemySkipOption = await findCurrentInteractionOption(page, option => option?.value?.skip === true);
    expect(enemySkipOption).toBeTruthy();
    await respondCurrentInteraction(page, { optionId: enemySkipOption.id });

    await expect.poll(async () => {
        const interaction = await getCurrentInteraction(page);
        return interaction ? { sourceId: interaction.data?.sourceId ?? null, playerId: interaction.playerId ?? null } : null;
    }, { timeout: 8000 }).toEqual({ sourceId: 'smashup_duel_deputy_card', playerId: '0' });
    await expect(page.getByText(deputyPromptText)).toBeVisible({ timeout: 8000 });
    await saveEvidenceScreenshot(page, testInfo, 'oops-duel-deputy-card-prompt');
    await page.locator('[data-card-uid="deputy-1"]').click({ force: true });

    await expect.poll(async () => (await getCurrentInteraction(page))?.data?.sourceId ?? null).toBe('smashup_duel_deputy_target');
    await saveEvidenceScreenshot(page, testInfo, 'oops-duel-deputy-target-prompt');
    await clickSelectableMinion(page, 'gun-1');

    await expect.poll(async () => {
        const state = await game.getState();
        return {
            enemyGone: !state.core.bases[0].minions.some((minion: any) => minion.uid === 'enemy-1'),
            deputyDiscarded: state.core.players['0'].discard.some((card: any) => card.uid === 'deputy-1'),
            activeDuel: state.core.activeDuel ?? null,
        };
    }, { timeout: 8000 }).toEqual({
        enemyGone: true,
        deputyDiscarded: true,
        activeDuel: null,
    });
    await expect(page.getByText(duelBannerText)).toHaveCount(0);

    await saveEvidenceScreenshot(page, testInfo, 'oops-duel-after-resolve');
});

test('Oops Samurai 额外出牌效果应在浏览器中兑现额外随从与行动额度', async ({ page, game }, testInfo) => {
    test.setTimeout(60000);

    await game.openTestGame('smashup');
    await game.setupScene({
        gameId: 'smashup',
        player0: {
            factions: ['samurai', 'cowboys'],
            hand: [
                { uid: 'yokai-1', defId: 'samurai_yokai_attack', type: 'action' },
            ],
            deck: [],
            discard: [],
            field: [
                { uid: 'ally-1', defId: 'samurai_samurai_chan', baseIndex: 0, owner: '0', controller: '0', power: 2 },
            ],
            minionsPlayed: 0,
            minionLimit: 1,
            actionsPlayed: 0,
            actionLimit: 1,
        },
        player1: {
            factions: ['vikings', 'robots'],
            hand: [],
            deck: [],
            discard: [],
            minionsPlayed: 0,
            minionLimit: 1,
            actionsPlayed: 0,
            actionLimit: 1,
        },
        currentPlayer: '0',
        phase: 'playCards',
        bases: [{ defId: 'base_a' }],
        extra: {
            core: {
                turnOrder: ['0', '1'],
                turnNumber: 1,
                nextUid: 7000,
            },
        },
    });

    await waitForSmashUpUI(page);
    await page.evaluate(() => {
        const harness = (window as any).__BG_TEST_HARNESS__;
        harness.state.patch({
            sys: {
                interaction: {
                    current: {
                        id: 'samurai-yokai-attack-test',
                        kind: 'simple-choice',
                        playerId: '0',
                        data: {
                            title: '妖怪来袭：选择你要消灭的一个随从',
                            options: [
                                {
                                    id: 'minion-0',
                                    label: 'Samurai-Chan',
                                    value: { minionUid: 'ally-1', baseIndex: 0, defId: 'samurai_samurai_chan' },
                                },
                            ],
                            sourceId: 'samurai_yokai_attack',
                            targetType: 'minion',
                        },
                    },
                    queue: [],
                    isBlocked: false,
                },
            },
        });
    });
    await page.waitForTimeout(300);
    await expect.poll(async () => (await getCurrentInteraction(page))?.data?.sourceId ?? null).toBe('samurai_yokai_attack');

    await waitForSelectableMinion(page, 'ally-1');
    await saveEvidenceScreenshot(page, testInfo, 'oops-extra-play-before-select');
    await clickSelectableMinion(page, 'ally-1');

    await expect.poll(async () => {
        const state = await game.getState();
        return {
            allyGone: !state.core.bases[0].minions.some((minion: any) => minion.uid === 'ally-1'),
            minionLimit: state.core.players['0'].minionLimit,
            actionLimit: state.core.players['0'].actionLimit,
        };
    }, { timeout: 8000 }).toEqual({
        allyGone: true,
        minionLimit: 2,
        actionLimit: 2,
    });

    await saveEvidenceScreenshot(page, testInfo, 'oops-extra-play-after-resolve');
});

test('在线模式对手打出行动卡时应显示特写', async ({ browser }, testInfo) => {
    test.setTimeout(120000);

    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const firstSetup = await setupSmashUpMatchSkipSetup(browser, baseURL);
    if (!firstSetup) {
        test.skip(true, 'SmashUp 联机房间创建失败');
        return;
    }

    try {
        const { hostPage, guestPage } = firstSetup;
        await applyOnlineMatchState(firstSetup.matchId, hostPage, (state) => buildActionSpotlightState(state, 0));
        await waitForSmashUpUI(hostPage);
        await waitForSmashUpUI(guestPage);
        await waitForTurnTracker(hostPage, 'YOU');
        await waitForTurnTracker(guestPage, 'OPP');

        const guestSpotlightCard = guestPage.getByTestId('smashup-action-spotlight-card');
        const guestSpotlightQueue = guestPage.getByTestId('card-spotlight-queue');
        const hostSpotlightQueue = hostPage.getByTestId('card-spotlight-queue');

        const hostActionUid = await getPlayerActionUid(hostPage, '0', 'wizard_mystic_studies');
        expect(hostActionUid).toBeTruthy();
        await hostPage.locator(`[data-card-uid="${hostActionUid}"]`).click();
        await expect(guestSpotlightCard).toBeVisible({ timeout: 8000 });
        await expect(guestSpotlightCard).toHaveAttribute('data-card-def-id', 'wizard_mystic_studies');
        await expect(hostSpotlightQueue).toHaveCount(0);
        await saveEvidenceScreenshot(guestPage, testInfo, 'action-spotlight-online-p0');

        await guestSpotlightQueue.click({ force: true });
        await expect(guestSpotlightCard).toBeHidden({ timeout: 5000 });
    } finally {
        await firstSetup.guestContext.close();
        await firstSetup.hostContext.close();
    }

    const secondSetup = await setupSmashUpMatchSkipSetup(browser, baseURL);
    if (!secondSetup) {
        test.skip(true, 'SmashUp 联机房间创建失败（P1 场景）');
        return;
    }

    try {
        const { hostPage, guestPage } = secondSetup;
        await applyOnlineMatchState(secondSetup.matchId, hostPage, (state) => buildActionSpotlightState(state, 1));
        await waitForSmashUpUI(hostPage);
        await waitForSmashUpUI(guestPage);
        await waitForTurnTracker(hostPage, 'OPP');
        await waitForTurnTracker(guestPage, 'YOU');

        const hostSpotlightCard = hostPage.getByTestId('smashup-action-spotlight-card');
        const hostSpotlightQueue = hostPage.getByTestId('card-spotlight-queue');
        const guestSpotlightQueue = guestPage.getByTestId('card-spotlight-queue');

        const guestActionUid = await getPlayerActionUid(guestPage, '1', 'wizard_mystic_studies');
        expect(guestActionUid).toBeTruthy();
        await guestPage.locator(`[data-card-uid="${guestActionUid}"]`).click();
        await expect(hostSpotlightCard).toBeVisible({ timeout: 8000 });
        await expect(hostSpotlightCard).toHaveAttribute('data-card-def-id', 'wizard_mystic_studies');
        await expect(guestSpotlightQueue).toHaveCount(0);
        await saveEvidenceScreenshot(hostPage, testInfo, 'action-spotlight-online-p1');

        await hostSpotlightQueue.click({ force: true });
        await expect(hostSpotlightCard).toBeHidden({ timeout: 5000 });
    } finally {
        await secondSetup.guestContext.close();
        await secondSetup.hostContext.close();
    }
});

test('阵营选择已清空但 phase 残留时，仍应显示起手重抽交互', async ({ page, game }, testInfo) => {
    test.setTimeout(60000);

    await page.goto('/play/smashup');
    await page.waitForFunction(
        () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true,
        { timeout: 15000, polling: 200 },
    );

    await game.setupScene({
        gameId: 'smashup',
        player0: { factions: ['tricksters_pod', 'steampunks_pod'] },
        player1: { factions: ['vampires_pod', 'bear_cavalry_pod'] },
        currentPlayer: '0',
        phase: 'playCards',
    });

    await page.evaluate((updaterSource) => {
        const harness = (window as any).__BG_TEST_HARNESS__;
        const state = harness.state.get();
        const updater = new Function('state', `${updaterSource}`) as (state: any) => any;
        harness.state.set(updater(state));
    }, `return (${buildFactionSelectStuckState.toString()})(state);`);

    await page.waitForTimeout(500);
    await expect(page.locator('[data-tutorial-id="su-faction-select"]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '保留手牌' })).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole('button', { name: '重抽一次' })).toBeVisible({ timeout: 8000 });

    await saveEvidenceScreenshot(page, testInfo, 'stuck-faction-select-mulligan-visible');
});
