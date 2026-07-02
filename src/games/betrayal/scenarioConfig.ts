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
    | 'observatory'
    | 'tower'
    | 'statuaryCorridor'
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
    | 'laundryChute'
    | 'vault'
    | 'chasm'
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
    entryRoomId?: string;
    entryEdge?: BetrayalRoomEdge;
    orientationTurns?: 0 | 1 | 2 | 3;
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
    visualId: Exclude<BetrayalRoomVisualId, 'startTriple' | 'startHallway' | 'upperLanding' | 'basementLanding' | 'entranceHall' | 'foyer' | 'backUpper' | 'backGround' | 'backBasement'>;
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
        omen: 9,
        item: 11,
        event: 8,
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
            { id: 'camera', name: '相机', kind: 'item' },
            { id: 'medical-kit', name: '急救包', kind: 'item' },
            { id: 'holy-water', name: '圣水', kind: 'item' },
            { id: 'flashlight', name: '手电筒', kind: 'item' },
            { id: 'radio', name: '短波机', kind: 'item' },
            { id: 'map', name: '折叠地图', kind: 'item' },
            { id: 'rope', name: '绳索', kind: 'item' },
            { id: 'lockpick-tool', name: '撬锁工具', kind: 'item' },
            { id: 'hunting-knife', name: '狩猎短刀', kind: 'item' },
            { id: 'notebook', name: '调查笔记', kind: 'item' },
            { id: 'manuscript', name: '旧手稿', kind: 'item' },
        ],
        omen: [
            { id: 'omen-book', name: '预兆书', kind: 'omen' },
            { id: 'dog', name: '狗', kind: 'omen' },
            { id: 'mask', name: '面具', kind: 'omen' },
            { id: 'skull', name: '头骨', kind: 'omen' },
            { id: 'holy-symbol', name: '圣符', kind: 'omen' },
            { id: 'armor', name: '盔甲', kind: 'omen' },
            { id: 'idol', name: '雕像', kind: 'omen' },
            { id: 'ring', name: '指环', kind: 'omen' },
            { id: 'dagger', name: '匕首', kind: 'omen' },
        ],
    } satisfies Record<Exclude<BetrayalDeckKind, 'event'>, BetrayalInventorySeed[]>,
    roomDiscoveryByFloor: {
        ground: [
            {
                name: '观测台',
                hint: '一层观测房间，中央器械让视线与路线都更紧张',
                tags: ['一层', '观察'],
                visualId: 'observatory',
                doorways: ['north', 'east', 'south', 'west'],
            },
            {
                name: '温室',
                hint: '玻璃与藤蔓围住的一层房间，适合制造视线遮挡',
                tags: ['一层', '植物'],
                visualId: 'conservatory',
                doorways: ['east', 'south'],
            },
            {
                name: '墓园',
                hint: '通向地下洞窟的室外墓地，适合承接追逐与怪物线',
                tags: ['一层', '室外'],
                visualId: 'graveyard',
                doorways: ['east', 'south'],
            },
            {
                name: '舞厅',
                hint: '宽敞的一层房间，适合会合与周旋',
                tags: ['会合', '开阔'],
                visualId: 'ballroom',
                doorways: ['south', 'west'],
            },
            {
                name: '厨房',
                hint: '食物和器具堆在一层，是事件与物品都可能发生的房间',
                tags: ['一层', '物资'],
                visualId: 'kitchen',
                doorways: ['east', 'south', 'west'],
            },
            {
                name: '餐厅',
                hint: '长桌和阴影形成一层交汇点',
                tags: ['一层', '会合'],
                visualId: 'diningRoom',
                doorways: ['north', 'west'],
            },
            {
                name: '礼拜堂',
                hint: '冷清肃穆，像在等待一件不该发生的事',
                tags: ['神秘', '静压'],
                visualId: 'chapel',
                doorways: ['east', 'south'],
            },
            {
                name: '实验室',
                hint: '仪器和试剂暗示这里会触发危险事件',
                tags: ['一层', '危险'],
                visualId: 'laboratory',
                doorways: ['north', 'east'],
            },
            {
                name: '金库',
                hint: '一层封闭房间，适合放置剧本物件和高价值目标',
                tags: ['一层', '目标'],
                visualId: 'vault',
                doorways: ['north', 'east'],
            },
            {
                name: '火炉房',
                hint: '炙热房间会改变移动与伤害判断',
                tags: ['一层', '危险'],
                visualId: 'furnaceRoom',
                doorways: ['east', 'south', 'west'],
            },
            {
                name: '客房',
                hint: '卧室类房间，后续剧本可作为特定目标房间',
                tags: ['一层', '上层', '卧室'],
                visualId: 'guestQuarters',
                doorways: ['east', 'south'],
            },
            {
                name: '血腥房间',
                hint: '血迹房间适合承接死亡、搜查和剧本标记',
                tags: ['一层', '上层', '危险'],
                visualId: 'bloodyRoom',
                doorways: ['north', 'east'],
            },
            {
                name: '标本室',
                hint: '标本和柜架让这里适合触发异常事件',
                tags: ['一层', '事件'],
                visualId: 'specimenRoom',
                doorways: ['north', 'east', 'south'],
            },
            {
                name: '沙龙',
                hint: '桌椅和壁炉形成可会合的房间',
                tags: ['一层', '会合'],
                visualId: 'salon',
                doorways: ['north', 'east', 'south'],
            },
            {
                name: '主卧',
                hint: '卧室类核心房间，适合后续剧本定位',
                tags: ['一层', '上层', '卧室'],
                visualId: 'primaryBedroom',
                doorways: ['north', 'east', 'south'],
            },
            {
                name: '育婴室',
                hint: '狭窄房间，适合触发事件和剧本特殊物件',
                tags: ['一层', '上层', '事件'],
                visualId: 'nursery',
                doorways: ['north', 'east', 'south'],
            },
            {
                name: '手术室',
                hint: '危险的治疗房间，适合承接身体伤害事件',
                tags: ['一层', '地下', '危险'],
                visualId: 'operatingTheatre',
                doorways: ['north', 'east', 'south'],
            },
            {
                name: '器械库',
                hint: '武器与道具集中，适合物品奖励',
                tags: ['一层', '物品'],
                visualId: 'armory',
                doorways: ['north', 'east', 'south'],
            },
        ],
        upper: [
            {
                name: '塔楼',
                hint: '上层塔楼，边缘路线和高度感会影响移动判断',
                tags: ['上层', '高处'],
                visualId: 'tower',
                doorways: ['south', 'west'],
            },
            {
                name: '雕像走廊',
                hint: '上层走廊，适合连接多个房间',
                tags: ['上层', '走廊'],
                visualId: 'statuaryCorridor',
                doorways: ['north', 'east', 'south'],
            },
            {
                name: '阁楼',
                hint: '狭窄昏暗，像是能翻出旧物的上层房间',
                tags: ['上层', '杂物'],
                visualId: 'attic',
                doorways: ['south', 'west'],
            },
            {
                name: '书房',
                hint: '书桌和卷宗让这里成为调查线索的房间',
                tags: ['知识', '调查'],
                visualId: 'study',
                doorways: ['north', 'east'],
            },
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
            {
                name: '冬季卧室',
                hint: '卧室类上层房间，后续剧本可作为目标地点',
                tags: ['上层', '卧室'],
                visualId: 'winterBedroom',
                doorways: ['east', 'south'],
            },
            {
                name: '倒塌房间',
                hint: '结构破损会影响离开与坠落判断',
                tags: ['上层', '危险'],
                visualId: 'collapsedRoom',
                doorways: ['north', 'south'],
            },
            {
                name: '烧焦房间',
                hint: '火焰痕迹明确，适合承接火焰类剧本规则',
                tags: ['上层', '危险'],
                visualId: 'charredRoom',
                doorways: ['north', 'east'],
            },
            {
                name: '管风琴室',
                hint: '上层仪式感房间，适合声音与精神事件',
                tags: ['上层', '精神'],
                visualId: 'organRoom',
                doorways: ['north', 'east', 'south'],
            },
            {
                name: '隔音室',
                hint: '封闭空间，适合特殊事件和阻隔效果',
                tags: ['上层', '封闭'],
                visualId: 'soundproofedRoom',
                doorways: ['north', 'east', 'south'],
            },
            {
                name: '游戏室',
                hint: '娱乐桌面房间，适合物品和事件交汇',
                tags: ['上层', '事件'],
                visualId: 'gameRoom',
                doorways: ['north', 'east', 'south'],
            },
            {
                name: '体育馆',
                hint: '开阔空间，适合速度与力量检定',
                tags: ['上层', '力量'],
                visualId: 'gymnasium',
                doorways: ['north', 'east', 'south'],
            },
            {
                name: '狭窄通道',
                hint: '通道型房间，主要承担路线连接',
                tags: ['上层', '通道'],
                visualId: 'crampedPassageway',
                doorways: ['north', 'east', 'south', 'west'],
            },
            {
                name: '神秘电梯',
                hint: '可连接任意楼层的特殊移动房间',
                tags: ['上层', '地下', '特殊移动'],
                visualId: 'mysticElevator',
                doorways: ['north', 'east', 'south', 'west'],
            },
        ],
        basement: [
            {
                name: '洗衣滑槽',
                hint: '通向地下室起始点的特殊竖向连接',
                tags: ['上层', '地下', '特殊移动'],
                visualId: 'laundryChute',
                doorways: ['north', 'east'],
            },
            {
                name: '裂隙',
                hint: '地下危险地形，后续剧本可能要求丢弃或搬运物体',
                tags: ['地下', '危险'],
                visualId: 'chasm',
                doorways: ['north', 'south'],
            },
            {
                name: '储物间',
                hint: '堆满旧箱和杂物，翻找起来最像物品点',
                tags: ['物资', '翻找'],
                visualId: 'larder',
                doorways: ['north', 'east'],
            },
            {
                name: '地下湖',
                hint: '黑水切开地下空间，移动时必须考虑绕行',
                tags: ['地下', '水域'],
                visualId: 'undergroundLake',
                doorways: ['north', 'west'],
            },
            {
                name: '地下洞窟',
                hint: '粗糙岩壁和阴影让这里更像怪物出没处',
                tags: ['地下', '危险'],
                visualId: 'undergroundCavern',
                doorways: ['east', 'south'],
            },
            {
                name: '仪式室',
                hint: '看得出有人在这里做过不该做的准备',
                tags: ['仪式', '危险'],
                visualId: 'ritualRoom',
                doorways: ['west', 'south'],
            },
            {
                name: '地下墓穴',
                hint: '狭长墓道适合让追逐和围堵成立',
                tags: ['地下', '墓穴'],
                visualId: 'catacombs',
                doorways: ['north', 'south'],
            },
            {
                name: '密道楼梯',
                hint: '地下到一层的特殊连接房间',
                tags: ['地下', '特殊移动'],
                visualId: 'secretStaircase',
                doorways: ['north', 'east'],
            },
            {
                name: '杂物间',
                hint: '地下杂物房，适合放置障碍或物件',
                tags: ['地下', '物品'],
                visualId: 'junkRoom',
                doorways: ['north', 'east'],
            },
            {
                name: '爬行空间',
                hint: '狭窄地下通路，适合限制移动',
                tags: ['地下', '通道'],
                visualId: 'crawlspace',
                doorways: ['north', 'east'],
            },
        ],
    } satisfies Record<BetrayalRoomSeed['floor'], BetrayalRoomDiscoveryTemplate[]>,
    events: [
        { name: '回廊顺风', effect: { mode: 'move', amount: 1, recommendedAction: 'move' } },
        { name: '窃窃低语', effect: { mode: 'trait', trait: 'sanity', amount: -1, recommendedAction: 'endTurn' } },
        { name: '旧日手记', effect: { mode: 'trait', trait: 'knowledge', amount: 1, recommendedAction: 'explore' } },
        { name: '滑落阶梯', effect: { mode: 'trait', trait: 'speed', amount: -1, recommendedAction: 'endTurn' } },
        { name: '墙中低语', effect: { mode: 'trait', trait: 'knowledge', amount: -1, recommendedAction: 'endTurn' } },
        { name: '冷风指路', effect: { mode: 'move', amount: 1, recommendedAction: 'explore' } },
        { name: '阴影扑面', effect: { mode: 'trait', trait: 'might', amount: -1, recommendedAction: 'endTurn' } },
        { name: '残留祝福', effect: { mode: 'trait', trait: 'sanity', amount: 1, recommendedAction: 'explore' } },
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
                { id: 'flashlight', name: '手电筒', kind: 'item' },
                { id: 'idol', name: '雕像', kind: 'omen' },
            ],
            'michelle-monroe': [
                { id: 'lockpick-tool', name: '撬锁工具', kind: 'item' },
                { id: 'lantern', name: '提灯', kind: 'item' },
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
