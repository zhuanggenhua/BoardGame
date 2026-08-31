import { describe, expect, it } from 'vitest';
import { executePipeline } from '../../../engine/pipeline';
import type { MatchState } from '../../../engine/types';
import { DiceThroneDomain } from '../domain';
import { createDiceThroneEventSystem } from '../domain/systems';
import { reduce } from '../domain/reducer';
import type { DiceThroneCore, DiceThroneEvent, PendingBonusDiceSettlement } from '../domain/types';
import { createHeroMatchup, createQueuedRandom, testSystems } from './test-utils';
import { COMMON_CARDS } from '../domain/commonCards';
import { RESOURCE_IDS } from '../domain/resources';
import { TOKEN_IDS } from '../domain/ids';
import { buildBonusDiceSettlementEvents } from '../domain/executeTokens';
import { CP_MAX } from '../domain/types';
import { getRegisteredBonusDiceSettlementIds } from '../domain/bonusDiceSettlement';
import { getCurrentInteractionSummary } from '../../../engine/testing/interactionTestFacade';

const bonusSettlement = (): PendingBonusDiceSettlement => ({
    id: 'ordinary-confirm-required',
    sourceAbilityId: 'ordinary-confirm-required',
    attackerId: '0',
    targetId: '1',
    dice: [{ index: 0, value: 4, face: 'sabre', effectParams: { value: 4 } }],
    rerollCostTokenId: 'tactical_advantage',
    rerollCostAmount: 1,
    rerollCount: 0,
    maxRerollCount: 1,
    readyToSettle: false,
    allowDiceModification: true,
});

const runBonusDiceSystem = (
    state: MatchState<DiceThroneCore>,
    events: DiceThroneEvent[],
) => {
    const system = createDiceThroneEventSystem();
    return system.afterEvents?.({
        state,
        events,
        random: createQueuedRandom([6]),
    } as any) as { state?: MatchState<DiceThroneCore>; events?: DiceThroneEvent[] } | undefined;
};

const openBonusDiceState = (
    settlement: PendingBonusDiceSettlement,
    mutate?: (core: DiceThroneCore) => void,
): MatchState<DiceThroneCore> => {
    const state = createHeroMatchup('monk', 'treant')(['0', '1'], createQueuedRandom([1]));
    mutate?.(state.core);
    const requested = {
        type: 'BONUS_DICE_REROLL_REQUESTED',
        payload: { settlement },
        sourceCommandType: 'TEST_BONUS_DICE',
        timestamp: 100,
    } as DiceThroneEvent;
    const coreWithBonus = reduce(state.core, requested);
    const result = runBonusDiceSystem({ ...state, core: coreWithBonus }, [requested]);
    if (!result?.state) {
        throw new Error('奖励骰交互未成功打开');
    }
    return result.state;
};

describe('DiceThrone 奖励骰普通确认合同', () => {
    it('所有生产奖励骰专用结算器都必须注册，避免投掷成功但确认后没有规则消费者', () => {
        const expectedSettlementIds = [
            'artificer-heal-bot-use',
            'artificer-wrench-strike-branch',
            'artificer-perfectly-calibrated-roll',
            'barbarian-suppress-roll',
            'barbarian-suppress-2-roll',
            'barbarian-lucky-roll-heal',
            'barbarian-more-please-roll-damage',
            'cursed-pirate-flay',
            'cursed-pirate-crows-nest',
            'cursed-pirate-hefty',
            'cursed-pirate-sip-roll',
            'gunslinger-loaded-use',
            'gunslinger-eat-my-lead',
            'gunslinger-high-noon',
            'one-throw-fortune-cp',
            'monk-thunder-strike-settlement',
            'monk-thunder-strike-2-settlement',
            'moon-elf-exploding-arrow',
            'moon-elf-exploding-arrow-2',
            'moon-elf-exploding-arrow-3',
            'moon-elf-shadow-strike',
            'moon-elf-volley',
            'moon-elf-watch-out',
            'ninja-going-forward',
            'ninja-going-forward-bleed',
            'ninja-going-forward-2',
            'ninja-poison-blade-2',
            'ninja-death-blossom',
            'ninja-ninjutsu',
            'ninja-death-blossom-2',
            'pyro-get-fired-up-roll',
            'pyro-infernal-embrace-roll',
            'pyro-blast-roll',
            'samurai-back-strike-use',
            'samurai-masamune',
            'samurai-righteousness',
            'shadow-thief-shadow-dance',
            'shadow-thief-shadow-dance-2',
            'shadow-thief-sneak-attack',
            'tianshi-divine-punishment',
            'tianshi-triumphant-return',
            'tianshi-holy-strike',
            'tianshi-angelic-tactics',
            'tianshi-supreme-holiness',
            'tianshi-flight',
            'treant-life-sap-roll',
            'treant-wild-growth-2-roll',
            'treant-trample-roll',
            'treant-soulfire-roll',
            'treant-mother-tree-roll',
            'treant-rooted-roll',
            'vampire-lord-mesmerize-roll',
            'zhanshujia-war-monger-roll',
            'zhanshujia-war-monger-2-roll',
            'zhanshujia-war-room-roll',
            'powder-keg-upkeep',
            'blinded-check',
            'tianshi-dazzle-check',
        ];

        expect(getRegisteredBonusDiceSettlementIds()).toEqual(new Set(expectedSettlementIds));
    });

    it('即使对手有改骰牌，奖励骰也不再打开响应窗口，而是直接停在右侧骰盘等待普通确认', () => {
        const settlement = bonusSettlement();
        const nextState = openBonusDiceState(settlement, (core) => {
            const giveHand = COMMON_CARDS.find((card) => card.id === 'card-give-hand');
            if (!giveHand) throw new Error('测试缺少“弹一手”通用牌定义');
            core.players['1'].hand = [giveHand];
            core.players['1'].resources.CP = 3;
        });

        expect(nextState.sys.responseWindow?.current).toBeUndefined();
        expect(nextState.sys.interaction.current).toMatchObject({
            kind: 'dt:bonus-dice',
            playerId: '0',
        });
    });

    it('无可用内置重投且没有响应时，奖励骰仍停在右侧骰盘等待普通确认', () => {
        const settlement = bonusSettlement();
        const nextState = openBonusDiceState(settlement, (core) => {
            core.players['0'].tokens.tactical_advantage = 0;
        });

        expect(nextState.core.pendingBonusDiceSettlement).toMatchObject({
            id: settlement.id,
            dice: [{ value: 4 }],
        });
        expect(nextState.sys.interaction.current).toMatchObject({
            kind: 'dt:bonus-dice',
            playerId: '0',
        });
    });

    it('Token 响应期间确认奖励骰只释放奖励骰交互，不关闭当前 Token 响应窗口', () => {
        const state = createHeroMatchup('shadow_thief', 'monk')(['0', '1'], createQueuedRandom([1]));
        state.sys.interaction.current = {
            id: 'dt-token-response-dmg-1',
            kind: 'dt:token-response',
            playerId: '0',
            data: null,
            diagnosticMetadata: { pendingDamageId: 'dmg-1' },
        } as any;
        state.sys.interaction.queue = [{
            id: 'dt-bonus-dice-shadow-thief-sneak-attack-display-11',
            kind: 'dt:bonus-dice',
            playerId: '0',
            data: null,
        } as any];

        const result = runBonusDiceSystem(state, [{
            type: 'BONUS_DICE_SETTLED',
            payload: {
                settlementId: 'shadow-thief-sneak-attack-display-11',
                finalDice: [{ index: 0, value: 5, face: 'shadow', effectParams: { value: 5 } }],
                totalDamage: 0,
                thresholdTriggered: false,
                attackerId: '0',
                targetId: '1',
                sourceAbilityId: 'sneak_attack',
                displayOnly: true,
                allowDiceModification: true,
            },
            sourceCommandType: 'SKIP_BONUS_DICE_REROLL',
            timestamp: 101,
        } as DiceThroneEvent]);

        expect(result?.state?.sys.interaction.current).toMatchObject({
            kind: 'dt:token-response',
            playerId: '0',
        });
        expect(result?.state?.sys.interaction.queue).toHaveLength(0);
    });

    it('达到奖励骰重投上限后仍等待骰主点击右侧骰盘普通确认', () => {
        const settlement = {
            ...bonusSettlement(),
            rerollCostTokenId: '',
            rerollCostAmount: 0,
            rerollCount: 0,
            maxRerollCount: 1,
        };
        const opened = openBonusDiceState(settlement);

        const rerolled = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            opened,
            {
                type: 'REROLL_BONUS_DIE',
                playerId: '0',
                payload: { dieIndex: 0 },
                timestamp: 101,
            } as any,
            createQueuedRandom([6]),
            ['0', '1'],
        );

        expect(rerolled.success).toBe(true);
        expect(rerolled.events).toContainEqual(expect.objectContaining({
            type: 'BONUS_DIE_REROLLED',
        }));
        expect(rerolled.events).not.toContainEqual(expect.objectContaining({
            type: 'BONUS_DICE_SETTLED',
        }));
        expect(rerolled.state.core.pendingBonusDiceSettlement).toMatchObject({
            id: settlement.id,
            rerollCount: 1,
            maxRerollCount: 1,
            dice: [{ value: 6 }],
        });
        expect(rerolled.state.sys.interaction.current).toMatchObject({
            kind: 'dt:bonus-dice',
            playerId: '0',
        });
    });

    it('奖励骰确认只结算一次，确认后再次点击不能重复造成伤害或重新打开交互', () => {
        const settlement = bonusSettlement();
        const opened = openBonusDiceState(settlement, (core) => {
            core.players['0'].tokens = {};
            core.players['1'].tokens = {};
            core.players['1'].resources[RESOURCE_IDS.HP] = 20;
        });

        const first = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            opened,
            { type: 'CONFIRM_ROLL', playerId: '0', payload: {}, timestamp: 101 } as any,
            createQueuedRandom([1]),
            ['0', '1'],
        );

        expect(first.success).toBe(true);
        expect(first.state.core.players['1'].resources[RESOURCE_IDS.HP]).toBe(16);
        expect(first.state.core.pendingBonusDiceSettlement).toBeUndefined();

        const second = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            first.state,
            { type: 'CONFIRM_ROLL', playerId: '0', payload: {}, timestamp: 102 } as any,
            createQueuedRandom([1]),
            ['0', '1'],
        );

        expect(second.success).toBe(false);
        expect(second.events.filter((event) => event.type === 'DAMAGE_DEALT')).toHaveLength(0);
        expect(second.state.core.players['1'].resources[RESOURCE_IDS.HP]).toBe(16);
        expect(getCurrentInteractionSummary(second.state).kind).toBeUndefined();
    });

    it('攻击型奖励骰普通确认后必须把同批后续加伤一起带入攻击续跑', () => {
        const state = createHeroMatchup('gunslinger', 'monk')(['0', '1'], createQueuedRandom([1]));
        state.sys.phase = 'offensiveRoll';
        state.sys.flowHalted = true;
        state.core.activePlayerId = '0';
        state.core.turnPhase = 'offensiveRoll';
        state.core.rollConfirmed = true;
        state.core.players['0'].resources[RESOURCE_IDS.HP] = 50;
        state.core.players['1'].resources[RESOURCE_IDS.HP] = 50;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'revolver-3',
            isDefendable: false,
            damage: 0,
            bonusDamage: 0,
            settlementStage: 'preDamage',
            offensiveRollEndTokenResolved: true,
        } as DiceThroneCore['pendingAttack'];

        const settlement: PendingBonusDiceSettlement = {
            id: 'loaded-wild-west-confirm',
            sourceAbilityId: 'revolver-3',
            attackerId: '0',
            targetId: '1',
            dice: [{ index: 0, value: 6, face: 'bullet', effectParams: { value: 6 } }],
            rerollCostTokenId: '',
            rerollCostAmount: 0,
            rerollCount: 0,
            maxRerollCount: 0,
            readyToSettle: false,
            resolutionMode: 'attackBonus',
            attackBonusScale: 'halfUp',
            postSettleBonusDamageAdds: [{ amount: 1, sourceCardId: 'card-wild-west' }],
            allowDiceModification: true,
            continuation: { kind: 'attack', settlementStage: 'preDamage', markBonusDiceResolved: false },
        };
        const requested = {
            type: 'BONUS_DICE_REROLL_REQUESTED',
            payload: { settlement },
            sourceCommandType: 'TEST_BONUS_DICE',
            timestamp: 100,
        } as DiceThroneEvent;
        const openedCore = reduce(state.core, requested);
        const opened = runBonusDiceSystem({ ...state, core: openedCore }, [requested])?.state;
        if (!opened) throw new Error('奖励骰交互未成功打开');

        const confirmed = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            opened,
            {
                type: 'CONFIRM_ROLL',
                playerId: '0',
                payload: {},
                timestamp: 101,
            } as any,
            createQueuedRandom([1]),
            ['0', '1'],
        );

        expect(confirmed.success).toBe(true);
        expect(confirmed.events).toContainEqual(expect.objectContaining({
            type: 'BONUS_DICE_SETTLED',
            payload: expect.objectContaining({ settlementId: settlement.id }),
        }));
        expect(confirmed.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: 'BONUS_DAMAGE_ADDED',
                payload: expect.objectContaining({ amount: 3 }),
            }),
            expect.objectContaining({
                type: 'BONUS_DAMAGE_ADDED',
                payload: expect.objectContaining({ amount: 1, sourceCardId: 'card-wild-west' }),
            }),
        ]));
        expect(confirmed.state.core.pendingAttack).toBeNull();
        // 左轮基础伤害 3 + Loaded 奖励骰 6 => +3 + Wild West 后续 +1。
        expect(confirmed.state.core.lastResolvedAttackDamage).toBe(7);
        expect(confirmed.state.core.players['1'].resources[RESOURCE_IDS.HP]).toBe(43);
    });

    it('默认奖励骰获得 Token 时，事件数量必须按实际上限截断', () => {
        const state = createHeroMatchup('monk', 'treant')(['0', '1'], createQueuedRandom([1])).core;
        state.players['0'].tokens[TOKEN_IDS.TAIJI] = 5;

        const settlement: PendingBonusDiceSettlement = {
            id: 'default-token-cap',
            sourceAbilityId: 'default-token-cap',
            attackerId: '0',
            targetId: '1',
            dice: [{ index: 0, value: 6, face: 'unknown' }],
            rerollCostTokenId: '',
            rerollCostAmount: 0,
            rerollCount: 0,
            maxRerollCount: 0,
            readyToSettle: false,
            rollDieResolution: {
                defaultEffect: {
                    grantToken: { tokenId: TOKEN_IDS.TAIJI, value: 2 },
                },
                effectTargetId: '0',
            },
        };

        const events = buildBonusDiceSettlementEvents({
            state,
            settlement,
            random: createQueuedRandom([1]),
            timestamp: 101,
            sourceCommandType: 'TEST_CONFIRM_BONUS_DICE',
        });

        expect(events).toContainEqual(expect.objectContaining({
            type: 'TOKEN_GRANTED',
            payload: expect.objectContaining({
                targetId: '0',
                tokenId: TOKEN_IDS.TAIJI,
                amount: 0,
                newTotal: 5,
            }),
        }));
    });

    it('奖励骰获得 CP 达到上限时，事件增量必须按实际增加量记录', () => {
        const state = createHeroMatchup('monk', 'treant')(['0', '1'], createQueuedRandom([1])).core;
        state.players['0'].resources[RESOURCE_IDS.CP] = CP_MAX;

        const settlement: PendingBonusDiceSettlement = {
            id: 'conditional-cp-cap',
            sourceAbilityId: 'conditional-cp-cap',
            attackerId: '0',
            targetId: '1',
            dice: [{ index: 0, value: 6, face: 'unknown' }],
            rerollCostTokenId: '',
            rerollCostAmount: 0,
            rerollCount: 0,
            maxRerollCount: 0,
            readyToSettle: false,
            resolutionMode: 'none',
            rollDieResolution: {
                conditionalEffects: [{ face: 'unknown', cp: 2 }],
                effectTargetId: '0',
            },
        };

        const events = buildBonusDiceSettlementEvents({
            state,
            settlement,
            random: createQueuedRandom([1]),
            timestamp: 102,
            sourceCommandType: 'TEST_CONFIRM_BONUS_DICE',
        });

        expect(events).toContainEqual(expect.objectContaining({
            type: 'CP_CHANGED',
            payload: expect.objectContaining({
                playerId: '0',
                delta: 0,
                newValue: CP_MAX,
            }),
        }));
    });
});
