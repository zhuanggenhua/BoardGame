/**
 * 召唤师战争 - 领域类型定义
 */


// ============================================================================
// 基础类型
// ============================================================================

/** 格子坐标 */
export interface CellCoord {
  row: number;
  col: number;
}

/** 玩家 ID */
export type PlayerId = '0' | '1';

/** 攻击类型 */
export type AttackType = 'melee' | 'ranged';

/** 射程（近战为1，远程通常为3） */
export type AttackRange = 1 | 2 | 3 | 4;

/** 单位职业 */
export type UnitClass = 'summoner' | 'champion' | 'common';

/** 卡牌类型 */
export type CardType = 'unit' | 'event' | 'structure';

// ============================================================================
// 游戏阶段
// ============================================================================

/** 游戏阶段（按规则顺序） */
export type GamePhase =
  | 'factionSelect' // 0. 阵营选择阶段
  | 'summon'   // 1. 召唤阶段
  | 'move'     // 2. 移动阶段
  | 'build'    // 3. 建造阶段
  | 'attack'   // 4. 攻击阶段
  | 'magic'    // 5. 魔力阶段
  | 'draw';    // 6. 抽牌阶段

/** 游戏进行阶段顺序（不含选阵营） */
export const PHASE_ORDER: GamePhase[] = ['summon', 'move', 'build', 'attack', 'magic', 'draw'];

/** 阵营 ID */
export type FactionId = 'necromancer' | 'trickster' | 'paladin' | 'goblin' | 'frost' | 'barbaric';

/**
 * 阵营目录的唯一权威来源：config/factions/index.ts 的 FACTION_CATALOG
 * 此处不再重复定义，避免数据不一致
 */

// ============================================================================
// 卡牌定义
// ============================================================================

/** 单位卡牌 */
export interface UnitCard {
  id: string;
  cardType: 'unit';
  name: string;
  unitClass: UnitClass;
  faction: FactionId;
  strength: number;      // 攻击力（骰子数）
  life: number;          // 生命值
  cost: number;          // 召唤费用
  attackType: AttackType;
  attackRange: AttackRange; // 射程（近战1，远程通常3）
  abilities?: string[];  // 能力 ID 列表
  deckSymbols: string[]; // 牌组符号
  spriteIndex?: number;  // 精灵图索引
  spriteAtlas?: 'hero' | 'cards' | 'portal'; // 精灵图集类型
}

/** 事件类型 */
export type EventType = 'legendary' | 'common';

/** 事件卡牌 */
export interface EventCard {
  id: string;
  cardType: 'event';
  name: string;
  faction: FactionId;
  eventType?: EventType; // 传奇/普通
  cost: number;
  playPhase: GamePhase | 'any';
  effect: string;        // 效果描述
  isActive?: boolean;    // 是否为主动事件
  charges?: number;      // 充能计数（殉葬火堆等主动事件使用）
  targetUnitId?: string; // 目标单位 ID（催眠引诱等需要追踪目标的主动事件）
  entanglementTargets?: [string, string]; // 交缠颂歌：两个目标单位 ID
  deckSymbols: string[];
  spriteIndex?: number;  // 精灵图索引
  spriteAtlas?: 'hero' | 'cards' | 'portal';
}

/** 建筑卡牌 */
export interface StructureCard {
  id: string;
  cardType: 'structure';
  name: string;
  faction: FactionId;
  cost: number;
  life: number;
  isGate?: boolean;      // 是否为城门
  isStartingGate?: boolean; // 是否为起始城门（10生命）
  deckSymbols: string[];
  spriteIndex?: number;  // 精灵图索引
  spriteAtlas?: 'hero' | 'cards' | 'portal';
}

/** 卡牌联合类型 */
export type Card = UnitCard | EventCard | StructureCard;

// ============================================================================
// 战场状态
// ============================================================================

/** 战场上的单位 */
export interface BoardUnit {
  cardId: string;
  card: UnitCard;
  owner: PlayerId;
  position: CellCoord;
  damage: number;        // 当前伤害
  boosts: number;        // 增益标记数
  hasMoved: boolean;     // 本回合是否已移动
  hasAttacked: boolean;  // 本回合是否已攻击
  extraAttacks?: number; // 额外攻击次数（连续射击/群情激愤等授予，不计入3次限制）
  attachedCards?: EventCard[]; // 附加的事件卡（如狱火铸剑）
  healingMode?: boolean; // 治疗模式（圣殿牧师：本次攻击转为治疗）
  wasAttackedThisTurn?: boolean; // 本回合是否已被攻击（庇护判定用）
  tempAbilities?: string[]; // 临时技能（幻化复制，回合结束清除）
  originalOwner?: PlayerId; // 临时控制权转移前的原始拥有者（心灵操控）
  attachedUnits?: { cardId: string; card: UnitCard; owner: PlayerId }[]; // 附加的单位卡（冰霜战斧）
}

/** 战场上的建筑 */
export interface BoardStructure {
  cardId: string;
  card: StructureCard;
  owner: PlayerId;
  position: CellCoord;
  damage: number;
}

/** 战场格子 */
export interface BoardCell {
  unit?: BoardUnit;
  structure?: BoardStructure;
}

// ============================================================================
// 玩家状态
// ============================================================================

/** 玩家状态 */
export interface PlayerState {
  id: PlayerId;
  magic: number;         // 当前魔力（0-15）
  hand: Card[];          // 手牌
  deck: Card[];          // 抽牌堆
  discard: Card[];       // 弃牌堆
  activeEvents: EventCard[]; // 主动事件区
  summonerId: string;    // 召唤师卡牌 ID
  moveCount: number;     // 本回合已移动单位数
  attackCount: number;   // 本回合已攻击单位数
  hasAttackedEnemy: boolean; // 本回合是否攻击过敌方
}

// ============================================================================
// 核心游戏状态
// ============================================================================

/** 阵营选择阶段的游戏阶段 */
export type SetupPhase = 'factionSelect';

/** 完整游戏阶段（含选阵营） */
export type FullGamePhase = SetupPhase | GamePhase;

/** 召唤师战争核心状态 */
export interface SummonerWarsCore {
  /** 战场网格（6行8列） */
  board: BoardCell[][];
  /** 玩家状态 */
  players: Record<PlayerId, PlayerState>;
  /** 当前阶段 */
  phase: GamePhase;
  /** 当前回合玩家 */
  currentPlayer: PlayerId;
  /** 回合数 */
  turnNumber: number;
  /** 选中的单位（用于移动/攻击） */
  selectedUnit?: CellCoord;
  /** 攻击目标选择模式 */
  attackTargetMode?: {
    attacker: CellCoord;
    validTargets: CellCoord[];
  };
  /** 阵营选择状态（选阵营阶段使用，未选时为 'unselected'） */
  selectedFactions: Record<PlayerId, FactionId | 'unselected'>;
  /** 玩家准备状态 */
  readyPlayers: Record<PlayerId, boolean>;
  /** 房主玩家 ID */
  hostPlayerId: PlayerId;
  /** 房主是否已点击开始 */
  hostStarted: boolean;
  /** 自定义牌组数据（选角阶段使用，玩家选择自定义牌组时存储） */
  customDeckData?: Partial<Record<PlayerId, SerializedCustomDeck>>;
  /** 技能使用次数追踪（key: `${unitCardId}:${abilityId}`，回合结束清空） */
  abilityUsageCount: Record<string, number>;
}

// ============================================================================
// 命令类型
// ============================================================================

/** 命令类型常量 */
export const SW_COMMANDS = {
  // 阵营选择阶段
  SELECT_FACTION: 'sw:select_faction',
  SELECT_CUSTOM_DECK: 'sw:select_custom_deck',
  PLAYER_READY: 'sw:player_ready',
  HOST_START_GAME: 'sw:host_start_game',
  // 召唤阶段
  SUMMON_UNIT: 'sw:summon_unit',
  // 移动阶段
  SELECT_UNIT: 'sw:select_unit',
  MOVE_UNIT: 'sw:move_unit',
  // 建造阶段
  BUILD_STRUCTURE: 'sw:build_structure',
  // 攻击阶段
  DECLARE_ATTACK: 'sw:declare_attack',
  CONFIRM_ATTACK: 'sw:confirm_attack',
  // 魔力阶段
  DISCARD_FOR_MAGIC: 'sw:discard_for_magic',
  // 通用
  END_PHASE: 'sw:end_phase',
  PLAY_EVENT: 'sw:play_event',
  BLOOD_SUMMON_STEP: 'sw:blood_summon_step',
  ACTIVATE_ABILITY: 'sw:activate_ability',
  FUNERAL_PYRE_HEAL: 'sw:funeral_pyre_heal',
} as const;

/** 召唤单位命令 */
export interface SummonUnitCommand {
  type: typeof SW_COMMANDS.SUMMON_UNIT;
  cardId: string;
  position: CellCoord;
}

/** 选择单位命令 */
export interface SelectUnitCommand {
  type: typeof SW_COMMANDS.SELECT_UNIT;
  position: CellCoord;
}

/** 移动单位命令 */
export interface MoveUnitCommand {
  type: typeof SW_COMMANDS.MOVE_UNIT;
  from: CellCoord;
  to: CellCoord;
}

/** 建造建筑命令 */
export interface BuildStructureCommand {
  type: typeof SW_COMMANDS.BUILD_STRUCTURE;
  cardId: string;
  position: CellCoord;
}

/** 宣告攻击命令 */
export interface DeclareAttackCommand {
  type: typeof SW_COMMANDS.DECLARE_ATTACK;
  attacker: CellCoord;
  target: CellCoord;
}

/** 确认攻击命令（掷骰后） */
export interface ConfirmAttackCommand {
  type: typeof SW_COMMANDS.CONFIRM_ATTACK;
  diceResults: ('melee' | 'ranged' | 'special')[];
}

/** 弃牌换魔力命令 */
export interface DiscardForMagicCommand {
  type: typeof SW_COMMANDS.DISCARD_FOR_MAGIC;
  cardIds: string[];
}

/** 结束阶段命令 */
export interface EndPhaseCommand {
  type: typeof SW_COMMANDS.END_PHASE;
}

/** 施放事件命令 */
export interface PlayEventCommand {
  type: typeof SW_COMMANDS.PLAY_EVENT;
  cardId: string;
  targets?: CellCoord[];
  damageTargets?: (CellCoord | null)[];
}

/** 血契召唤步骤命令 */
export interface BloodSummonStepCommand {
  type: typeof SW_COMMANDS.BLOOD_SUMMON_STEP;
  targetUnitPosition: CellCoord; // 友方单位（承受伤害）
  summonCardId: string;          // 手牌中费用≤2的单位
  summonPosition: CellCoord;     // 放置位置（目标相邻空格）
}

/** 激活技能命令 */
export interface ActivateAbilityCommand {
  type: typeof SW_COMMANDS.ACTIVATE_ABILITY;
  abilityId: string;
  sourceUnitId: string;
  targetCardId?: string;    // 从弃牌堆选中的卡牌 ID
  targetPosition?: CellCoord; // 目标位置
  targetUnitId?: string;    // 目标单位 ID
}

/** 殉葬火堆治疗命令 */
export interface FuneralPyreHealCommand {
  type: typeof SW_COMMANDS.FUNERAL_PYRE_HEAL;
  cardId: string;
  targetPosition?: CellCoord;
  skip?: boolean;
}

/** 选择自定义牌组命令 */
export interface SelectCustomDeckCommand {
  type: typeof SW_COMMANDS.SELECT_CUSTOM_DECK;
  /** 序列化的自定义牌组数据 */
  deckData: SerializedCustomDeck;
}

/** 所有命令联合类型 */
export type SWCommand =
  | SummonUnitCommand
  | SelectUnitCommand
  | MoveUnitCommand
  | BuildStructureCommand
  | DeclareAttackCommand
  | ConfirmAttackCommand
  | DiscardForMagicCommand
  | EndPhaseCommand
  | PlayEventCommand
  | BloodSummonStepCommand
  | ActivateAbilityCommand
  | FuneralPyreHealCommand
  | SelectCustomDeckCommand;

// ============================================================================
// 事件类型
// ============================================================================

/** 事件类型常量 */
export const SW_EVENTS = {
  // 阵营选择事件
  FACTION_SELECTED: 'sw:faction_selected',
  PLAYER_READY: 'sw:player_ready',
  HOST_STARTED: 'sw:host_started',
  GAME_INITIALIZED: 'sw:game_initialized',
  // 单位事件
  UNIT_SUMMONED: 'sw:unit_summoned',
  UNIT_MOVED: 'sw:unit_moved',
  UNIT_ATTACKED: 'sw:unit_attacked',
  UNIT_DAMAGED: 'sw:unit_damaged',
  UNIT_HEALED: 'sw:unit_healed',
  UNIT_DESTROYED: 'sw:unit_destroyed',
  UNIT_CHARGED: 'sw:unit_charged',
  // 建筑事件
  STRUCTURE_BUILT: 'sw:structure_built',
  STRUCTURE_DAMAGED: 'sw:structure_damaged',
  STRUCTURE_DESTROYED: 'sw:structure_destroyed',
  STRUCTURE_HEALED: 'sw:structure_healed',
  // 资源事件
  MAGIC_CHANGED: 'sw:magic_changed',
  // 卡牌事件
  CARD_DRAWN: 'sw:card_drawn',
  CARD_DISCARDED: 'sw:card_discarded',
  EVENT_PLAYED: 'sw:event_played',
  ACTIVE_EVENT_DISCARDED: 'sw:active_event_discarded',
  // 阶段/回合事件
  PHASE_CHANGED: 'sw:phase_changed',
  TURN_CHANGED: 'sw:turn_changed',
  GAME_OVER: 'sw:game_over',
  // 技能事件
  ABILITY_TRIGGERED: 'sw:ability_triggered',
  STRENGTH_MODIFIED: 'sw:strength_modified',
  SUMMON_FROM_DISCARD_REQUESTED: 'sw:summon_from_discard_requested',
  SOUL_TRANSFER_REQUESTED: 'sw:soul_transfer_requested',
  FUNERAL_PYRE_CHARGED: 'sw:funeral_pyre_charged',
  EVENT_ATTACHED: 'sw:event_attached',
  // 推拉事件（欺心巫族核心机制）
  UNIT_PUSHED: 'sw:unit_pushed',
  UNIT_PULLED: 'sw:unit_pulled',
  // 控制权转移（心灵捕获）
  MIND_CAPTURE_REQUESTED: 'sw:mind_capture_requested',
  CONTROL_TRANSFERRED: 'sw:control_transferred',
  // 额外攻击（读心传念）
  EXTRA_ATTACK_GRANTED: 'sw:extra_attack_granted',
  // 迷魂减伤
  DAMAGE_REDUCED: 'sw:damage_reduced',
  // 催眠引诱标记
  HYPNOTIC_LURE_MARKED: 'sw:hypnotic_lure_marked',
  // 位置交换（神出鬼没）
  UNITS_SWAPPED: 'sw:units_swapped',
  // 抓附跟随请求（抓附手）
  GRAB_FOLLOW_REQUESTED: 'sw:grab_follow_requested',
  // 卡牌回收（从弃牌堆拿回手牌）
  CARD_RETRIEVED: 'sw:card_retrieved',
  // 治疗模式标记（圣殿牧师）
  HEALING_MODE_SET: 'sw:healing_mode_set',
  // 技能复制（幻化）
  ABILITIES_COPIED: 'sw:abilities_copied',
  // 单位附加（冰霜战斧）
  UNIT_ATTACHED: 'sw:unit_attached',
  // 消耗移动次数（技能代替移动，如预备）
  MOVE_ACTION_CONSUMED: 'sw:move_action_consumed',
  // 消耗攻击次数（技能代替攻击，如高阶念力）
  ATTACK_ACTION_CONSUMED: 'sw:attack_action_consumed',
} as const;

// ============================================================================
// 事件 Payload 类型约束
// ============================================================================

/**
 * ABILITY_TRIGGERED 事件的 payload 类型约束
 * 
 * 所有 ABILITY_TRIGGERED 事件必须包含 sourcePosition，
 * 否则 UI 层（useGameEvents）无法定位来源单位、无法触发交互。
 */
export interface AbilityTriggeredPayload {
  abilityId: string;
  sourceUnitId: string;
  /** 来源单位位置 — 必填，UI 层依赖此字段定位单位 */
  sourcePosition: CellCoord;
  /** 技能名称（resolveAbilityEffects 头部事件携带） */
  abilityName?: string;
  /** 效果类型标识（如 preventMagicGain / extraMove） */
  effectType?: string;
  /** 自定义参数 */
  params?: Record<string, unknown>;
  /** 其他扩展字段 */
  [key: string]: unknown;
}

// ============================================================================
// 单位实例类型（用于技能系统）
// ============================================================================

/** 单位实例（包含位置信息） */
export type UnitInstance = BoardUnit;

// ============================================================================
// 阵营选择
// ============================================================================

/** 序列化的单张卡牌条目（存储/传输用） */
export interface SerializedCardEntry {
  /** 卡牌基础 ID（如 'necro-undead-warrior'） */
  cardId: string;
  /** 卡牌所属阵营 */
  faction: FactionId;
  /** 数量 */
  count: number;
}

/** 序列化的自定义牌组（存储/传输用） */
export interface SerializedCustomDeck {
  /** 牌组名称 */
  name: string;
  /** 召唤师卡牌 ID */
  summonerId: string;
  /** 召唤师所属阵营 */
  summonerFaction: FactionId;
  /** 手动选择的卡牌列表 */
  cards: SerializedCardEntry[];
  /** 自由组卡模式（跳过符号匹配限制） */
  freeMode?: boolean;
}

/** 阵营选择事件 */
export const SW_SELECTION_EVENTS = {
  FACTION_SELECTED: 'sw:faction_selected',
  PLAYER_READY: 'sw:player_ready',
  HOST_STARTED: 'sw:host_started',
  SELECTION_COMPLETE: 'sw:selection_complete',
} as const;
