/**
 * SummonerWars 交互流程端到端测试
 *
 * 与 interaction-chain-comprehensive.test.ts 的区别：
 * - comprehensive 测试覆盖单个技能的 payload 契约、验证层、执行器防御性
 * - 本文件覆盖多步骤业务流程的完整跑通 + 状态变更断言
 *
 * 测试场景：
 * 1. 交缠颂歌：选两个单位 → 共享技能 → 攻击时 buff 生效
 * 2. 复活亡灵：弃牌堆选卡 → 选位置 → 召唤师受伤 + 单位出现
 * 3. 催眠引诱：拉目标 → 攻击时+1战力
 * 4. 圣洁审判：放置充能 → 友方士兵+1战力
 * 5. 冰霜战斧附加：铁匠附加到士兵 → 攻击时⚔️面始终命中
 * 6. 撤退+攻击：撤退移动 → 确认位置变更 → 后续攻击正常
 * 7. 预备+连续射击：预备充能 → 连续射击消耗充能授予额外攻击
 * 8. 交缠颂歌解除：目标被消灭 → 事件卡弃除 → 技能共享失效
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createInitializedCore, generateInstanceId, resetInstanceCounter } from './test-helpers';
import { executeCommand } from '../domain/execute';
import { validateCommand } from '../domain/validate';
import { SummonerWarsDomain } from '../domain';
import { SW_COMMANDS, SW_EVENTS } from '../domain/types';
import type { SummonerWarsCore, PlayerId, CellCoord, BoardUnit, UnitCard, EventCard } from '../domain/types';
import type { RandomFn, MatchState, GameEvent } from '../../../engine/types';
import { getUnitAt, getUnitAbilities, manhattanDistance } from '../domain/helpers';
import { getEffectiveStrengthValue } from '../domain/abilityResolver';
import { CARD_IDS, getBaseCardId } from '../domain/ids';

// ============================================================================
// 测试辅助
// ============================================================================

function testRandom(): RandomFn {
  return {
    shuffle: <T>(arr: T[]) => arr,
    random: () => 0.5,
    d: (max: number) => Math.ceil(max * 0.5) || 1,
    range: (min: number, max: number) => Math.floor(min + (max - min) * 0.5),
  };
}

/** 所有骰子都命中的 random（melee: index 0-2 → random < 0.5） */
function allHitRandom(): RandomFn {
  return {
    shuffle: <T>(arr: T[]) => arr,
    random: () => 0, // Math.floor(0 * 6) = 0 → melee 面
    d: (max: number) => 1,
    range: (min: number) => min,
  };
}

function mkUnit(id: string, overrides?: Partial<UnitCard>): UnitCard {
  return {
    id, cardType: 'unit', name: `测试-${id}`, unitClass: 'common', faction: 'necromancer',
    strength: 2, life: 3, cost: 1, attackType: 'melee', attackRange: 1,
    deckSymbols: [], ...overrides,
  };
}

function mkEventCard(id: string, overrides?: Partial<EventCard>): EventCard {
  return {
    id, cardType: 'event', name: `事件-${id}`, faction: 'barbaric',
    eventType: 'common', playPhase: 'summon', cost: 0, effect: '',
    deckSymbols: [], ...overrides,
  } as EventCard;
}

function putUnit(core: SummonerWarsCore, pos: CellCoord, card: UnitCard, owner: PlayerId, extra?: Partial<BoardUnit>): BoardUnit {
  const cardId = `${card.id}-${pos.row}-${pos.col}`;
  const u: BoardUnit = {
    instanceId: extra?.instanceId ?? generateInstanceId(cardId),
    cardId, card, owner, position: pos,
    damage: 0, boosts: 0, hasMoved: false, hasAttacked: false,
    ...extra,
  };
  core.board[pos.row][pos.col].unit = u;
  return u;
}

function clearRect(core: SummonerWarsCore, rows: number[], cols: number[]) {
  for (const r of rows) for (const c of cols) {
    if (core.board[r]?.[c]) { core.board[r][c].unit = undefined; core.board[r][c].structure = undefined; }
  }
}

/** 执行命令并返回事件 */
function exec(core: SummonerWarsCore, cmd: string, payload: Record<string, unknown>, random?: RandomFn) {
  const state = { core } as MatchState<SummonerWarsCore>;
  return executeCommand(state, { type: cmd, payload, timestamp: Date.now() }, random ?? testRandom());
}

/** 执行命令并应用事件到 core，返回新 core + 事件 */
function execAndApply(core: SummonerWarsCore, cmd: string, payload: Record<string, unknown>, random?: RandomFn): { core: SummonerWarsCore; events: GameEvent[] } {
  const events = exec(core, cmd, payload, random);
  let newCore = core;
  for (const event of events) {
    newCore = SummonerWarsDomain.reduce(newCore, event);
  }
  return { core: newCore, events };
}

// ============================================================================
// 1. 交缠颂歌：选两个单位 → 共享技能 → 攻击时 buff 生效
// ============================================================================

describe('交缠颂歌 E2E 流程', () => {
  let core: SummonerWarsCore;

  beforeEach(() => {
    resetInstanceCounter();
    core = createInitializedCore(['0', '1'], testRandom(), { faction0: 'barbaric', faction1: 'necromancer' });
    clearRect(core, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);
  });

  it('交缠颂歌让两个士兵共享技能，攻击时 power_up 生效', () => {
    core.phase = 'summon';
    core.currentPlayer = '0' as PlayerId;

    // 放置召唤师（真实：阿布亚·石，STR 5, HP 10, ranged(3)）
    const summoner = mkUnit('barbaric-summoner', { unitClass: 'summoner', faction: 'barbaric', abilities: ['ancestral_bond'], life: 10, strength: 5, attackType: 'ranged', attackRange: 3 });
    putUnit(core, { row: 4, col: 2 }, summoner, '0');

    // 放置两个友方士兵：
    // unitA: 蒙威尊者（有 power_up：战力 += 充能数）— 真实：STR 1, HP 11, melee
    const unitACard = mkUnit('barbaric-moka', { faction: 'barbaric', unitClass: 'champion', abilities: ['power_up', 'trample'], strength: 1, life: 11, attackType: 'melee', attackRange: 1 });
    const unitA = putUnit(core, { row: 4, col: 3 }, unitACard, '0', { boosts: 3 });

    // unitB: 边境弓箭手（有 prepare + rapid_fire）— 真实：STR 2, HP 4, ranged(3)
    const unitBCard = mkUnit('barbaric-frontier-archer', { faction: 'barbaric', unitClass: 'common', abilities: ['prepare', 'rapid_fire'], strength: 2, life: 4, attackType: 'ranged', attackRange: 3 });
    const unitB = putUnit(core, { row: 4, col: 4 }, unitBCard, '0');

    // 放置敌方单位（真实：亡灵战士，STR 2, HP 4, melee）
    const enemy = mkUnit('necro-undead-warrior', { faction: 'necromancer', unitClass: 'common', strength: 2, life: 4, attackType: 'melee', attackRange: 1, abilities: ['blood_rage', 'power_boost', 'blood_rage_decay'] });
    putUnit(core, { row: 3, col: 4 }, enemy, '1');

    // --- 验证交缠前 unitB 的技能和战力 ---
    const abilitiesBefore = getUnitAbilities(unitB, core);
    expect(abilitiesBefore).toContain('prepare');
    expect(abilitiesBefore).toContain('rapid_fire');
    expect(abilitiesBefore).not.toContain('power_up');
    const strengthBefore = getEffectiveStrengthValue(unitB, core);
    expect(strengthBefore).toBe(2); // 基础战力2，无 power_up 加成

    // --- 步骤1：打出交缠颂歌事件卡 ---
    // 手动模拟：将交缠颂歌卡放入手牌
    const entanglementCard = mkEventCard('barbaric-chant-of-entanglement', {
      faction: 'barbaric', isActive: true, playPhase: 'summon', cost: 0,
    });
    core.players['0'].hand.push(entanglementCard as any);

    const { core: coreAfterPlay, events: playEvents } = execAndApply(
      core, SW_COMMANDS.PLAY_EVENT, {
        cardId: entanglementCard.id,
        targets: [{ row: 4, col: 3 }, { row: 4, col: 4 }], // unitA 和 unitB 的位置
      }
    );

    // 验证事件卡进入主动事件区
    const activeEntanglement = coreAfterPlay.players['0'].activeEvents.find(
      ev => getBaseCardId(ev.id) === CARD_IDS.BARBARIC_CHANT_OF_ENTANGLEMENT
    );
    expect(activeEntanglement).toBeDefined();

    // 验证 entanglementTargets 已写入
    expect(activeEntanglement!.entanglementTargets).toBeDefined();
    expect(activeEntanglement!.entanglementTargets).toContain(unitA.instanceId);
    expect(activeEntanglement!.entanglementTargets).toContain(unitB.instanceId);

    // --- 步骤2：验证交缠后 unitB 获得了 power_up + trample ---
    const abilitiesAfter = getUnitAbilities(unitB, coreAfterPlay);
    expect(abilitiesAfter).toContain('prepare');    // 自身技能保留
    expect(abilitiesAfter).toContain('rapid_fire'); // 自身技能保留
    expect(abilitiesAfter).toContain('power_up');   // 从 unitA（蒙威尊者）共享获得
    expect(abilitiesAfter).toContain('trample');    // 从 unitA（蒙威尊者）共享获得

    // --- 步骤3：验证交缠后 unitA 获得了 prepare + rapid_fire ---
    const abilitiesA = getUnitAbilities(unitA, coreAfterPlay);
    expect(abilitiesA).toContain('power_up');    // 自身技能保留
    expect(abilitiesA).toContain('trample');     // 自身技能保留
    expect(abilitiesA).toContain('prepare');     // 从 unitB（弓箭手）共享获得
    expect(abilitiesA).toContain('rapid_fire');  // 从 unitB（弓箭手）共享获得

    // --- 步骤4：验证 unitB 的战力因 power_up 而提升 ---
    // unitB 没有充能（boosts=0），所以 power_up 加成为0
    const unitBOnBoard = getUnitAt(coreAfterPlay, { row: 4, col: 4 })!;
    const strengthAfterNoCharge = getEffectiveStrengthValue(unitBOnBoard, coreAfterPlay);
    expect(strengthAfterNoCharge).toBe(2); // 基础2 + power_up(0充能) = 2

    // 给 unitB 充能后再检查战力
    const coreWithCharge = { ...coreAfterPlay };
    const boardCopy = coreWithCharge.board.map(row => row.map(cell => ({ ...cell })));
    const unitBCell = boardCopy[4][4];
    unitBCell.unit = { ...unitBCell.unit!, boosts: 2 };
    coreWithCharge.board = boardCopy;

    const unitBCharged = getUnitAt(coreWithCharge, { row: 4, col: 4 })!;
    const strengthWithCharge = getEffectiveStrengthValue(unitBCharged, coreWithCharge);
    expect(strengthWithCharge).toBe(4); // 基础2 + power_up(2充能) = 4

    // --- 步骤5：实际攻击，验证骰子数量反映了 buff 后的战力 ---
    // 切换到攻击阶段
    coreWithCharge.phase = 'attack';
    const { events: attackEvents } = execAndApply(
      coreWithCharge, SW_COMMANDS.DECLARE_ATTACK, {
        attacker: { row: 4, col: 4 },
        target: { row: 3, col: 4 },
      }, allHitRandom()
    );

    const attackEvent = attackEvents.find(e => e.type === SW_EVENTS.UNIT_ATTACKED);
    expect(attackEvent).toBeDefined();
    const attackPayload = attackEvent!.payload as Record<string, unknown>;
    // 骰子数量应该是 4（基础2 + power_up 2充能）
    expect(attackPayload.diceCount).toBe(4);
    // 基础战力记录
    expect(attackPayload.baseStrength).toBe(2);
  });

  it('交缠颂歌目标被消灭后事件卡弃除，技能共享失效', () => {
    core.phase = 'summon';
    core.currentPlayer = '0' as PlayerId;

    const summoner = mkUnit('barbaric-summoner', { unitClass: 'summoner', faction: 'barbaric', abilities: ['ancestral_bond'], life: 10, strength: 5, attackType: 'ranged', attackRange: 3 });
    putUnit(core, { row: 4, col: 2 }, summoner, '0');

    // unitA: 雌狮（真实：STR 3, HP 2, melee），damage=1 使剩余生命=1，方便被一击消灭
    const unitACard = mkUnit('barbaric-lioness', { faction: 'barbaric', unitClass: 'common', abilities: ['intimidate', 'life_up'], strength: 3, life: 2, attackType: 'melee', attackRange: 1 });
    const unitA = putUnit(core, { row: 4, col: 3 }, unitACard, '0', { damage: 1 });

    // unitB: 犀牛（真实：STR 2, HP 5, melee）
    const unitBCard = mkUnit('barbaric-rhinoceros', { faction: 'barbaric', unitClass: 'common', abilities: ['speed_up', 'trample'], strength: 2, life: 5, attackType: 'melee', attackRange: 1 });
    const unitB = putUnit(core, { row: 4, col: 4 }, unitBCard, '0');

    // 放置敌方攻击者（亡灵战士，真实：STR 2, HP 4, melee，足以一击消灭剩余1HP的雌狮）
    const killer = mkUnit('necro-undead-warrior', { faction: 'necromancer', unitClass: 'common', strength: 2, life: 4, attackType: 'melee', attackRange: 1, abilities: ['blood_rage', 'power_boost', 'blood_rage_decay'] });
    putUnit(core, { row: 3, col: 3 }, killer, '1');

    // 打出交缠颂歌
    const entanglementCard = mkEventCard('barbaric-chant-of-entanglement', {
      faction: 'barbaric', isActive: true, playPhase: 'summon', cost: 0,
    });
    core.players['0'].hand.push(entanglementCard as any);

    const { core: coreAfterPlay } = execAndApply(
      core, SW_COMMANDS.PLAY_EVENT, {
        cardId: entanglementCard.id,
        targets: [{ row: 4, col: 3 }, { row: 4, col: 4 }],
      }
    );

    // 验证交缠生效
    const unitBAbilities = getUnitAbilities(unitB, coreAfterPlay);
    expect(unitBAbilities).toContain('intimidate'); // 从 unitA 共享

    // --- 通过真实攻击消灭 unitA ---
    // 切换到对手回合的攻击阶段
    const coreForKill = { ...coreAfterPlay };
    coreForKill.phase = 'attack';
    coreForKill.currentPlayer = '1' as PlayerId;

    const { core: coreAfterKill, events: killEvents } = execAndApply(
      coreForKill, SW_COMMANDS.DECLARE_ATTACK, {
        attacker: { row: 3, col: 3 },
        target: { row: 4, col: 3 },
      }, allHitRandom() // 全部命中，3点伤害足以消灭 life=1 的 unitA
    );

    // 验证 unitA 被消灭
    const destroyEvent = killEvents.find(e => e.type === SW_EVENTS.UNIT_DESTROYED);
    expect(destroyEvent).toBeDefined();
    expect(getUnitAt(coreAfterKill, { row: 4, col: 3 })).toBeUndefined();

    // 验证 execute 后处理自动弃置了交缠颂歌
    const discardEvent = killEvents.find(e => e.type === SW_EVENTS.ACTIVE_EVENT_DISCARDED);
    expect(discardEvent).toBeDefined();

    const activeEntAfterKill = coreAfterKill.players['0'].activeEvents.find(
      ev => getBaseCardId(ev.id) === CARD_IDS.BARBARIC_CHANT_OF_ENTANGLEMENT
    );
    expect(activeEntAfterKill).toBeUndefined();

    // 验证 unitB 不再拥有 unitA 的技能
    const unitBAfterKill = getUnitAt(coreAfterKill, { row: 4, col: 4 })!;
    const abilitiesAfterKill = getUnitAbilities(unitBAfterKill, coreAfterKill);
    expect(abilitiesAfterKill).toContain('speed_up');    // 自身技能保留
    expect(abilitiesAfterKill).toContain('trample');     // 自身技能保留
    expect(abilitiesAfterKill).not.toContain('intimidate'); // 共享技能失效
    expect(abilitiesAfterKill).not.toContain('life_up');    // 共享技能失效
  });
});

// ============================================================================
// 2. 复活亡灵：弃牌堆选卡 → 选位置 → 召唤师受伤 + 单位出现
// ============================================================================

describe('复活亡灵 E2E 流程', () => {
  let core: SummonerWarsCore;

  beforeEach(() => {
    resetInstanceCounter();
    core = createInitializedCore(['0', '1'], testRandom(), { faction0: 'necromancer', faction1: 'necromancer' });
    clearRect(core, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);
  });

  it('复活亡灵完整流程：召唤师受伤 + 弃牌堆单位出现在棋盘', () => {
    core.phase = 'summon';
    core.currentPlayer = '0' as PlayerId;

    // 放置召唤师（真实：瑞特-塔鲁斯，STR 2, HP 12, ranged(3)）
    const summoner = mkUnit('necro-summoner', {
      abilities: ['revive_undead'], unitClass: 'summoner', faction: 'necromancer', life: 12, strength: 2, attackType: 'ranged', attackRange: 3,
    });
    const summonerUnit = putUnit(core, { row: 4, col: 3 }, summoner, '0');

    // 在弃牌堆放一个亡灵战士（真实：STR 2, HP 4, melee）
    const skeletonCard = mkUnit('necro-undead-warrior', { faction: 'necromancer', unitClass: 'common', strength: 2, life: 4, attackType: 'melee', attackRange: 1, abilities: ['blood_rage', 'power_boost', 'blood_rage_decay'] });
    const discardId = 'necro-undead-warrior-0-discard';
    core.players['0'].discard.push({ ...skeletonCard, id: discardId } as any);

    // 确保目标位置为空
    expect(getUnitAt(core, { row: 4, col: 4 })).toBeUndefined();

    // 执行复活亡灵
    const { core: coreAfter, events } = execAndApply(
      core, SW_COMMANDS.ACTIVATE_ABILITY, {
        abilityId: 'revive_undead',
        sourceUnitId: summonerUnit.instanceId,
        targetCardId: discardId,
        targetPosition: { row: 4, col: 4 },
      }
    );

    // 验证召唤师受伤（revive_undead 代价：召唤师受2伤）
    const damageEvent = events.find(e =>
      e.type === SW_EVENTS.UNIT_DAMAGED
      && (e.payload as Record<string, unknown>).reason === 'revive_undead'
    );
    expect(damageEvent).toBeDefined();

    // 验证召唤师 damage 增加
    const summonerAfter = getUnitAt(coreAfter, { row: 4, col: 3 });
    expect(summonerAfter).toBeDefined();
    expect(summonerAfter!.damage).toBe(2);

    // 验证复活的单位出现在目标位置
    const revivedUnit = getUnitAt(coreAfter, { row: 4, col: 4 });
    expect(revivedUnit).toBeDefined();
    expect(revivedUnit!.owner).toBe('0');
    expect(revivedUnit!.card.name).toBe(skeletonCard.name);

    // 验证弃牌堆中该卡已移除
    const stillInDiscard = coreAfter.players['0'].discard.find(c => c.id === discardId);
    expect(stillInDiscard).toBeUndefined();
  });
});

// ============================================================================
// 3. 冰霜战斧附加 → 攻击时⚔️面始终命中
// ============================================================================

describe('冰霜战斧附加 E2E 流程', () => {
  let core: SummonerWarsCore;

  beforeEach(() => {
    resetInstanceCounter();
    core = createInitializedCore(['0', '1'], testRandom(), { faction0: 'frost', faction1: 'necromancer' });
    clearRect(core, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);
  });

  it('铁匠附加到远程士兵后，攻击时⚡面也计为命中', () => {
    core.phase = 'move';
    core.currentPlayer = '0' as PlayerId;

    // 放置寒冰锻造师（真实：STR 2, HP 2, melee，有 frost_axe 技能，2充能）
    const smithCard = mkUnit('frost-ice-smith', { abilities: ['frost_axe'], faction: 'frost', unitClass: 'common', strength: 2, life: 2, attackType: 'melee', attackRange: 1 });
    const smith = putUnit(core, { row: 4, col: 3 }, smithCard, '0', { boosts: 2 });

    // 放置冰霜法师（真实：STR 1, HP 4, ranged(3)，被附加后攻击）
    const archerCard = mkUnit('frost-mage', { faction: 'frost', unitClass: 'common', strength: 1, life: 4, attackType: 'ranged', attackRange: 3, abilities: ['frost_bolt'] });
    const archer = putUnit(core, { row: 4, col: 4 }, archerCard, '0');

    // 放置敌方单位（亡灵战士，真实：STR 2, HP 4, melee）
    const enemy = mkUnit('necro-undead-warrior', { faction: 'necromancer', unitClass: 'common', strength: 2, life: 4, attackType: 'melee', attackRange: 1, abilities: ['blood_rage', 'power_boost', 'blood_rage_decay'] });
    putUnit(core, { row: 2, col: 4 }, enemy, '1');

    // --- 步骤1：铁匠使用 frost_axe attach 到弓箭手 ---
    const { core: coreAfterAttach, events: attachEvents } = execAndApply(
      core, SW_COMMANDS.ACTIVATE_ABILITY, {
        abilityId: 'frost_axe',
        sourceUnitId: smith.instanceId,
        choice: 'attach',
        targetPosition: { row: 4, col: 4 },
      }
    );

    // 验证附加事件
    const attachEvent = attachEvents.find(e => e.type === SW_EVENTS.UNIT_ATTACHED);
    expect(attachEvent).toBeDefined();

    // 验证弓箭手有 attachedUnits
    const archerAfter = getUnitAt(coreAfterAttach, { row: 4, col: 4 });
    expect(archerAfter).toBeDefined();
    expect(archerAfter!.attachedUnits).toBeDefined();
    expect(archerAfter!.attachedUnits!.length).toBeGreaterThan(0);

    // 验证铁匠从棋盘消失（被附加到弓箭手身上）
    const smithAfter = getUnitAt(coreAfterAttach, { row: 4, col: 3 });
    expect(smithAfter).toBeUndefined();

    // --- 步骤2：弓箭手攻击敌方，验证⚡面也命中 ---
    // 使用特殊 random：所有骰子都掷出 special（⚡）面
    // 远程攻击正常只有 ranged 面命中，但 frost_axe 让 special 面也命中
    const coreForAttack = { ...coreAfterAttach };
    coreForAttack.phase = 'attack';

    // 构造一个 random 让所有骰子掷出 special 面（0.75 → index 4: melee + special）
    const specialDiceRandom: RandomFn = {
      shuffle: <T>(arr: T[]) => arr,
      random: () => 0.75, // 0.75 → index 4 (melee + special)
      d: (max: number) => 1,
      range: (min: number) => min,
    };

    const { events: attackEvents } = execAndApply(
      coreForAttack, SW_COMMANDS.DECLARE_ATTACK, {
        attacker: { row: 4, col: 4 },
        target: { row: 2, col: 4 },
      }, specialDiceRandom
    );

    const attackEvent = attackEvents.find(e => e.type === SW_EVENTS.UNIT_ATTACKED);
    expect(attackEvent).toBeDefined();
    const atkPayload = attackEvent!.payload as Record<string, unknown>;
    const diceResults = atkPayload.diceResults as Array<{ faceIndex: number; marks: string[] }>;
    const hits = atkPayload.hits as number;

    // 所有骰子都包含 special 标记，远程攻击正常只有 ranged 标记命中
    // frost_axe 让 special = 2个melee命中
    expect(diceResults.every(d => d.marks.includes('special'))).toBe(true);
    // 每个面有 melee + special 两个标记
    // 远程攻击：melee 不算命中，special 算2个命中
    // 所以每个骰子贡献2个命中，总共 diceResults.length * 2
    expect(hits).toBe(diceResults.length * 2);
  });
});

// ============================================================================
// 4. 预备+连续射击：预备充能 → 连续射击消耗充能授予额外攻击
// ============================================================================

describe('预备+连续射击 E2E 流程', () => {
  let core: SummonerWarsCore;

  beforeEach(() => {
    resetInstanceCounter();
    core = createInitializedCore(['0', '1'], testRandom(), { faction0: 'barbaric', faction1: 'necromancer' });
    clearRect(core, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);
  });

  it('弓箭手预备充能 → 连续射击消耗充能 → 获得额外攻击', () => {
    core.phase = 'move';
    core.currentPlayer = '0' as PlayerId;

    // 放置边境弓箭手（真实：STR 2, HP 4, ranged(3)，有 prepare + rapid_fire）
    const archerCard = mkUnit('barbaric-frontier-archer', {
      faction: 'barbaric', unitClass: 'common', abilities: ['prepare', 'rapid_fire'],
      strength: 2, life: 4, attackType: 'ranged', attackRange: 3,
    });
    const archer = putUnit(core, { row: 4, col: 3 }, archerCard, '0', { hasMoved: false, boosts: 0 });

    // 放置敌方单位（亡灵战士，真实：STR 2, HP 4, melee）
    const enemy = mkUnit('necro-undead-warrior', { faction: 'necromancer', unitClass: 'common', strength: 2, life: 4, attackType: 'melee', attackRange: 1, abilities: ['blood_rage', 'power_boost', 'blood_rage_decay'] });
    putUnit(core, { row: 2, col: 3 }, enemy, '1');

    // --- 步骤1：预备（消耗移动行动，获得1充能） ---
    const { core: coreAfterPrepare, events: prepareEvents } = execAndApply(
      core, SW_COMMANDS.ACTIVATE_ABILITY, {
        abilityId: 'prepare',
        sourceUnitId: archer.instanceId,
      }
    );

    // 验证充能事件
    const chargeEvent = prepareEvents.find(e => e.type === SW_EVENTS.UNIT_CHARGED);
    expect(chargeEvent).toBeDefined();

    // 验证弓箭手充能增加
    const archerAfterPrepare = getUnitAt(coreAfterPrepare, { row: 4, col: 3 });
    expect(archerAfterPrepare).toBeDefined();
    expect(archerAfterPrepare!.boosts).toBe(1);

    // 验证移动行动已消耗（hasMoved=true）
    expect(archerAfterPrepare!.hasMoved).toBe(true);

    // --- 步骤2：切换到攻击阶段，使用连续射击 ---
    const coreForRapidFire = { ...coreAfterPrepare };
    coreForRapidFire.phase = 'attack';

    const { core: coreAfterRapidFire, events: rapidFireEvents } = execAndApply(
      coreForRapidFire, SW_COMMANDS.ACTIVATE_ABILITY, {
        abilityId: 'rapid_fire',
        sourceUnitId: archer.instanceId,
      }
    );

    // 验证充能消耗
    const dischargeEvent = rapidFireEvents.find(e =>
      e.type === SW_EVENTS.UNIT_CHARGED
      && (e.payload as Record<string, unknown>).delta === -1
    );
    expect(dischargeEvent).toBeDefined();

    // 验证额外攻击授予
    const extraAttackEvent = rapidFireEvents.find(e => e.type === SW_EVENTS.EXTRA_ATTACK_GRANTED);
    expect(extraAttackEvent).toBeDefined();

    // 验证弓箭手充能减少
    const archerAfterRapidFire = getUnitAt(coreAfterRapidFire, { row: 4, col: 3 });
    expect(archerAfterRapidFire!.boosts).toBe(0);

    // 验证弓箭手获得了额外攻击
    expect(archerAfterRapidFire!.extraAttacks).toBeGreaterThanOrEqual(1);

    // --- 步骤3：实际攻击 ---
    const { events: attackEvents } = execAndApply(
      coreAfterRapidFire, SW_COMMANDS.DECLARE_ATTACK, {
        attacker: { row: 4, col: 3 },
        target: { row: 2, col: 3 },
      }, allHitRandom()
    );

    const attackEvent = attackEvents.find(e => e.type === SW_EVENTS.UNIT_ATTACKED);
    expect(attackEvent).toBeDefined();
    // 弓箭手基础战力2，无充能加成
    expect((attackEvent!.payload as Record<string, unknown>).diceCount).toBe(2);
  });
});

// ============================================================================
// 5. 撤退 E2E：消耗充能/魔力 → 移动 → 位置变更确认
// ============================================================================

describe('撤退 E2E 流程', () => {
  let core: SummonerWarsCore;

  beforeEach(() => {
    resetInstanceCounter();
    core = createInitializedCore(['0', '1'], testRandom(), { faction0: 'barbaric', faction1: 'necromancer' });
    clearRect(core, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);
  });

  it('撤退消耗充能后单位移动到新位置，后续可正常攻击', () => {
    core.phase = 'attack';
    core.currentPlayer = '0' as PlayerId;

    // 放置凯鲁尊者（真实：STR 4, HP 7, melee，有 withdraw + inspire）
    const kaluCard = mkUnit('barbaric-kalu', {
      faction: 'barbaric', unitClass: 'champion', abilities: ['inspire', 'withdraw'],
      strength: 4, life: 7, attackType: 'melee', attackRange: 1,
    });
    const kalu = putUnit(core, { row: 4, col: 3 }, kaluCard, '0', { boosts: 2, hasAttacked: false });

    // 放置敌方单位（亡灵战士，真实：STR 2, HP 4, melee）
    const enemy = mkUnit('necro-undead-warrior', { faction: 'necromancer', unitClass: 'common', strength: 2, life: 4, attackType: 'melee', attackRange: 1, abilities: ['blood_rage', 'power_boost', 'blood_rage_decay'] });
    putUnit(core, { row: 3, col: 5 }, enemy, '1');

    // --- 步骤1：撤退（消耗1充能，直线移动2格到 (4,5)） ---
    // 先确认路径畅通
    expect(getUnitAt(core, { row: 4, col: 4 })).toBeUndefined();
    expect(getUnitAt(core, { row: 4, col: 5 })).toBeUndefined();

    const { core: coreAfterWithdraw, events: withdrawEvents } = execAndApply(
      core, SW_COMMANDS.ACTIVATE_ABILITY, {
        abilityId: 'withdraw',
        sourceUnitId: kalu.instanceId,
        costType: 'charge',
        targetPosition: { row: 4, col: 5 },
      }
    );

    // 验证充能消耗
    const chargeEvent = withdrawEvents.find(e =>
      e.type === SW_EVENTS.UNIT_CHARGED && (e.payload as Record<string, unknown>).delta === -1
    );
    expect(chargeEvent).toBeDefined();

    // 验证单位移动
    const moveEvent = withdrawEvents.find(e => e.type === SW_EVENTS.UNIT_MOVED);
    expect(moveEvent).toBeDefined();

    // 验证原位置为空
    expect(getUnitAt(coreAfterWithdraw, { row: 4, col: 3 })).toBeUndefined();

    // 验证新位置有单位
    const kaluAfter = getUnitAt(coreAfterWithdraw, { row: 4, col: 5 });
    expect(kaluAfter).toBeDefined();
    expect(kaluAfter!.instanceId).toBe(kalu.instanceId);
    expect(kaluAfter!.boosts).toBe(1); // 2 - 1 = 1
  });
});

// ============================================================================
// 6. 催眠引诱 E2E：拉目标 → 攻击时+1战力
// ============================================================================

describe('催眠引诱 E2E 流程', () => {
  let core: SummonerWarsCore;

  beforeEach(() => {
    resetInstanceCounter();
    core = createInitializedCore(['0', '1'], testRandom(), { faction0: 'trickster', faction1: 'necromancer' });
    clearRect(core, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);
  });

  it('催眠引诱拉目标后，召唤师攻击该目标时+1战力', () => {
    core.phase = 'summon'; // 催眠引诱在 summon 阶段打出
    core.currentPlayer = '0' as PlayerId;

    // 放置召唤师（真实：泰珂露，STR 3, HP 13, ranged(3)）
    const summoner = mkUnit('trickster-summoner', {
      unitClass: 'summoner', faction: 'trickster', abilities: ['mind_capture'],
      strength: 3, life: 13, attackType: 'ranged', attackRange: 3,
    });
    putUnit(core, { row: 4, col: 2 }, summoner, '0');

    // 放置敌方单位（亡灵战士，真实：STR 2, HP 4, melee）
    const enemy = mkUnit('necro-undead-warrior', { faction: 'necromancer', unitClass: 'common', strength: 2, life: 4, attackType: 'melee', attackRange: 1, abilities: ['blood_rage', 'power_boost', 'blood_rage_decay'] });
    const enemyUnit = putUnit(core, { row: 2, col: 2 }, enemy, '1');

    // 手动放入催眠引诱事件卡
    const lureCard = mkEventCard('trickster-hypnotic-lure', {
      faction: 'trickster', isActive: true, playPhase: 'any', cost: 0,
    });
    core.players['0'].hand.push(lureCard as any);

    // --- 步骤1：打出催眠引诱 ---
    const { core: coreAfterLure, events: lureEvents } = execAndApply(
      core, SW_COMMANDS.PLAY_EVENT, {
        cardId: lureCard.id,
        targets: [{ row: 2, col: 2 }],
      }
    );

    // 验证事件卡进入主动事件区
    const activeLure = coreAfterLure.players['0'].activeEvents.find(
      ev => getBaseCardId(ev.id) === CARD_IDS.TRICKSTER_HYPNOTIC_LURE
    );
    expect(activeLure).toBeDefined();
    // 验证目标标记
    expect(activeLure!.targetUnitId).toBe(enemyUnit.instanceId);

    // --- 步骤2：切换到攻击阶段，召唤师攻击被催眠的目标 ---
    const coreForAttack = { ...coreAfterLure };
    coreForAttack.phase = 'attack';

    // 催眠引诱会拉目标向召唤师靠近1格
    // 敌方从 (2,2) 被拉到 (3,2)（同列，向召唤师 (4,2) 靠近）
    const pulledEvent = lureEvents.find(e => e.type === SW_EVENTS.UNIT_PULLED);
    expect(pulledEvent).toBeDefined(); // 确认拉动发生

    // 找到敌方单位当前位置
    let enemyPos: CellCoord | undefined;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 6; c++) {
        const u = getUnitAt(coreForAttack, { row: r, col: c });
        if (u && u.instanceId === enemyUnit.instanceId) {
          enemyPos = { row: r, col: c };
          break;
        }
      }
      if (enemyPos) break;
    }
    expect(enemyPos).toBeDefined();
    // 验证拉动后位置（从 (2,2) 拉到 (3,2)）
    expect(enemyPos!.row).toBe(3);
    expect(enemyPos!.col).toBe(2);

    const { events: attackEvents } = execAndApply(
      coreForAttack, SW_COMMANDS.DECLARE_ATTACK, {
        attacker: { row: 4, col: 2 },
        target: enemyPos!,
      }, allHitRandom()
    );

    const attackEvent = attackEvents.find(e => e.type === SW_EVENTS.UNIT_ATTACKED);
    expect(attackEvent).toBeDefined();
    const atkPayload = attackEvent!.payload as Record<string, unknown>;
    // 召唤师基础战力3 + 催眠引诱+1 = 4
    expect(atkPayload.diceCount).toBe(4);
    expect(atkPayload.baseStrength).toBe(3);
  });
});

// ============================================================================
// 7. 圣洁审判 E2E：放置充能 → 友方士兵+1战力
// ============================================================================

describe('圣洁审判 E2E 流程', () => {
  let core: SummonerWarsCore;

  beforeEach(() => {
    resetInstanceCounter();
    core = createInitializedCore(['0', '1'], testRandom(), { faction0: 'paladin', faction1: 'necromancer' });
    clearRect(core, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);
  });

  it('圣洁审判放置后友方城塞士兵+1战力', () => {
    core.phase = 'summon';
    core.currentPlayer = '0' as PlayerId;

    // 放置召唤师（真实：瑟拉·艾德温，STR 2, HP 12, ranged(3)）
    const summoner = mkUnit('paladin-summoner', {
      unitClass: 'summoner', faction: 'paladin', abilities: ['fortress_power'],
      strength: 2, life: 12, attackType: 'ranged', attackRange: 3,
    });
    putUnit(core, { row: 4, col: 2 }, summoner, '0');

    // 放置城塞骑士（真实：STR 2, HP 5, melee，应该获得+1战力）
    const knightCard = mkUnit('paladin-fortress-knight', {
      faction: 'paladin', unitClass: 'common', abilities: ['entangle', 'guardian'],
      strength: 2, life: 5, attackType: 'melee', attackRange: 1,
    });
    const knight = putUnit(core, { row: 4, col: 3 }, knightCard, '0');

    // 放置敌方单位（亡灵战士，真实：STR 2, HP 4, melee）
    const enemy = mkUnit('necro-undead-warrior', { faction: 'necromancer', unitClass: 'common', strength: 2, life: 4, attackType: 'melee', attackRange: 1, abilities: ['blood_rage', 'power_boost', 'blood_rage_decay'] });
    putUnit(core, { row: 3, col: 3 }, enemy, '1');

    // 攻击前验证基础战力
    const strengthBefore = getEffectiveStrengthValue(knight, core);
    expect(strengthBefore).toBe(2);

    // 手动放入圣洁审判事件卡
    const judgmentCard = mkEventCard('paladin-holy-judgment', {
      faction: 'paladin', isActive: true, playPhase: 'summon', cost: 0,
    });
    core.players['0'].hand.push(judgmentCard as any);

    // --- 打出圣洁审判 ---
    const { core: coreAfterJudgment } = execAndApply(
      core, SW_COMMANDS.PLAY_EVENT, {
        cardId: judgmentCard.id,
      }
    );

    // 验证事件卡进入主动事件区
    const activeJudgment = coreAfterJudgment.players['0'].activeEvents.find(
      ev => getBaseCardId(ev.id) === CARD_IDS.PALADIN_HOLY_JUDGMENT
    );
    expect(activeJudgment).toBeDefined();
    // 验证初始充能为2
    expect(activeJudgment!.charges).toBe(2);

    // 验证城塞士兵战力+1
    const knightAfter = getUnitAt(coreAfterJudgment, { row: 4, col: 3 })!;
    const strengthAfter = getEffectiveStrengthValue(knightAfter, coreAfterJudgment);
    expect(strengthAfter).toBe(3); // 基础2 + 圣洁审判+1 = 3

    // --- 实际攻击验证骰子数量 ---
    const coreForAttack = { ...coreAfterJudgment };
    coreForAttack.phase = 'attack';

    const { events: attackEvents } = execAndApply(
      coreForAttack, SW_COMMANDS.DECLARE_ATTACK, {
        attacker: { row: 4, col: 3 },
        target: { row: 3, col: 3 },
      }, allHitRandom()
    );

    const attackEvent = attackEvents.find(e => e.type === SW_EVENTS.UNIT_ATTACKED);
    expect(attackEvent).toBeDefined();
    expect((attackEvent!.payload as Record<string, unknown>).diceCount).toBe(3);
  });
});

// ============================================================================
// 8. 灵魂羁绊 E2E：充能自身 → 转移充能 → 目标战力提升
// ============================================================================

describe('灵魂羁绊 E2E 流程', () => {
  let core: SummonerWarsCore;

  beforeEach(() => {
    resetInstanceCounter();
    core = createInitializedCore(['0', '1'], testRandom(), { faction0: 'barbaric', faction1: 'necromancer' });
    clearRect(core, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);
  });

  it('灵魂法师转移充能到蒙威尊者，蒙威尊者 power_up 战力提升', () => {
    core.phase = 'move';
    core.currentPlayer = '0' as PlayerId;

    // 放置祖灵法师（真实：STR 1, HP 2, ranged(3)，有 spirit_bond + gather_power）
    const shamanCard = mkUnit('barbaric-spirit-mage', {
      faction: 'barbaric', unitClass: 'common', abilities: ['gather_power', 'spirit_bond'],
      strength: 1, life: 2, attackType: 'ranged', attackRange: 3,
    });
    const shaman = putUnit(core, { row: 4, col: 3 }, shamanCard, '0', { boosts: 3 });

    // 放置蒙威尊者（真实：STR 1, HP 11, melee，有 power_up：战力 += 充能数，最多+5）
    const mokaCard = mkUnit('barbaric-moka', {
      faction: 'barbaric', unitClass: 'champion', abilities: ['power_up', 'trample'],
      strength: 1, life: 11, attackType: 'melee', attackRange: 1,
    });
    const moka = putUnit(core, { row: 4, col: 4 }, mokaCard, '0', { boosts: 0 });

    // 放置敌方单位（亡灵弓箭手，真实：STR 3, HP 2, ranged(3)）
    const enemy = mkUnit('necro-undead-archer', { faction: 'necromancer', unitClass: 'common', strength: 3, life: 2, attackType: 'ranged', attackRange: 3, abilities: ['soul_transfer'] });
    putUnit(core, { row: 3, col: 4 }, enemy, '1');

    // 验证蒙威尊者初始战力（基础1 + power_up(0充能) = 1）
    const mokaStrengthBefore = getEffectiveStrengthValue(moka, core);
    expect(mokaStrengthBefore).toBe(1);

    // --- 步骤1：灵魂法师使用 spirit_bond transfer 转移充能到蒙威尊者 ---
    const { core: coreAfterTransfer, events: transferEvents } = execAndApply(
      core, SW_COMMANDS.ACTIVATE_ABILITY, {
        abilityId: 'spirit_bond',
        sourceUnitId: shaman.instanceId,
        choice: 'transfer',
        targetPosition: { row: 4, col: 4 },
      }
    );

    // 验证充能转移事件
    const chargeEvents = transferEvents.filter(e => e.type === SW_EVENTS.UNIT_CHARGED);
    expect(chargeEvents.length).toBeGreaterThanOrEqual(2); // -1 source, +1 target

    // 验证灵魂法师充能减少
    const shamanAfter = getUnitAt(coreAfterTransfer, { row: 4, col: 3 });
    expect(shamanAfter!.boosts).toBeLessThan(3);

    // 验证蒙威尊者充能增加
    const mokaAfter = getUnitAt(coreAfterTransfer, { row: 4, col: 4 });
    expect(mokaAfter!.boosts).toBeGreaterThan(0);

    // --- 步骤2：验证蒙威尊者战力因 power_up 提升 ---
    const mokaStrengthAfter = getEffectiveStrengthValue(mokaAfter!, coreAfterTransfer);
    // 基础1 + power_up(充能数) = 1 + mokaAfter.boosts
    expect(mokaStrengthAfter).toBe(1 + mokaAfter!.boosts);

    // --- 步骤3：实际攻击验证 ---
    const coreForAttack = { ...coreAfterTransfer };
    coreForAttack.phase = 'attack';

    const { events: attackEvents } = execAndApply(
      coreForAttack, SW_COMMANDS.DECLARE_ATTACK, {
        attacker: { row: 4, col: 4 },
        target: { row: 3, col: 4 },
      }, allHitRandom()
    );

    const attackEvent = attackEvents.find(e => e.type === SW_EVENTS.UNIT_ATTACKED);
    expect(attackEvent).toBeDefined();
    const atkPayload = attackEvent!.payload as Record<string, unknown>;
    // 骰子数量 = 基础1 + power_up(充能数)
    expect(atkPayload.diceCount).toBe(1 + mokaAfter!.boosts);
  });
});

// ============================================================================
// 9. 交缠颂歌 + 连续射击共享：蒙威尊者和弓箭手互相共享技能后都能触发连续射击
// ============================================================================

describe('交缠颂歌 + 连续射击共享 E2E', () => {
  let core: SummonerWarsCore;

  beforeEach(() => {
    resetInstanceCounter();
    core = createInitializedCore(['0', '1'], testRandom(), { faction0: 'barbaric', faction1: 'necromancer' });
    clearRect(core, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);
  });

  it('交缠后蒙威尊者获得 rapid_fire，攻击后触发连续射击获得额外攻击', () => {
    core.phase = 'summon';
    core.currentPlayer = '0' as PlayerId;

    // 放置召唤师（真实：阿布亚·石，STR 5, HP 10, ranged(3)）
    const summoner = mkUnit('barbaric-summoner', { unitClass: 'summoner', faction: 'barbaric', abilities: ['ancestral_bond'], life: 10, strength: 5, attackType: 'ranged', attackRange: 3 });
    putUnit(core, { row: 5, col: 2 }, summoner, '0');

    // 蒙威尊者（trample + power_up），无 rapid_fire
    // 真实属性：strength: 1, life: 11, cost: 8, melee
    const mokaCard = mkUnit('barbaric-moka', {
      faction: 'barbaric', unitClass: 'champion', abilities: ['power_up', 'trample'],
      strength: 1, life: 11, attackType: 'melee', attackRange: 1,
    });
    const moka = putUnit(core, { row: 4, col: 3 }, mokaCard, '0', { boosts: 2 });

    // 边境弓箭手（prepare + rapid_fire）
    // 真实属性：strength: 2, life: 4, cost: 2, ranged, range: 3
    const archerCard = mkUnit('barbaric-frontier-archer', {
      faction: 'barbaric', unitClass: 'common', abilities: ['prepare', 'rapid_fire'],
      strength: 2, life: 4, attackType: 'ranged', attackRange: 3,
    });
    const archer = putUnit(core, { row: 4, col: 4 }, archerCard, '0', { boosts: 1 });

    // 敌方单位（亡灵战士，真实：STR 2, HP 4, melee）
    const enemy1 = mkUnit('necro-undead-warrior', { faction: 'necromancer', unitClass: 'common', strength: 2, life: 4, attackType: 'melee', attackRange: 1, abilities: ['blood_rage', 'power_boost', 'blood_rage_decay'] });
    putUnit(core, { row: 3, col: 3 }, enemy1, '1');

    // 敌方单位（亡灵弓箭手，真实：STR 3, HP 2, ranged(3)）
    const enemy2 = mkUnit('necro-undead-archer', { faction: 'necromancer', unitClass: 'common', strength: 3, life: 2, attackType: 'ranged', attackRange: 3, abilities: ['soul_transfer'] });
    putUnit(core, { row: 2, col: 4 }, enemy2, '1');

    // --- 验证交缠前蒙威尊者没有 rapid_fire ---
    const mokaAbilitiesBefore = getUnitAbilities(moka, core);
    expect(mokaAbilitiesBefore).toContain('trample');
    expect(mokaAbilitiesBefore).toContain('power_up');
    expect(mokaAbilitiesBefore).not.toContain('rapid_fire');

    // --- 打出交缠颂歌 ---
    const entanglementCard = mkEventCard('barbaric-chant-of-entanglement', {
      faction: 'barbaric', isActive: true, playPhase: 'summon', cost: 0,
    });
    core.players['0'].hand.push(entanglementCard as any);

    const { core: coreAfterPlay } = execAndApply(
      core, SW_COMMANDS.PLAY_EVENT, {
        cardId: entanglementCard.id,
        targets: [{ row: 4, col: 3 }, { row: 4, col: 4 }], // 蒙威尊者和弓箭手
      }
    );

    // 验证交缠生效：蒙威尊者获得 rapid_fire + prepare
    const mokaAbilitiesAfter = getUnitAbilities(moka, coreAfterPlay);
    expect(mokaAbilitiesAfter).toContain('trample');
    expect(mokaAbilitiesAfter).toContain('power_up');
    expect(mokaAbilitiesAfter).toContain('rapid_fire');  // 从弓箭手共享
    expect(mokaAbilitiesAfter).toContain('prepare');     // 从弓箭手共享

    // 验证弓箭手获得 trample + power_up
    const archerAbilitiesAfter = getUnitAbilities(archer, coreAfterPlay);
    expect(archerAbilitiesAfter).toContain('prepare');
    expect(archerAbilitiesAfter).toContain('rapid_fire');
    expect(archerAbilitiesAfter).toContain('trample');    // 从蒙威尊者共享
    expect(archerAbilitiesAfter).toContain('power_up');   // 从蒙威尊者共享

    // --- 蒙威尊者攻击 → afterAttack 触发 rapid_fire ---
    const coreForAttack = { ...coreAfterPlay };
    coreForAttack.phase = 'attack';

    const { core: coreAfterMokaAttack, events: mokaAttackEvents } = execAndApply(
      coreForAttack, SW_COMMANDS.DECLARE_ATTACK, {
        attacker: { row: 4, col: 3 },
        target: { row: 3, col: 3 },
      }, allHitRandom()
    );

    // 验证攻击事件
    const mokaAttackEvent = mokaAttackEvents.find(e => e.type === SW_EVENTS.UNIT_ATTACKED);
    expect(mokaAttackEvent).toBeDefined();
    // 蒙威尊者基础战力1 + power_up(2充能) = 3
    expect((mokaAttackEvent!.payload as Record<string, unknown>).diceCount).toBe(3);

    // 验证 afterAttack 触发了 rapid_fire 的 ABILITY_TRIGGERED 事件
    const rapidFireTrigger = mokaAttackEvents.find(e =>
      e.type === SW_EVENTS.ABILITY_TRIGGERED
      && (e.payload as Record<string, unknown>).actionId === 'rapid_fire_extra_attack'
    );
    expect(rapidFireTrigger).toBeDefined();

    // --- 蒙威尊者执行 rapid_fire（消耗1充能，获得额外攻击） ---
    const { core: coreAfterRapidFire, events: rapidFireEvents } = execAndApply(
      coreAfterMokaAttack, SW_COMMANDS.ACTIVATE_ABILITY, {
        abilityId: 'rapid_fire',
        sourceUnitId: moka.instanceId,
      }
    );

    // 验证充能消耗
    const chargeEvent = rapidFireEvents.find(e =>
      e.type === SW_EVENTS.UNIT_CHARGED && (e.payload as Record<string, unknown>).delta === -1
    );
    expect(chargeEvent).toBeDefined();

    // 验证额外攻击授予
    const extraAttackEvent = rapidFireEvents.find(e => e.type === SW_EVENTS.EXTRA_ATTACK_GRANTED);
    expect(extraAttackEvent).toBeDefined();

    // 验证蒙威尊者充能减少（2 → 1）
    const mokaAfterRapidFire = getUnitAt(coreAfterRapidFire, { row: 4, col: 3 });
    expect(mokaAfterRapidFire!.boosts).toBe(1);
    expect(mokaAfterRapidFire!.extraAttacks).toBeGreaterThanOrEqual(1);
  });

  it('交缠后弓箭手也能正常触发自身的 rapid_fire', () => {
    core.phase = 'summon';
    core.currentPlayer = '0' as PlayerId;

    const summoner = mkUnit('barbaric-summoner', { unitClass: 'summoner', faction: 'barbaric', abilities: ['ancestral_bond'], life: 10, strength: 5, attackType: 'ranged', attackRange: 3 });
    putUnit(core, { row: 5, col: 2 }, summoner, '0');

    // 蒙威尊者（真实属性：strength: 1, life: 11）
    const mokaCard = mkUnit('barbaric-moka', {
      faction: 'barbaric', unitClass: 'champion', abilities: ['power_up', 'trample'],
      strength: 1, life: 11, attackType: 'melee', attackRange: 1,
    });
    const moka = putUnit(core, { row: 4, col: 3 }, mokaCard, '0', { boosts: 1 });

    // 边境弓箭手（真实属性：strength: 2, life: 4）
    const archerCard = mkUnit('barbaric-frontier-archer', {
      faction: 'barbaric', unitClass: 'common', abilities: ['prepare', 'rapid_fire'],
      strength: 2, life: 4, attackType: 'ranged', attackRange: 3,
    });
    const archer = putUnit(core, { row: 4, col: 4 }, archerCard, '0', { boosts: 1 });

    // 敌方单位（亡灵弓箭手，真实：STR 3, HP 2, ranged(3)）— 给足够 HP 以存活两次攻击
    const enemy = mkUnit('necro-undead-archer', { faction: 'necromancer', unitClass: 'common', strength: 3, life: 10, attackType: 'ranged', attackRange: 3, abilities: ['soul_transfer'] });
    putUnit(core, { row: 2, col: 4 }, enemy, '1');

    // 打出交缠颂歌
    const entanglementCard = mkEventCard('barbaric-chant-of-entanglement', {
      faction: 'barbaric', isActive: true, playPhase: 'summon', cost: 0,
    });
    core.players['0'].hand.push(entanglementCard as any);

    const { core: coreAfterPlay } = execAndApply(
      core, SW_COMMANDS.PLAY_EVENT, {
        cardId: entanglementCard.id,
        targets: [{ row: 4, col: 3 }, { row: 4, col: 4 }],
      }
    );

    // --- 弓箭手攻击 → afterAttack 触发 rapid_fire ---
    const coreForAttack = { ...coreAfterPlay };
    coreForAttack.phase = 'attack';

    const { core: coreAfterArcherAttack, events: archerAttackEvents } = execAndApply(
      coreForAttack, SW_COMMANDS.DECLARE_ATTACK, {
        attacker: { row: 4, col: 4 },
        target: { row: 2, col: 4 },
      }, allHitRandom()
    );

    // 验证攻击事件（弓箭手基础战力2 + 交缠共享的 power_up(1充能) = 3）
    const archerAttackEvent = archerAttackEvents.find(e => e.type === SW_EVENTS.UNIT_ATTACKED);
    expect(archerAttackEvent).toBeDefined();
    expect((archerAttackEvent!.payload as Record<string, unknown>).diceCount).toBe(3);

    // 验证 afterAttack 触发了 rapid_fire
    const rapidFireTrigger = archerAttackEvents.find(e =>
      e.type === SW_EVENTS.ABILITY_TRIGGERED
      && (e.payload as Record<string, unknown>).actionId === 'rapid_fire_extra_attack'
    );
    expect(rapidFireTrigger).toBeDefined();

    // 弓箭手执行 rapid_fire
    const { core: coreAfterRapidFire, events: rapidFireEvents } = execAndApply(
      coreAfterArcherAttack, SW_COMMANDS.ACTIVATE_ABILITY, {
        abilityId: 'rapid_fire',
        sourceUnitId: archer.instanceId,
      }
    );

    const extraAttackEvent = rapidFireEvents.find(e => e.type === SW_EVENTS.EXTRA_ATTACK_GRANTED);
    expect(extraAttackEvent).toBeDefined();

    const archerAfter = getUnitAt(coreAfterRapidFire, { row: 4, col: 4 });
    expect(archerAfter!.boosts).toBe(0); // 1 - 1 = 0
    expect(archerAfter!.extraAttacks).toBeGreaterThanOrEqual(1);

    // --- 弓箭手用额外攻击打第二次 ---
    const { core: coreAfterAttack2, events: attack2Events } = execAndApply(
      coreAfterRapidFire, SW_COMMANDS.DECLARE_ATTACK, {
        attacker: { row: 4, col: 4 },
        target: { row: 2, col: 4 },
      }, allHitRandom()
    );

    const attack2Event = attack2Events.find(e => e.type === SW_EVENTS.UNIT_ATTACKED);
    expect(attack2Event).toBeDefined();
    // 第二次攻击：基础2 + 交缠共享的 power_up(0充能，已被 rapid_fire 消耗) = 2
    expect((attack2Event!.payload as Record<string, unknown>).diceCount).toBe(2);

    // 验证额外攻击已消耗
    const archerAfter2 = getUnitAt(coreAfterAttack2, { row: 4, col: 4 });
    expect(archerAfter2!.hasAttacked).toBe(true);
  });

  it('蒙威尊者无充能时，交缠共享的 rapid_fire 攻击后不触发且验证拒绝', () => {
    core.phase = 'summon';
    core.currentPlayer = '0' as PlayerId;

    const summoner = mkUnit('barbaric-summoner', { unitClass: 'summoner', faction: 'barbaric', abilities: ['ancestral_bond'], life: 10, strength: 5, attackType: 'ranged', attackRange: 3 });
    putUnit(core, { row: 5, col: 2 }, summoner, '0');

    // 蒙威尊者无充能（真实属性：strength: 1, life: 11）
    const mokaCard = mkUnit('barbaric-moka', {
      faction: 'barbaric', unitClass: 'champion', abilities: ['power_up', 'trample'],
      strength: 1, life: 11, attackType: 'melee', attackRange: 1,
    });
    const moka = putUnit(core, { row: 4, col: 3 }, mokaCard, '0', { boosts: 0 });

    // 边境弓箭手（真实属性：strength: 2, life: 4）
    const archerCard = mkUnit('barbaric-frontier-archer', {
      faction: 'barbaric', unitClass: 'common', abilities: ['prepare', 'rapid_fire'],
      strength: 2, life: 4, attackType: 'ranged', attackRange: 3,
    });
    putUnit(core, { row: 4, col: 4 }, archerCard, '0', { boosts: 1 });

    const enemy = mkUnit('necro-undead-warrior', { faction: 'necromancer', unitClass: 'common', strength: 2, life: 4, attackType: 'melee', attackRange: 1, abilities: ['blood_rage', 'power_boost', 'blood_rage_decay'] });
    putUnit(core, { row: 3, col: 3 }, enemy, '1');

    // 打出交缠颂歌
    const entanglementCard = mkEventCard('barbaric-chant-of-entanglement', {
      faction: 'barbaric', isActive: true, playPhase: 'summon', cost: 0,
    });
    core.players['0'].hand.push(entanglementCard as any);

    const { core: coreAfterPlay } = execAndApply(
      core, SW_COMMANDS.PLAY_EVENT, {
        cardId: entanglementCard.id,
        targets: [{ row: 4, col: 3 }, { row: 4, col: 4 }],
      }
    );

    // 确认蒙威尊者确实拥有 rapid_fire（交缠共享）
    const mokaAbilities = getUnitAbilities(moka, coreAfterPlay);
    expect(mokaAbilities).toContain('rapid_fire');

    // 蒙威尊者攻击
    const coreForAttack = { ...coreAfterPlay };
    coreForAttack.phase = 'attack';

    const { core: coreAfterAttack, events: attackEvents } = execAndApply(
      coreForAttack, SW_COMMANDS.DECLARE_ATTACK, {
        attacker: { row: 4, col: 3 },
        target: { row: 3, col: 3 },
      }, allHitRandom()
    );

    // rapid_fire 的 customValidator 要求 boosts >= 1，蒙威尊者 boosts=0
    // afterAttack 触发时 usesPerTurn 检查通过，但 customValidator 在 resolveAbilityEffects 中不检查
    // 实际上 afterAttack 的 ABILITY_TRIGGERED 事件仍会产生（通知 UI），
    // 但玩家尝试 ACTIVATE_ABILITY(rapid_fire) 时验证层会拒绝
    const state = { core: coreAfterAttack } as MatchState<SummonerWarsCore>;
    const result = validateCommand(state, {
      type: SW_COMMANDS.ACTIVATE_ABILITY,
      payload: { abilityId: 'rapid_fire', sourceUnitId: moka.instanceId },
      timestamp: Date.now(),
      playerId: '0',
    });
    expect(result.valid).toBe(false);

    // 验证蒙威尊者没有获得额外攻击
    const mokaAfter = getUnitAt(coreAfterAttack, { row: 4, col: 3 });
    expect(mokaAfter!.extraAttacks ?? 0).toBe(0);
  });

  it('蒙威尊者攻击后触发共享的 rapid_fire，再用额外攻击打第二次', () => {
    core.phase = 'summon';
    core.currentPlayer = '0' as PlayerId;

    const summoner = mkUnit('barbaric-summoner', { unitClass: 'summoner', faction: 'barbaric', abilities: ['ancestral_bond'], life: 10, strength: 5, attackType: 'ranged', attackRange: 3 });
    putUnit(core, { row: 5, col: 2 }, summoner, '0');

    // 蒙威尊者（真实属性：strength: 1, life: 11）
    const mokaCard = mkUnit('barbaric-moka', {
      faction: 'barbaric', unitClass: 'champion', abilities: ['power_up', 'trample'],
      strength: 1, life: 11, attackType: 'melee', attackRange: 1,
    });
    const moka = putUnit(core, { row: 4, col: 3 }, mokaCard, '0', { boosts: 2 });

    // 边境弓箭手（真实属性：strength: 2, life: 4）
    const archerCard = mkUnit('barbaric-frontier-archer', {
      faction: 'barbaric', unitClass: 'common', abilities: ['prepare', 'rapid_fire'],
      strength: 2, life: 4, attackType: 'ranged', attackRange: 3,
    });
    putUnit(core, { row: 4, col: 4 }, archerCard, '0', { boosts: 1 });

    const enemy = mkUnit('necro-undead-warrior', { faction: 'necromancer', unitClass: 'common', strength: 2, life: 15, attackType: 'melee', attackRange: 1, abilities: ['blood_rage', 'power_boost', 'blood_rage_decay'] });
    putUnit(core, { row: 3, col: 3 }, enemy, '1');

    // 打出交缠颂歌
    const entanglementCard = mkEventCard('barbaric-chant-of-entanglement', {
      faction: 'barbaric', isActive: true, playPhase: 'summon', cost: 0,
    });
    core.players['0'].hand.push(entanglementCard as any);

    const { core: coreAfterPlay } = execAndApply(
      core, SW_COMMANDS.PLAY_EVENT, {
        cardId: entanglementCard.id,
        targets: [{ row: 4, col: 3 }, { row: 4, col: 4 }],
      }
    );

    // --- 第一次攻击 ---
    const coreForAttack = { ...coreAfterPlay };
    coreForAttack.phase = 'attack';

    const { core: coreAfterAttack1 } = execAndApply(
      coreForAttack, SW_COMMANDS.DECLARE_ATTACK, {
        attacker: { row: 4, col: 3 },
        target: { row: 3, col: 3 },
      }, allHitRandom()
    );

    // 执行 rapid_fire 获得额外攻击
    const { core: coreAfterRapidFire } = execAndApply(
      coreAfterAttack1, SW_COMMANDS.ACTIVATE_ABILITY, {
        abilityId: 'rapid_fire',
        sourceUnitId: moka.instanceId,
      }
    );

    const mokaAfterRF = getUnitAt(coreAfterRapidFire, { row: 4, col: 3 });
    expect(mokaAfterRF!.extraAttacks).toBeGreaterThanOrEqual(1);
    expect(mokaAfterRF!.boosts).toBe(1); // 2 - 1 = 1

    // --- 第二次攻击（使用额外攻击） ---
    const { core: coreAfterAttack2, events: attack2Events } = execAndApply(
      coreAfterRapidFire, SW_COMMANDS.DECLARE_ATTACK, {
        attacker: { row: 4, col: 3 },
        target: { row: 3, col: 3 },
      }, allHitRandom()
    );

    const attack2Event = attack2Events.find(e => e.type === SW_EVENTS.UNIT_ATTACKED);
    expect(attack2Event).toBeDefined();
    // 第二次攻击：基础1 + power_up(1充能) = 2（第一次消耗了1充能）
    expect((attack2Event!.payload as Record<string, unknown>).diceCount).toBe(2);

    // 验证额外攻击已消耗
    const mokaAfterAttack2 = getUnitAt(coreAfterAttack2, { row: 4, col: 3 });
    expect(mokaAfterAttack2!.hasAttacked).toBe(true);
  });
});

// ============================================================================
// 10. 寒冰碎屑 E2E：建造阶段结束 → 消耗充能 → 建筑相邻敌方受伤
// ============================================================================

describe('寒冰碎屑 E2E 流程', () => {
  let core: SummonerWarsCore;

  beforeEach(() => {
    resetInstanceCounter();
    core = createInitializedCore(['0', '1'], testRandom(), { faction0: 'frost', faction1: 'necromancer' });
    clearRect(core, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);
  });

  it('寒冰碎屑消耗充能后对建筑相邻敌方造成1伤', () => {
    core.phase = 'build';
    core.currentPlayer = '0' as PlayerId;

    // 放置贾穆德（真实：STR 3, HP 7, ranged(3)，有 ice_shards + imposing）
    const jarmundCard = mkUnit('frost-jarmund', {
      faction: 'frost', unitClass: 'champion', abilities: ['imposing', 'ice_shards'],
      strength: 3, life: 7, attackType: 'ranged', attackRange: 3,
    });
    const jarmund = putUnit(core, { row: 4, col: 3 }, jarmundCard, '0', { boosts: 2 });

    // 放置友方建筑（冰墙）
    core.board[3][3].structure = { id: 'ice-wall-1', type: 'wall', owner: '0' as PlayerId, life: 3, damage: 0 };

    // 放置敌方单位（亡灵战士，真实：STR 2, HP 4, melee，与建筑相邻）
    const enemy = mkUnit('necro-undead-warrior', { faction: 'necromancer', unitClass: 'common', strength: 2, life: 4, attackType: 'melee', attackRange: 1, abilities: ['blood_rage', 'power_boost', 'blood_rage_decay'] });
    const enemyUnit = putUnit(core, { row: 3, col: 4 }, enemy, '1');

    // 验证敌方初始无伤
    expect(enemyUnit.damage).toBe(0);

    // --- 执行寒冰碎屑 ---
    const { core: coreAfterShards, events: shardsEvents } = execAndApply(
      core, SW_COMMANDS.ACTIVATE_ABILITY, {
        abilityId: 'ice_shards',
        sourceUnitId: jarmund.instanceId,
      }
    );

    // 验证充能消耗
    const chargeEvent = shardsEvents.find(e =>
      e.type === SW_EVENTS.UNIT_CHARGED && (e.payload as Record<string, unknown>).delta === -1
    );
    expect(chargeEvent).toBeDefined();

    // 验证伤害事件
    const damageEvent = shardsEvents.find(e =>
      e.type === SW_EVENTS.UNIT_DAMAGED
      && (e.payload as Record<string, unknown>).reason === 'ice_shards'
    );
    expect(damageEvent).toBeDefined();

    // 验证敌方受伤
    const enemyAfter = getUnitAt(coreAfterShards, { row: 3, col: 4 });
    expect(enemyAfter).toBeDefined();
    expect(enemyAfter!.damage).toBe(1);

    // 验证贾穆德充能减少
    const jarmundAfter = getUnitAt(coreAfterShards, { row: 4, col: 3 });
    expect(jarmundAfter!.boosts).toBe(1); // 2 - 1 = 1
  });

  it('寒冰碎屑对多个建筑相邻的不同敌方都造成伤害', () => {
    core.phase = 'build';
    core.currentPlayer = '0' as PlayerId;

    const jarmundCard = mkUnit('frost-jarmund', {
      faction: 'frost', unitClass: 'champion', abilities: ['imposing', 'ice_shards'],
      strength: 3, life: 7, attackType: 'ranged', attackRange: 3,
    });
    const jarmund = putUnit(core, { row: 5, col: 2 }, jarmundCard, '0', { boosts: 1 });

    // 两个友方建筑
    core.board[3][2].structure = { id: 'ice-wall-a', type: 'wall', owner: '0' as PlayerId, life: 3, damage: 0 };
    core.board[3][4].structure = { id: 'ice-wall-b', type: 'wall', owner: '0' as PlayerId, life: 3, damage: 0 };

    // 敌方单位分别与不同建筑相邻（亡灵战士，真实：STR 2, HP 4, melee）
    const enemyA = mkUnit('necro-undead-warrior', { faction: 'necromancer', unitClass: 'common', strength: 2, life: 4, attackType: 'melee', attackRange: 1, abilities: ['blood_rage', 'power_boost', 'blood_rage_decay'] });
    putUnit(core, { row: 3, col: 3 }, enemyA, '1'); // 与 ice-wall-a 相邻

    const enemyB = mkUnit('necro-hellfire-cultist', { faction: 'necromancer', unitClass: 'common', strength: 2, life: 2, attackType: 'ranged', attackRange: 3, abilities: ['sacrifice'] });
    putUnit(core, { row: 3, col: 5 }, enemyB, '1'); // 与 ice-wall-b 相邻

    const { core: coreAfter, events } = execAndApply(
      core, SW_COMMANDS.ACTIVATE_ABILITY, {
        abilityId: 'ice_shards',
        sourceUnitId: jarmund.instanceId,
      }
    );

    // 验证两个敌方都受伤
    const damageEvents = events.filter(e =>
      e.type === SW_EVENTS.UNIT_DAMAGED && (e.payload as Record<string, unknown>).reason === 'ice_shards'
    );
    expect(damageEvents.length).toBe(2);

    expect(getUnitAt(coreAfter, { row: 3, col: 3 })!.damage).toBe(1);
    expect(getUnitAt(coreAfter, { row: 3, col: 5 })!.damage).toBe(1);
  });

  it('无充能时寒冰碎屑不可激活', () => {
    core.phase = 'build';
    core.currentPlayer = '0' as PlayerId;

    const jarmundCard = mkUnit('frost-jarmund', {
      faction: 'frost', unitClass: 'champion', abilities: ['imposing', 'ice_shards'],
      strength: 3, life: 7, attackType: 'ranged', attackRange: 3,
    });
    const jarmund = putUnit(core, { row: 4, col: 3 }, jarmundCard, '0', { boosts: 0 }); // 无充能

    core.board[3][3].structure = { id: 'ice-wall-1', type: 'wall', owner: '0' as PlayerId, life: 3, damage: 0 };
    putUnit(core, { row: 3, col: 4 }, mkUnit('necro-undead-warrior', { faction: 'necromancer', unitClass: 'common', strength: 2, life: 4, attackType: 'melee', attackRange: 1, abilities: ['blood_rage', 'power_boost', 'blood_rage_decay'] }), '1');

    const state = { core } as MatchState<SummonerWarsCore>;
    const result = validateCommand(state, {
      type: SW_COMMANDS.ACTIVATE_ABILITY,
      payload: { abilityId: 'ice_shards', sourceUnitId: jarmund.instanceId },
      timestamp: Date.now(),
      playerId: '0',
    });
    expect(result.valid).toBe(false);
  });

  it('无充能时执行器也不产生任何事件（防御性）', () => {
    core.phase = 'build';
    core.currentPlayer = '0' as PlayerId;

    const jarmundCard = mkUnit('frost-jarmund', {
      faction: 'frost', unitClass: 'champion', abilities: ['imposing', 'ice_shards'],
      strength: 3, life: 7, attackType: 'ranged', attackRange: 3,
    });
    const jarmund = putUnit(core, { row: 4, col: 3 }, jarmundCard, '0', { boosts: 0 });

    core.board[3][3].structure = { id: 'ice-wall-1', type: 'wall', owner: '0' as PlayerId, life: 3, damage: 0 };
    putUnit(core, { row: 3, col: 4 }, mkUnit('necro-undead-warrior', { faction: 'necromancer', unitClass: 'common', strength: 2, life: 4, attackType: 'melee', attackRange: 1, abilities: ['blood_rage', 'power_boost', 'blood_rage_decay'] }), '1');

    // 绕过验证直接执行，确认执行器本身也有防御
    const events = exec(core, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'ice_shards',
      sourceUnitId: jarmund.instanceId,
    });

    // 执行器检查 boosts < 1 后直接返回空事件
    const chargeEvents = events.filter(e => e.type === SW_EVENTS.UNIT_CHARGED);
    const damageEvents = events.filter(e => e.type === SW_EVENTS.UNIT_DAMAGED);
    expect(chargeEvents.length).toBe(0);
    expect(damageEvents.length).toBe(0);
  });
});
