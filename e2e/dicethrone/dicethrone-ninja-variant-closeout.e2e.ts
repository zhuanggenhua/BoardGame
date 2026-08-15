import { test, expect } from '../framework';
import { createCharacterDice } from '../../src/games/dicethrone/domain/characters';
import { getHeroDieFace } from '../../src/games/dicethrone/domain/rules';
import type { Die } from '../../src/games/dicethrone/domain/types';
import { RESOURCE_IDS } from '../../src/games/dicethrone/domain/resources';
import { TOKEN_IDS } from '../../src/games/dicethrone/domain/ids';
import { SHADOW_STEP_2, SMOKE_SCREEN_2 } from '../../src/games/dicethrone/heroes/ninja/abilities';
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
    await page.evaluate(({ commandType, commandPlayerId, commandPayload }) => {
        window.__BG_TEST_HARNESS__?.command.dispatch({
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

async function readHarnessDebugState(page: any): Promise<any> {
    return await page.evaluate(() => {
        const state = window.__BG_TEST_HARNESS__?.state?.get?.();
        return {
            phase: state?.sys?.phase ?? null,
            pendingAttack: state?.core?.pendingAttack ?? null,
            pendingDamage: state?.core?.pendingDamage ?? null,
            interaction: state?.sys?.interaction?.current ?? null,
            responseWindow: state?.sys?.responseWindow?.current ?? null,
        };
    });
}

async function maybePassResponse(page: any): Promise<boolean> {
    const passButton = page.getByTestId('dicethrone-response-pass-button')
        .or(page.getByRole('button', { name: /^(Pass|跳过|让过)$/i }))
        .first();
    if (await passButton.isVisible({ timeout: 700 }).catch(() => false)) {
        await passButton.click();
        await page.waitForTimeout(300);
        return true;
    }
    return false;
}

async function settlePendingAttackCloseout(page: any, playerId: string): Promise<void> {
    for (let round = 0; round < 8; round += 1) {
        const state = await page.evaluate(() => window.__BG_TEST_HARNESS__?.state?.get?.());
        const pendingAttack = state?.core?.pendingAttack ?? null;
        const pendingDamage = state?.core?.pendingDamage ?? null;
        if (!pendingAttack && !pendingDamage) {
            return;
        }

        if (await maybePassResponse(page)) {
            continue;
        }

        const pendingDamageResponderId = pendingDamage?.responderId;
        if (typeof pendingDamageResponderId === 'string' && pendingDamageResponderId.length > 0) {
            await dispatchHarnessCommand(page, 'SKIP_TOKEN_RESPONSE', pendingDamageResponderId);
            await page.waitForTimeout(300);
            continue;
        }

        const resolveAttackButton = page.getByRole('button', { name: /^(Resolve Attack|结算攻击)$/i }).first();
        if (
            await resolveAttackButton.isVisible({ timeout: 700 }).catch(() => false)
            && await resolveAttackButton.isEnabled({ timeout: 500 }).catch(() => false)
        ) {
            await resolveAttackButton.click({ timeout: 2000 });
            await page.waitForTimeout(300);
            continue;
        }

        await clickAdvancePhase(page, playerId);
        await page.waitForTimeout(300);
    }

    throw new Error(`攻击收口超过最大轮次仍未完成：${JSON.stringify(await readHarnessDebugState(page))}`);
}

async function chooseVariantByLabelIfVisible(page: any, label: RegExp): Promise<void> {
    const variantModal = page.getByRole('heading', { name: '选择发动变体' }).first();
    if (!await variantModal.isVisible({ timeout: 1200 }).catch(() => false)) {
        return;
    }
    const optionButton = page.getByRole('button', { name: label }).first();
    await expect(optionButton).toBeVisible({ timeout: 5000 });
    await optionButton.click();
}

async function chooseFirstSimpleChoiceIfVisible(page: any, title: RegExp, buttonLabel: RegExp): Promise<void> {
    const modalTitle = page.locator('#modal-root').getByText(title).first();
    if (!await modalTitle.isVisible({ timeout: 1200 }).catch(() => false)) {
        return;
    }
    const optionButton = page.locator('#modal-root').getByRole('button', { name: buttonLabel }).first();
    await expect(optionButton).toBeVisible({ timeout: 5000 });
    await optionButton.click();
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

async function setupNinjaVariantScene(
    page: any,
    game: any,
    options: {
        abilityId: 'shadow-step' | 'smoke-screen';
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

test.describe('DiceThrone Ninja 分支技能真实收口', () => {
    test('暗影步 II 主分支应从真实槽位进入变体选择，并按 5 点不可防御伤害 + 2 慢性中毒收口', async ({ page, game }, testInfo) => {
        await setupNinjaVariantScene(page, game, {
            abilityId: 'shadow-step',
            upgradeCardId: 'upgrade-shadow-step-2',
            abilityDef: SHADOW_STEP_2,
            attackDiceValues: [6, 6, 6, 6, 1],
        });

        await game.screenshot('ninja-shadow-step-2-main-before-click', testInfo);
        await clickAbilitySlot(page, 'lightning');
        await game.screenshot('ninja-shadow-step-2-main-variant-choice', testInfo);
        await chooseVariantByLabelIfVisible(page, /暗影步 II（4个面具）/i);
        await dismissAttackShowcaseIfVisible(page);
        await clickAdvancePhase(page, '0');
        await settlePendingAttackCloseout(page, '0');

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                sourceAbilityId: state?.core?.pendingAttack?.sourceAbilityId ?? null,
                pendingAttack: state?.core?.pendingAttack ?? null,
                pendingDamage: state?.core?.pendingDamage ?? null,
                defenderHp: state?.core?.players?.['1']?.resources?.hp ?? null,
                delayedPoison: state?.core?.players?.['1']?.tokens?.[TOKEN_IDS.DELAYED_POISON] ?? 0,
                smokeBomb: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.SMOKE_BOMB] ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            sourceAbilityId: null,
            pendingAttack: null,
            pendingDamage: null,
            defenderHp: 25,
            delayedPoison: 2,
            smokeBomb: 1,
        });
        await game.screenshot('ninja-shadow-step-2-main-after-closeout', testInfo);
    });

    test('暗影步 II 的勒杀分支应从真实槽位进入变体选择，并在不造成攻击伤害的前提下收口', async ({ page, game }, testInfo) => {
        await setupNinjaVariantScene(page, game, {
            abilityId: 'shadow-step',
            upgradeCardId: 'upgrade-shadow-step-2',
            abilityDef: SHADOW_STEP_2,
            attackDiceValues: [6, 6, 6, 6, 1],
        });

        await game.screenshot('ninja-shadow-step-2-strangle-before-click', testInfo);
        await clickAbilitySlot(page, 'lightning');
        await game.screenshot('ninja-shadow-step-2-strangle-variant-choice', testInfo);
        await chooseVariantByLabelIfVisible(page, /勒杀|暗影步 II（3个面具）/i);
        await dismissAttackShowcaseIfVisible(page);
        await clickAdvancePhase(page, '0');
        await settlePendingAttackCloseout(page, '0');

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                sourceAbilityId: state?.core?.pendingAttack?.sourceAbilityId ?? null,
                pendingAttack: state?.core?.pendingAttack ?? null,
                pendingDamage: state?.core?.pendingDamage ?? null,
                defenderHp: state?.core?.players?.['1']?.resources?.hp ?? null,
                delayedPoison: state?.core?.players?.['1']?.tokens?.[TOKEN_IDS.DELAYED_POISON] ?? 0,
                smokeBomb: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.SMOKE_BOMB] ?? 0,
                ninjutsu: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.NINJUTSU] ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            sourceAbilityId: null,
            pendingAttack: null,
            pendingDamage: null,
            defenderHp: 30,
            delayedPoison: 2,
            smokeBomb: 0,
            ninjutsu: 3,
        });
        await game.screenshot('ninja-shadow-step-2-strangle-after-closeout', testInfo);
    });

    test('烟雾阵 II 主分支应从真实槽位收口到 1 烟雾弹 + 3 忍术 + 1 慢性中毒', async ({ page, game }, testInfo) => {
        await setupNinjaVariantScene(page, game, {
            abilityId: 'smoke-screen',
            upgradeCardId: 'upgrade-smoke-screen-2',
            abilityDef: SMOKE_SCREEN_2,
            attackDiceValues: [1, 4, 5, 6, 1],
        });

        await game.screenshot('ninja-smoke-screen-2-main-before-click', testInfo);
        await clickAbilitySlot(page, 'lotus');
        await dismissAttackShowcaseIfVisible(page);
        await clickAdvancePhase(page, '0');
        await chooseFirstSimpleChoiceIfVisible(page, /选择烟雾阵 II 的目标/i, /1号玩家|P1|2号玩家|P2/i);
        await settlePendingAttackCloseout(page, '0');

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                sourceAbilityId: state?.core?.pendingAttack?.sourceAbilityId ?? null,
                pendingAttack: state?.core?.pendingAttack ?? null,
                pendingDamage: state?.core?.pendingDamage ?? null,
                defenderHp: state?.core?.players?.['1']?.resources?.hp ?? null,
                delayedPoison: state?.core?.players?.['1']?.tokens?.[TOKEN_IDS.DELAYED_POISON] ?? 0,
                smokeBomb: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.SMOKE_BOMB] ?? 0,
                ninjutsu: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.NINJUTSU] ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            sourceAbilityId: null,
            pendingAttack: null,
            pendingDamage: null,
            defenderHp: 30,
            delayedPoison: 1,
            smokeBomb: 1,
            ninjutsu: 3,
        });
        await game.screenshot('ninja-smoke-screen-2-main-after-closeout', testInfo);
    });

    test('烟雾阵 II 的九字切分支应从真实槽位收口到同一名对手两次 4 点真实伤害', async ({ page, game }, testInfo) => {
        await setupNinjaVariantScene(page, game, {
            abilityId: 'smoke-screen',
            upgradeCardId: 'upgrade-smoke-screen-2',
            abilityDef: SMOKE_SCREEN_2,
            attackDiceValues: [4, 4, 4, 6, 6],
        });

        await game.screenshot('ninja-smoke-screen-2-kuji-kiri-before-click', testInfo);
        await clickAbilitySlot(page, 'lotus');
        await dismissAttackShowcaseIfVisible(page);
        await clickAdvancePhase(page, '0');
        await chooseFirstSimpleChoiceIfVisible(page, /选择九字切的目标/i, /两次 4 点真实伤害|2号玩家|P2/i);
        await settlePendingAttackCloseout(page, '0');

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                sourceAbilityId: state?.core?.pendingAttack?.sourceAbilityId ?? null,
                pendingAttack: state?.core?.pendingAttack ?? null,
                pendingDamage: state?.core?.pendingDamage ?? null,
                defenderHp: state?.core?.players?.['1']?.resources?.hp ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            sourceAbilityId: null,
            pendingAttack: null,
            pendingDamage: null,
            defenderHp: 22,
        });
        await game.screenshot('ninja-smoke-screen-2-kuji-kiri-after-closeout', testInfo);
    });
});
