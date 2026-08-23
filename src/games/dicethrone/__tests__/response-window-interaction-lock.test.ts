/**
 * 响应窗口 + 交互锁定完整性测试。
 *
 * 核心校验：
 * 在 afterRollConfirmed 响应窗口中打出会创建交互的卡牌后，
 * 响应窗口必须保持打开，并通过 pendingInteractionId 继续锁定，
 * 直到交互完成或取消。
 */
import { describe, expect, it } from 'vitest';
import { resolveNextAiAction } from '../../../engine/ai';
import { DiceThroneDomain } from '../domain';
import { execute as executeDomainCommand } from '../domain/execute';
import { TOKEN_IDS } from '../domain/ids';
import { RESOURCE_IDS } from '../domain/resources';
import { ATTACK_SNAPSHOT_DIE_ID_OFFSET, getResponderQueue } from '../domain/rules';
import { diceModifyReducer, diceModifyToCommands, diceSelectReducer, diceSelectToCommands } from '../domain/systems';
import { engineConfig } from '../game';
import {
    advanceTo,
    cmd,
    createHeroMatchup,
    createQueuedRandom,
    createRunner,
    createSetupWithHand,
    fixedRandom,
    fistAttackAbilityId,
    getCardById,
} from './test-utils';

function assertWindowLockedWithInteraction(
    state: any,
    expectedInteractionKind: string,
    expectedPlayerId: string,
) {
    const interaction = state.sys.interaction?.current;
    expect(interaction, '交互应已创建').toBeDefined();
    expect(interaction?.kind).toBe(expectedInteractionKind);
    expect(interaction?.playerId).toBe(expectedPlayerId);

    const responseWindow = state.sys.responseWindow?.current;
    expect(responseWindow, '响应窗口应保持打开').toBeDefined();
    expect(responseWindow?.pendingInteractionId, '响应窗口应被交互锁定').toBeDefined();
}

function createUltimatePreActivationState() {
    const state = createHeroMatchup('cursed_pirate', 'monk', (core) => {
        core.players['1'].hand = [getCardById('card-unexpected')];
        core.players['1'].resources[RESOURCE_IDS.CP] = 10;
    })(['0', '1'], fixedRandom);

    state.sys.phase = 'offensiveRoll';
    state.core.activePlayerId = '0';
    state.core.rollCount = 1;
    state.core.rollConfirmed = true;
    state.core.dice = state.core.dice.map((die, index) => ({
        ...die,
        value: 6,
        symbol: index < 5 ? 'skull' : die.symbol,
        symbols: index < 5 ? ['skull'] : die.symbols,
    }));
    state.core.pendingAttack = {
        attackerId: '0',
        defenderId: '1',
        sourceAbilityId: 'merciless-plunder',
        isDefendable: false,
        isUltimate: true,
    };

    return state;
}

describe('终极技能发动前响应时机', () => {
    it('响应窗口等待玩家 1 时，玩家 0 不能在领域校验中继续出牌', () => {
        const state = createSetupWithHand(['card-surprise'], {
            playerId: '0',
            cp: 10,
            mutate: (core) => {
                core.activePlayerId = '1';
                core.rollCount = 1;
                core.rollConfirmed = true;
                core.dice = core.dice.map((die, index) => ({
                    ...die,
                    value: index + 1,
                    symbol: 'fist',
                    symbols: ['fist'],
                }));
            },
        })(['0', '1'], fixedRandom);
        state.sys.phase = 'offensiveRoll';
        state.sys.responseWindow.current = {
            id: 'afterRollConfirmed-test',
            windowType: 'afterRollConfirmed',
            responderQueue: ['1'],
            currentResponderIndex: 0,
            passedPlayers: [],
        };

        const validation = DiceThroneDomain.validate(state, {
            type: 'PLAY_CARD',
            playerId: '0',
            payload: { cardId: 'card-surprise' },
            timestamp: 1,
        } as any);

        expect(validation).toEqual({ valid: false, error: 'not_current_responder' });
    });

    it('响应窗口等待玩家 1 时，玩家 0 不能在领域校验中继续打升级牌', () => {
        const state = createSetupWithHand(['card-meditation-2'], {
            playerId: '0',
            cp: 10,
            mutate: (core) => {
                core.activePlayerId = '1';
            },
        })(['0', '1'], fixedRandom);
        state.sys.phase = 'main1';
        state.sys.responseWindow.current = {
            id: 'afterRollConfirmed-test',
            windowType: 'afterRollConfirmed',
            responderQueue: ['1'],
            currentResponderIndex: 0,
            passedPlayers: [],
        };

        const validation = DiceThroneDomain.validate(state, {
            type: 'PLAY_UPGRADE_CARD',
            playerId: '0',
            payload: { cardId: 'card-meditation-2', targetAbilityId: 'meditation' },
            timestamp: 1,
        } as any);

        expect(validation).toEqual({ valid: false, error: 'not_current_responder' });
    });

    it('已有攻击候选的确认骰响应窗口仍应把对手列为响应者', () => {
        const state = createUltimatePreActivationState();

        expect(getResponderQueue(
            state.core,
            'afterRollConfirmed',
            '1',
            undefined,
            '0',
            'offensiveRoll',
        )).toEqual(['1']);
    });

    it('终极技能发动前骰面被修改时应取消当前选择并要求重选', () => {
        const state = createUltimatePreActivationState();
        const events = executeDomainCommand(state, {
            type: 'MODIFY_DIE',
            playerId: '1',
            payload: { dieId: 0, newValue: 5 },
            timestamp: 1,
        } as any, fixedRandom);

        expect(events.map((event) => event.type)).toContain('ABILITY_RESELECTION_REQUIRED');
    });
});

describe('响应窗口交互锁定：骰子修改类（modifyDie）', () => {
    it('弹一手（modify-die-adjust-1, target=select）：完整流程', () => {
        const random = createQueuedRandom([1, 1, 1, 1, 1]);
        const runner = createRunner(random, true);

        const result1 = runner.run({
            name: '弹一手在 afterRollConfirmed 窗口中打出',
            setup: createSetupWithHand(['card-flick'], {
                playerId: '1',
                cp: 10,
                mutate: (core) => {
                    core.players['0'].hand = [];
                    core.players['0'].deck = [];
                    core.players['1'].deck = [];
                },
            }),
            commands: [
                ...advanceTo('offensiveRoll'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('PLAY_CARD', '1', { cardId: 'card-flick' }),
            ],
        });

        assertWindowLockedWithInteraction(result1.finalState, 'multistep-choice', '1');
        const lockedDecisionEpoch = result1.finalState.sys.decisionEpoch ?? 0;
        expect(lockedDecisionEpoch).toBeGreaterThan(0);
        const meta1 = (result1.finalState.sys.interaction?.current?.data as any)?.meta;
        expect(meta1?.targetOpponentDice).toBe(true);

        const result2 = runner.run({
            name: '修改骰子并确认交互',
            setup: () => result1.finalState,
            commands: [
                cmd('MODIFY_DIE', '1', { dieId: 0, newValue: 4 }),
                cmd('SYS_INTERACTION_CONFIRM', '1'),
            ],
        });

        expect(result2.finalState.core.dice.find((d: any) => d.id === 0)?.value).toBe(4);
        expect(result2.finalState.sys.interaction?.current).toBeUndefined();
        expect(result2.finalState.sys.responseWindow?.current).toBeUndefined();
        expect((result2.finalState.sys.decisionEpoch ?? 0)).toBeGreaterThan(lockedDecisionEpoch);
    });

    it('惊不惊喜（modify-die-any-1, target=select）：窗口锁定', () => {
        const random = createQueuedRandom([1, 1, 1, 1, 1]);
        const runner = createRunner(random, true);

        const result = runner.run({
            name: '惊不惊喜在 afterRollConfirmed 窗口中打出',
            setup: createSetupWithHand(['card-surprise'], {
                playerId: '1',
                cp: 10,
                mutate: (core) => {
                    core.players['0'].hand = [];
                    core.players['0'].deck = [];
                    core.players['1'].deck = [];
                },
            }),
            commands: [
                ...advanceTo('offensiveRoll'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('PLAY_CARD', '1', { cardId: 'card-surprise' }),
            ],
        });

        assertWindowLockedWithInteraction(result.finalState, 'multistep-choice', '1');
        const meta = (result.finalState.sys.interaction?.current?.data as any)?.meta;
        expect(meta?.dtType).toBe('modifyDie');
        expect(meta?.targetOpponentDice).toBe(true);
    });

    it('意不意外（modify-die-any-2, target=select）：窗口锁定', () => {
        const random = createQueuedRandom([1, 1, 1, 1, 1]);
        const runner = createRunner(random, true);

        const result = runner.run({
            name: '意不意外在 afterRollConfirmed 窗口中打出',
            setup: createSetupWithHand(['card-unexpected'], {
                playerId: '1',
                cp: 10,
                mutate: (core) => {
                    core.players['0'].hand = [];
                    core.players['0'].deck = [];
                    core.players['1'].deck = [];
                },
            }),
            commands: [
                ...advanceTo('offensiveRoll'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('PLAY_CARD', '1', { cardId: 'card-unexpected' }),
            ],
        });

        assertWindowLockedWithInteraction(result.finalState, 'multistep-choice', '1');
        const meta = (result.finalState.sys.interaction?.current?.data as any)?.meta;
        expect(meta?.dtType).toBe('modifyDie');
        expect(meta?.selectCount).toBe(2);
    });

    it('枪手在防御骰确认后的响应窗口可用惊不惊喜改防御方骰子', () => {
        const random = createQueuedRandom([1, 1, 1, 4, 5, 1, 2, 3, 4]);
        const runner = createRunner(random, true);

        const result = runner.run({
            name: '枪手在防御骰确认后使用惊不惊喜改防御方骰子',
            setup: createHeroMatchup('gunslinger', 'monk', (core) => {
                core.players['0'].hand = [getCardById('card-surprise')];
                core.players['0'].deck = [];
                core.players['0'].tokens.loaded = 0;
                core.players['0'].resources[RESOURCE_IDS.CP] = 10;
                core.players['1'].hand = [];
                core.players['1'].deck = [];
            }),
            commands: [
                ...advanceTo('offensiveRoll'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('RESPONSE_PASS', '0'),
                cmd('RESPONSE_PASS', '1'),
                cmd('SELECT_ABILITY', '0', { abilityId: 'revolver-3' }),
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '1'),
                cmd('CONFIRM_ROLL', '1'),
                cmd('PLAY_CARD', '0', { cardId: 'card-surprise' }),
            ],
        });

        expect(result.assertionErrors).toEqual([]);
        expect(result.finalState.sys.phase).toBe('defensiveRoll');
        assertWindowLockedWithInteraction(result.finalState, 'multistep-choice', '0');
        expect(result.finalState.core.players['0'].discard.some((card: any) => card.id === 'card-surprise')).toBe(true);

        const meta = (result.finalState.sys.interaction?.current?.data as any)?.meta;
        expect(meta).toMatchObject({
            dtType: 'modifyDie',
            targetOpponentDice: true,
            diceOwnerId: '1',
            selectCount: 1,
        });
    });

    it('攻击方奖励骰结算后仍可在防御骰响应窗口用惊不惊喜改防御骰', () => {
        const random = createQueuedRandom([1, 1, 1, 4, 5, 1, 2, 3, 4]);
        const runner = createRunner(random, true);

        const opened = runner.run({
            name: '攻击方奖励骰已结算后进入防御骰响应窗口',
            setup: createHeroMatchup('gunslinger', 'monk', (core) => {
                core.players['0'].hand = [getCardById('card-surprise')];
                core.players['0'].deck = [];
                core.players['0'].tokens.loaded = 0;
                core.players['0'].resources[RESOURCE_IDS.CP] = 10;
                core.players['1'].hand = [];
                core.players['1'].deck = [];
            }),
            commands: [
                ...advanceTo('offensiveRoll'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('RESPONSE_PASS', '0'),
                cmd('RESPONSE_PASS', '1'),
                cmd('SELECT_ABILITY', '0', { abilityId: 'revolver-3' }),
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '1'),
                cmd('CONFIRM_ROLL', '1'),
            ],
        });

        expect(opened.assertionErrors).toEqual([]);
        expect(opened.finalState.sys.responseWindow?.current).toMatchObject({
            windowType: 'afterRollConfirmed',
            responderQueue: ['0'],
        });

        runner.setState({
            ...opened.finalState,
            core: {
                ...opened.finalState.core,
                pendingAttack: opened.finalState.core.pendingAttack
                    ? {
                        ...opened.finalState.core.pendingAttack,
                        bonusDiceResolved: true,
                        bonusDamage: 2,
                        attackModifierBonusDamage: 2,
                    }
                    : opened.finalState.core.pendingAttack,
            },
        });

        const result = runner.dispatch('PLAY_CARD', {
            playerId: '0',
            cardId: 'card-surprise',
        });

        expect(result.success).toBe(true);
        expect(result.events.map((event: any) => event.type)).toContain('INTERACTION_REQUESTED');
        assertWindowLockedWithInteraction(result.finalState, 'multistep-choice', '0');
        expect(result.finalState.core.players['0'].discard.some((card: any) => card.id === 'card-surprise')).toBe(true);
    });

    it('防御方枪手在防御骰确认后的响应窗口可用惊不惊喜改攻击方骰子', () => {
        const random = createQueuedRandom([1, 1, 1, 1, 1, 1, 2, 3, 4, 5]);
        const runner = createRunner(random, true);

        const result = runner.run({
            name: '防御方枪手在防御骰确认后使用惊不惊喜改攻击方骰子',
            setup: createHeroMatchup('monk', 'gunslinger', (core) => {
                core.players['0'].hand = [];
                core.players['0'].deck = [];
                core.players['1'].hand = [getCardById('card-surprise')];
                core.players['1'].deck = [];
                core.players['1'].tokens.loaded = 0;
                core.players['1'].resources[RESOURCE_IDS.CP] = 10;
            }),
            commands: [
                ...advanceTo('offensiveRoll'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('RESPONSE_PASS', '0'),
                cmd('RESPONSE_PASS', '1'),
                cmd('SELECT_ABILITY', '0', { abilityId: fistAttackAbilityId }),
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '1'),
                cmd('CONFIRM_ROLL', '1'),
                cmd('RESPONSE_PASS', '0'),
                cmd('PLAY_CARD', '1', { cardId: 'card-surprise' }),
            ],
        });

        expect(result.assertionErrors).toEqual([]);
        expect(result.finalState.sys.phase).toBe('defensiveRoll');
        expect(result.finalState.sys.interaction?.current?.kind).toBe('multistep-choice');
        expect(result.finalState.sys.interaction?.current?.playerId).toBe('1');
        expect(result.finalState.sys.responseWindow?.current).toBeUndefined();
        expect(result.finalState.core.players['1'].discard.some((card: any) => card.id === 'card-surprise')).toBe(true);

        const interactionData = result.finalState.sys.interaction?.current?.data as any;
        const meta = interactionData?.meta;
        expect(interactionData?.allowedDieIds).toEqual(expect.arrayContaining([0, 1]));
        expect(meta).toMatchObject({
            dtType: 'modifyDie',
            targetOpponentDice: true,
            selectCount: 1,
        });
        expect(meta?.diceOwnerId).toBeUndefined();

        runner.setState(result.finalState);
        const modifyAttackDie = runner.dispatch('MODIFY_DIE', {
            playerId: '1',
            dieId: 1,
            newValue: 6,
        });

        expect(modifyAttackDie.success).toBe(true);
        expect(modifyAttackDie.finalState.core.dice[0]?.value).toBe(1);
        expect(modifyAttackDie.finalState.core.dice[1]?.value).not.toBe(6);
        expect(modifyAttackDie.finalState.core.currentRollContext?.dice.find((die: any) => die.id === 1)?.value).toBe(6);
    });

    it('防御方在普通防御骰确认后的响应窗口可用惊不惊喜改攻击快照骰子', () => {
        const random = createQueuedRandom([1, 1, 1, 1, 1, 2, 3, 4]);
        const runner = createRunner(random, true);

        const result = runner.run({
            name: '防御方普通防御后使用惊不惊喜改攻击快照骰子',
            setup: createHeroMatchup('monk', 'barbarian', (core) => {
                core.players['0'].hand = [];
                core.players['0'].deck = [];
                core.players['1'].hand = [getCardById('card-surprise')];
                core.players['1'].deck = [];
                core.players['1'].resources[RESOURCE_IDS.CP] = 10;
            }),
            commands: [
                ...advanceTo('offensiveRoll'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('RESPONSE_PASS', '0'),
                cmd('RESPONSE_PASS', '1'),
                cmd('SELECT_ABILITY', '0', { abilityId: fistAttackAbilityId }),
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '1'),
                cmd('CONFIRM_ROLL', '1'),
                cmd('RESPONSE_PASS', '0'),
                cmd('PLAY_CARD', '1', { cardId: 'card-surprise' }),
            ],
        });

        expect(result.assertionErrors).toEqual([]);
        expect(result.finalState.sys.phase).toBe('defensiveRoll');
        expect(result.finalState.core.pendingAttack?.defenseAbilityId).toBe('thick-skin');
        expect(result.finalState.core.players['1'].discard.some((card: any) => card.id === 'card-surprise')).toBe(true);

        const interactionData = result.finalState.sys.interaction?.current?.data as any;
        const meta = interactionData?.meta;
        expect(interactionData?.allowedDieIds).toEqual(expect.arrayContaining([
            0,
            1,
            2,
            ATTACK_SNAPSHOT_DIE_ID_OFFSET,
        ]));
        expect(meta).toMatchObject({
            dtType: 'modifyDie',
            targetOpponentDice: true,
            selectCount: 1,
        });
        expect(meta?.diceOwnerId).toBeUndefined();

        runner.setState(result.finalState);
        const modifyAttackDie = runner.dispatch('MODIFY_DIE', {
            playerId: '1',
            dieId: ATTACK_SNAPSHOT_DIE_ID_OFFSET,
            newValue: 6,
        });

        expect(modifyAttackDie.success).toBe(true);
        expect(modifyAttackDie.finalState.core.dice[0]?.value).toBe(2);
        expect(modifyAttackDie.finalState.core.pendingAttack?.attackDiceValues?.[0]).toBe(6);
        expect(modifyAttackDie.finalState.core.pendingAttack?.attackDiceFaceCounts).toMatchObject({ fist: 4 });
    });
});

describe('伤害响应期间的卡牌后续交互', () => {
    it('防御方在伤害响应中打出“来个六！”后，应先完成选骰再回到伤害响应', () => {
        const random = createQueuedRandom([5, 5, 1, 3, 3]);
        const runner = createRunner(random, true);

        const result1 = runner.run({
            name: '伤害响应中打出来个六',
            setup: (playerIds, setupRandom) => {
                const state = createHeroMatchup('cursed_pirate', 'zhanshujia', (core) => {
                    core.players['0'].hand = [getCardById('card-play-six')];
                    core.players['0'].resources[RESOURCE_IDS.CP] = 10;
                    core.players['1'].hand = [];
                    core.players['0'].deck = [];
                    core.players['1'].deck = [];
                })(playerIds, setupRandom);
                state.sys.phase = 'defensiveRoll';
                state.sys.interaction.current = {
                    id: 'dt-token-response-damage-test',
                    kind: 'dt:token-response',
                    playerId: '0',
                    data: null,
                };
                state.core.phase = 'defensiveRoll' as any;
                state.core.activePlayerId = '1';
                state.core.rollCount = 1;
                state.core.rollLimit = 1;
                state.core.rollConfirmed = true;
                state.core.rollDiceCount = 5;
                state.core.dice = state.core.dice.map((die, index) => ({
                    ...die,
                    value: [5, 5, 1, 3, 3][index] ?? die.value,
                    isKept: false,
                }));
                state.core.pendingAttack = {
                    attackerId: '1',
                    defenderId: '0',
                    settlementStage: 'preDamage',
                    isDefendable: true,
                    sourceAbilityId: 'flanking',
                    isUltimate: false,
                    damageResolved: false,
                    resolvedDamage: 0,
                    preDefenseResolved: true,
                    defenseAbilityId: 'still-wet-behind-ears',
                    defenseResolved: true,
                } as any;
                state.core.pendingDamage = {
                    id: 'damage-test',
                    sourcePlayerId: '1',
                    targetPlayerId: '0',
                    originalDamage: 6,
                    currentDamage: 6,
                    sourceAbilityId: 'flanking',
                    damageScope: 'attack',
                    responseType: 'beforeDamageReceived',
                    responderId: '0',
                    isFullyEvaded: false,
                };
                return state;
            },
            commands: [
                cmd('PLAY_CARD', '0', { cardId: 'card-play-six' }),
            ],
        });

        expect(result1.assertionErrors).toEqual([]);
        expect(result1.finalState.sys.interaction.current?.kind).toBe('multistep-choice');
        expect(result1.finalState.sys.interaction.current?.playerId).toBe('0');
        expect((result1.finalState.sys.interaction.current?.data as any)?.meta?.dtType).toBe('modifyDie');
        expect(result1.finalState.sys.interaction.queue[0]?.kind).toBe('dt:token-response');

        const result2 = runner.run({
            name: '来个六改骰后仍等待确认',
            setup: () => result1.finalState,
            commands: [
                cmd('MODIFY_DIE', '0', { dieId: 2, newValue: 6 }),
            ],
        });

        expect(result2.assertionErrors).toEqual([]);
        expect(result2.finalState.core.dice[2]?.value).toBe(6);
        expect(result2.finalState.sys.interaction.current?.kind).toBe('multistep-choice');
        expect(result2.finalState.sys.interaction.current?.playerId).toBe('0');
        expect((result2.finalState.sys.interaction.current?.data as any)?.completedDieIds).toContain(2);
        expect(result2.finalState.core.pendingDamage?.id).toBe('damage-test');

        const result3 = runner.run({
            name: '确认来个六选骰后回到伤害响应',
            setup: () => result2.finalState,
            commands: [
                cmd('SYS_INTERACTION_CONFIRM', '0'),
            ],
        });

        expect(result3.assertionErrors).toEqual([]);
        expect(result3.finalState.sys.interaction.current?.kind).toBe('dt:token-response');
        expect(result3.finalState.sys.interaction.current?.playerId).toBe('0');
        expect(result3.finalState.core.pendingDamage?.id).toBe('damage-test');
    });
});

describe('modifyDie 严格超限回归', () => {
    it('咒缚海盗三颗 6 应能用意不意外一次补成五颗 6', () => {
        const random = createQueuedRandom([6, 6, 6, 1, 1]);
        const runner = createRunner(random, true);

        const result = runner.run({
            name: '咒缚海盗三颗 6 使用意不意外补成五颗 6',
            setup: createHeroMatchup('cursed_pirate', 'monk', (core) => {
                core.players['0'].hand = [getCardById('card-unexpected')];
                core.players['0'].resources[RESOURCE_IDS.CP] = 10;
                core.players['1'].hand = [];
                core.players['1'].deck = [];
            }),
            commands: [
                ...advanceTo('offensiveRoll'),
                cmd('ROLL_DICE', '0'),
                cmd('PLAY_CARD', '0', { cardId: 'card-unexpected' }),
                cmd('MODIFY_DIE', '0', { dieId: 3, newValue: 6 }),
                cmd('MODIFY_DIE', '0', { dieId: 4, newValue: 6 }),
                cmd('SYS_INTERACTION_CONFIRM', '0'),
            ],
            expect: {
                diceValues: [6, 6, 6, 6, 6],
                pendingInteraction: null,
                players: { '0': { discardSize: 1 } },
            },
        });

        expect(result.assertionErrors).toEqual([]);
    });

    it('card-unexpected 本地 any-2 预览不得累计到第 3/4 颗骰子', () => {
        let result = { modifications: {}, modCount: 0, totalAdjustment: 0 };

        result = diceModifyReducer(result, { action: 'setAny', dieId: 0, newValue: 6 }, { mode: 'any' }, 2);
        result = diceModifyReducer(result, { action: 'setAny', dieId: 1, newValue: 5 }, { mode: 'any' }, 2);
        result = diceModifyReducer(result, { action: 'setAny', dieId: 2, newValue: 4 }, { mode: 'any' }, 2);
        result = diceModifyReducer(result, { action: 'setAny', dieId: 3, newValue: 3 }, { mode: 'any' }, 2);
        result = diceModifyReducer(result, { action: 'setAny', dieId: 0, newValue: 2 }, { mode: 'any' }, 2);

        expect(result).toEqual({
            modifications: { 0: 2, 1: 5 },
            modCount: 2,
            totalAdjustment: 0,
        });
        expect(diceModifyToCommands(result, 2)).toEqual([
            { type: 'MODIFY_DIE', payload: { dieId: 0, newValue: 2 } },
            { type: 'MODIFY_DIE', payload: { dieId: 1, newValue: 5 } },
        ]);
    });

    it('card-me-too 本地 copy 模式重复点同一源骰不得提前形成两步', () => {
        let result = { modifications: {}, modCount: 0, totalAdjustment: 0 };

        result = diceModifyReducer(result, { action: 'select', dieId: 4, dieValue: 6 }, { mode: 'copy' }, 2);
        result = diceModifyReducer(result, { action: 'select', dieId: 4, dieValue: 6 }, { mode: 'copy' }, 2);

        expect(result).toEqual({
            modifications: { 4: 6 },
            modCount: 1,
            totalAdjustment: 0,
        });
        expect(diceModifyToCommands(result, 2)).toEqual([
            { type: 'MODIFY_DIE', payload: { dieId: 4, newValue: 6 } },
        ]);
    });

    it('reroll up to N 本地选择不得超过 selectCount，但允许少选后确认', () => {
        let result = { selectedDiceIds: [] };

        result = diceSelectReducer(result, { action: 'toggle', dieId: 0 }, 2);
        result = diceSelectReducer(result, { action: 'toggle', dieId: 1 }, 2);
        result = diceSelectReducer(result, { action: 'toggle', dieId: 2 }, 2);

        expect(result).toEqual({ selectedDiceIds: [0, 1] });
        expect(diceSelectToCommands(result, 2)).toEqual([
            { type: 'REROLL_DIE', payload: { dieId: 0 } },
            { type: 'REROLL_DIE', payload: { dieId: 1 } },
        ]);

        result = diceSelectReducer(result, { action: 'toggle', dieId: 1 }, 2);
        expect(result).toEqual({ selectedDiceIds: [0] });
        expect(diceSelectToCommands(result, 2)).toEqual([
            { type: 'REROLL_DIE', payload: { dieId: 0 } },
        ]);
    });

    it('card-unexpected 只能修改 2 颗骰子，第 3 次 MODIFY_DIE 会被拒绝', () => {
        const random = createQueuedRandom([1, 1, 1, 1, 1]);
        const runner = createRunner(random, true);

        const setupResult = runner.run({
            name: 'card-unexpected 在 afterRollConfirmed 窗口中打出',
            setup: createSetupWithHand(['card-unexpected'], {
                playerId: '1',
                cp: 10,
                mutate: (core) => {
                    core.players['0'].hand = [];
                    core.players['0'].deck = [];
                    core.players['1'].deck = [];
                },
            }),
            commands: [
                ...advanceTo('offensiveRoll'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('PLAY_CARD', '1', { cardId: 'card-unexpected' }),
            ],
        });

        runner.setState(setupResult.finalState);

        const firstModify = runner.dispatch('MODIFY_DIE', { playerId: '1', dieId: 0, newValue: 4 });
        expect(firstModify.success).toBe(true);

        const secondModify = runner.dispatch('MODIFY_DIE', { playerId: '1', dieId: 1, newValue: 5 });
        expect(secondModify.success).toBe(true);

        const thirdModify = runner.dispatch('MODIFY_DIE', { playerId: '1', dieId: 2, newValue: 6 });
        expect(thirdModify.success).toBe(false);
        expect(thirdModify.error).toBe('modify_die_limit_reached');

        const diceValues = thirdModify.finalState.core.dice.map((die: any) => die.value);
        expect(diceValues.slice(0, 5)).toEqual([4, 5, 1, 1, 1]);

        const completedDieIds = (thirdModify.finalState.sys.interaction?.current?.data as any)?.completedDieIds;
        expect(completedDieIds).toEqual([0, 1]);
    });

    it('card-unexpected 重复修改同一颗骰子时，应拒绝重复消费且不得提前完成交互', () => {
        const random = createQueuedRandom([1, 1, 1, 1, 1]);
        const runner = createRunner(random, true);

        const setupResult = runner.run({
            name: 'card-unexpected 重复修改同一颗骰子',
            setup: createSetupWithHand(['card-unexpected'], {
                playerId: '1',
                cp: 10,
                mutate: (core) => {
                    core.players['0'].hand = [];
                    core.players['0'].deck = [];
                    core.players['1'].deck = [];
                },
            }),
            commands: [
                ...advanceTo('offensiveRoll'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('PLAY_CARD', '1', { cardId: 'card-unexpected' }),
            ],
        });

        runner.setState(setupResult.finalState);

        const firstModify = runner.dispatch('MODIFY_DIE', { playerId: '1', dieId: 0, newValue: 4 });
        expect(firstModify.success).toBe(true);

        const secondModify = runner.dispatch('MODIFY_DIE', { playerId: '1', dieId: 0, newValue: 5 });
        expect(secondModify.success).toBe(false);
        expect(secondModify.error).toBe('die_already_completed');
        expect(secondModify.finalState.sys.interaction?.current?.kind).toBe('multistep-choice');
        expect((secondModify.finalState.sys.interaction?.current?.data as any)?.completedDieIds).toEqual([0]);
    });
});

describe('响应窗口交互锁定：骰子重掷类（selectDie）', () => {
    it('抬一手（reroll-opponent-die-1, target=opponent）：窗口锁定', () => {
        const random = createQueuedRandom([1, 1, 1, 1, 1, 6]);
        const runner = createRunner(random, true);

        const result = runner.run({
            name: '抬一手在 afterRollConfirmed 窗口中打出',
            setup: createSetupWithHand(['card-give-hand'], {
                playerId: '1',
                cp: 10,
                mutate: (core) => {
                    core.players['0'].hand = [];
                    core.players['0'].deck = [];
                    core.players['1'].deck = [];
                },
            }),
            commands: [
                ...advanceTo('offensiveRoll'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('PLAY_CARD', '1', { cardId: 'card-give-hand' }),
            ],
        });

        assertWindowLockedWithInteraction(result.finalState, 'multistep-choice', '1');
        const meta = (result.finalState.sys.interaction?.current?.data as any)?.meta;
        expect(meta?.dtType).toBe('selectDie');
        expect(meta?.targetOpponentDice).toBe(true);
    });
});

describe('响应窗口交互锁定：取消交互', () => {
    it('交互锁定期间 RESPONSE_PASS 应被拒绝，且不得提前清掉窗口或交互', () => {
        const random = createQueuedRandom([1, 1, 1, 1, 1]);
        const runner = createRunner(random, true);

        const setupResult = runner.run({
            name: '弹一手在响应窗口中打出并创建交互',
            setup: createSetupWithHand(['card-flick'], {
                playerId: '1',
                cp: 10,
                mutate: (core) => {
                    core.players['0'].hand = [];
                    core.players['0'].deck = [];
                    core.players['1'].deck = [];
                },
            }),
            commands: [
                ...advanceTo('offensiveRoll'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('PLAY_CARD', '1', { cardId: 'card-flick' }),
            ],
        });

        assertWindowLockedWithInteraction(setupResult.finalState, 'multistep-choice', '1');
        runner.setState(setupResult.finalState);

        const blockedPass = runner.dispatch('RESPONSE_PASS', { playerId: '1' });

        expect(blockedPass.success).toBe(false);
        expect(blockedPass.error).toBe('交互处理中，无法跳过响应');
        expect(blockedPass.finalState.sys.interaction?.current?.kind).toBe('multistep-choice');
        expect(blockedPass.finalState.sys.responseWindow?.current?.pendingInteractionId).toBeDefined();
    });

    it('取消弹一手交互后，卡牌返回手牌', () => {
        const random = createQueuedRandom([1, 1, 1, 1, 1]);
        const runner = createRunner(random, true);

        const result1 = runner.run({
            name: '弹一手在响应窗口中打出',
            setup: createSetupWithHand(['card-flick'], {
                playerId: '1',
                cp: 10,
                mutate: (core) => {
                    core.players['0'].hand = [];
                    core.players['0'].deck = [];
                    core.players['1'].deck = [];
                },
            }),
            commands: [
                ...advanceTo('offensiveRoll'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('PLAY_CARD', '1', { cardId: 'card-flick' }),
            ],
        });

        assertWindowLockedWithInteraction(result1.finalState, 'multistep-choice', '1');

        const result2 = runner.run({
            name: '取消弹一手交互',
            setup: () => result1.finalState,
            commands: [cmd('SYS_INTERACTION_CANCEL', '1')],
        });

        expect(result2.finalState.sys.interaction?.current).toBeUndefined();
        expect(result2.finalState.core.players['1'].hand.some((c: any) => c.id === 'card-flick')).toBe(true);
    });
});

describe('AI 私有状态选择的唯一执行入口', () => {
    it('afterCardPlayed 响应者打出即时牌后，不应被触发牌玩家的状态选择交互卡住', () => {
        const runner = createRunner(fixedRandom, true);
        const opened = runner.run({
            name: '转移状态触发 afterCardPlayed 后等待对手响应',
            setup: (playerIds, random) => {
                const state = createHeroMatchup(
                    'monk',
                    'barbarian',
                    (core) => {
                        core.activePlayerId = '0';
                        core.turnPhase = 'main1';
                        core.players['0'].hand = [getCardById('card-transfer-status')];
                        core.players['0'].deck = [];
                        core.players['0'].tokens[TOKEN_IDS.TACTICAL_ADVANTAGE] = 1;
                        core.players['0'].resources[RESOURCE_IDS.CP] = 10;
                        core.players['1'].hand = [getCardById('card-boss-generous')];
                        core.players['1'].deck = [];
                        core.players['1'].resources[RESOURCE_IDS.CP] = 1;
                    },
                )(playerIds, random);
                state.sys.phase = 'main1';
                return state;
            },
            commands: [cmd('PLAY_CARD', '0', { cardId: 'card-transfer-status' })],
        });

        expect(opened.assertionErrors).toEqual([]);
        expect(opened.finalState.sys.responseWindow?.current).toMatchObject({
            windowType: 'afterCardPlayed',
            sourceId: 'card-transfer-status',
            responderQueue: ['1'],
        });
        expect(opened.finalState.core.cardPlayedSequence).toBeGreaterThan(0);
        expect(opened.finalState.core.afterCardResponseWindowSequence).toBe(opened.finalState.core.cardPlayedSequence);
        expect(opened.finalState.sys.interaction?.current).toMatchObject({
            kind: 'dt:card-interaction',
            playerId: '0',
        });

        runner.setState(opened.finalState);
        const responded = runner.dispatch('PLAY_CARD', {
            playerId: '1',
            cardId: 'card-boss-generous',
        });

        expect(responded.success).toBe(true);
        expect(responded.finalState.sys.responseWindow?.current).toBeUndefined();
        expect(responded.finalState.sys.interaction?.current).toMatchObject({
            kind: 'dt:card-interaction',
            playerId: '0',
        });
        expect(responded.finalState.core.players['1'].discard.map((card: any) => card.id)).toContain('card-boss-generous');
        expect(responded.finalState.core.players['1'].resources[RESOURCE_IDS.CP]).toBe(3);
        expect(responded.finalState.core.cardPlayedSequence).toBe(opened.finalState.core.cardPlayedSequence);
        expect(responded.finalState.core.afterCardResponseWindowSequence).toBe(opened.finalState.core.cardPlayedSequence);
    });

    it('AI 作为 afterCardPlayed 当前响应者时，不应被触发牌玩家的私有状态选择遮蔽为跳过响应', async () => {
        const runner = createRunner(fixedRandom, true);
        const opened = runner.run({
            name: '转移状态触发 afterCardPlayed 后等待 AI 响应',
            setup: (playerIds, random) => {
                const state = createHeroMatchup(
                    'monk',
                    'barbarian',
                    (core) => {
                        core.activePlayerId = '0';
                        core.turnPhase = 'main1';
                        core.players['0'].hand = [getCardById('card-transfer-status')];
                        core.players['0'].deck = [];
                        core.players['0'].tokens[TOKEN_IDS.TACTICAL_ADVANTAGE] = 1;
                        core.players['0'].resources[RESOURCE_IDS.CP] = 10;
                        core.players['1'].hand = [getCardById('card-boss-generous')];
                        core.players['1'].deck = [];
                        core.players['1'].resources[RESOURCE_IDS.CP] = 1;
                    },
                )(playerIds, random);
                state.sys.phase = 'main1';
                return state;
            },
            commands: [cmd('PLAY_CARD', '0', { cardId: 'card-transfer-status' })],
        });

        expect(opened.assertionErrors).toEqual([]);
        expect(opened.finalState.sys.responseWindow?.current).toMatchObject({
            windowType: 'afterCardPlayed',
            responderQueue: ['1'],
        });
        expect(opened.finalState.sys.interaction?.current).toMatchObject({
            kind: 'dt:card-interaction',
            playerId: '0',
        });

        const resolution = await resolveNextAiAction({
            engineConfig,
            state: opened.finalState,
            matchId: 'dicethrone-after-card-played-ai-hidden-trigger-interaction',
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai', minimumActionDelayMs: 0 },
            },
        });

        expect(resolution?.playerId).toBe('1');
        expect(resolution?.action.kind).toBe('response-play-card');
        expect(resolution?.action.metadata).toMatchObject({ cardId: 'card-boss-generous' });
        expect(resolution?.action.commands).toEqual([{
            type: 'PLAY_CARD',
            payload: { cardId: 'card-boss-generous' },
        }]);
    });

    it('AI 在 afterRollConfirmed 响应窗口不能打出拜拜了您嘞，非法出牌不得破坏响应窗口', () => {
        const runner = createRunner(createQueuedRandom([1, 1, 1, 1, 1]), true);
        const windowOpened = runner.run({
            name: '确认攻击骰后的响应窗口拒绝拜拜了您嘞',
            setup: createSetupWithHand(['card-bye-bye', 'card-flick'], {
                playerId: '1',
                cp: 10,
                mutate: (core) => {
                    core.players['0'].tokens[TOKEN_IDS.TACTICAL_ADVANTAGE] = 1;
                    core.players['0'].hand = [];
                    core.players['0'].deck = [];
                    core.players['1'].deck = [];
                },
            }),
            commands: [
                ...advanceTo('offensiveRoll'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
            ],
        });

        expect(windowOpened.assertionErrors).toEqual([]);
        expect(windowOpened.finalState.sys.phase).toBe('offensiveRoll');
        const responseWindowBefore = windowOpened.finalState.sys.responseWindow?.current;
        expect(responseWindowBefore).toMatchObject({
            windowType: 'afterRollConfirmed',
            responderQueue: ['1'],
        });
        expect(windowOpened.finalState.sys.interaction?.current).toBeUndefined();

        runner.setState(windowOpened.finalState);
        const blocked = runner.dispatch('PLAY_CARD', {
            playerId: '1',
            cardId: 'card-bye-bye',
        });

        expect(blocked.success).toBe(false);
        expect(blocked.error).toBe('wrongPhaseForCard');
        expect(blocked.finalState.core.players['1'].hand.map((card: any) => card.id)).toContain('card-bye-bye');
        expect(blocked.finalState.core.players['1'].discard.map((card: any) => card.id)).not.toContain('card-bye-bye');
        expect(blocked.finalState.sys.interaction?.current).toBeUndefined();
        expect(blocked.finalState.sys.responseWindow?.current).toEqual(responseWindowBefore);
    });

    it('本地 AI 打出拜拜了您嘞后应移除状态，不得退回为 RESPONSE_PASS', async () => {
        const runner = createRunner(fixedRandom, true);
        const played = runner.run({
            name: '本地 AI 在主阶段打出拜拜了您嘞并选择移除战术优势',
            setup: (playerIds, random) => {
                const state = createSetupWithHand(['card-bye-bye'], {
                    playerId: '1',
                    cp: 10,
                    mutate: (core) => {
                        core.players['0'].tokens[TOKEN_IDS.TACTICAL_ADVANTAGE] = 1;
                        core.players['0'].hand = [];
                        core.players['0'].deck = [];
                        core.players['1'].deck = [];
                        core.activePlayerId = '1';
                        core.turnPhase = 'main1';
                    },
                })(playerIds, random);
                state.sys.phase = 'main1';
                return state;
            },
            commands: [cmd('PLAY_CARD', '1', { cardId: 'card-bye-bye' })],
        });

        expect(played.assertionErrors).toEqual([]);
        expect(played.finalState.sys.interaction?.current?.playerId).toBe('1');
        expect(played.finalState.sys.interaction?.current?.kind).toBe('dt:card-interaction');

        const resolution = await resolveNextAiAction({
            engineConfig,
            state: played.finalState,
            matchId: 'dicethrone-bye-bye-private-ai-choice',
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai', minimumActionDelayMs: 0 },
            },
        });

        expect(resolution?.playerId).toBe('1');
        expect(resolution?.action.kind).toBe('interaction-remove-status');
        expect(resolution?.action.commands).toEqual([
            {
                type: 'REMOVE_STATUS',
                payload: {
                    targetPlayerId: '0',
                    statusId: TOKEN_IDS.TACTICAL_ADVANTAGE,
                },
            },
        ]);
        expect(resolution?.action.commands.some((command) => command.type === 'RESPONSE_PASS')).toBe(false);

        runner.setState(played.finalState);
        const removed = runner.dispatch('REMOVE_STATUS', {
            playerId: '1',
            targetPlayerId: '0',
            statusId: TOKEN_IDS.TACTICAL_ADVANTAGE,
        });

        expect(removed.success).toBe(true);
        expect(removed.finalState.core.players['0'].tokens[TOKEN_IDS.TACTICAL_ADVANTAGE]).toBe(0);
        expect(removed.finalState.sys.interaction?.current).toBeUndefined();
    });
});
