import type { QidahenFactionId, QidahenSpecialTroopStack, QidahenTroopKind } from './types';
import { getFactionDisplayName } from './factionLabelSemantics';

const QIDAHEN_TROOP_KIND_LABELS: Record<QidahenTroopKind, string> = {
    infantry: '步兵',
    cavalry: '骑兵',
    artillery: '炮兵',
};

export const getQidahenTroopKindLabel = (troopKind: QidahenTroopKind): string => (
    QIDAHEN_TROOP_KIND_LABELS[troopKind]
);

export const clampTroopLevel = (level: number): number => Math.max(1, Math.min(4, Math.floor(level)));

export const getRegularTroopKindForFaction = (factionId: QidahenFactionId): QidahenTroopKind => (
    factionId === 'mongol' ? 'cavalry' : 'infantry'
);

export const buildRegularTroopStack = (
    factionId: QidahenFactionId,
    sourceId: string,
    count: number,
    level = 2,
): QidahenSpecialTroopStack => {
    const troopKind = getRegularTroopKindForFaction(factionId);
    return {
        id: `${factionId}-${sourceId}-regular-${troopKind}-lv${level}`,
        label: `${getFactionDisplayName(factionId)}${getQidahenTroopKindLabel(troopKind)}`,
        faction: factionId,
        troopKind,
        count,
        level,
    };
};

export const buildFactionTroopStack = (
    factionId: QidahenFactionId,
    sourceId: string,
    troopKind: QidahenTroopKind,
    count: number,
    level = 2,
    label = `${getFactionDisplayName(factionId)}${getQidahenTroopKindLabel(troopKind)}`,
): QidahenSpecialTroopStack => ({
    id: `${factionId}-${sourceId}-${troopKind}-lv${clampTroopLevel(level)}`,
    label,
    faction: factionId,
    troopKind,
    count,
    level: clampTroopLevel(level),
});

export const buildArtilleryTroopStack = (
    factionId: QidahenFactionId,
    sourceId: string,
    count: number,
    level = 1,
): QidahenSpecialTroopStack => ({
    id: `${factionId}-${sourceId}-regular-artillery-lv${clampTroopLevel(level)}`,
    label: `${getFactionDisplayName(factionId)}炮兵`,
    faction: factionId,
    troopKind: 'artillery',
    count,
    level: clampTroopLevel(level),
});

export const buildMercenaryTroopStack = (
    factionId: QidahenFactionId,
    sourceId: string,
    count: number,
    level = 2,
    troopKind: QidahenTroopKind = 'infantry',
): QidahenSpecialTroopStack => buildFactionTroopStack(
    factionId,
    `${sourceId}-mercenary`,
    troopKind,
    count,
    level,
    troopKind === 'cavalry' ? '雇佣骑兵' : troopKind === 'artillery' ? '雇佣炮兵' : '雇佣军',
);
