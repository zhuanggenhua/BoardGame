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

    /** 眩晕（炎术士） */
    STUN: 'stun',

    /** 致盲（月精灵） */
    BLINDED: 'blinded',

    /** 缠绕（月精灵） */
    ENTANGLE: 'entangle',

    /** 锁定（月精灵） */
    TARGETED: 'targeted',

    /** 战术家：紧缚 */
    BIND: 'bind',

    /** 中毒（影贼） */
    POISON: 'poison',

    /** 咒缚海盗：诅咒金币 */
    CURSED_COIN: 'cursed_coin',

    /** 咒缚海盗：火药桶 */
    POWDER_KEG: 'powder_keg',

    /** 咒缚海盗：凋零 */
    WITHER: 'wither',

    /** 咒缚海盗：休战 */
    PARLEY: 'parley',

    /** 工匠：纳米爆弹 */
    NANOBOMB: 'nanobomb',

    /** 炽天使：眩光 */
    DAZZLE: 'dazzle',

    /** 女猎手：流血 */
    BLEED: 'bleed',
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

    /** 装填弹药（枪手） */
    LOADED: 'loaded',

    /** 赏金（枪手） */
    BOUNTY: 'bounty',

    /** 战术家：战术优势 */
    TACTICAL_ADVANTAGE: 'tactical_advantage',

    HONOR: 'honor',
    SHAME: 'shame',
    SAMURAI_RETRIBUTION: 'samurai_retribution',

    /** 树精：幼种树灵 / 木苗树灵 / 神性树灵 */
    TREANT_SEEDLING: 'treant_seedling',
    TREANT_SAPLING: 'treant_sapling',
    TREANT_DIVINE: 'treant_divine',
    /** 树精：生命源泉 / 刺藤 */
    LIFE_SAP: 'life_sap',
    THORN: 'thorn',

    /** 忍者：慢性中毒 / 忍术 / 烟雾弹 */
    DELAYED_POISON: 'delayed_poison',
    NINJUTSU: 'ninjutsu',
    SMOKE_BOMB: 'smoke_bomb',

    /** 工匠：合成器 / 机器人 */
    SYNTH: 'synth',
    NANOBOT: 'nanobot',
    SHOCK_BOT: 'shock_bot',
    HEAL_BOT: 'heal_bot',

    /** 炽天使：飞行 / 神圣降临 */
    FLIGHT: 'flight',
    DIVINE_ARRIVAL: 'divine_arrival',

    /** 女猎手：妮拉之系 */
    NYRAS_BOND: 'nyras_bond',
    /** 仅用于伤害响应命令，不是可展示或可堆叠的 Token。 */
    NYRA_REDIRECT: 'nyra_redirect',

    /** 吸血鬼领主：鲜血之力 */
    BLOOD_POWER: 'blood_power',
    /** 吸血鬼领主：催眠 / 凝视 */
    MESMERIZE: 'mesmerize',
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

export const SAMURAI_DICE_FACE_IDS = {
    KATANA: 'katana',
    HELM: 'helm',
    RISING_SUN: 'rising_sun',
} as const;

export type SamuraiDiceFaceId = (typeof SAMURAI_DICE_FACE_IDS)[keyof typeof SAMURAI_DICE_FACE_IDS];

export const TREANT_DICE_FACE_IDS = {
    BRANCH: 'branch',
    LEAF: 'leaf',
    SPIRIT: 'spirit',
} as const;

export type TreantDiceFaceId = (typeof TREANT_DICE_FACE_IDS)[keyof typeof TREANT_DICE_FACE_IDS];

export const NINJA_DICE_FACE_IDS = {
    KATANA: 'ninja_katana',
    SHURIKEN: 'shuriken',
    MASK: 'mask',
} as const;

export type NinjaDiceFaceId = (typeof NINJA_DICE_FACE_IDS)[keyof typeof NINJA_DICE_FACE_IDS];

export const ZHANSHUJIA_DICE_FACE_IDS = {
    SABRE: 'sabre',
    BANNER: 'banner',
    MEDAL: 'medal',
} as const;

export type ZhanshujiaDiceFaceId = (typeof ZHANSHUJIA_DICE_FACE_IDS)[keyof typeof ZHANSHUJIA_DICE_FACE_IDS];

export const CURSED_PIRATE_DICE_FACE_IDS = {
    CUTLASS: 'cutlass',
    LOOT: 'loot',
    SKULL: 'skull',
} as const;

export type CursedPirateDiceFaceId = (typeof CURSED_PIRATE_DICE_FACE_IDS)[keyof typeof CURSED_PIRATE_DICE_FACE_IDS];

export const ARTIFICER_DICE_FACE_IDS = {
    WRENCH: 'wrench',
    GEAR: 'gear',
    ELECTRICITY: 'electricity',
} as const;

export type ArtificerDiceFaceId = (typeof ARTIFICER_DICE_FACE_IDS)[keyof typeof ARTIFICER_DICE_FACE_IDS];

// ============================================================================
// 骰面 ID（炽天使）
// ============================================================================

export const TIANSHI_DICE_FACE_IDS = {
    /** 刀刃：骰子 1、2、3 */
    BLADE: 'blade',
    /** 羽翼：骰子 4 */
    WING: 'wing',
    /** 十字：骰子 5 */
    CROSS: 'cross',
    /** 盾牌：骰子 6 */
    SHIELD: 'shield',
} as const;

export type TianshiDiceFaceId = (typeof TIANSHI_DICE_FACE_IDS)[keyof typeof TIANSHI_DICE_FACE_IDS];

// ============================================================================
// 骰面 ID（女猎手）
// ============================================================================

export const LIEREN_DICE_FACE_IDS = {
    /** 长矛：骰子 1、2 */
    SPEAR: 'spear',
    /** 利爪：骰子 3、4 */
    CLAW: 'claw',
    /** 魂之羁绊：骰子 5 */
    NYRAS_BOND: 'nyras_bond',
    /** 剑齿虎：骰子 6 */
    SABERTOOTH: 'sabertooth',
} as const;

export type LierenDiceFaceId = (typeof LIEREN_DICE_FACE_IDS)[keyof typeof LIEREN_DICE_FACE_IDS];

// ============================================================================
// 骰面 ID（吸血鬼领主）
// ============================================================================

export const VAMPIRE_LORD_DICE_FACE_IDS = {
    /** 利爪：骰子 1、2、3 */
    CLAW: 'claw',
    /** 催眠 / 凝视：骰子 4、5 */
    MESMERIZE: 'mesmerize',
    /** 血滴：骰子 6 */
    BLOOD_DROP: 'blood_drop',
} as const;

export type VampireLordDiceFaceId = (typeof VAMPIRE_LORD_DICE_FACE_IDS)[keyof typeof VAMPIRE_LORD_DICE_FACE_IDS];

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
    SELECT_DEFENDER_TARGET: 'SELECT_DEFENDER_TARGET',
    SELECT_CHARACTER: 'SELECT_CHARACTER',
    HOST_START_GAME: 'HOST_START_GAME',
    MOVE_SEAT: 'MOVE_SEAT',
    REQUEST_SEAT_SWAP: 'REQUEST_SEAT_SWAP',
    RESPOND_SEAT_SWAP: 'RESPOND_SEAT_SWAP',
    CANCEL_SEAT_SWAP: 'CANCEL_SEAT_SWAP',
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
    GUNSLINGER: 'dicethrone:gunslinger-cards',
    SAMURAI: 'dicethrone:samurai-cards',
    TREANT: 'dicethrone:treant-cards',
    NINJA: 'dicethrone:ninja-cards',
    ZHANSHUJIA: 'dicethrone:zhanshujia-cards',
    CURSED_PIRATE: 'dicethrone:cursed_pirate-cards',
    ARTIFICER: 'dicethrone:artificer-cards',
    TIANSHI: 'dicethrone:tianshi-cards',
    LIEREN: 'dicethrone:lieren-cards',
    VAMPIRE_LORD: 'dicethrone:vampire_lord-cards',
} as const;

export const DICETHRONE_HAND_CARD_ATLAS_IDS = {
    GUNSLINGER: 'dicethrone:gunslinger-hand-cards',
    SAMURAI: 'dicethrone:samurai-hand-cards',
} as const;

export const DICETHRONE_STATUS_ATLAS_IDS = {
    MONK: 'dicethrone:monk-status',
    BARBARIAN: 'dicethrone:barbarian-status',
    PYROMANCER: 'dicethrone:pyromancer-status',
    MOON_ELF: 'dicethrone:moon_elf-status',
    SHADOW_THIEF: 'dicethrone:shadow_thief-status',
    PALADIN: 'dicethrone:paladin-status',
    GUNSLINGER: 'dicethrone:gunslinger-status',
    SAMURAI: 'dicethrone:samurai-status',
    TREANT: 'dicethrone:treant-status',
    NINJA: 'dicethrone:ninja-status',
    ZHANSHUJIA: 'dicethrone:zhanshujia-status',
    CURSED_PIRATE: 'dicethrone:cursed_pirate-status',
    ARTIFICER: 'dicethrone:artificer-status',
    TIANSHI: 'dicethrone:tianshi-status',
    LIEREN: 'dicethrone:lieren-status',
    VAMPIRE_LORD: 'dicethrone:vampire_lord-status',
} as const;
