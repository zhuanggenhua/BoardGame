import { QIDAHEN_RUNTIME_REGION_DEFINITIONS } from '../ui/mapGraph';
import type { QidahenFactionId, QidahenSpecialTroopStack } from './types';

type QidahenRegionTag =
    | 'anchorage'
    | 'capital'
    | 'city'
    | 'frontier'
    | 'korea'
    | 'maintenance-dependency'
    | 'maintenance-target'
    | 'south-of-wall'
    | 'logical';

type QidahenFortificationId =
    | 'outer-wall'
    | 'inner-wall'
    | 'shanhaiguan'
    | 'ningyuan'
    | 'jinzhou';

interface QidahenRuleRegionConfig {
    id: string;
    name: string;
    primaryRuntimeRegionId: string;
    runtimeRegionIds: string[];
    tags: QidahenRegionTag[];
    tributeCards: number;
    maintenanceFortificationId: QidahenFortificationId | null;
    initialController: QidahenFactionId | 'neutral';
    initialTroops: number;
    initialSpecialTroops: QidahenSpecialTroopStack[];
    initialPopulation: number;
    initialNote: string | null;
    capitalOf: QidahenFactionId | null;
    prestigeCardBonus: number;
    prestigeCardBonusUnlock: 'always' | 'after-initial-controller-lost' | null;
}

interface QidahenFortificationConfig {
    id: QidahenFortificationId;
    label: string;
    maintenanceCost: number;
    dependencyRegionId: string | null;
    dependencyLabel: string | null;
    ruleNote: string;
    autoPayPriority: number;
}

const runtimeRegionOverrides: Partial<Record<string, Partial<QidahenRuleRegionConfig>>> = {
    'city-region-11': {
        name: '长白',
        tags: ['frontier'],
        initialController: 'jin',
        initialTroops: 2,
        initialSpecialTroops: [
            { id: 'jin-changbai-infantry-lv2', label: '后金步兵', faction: 'jin', troopKind: 'infantry', count: 2, level: 2 },
        ],
        initialPopulation: 2,
        initialNote: '剧本一后金本土：长白，按规则书先落 2 个 Lv2 部队与 2 人口。',
    },
    'city-region-13': {
        name: '建州',
        tags: ['capital', 'frontier'],
        initialController: 'jin',
        initialTroops: 3,
        initialSpecialTroops: [
            { id: 'jin-jianzhou-infantry-lv4', label: '后金精锐步兵', faction: 'jin', troopKind: 'infantry', count: 2, level: 4 },
            { id: 'jin-jianzhou-infantry-lv2', label: '后金步兵', faction: 'jin', troopKind: 'infantry', count: 1, level: 2 },
        ],
        initialPopulation: 2,
        initialNote: '剧本一后金本土：建州，按规则书落 2 个 Lv4 步兵、1 个 Lv2 部队与 2 人口。',
        capitalOf: 'jin',
    },
    'city-region-14': {
        name: '察哈尔',
        tags: ['frontier'],
        initialController: 'mongol',
        initialTroops: 3,
        initialSpecialTroops: [
            { id: 'mongol-chahar-cavalry-lv3', label: '蒙古骑兵', faction: 'mongol', troopKind: 'cavalry', count: 3, level: 3 },
        ],
        initialPopulation: 3,
        initialNote: '剧本一蒙古本土：察哈尔，按规则书落 3 个 Lv3 骑兵与 3 人口。',
    },
    'city-region-19': {
        name: '敖汉部',
        tags: ['frontier'],
        initialController: 'mongol',
        initialTroops: 1,
        initialSpecialTroops: [
            { id: 'mongol-aohanbu-mercenary-cavalry-lv2', label: '蒙古雇佣骑兵', faction: 'mongol', troopKind: 'cavalry', count: 1, level: 2 },
        ],
        initialPopulation: 1,
        initialNote: '剧本一蒙古控制区：敖汉部，按规则书落 1 个 Lv2 雇佣骑兵与 1 人口。',
    },
    'city-region-19-liaoxi': {
        name: '辽西',
        tags: ['frontier'],
        initialController: 'ming',
        initialTroops: 1,
        initialSpecialTroops: [
            { id: 'ming-liaoxi-infantry-lv1', label: '大明步兵', faction: 'ming', troopKind: 'infantry', count: 1, level: 1 },
        ],
        initialPopulation: 2,
        initialNote: '剧本一大明本土：辽西，按规则书落 1 个 Lv1 部队与 2 人口。',
    },
    'city-region-24': {
        name: '宣府',
        tags: ['city', 'frontier'],
        maintenanceFortificationId: 'ningyuan',
    },
    'city-region-28': {
        name: '顺天',
        tags: [],
        initialController: 'ming',
        initialTroops: 0,
        initialSpecialTroops: [],
        initialPopulation: 1,
        initialNote: '剧本一本土区域拆模过渡：顺天当前先作为与蓟镇共用印刷区的独立 runtime 壳层，起始只承接 1 人口。',
    },
    'city-region-28-jizhen': {
        name: '蓟镇',
        tags: ['frontier', 'south-of-wall'],
        initialController: 'ming',
        initialTroops: 1,
        initialSpecialTroops: [
            { id: 'ming-jizhen-infantry-lv1', label: '大明步兵', faction: 'ming', troopKind: 'infantry', count: 1, level: 1 },
        ],
        initialPopulation: 1,
        initialNote: '剧本一本土区域拆模过渡：蓟镇当前先承接原 `city-region-28` 的边界关系与前线兵力。',
    },
    'city-region-27': {
        tags: ['south-of-wall'],
    },
    'city-region-30': {
        tags: ['south-of-wall'],
    },
    'city-region-31': {
        tags: ['south-of-wall'],
    },
    'city-region-32': {
        tags: ['south-of-wall'],
    },
    'city-region-33': {
        tags: ['south-of-wall'],
    },
    'city-region-22': {
        name: '东江',
        tags: ['anchorage', 'city', 'frontier'],
        initialController: 'ming',
        initialTroops: 1,
        initialSpecialTroops: [
            { id: 'ming-dongjiang-infantry-lv1', label: '大明步兵', faction: 'ming', troopKind: 'infantry', count: 1, level: 1 },
        ],
        initialPopulation: 2,
        initialNote: '剧本一大明本土区域，先按规则书的 1 个 Lv1 部队与 2 人口落地，保留后续手调空间。',
    },
    jinzhou: {
        tags: ['anchorage', 'city', 'frontier', 'maintenance-target'],
        maintenanceFortificationId: 'jinzhou',
        initialController: 'jin',
        initialTroops: 2,
        initialSpecialTroops: [
            { id: 'jin-jinzhou-infantry-lv2', label: '后金步兵', faction: 'jin', troopKind: 'infantry', count: 2, level: 2 },
        ],
        initialPopulation: 2,
        initialNote: '辽西前线。当前势力行动可先围绕这里验证转控与移动代价。',
    },
    'song-jin': {
        name: '皮岛',
        tags: ['anchorage', 'city', 'frontier'],
        initialController: 'ming',
        initialTroops: 2,
        initialSpecialTroops: [
            { id: 'ming-pidao-infantry-lv1', label: '大明步兵', faction: 'ming', troopKind: 'infantry', count: 2, level: 1 },
        ],
        initialPopulation: 2,
        initialNote: '沿海据点，可承接后续补给、兵力与港口规则。',
    },
    'city-region-25': {
        tags: ['city', 'frontier', 'maintenance-target'],
        maintenanceFortificationId: 'shanhaiguan',
        initialController: 'ming',
        initialTroops: 2,
        initialSpecialTroops: [
            { id: 'ming-shanhaiguan-infantry-lv1', label: '大明步兵', faction: 'ming', troopKind: 'infantry', count: 2, level: 1 },
        ],
        initialPopulation: 1,
        initialNote: '山海关前线，大明在此扼守辽西与蓟镇之间的关隘。',
    },
    'xian-xing': {
        tags: ['korea'],
        tributeCards: 1,
        initialController: 'ming',
        initialTroops: 1,
        initialSpecialTroops: [
            { id: 'ming-xianxing-mercenary-lv2', label: '朝鲜雇佣军', faction: 'ming', troopKind: 'infantry', count: 1, level: 2 },
        ],
        initialPopulation: 3,
        initialNote: '朝鲜方向前线，先作为后金控制区与海岸邻接样本。',
    },
    'city-region-18': {
        name: '平壤',
        tags: ['korea'],
        tributeCards: 1,
        initialController: 'ming',
        initialTroops: 1,
        initialSpecialTroops: [
            { id: 'ming-pingrang-mercenary-lv2', label: '朝鲜雇佣军', faction: 'ming', troopKind: 'infantry', count: 1, level: 2 },
        ],
    },
    'city-region-29': {
        name: '汉城',
        tags: ['capital', 'korea'],
        tributeCards: 1,
        initialController: 'ming',
        initialTroops: 1,
        initialSpecialTroops: [
            { id: 'ming-hanseong-mercenary-lv2', label: '朝鲜雇佣军', faction: 'ming', troopKind: 'infantry', count: 1, level: 2 },
        ],
        capitalOf: 'ming',
        prestigeCardBonus: 1,
        prestigeCardBonusUnlock: 'after-initial-controller-lost',
    },
};

const runtimeRegionConfigs: QidahenRuleRegionConfig[] = QIDAHEN_RUNTIME_REGION_DEFINITIONS.map((region) => {
    const override = runtimeRegionOverrides[region.id] ?? {};
    return {
        id: region.id,
        name: override.name ?? region.name,
        primaryRuntimeRegionId: override.primaryRuntimeRegionId ?? region.id,
        runtimeRegionIds: override.runtimeRegionIds ?? [region.id],
        tags: override.tags ?? [],
        tributeCards: override.tributeCards ?? 0,
        maintenanceFortificationId: override.maintenanceFortificationId ?? null,
        initialController: override.initialController ?? 'neutral',
        initialTroops: override.initialTroops ?? 0,
        initialSpecialTroops: override.initialSpecialTroops ?? [],
        initialPopulation: override.initialPopulation ?? 0,
        initialNote: override.initialNote ?? null,
        capitalOf: override.capitalOf ?? null,
        prestigeCardBonus: override.prestigeCardBonus ?? 0,
        prestigeCardBonusUnlock: override.prestigeCardBonusUnlock ?? null,
    };
});

const createLogicalRuleRegionConfig = ({
    id,
    name,
    primaryRuntimeRegionId,
    runtimeRegionIds = [primaryRuntimeRegionId],
    tags = [],
    tributeCards = 0,
    maintenanceFortificationId = null,
    initialController = 'neutral',
    capitalOf = null,
    prestigeCardBonus = 0,
    prestigeCardBonusUnlock = null,
}: {
    id: string;
    name: string;
    primaryRuntimeRegionId: string;
    runtimeRegionIds?: string[];
    tags?: QidahenRegionTag[];
    tributeCards?: number;
    maintenanceFortificationId?: QidahenFortificationId | null;
    initialController?: QidahenFactionId | 'neutral';
    capitalOf?: QidahenFactionId | null;
    prestigeCardBonus?: number;
    prestigeCardBonusUnlock?: 'always' | 'after-initial-controller-lost' | null;
}): QidahenRuleRegionConfig => ({
    id,
    name,
    primaryRuntimeRegionId,
    runtimeRegionIds,
    tags: [...tags, 'logical'],
    tributeCards,
    maintenanceFortificationId,
    initialController,
    initialTroops: 0,
    initialSpecialTroops: [],
    initialPopulation: 0,
    initialNote: null,
    capitalOf,
    prestigeCardBonus,
    prestigeCardBonusUnlock,
});

const logicalRuleRegionConfigs: QidahenRuleRegionConfig[] = [
    createLogicalRuleRegionConfig({
        id: 'shan-hai-guan',
        name: '山海关',
        primaryRuntimeRegionId: 'city-region-25',
        tags: ['city', 'frontier', 'maintenance-target'],
        maintenanceFortificationId: 'shanhaiguan',
        initialController: 'ming',
    }),
    createLogicalRuleRegionConfig({
        id: 'shou-cheng',
        name: '汉城',
        primaryRuntimeRegionId: 'city-region-29',
        runtimeRegionIds: ['city-region-18', 'city-region-29'],
        tags: ['capital', 'korea'],
        initialController: 'ming',
        capitalOf: 'ming',
        prestigeCardBonus: 1,
        prestigeCardBonusUnlock: 'after-initial-controller-lost',
    }),
    createLogicalRuleRegionConfig({
        id: 'liao-xi',
        name: '辽西',
        primaryRuntimeRegionId: 'city-region-19-liaoxi',
        tags: ['frontier', 'maintenance-dependency'],
        initialController: 'ming',
    }),
    createLogicalRuleRegionConfig({
        id: 'ning-yuan',
        name: '宁远',
        primaryRuntimeRegionId: 'city-region-24',
        tags: ['city', 'frontier', 'maintenance-target'],
        maintenanceFortificationId: 'ningyuan',
    }),
    createLogicalRuleRegionConfig({
        id: 'ji-zhen',
        name: '蓟镇',
        primaryRuntimeRegionId: 'city-region-28-jizhen',
        tags: ['frontier', 'maintenance-dependency', 'south-of-wall'],
        initialController: 'ming',
    }),
    createLogicalRuleRegionConfig({
        id: 'liao-bei',
        name: '辽北',
        primaryRuntimeRegionId: 'city-region-15',
    }),
    createLogicalRuleRegionConfig({
        id: 'liao-dong',
        name: '辽东',
        primaryRuntimeRegionId: 'city-region-15-liaodong',
    }),
    createLogicalRuleRegionConfig({
        id: 'xuan-fu',
        name: '宣府',
        primaryRuntimeRegionId: 'city-region-24',
    }),
    createLogicalRuleRegionConfig({
        id: 'shun-tian',
        name: '顺天',
        primaryRuntimeRegionId: 'city-region-28',
    }),
];

const QIDAHEN_RULE_REGION_CONFIGS: QidahenRuleRegionConfig[] = [
    ...runtimeRegionConfigs,
    ...logicalRuleRegionConfigs,
];

const QIDAHEN_RULE_REGION_CONFIG_BY_ID = new Map(
    QIDAHEN_RULE_REGION_CONFIGS.map((region) => [region.id, region]),
);

const QIDAHEN_LOGICAL_RULE_REGION_IDS = new Set(
    logicalRuleRegionConfigs.map((region) => region.id),
);

const QIDAHEN_KOREA_RUNTIME_REGION_IDS = runtimeRegionConfigs
    .filter((region) => region.tags.includes('korea'))
    .map((region) => region.id);

const QIDAHEN_FORTIFICATION_CONFIGS: QidahenFortificationConfig[] = [
    {
        id: 'outer-wall',
        label: '外长城',
        maintenanceCost: 6,
        dependencyRegionId: null,
        dependencyLabel: null,
        ruleNote: '攻入长城凸面战场宽度 1；若破败则视为平原宽度 3。',
        autoPayPriority: 5,
    },
    {
        id: 'inner-wall',
        label: '内长城',
        maintenanceCost: 2,
        dependencyRegionId: null,
        dependencyLabel: null,
        ruleNote: '当前图谱仅保留维护费，不额外改边界；后续可继续细分内墙区段。',
        autoPayPriority: 4,
    },
    {
        id: 'shanhaiguan',
        label: '山海关',
        maintenanceCost: 2,
        dependencyRegionId: 'ji-zhen',
        dependencyLabel: '蓟镇',
        ruleNote: '若破败则山海关边界视为平原，后金联姻诱降辽西时取消 2 部队减免。',
        autoPayPriority: 1,
    },
    {
        id: 'ningyuan',
        label: '宁远',
        maintenanceCost: 2,
        dependencyRegionId: 'liao-xi',
        dependencyLabel: '辽西',
        ruleNote: '若破败则宁远视为城市不存在。',
        autoPayPriority: 3,
    },
    {
        id: 'jinzhou',
        label: '锦州',
        maintenanceCost: 2,
        dependencyRegionId: 'liao-xi',
        dependencyLabel: '辽西',
        ruleNote: '若破败则锦州视为城市不存在。',
        autoPayPriority: 2,
    },
];

export const getQidahenFortificationConfigs = () => (
    QIDAHEN_FORTIFICATION_CONFIGS.map((config) => ({ ...config }))
);

export const getQidahenLogicalRuleRegionConfigs = (): QidahenRuleRegionConfig[] => (
    logicalRuleRegionConfigs.map((config) => ({
        ...config,
        runtimeRegionIds: [...config.runtimeRegionIds],
        tags: [...config.tags],
        initialSpecialTroops: config.initialSpecialTroops.map((troop) => ({ ...troop })),
    }))
);

export const isQidahenLogicalRuleRegionId = (regionId: string): boolean => (
    QIDAHEN_LOGICAL_RULE_REGION_IDS.has(regionId)
);

export const resolveQidahenRuleRegionConfig = (regionId: string): QidahenRuleRegionConfig => (
    QIDAHEN_RULE_REGION_CONFIG_BY_ID.get(regionId)
    ?? {
        id: regionId,
        name: regionId,
        primaryRuntimeRegionId: regionId,
        runtimeRegionIds: [regionId],
        tags: [],
        tributeCards: 0,
        maintenanceFortificationId: null,
        initialController: 'neutral',
        initialTroops: 0,
        initialSpecialTroops: [],
        initialPopulation: 0,
        initialNote: null,
        capitalOf: null,
        prestigeCardBonus: 0,
        prestigeCardBonusUnlock: null,
    }
);

export const resolveQidahenPrimaryRuntimeRegionId = (regionId: string): string => (
    resolveQidahenRuleRegionConfig(regionId).primaryRuntimeRegionId
);

export const resolveQidahenRuntimeRegionIds = (regionId: string): string[] => (
    [...resolveQidahenRuleRegionConfig(regionId).runtimeRegionIds]
);

export const isQidahenRuleRegionEquivalent = (regionId: string, targetRuleRegionId: string): boolean => {
    const regionRuntimeIds = new Set(resolveQidahenRuntimeRegionIds(regionId));
    return resolveQidahenRuntimeRegionIds(targetRuleRegionId).some((runtimeRegionId) => regionRuntimeIds.has(runtimeRegionId));
};

export const isQidahenCityRuntimeRegion = (regionId: string): boolean => (
    resolveQidahenRuleRegionConfig(regionId).tags.includes('city')
);

export const isQidahenKoreaRuntimeRegionId = (regionId: string): boolean => (
    QIDAHEN_KOREA_RUNTIME_REGION_IDS.includes(regionId)
);

export const getQidahenInitialController = (regionId: string): QidahenFactionId | 'neutral' => (
    resolveQidahenRuleRegionConfig(regionId).initialController
);
