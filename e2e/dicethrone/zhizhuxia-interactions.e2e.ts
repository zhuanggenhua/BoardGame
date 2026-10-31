/**
 * DiceThrone 蜘蛛侠规则交互审计证据。
 *
 * 第一组覆盖：落网只在技能区普通攻击进入防御前消费，
 * 并把本次攻击改为不可防御；状态变化来自真实浏览器运行时命令链。
 */

import type { Page, TestInfo } from '@playwright/test';
import { dirname } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { test, expect } from '../framework';
import { clearEvidenceScreenshotsForTest, getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';
import { dispatchDiceThroneCommand, dragDiceThroneHandCardToPlay, waitForDiceThroneHarness } from '../helpers/dicethrone';
import { waitForTestHarness } from '../helpers/common';
import { STATUS_IDS, TOKEN_IDS } from '../../src/games/dicethrone/domain/ids';
import { RESOURCE_IDS } from '../../src/games/dicethrone/domain/resources';

const saveEvidenceScreenshot = async (page: Page, testInfo: TestInfo, name: string): Promise<string> => {
    const path = getEvidenceScreenshotPath(testInfo, name, {
        filename: `${name}.png`,
        format: 'png',
        requireChineseName: true,
    });
    await mkdir(dirname(path), { recursive: true });
    await page.screenshot({ path, fullPage: false });
    return path;
};

const spiderDice = Array.from({ length: 5 }, (_, id) => ({
    id,
    value: 1,
    definitionId: 'zhizhuxia-dice',
    symbol: 'fist',
    symbols: ['fist'],
    isKept: false,
    ownerId: '0',
}));

const startDefenseIfPresent = async (page: Page): Promise<void> => {
    const startDefenseButton = page.getByRole('button', { name: /开始防御|Start Defense/i }).first();
    if (await startDefenseButton.isVisible({ timeout: 1500 }).catch(() => false)) {
        await startDefenseButton.click();
        await expect(startDefenseButton).toBeHidden({ timeout: 5000 });
    }
};

test.describe('DiceThrone 蜘蛛侠真实规则交互', () => {
    test('落网应在技能区普通攻击进入防御前被消费', async ({ page, game }, testInfo) => {
        test.setTimeout(120000);
        await clearEvidenceScreenshotsForTest(testInfo);
        await game.openTestGame('dicethrone', { playerID: '0', seat1: 'human' }, 45000);
        await waitForTestHarness(page, 40000);
        await waitForDiceThroneHarness(page);

        await game.setupScene({
            gameId: 'dicethrone',
            player0: {
                hand: [],
                resources: { CP: 10, HP: 50 },
            },
            player1: {
                hand: [],
                resources: { CP: 10, HP: 50 },
                statusEffects: { webbed: 1 },
            },
            currentPlayer: '0',
            phase: 'offensiveRoll',
            extra: {
                selectedCharacters: { '0': 'zhizhuxia', '1': 'monk' },
                activePlayerId: '0',
                rollCount: 3,
                rollLimit: 3,
                rollConfirmed: true,
                dice: spiderDice,
                pendingAttack: null,
                pendingDamage: null,
                currentRollContext: {
                    kind: 'main',
                    id: 'zhizhuxia-webbed-audit-roll',
                    ownerPlayerId: '0',
                    phase: 'offensiveRoll',
                    dice: spiderDice,
                    rollCount: 3,
                    rollLimit: 3,
                    rollConfirmed: true,
                },
            },
        });

        await expect(page.getByTestId('player-board-surface')).toHaveAttribute('data-character-id', 'zhizhuxia');
        await expect.poll(async () => {
            const state = await game.getState();
            return state?.core?.players?.['1']?.statusEffects?.webbed ?? 0;
        }).toBe(1);
        await saveEvidenceScreenshot(page, testInfo, '01-落网-普通攻击前');

        await dispatchDiceThroneCommand(page, {
            type: 'SELECT_ABILITY',
            playerId: '0',
            payload: { abilityId: 'heavy-punch-3' },
        });
        await expect.poll(async () => {
            const state = await game.getState();
            return {
                reject: await page.evaluate(() => (window as any).__BG_LAST_COMMAND_REJECTED__ ?? null),
                sourceAbilityId: state?.core?.pendingAttack?.sourceAbilityId ?? null,
                defenderId: state?.core?.pendingAttack?.defenderId ?? null,
            };
        }, { timeout: 10000 }).toMatchObject({
            reject: null,
            sourceAbilityId: 'heavy-punch-3',
            defenderId: '1',
        });

        await dispatchDiceThroneCommand(page, {
            type: 'ADVANCE_PHASE',
            playerId: '0',
            payload: {},
        });

        await expect.poll(async () => {
            const state = await game.getState();
            const entries = Array.isArray(state?.sys?.eventStream?.entries)
                ? state.sys.eventStream.entries
                : [];
            return {
                reject: await page.evaluate(() => (window as any).__BG_LAST_COMMAND_REJECTED__ ?? null),
                phase: state?.sys?.phase ?? null,
                webbed: state?.core?.players?.['1']?.statusEffects?.webbed ?? 0,
                eventTypes: entries.map((entry: any) => entry?.event?.type ?? entry?.type ?? null),
            };
        }, { timeout: 15000 }).toMatchObject({
            reject: null,
            phase: 'main2',
            webbed: 0,
        });

        const settledState = await game.getState();
        const eventTypes = Array.isArray(settledState?.sys?.eventStream?.entries)
            ? settledState.sys.eventStream.entries.map((entry: any) => entry?.event?.type ?? entry?.type ?? null)
            : [];
        expect(eventTypes).toEqual(expect.arrayContaining(['PENDING_ATTACK_UPDATED', 'STATUS_REMOVED']));

        await saveEvidenceScreenshot(page, testInfo, '02-落网-普通攻击前被消费');
    });

    test('真实打出蜘蛛发射器后，施加落网应立即造成 2 点状态伤害', async ({ page, game }, testInfo) => {
        test.setTimeout(120000);
        await clearEvidenceScreenshotsForTest(testInfo);
        await game.openTestGame('dicethrone', { playerID: '0', seat1: 'human' }, 45000);
        await waitForTestHarness(page, 40000);
        await waitForDiceThroneHarness(page);

        await game.setupScene({
            gameId: 'dicethrone',
            player0: {
                hand: ['card-zhizhuxia-spider-launcher'],
                resources: { CP: 5, HP: 50 },
            },
            player1: {
                hand: [],
                resources: { CP: 5, HP: 50 },
            },
            currentPlayer: '0',
            phase: 'main1',
            extra: {
                selectedCharacters: { '0': 'zhizhuxia', '1': 'monk' },
                activePlayerId: '0',
                hostStarted: true,
            },
        });

        await game.waitForPhase('main1', 10000);
        await expect(page.getByTestId('player-board-surface')).toHaveAttribute('data-character-id', 'zhizhuxia');
        await expect(page.locator('[data-testid="hand-area"] [data-card-id="card-zhizhuxia-spider-launcher"]').first())
            .toBeVisible({ timeout: 10000 });
        await saveEvidenceScreenshot(page, testInfo, '03-蜘蛛发射器-施加落网前');

        await dragDiceThroneHandCardToPlay(page, 'card-zhizhuxia-spider-launcher');

        await expect.poll(async () => {
            const state = await game.getState();
            const entries = Array.isArray(state?.sys?.eventStream?.entries)
                ? state.sys.eventStream.entries
                : [];
            const webbedDamage = entries.filter((entry: any) => (
                (entry?.event?.type ?? entry?.type) === 'DAMAGE_DEALT'
                && entry?.event?.payload?.sourceAbilityId === STATUS_IDS.WEBBED
                && entry?.event?.payload?.damageOrigin === 'status'
            ));
            const latest = webbedDamage.at(-1)?.event?.payload ?? null;
            return {
                reject: await page.evaluate(() => (window as any).__BG_LAST_COMMAND_REJECTED__ ?? null),
                hp: state?.core?.players?.['1']?.resources?.HP ?? state?.core?.players?.['1']?.resources?.hp ?? null,
                webbed: state?.core?.players?.['1']?.statusEffects?.webbed ?? 0,
                handIds: state?.core?.players?.['0']?.hand?.map((card: any) => card.id) ?? [],
                discardIds: state?.core?.players?.['0']?.discard?.map((card: any) => card.id) ?? [],
                webbedDamageCount: webbedDamage.length,
                webbedDamage: latest,
            };
        }, { timeout: 15000 }).toMatchObject({
            reject: null,
            hp: 48,
            webbed: 1,
            handIds: [],
            discardIds: ['card-zhizhuxia-spider-launcher'],
            webbedDamageCount: 1,
            webbedDamage: {
                amount: 2,
                actualDamage: 2,
                damageScope: 'direct',
                damageOrigin: 'status',
                unblockable: true,
            },
        });

        await saveEvidenceScreenshot(page, testInfo, '04-蜘蛛发射器-落网与2点状态伤害已结算');
    });

    test('手牌来源直接伤害不消费落网', async ({ page, game }, testInfo) => {
        test.setTimeout(120000);
        await clearEvidenceScreenshotsForTest(testInfo);
        await game.openTestGame('dicethrone', { playerID: '0', seat1: 'human' }, 45000);
        await waitForTestHarness(page, 40000);
        await waitForDiceThroneHarness(page);

        await game.setupScene({
            gameId: 'dicethrone',
            player0: {
                hand: ['card-zhizhuxia-invisible-punch'],
                resources: { CP: 10, HP: 50 },
            },
            player1: {
                hand: [],
                resources: { CP: 10, HP: 50 },
                statusEffects: { webbed: 1 },
            },
            currentPlayer: '1',
            phase: 'defensiveRoll',
            sys: {
                responseWindow: {
                    current: {
                        id: 'zhizhuxia-card-before-damage-window',
                        windowType: 'afterAttackResolved',
                        sourceId: 'fist-technique-3',
                        responderQueue: ['0'],
                        currentResponderIndex: 0,
                        passedPlayers: [],
                    },
                },
            },
            extra: {
                selectedCharacters: { '0': 'zhizhuxia', '1': 'monk' },
                activePlayerId: '1',
                pendingAttack: {
                    attackerId: '1',
                    defenderId: '0',
                    sourceAbilityId: 'fist-technique-3',
                    isDefendable: true,
                    zhizhuxiaDamagePercent: -50,
                },
                pendingDamage: {
                    id: 'zhizhuxia-card-direct-damage',
                    sourcePlayerId: '1',
                    targetPlayerId: '0',
                    originalDamage: 5,
                    currentDamage: 5,
                    sourceAbilityId: 'fist-technique-3',
                    damageScope: 'attack',
                    damageOrigin: 'ability',
                    responseType: 'beforeDamageReceived',
                    responderId: '0',
                    isFullyEvaded: false,
                },
            },
        });

        await expect(page.getByTestId('player-board-surface')).toHaveAttribute('data-character-id', 'zhizhuxia');
        await expect.poll(async () => {
            const state = await game.getState();
            return {
                webbed: state?.core?.players?.['1']?.statusEffects?.webbed ?? 0,
                handIds: state?.core?.players?.['0']?.hand?.map((card: any) => card.id) ?? [],
            };
        }).toMatchObject({ webbed: 1, handIds: ['card-zhizhuxia-invisible-punch'] });
        await saveEvidenceScreenshot(page, testInfo, '03-手牌来源伤害-落网保留');

        await dispatchDiceThroneCommand(page, {
            type: 'PLAY_CARD',
            playerId: '0',
            payload: { cardId: 'card-zhizhuxia-invisible-punch' },
        });
        console.log('[zhizhuxia-card-command-reject]', JSON.stringify(await page.evaluate(() => (window as any).__BG_LAST_COMMAND_REJECTED__ ?? null)));

        console.log('[zhizhuxia-diag-card]', JSON.stringify(await game.getState()));

        await expect.poll(async () => {
            const state = await game.getState();
            const entries = Array.isArray(state?.sys?.eventStream?.entries)
                ? state.sys.eventStream.entries
                : [];
            const cardDamage = [...entries]
                .reverse()
                .find((entry: any) => entry?.event?.type === 'DAMAGE_DEALT' && entry?.event?.payload?.sourceAbilityId === 'card-zhizhuxia-invisible-punch');
            return {
                webbed: state?.core?.players?.['1']?.statusEffects?.webbed ?? 0,
                hp: state?.core?.players?.['1']?.resources?.HP ?? state?.core?.players?.['1']?.resources?.hp ?? null,
                handIds: state?.core?.players?.['0']?.hand?.map((card: any) => card.id) ?? [],
                discardIds: state?.core?.players?.['0']?.discard?.map((card: any) => card.id) ?? [],
                cardDamageOrigin: cardDamage?.event?.payload?.damageOrigin ?? null,
                cardDamageScope: cardDamage?.event?.payload?.damageScope ?? null,
            };
        }, { timeout: 15000 }).toMatchObject({
            webbed: 1,
            hp: 47,
            handIds: [],
            discardIds: ['card-zhizhuxia-invisible-punch'],
            cardDamageOrigin: 'card',
            cardDamageScope: 'direct',
        });

        await saveEvidenceScreenshot(page, testInfo, '04-手牌来源伤害-不消费落网');
    });

    test('Token 来源反伤不消费落网，并保留 token 直接伤害来源', async ({ page, game }, testInfo) => {
        test.setTimeout(120000);
        await clearEvidenceScreenshotsForTest(testInfo);
        await game.openTestGame('dicethrone', { playerID: '0', seat1: 'human' }, 45000);
        await waitForTestHarness(page, 40000);
        await waitForDiceThroneHarness(page);

        await game.setupScene({
            gameId: 'dicethrone',
            player0: {
                hand: [],
                resources: { CP: 10, HP: 50 },
                tokens: { [TOKEN_IDS.RETRIBUTION]: 1 },
            },
            player1: {
                hand: [],
                resources: { CP: 10, HP: 50 },
                statusEffects: { webbed: 1 },
            },
            currentPlayer: '1',
            phase: 'defensiveRoll',
            sys: {
                interaction: {
                    current: {
                        id: 'dt:token-response:zhizhuxia-token-direct-damage',
                        kind: 'dt:token-response',
                        playerId: '0',
                        data: {
                            pendingDamageId: 'zhizhuxia-token-direct-damage',
                        },
                    },
                    queue: [],
                },
                responseWindow: {
                    current: {
                        id: 'zhizhuxia-token-before-damage-window',
                        windowType: 'afterAttackResolved',
                    sourceId: 'fist-technique-3',
                        responderQueue: ['0'],
                        currentResponderIndex: 0,
                        passedPlayers: [],
                    },
                },
            },
            extra: {
                selectedCharacters: { '0': 'paladin', '1': 'zhizhuxia' },
                activePlayerId: '1',
                pendingAttack: {
                    attackerId: '1',
                    defenderId: '0',
                    sourceAbilityId: 'fist-technique-3',
                    isDefendable: true,
                },
                pendingDamage: {
                    id: 'zhizhuxia-token-direct-damage',
                    sourcePlayerId: '1',
                    targetPlayerId: '0',
                    originalDamage: 4,
                    currentDamage: 4,
                    sourceAbilityId: 'fist-technique-3',
                    damageScope: 'attack',
                    damageOrigin: 'ability',
                    responseType: 'beforeDamageReceived',
                    responderId: '0',
                    isFullyEvaded: false,
                },
            },
        });

        const retributionToken = page.getByTestId(`dt-player-0-token-${TOKEN_IDS.RETRIBUTION}`);
        await expect(retributionToken).toBeVisible({ timeout: 10000 });
        await expect(retributionToken).toHaveAttribute('data-token-clickable', 'true', { timeout: 10000 });
        await saveEvidenceScreenshot(page, testInfo, '05-Token来源伤害-落网保留');

        await retributionToken.click();
        const passButton = page.getByTestId('dicethrone-response-pass-button');
        if (await passButton.isVisible({ timeout: 1500 }).catch(() => false)) {
            await passButton.click();
        }

        await expect.poll(async () => {
            const state = await game.getState();
            const entries = Array.isArray(state?.sys?.eventStream?.entries)
                ? state.sys.eventStream.entries
                : [];
            const reflectedDamage = [...entries]
                .reverse()
                .find((entry: any) => entry?.event?.type === 'DAMAGE_DEALT' && entry?.event?.payload?.sourceAbilityId === 'retribution-reflect');
            return {
                webbed: state?.core?.players?.['1']?.statusEffects?.webbed ?? 0,
                attackerHp: state?.core?.players?.['1']?.resources?.HP ?? state?.core?.players?.['1']?.resources?.hp ?? null,
                defenderHp: state?.core?.players?.['0']?.resources?.HP ?? state?.core?.players?.['0']?.resources?.hp ?? null,
                retribution: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.RETRIBUTION] ?? 0,
                pendingDamage: state?.core?.pendingDamage ?? null,
                tokenDamageOrigin: reflectedDamage?.event?.payload?.damageOrigin ?? null,
                tokenDamageScope: reflectedDamage?.event?.payload?.damageScope ?? null,
            };
        }, { timeout: 15000 }).toMatchObject({
            webbed: 1,
            attackerHp: 48,
            defenderHp: 46,
            retribution: 0,
            pendingDamage: null,
            tokenDamageOrigin: 'token',
            tokenDamageScope: 'direct',
        });

        await saveEvidenceScreenshot(page, testInfo, '06-Token来源伤害-不消费落网');
    });

    test('蜘蛛感应投出蜘蛛后，技能区攻击伤害减半并向上取整', async ({ page, game }, testInfo) => {
        test.setTimeout(120000);
        await clearEvidenceScreenshotsForTest(testInfo);
        await game.openTestGame('dicethrone', { playerID: '1', seat1: 'human' }, 45000);
        await waitForTestHarness(page, 40000);
        await waitForDiceThroneHarness(page);

        const defensiveDice = [
            { id: 0, value: 6, definitionId: 'zhizhuxia-dice', symbol: 'spider', symbols: ['spider'], isKept: false, ownerId: '1' },
            { id: 1, value: 1, definitionId: 'zhizhuxia-dice', symbol: 'fist', symbols: ['fist'], isKept: false, ownerId: '1' },
        ];
        await game.setupScene({
            gameId: 'dicethrone',
            player0: { hand: [], resources: { CP: 10, HP: 50 } },
            player1: { hand: [], resources: { CP: 10, HP: 50 } },
            currentPlayer: '1',
            phase: 'defensiveRoll',
            extra: {
                selectedCharacters: { '0': 'monk', '1': 'zhizhuxia' },
                activePlayerId: '1',
                rollCount: 1,
                rollLimit: 1,
                rollDiceCount: 2,
                rollConfirmed: true,
                dice: defensiveDice,
                currentRollContext: {
                    id: 'zhizhuxia-spider-sense-audit-roll',
                    kind: 'defensive',
                    ownerPlayerId: '1',
                    targetPlayerId: '0',
                    sourceAbilityId: 'spider-sense',
                    phase: 'defensiveRoll',
                    dice: defensiveDice,
                    status: 'settling',
                    policy: {
                        modifiableBy: 'owner',
                        rerollableBy: 'owner',
                        allowPassiveReroll: true,
                        allowDiceCardTargeting: true,
                        ultimateLocked: false,
                        blocksPhaseFlow: true,
                    },
                    settlement: { mode: 'damage' },
                    display: { surface: 'diceTray', replayOnly: false },
                },
                pendingAttack: {
                    attackerId: '0',
                    defenderId: '1',
                    sourceAbilityId: 'fist-technique-3',
                    defenseAbilityId: 'spider-sense',
                    isDefendable: true,
                    damage: 4,
                    bonusDamage: 0,
                    damageResolved: false,
                    resolvedDamage: 0,
                    preDefenseResolved: true,
                    offensiveRollEndTokenResolved: true,
                    settlementStage: 'preDamage',
                },
            },
        });

        await expect(page.getByTestId('player-board-surface')).toHaveAttribute('data-character-id', 'zhizhuxia');
        await saveEvidenceScreenshot(page, testInfo, '07-蜘蛛感应-投出蜘蛛前');
        await startDefenseIfPresent(page);

        const advanceDefense = page.locator('[data-tutorial-id="advance-phase-button"]').first();
        await expect(advanceDefense).toBeVisible({ timeout: 10000 });
        await expect(advanceDefense).toBeEnabled({ timeout: 10000 });
        await advanceDefense.click();

        console.log('[zhizhuxia-diag-spider]', JSON.stringify(await game.getState()));

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                phase: state?.sys?.phase ?? null,
                defenderHp: state?.core?.players?.['1']?.resources?.HP ?? state?.core?.players?.['1']?.resources?.hp ?? null,
                pendingAttack: state?.core?.pendingAttack ?? null,
                attackDamagePercent: state?.core?.pendingAttack?.zhizhuxiaDamagePercent ?? null,
            };
        }, { timeout: 15000 }).toMatchObject({
            phase: 'main2',
            defenderHp: 48,
            pendingAttack: null,
        });

        await saveEvidenceScreenshot(page, testInfo, '08-蜘蛛感应-伤害减半结算');
    });

    test('飞荡脱身使蛛网可作为蜘蛛感应成功面', async ({ page, game }, testInfo) => {
        test.setTimeout(120000);
        await clearEvidenceScreenshotsForTest(testInfo);
        await game.openTestGame('dicethrone', { playerID: '1', seat1: 'human' }, 45000);
        await waitForTestHarness(page, 40000);
        await waitForDiceThroneHarness(page);

        const defensiveDice = [
            { id: 0, value: 4, definitionId: 'zhizhuxia-dice', symbol: 'web', symbols: ['web'], isKept: false, ownerId: '1' },
            { id: 1, value: 1, definitionId: 'zhizhuxia-dice', symbol: 'fist', symbols: ['fist'], isKept: false, ownerId: '1' },
        ];
        await game.setupScene({
            gameId: 'dicethrone',
            player0: { hand: [], resources: { CP: 10, HP: 50 } },
            player1: { hand: ['card-zhizhuxia-flying-escape'], resources: { CP: 10, HP: 50 } },
            currentPlayer: '1',
            phase: 'defensiveRoll',
            extra: {
                selectedCharacters: { '0': 'monk', '1': 'zhizhuxia' },
                activePlayerId: '1',
                rollCount: 1,
                rollLimit: 1,
                rollDiceCount: 2,
                rollConfirmed: true,
                dice: defensiveDice,
                currentRollContext: {
                    id: 'zhizhuxia-flying-escape-audit-roll',
                    kind: 'defensive',
                    ownerPlayerId: '1',
                    targetPlayerId: '0',
                    sourceAbilityId: 'spider-sense',
                    phase: 'defensiveRoll',
                    dice: defensiveDice,
                    status: 'open',
                    policy: {
                        modifiableBy: 'owner',
                        rerollableBy: 'owner',
                        allowPassiveReroll: true,
                        allowDiceCardTargeting: true,
                        ultimateLocked: false,
                        blocksPhaseFlow: true,
                    },
                    settlement: { mode: 'damage' },
                    display: { surface: 'diceTray', replayOnly: false },
                },
                pendingAttack: {
                    attackerId: '0',
                    defenderId: '1',
                    sourceAbilityId: 'fist-technique-3',
                    defenseAbilityId: 'spider-sense',
                    isDefendable: true,
                    damage: 4,
                    bonusDamage: 0,
                    damageResolved: false,
                    resolvedDamage: 0,
                    preDefenseResolved: true,
                    offensiveRollEndTokenResolved: true,
                    settlementStage: 'preDamage',
                },
            },
        });

        await expect(page.getByTestId('player-board-surface')).toHaveAttribute('data-character-id', 'zhizhuxia');
        await saveEvidenceScreenshot(page, testInfo, '09-飞荡脱身-蛛网骰面');
        await startDefenseIfPresent(page);
        await expect(page.locator('[data-testid="hand-area"] [data-card-id="card-zhizhuxia-flying-escape"]').first())
            .toBeVisible({ timeout: 10000 });
        await dispatchDiceThroneCommand(page, {
            type: 'PLAY_CARD',
            playerId: '1',
            payload: { cardId: 'card-zhizhuxia-flying-escape' },
        });

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                acceptsWeb: state?.core?.pendingAttack?.zhizhuxiaSpiderSenseAcceptsWeb ?? false,
                handIds: state?.core?.players?.['1']?.hand?.map((card: any) => card.id) ?? [],
                discardIds: state?.core?.players?.['1']?.discard?.map((card: any) => card.id) ?? [],
            };
        }, { timeout: 15000 }).toMatchObject({
            acceptsWeb: true,
            handIds: [],
            discardIds: ['card-zhizhuxia-flying-escape'],
        });

        const advanceDefense = page.locator('[data-tutorial-id="advance-phase-button"]').first();
        await expect(advanceDefense).toBeVisible({ timeout: 10000 });
        await expect(advanceDefense).toBeEnabled({ timeout: 10000 });
        await dispatchDiceThroneCommand(page, {
            type: 'ADVANCE_PHASE',
            playerId: '1',
            payload: {},
        });

        console.log('[zhizhuxia-diag-web]', JSON.stringify(await game.getState()));

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                phase: state?.sys?.phase ?? null,
                defenderHp: state?.core?.players?.['1']?.resources?.HP ?? state?.core?.players?.['1']?.resources?.hp ?? null,
                pendingAttack: state?.core?.pendingAttack ?? null,
            };
        }, { timeout: 15000 }).toMatchObject({
            phase: 'main2',
            defenderHp: 48,
            pendingAttack: null,
        });

        await saveEvidenceScreenshot(page, testInfo, '10-飞荡脱身-蛛网视为成功面并减伤');
    });

    test('隐形在不可防御伤害窗口使本次伤害完全失效', async ({ page, game }, testInfo) => {
        test.setTimeout(120000);
        await clearEvidenceScreenshotsForTest(testInfo);
        await game.openTestGame('dicethrone', { playerID: '1', seat1: 'human' }, 45000);
        await waitForTestHarness(page, 40000);
        await waitForDiceThroneHarness(page);

        await game.setupScene({
            gameId: 'dicethrone',
            player0: { hand: [], resources: { CP: 10, HP: 50 } },
            player1: { hand: [], resources: { CP: 10, HP: 50 }, tokens: { [TOKEN_IDS.INVISIBLE]: 1 } },
            currentPlayer: '1',
            phase: 'defensiveRoll',
            sys: {
                interaction: {
                    current: {
                        id: 'dt:token-response:zhizhuxia-invisible-damage',
                        kind: 'dt:token-response',
                        playerId: '1',
                        data: { pendingDamageId: 'zhizhuxia-invisible-damage' },
                    },
                    queue: [],
                },
                responseWindow: {
                    current: {
                        id: 'zhizhuxia-invisible-damage-window',
                        windowType: 'afterAttackResolved',
                        sourceId: 'venom-punch-4',
                        responderQueue: ['1'],
                        currentResponderIndex: 0,
                        passedPlayers: [],
                    },
                },
            },
            extra: {
                selectedCharacters: { '0': 'monk', '1': 'zhizhuxia' },
                activePlayerId: '1',
                pendingAttack: {
                    attackerId: '0',
                    defenderId: '1',
                    sourceAbilityId: 'venom-punch-4',
                    isDefendable: false,
                    isUltimate: false,
                    damage: 7,
                    bonusDamage: 0,
                    preDefenseResolved: true,
                    damageResolved: false,
                    settlementStage: 'preDamage',
                },
                pendingDamage: {
                    id: 'zhizhuxia-invisible-damage',
                    sourcePlayerId: '0',
                    targetPlayerId: '1',
                    originalDamage: 7,
                    currentDamage: 7,
                    sourceAbilityId: 'venom-punch-4',
                    damageScope: 'attack',
                    damageOrigin: 'ability',
                    unblockable: true,
                    responseType: 'beforeDamageReceived',
                    responderId: '1',
                    isFullyEvaded: false,
                },
            },
        });

        const invisibleToken = page.getByTestId(`dt-player-1-token-${TOKEN_IDS.INVISIBLE}`);
        await expect.poll(async () => {
            const state = await game.getState();
            return {
                phase: state?.sys?.phase ?? null,
                attackerId: state?.core?.pendingAttack?.attackerId ?? null,
                defenderId: state?.core?.pendingAttack?.defenderId ?? null,
                sourceAbilityId: state?.core?.pendingAttack?.sourceAbilityId ?? null,
                isDefendable: state?.core?.pendingAttack?.isDefendable ?? null,
                damageUnblockable: state?.core?.pendingDamage?.unblockable ?? null,
                damage: state?.core?.pendingDamage?.currentDamage ?? null,
                defenderHp: state?.core?.players?.['1']?.resources?.HP ?? state?.core?.players?.['1']?.resources?.hp ?? null,
                invisible: state?.core?.players?.['1']?.tokens?.[TOKEN_IDS.INVISIBLE] ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            phase: 'defensiveRoll',
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'venom-punch-4',
            isDefendable: false,
            damageUnblockable: true,
            damage: 7,
            defenderHp: 50,
            invisible: 1,
        });
        await expect(invisibleToken).toBeVisible({ timeout: 10000 });
        await expect(invisibleToken).toHaveAttribute('data-token-clickable', 'true', { timeout: 10000 });
        const availableInvisibleRipples = invisibleToken.locator('[data-dicethrone-token-ripple="available"]');
        await expect(availableInvisibleRipples).toHaveCount(2);
        await expect(availableInvisibleRipples.first()).toHaveCSS('display', 'block');
        await expect(availableInvisibleRipples.first()).toHaveCSS('animation-name', 'dicethrone-token-available-ripple');
        await expect.poll(async () => availableInvisibleRipples.evaluateAll((ripples) => ripples.some((ripple) => {
            const style = window.getComputedStyle(ripple);
            const scale = new DOMMatrixReadOnly(style.transform).a;
            return style.display !== 'none' && Number(style.opacity) > 0.2 && scale > 1.05;
        })), { timeout: 5000 }).toBe(true);
        await saveEvidenceScreenshot(page, testInfo, '11-隐形-不可防御伤害响应窗口');
        await invisibleToken.click();

        await expect.poll(async () => {
            const state = await game.getState();
            const entries = Array.isArray(state?.sys?.eventStream?.entries)
                ? state.sys.eventStream.entries
                : [];
            const tokenUsed = [...entries]
                .reverse()
                .find((entry: any) => entry?.event?.type === 'TOKEN_USED' && entry?.event?.payload?.tokenId === TOKEN_IDS.INVISIBLE);
            return {
                defenderHp: state?.core?.players?.['1']?.resources?.HP ?? state?.core?.players?.['1']?.resources?.hp ?? null,
                invisible: state?.core?.players?.['1']?.tokens?.[TOKEN_IDS.INVISIBLE] ?? 0,
                pendingDamage: state?.core?.pendingDamage ?? null,
                fullyEvaded: tokenUsed?.event?.payload?.fullyEvaded ?? false,
            };
        }, { timeout: 15000 }).toMatchObject({
            defenderHp: 50,
            invisible: 0,
            pendingDamage: null,
            fullyEvaded: true,
        });

        await saveEvidenceScreenshot(page, testInfo, '12-隐形-伤害完全失效');
    });

    test('蜘蛛感应防御掷骰中消耗隐形后增加一次防御投骰', async ({ page, game }, testInfo) => {
        test.setTimeout(120000);
        await clearEvidenceScreenshotsForTest(testInfo);
        await game.openTestGame('dicethrone', { playerID: '1', seat1: 'human' }, 45000);
        await waitForTestHarness(page, 40000);
        await waitForDiceThroneHarness(page);

        const defensiveDice = [
            { id: 0, value: 6, definitionId: 'zhizhuxia-dice', symbol: 'spider', symbols: ['spider'], isKept: false, ownerId: '1' },
            { id: 1, value: 1, definitionId: 'zhizhuxia-dice', symbol: 'fist', symbols: ['fist'], isKept: false, ownerId: '1' },
        ];
        await game.setupScene({
            gameId: 'dicethrone',
            player0: { hand: [], resources: { CP: 10, HP: 50 } },
            player1: { hand: [], resources: { CP: 10, HP: 50 }, tokens: { [TOKEN_IDS.INVISIBLE]: 1 } },
            currentPlayer: '1',
            phase: 'defensiveRoll',
            extra: {
                selectedCharacters: { '0': 'monk', '1': 'zhizhuxia' },
                activePlayerId: '1',
                rollCount: 1,
                rollLimit: 1,
                rollDiceCount: 2,
                rollConfirmed: false,
                dice: defensiveDice,
                currentRollContext: {
                    id: 'zhizhuxia-extra-defense-roll-audit',
                    kind: 'defensive',
                    ownerPlayerId: '1',
                    targetPlayerId: '0',
                    sourceAbilityId: 'spider-sense',
                    phase: 'defensiveRoll',
                    dice: defensiveDice,
                    status: 'open',
                    policy: {
                        modifiableBy: 'owner',
                        rerollableBy: 'owner',
                        allowPassiveReroll: true,
                        allowDiceCardTargeting: true,
                        ultimateLocked: false,
                        blocksPhaseFlow: true,
                    },
                    settlement: { mode: 'damage' },
                    display: { surface: 'diceTray', replayOnly: false },
                },
                pendingAttack: {
                    attackerId: '0',
                    defenderId: '1',
                    sourceAbilityId: 'fist-technique-3',
                    defenseAbilityId: 'spider-sense',
                    isDefendable: true,
                    damage: 4,
                    bonusDamage: 0,
                    damageResolved: false,
                    resolvedDamage: 0,
                    preDefenseResolved: true,
                    offensiveRollEndTokenResolved: true,
                    settlementStage: 'preDamage',
                },
            },
        });

        const invisibleToken = page.getByTestId(`dt-player-1-token-${TOKEN_IDS.INVISIBLE}`);
        await expect(invisibleToken).toBeVisible({ timeout: 10000 });
        await expect(invisibleToken).toHaveAttribute('data-token-clickable', 'true', { timeout: 10000 });
        await startDefenseIfPresent(page);
        await saveEvidenceScreenshot(page, testInfo, '13-隐形-防御投骰中可用');
        await invisibleToken.click();

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                rollLimit: state?.core?.rollLimit ?? null,
                invisible: state?.core?.players?.['1']?.tokens?.[TOKEN_IDS.INVISIBLE] ?? 0,
                phase: state?.sys?.phase ?? null,
                defenseAbilityId: state?.core?.pendingAttack?.defenseAbilityId ?? null,
            };
        }, { timeout: 15000 }).toMatchObject({
            rollLimit: 2,
            invisible: 0,
            phase: 'defensiveRoll',
            defenseAbilityId: 'spider-sense',
        });

        await saveEvidenceScreenshot(page, testInfo, '14-隐形-增加一次防御投骰');
    });

    test('连击触发的追加攻击应先进入进攻阶段，不得先进入弃牌或对手收入阶段', async ({ page, game }, testInfo) => {
        test.setTimeout(120000);
        await clearEvidenceScreenshotsForTest(testInfo);
        await game.openTestGame('dicethrone', { playerID: '0', seat1: 'human' }, 45000);
        await waitForTestHarness(page, 40000);
        await waitForDiceThroneHarness(page);

        await game.setupScene({
            gameId: 'dicethrone',
            player0: {
                hand: [],
                resources: { CP: 4, HP: 50 },
                tokens: { [TOKEN_IDS.COMBO]: 0 },
            },
            player1: {
                hand: [],
                resources: { CP: 0, HP: 50 },
            },
            currentPlayer: '0',
            phase: 'main2',
            extra: {
                selectedCharacters: { '0': 'zhizhuxia', '1': 'monk' },
                activePlayerId: '0',
                turnNumber: 4,
                lastResolvedAttackDamage: 3,
                passiveActionUsedThisTurn: {
                    '0': { 'zhizhuxia-combo-extra-attack': true },
                },
                extraAttackInProgress: {
                    attackerId: '0',
                    originalActivePlayerId: '0',
                    sourceStatusId: TOKEN_IDS.COMBO,
                    phaseEntered: false,
                },
            },
        });

        await game.waitForPhase('main2', 10000);
        await saveEvidenceScreenshot(page, testInfo, '15-连击-追加攻击进入前');

        await dispatchDiceThroneCommand(page, {
            type: 'ADVANCE_PHASE',
            playerId: '0',
            payload: {},
        });

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                phase: state?.sys?.phase ?? null,
                activePlayerId: state?.core?.activePlayerId ?? null,
                turnNumber: state?.core?.turnNumber ?? null,
                phaseEntered: state?.core?.extraAttackInProgress?.phaseEntered ?? null,
                opponentCp: state?.core?.players?.['1']?.resources?.[RESOURCE_IDS.CP] ?? null,
            };
        }, { timeout: 15000 }).toEqual({
            phase: 'offensiveRoll',
            activePlayerId: '0',
            turnNumber: 4,
            phaseEntered: true,
            opponentCp: 0,
        });

        await saveEvidenceScreenshot(page, testInfo, '16-连击-追加攻击先于对手收入阶段');
    });

});
