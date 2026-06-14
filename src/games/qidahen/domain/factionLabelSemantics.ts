import type { QidahenCore, QidahenFactionId } from './types';

const factionDisplayNameById: Record<QidahenFactionId, string> = {
    ming: '大明',
    mongol: '蒙古',
    jin: '后金',
};

export const getFactionDisplayName = (factionId: QidahenFactionId): string => (
    factionDisplayNameById[factionId]
);

export const toFactionLabel = (controller: QidahenFactionId | 'neutral') => (
    controller === 'neutral' ? '中立' : getFactionDisplayName(controller)
);

export const getRegionControlLabel = (
    region: Pick<QidahenCore['regions'][number], 'controller' | 'diplomacyMarkerFaction' | 'diplomacyMarkerSide'>,
): string => {
    if (region.diplomacyMarkerFaction && region.diplomacyMarkerSide === 'friendly') {
        return `${toFactionLabel(region.diplomacyMarkerFaction)}友好`;
    }
    if (region.diplomacyMarkerFaction && region.diplomacyMarkerSide === 'vassal') {
        return `${toFactionLabel(region.diplomacyMarkerFaction)}附庸`;
    }
    return toFactionLabel(region.controller);
};
