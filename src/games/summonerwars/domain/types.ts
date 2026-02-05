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
  | 'summon'   // 1. 召唤阶段
  | 'move'     // 2. 移动阶段
  | 'build'    // 3. 建造阶段
  | 'attack'   // 4. 攻击阶段
  | 'magic'    // 5. 魔力阶段
  | 'draw';    // 6. 抽牌阶段

/** 阶段顺序 */
export const PHASE_ORDER: GamePhase[] = ['summon', 'move', 'build', 'attack', 'magic', 'draw'];

// ============================================================================
// 卡牌定义
// ============================================================================

/** 单位卡牌 */
export interface UnitCard {
  id: string;
  cardType: 'unit';
  name: string;
  unitClass: UnitClass;
  faction: string;
  strength: number;      // 攻击力（骰子数）
  life: number;          // 生命值
  cost: number;          // 召唤费用
  attackType: AttackType;
  attackRange: AttackRange; // 射程（近战1，远程通常3）
  abilities?: string[];  // 能力 ID 列表
  abilityText?: string;  // 能力描述文本
  deckSymbols: string[]; // 牌组符号
  spriteIndex?: number;  // 精灵图索引
  spriteAtlas?: 'hero' | 'cards'; // 精灵图集类型
}

/** 事件类型 */
export type EventType = 'legendary' | 'common';

/** 事件卡牌 */
export interface EventCard {
  id: string;
  cardType: 'event';
  name: string;
  eventType?: EventType; // 传奇/普通
  cost: number;
  playPhase: GamePhase | 'any';
  effect: string;        // 效果描述
  isActive?: boolean;    // 是否为主动事件
  deckSymbols: string[];
  spriteIndex?: number;  // 精灵图索引
  spriteAtlas?: 'hero' | 'cards';
}

/** 建筑卡牌 */
export interface StructureCard {
  id: string;
  cardType: 'structure';
  name: string;
  cost: number;
  life: number;
  isGate?: boolean;      // 是否为城门
  isStartingGate?: boolean; // 是否为起始城门（10生命）
  deckSymbols: string[];
  spriteIndex?: number;  // 精灵图索引
  spriteAtlas?: 'hero' | 'cards';
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
}

// ============================================================================
// 命令类型
// ============================================================================

/** 命令类型常量 */
export const SW_COMMANDS = {
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
  | PlayEventCommand;

// ============================================================================
// 事件类型
// ============================================================================

/** 事件类型常量 */
export const SW_EVENTS = {
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
  STRUCTURE_DESTROYED: 'sw:structure_destroyed',
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
} as const;

// ============================================================================
// 单位实例类型（用于技能系统）
// ============================================================================

/** 单位实例（包含位置信息） */
export type UnitInstance = BoardUnit;
