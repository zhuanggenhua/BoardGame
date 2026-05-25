/**
 * 测试学徒打出 ongoing 行动卡的流程
 * 
 * Bug: 学徒通过 play_extra 打出 ongoing 行动卡时，没有选择目标基地的交互
 * Fix: 检测到 ongoing 行动卡时，先创建选择基地的交互，然后再打出
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { makeState, makePlayer, makeCard, makeBase, makeMatchState } from './helpers';
import { runCommand, defaultTestRandom } from './testRunner';
import { SU_COMMANDS, SU_EVENTS } from '../domain/types';
import { INTERACTION_COMMANDS } from '../../../engine/systems/InteractionSystem';
import { registerWizardAbilities } from '../abilities/wizards';
import { registerZombieAbilities } from '../abilities/zombies';
import { clearRegistry } from '../domain/abilityRegistry';
import { clearInteractionHandlers } from '../domain/abilityInteractionHandlers';

beforeAll(() => {
    clearRegistry();
    clearInteractionHandlers();
    registerWizardAbilities();
    registerZombieAbilities();
});

describe('学徒打出 ongoing 行动卡', () => {
    it('直接打出被他人拥有的 ongoing 行动时，附着后仍应保留 owner 且从当前玩家手牌移除', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('overrun', 'zombie_overrun', 'action', '1')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({ defId: 'base_a' })],
        });

        const result = runCommand(makeMatchState(state), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'overrun', targetBaseIndex: 0 },
        }, defaultTestRandom);

        expect(result.success).toBe(true);
        const attachEvent = result.events.find(event => event.type === 'su:ongoing_attached') as any;
        expect(attachEvent?.payload?.ownerId).toBe('1');

        const finalCore = result.finalState.core;
        expect(finalCore.bases[0].ongoingActions).toContainEqual(
            expect.objectContaining({ uid: 'overrun', defId: 'zombie_overrun', ownerId: '1' }),
        );
        expect(finalCore.players['0'].hand.some(card => card.uid === 'overrun')).toBe(false);
        expect(finalCore.players['1'].hand.some(card => card.uid === 'overrun')).toBe(false);
    });

    it('学徒选择把当前牌库顶 borrowed 行动放入手牌时，应进入当前玩家手牌且不动真实拥有者牌库', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('m1', 'wizard_neophyte', 'minion', '0')],
                    deck: [
                        makeCard('borrowed-summon', 'wizard_summon', 'action', '1'),
                        makeCard('p0-tail', 'test_minion', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1', {
                    deck: [makeCard('p1-tail', 'test_minion', 'minion', '1')],
                }),
            },
            bases: [makeBase()],
        });

        const playNeophyte = runCommand(makeMatchState(state), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'm1', baseIndex: 0 },
        }, defaultTestRandom);
        expect(playNeophyte.success).toBe(true);
        expect(playNeophyte.finalState.sys.interaction.current?.data?.sourceId).toBe('wizard_neophyte');

        const chooseToHand = runCommand(playNeophyte.finalState, {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '0',
            payload: { optionId: 'to_hand' },
        }, defaultTestRandom);
        expect(chooseToHand.success).toBe(true);

        const drawEvent = chooseToHand.events.find(event => event.type === SU_EVENTS.CARDS_DRAWN) as any;
        expect(drawEvent?.payload).toEqual(expect.objectContaining({
            playerId: '0',
            cardUids: ['borrowed-summon'],
        }));
        expect(chooseToHand.finalState.core.players['0'].hand).toContainEqual(
            expect.objectContaining({ uid: 'borrowed-summon', owner: '1' }),
        );
        expect(chooseToHand.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['p0-tail']);
        expect(chooseToHand.finalState.core.players['1'].deck.map(card => card.uid)).toEqual(['p1-tail']);
        expect(chooseToHand.finalState.core.players['1'].hand.some(card => card.uid === 'borrowed-summon')).toBe(false);
    });

    it('学徒额外打出当前牌库顶 borrowed ongoing 行动时，应从当前牌库移除并保留真实 owner 附着', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('m1', 'wizard_neophyte', 'minion', '0')],
                    deck: [
                        makeCard('borrowed-overrun', 'zombie_overrun', 'action', '1'),
                        makeCard('p0-tail', 'test_minion', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1', {
                    deck: [makeCard('p1-tail', 'test_minion', 'minion', '1')],
                }),
            },
            bases: [makeBase({ defId: 'base_a' }), makeBase({ defId: 'base_b' })],
        });

        const playNeophyte = runCommand(makeMatchState(state), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'm1', baseIndex: 0 },
        }, defaultTestRandom);
        expect(playNeophyte.success).toBe(true);
        expect(playNeophyte.finalState.sys.interaction.current?.data?.sourceId).toBe('wizard_neophyte');

        const choosePlay = runCommand(playNeophyte.finalState, {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '0',
            payload: { optionId: 'play_extra' },
        }, defaultTestRandom);
        expect(choosePlay.success).toBe(true);

        const targetPrompt = choosePlay.finalState.sys.interaction.current;
        expect(targetPrompt?.data?.sourceId).toBe('wizard_neophyte_choose_base');
        const baseOption = (targetPrompt?.data?.options ?? [])[0];

        const resolveTarget = runCommand(choosePlay.finalState, {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '0',
            payload: { optionId: baseOption.id },
        }, defaultTestRandom);
        expect(resolveTarget.success).toBe(true);

        expect(resolveTarget.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.CARD_REMOVED_FROM_DECK,
            payload: expect.objectContaining({
                playerId: '0',
                cardUid: 'borrowed-overrun',
                defId: 'zombie_overrun',
            }),
        }));
        expect(resolveTarget.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ACTION_PLAYED,
            payload: expect.objectContaining({
                playerId: '0',
                cardUid: 'borrowed-overrun',
                defId: 'zombie_overrun',
                ownerId: '1',
                isExtraAction: true,
                targetBaseIndex: 0,
            }),
        }));
        expect(resolveTarget.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ONGOING_ATTACHED,
            payload: expect.objectContaining({
                cardUid: 'borrowed-overrun',
                defId: 'zombie_overrun',
                ownerId: '1',
                targetType: 'base',
                targetBaseIndex: 0,
            }),
        }));
        expect(resolveTarget.finalState.core.bases[0].ongoingActions).toContainEqual(
            expect.objectContaining({ uid: 'borrowed-overrun', defId: 'zombie_overrun', ownerId: '1' }),
        );
        expect(resolveTarget.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['p0-tail']);
        expect(resolveTarget.finalState.core.players['1'].deck.map(card => card.uid)).toEqual(['p1-tail']);
        expect(resolveTarget.finalState.core.players['0'].discard.some(card => card.uid === 'borrowed-overrun')).toBe(false);
        expect(resolveTarget.finalState.core.players['1'].discard.some(card => card.uid === 'borrowed-overrun')).toBe(false);
    });

    it('学徒打出 zombie_overrun（泛滥横行）时应该先选择目标基地', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('m1', 'wizard_neophyte', 'minion', '0')],
                    deck: [
                        makeCard('overrun', 'zombie_overrun', 'action', '0'), // ongoing 行动卡
                        makeCard('d2', 'test_minion', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase(), makeBase()],
        });

        const ms = makeMatchState(state);

        // Step 1: 打出学徒
        const r1 = runCommand(ms, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'm1', baseIndex: 0 },
        }, defaultTestRandom);

        expect(r1.success).toBe(true);

        // Step 2: 学徒 onPlay 触发，展示牌库顶（zombie_overrun）
        const interaction1 = r1.finalState.sys.interaction.current;
        expect(interaction1).toBeDefined();
        expect((interaction1?.data as any)?.sourceId).toBe('wizard_neophyte');

        // Step 3: 选择 play_extra（作为额外行动打出）
        const r2 = runCommand(r1.finalState, {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '0',
            payload: { optionId: 'play_extra' },
        }, defaultTestRandom);

        expect(r2.success).toBe(true);

        // Step 4: 应该弹出选择基地的交互
        const interaction2 = r2.finalState.sys.interaction.current;
        expect(interaction2).toBeDefined();
        expect((interaction2?.data as any)?.sourceId).toBe('wizard_neophyte_choose_base');
        expect((interaction2?.data as any)?.title).toContain('泛滥横行');

        // 验证选项包含所有基地
        const options = (interaction2?.data as any)?.options;
        expect(options).toHaveLength(2);

        // Step 5: 选择基地 0
        const r3 = runCommand(r2.finalState, {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '0',
            payload: { optionId: options[0].id },
        }, defaultTestRandom);

        expect(r3.success).toBe(true);

        // 验证 ongoing 行动卡已附着到基地 0
        const finalState = r3.finalState.core;
        expect(finalState.bases[0].ongoingActions).toHaveLength(1);
        expect(finalState.bases[0].ongoingActions[0].defId).toBe('zombie_overrun');
        expect(finalState.bases[0].ongoingActions[0].ownerId).toBe('0');

        // 验证卡牌不在手牌中
        expect(finalState.players['0'].hand.find(c => c.uid === 'overrun')).toBeUndefined();

        // 验证行动额度没有被消耗（额外行动）
        expect(finalState.players['0'].actionsPlayed).toBe(0);
    });

    it('学徒打出 standard 行动卡时不需要选择基地', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('m1', 'wizard_neophyte', 'minion', '0')],
                    deck: [
                        makeCard('summon', 'wizard_summon', 'action', '0'), // standard 行动卡
                        makeCard('d2', 'test_minion', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase()],
        });

        const ms = makeMatchState(state);

        // Step 1: 打出学徒
        const r1 = runCommand(ms, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'm1', baseIndex: 0 },
        }, defaultTestRandom);

        expect(r1.success).toBe(true);

        // Step 2: 选择 play_extra
        const r2 = runCommand(r1.finalState, {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '0',
            payload: { optionId: 'play_extra' },
        }, defaultTestRandom);

        expect(r2.success).toBe(true);

        // Step 3: wizard_summon 的 onPlay 能力会增加随从额度（不创建交互）
        const finalState = r2.finalState.core;
        
        // 验证行动卡已进入弃牌堆
        expect(finalState.players['0'].discard.find(c => c.uid === 'summon')).toBeDefined();
        
        // 验证随从额度增加了 1
        expect(finalState.players['0'].minionLimit).toBe(2); // 初始 1 + wizard_summon 额外 1
        
        // 验证行动额度没有被消耗（额外行动）
        expect(finalState.players['0'].actionsPlayed).toBe(0);
    });
});
