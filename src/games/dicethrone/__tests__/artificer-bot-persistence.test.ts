import { describe, expect, it } from 'vitest';
import { execute } from '../domain/execute';
import { reduce } from '../domain/reducer';
import type { DiceThroneCore, DiceThroneEvent } from '../domain/types';
import { RESOURCE_IDS } from '../domain/resources';
import { TOKEN_IDS } from '../domain/ids';
import { createHeroMatchup, createQueuedRandom, fixedRandom } from './test-utils';

const applyEvents = (core: DiceThroneCore, events: DiceThroneEvent[]): DiceThroneCore =>
    events.reduce((current, event) => reduce(current, event), core);

const setArtificerBot = (
    state: DiceThroneCore,
    playerId: string,
    tokenId: typeof TOKEN_IDS.NANOBOT | typeof TOKEN_IDS.SHOCK_BOT | typeof TOKEN_IDS.HEAL_BOT,
    options?: { upgraded?: boolean; activationsUsedThisTurn?: number },
) => {
    const upgraded = options?.upgraded ?? false;
    state.players[playerId].tokens[tokenId] = 1;
    state.players[playerId].tokenStackLimits = {
        ...(state.players[playerId].tokenStackLimits ?? {}),
        [tokenId]: upgraded ? 2 : 1,
    };
    state.players[playerId].artificerBotState = {
        ...(state.players[playerId].artificerBotState ?? {}),
        [tokenId]: {
            built: true,
            upgraded,
            activationsUsedThisTurn: options?.activationsUsedThisTurn ?? 0,
        },
    };
};

describe('DiceThrone 工匠机器人持久化与使用次数', () => {
    it('基础电能机器人激活后不会降级或消失，只记录本回合已激活次数', () => {
        const state = createHeroMatchup('artificer', 'monk')(['0', '1'], fixedRandom);
        setArtificerBot(state.core, '0', TOKEN_IDS.SHOCK_BOT);
        state.core.players['0'].tokens[TOKEN_IDS.SYNTH] = 2;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'shock-bot',
            isDefendable: true,
        } as DiceThroneCore['pendingAttack'];
        state.core.pendingDamage = {
            id: 'damage-test',
            sourcePlayerId: '0',
            targetPlayerId: '1',
            originalDamage: 6,
            currentDamage: 6,
            sourceAbilityId: 'shock-bot',
            damageScope: 'attack',
            responseType: 'beforeDamageDealt',
            responderId: '0',
            isFullyEvaded: false,
        };

        const events = execute(state, {
            type: 'USE_TOKEN',
            playerId: '0',
            payload: { tokenId: TOKEN_IDS.SHOCK_BOT, amount: 1 },
            timestamp: 100,
        }, fixedRandom);
        const next = applyEvents(state.core, events);

        expect(next.players['0'].tokens[TOKEN_IDS.SHOCK_BOT]).toBe(1);
        expect(next.players['0'].tokens[TOKEN_IDS.SYNTH]).toBe(0);
        expect(next.pendingDamage?.currentDamage).toBe(9);
        expect(next.players['0'].artificerBotState?.[TOKEN_IDS.SHOCK_BOT]).toMatchObject({
            built: true,
            upgraded: false,
            activationsUsedThisTurn: 1,
        });
    });

    it('高级电能机器人激活后不会降级，且额外合成器成本降为 1', () => {
        const state = createHeroMatchup('artificer', 'monk')(['0', '1'], fixedRandom);
        setArtificerBot(state.core, '0', TOKEN_IDS.SHOCK_BOT, { upgraded: true });
        state.core.players['0'].tokens[TOKEN_IDS.SYNTH] = 1;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'shock-bot',
            isDefendable: true,
        } as DiceThroneCore['pendingAttack'];
        state.core.pendingDamage = {
            id: 'damage-test',
            sourcePlayerId: '0',
            targetPlayerId: '1',
            originalDamage: 6,
            currentDamage: 6,
            sourceAbilityId: 'shock-bot',
            damageScope: 'attack',
            responseType: 'beforeDamageDealt',
            responderId: '0',
            isFullyEvaded: false,
        };

        const events = execute(state, {
            type: 'USE_TOKEN',
            playerId: '0',
            payload: { tokenId: TOKEN_IDS.SHOCK_BOT, amount: 1 },
            timestamp: 101,
        }, fixedRandom);
        const next = applyEvents(state.core, events);

        expect(next.players['0'].tokens[TOKEN_IDS.SHOCK_BOT]).toBe(1);
        expect(next.players['0'].tokens[TOKEN_IDS.SYNTH]).toBe(0);
        expect(next.players['0'].artificerBotState?.[TOKEN_IDS.SHOCK_BOT]).toMatchObject({
            built: true,
            upgraded: true,
            activationsUsedThisTurn: 1,
        });
    });

    it('升级基础电能机器人会花费 3 个合成器，并保留机器人本体', () => {
        const state = createHeroMatchup('artificer', 'monk')(['0', '1'], fixedRandom);
        state.sys.phase = 'main1';
        state.core.activePlayerId = '0';
        state.core.players['0'].tokens[TOKEN_IDS.SYNTH] = 3;
        setArtificerBot(state.core, '0', TOKEN_IDS.SHOCK_BOT);

        const events = execute(state, {
            type: 'USE_PASSIVE_ABILITY',
            playerId: '0',
            payload: { passiveId: 'artificer-workshop', actionIndex: 7 },
            timestamp: 102,
        }, fixedRandom);
        const next = applyEvents(state.core, events);

        expect(next.players['0'].tokens[TOKEN_IDS.SYNTH]).toBe(0);
        expect(next.players['0'].tokens[TOKEN_IDS.SHOCK_BOT]).toBe(1);
        expect(next.players['0'].tokenStackLimits?.[TOKEN_IDS.SHOCK_BOT]).toBe(2);
        expect(next.players['0'].artificerBotState?.[TOKEN_IDS.SHOCK_BOT]).toMatchObject({
            built: true,
            upgraded: true,
            activationsUsedThisTurn: 0,
        });
    });

    it('机器人作为同伴不会被清除或转移指示物的命令误处理', () => {
        const state = createHeroMatchup('artificer', 'monk')(['0', '1'], fixedRandom);
        setArtificerBot(state.core, '0', TOKEN_IDS.HEAL_BOT, { upgraded: true });

        const removeEvents = execute(state, {
            type: 'REMOVE_STATUS',
            playerId: '0',
            payload: { targetPlayerId: '0', statusId: TOKEN_IDS.HEAL_BOT },
            timestamp: 103,
        }, fixedRandom);
        const transferEvents = execute(state, {
            type: 'TRANSFER_STATUS',
            playerId: '0',
            payload: { fromPlayerId: '0', toPlayerId: '1', statusId: TOKEN_IDS.HEAL_BOT },
            timestamp: 104,
        }, fixedRandom);

        expect(removeEvents).toHaveLength(0);
        expect(transferEvents).toHaveLength(0);
    });

    it('治疗机器人激活后不会消失，且按骰面治疗 1 或 2', () => {
        const state = createHeroMatchup('monk', 'artificer')(['0', '1'], fixedRandom);
        setArtificerBot(state.core, '1', TOKEN_IDS.HEAL_BOT, { upgraded: true });
        state.core.players['1'].tokens[TOKEN_IDS.SYNTH] = 1;
        state.core.players['1'].resources[RESOURCE_IDS.HP] = 40;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'fist-technique',
            isDefendable: true,
        } as DiceThroneCore['pendingAttack'];
        state.core.pendingDamage = {
            id: 'damage-test',
            sourcePlayerId: '0',
            targetPlayerId: '1',
            originalDamage: 6,
            currentDamage: 6,
            sourceAbilityId: 'fist-technique',
            damageScope: 'attack',
            responseType: 'beforeDamageReceived',
            responderId: '1',
            isFullyEvaded: false,
        };

        const events = execute(state, {
            type: 'USE_TOKEN',
            playerId: '1',
            payload: { tokenId: TOKEN_IDS.HEAL_BOT, amount: 1 },
            timestamp: 105,
        }, createQueuedRandom([1]));
        const pending = applyEvents(state.core, events);

        expect(pending.pendingBonusDiceSettlement).toMatchObject({
            attackerId: '1',
            targetId: '1',
            sourceAbilityId: 'artificer-heal-bot-use',
        });
        expect(pending.players['1'].tokens[TOKEN_IDS.HEAL_BOT]).toBe(1);
        expect(pending.players['1'].tokens[TOKEN_IDS.SYNTH]).toBe(0);

        const settleEvents = execute({
            core: pending,
            sys: { phase: 'defensiveRoll' },
        } as any, {
            type: 'SKIP_BONUS_DICE_REROLL',
            playerId: '1',
            payload: {},
            timestamp: 106,
        } as any, fixedRandom);
        const next = applyEvents(pending, settleEvents);

        expect(next.players['1'].resources[RESOURCE_IDS.HP]).toBe(35);
        expect(next.pendingDamage).toBeUndefined();
        expect(next.players['1'].artificerBotState?.[TOKEN_IDS.HEAL_BOT]).toMatchObject({
            built: true,
            upgraded: true,
            activationsUsedThisTurn: 1,
        });
    });

    it('灵感突现 II 的从头构建选择后应同时收口当前攻击链', () => {
        const state = createHeroMatchup('artificer', 'monk')(['0', '1'], fixedRandom);
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'eureka-2-build-from-scratch',
            isDefendable: false,
            damageResolved: false,
            resolvedDamage: 0,
            settlementStage: 'preDamage',
            attackDiceFaceCounts: { wrench: 2, gear: 2, electricity: 1 },
            attackDiceValues: [1, 2, 4, 5, 6],
            bonusDamage: 0,
            attackModifierBonusDamage: 0,
        } as DiceThroneCore['pendingAttack'];
        state.core.currentChoiceSourceAbilityId = 'eureka-2-build-from-scratch';

        const next = reduce(state.core, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '0',
                value: 2,
                customId: 'artificer-build-from-scratch-resolve',
                sourceAbilityId: 'eureka-2-build-from-scratch',
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 106,
        } as DiceThroneEvent);

        expect(next.players['0'].tokens[TOKEN_IDS.SHOCK_BOT]).toBe(1);
        expect(next.players['0'].tokenStackLimits?.[TOKEN_IDS.SHOCK_BOT]).toBe(2);
        expect(next.players['0'].artificerBotState?.[TOKEN_IDS.SHOCK_BOT]).toMatchObject({
            built: true,
            upgraded: true,
            activationsUsedThisTurn: 0,
        });
        expect(next.pendingAttack).toMatchObject({
            sourceAbilityId: 'eureka-2-build-from-scratch',
            settlementStage: 'readyToResolve',
            postDamageFollowUpResolved: true,
        });
    });
});
