/**
 * DiceThrone 炽天使技能与专属卡真实入口补证。
 *
 * 本文件只走当前 /play/dicethrone 测试入口：技能点击玩家板槽位，卡牌从真实手牌拖拽，
 * 目标选择点击真实玩家卡片，奖励骰始终由右侧骰盘完成重掷/确认，最后回读 TestHarness 权威状态。
 */

import type { Page } from '@playwright/test';
import { expect, test } from '../framework';
import type { GameTestContext } from '../framework';
import { RESOURCE_IDS } from '../../src/games/dicethrone/domain/resources';
import { STATUS_IDS, TOKEN_IDS } from '../../src/games/dicethrone/domain/ids';
import { ALL_TOKEN_DEFINITIONS } from '../../src/games/dicethrone/domain/characters';
import { buildDiceThroneTokenResponseChoiceCandidates } from '../../src/games/dicethrone/domain/timingOpportunities';
import { setDiceThroneBonusDiceValues } from '../helpers/dicethrone';
import { expectRightTrayBonusDiceConfirmation, settleCurrentBonusDice, waitForDiceThroneVisualIdle } from './bonus-dice-flow';
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
        opponentHand?: string[];
        cp?: number;
        hp?: number;
        opponentHp?: number;
        currentPlayer?: string;
        currentPlayerIndex?: number;
        randomQueue?: number[];
        pendingAttack?: JsonRecord | null;
        tokens?: Record<string, number>;
        statuses?: Record<string, number>;
        opponentTokens?: Record<string, number>;
        opponentStatuses?: Record<string, number>;
        disableLocalAiAutomation?: boolean;
        extra?: JsonRecord;
    },
): Promise<void> => {
    await game.openTestGame('dicethrone', {
        playerID: '0',
        ...(options.disableLocalAiAutomation ? { disableLocalAiAutomation: true } : {}),
    });
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
            hand: options.opponentHand ?? [],
            resources: { [RESOURCE_IDS.CP]: 10, [RESOURCE_IDS.HP]: options.opponentHp ?? 50 },
            tokens: options.opponentTokens ?? {},
        },
        currentPlayer: options.currentPlayer ?? '0',
        phase: options.phase,
        sys: {
            phase: options.phase,
            currentPlayerIndex: options.currentPlayerIndex ?? 0,
            interaction: { current: undefined, queue: [] },
            responseWindow: { current: undefined },
        },
        extra: {
            selectedCharacters: { '0': TIANSHI, '1': MONK },
            hostStarted: true,
            activePlayerId: options.currentPlayer ?? '0',
            currentPlayer: options.currentPlayer ?? '0',
            currentPlayerIndex: options.currentPlayerIndex ?? 0,
            rollCount: 1,
            rollLimit: 3,
            rollDiceCount: 5,
            rollConfirmed: true,
            ...(options.dice ? { dice: makeDice(options.dice) } : {}),
            pendingAttack: options.pendingAttack ?? null,
            pendingDamage: null,
            pendingBonusDiceSettlement: undefined,
            activatingAbilityId: undefined,
            // 真实对局初始化会注册完整标记定义；响应窗口依赖它判断飞行是否可用。
            tokenDefinitions: ALL_TOKEN_DEFINITIONS,
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

const expectRightTrayDiceDefinitions = async (
    page: Page,
    expectedDefinitionId: string,
    expectedCount: number,
    expectedOwnerId?: string,
): Promise<void> => {
    const diceTray = page.getByTestId('dicethrone-2d-dice-tray');
    await expect(diceTray).toBeVisible({ timeout: 10000 });
    await expect(diceTray.getByTestId('dice-2d')).toHaveCount(expectedCount);
    await expect(page.getByTestId('dice-2d')).toHaveCount(expectedCount);
    await expect.poll(async () => (
        diceTray.locator('[data-testid^="die-button-"]').evaluateAll(elements => (
            elements.map(element => element.getAttribute('data-definition-id'))
        ))
    ), { timeout: 10000 }).toEqual(Array.from({ length: expectedCount }, () => expectedDefinitionId));
    if (expectedOwnerId !== undefined) {
        await expect.poll(async () => (
            diceTray.locator('[data-testid^="die-button-"]').evaluateAll(elements => (
                elements.map(element => element.getAttribute('data-owner-id'))
            ))
        ), { timeout: 10000 }).toEqual(Array.from({ length: expectedCount }, () => expectedOwnerId));
    }
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

const dismissAttackShowcaseIfVisible = async (page: Page): Promise<void> => {
    const showcase = page.getByTestId('attack-showcase-overlay').first();
    if (!await showcase.isVisible({ timeout: 1500 }).catch(() => false)) return;

    const continueButton = showcase.getByRole('button', { name: /开始防御|继续|Defend|Continue/i }).first();
    await expect(continueButton).toBeVisible({ timeout: 5000 });
    await continueButton.click();
    await expect(showcase).toHaveCount(0, { timeout: 8000 });
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
    // Framer Motion 需要至少一个渲染节拍写入 drag offset；连续同步事件会偶发
    // 在 offset 还是 0 时触发全局 pointerup，使手牌回弹而不是打出。
    await page.waitForTimeout(50);
    await page.mouse.move(startX, Math.max(24, startY - 280), { steps: 18 });
    await page.waitForTimeout(50);
    await page.mouse.up();
    await page.mouse.move(2, 2);
}

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
    test('神圣惩戒应先在右侧显示 4 个额外骰，确认后才收口到最终伤害、Token 和状态', async ({ page, game }, testInfo) => {
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
        await expectRightTrayBonusDiceConfirmation(page, () => readState(game), { sourceAbilityId: 'divine-punishment' });
        const diceTray = page.getByTestId('dicethrone-2d-dice-tray');
        await expect(diceTray.getByTestId('dice-2d')).toHaveCount(4);
        await expect(diceTray.getByTestId('die-button-0')).toHaveAttribute('data-clickable', 'false');
        await expect.poll(async () => {
            const state = await readState(game);
            return {
                pendingSettlement: state.core?.pendingBonusDiceSettlement ?? null,
                pendingAttack: state.core?.pendingAttack ?? null,
                opponentHp: state.core?.players?.['1']?.resources?.[RESOURCE_IDS.HP] ?? null,
                flight: state.core?.players?.['0']?.tokens?.[TOKEN_IDS.FLIGHT] ?? 0,
                purify: state.core?.players?.['0']?.tokens?.[TOKEN_IDS.PURIFY] ?? 0,
                dazzle: state.core?.players?.['1']?.statusEffects?.[STATUS_IDS.DAZZLE] ?? 0,
            };
        }, { timeout: 10000 }).toMatchObject({
            pendingSettlement: expect.any(Object),
            opponentHp: 50,
            flight: 0,
            purify: 0,
            dazzle: 0,
        });
        // 骰子翻转结束后才截图，保证玩家能读到四个最终骰面而不是动画中间帧。
        await waitForDiceThroneVisualIdle(page);
        await game.screenshot('tianshi-divine-punishment-right-tray-before-confirm', testInfo);
        await settleCurrentBonusDice(page, () => readState(game), { sourceAbilityId: 'divine-punishment' });
        await expect.poll(async () => {
            const state = await readState(game);
            return {
                pendingSettlement: state.core?.pendingBonusDiceSettlement ?? null,
                pendingAttack: state.core?.pendingAttack ?? null,
                opponentHp: state.core?.players?.['1']?.resources?.[RESOURCE_IDS.HP] ?? null,
                flight: state.core?.players?.['0']?.tokens?.[TOKEN_IDS.FLIGHT] ?? 0,
                purify: state.core?.players?.['0']?.tokens?.[TOKEN_IDS.PURIFY] ?? 0,
                dazzle: state.core?.players?.['1']?.statusEffects?.[STATUS_IDS.DAZZLE] ?? 0,
            };
        }, { timeout: 10000 }).toMatchObject({
            pendingSettlement: null,
            pendingAttack: null,
            opponentHp: 48,
            flight: 1,
            purify: 1,
            dazzle: 1,
        });
        await expect(page.getByTestId('dt-top-header-1-hp-value')).toHaveText('48', { timeout: 10000 });
        await waitForDiceThroneVisualIdle(page);
        await game.screenshot('tianshi-divine-punishment-after-confirm', testInfo);
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

    test('凯旋归来奖励骰掷出 6 时应在右侧确认后使攻击不可防御并结算', async ({ page, game }, testInfo) => {
        await setupTianshiScene(game, {
            phase: 'offensiveRoll',
            dice: [1, 2, 3, 4, 5],
            randomQueue: [randomValueForDieFace(6)],
            opponentHp: 50,
        });

        await clickAbilitySlot(page, 'combo', 'triumphant-return');
        await expect.poll(async () => (await readState(game)).core?.pendingAttack?.sourceAbilityId ?? null, { timeout: 10000 })
            .toBe('triumphant-return');
        await advancePhase(page);
        await expectRightTrayBonusDiceConfirmation(page, () => readState(game), { sourceAbilityId: 'triumphant-return' });
        await expect(page.getByTestId('dicethrone-2d-dice-tray').getByTestId('dice-2d')).toHaveCount(1);
        await waitForDiceThroneVisualIdle(page);
        await game.screenshot('tianshi-triumphant-return-right-tray-before-confirm', testInfo);
        await settleCurrentBonusDice(page, () => readState(game), { sourceAbilityId: 'triumphant-return' });
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
                madeUndefendable: events.some((event: JsonRecord) => event?.type === 'ATTACK_MADE_UNDEFENDABLE'),
                taijiReductions: events.filter((event: JsonRecord) => (
                    event?.type === 'TOKEN_USED' &&
                    event?.payload?.tokenId === TOKEN_IDS.TAIJI &&
                    event?.payload?.effectType === 'damageReduction'
                )).length,
            };
        }, { timeout: 10000 }).toMatchObject({
            pendingSettlement: null,
            pendingAttack: null,
            opponentHp: 44,
            attackResolvedDamage: 6,
            madeUndefendable: true,
            taijiReductions: 0,
        });
        await game.screenshot('tianshi-triumphant-return-after-auto-settle', testInfo);
    });

    test('天使斗篷应通过一次普通防御投掷结算反击，并让主攻击扣除炽天使生命', async ({ page, game }, testInfo) => {
        await setupTianshiScene(game, {
            phase: 'defensiveRoll',
            dice: [1, 2, 3, 4, 5],
            currentPlayer: '1',
            currentPlayerIndex: 1,
            disableLocalAiAutomation: true,
            pendingAttack: {
                attackerId: '1',
                defenderId: '0',
                sourceAbilityId: 'fist-technique-5',
                isDefendable: true,
                damage: 8,
            },
            extra: {
                rollCount: 0,
                rollLimit: 1,
                rollDiceCount: 0,
                rollConfirmed: false,
            },
        });

        await game.screenshot('tianshi-angelic-cloak-defense-before-click', testInfo);
        await dismissAttackShowcaseIfVisible(page);
        await clickAbilitySlot(page, 'meditate', 'angelic-cloak');

        await expect.poll(async () => {
            const state = await readState(game);
            return {
                defenseAbilityId: state.core?.pendingAttack?.defenseAbilityId ?? null,
                rollDiceCount: state.core?.rollDiceCount ?? null,
                rollLimit: state.core?.rollLimit ?? null,
                rollCount: state.core?.rollCount ?? null,
                rollConfirmed: state.core?.rollConfirmed ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            defenseAbilityId: 'angelic-cloak',
            rollDiceCount: 1,
            rollLimit: 1,
            rollCount: 0,
            rollConfirmed: false,
        });

        const rollButton = page.locator('[data-tutorial-id="dice-roll-button"]');
        const confirmButton = page.locator('[data-tutorial-id="dice-confirm-button"]');
        const endDefenseButton = page.getByRole('button', { name: /结束防御|End Defense/i }).first();
        await expectRightTrayDiceDefinitions(page, 'tianshi-dice', 1);
        await page.waitForFunction(() => Boolean(window.__BG_TEST_HARNESS__?.dice));
        await page.evaluate(() => {
            window.__BG_TEST_HARNESS__?.dice.setValues([1]);
        });
        await expect(rollButton).toBeEnabled({ timeout: 5000 });
        await rollButton.click();

        await expect.poll(async () => {
            const state = await readState(game);
            return {
                rollCount: state.core?.rollCount ?? null,
                rollConfirmed: state.core?.rollConfirmed ?? null,
                dice: state.core?.dice?.slice(0, 1).map((die: JsonRecord) => die.value) ?? [],
                rollKind: state.core?.currentRollContext?.kind ?? null,
                pendingBonusDiceSettlement: state.core?.pendingBonusDiceSettlement ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            rollCount: 1,
            rollConfirmed: false,
            dice: [1],
            rollKind: 'defensive',
            pendingBonusDiceSettlement: null,
        });
        await expectRightTrayDiceDefinitions(page, 'tianshi-dice', 1);
        await game.screenshot('tianshi-angelic-cloak-normal-defense-roll', testInfo);

        await expect(confirmButton).toBeEnabled({ timeout: 5000 });
        await confirmButton.click();
        await expect.poll(async () => {
            const state = await readState(game);
            const events = (state.sys?.eventStream?.entries ?? []).map((entry: JsonRecord) => entry?.event ?? entry);
            const defenseRoll = events.find((event: JsonRecord) => (
                event?.type === 'DICE_ROLLED'
                && event?.payload?.phase === 'defensiveRoll'
                && event?.payload?.rollerId === '0'
            ));
            return {
                rollConfirmed: state.core?.rollConfirmed ?? null,
                defenseResults: defenseRoll?.payload?.results ?? null,
                defenseRollCount: events.filter((event: JsonRecord) => (
                    event?.type === 'DICE_ROLLED'
                    && event?.payload?.phase === 'defensiveRoll'
                    && event?.payload?.rollerId === '0'
                )).length,
                pendingBonusDiceSettlement: state.core?.pendingBonusDiceSettlement ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            rollConfirmed: true,
            defenseResults: [1],
            defenseRollCount: 1,
            pendingBonusDiceSettlement: null,
        });

        await expect(endDefenseButton).toBeEnabled({ timeout: 5000 });
        await endDefenseButton.click();
        await expect.poll(async () => (await readState(game)).core?.pendingAttack ?? null, { timeout: 10000 }).toBeNull();

        await expect.poll(async () => {
            const state = await readState(game);
            const events = (state.sys?.eventStream?.entries ?? []).map((entry: JsonRecord) => entry?.event ?? entry);
            const counterDamage = events.find((event: JsonRecord) => (
                event?.type === 'DAMAGE_DEALT'
                && event?.payload?.targetId === '1'
                && event?.payload?.sourceAbilityId === 'angelic-cloak'
            ));
            const attackResolved = events.find((event: JsonRecord) => (
                event?.type === 'ATTACK_RESOLVED'
                && event?.payload?.sourceAbilityId === 'fist-technique-5'
            ));
            return {
                phase: state.sys?.phase ?? null,
                pendingAttack: state.core?.pendingAttack ?? null,
                pendingSettlement: state.core?.pendingBonusDiceSettlement ?? null,
                tianshiHp: state.core?.players?.['0']?.resources?.[RESOURCE_IDS.HP] ?? null,
                monkHp: state.core?.players?.['1']?.resources?.[RESOURCE_IDS.HP] ?? null,
                counterDamage: counterDamage?.payload?.actualDamage ?? null,
                attackResolvedDamage: attackResolved?.payload?.totalDamage ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            phase: 'main2',
            pendingAttack: null,
            pendingSettlement: null,
            tianshiHp: 42,
            monkHp: 48,
            counterDamage: 2,
            attackResolvedDamage: 8,
        });
        await game.screenshot('tianshi-angelic-cloak-after-closeout', testInfo);
    });

    test('天使斗篷投出双翼后，真实防御链会先授予飞行并等待响应后收口', async ({ page, game }, testInfo) => {
        await setupTianshiScene(game, {
            phase: 'defensiveRoll',
            dice: [1, 2, 3, 4, 5],
            currentPlayer: '1',
            currentPlayerIndex: 1,
            disableLocalAiAutomation: true,
            pendingAttack: {
                attackerId: '1',
                defenderId: '0',
                sourceAbilityId: 'fist-technique-5',
                isDefendable: true,
                damage: 8,
            },
            extra: {
                rollCount: 0,
                rollLimit: 1,
                rollDiceCount: 0,
                rollConfirmed: false,
            },
        });
        await dismissAttackShowcaseIfVisible(page);
        await clickAbilitySlot(page, 'meditate', 'angelic-cloak');
        await expectRightTrayDiceDefinitions(page, 'tianshi-dice', 1);

        const rollButton = page.locator('[data-tutorial-id="dice-roll-button"]');
        const confirmButton = page.locator('[data-tutorial-id="dice-confirm-button"]');
        await page.waitForFunction(() => Boolean(window.__BG_TEST_HARNESS__?.dice));
        await page.evaluate(() => {
            window.__BG_TEST_HARNESS__?.dice.setValues([4]);
        });
        await expect(rollButton).toBeEnabled({ timeout: 5000 });
        await rollButton.click();
        await expect.poll(async () => (await readState(game)).core?.dice?.[0]?.value ?? null, { timeout: 10000 }).toBe(4);
        await expect(confirmButton).toBeEnabled({ timeout: 5000 });
        await confirmButton.click();
        await expect.poll(async () => {
            const state = await readState(game);
            return {
                rollConfirmed: state.core?.rollConfirmed ?? null,
                phase: state.sys?.phase ?? null,
            };
        }, { timeout: 10000 }).toMatchObject({
            phase: 'defensiveRoll',
            rollConfirmed: true,
        });

        await expect(page.getByRole('button', { name: /结束防御|End Defense/i }).first()).toBeEnabled({ timeout: 5000 });
        await page.getByRole('button', { name: /结束防御|End Defense/i }).first().click();
        const passResponse = page.getByRole('button', { name: /^(跳过|Pass)$/i }).first();
        await expect(passResponse).toBeEnabled({ timeout: 5000 });
        await passResponse.click();
        await expect.poll(async () => {
            const state = await readState(game);
            return {
                phase: state.sys?.phase ?? null,
                pendingAttack: state.core?.pendingAttack ?? null,
                tianshiHp: state.core?.players?.['0']?.resources?.[RESOURCE_IDS.HP] ?? null,
                flight: state.core?.players?.['0']?.tokens?.[TOKEN_IDS.FLIGHT] ?? null,
            };
        }, { timeout: 10000 }).toEqual({ phase: 'main2', pendingAttack: null, tianshiHp: 42, flight: 1 });
        await game.screenshot('tianshi-angelic-cloak-wing-grants-flight', testInfo);
    });

    test('天使斗篷双翼取得飞行后，飞行奖励骰有6免伤、无6承受8点原攻击都应从真实防御链收口', async ({ page, game }, testInfo) => {
        for (const scenario of [
            { name: '有6免伤', flightDice: [6, 1], expectedHp: 50, expectedEvaded: true },
            { name: '无6承受8点原攻击', flightDice: [2, 5], expectedHp: 42, expectedEvaded: false },
        ]) {
            await setupTianshiScene(game, {
                phase: 'defensiveRoll',
                dice: [1, 2, 3, 4, 5],
                currentPlayer: '1',
                currentPlayerIndex: 1,
                disableLocalAiAutomation: true,
                pendingAttack: {
                    attackerId: '1',
                    defenderId: '0',
                    sourceAbilityId: 'fist-technique-5',
                    isDefendable: true,
                    damage: 8,
                },
                extra: {
                    rollCount: 0,
                    rollLimit: 1,
                    rollDiceCount: 0,
                    rollConfirmed: false,
                },
            });
            await dismissAttackShowcaseIfVisible(page);
            await clickAbilitySlot(page, 'meditate', 'angelic-cloak');
            await expectRightTrayDiceDefinitions(page, 'tianshi-dice', 1);
            await page.waitForFunction(() => Boolean(window.__BG_TEST_HARNESS__?.dice));
            await page.evaluate(() => window.__BG_TEST_HARNESS__?.dice.setValues([4]));
            await page.locator('[data-tutorial-id="dice-roll-button"]').click();
            await page.locator('[data-tutorial-id="dice-confirm-button"]').click();
            await page.getByRole('button', { name: /结束防御|End Defense/i }).first().click();

            const flightToken = page.getByTestId(`dt-player-0-token-${TOKEN_IDS.FLIGHT}`);
            await expect(flightToken).toHaveAttribute('data-token-clickable', 'true', { timeout: 10000 });
            await setDiceThroneBonusDiceValues(page, scenario.flightDice);
            await flightToken.click();
            await expectRightTrayBonusDiceConfirmation(page, () => readState(game), { sourceAbilityId: TOKEN_IDS.FLIGHT });
            await expectRightTrayDiceDefinitions(page, 'tianshi-dice', 2, '0');
            await game.screenshot(`tianshi-angelic-cloak-wing-flight-bonus-${scenario.name}`, testInfo);
            await settleCurrentBonusDice(page, () => readState(game), { sourceAbilityId: TOKEN_IDS.FLIGHT });

            if (!scenario.expectedEvaded) {
                const passResponse = page.getByRole('button', { name: /^(跳过|Pass)$/i }).first();
                await expect(passResponse).toBeEnabled({ timeout: 10000 });
                await passResponse.click();
            }

            await expect.poll(async () => {
                const state = await readState(game);
                return {
                    hp: state.core?.players?.['0']?.resources?.[RESOURCE_IDS.HP] ?? null,
                    flight: state.core?.players?.['0']?.tokens?.[TOKEN_IDS.FLIGHT] ?? null,
                    pendingAttack: state.core?.pendingAttack ?? null,
                    pendingDamage: state.core?.pendingDamage ?? null,
                };
            }, { timeout: 10000 }).toEqual({
                hp: scenario.expectedHp,
                flight: 0,
                pendingAttack: null,
                pendingDamage: null,
            });
            await waitForDiceThroneVisualIdle(page);
            await game.screenshot(`tianshi-angelic-cloak-wing-flight-final-${scenario.name}`, testInfo);
        }
    });

    test('天使斗篷防御骰 5 和 6 应从真实防御链分别减免 2 与 3 点伤害', async ({ page, game }, testInfo) => {
        for (const { defenseFace, preventedDamage, expectedHp } of [
            { defenseFace: 5, preventedDamage: 2, expectedHp: 44 },
            { defenseFace: 6, preventedDamage: 3, expectedHp: 45 },
        ]) {
            await setupTianshiScene(game, {
                phase: 'defensiveRoll',
                dice: [1, 2, 3, 4, 5],
                currentPlayer: '1',
                currentPlayerIndex: 1,
                disableLocalAiAutomation: true,
                pendingAttack: {
                    attackerId: '1',
                    defenderId: '0',
                    sourceAbilityId: 'fist-technique-5',
                    isDefendable: true,
                    damage: 8,
                },
                extra: {
                    rollCount: 0,
                    rollLimit: 1,
                    rollDiceCount: 0,
                    rollConfirmed: false,
                },
            });
            await dismissAttackShowcaseIfVisible(page);
            await clickAbilitySlot(page, 'meditate', 'angelic-cloak');
            await expectRightTrayDiceDefinitions(page, 'tianshi-dice', 1);
            await page.waitForFunction(() => Boolean(window.__BG_TEST_HARNESS__?.dice));
            await page.evaluate((value) => window.__BG_TEST_HARNESS__?.dice.setValues([value]), defenseFace);
            await page.locator('[data-tutorial-id="dice-roll-button"]').click();
            await page.locator('[data-tutorial-id="dice-confirm-button"]').click();
            await page.getByRole('button', { name: /结束防御|End Defense/i }).first().click();

            await expect.poll(async () => {
                const state = await readState(game);
                const events = (state.sys?.eventStream?.entries ?? []).map((entry: JsonRecord) => entry?.event ?? entry);
                const mainDamage = events.find((event: JsonRecord) => (
                    event?.type === 'DAMAGE_DEALT'
                    && event?.payload?.sourceAbilityId === 'fist-technique-5'
                    && event?.payload?.targetId === '0'
                ));
                return {
                    hp: state.core?.players?.['0']?.resources?.[RESOURCE_IDS.HP] ?? null,
                    pendingAttack: state.core?.pendingAttack ?? null,
                    actualDamage: mainDamage?.payload?.actualDamage ?? null,
                };
            }, { timeout: 10000 }).toEqual({
                hp: expectedHp,
                pendingAttack: null,
                actualDamage: 8 - preventedDamage,
            });
            await waitForDiceThroneVisualIdle(page);
            await game.screenshot(`tianshi-angelic-cloak-defense-shield-${defenseFace}-final`, testInfo);
        }
    });

    test('消耗飞行 Token 的临时奖励骰应显示右侧确认，确认后回到正式进攻骰', async ({ page, game }, testInfo) => {
        await setupTianshiScene(game, {
            phase: 'offensiveRoll',
            dice: [1, 1, 1, 4, 5],
            tokens: { [TOKEN_IDS.FLIGHT]: 1 },
            pendingAttack: pendingAttackForCard(),
        });
        await setDiceThroneBonusDiceValues(page, [1, 6]);

        const flightToken = page.getByTestId(`dt-player-0-token-${TOKEN_IDS.FLIGHT}`);
        await expect(flightToken).toBeVisible({ timeout: 10000 });
        await flightToken.click();

        await expect.poll(async () => {
            const state = await readState(game);
            return {
                flight: state.core?.players?.['0']?.tokens?.[TOKEN_IDS.FLIGHT] ?? null,
                undefendable: state.core?.pendingAttack?.isDefendable === false,
                dice: state.core?.currentRollContext?.dice?.map((die: JsonRecord) => die.value) ?? [],
                pendingSettlement: state.core?.pendingBonusDiceSettlement?.sourceAbilityId ?? null,
                replayOnly: state.core?.currentRollContext?.display?.replayOnly ?? false,
            };
        }, { timeout: 10000 }).toEqual({
            flight: 0,
            undefendable: true,
            dice: [1, 6],
            pendingSettlement: TOKEN_IDS.FLIGHT,
            replayOnly: false,
        });

        await expectRightTrayBonusDiceConfirmation(page, () => readState(game), { sourceAbilityId: TOKEN_IDS.FLIGHT });
        const diceTray = page.getByTestId('dicethrone-2d-dice-tray');
        await expect(diceTray).toBeVisible({ timeout: 10000 });
        await expect(diceTray.getByTestId('dice-2d')).toHaveCount(2);
        await expect(diceTray.getByTestId('dice-2d').nth(0)).toHaveAttribute('data-roll-animation', 'dice2d-cube-tumble');
        await expect(diceTray.getByTestId('dice-2d').nth(1)).toHaveAttribute('data-roll-animation', 'dice2d-cube-tumble');
        await expect(diceTray.getByTestId('dice-2d').nth(0)).toHaveAttribute('data-face-value', '1');
        await expect(diceTray.getByTestId('dice-2d').nth(1)).toHaveAttribute('data-face-value', '6');
        await game.screenshot('tianshi-flight-token-right-tray-rolling', testInfo);
        await expect(page.getByTestId('bonus-dice-confirm-button')).toHaveCount(0);
        await expect(page.getByTestId('bonus-die-overlay')).toBeHidden();
        await expect(page.getByTestId('card-spotlight-overlay')).toBeHidden();

        await settleCurrentBonusDice(page, () => readState(game), { sourceAbilityId: TOKEN_IDS.FLIGHT });
        await expect.poll(async () => {
            const state = await readState(game);
            return {
                pendingSettlement: state.core?.pendingBonusDiceSettlement ?? null,
                kind: state.core?.currentRollContext?.kind ?? null,
                dice: state.core?.currentRollContext?.dice?.map((die: JsonRecord) => die.value) ?? [],
                replayOnly: state.core?.currentRollContext?.display?.replayOnly ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            pendingSettlement: null,
            kind: 'offensive',
            dice: [1, 1, 1, 4, 5],
            replayOnly: false,
        });
        await game.screenshot('tianshi-flight-token-right-tray-after-confirm-return-main-dice', testInfo);
    });

    test('防御响应窗口中飞行临时骰确认后，抬一手应继续命中正式防御骰', async ({ page, game }, testInfo) => {
        await setupTianshiScene(game, {
            phase: 'defensiveRoll',
            dice: [3, 3, 3, 3, 3],
            tokens: { [TOKEN_IDS.FLIGHT]: 1 },
            opponentHand: ['card-give-hand'],
            currentPlayer: '1',
            currentPlayerIndex: 1,
            randomQueue: [randomValueForDieFace(1), randomValueForDieFace(2), randomValueForDieFace(6)],
            pendingAttack: {
                attackerId: '1',
                defenderId: '0',
                sourceAbilityId: 'holy-blade-3',
                defenseAbilityId: 'angelic-cloak',
                isDefendable: true,
                damage: 5,
            },
        });
        await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const state = harness?.state?.get?.();
            if (!state || typeof harness?.state?.set !== 'function') {
                throw new Error('TestHarness state.set 不可用');
            }
            harness.state.set({
                ...state,
                sys: {
                    ...state.sys,
                    responseWindow: {
                        current: {
                            windowId: 'afterRollConfirmed-defense-flight-e2e',
                            responderQueue: ['1'],
                            currentResponderIndex: 0,
                            windowType: 'afterRollConfirmed',
                            sourceId: 'defense-roll-confirmed-before-flight-e2e',
                        },
                    },
                },
                core: {
                    ...state.core,
                    activePlayerId: '1',
                    rollCount: 1,
                    rollDiceCount: 5,
                    rollConfirmed: true,
                },
            });
        });

        const flightToken = page.getByTestId(`dt-player-0-token-${TOKEN_IDS.FLIGHT}`);
        await expect(flightToken).toBeVisible({ timeout: 10000 });
        await expect(flightToken).toHaveAttribute('data-token-clickable', 'true', { timeout: 10000 });
        await flightToken.click();
        await expectRightTrayBonusDiceConfirmation(page, () => readState(game), { sourceAbilityId: TOKEN_IDS.FLIGHT });
        await game.screenshot('tianshi-defense-flight-response-window-confirm-ready', testInfo);

        await settleCurrentBonusDice(page, () => readState(game), { sourceAbilityId: TOKEN_IDS.FLIGHT });
        await expect.poll(async () => {
            const state = await readState(game);
            return {
                pendingSettlement: state.core?.pendingBonusDiceSettlement ?? null,
                responseWindow: state.sys?.responseWindow?.current?.windowType ?? null,
                rollKind: state.core?.currentRollContext?.kind ?? null,
                rollOwner: state.core?.currentRollContext?.ownerPlayerId ?? null,
                diceValues: state.core?.currentRollContext?.dice?.map((die: JsonRecord) => die.value) ?? [],
            };
        }, { timeout: 10000 }).toEqual({
            pendingSettlement: null,
            responseWindow: 'afterRollConfirmed',
            rollKind: 'defensive',
            rollOwner: '0',
            diceValues: [3, 3, 3, 3, 3],
        });

        await dispatchCommand(page, 'PLAY_CARD', '1', { cardId: 'card-give-hand' });
        await expect.poll(async () => {
            const interaction = (await readState(game)).sys?.interaction?.current;
            return {
                kind: interaction?.kind ?? null,
                playerId: interaction?.playerId ?? null,
                diceOwnerId: interaction?.data?.meta?.diceOwnerId ?? null,
                allowedDieIds: interaction?.data?.allowedDieIds ?? [],
            };
        }, { timeout: 10000 }).toEqual({
            kind: 'multistep-choice',
            playerId: '1',
            diceOwnerId: '0',
            allowedDieIds: [0, 1, 2, 3, 4],
        });
        await game.screenshot('tianshi-defense-flight-after-confirm-give-hand-targets-defense-dice', testInfo);
    });

    test('防御掷骰阶段的伤害响应弹窗应允许立即使用飞行并免除当前伤害', async ({ page, game }, testInfo) => {
        for (const scenario of [
            { name: '有6免伤', values: [6, 1], expectedHp: 50, expectedEvaded: true },
            { name: '无6继续受伤', values: [2, 5], expectedHp: 43, expectedEvaded: false },
        ]) {
        await setupTianshiScene(game, {
            phase: 'defensiveRoll',
            tokens: { [TOKEN_IDS.FLIGHT]: 1 },
            pendingAttack: {
                attackerId: '1',
                defenderId: '0',
                sourceAbilityId: 'holy-blade-3',
                isDefendable: true,
                damage: 7,
            },
            extra: {
                pendingDamage: {
                    id: 'tianshi-flight-response',
                    sourcePlayerId: '1',
                    targetPlayerId: '0',
                    originalDamage: 7,
                    currentDamage: 7,
                    responseType: 'beforeDamageReceived',
                    responderId: '0',
                    isFullyEvaded: false,
                },
            },
        });
        await dismissAttackShowcaseIfVisible(page);
        const seededState = await readState(game);
        const pendingDamage = seededState.core?.pendingDamage as JsonRecord;
        const resolutionFrameId = `dicethrone:token-response-frame:${pendingDamage.id}`;
        const choiceRequestContract = {
            requestId: `dicethrone:token-response:${pendingDamage.id}:${pendingDamage.responseType}:${pendingDamage.responderId}`,
            playerId: pendingDamage.responderId,
            kind: 'choose-option',
            sourceId: 'dicethrone_token_response',
            candidates: buildDiceThroneTokenResponseChoiceCandidates(seededState.core as any, pendingDamage as any),
            selection: { min: 1, max: 1 },
            resolution: { type: 'candidate-commands' },
            metadata: {
                pendingDamageId: pendingDamage.id,
                resolutionFrameId,
                sourcePlayerId: pendingDamage.sourcePlayerId,
                targetPlayerId: pendingDamage.targetPlayerId,
                responderId: pendingDamage.responderId,
                responseType: pendingDamage.responseType,
                sourceAbilityId: pendingDamage.sourceAbilityId,
                originalDamage: pendingDamage.originalDamage,
                currentDamage: pendingDamage.currentDamage,
                priority: 70,
            },
        };
        await page.evaluate(({ choiceRequestContract: contract, resolutionFrameId: frameId }) => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const state = harness?.state?.get?.();
            if (!state || typeof harness?.state?.set !== 'function') {
                throw new Error('TestHarness state.set 不可用');
            }
            harness.state.set({
                ...state,
                sys: {
                    ...state.sys,
                    interaction: {
                        current: {
                            id: 'dt-token-response-tianshi-flight',
                            kind: 'dt:token-response',
                            playerId: '0',
                            resolutionFrameId: frameId,
                            data: { choiceRequestContract: contract },
                        },
                        queue: [],
                    },
                },
            });
        }, { choiceRequestContract, resolutionFrameId });
        await dismissAttackShowcaseIfVisible(page);
        await setDiceThroneBonusDiceValues(page, scenario.values);

        const tokenResponse = page.getByTestId('dicethrone-response-window-hint');
        const flightToken = page.getByTestId(`dt-player-0-token-${TOKEN_IDS.FLIGHT}`);
        await expect(tokenResponse).toBeVisible({ timeout: 10000 });
        await expect(flightToken).toBeVisible({ timeout: 10000 });
        await expect(flightToken).toHaveAttribute('data-token-clickable', 'true');
        await game.screenshot(`tianshi-flight-token-response-ready-${scenario.name}`, testInfo);
        await flightToken.click();
        // 飞行先产生右侧临时奖励骰；必须由真实骰盘确认后，才会把结果回写到防御响应。
        await expectRightTrayBonusDiceConfirmation(page, () => readState(game), { sourceAbilityId: TOKEN_IDS.FLIGHT });
        await game.screenshot(`tianshi-flight-token-response-bonus-dice-${scenario.name}`, testInfo);
        await settleCurrentBonusDice(page, () => readState(game), { sourceAbilityId: TOKEN_IDS.FLIGHT });
        if (!scenario.expectedEvaded) {
            const passResponse = page.getByRole('button', { name: /^(跳过|Pass)$/i }).first();
            await expect(passResponse).toBeEnabled({ timeout: 10000 });
            await passResponse.click();
        }

        await expect.poll(async () => {
            const state = await readState(game);
            return {
                flight: state.core?.players?.['0']?.tokens?.[TOKEN_IDS.FLIGHT] ?? null,
                hp: state.core?.players?.['0']?.resources?.[RESOURCE_IDS.HP] ?? null,
                pendingDamage: state.core?.pendingDamage ?? null,
                defensiveFlightActivated: state.core?.pendingAttack?.defensiveFlightActivated ?? false,
                dice: state.core?.currentRollContext?.dice?.map((die: JsonRecord) => die.value) ?? [],
            };
        }, { timeout: 10000 }).toEqual({
            flight: 0,
            hp: scenario.expectedHp,
            pendingDamage: null,
            defensiveFlightActivated: scenario.expectedEvaded,
            dice: scenario.values,
        });
        await expect(tokenResponse).toBeHidden({ timeout: 10000 });
        await expect(page.getByTestId('bonus-die-overlay')).toBeHidden();
        await expect(page.getByTestId('card-spotlight-overlay')).toBeHidden();
        await expect(page.getByTestId('attack-showcase-overlay')).toHaveCount(0);
        await waitForDiceThroneVisualIdle(page);
        await game.screenshot(`tianshi-flight-token-response-right-tray-settled-${scenario.name}`, testInfo);
        }
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
        await expect(page.getByRole('button', { name: '炽天使' })).toBeVisible({ timeout: 10000 });
        await expect(page.getByRole('button', { name: '武僧' })).toBeVisible({ timeout: 10000 });
        await game.screenshot('tianshi-divine-purification-target-choice', testInfo);
        await page.getByRole('button', { name: '炽天使' }).click();

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
        await settleCurrentBonusDice(page, () => readState(game), { sourceAbilityId: cardId });
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
        await settleCurrentBonusDice(page, () => readState(game), { sourceAbilityId: cardId });
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

    test('至高圣洁应只在右侧骰盘显示，并可从真实手牌改为圣洁吊坠后自动结算', async ({ page, game }, testInfo) => {
        const cardId = 'card-tianshi-supreme-holiness';
        const playSixCardId = 'card-play-six';
        await setupTianshiScene(game, {
            phase: 'main1',
            hand: [cardId, playSixCardId],
            cp: 10,
            randomQueue: [1].map(randomValueForDieFace),
        });

        await expect(page.getByTestId('bonus-dice-response-toggle')).toHaveCount(0);

        await dragHandCardToPlay(page, cardId);
        await expect.poll(async () => {
            const state = await readState(game);
            return {
                sourceAbilityId: state.core?.pendingBonusDiceSettlement?.sourceAbilityId ?? null,
                diceValues: state.core?.pendingBonusDiceSettlement?.dice?.map((die: JsonRecord) => die.value) ?? [],
                responseWindow: state.sys?.responseWindow?.current?.windowType ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            sourceAbilityId: cardId,
            diceValues: [1],
            responseWindow: null,
        });

        await expectRightTrayBonusDiceConfirmation(page, () => readState(game), { sourceAbilityId: cardId });
        const diceTray = page.getByTestId('dicethrone-2d-dice-tray');
        await expect(diceTray).toBeVisible({ timeout: 10000 });
        await expect(diceTray.getByTestId('dice-2d')).toHaveCount(1);
        await expect(diceTray.getByTestId('dice-2d')).toHaveAttribute('data-face-value', '1');
        await expect(page.getByTestId('bonus-die-overlay')).toBeHidden();
        await expect(page.getByTestId('card-spotlight-overlay')).toBeHidden();
        await expect(page.getByTestId('dicethrone-response-window-hint')).toHaveCount(0);
        await game.screenshot('tianshi-supreme-holiness-right-tray-before-modification', testInfo);

        await dragHandCardToPlay(page, playSixCardId);
        await expect.poll(async () => {
            const interaction = (await readState(game)).sys?.interaction?.current;
            return {
                type: interaction?.data?.meta?.dtType ?? null,
                targetValue: interaction?.data?.meta?.dieModifyConfig?.targetValue ?? null,
            };
        }, { timeout: 10000 }).toEqual({ type: 'modifyDie', targetValue: 6 });
        const dieButton = page.getByTestId('die-button-0').first();
        await expect(dieButton).toBeVisible({ timeout: 10000 });
        await dieButton.click();

        await expectCardConsumed(game, cardId, 9, [cardId, playSixCardId]);
        await expect.poll(async () => {
            const state = await readState(game);
            const player = state.core?.players?.['0'];
            return {
                pendingSettlement: state.core?.pendingBonusDiceSettlement ?? null,
                flight: player?.tokens?.[TOKEN_IDS.FLIGHT] ?? 0,
                purify: player?.tokens?.[TOKEN_IDS.PURIFY] ?? 0,
            };
        }, { timeout: 10000 }).toEqual({ pendingSettlement: null, flight: 2, purify: 2 });
        await expect(diceTray).toBeVisible({ timeout: 10000 });
        await expect(diceTray.getByTestId('dice-2d')).toHaveCount(1);
        await expect(diceTray.getByTestId('dice-2d')).toHaveAttribute('data-face-value', '6');
        await expect(diceTray.getByTestId('die-button-0')).toHaveAttribute('data-display-only', 'true');
        await expect(page.getByTestId('bonus-die-overlay')).toBeHidden();
        await expect(page.getByTestId('card-spotlight-overlay')).toBeHidden();
        // 等待骰面翻转结束，确保截图交付的是最终 6，而不是转面中的相邻骰面。
        await page.waitForTimeout(1100);
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
