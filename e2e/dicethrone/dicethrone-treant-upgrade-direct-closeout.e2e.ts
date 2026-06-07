import { test, expect } from '../framework';
import { maybePassResponse } from '../helpers/dicethrone';
import { createCharacterDice } from '../../src/games/dicethrone/domain/characters';
import { getHeroDieFace } from '../../src/games/dicethrone/domain/rules';
import type { Die } from '../../src/games/dicethrone/domain/types';
import { RESOURCE_IDS } from '../../src/games/dicethrone/domain/resources';
import { TOKEN_IDS } from '../../src/games/dicethrone/domain/ids';
import {
    NATURE_TOUCH_2,
    SHATTERING_FIST_2,
    SHATTERING_FIST_3,
    TEND_CARE_2,
    VENGEFUL_VINES_2,
    WILD_GROWTH_2,
} from '../../src/games/dicethrone/heroes/treant/abilities';
import '../../src/games/dicethrone/domain';

const createTreantDiceWithValues = (values: number[]) =>
    createCharacterDice('treant').map((die: Die, index: number) => {
        const value = values[index] ?? 1;
        const symbol = getHeroDieFace('treant', value);
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

async function closeBonusDieOverlayIfVisible(page: any): Promise<void> {
    const overlay = page.locator('[data-testid="bonus-die-overlay"]').first();
    if (!await overlay.isVisible({ timeout: 1200 }).catch(() => false)) {
        return;
    }

    const confirmDamageButton = page.getByRole('button', { name: /^(确认伤害|Confirm Damage)$/i }).first();
    if (await confirmDamageButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await confirmDamageButton.click();
    } else {
        const closeButton = page.getByLabel(/关闭|Close/i).first();
        await expect(closeButton).toBeVisible({ timeout: 5000 });
        await closeButton.click();
    }
    await expect(overlay).toBeHidden({ timeout: 5000 });
}

async function readHarnessState(page: any): Promise<any> {
    return await page.evaluate(() => window.__BG_TEST_HARNESS__?.state?.get?.());
}

async function alignDirectPageToPlayer(page: any, playerId: '0' | '1', phase?: string): Promise<void> {
    await page.evaluate(({ nextPlayerId, nextPhase }) => {
        const harness = window.__BG_TEST_HARNESS__;
        const current = harness?.state?.get?.();
        if (!current || !harness?.state?.set) {
            throw new Error('TestHarness state 不可用');
        }

        return harness.state.set({
            ...current,
            core: {
                ...current.core,
                activePlayerId: nextPlayerId,
                currentPlayer: nextPlayerId,
            },
            sys: {
                ...(current.sys ?? {}),
                currentPlayerIndex: nextPlayerId === '0' ? 0 : 1,
                ...(nextPhase ? { phase: nextPhase } : {}),
            },
        });
    }, { nextPlayerId: playerId, nextPhase: phase });
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

async function chooseButtonByName(page: any, title: RegExp, buttonName: RegExp): Promise<void> {
    const modalRoot = page.locator('#modal-root');
    await expect(modalRoot.getByText(title).first()).toBeVisible({ timeout: 5000 });
    const targetButton = modalRoot.getByRole('button', { name: buttonName }).first();
    await expect(targetButton).toBeVisible({ timeout: 5000 });
    await targetButton.click();
}

async function chooseVariantByLabelIfVisible(page: any, label: RegExp): Promise<void> {
    const variantTitle = page.getByRole('heading', { name: '选择发动变体' }).first();
    if (!await variantTitle.isVisible({ timeout: 1200 }).catch(() => false)) {
        return;
    }
    const optionButton = page.getByRole('button', { name: label }).first();
    await expect(optionButton).toBeVisible({ timeout: 5000 });
    await optionButton.click();
    await expect(variantTitle).toBeHidden({ timeout: 5000 }).catch(() => {});
}

async function resolvePaladinDefenseIfNeeded(page: any): Promise<void> {
    let defenseState: any = null;
    for (let attempt = 0; attempt < 20; attempt += 1) {
        const state = await readHarnessState(page);
        const pendingAttack = state?.core?.pendingAttack ?? null;
        const phase = state?.sys?.phase ?? null;
        if (!pendingAttack) {
            return;
        }
        if (phase === 'defensiveRoll' && pendingAttack.defenderId === '1') {
            defenseState = state;
            break;
        }
        await page.waitForTimeout(250);
    }

    if (!defenseState) {
        throw new Error('攻击已进入可防御链路，但 direct 场景未进入圣骑 defensiveRoll');
    }

    await page.waitForFunction(() => Boolean(window.__BG_TEST_HARNESS__?.dice), { timeout: 5000 });
    await page.evaluate(() => {
        window.__BG_TEST_HARNESS__?.dice.setValues([6, 6, 6]);
    });

    // TestMatchRoom 现在允许通过 URL 固定玩家视角；off-turn 防御链不能再依赖“切到 defender 视角后按钮 enabled”。
    // 这里直接用 harness 以 defender 身份驱动命令，避免把固定视角下的 disabled UI 误判成实现回退。
    await dispatchHarnessCommand(page, 'ROLL_DICE', '1');
    await dispatchHarnessCommand(page, 'CONFIRM_ROLL', '1');
    await dispatchHarnessCommand(page, 'ADVANCE_PHASE', '1');

    for (let round = 0; round < 6; round += 1) {
        const state = await readHarnessState(page);
        if (!state?.core?.pendingAttack && !state?.core?.pendingDamage) {
            return;
        }

        const pendingDamageResponderId = state?.core?.pendingDamage?.responderId;
        if (typeof pendingDamageResponderId === 'string' && pendingDamageResponderId.length > 0) {
            await dispatchHarnessCommand(page, 'SKIP_TOKEN_RESPONSE', pendingDamageResponderId, {});
            await page.waitForTimeout(250);
            continue;
        }
        if (state?.sys?.phase === 'defensiveRoll' && state?.core?.pendingAttack?.defenderId === '1') {
            await dispatchHarnessCommand(page, 'ADVANCE_PHASE', '1');
            await page.waitForTimeout(250);
            continue;
        }
        if (await maybePassResponse(page)) {
            continue;
        }
        await page.waitForTimeout(250);
    }

    throw new Error(`圣骑防御未在预期轮次内收口: ${JSON.stringify(await readHarnessState(page))}`);
}

async function settleAfterChoice(page: any, playerId: '0' | '1' = '0'): Promise<void> {
    for (let round = 0; round < 8; round += 1) {
        await closeBonusDieOverlayIfVisible(page);

        const state = await readHarnessState(page);
        if (!state?.core?.pendingAttack && !state?.core?.pendingDamage && !state?.core?.pendingBonusDiceSettlement) {
            return;
        }

        if (state?.core?.pendingAttack && state?.sys?.phase === 'defensiveRoll' && state?.core?.pendingAttack?.defenderId === '1') {
            await resolvePaladinDefenseIfNeeded(page);
            continue;
        }

        if (await maybePassResponse(page)) {
            continue;
        }

        const advanceButton = page.locator('[data-tutorial-id="advance-phase-button"]').first();
        if (
            await advanceButton.isVisible({ timeout: 400 }).catch(() => false)
            && await advanceButton.isEnabled({ timeout: 400 }).catch(() => false)
        ) {
            await clickAdvancePhase(page, playerId);
            await page.waitForTimeout(250);
            continue;
        }

        await page.waitForTimeout(250);
    }

    throw new Error(`对象级 closeout 未在预期轮次内完成: ${JSON.stringify(await readHarnessState(page))}`);
}

async function setupTreantAbilityScene(
    page: any,
    game: any,
    options: {
        abilityId: 'tend-care' | 'nature-touch' | 'vengeful-vines' | 'wild-growth' | 'shattering-fist' | 'quiet-cultivation' | 'forest-awakens';
        upgradeCardId?: string;
        abilityDef?: unknown;
        abilityLevel?: number;
        attackDiceValues: number[];
        phase?: string;
        activePlayerId?: '0' | '1';
        expectTreantSurface?: boolean;
        randomValues?: number[];
        player0Resources?: Record<string, number>;
        player0Tokens?: Record<string, number>;
        player1Resources?: Record<string, number>;
        player1Tokens?: Record<string, number>;
        player0Hand?: unknown[];
    },
): Promise<void> {
    const preparedDice = createTreantDiceWithValues(options.attackDiceValues);

    await game.openTestGame('dicethrone', { playerID: 0 });
    await game.setupScene({
        gameId: 'dicethrone',
        player0: {
            resources: { CP: 3, HP: 30 },
            tokens: {
                life_sap: 0,
                thorn: 0,
                seedling: 0,
                sapling: 0,
                divine: 0,
            },
        },
        player1: {
            resources: { CP: 0, HP: 30 },
            tokens: {},
        },
        currentPlayer: options.activePlayerId ?? '0',
        phase: options.phase ?? 'offensiveRoll',
        extra: {
            selectedCharacters: { '0': 'treant', '1': 'paladin' },
            hostStarted: true,
            activePlayerId: options.activePlayerId ?? '0',
            currentPlayer: options.activePlayerId ?? '0',
            currentPlayerIndex: options.activePlayerId === '1' ? 1 : 0,
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
        ({ abilityId, abilityDef, abilityLevel, upgradeCardId, preparedDice, phase, randomValues, p0Resources, p0Tokens, p1Resources, p1Tokens, p0Hand }) => {
            const harness = window.__BG_TEST_HARNESS__;
            const current = harness?.state?.get?.();
            if (!current || !harness?.state?.set) {
                throw new Error('TestHarness state 不可用');
            }

            const players = { ...(current.core?.players ?? {}) };
            const treant = { ...(players['0'] ?? {}) };
            const paladin = { ...(players['1'] ?? {}) };
            players['0'] = {
                ...treant,
                abilities: Array.isArray(treant.abilities) && abilityDef
                    ? treant.abilities.map((ability: any) => (ability?.id === abilityId ? abilityDef : ability))
                    : treant.abilities,
                abilityLevels: {
                    ...(treant.abilityLevels ?? {}),
                    ...(typeof abilityLevel === 'number'
                        ? { [abilityId]: abilityLevel }
                        : (upgradeCardId ? { [abilityId]: 2 } : {})),
                },
                upgradeCardByAbilityId: upgradeCardId
                    ? {
                        ...(treant.upgradeCardByAbilityId ?? {}),
                        [abilityId]: { cardId: upgradeCardId, cpCost: 2 },
                    }
                    : { ...(treant.upgradeCardByAbilityId ?? {}) },
                resources: {
                    ...(treant.resources ?? {}),
                    ...(p0Resources ?? {}),
                },
                tokens: {
                    ...(treant.tokens ?? {}),
                    ...(p0Tokens ?? {}),
                },
                hand: Array.isArray(p0Hand) ? p0Hand : [],
            };
            players['1'] = {
                ...paladin,
                resources: {
                    ...(paladin.resources ?? {}),
                    ...(p1Resources ?? {}),
                },
                tokens: {
                    ...(paladin.tokens ?? {}),
                    ...(p1Tokens ?? {}),
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
                    phase: phase ?? 'offensiveRoll',
                    interaction: {
                        ...((current.sys?.interaction ?? {}) as Record<string, unknown>),
                        current: undefined,
                    },
                    responseWindow: {
                        ...((current.sys?.responseWindow ?? {}) as Record<string, unknown>),
                        current: undefined,
                    },
                    tutorial: randomValues
                        ? {
                            ...((current.sys?.tutorial ?? {}) as Record<string, unknown>),
                            active: true,
                            randomPolicy: { mode: 'sequence', values: randomValues, cursor: 0 },
                        }
                        : current.sys?.tutorial,
                },
            });
        },
        {
            abilityId: options.abilityId,
            abilityDef: options.abilityDef,
            abilityLevel: options.abilityLevel,
            upgradeCardId: options.upgradeCardId,
            preparedDice,
            phase: options.phase ?? 'offensiveRoll',
            randomValues: options.randomValues,
            p0Resources: options.player0Resources ?? {},
            p0Tokens: options.player0Tokens ?? {},
            p1Resources: options.player1Resources ?? {},
            p1Tokens: options.player1Tokens ?? {},
            p0Hand: options.player0Hand ?? [],
        },
    );

    if (options.expectTreantSurface !== false) {
        await expect(page.getByTestId('player-board-surface')).toHaveAttribute('data-character-id', 'treant', { timeout: 10000 });
    }
}

test.describe('DiceThrone Treant 升级技能对象级真实收口', () => {
    test('破碎之拳基础版应从真实槽位收口到移除 1 幼种树灵、施加 1 刺藤并造成 7 点伤害', async ({ page, game }, testInfo) => {
        await setupTreantAbilityScene(page, game, {
            abilityId: 'shattering-fist',
            attackDiceValues: [1, 2, 3, 1, 2],
            player0Tokens: {
                [TOKEN_IDS.TREANT_SEEDLING]: 1,
                [TOKEN_IDS.TREANT_SAPLING]: 0,
                [TOKEN_IDS.TREANT_DIVINE]: 0,
            },
            player1Resources: {
                [RESOURCE_IDS.HP]: 30,
            },
            player1Tokens: {
                [TOKEN_IDS.THORN]: 0,
            },
        });

        await game.screenshot('treant-shattering-fist-base-before-click', testInfo);
        await clickResolvedAbilitySlot(page, 'fist', 'shattering-fist-5');
        await dismissAttackShowcaseIfVisible(page);
        await clickAdvancePhase(page, '0');
        await chooseButtonByName(page, /破碎之拳/i, /幼种/i);
        await settleAfterChoice(page);

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                pendingAttack: state?.core?.pendingAttack ?? null,
                pendingDamage: state?.core?.pendingDamage ?? null,
                defenderHp: state?.core?.players?.['1']?.resources?.hp ?? null,
                thorn: state?.core?.players?.['1']?.tokens?.[TOKEN_IDS.THORN] ?? 0,
                seedling: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.TREANT_SEEDLING] ?? 0,
                sapling: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.TREANT_SAPLING] ?? 0,
                divine: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.TREANT_DIVINE] ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            pendingAttack: null,
            pendingDamage: null,
            defenderHp: 23,
            thorn: 1,
            seedling: 0,
            sapling: 0,
            divine: 0,
        });
        await game.screenshot('treant-shattering-fist-base-after-closeout', testInfo);
    });

    test('细心呵护基础版应从真实槽位收口到抽 1、养成 3 树灵、自己获得生命源泉并对手获得刺藤', async ({ page, game }, testInfo) => {
        await setupTreantAbilityScene(page, game, {
            abilityId: 'tend-care',
            attackDiceValues: [4, 4, 6, 6, 1],
            player0Tokens: {
                [TOKEN_IDS.TREANT_SEEDLING]: 1,
                [TOKEN_IDS.TREANT_SAPLING]: 0,
                [TOKEN_IDS.TREANT_DIVINE]: 0,
                [TOKEN_IDS.LIFE_SAP]: 0,
            },
            player1Tokens: {
                [TOKEN_IDS.THORN]: 0,
            },
        });

        await game.screenshot('treant-tend-care-base-before-click', testInfo);
        await clickResolvedAbilitySlot(page, 'chi', 'tend-care');
        await dismissAttackShowcaseIfVisible(page);
        await clickAdvancePhase(page, '0');
        await chooseButtonByName(
            page,
            /细心呵护：选择树灵与目标/i,
            /幼种 2 .*木苗 1 .*神性 0.*P1 获得生命源泉.*P2 获得刺藤/i,
        );
        await settleAfterChoice(page);

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                pendingAttack: state?.core?.pendingAttack ?? null,
                pendingDamage: state?.core?.pendingDamage ?? null,
                pendingBonus: state?.core?.pendingBonusDiceSettlement ?? null,
                handCount: state?.core?.players?.['0']?.hand?.length ?? 0,
                seedling: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.TREANT_SEEDLING] ?? 0,
                sapling: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.TREANT_SAPLING] ?? 0,
                divine: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.TREANT_DIVINE] ?? 0,
                lifeSap: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.LIFE_SAP] ?? 0,
                thorn: state?.core?.players?.['1']?.tokens?.[TOKEN_IDS.THORN] ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            pendingAttack: null,
            pendingDamage: null,
            pendingBonus: null,
            handCount: 1,
            seedling: 2,
            sapling: 1,
            divine: 0,
            lifeSap: 1,
            thorn: 1,
        });
        await game.screenshot('treant-tend-care-base-after-closeout', testInfo);
    });

    test('复仇枝蔓基础版应从真实槽位收口到 7 点伤害加 1 刺藤', async ({ page, game }, testInfo) => {
        await setupTreantAbilityScene(page, game, {
            abilityId: 'vengeful-vines',
            attackDiceValues: [1, 2, 3, 4, 6],
            player1Resources: {
                [RESOURCE_IDS.HP]: 30,
            },
            player1Tokens: {
                [TOKEN_IDS.THORN]: 0,
            },
        });

        await game.screenshot('treant-vengeful-vines-base-before-click', testInfo);
        await clickResolvedAbilitySlot(page, 'combo', 'vengeful-vines');
        await dismissAttackShowcaseIfVisible(page);
        await clickAdvancePhase(page, '0');
        await settleAfterChoice(page);

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                pendingAttack: state?.core?.pendingAttack ?? null,
                pendingDamage: state?.core?.pendingDamage ?? null,
                defenderHp: state?.core?.players?.['1']?.resources?.hp ?? null,
                thorn: state?.core?.players?.['1']?.tokens?.[TOKEN_IDS.THORN] ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            pendingAttack: null,
            pendingDamage: null,
            defenderHp: 23,
            thorn: 1,
        });
        await game.screenshot('treant-vengeful-vines-base-after-closeout', testInfo);
    });

    test('自然之触基础版应从真实槽位收口到养成后追加伤害并直接造成 7 点不可防御伤害', async ({ page, game }, testInfo) => {
        await setupTreantAbilityScene(page, game, {
            abilityId: 'nature-touch',
            attackDiceValues: [6, 6, 6, 6, 1],
            player0Tokens: {
                [TOKEN_IDS.TREANT_SEEDLING]: 0,
                [TOKEN_IDS.TREANT_SAPLING]: 0,
                [TOKEN_IDS.TREANT_DIVINE]: 0,
            },
            player1Resources: {
                [RESOURCE_IDS.HP]: 30,
            },
        });

        await game.screenshot('treant-nature-touch-base-before-click', testInfo);
        await clickResolvedAbilitySlot(page, 'lightning', 'nature-touch');
        await dismissAttackShowcaseIfVisible(page);
        await clickAdvancePhase(page, '0');
        await chooseButtonByName(page, /自然之触：选择养成后的树灵/i, /结算后：幼种 2/i);
        await settleAfterChoice(page);

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                pendingAttack: state?.core?.pendingAttack ?? null,
                pendingDamage: state?.core?.pendingDamage ?? null,
                defenderHp: state?.core?.players?.['1']?.resources?.hp ?? null,
                seedling: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.TREANT_SEEDLING] ?? 0,
                sapling: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.TREANT_SAPLING] ?? 0,
                divine: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.TREANT_DIVINE] ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            pendingAttack: null,
            pendingDamage: null,
            defenderHp: 23,
            seedling: 2,
            sapling: 0,
            divine: 0,
        });
        await game.screenshot('treant-nature-touch-base-after-closeout', testInfo);
    });

    test('静默耕耘应在真实 upkeep 选择养成后收口到木苗 1 并继续推进到收入阶段', async ({ page, game }, testInfo) => {
        await setupTreantAbilityScene(page, game, {
            abilityId: 'quiet-cultivation',
            phase: 'discard',
            attackDiceValues: [1, 1, 1, 1, 1],
            player0Tokens: {
                [TOKEN_IDS.TREANT_SEEDLING]: 1,
                [TOKEN_IDS.TREANT_SAPLING]: 0,
                [TOKEN_IDS.TREANT_DIVINE]: 0,
            },
        });

        await page.evaluate(() => {
            const harness = window.__BG_TEST_HARNESS__;
            const current = harness?.state?.get?.();
            if (!current || !harness?.state?.set) {
                throw new Error('TestHarness state 不可用');
            }

            harness.state.set({
                ...current,
                core: {
                    ...current.core,
                    activePlayerId: '1',
                    currentPlayer: '1',
                },
                sys: {
                    ...current.sys,
                    phase: 'discard',
                },
            });
        });

        await game.screenshot('treant-quiet-cultivation-before-advance', testInfo);
        await clickAdvancePhase(page, '1');
        await expect(page.locator('#modal-root').getByText(/静默耕耘|养成后的树灵/i).first()).toBeVisible({ timeout: 5000 });
        await game.screenshot('treant-quiet-cultivation-before-choice', testInfo);
        await chooseButtonByName(page, /静默耕耘|养成后的树灵/i, /木苗 1/i);

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                interaction: state?.sys?.interaction?.current ?? null,
                seedling: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.TREANT_SEEDLING] ?? 0,
                sapling: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.TREANT_SAPLING] ?? 0,
                divine: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.TREANT_DIVINE] ?? 0,
                phase: state?.sys?.phase ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            interaction: null,
            seedling: 0,
            sapling: 1,
            divine: 0,
            phase: 'main1',
        });
        await game.screenshot('treant-quiet-cultivation-after-advance', testInfo);
    });

    test('细心呵护 II 主路线应从真实槽位收口到抽 1 + 4 次养成 + 自己获得生命源泉 + 对手获得刺藤', async ({ page, game }, testInfo) => {
        await setupTreantAbilityScene(page, game, {
            abilityId: 'tend-care',
            upgradeCardId: 'upgrade-tend-care-2',
            abilityDef: TEND_CARE_2,
            attackDiceValues: [4, 4, 6, 6, 1],
            player0Hand: [],
            player0Tokens: {
                [TOKEN_IDS.TREANT_SEEDLING]: 0,
                [TOKEN_IDS.TREANT_SAPLING]: 0,
                [TOKEN_IDS.TREANT_DIVINE]: 0,
                [TOKEN_IDS.LIFE_SAP]: 0,
            },
            player1Tokens: {
                [TOKEN_IDS.THORN]: 0,
            },
        });

        await game.screenshot('treant-tend-care-2-main-before-click', testInfo);
        await clickResolvedAbilitySlot(page, 'chi', 'tend-care-2-main');
        await dismissAttackShowcaseIfVisible(page);
        await clickAdvancePhase(page, '0');
        await chooseButtonByName(
            page,
            /细心呵护：选择树灵与目标/i,
            /幼种 2 .*木苗 1 .*神性 0.*P1 获得生命源泉.*P2 获得刺藤/i,
        );
        await settleAfterChoice(page);

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                pendingAttack: state?.core?.pendingAttack ?? null,
                pendingDamage: state?.core?.pendingDamage ?? null,
                pendingBonus: state?.core?.pendingBonusDiceSettlement ?? null,
                handCount: state?.core?.players?.['0']?.hand?.length ?? 0,
                seedling: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.TREANT_SEEDLING] ?? 0,
                sapling: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.TREANT_SAPLING] ?? 0,
                divine: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.TREANT_DIVINE] ?? 0,
                lifeSap: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.LIFE_SAP] ?? 0,
                thorn: state?.core?.players?.['1']?.tokens?.[TOKEN_IDS.THORN] ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            pendingAttack: null,
            pendingDamage: null,
            pendingBonus: null,
            handCount: 1,
            seedling: 2,
            sapling: 1,
            divine: 0,
            lifeSap: 1,
            thorn: 1,
        });
        await game.screenshot('treant-tend-care-2-main-after-closeout', testInfo);
    });

    test('细心呵护 II 的培育分支应从真实槽位收口到 6 次养成', async ({ page, game }, testInfo) => {
        await setupTreantAbilityScene(page, game, {
            abilityId: 'tend-care',
            upgradeCardId: 'upgrade-tend-care-2',
            abilityDef: TEND_CARE_2,
            attackDiceValues: [1, 1, 6, 6, 4],
            player0Tokens: {
                [TOKEN_IDS.TREANT_SEEDLING]: 0,
                [TOKEN_IDS.TREANT_SAPLING]: 0,
                [TOKEN_IDS.TREANT_DIVINE]: 0,
            },
        });

        await game.screenshot('treant-tend-care-2-cultivate-before-click', testInfo);
        await clickResolvedAbilitySlot(page, 'chi', 'tend-care-2-cultivate');
        await dismissAttackShowcaseIfVisible(page);
        await clickAdvancePhase(page, '0');
        await chooseButtonByName(page, /自然之触：选择养成后的树灵/i, /结算后：幼种 3，神性 1/i);
        await settleAfterChoice(page);

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                pendingAttack: state?.core?.pendingAttack ?? null,
                pendingDamage: state?.core?.pendingDamage ?? null,
                seedling: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.TREANT_SEEDLING] ?? 0,
                sapling: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.TREANT_SAPLING] ?? 0,
                divine: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.TREANT_DIVINE] ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            pendingAttack: null,
            pendingDamage: null,
            seedling: 3,
            sapling: 0,
            divine: 1,
        });
        await game.screenshot('treant-tend-care-2-cultivate-after-closeout', testInfo);
    });

    test('自然之触 II 主路线应从真实槽位收口到 10 点不可防御伤害', async ({ page, game }, testInfo) => {
        await setupTreantAbilityScene(page, game, {
            abilityId: 'nature-touch',
            upgradeCardId: 'upgrade-nature-touch-2',
            abilityDef: NATURE_TOUCH_2,
            attackDiceValues: [6, 6, 6, 6, 1],
            player0Tokens: {
                [TOKEN_IDS.TREANT_SEEDLING]: 1,
                [TOKEN_IDS.TREANT_SAPLING]: 1,
                [TOKEN_IDS.TREANT_DIVINE]: 0,
            },
            player1Resources: {
                [RESOURCE_IDS.HP]: 30,
            },
        });

        await game.screenshot('treant-nature-touch-2-main-before-click', testInfo);
        await clickResolvedAbilitySlot(page, 'lightning', 'nature-touch-2-main');
        await chooseVariantByLabelIfVisible(page, /自然之触 II（4个树灵）/i);
        await dismissAttackShowcaseIfVisible(page);
        await clickAdvancePhase(page, '0');
        await chooseButtonByName(page, /自然之触：选择养成后的树灵/i, /结算后：幼种 3，木苗 1/i);
        await settleAfterChoice(page);

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                pendingAttack: state?.core?.pendingAttack ?? null,
                pendingDamage: state?.core?.pendingDamage ?? null,
                defenderHp: state?.core?.players?.['1']?.resources?.hp ?? null,
                seedling: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.TREANT_SEEDLING] ?? 0,
                sapling: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.TREANT_SAPLING] ?? 0,
                divine: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.TREANT_DIVINE] ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            pendingAttack: null,
            pendingDamage: null,
            defenderHp: 20,
            seedling: 3,
            sapling: 1,
            divine: 0,
        });
        await game.screenshot('treant-nature-touch-2-main-after-closeout', testInfo);
    });

    test('自然之触 II 的自然之怜分支应从真实槽位收口到治疗 +1 CP + 抽 1 + 1 次养成', async ({ page, game }, testInfo) => {
        await setupTreantAbilityScene(page, game, {
            abilityId: 'nature-touch',
            upgradeCardId: 'upgrade-nature-touch-2',
            abilityDef: NATURE_TOUCH_2,
            attackDiceValues: [6, 6, 6, 1, 1],
            player0Resources: {
                [RESOURCE_IDS.HP]: 25,
                [RESOURCE_IDS.CP]: 1,
            },
            player0Tokens: {
                [TOKEN_IDS.TREANT_SEEDLING]: 1,
                [TOKEN_IDS.TREANT_SAPLING]: 0,
                [TOKEN_IDS.TREANT_DIVINE]: 0,
            },
            player0Hand: [],
        });

        await game.screenshot('treant-nature-touch-2-mercy-before-click', testInfo);
        await clickResolvedAbilitySlot(page, 'lightning', 'nature-touch-2-mercy');
        await dismissAttackShowcaseIfVisible(page);
        await clickAdvancePhase(page, '0');
        await chooseButtonByName(page, /自然之触：选择养成后的树灵/i, /结算后：幼种 2/i);
        await settleAfterChoice(page);

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                pendingAttack: state?.core?.pendingAttack ?? null,
                pendingDamage: state?.core?.pendingDamage ?? null,
                hp: state?.core?.players?.['0']?.resources?.hp ?? null,
                cp: state?.core?.players?.['0']?.resources?.cp ?? null,
                handCount: state?.core?.players?.['0']?.hand?.length ?? 0,
                seedling: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.TREANT_SEEDLING] ?? 0,
                sapling: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.TREANT_SAPLING] ?? 0,
                divine: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.TREANT_DIVINE] ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            pendingAttack: null,
            pendingDamage: null,
            hp: 26,
            cp: 2,
            handCount: 1,
            seedling: 2,
            sapling: 0,
            divine: 0,
        });
        await game.screenshot('treant-nature-touch-2-mercy-after-closeout', testInfo);
    });

    test('复仇枝蔓 II 主路线应从真实槽位收口到 8 点伤害 + 1 刺藤', async ({ page, game }, testInfo) => {
        await setupTreantAbilityScene(page, game, {
            abilityId: 'vengeful-vines',
            upgradeCardId: 'upgrade-vengeful-vines-2',
            abilityDef: VENGEFUL_VINES_2,
            attackDiceValues: [1, 2, 3, 4, 6],
            player1Resources: {
                [RESOURCE_IDS.HP]: 30,
            },
            player1Tokens: {
                [TOKEN_IDS.THORN]: 0,
            },
        });

        await game.screenshot('treant-vengeful-vines-2-main-before-click', testInfo);
        await clickResolvedAbilitySlot(page, 'combo', 'vengeful-vines-2-main');
        await dismissAttackShowcaseIfVisible(page);
        await clickAdvancePhase(page, '0');
        await settleAfterChoice(page);

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                pendingAttack: state?.core?.pendingAttack ?? null,
                pendingDamage: state?.core?.pendingDamage ?? null,
                defenderHp: state?.core?.players?.['1']?.resources?.hp ?? null,
                thorn: state?.core?.players?.['1']?.tokens?.[TOKEN_IDS.THORN] ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            pendingAttack: null,
            pendingDamage: null,
            defenderHp: 22,
            thorn: 1,
        });
        await game.screenshot('treant-vengeful-vines-2-main-after-closeout', testInfo);
    });

    test('复仇枝蔓 II 的苦痛根系分支应从真实槽位收口到按树灵总数造成 3 点真实伤害', async ({ page, game }, testInfo) => {
        await setupTreantAbilityScene(page, game, {
            abilityId: 'vengeful-vines',
            upgradeCardId: 'upgrade-vengeful-vines-2',
            abilityDef: VENGEFUL_VINES_2,
            attackDiceValues: [4, 4, 4, 1, 6],
            player0Tokens: {
                [TOKEN_IDS.TREANT_SEEDLING]: 1,
                [TOKEN_IDS.TREANT_SAPLING]: 1,
                [TOKEN_IDS.TREANT_DIVINE]: 1,
            },
            player1Resources: {
                [RESOURCE_IDS.HP]: 30,
            },
        });

        await game.screenshot('treant-vengeful-vines-2-pain-before-click', testInfo);
        await clickResolvedAbilitySlot(page, 'combo', 'vengeful-vines-2-pain');
        await dismissAttackShowcaseIfVisible(page);
        await clickAdvancePhase(page, '0');
        await settleAfterChoice(page);

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                pendingAttack: state?.core?.pendingAttack ?? null,
                pendingDamage: state?.core?.pendingDamage ?? null,
                defenderHp: state?.core?.players?.['1']?.resources?.hp ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            pendingAttack: null,
            pendingDamage: null,
            defenderHp: 27,
        });
        await game.screenshot('treant-vengeful-vines-2-pain-after-closeout', testInfo);
    });

    test('破碎之拳 II 应从真实槽位收口到 7 点伤害 + 1 刺藤', async ({ page, game }, testInfo) => {
        await setupTreantAbilityScene(page, game, {
            abilityId: 'shattering-fist',
            upgradeCardId: 'upgrade-shattering-fist-2',
            abilityDef: SHATTERING_FIST_2,
            attackDiceValues: [1, 2, 3, 1, 2],
            player1Resources: {
                [RESOURCE_IDS.HP]: 30,
            },
            player1Tokens: {
                [TOKEN_IDS.THORN]: 0,
            },
        });

        await game.screenshot('treant-shattering-fist-2-before-click', testInfo);
        await clickResolvedAbilitySlot(page, 'fist', 'shattering-fist-2-5');
        await dismissAttackShowcaseIfVisible(page);
        await clickAdvancePhase(page, '0');
        await settleAfterChoice(page);

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                pendingAttack: state?.core?.pendingAttack ?? null,
                pendingDamage: state?.core?.pendingDamage ?? null,
                defenderHp: state?.core?.players?.['1']?.resources?.hp ?? null,
                thorn: state?.core?.players?.['1']?.tokens?.[TOKEN_IDS.THORN] ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            pendingAttack: null,
            pendingDamage: null,
            defenderHp: 23,
            thorn: 1,
        });
        await game.screenshot('treant-shattering-fist-2-after-closeout', testInfo);
    });

    test('破碎之拳 III 应从真实槽位收口到养成 1 + 7 点伤害 + 1 刺藤', async ({ page, game }, testInfo) => {
        await setupTreantAbilityScene(page, game, {
            abilityId: 'shattering-fist',
            upgradeCardId: 'upgrade-shattering-fist-3',
            abilityDef: SHATTERING_FIST_3,
            attackDiceValues: [2, 2, 2, 1, 3],
            player0Tokens: {
                [TOKEN_IDS.TREANT_SEEDLING]: 0,
                [TOKEN_IDS.TREANT_SAPLING]: 0,
                [TOKEN_IDS.TREANT_DIVINE]: 0,
            },
            player1Resources: {
                [RESOURCE_IDS.HP]: 30,
            },
            player1Tokens: {
                [TOKEN_IDS.THORN]: 0,
            },
        });

        await game.screenshot('treant-shattering-fist-3-before-click', testInfo);
        await clickResolvedAbilitySlot(page, 'fist', 'shattering-fist-3-5');
        await dismissAttackShowcaseIfVisible(page);
        await clickAdvancePhase(page, '0');
        await chooseButtonByName(page, /破碎之拳/i, /结算后：幼种 1/i);
        await settleAfterChoice(page);

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                pendingAttack: state?.core?.pendingAttack ?? null,
                pendingDamage: state?.core?.pendingDamage ?? null,
                defenderHp: state?.core?.players?.['1']?.resources?.hp ?? null,
                thorn: state?.core?.players?.['1']?.tokens?.[TOKEN_IDS.THORN] ?? 0,
                seedling: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.TREANT_SEEDLING] ?? 0,
                sapling: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.TREANT_SAPLING] ?? 0,
                divine: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.TREANT_DIVINE] ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            pendingAttack: null,
            pendingDamage: null,
            defenderHp: 23,
            thorn: 1,
            seedling: 1,
            sapling: 0,
            divine: 0,
        });
        await game.screenshot('treant-shattering-fist-3-after-closeout', testInfo);
    });

    test('森林觉醒应从真实终极槽位收口到自己获得生命源泉、养成 5、施加刺藤并造成 10 点伤害', async ({ page, game }, testInfo) => {
        await setupTreantAbilityScene(page, game, {
            abilityId: 'forest-awakens',
            attackDiceValues: [6, 6, 6, 6, 6],
            player0Tokens: {
                [TOKEN_IDS.TREANT_SEEDLING]: 0,
                [TOKEN_IDS.TREANT_SAPLING]: 0,
                [TOKEN_IDS.TREANT_DIVINE]: 0,
                [TOKEN_IDS.LIFE_SAP]: 0,
            },
            player1Resources: {
                [RESOURCE_IDS.HP]: 30,
            },
            player1Tokens: {
                [TOKEN_IDS.THORN]: 0,
            },
        });

        await game.screenshot('treant-forest-awakens-before-click', testInfo);
        await clickResolvedAbilitySlot(page, 'ultimate', 'forest-awakens');
        await dismissAttackShowcaseIfVisible(page);
        await clickAdvancePhase(page, '0');
        await chooseButtonByName(page, /森林觉醒|养成后的树灵/i, /结算后：幼种 1，木苗 2/i);
        await settleAfterChoice(page);

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                pendingAttack: state?.core?.pendingAttack ?? null,
                pendingDamage: state?.core?.pendingDamage ?? null,
                defenderHp: state?.core?.players?.['1']?.resources?.hp ?? null,
                thorn: state?.core?.players?.['1']?.tokens?.[TOKEN_IDS.THORN] ?? 0,
                lifeSap: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.LIFE_SAP] ?? 0,
                seedling: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.TREANT_SEEDLING] ?? 0,
                sapling: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.TREANT_SAPLING] ?? 0,
                divine: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.TREANT_DIVINE] ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            pendingAttack: null,
            pendingDamage: null,
            defenderHp: 20,
            thorn: 1,
            lifeSap: 1,
            seedling: 1,
            sapling: 2,
            divine: 0,
        });
        await game.screenshot('treant-forest-awakens-after-closeout', testInfo);
    });

    test('野蛮生长 II 主路线应从真实槽位收口到 10 点伤害 + 生命源泉 + 2 次养成', async ({ page, game }, testInfo) => {
        await setupTreantAbilityScene(page, game, {
            abilityId: 'wild-growth',
            upgradeCardId: 'upgrade-wild-growth-2',
            abilityDef: WILD_GROWTH_2,
            attackDiceValues: [1, 2, 3, 4, 5],
            randomValues: [1, 4, 6, 6, 2],
            player0Tokens: {
                [TOKEN_IDS.TREANT_SEEDLING]: 0,
                [TOKEN_IDS.TREANT_SAPLING]: 0,
                [TOKEN_IDS.TREANT_DIVINE]: 0,
                [TOKEN_IDS.LIFE_SAP]: 0,
            },
            player1Resources: {
                [RESOURCE_IDS.HP]: 30,
            },
        });

        await game.screenshot('treant-wild-growth-2-main-before-click', testInfo);
        await clickResolvedAbilitySlot(page, 'lotus', 'wild-growth-2-main');
        await dismissAttackShowcaseIfVisible(page);
        await clickAdvancePhase(page, '0');
        await chooseButtonByName(page, /自然之触：选择养成后的树灵/i, /结算后：幼种 2/i);
        await settleAfterChoice(page);

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                pendingAttack: state?.core?.pendingAttack ?? null,
                pendingDamage: state?.core?.pendingDamage ?? null,
                pendingBonus: state?.core?.pendingBonusDiceSettlement ?? null,
                defenderHp: state?.core?.players?.['1']?.resources?.hp ?? null,
                lifeSap: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.LIFE_SAP] ?? 0,
                seedling: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.TREANT_SEEDLING] ?? 0,
                sapling: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.TREANT_SAPLING] ?? 0,
                divine: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.TREANT_DIVINE] ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            pendingAttack: null,
            pendingDamage: null,
            pendingBonus: null,
            defenderHp: 20,
            lifeSap: 1,
            seedling: 2,
            sapling: 0,
            divine: 0,
        });
        await game.screenshot('treant-wild-growth-2-main-after-closeout', testInfo);
    });

    test('野蛮生长 II 的乱花迷眼分支应从真实槽位收口到 4 点不可防御伤害 + 1 刺藤', async ({ page, game }, testInfo) => {
        await setupTreantAbilityScene(page, game, {
            abilityId: 'wild-growth',
            upgradeCardId: 'upgrade-wild-growth-2',
            abilityDef: WILD_GROWTH_2,
            attackDiceValues: [1, 1, 4, 6, 6],
            player1Resources: {
                [RESOURCE_IDS.HP]: 30,
            },
            player1Tokens: {
                [TOKEN_IDS.THORN]: 0,
            },
        });

        await game.screenshot('treant-wild-growth-2-dazzle-before-click', testInfo);
        await clickResolvedAbilitySlot(page, 'lotus', 'wild-growth-2-dazzle');
        await dismissAttackShowcaseIfVisible(page);
        await clickAdvancePhase(page, '0');
        await settleAfterChoice(page);

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                pendingAttack: state?.core?.pendingAttack ?? null,
                pendingDamage: state?.core?.pendingDamage ?? null,
                defenderHp: state?.core?.players?.['1']?.resources?.hp ?? null,
                thorn: state?.core?.players?.['1']?.tokens?.[TOKEN_IDS.THORN] ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            pendingAttack: null,
            pendingDamage: null,
            defenderHp: 26,
            thorn: 1,
        });
        await game.screenshot('treant-wild-growth-2-dazzle-after-closeout', testInfo);
    });
});
