import {
    BETRAYAL_DISCOVERY_POOLS,
    BETRAYAL_EXPLORER_CATALOG,
    BETRAYAL_RUNTIME_SUPPORTED_HAUNT_CARD_NUMBERS,
    BETRAYAL_SCENARIO_CARD_CANDIDATES,
    BETRAYAL_SCENARIO_CONFIGS,
    BETRAYAL_SHARED_PRE_HAUNT_SETUP,
    resolveBetrayalRoomDiscoverySymbol,
    type BetrayalRoomDiscoveryTemplate,
    type BetrayalRoomEdge,
    type BetrayalRoomFloor,
    type BetrayalRoomSeed,
} from '../scenarioConfig';
import { resolveBetrayalRoomTileVisual } from '../roomAtlas';

export const BETRAYAL_CONFIG_REVIEW_VERSION = 'legacy-ts-config-v1';
export const BETRAYAL_CONFIG_REVIEW_TABLE_ID = 'betrayal:legacy-config-review';

export type BetrayalConfigReviewType =
    | 'explorer'
    | 'starting-room'
    | 'room-template'
    | 'scenario-card'
    | 'scenario-config'
    | 'haunt-static';

export type BetrayalConfigReviewStatus =
    | 'locked'
    | 'blocked'
    | 'disputed'
    | 'code-owned'
    | 'representative-only'
    | 'contract-pending';

export const BETRAYAL_CONFIG_REVIEW_FIELD_KEYS = [
    'category',
    'name',
    'explorerId',
    'panelAsset',
    'panelSourceFile',
    'mapTokenAsset',
    'mapTokenSourceFile',
    'mapTokenCompressedAsset',
    'assetUsageContract',
    'floor',
    'coordinates',
    'state',
    'visualId',
    'atlasFrame',
    'discoverySymbol',
    'doorways',
    'orientationTurns',
    'rotatedDoorways',
    'connectionStatus',
    'scenarioCardLabel',
    'triggerOmenLabel',
    'hauntNumber',
    'implementationStatus',
    'implementedScenarioId',
    'runtimeSupport',
    'runtimeObjective',
    'hauntObjective',
    'hauntId',
    'reward',
    'sourcePath',
    'reviewStatus',
] as const;

export type BetrayalConfigReviewFieldKey = typeof BETRAYAL_CONFIG_REVIEW_FIELD_KEYS[number];

export const BETRAYAL_CONFIG_REVIEW_COLUMN_KEYS = [
    ...BETRAYAL_CONFIG_REVIEW_FIELD_KEYS,
] as const;

export type BetrayalConfigReviewColumnKey = typeof BETRAYAL_CONFIG_REVIEW_COLUMN_KEYS[number];

export type BetrayalConfigReviewFieldValueKind =
    | 'string'
    | 'number'
    | 'boolean'
    | 'string-array';

export type BetrayalConfigReviewFieldApplicability =
    | 'all'
    | 'explorer'
    | 'room'
    | 'scenario'
    | 'haunt';

export interface BetrayalConfigReviewFieldDefinition {
    key: BetrayalConfigReviewFieldKey;
    valueKind: BetrayalConfigReviewFieldValueKind;
    applicability: BetrayalConfigReviewFieldApplicability;
    editable: boolean;
    requiredForAudit: boolean;
    meaning: string;
    evidence: string[];
    getValue: (row: BetrayalConfigReviewRow) => unknown;
}

export type BetrayalConfigReviewFieldPaths = Record<BetrayalConfigReviewFieldKey, string>;

export interface BetrayalConfigReviewRow {
    rowId: string;
    objectId: string;
    objectType: BetrayalConfigReviewType;
    groupName: string;
    displayName: string;
    searchText: string;
    sourceContexts: string[];
    values: Partial<Record<BetrayalConfigReviewFieldKey, unknown>>;
    fieldPaths: BetrayalConfigReviewFieldPaths;
}

export interface BetrayalConfigReviewTable {
    tableId: string;
    gameId: 'betrayal';
    configVersion: string;
    rows: BetrayalConfigReviewRow[];
}

const FIELD_EVIDENCE = {
    scenarioConfig: 'src/games/betrayal/scenarioConfig.ts',
    gameRuntime: 'src/games/betrayal/game.ts',
    roomContract: 'evidence/betrayal/full-audit/room-tile-s0-contract-2026-07-29.md',
    setupAudit: 'evidence/betrayal/full-audit/opening-setup-and-explorer-config-audit-2026-08-01.md',
    hauntDocs: 'docs/games/betrayal/haunts/*.md',
    intakeContract: 'docs/games/betrayal/intake-contract.md',
    runtimeResourceMap: 'docs/games/betrayal/sources/image-index/runtime-resource-map.json',
    assetManifest: 'public/assets/i18n/zh-CN/betrayal/assets-manifest.json',
} as const;

const EDGE_ORDER: readonly BetrayalRoomEdge[] = ['north', 'east', 'south', 'west'];
const EDGE_LABELS: Record<BetrayalRoomEdge, string> = {
    north: '北',
    east: '东',
    south: '南',
    west: '西',
};

const FLOOR_LABELS: Record<BetrayalRoomFloor, string> = {
    ground: '一层',
    upper: '上层',
    basement: '地下室',
};

function rotateEdge(edge: BetrayalRoomEdge, turns: number): BetrayalRoomEdge {
    const index = EDGE_ORDER.indexOf(edge);
    return EDGE_ORDER[(index + turns + EDGE_ORDER.length) % EDGE_ORDER.length]!;
}

export function rotateBetrayalRoomDoorways(
    doorways: readonly BetrayalRoomEdge[],
    orientationTurns: number,
): BetrayalRoomEdge[] {
    return doorways.map((edge) => rotateEdge(edge, orientationTurns));
}

function formatEdges(edges: readonly BetrayalRoomEdge[]): string[] {
    return edges.map((edge) => EDGE_LABELS[edge]);
}

function formatDoorwayConnections(doorways: readonly BetrayalRoomSeed['doorways']): string[] {
    return doorways.map((doorway) => {
        const target = doorway.connectsToRoomId ? `→ ${doorway.connectsToRoomId}` : '未连接';
        const floor = doorway.leadsToFloor ? ` / 通向${FLOOR_LABELS[doorway.leadsToFloor]}` : '';
        const note = doorway.note ? ` / ${doorway.note}` : '';
        return `${EDGE_LABELS[doorway.edge]} ${target}${floor}${note}`;
    });
}

function formatOrientationOptions(doorways: readonly BetrayalRoomEdge[]): string[] {
    return [0, 1, 2, 3].map((turns) => (
        `${turns}转：${formatEdges(rotateBetrayalRoomDoorways(doorways, turns)).join('、')}`
    ));
}

function resolveAtlasFrame(visualId: string): number | undefined {
    const visual = resolveBetrayalRoomTileVisual(visualId);
    return visual?.frameIndex;
}

function allFieldPaths(root: string): BetrayalConfigReviewFieldPaths {
    return Object.fromEntries(
        BETRAYAL_CONFIG_REVIEW_FIELD_KEYS.map((key) => [key, `${root}.${key}`]),
    ) as BetrayalConfigReviewFieldPaths;
}

function buildRow({
    objectType,
    objectId,
    groupName,
    displayName,
    values,
    sourceContexts,
    root,
    fieldPathOverrides,
}: {
    objectType: BetrayalConfigReviewType;
    objectId: string;
    groupName: string;
    displayName: string;
    values: Partial<Record<BetrayalConfigReviewFieldKey, unknown>>;
    sourceContexts: string[];
    root: string;
    fieldPathOverrides?: Partial<BetrayalConfigReviewFieldPaths>;
}): BetrayalConfigReviewRow {
    const normalizedValues = {
        category: groupName,
        name: displayName,
        ...values,
    } satisfies Partial<Record<BetrayalConfigReviewFieldKey, unknown>>;
    return {
        rowId: `${objectType}:${objectId}`,
        objectId,
        objectType,
        groupName,
        displayName,
        values: normalizedValues,
        sourceContexts,
        fieldPaths: {
            ...allFieldPaths(root),
            ...fieldPathOverrides,
        },
        searchText: [
            objectType,
            objectId,
            groupName,
            displayName,
            ...Object.values(normalizedValues).flatMap((value) => Array.isArray(value) ? value : [value]),
            ...sourceContexts,
        ].filter((value) => value !== undefined && value !== null).join(' ').toLocaleLowerCase(),
    };
}

function buildStartingRoomRow(room: BetrayalRoomSeed): BetrayalConfigReviewRow {
    const orientationTurns = room.orientationTurns ?? 0;
    const rawDoorways = room.doorways.map((doorway) => doorway.edge);
    const missingConnectionIds = room.connectedRoomIds.filter((roomId) => (
        !room.doorways.some((doorway) => doorway.connectsToRoomId === roomId)
    ));
    const extraDoorTargets = room.doorways
        .map((doorway) => doorway.connectsToRoomId)
        .filter((roomId): roomId is string => Boolean(roomId))
        .filter((roomId) => !room.connectedRoomIds.includes(roomId));
    const connectionStatus = missingConnectionIds.length === 0 && extraDoorTargets.length === 0
        ? '连接清单与门位一致'
        : `连接差异：缺少 ${missingConnectionIds.join('、') || '无'}；多出 ${extraDoorTargets.join('、') || '无'}`;

    return buildRow({
        objectType: 'starting-room',
        objectId: room.id,
        groupName: '起始布局',
        displayName: room.name,
        values: {
            floor: FLOOR_LABELS[room.floor],
            coordinates: `${room.x},${room.y}`,
            state: room.state === 'discovered' ? '已发现' : '未探索占位',
            visualId: room.visualId,
            atlasFrame: resolveAtlasFrame(room.visualId),
            discoverySymbol: room.discoveryReward ?? 'none',
            doorways: formatDoorwayConnections(room.doorways),
            orientationTurns,
            rotatedDoorways: formatEdges(rotateBetrayalRoomDoorways(rawDoorways, orientationTurns)),
            connectionStatus,
            reviewStatus: 'locked',
        },
        sourceContexts: [
            FIELD_EVIDENCE.scenarioConfig,
            FIELD_EVIDENCE.setupAudit,
        ],
        root: `legacy.betrayal.scenarioConfig.BETRAYAL_SHARED_PRE_HAUNT_SETUP.startingRoomLayout.${room.id}`,
    });
}

function buildExplorerRows(): BetrayalConfigReviewRow[] {
    return BETRAYAL_EXPLORER_CATALOG.map((explorer) => {
        const tokenAsset = explorer.tokenAsset ?? '';
        const tokenCompressedAsset = tokenAsset
            ? `public/assets/i18n/zh-CN/betrayal/tokens/explorers/compressed/${explorer.explorerId}.webp`
            : '';

        return buildRow({
            objectType: 'explorer',
            objectId: explorer.explorerId,
            groupName: '探索者角色',
            displayName: explorer.displayName,
            values: {
                explorerId: explorer.explorerId,
                panelAsset: explorer.portraitAsset,
                panelSourceFile: `public/assets/i18n/zh-CN/${explorer.portraitAsset}.png`,
                mapTokenAsset: tokenAsset,
                mapTokenSourceFile: tokenAsset ? `public/assets/i18n/zh-CN/${tokenAsset}.png` : '',
                mapTokenCompressedAsset: tokenCompressedAsset,
                assetUsageContract: '玩家面板使用 panelAsset / portraitAsset；地图房间角色 token 使用 mapTokenAsset / tokenAsset；两者不能互相替代',
                reviewStatus: tokenAsset ? 'locked' : 'blocked',
            },
            sourceContexts: [
                FIELD_EVIDENCE.scenarioConfig,
                FIELD_EVIDENCE.intakeContract,
                FIELD_EVIDENCE.runtimeResourceMap,
                FIELD_EVIDENCE.assetManifest,
            ],
            root: `legacy.betrayal.scenarioConfig.BETRAYAL_EXPLORER_CATALOG.${explorer.explorerId}`,
            fieldPathOverrides: {
                explorerId: `legacy.betrayal.scenarioConfig.BETRAYAL_EXPLORER_CATALOG.${explorer.explorerId}.explorerId`,
                name: `legacy.betrayal.scenarioConfig.BETRAYAL_EXPLORER_CATALOG.${explorer.explorerId}.displayName`,
                panelAsset: `legacy.betrayal.scenarioConfig.BETRAYAL_EXPLORER_CATALOG.${explorer.explorerId}.portraitAsset`,
                mapTokenAsset: `legacy.betrayal.scenarioConfig.BETRAYAL_EXPLORER_CATALOG.${explorer.explorerId}.tokenAsset`,
            },
        });
    });
}

function buildRoomTemplateRow(floor: BetrayalRoomFloor, room: BetrayalRoomDiscoveryTemplate): BetrayalConfigReviewRow {
    const discoverySymbol = resolveBetrayalRoomDiscoverySymbol(room);
    return buildRow({
        objectType: 'room-template',
        objectId: `${floor}:${room.visualId}`,
        groupName: '可探索房间',
        displayName: room.name,
        values: {
            floor: FLOOR_LABELS[floor],
            state: '房间牌堆模板',
            visualId: room.visualId,
            atlasFrame: resolveAtlasFrame(room.visualId),
            discoverySymbol,
            doorways: formatEdges(room.doorways),
            orientationTurns: '运行时选择',
            rotatedDoorways: formatOrientationOptions(room.doorways),
            connectionStatus: '放置时必须至少一扇旋转后门位连通入口门',
            reviewStatus: 'locked',
        },
        sourceContexts: [
            FIELD_EVIDENCE.scenarioConfig,
            FIELD_EVIDENCE.roomContract,
        ],
        root: `legacy.betrayal.scenarioConfig.BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.${floor}.${room.visualId}`,
    });
}

function buildScenarioCardRows(): BetrayalConfigReviewRow[] {
    return BETRAYAL_SCENARIO_CARD_CANDIDATES.map((candidate) => buildRow({
        objectType: 'scenario-card',
        objectId: candidate.id,
        groupName: '剧本候选',
        displayName: candidate.title,
        values: {
            scenarioCardLabel: candidate.scenarioCardLabel,
            triggerOmenLabel: candidate.triggerOmenLabel,
            hauntNumber: candidate.hauntNumber,
            implementationStatus: candidate.implementationStatus,
            implementedScenarioId: candidate.implementedScenarioId ?? '',
            runtimeSupport: BETRAYAL_RUNTIME_SUPPORTED_HAUNT_CARD_NUMBERS.includes(
                candidate.hauntNumber as typeof BETRAYAL_RUNTIME_SUPPORTED_HAUNT_CARD_NUMBERS[number],
            ) ? '运行支持代表链' : '未进入运行支持清单',
            sourcePath: candidate.sourcePath,
            reviewStatus: candidate.implementationStatus === 'implemented'
                ? 'locked'
                : candidate.implementationStatus === 'runtime-supported'
                    ? 'representative-only'
                    : 'contract-pending',
        },
        sourceContexts: [
            FIELD_EVIDENCE.scenarioConfig,
            candidate.sourcePath,
        ],
        root: `legacy.betrayal.scenarioConfig.BETRAYAL_SCENARIO_CARD_CANDIDATES.${candidate.id}`,
    }));
}

function buildScenarioConfigRows(): BetrayalConfigReviewRow[] {
    return Object.values(BETRAYAL_SCENARIO_CONFIGS).map((scenario) => buildRow({
        objectType: 'scenario-config',
        objectId: scenario.id,
        groupName: '剧本运行配置',
        displayName: scenario.title,
        values: {
            scenarioCardLabel: scenario.scenarioCardLabel,
            triggerOmenLabel: scenario.hauntTriggerLabel,
            hauntId: scenario.hauntId,
            runtimeObjective: scenario.presentation.runtimeObjective,
            hauntObjective: scenario.presentation.hauntObjective,
            reward: `星星 ${scenario.completion.reward.stars}；日志 ${scenario.completion.reward.logs}；最低预兆 ${scenario.completion.reward.minimumOmens}`,
            implementationStatus: 'implemented',
            reviewStatus: 'locked',
        },
        sourceContexts: [
            FIELD_EVIDENCE.scenarioConfig,
            FIELD_EVIDENCE.setupAudit,
        ],
        root: `legacy.betrayal.scenarioConfig.BETRAYAL_SCENARIO_CONFIGS.${scenario.id}`,
    }));
}

function buildHauntStaticRows(): BetrayalConfigReviewRow[] {
    return BETRAYAL_RUNTIME_SUPPORTED_HAUNT_CARD_NUMBERS.map((hauntNumber) => {
        const candidates = BETRAYAL_SCENARIO_CARD_CANDIDATES.filter((candidate) => candidate.hauntNumber === hauntNumber);
        const primary = candidates[0];
        const implementedCount = candidates.filter((candidate) => candidate.implementationStatus === 'implemented').length;
        const hasCandidateConfig = candidates.length > 0;
        return buildRow({
            objectType: 'haunt-static',
            objectId: `haunt-${hauntNumber}`,
            groupName: '作祟静态元数据',
            displayName: hasCandidateConfig
                ? `作祟 ${hauntNumber}：${candidates.map((candidate) => candidate.title).join(' / ')}`
                : `作祟 ${hauntNumber}：运行支持候选未登记`,
            values: {
                hauntNumber,
                triggerOmenLabel: candidates.map((candidate) => candidate.triggerOmenLabel),
                implementationStatus: !hasCandidateConfig
                    ? 'code-owned'
                    : implementedCount === candidates.length
                        ? 'implemented'
                        : 'runtime-supported',
                runtimeSupport: '在运行支持清单中；具体机制仍由 game.ts 代码 Module 承接',
                sourcePath: candidates.map((candidate) => candidate.sourcePath),
                reviewStatus: !hasCandidateConfig
                    ? 'code-owned'
                    : implementedCount === candidates.length
                        ? 'locked'
                        : 'representative-only',
            },
            sourceContexts: [
                FIELD_EVIDENCE.scenarioConfig,
                FIELD_EVIDENCE.gameRuntime,
                ...(primary ? [primary.sourcePath] : []),
            ],
            root: `legacy.betrayal.scenarioConfig.BETRAYAL_RUNTIME_SUPPORTED_HAUNT_CARD_NUMBERS.${hauntNumber}`,
        });
    });
}

export const BETRAYAL_CONFIG_REVIEW_FIELD_DEFINITIONS: readonly BetrayalConfigReviewFieldDefinition[] = [
    {
        key: 'category',
        valueKind: 'string',
        applicability: 'all',
        editable: false,
        requiredForAudit: true,
        meaning: '配置对象分组',
        evidence: [FIELD_EVIDENCE.scenarioConfig],
        getValue: (row) => row.values.category,
    },
    {
        key: 'name',
        valueKind: 'string',
        applicability: 'all',
        editable: true,
        requiredForAudit: true,
        meaning: '玩家可见对象名称',
        evidence: [FIELD_EVIDENCE.scenarioConfig],
        getValue: (row) => row.values.name,
    },
    {
        key: 'explorerId',
        valueKind: 'string',
        applicability: 'explorer',
        editable: false,
        requiredForAudit: true,
        meaning: '探索者唯一配置 ID，用于关联玩家面板资源和地图 token',
        evidence: [FIELD_EVIDENCE.scenarioConfig],
        getValue: (row) => row.values.explorerId,
    },
    {
        key: 'panelAsset',
        valueKind: 'string',
        applicability: 'explorer',
        editable: true,
        requiredForAudit: true,
        meaning: '玩家面板 / 角色板资源；左上玩家面板读取这个字段',
        evidence: [FIELD_EVIDENCE.scenarioConfig, FIELD_EVIDENCE.intakeContract],
        getValue: (row) => row.values.panelAsset,
    },
    {
        key: 'panelSourceFile',
        valueKind: 'string',
        applicability: 'explorer',
        editable: false,
        requiredForAudit: true,
        meaning: '玩家面板资源源文件路径，用于人工核对角色板 / 肖像',
        evidence: [FIELD_EVIDENCE.intakeContract, FIELD_EVIDENCE.assetManifest],
        getValue: (row) => row.values.panelSourceFile,
    },
    {
        key: 'mapTokenAsset',
        valueKind: 'string',
        applicability: 'explorer',
        editable: true,
        requiredForAudit: true,
        meaning: '地图房间内角色 token 资源；地图 token 渲染读取这个字段',
        evidence: [FIELD_EVIDENCE.scenarioConfig, FIELD_EVIDENCE.runtimeResourceMap],
        getValue: (row) => row.values.mapTokenAsset,
    },
    {
        key: 'mapTokenSourceFile',
        valueKind: 'string',
        applicability: 'explorer',
        editable: false,
        requiredForAudit: true,
        meaning: '地图角色 token 源图路径，用于人工核对正式 token',
        evidence: [FIELD_EVIDENCE.runtimeResourceMap, FIELD_EVIDENCE.assetManifest],
        getValue: (row) => row.values.mapTokenSourceFile,
    },
    {
        key: 'mapTokenCompressedAsset',
        valueKind: 'string',
        applicability: 'explorer',
        editable: false,
        requiredForAudit: true,
        meaning: '地图角色 token 压缩运行时资源路径',
        evidence: [FIELD_EVIDENCE.intakeContract, FIELD_EVIDENCE.assetManifest],
        getValue: (row) => row.values.mapTokenCompressedAsset,
    },
    {
        key: 'assetUsageContract',
        valueKind: 'string',
        applicability: 'explorer',
        editable: false,
        requiredForAudit: true,
        meaning: '玩家面板和地图 token 的职责边界，防止两类资源串用',
        evidence: [FIELD_EVIDENCE.intakeContract, FIELD_EVIDENCE.runtimeResourceMap],
        getValue: (row) => row.values.assetUsageContract,
    },
    {
        key: 'floor',
        valueKind: 'string',
        applicability: 'room',
        editable: true,
        requiredForAudit: true,
        meaning: '房间所属楼层或背面区域',
        evidence: [FIELD_EVIDENCE.scenarioConfig, FIELD_EVIDENCE.roomContract],
        getValue: (row) => row.values.floor,
    },
    {
        key: 'coordinates',
        valueKind: 'string',
        applicability: 'room',
        editable: true,
        requiredForAudit: false,
        meaning: '起始布局坐标',
        evidence: [FIELD_EVIDENCE.scenarioConfig],
        getValue: (row) => row.values.coordinates,
    },
    {
        key: 'state',
        valueKind: 'string',
        applicability: 'room',
        editable: true,
        requiredForAudit: true,
        meaning: '房间当前配置状态',
        evidence: [FIELD_EVIDENCE.scenarioConfig],
        getValue: (row) => row.values.state,
    },
    {
        key: 'visualId',
        valueKind: 'string',
        applicability: 'room',
        editable: true,
        requiredForAudit: true,
        meaning: '房间素材 visualId',
        evidence: [FIELD_EVIDENCE.scenarioConfig, FIELD_EVIDENCE.roomContract],
        getValue: (row) => row.values.visualId,
    },
    {
        key: 'atlasFrame',
        valueKind: 'number',
        applicability: 'room',
        editable: false,
        requiredForAudit: true,
        meaning: '房间图集 frame，用于对照图片来源',
        evidence: [FIELD_EVIDENCE.roomContract],
        getValue: (row) => row.values.atlasFrame,
    },
    {
        key: 'discoverySymbol',
        valueKind: 'string',
        applicability: 'room',
        editable: true,
        requiredForAudit: true,
        meaning: '房间正面发现符号',
        evidence: [FIELD_EVIDENCE.scenarioConfig, FIELD_EVIDENCE.roomContract],
        getValue: (row) => row.values.discoverySymbol,
    },
    {
        key: 'doorways',
        valueKind: 'string-array',
        applicability: 'room',
        editable: true,
        requiredForAudit: true,
        meaning: '房间原始门位或固定连接门',
        evidence: [FIELD_EVIDENCE.scenarioConfig, FIELD_EVIDENCE.roomContract],
        getValue: (row) => row.values.doorways,
    },
    {
        key: 'orientationTurns',
        valueKind: 'string',
        applicability: 'room',
        editable: true,
        requiredForAudit: true,
        meaning: '房间旋转次数；可探索房间在运行时选择',
        evidence: [FIELD_EVIDENCE.scenarioConfig, FIELD_EVIDENCE.gameRuntime],
        getValue: (row) => row.values.orientationTurns,
    },
    {
        key: 'rotatedDoorways',
        valueKind: 'string-array',
        applicability: 'room',
        editable: false,
        requiredForAudit: true,
        meaning: '旋转后门位，用于核对是否能连通',
        evidence: [FIELD_EVIDENCE.gameRuntime],
        getValue: (row) => row.values.rotatedDoorways,
    },
    {
        key: 'connectionStatus',
        valueKind: 'string',
        applicability: 'room',
        editable: false,
        requiredForAudit: true,
        meaning: '门位与连接关系校验结果',
        evidence: [FIELD_EVIDENCE.gameRuntime],
        getValue: (row) => row.values.connectionStatus,
    },
    {
        key: 'scenarioCardLabel',
        valueKind: 'string',
        applicability: 'scenario',
        editable: true,
        requiredForAudit: true,
        meaning: '剧本卡触发矩阵标签',
        evidence: [FIELD_EVIDENCE.scenarioConfig, FIELD_EVIDENCE.hauntDocs],
        getValue: (row) => row.values.scenarioCardLabel,
    },
    {
        key: 'triggerOmenLabel',
        valueKind: 'string',
        applicability: 'scenario',
        editable: true,
        requiredForAudit: true,
        meaning: '触发作祟的预兆或事件标签',
        evidence: [FIELD_EVIDENCE.scenarioConfig, FIELD_EVIDENCE.hauntDocs],
        getValue: (row) => row.values.triggerOmenLabel,
    },
    {
        key: 'hauntNumber',
        valueKind: 'number',
        applicability: 'haunt',
        editable: true,
        requiredForAudit: true,
        meaning: '作祟编号',
        evidence: [FIELD_EVIDENCE.scenarioConfig, FIELD_EVIDENCE.hauntDocs],
        getValue: (row) => row.values.hauntNumber,
    },
    {
        key: 'implementationStatus',
        valueKind: 'string',
        applicability: 'scenario',
        editable: true,
        requiredForAudit: true,
        meaning: '实现状态，不能把代表链冒充完成',
        evidence: [FIELD_EVIDENCE.scenarioConfig, FIELD_EVIDENCE.gameRuntime],
        getValue: (row) => row.values.implementationStatus,
    },
    {
        key: 'implementedScenarioId',
        valueKind: 'string',
        applicability: 'scenario',
        editable: true,
        requiredForAudit: true,
        meaning: '已接入运行剧本 ID',
        evidence: [FIELD_EVIDENCE.scenarioConfig],
        getValue: (row) => row.values.implementedScenarioId,
    },
    {
        key: 'runtimeSupport',
        valueKind: 'string',
        applicability: 'haunt',
        editable: false,
        requiredForAudit: true,
        meaning: '运行支持边界',
        evidence: [FIELD_EVIDENCE.scenarioConfig, FIELD_EVIDENCE.gameRuntime],
        getValue: (row) => row.values.runtimeSupport,
    },
    {
        key: 'runtimeObjective',
        valueKind: 'string',
        applicability: 'scenario',
        editable: true,
        requiredForAudit: true,
        meaning: '作祟前目标文案',
        evidence: [FIELD_EVIDENCE.scenarioConfig],
        getValue: (row) => row.values.runtimeObjective,
    },
    {
        key: 'hauntObjective',
        valueKind: 'string',
        applicability: 'scenario',
        editable: true,
        requiredForAudit: true,
        meaning: '作祟后目标文案',
        evidence: [FIELD_EVIDENCE.scenarioConfig],
        getValue: (row) => row.values.hauntObjective,
    },
    {
        key: 'hauntId',
        valueKind: 'string',
        applicability: 'scenario',
        editable: true,
        requiredForAudit: true,
        meaning: '运行时作祟 ID',
        evidence: [FIELD_EVIDENCE.scenarioConfig],
        getValue: (row) => row.values.hauntId,
    },
    {
        key: 'reward',
        valueKind: 'string',
        applicability: 'scenario',
        editable: true,
        requiredForAudit: true,
        meaning: '剧本完成奖励配置',
        evidence: [FIELD_EVIDENCE.scenarioConfig],
        getValue: (row) => row.values.reward,
    },
    {
        key: 'sourcePath',
        valueKind: 'string-array',
        applicability: 'scenario',
        editable: false,
        requiredForAudit: true,
        meaning: '规则来源文档',
        evidence: [FIELD_EVIDENCE.hauntDocs],
        getValue: (row) => row.values.sourcePath,
    },
    {
        key: 'reviewStatus',
        valueKind: 'string',
        applicability: 'all',
        editable: false,
        requiredForAudit: true,
        meaning: '配置审查状态',
        evidence: [FIELD_EVIDENCE.scenarioConfig],
        getValue: (row) => row.values.reviewStatus,
    },
];

const FIELD_DEFINITION_BY_KEY = new Map(
    BETRAYAL_CONFIG_REVIEW_FIELD_DEFINITIONS.map((definition) => [definition.key, definition]),
);

export function getBetrayalConfigReviewFieldDefinition(
    fieldKey: BetrayalConfigReviewFieldKey,
): BetrayalConfigReviewFieldDefinition {
    const definition = FIELD_DEFINITION_BY_KEY.get(fieldKey);
    if (!definition) {
        throw new Error(`Unknown Betrayal config review field: ${fieldKey}`);
    }
    return definition;
}

export function getBetrayalConfigReviewCellValue(
    row: BetrayalConfigReviewRow,
    fieldKey: BetrayalConfigReviewFieldKey,
): unknown {
    return getBetrayalConfigReviewFieldDefinition(fieldKey).getValue(row);
}

export function isBetrayalConfigReviewFieldApplicable(
    row: BetrayalConfigReviewRow,
    fieldKey: BetrayalConfigReviewFieldKey,
): boolean {
    const applicability = getBetrayalConfigReviewFieldDefinition(fieldKey).applicability;
    if (applicability === 'all') return true;
    if (applicability === 'explorer') return row.objectType === 'explorer';
    if (applicability === 'room') return row.objectType === 'starting-room' || row.objectType === 'room-template';
    if (applicability === 'scenario') return row.objectType === 'scenario-card' || row.objectType === 'scenario-config';
    if (applicability === 'haunt') return row.objectType === 'scenario-card' || row.objectType === 'haunt-static';
    return false;
}

export function buildBetrayalConfigReviewTable(): BetrayalConfigReviewTable {
    const rows: BetrayalConfigReviewRow[] = [
        ...buildExplorerRows(),
        ...BETRAYAL_SHARED_PRE_HAUNT_SETUP.startingRoomLayout.map(buildStartingRoomRow),
        ...Object.entries(BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor).flatMap(([floor, rooms]) => (
            rooms.map((room) => buildRoomTemplateRow(floor as BetrayalRoomFloor, room))
        )),
        ...buildScenarioCardRows(),
        ...buildScenarioConfigRows(),
        ...buildHauntStaticRows(),
    ];

    return {
        tableId: BETRAYAL_CONFIG_REVIEW_TABLE_ID,
        gameId: 'betrayal',
        configVersion: BETRAYAL_CONFIG_REVIEW_VERSION,
        rows,
    };
}
