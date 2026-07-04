import { getEffectiveHomelandController } from './regionRuleSemantics';
import {
    isQidahenHanRuntimeRegionId,
    isQidahenJurchenRuntimeRegionId,
    isQidahenMongolRuntimeRegionId,
} from './regionEthnicity';
import { resolveQidahenPrimaryRuntimeRegionId } from './regionConfig';
import { addSpecialTroopStackToRegion } from './troopCompat';
import { buildRegularTroopStack } from './troopStacks';
import type {
    QidahenArmamentId,
    QidahenCore,
    QidahenFactionId,
    QidahenSeasonSummary,
} from './types';

interface QidahenSelectedActionExecutionResolutionDependencies {
    buildSeasonSummary: (
        title: string,
        timestamp: number,
        lines: string[],
    ) => QidahenSeasonSummary;
    resolveGrantPardonExecution: (
        state: QidahenCore,
        factions: QidahenCore['factions'],
        timestamp: number,
    ) => {
        factions: QidahenCore['factions'];
        lastSeasonSummary: QidahenSeasonSummary | null;
        regions: QidahenCore['regions'];
        selectedRegionId: string;
    };
    resolveSelectedArmamentUpgradeExecution: (
        state: QidahenCore,
        factions: QidahenCore['factions'],
        currentFactionId: QidahenFactionId,
        selectedArmamentId: QidahenArmamentId | null,
        selectedHandActionCardLabel: string | null,
        timestamp: number,
    ) => {
        factions: QidahenCore['factions'];
        lastSeasonSummary: QidahenSeasonSummary | null;
    };
}

interface QidahenBannerEventConfig {
    cardDefId: string;
    title: string;
    armamentId: QidahenArmamentId;
    regionKindLabel: string;
    troopSourceId: string;
    isTargetRegion: (regionId: string) => boolean;
}

interface QidahenDroughtEventConfig {
    cardDefIds: string[];
    title: string;
    regionKindLabel: string;
    isTargetRegion: (regionId: string) => boolean;
}

interface QidahenSelectedActionExecutionResolutionResult {
    factions: QidahenCore['factions'];
    lastSeasonSummary: QidahenSeasonSummary | null;
    regions: QidahenCore['regions'];
    selectedRegionId: string;
}

export const resolveQidahenSelectedActionExecutionResolution = (
    state: QidahenCore,
    actionId: string,
    currentFactionId: QidahenFactionId,
    selectedEventActionCardDefId: string | null,
    selectedArmamentId: QidahenArmamentId | null,
    selectedHandActionCardLabel: string | null,
    factions: QidahenCore['factions'],
    timestamp: number,
    dependencies: QidahenSelectedActionExecutionResolutionDependencies,
): QidahenSelectedActionExecutionResolutionResult => {
    let nextFactions = factions;
    let nextLastSeasonSummary: QidahenSeasonSummary | null = null;
    let nextRegions = state.regions;
    let nextSelectedRegionId = state.selectedRegionId;

    const resolveBannerEvent = (config: QidahenBannerEventConfig): boolean => {
        if (
            actionId !== 'play-event-card'
            || currentFactionId !== 'jin'
            || selectedEventActionCardDefId !== config.cardDefId
        ) {
            return false;
        }

        const bannerArmament = nextFactions.jin.armaments.find((armament) => armament.id === config.armamentId);
        const bannerAlreadyActive = (bannerArmament?.level ?? 0) > 0;
        const controlledRegions = nextRegions.filter((region) => (
            !region.isLogicalRegion
            && config.isTargetRegion(region.id)
            && region.controller === 'jin'
        ));
        const addedTroops = bannerAlreadyActive ? 0 : controlledRegions.length;

        nextRegions = nextRegions.map((region) => {
            if (!controlledRegions.some((targetRegion) => targetRegion.id === region.id)) {
                return region;
            }
            const nextRegion = {
                ...region,
                troops: region.troops + (bannerAlreadyActive ? 0 : 1),
                note: [
                    region.note,
                    bannerAlreadyActive
                        ? `${config.title}：${config.regionKindLabel}区域已视为后金本土。`
                        : `${config.title}：建立 1 个 2 级后金次级步兵，并将${config.regionKindLabel}区域视为后金本土。`,
                ].filter(Boolean).join(' '),
            };
            return bannerAlreadyActive
                ? nextRegion
                : addSpecialTroopStackToRegion(
                    nextRegion,
                    buildRegularTroopStack('jin', `${config.troopSourceId}-${region.id}`, 1, 2),
                );
        });
        nextFactions = {
            ...nextFactions,
            jin: {
                ...nextFactions.jin,
                troops: nextFactions.jin.troops + addedTroops,
                armaments: nextFactions.jin.armaments.map((armament) => (
                    armament.id === config.armamentId
                        ? { ...armament, level: Math.max(1, armament.level) }
                        : armament
                )),
            },
        };
        nextLastSeasonSummary = dependencies.buildSeasonSummary(config.title, timestamp, [
            bannerAlreadyActive
                ? `${config.title}已经生效，本次未重复建立次级部队。`
                : `后金控制 ${controlledRegions.length} 个${config.regionKindLabel}区域，建立 ${addedTroops} 个 2 级后金次级步兵。`,
            `${config.regionKindLabel}区域之后视为后金本土。`,
        ]);
        return true;
    };

    const resolveDroughtEvent = (config: QidahenDroughtEventConfig): boolean => {
        if (
            actionId !== 'play-event-card'
            || selectedEventActionCardDefId == null
            || !config.cardDefIds.includes(selectedEventActionCardDefId)
        ) {
            return false;
        }

        const selectedRuntimeRegionId = resolveQidahenPrimaryRuntimeRegionId(nextSelectedRegionId);
        const selectedRegion = nextRegions.find((region) => region.id === selectedRuntimeRegionId);
        if (!selectedRegion || selectedRegion.isLogicalRegion || !config.isTargetRegion(selectedRegion.id)) {
            nextLastSeasonSummary = dependencies.buildSeasonSummary(config.title, timestamp, [
                `当前选中区域不是${config.regionKindLabel}区域，本次未放置旱灾标记。`,
            ]);
            return true;
        }

        const markerId = `drought-marker-${selectedRegion.id}`;
        const hasDroughtMarker = selectedRegion.eventMarkers.some((marker) => marker.kind === 'drought');
        nextRegions = nextRegions.map((region) => (
            region.id === selectedRegion.id
                ? {
                    ...region,
                    eventMarkers: hasDroughtMarker
                        ? region.eventMarkers
                        : [
                            ...region.eventMarkers,
                            {
                                id: markerId,
                                kind: 'drought' as const,
                                label: '旱灾标记',
                                sourceCardDefId: selectedEventActionCardDefId,
                                imageSrc: 'qidahen/markers/drought-marker',
                            },
                        ],
                    note: [
                        region.note,
                        hasDroughtMarker
                            ? `${config.title}：${region.name} 已有旱灾标记。`
                            : `${config.title}：放置旱灾标记；该区域人口数视为 0，但仍可被劫掠。`,
                    ].filter(Boolean).join(' '),
                }
                : region
        ));
        nextSelectedRegionId = selectedRegion.id;
        nextLastSeasonSummary = dependencies.buildSeasonSummary(config.title, timestamp, [
            hasDroughtMarker
                ? `${selectedRegion.name} 已有旱灾标记，本次不重复放置。`
                : `在 ${selectedRegion.name} 放置旱灾标记。`,
            '旱灾区域人口数视为 0，但仍可被劫掠；完整人口结算入口仍需后续逐项接入。',
        ]);
        return true;
    };

    if (actionId === 'upgrade-armament') {
        const upgradeResolution = dependencies.resolveSelectedArmamentUpgradeExecution(
            state,
            nextFactions,
            currentFactionId,
            selectedArmamentId,
            selectedHandActionCardLabel,
            timestamp,
        );
        nextFactions = upgradeResolution.factions;
        nextLastSeasonSummary = upgradeResolution.lastSeasonSummary;
    }

    resolveBannerEvent({
        cardDefId: 'qidahen-atlas05-1605-establish-han-banners',
        title: '成立汉八旗',
        armamentId: 'han-banners',
        regionKindLabel: '汉人',
        troopSourceId: 'han-banners',
        isTargetRegion: isQidahenHanRuntimeRegionId,
    });
    resolveBannerEvent({
        cardDefId: 'qidahen-atlas05-1606-establish-manzhou-banners',
        title: '成立满八旗',
        armamentId: 'manzhou-banners',
        regionKindLabel: '女真人',
        troopSourceId: 'manzhou-banners',
        isTargetRegion: isQidahenJurchenRuntimeRegionId,
    });
    resolveBannerEvent({
        cardDefId: 'qidahen-atlas05-1607-establish-mongol-banners',
        title: '成立蒙八旗',
        armamentId: 'mongol-banners',
        regionKindLabel: '蒙古人',
        troopSourceId: 'mongol-banners',
        isTargetRegion: isQidahenMongolRuntimeRegionId,
    });
    resolveDroughtEvent({
        cardDefIds: [
            'qidahen-atlas05-1608-mongol-drought',
            'qidahen-atlas05-1637-mongol-drought-alt',
        ],
        title: '蒙古大旱',
        regionKindLabel: '蒙古人',
        isTargetRegion: isQidahenMongolRuntimeRegionId,
    });
    resolveDroughtEvent({
        cardDefIds: ['qidahen-atlas05-1613-northeast-drought'],
        title: '东北大旱',
        regionKindLabel: '女真人',
        isTargetRegion: isQidahenJurchenRuntimeRegionId,
    });

    if (
        actionId === 'play-event-card'
        && currentFactionId === 'jin'
        && selectedEventActionCardDefId === 'qidahen-atlas05-1609-seven-grievances'
    ) {
        const selectedRegion = nextRegions.find((region) => region.id === nextSelectedRegionId);
        if (selectedRegion && getEffectiveHomelandController(state, selectedRegion.id) === 'jin') {
            const addedTroops = 2;
            nextRegions = nextRegions.map((region) => (
                region.id === selectedRegion.id
                    ? addSpecialTroopStackToRegion({
                        ...region,
                        troops: region.troops + addedTroops,
                        note: [
                            region.note,
                            '七大恨：在后金本土建立 2 个 3 级主力步兵。',
                        ].filter(Boolean).join(' '),
                    }, buildRegularTroopStack('jin', 'seven-grievances', addedTroops, 3))
                    : region
            ));
            nextFactions = {
                ...nextFactions,
                jin: {
                    ...nextFactions.jin,
                    troops: nextFactions.jin.troops + addedTroops,
                },
            };
            nextLastSeasonSummary = dependencies.buildSeasonSummary('七大恨', timestamp, [
                `在 ${selectedRegion.name} 建立 2 个 3 级后金步兵。`,
            ]);
        } else {
            nextLastSeasonSummary = dependencies.buildSeasonSummary('七大恨', timestamp, [
                '当前选中区域不是后金本土，本次未建立部队。',
            ]);
        }
    }

    if (actionId === 'grant-pardon') {
        const grantPardonResolution = dependencies.resolveGrantPardonExecution(
            state,
            nextFactions,
            timestamp,
        );
        nextFactions = grantPardonResolution.factions;
        nextLastSeasonSummary = grantPardonResolution.lastSeasonSummary;
        nextRegions = grantPardonResolution.regions;
        nextSelectedRegionId = grantPardonResolution.selectedRegionId;
    }

    return {
        factions: nextFactions,
        lastSeasonSummary: nextLastSeasonSummary,
        regions: nextRegions,
        selectedRegionId: nextSelectedRegionId,
    };
};
