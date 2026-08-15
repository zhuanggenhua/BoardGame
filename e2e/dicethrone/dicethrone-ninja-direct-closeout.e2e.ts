import { test, expect } from '../framework';
import { dispatchDiceThroneCommand, maybePassResponse } from '../helpers/dicethrone';
import { createCharacterDice } from '../../src/games/dicethrone/domain/characters';
import { getHeroDieFace } from '../../src/games/dicethrone/domain/rules';
import type { Die } from '../../src/games/dicethrone/domain/types';
import { RESOURCE_IDS } from '../../src/games/dicethrone/domain/resources';
import { TOKEN_IDS } from '../../src/games/dicethrone/domain/ids';
import { SHADOW_FANG_2, SLASH_2 } from '../../src/games/dicethrone/heroes/ninja/abilities';
import '../../src/games/dicethrone/domain';

const createNinjaDiceWithValues = (values: number[]) =>
    createCharacterDice('ninja').map((die: Die, index: number) => {
        const value = values[index] ?? 1;
        const symbol = getHeroDieFace('ninja', value);
        return {
            ...die,
            id: index,
            isKept: false,
            isLocked: false,
            value,
            symbol,
            symbols: symbol ? [symbol] : [],
            playerId: '0',
        };
    });

async function dispatchHarnessCommand(
    page: any,
    type: string,
    playerId: string,
    payload: Record<string, unknown> = {},
): Promise<void> {
    await page.evaluate(async ({ commandType, commandPlayerId, commandPayload }) => {
        await window.__BG_TEST_HARNESS__?.command.dispatch({
            type: commandType,
            playerId: commandPlayerId,
            payload: commandPayload,
        });
    }, {
        commandType: type,
        commandPlayerId: playerId,
        commandPayload: payload,
    });
}

async function clickAdvancePhase(page: any, playerId: string): Promise<void> {
    const advanceButton = page.locator('[data-tutorial-id="advance-phase-button"]').first();
    if (
        await advanceButton.isVisible({ timeout: 1500 }).catch(() => false)
        && await advanceButton.isEnabled({ timeout: 500 }).catch(() => false)
    ) {
        const clicked = await advanceButton.click({ timeout: 2000 }).then(() => true).catch(() => false);
        if (clicked) return;
    }
    await dispatchHarnessCommand(page, 'ADVANCE_PHASE', playerId);
}

async function dismissAttackShowcaseIfVisible(page: any): Promise<void> {
    const continueButton = page.getByRole('button', { name: /开始防御|继续|Start Defense|Continue/i }).first();
    if (await continueButton.isVisible({ timeout: 1500 }).catch(() => false)) {
        await continueButton.click();
        await expect(continueButton).toBeHidden({ timeout: 5000 }).catch(() => {});
    }
}

async function readHarnessState(page: any): Promise<any> {
    return await page.evaluate(() => window.__BG_TEST_HARNESS__?.state?.get?.());
}

async function readRecentCombatEvents(page: any): Promise<any[]> {
    return await page.evaluate(() => {
        const state = window.__BG_TEST_HARNESS__?.state?.get?.();
        const entries = state?.sys?.eventStream?.entries ?? [];
        return entries
            .filter((entry: any) => [
                'BONUS_DIE_ROLLED',
                'PENDING_ATTACK_UPDATED',
                'BONUS_DICE_REROLL_REQUESTED',
            ].includes(entry?.event?.type))
            .slice(-8)
            .map((entry: any) => ({
                type: entry?.event?.type ?? null,
                payload: entry?.event?.payload ?? null,
            }));
    });
}

async function readDefenseDebugState(page: any): Promise<any> {
    return await page.evaluate(() => {
        const state = window.__BG_TEST_HARNESS__?.state?.get?.();
        return {
            phase: state?.sys?.phase ?? null,
            interaction: state?.sys?.interaction?.current ?? null,
            responseWindow: state?.sys?.responseWindow?.current ?? null,
            pendingAttack: state?.core?.pendingAttack ?? null,
            pendingDamage: state?.core?.pendingDamage ?? null,
            pendingBonusDiceSettlement: state?.core?.pendingBonusDiceSettlement ?? null,
            recentCombatEvents: (state?.sys?.eventStream?.entries ?? [])
                .filter((entry: any) => [
                    'BONUS_DIE_ROLLED',
                    'PENDING_ATTACK_UPDATED',
                    'BONUS_DICE_REROLL_REQUESTED',
                ].includes(entry?.event?.type))
                .slice(-8)
                .map((entry: any) => ({
                    type: entry?.event?.type ?? null,
                    payload: entry?.event?.payload ?? null,
                })),
        };
    });
}

async function readHarnessStatus(page: any): Promise<any> {
    return await page.evaluate(() => window.__BG_TEST_HARNESS__?.getStatus?.() ?? null);
}

async function alignDirectPageToDefenderControl(page: any): Promise<void> {
    await page.evaluate(() => {
        const harness = window.__BG_TEST_HARNESS__;
        const current = harness?.state?.get?.();
        if (!current || !harness?.state?.set) {
            throw new Error('TestHarness state 不可用');
        }

        return harness.state.set({
            ...current,
            core: {
                ...current.core,
                activePlayerId: '1',
                currentPlayer: '1',
            },
            sys: {
                ...(current.sys ?? {}),
                currentPlayerIndex: 1,
                phase: 'defensiveRoll',
            },
        });
    });
}

async function alignDirectPageToAttackerControl(page: any): Promise<void> {
    await page.evaluate(() => {
        const harness = window.__BG_TEST_HARNESS__;
        const current = harness?.state?.get?.();
        if (!current || !harness?.state?.set) {
            throw new Error('TestHarness state 不可用');
        }

        return harness.state.set({
            ...current,
            core: {
                ...current.core,
                activePlayerId: '0',
                currentPlayer: '0',
            },
            sys: {
                ...(current.sys ?? {}),
                currentPlayerIndex: 0,
            },
        });
    });
}

async function drainOpenResponseWindows(page: any, maxRounds = 8): Promise<boolean> {
    let drained = false;
    for (let round = 0; round < maxRounds; round += 1) {
        const state = await readHarnessState(page);
        const responseWindow = state?.sys?.responseWindow?.current ?? null;
        if (!responseWindow) {
            return drained;
        }

        if (responseWindow.pendingInteractionId || responseWindow.requiredInteractionId) {
            throw new Error(`响应窗口仍被交互锁定，不能直接让过：${JSON.stringify(responseWindow)}`);
        }

        const responderQueue = Array.isArray(responseWindow.responderQueue)
            ? responseWindow.responderQueue.map(String)
            : [];
        const currentResponderIndex = typeof responseWindow.currentResponderIndex === 'number'
            ? responseWindow.currentResponderIndex
            : 0;
        const responderId = responderQueue[currentResponderIndex];
        if (!responderId) {
            throw new Error(`响应窗口缺少当前响应者，不能让过：${JSON.stringify(responseWindow)}`);
        }

        await dispatchDiceThroneCommand(page, {
            type: 'RESPONSE_PASS',
            playerId: responderId,
            payload: { forPlayerId: responderId },
        });
        await page.waitForTimeout(250);
        drained = true;
    }

    throw new Error(`响应窗口超过最大让过轮次仍未关闭：${JSON.stringify(await readDefenseDebugState(page))}`);
}

function getSimpleChoiceSkipOptionId(interaction: any): string | null {
    if (interaction?.kind !== 'simple-choice') return null;
    const options = Array.isArray(interaction?.data?.options) ? interaction.data.options : [];
    const skipOption = options.find((option: any) => {
        if (!option || option.disabled === true) return false;
        return option.id === 'skip'
            || option.labelKey === 'tokenResponse.skip'
            || option.value?.customId === 'skip'
            || option.value?.labelKey === 'tokenResponse.skip';
    });
    return typeof skipOption?.id === 'string' ? skipOption.id : null;
}

async function skipOpenSimpleChoiceIfAvailable(page: any): Promise<boolean> {
    const state = await readHarnessState(page);
    const interaction = state?.sys?.interaction?.current ?? null;
    const optionId = getSimpleChoiceSkipOptionId(interaction);
    if (!optionId) {
        return false;
    }

    const playerId = typeof interaction?.playerId === 'string' ? interaction.playerId : null;
    const interactionId = typeof interaction?.id === 'string' ? interaction.id : null;
    if (!playerId || !interactionId) {
        throw new Error(`simple-choice 缺少决策玩家或交互 ID，不能跳过：${JSON.stringify(interaction)}`);
    }

    await dispatchDiceThroneCommand(page, {
        type: 'SYS_INTERACTION_RESPOND',
        playerId,
        payload: { interactionId, optionId },
    });
    await page.waitForTimeout(300);
    return true;
}

async function clickResolveAttackIfAvailable(page: any): Promise<boolean> {
    const resolveAttackButton = page.getByRole('button', { name: /^(Resolve Attack|结算攻击)$/i }).first();
    if (
        await resolveAttackButton.isVisible({ timeout: 500 }).catch(() => false)
        && await resolveAttackButton.isEnabled({ timeout: 500 }).catch(() => false)
    ) {
        await resolveAttackButton.click({ timeout: 2000 });
        await page.waitForTimeout(300);
        return true;
    }
    return false;
}

async function resolveTreantDefenseIfNeeded(
    page: any,
    options: {
        defenseRollDiceValues?: number[];
        rootedBonusDiceValues?: number[];
    } = {},
): Promise<void> {
    const defenseRollDiceValues = options.defenseRollDiceValues ?? [1, 1, 1];
    const rootedBonusDiceValues = options.rootedBonusDiceValues ?? [4, 5, 4];
    let defenseState: any = null;
    for (let attempt = 0; attempt < 20; attempt += 1) {
        const state = await readHarnessState(page);
        const pendingAttack = state?.core?.pendingAttack ?? null;
        const phase = state?.sys?.phase ?? null;
        if (!pendingAttack) {
            return;
        }
        if (state?.sys?.responseWindow?.current) {
            await drainOpenResponseWindows(page);
            continue;
        }
        if (await skipOpenSimpleChoiceIfAvailable(page)) {
            continue;
        }
        if (phase === 'offensiveRoll' && pendingAttack.defenderId === '1' && pendingAttack.isDefendable !== false) {
            if (await clickResolveAttackIfAvailable(page)) {
                continue;
            }
            await clickAdvancePhase(page, pendingAttack.attackerId ?? '0');
            await page.waitForTimeout(250);
            continue;
        }
        if (phase === 'defensiveRoll' && pendingAttack.defenderId === '1') {
            defenseState = state;
            break;
        }
        await page.waitForTimeout(250);
    }

    if (!defenseState) {
        throw new Error(
            `攻击已进入可防御链路，但 direct 场景未进入树精 defensiveRoll: ` +
            `${JSON.stringify(await readDefenseDebugState(page))}`,
        );
    }

    await alignDirectPageToDefenderControl(page);
    await dismissAttackShowcaseIfVisible(page);
    await page.waitForFunction(
        () => Boolean(window.__BG_TEST_HARNESS__?.random && window.__BG_TEST_HARNESS__?.dice),
        { timeout: 5000 },
    );
    await page.evaluate((values: number[]) => {
        window.__BG_TEST_HARNESS__?.dice.setValues(values);
    }, defenseRollDiceValues);

    await dispatchHarnessCommand(page, 'ROLL_DICE', '1');
    await dispatchHarnessCommand(page, 'CONFIRM_ROLL', '1');
    await page.evaluate((values: number[]) => {
        window.__BG_TEST_HARNESS__?.dice.setValues(values);
    }, rootedBonusDiceValues);
    await clickAdvancePhase(page, '1');

    const rootedChoiceTitle = page.getByText('扎根：选择额外效果').first();
    if (await rootedChoiceTitle.isVisible({ timeout: 1500 }).catch(() => false)) {
        const modalRoot = page.locator('#modal-root');
        const cultivateButton = modalRoot.getByRole('button', { name: /养成后：幼种 1/i }).first();
        const anyChoiceButton = modalRoot.getByRole('button').filter({ hasText: /\S+/ }).first();
        if (await cultivateButton.isVisible({ timeout: 1000 }).catch(() => false)) {
            await cultivateButton.click();
        } else {
            await anyChoiceButton.click();
        }
        await expect(rootedChoiceTitle).toBeHidden({ timeout: 10000 });
    }

    for (let round = 0; round < 6; round += 1) {
        const state = await readHarnessState(page);
        if (!state?.core?.pendingAttack && !state?.core?.pendingDamage) {
            return;
        }
        const pendingDamageResponderId = state?.core?.pendingDamage?.responderId;
        if (typeof pendingDamageResponderId === 'string' && pendingDamageResponderId.length > 0) {
            if (pendingDamageResponderId === '0') {
                await alignDirectPageToAttackerControl(page);
            }
            await dispatchDiceThroneCommand(page, {
                type: 'SKIP_TOKEN_RESPONSE',
                playerId: pendingDamageResponderId,
                payload: {},
            });
            await page.waitForTimeout(250);
            continue;
        }
        const passed = await maybePassResponse(page);
        if (passed) {
            continue;
        }
        if (state?.sys?.phase === 'defensiveRoll' && state?.core?.pendingAttack?.defenderId === '1') {
            await clickAdvancePhase(page, '1');
            continue;
        }
        await page.waitForTimeout(250);
    }

    throw new Error(
        `树精防御未在预期轮次内收口: ` +
        `${JSON.stringify({
            debug: await readDefenseDebugState(page),
            harnessStatus: await readHarnessStatus(page),
        })}`,
    );
}

async function clickAbilitySlot(page: any, slotId: string): Promise<void> {
    const slot = page.locator(`[data-testid="player-board-surface"] [data-ability-slot="${slotId}"]`).first();
    await expect(slot).toHaveAttribute('data-can-click', 'true', { timeout: 10000 });

    const clickPoint = await page.evaluate((targetSlotId: string) => {
        const element = document.querySelector(
            `[data-testid="player-board-surface"] [data-ability-slot="${targetSlotId}"]`,
        ) as HTMLElement | null;
        if (!element) return null;

        const rect = element.getBoundingClientRect();
        const xFractions = [0.18, 0.5, 0.82];
        const yFractions = [0.12, 0.28, 0.5, 0.72, 0.88];

        for (const yFraction of yFractions) {
            for (const xFraction of xFractions) {
                const x = rect.left + rect.width * xFraction;
                const y = rect.top + rect.height * yFraction;
                const topElement = document.elementFromPoint(x, y);
                const hitSlot = topElement?.closest?.('[data-ability-slot]');
                if (hitSlot === element) {
                    return { x, y };
                }
            }
        }

        return null;
    }, slotId);

    expect(clickPoint, `${slotId} 槽位必须存在真实可点击点`).not.toBeNull();
    await page.mouse.click(clickPoint!.x, clickPoint!.y);
}

async function clickResolvedAbilitySlot(
    page: any,
    slotId: string,
    expectedAbilityId: string,
): Promise<void> {
    const slot = page.locator(`[data-testid="player-board-surface"] [data-ability-slot="${slotId}"]`).first();
    await expect(slot).toHaveAttribute('data-resolved-ability-id', expectedAbilityId, { timeout: 10000 });
    await clickAbilitySlot(page, slotId);
}

async function setupNinjaDirectCloseoutScene(
    page: any,
    game: any,
    options: {
        abilityId: 'slash' | 'shadow-fang';
        upgradeCardId: string;
        abilityDef: unknown;
        attackDiceValues: number[];
    },
): Promise<void> {
    const preparedDice = createNinjaDiceWithValues(options.attackDiceValues);

    await game.openTestGame('dicethrone');
    await game.setupScene({
        gameId: 'dicethrone',
        player0: {
            resources: { CP: 3, HP: 30 },
            tokens: { smoke_bomb: 0, ninjutsu: 0 },
        },
        player1: {
            resources: { HP: 30 },
            tokens: { delayed_poison: 0, sneak: 0 },
        },
        currentPlayer: '0',
        phase: 'offensiveRoll',
        extra: {
            selectedCharacters: { '0': 'ninja', '1': 'treant' },
            hostStarted: true,
            activePlayerId: '0',
            currentPlayer: '0',
            currentPlayerIndex: 0,
            rollCount: 1,
            rollLimit: 3,
            rollConfirmed: true,
            dice: preparedDice,
            pendingAttack: null,
            pendingDamage: null,
            pendingBonusDiceSettlement: undefined,
            activatingAbilityId: undefined,
        },
    });

    await page.evaluate(
        ({ abilityId, abilityDef, upgradeCardId, preparedDice, smokeBombTokenId, ninjutsuTokenId, delayedPoisonTokenId, hpKey, cpKey }) => {
            const harness = window.__BG_TEST_HARNESS__;
            const current = harness?.state?.get?.();
            if (!current || !harness?.state?.set) {
                throw new Error('TestHarness state 不可用');
            }

            const players = { ...(current.core?.players ?? {}) };
            const ninja = { ...(players['0'] ?? {}) };
            const treant = { ...(players['1'] ?? {}) };
            players['0'] = {
                ...ninja,
                abilities: Array.isArray(ninja.abilities)
                    ? ninja.abilities.map((ability: any) => (ability?.id === abilityId ? abilityDef : ability))
                    : ninja.abilities,
                abilityLevels: {
                    ...(ninja.abilityLevels ?? {}),
                    [abilityId]: 2,
                },
                upgradeCardByAbilityId: {
                    ...(ninja.upgradeCardByAbilityId ?? {}),
                    [abilityId]: { cardId: upgradeCardId, cpCost: 2 },
                },
                tokens: {
                    ...(ninja.tokens ?? {}),
                    [smokeBombTokenId]: 0,
                    [ninjutsuTokenId]: 0,
                },
                resources: {
                    ...(ninja.resources ?? {}),
                    [hpKey]: 30,
                    [cpKey]: 3,
                },
            };
            players['1'] = {
                ...treant,
                tokens: {
                    ...(treant.tokens ?? {}),
                    [delayedPoisonTokenId]: 0,
                    sneak: 0,
                },
                resources: {
                    ...(treant.resources ?? {}),
                    [hpKey]: 30,
                },
            };

            return harness.state.set({
                ...current,
                core: {
                    ...current.core,
                    players,
                    activePlayerId: '0',
                    rollCount: 1,
                    rollLimit: 3,
                    rollConfirmed: true,
                    dice: preparedDice,
                    pendingAttack: null,
                    pendingDamage: null,
                    pendingBonusDiceSettlement: undefined,
                    activatingAbilityId: undefined,
                },
                sys: {
                    ...(current.sys ?? {}),
                    phase: 'offensiveRoll',
                    interaction: {
                        ...((current.sys?.interaction ?? {}) as Record<string, unknown>),
                        current: undefined,
                    },
                    responseWindow: {
                        ...((current.sys?.responseWindow ?? {}) as Record<string, unknown>),
                        current: undefined,
                    },
                },
            });
        },
        {
            abilityId: options.abilityId,
            abilityDef: options.abilityDef,
            upgradeCardId: options.upgradeCardId,
            preparedDice,
            smokeBombTokenId: TOKEN_IDS.SMOKE_BOMB,
            ninjutsuTokenId: TOKEN_IDS.NINJUTSU,
            delayedPoisonTokenId: TOKEN_IDS.DELAYED_POISON,
            hpKey: RESOURCE_IDS.HP,
            cpKey: RESOURCE_IDS.CP,
        },
    );

    await expect(page.getByTestId('player-board-surface')).toHaveAttribute('data-character-id', 'ninja', { timeout: 10000 });
}

test.describe('DiceThrone Ninja 技能对象级真实收口', () => {
    test('斩击 II 应从真实槽位收口到 4 点伤害 + 1 忍术', async ({ page, game }, testInfo) => {
        await setupNinjaDirectCloseoutScene(page, game, {
            abilityId: 'slash',
            upgradeCardId: 'upgrade-slash-2',
            abilityDef: SLASH_2,
            attackDiceValues: [1, 1, 1, 4, 5],
        });

        await game.screenshot('ninja-slash-2-before-click', testInfo);
        await clickResolvedAbilitySlot(page, 'fist', 'slash-2-3');
        await dismissAttackShowcaseIfVisible(page);
        await clickAdvancePhase(page, '0');
        await resolveTreantDefenseIfNeeded(page);

        try {
            await expect.poll(async () => {
                const state = await game.getState();
                return {
                    player0Character: state?.core?.players?.['0']?.characterId ?? null,
                    player1Character: state?.core?.players?.['1']?.characterId ?? null,
                    hp0: state?.core?.players?.['0']?.resources?.hp ?? null,
                    hp1: state?.core?.players?.['1']?.resources?.hp ?? null,
                    sourceAbilityId: state?.core?.pendingAttack?.sourceAbilityId ?? null,
                    pendingAttack: state?.core?.pendingAttack ?? null,
                    pendingDamage: state?.core?.pendingDamage ?? null,
                    defenderHp: state?.core?.players?.['1']?.resources?.hp ?? null,
                    ninjutsu: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.NINJUTSU] ?? 0,
                };
            }, { timeout: 10000 }).toEqual({
                player0Character: 'ninja',
                player1Character: 'treant',
                hp0: 30,
                hp1: 26,
                sourceAbilityId: null,
                pendingAttack: null,
                pendingDamage: null,
                defenderHp: 26,
                ninjutsu: 1,
            });
        } catch (error) {
            const debugState = await readDefenseDebugState(page);
            const recentCombatEvents = await readRecentCombatEvents(page);
            throw new Error(
                `斩击 II direct closeout 未达到期望。\n` +
                `debugState=${JSON.stringify(debugState)}\n` +
                `recentCombatEvents=${JSON.stringify(recentCombatEvents)}\n` +
                `originalError=${error instanceof Error ? error.message : String(error)}`,
            );
        }
        await game.screenshot('ninja-slash-2-after-closeout', testInfo);
    });

    test('影牙 II 主分支应从真实槽位收口到 8 点伤害 + 1 烟雾弹 + 2 忍术', async ({ page, game }, testInfo) => {
        await setupNinjaDirectCloseoutScene(page, game, {
            abilityId: 'shadow-fang',
            upgradeCardId: 'upgrade-shadow-fang-2',
            abilityDef: SHADOW_FANG_2,
            attackDiceValues: [1, 2, 3, 4, 5],
        });

        await game.screenshot('ninja-shadow-fang-2-main-before-click', testInfo);
        await clickResolvedAbilitySlot(page, 'calm', 'shadow-fang-2-main');
        await dismissAttackShowcaseIfVisible(page);
        await clickAdvancePhase(page, '0');
        await resolveTreantDefenseIfNeeded(page);

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                sourceAbilityId: state?.core?.pendingAttack?.sourceAbilityId ?? null,
                pendingAttack: state?.core?.pendingAttack ?? null,
                pendingDamage: state?.core?.pendingDamage ?? null,
                defenderHp: state?.core?.players?.['1']?.resources?.hp ?? null,
                smokeBomb: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.SMOKE_BOMB] ?? 0,
                ninjutsu: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.NINJUTSU] ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            sourceAbilityId: null,
            pendingAttack: null,
            pendingDamage: null,
            defenderHp: 22,
            smokeBomb: 1,
            ninjutsu: 2,
        });
        await game.screenshot('ninja-shadow-fang-2-main-after-closeout', testInfo);
    });

    test('影牙 II 的诳惑分支应从真实槽位收口到 2 点不可防御伤害 + 1 烟雾弹', async ({ page, game }, testInfo) => {
        await setupNinjaDirectCloseoutScene(page, game, {
            abilityId: 'shadow-fang',
            upgradeCardId: 'upgrade-shadow-fang-2',
            abilityDef: SHADOW_FANG_2,
            attackDiceValues: [1, 1, 4, 6, 6],
        });

        await game.screenshot('ninja-shadow-fang-2-deceive-before-click', testInfo);
        await clickResolvedAbilitySlot(page, 'calm', 'shadow-fang-2-deceive');
        await dismissAttackShowcaseIfVisible(page);
        await clickAdvancePhase(page, '0');
        await resolveTreantDefenseIfNeeded(page);

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                sourceAbilityId: state?.core?.pendingAttack?.sourceAbilityId ?? null,
                pendingAttack: state?.core?.pendingAttack ?? null,
                pendingDamage: state?.core?.pendingDamage ?? null,
                defenderHp: state?.core?.players?.['1']?.resources?.hp ?? null,
                smokeBomb: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.SMOKE_BOMB] ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            sourceAbilityId: null,
            pendingAttack: null,
            pendingDamage: null,
            defenderHp: 28,
            smokeBomb: 1,
        });
        await game.screenshot('ninja-shadow-fang-2-deceive-after-closeout', testInfo);
    });
});
