import { describe, expect, it } from 'vitest';
import { buildDispatchGroups, setDispatchGroupCount } from '../ui/dispatchGroupSelection';
import type { QidahenMapToken, QidahenPiece } from '../domain/types';

describe('出兵同类部队数量', () => {
    const eligible = new Set(['a', 'b', 'c', 'other']);
    it('增加和减少时保留其它兵种以及当前已选部队身份', () => {
        expect(setDispatchGroupCount(['other', 'b'], ['a', 'b', 'c'], eligible, 4, 3)).toEqual(['other', 'b', 'a', 'c']);
        expect(setDispatchGroupCount(['other', 'b', 'a', 'c'], ['a', 'b', 'c'], eligible, 4, 1)).toEqual(['other', 'b']);
        expect(setDispatchGroupCount(['other', 'b'], ['a', 'b', 'c'], eligible, 4, 0)).toEqual(['other']);
    });
    it('不选择非法候选且尊重总数上限', () => {
        expect(setDispatchGroupCount(['other'], ['a', 'b', 'invalid', 'a'], eligible, 2, 9)).toEqual(['other', 'a']);
    });
    it('只合并同地区同阵营同类型同等级且训练资格一致的正式候选', () => {
        const unit = (id: string, changes: Partial<QidahenPiece> = {}): QidahenPiece => ({
            id, sourceStackId: id, label: id, faction: 'ming', troopKind: 'infantry', troopClass: 'regular',
            level: 2, regionId: 'r', location: 'field', rotationDeg: 0, ...changes,
        });
        const pieces = [unit('a'), unit('b'), unit('c', { level: 3 }), unit('d', { troopKind: 'artillery' }), unit('e'), unit('f')];
        const tokens: QidahenMapToken[] = pieces.map(piece => ({ id: `token-${piece.id}`, x: 0, y: 0, type: 'army',
            faction: piece.faction, regionId: piece.regionId, location: 'field', troopKind: piece.troopKind, pieceId: piece.id }));
        expect(buildDispatchGroups(tokens, pieces, new Set(['a', 'b', 'c', 'd', 'e']), new Set(['e'])))
            .toEqual([{ tokenId: 'token-a', pieceIds: ['a', 'b'] }]);
    });
});
