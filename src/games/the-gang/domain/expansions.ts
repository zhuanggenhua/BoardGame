import type {
    PlayingCard,
    Rank,
    TheGangChallengeId,
    TheGangExitChipMode,
    TheGangGameMode,
    TheGangRulesConfig,
    TheGangSpecialistId,
    TheGangToolId,
} from './types';

export interface TheGangGameModeRule {
    id: TheGangGameMode;
    label: string;
    handCards: number;
    pocketCards: number;
    flopCards: number;
    turnCards: number;
    riverCards: number;
    perGap?: boolean;
    perPlayer?: boolean;
    incompatibleChallenges: readonly TheGangChallengeId[];
}

export interface TheGangExitChipModeRule {
    id: TheGangExitChipMode;
    label: string;
    reduction: number;
    summary: string;
}

export interface TheGangChallengeRule {
    id: TheGangChallengeId;
    ttsId: string;
    label: string;
    module: 'core' | 'poker' | 'setup' | 'tools' | 'specialists' | 'vault';
    stackable?: boolean;
    maxCount?: number;
    runtimeStatus: 'implemented' | 'documented';
    summary: string;
}

export interface TheGangToolRule {
    id: TheGangToolId;
    label: string;
    count: number;
    runtimeStatus: 'implemented' | 'draw-only';
    summary: string;
}

export interface TheGangSpecialistRule {
    id: TheGangSpecialistId;
    label: string;
    runtimeStatus: 'draw-only';
    summary: string;
}

export const DEFAULT_THE_GANG_RULES_CONFIG: TheGangRulesConfig = {
    gameMode: 'texas-holdem',
    exitChipMode: 'default',
    omaha: false,
    twoHand: false,
    handSwap: false,
    automode: false,
    antiTroll: false,
    challenges: {},
};

export const THE_GANG_GAME_MODES: Record<TheGangGameMode, TheGangGameModeRule> = {
    'texas-holdem': {
        id: 'texas-holdem',
        label: '德州扑克',
        handCards: 2,
        pocketCards: 0,
        flopCards: 3,
        turnCards: 1,
        riverCards: 1,
        incompatibleChallenges: [],
    },
    'seven-card-stud': {
        id: 'seven-card-stud',
        label: '七张梭哈',
        handCards: 3,
        pocketCards: 1,
        flopCards: 1,
        turnCards: 1,
        riverCards: 1,
        perPlayer: true,
        incompatibleChallenges: [
            'uninvited-guest',
            'lengthy-finish',
            'rough-kickoff',
            'foot-door',
            'reverse-run',
        ],
    },
    'banana-split': {
        id: 'banana-split',
        label: '香蕉分牌',
        handCards: 2,
        pocketCards: 0,
        flopCards: 1,
        turnCards: 1,
        riverCards: 1,
        perGap: true,
        perPlayer: true,
        incompatibleChallenges: [
            'uninvited-guest',
            'lengthy-finish',
            'rough-kickoff',
            'foot-door',
            'reverse-run',
        ],
    },
};

export const THE_GANG_EXIT_CHIP_MODES: Record<TheGangExitChipMode, TheGangExitChipModeRule> = {
    default: {
        id: 'default',
        label: '普通',
        reduction: 0,
        summary: '按 TTS 默认撤离筹码数量启用。',
    },
    mastermind: {
        id: 'mastermind',
        label: '智囊',
        reduction: 1,
        summary: '撤离筹码数量比默认少 1。',
    },
    'mega-mastermind': {
        id: 'mega-mastermind',
        label: '超级智囊',
        reduction: 2,
        summary: '撤离筹码数量比默认少 2。',
    },
    'ultra-mastermind': {
        id: 'ultra-mastermind',
        label: '终极智囊',
        reduction: 3,
        summary: '撤离筹码数量降到 0。',
    },
};

export const THE_GANG_CHALLENGES: Record<TheGangChallengeId, TheGangChallengeRule> = {
    'quick-access': {
        id: 'quick-access',
        ttsId: '1',
        label: '快速通道',
        module: 'core',
        runtimeStatus: 'implemented',
        summary: '跳过第二轮筹码阶段。',
    },
    'noise-sensor': {
        id: 'noise-sensor',
        ttsId: '2',
        label: '声音传感器',
        module: 'setup',
        runtimeStatus: 'implemented',
        summary: '翻出一张额外公共牌后弃掉最低牌。',
    },
    'motion-detector': {
        id: 'motion-detector',
        ttsId: '3',
        label: '运动探测器',
        module: 'setup',
        runtimeStatus: 'implemented',
        summary: '第二轮额外翻牌并弃掉最低牌。',
    },
    'retina-scan': {
        id: 'retina-scan',
        ttsId: '4',
        label: '视网膜扫描',
        module: 'core',
        runtimeStatus: 'implemented',
        summary: 'TTS 中是点数提醒 UI；本实现将其作为牌桌短状态提示接入。',
    },
    'hasty-getaway': {
        id: 'hasty-getaway',
        ttsId: '5',
        label: '匆忙逃离',
        module: 'core',
        runtimeStatus: 'implemented',
        summary: '跳过第三轮筹码阶段。',
    },
    'ventilation-shaft': {
        id: 'ventilation-shaft',
        ttsId: '6',
        label: '通风管道',
        module: 'setup',
        runtimeStatus: 'implemented',
        summary: '最后一轮额外翻牌并弃掉前面牌，等价为只保留最后一张。',
    },
    'laser-tripwires': {
        id: 'laser-tripwires',
        ttsId: '7',
        label: '激光绊线',
        module: 'setup',
        runtimeStatus: 'implemented',
        summary: '第二轮额外翻牌并弃掉最高牌。',
    },
    blackout: {
        id: 'blackout',
        ttsId: '8',
        label: '断电',
        module: 'core',
        runtimeStatus: 'implemented',
        summary: 'TTS 中影响桌面提示与可见信息；本实现将其作为牌桌短状态提示接入。',
    },
    'fingerprint-scan': {
        id: 'fingerprint-scan',
        ttsId: '9',
        label: '指纹扫描',
        module: 'core',
        runtimeStatus: 'implemented',
        summary: 'TTS 中是牌型提醒 UI；本实现将其作为牌桌短状态提示接入。',
    },
    'security-camera': {
        id: 'security-camera',
        ttsId: '10',
        label: '安保摄像头',
        module: 'setup',
        runtimeStatus: 'implemented',
        summary: '每名玩家多发一张手牌。',
    },
    'the-joker': {
        id: 'the-joker',
        ttsId: '11',
        label: '替换鬼牌',
        module: 'poker',
        stackable: true,
        runtimeStatus: 'implemented',
        summary: '向牌堆加入替换鬼牌；鬼牌可帮助组成五条。',
    },
    'uninvited-guest': {
        id: 'uninvited-guest',
        ttsId: '12',
        label: '不速之客',
        module: 'setup',
        stackable: true,
        maxCount: 2,
        runtimeStatus: 'implemented',
        summary: '转牌阶段额外加牌，最多叠 2 次。',
    },
    'reverse-run': {
        id: 'reverse-run',
        ttsId: '13',
        label: '迂回',
        module: 'setup',
        runtimeStatus: 'implemented',
        summary: '公共牌顺序反转为先 1 张、最后 3 张。',
    },
    'master-key': {
        id: 'master-key',
        ttsId: '14',
        label: '万能钥匙',
        module: 'poker',
        stackable: true,
        runtimeStatus: 'implemented',
        summary: '向牌堆加入万能牌；万能牌可补组、顺子和同花。',
    },
    balance: {
        id: 'balance',
        ttsId: '15',
        label: '平账',
        module: 'setup',
        runtimeStatus: 'implemented',
        summary: '起手少发一张手牌，第二轮再给每名玩家补一张手牌。',
    },
    'quick-execution': {
        id: 'quick-execution',
        ttsId: '30',
        label: '迅速执行',
        module: 'core',
        runtimeStatus: 'implemented',
        summary: '跳过第二轮筹码阶段。',
    },
    'lengthy-finish': {
        id: 'lengthy-finish',
        ttsId: '31',
        label: '漫长收尾',
        module: 'setup',
        stackable: true,
        maxCount: 2,
        runtimeStatus: 'implemented',
        summary: '河牌阶段额外加牌，最多叠 2 次。',
    },
    'rough-kickoff': {
        id: 'rough-kickoff',
        ttsId: '32',
        label: '粗暴开场',
        module: 'setup',
        stackable: true,
        maxCount: 2,
        runtimeStatus: 'implemented',
        summary: '翻牌阶段额外加牌，最多叠 2 次。',
    },
    'quantum-chaos': {
        id: 'quantum-chaos',
        ttsId: '33',
        label: '量子混沌',
        module: 'poker',
        runtimeStatus: 'implemented',
        summary: '牌面点数强弱反向。',
    },
    'no-color': {
        id: 'no-color',
        ttsId: '34',
        label: '不分肤色',
        module: 'poker',
        runtimeStatus: 'implemented',
        summary: '禁用同花、同花顺和皇家同花顺。',
    },
    'all-out-attack': {
        id: 'all-out-attack',
        ttsId: '35',
        label: '倾巢出动',
        module: 'poker',
        runtimeStatus: 'implemented',
        summary: '万能牌至少按不低于手牌最高值参与。',
    },
    'sleeping-guard': {
        id: 'sleeping-guard',
        ttsId: '36',
        label: '瞌睡看守',
        module: 'poker',
        runtimeStatus: 'implemented',
        summary: '万能牌至多按不高于手牌最低值参与。',
    },
    'intricate-lock': {
        id: 'intricate-lock',
        ttsId: '37',
        label: '复合锁',
        module: 'poker',
        runtimeStatus: 'implemented',
        summary: '配置中可锁定指定牌型，已锁牌型不会成为最佳结果。',
    },
    'cluttered-toolbox': {
        id: 'cluttered-toolbox',
        ttsId: '38',
        label: '杂乱工具箱',
        module: 'poker',
        runtimeStatus: 'implemented',
        summary: '加入空白牌，并让一个点数在本次抢劫中失效。',
    },
    'foot-door': {
        id: 'foot-door',
        ttsId: '39',
        label: '入门',
        module: 'setup',
        stackable: true,
        maxCount: 2,
        runtimeStatus: 'implemented',
        summary: '增加前置公共牌/个人公共牌，最多叠 2 次。',
    },
    'extra-hours': {
        id: 'extra-hours',
        ttsId: '40',
        label: '加班',
        module: 'poker',
        runtimeStatus: 'implemented',
        summary: '加入 B/C/D 扩展点数。',
    },
    'grinding-gears': {
        id: 'grinding-gears',
        ttsId: '41',
        label: '粉碎齿轮',
        module: 'poker',
        runtimeStatus: 'implemented',
        summary: '加入第五花色齿轮，并启用五花、五花顺牌型。',
    },
};

export const THE_GANG_TOOLS: Record<TheGangToolId, TheGangToolRule> = {
    airpods: {
        id: 'airpods',
        label: 'Airpods',
        count: 1,
        runtimeStatus: 'draw-only',
        summary: 'TTS 工具牌堆对象；Lua 中未绑定专属脚本效果。',
    },
    'backdoor-key': {
        id: 'backdoor-key',
        label: 'Backdoor Key',
        count: 1,
        runtimeStatus: 'draw-only',
        summary: 'TTS 工具牌堆对象；Lua 中未绑定专属脚本效果。',
    },
    'burner-phone': {
        id: 'burner-phone',
        label: '一次性手机',
        count: 3,
        runtimeStatus: 'implemented',
        summary: '使用后弃掉本工具，并从专家牌堆抽 2 张专家牌。',
    },
    crowbar: {
        id: 'crowbar',
        label: 'Crowbar',
        count: 1,
        runtimeStatus: 'draw-only',
        summary: 'TTS 工具牌堆对象；Lua 中未绑定专属脚本效果。',
    },
    flashlight: {
        id: 'flashlight',
        label: '手电筒',
        count: 1,
        runtimeStatus: 'implemented',
        summary: '激活后从牌堆翻出 1 张非 Joker 牌，作为额外可见评估牌。',
    },
    'jamming-device': {
        id: 'jamming-device',
        label: 'Jamming Device',
        count: 1,
        runtimeStatus: 'draw-only',
        summary: 'TTS 工具牌堆对象；原始名称拼作 Jamming Devise，Lua 中未绑定专属脚本效果。',
    },
    'lock-pick': {
        id: 'lock-pick',
        label: 'Lock Pick',
        count: 1,
        runtimeStatus: 'draw-only',
        summary: 'TTS 工具牌堆对象；Lua 中未绑定专属脚本效果。',
    },
    lubricant: {
        id: 'lubricant',
        label: '润滑剂',
        count: 1,
        runtimeStatus: 'implemented',
        summary: '进入工具区后公开并锁定，本实现记录为已公开激活工具。',
    },
    'night-vision-goggles': {
        id: 'night-vision-goggles',
        label: '夜视眼镜',
        count: 1,
        runtimeStatus: 'implemented',
        summary: '激活后选择 1 张手牌放到夜视眼镜上，该牌仍计入手牌评估。',
    },
    'smoke-grenade': {
        id: 'smoke-grenade',
        label: 'Smoke Grenade',
        count: 1,
        runtimeStatus: 'draw-only',
        summary: 'TTS 工具牌堆对象；Lua 中未绑定专属脚本效果。',
    },
};

export const THE_GANG_SPECIALISTS: Record<TheGangSpecialistId, TheGangSpecialistRule> = {
    'con-artist': {
        id: 'con-artist',
        label: 'Con Artist',
        runtimeStatus: 'draw-only',
        summary: '专家牌堆对象；TTS Lua 当前只实现抽取与重置，没有单张专家效果脚本。',
    },
    coordinator: {
        id: 'coordinator',
        label: 'Coordinator',
        runtimeStatus: 'draw-only',
        summary: '专家牌堆对象；TTS Lua 当前只实现抽取与重置，没有单张专家效果脚本。',
    },
    'getaway-driver': {
        id: 'getaway-driver',
        label: 'Getaway Driver',
        runtimeStatus: 'draw-only',
        summary: '专家牌堆对象；TTS Lua 当前只实现抽取与重置，没有单张专家效果脚本。',
    },
    hacker: {
        id: 'hacker',
        label: 'Hacker',
        runtimeStatus: 'draw-only',
        summary: '专家牌堆对象；TTS Lua 当前只实现抽取与重置，没有单张专家效果脚本。',
    },
    information: {
        id: 'information',
        label: 'Information',
        runtimeStatus: 'draw-only',
        summary: '专家牌堆对象；TTS Lua 当前只实现抽取与重置，没有单张专家效果脚本。',
    },
    investor: {
        id: 'investor',
        label: 'Investor',
        runtimeStatus: 'draw-only',
        summary: '专家牌堆对象；TTS Lua 当前只实现抽取与重置，没有单张专家效果脚本。',
    },
    jack: {
        id: 'jack',
        label: 'Jack',
        runtimeStatus: 'draw-only',
        summary: '专家牌堆对象；TTS Lua 当前只实现抽取与重置，没有单张专家效果脚本。',
    },
    mastermind: {
        id: 'mastermind',
        label: 'Mastermind',
        runtimeStatus: 'draw-only',
        summary: '专家牌堆对象；TTS Lua 当前只实现抽取与重置，没有单张专家效果脚本。',
    },
    'math-wiz': {
        id: 'math-wiz',
        label: 'Math Wiz',
        runtimeStatus: 'draw-only',
        summary: '专家牌堆对象；TTS Lua 当前只实现抽取与重置，没有单张专家效果脚本。',
    },
    muscle: {
        id: 'muscle',
        label: 'Muscle',
        runtimeStatus: 'draw-only',
        summary: '专家牌堆对象；TTS Lua 当前只实现抽取与重置，没有单张专家效果脚本。',
    },
};

const allChallengeIds = Object.keys(THE_GANG_CHALLENGES) as TheGangChallengeId[];

export function normalizeRulesConfig(config?: Partial<TheGangRulesConfig>): TheGangRulesConfig {
    const gameMode = config?.gameMode && THE_GANG_GAME_MODES[config.gameMode]
        ? config.gameMode
        : DEFAULT_THE_GANG_RULES_CONFIG.gameMode;
    const exitChipMode = config?.exitChipMode && THE_GANG_EXIT_CHIP_MODES[config.exitChipMode]
        ? config.exitChipMode
        : DEFAULT_THE_GANG_RULES_CONFIG.exitChipMode;
    const mode = THE_GANG_GAME_MODES[gameMode];
    const challenges: Partial<Record<TheGangChallengeId, number>> = {};

    for (const challengeId of allChallengeIds) {
        const rawCount = config?.challenges?.[challengeId] ?? 0;
        const rule = THE_GANG_CHALLENGES[challengeId];
        const integerCount = Number.isFinite(rawCount) ? Math.max(0, Math.floor(rawCount)) : 0;
        const cappedCount = rule.stackable
            ? Math.min(integerCount, rule.maxCount ?? integerCount)
            : Math.min(integerCount, 1);
        if (cappedCount > 0 && !mode.incompatibleChallenges.includes(challengeId)) {
            challenges[challengeId] = cappedCount;
        }
    }

    const twoHand = gameMode === 'texas-holdem' && config?.twoHand === true;

    return {
        gameMode,
        exitChipMode,
        omaha: config?.omaha === true,
        twoHand,
        handSwap: twoHand,
        automode: config?.automode === true,
        antiTroll: config?.antiTroll === true,
        challenges,
        lockedHandRanks: config?.lockedHandRanks ? [...config.lockedHandRanks] : [],
    };
}

export function getChallengeCount(
    config: TheGangRulesConfig,
    challengeId: TheGangChallengeId,
): number {
    return config.challenges[challengeId] ?? 0;
}

export function isChallengeActive(
    config: TheGangRulesConfig,
    challengeId: TheGangChallengeId,
): boolean {
    return getChallengeCount(config, challengeId) > 0;
}

export function getActiveChallengeLabels(config: TheGangRulesConfig): string[] {
    return allChallengeIds
        .filter((challengeId) => isChallengeActive(config, challengeId))
        .map((challengeId) => THE_GANG_CHALLENGES[challengeId].label);
}

export interface TheGangDealPlan {
    handCards: number;
    pocketCards: number;
    roundDraws: Record<1 | 2 | 3, number>;
    skippedRounds: readonly number[];
    perPlayerCommunity: boolean;
    perGap: boolean;
}

const DEAL_AFFECTING_CHALLENGES: readonly TheGangChallengeId[] = [
    'noise-sensor',
    'motion-detector',
    'ventilation-shaft',
    'laser-tripwires',
    'security-camera',
    'the-joker',
    'uninvited-guest',
    'reverse-run',
    'master-key',
    'balance',
    'lengthy-finish',
    'rough-kickoff',
    'cluttered-toolbox',
    'foot-door',
    'extra-hours',
    'grinding-gears',
];

export function buildDealPlan(config: TheGangRulesConfig): TheGangDealPlan {
    const normalized = normalizeRulesConfig(config);
    const mode = THE_GANG_GAME_MODES[normalized.gameMode];
    const quickSkipRound2 = isChallengeActive(normalized, 'quick-access')
        || isChallengeActive(normalized, 'quick-execution');
    const skippedRounds = [
        ...(quickSkipRound2 ? [2] : []),
        ...(isChallengeActive(normalized, 'hasty-getaway') ? [3] : []),
    ];
    const reverseRun = isChallengeActive(normalized, 'reverse-run');

    const pocketCards = mode.pocketCards + getChallengeCount(normalized, 'foot-door');
    const handCards = Math.max(
        1,
        mode.handCards
            - getChallengeCount(normalized, 'balance')
            + getChallengeCount(normalized, 'security-camera')
            + (normalized.omaha ? 2 : 0),
    );
    const flopCards = (reverseRun ? 1 : mode.flopCards)
        + getChallengeCount(normalized, 'rough-kickoff');
    const turnCards = mode.turnCards
        + getChallengeCount(normalized, 'uninvited-guest');
    const riverCards = (reverseRun ? 3 : mode.riverCards)
        + getChallengeCount(normalized, 'lengthy-finish');

    return {
        handCards,
        pocketCards,
        roundDraws: {
            1: Math.max(0, flopCards),
            2: Math.max(0, turnCards),
            3: Math.max(0, riverCards),
        },
        skippedRounds,
        perPlayerCommunity: mode.perPlayer === true,
        perGap: mode.perGap === true,
    };
}

export function getRulesDealSignature(config: TheGangRulesConfig): string {
    const normalized = normalizeRulesConfig(config);
    const activeDealChallenges = DEAL_AFFECTING_CHALLENGES
        .map((challengeId) => [challengeId, getChallengeCount(normalized, challengeId)] as const)
        .filter(([, count]) => count > 0);

    return JSON.stringify({
        gameMode: normalized.gameMode,
        omaha: normalized.omaha,
        twoHand: normalized.twoHand,
        challenges: activeDealChallenges,
    });
}

export function rulesConfigRequiresRedeal(
    previous: TheGangRulesConfig,
    next: TheGangRulesConfig,
): boolean {
    return getRulesDealSignature(previous) !== getRulesDealSignature(next);
}

export function selectDeterministicRank(seed: string): Rank {
    const ranks: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    const checksum = [...seed].reduce((total, char) => total + char.charCodeAt(0), 0);
    return ranks[checksum % ranks.length];
}

export function getBlackedRankForHeist(config: TheGangRulesConfig, heistNumber: number): Rank | undefined {
    if (!isChallengeActive(config, 'cluttered-toolbox')) return undefined;
    return selectDeterministicRank(`${config.gameMode}:${heistNumber}:${Object.keys(config.challenges).join(',')}`);
}

export function createSpecialCardsForConfig(config: TheGangRulesConfig): PlayingCard[] {
    const cards: PlayingCard[] = [];
    const jokerCount = getChallengeCount(config, 'the-joker') * 2;
    const wildCount = getChallengeCount(config, 'master-key');
    const blankCount = isChallengeActive(config, 'cluttered-toolbox') ? 4 : 0;

    for (let index = 0; index < jokerCount; index += 1) {
        cards.push({ suit: 'special', rank: 'Joker', kind: 'joker' });
    }
    for (let index = 0; index < wildCount; index += 1) {
        cards.push({ suit: 'special', rank: 'Wild', kind: 'wild' });
    }
    for (let index = 0; index < blankCount; index += 1) {
        cards.push({ suit: 'special', rank: 'Blank', kind: 'blank' });
    }

    return cards;
}

export function createToolDeck(): TheGangToolId[] {
    return Object.values(THE_GANG_TOOLS).flatMap((tool) =>
        Array.from({ length: tool.count }, () => tool.id),
    );
}

export function createSpecialistDeck(): TheGangSpecialistId[] {
    return Object.keys(THE_GANG_SPECIALISTS) as TheGangSpecialistId[];
}
