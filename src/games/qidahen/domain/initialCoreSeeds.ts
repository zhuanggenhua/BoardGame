import type { PlayerId } from '../../../engine/types';
import { QIDAHEN_MAP_HEIGHT, QIDAHEN_MAP_WIDTH } from '../ui/mapRegions';
import { QIDAHEN_RUNTIME_REGION_DEFINITIONS } from '../ui/mapGraph';
import {
    getQidahenFortificationConfigs,
    getQidahenInitialController,
    isQidahenKoreaRuntimeRegionId,
    resolveQidahenRuleRegionConfig,
} from './regionConfig';
import { getScenarioPlayableFactionIds } from './factionTurnOrder';
import { getRegionControlLabel } from './factionLabelSemantics';
import { createInitialCharacterStates } from './characterCatalogState';
import { createInitialArmamentStates } from './armamentCatalogState';
import { getQidahenStatefulRegionDisplayName } from './runtimeRegionRules';
import type { QidahenCore, QidahenFactionId, QidahenFactionState, QidahenFortificationState, QidahenScenarioId } from './types';

const initialFactionSeedsById: Record<QidahenFactionId, Pick<QidahenFactionState, 'name' | 'colorClass' | 'vp' | 'troops' | 'grain' | 'landTax'>> = {
    ming: {
        name: '大明',
        colorClass: 'bg-[#8f2f24]',
        vp: 0,
        troops: 18,
        grain: 12,
        landTax: 70,
    },
    mongol: {
        name: '蒙古',
        colorClass: 'bg-[#6f4c24]',
        vp: 1,
        troops: 16,
        grain: 10,
        landTax: 65,
    },
    jin: {
        name: '后金',
        colorClass: 'bg-[#244c6f]',
        vp: 0,
        troops: 17,
        grain: 11,
        landTax: 75,
    },
};

export const getScenarioPlayerIdsByFaction = (
    playerIds: PlayerId[],
    scenarioId: QidahenScenarioId,
): Record<QidahenFactionId, PlayerId> => {
    const playableFactionIds = new Set(getScenarioPlayableFactionIds(scenarioId));
    let playableIndex = 0;

    return {
        ming: playableFactionIds.has('ming')
            ? playerIds[playableIndex++] ?? '0'
            : 'qidahen-neutral-ming',
        mongol: playableFactionIds.has('mongol')
            ? playerIds[playableIndex++] ?? '1'
            : 'qidahen-neutral-mongol',
        jin: playableFactionIds.has('jin')
            ? playerIds[playableIndex++] ?? '2'
            : 'qidahen-neutral-jin',
    };
};

export const createInitialFactionState = (
    id: QidahenFactionId,
    playerId: PlayerId,
): QidahenFactionState => {
    const seed = initialFactionSeedsById[id];
    return {
        id,
        playerId,
        name: seed.name,
        colorClass: seed.colorClass,
        vp: seed.vp,
        troops: seed.troops,
        grain: seed.grain,
        landTax: seed.landTax,
        handLimit: id === 'ming' ? 15 : 10,
        handCount: id === 'ming' ? 3 : id === 'mongol' ? 6 : 10,
        drawPileCount: 20,
        discardPileCount: id === 'ming' ? 7 : 0,
        actionDiamonds: id === 'jin' ? 2 : 3,
        defeatMarkers: 0,
        armaments: createInitialArmamentStates(id),
        characters: createInitialCharacterStates(id),
    };
};

export const createInitialFortifications = (): QidahenFortificationState[] => (
    getQidahenFortificationConfigs()
        .sort((left, right) => left.autoPayPriority - right.autoPayPriority)
        .map((fortification) => ({
            id: fortification.id,
            label: fortification.label,
            maintenanceCost: fortification.maintenanceCost,
            ruined: false,
            dependencyRegionId: fortification.dependencyRegionId,
            dependencyLabel: fortification.dependencyLabel,
            ruleNote: fortification.ruleNote,
        }))
);

export const createInitialRuntimeRegionSummaries = (): QidahenCore['regions'] => (
    QIDAHEN_RUNTIME_REGION_DEFINITIONS.map((region) => {
        const regionConfig = resolveQidahenRuleRegionConfig(region.id);
        const controller = getQidahenInitialController(region.id);
        const point = region.center ?? region.seed ?? { x: QIDAHEN_MAP_WIDTH / 2, y: QIDAHEN_MAP_HEIGHT / 2 };
        const initialNote = regionConfig.initialNote;
        return {
            id: region.id,
            name: getQidahenStatefulRegionDisplayName(region.id),
            isLogicalRegion: false,
            primaryRuntimeRegionId: region.id,
            runtimeRegionIds: [region.id],
            controller,
            diplomacyMarkerFaction: null,
            diplomacyMarkerSide: null,
            x: point.x / QIDAHEN_MAP_WIDTH,
            y: point.y / QIDAHEN_MAP_HEIGHT,
            troops: regionConfig.initialTroops,
            population: isQidahenKoreaRuntimeRegionId(region.id) ? 0 : regionConfig.initialPopulation,
            controlLabel: getRegionControlLabel({
                controller,
                diplomacyMarkerFaction: null,
                diplomacyMarkerSide: null,
            }),
            note: initialNote
                ?? (isQidahenKoreaRuntimeRegionId(region.id)
                    ? `${regionConfig.name} · 朝鲜区域，默认用于朝贡与耗损结算样本。`
                    : `${regionConfig.name} · 邻接 ${region.adjacentRegionIds.length} 区 · 初始移动代价已按边界类型生成，可继续微调。`),
            siegeState: null,
            cityState: null,
            eventMarkers: [],
            specialTroops: regionConfig.initialSpecialTroops.map((stack) => ({
                ...stack,
                pieceIds: stack.pieceIds ? [...stack.pieceIds] : undefined,
            })),
            adjacentRegionIds: [...region.adjacentRegionIds],
            travelCostByRegionId: { ...region.travelCostByRegionId },
            movementCostByRegionId: { ...region.movementCostByRegionId },
            boundaryTypeByRegionId: { ...region.boundaryTypeByRegionId },
        };
    })
);
