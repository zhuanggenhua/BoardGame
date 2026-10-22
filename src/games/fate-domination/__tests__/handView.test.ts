import { expect, it } from 'vitest';
import { projectFateHand } from '../domain/handView';
const hand = ['a', 'b', 'c'].map(id => ({ id, definitionId: id }));
it('选择出牌、撤回与确认后，剩余手牌集合按真实数量更新且不重复出现在两区', () => {
 const base = { hand, selectedAttackIds: [] as string[], activeAttackIds: [] as string[] };
 expect(projectFateHand(base).available).toHaveLength(3);
 const selected = projectFateHand({ ...base, selectedAttackIds: ['b'] });
 expect(selected.available.map(c => c.id)).toEqual(['a', 'c']);
 expect(selected.staged.map(c => c.id)).toEqual(['b']);
 expect(projectFateHand(base).available).toHaveLength(3);
 const committed = projectFateHand({ ...base, activeAttackIds: ['a', 'c'] });
 expect(committed.available.map(c => c.id)).toEqual(['b']);
 expect(committed.active.map(c => c.id)).toEqual(['a', 'c']);
 expect(committed.staged).toEqual([]);
});
it('空手与全部已激活不保留虚假牌位', () => {
 expect(projectFateHand({ hand: [], selectedAttackIds: [], activeAttackIds: [] }).available).toEqual([]);
 expect(projectFateHand({ hand, selectedAttackIds: [], activeAttackIds: ['a','b','c'] }).available).toEqual([]);
});
it('待打出与已打出遵守正式选择顺序，不被原手牌位置覆盖', () => {
 const result=projectFateHand({hand,selectedAttackIds:['c','a'],activeAttackIds:[]});
 expect(result.staged.map(c=>c.id)).toEqual(['c','a']);
 expect(projectFateHand({hand,selectedAttackIds:[],activeAttackIds:['c','a']}).active.map(c=>c.id)).toEqual(['c','a']);
});
