import { QIDAHEN_MAP_HEIGHT, QIDAHEN_MAP_WIDTH } from '../ui/mapRegions';
import { getRegularTroopKindForFaction } from './troopStacks';
import { inferTroopKindForStack, syncPiecesFromRegions } from './troopCompat';
import type {
    QidahenCore,
    QidahenFactionId,
    QidahenMapToken,
    QidahenSpecialTroopStack,
} from './types';

const controlMarkerByFaction: Record<QidahenFactionId, string> = {
    ming: 'qidahen/markers/ming-control-diplomacy-marker-a',
    mongol: 'qidahen/markers/mongol-control-diplomacy-marker-a',
    jin: 'qidahen/markers/jin-control-diplomacy-marker-a',
};

const diplomacyMarkerImageByFaction: Record<QidahenFactionId, Record<'friendly' | 'vassal', string>> = {
    ming: {
        friendly: 'qidahen/markers/ming-control-diplomacy-marker-b',
        vassal: 'qidahen/markers/ming-control-diplomacy-marker-a',
    },
    mongol: {
        friendly: 'qidahen/markers/mongol-control-diplomacy-marker-b',
        vassal: 'qidahen/markers/mongol-control-diplomacy-marker-a',
    },
    jin: {
        friendly: 'qidahen/markers/jin-control-diplomacy-marker-b',
        vassal: 'qidahen/markers/jin-control-diplomacy-marker-a',
    },
};

const legacyMapTokenBaseIdByRegion: Partial<Record<string, string>> = {
    'city-region-11': 'changbai',
    'city-region-13': 'jianzhou',
    'city-region-14': 'chahar',
    jinzhou: 'jinzhou',
    'song-jin': 'songjin',
};

const mapTokenOffsetByRole = {
    army: { x: -16, y: 10 },
    siegeArmy: { x: -34, y: 36 },
    control: { x: 18, y: -16 },
    diplomacy: { x: -18, y: -16 },
    marker: { x: -18, y: -16 },
} as const;

const clampMapTokenCoordinate = (value: number): number => Math.max(0.02, Math.min(0.98, value));

const siegeArmyAnchorPointByRegionId: Partial<Record<string, { x: number; y: number }>> = {
    'city-region-22': { x: 940 / QIDAHEN_MAP_WIDTH, y: 514 / QIDAHEN_MAP_HEIGHT },
};

const getMapTokenPoint = (
    region: Pick<QidahenCore['regions'][number], 'x' | 'y'>,
    role: keyof typeof mapTokenOffsetByRole,
) => ({
    x: clampMapTokenCoordinate(region.x + mapTokenOffsetByRole[role].x / QIDAHEN_MAP_WIDTH),
    y: clampMapTokenCoordinate(region.y + mapTokenOffsetByRole[role].y / QIDAHEN_MAP_HEIGHT),
});

const getMapArmyImageSrc = (
    controller: QidahenFactionId | 'neutral',
    representativeStack: QidahenSpecialTroopStack | null,
): string | undefined => {
    if (representativeStack && (representativeStack.id.includes('chuanbing') || representativeStack.label.includes('川兵'))) {
        return 'qidahen/units/ming-chuanbing-unit';
    }

    const troopKind = representativeStack
        ? inferTroopKindForStack(representativeStack)
        : controller === 'neutral'
            ? 'infantry'
            : getRegularTroopKindForFaction(controller);
    const unitFaction = representativeStack?.faction ?? (controller === 'neutral' ? 'neutral' : controller);
    const isMercenary = representativeStack
        ? representativeStack.id.includes('mercenary') || representativeStack.label.includes('雇佣')
        : false;

    if (unitFaction === 'neutral') {
        return troopKind === 'cavalry'
            ? 'qidahen/units/neutral-cavalry-unit'
            : 'qidahen/units/neutral-infantry-unit';
    }

    const unitFamily = isMercenary ? 'mercenary' : 'regular';
    if (troopKind === 'artillery') {
        return `qidahen/units/${unitFaction}-${unitFamily}-artillery-unit`;
    }
    if (troopKind === 'cavalry') {
        return `qidahen/units/${unitFaction}-${unitFamily}-cavalry-unit`;
    }
    return `qidahen/units/${unitFaction}-${unitFamily}-infantry-unit`;
};

const buildMapArmyTokensForRegion = (
    region: QidahenCore['regions'][number],
    baseId: string,
    pieces: QidahenCore['pieces'],
): QidahenCore['mapTokens'] => {
    const fieldPieces = pieces
        .filter((piece) => piece.regionId === region.id && piece.location === 'field')
        .sort((left, right) => (
            right.level - left.level
            || (left.troopKind === 'artillery' ? -1 : left.troopKind === 'cavalry' ? 0 : 1)
            - (right.troopKind === 'artillery' ? -1 : right.troopKind === 'cavalry' ? 0 : 1)
            || left.id.localeCompare(right.id, 'en')
        ));
    const representedTroops = Math.max(
        region.troops,
        fieldPieces.length,
    );
    if (representedTroops <= 0) {
        return [];
    }

    const point = getMapTokenPoint(region, 'army');
    const displayUnits: Array<Pick<QidahenMapToken, 'faction' | 'imageSrc' | 'rotationDeg'> & { tokenId: string }> = [];

    for (const piece of fieldPieces) {
        displayUnits.push({
            tokenId: `${baseId}-army-${piece.id}`,
            faction: piece.faction,
            imageSrc: getMapArmyImageSrc(region.controller, {
                id: piece.sourceStackId,
                label: piece.label,
                faction: piece.faction,
                troopKind: piece.troopKind,
                count: 1,
                level: piece.level,
            }),
            rotationDeg: piece.rotationDeg,
        });
    }

    const fallbackFaction = region.controller === 'neutral' ? 'neutral' : region.controller;
    const fallbackImageSrc = getMapArmyImageSrc(region.controller, null);
    while (displayUnits.length < representedTroops) {
        displayUnits.push({
            tokenId: `${baseId}-army-fallback-${displayUnits.length + 1}`,
            faction: fallbackFaction,
            imageSrc: fallbackImageSrc,
            rotationDeg: 0,
        });
    }

    const maxColumns = Math.min(3, displayUnits.length);
    const rowCount = Math.ceil(displayUnits.length / maxColumns);
    const horizontalSpacing = 20;
    const verticalSpacing = 18;

    return displayUnits.map((unit, index) => {
        const currentRow = Math.floor(index / maxColumns);
        const currentRowStart = currentRow * maxColumns;
        const currentRowLength = Math.min(maxColumns, displayUnits.length - currentRowStart);
        const currentColumn = index - currentRowStart;
        const xOffset = (currentColumn - (currentRowLength - 1) / 2) * horizontalSpacing;
        const yOffset = (currentRow - (rowCount - 1) / 2) * verticalSpacing;
        return {
            id: unit.tokenId,
            x: clampMapTokenCoordinate(point.x + xOffset / QIDAHEN_MAP_WIDTH),
            y: clampMapTokenCoordinate(point.y + yOffset / QIDAHEN_MAP_HEIGHT),
            type: 'army' as const,
            faction: unit.faction,
            regionId: region.id,
            troopIndex: index + 1,
            imageSrc: unit.imageSrc,
            size: 26,
            rotationDeg: unit.rotationDeg,
        };
    });
};

const buildMapSiegeAttackerTokensForRegion = (
    region: QidahenCore['regions'][number],
    baseId: string,
    pieces: QidahenCore['pieces'],
): QidahenCore['mapTokens'] => {
    if (!region.siegeState || region.siegeState.attackerTroops <= 0) {
        return [];
    }

    const siegePieces = pieces
        .filter((piece) => piece.regionId === region.id && piece.location === 'siege-attacker')
        .sort((left, right) => (
            right.level - left.level
            || (left.troopKind === 'artillery' ? -1 : left.troopKind === 'cavalry' ? 0 : 1)
            - (right.troopKind === 'artillery' ? -1 : right.troopKind === 'cavalry' ? 0 : 1)
            || left.id.localeCompare(right.id, 'en')
        ));
    const representedTroops = Math.max(region.siegeState.attackerTroops, siegePieces.length);
    const point = siegeArmyAnchorPointByRegionId[region.id] ?? getMapTokenPoint(region, 'siegeArmy');
    const displayUnits: Array<Pick<QidahenMapToken, 'faction' | 'imageSrc' | 'rotationDeg'> & { tokenId: string }> = [];

    for (const piece of siegePieces) {
        displayUnits.push({
            tokenId: `${baseId}-siege-army-${piece.id}`,
            faction: piece.faction,
            imageSrc: getMapArmyImageSrc(region.siegeState.attackerFactionId, {
                id: piece.sourceStackId,
                label: piece.label,
                faction: piece.faction,
                troopKind: piece.troopKind,
                count: 1,
                level: piece.level,
            }),
            rotationDeg: piece.rotationDeg,
        });
    }

    const fallbackImageSrc = getMapArmyImageSrc(region.siegeState.attackerFactionId, null);
    while (displayUnits.length < representedTroops) {
        displayUnits.push({
            tokenId: `${baseId}-siege-army-fallback-${displayUnits.length + 1}`,
            faction: region.siegeState.attackerFactionId,
            imageSrc: fallbackImageSrc,
            rotationDeg: 0,
        });
    }

    const maxColumns = Math.min(3, displayUnits.length);
    const rowCount = Math.ceil(displayUnits.length / maxColumns);
    const horizontalSpacing = 20;
    const verticalSpacing = 18;

    return displayUnits.map((unit, index) => {
        const currentRow = Math.floor(index / maxColumns);
        const currentRowStart = currentRow * maxColumns;
        const currentRowLength = Math.min(maxColumns, displayUnits.length - currentRowStart);
        const currentColumn = index - currentRowStart;
        const xOffset = (currentColumn - (currentRowLength - 1) / 2) * horizontalSpacing;
        const yOffset = (currentRow - (rowCount - 1) / 2) * verticalSpacing;
        return {
            id: unit.tokenId,
            x: clampMapTokenCoordinate(point.x + xOffset / QIDAHEN_MAP_WIDTH),
            y: clampMapTokenCoordinate(point.y + yOffset / QIDAHEN_MAP_HEIGHT),
            type: 'army' as const,
            faction: unit.faction,
            regionId: region.id,
            imageSrc: unit.imageSrc,
            size: 26,
            rotationDeg: unit.rotationDeg,
        };
    });
};

export const syncQidahenMapTokensFromRegions = (
    regions: QidahenCore['regions'],
    pieces: QidahenCore['pieces'] = syncPiecesFromRegions(regions),
): QidahenCore['mapTokens'] => (
    regions
        .filter((region) => !region.isLogicalRegion)
        .flatMap((region) => {
            const baseId = legacyMapTokenBaseIdByRegion[region.id] ?? region.id;
            const nextTokens: QidahenCore['mapTokens'] = [];

            nextTokens.push(...buildMapArmyTokensForRegion(region, baseId, pieces));
            nextTokens.push(...buildMapSiegeAttackerTokensForRegion(region, baseId, pieces));

            if (region.controller !== 'neutral') {
                const point = getMapTokenPoint(region, 'control');
                nextTokens.push({
                    id: `${baseId}-control`,
                    x: point.x,
                    y: point.y,
                    type: 'control',
                    faction: region.controller,
                    imageSrc: controlMarkerByFaction[region.controller],
                    size: 29,
                });
            }

            if (region.diplomacyMarkerFaction != null && region.diplomacyMarkerSide != null) {
                const point = getMapTokenPoint(region, 'diplomacy');
                nextTokens.push({
                    id: `diplomacy-marker-${region.id}`,
                    x: point.x,
                    y: point.y,
                    type: 'control',
                    faction: region.diplomacyMarkerFaction,
                    imageSrc: diplomacyMarkerImageByFaction[region.diplomacyMarkerFaction][region.diplomacyMarkerSide],
                    size: 27,
                });
            }

            for (const [index, marker] of region.eventMarkers.entries()) {
                const point = getMapTokenPoint(region, 'marker');
                nextTokens.push({
                    id: marker.id,
                    x: clampMapTokenCoordinate(point.x + (index * 14) / QIDAHEN_MAP_WIDTH),
                    y: clampMapTokenCoordinate(point.y + (index * 14) / QIDAHEN_MAP_HEIGHT),
                    type: 'marker',
                    faction: 'neutral',
                    imageSrc: marker.imageSrc,
                    value: marker.imageSrc ? undefined : marker.label,
                    size: 27,
                });
            }

            return nextTokens;
        })
);
