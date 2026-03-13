/**
 * DiceThrone 领域内的稳定 ID 常量表（单一真源）。
 *
 * 目的：
 * - 避免在 domain / UI / tests 中散落字符串字面量，降低重命名和新增成本
 * - 保留字符串 id 的序列化优势，便于存档、回放、日志和网络同步
 */

// ============================================================================
// 状态效果 ID
// ============================================================================

export const STATUS_IDS = {
    /** 击倒（旧 stun 命名的纠正版本） */
    KNOCKDOWN: 'knockdown',

    /** 燃烧（炎术士） */
    BURN: 'burn',

    /** 脑震荡（野蛮人） */
    CONCUSSION: 'concussion',

    /** 晕眩（野蛮人 / 炎术士） */
    DAZE: 'daze',

    /** 致盲（月精灵） */
    BLINDED: 'blinded',

    /** 缠绕（月精灵） */
    ENTANGLE: 'entangle',

    /** 锁定（月精灵） */
    TARGETED: 'targeted',

    /** 中毒（影贼） */
    POISON: 'poison',
} as const;

export type StatusId = (typeof STATUS_IDS)[keyof typeof STATUS_IDS];

// ============================================================================
// Token ID（角色资源 / 标记）
// ============================================================================

export const TOKEN_IDS = {
    /** 太极 */
    TAIJI: 'taiji',

    /** 闪避 */
    EVASIVE: 'evasive',

    /** 净化 */
    PURIFY: 'purify',

    /** 火焰精通（炎术士） */
    FIRE_MASTERY: 'fire_mastery',

    /** 潜行（影贼） */
    SNEAK: 'sneak',

    /** 伏击（影贼） */
    SNEAK_ATTACK: 'sneak_attack',

    /** 神圣祝福（圣骑士） */
    BLESSING_OF_DIVINITY: 'blessing_of_divinity',

    /** 神罚（圣骑士） */
    RETRIBUTION: 'retribution',

    /** 暴击（圣骑士） */
    CRIT: 'crit',

    /** 守护（圣骑士） */
    PROTECT: 'protect',

    /** 精准（圣骑士） */
    ACCURACY: 'accuracy',

    /** 什一税升级（圣骑士） */
    TITHES_UPGRADED: 'tithes_upgraded',
} as const;

export type TokenId = (typeof TOKEN_IDS)[keyof typeof TOKEN_IDS];

// ============================================================================
// 骰面 ID（僧侣）
// ============================================================================

export const DICE_FACE_IDS = {
    /** 拳：骰子 1、2 */
    FIST: 'fist',

    /** 掌：骰子 3 */
    PALM: 'palm',

    /** 太极：骰子 4、5 */
    TAIJI: 'taiji',

    /** 莲花：骰子 6 */
    LOTUS: 'lotus',
} as const;

export type DiceFaceId = (typeof DICE_FACE_IDS)[keyof typeof DICE_FACE_IDS];

// ============================================================================
// 骰面 ID（野蛮人）
// ============================================================================

export const BARBARIAN_DICE_FACE_IDS = {
    /** 剑：骰子 1、2、3 */
    SWORD: 'sword',

    /** 心：骰子 4、5 */
    HEART: 'heart',

    /** 力量：骰子 6 */
    STRENGTH: 'strength',
} as const;

export type BarbarianDiceFaceId = (typeof BARBARIAN_DICE_FACE_IDS)[keyof typeof BARBARIAN_DICE_FACE_IDS];

// ============================================================================
// 骰面 ID（炎术士）
// ============================================================================

export const PYROMANCER_DICE_FACE_IDS = {
    /** 火：骰子 1、2、3 */
    FIRE: 'fire',
    /** 熔岩 / 爆发：骰子 4 */
    MAGMA: 'magma',
    /** 火魂 / 焚魂：骰子 5 */
    FIERY_SOUL: 'fiery_soul',
    /** 陨石：骰子 6 */
    METEOR: 'meteor',
} as const;

export type PyromancerDiceFaceId = (typeof PYROMANCER_DICE_FACE_IDS)[keyof typeof PYROMANCER_DICE_FACE_IDS];

// ============================================================================
// 骰面 ID（月精灵）
// ============================================================================

export const MOON_ELF_DICE_FACE_IDS = {
    /** 弓：骰子 1、2、3 */
    BOW: 'bow',
    /** 足：骰子 4、5 */
    FOOT: 'foot',
    /** 月：骰子 6 */
    MOON: 'moon',
} as const;

export type MoonElfDiceFaceId = (typeof MOON_ELF_DICE_FACE_IDS)[keyof typeof MOON_ELF_DICE_FACE_IDS];

export const GUNSLINGER_DICE_FACE_IDS = {
    BULLET: 'bullet',
    DASH: 'dash',
    BULLSEYE: 'bullseye',
} as const;

export type GunslingerDiceFaceId = (typeof GUNSLINGER_DICE_FACE_IDS)[keyof typeof GUNSLINGER_DICE_FACE_IDS];

// ============================================================================
// 骰面 ID（影贼）
// ============================================================================

export const SHADOW_THIEF_DICE_FACE_IDS = {
    /** 匕首：骰子 1、2 */
    DAGGER: 'dagger',
    /** 背包：骰子 3、4 */
    BAG: 'bag',
    /** 卡牌：骰子 5 */
    CARD: 'card',
    /** 暗影：骰子 6 */
    SHADOW: 'shadow',
} as const;

export type ShadowThiefDiceFaceId = (typeof SHADOW_THIEF_DICE_FACE_IDS)[keyof typeof SHADOW_THIEF_DICE_FACE_IDS];

// ============================================================================
// 骰面 ID（圣骑士）
// ============================================================================

export const PALADIN_DICE_FACE_IDS = {
    /** 剑：骰子 1、2 */
    SWORD: 'sword',
    /** 头盔：骰子 3、4 */
    HELM: 'helm',
    /** 心：骰子 5 */
    HEART: 'heart',
    /** 祈祷：骰子 6 */
    PRAY: 'pray',
} as const;

export type PaladinDiceFaceId = (typeof PALADIN_DICE_FACE_IDS)[keyof typeof PALADIN_DICE_FACE_IDS];

// ============================================================================
// DiceThrone 命令 ID
// ============================================================================

export const DICETHRONE_COMMANDS = {
    PAY_TO_REMOVE_KNOCKDOWN: 'PAY_TO_REMOVE_KNOCKDOWN',
    SELECT_CHARACTER: 'SELECT_CHARACTER',
    HOST_START_GAME: 'HOST_START_GAME',
} as const;

export type DiceThroneCommandType = (typeof DICETHRONE_COMMANDS)[keyof typeof DICETHRONE_COMMANDS];
export type PayToRemoveKnockdownCommandType = typeof DICETHRONE_COMMANDS.PAY_TO_REMOVE_KNOCKDOWN;

// ============================================================================
// 卡牌图集 ID
// ============================================================================

export const DICETHRONE_CARD_ATLAS_IDS = {
    MONK: 'dicethrone:monk-cards',
    BARBARIAN: 'dicethrone:barbarian-cards',
    PYROMANCER: 'dicethrone:pyromancer-cards',
    MOON_ELF: 'dicethrone:moon_elf-cards',
    SHADOW_THIEF: 'dicethrone:shadow_thief-cards',
    PALADIN: 'dicethrone:paladin-cards',
} as const;

export const DICETHRONE_STATUS_ATLAS_IDS = {
    MONK: 'dicethrone:monk-status',
    BARBARIAN: 'dicethrone:barbarian-status',
    PYROMANCER: 'dicethrone:pyromancer-status',
    MOON_ELF: 'dicethrone:moon_elf-status',
    SHADOW_THIEF: 'dicethrone:shadow_thief-status',
    PALADIN: 'dicethrone:paladin-status',
} as const;
