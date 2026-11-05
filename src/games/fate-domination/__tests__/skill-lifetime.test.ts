import { expect, it } from 'vitest';
import { createReplayAdapter } from '../../../engine/adapter';
import { FateDominationDomain } from '../domain';
import { projectFateSkillCards } from '../domain/playerView';
import { emptyFateBattleResult } from '../domain/battleAwards';

it('已打出的每局一次螺旋剑在回合末移除，不重新成为暗置技能占位', () => {
    const adapter = createReplayAdapter(FateDominationDomain, 'one-game-skill');
    let state = adapter.setup(['0', '1', '2']);
    state = adapter.execute(state, { type: 'SELECT_SERVANT', playerId: '0', payload: { servantId: 'servant-archer' } }).state;
    const skillId = state.core.players['0'].skills.find(skill => skill.id.startsWith('sc_emiya_2:'))!.id;
    state.core.players['0'].activeSkills = [skillId];
    state.core.players['0'].revealedSkillIds = [skillId];
    const core = FateDominationDomain.reduce(state.core, { type: 'BATTLE_RESOLVED', timestamp: 1, payload: { result: emptyFateBattleResult('0'), nextRound: 2 } });
    expect(core.players['0'].skills.some(skill => skill.id === skillId)).toBe(false);
    expect(projectFateSkillCards(core.players['0'], '0')).toHaveLength(2);
    expect(projectFateSkillCards(core.players['0'], '1')).toHaveLength(2);
    expect(core.players['0'].activeSkills).toEqual([]);
    expect(core.players['0'].revealedSkillIds).not.toContain(skillId);
});

it('没有打出的每局一次技能不能因一轮结束而被移除', () => {
    const adapter = createReplayAdapter(FateDominationDomain, 'unused-one-game-skill');
    let state = adapter.setup(['0', '1', '2']);
    state = adapter.execute(state, { type: 'SELECT_SERVANT', playerId: '0', payload: { servantId: 'servant-archer' } }).state;
    const core = FateDominationDomain.reduce(state.core, { type: 'BATTLE_RESOLVED', timestamp: 1, payload: { result: emptyFateBattleResult('0'), nextRound: 2 } });
    expect(core.players['0'].skills.some(skill => skill.id.startsWith('sc_emiya_2:'))).toBe(true);
    expect(projectFateSkillCards(core.players['0'], '0')).toHaveLength(3);
});
