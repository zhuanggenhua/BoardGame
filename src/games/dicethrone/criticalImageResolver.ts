/**
 * DiceThrone 关键图片解析器
 *
 * 设计原则：资源类型在 CHARACTER_ASSET_TYPES 中统一声明，
 * resolver 只按阶段决定"哪些角色"和"哪些资源类型"进入 critical/warm，
 * 不再手动枚举路径，避免新增资源类型时遗漏。
 */

import type { CriticalImageResolver, CriticalImageResolverResult } from '../../core/types';
import type { DiceThroneCore, SelectableCharacterId } from './domain/types';
import { IMPLEMENTED_DICETHRONE_CHARACTER_IDS } from './domain/types';
import type { MatchState } from '../../engine/types';

// ============================================================================
// 资源类型声明（唯一数据源）
// ============================================================================

/**
 * 每个角色拥有的资源类型及其子路径（相对于角色目录）
 *
 * 新增资源类型时只需在此处添加一行，所有阶段自动覆盖。
 * tags 用于按阶段筛选：
 *   - 'selection': 角色选择界面需要的资源
 *   - 'gameplay':  游戏进行中需要的资源
 */
const CHARACTER_ASSET_TYPES = [
    { key: 'player-board', tags: ['selection', 'gameplay'] },
    { key: 'tip',          tags: ['selection', 'gameplay'] },
    { key: 'ability-cards', tags: ['gameplay'] },
    { key: 'dice',          tags: ['gameplay'] },
    { key: 'status-icons-atlas', tags: ['gameplay'] },
] as const;

type AssetTag = 'selection' | 'gameplay';

// ============================================================================
// 角色 → 目录映射
// ============================================================================

const CHARACTER_DIR_MAP: Record<SelectableCharacterId, string> = {
    monk: 'monk',
    barbarian: 'barbarian',
    pyromancer: 'pyromancer',
    shadow_thief: 'shadow_thief',
    moon_elf: 'moon_elf',
    paladin: 'paladin',
};

/** 已实现完整资源的角色列表（直接引用类型系统常量，避免两处维护） */
const IMPLEMENTED_CHARACTERS: readonly SelectableCharacterId[] = IMPLEMENTED_DICETHRONE_CHARACTER_IDS;

// ============================================================================
// 通用资源
// ============================================================================

const COMMON_CRITICAL_PATHS = [
    'dicethrone/images/Common/background',
    'dicethrone/images/Common/card-background',
    'dicethrone/images/Common/character-portraits',
];

// ============================================================================
// 路径生成工具
// ============================================================================

/** 获取角色指定资源类型的路径 */
function getCharAssetPath(charId: SelectableCharacterId, assetKey: string): string {
    return `dicethrone/images/${CHARACTER_DIR_MAP[charId]}/${assetKey}`;
}

/** 获取角色的所有匹配 tag 的资源路径 */
function getCharAssetsByTag(charId: SelectableCharacterId, tag: AssetTag): string[] {
    return CHARACTER_ASSET_TYPES
        .filter(a => (a.tags as readonly string[]).includes(tag))
        .map(a => getCharAssetPath(charId, a.key));
}

/** 获取角色的全部资源路径 */
function getAllCharAssets(charId: SelectableCharacterId): string[] {
    return CHARACTER_ASSET_TYPES.map(a => getCharAssetPath(charId, a.key));
}

// ============================================================================
// 解析器实现
// ============================================================================

function extractSelectedCharacters(core: DiceThroneCore): SelectableCharacterId[] {
    const selected = new Set<SelectableCharacterId>();
    for (const charId of Object.values(core.selectedCharacters)) {
        if (charId && charId !== 'unselected') {
            selected.add(charId as SelectableCharacterId);
        }
    }
    return [...selected];
}

function isInSetupPhase(core: DiceThroneCore): boolean {
    return !core.hostStarted;
}

/**
 * DiceThrone 关键图片解析器
 *
 * 策略：
 * 1. 无状态：选角界面资源为 critical，gameplay 资源为 warm
 * 2. 角色选择阶段：selection 标签资源为 critical，gameplay 标签资源为 warm
 * 3. 游戏进行中：自己角色全部资源为 critical，对手角色全部资源为 warm
 */
export const diceThroneCriticalImageResolver: CriticalImageResolver = (
    gameState: unknown,
    _locale?: string,
    playerID?: string | null,
): CriticalImageResolverResult => {
    const state = gameState as MatchState<DiceThroneCore>;
    const core = state?.core;

    // 无状态：预加载选角界面所需资源
    if (!core) {
        const critical = [
            ...COMMON_CRITICAL_PATHS,
            ...IMPLEMENTED_CHARACTERS.flatMap(c => getCharAssetsByTag(c, 'selection')),
        ];
        const warm = IMPLEMENTED_CHARACTERS.flatMap(c => getCharAssetsByTag(c, 'gameplay'))
            .filter(p => !critical.includes(p));
        return { critical, warm, phaseKey: 'no-state' };
    }

    const selectedCharacters = extractSelectedCharacters(core);

    if (isInSetupPhase(core)) {
        // 角色选择阶段：selection 资源为 critical，gameplay 资源为 warm
        const critical = [
            ...COMMON_CRITICAL_PATHS,
            ...IMPLEMENTED_CHARACTERS.flatMap(c => getCharAssetsByTag(c, 'selection')),
        ];
        const warm = IMPLEMENTED_CHARACTERS.flatMap(c => getCharAssetsByTag(c, 'gameplay'))
            .filter(p => !critical.includes(p));
        return { critical, warm, phaseKey: 'setup' };
    }

    // 游戏进行中：自己角色 critical，对手角色 warm
    if (selectedCharacters.length === 0) {
        return { critical: [...COMMON_CRITICAL_PATHS], warm: [], phaseKey: 'playing:none' };
    }

    // 按 playerID 区分自己和对手的角色
    const myCharId = playerID ? core.selectedCharacters[playerID] : null;
    const myChar = (myCharId && myCharId !== 'unselected')
        ? myCharId as SelectableCharacterId : null;

    // 自己的角色 → critical，对手的角色 → warm
    const myChars = myChar ? [myChar] : selectedCharacters;
    const opponentChars = myChar
        ? selectedCharacters.filter(c => c !== myChar)
        : [];

    const critical = [
        ...COMMON_CRITICAL_PATHS,
        ...myChars.flatMap(getAllCharAssets),
    ];

    const unselected = IMPLEMENTED_CHARACTERS.filter(c => !selectedCharacters.includes(c));
    const warm = [
        ...opponentChars.flatMap(getAllCharAssets),
        ...unselected.flatMap(getAllCharAssets),
    ];

    const sortedChars = [...selectedCharacters].sort().join(',');
    return { critical, warm, phaseKey: `playing:${sortedChars}` };
};

// ============================================================================
// 导出供测试使用
// ============================================================================

export const _testExports = {
    CHARACTER_ASSET_TYPES,
    IMPLEMENTED_CHARACTERS,
    COMMON_CRITICAL_PATHS,
    getCharAssetPath,
    getCharAssetsByTag,
    getAllCharAssets,
};
