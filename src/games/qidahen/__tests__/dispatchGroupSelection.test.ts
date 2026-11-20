import { describe, expect, it } from 'vitest';
import { buildDispatchGroups, setDispatchGroupCount } from '../ui/dispatchGroupSelection';
import type { QidahenMapToken, QidahenPiece } from '../domain/types';

describe('出兵数量编制', () => {
    it('只能合并规则状态相同的候选，保留不同等级、兵种和训练状态', () => {
        const unit = (id: string, changes: Partial<QidahenPiece> = {}): QidahenPiece => ({
            id, sourceStackId: id, label: id, faction: 'ming', troopKind: 'infantry', troopClass: 'regular',
            level: 2, regionId: 'r', location: 'field', rotationDeg: 0, ...changes,
        });
        const pieces = [unit('a'), unit('b'), unit('c', { level: 3 }), unit('d', { troopKind: 'artillery' }), unit('e'), unit('f')];
        const tokens: QidahenMapToken[] = pieces.map(piece => ({ id: `token-${piece.id}`, x: 0, y: 0, type: 'army',
            faction: piece.faction, regionId: piece.regionId, location: 'field', troopKind: piece.troopKind, pieceId: piece.id }));
        expect(buildDispatchGroups(tokens, pieces, new Set(['a', 'b', 'c', 'd', 'e']), new Set(['e'])).map(group => group.pieceIds))
            .toEqual([['a', 'b'], ['c'], ['d'], ['e']]);
    });

    it('修改数量保留当前已选实体和其它组，并按余量限制输入', () => {
        const legal = new Set(['a', 'b', 'c', 'other']);
        const group = ['a', 'b', 'c', 'invalid'];
        expect(setDispatchGroupCount(['other', 'b'], group, legal, 3, 999)).toEqual(['other', 'b', 'a']);
        expect(setDispatchGroupCount(['other', 'b', 'a'], group, legal, 3, 1)).toEqual(['other', 'b']);
        expect(setDispatchGroupCount(['other', 'b'], group, legal, 3, 0)).toEqual(['other']);
    });
});
