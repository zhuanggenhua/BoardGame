import { expect, it } from 'vitest';
import { createInitialSystemState, createSeededRandom, executePipeline } from '../../../engine';
import { FateDominationDomain } from '../domain';
import { engineConfig } from '../game';
import { FATE_EVENTS } from '../data';
import type { Command, MatchState } from '../../../engine/types';
import type { FateDominationCore } from '../domain';

function battleFixture(round = 1, seals = 2, withLeylines = false) {
    const ids = ['0', '1', '2'];
    const random = createSeededRandom('post-battle-choice');
    let state: MatchState<FateDominationCore> = { core: FateDominationDomain.setup(ids, random), sys: createInitialSystemState(ids, engineConfig.systems, 'post-battle-choice') };
    state.core.phase = 'battle'; state.core.round = round;
    for (const player of Object.values(state.core.players)) {
        player.locationId = player.id === '2' ? 'recon' : 'miyama';
        player.deploymentSlot = null; player.commandSpells = seals; player.mana = 0;
    }
    const objective = FATE_EVENTS.find(card => card.id === 'fuyuki_E12')!;
    const objectives = [objective, ...(withLeylines ? FATE_EVENTS.filter(card=>['fuyuki_E18','fuyuki_E19'].includes(card.id)) : [])];
    state.core.currentEvents = { miyama: objectives, shinto: [] };
    state.core.battlefield.miyama = { ...state.core.battlefield.miyama, playerIds: ['0', '1'], eventCards: objectives };
    state.core.battlefield.shinto = { ...state.core.battlefield.shinto, playerIds: [], eventCards: [] };
    state.core.battlefield.recon.playerIds = ['2'];
    const run = (command: Command) => executePipeline({ domain: FateDominationDomain, systems: engineConfig.systems }, state, command, random, ids);
    const apply = (command: Command) => { const result = run(command); expect(result.success, command.type).toBe(true); state = result.state; return result; };
    for (const playerId of ids) apply({ type: 'ADVANCE_PHASE', playerId, payload: {} });
    for (const locationId of ['miyama', 'shinto', 'recon']) apply({ type: 'RESOLVE_LOCATION', playerId: state.core.currentPlayerId, payload: { locationId } });
    return { get state() { return state; }, run, apply };
}

it('平局两位胜者各自恢复或不恢复，最后一人明确选择后才清场', () => {
    const game = battleFixture();
    expect(game.state.core.round).toBe(1);
    expect(game.state.core.battleResolution?.step).toBe('after-battle');
    let choice = game.state.sys.interaction.current!;
    expect(choice.playerId).toBe('0');
    expect((choice.data as {ai:{status:string}}).ai.status).toBe('unsupported');
    expect(game.state.core.players['0'].locationId).toBe('miyama');
    game.apply({ type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { interactionId: choice.id, optionId: 'restore' } });
    expect(game.state.core.players['0'].commandSpells).toBe(3);
    expect(game.state.core.round).toBe(1);
    choice = game.state.sys.interaction.current!; expect(choice.playerId).toBe('1');
    game.apply({ type: 'SYS_INTERACTION_RESPOND', playerId: '1', payload: { interactionId: choice.id, optionId: 'decline' } });
    expect(game.state.core.players['1'].commandSpells).toBe(2);
    expect(game.state.core.round).toBe(2); expect(game.state.sys.interaction.current).toBeUndefined();
    expect(game.state.sys.undo.snapshots).toEqual([]);expect(game.state.sys.undo.snapshotCursors??[]).toEqual([]);
    expect(game.state.core.players['0'].locationId).toBeNull();
    expect(game.state.sys.resolution?.activeFrameId).toBeFalsy();
});

it('战后选择拒绝越权、旧ID、客户端覆盖、撤销和绕过，不丢失待选状态', () => {
    const game = battleFixture(); const choice = game.state.sys.interaction.current!;
    expect(choice).toBeDefined();
    const commands: Command[] = [
        { type: 'SYS_INTERACTION_RESPOND', playerId: '1', payload: { interactionId: choice.id, optionId: 'restore' } },
        { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { interactionId: 'stale', optionId: 'restore' } },
        { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { interactionId: choice.id, optionId: 'restore', mergedValue: { amount: 99 } } },
        ...['SYS_INTERACTION_CANCEL', 'SYS_INTERACTION_TIMEOUT', 'SYS_FORCE_UNLOCK', 'SYS_REQUEST_UNDO', 'ADVANCE_PHASE'].map(type => ({ type, playerId: '0', payload: {} })),
    ];
    for (const command of commands) {
        const result = game.run(command); expect(result.success, command.type).toBe(false);
        expect(result.state.sys.interaction.current?.id).toBe(choice.id);
        expect(result.state.core.players['0'].commandSpells).toBe(2);
        expect(result.events).toEqual([]);
    }
});

it('第十一轮的可选奖励完成前不设置终局，选择完成后系统终局同步', () => {
    const game = battleFixture(11); expect(game.state.sys.gameover).toBeUndefined();
    for (const playerId of ['0', '1']) {
        const choice = game.state.sys.interaction.current!; expect(choice).toBeDefined();
        game.apply({ type: 'SYS_INTERACTION_RESPOND', playerId, payload: { interactionId: choice.id, optionId: 'decline' } });
    }
    expect(game.state.core.phase).toBe('complete'); expect(game.state.sys.gameover).toEqual(game.state.core.gameResult);
});
it('热座按交互本人而非最后战斗玩家显示，完成后回落到正常顺位', () => {
    const game = battleFixture();
    const resolve = engineConfig.resolveLocalRuntimeControlledPlayerId;
    expect(resolve).toBeDefined();
    expect(resolve!({ state: game.state, fallbackPlayerId: '2' })).toBe('0');
    for(const playerId of ['0','1'])game.apply({type:'SYS_INTERACTION_RESPOND',playerId,payload:{interactionId:game.state.sys.interaction.current!.id,optionId:'decline'}});
    expect(resolve!({state:game.state,fallbackPlayerId:game.state.core.currentPlayerId})).toBe(game.state.core.currentPlayerId);
});

it('胜者没有已消耗令咒时不造空选择窗口',()=>{
 const game=battleFixture(1,3);expect(game.state.core.round).toBe(2);expect(game.state.sys.interaction.current).toBeUndefined();expect(game.state.sys.resolution?.activeFrameId).toBeFalsy();
});
it('双地脉与两次令咒选择并存，魔力奖励只结算一次',()=>{
 const game=battleFixture(1,2,true);
 expect(game.state.core.players['0'].mana).toBe(4);expect(game.state.core.players['1'].mana).toBe(4);
 for(const playerId of ['0','1'])game.apply({type:'SYS_INTERACTION_RESPOND',playerId,payload:{interactionId:game.state.sys.interaction.current!.id,optionId:'restore'}});
 expect(game.state.core.players['0'].mana).toBe(4+game.state.core.situation.printedMana);
 expect(game.state.sys.eventStream.entries.filter(entry=>entry.event.type==='FATE_MANA_GAINED')).toHaveLength(4);
});
it('诊断快照不是规则真相，删除诊断不影响权威选择',()=>{
 const game=battleFixture();const choice=game.state.sys.interaction.current!;
 const data=choice.data as Record<string,unknown>;delete data.choiceRequest;
 game.apply({type:'SYS_INTERACTION_RESPOND',playerId:choice.playerId,payload:{interactionId:choice.id,optionId:'restore'}});
 expect(game.state.core.players['0'].commandSpells).toBe(3);
});
it('权威选择上下文损坏时拒绝，不从诊断摘要回退恢复',()=>{
 const game=battleFixture();const choice=game.state.sys.interaction.current!;
 delete (choice.data as Record<string,unknown>).fateContext;
 const result=game.run({type:'SYS_INTERACTION_RESPOND',playerId:choice.playerId,payload:{interactionId:choice.id,optionId:'restore'}});
 expect(result.success).toBe(false);expect(result.state.sys.interaction.current?.id).toBe(choice.id);expect(result.state.core.players['0'].commandSpells).toBe(2);
});
