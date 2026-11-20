import type { QidahenMapToken, QidahenPiece } from '../domain/types';

export function buildDispatchGroups(
    tokens: readonly QidahenMapToken[], pieces: readonly QidahenPiece[],
    eligible: ReadonlySet<string>, trained: ReadonlySet<string>,
) {
    const byId = new Map(pieces.map(piece => [piece.id, piece]));
    const groups = new Map<string, { token: QidahenMapToken; pieceIds: string[]; piece: QidahenPiece; trained: boolean }>();
    for (const token of tokens) {
        if (token.type !== 'army' || !token.pieceId || !eligible.has(token.pieceId)) continue;
        const piece = byId.get(token.pieceId);
        if (!piece) continue;
        const hasTrained = trained.has(piece.id);
        const key = JSON.stringify([piece.regionId, piece.location, piece.faction, piece.originalFaction,
            piece.troopClass, piece.troopKind, piece.level, hasTrained, token.imageSrc, token.rotationDeg ?? 0]);
        const group = groups.get(key);
        if (group) group.pieceIds.push(piece.id);
        else groups.set(key, { token, piece, pieceIds: [piece.id], trained: hasTrained });
    }
    return [...groups.values()];
}

/** Setting a quantity keeps the original IDs already in that group. */
export function setDispatchGroupCount(
    selected: readonly string[], group: readonly string[], eligible: ReadonlySet<string>, max: number, requested: number,
): string[] {
    const validGroup = [...new Set(group)].filter(id => eligible.has(id));
    const members = new Set(validGroup);
    const others = selected.filter(id => !members.has(id));
    const current = selected.filter(id => members.has(id));
    const count = Math.max(0, Math.min(Math.floor(requested), validGroup.length, max - others.length));
    const available = validGroup.filter(id => !current.includes(id));
    return [...others, ...current.slice(0, count), ...available.slice(0, Math.max(0, count - current.length))];
}
