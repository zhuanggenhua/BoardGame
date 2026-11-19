import type { QidahenMapToken, QidahenPiece } from '../domain/types';

export const QIDAHEN_DISPATCH_ROSTER_ID = 'qidahen-dispatch-roster';

export interface DispatchGroup {
    tokenId: string;
    pieceIds: string[];
}

/** 只合并正式可选且规则属性一致的部队，保留稳定的实体 ID。 */
export function buildDispatchGroups(
    tokens: readonly QidahenMapToken[], pieces: readonly QidahenPiece[], eligible: ReadonlySet<string>,
    trained: ReadonlySet<string>,
): DispatchGroup[] {
    const byId = new Map(pieces.map(piece => [piece.id, piece]));
    const groups = new Map<string, DispatchGroup>();
    for (const token of tokens) {
        if (token.type !== 'army' || token.location !== 'field' || !token.pieceId || !eligible.has(token.pieceId)) continue;
        const piece = byId.get(token.pieceId);
        if (!piece) continue;
        const key = JSON.stringify([piece.regionId, piece.faction, piece.originalFaction, piece.troopClass,
            piece.troopKind, piece.level, trained.has(piece.id), token.imageSrc, token.rotationDeg ?? 0]);
        const group = groups.get(key);
        if (group) group.pieceIds.push(piece.id);
        else groups.set(key, { tokenId: token.id, pieceIds: [piece.id] });
    }
    return [...groups.values()].filter(group => group.pieceIds.length > 1);
}

/** 按正式候选调整同组数量；保留其它组及已选单位的原始身份。 */
export function setDispatchGroupCount(
    selected: readonly string[], group: readonly string[], eligible: ReadonlySet<string>, max: number, requested: number,
): string[] {
    const validGroup = [...new Set(group)].filter(id => eligible.has(id));
    const members = new Set(validGroup);
    const others = selected.filter(id => !members.has(id));
    const current = selected.filter(id => members.has(id));
    const available = validGroup.filter(id => !current.includes(id));
    const count = Math.max(0, Math.min(Math.floor(requested), validGroup.length, Math.max(0, max - others.length)));
    return [...others, ...current.slice(0, count), ...available.slice(0, Math.max(0, count - current.length))];
}
