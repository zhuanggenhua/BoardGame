/**
 * DiceThrone 炽天使技能与专属卡真实入口补证。
 *
 * 本文件只走当前 /play/dicethrone 测试入口：技能点击玩家板槽位，卡牌从真实手牌拖拽，
 * 目标选择点击真实玩家卡片，奖励骰通过真实浮层完成重掷/确认，最后回读 TestHarness 权威状态。
 */

import type { Page } from '@playwright/test';
import { expect, test } from '../framework';
import type { GameTestContext } from '../framework';
import { RESOURCE_IDS } from '../../src/games/dicethrone/domain/resources';
import { STATUS_IDS, TOKEN_IDS } from '../../src/games/dicethrone/domain/ids';
import '../../src/games/dicethrone/domain';

type JsonRecord = Record<string, any>;

const TIANSHI = 'tianshi';
const MONK = 'monk';

const randomValueForDieFace = (value: number): number => {
    const normalized = Math.max(1, Math.min(6, Math.floor(value)));
    return ((normalized - 1) / 6) + 0.001;
};

const makeDice = (values: number[]) => values.map((value, index) => ({
    id: index,
    value,
    isKept: false,
    isLocked: false,
    playerId: '0',
}));

const readState = async (game: GameTestContext): Promise<JsonRecord> => game.getState() as Promise<JsonRecord>;

const dispatchCommand = async (
    page: Page,
    type: string,
    playerId = '0',
    payload: Record<string, unknown> = {},
): Promise<void> => {
    await page.evaluate(async ({ commandType, commandPlayerId, commandPayload }) => {
        const harness = (window as any).__BG_TEST_HARNESS__;
        if (typeof harness?.command?.dispatch !== 'function') {
            throw new Error('TestHarness command.dispatch 不可用');
        }
        await harness.command.dispatch({
            type: commandType,
            playerId: commandPlayerId,
            payload: commandPayload,
            timestamp: Date.now(),
        });
    }, { commandType: type, commandPlayerId: playerId, commandPayload: payload });
};

const setupTianshiScene = async (
    game: GameTestContext,
    options: {
        phase: string;
        dice?: number[];
        hand?: string[];
        cp?: number;
        hp?: number;
        opponentHp?: number;
        randomQueue?: number[];
        pendingAttack?: JsonRecord | null;
        tokens?: Record<string, number>;
        statuses?: Record<string, number>;
        opponentTokens?: Record<string, number>;
        opponentStatuses?: Record<string, number>;
        extra?: JsonRecord;
    },
): Promise<void> => {
    await game.openTestGame('dicethrone', { playerID: '0' });
    await game.setupScene({
        gameId: 'dicethrone',
        randomQueue: options.randomQueue,
        player0: {
            hand: options.hand ?? [],
            resources: {
                [RESOURCE_IDS.CP]: options.cp ?? 10,
                [RESOURCE_IDS.HP]: options.hp ?? 50,
            },
            tokens: options.tokens ?? {},
        },
        player1: {
            resources: { [RESOURCE_IDS.CP]: 10, [RESOURCE_IDS.HP]: options.opponentHp ?? 50 },
            tokens: options.opponentTokens ?? {},
        },
        currentPlayer: '0',
        phase: options.phase,
        sys: {
            phase: options.phase,
            currentPlayerIndex: 0,
            interaction: { current: undefined, queue: [] },
            responseWindow: { current: undefined },
        },
        extra: {
            selectedCharacters: { '0': TIANSHI, '1': MONK },
            hostStarted: true,
            activePlayerId: '0',
            currentPlayer: '0',
            currentPlayerIndex: 0,
            rollCount: 1,
            rollLimit: 3,
            rollDiceCount: 5,
            rollConfirmed: true,
            ...(options.dice ? { dice: makeDice(options.dice) } : {}),
            pendingAttack: options.pendingAttack ?? null,
            pendingDamage: null,
            pendingBonusDiceSettlement: undefined,
            activatingAbilityId: undefined,
            ...options.extra,
        },
    });

    await game.waitForPhase(options.phase, 10000);
    if (options.statuses || options.opponentStatuses) {
        await game.page.evaluate(({ statuses, opponentStatuses }) => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const state = harness?.state?.get?.();
            if (!state || typeof harness?.state?.set !== 'function') {
                throw new Error('TestHarness state.set 不可用');
            }
            return harness.state.set({
                ...state,
                core: {
                    ...state.core,
                    players: {
                        ...state.core.players,
                        '0': { ...state.core.players['0'], statusEffects: statuses ?? state.core.players['0'].statusEffects },
                        '1': { ...state.core.players['1'], statusEffects: opponentStatuses ?? state.core.players['1'].statusEffects },
                    },
                },
            });
        }, { statuses: options.statuses, opponentStatuses: options.opponentStatuses });
    }
    await expect(game.page.getByTestId('player-board-surface')).toHaveAttribute('data-character-id', TIANSHI, { timeout: 10000 });
}

const clickAbilitySlot = async (page: Page, slotId: string, expectedAbilityId: string): Promise<void> => {
    const slot = page.locator(`[data-testid="player-board-surface"] [data-ability-slot="${slotId}"]`).first();
    await expect(slot).toHaveAttribute('data-resolved-ability-id', expectedAbilityId, { timeout: 10000 });
    await expect(slot).toHaveAttribute('data-can-click', 'true', { timeout: 10000 });
    const clickBox = await slot.boundingBox();
    if (!clickBox) throw new Error(`无法获取技能槽 ${slotId} 的真实点击区域`);
    await page.mouse.click(clickBox.x + clickBox.width / 2, clickBox.y + clickBox.height / 2);
};

const advancePhase = async (page: Page, playerId = '0'): Promise<void> => {
    const button = page.locator('[data-tutorial-id="advance-phase-button"]');
    if (
        playerId === '0'
        && await button.isVisible({ timeout: 1500 }).catch(() => false)
        && await button.isEnabled({ timeout: 1500 }).catch(() => false)
    ) {
        await button.click({ force: true });
        return;
    }
    await dispatchCommand(page, 'ADVANCE_PHASE', playerId);
};

const passResponseWindowIfVisible = async (page: Page): Promise<void> => {
    const passButton = page.getByRole('button', { name: /^(跳过|Pass)$/i }).first();
    if (!await passButton.isVisible({ timeout: 1500 }).catch(() => false)) return;
    await expect(passButton).toBeEnabled({ timeout: 5000 });
    await passButton.click({ force: true });
};

const advanceAttackToCloseout = async (page: Page, game: GameTestContext): Promise<void> => {
    const maxAttempts = 24;
    let sourceAbilityId: string | undefined;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        let state = await readState(game);
        const pendingAttack = state.core?.pendingAttack;
        sourceAbilityId ??= pendingAttack?.sourceAbilityId;
        const events = (state.sys?.eventStream?.entries ?? []).map((entry: JsonRecord) => entry?.event ?? entry);
        const attackResolved = Boolean(sourceAbilityId) && events.some((event: JsonRecord) => (
            event?.type === 'ATTACK_RESOLVED'
            && event?.payload?.sourceAbilityId === sourceAbilityId
        ));
        if (!pendingAttack && attackResolved) return;

        // 攻击结算可能连续经过“攻击方响应 → 防御掷骰 → 防御方响应 →
        // 攻击方响应”。每一轮都先处理当前可见的真实跳过入口，再推进
        // 对应玩家的阶段，直到领域状态真正清掉 pendingAttack。
        await passResponseWindowIfVisible(page);
        state = await readState(game);
        const pendingAfterPass = state.core?.pendingAttack;
        if (!pendingAfterPass) {
            const afterPassEvents = (state.sys?.eventStream?.entries ?? []).map((entry: JsonRecord) => entry?.event ?? entry);
            if (afterPassEvents.some((event: JsonRecord) => (
                event?.type === 'ATTACK_RESOLVED'
                && event?.payload?.sourceAbilityId === sourceAbilityId
            ))) return;
            continue;
        }

        // 防御方的本地 AI 需要先完成“选防御技能 → 掷骰 → 确认骰面”。
        // 在这段真实动作链尚未完成前，直接发送 ADVANCE_PHASE 只会得到
        // “无法推进阶段”的提示，不能代表攻击链真的卡住。
        if (
            state.sys?.phase === 'defensiveRoll'
            && pendingAfterPass.defenseResolved !== true
            && !state.sys?.interaction?.current
        ) {
            await page.waitForTimeout(250);
            continue;
        }

        if (state.sys?.interaction?.current) {
            await page.waitForTimeout(250);
            continue;
        }

        // 防御已完成后，伤害响应状态可能先写入 core、再由系统补齐
        // dt:token-response 交互。等待这一轮状态同步，避免在真实交互
        // 尚未挂载时重复推进。
        if (state.core?.pendingDamage && !state.sys?.interaction?.current) {
            await page.waitForTimeout(250);
            continue;
        }

        const phase = state.sys?.phase;
        const nextPlayerId = phase === 'defensiveRoll'
            ? pendingAfterPass.defenderId ?? '1'
            : phase === 'offensiveRoll'
                ? pendingAfterPass.attackerId ?? '0'
                : state.core?.activePlayerId ?? pendingAfterPass.attackerId ?? '0';
        await advancePhase(page, nextPlayerId);
        await page.waitForTimeout(250);
    }

    const finalState = await readState(game);
    throw new Error(`攻击未在 ${maxAttempts} 次真实推进内收口：${JSON.stringify({
        phase: finalState.sys?.phase,
        activePlayerId: finalState.core?.activePlayerId,
        responseWindow: finalState.sys?.responseWindow?.current ?? null,
        pendingAttack: finalState.core?.pendingAttack ?? null,
        interaction: finalState.sys?.interaction?.current ?? null,
    })}`);
};

const dragHandCardToPlay = async (page: Page, cardId: string): Promise<void> => {
    const card = page.locator(`[data-testid="hand-area"] [data-card-id="${cardId}"]`).first();
    await expect(card).toBeVisible({ timeout: 10000 });
    await expect(card).toHaveAttribute('data-can-drag', 'true', { timeout: 10000 });

    const box = await card.boundingBox();
    if (!box || box.width <= 0 || box.height <= 0) {
        throw new Error(`未能获取手牌 ${cardId} 的真实拖拽区域`);
    }

    const startX = box.x + box.width / 2;
    const startY = box.y + box.height * 0.78;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX, Math.max(24, startY - 240), { steps: 12 });
    await page.mouse.up();
    await page.mouse.move(2, 2);
}

const settleBonusOverlay = async (page: Page): Promise<void> => {
    // 卡牌特写是 pointer-events-none 的非交互展示层，且对手可能连续产生多张
    // 3 秒特写；它不是奖励骰交互载体，不应等待整条特写队列清空后才收口。
    // 拖拽后的同一张手牌可能留下产品已有的卡牌查看层；它才可能挡住确认按钮，
    // 因此仍按真实产品入口关闭它，不伪造状态。
    const boardMagnify = page.getByTestId('board-magnify-overlay');
    if (await boardMagnify.isVisible({ timeout: 1000 }).catch(() => false)) {
        await boardMagnify.getByRole('button', { name: /关闭预览|Close preview/i }).click();
        await expect(boardMagnify).toBeHidden({ timeout: 3000 });
    }

    const overlay = page.getByTestId('bonus-die-overlay');
    await expect(overlay).toBeVisible({ timeout: 10000 });
    const actionButton = overlay.getByRole('button', { name: /确认伤害|确认伤害|关闭特写|Confirm damage|Close spotlight/i }).first();
    await expect(actionButton).toBeVisible({ timeout: 10000 });
    // 产品浮层保留 300ms 点击保护窗，避免触发浮层的同一次点击立刻关闭。
    await page.waitForTimeout(350);
    await actionButton.click({ force: true });
    await expect.poll(async () => page.evaluate(() => {
        const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
        return state?.core?.pendingBonusDiceSettlement?.sourceAbilityId ?? null;
    }), { timeout: 10000 }).toBeNull();
    await expect(overlay).toBeHidden({ timeout: 10000 });
};

const selectPlayerTarget = async (page: Page, playerId: string): Promise<void> => {
    const target = page.getByTestId(`dt-player-target-${playerId}`);
    await expect(target).toBeVisible({ timeout: 10000 });
    await target.click();
    const confirm = page.locator('#modal-root').getByRole('button', { name: /^确认$/ });
    await expect(confirm).toBeEnabled({ timeout: 5000 });
    await confirm.click();
};

const selectChoicePlayer = async (page: Page, playerId: string): Promise<void> => {
    const choiceButton = page.locator('#modal-root').getByRole('button', { name: new RegExp(`^玩家 ${playerId}$`) });
    await expect(choiceButton).toBeVisible({ timeout: 10000 });
    await choiceButton.click();
};

const expectCardConsumed = async (
    game: GameTestContext,
    cardId: string,
    expectedCp: number,
    expectedDiscardIds: string[] = [cardId],
): Promise<void> => {
    await expect.poll(async () => {
        const state = await readState(game);
        const player = state.core?.players?.['0'];
        return {
            handIds: player?.hand?.map((card: JsonRecord) => card.id) ?? [],
            discardIds: player?.discard?.map((card: JsonRecord) => card.id) ?? [],
            cp: player?.resources?.[RESOURCE_IDS.CP] ?? null,
        };
    }, { timeout: 10000 }).toMatchObject({
        handIds: [],
        discardIds: expectedDiscardIds,
        cp: expectedCp,
    });
};

const pendingAttackForCard = (isDefendable = false): JsonRecord => ({
    attackerId: '0',
    defenderId: '1',
    sourceAbilityId: 'holy-blade',
    isDefendable,
    damage: 5,
    settlementStage: 'preDamage',
    damageResolved: false,
    resolvedDamage: 0,
    bonusDamage: 0,
    attackModifierBonusDamage: 0,
    attackDiceValues: [1, 1, 1, 4, 5],
    attackDiceFaceCounts: { blade: 3, wing: 1, cross: 1 },
});

const waitForAttackResolved = async (game: GameTestContext, sourceAbilityId: string): Promise<void> => {
    await expect.poll(async () => {
        const state = await readState(game);
        const events = (state.sys?.eventStream?.entries ?? []).map((entry: JsonRecord) => entry?.event ?? entry);
        return {
            pendingAttack: state.core?.pendingAttack ?? null,
            attackResolved: events.some((event: JsonRecord) => (
                event?.type === 'ATTACK_RESOLVED' && event?.payload?.sourceAbilityId === sourceAbilityId
            )),
        };
    }, { timeout: 10000 }).toMatchObject({
        pendingAttack: null,
        attackResolved: true,
    });
};

test.describe('DiceThrone 炽天使技能与专属卡真实入口', () => {
    test('神圣惩戒应从真实槽位投出 4 个额外骰并收口到最终伤害、Token 和状态', async ({ page, game }, testInfo) => {
        await setupTianshiScene(game, {
            phase: 'offensiveRoll',
            dice: [1, 4, 5, 6, 2],
            randomQueue: [1, 4, 5, 6].map(randomValueForDieFace),
            opponentHp: 50,
        });

        await game.screenshot('tianshi-divine-punishment-before-click', testInfo);
        await clickAbilitySlot(page, 'lotus', 'divine-punishment');
        await expect.poll(async () => (await readState(game)).core?.pendingAttack?.sourceAbilityId ?? null, { timeout: 10000 })
            .toBe('divine-punishment');

        await advancePhase(page);
        const overlay = page.getByTestId('bonus-die-overlay');
        await expect(overlay).toBeVisible({ timeout: 10000 });
        await expect.poll(async () => {
            const state = await readState(game);
            const settlement = state.core?.pendingBonusDiceSettlement;
            return {
                sourceAbilityId: settlement?.sourceAbilityId ?? null,
                diceValues: settlement?.dice?.map((die: JsonRecord) => die.value) ?? [],
            };
        }, { timeout: 10000 }).toEqual({
            sourceAbilityId: 'divine-punishment',
            diceValues: [1, 4, 5, 6],
        });
        await game.screenshot('tianshi-divine-punishment-four-bonus-dice', testInfo);

        await settleBonusOverlay(page);
        await expect.poll(async () => {
            const state = await readState(game);
            const tianshi = state.core?.players?.['0'];
            const monk = state.core?.players?.['1'];
            return {
                pendingSettlement: state.core?.pendingBonusDiceSettlement ?? null,
                pendingAttack: state.core?.pendingAttack ?? null,
                opponentHp: monk?.resources?.[RESOURCE_IDS.HP] ?? null,
                flight: tianshi?.tokens?.[TOKEN_IDS.FLIGHT] ?? 0,
                purify: tianshi?.tokens?.[TOKEN_IDS.PURIFY] ?? 0,
                dazzle: monk?.statusEffects?.[STATUS_IDS.DAZZLE] ?? 0,
            };
        }, { timeout: 10000 }).toMatchObject({
            pendingSettlement: null,
            pendingAttack: null,
            opponentHp: 48,
            flight: 1,
            purify: 1,
            dazzle: 1,
        });
        await game.screenshot('tianshi-divine-punishment-after-closeout', testInfo);
    });

    test('圣刃应从真实技能槽位结算基础攻击并回到无临时攻击状态', async ({ page, game }, testInfo) => {
        await setupTianshiScene(game, {
            phase: 'offensiveRoll',
            dice: [1, 2, 3, 4, 5],
            randomQueue: [randomValueForDieFace(1)],
            opponentHp: 50,
        });

        await game.screenshot('tianshi-holy-blade-before-click', testInfo);
        await clickAbilitySlot(page, 'fist', 'holy-blade-3');
        await expect.poll(async () => (await readState(game)).core?.pendingAttack?.sourceAbilityId ?? null, { timeout: 10000 })
            .toBe('holy-blade-3');
        await advanceAttackToCloseout(page, game);
        await waitForAttackResolved(game, 'holy-blade-3');
        await game.screenshot('tianshi-holy-blade-after-closeout', testInfo);
    });

    test('圣洁光辉应从真实技能槽位造成攻击并获得飞行', async ({ page, game }, testInfo) => {
        await setupTianshiScene(game, {
            phase: 'offensiveRoll',
            dice: [1, 1, 1, 4, 2],
            randomQueue: [randomValueForDieFace(1)],
            opponentHp: 50,
        });

        await game.screenshot('tianshi-holy-radiance-before-click', testInfo);
        await clickAbilitySlot(page, 'chi', 'holy-radiance');
        await expect.poll(async () => (await readState(game)).core?.pendingAttack?.sourceAbilityId ?? null, { timeout: 10000 })
            .toBe('holy-radiance');
        await advanceAttackToCloseout(page, game);
        await waitForAttackResolved(game, 'holy-radiance');
        await expect.poll(async () => (await readState(game)).core?.players?.['0']?.tokens?.[TOKEN_IDS.FLIGHT] ?? 0, { timeout: 10000 })
            .toBe(1);
        await game.screenshot('tianshi-holy-radiance-after-closeout', testInfo);
    });

    test('无上之力应从真实技能槽位结算飞行、神圣降临、眩光和攻击', async ({ page, game }, testInfo) => {
        await setupTianshiScene(game, {
            phase: 'offensiveRoll',
            dice: [6, 6, 6, 6, 1],
            randomQueue: [randomValueForDieFace(1)],
            opponentHp: 50,
        });

        await game.screenshot('tianshi-supreme-power-before-click', testInfo);
        await clickAbilitySlot(page, 'lightning', 'supreme-power');
        await expect.poll(async () => (await readState(game)).core?.pendingAttack?.sourceAbilityId ?? null, { timeout: 10000 })
            .toBe('supreme-power');
        await advanceAttackToCloseout(page, game);
        await waitForAttackResolved(game, 'supreme-power');
        await expect.poll(async () => {
            const state = await readState(game);
            return {
                flight: state.core?.players?.['0']?.tokens?.[TOKEN_IDS.FLIGHT] ?? 0,
                divineArrival: state.core?.players?.['0']?.tokens?.[TOKEN_IDS.DIVINE_ARRIVAL] ?? 0,
                dazzle: state.core?.players?.['1']?.statusEffects?.[STATUS_IDS.DAZZLE] ?? 0,
            };
        }, { timeout: 10000 }).toEqual({ flight: 1, divineArrival: 1, dazzle: 1 });
        await game.screenshot('tianshi-supreme-power-after-closeout', testInfo);
    });

    test('天使长之志应从真实技能槽位结算大顺子攻击并获得飞行与眩光', async ({ page, game }, testInfo) => {
        await setupTianshiScene(game, {
            phase: 'offensiveRoll',
            dice: [1, 2, 3, 4, 5],
            randomQueue: [randomValueForDieFace(1)],
            opponentHp: 50,
        });

        await game.screenshot('tianshi-archangel-resolve-before-click', testInfo);
        await clickAbilitySlot(page, 'calm', 'archangel-resolve');
        await expect.poll(async () => (await readState(game)).core?.pendingAttack?.sourceAbilityId ?? null, { timeout: 10000 })
            .toBe('archangel-resolve');
        await advanceAttackToCloseout(page, game);
        await waitForAttackResolved(game, 'archangel-resolve');
        await expect.poll(async () => {
            const state = await readState(game);
            return {
                flight: state.core?.players?.['0']?.tokens?.[TOKEN_IDS.FLIGHT] ?? 0,
                dazzle: state.core?.players?.['1']?.statusEffects?.[STATUS_IDS.DAZZLE] ?? 0,
            };
        }, { timeout: 10000 }).toEqual({ flight: 1, dazzle: 1 });
        await game.screenshot('tianshi-archangel-resolve-after-closeout', testInfo);
    });

    test('天堂断腕斩应从真实终极技能槽位结算攻击并获得三种终极 Token', async ({ page, game }, testInfo) => {
        await setupTianshiScene(game, {
            phase: 'offensiveRoll',
            dice: [6, 6, 6, 6, 6],
            opponentHp: 50,
        });

        await game.screenshot('tianshi-heavenly-severing-before-click', testInfo);
        await clickAbilitySlot(page, 'ultimate', 'heavenly-severing');
        await expect.poll(async () => (await readState(game)).core?.pendingAttack?.sourceAbilityId ?? null, { timeout: 10000 })
            .toBe('heavenly-severing');
        await advanceAttackToCloseout(page, game);
        await waitForAttackResolved(game, 'heavenly-severing');
        await expect.poll(async () => {
            const state = await readState(game);
            return {
                flight: state.core?.players?.['0']?.tokens?.[TOKEN_IDS.FLIGHT] ?? 0,
                divineArrival: state.core?.players?.['0']?.tokens?.[TOKEN_IDS.DIVINE_ARRIVAL] ?? 0,
                blessing: state.core?.players?.['0']?.tokens?.[TOKEN_IDS.BLESSING_OF_DIVINITY] ?? 0,
            };
        }, { timeout: 10000 }).toEqual({ flight: 1, divineArrival: 1, blessing: 1 });
        await game.screenshot('tianshi-heavenly-severing-after-closeout', testInfo);
    });

    test('凯旋归来应从真实槽位进入奖励骰浮层并在关闭后回到无临时结算', async ({ page, game }, testInfo) => {
        await setupTianshiScene(game, {
            phase: 'offensiveRoll',
            dice: [1, 2, 3, 4, 5],
            randomQueue: [randomValueForDieFace(4)],
            opponentHp: 50,
        });

        await clickAbilitySlot(page, 'combo', 'triumphant-return');
        await expect.poll(async () => (await readState(game)).core?.pendingAttack?.sourceAbilityId ?? null, { timeout: 10000 })
            .toBe('triumphant-return');
        await advancePhase(page);
        await expect(page.getByTestId('bonus-die-overlay')).toBeVisible({ timeout: 10000 });
        await game.screenshot('tianshi-triumphant-return-bonus-die', testInfo);
        await settleBonusOverlay(page);

        await expect.poll(async () => {
            const state = await readState(game);
            return {
                pendingSettlement: state.core?.pendingBonusDiceSettlement ?? null,
                pendingAttack: state.core?.pendingAttack ?? null,
            };
        }, { timeout: 10000 }).toMatchObject({
            pendingSettlement: null,
            pendingAttack: null,
        });

        await expect.poll(async () => {
            const state = await readState(game);
            const events = (state.sys?.eventStream?.entries ?? []).map((entry: JsonRecord) => entry?.event ?? entry);
            const attackResolved = events.find((event: JsonRecord) => (
                event?.type === 'ATTACK_RESOLVED' && event?.payload?.sourceAbilityId === 'triumphant-return'
            ));
            return {
                pendingSettlement: state.core?.pendingBonusDiceSettlement ?? null,
                pendingAttack: state.core?.pendingAttack ?? null,
                opponentHp: state.core?.players?.['1']?.resources?.[RESOURCE_IDS.HP] ?? null,
                attackResolvedDamage: attackResolved?.payload?.totalDamage ?? null,
                taijiReductions: events.filter((event: JsonRecord) => (
                    event?.type === 'TOKEN_USED' &&
                    event?.payload?.tokenId === TOKEN_IDS.TAIJI &&
                    event?.payload?.effectType === 'damageReduction'
                )).length,
            };
        }, { timeout: 10000 }).toMatchObject({
            pendingSettlement: null,
            pendingAttack: null,
            opponentHp: 47,
            attackResolvedDamage: 3,
            taijiReductions: 5,
        });
        await game.screenshot('tianshi-triumphant-return-after-closeout', testInfo);
    });

    test('天使斗篷应在真实防御阶段打开可重投奖励骰，并免费重投一次后收口', async ({ page, game }, testInfo) => {
        await setupTianshiScene(game, {
            phase: 'defensiveRoll',
            dice: [1, 1, 1, 1, 1],
            randomQueue: [randomValueForDieFace(1), randomValueForDieFace(6)],
            pendingAttack: {
                attackerId: '1',
                defenderId: '0',
                sourceAbilityId: 'holy-blade',
                isDefendable: true,
                damage: 5,
            },
        });

        await game.screenshot('tianshi-angelic-cloak-defense-before-click', testInfo);
        await clickAbilitySlot(page, 'meditate', 'angelic-cloak');
        await advancePhase(page);

        const overlay = page.getByTestId('bonus-die-overlay');
        await expect(overlay).toBeVisible({ timeout: 10000 });
        await expect.poll(async () => {
            const state = await readState(game);
            const settlement = state.core?.pendingBonusDiceSettlement;
            return {
                sourceAbilityId: settlement?.sourceAbilityId ?? null,
                rerollCount: settlement?.rerollCount ?? null,
                maxRerollCount: settlement?.maxRerollCount ?? null,
                dieValue: settlement?.dice?.[0]?.value ?? null,
                rerollCost: settlement?.rerollCostAmount ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            sourceAbilityId: 'angelic-cloak',
            rerollCount: 0,
            maxRerollCount: 1,
            dieValue: 1,
            rerollCost: 0,
        });
        await game.screenshot('tianshi-angelic-cloak-reroll-open', testInfo);

        const rerollOption = page.getByTestId('bonus-die-reroll-option-0');
        await expect(rerollOption).toBeEnabled({ timeout: 5000 });
        await rerollOption.click({ force: true });
        await expect.poll(async () => {
            const state = await readState(game);
            return {
                rerollCount: state.core?.pendingBonusDiceSettlement?.rerollCount ?? null,
                dieValue: state.core?.pendingBonusDiceSettlement?.dice?.[0]?.value ?? null,
            };
        }, { timeout: 10000 }).toEqual({ rerollCount: 1, dieValue: 6 });
        await expect(rerollOption).toBeDisabled({ timeout: 5000 });
        await game.screenshot('tianshi-angelic-cloak-reroll-limit', testInfo);

        await settleBonusOverlay(page);
        await expect.poll(async () => {
            const state = await readState(game);
            return {
                pendingSettlement: state.core?.pendingBonusDiceSettlement ?? null,
                pendingAttack: state.core?.pendingAttack ?? null,
                flight: state.core?.players?.['0']?.tokens?.[TOKEN_IDS.FLIGHT] ?? 0,
                shield: state.core?.players?.['0']?.damageShields?.[0]?.value ?? null,
                shieldGranted: (state.sys?.eventStream?.entries ?? [])
                    .map((entry: JsonRecord) => entry?.event)
                    .find((event: JsonRecord) => event?.type === 'DAMAGE_SHIELD_GRANTED')
                    ?.payload?.value ?? null,
            };
        }, { timeout: 10000 }).toMatchObject({
            pendingSettlement: null,
            pendingAttack: null,
            flight: 0,
            shield: null,
            shieldGranted: 3,
        });
        await game.screenshot('tianshi-angelic-cloak-after-closeout', testInfo);
    });

    test('复合升级牌福音临世应从真实手牌支付 CP、替换技能并通过玩家卡片选择目标', async ({ page, game }, testInfo) => {
        await setupTianshiScene(game, {
            phase: 'main1',
            hand: ['upgrade-tianshi-supreme-power-2-gospel-arrival'],
            cp: 10,
        });

        await game.screenshot('tianshi-gospel-arrival-before-play', testInfo);
        await dragHandCardToPlay(page, 'upgrade-tianshi-supreme-power-2-gospel-arrival');

        await expect.poll(async () => {
            const state = await readState(game);
            const tianshi = state.core?.players?.['0'];
            const interaction = state.sys?.interaction?.current;
            return {
                handIds: tianshi?.hand?.map((card: JsonRecord) => card.id) ?? [],
                discardIds: tianshi?.discard?.map((card: JsonRecord) => card.id) ?? [],
                cp: tianshi?.resources?.[RESOURCE_IDS.CP] ?? null,
                abilityLevel: tianshi?.abilityLevels?.['supreme-power'] ?? null,
                upgradeCardId: tianshi?.upgradeCardByAbilityId?.['supreme-power']?.cardId ?? null,
                interactionType: interaction?.kind === 'card' ? interaction?.data?.type : interaction?.data?.type ?? null,
                targetPlayerIds: interaction?.data?.targetPlayerIds ?? [],
            };
        }, { timeout: 10000 }).toMatchObject({
            handIds: [],
            discardIds: [],
            cp: 8,
            abilityLevel: 2,
            upgradeCardId: 'upgrade-tianshi-supreme-power-2-gospel-arrival',
            interactionType: 'selectPlayer',
            targetPlayerIds: ['1'],
        });
        await expect(page.getByTestId('dt-player-target-1')).toBeVisible({ timeout: 5000 });
        await game.screenshot('tianshi-gospel-arrival-target-choice', testInfo);
        await selectPlayerTarget(page, '1');

        await expect.poll(async () => {
            const state = await readState(game);
            return {
                interaction: state.sys?.interaction?.current ?? null,
                divineArrival: state.core?.players?.['0']?.tokens?.[TOKEN_IDS.DIVINE_ARRIVAL] ?? 0,
                purify: state.core?.players?.['0']?.tokens?.[TOKEN_IDS.PURIFY] ?? 0,
                dazzle: state.core?.players?.['1']?.statusEffects?.[STATUS_IDS.DAZZLE] ?? 0,
            };
        }, { timeout: 10000 }).toMatchObject({
            interaction: null,
            divineArrival: 1,
            purify: 2,
            dazzle: 1,
        });
        await game.screenshot('tianshi-gospel-arrival-after-target', testInfo);
    });

    test('神圣净化应从真实技能槽位打开玩家目标选择并支持选择自身后的可选状态移除跳过', async ({ page, game }, testInfo) => {
        await setupTianshiScene(game, {
            phase: 'offensiveRoll',
            dice: [5, 5, 6, 1, 2],
            hp: 40,
            opponentHp: 50,
            statuses: { [STATUS_IDS.POISON]: 1 },
            extra: {
                // 让测试明确落在技能结算而不是默认空态；选择自身后再验证可选清理窗口。
                pendingAttack: null,
            },
        });

        await clickAbilitySlot(page, 'sky', 'divine-purification');
        await advancePhase(page);
        await expect(page.getByText('神圣净化：选择一名玩家')).toBeVisible({ timeout: 10000 });
        await expect(page.getByRole('button', { name: '玩家 0' })).toBeVisible({ timeout: 10000 });
        await expect(page.getByRole('button', { name: '玩家 1' })).toBeVisible({ timeout: 10000 });
        await game.screenshot('tianshi-divine-purification-target-choice', testInfo);
        await page.getByRole('button', { name: '玩家 0' }).click();

        await expect.poll(async () => {
            const state = await readState(game);
            const interaction = state.sys?.interaction?.current;
            return {
                hp: state.core?.players?.['0']?.resources?.[RESOURCE_IDS.HP] ?? null,
                interactionType: interaction?.kind === 'card' ? interaction?.data?.type : interaction?.data?.type ?? null,
                sourceCardId: interaction?.data?.sourceCardId ?? null,
            };
        }, { timeout: 10000 }).toMatchObject({
            hp: 44,
            interactionType: 'selectStatus',
            sourceCardId: 'divine-purification',
        });
        await expect(page.getByTestId(`dt-status-owner-0`)).toBeVisible({ timeout: 5000 });
        await game.screenshot('tianshi-divine-purification-optional-status-choice', testInfo);

        const confirm = page.locator('#modal-root').getByRole('button', { name: /^确认$/ });
        await expect(confirm).toBeEnabled({ timeout: 5000 });
        await confirm.click();
        await expect.poll(async () => {
            const state = await readState(game);
            return {
                interaction: state.sys?.interaction?.current ?? null,
                hp: state.core?.players?.['0']?.resources?.[RESOURCE_IDS.HP] ?? null,
            };
        }, { timeout: 10000 }).toMatchObject({ interaction: null, hp: 44 });
        await game.screenshot('tianshi-divine-purification-after-skip', testInfo);
    });

    test('圣击专属牌应从真实攻击修正入口投出五个奖励骰并施加眩光', async ({ page, game }, testInfo) => {
        const cardId = 'card-tianshi-holy-strike';
        await setupTianshiScene(game, {
            phase: 'offensiveRoll',
            hand: [cardId],
            cp: 10,
            randomQueue: [1, 4, 4, 1, 1].map(randomValueForDieFace),
            pendingAttack: pendingAttackForCard(),
        });

        await dragHandCardToPlay(page, cardId);
        await expect.poll(async () => (await readState(game)).core?.pendingBonusDiceSettlement?.sourceAbilityId ?? null, { timeout: 10000 })
            .toBe(cardId);
        await expect.poll(async () => (await readState(game)).core?.pendingBonusDiceSettlement?.dice?.map((die: JsonRecord) => die.value) ?? [], { timeout: 10000 })
            .toEqual([1, 4, 4, 1, 1]);
        await settleBonusOverlay(page);
        await expectCardConsumed(game, cardId, 9);
        await expect.poll(async () => {
            const state = await readState(game);
            return {
                dazzle: state.core?.players?.['1']?.statusEffects?.[STATUS_IDS.DAZZLE] ?? 0,
                bonusDamage: state.core?.pendingAttack?.bonusDamage ?? 0,
            };
        }, { timeout: 10000 }).toMatchObject({ dazzle: 1 });
        await game.screenshot('tianshi-holy-strike-card-after-closeout', testInfo);
    });

    test('天使战术专属牌应从真实攻击修正入口投出奖励骰并获得飞行', async ({ page, game }, testInfo) => {
        const cardId = 'card-tianshi-angelic-tactics';
        await setupTianshiScene(game, {
            phase: 'offensiveRoll',
            hand: [cardId],
            cp: 10,
            randomQueue: [4].map(randomValueForDieFace),
            pendingAttack: pendingAttackForCard(),
        });

        await dragHandCardToPlay(page, cardId);
        await expect.poll(async () => (await readState(game)).core?.pendingBonusDiceSettlement?.sourceAbilityId ?? null, { timeout: 10000 })
            .toBe(cardId);
        await settleBonusOverlay(page);
        await expectCardConsumed(game, cardId, 9);
        await expect.poll(async () => (await readState(game)).core?.players?.['0']?.tokens?.[TOKEN_IDS.FLIGHT] ?? 0, { timeout: 10000 })
            .toBe(1);
        await game.screenshot('tianshi-angelic-tactics-card-after-closeout', testInfo);
    });

    test('神圣指令复合升级牌应从真实手牌升级神圣惩戒并完成目标伤害', async ({ page, game }, testInfo) => {
        const cardId = 'upgrade-tianshi-divine-punishment-2-divine-command';
        await setupTianshiScene(game, { phase: 'main1', hand: [cardId], cp: 10, hp: 49, opponentHp: 50 });

        await dragHandCardToPlay(page, cardId);
        await expectCardConsumed(game, cardId, 8, []);
        await expect.poll(async () => (await readState(game)).core?.players?.['0']?.abilityLevels?.['divine-punishment'] ?? null, { timeout: 10000 })
            .toBe(2);
        await expect.poll(async () => (await readState(game)).sys?.interaction?.current?.data?.type ?? null, { timeout: 10000 })
            .toBe('selectPlayer');
        await selectPlayerTarget(page, '1');
        await expect.poll(async () => {
            const state = await readState(game);
            return {
                hp: state.core?.players?.['0']?.resources?.[RESOURCE_IDS.HP] ?? null,
                opponentHp: state.core?.players?.['1']?.resources?.[RESOURCE_IDS.HP] ?? null,
                interaction: state.sys?.interaction?.current ?? null,
            };
        }, { timeout: 10000 }).toMatchObject({ hp: 50, opponentHp: 46, interaction: null });
        await game.screenshot('tianshi-divine-command-card-after-target', testInfo);
    });

    test('神圣净化 II 升级牌应从真实手牌支付 CP 并替换技能', async ({ page, game }, testInfo) => {
        const cardId = 'upgrade-tianshi-divine-purification-2';
        await setupTianshiScene(game, { phase: 'main1', hand: [cardId], cp: 10 });

        await dragHandCardToPlay(page, cardId);
        await expectCardConsumed(game, cardId, 8, []);
        await expect.poll(async () => (await readState(game)).core?.players?.['0']?.abilityLevels?.['divine-purification'] ?? null, { timeout: 10000 })
            .toBe(2);
        await game.screenshot('tianshi-divine-purification-upgrade-card-after-play', testInfo);
    });

    test('神圣庇护复合升级牌应升级天使长之志并通过真实玩家卡片授予 Token', async ({ page, game }, testInfo) => {
        const cardId = 'upgrade-tianshi-archangel-resolve-2-divine-protection';
        await setupTianshiScene(game, { phase: 'main1', hand: [cardId], cp: 10 });

        await dragHandCardToPlay(page, cardId);
        await expectCardConsumed(game, cardId, 8, []);
        await expect.poll(async () => (await readState(game)).core?.players?.['0']?.abilityLevels?.['archangel-resolve'] ?? null, { timeout: 10000 })
            .toBe(2);
        await selectPlayerTarget(page, '0');
        await expect.poll(async () => {
            const state = await readState(game);
            return {
                flight: state.core?.players?.['0']?.tokens?.[TOKEN_IDS.FLIGHT] ?? 0,
                purify: state.core?.players?.['0']?.tokens?.[TOKEN_IDS.PURIFY] ?? 0,
                interaction: state.sys?.interaction?.current ?? null,
            };
        }, { timeout: 10000 }).toMatchObject({ flight: 2, purify: 2, interaction: null });
        await game.screenshot('tianshi-divine-protection-card-after-target', testInfo);
    });

    test('天使斗篷 III 升级牌应从真实手牌替换防御技能并支付 3 CP', async ({ page, game }, testInfo) => {
        const cardId = 'upgrade-tianshi-angelic-cloak-3';
        await setupTianshiScene(game, { phase: 'main1', hand: [cardId], cp: 10 });

        await dragHandCardToPlay(page, cardId);
        await expectCardConsumed(game, cardId, 7, []);
        await expect.poll(async () => (await readState(game)).core?.players?.['0']?.abilityLevels?.['angelic-cloak'] ?? null, { timeout: 10000 })
            .toBe(3);
        await game.screenshot('tianshi-angelic-cloak-3-upgrade-card-after-play', testInfo);
    });

    test('天使斗篷 II 升级牌应从真实手牌替换防御技能并支付 2 CP', async ({ page, game }, testInfo) => {
        const cardId = 'upgrade-tianshi-angelic-cloak-2';
        await setupTianshiScene(game, { phase: 'main1', hand: [cardId], cp: 10 });

        await dragHandCardToPlay(page, cardId);
        await expectCardConsumed(game, cardId, 8, []);
        await expect.poll(async () => (await readState(game)).core?.players?.['0']?.abilityLevels?.['angelic-cloak'] ?? null, { timeout: 10000 })
            .toBe(2);
        await game.screenshot('tianshi-angelic-cloak-2-upgrade-card-after-play', testInfo);
    });

    test('凯旋归来 II 升级牌应从真实手牌替换技能并支付 2 CP', async ({ page, game }, testInfo) => {
        const cardId = 'upgrade-tianshi-triumphant-return-2';
        await setupTianshiScene(game, { phase: 'main1', hand: [cardId], cp: 10 });

        await dragHandCardToPlay(page, cardId);
        await expectCardConsumed(game, cardId, 8, []);
        await expect.poll(async () => (await readState(game)).core?.players?.['0']?.abilityLevels?.['triumphant-return'] ?? null, { timeout: 10000 })
            .toBe(2);
        await game.screenshot('tianshi-triumphant-return-2-upgrade-card-after-play', testInfo);
    });

    test('起飞复合升级牌应升级圣洁光辉并通过真实玩家卡片造成不可防御伤害', async ({ page, game }, testInfo) => {
        const cardId = 'upgrade-tianshi-holy-radiance-2-takeoff';
        await setupTianshiScene(game, { phase: 'main1', hand: [cardId], cp: 10, opponentHp: 50 });

        await dragHandCardToPlay(page, cardId);
        await expectCardConsumed(game, cardId, 8, []);
        await expect.poll(async () => (await readState(game)).core?.players?.['0']?.abilityLevels?.['holy-radiance'] ?? null, { timeout: 10000 })
            .toBe(2);
        await selectPlayerTarget(page, '1');
        await expect.poll(async () => {
            const state = await readState(game);
            return {
                flight: state.core?.players?.['1']?.tokens?.[TOKEN_IDS.FLIGHT] ?? 0,
                opponentHp: state.core?.players?.['1']?.resources?.[RESOURCE_IDS.HP] ?? null,
                interaction: state.sys?.interaction?.current ?? null,
            };
        }, { timeout: 10000 }).toMatchObject({ flight: 1, opponentHp: 47, interaction: null });
        await game.screenshot('tianshi-takeoff-card-after-target', testInfo);
    });

    test('小天使 II 复合升级牌应升级圣刃到 III 级并获得三种 Token', async ({ page, game }, testInfo) => {
        const cardId = 'upgrade-tianshi-holy-blade-3-cherub-2';
        await setupTianshiScene(game, { phase: 'main1', hand: [cardId], cp: 10 });

        await dragHandCardToPlay(page, cardId);
        await expectCardConsumed(game, cardId, 6, []);
        await expect.poll(async () => {
            const state = await readState(game);
            const player = state.core?.players?.['0'];
            return {
                level: player?.abilityLevels?.['holy-blade'] ?? null,
                flight: player?.tokens?.[TOKEN_IDS.FLIGHT] ?? 0,
                purify: player?.tokens?.[TOKEN_IDS.PURIFY] ?? 0,
                divineArrival: player?.tokens?.[TOKEN_IDS.DIVINE_ARRIVAL] ?? 0,
                interaction: state.sys?.interaction?.current ?? null,
            };
        }, { timeout: 10000 }).toMatchObject({ level: 3, flight: 1, purify: 1, divineArrival: 1, interaction: null });
        await game.screenshot('tianshi-cherub-2-card-after-play', testInfo);
    });

    test('神圣裁决应从真实手牌完成三段玩家选择并留下神圣降临、眩光、飞行和净化', async ({ page, game }, testInfo) => {
        const cardId = 'card-tianshi-divine-arbitration';
        await setupTianshiScene(game, { phase: 'main1', hand: [cardId], cp: 10 });

        await dragHandCardToPlay(page, cardId);
        await expectCardConsumed(game, cardId, 6);
        await expect.poll(async () => {
            const state = await readState(game);
            return {
                arrival: state.core?.players?.['0']?.tokens?.[TOKEN_IDS.DIVINE_ARRIVAL] ?? 0,
                interaction: state.sys?.interaction?.current ?? null,
            };
        }, { timeout: 10000 }).toMatchObject({ arrival: 1 });
        await selectChoicePlayer(page, '1');
        await expect.poll(async () => (await readState(game)).core?.players?.['1']?.statusEffects?.[STATUS_IDS.DAZZLE] ?? 0, { timeout: 10000 })
            .toBe(1);
        await game.screenshot('tianshi-divine-arbitration-flight-choice', testInfo);
        await selectChoicePlayer(page, '0');
        await expect.poll(async () => {
            const state = await readState(game);
            return {
                flight: state.core?.players?.['0']?.tokens?.[TOKEN_IDS.FLIGHT] ?? 0,
                interaction: state.sys?.interaction?.current ?? null,
            };
        }, { timeout: 10000 }).toMatchObject({ flight: 2 });
        await game.screenshot('tianshi-divine-arbitration-purify-choice', testInfo);
        await selectChoicePlayer(page, '0');
        await expect.poll(async () => {
            const state = await readState(game);
            return {
                purify: state.core?.players?.['0']?.tokens?.[TOKEN_IDS.PURIFY] ?? 0,
                interaction: state.sys?.interaction?.current ?? null,
            };
        }, { timeout: 10000 }).toMatchObject({ purify: 1, interaction: null });
        await game.screenshot('tianshi-divine-arbitration-card-after-choices', testInfo);
    });

    test('至高圣洁应从真实手牌投出奖励骰并在圣洁吊坠分支获得两种 Token', async ({ page, game }, testInfo) => {
        const cardId = 'card-tianshi-supreme-holiness';
        await setupTianshiScene(game, {
            phase: 'main1',
            hand: [cardId],
            cp: 10,
            randomQueue: [6].map(randomValueForDieFace),
        });

        await dragHandCardToPlay(page, cardId);
        await expect.poll(async () => (await readState(game)).core?.pendingBonusDiceSettlement?.sourceAbilityId ?? null, { timeout: 10000 })
            .toBe(cardId);
        await settleBonusOverlay(page);
        await expectCardConsumed(game, cardId, 10);
        await expect.poll(async () => {
            const state = await readState(game);
            const player = state.core?.players?.['0'];
            return {
                flight: player?.tokens?.[TOKEN_IDS.FLIGHT] ?? 0,
                purify: player?.tokens?.[TOKEN_IDS.PURIFY] ?? 0,
            };
        }, { timeout: 10000 }).toEqual({ flight: 2, purify: 2 });
        await game.screenshot('tianshi-supreme-holiness-card-after-closeout', testInfo);
    });

    test('飞升应从真实手牌打开玩家卡片选择并授予目标飞行', async ({ page, game }, testInfo) => {
        const cardId = 'card-tianshi-ascension';
        await setupTianshiScene(game, { phase: 'main1', hand: [cardId], cp: 10 });

        await dragHandCardToPlay(page, cardId);
        await expectCardConsumed(game, cardId, 9);
        await expect.poll(async () => (await readState(game)).sys?.interaction?.current?.data?.type ?? null, { timeout: 10000 })
            .toBe('selectPlayer');
        await selectPlayerTarget(page, '1');
        await expect.poll(async () => {
            const state = await readState(game);
            return {
                flight: state.core?.players?.['1']?.tokens?.[TOKEN_IDS.FLIGHT] ?? 0,
                interaction: state.sys?.interaction?.current ?? null,
            };
        }, { timeout: 10000 }).toMatchObject({ flight: 1, interaction: null });
        await game.screenshot('tianshi-ascension-card-after-target', testInfo);
    });

    test('小天使复合升级牌应从真实手牌升级圣刃到 II 级并获得两种 Token', async ({ page, game }, testInfo) => {
        const cardId = 'upgrade-tianshi-holy-blade-2-cherub';
        await setupTianshiScene(game, { phase: 'main1', hand: [cardId], cp: 10 });

        await dragHandCardToPlay(page, cardId);
        await expectCardConsumed(game, cardId, 8, []);
        await expect.poll(async () => {
            const state = await readState(game);
            const player = state.core?.players?.['0'];
            return {
                level: player?.abilityLevels?.['holy-blade'] ?? null,
                flight: player?.tokens?.[TOKEN_IDS.FLIGHT] ?? 0,
                divineArrival: player?.tokens?.[TOKEN_IDS.DIVINE_ARRIVAL] ?? 0,
                purify: player?.tokens?.[TOKEN_IDS.PURIFY] ?? 0,
            };
        }, { timeout: 10000 }).toEqual({ level: 2, flight: 1, divineArrival: 1, purify: 0 });
        await game.screenshot('tianshi-cherub-card-after-play', testInfo);
    });
});
