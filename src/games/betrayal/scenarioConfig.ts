export type BetrayalTraitKey = 'might' | 'speed' | 'knowledge' | 'sanity';
export type BetrayalInventoryKind = 'item' | 'omen';
export type BetrayalDeckKind = 'event' | 'item' | 'omen';
export type BetrayalRecommendedAction = 'move' | 'explore' | 'trade' | 'use' | 'endTurn';
export type BetrayalScenarioId = 'first-scenario';
export type BetrayalScenarioOutcome = 'survivors' | 'traitor';
export type BetrayalTraitorSelectionPolicy = 'last-explorer' | 'current-explorer';
export type BetrayalSurvivorSelectionPolicy = 'all-non-traitor' | 'current-explorer-only';
export type BetrayalRoomFloor = 'ground' | 'upper' | 'basement';
export type BetrayalRoomEdge = 'north' | 'east' | 'south' | 'west';
export type BetrayalRoomVisualId =
    | 'startTriple'
    | 'startHallway'
    | 'upperLanding'
    | 'basementLanding'
    | 'conservatory'
    | 'bedroom'
    | 'attic'
    | 'study'
    | 'gallery'
    | 'entranceHall'
    | 'diningRoom'
    | 'foyer'
    | 'ballroom'
    | 'chapel'
    | 'larder'
    | 'kitchen'
    | 'laboratory'
    | 'graveyard'
    | 'panicRoom'
    | 'undergroundCavern'
    | 'ritualRoom'
    | 'undergroundLake'
    | 'catacombs'
    | 'secretStaircase'
    | 'furnaceRoom'
    | 'winterBedroom'
    | 'guestQuarters'
    | 'bloodyRoom'
    | 'library'
    | 'collapsedRoom'
    | 'junkRoom'
    | 'specimenRoom'
    | 'charredRoom'
    | 'salon'
    | 'primaryBedroom'
    | 'organRoom'
    | 'soundproofedRoom'
    | 'nursery'
    | 'operatingTheatre'
    | 'crawlspace'
    | 'gameRoom'
    | 'gymnasium'
    | 'armory'
    | 'crampedPassageway'
    | 'mysticElevator'
    | 'backUpper'
    | 'backGround'
    | 'backBasement';

export interface BetrayalRoomDoorway {
    edge: BetrayalRoomEdge;
    connectsToRoomId?: string;
    leadsToFloor?: BetrayalRoomFloor;
    note?: string;
}

export interface BetrayalInventorySeed {
    id: string;
    name: string;
    kind: BetrayalInventoryKind;
}

export interface BetrayalExplorerCatalogEntry {
    explorerId: string;
    displayName: string;
    portraitAsset: string;
    tokenAsset?: string;
    color: string;
    traits: Record<BetrayalTraitKey, number>;
    abilityName: string;
    abilityText: string;
}

export interface BetrayalRoomSeed {
    id: string;
    name: string;
    floor: BetrayalRoomFloor;
    x: number;
    y: number;
    connectedRoomIds: string[];
    state: 'discovered' | 'unexplored';
    startingTile?: boolean;
    hint: string;
    tags: string[];
    discoveryReward: BetrayalDeckKind | null;
    visualId: BetrayalRoomVisualId;
    doorways: BetrayalRoomDoorway[];
    backVisualId: Extract<BetrayalRoomVisualId, 'backUpper' | 'backGround' | 'backBasement'>;
}

export interface BetrayalRoomDiscoveryTemplate {
    name: string;
    hint: string;
    tags: string[];
    visualId: Exclude<BetrayalRoomVisualId, 'startTriple' | 'upperLanding' | 'basementLanding' | 'entranceHall' | 'foyer' | 'backUpper' | 'backGround' | 'backBasement'>;
    doorways: BetrayalRoomEdge[];
}

export interface BetrayalUseEffectSeed {
    mode: 'move' | 'trait';
    amount: number;
    trait?: BetrayalTraitKey;
    recommendedAction: BetrayalRecommendedAction;
}

export interface BetrayalEventSeed {
    name: string;
    effect: BetrayalUseEffectSeed;
}

export interface BetrayalMonsterSeed {
    id: string;
    name: string;
    portraitAsset: string;
    tokenAsset?: string;
    roomId: string;
    might: number;
    speed: number;
    damage: number;
}

export interface BetrayalScenarioRuntimePreview {
    monsters: BetrayalMonsterSeed[];
}

export interface BetrayalScenarioCompletionConfig {
    minExploreCount: number;
    outcome: BetrayalScenarioOutcome;
    traitorSelection: BetrayalTraitorSelectionPolicy;
    survivorSelection: BetrayalSurvivorSelectionPolicy;
    reward: {
        stars: number;
        logs: number;
        minimumOmens: number;
    };
}

export interface BetrayalScenarioConfig {
    id: BetrayalScenarioId;
    title: string;
    scenarioCardLabel: 'NONE';
    hauntId: 'crimson-jack-returns';
    hauntTitle: string;
    hauntTriggerLabel: string;
    presentation: {
        referenceTitle: string;
        runtimeObjective: string;
        hauntObjective: string;
    };
    startingInventoryByExplorerId: Record<string, BetrayalInventorySeed[]>;
    logs: {
        scenarioStarted: string;
        hauntTriggered: string;
        scenarioCompleted: string;
    };
    runtimePreview?: BetrayalScenarioRuntimePreview;
    completion: BetrayalScenarioCompletionConfig;
}

export const BETRAYAL_EXPLORER_CATALOG: BetrayalExplorerCatalogEntry[] = [
    {
        explorerId: 'jaden-jones',
        displayName: '杰登·琼斯',
        portraitAsset: 'betrayal/explorers/jade-jones',
        tokenAsset: 'betrayal/tokens/explorers/jaden-jones',
        color: '#8cc63f',
        traits: { might: 4, speed: 3, knowledge: 4, sanity: 6 },
        abilityName: '大胆',
        abilityText: '攻击投掷 +1。',
    },
    {
        explorerId: 'rebecca-allen',
        displayName: '丽贝卡·艾伦博士',
        portraitAsset: 'betrayal/explorers/xia',
        tokenAsset: 'betrayal/tokens/explorers/rebecca-allen',
        color: '#3699d3',
        traits: { might: 4, speed: 3, knowledge: 4, sanity: 6 },
        abilityName: '冷静',
        abilityText: '第一次事件检定后可重投 1 颗骰。',
    },
    {
        explorerId: 'darryl-highla',
        displayName: '达里尔·海拉',
        portraitAsset: 'betrayal/explorers/anita-hernandez',
        tokenAsset: 'betrayal/tokens/explorers/darryl-highla',
        color: '#b45ca3',
        traits: { might: 3, speed: 4, knowledge: 3, sanity: 5 },
        abilityName: '敏锐',
        abilityText: '探索到事件房间时，知识 +1。',
    },
    {
        explorerId: 'oliver-swift',
        displayName: '奥利弗·斯威夫特',
        portraitAsset: 'betrayal/explorers/oliver-swift',
        color: '#d0603f',
        traits: { might: 4, speed: 3, knowledge: 2, sanity: 4 },
        abilityName: '谨慎',
        abilityText: '结束回合时若未探索，移动 +1。',
    },
    {
        explorerId: 'lia-valencia',
        displayName: '莉娅·瓦伦西亚',
        portraitAsset: 'betrayal/explorers/sera-nguyen',
        color: '#d0a23e',
        traits: { might: 4, speed: 3, knowledge: 4, sanity: 6 },
        abilityName: '专注',
        abilityText: '使用物品后可查看顶牌。',
    },
    {
        explorerId: 'sam-yin',
        displayName: '山姆·尹',
        portraitAsset: 'betrayal/explorers/father-warren-leung',
        tokenAsset: 'betrayal/tokens/explorers/father-warren-leung',
        color: '#719d4a',
        traits: { might: 4, speed: 3, knowledge: 4, sanity: 6 },
        abilityName: '守护',
        abilityText: '同房间队友受伤时可替其承受 1 点。',
    },
    {
        explorerId: 'michelle-monroe',
        displayName: '米歇尔·门罗',
        portraitAsset: 'betrayal/explorers/anita-hernandez',
        color: '#777777',
        traits: { might: 4, speed: 3, knowledge: 4, sanity: 6 },
        abilityName: '沉默',
        abilityText: '暂作首剧本叛徒占位。',
    },
];

export const BETRAYAL_SHARED_PRE_HAUNT_SETUP = {
    explorerStartTileId: 'entrance-hall',
    initialDeckCounts: {
        omen: 13,
        item: 15,
        event: 17,
    } satisfies Record<BetrayalDeckKind, number>,
    startingRoomLayout: [
        {
            id: 'upper-landing',
            name: '上层起始点',
            floor: 'upper',
            x: 2,
            y: 1,
            connectedRoomIds: ['grand-staircase', 'upper-west', 'upper-north'],
            state: 'discovered',
            startingTile: true,
            hint: '上层起始连接位',
            tags: ['起始', '上层'],
            discoveryReward: null,
            visualId: 'upperLanding',
            backVisualId: 'backUpper',
            doorways: [
                { edge: 'north', connectsToRoomId: 'upper-north' },
                { edge: 'west', connectsToRoomId: 'upper-west' },
                { edge: 'east', connectsToRoomId: 'grand-staircase', leadsToFloor: 'ground', note: '通向 Ground Floor Staircase' },
            ],
        },
        {
            id: 'upper-west',
            name: '未探索',
            floor: 'upper',
            x: 1,
            y: 1,
            connectedRoomIds: ['upper-landing'],
            state: 'unexplored',
            hint: '等待翻出上层房间',
            tags: ['待翻出'],
            discoveryReward: null,
            visualId: 'backUpper',
            backVisualId: 'backUpper',
            doorways: [
                { edge: 'east', connectsToRoomId: 'upper-landing' },
            ],
        },
        {
            id: 'upper-north',
            name: '未探索',
            floor: 'upper',
            x: 2,
            y: 0,
            connectedRoomIds: ['upper-landing'],
            state: 'unexplored',
            hint: '等待翻出上层房间',
            tags: ['待翻出'],
            discoveryReward: null,
            visualId: 'backUpper',
            backVisualId: 'backUpper',
            doorways: [
                { edge: 'south', connectsToRoomId: 'upper-landing' },
            ],
        },
        {
            id: 'grand-staircase',
            name: '大阶梯',
            floor: 'ground',
            x: 2,
            y: 2,
            connectedRoomIds: ['upper-landing', 'hallway', 'basement-landing'],
            state: 'discovered',
            startingTile: true,
            hint: '宅邸中央的楼梯间',
            tags: ['起始', '连接'],
            discoveryReward: null,
            visualId: 'startTriple',
            backVisualId: 'backGround',
            doorways: [
                { edge: 'north', connectsToRoomId: 'upper-landing', leadsToFloor: 'upper', note: '通向 Upper Landing' },
                { edge: 'east', connectsToRoomId: 'hallway' },
                { edge: 'south', connectsToRoomId: 'basement-landing', leadsToFloor: 'basement', note: '通向 Basement Landing' },
            ],
        },
        {
            id: 'hallway',
            name: '门厅',
            floor: 'ground',
            x: 3,
            y: 2,
            connectedRoomIds: ['grand-staircase', 'entrance-hall', 'ground-north', 'ground-south'],
            state: 'discovered',
            startingTile: true,
            hint: '连接前厅与楼梯的长廊',
            tags: ['起始', '走廊'],
            discoveryReward: null,
            visualId: 'startHallway',
            backVisualId: 'backGround',
            doorways: [
                { edge: 'west', connectsToRoomId: 'grand-staircase' },
                { edge: 'east', connectsToRoomId: 'entrance-hall' },
                { edge: 'north', connectsToRoomId: 'ground-north' },
                { edge: 'south', connectsToRoomId: 'ground-south' },
            ],
        },
        {
            id: 'entrance-hall',
            name: '入口大厅',
            floor: 'ground',
            x: 4,
            y: 2,
            connectedRoomIds: ['hallway', 'ground-east'],
            state: 'discovered',
            startingTile: true,
            hint: '进入宅邸后的起始入口',
            tags: ['起始', '入口'],
            discoveryReward: null,
            visualId: 'startTriple',
            backVisualId: 'backGround',
            doorways: [
                { edge: 'west', connectsToRoomId: 'hallway' },
                { edge: 'east', connectsToRoomId: 'ground-east' },
            ],
        },
        {
            id: 'ground-north',
            name: '未探索',
            floor: 'ground',
            x: 3,
            y: 1,
            connectedRoomIds: ['hallway'],
            state: 'unexplored',
            hint: '等待翻出一层房间',
            tags: ['待翻出'],
            discoveryReward: null,
            visualId: 'backGround',
            backVisualId: 'backGround',
            doorways: [
                { edge: 'south', connectsToRoomId: 'hallway' },
            ],
        },
        {
            id: 'ground-south',
            name: '未探索',
            floor: 'ground',
            x: 3,
            y: 3,
            connectedRoomIds: ['hallway'],
            state: 'unexplored',
            hint: '等待翻出一层房间',
            tags: ['待翻出'],
            discoveryReward: null,
            visualId: 'backGround',
            backVisualId: 'backGround',
            doorways: [
                { edge: 'north', connectsToRoomId: 'hallway' },
            ],
        },
        {
            id: 'ground-east',
            name: '未探索',
            floor: 'ground',
            x: 5,
            y: 2,
            connectedRoomIds: ['entrance-hall'],
            state: 'unexplored',
            hint: '等待翻出一层房间',
            tags: ['待翻出'],
            discoveryReward: null,
            visualId: 'backGround',
            backVisualId: 'backGround',
            doorways: [
                { edge: 'west', connectsToRoomId: 'entrance-hall' },
            ],
        },
        {
            id: 'basement-landing',
            name: '地下室起始点',
            floor: 'basement',
            x: 2,
            y: 3,
            connectedRoomIds: ['grand-staircase', 'basement-east', 'basement-south'],
            state: 'discovered',
            startingTile: true,
            hint: '地下入口，通向更深处',
            tags: ['起始', '地下'],
            discoveryReward: null,
            visualId: 'basementLanding',
            backVisualId: 'backBasement',
            doorways: [
                { edge: 'north', connectsToRoomId: 'grand-staircase', leadsToFloor: 'ground', note: '与 Ground Floor Staircase 特殊相邻' },
                { edge: 'east', connectsToRoomId: 'basement-east' },
                { edge: 'south', connectsToRoomId: 'basement-south' },
            ],
        },
        {
            id: 'basement-east',
            name: '未探索',
            floor: 'basement',
            x: 3,
            y: 3,
            connectedRoomIds: ['basement-landing'],
            state: 'unexplored',
            hint: '等待翻出地下房间',
            tags: ['待翻出'],
            discoveryReward: null,
            visualId: 'backBasement',
            backVisualId: 'backBasement',
            doorways: [
                { edge: 'west', connectsToRoomId: 'basement-landing' },
            ],
        },
        {
            id: 'basement-south',
            name: '未探索',
            floor: 'basement',
            x: 2,
            y: 4,
            connectedRoomIds: ['basement-landing'],
            state: 'unexplored',
            hint: '等待翻出地下房间',
            tags: ['待翻出'],
            discoveryReward: null,
            visualId: 'backBasement',
            backVisualId: 'backBasement',
            doorways: [
                { edge: 'north', connectsToRoomId: 'basement-landing' },
            ],
        },
    ] satisfies BetrayalRoomSeed[],
};

export const BETRAYAL_DISCOVERY_POOLS = {
    drawOrder: ['event', 'item', 'omen'] as BetrayalDeckKind[],
    possessions: {
        item: [
            { id: 'lockpick-tool', name: '撬锁工具', kind: 'item' },
            { id: 'hunting-knife', name: '狩猎短刀', kind: 'item' },
            { id: 'matches', name: '火柴盒', kind: 'item' },
            { id: 'manuscript', name: '旧手稿', kind: 'item' },
        ],
        omen: [
            { id: 'dog', name: '狗', kind: 'omen' },
            { id: 'skull', name: '头骨', kind: 'omen' },
            { id: 'holy-symbol', name: '圣符', kind: 'omen' },
            { id: 'armor', name: '盔甲', kind: 'omen' },
            { id: 'idol', name: '雕像', kind: 'omen' },
            { id: 'dagger', name: '匕首', kind: 'omen' },
        ],
    } satisfies Record<Exclude<BetrayalDeckKind, 'event'>, BetrayalInventorySeed[]>,
    roomDiscoveryByFloor: {
        ground: [
            {
                name: '舞厅',
                hint: '宽敞的一层房间，适合会合与周旋',
                tags: ['会合', '开阔'],
                visualId: 'ballroom',
                doorways: ['south', 'west'],
            },
            {
                name: '礼拜堂',
                hint: '冷清肃穆，像在等待一件不该发生的事',
                tags: ['神秘', '静压'],
                visualId: 'chapel',
                doorways: ['east', 'south'],
            },
        ],
        upper: [
            {
                name: '长廊',
                hint: '细长上层通道，容易观察别处动静',
                tags: ['视野', '走位'],
                visualId: 'gallery',
                doorways: ['north', 'south'],
            },
            {
                name: '图书馆',
                hint: '成排旧书和破纸页，是找知识的地方',
                tags: ['知识', '调查'],
                visualId: 'library',
                doorways: ['south', 'west'],
            },
        ],
        basement: [
            {
                name: '储物间',
                hint: '堆满旧箱和杂物，翻找起来最像物品点',
                tags: ['物资', '翻找'],
                visualId: 'larder',
                doorways: ['north', 'east'],
            },
            {
                name: '仪式室',
                hint: '看得出有人在这里做过不该做的准备',
                tags: ['仪式', '危险'],
                visualId: 'ritualRoom',
                doorways: ['west', 'south'],
            },
        ],
    } satisfies Record<BetrayalRoomSeed['floor'], BetrayalRoomDiscoveryTemplate[]>,
    events: [
        { name: '回廊顺风', effect: { mode: 'move', amount: 1, recommendedAction: 'move' } },
        { name: '窃窃低语', effect: { mode: 'trait', trait: 'sanity', amount: -1, recommendedAction: 'endTurn' } },
        { name: '旧日手记', effect: { mode: 'trait', trait: 'knowledge', amount: 1, recommendedAction: 'explore' } },
        { name: '滑落阶梯', effect: { mode: 'trait', trait: 'speed', amount: -1, recommendedAction: 'endTurn' } },
    ] satisfies BetrayalEventSeed[],
};

export const BETRAYAL_SCENARIO_CONFIGS: Record<BetrayalScenarioId, BetrayalScenarioConfig> = {
    'first-scenario': {
        id: 'first-scenario',
        title: '首剧本：Crimson Jack Returns',
        scenarioCardLabel: 'NONE',
        hauntId: 'crimson-jack-returns',
        hauntTitle: 'Crimson Jack Returns',
        hauntTriggerLabel: 'A Splash of Crimson',
        presentation: {
            referenceTitle: '首剧本查阅',
            runtimeObjective: '恶兆前探索',
            hauntObjective: '击倒叛徒，释放并驱魔杰克之灵',
        },
        startingInventoryByExplorerId: {
            'jaden-jones': [
                { id: 'rope', name: '绳索', kind: 'item' },
                { id: 'flashlight', name: '手电筒', kind: 'item' },
                { id: 'omen-book', name: '预兆书', kind: 'omen' },
            ],
            'rebecca-allen': [
                { id: 'rope', name: '绳索', kind: 'item' },
                { id: 'notebook', name: '调查笔记', kind: 'item' },
                { id: 'ring', name: '古戒', kind: 'omen' },
            ],
            'darryl-highla': [
                { id: 'medical-kit', name: '急救包', kind: 'item' },
                { id: 'camera', name: '相机', kind: 'item' },
                { id: 'mask', name: '骨面具', kind: 'omen' },
            ],
            'oliver-swift': [
                { id: 'map', name: '折叠地图', kind: 'item' },
                { id: 'lantern', name: '提灯', kind: 'item' },
                { id: 'holy-symbol', name: '圣符', kind: 'omen' },
            ],
            'lia-valencia': [
                { id: 'journal', name: '日志', kind: 'item' },
                { id: 'radio', name: '短波机', kind: 'item' },
                { id: 'skull', name: '头骨', kind: 'omen' },
            ],
            'sam-yin': [
                { id: 'holy-water', name: '圣水', kind: 'item' },
                { id: 'cross', name: '十字架', kind: 'item' },
                { id: 'idol', name: '雕像', kind: 'omen' },
            ],
            'michelle-monroe': [
                { id: 'lockpick-tool', name: '撬锁工具', kind: 'item' },
                { id: 'matches', name: '火柴盒', kind: 'item' },
                { id: 'dagger', name: '匕首', kind: 'omen' },
            ],
        },
        logs: {
            scenarioStarted: '首剧本开始：恶兆前探索',
            hauntTriggered: '首剧本触发：Crimson Jack Returns',
            scenarioCompleted: '首剧本完成：杰克之灵被驱散',
        },
        runtimePreview: {
            monsters: [
                {
                    id: 'werewolf',
                    name: '狼人',
                    portraitAsset: 'betrayal/monsters/werewolf',
                    tokenAsset: 'betrayal/tokens/monsters/werewolf',
                    roomId: 'grand-staircase',
                    might: 5,
                    speed: 4,
                    damage: 2,
                },
                {
                    id: 'spirit',
                    name: '幽灵',
                    portraitAsset: 'betrayal/monsters/spirit',
                    tokenAsset: 'betrayal/tokens/monsters/ghost',
                    roomId: 'upper-landing',
                    might: 4,
                    speed: 5,
                    damage: 1,
                },
            ],
        },
        completion: {
            minExploreCount: 999,
            outcome: 'survivors',
            traitorSelection: 'current-explorer',
            survivorSelection: 'all-non-traitor',
            reward: {
                stars: 4,
                logs: 1,
                minimumOmens: 1,
            },
        },
    },
};

export const DEFAULT_BETRAYAL_SCENARIO_ID: BetrayalScenarioId = 'first-scenario';
