import { test, expect } from '../framework';
import { createCharacterDice } from '../../src/games/dicethrone/domain/characters';
import { getHeroDieFace } from '../../src/games/dicethrone/domain/rules';
import type { Die } from '../../src/games/dicethrone/domain/types';
import { DEATH_BLOSSOM_2, GOING_FORWARD_2 } from '../../src/games/dicethrone/heroes/ninja/abilities';
import { TOKEN_IDS } from '../../src/games/dicethrone/domain/ids';
import {
    expectRightTrayBonusDiceConfirmation,
    getRightTrayDie,
    settleCurrentBonusDice,
    waitForDiceThroneVisualIdle,
} from './bonus-dice-flow';
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

async function chooseVariantByLabel(page: any, label: RegExp): Promise<void> {
    const variantModal = page.locator('role=heading[name="选择发动变体"]').first();
    await expect(variantModal).toBeVisible({ timeout: 5000 });
    const optionButton = page.getByRole('button', { name: label }).first();
    await expect(optionButton).toBeVisible({ timeout: 5000 });
    await optionButton.click();
}

async function clickResolvedAbilitySlot(
    page: any,
    slotId: string,
    expectedAbilityId: string,
): Promise<void> {
    const slot = page.locator(`[data-testid="player-board-surface"] [data-ability-slot="${slotId}"]`).first();
    await expect(slot).toHaveAttribute('data-resolved-ability-id', expectedAbilityId, { timeout: 10000 });
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

async function clearIncidentalHandHover(page: any): Promise<void> {
    await page.mouse.move(8, 8);
    await expect.poll(async () => (
        page.locator('[data-testid="hand-area"] [data-card-id]:hover').count()
    ), { timeout: 5000 }).toBe(0);
    await expect.poll(async () => (
        page.locator('[data-testid="hand-area"] [data-testid="hand-card-visual"]').evaluateAll((nodes: Element[]) => {
            return nodes.every((node) => {
                const transform = window.getComputedStyle(node).transform;
                if (!transform || transform === 'none') return true;
                const matrix = new DOMMatrixReadOnly(transform);
                const scale = Math.hypot(matrix.a, matrix.b);
                return scale <= 1.05;
            });
        })
    ), { timeout: 5000 }).toBe(true);
}

async function expectNinjaDeathBlossomReadyVisualAnchor(page: any): Promise<void> {
    const deathBlossomSlot = page.locator('[data-testid="player-board-surface"] [data-ability-slot="sky"]').first();
    await expect(deathBlossomSlot).toHaveAttribute('data-resolved-ability-id', 'death-blossom', { timeout: 10000 });
    await expect(deathBlossomSlot.locator('[data-testid="dt-ability-highlight-sky"], [data-testid="dt-ability-selected-sky"]').first()).toBeVisible({ timeout: 5000 });

    const smokeScreenSlot = page.locator('[data-testid="player-board-surface"] [data-ability-slot="lotus"]').first();
    await expect(smokeScreenSlot).toHaveAttribute('data-base-ability-id', 'smoke-screen', { timeout: 10000 });
    await expect(smokeScreenSlot.locator('[data-testid="dt-ability-highlight-lotus"], [data-testid="dt-ability-selected-lotus"]')).toHaveCount(0);
}

async function expectNinjaDeathBlossomSourceSlotStillMapped(page: any): Promise<void> {
    const deathBlossomSlot = page.locator('[data-testid="player-board-surface"] [data-ability-slot="sky"]').first();
    await expect(deathBlossomSlot).toHaveAttribute('data-base-ability-id', 'death-blossom', { timeout: 10000 });
    await expect(deathBlossomSlot).toHaveAttribute('data-selected-ability-id', 'death-blossom', { timeout: 10000 });
    await expect(deathBlossomSlot).toHaveAttribute('data-is-selected', 'true', { timeout: 10000 });
    await expect(deathBlossomSlot).toHaveAttribute('data-available-ability-id', '', { timeout: 10000 });
    await expect(deathBlossomSlot.locator('[data-testid="dt-ability-selected-sky"]')).toBeVisible({ timeout: 5000 });

    const smokeScreenSlot = page.locator('[data-testid="player-board-surface"] [data-ability-slot="lotus"]').first();
    await expect(smokeScreenSlot).toHaveAttribute('data-base-ability-id', 'smoke-screen', { timeout: 10000 });
    await expect(smokeScreenSlot).toHaveAttribute('data-selected-ability-id', '', { timeout: 10000 });
    await expect(smokeScreenSlot).toHaveAttribute('data-is-selected', 'false', { timeout: 10000 });
    await expect(smokeScreenSlot).toHaveAttribute('data-available-ability-id', '', { timeout: 10000 });
    await expect(smokeScreenSlot.locator('[data-testid="dt-ability-highlight-lotus"], [data-testid="dt-ability-selected-lotus"]')).toHaveCount(0);
}

async function expectNinjaDeathBlossomSourceSlotClearedAfterCloseout(page: any): Promise<void> {
    const deathBlossomSlot = page.locator('[data-testid="player-board-surface"] [data-ability-slot="sky"]').first();
    await expect(deathBlossomSlot).toHaveAttribute('data-base-ability-id', 'death-blossom', { timeout: 10000 });
    await expect(deathBlossomSlot).toHaveAttribute('data-selected-ability-id', '', { timeout: 10000 });
    await expect(deathBlossomSlot).toHaveAttribute('data-is-selected', 'false', { timeout: 10000 });
    await expect(deathBlossomSlot.locator('[data-testid="dt-ability-selected-sky"]')).toHaveCount(0);

    const smokeScreenSlot = page.locator('[data-testid="player-board-surface"] [data-ability-slot="lotus"]').first();
    await expect(smokeScreenSlot).toHaveAttribute('data-base-ability-id', 'smoke-screen', { timeout: 10000 });
    await expect(smokeScreenSlot).toHaveAttribute('data-selected-ability-id', '', { timeout: 10000 });
    await expect(smokeScreenSlot).toHaveAttribute('data-is-selected', 'false', { timeout: 10000 });
    await expect(smokeScreenSlot.locator('[data-testid="dt-ability-highlight-lotus"], [data-testid="dt-ability-selected-lotus"]')).toHaveCount(0);
}

async function setupNinjaBonusRerollScene(
    page: any,
    game: any,
    options: {
        abilityId: 'going-forward' | 'death-blossom';
        upgradeCardId: string;
        abilityDef: unknown;
        attackDiceValues: number[];
        randomValues: number[];
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
        ({ abilityId, abilityDef, upgradeCardId, randomValues, preparedDice, smokeBombTokenId, ninjutsuTokenId, delayedPoisonTokenId }) => {
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
            };
            players['1'] = {
                ...treant,
                tokens: {
                    ...(treant.tokens ?? {}),
                    [delayedPoisonTokenId]: 0,
                    sneak: 0,
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
                    tutorial: {
                        ...((current.sys?.tutorial ?? {}) as Record<string, unknown>),
                        active: true,
                        randomPolicy: { mode: 'sequence', values: randomValues, cursor: 0 },
                    },
                },
            });
        },
        {
            abilityId: options.abilityId,
            abilityDef: options.abilityDef,
            upgradeCardId: options.upgradeCardId,
            randomValues: options.randomValues,
            preparedDice,
            smokeBombTokenId: TOKEN_IDS.SMOKE_BOMB,
            ninjutsuTokenId: TOKEN_IDS.NINJUTSU,
            delayedPoisonTokenId: TOKEN_IDS.DELAYED_POISON,
        },
    );

    await expect(page.getByTestId('player-board-surface')).toHaveAttribute('data-character-id', 'ninja', { timeout: 10000 });
    await expect.poll(async () => {
        const state = await game.getState();
        return {
            phase: state?.sys?.phase ?? null,
            currentPlayer: state?.core?.activePlayerId ?? null,
            abilityLevel: state?.core?.players?.['0']?.abilityLevels?.[options.abilityId] ?? null,
        };
    }, { timeout: 10000 }).toEqual({
        phase: 'offensiveRoll',
        currentPlayer: '0',
        abilityLevel: 2,
    });
}

test.describe('DiceThrone Ninja 奖励骰重投', () => {
    test('一往无前 II 主分支应从真实槽位进入奖励骰界面，并在 1 次重投后达到上限', async ({ page, game }, testInfo) => {
        await setupNinjaBonusRerollScene(page, game, {
            abilityId: 'going-forward',
            upgradeCardId: 'upgrade-going-forward-2',
            abilityDef: GOING_FORWARD_2,
            attackDiceValues: [4, 4, 5, 5, 6],
            randomValues: [2, 3, 1],
        });

        await game.screenshot('ninja-going-forward-2-main-before-click', testInfo);
        await clickResolvedAbilitySlot(page, 'chi', 'going-forward-2-main');
        await game.screenshot('ninja-going-forward-2-main-variant-choice', testInfo);
        await chooseVariantByLabel(page, /一往无前 II（4个手里剑）/i);

        await expect.poll(async () => {
            const state = await game.getState();
            return state?.core?.pendingAttack?.sourceAbilityId ?? null;
        }, { timeout: 10000 }).toBe('going-forward-2-main');
        await game.screenshot('ninja-going-forward-2-main-selected', testInfo);

        await dismissAttackShowcaseIfVisible(page);
        await clickAdvancePhase(page, '0');

        await expectRightTrayBonusDiceConfirmation(page, () => game.getState(), { sourceAbilityId: 'going-forward-2-main' });
        await expect.poll(async () => {
            const state = await game.getState();
            const settlement = state?.core?.pendingBonusDiceSettlement;
            return {
                sourceAbilityId: settlement?.sourceAbilityId ?? null,
                rerollCount: settlement?.rerollCount ?? null,
                maxRerollCount: settlement?.maxRerollCount ?? null,
                diceValues: settlement?.dice?.map((die: any) => die?.value ?? null) ?? [],
            };
        }, { timeout: 5000 }).toEqual({
            sourceAbilityId: 'going-forward-2-main',
            rerollCount: 0,
            maxRerollCount: 1,
            diceValues: [2, 3],
        });
        await game.screenshot('ninja-going-forward-2-main-right-tray', testInfo);

        await page.evaluate(() => {
            window.__BG_TEST_HARNESS__?.dice.setValues([1]);
        });
        const rerollOption0 = getRightTrayDie(page, 0);
        await expect(rerollOption0).toBeVisible({ timeout: 5000 });
        await rerollOption0.click({ force: true });

        await expect.poll(async () => {
            const state = await game.getState();
            const settlement = state?.core?.pendingBonusDiceSettlement;
            return {
                rerollCount: settlement?.rerollCount ?? null,
                maxRerollCount: settlement?.maxRerollCount ?? null,
                diceValues: settlement?.dice?.map((die: any) => die?.value ?? null) ?? [],
            };
        }, { timeout: 5000 }).toEqual({
            rerollCount: 1,
            maxRerollCount: 1,
            diceValues: [1, 3],
        });
        await expect(getRightTrayDie(page, 0)).toHaveAttribute('data-clickable', 'false', { timeout: 5000 });
        await expect(getRightTrayDie(page, 1)).toHaveAttribute('data-clickable', 'false', { timeout: 5000 });
        await game.screenshot('ninja-going-forward-2-main-limit-reached', testInfo);

        await settleCurrentBonusDice(page, () => game.getState(), { sourceAbilityId: 'going-forward-2-main' });
        await expect.poll(async () => {
            const state = await game.getState();
            return {
                settlement: state?.core?.pendingBonusDiceSettlement ?? null,
                pendingAttack: state?.core?.pendingAttack ?? null,
                pendingDamage: state?.core?.pendingDamage ?? null,
                defenderHp: state?.core?.players?.['1']?.resources?.hp ?? null,
            };
        }, { timeout: 5000 }).toEqual({
            settlement: null,
            pendingAttack: null,
            pendingDamage: null,
            defenderHp: 26,
        });
        await game.screenshot('ninja-going-forward-2-main-after-closeout', testInfo);
    });

    test('一往无前 II 的刀尖舔血分支应从真实槽位进入分支选择，并按单骰结果造成真实伤害后收口', async ({ page, game }, testInfo) => {
        await setupNinjaBonusRerollScene(page, game, {
            abilityId: 'going-forward',
            upgradeCardId: 'upgrade-going-forward-2',
            abilityDef: GOING_FORWARD_2,
            attackDiceValues: [4, 4, 4, 5, 6],
            randomValues: [4],
        });

        await game.screenshot('ninja-going-forward-2-bleed-before-click', testInfo);
        await clickResolvedAbilitySlot(page, 'chi', 'going-forward-2-main');
        await game.screenshot('ninja-going-forward-2-bleed-variant-choice', testInfo);
        await chooseVariantByLabel(page, /刀尖舔血|一往无前 II（3个手里剑）/i);

        await expect.poll(async () => {
            const state = await game.getState();
            return state?.core?.pendingAttack?.sourceAbilityId ?? null;
        }, { timeout: 10000 }).toBe('going-forward-2-bleed');
        await game.screenshot('ninja-going-forward-2-bleed-selected', testInfo);

        await dismissAttackShowcaseIfVisible(page);
        await clickAdvancePhase(page, '0');

        await expectRightTrayBonusDiceConfirmation(page, () => game.getState(), { sourceAbilityId: 'going-forward-2-bleed' });
        await expect.poll(async () => {
            const state = await game.getState();
            return {
                settlementOpen: Boolean(state?.core?.pendingBonusDiceSettlement),
                pendingAttackSource: state?.core?.pendingAttack?.sourceAbilityId ?? null,
                pendingAttackStage: state?.core?.pendingAttack?.settlementStage ?? null,
                pendingDamage: state?.core?.pendingDamage ?? null,
                defenderHp: state?.core?.players?.['1']?.resources?.hp ?? null,
            };
        }, { timeout: 5000 }).toEqual({
            settlementOpen: true,
            pendingAttackSource: 'going-forward-2-bleed',
            pendingAttackStage: 'preDamage',
            pendingDamage: null,
            defenderHp: 30,
        });
        await game.screenshot('ninja-going-forward-2-bleed-right-tray', testInfo);

        await settleCurrentBonusDice(page, () => game.getState(), { sourceAbilityId: 'going-forward-2-bleed' });
        await expect.poll(async () => {
            const state = await game.getState();
            return {
                settlement: state?.core?.pendingBonusDiceSettlement ?? null,
                pendingAttack: state?.core?.pendingAttack ?? null,
                pendingDamage: state?.core?.pendingDamage ?? null,
                defenderHp: state?.core?.players?.['1']?.resources?.hp ?? null,
            };
        }, { timeout: 5000 }).toEqual({
            settlement: null,
            pendingAttack: null,
            pendingDamage: null,
            defenderHp: 26,
        });
        await game.screenshot('ninja-going-forward-2-bleed-after-closeout', testInfo);
    });

    test('死亡盛放 II 应从真实槽位进入奖励骰界面，并在 2 次重投后达到上限', async ({ page, game }, testInfo) => {
        await setupNinjaBonusRerollScene(page, game, {
            abilityId: 'death-blossom',
            upgradeCardId: 'upgrade-death-blossom-2',
            abilityDef: DEATH_BLOSSOM_2,
            attackDiceValues: [1, 2, 3, 4, 5],
            randomValues: [1, 1, 1, 4, 4, 6, 6],
        });

        await clearIncidentalHandHover(page);
        await expectNinjaDeathBlossomReadyVisualAnchor(page);
        await game.screenshot('ninja-death-blossom-2-before-click', testInfo);
        await clickResolvedAbilitySlot(page, 'sky', 'death-blossom');
        await dismissAttackShowcaseIfVisible(page);
        await clickAdvancePhase(page, '0');

        await expectRightTrayBonusDiceConfirmation(page, () => game.getState(), { sourceAbilityId: 'death-blossom' });
        await expect.poll(async () => {
            const state = await game.getState();
            const settlement = state?.core?.pendingBonusDiceSettlement;
            return {
                sourceAbilityId: settlement?.sourceAbilityId ?? null,
                rerollCount: settlement?.rerollCount ?? null,
                maxRerollCount: settlement?.maxRerollCount ?? null,
                diceValues: settlement?.dice?.map((die: any) => die?.value ?? null) ?? [],
            };
        }, { timeout: 5000 }).toEqual({
            sourceAbilityId: 'death-blossom',
            rerollCount: 0,
            maxRerollCount: 2,
            diceValues: [1, 1, 1, 4, 4],
        });
        await waitForDiceThroneVisualIdle(page);
        await game.screenshot('ninja-death-blossom-2-right-tray-initial', testInfo);

        await page.evaluate(() => {
            window.__BG_TEST_HARNESS__?.dice.setValues([6]);
        });
        await getRightTrayDie(page, 0).click({ force: true });
        await expect.poll(async () => {
            const state = await game.getState();
            const settlement = state?.core?.pendingBonusDiceSettlement;
            return {
                rerollCount: settlement?.rerollCount ?? null,
                diceValues: settlement?.dice?.map((die: any) => die?.value ?? null) ?? [],
            };
        }, { timeout: 5000 }).toEqual({
            rerollCount: 1,
            diceValues: [6, 1, 1, 4, 4],
        });
        await waitForDiceThroneVisualIdle(page);
        await game.screenshot('ninja-death-blossom-2-after-first-reroll', testInfo);

        await page.evaluate(() => {
            window.__BG_TEST_HARNESS__?.dice.setValues([6]);
        });
        await getRightTrayDie(page, 1).click({ force: true });
        await expect.poll(async () => {
            const state = await game.getState();
            const settlement = state?.core?.pendingBonusDiceSettlement;
            return {
                rerollCount: settlement?.rerollCount ?? null,
                maxRerollCount: settlement?.maxRerollCount ?? null,
                diceValues: settlement?.dice?.map((die: any) => die?.value ?? null) ?? [],
            };
        }, { timeout: 5000 }).toEqual({
            rerollCount: 2,
            maxRerollCount: 2,
            diceValues: [6, 6, 1, 4, 4],
        });
        await expect(getRightTrayDie(page, 0)).toHaveAttribute('data-clickable', 'false', { timeout: 5000 });
        await expect(getRightTrayDie(page, 4)).toHaveAttribute('data-clickable', 'false', { timeout: 5000 });
        await waitForDiceThroneVisualIdle(page);
        await clearIncidentalHandHover(page);
        await expectNinjaDeathBlossomSourceSlotStillMapped(page);
        await game.screenshot('ninja-death-blossom-2-limit-reached', testInfo);

        await settleCurrentBonusDice(page, () => game.getState(), { sourceAbilityId: 'death-blossom' });
        await expect.poll(async () => {
            const state = await game.getState();
            const context = state?.core?.currentRollContext;
            return {
                settlement: state?.core?.pendingBonusDiceSettlement ?? null,
                pendingAttack: state?.core?.pendingAttack ?? null,
                pendingDamage: state?.core?.pendingDamage ?? null,
                currentRollContext: context
                    ? {
                        kind: context.kind,
                        status: context.status,
                        replayOnly: context.display?.replayOnly ?? false,
                        diceValues: Array.isArray(context.dice)
                            ? context.dice.map((die: any) => die.value)
                            : [],
                    }
                    : null,
                delayedPoison: state?.core?.players?.['1']?.tokens?.[TOKEN_IDS.DELAYED_POISON] ?? 0,
                defenderHp: state?.core?.players?.['1']?.resources?.hp ?? null,
            };
        }, { timeout: 5000 }).toEqual({
            settlement: null,
            pendingAttack: null,
            pendingDamage: null,
            currentRollContext: null,
            delayedPoison: 1,
            defenderHp: 25,
        });
        await waitForDiceThroneVisualIdle(page);
        await clearIncidentalHandHover(page);
        await expect(page.getByTestId('bonus-die-overlay')).toHaveCount(0);
        await expect(page.getByTestId('bonus-dice-confirm-button')).toHaveCount(0);
        const settledBonusDice = page.getByTestId('dicethrone-2d-dice-tray').locator('[data-testid^="die-button-"]');
        await expect(settledBonusDice).toHaveCount(0);
        await expectNinjaDeathBlossomSourceSlotClearedAfterCloseout(page);
        await game.screenshot('ninja-death-blossom-2-after-closeout', testInfo);
    });
});
