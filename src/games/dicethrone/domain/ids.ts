/**
 * DiceThrone 领域内的稳定 ID 常量表（单一真源）
 *
 * 目的：
 * - 避免在 domain/UI/tests 里散落字符串字面量，降低重命名/新增成本
 * - 仍然保留字符串 id 的序列化优势（存档/回放/日志/网络同步）
 */

// ============================================================================
// 状态效果 ID
// ============================================================================

export const STATUS_IDS = {
    /** 击倒/倒地（原先误用 stun） */
    KNOCKDOWN: 'knockdown',

    /** 眩晕 - 无法行动 */
    STUN: 'stun',

    /** 燃烧（炎术士） - 回合开始受伤害 */
    BURN: 'burn',

    /** 脑震荡（狂战士） - 跳过下个收入阶段 */
    CONCUSSION: 'concussion',

    /** 晕眩（狂战士） - 无法行动，攻击结束后再次攻击 */
    DAZE: 'daze',

    /** 致盲（月精灵） - 攻击失败率 1/3 */
    BLINDED: 'blinded',

    /** 缠绕（月精灵） - 攻击掷骰次数 -1 */
    ENTANGLE: 'entangle',

    /** 锁定（月精灵） - 受伤 +2 */
    TARGETED: 'targeted',

    /** 中毒（影子盗贼） - 回合开始受伤害 */
    POISON: 'poison',
} as const;

export type StatusId = (typeof STATUS_IDS)[keyof typeof STATUS_IDS];

// ============================================================================
// Token ID（僧侣角色）
// ============================================================================

export const TOKEN_IDS = {
    /** 太极 - 可用于增减伤害 */
    TAIJI: 'taiji',

    /** 闪避 - 投掷闪避判定 */
    EVASIVE: 'evasive',

    /** 净化 - 移除负面状态 */
    PURIFY: 'purify',

    /** 火焰精通（炎术士） - 增加火焰伤害 */
    FIRE_MASTERY: 'fire_mastery',

    /** 潜行（影子盗贼） - 避免受击 */
    SNEAK: 'sneak',

    /** 伏击（影子盗贼） - 增加伤害 */
    SNEAK_ATTACK: 'sneak_attack',

    /** 神圣祝福（圣骑士） - 免疫一次致死伤害并回血 */
    BLESSING_OF_DIVINITY: 'blessing_of_divinity',

    /** 神罚（圣骑士） - 反弹伤害 */
    RETRIBUTION: 'retribution',

    /** 暴击（圣骑士） - 增加伤害 */
    CRIT: 'crit',

    /** 守护（圣骑士） - 减免伤害 */
    PROTECT: 'protect',

    /** 精准（圣骑士） - 攻击不可防御 */
    ACCURACY: 'accuracy',

    /** 教会税升级（圣骑士） - income 阶段额外 +1CP */
    TITHES_UPGRADED: 'tithes_upgraded',
} as const;

export type TokenId = (typeof TOKEN_IDS)[keyof typeof TOKEN_IDS];

// ============================================================================
// 骰面 ID（僧侣骰子）
// ============================================================================

export const DICE_FACE_IDS = {
    /** 拳 - 骰值 1, 2 */
    FIST: 'fist',

    /** 掌 - 骰值 3 */
    PALM: 'palm',

    /** 太极 - 骰值 4, 5 */
    TAIJI: 'taiji',

    /** 莲花 - 骰值 6 */
    LOTUS: 'lotus',
} as const;

export type DiceFaceId = (typeof DICE_FACE_IDS)[keyof typeof DICE_FACE_IDS];

// ============================================================================
// 骰面 ID（狂战士骰子）
// ============================================================================

export const BARBARIAN_DICE_FACE_IDS = {
    /** 剑 - 骰值 1, 2, 3 */
    SWORD: 'sword',

    /** 恢复/心 - 骰值 4, 5 */
    HEART: 'heart',

    /** 力量/星 - 骰值 6 */
    STRENGTH: 'strength',
} as const;

export type BarbarianDiceFaceId = (typeof BARBARIAN_DICE_FACE_IDS)[keyof typeof BARBARIAN_DICE_FACE_IDS];

// ============================================================================
// 骰面 ID（炎术士骰子）
// ============================================================================

export const PYROMANCER_DICE_FACE_IDS = {
    /** 火 - 骰值 1, 2, 3 */
    FIRE: 'fire',
    /** 熔岩/爆发 - 骰值 4 (多角星) */
    MAGMA: 'magma',
    /** 火魂/焚魂 - 骰值 5 */
    FIERY_SOUL: 'fiery_soul',
    /** 陨石 - 骰值 6 (X形溅射) */
    METEOR: 'meteor',
} as const;

export type PyromancerDiceFaceId = (typeof PYROMANCER_DICE_FACE_IDS)[keyof typeof PYROMANCER_DICE_FACE_IDS];

// ============================================================================
// 骰面 ID（月精灵骰子）
// ============================================================================

export const MOON_ELF_DICE_FACE_IDS = {
    /** 弓 - 骰值 1, 2, 3 */
    BOW: 'bow',
    /** 足 - 骰值 4, 5 */
    FOOT: 'foot',
    /** 月 - 骰值 6 */
    MOON: 'moon',
} as const;

export type MoonElfDiceFaceId = (typeof MOON_ELF_DICE_FACE_IDS)[keyof typeof MOON_ELF_DICE_FACE_IDS];

// ============================================================================
// 骰面 ID（影子盗贼骰子）
// ============================================================================

export const SHADOW_THIEF_DICE_FACE_IDS = {
    /** 匕首 - 骰值 1, 2 */
    DAGGER: 'dagger',
    /** 背包 - 骰值 3, 4 */
    BAG: 'bag',
    /** 卡牌 - 骰值 5 */
    CARD: 'card',
    /** 暗影 - 骰值 6 */
    SHADOW: 'shadow',
} as const;

export type ShadowThiefDiceFaceId = (typeof SHADOW_THIEF_DICE_FACE_IDS)[keyof typeof SHADOW_THIEF_DICE_FACE_IDS];

// ============================================================================
// 骰面 ID（圣骑士骰子）
// ============================================================================

export const PALADIN_DICE_FACE_IDS = {
    /** 剑 - 骰值 1, 2 */
    SWORD: 'sword',
    /** 头盔 - 骰值 3, 4 */
    HELM: 'helm',
    /** 恢复/心 - 骰值 5 */
    HEART: 'heart',
    /** 祈祷/圣光/手 - 骰值 6 */
    PRAY: 'pray',
} as const;

export type PaladinDiceFaceId = (typeof PALADIN_DICE_FACE_IDS)[keyof typeof PALADIN_DICE_FACE_IDS];

// ============================================================================
// DiceThrone 领域命令 ID
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
