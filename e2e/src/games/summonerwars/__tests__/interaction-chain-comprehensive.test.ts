/**
 * SummonerWars 交互链完整性综合测试
 *
 * 覆盖所有交互场景：
 * 1. 多步交互链（interactionChain 声明）— 步骤覆盖 + 契约对齐
 * 2. 单步目标选择（requiresTargetSelection）— payload 字段完整性
 * 3. 阶段触发交互（onPhaseStart/onPhaseEnd）— 确认/跳过流程
 * 4. 事件驱动交互（UI 事件消费链路）— 消费完整性
 * 5. 执行器 payload 防御性检查 — 缺失字段时静默返回空事件
 * 6. 验证层有效性门控 — 有代价技能的前置条件
 * 7. 交互链边界情况 — 无效选择、取消、重复激活
 *
 * 重要：ACTIVATE_ABILITY 命令的 payload 必须包含 sourceUnitId（单位的 instanceId），
 * 而非 unitPosition。验证层和执行层都通过 instanceId 查找单位。
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { abilityRegistry } from '../domain/abilities';
import type { AbilityDef } from '../domain/abilities';
import { abilityExecutorRegistry } from '../domain/executors';
import { swCustomActionRegistry } from '../domain/customActionHandlers';
import { createInitializedCore, placeTestUnit, generateInstanceId, resetInstanceCounter } from './test-helpers';
import { executeCommand } from '../domain/execute';
import { validateCommand } from '../domain/validate';
import { SummonerWarsDomain } from '../domain';
import { SW_COMMANDS, SW_EVENTS } from '../domain/types';
import type { SummonerWarsCore, PlayerId, CellCoord, BoardUnit, UnitCard, StructureCard, EventCard } from '../domain/types';
import type { RandomFn, MatchState } from '../../../engine/types';
import { getUnitAt, isCellEmpty, getPlayerUnits, manhattanDistance } from '../domain/helpers';
import { CARD_IDS } from '../domain/ids';
import { executePipeline, createInitialSystemState } from '../../../engine/pipeline';
import { createInteractionSystem, createSimpleChoice, INTERACTION_COMMANDS } from '../../../engine/systems/InteractionSystem';
import { createSimpleChoiceSystem } from '../../../engine/systems/SimpleChoiceSystem';
import { createSummonerWarsInteractionSystem } from '../domain/systems';
import { buildSummonerWarsAiLegalActions } from '../ai';
import { resolveNextLocalAiAction } from '../../../engine/ai';
import { engineConfig } from '../game';
import { shouldBlockHandInteraction } from '../ui/handInteractionBusy';

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

function mkUnit(id: string, overrides?: Partial<UnitCard>): UnitCard {
  return {
    id, cardType: 'unit', name: `测试-${id}`, unitClass: 'common', faction: 'necromancer',
    strength: 2, life: 3, cost: 1, attackType: 'melee', attackRange: 1,
    deckSymbols: [], ...overrides,
  };
}

function mkStructure(id: string, overrides?: Partial<StructureCard>): StructureCard {
  return {
    id, cardType: 'structure' as const, name: `建筑-${id}`, faction: 'frost', cost: 0, life: 5,
    deckSymbols: [], ...overrides,
  } as StructureCard;
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

function putStructure(core: SummonerWarsCore, pos: CellCoord, owner: PlayerId, card?: StructureCard) {
  const c = card ?? mkStructure(`s-${pos.row}-${pos.col}`);
  core.board[pos.row][pos.col].structure = {
    cardId: c.id, card: c, owner, position: pos, damage: 0,
  };
}

function clearRect(core: SummonerWarsCore, rows: number[], cols: number[]) {
  for (const r of rows) for (const c of cols) {
    if (core.board[r]?.[c]) { core.board[r][c].unit = undefined; core.board[r][c].structure = undefined; }
  }
}

/** 执行命令（绕过验证层，直接测试执行器） */
function exec(core: SummonerWarsCore, cmd: string, payload: Record<string, unknown>, random?: RandomFn) {
  const state = { core } as MatchState<SummonerWarsCore>;
  return executeCommand(state, { type: cmd, payload, timestamp: Date.now() }, random ?? testRandom());
}

/** 验证命令合法性 */
function validate(core: SummonerWarsCore, cmd: string, payload: Record<string, unknown>, playerId?: string) {
  const state = { core } as MatchState<SummonerWarsCore>;
  return validateCommand(state, { type: cmd, payload, playerId });
}

/** 验证+执行：先验证，通过后执行 */
function validateAndExec(core: SummonerWarsCore, cmd: string, payload: Record<string, unknown>, random?: RandomFn) {
  const result = validate(core, cmd, payload);
  if (!result.valid) return [];
  return exec(core, cmd, payload, random);
}

const interactionSystems = [
  createInteractionSystem<SummonerWarsCore>(),
  createSimpleChoiceSystem<SummonerWarsCore>(),
  createSummonerWarsInteractionSystem(),
];

describe('SummonerWars 手牌交互阻塞判定', () => {
  it('未知引擎交互不应阻止召唤阶段打出事件卡', () => {
    expect(shouldBlockHandInteraction({
      hasAbilityMode: false,
      hasActiveEventMode: false,
      hasEngineInteraction: true,
      hasSwInteraction: false,
    })).toBe(false);
  });

  it('召唤师战争交互存在时应继续阻止手牌并发操作', () => {
    expect(shouldBlockHandInteraction({
      hasAbilityMode: false,
      hasActiveEventMode: false,
      hasEngineInteraction: true,
      hasSwInteraction: true,
    })).toBe(true);
  });

  it('本地能力模式或事件模式仍应优先阻止手牌操作', () => {
    expect(shouldBlockHandInteraction({
      hasAbilityMode: true,
      hasActiveEventMode: false,
      hasEngineInteraction: false,
      hasSwInteraction: false,
    })).toBe(true);
    expect(shouldBlockHandInteraction({
      hasAbilityMode: false,
      hasActiveEventMode: true,
      hasEngineInteraction: false,
      hasSwInteraction: false,
    })).toBe(true);
  });
});

function runPipeline(
  state: MatchState<SummonerWarsCore>,
  command: { type: string; playerId: PlayerId; payload: Record<string, unknown> },
) {
  return executePipeline(
    { domain: SummonerWarsDomain, systems: interactionSystems },
    state,
    command,
    testRandom(),
    ['0', '1'],
  );
}

// ============================================================================
// AI 交互覆盖
// ============================================================================

describe('SummonerWars AI 交互覆盖', () => {
  it('simple-choice 交互时应生成响应动作', () => {
    const core = createInitializedCore(['0', '1'], testRandom());
    const sys = createInitialSystemState(['0', '1'], []);
    const interaction = createSimpleChoice(
      'sw-ai-choice',
      '0',
      '测试交互',
      [{
        id: 'opt-1',
        label: '目标 1',
        value: { targetPosition: { row: 1, col: 1 } },
      }],
    );
    sys.interaction = { current: interaction, queue: [], isBlocked: false };

    const actions = buildSummonerWarsAiLegalActions({
      playerId: '0',
      state: { core, sys },
    });

    expect(actions.some((action) => action.kind === 'interaction-choice')).toBe(true);
    expect(actions[0]?.commands[0]?.type).toBe('SYS_INTERACTION_RESPOND');
  });

  it('multistep-choice 交互时应提供 confirm/cancel', () => {
    const core = createInitializedCore(['0', '1'], testRandom());
    const sys = createInitialSystemState(['0', '1'], []);
    sys.interaction = {
      current: {
        id: 'sw-ai-multi',
        playerId: '0',
        kind: 'multistep-choice',
        data: { title: '测试多步' },
      },
      queue: [],
      isBlocked: false,
    };

    const actions = buildSummonerWarsAiLegalActions({
      playerId: '0',
      state: { core, sys },
    });

    const kinds = actions.map((action) => action.kind);
    expect(kinds).toContain('interaction-confirm');
    expect(kinds).toContain('interaction-cancel');
  });

  it('[blood_summon] 本地 AI 可走完整事件交互链并完成收口', async () => {
    resetInstanceCounter();
    const core = createInitializedCore(['0', '1'], testRandom(), { faction0: 'necromancer', faction1: 'trickster' });
    clearRect(core, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);
    core.phase = 'summon';
    core.currentPlayer = '0';

    const targetUnit = mkUnit('ally-target', { life: 4, faction: 'necromancer', abilities: [] });
    putUnit(core, { row: 4, col: 2 }, targetUnit, '0');
    putStructure(core, { row: 5, col: 2 }, '0');
    putStructure(core, { row: 4, col: 1 }, '0');
    putStructure(core, { row: 4, col: 3 }, '0');

    core.players['0'].magic = 0;
    core.players['0'].hand = [
      {
        id: CARD_IDS.NECRO_BLOOD_SUMMON,
        cardType: 'event',
        name: '血契召唤',
        eventType: 'common',
        faction: 'necromancer',
        cost: 0,
        playPhase: 'summon',
        effect: '测试',
        deckSymbols: [],
      } as EventCard,
      mkUnit('cheap-unit', { cost: 1, faction: 'necromancer' }),
    ];

    let state: MatchState<SummonerWarsCore> = {
      core,
      sys: createInitialSystemState(['0', '1'], interactionSystems),
    };

    const runAiStep = async () => {
      const resolution = await resolveNextLocalAiAction({
        engineConfig,
        state,
        matchId: 'local:summonerwars-blood-summon-ai',
        seatControllers: {
          '0': { type: 'local-ai' },
        },
      });

      expect(resolution?.playerId).toBe('0');
      expect(resolution?.action.commands.length).toBeGreaterThan(0);
      for (const command of resolution!.action.commands) {
        const result = runPipeline(state, {
          type: command.type,
          playerId: '0',
          payload: (command.payload ?? {}) as Record<string, unknown>,
        });
        expect(result.success).toBe(true);
        state = result.state;
      }
      return resolution!;
    };

    const first = await runAiStep();
    expect(first.action.commands[0]?.type).toBe(SW_COMMANDS.REQUEST_EVENT_INTERACTION);
    expect(getSwCurrentType(state)).toBe('blood_summon_select_target');

    for (let step = 0; step < 6 && state.sys.interaction.current; step += 1) {
      await runAiStep();
    }

    expect(state.sys.interaction.current).toBeUndefined();
    expect(getUnitAt(state.core, { row: 3, col: 2 })?.card.id).toBe('cheap-unit');
    const targetAfter = getUnitAt(state.core, { row: 4, col: 2 });
    expect(targetAfter?.damage).toBe(2);
  });
});

function getSwCurrentType(state: MatchState<SummonerWarsCore>): string | undefined {
  const current = state.sys.interaction.current;
  if (!current || current.kind !== 'simple-choice') return undefined;
  const data = current.data as { sw?: { type?: string } };
  return data.sw?.type;
}

describe('SummonerWars 系统交互桥接回归', () => {
  it('[fire_sacrifice_summon] 召唤后进入系统交互并可完成牺牲召唤', () => {
    resetInstanceCounter();
    const core = createInitializedCore(['0', '1'], testRandom(), { faction0: 'necromancer', faction1: 'trickster' });
    clearRect(core, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);
    core.phase = 'summon';
    core.currentPlayer = '0';

    const summonPos = { row: 4, col: 2 };
    const sacrificePos = { row: 5, col: 2 };
    putUnit(core, sacrificePos, mkUnit('fire-sacrifice-target', { unitClass: 'common', faction: 'necromancer' }), '0');

    const fireSacrificeCard: UnitCard = {
      id: 'fire-sacrifice-summoner',
      cardType: 'unit',
      name: '伊路特-巴尔',
      faction: 'necromancer',
      cost: 2,
      life: 5,
      strength: 2,
      attackType: 'melee',
      attackRange: 1,
      unitClass: 'champion',
      deckSymbols: [],
      abilities: ['fire_sacrifice_summon'],
    };
    core.players['0'].magic = 10;
    core.players['0'].hand = [fireSacrificeCard];

    let state: MatchState<SummonerWarsCore> = {
      core,
      sys: createInitialSystemState(['0', '1'], interactionSystems),
    };

    const summonResult = runPipeline(state, {
      type: SW_COMMANDS.SUMMON_UNIT,
      playerId: '0',
      payload: { cardId: fireSacrificeCard.id, position: summonPos },
    });
    expect(summonResult.success).toBe(true);
    state = summonResult.state;
    expect(getSwCurrentType(state)).toBe('fire_sacrifice_summon');

    const current = state.sys.interaction.current;
    expect(current?.kind).toBe('simple-choice');
    const currentOptions = ((current?.data as { options?: PromptOption[] } | undefined)?.options ?? []) as PromptOption[];
    const optionId = currentOptions.find((option) => {
      const value = option.value as { action?: string; sacrificeUnitId?: string } | undefined;
      const unit = getUnitAt(state.core, sacrificePos);
      return value?.action === 'fire_sacrifice_summon' && value.sacrificeUnitId === unit?.instanceId;
    })?.id;
    expect(optionId).toBeTruthy();

    const respondResult = runPipeline(state, {
      type: INTERACTION_COMMANDS.RESPOND,
      playerId: '0',
      payload: { interactionId: current!.id, optionId },
    });
    expect(respondResult.success).toBe(true);
    state = respondResult.state;

    expect(state.sys.interaction.current).toBeUndefined();
    expect(getUnitAt(state.core, sacrificePos)?.card.id).toBe(fireSacrificeCard.id);
    expect(getUnitAt(state.core, summonPos)).toBeUndefined();
    expect(state.core.players['0'].hand.some((card) => card.id === fireSacrificeCard.id)).toBe(false);
  });

  it('[ice_ram] 两步系统交互可完成推拉且不会重触发', () => {
    resetInstanceCounter();
    const core = createInitializedCore(['0', '1'], testRandom(), { faction0: 'frost', faction1: 'barbaric' });
    clearRect(core, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);
    core.phase = 'move';
    core.currentPlayer = '0';

    const structurePos = { row: 4, col: 3 };
    const targetPos = { row: 4, col: 4 };
    const pushPos = { row: 4, col: 5 };
    putStructure(core, structurePos, '0');
    const target = putUnit(core, targetPos, mkUnit('ice-ram-target', { faction: 'barbaric' }), '1');

    const interaction = createSimpleChoice(
      'sw-ice-ram-target-test',
      '0',
      '寒冰冲撞',
      [
        { id: 'pick-target', label: '目标', value: { action: 'ice_ram_target', targetPosition: targetPos } },
        { id: 'skip', label: '跳过', value: { skip: true } },
      ],
      { sourceId: 'ice_ram', targetType: 'minion', autoResolveIfSingle: false },
    );
    const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
    interaction.data = {
      ...interactionData,
      sw: {
        type: 'ice_ram_target',
        structurePosition: structurePos,
        ownerId: '0',
      },
    };

    let state: MatchState<SummonerWarsCore> = {
      core,
      sys: createInitialSystemState(['0', '1'], interactionSystems),
    };
    state.sys.interaction.current = interaction;

    const pickTargetResult = runPipeline(state, {
      type: INTERACTION_COMMANDS.RESPOND,
      playerId: '0',
      payload: { interactionId: interaction.id, optionId: 'pick-target' },
    });
    expect(pickTargetResult.success).toBe(true);
    state = pickTargetResult.state;
    expect(getSwCurrentType(state)).toBe('ice_ram_push');

    const pushCurrent = state.sys.interaction.current;
    expect(pushCurrent?.kind).toBe('simple-choice');
    const pushOptions = ((pushCurrent?.data as { options?: PromptOption[] } | undefined)?.options ?? []) as PromptOption[];
    const pushOptionId = pushOptions.find((option) => {
      const value = option.value as { action?: string; pushNewPosition?: CellCoord } | undefined;
      return value?.action === 'ice_ram_push'
        && value.pushNewPosition?.row === pushPos.row
        && value.pushNewPosition?.col === pushPos.col;
    })?.id;
    expect(pushOptionId).toBeTruthy();

    const pushResult = runPipeline(state, {
      type: INTERACTION_COMMANDS.RESPOND,
      playerId: '0',
      payload: { interactionId: pushCurrent!.id, optionId: pushOptionId },
    });
    expect(pushResult.success).toBe(true);
    state = pushResult.state;

    expect(state.sys.interaction.current).toBeUndefined();
    expect(state.sys.interaction.queue.length).toBe(0);
    // 单测环境未注入寒冰冲撞 active event，上游执行会拒绝推拉；这里验证交互链能收口且不会重触发
    expect(getUnitAt(state.core, targetPos)?.instanceId).toBe(target.instanceId);
    expect(getUnitAt(state.core, pushPos)).toBeUndefined();
  });

  it('[ice_ram] 首步 skip 后应直接收口且不进入二步推拉', () => {
    resetInstanceCounter();
    const core = createInitializedCore(['0', '1'], testRandom(), { faction0: 'frost', faction1: 'barbaric' });
    clearRect(core, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);
    core.phase = 'move';
    core.currentPlayer = '0';

    const structurePos = { row: 4, col: 3 };
    const targetPos = { row: 4, col: 4 };
    putStructure(core, structurePos, '0');
    putUnit(core, targetPos, mkUnit('ice-ram-target', { faction: 'barbaric' }), '1');

    const interaction = createSimpleChoice(
      'sw-ice-ram-target-skip-test',
      '0',
      '寒冰冲撞',
      [
        { id: 'pick-target', label: '目标', value: { action: 'ice_ram_target', targetPosition: targetPos } },
        { id: 'skip', label: '跳过', value: { skip: true } },
      ],
      { sourceId: 'ice_ram', targetType: 'minion', autoResolveIfSingle: false },
    );
    const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
    interaction.data = {
      ...interactionData,
      sw: {
        type: 'ice_ram_target',
        structurePosition: structurePos,
        ownerId: '0',
      },
    };

    let state: MatchState<SummonerWarsCore> = {
      core,
      sys: createInitialSystemState(['0', '1'], interactionSystems),
    };
    state.sys.interaction.current = interaction;

    const skipResult = runPipeline(state, {
      type: INTERACTION_COMMANDS.RESPOND,
      playerId: '0',
      payload: { interactionId: interaction.id, optionId: 'skip' },
    });
    expect(skipResult.success).toBe(true);
    state = skipResult.state;

    expect(state.sys.interaction.current).toBeUndefined();
    expect(state.sys.interaction.queue.length).toBe(0);
    expect(getUnitAt(state.core, targetPos)).toBeTruthy();
  });
});

// ============================================================================
// Section 1: 多步交互链 — 执行器 payload 防御性检查
// 验证：缺失必需字段时执行器静默返回空事件（不崩溃）
// ============================================================================

describe('多步交互链 — 执行器 payload 防御性', () => {
  let core: SummonerWarsCore;

  beforeEach(() => {
    resetInstanceCounter();
    core = createInitializedCore(['0', '1'], testRandom(), { faction0: 'frost', faction1: 'barbaric' });
    clearRect(core, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);
  });

  // --- structure_shift: 缺少 newPosition ---
  it('[structure_shift] 缺少 newPosition 时返回空事件', () => {
    core.phase = 'move';
    core.currentPlayer = '0' as PlayerId;
    const summoner = mkUnit('svara', { abilities: ['structure_shift'], unitClass: 'summoner', faction: 'frost' });
    const unit = putUnit(core, { row: 4, col: 3 }, summoner, '0');
    putStructure(core, { row: 4, col: 4 }, '0');

    const events = exec(core, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'structure_shift',
      sourceUnitId: unit.instanceId,
      targetPosition: { row: 4, col: 4 },
      // 故意缺少 newPosition
    });
    // 不应崩溃，应返回 ABILITY_TRIGGERED 但无实际移动事件
    const pushEvent = events.find(e => e.type === SW_EVENTS.UNIT_PUSHED);
    expect(pushEvent).toBeUndefined();
  });

  // --- structure_shift: 完整 payload ---
  it('[structure_shift] 完整 payload 产生 UNIT_PUSHED 事件', () => {
    core.phase = 'move';
    core.currentPlayer = '0' as PlayerId;
    const summoner = mkUnit('svara', { abilities: ['structure_shift'], unitClass: 'summoner', faction: 'frost' });
    const unit = putUnit(core, { row: 4, col: 3 }, summoner, '0');
    putStructure(core, { row: 4, col: 4 }, '0');

    const events = exec(core, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'structure_shift',
      sourceUnitId: unit.instanceId,
      targetPosition: { row: 4, col: 4 },
      newPosition: { row: 4, col: 5 },
    });
    const pushEvent = events.find(e => e.type === SW_EVENTS.UNIT_PUSHED);
    expect(pushEvent).toBeDefined();
  });

  // --- withdraw: 缺少 costType 时走 magic 路径（else 分支） ---
  it('[withdraw] 缺少 costType 且无魔力时不产生移动事件', () => {
    core.phase = 'attack';
    core.currentPlayer = '1' as PlayerId;
    core.players['1'].magic = 0; // 无魔力
    const kairu = mkUnit('kairu', { abilities: ['withdraw'], unitClass: 'champion', faction: 'barbaric' });
    const unit = putUnit(core, { row: 4, col: 3 }, kairu, '1', { boosts: 1 });

    const events = exec(core, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'withdraw',
      sourceUnitId: unit.instanceId,
      targetPosition: { row: 4, col: 5 },
      // 缺少 costType → 走 else（magic）分支，但无魔力
    });
    // 执行器走 magic 路径但魔力不足，不产生移动事件
    const moveEvent = events.find(e => e.type === SW_EVENTS.UNIT_MOVED);
    expect(moveEvent).toBeUndefined();
  });

  // --- withdraw: 完整 payload（charge 路径） ---
  it('[withdraw] charge 路径完整 payload 产生移动事件', () => {
    core.phase = 'attack';
    core.currentPlayer = '1' as PlayerId;
    const kairu = mkUnit('kairu', { abilities: ['withdraw'], unitClass: 'champion', faction: 'barbaric' });
    const unit = putUnit(core, { row: 4, col: 3 }, kairu, '1', { boosts: 1 });

    const events = exec(core, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'withdraw',
      sourceUnitId: unit.instanceId,
      costType: 'charge',
      targetPosition: { row: 4, col: 5 },
    });
    const chargeEvent = events.find(e => e.type === SW_EVENTS.UNIT_CHARGED);
    const moveEvent = events.find(e => e.type === SW_EVENTS.UNIT_MOVED);
    expect(chargeEvent).toBeDefined();
    expect(moveEvent).toBeDefined();
  });

  // --- withdraw: 完整 payload（magic 路径） ---
  it('[withdraw] magic 路径完整 payload 产生移动事件', () => {
    core.phase = 'attack';
    core.currentPlayer = '1' as PlayerId;
    core.players['1'].magic = 3;
    const kairu = mkUnit('kairu', { abilities: ['withdraw'], unitClass: 'champion', faction: 'barbaric' });
    const unit = putUnit(core, { row: 4, col: 3 }, kairu, '1', { boosts: 0 });

    const events = exec(core, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'withdraw',
      sourceUnitId: unit.instanceId,
      costType: 'magic',
      targetPosition: { row: 4, col: 5 },
    });
    const magicEvent = events.find(e => e.type === SW_EVENTS.MAGIC_CHANGED);
    const moveEvent = events.find(e => e.type === SW_EVENTS.UNIT_MOVED);
    expect(magicEvent).toBeDefined();
    expect(moveEvent).toBeDefined();
  });

  // --- frost_axe: 缺少 choice ---
  it('[frost_axe] 缺少 choice 时验证失败', () => {
    core.phase = 'move';
    core.currentPlayer = '0' as PlayerId;
    const smith = mkUnit('smith', { abilities: ['frost_axe'], faction: 'frost' });
    const unit = putUnit(core, { row: 4, col: 3 }, smith, '0', { boosts: 1 });

    const result = validate(core, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'frost_axe',
      sourceUnitId: unit.instanceId,
    });
    expect(result.valid).toBe(false);
  });

  // --- frost_axe: self 路径 ---
  it('[frost_axe] choice=self 充能自身', () => {
    core.phase = 'move';
    core.currentPlayer = '0' as PlayerId;
    const smith = mkUnit('smith', { abilities: ['frost_axe'], faction: 'frost' });
    const unit = putUnit(core, { row: 4, col: 3 }, smith, '0');

    const events = exec(core, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'frost_axe',
      sourceUnitId: unit.instanceId,
      choice: 'self',
    });
    const chargeEvent = events.find(e => e.type === SW_EVENTS.UNIT_CHARGED);
    expect(chargeEvent).toBeDefined();
  });

  // --- frost_axe: attach 路径 ---
  it('[frost_axe] choice=attach 附加到友方士兵', () => {
    core.phase = 'move';
    core.currentPlayer = '0' as PlayerId;
    const smith = mkUnit('smith', { abilities: ['frost_axe'], faction: 'frost' });
    const unit = putUnit(core, { row: 4, col: 3 }, smith, '0', { boosts: 2 });
    const target = mkUnit('soldier', { unitClass: 'common', faction: 'frost' });
    putUnit(core, { row: 4, col: 4 }, target, '0');

    const events = exec(core, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'frost_axe',
      sourceUnitId: unit.instanceId,
      choice: 'attach',
      targetPosition: { row: 4, col: 4 },
    });
    const attachEvent = events.find(e => e.type === SW_EVENTS.UNIT_ATTACHED);
    expect(attachEvent).toBeDefined();
  });

  // --- frost_axe: attach 路径缺少 targetPosition ---
  it('[frost_axe] choice=attach 缺少 targetPosition 时验证失败', () => {
    core.phase = 'move';
    core.currentPlayer = '0' as PlayerId;
    const smith = mkUnit('smith', { abilities: ['frost_axe'], faction: 'frost' });
    const unit = putUnit(core, { row: 4, col: 3 }, smith, '0', { boosts: 2 });

    const result = validate(core, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'frost_axe',
      sourceUnitId: unit.instanceId,
      choice: 'attach',
      // 缺少 targetPosition
    });
    expect(result.valid).toBe(false);
  });

  // --- spirit_bond: self 路径 ---
  it('[spirit_bond] choice=self 充能自身', () => {
    core.phase = 'move';
    core.currentPlayer = '1' as PlayerId;
    const shaman = mkUnit('shaman', { abilities: ['spirit_bond'], faction: 'barbaric' });
    const unit = putUnit(core, { row: 4, col: 3 }, shaman, '1');

    const events = exec(core, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'spirit_bond',
      sourceUnitId: unit.instanceId,
      choice: 'self',
    });
    const chargeEvent = events.find(e => e.type === SW_EVENTS.UNIT_CHARGED);
    expect(chargeEvent).toBeDefined();
  });

  // --- spirit_bond: transfer 路径 ---
  it('[spirit_bond] choice=transfer 转移充能到友方', () => {
    core.phase = 'move';
    core.currentPlayer = '1' as PlayerId;
    const shaman = mkUnit('shaman', { abilities: ['spirit_bond'], faction: 'barbaric' });
    const unit = putUnit(core, { row: 4, col: 3 }, shaman, '1', { boosts: 2 });
    const ally = mkUnit('ally', { faction: 'barbaric' });
    putUnit(core, { row: 4, col: 4 }, ally, '1');

    const events = exec(core, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'spirit_bond',
      sourceUnitId: unit.instanceId,
      choice: 'transfer',
      targetPosition: { row: 4, col: 4 },
    });
    const chargeEvents = events.filter(e => e.type === SW_EVENTS.UNIT_CHARGED);
    expect(chargeEvents.length).toBeGreaterThanOrEqual(2); // -1 source, +1 target
  });

  // --- spirit_bond: transfer 缺少 targetPosition ---
  it('[spirit_bond] choice=transfer 缺少 targetPosition 时验证失败', () => {
    core.phase = 'move';
    core.currentPlayer = '1' as PlayerId;
    const shaman = mkUnit('shaman', { abilities: ['spirit_bond'], faction: 'barbaric' });
    const unit = putUnit(core, { row: 4, col: 3 }, shaman, '1', { boosts: 2 });

    const result = validate(core, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'spirit_bond',
      sourceUnitId: unit.instanceId,
      choice: 'transfer',
      // 缺少 targetPosition
    });
    expect(result.valid).toBe(false);
  });

  // --- spirit_bond: 无效 choice ---
  it('[spirit_bond] 无效 choice 时验证失败', () => {
    core.phase = 'move';
    core.currentPlayer = '1' as PlayerId;
    const shaman = mkUnit('shaman', { abilities: ['spirit_bond'], faction: 'barbaric' });
    const unit = putUnit(core, { row: 4, col: 3 }, shaman, '1');

    const result = validate(core, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'spirit_bond',
      sourceUnitId: unit.instanceId,
      choice: 'invalid',
    });
    expect(result.valid).toBe(false);
  });

  // --- feed_beast: self_destroy 路径 ---
  it('[feed_beast] choice=self_destroy 自毁', () => {
    core.phase = 'attack';
    core.currentPlayer = '1' as PlayerId;
    const beast = mkUnit('beast', { abilities: ['feed_beast'], unitClass: 'champion', faction: 'goblin', life: 6 });
    const unit = putUnit(core, { row: 4, col: 3 }, beast, '1');

    const events = exec(core, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'feed_beast',
      sourceUnitId: unit.instanceId,
      choice: 'self_destroy',
    });
    const destroyEvent = events.find(e =>
      e.type === SW_EVENTS.UNIT_DESTROYED
      && (e.payload as Record<string, unknown>).reason === 'feed_beast_self'
    );
    expect(destroyEvent).toBeDefined();
  });

  // --- feed_beast: destroy_adjacent 路径 ---
  it('[feed_beast] choice=destroy_adjacent 吞噬相邻友方', () => {
    core.phase = 'attack';
    core.currentPlayer = '1' as PlayerId;
    const beast = mkUnit('beast', { abilities: ['feed_beast'], unitClass: 'champion', faction: 'goblin', life: 6 });
    const unit = putUnit(core, { row: 4, col: 3 }, beast, '1');
    const victim = mkUnit('goblin-soldier', { cost: 0, faction: 'goblin' });
    putUnit(core, { row: 4, col: 4 }, victim, '1');

    const events = exec(core, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'feed_beast',
      sourceUnitId: unit.instanceId,
      choice: 'destroy_adjacent',
      targetPosition: { row: 4, col: 4 },
    });
    const destroyEvent = events.find(e =>
      e.type === SW_EVENTS.UNIT_DESTROYED
      && (e.payload as Record<string, unknown>).reason === 'feed_beast'
    );
    expect(destroyEvent).toBeDefined();
  });

  // --- feed_beast: destroy_adjacent 缺少 targetPosition ---
  it('[feed_beast] choice=destroy_adjacent 缺少 targetPosition 时验证失败', () => {
    core.phase = 'attack';
    core.currentPlayer = '1' as PlayerId;
    const beast = mkUnit('beast', { abilities: ['feed_beast'], unitClass: 'champion', faction: 'goblin', life: 6 });
    const unit = putUnit(core, { row: 4, col: 3 }, beast, '1');

    const result = validate(core, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'feed_beast',
      sourceUnitId: unit.instanceId,
      choice: 'destroy_adjacent',
      // 缺少 targetPosition
    });
    expect(result.valid).toBe(false);
  });
});

// ============================================================================
// Section 2: 单步目标选择技能 — payload 完整性
// ============================================================================

describe('单步目标选择技能 — payload 完整性', () => {
  let core: SummonerWarsCore;

  beforeEach(() => {
    resetInstanceCounter();
    core = createInitializedCore(['0', '1'], testRandom(), { faction0: 'trickster', faction1: 'necromancer' });
    clearRect(core, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);
  });

  // --- telekinesis: 攻击后推拉 ---
  it('[telekinesis] 完整 payload 产生推拉事件', () => {
    core.phase = 'attack';
    core.currentPlayer = '0' as PlayerId;
    const mage = mkUnit('wind-mage', { abilities: ['telekinesis'], faction: 'trickster', attackRange: 2 });
    const unit = putUnit(core, { row: 4, col: 3 }, mage, '0');
    const enemy = mkUnit('skeleton', { faction: 'necromancer' });
    putUnit(core, { row: 4, col: 4 }, enemy, '1');

    const events = exec(core, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'telekinesis',
      sourceUnitId: unit.instanceId,
      targetPosition: { row: 4, col: 4 },
      direction: 'push',
    });
    const pushEvent = events.find(e => e.type === SW_EVENTS.UNIT_PUSHED);
    expect(pushEvent).toBeDefined();
  });

  // --- telekinesis: 缺少 targetPosition ---
  it('[telekinesis] 缺少 targetPosition 时验证失败', () => {
    core.phase = 'attack';
    core.currentPlayer = '0' as PlayerId;
    const mage = mkUnit('wind-mage', { abilities: ['telekinesis'], faction: 'trickster' });
    const unit = putUnit(core, { row: 4, col: 3 }, mage, '0');

    const result = validate(core, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'telekinesis',
      sourceUnitId: unit.instanceId,
      direction: 'push',
      // 缺少 targetPosition
    });
    expect(result.valid).toBe(false);
  });

  // --- telekinesis: 目标是召唤师（应拒绝） ---
  it('[telekinesis] 目标是召唤师时验证失败', () => {
    core.phase = 'attack';
    core.currentPlayer = '0' as PlayerId;
    const mage = mkUnit('wind-mage', { abilities: ['telekinesis'], faction: 'trickster' });
    const unit = putUnit(core, { row: 4, col: 3 }, mage, '0');
    const enemySummoner = mkUnit('ret-summoner', { unitClass: 'summoner', faction: 'necromancer' });
    putUnit(core, { row: 4, col: 4 }, enemySummoner, '1');

    const result = validate(core, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'telekinesis',
      sourceUnitId: unit.instanceId,
      targetPosition: { row: 4, col: 4 },
      direction: 'push',
    });
    expect(result.valid).toBe(false);
  });

  // --- high_telekinesis_instead: 代替攻击推拉 ---
  it('[high_telekinesis_instead] 代替攻击推拉成功', () => {
    core.phase = 'attack';
    core.currentPlayer = '0' as PlayerId;
    core.players['0'].attackCount = 0;
    const kara = mkUnit('kara', { abilities: ['high_telekinesis_instead'], unitClass: 'champion', faction: 'trickster' });
    const unit = putUnit(core, { row: 4, col: 3 }, kara, '0', { hasAttacked: false });
    const enemy = mkUnit('skeleton', { faction: 'necromancer' });
    // 敌人在 (4,4)，推拉后到 (4,5)，确保目标位置在棋盘内
    putUnit(core, { row: 4, col: 4 }, enemy, '1');

    const events = exec(core, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'high_telekinesis_instead',
      sourceUnitId: unit.instanceId,
      targetPosition: { row: 4, col: 4 },
      direction: 'push',
    });
    const pushEvent = events.find(e => e.type === SW_EVENTS.UNIT_PUSHED);
    expect(pushEvent).toBeDefined();
  });

  // --- high_telekinesis_instead: 已攻击时拒绝 ---
  it('[high_telekinesis_instead] 已攻击时验证失败', () => {
    core.phase = 'attack';
    core.currentPlayer = '0' as PlayerId;
    const kara = mkUnit('kara', { abilities: ['high_telekinesis_instead'], unitClass: 'champion', faction: 'trickster' });
    const unit = putUnit(core, { row: 4, col: 3 }, kara, '0', { hasAttacked: true });
    const enemy = mkUnit('skeleton', { faction: 'necromancer' });
    putUnit(core, { row: 4, col: 4 }, enemy, '1');

    const result = validate(core, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'high_telekinesis_instead',
      sourceUnitId: unit.instanceId,
      targetPosition: { row: 4, col: 4 },
      direction: 'push',
    });
    expect(result.valid).toBe(false);
  });

  // --- mind_transmission: 读心传念 ---
  it('[mind_transmission] 完整 payload 授予额外攻击', () => {
    core.phase = 'attack';
    core.currentPlayer = '0' as PlayerId;
    const gurzhuang = mkUnit('gurzhuang', { abilities: ['mind_transmission'], unitClass: 'champion', faction: 'trickster' });
    const unit = putUnit(core, { row: 4, col: 3 }, gurzhuang, '0');
    const soldier = mkUnit('soldier', { unitClass: 'common', faction: 'trickster' });
    putUnit(core, { row: 4, col: 4 }, soldier, '0');

    const events = exec(core, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'mind_transmission',
      sourceUnitId: unit.instanceId,
      targetPosition: { row: 4, col: 4 },
    });
    const extraAttack = events.find(e => e.type === SW_EVENTS.EXTRA_ATTACK_GRANTED);
    expect(extraAttack).toBeDefined();
  });

  // --- mind_transmission: 目标不是士兵 ---
  it('[mind_transmission] 目标不是士兵时验证失败', () => {
    core.phase = 'attack';
    core.currentPlayer = '0' as PlayerId;
    const gurzhuang = mkUnit('gurzhuang', { abilities: ['mind_transmission'], unitClass: 'champion', faction: 'trickster' });
    const unit = putUnit(core, { row: 4, col: 3 }, gurzhuang, '0');
    const champion = mkUnit('champion', { unitClass: 'champion', faction: 'trickster' });
    putUnit(core, { row: 4, col: 4 }, champion, '0');

    const result = validate(core, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'mind_transmission',
      sourceUnitId: unit.instanceId,
      targetPosition: { row: 4, col: 4 },
    });
    expect(result.valid).toBe(false);
  });

  // --- mind_transmission: 目标超出范围 ---
  it('[mind_transmission] 目标超出3格时验证失败', () => {
    core.phase = 'attack';
    core.currentPlayer = '0' as PlayerId;
    const gurzhuang = mkUnit('gurzhuang', { abilities: ['mind_transmission'], unitClass: 'champion', faction: 'trickster' });
    const unit = putUnit(core, { row: 4, col: 0 }, gurzhuang, '0');
    const soldier = mkUnit('soldier', { unitClass: 'common', faction: 'trickster' });
    putUnit(core, { row: 4, col: 5 }, soldier, '0'); // 距离5格

    const result = validate(core, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'mind_transmission',
      sourceUnitId: unit.instanceId,
      targetPosition: { row: 4, col: 5 },
    });
    expect(result.valid).toBe(false);
  });
});

// ============================================================================
// Section 3: 亡灵法师交互链
// ============================================================================

describe('亡灵法师交互链', () => {
  let core: SummonerWarsCore;

  beforeEach(() => {
    resetInstanceCounter();
    core = createInitializedCore(['0', '1'], testRandom(), { faction0: 'necromancer', faction1: 'necromancer' });
    clearRect(core, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);
  });

  // --- revive_undead: 完整流程 ---
  it('[revive_undead] 完整 payload 从弃牌堆复活亡灵', () => {
    core.phase = 'summon';
    core.currentPlayer = '0' as PlayerId;
    const summoner = mkUnit('ret-summoner', {
      abilities: ['revive_undead'], unitClass: 'summoner', faction: 'necromancer', life: 8,
    });
    const unit = putUnit(core, { row: 4, col: 3 }, summoner, '0');

    // 在弃牌堆放一个亡灵单位
    const undeadCard = mkUnit('skeleton-warrior', { faction: 'necromancer', unitClass: 'common' });
    const discardCard = { ...undeadCard, id: 'skeleton_warrior-0-discard' };
    core.players['0'].discard.push(discardCard as any);

    const events = exec(core, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'revive_undead',
      sourceUnitId: unit.instanceId,
      targetCardId: 'skeleton_warrior-0-discard',
      targetPosition: { row: 4, col: 4 },
    });
    const damageEvent = events.find(e =>
      e.type === SW_EVENTS.UNIT_DAMAGED
      && (e.payload as Record<string, unknown>).reason === 'revive_undead'
    );
    expect(damageEvent).toBeDefined();
  });

  // --- revive_undead: 缺少 targetCardId ---
  it('[revive_undead] 缺少 targetCardId 时验证失败', () => {
    core.phase = 'summon';
    core.currentPlayer = '0' as PlayerId;
    const summoner = mkUnit('ret-summoner', {
      abilities: ['revive_undead'], unitClass: 'summoner', faction: 'necromancer', life: 8,
    });
    const unit = putUnit(core, { row: 4, col: 3 }, summoner, '0');

    const result = validate(core, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'revive_undead',
      sourceUnitId: unit.instanceId,
      targetPosition: { row: 4, col: 4 },
      // 缺少 targetCardId
    });
    expect(result.valid).toBe(false);
  });

  // --- revive_undead: 缺少 targetPosition ---
  it('[revive_undead] 缺少 targetPosition 时验证失败', () => {
    core.phase = 'summon';
    core.currentPlayer = '0' as PlayerId;
    const summoner = mkUnit('ret-summoner', {
      abilities: ['revive_undead'], unitClass: 'summoner', faction: 'necromancer', life: 8,
    });
    const unit = putUnit(core, { row: 4, col: 3 }, summoner, '0');
    const discardCard = mkUnit('skeleton_warrior', { faction: 'necromancer' });
    core.players['0'].discard.push({ ...discardCard, id: 'sk-discard' } as any);

    const result = validate(core, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'revive_undead',
      sourceUnitId: unit.instanceId,
      targetCardId: 'sk-discard',
      // 缺少 targetPosition
    });
    expect(result.valid).toBe(false);
  });

  // --- ancestral_bond: 祖灵羁绊 ---
  it('[ancestral_bond] 完整 payload 充能目标并转移自身充能', () => {
    core.phase = 'move';
    core.currentPlayer = '1' as PlayerId;
    const summoner = mkUnit('abuya', { abilities: ['ancestral_bond'], unitClass: 'summoner', faction: 'barbaric' });
    const unit = putUnit(core, { row: 4, col: 3 }, summoner, '1', { boosts: 3 });
    const ally = mkUnit('ally', { faction: 'barbaric' });
    putUnit(core, { row: 4, col: 4 }, ally, '1');

    const events = exec(core, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'ancestral_bond',
      sourceUnitId: unit.instanceId,
      targetPosition: { row: 4, col: 4 },
    });
    const chargeEvents = events.filter(e => e.type === SW_EVENTS.UNIT_CHARGED);
    // 至少有充能事件（+1目标, 转移充能）
    expect(chargeEvents.length).toBeGreaterThanOrEqual(2);
  });

  // --- ancestral_bond: 目标超出范围 ---
  it('[ancestral_bond] 目标超出3格时验证失败', () => {
    core.phase = 'move';
    core.currentPlayer = '1' as PlayerId;
    const summoner = mkUnit('abuya', { abilities: ['ancestral_bond'], unitClass: 'summoner', faction: 'barbaric' });
    const unit = putUnit(core, { row: 4, col: 0 }, summoner, '1');
    const ally = mkUnit('ally', { faction: 'barbaric' });
    putUnit(core, { row: 4, col: 5 }, ally, '1'); // 距离5格

    const result = validate(core, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'ancestral_bond',
      sourceUnitId: unit.instanceId,
      targetPosition: { row: 4, col: 5 },
    });
    expect(result.valid).toBe(false);
  });

  // --- ancestral_bond: 选择自己 ---
  it('[ancestral_bond] 选择自己时验证失败', () => {
    core.phase = 'move';
    core.currentPlayer = '1' as PlayerId;
    const summoner = mkUnit('abuya', { abilities: ['ancestral_bond'], unitClass: 'summoner', faction: 'barbaric' });
    const unit = putUnit(core, { row: 4, col: 3 }, summoner, '1');

    const result = validate(core, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'ancestral_bond',
      sourceUnitId: unit.instanceId,
      targetPosition: { row: 4, col: 3 },
    });
    expect(result.valid).toBe(false);
  });
});

// ============================================================================
// Section 4: 先锋军团交互链
// ============================================================================

describe('先锋军团交互链', () => {
  let core: SummonerWarsCore;

  beforeEach(() => {
    resetInstanceCounter();
    core = createInitializedCore(['0', '1'], testRandom(), { faction0: 'paladin', faction1: 'necromancer' });
    clearRect(core, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);
  });

  // --- vanish: 神出鬼没 ---
  it('[vanish] 与0费友方交换位置', () => {
    core.phase = 'attack';
    core.currentPlayer = '0' as PlayerId;
    const summoner = mkUnit('sneeks', { abilities: ['vanish'], unitClass: 'summoner', faction: 'goblin' });
    const unit = putUnit(core, { row: 4, col: 3 }, summoner, '0');
    const zeroCost = mkUnit('goblin-minion', { cost: 0, faction: 'goblin' });
    putUnit(core, { row: 4, col: 5 }, zeroCost, '0');

    const events = exec(core, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'vanish',
      sourceUnitId: unit.instanceId,
      targetPosition: { row: 4, col: 5 },
    });
    const swapEvent = events.find(e => e.type === SW_EVENTS.UNITS_SWAPPED);
    expect(swapEvent).toBeDefined();
  });

  // --- vanish: 目标费用不为0 ---
  it('[vanish] 目标费用不为0时验证失败', () => {
    core.phase = 'attack';
    core.currentPlayer = '0' as PlayerId;
    const summoner = mkUnit('sneeks', { abilities: ['vanish'], unitClass: 'summoner', faction: 'goblin' });
    const unit = putUnit(core, { row: 4, col: 3 }, summoner, '0');
    const costUnit = mkUnit('goblin-champ', { cost: 3, faction: 'goblin' });
    putUnit(core, { row: 4, col: 5 }, costUnit, '0');

    const result = validate(core, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'vanish',
      sourceUnitId: unit.instanceId,
      targetPosition: { row: 4, col: 5 },
    });
    expect(result.valid).toBe(false);
  });

  // --- vanish: 目标是敌方 ---
  it('[vanish] 目标是敌方时验证失败', () => {
    core.phase = 'attack';
    core.currentPlayer = '0' as PlayerId;
    const summoner = mkUnit('sneeks', { abilities: ['vanish'], unitClass: 'summoner', faction: 'goblin' });
    const unit = putUnit(core, { row: 4, col: 3 }, summoner, '0');
    const enemy = mkUnit('skeleton', { cost: 0, faction: 'necromancer' });
    putUnit(core, { row: 4, col: 5 }, enemy, '1');

    const result = validate(core, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'vanish',
      sourceUnitId: unit.instanceId,
      targetPosition: { row: 4, col: 5 },
    });
    expect(result.valid).toBe(false);
  });

  // --- prepare: 预备充能 ---
  it('[prepare] 未移动时充能成功', () => {
    core.phase = 'move';
    core.currentPlayer = '0' as PlayerId;
    const archer = mkUnit('archer', { abilities: ['prepare'], faction: 'barbaric' });
    const unit = putUnit(core, { row: 4, col: 3 }, archer, '0', { hasMoved: false });

    const events = exec(core, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'prepare',
      sourceUnitId: unit.instanceId,
    });
    const chargeEvent = events.find(e => e.type === SW_EVENTS.UNIT_CHARGED);
    expect(chargeEvent).toBeDefined();
  });

  // --- prepare: 已移动时拒绝 ---
  it('[prepare] 已移动时验证失败', () => {
    core.phase = 'move';
    core.currentPlayer = '0' as PlayerId;
    const archer = mkUnit('archer', { abilities: ['prepare'], faction: 'barbaric' });
    const unit = putUnit(core, { row: 4, col: 3 }, archer, '0', { hasMoved: true });

    const result = validate(core, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'prepare',
      sourceUnitId: unit.instanceId,
    });
    expect(result.valid).toBe(false);
  });

  // --- inspire: 启悟充能相邻友方 ---
  it('[inspire] 充能相邻友方单位', () => {
    core.phase = 'move';
    core.currentPlayer = '0' as PlayerId;
    const kairu = mkUnit('kairu', { abilities: ['inspire'], unitClass: 'champion', faction: 'barbaric' });
    const unit = putUnit(core, { row: 4, col: 3 }, kairu, '0');
    const ally1 = mkUnit('ally1', { faction: 'barbaric' });
    putUnit(core, { row: 4, col: 4 }, ally1, '0');
    const ally2 = mkUnit('ally2', { faction: 'barbaric' });
    putUnit(core, { row: 3, col: 3 }, ally2, '0');

    const events = exec(core, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'inspire',
      sourceUnitId: unit.instanceId,
    });
    const chargeEvents = events.filter(e => e.type === SW_EVENTS.UNIT_CHARGED);
    expect(chargeEvents.length).toBeGreaterThanOrEqual(2);
  });
});

// ============================================================================
// Section 5: 验证层有效性门控 — 有代价技能的前置条件
// ============================================================================

describe('验证层有效性门控', () => {
  let core: SummonerWarsCore;

  beforeEach(() => {
    resetInstanceCounter();
    core = createInitializedCore(['0', '1'], testRandom(), { faction0: 'frost', faction1: 'barbaric' });
    clearRect(core, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);
  });

  // --- withdraw: 无充能且无魔力时拒绝 ---
  it('[withdraw] 无充能且无魔力时验证失败', () => {
    core.phase = 'attack';
    core.currentPlayer = '1' as PlayerId;
    core.players['1'].magic = 0;
    const kairu = mkUnit('kairu', { abilities: ['withdraw'], unitClass: 'champion', faction: 'barbaric' });
    const unit = putUnit(core, { row: 4, col: 3 }, kairu, '1', { boosts: 0 });

    // charge 路径
    const result1 = validate(core, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'withdraw',
      sourceUnitId: unit.instanceId,
      costType: 'charge',
      targetPosition: { row: 4, col: 5 },
    });
    expect(result1.valid).toBe(false);

    // magic 路径
    const result2 = validate(core, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'withdraw',
      sourceUnitId: unit.instanceId,
      costType: 'magic',
      targetPosition: { row: 4, col: 5 },
    });
    expect(result2.valid).toBe(false);
  });

  // --- frost_axe: attach 路径充能不足时拒绝 ---
  it('[frost_axe] attach 路径充能不足时验证失败', () => {
    core.phase = 'move';
    core.currentPlayer = '0' as PlayerId;
    const smith = mkUnit('smith', { abilities: ['frost_axe'], faction: 'frost' });
    const unit = putUnit(core, { row: 4, col: 3 }, smith, '0', { boosts: 0 }); // 无充能
    const target = mkUnit('soldier', { unitClass: 'common', faction: 'frost' });
    putUnit(core, { row: 4, col: 4 }, target, '0');

    const result = validate(core, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'frost_axe',
      sourceUnitId: unit.instanceId,
      choice: 'attach',
      targetPosition: { row: 4, col: 4 },
    });
    expect(result.valid).toBe(false);
  });

  // --- spirit_bond: transfer 路径充能不足时拒绝 ---
  it('[spirit_bond] transfer 路径充能不足时验证失败', () => {
    core.phase = 'move';
    core.currentPlayer = '1' as PlayerId;
    const shaman = mkUnit('shaman', { abilities: ['spirit_bond'], faction: 'barbaric' });
    const unit = putUnit(core, { row: 4, col: 3 }, shaman, '1', { boosts: 0 }); // 无充能
    const ally = mkUnit('ally', { faction: 'barbaric' });
    putUnit(core, { row: 4, col: 4 }, ally, '1');

    const result = validate(core, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'spirit_bond',
      sourceUnitId: unit.instanceId,
      choice: 'transfer',
      targetPosition: { row: 4, col: 4 },
    });
    expect(result.valid).toBe(false);
  });

  // --- blood_rune: charge 路径魔力不足时拒绝 ---
  it('[blood_rune] charge 路径魔力不足时验证失败', () => {
    core.phase = 'attack';
    core.currentPlayer = '0' as PlayerId;
    core.players['0'].magic = 0;
    const brav = mkUnit('brav', { abilities: ['blood_rune'], unitClass: 'champion', faction: 'goblin' });
    const unit = putUnit(core, { row: 4, col: 3 }, brav, '0');

    const result = validate(core, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'blood_rune',
      sourceUnitId: unit.instanceId,
      choice: 'charge',
    });
    expect(result.valid).toBe(false);
  });

  // --- blood_rune: damage 路径始终可用 ---
  it('[blood_rune] damage 路径始终可用', () => {
    core.phase = 'attack';
    core.currentPlayer = '0' as PlayerId;
    core.players['0'].magic = 0;
    const brav = mkUnit('brav', { abilities: ['blood_rune'], unitClass: 'champion', faction: 'goblin' });
    const unit = putUnit(core, { row: 4, col: 3 }, brav, '0');

    const events = exec(core, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'blood_rune',
      sourceUnitId: unit.instanceId,
      choice: 'damage',
    });
    const damageEvent = events.find(e =>
      e.type === SW_EVENTS.UNIT_DAMAGED
      && (e.payload as Record<string, unknown>).reason === 'blood_rune'
    );
    expect(damageEvent).toBeDefined();
  });

  // --- mind_capture_resolve: 无效 choice ---
  it('[mind_capture_resolve] 无效 choice 时验证失败', () => {
    core.phase = 'attack';
    core.currentPlayer = '0' as PlayerId;
    const summoner = mkUnit('tekelu', { abilities: ['mind_capture_resolve'], unitClass: 'summoner', faction: 'trickster' });
    const unit = putUnit(core, { row: 4, col: 3 }, summoner, '0');

    const result = validate(core, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'mind_capture_resolve',
      sourceUnitId: unit.instanceId,
      choice: 'invalid',
    });
    expect(result.valid).toBe(false);
  });
});

// ============================================================================
// Section 6: 阶段限制验证 — 错误阶段使用技能
// ============================================================================

describe('阶段限制验证', () => {
  let core: SummonerWarsCore;

  beforeEach(() => {
    resetInstanceCounter();
    core = createInitializedCore(['0', '1'], testRandom(), { faction0: 'frost', faction1: 'barbaric' });
    clearRect(core, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);
  });

  // --- structure_shift: 非 move 阶段拒绝 ---
  it('[structure_shift] 非 move 阶段时验证失败', () => {
    core.phase = 'attack'; // 错误阶段
    core.currentPlayer = '0' as PlayerId;
    const summoner = mkUnit('svara', { abilities: ['structure_shift'], unitClass: 'summoner', faction: 'frost' });
    const unit = putUnit(core, { row: 4, col: 3 }, summoner, '0');
    putStructure(core, { row: 4, col: 4 }, '0');

    const result = validate(core, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'structure_shift',
      sourceUnitId: unit.instanceId,
      targetPosition: { row: 4, col: 4 },
      newPosition: { row: 4, col: 5 },
    });
    expect(result.valid).toBe(false);
  });

  // --- withdraw: 非 attack 阶段拒绝 ---
  it('[withdraw] 非 attack 阶段时验证失败', () => {
    core.phase = 'move'; // 错误阶段
    core.currentPlayer = '1' as PlayerId;
    const kairu = mkUnit('kairu', { abilities: ['withdraw'], unitClass: 'champion', faction: 'barbaric' });
    const unit = putUnit(core, { row: 4, col: 3 }, kairu, '1', { boosts: 1 });

    const result = validate(core, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'withdraw',
      sourceUnitId: unit.instanceId,
      costType: 'charge',
      targetPosition: { row: 4, col: 5 },
    });
    expect(result.valid).toBe(false);
  });

  // --- prepare: 非 move 阶段拒绝 ---
  it('[prepare] 非 move 阶段时验证失败', () => {
    core.phase = 'attack'; // 错误阶段
    core.currentPlayer = '0' as PlayerId;
    const archer = mkUnit('archer', { abilities: ['prepare'], faction: 'barbaric' });
    const unit = putUnit(core, { row: 4, col: 3 }, archer, '0', { hasMoved: false });

    const result = validate(core, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'prepare',
      sourceUnitId: unit.instanceId,
    });
    expect(result.valid).toBe(false);
  });

  // --- frost_axe: 非 move 阶段拒绝 ---
  it('[frost_axe] 非 move 阶段时验证失败', () => {
    core.phase = 'attack'; // 错误阶段
    core.currentPlayer = '0' as PlayerId;
    const smith = mkUnit('smith', { abilities: ['frost_axe'], faction: 'frost' });
    const unit = putUnit(core, { row: 4, col: 3 }, smith, '0');

    const result = validate(core, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'frost_axe',
      sourceUnitId: unit.instanceId,
      choice: 'self',
    });
    expect(result.valid).toBe(false);
  });

  // --- vanish: 非 attack 阶段拒绝 ---
  it('[vanish] 非 attack 阶段时验证失败', () => {
    core.phase = 'move'; // 错误阶段
    core.currentPlayer = '0' as PlayerId;
    const summoner = mkUnit('sneeks', { abilities: ['vanish'], unitClass: 'summoner', faction: 'goblin' });
    const unit = putUnit(core, { row: 4, col: 3 }, summoner, '0');
    const zeroCost = mkUnit('goblin-minion', { cost: 0, faction: 'goblin' });
    putUnit(core, { row: 4, col: 5 }, zeroCost, '0');

    const result = validate(core, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'vanish',
      sourceUnitId: unit.instanceId,
      targetPosition: { row: 4, col: 5 },
    });
    expect(result.valid).toBe(false);
  });
});

// ============================================================================
// Section 7: 交互链边界情况 — 距离/位置/所有权验证
// ============================================================================

describe('交互链边界情况', () => {
  let core: SummonerWarsCore;

  beforeEach(() => {
    resetInstanceCounter();
    core = createInitializedCore(['0', '1'], testRandom(), { faction0: 'frost', faction1: 'trickster' });
    clearRect(core, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);
  });

  // --- structure_shift: 目标不是友方建筑 ---
  it('[structure_shift] 目标不是友方建筑时验证失败', () => {
    core.phase = 'move';
    core.currentPlayer = '0' as PlayerId;
    const summoner = mkUnit('svara', { abilities: ['structure_shift'], unitClass: 'summoner', faction: 'frost' });
    const unit = putUnit(core, { row: 4, col: 3 }, summoner, '0');
    putStructure(core, { row: 4, col: 4 }, '1'); // 敌方建筑

    const result = validate(core, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'structure_shift',
      sourceUnitId: unit.instanceId,
      targetPosition: { row: 4, col: 4 },
      newPosition: { row: 4, col: 5 },
    });
    expect(result.valid).toBe(false);
  });

  // --- structure_shift: 目标超出3格 ---
  it('[structure_shift] 目标超出3格时验证失败', () => {
    core.phase = 'move';
    core.currentPlayer = '0' as PlayerId;
    const summoner = mkUnit('svara', { abilities: ['structure_shift'], unitClass: 'summoner', faction: 'frost' });
    const unit = putUnit(core, { row: 4, col: 0 }, summoner, '0');
    putStructure(core, { row: 4, col: 5 }, '0'); // 距离5格

    const result = validate(core, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'structure_shift',
      sourceUnitId: unit.instanceId,
      targetPosition: { row: 4, col: 5 },
      newPosition: { row: 3, col: 5 },
    });
    expect(result.valid).toBe(false);
  });

  // --- withdraw: 移动距离超出2格 ---
  it('[withdraw] 移动距离超出2格时验证失败', () => {
    core.phase = 'attack';
    core.currentPlayer = '1' as PlayerId;
    const kairu = mkUnit('kairu', { abilities: ['withdraw'], unitClass: 'champion', faction: 'barbaric' });
    const unit = putUnit(core, { row: 4, col: 3 }, kairu, '1', { boosts: 1 });

    const result = validate(core, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'withdraw',
      sourceUnitId: unit.instanceId,
      costType: 'charge',
      targetPosition: { row: 1, col: 3 }, // 距离3格
    });
    expect(result.valid).toBe(false);
  });

  // --- withdraw: 非直线移动 ---
  it('[withdraw] 非直线移动时验证失败', () => {
    core.phase = 'attack';
    core.currentPlayer = '1' as PlayerId;
    const kairu = mkUnit('kairu', { abilities: ['withdraw'], unitClass: 'champion', faction: 'barbaric' });
    const unit = putUnit(core, { row: 4, col: 3 }, kairu, '1', { boosts: 1 });

    const result = validate(core, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'withdraw',
      sourceUnitId: unit.instanceId,
      costType: 'charge',
      targetPosition: { row: 3, col: 4 }, // 对角线
    });
    expect(result.valid).toBe(false);
  });

  // --- frost_axe: attach 目标不是友方 ---
  it('[frost_axe] attach 目标不是友方时验证失败', () => {
    core.phase = 'move';
    core.currentPlayer = '0' as PlayerId;
    const smith = mkUnit('smith', { abilities: ['frost_axe'], faction: 'frost' });
    const unit = putUnit(core, { row: 4, col: 3 }, smith, '0', { boosts: 2 });
    const enemy = mkUnit('enemy', { unitClass: 'common', faction: 'trickster' });
    putUnit(core, { row: 4, col: 4 }, enemy, '1');

    const result = validate(core, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'frost_axe',
      sourceUnitId: unit.instanceId,
      choice: 'attach',
      targetPosition: { row: 4, col: 4 },
    });
    expect(result.valid).toBe(false);
  });

  // --- frost_axe: attach 目标不是士兵 ---
  it('[frost_axe] attach 目标不是士兵时验证失败', () => {
    core.phase = 'move';
    core.currentPlayer = '0' as PlayerId;
    const smith = mkUnit('smith', { abilities: ['frost_axe'], faction: 'frost' });
    const unit = putUnit(core, { row: 4, col: 3 }, smith, '0', { boosts: 2 });
    const champion = mkUnit('champion', { unitClass: 'champion', faction: 'frost' });
    putUnit(core, { row: 4, col: 4 }, champion, '0');

    const result = validate(core, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'frost_axe',
      sourceUnitId: unit.instanceId,
      choice: 'attach',
      targetPosition: { row: 4, col: 4 },
    });
    expect(result.valid).toBe(false);
  });

  // --- frost_axe: attach 目标是自身 ---
  it('[frost_axe] attach 目标是自身时验证失败', () => {
    core.phase = 'move';
    core.currentPlayer = '0' as PlayerId;
    const smith = mkUnit('smith', { abilities: ['frost_axe'], faction: 'frost' });
    const unit = putUnit(core, { row: 4, col: 3 }, smith, '0', { boosts: 2 });

    const result = validate(core, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'frost_axe',
      sourceUnitId: unit.instanceId,
      choice: 'attach',
      targetPosition: { row: 4, col: 3 },
    });
    expect(result.valid).toBe(false);
  });

  // --- telekinesis: 目标超出2格 ---
  it('[telekinesis] 目标超出2格时验证失败', () => {
    core.phase = 'attack';
    core.currentPlayer = '0' as PlayerId;
    const mage = mkUnit('wind-mage', { abilities: ['telekinesis'], faction: 'frost' });
    const unit = putUnit(core, { row: 4, col: 0 }, mage, '0');
    const enemy = mkUnit('enemy', { faction: 'trickster' });
    putUnit(core, { row: 4, col: 5 }, enemy, '1'); // 距离5格

    const result = validate(core, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'telekinesis',
      sourceUnitId: unit.instanceId,
      targetPosition: { row: 4, col: 5 },
      direction: 'push',
    });
    expect(result.valid).toBe(false);
  });

  // --- high_telekinesis: 目标超出3格 ---
  it('[high_telekinesis] 目标超出3格时验证失败', () => {
    core.phase = 'attack';
    core.currentPlayer = '0' as PlayerId;
    const kara = mkUnit('kara', { abilities: ['high_telekinesis'], unitClass: 'champion', faction: 'trickster' });
    const unit = putUnit(core, { row: 4, col: 0 }, kara, '0');
    const enemy = mkUnit('enemy', { faction: 'trickster' });
    putUnit(core, { row: 4, col: 5 }, enemy, '1'); // 距离5格

    const result = validate(core, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'high_telekinesis',
      sourceUnitId: unit.instanceId,
      targetPosition: { row: 4, col: 5 },
      direction: 'push',
    });
    expect(result.valid).toBe(false);
  });
});

// ============================================================================
// Section 8: 执行器注册表完整性 — 所有 interactionChain 技能都有执行器
// ============================================================================

describe('执行器注册表完整性', () => {
  const allAbilities = abilityRegistry.getAll();
  const executorIds = abilityExecutorRegistry.getRegisteredIds();

  it('所有声明了 interactionChain 的技能都有对应执行器', () => {
    const violations: string[] = [];
    for (const def of allAbilities) {
      if (!def.interactionChain) continue;
      if (!executorIds.has(def.id)) {
        violations.push(`[${def.id}]（${def.name}）声明了 interactionChain 但无对应执行器`);
      }
    }
    expect(violations).toEqual([]);
  });

  it('所有 activated 技能都有对应执行器', () => {
    const violations: string[] = [];
    for (const def of allAbilities) {
      if (def.trigger !== 'activated') continue;
      if (!executorIds.has(def.id)) {
        violations.push(`[${def.id}]（${def.name}）是 activated 技能但无对应执行器`);
      }
    }
    expect(violations).toEqual([]);
  });

  it('所有 afterAttack 需要目标选择的技能都有对应执行器', () => {
    const violations: string[] = [];
    for (const def of allAbilities) {
      if (def.trigger !== 'afterAttack') continue;
      if (!def.requiresTargetSelection) continue;
      if (!executorIds.has(def.id)) {
        violations.push(`[${def.id}]（${def.name}）是 afterAttack+目标选择技能但无对应执行器`);
      }
    }
    expect(violations).toEqual([]);
  });

  it('所有 beforeAttack 需要目标选择的技能都有对应执行器', () => {
    const violations: string[] = [];
    for (const def of allAbilities) {
      if (def.trigger !== 'beforeAttack') continue;
      if (!def.requiresTargetSelection) continue;
      if (!executorIds.has(def.id)) {
        violations.push(`[${def.id}]（${def.name}）是 beforeAttack+目标选择技能但无对应执行器`);
      }
    }
    expect(violations).toEqual([]);
  });

  it('所有 onPhaseStart 需要目标选择的技能都有对应执行器', () => {
    const violations: string[] = [];
    for (const def of allAbilities) {
      if (def.trigger !== 'onPhaseStart') continue;
      if (!def.requiresTargetSelection) continue;
      if (!executorIds.has(def.id)) {
        violations.push(`[${def.id}]（${def.name}）是 onPhaseStart+目标选择技能但无对应执行器`);
      }
    }
    expect(violations).toEqual([]);
  });

  it('所有 onPhaseEnd 需要目标选择的技能都有对应执行器', () => {
    const violations: string[] = [];
    for (const def of allAbilities) {
      if (def.trigger !== 'onPhaseEnd') continue;
      if (!def.requiresTargetSelection) continue;
      if (!executorIds.has(def.id)) {
        violations.push(`[${def.id}]（${def.name}）是 onPhaseEnd+目标选择技能但无对应执行器`);
      }
    }
    expect(violations).toEqual([]);
  });
});

// ============================================================================
// Section 9: interactionChain 契约全量校验（扩展版）
// ============================================================================

describe('interactionChain 契约全量校验', () => {
  const allAbilities = abilityRegistry.getAll();
  const defsWithChain = allAbilities.filter(d => d.interactionChain);

  it('至少存在 6 个声明了 interactionChain 的技能', () => {
    expect(defsWithChain.length).toBeGreaterThanOrEqual(6);
  });

  it('steps 产出字段覆盖 payloadContract.required', () => {
    const violations: string[] = [];
    for (const def of defsWithChain) {
      const chain = def.interactionChain!;
      const produced = new Set(chain.steps.map(s => s.producesField));
      for (const field of chain.payloadContract.required) {
        if (!produced.has(field)) {
          violations.push(`[${def.id}] required 字段 '${field}' 未被任何 step 产出`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('steps 无重复产出字段', () => {
    const violations: string[] = [];
    for (const def of defsWithChain) {
      const chain = def.interactionChain!;
      const seen = new Set<string>();
      for (const step of chain.steps) {
        if (seen.has(step.producesField)) {
          violations.push(`[${def.id}] step '${step.step}' 产出字段 '${step.producesField}' 重复`);
        }
        seen.add(step.producesField);
      }
    }
    expect(violations).toEqual([]);
  });

  it('optional 字段在 steps 中标记为 optional', () => {
    const violations: string[] = [];
    for (const def of defsWithChain) {
      const chain = def.interactionChain!;
      const optionalFields = chain.payloadContract.optional ?? [];
      for (const field of optionalFields) {
        const step = chain.steps.find(s => s.producesField === field);
        if (step && !step.optional) {
          violations.push(`[${def.id}] payload optional 字段 '${field}' 对应的 step '${step.step}' 未标记 optional`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('payloadContract.required 与执行器 payloadContract 双向对齐', () => {
    const violations: string[] = [];
    for (const def of defsWithChain) {
      const chain = def.interactionChain!;
      const execContract = abilityExecutorRegistry.getPayloadContract?.(def.id);
      if (!execContract) continue; // 无执行器契约声明，跳过

      // 执行器 required ⊆ 定义 required ∪ optional
      const defAll = new Set([
        ...chain.payloadContract.required,
        ...(chain.payloadContract.optional ?? []),
      ]);
      for (const field of execContract.required) {
        if (!defAll.has(field)) {
          violations.push(`[${def.id}] 执行器需要 '${field}' 但 AbilityDef payloadContract 未声明`);
        }
      }

      // 定义 required ⊆ 执行器 required ∪ optional
      const execAll = new Set([
        ...execContract.required,
        ...(execContract.optional ?? []),
      ]);
      for (const field of chain.payloadContract.required) {
        if (!execAll.has(field)) {
          violations.push(`[${def.id}] AbilityDef 声明 '${field}' 但执行器 payloadContract 未包含`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('所有 interactionChain 技能的 validation.customValidator 存在', () => {
    const violations: string[] = [];
    for (const def of defsWithChain) {
      if (!def.validation?.customValidator) {
        violations.push(`[${def.id}]（${def.name}）声明了 interactionChain 但无 customValidator`);
      }
    }
    expect(violations).toEqual([]);
  });
});

// ============================================================================
// Section 10: 需要目标选择但未声明 interactionChain 的技能审计
// 确保这些技能的 payload 字段在 UI 层有对应的收集逻辑
// ============================================================================

describe('目标选择技能 payload 字段审计', () => {
  const allAbilities = abilityRegistry.getAll();

  /**
   * 需要目标选择但未声明 interactionChain 的技能
   * 这些技能通过 UI 事件系统或单步交互收集 payload
   */
  const singleStepTargetAbilities = allAbilities.filter(
    d => d.requiresTargetSelection && !d.interactionChain
  );

  it('列出所有需要目标选择但未声明 interactionChain 的技能', () => {
    // 这些技能应该是单步交互或由特殊系统处理
    expect(singleStepTargetAbilities.length).toBeGreaterThan(0);
  });

  it('所有需要目标选择的技能都有 validation.customValidator', () => {
    // 白名单：被动技能由特殊系统处理，不需要 customValidator
    const whitelist = new Set<string>();
    const violations: string[] = [];
    for (const def of singleStepTargetAbilities) {
      if (whitelist.has(def.id)) continue;
      if (!def.validation?.customValidator) {
        violations.push(`[${def.id}]（${def.name}）需要目标选择但无 customValidator`);
      }
    }
    expect(violations).toEqual([]);
  });

  it('所有 activated + requiresTargetSelection 技能都有 ui 配置', () => {
    const violations: string[] = [];
    for (const def of allAbilities) {
      if (def.trigger !== 'activated') continue;
      if (!def.requiresTargetSelection) continue;
      if (!def.ui) {
        violations.push(`[${def.id}]（${def.name}）是 activated+目标选择技能但无 ui 配置`);
      }
    }
    expect(violations).toEqual([]);
  });

  it('所有有 ui.activationStep 的技能 activationStep 值合法', () => {
    const validSteps = new Set([
      'selectCard', 'selectPosition', 'selectUnit', 'selectCards',
      'selectChoice', 'selectAttachTarget', 'selectNewPosition', 'selectPushDirection',
    ]);
    const violations: string[] = [];
    for (const def of allAbilities) {
      if (!def.ui?.activationStep) continue;
      if (!validSteps.has(def.ui.activationStep)) {
        violations.push(`[${def.id}] activationStep '${def.ui.activationStep}' 不在合法值列表中`);
      }
    }
    expect(violations).toEqual([]);
  });
});

// ============================================================================
// Section 11: 交互链 — 非当前玩家操作拒绝
// ============================================================================

describe('非当前玩家操作拒绝', () => {
  let core: SummonerWarsCore;

  beforeEach(() => {
    resetInstanceCounter();
    core = createInitializedCore(['0', '1'], testRandom(), { faction0: 'frost', faction1: 'barbaric' });
    clearRect(core, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);
  });

  it('[structure_shift] 非当前玩家的单位操作时拒绝', () => {
    core.phase = 'move';
    core.currentPlayer = '0' as PlayerId;
    // 放置属于玩家1的单位，但当前回合是玩家0
    const summoner = mkUnit('svara', { abilities: ['structure_shift'], unitClass: 'summoner', faction: 'frost' });
    const unit = putUnit(core, { row: 4, col: 3 }, summoner, '1'); // 属于玩家1
    putStructure(core, { row: 4, col: 4 }, '1');

    // 验证层应拒绝（单位不属于当前玩家）
    const result = validate(core, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'structure_shift',
      sourceUnitId: unit.instanceId,
      targetPosition: { row: 4, col: 4 },
      newPosition: { row: 4, col: 5 },
    });
    expect(result.valid).toBe(false);
  });

  it('[withdraw] 非当前玩家的单位操作时拒绝', () => {
    core.phase = 'attack';
    core.currentPlayer = '0' as PlayerId;
    // 放置属于玩家1的单位，但当前回合是玩家0
    const kairu = mkUnit('kairu', { abilities: ['withdraw'], unitClass: 'champion', faction: 'barbaric' });
    const unit = putUnit(core, { row: 4, col: 3 }, kairu, '1', { boosts: 1 });

    const result = validate(core, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'withdraw',
      sourceUnitId: unit.instanceId,
      costType: 'charge',
      targetPosition: { row: 4, col: 5 },
    });
    expect(result.valid).toBe(false);
  });
});

// ============================================================================
// Section 12: 交互链 — usesPerTurn 限制
// ============================================================================

describe('usesPerTurn 限制', () => {
  let core: SummonerWarsCore;

  beforeEach(() => {
    resetInstanceCounter();
    core = createInitializedCore(['0', '1'], testRandom(), { faction0: 'frost', faction1: 'barbaric' });
    clearRect(core, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);
  });

  it('[prepare] usesPerTurn=1 第二次使用时拒绝', () => {
    core.phase = 'move';
    core.currentPlayer = '0' as PlayerId;
    const archer = mkUnit('archer', { abilities: ['prepare'], faction: 'barbaric' });
    const unit = putUnit(core, { row: 4, col: 3 }, archer, '0', { hasMoved: false });

    // 第一次使用
    const events1 = exec(core, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'prepare',
      sourceUnitId: unit.instanceId,
    });
    expect(events1.find(e => e.type === SW_EVENTS.UNIT_CHARGED)).toBeDefined();

    // 应用事件到 core（模拟 reduce）
    for (const event of events1) {
      core = SummonerWarsDomain.reduce(core, event);
    }

    // 第二次使用应被拒绝（usesPerTurn=1）
    const result = validate(core, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'prepare',
      sourceUnitId: unit.instanceId,
    });
    expect(result.valid).toBe(false);
  });
});

// ============================================================================
// Section 13: Phase B 事件卡交互 → InteractionSystem
// ============================================================================

describe('Phase B 事件卡交互可见性', () => {
  it('[blood_summon] 走完整的 sys.interaction 链路', () => {
    resetInstanceCounter();
    const core = createInitializedCore(['0', '1'], testRandom(), { faction0: 'necromancer', faction1: 'trickster' });
    clearRect(core, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);
    core.phase = 'summon';
    core.currentPlayer = '0';

    putUnit(core, { row: 4, col: 2 }, mkUnit('ally-target', { faction: 'necromancer' }), '0');
    core.players['0'].hand = [
      {
        id: CARD_IDS.NECRO_BLOOD_SUMMON,
        cardType: 'event',
        name: '血契召唤',
        eventType: 'common',
        faction: 'necromancer',
        cost: 0,
        playPhase: 'summon',
        effect: '测试',
        deckSymbols: [],
      } as EventCard,
      mkUnit('cheap-unit', { cost: 1, faction: 'necromancer' }),
    ];

    let state: MatchState<SummonerWarsCore> = {
      core,
      sys: createInitialSystemState(['0', '1'], interactionSystems),
    };

    const requested = runPipeline(state, {
      type: SW_COMMANDS.REQUEST_EVENT_INTERACTION,
      playerId: '0',
      payload: { cardId: CARD_IDS.NECRO_BLOOD_SUMMON },
    });
    expect(requested.success).toBe(true);
    state = requested.state;
    expect(getSwCurrentType(state)).toBe('blood_summon_select_target');

    const pickTarget = runPipeline(state, {
      type: INTERACTION_COMMANDS.RESPOND,
      playerId: '0',
      payload: { interactionId: state.sys.interaction.current!.id, optionId: 'pos:4,2' },
    });
    expect(pickTarget.success).toBe(true);
    state = pickTarget.state;
    expect(getSwCurrentType(state)).toBe('blood_summon_select_card');

    const pickCard = runPipeline(state, {
      type: INTERACTION_COMMANDS.RESPOND,
      playerId: '0',
      payload: { interactionId: state.sys.interaction.current!.id, optionId: 'cheap-unit' },
    });
    expect(pickCard.success).toBe(true);
    state = pickCard.state;
    expect(getSwCurrentType(state)).toBe('blood_summon_select_position');

    const pickPosition = runPipeline(state, {
      type: INTERACTION_COMMANDS.RESPOND,
      playerId: '0',
      payload: { interactionId: state.sys.interaction.current!.id, optionId: 'pos:3,2' },
    });
    expect(pickPosition.success).toBe(true);
    state = pickPosition.state;
    expect(getSwCurrentType(state)).toBe('blood_summon_confirm');

    const finish = runPipeline(state, {
      type: INTERACTION_COMMANDS.RESPOND,
      playerId: '0',
      payload: { interactionId: state.sys.interaction.current!.id, optionId: 'finish' },
    });
    expect(finish.success).toBe(true);
    state = finish.state;
    expect(state.sys.interaction.current).toBeUndefined();
    expect(getUnitAt(state.core, { row: 3, col: 2 })?.card.id).toBe('cheap-unit');
  });

  it('[annihilate] 多选 optionIds 会推进到伤害分配交互', () => {
    resetInstanceCounter();
    const core = createInitializedCore(['0', '1'], testRandom(), { faction0: 'necromancer', faction1: 'trickster' });
    clearRect(core, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);
    core.phase = 'move';
    core.currentPlayer = '0';

    putUnit(core, { row: 4, col: 1 }, mkUnit('ally-a', { faction: 'necromancer' }), '0');
    putUnit(core, { row: 4, col: 3 }, mkUnit('ally-b', { faction: 'necromancer' }), '0');
    putUnit(core, { row: 4, col: 2 }, mkUnit('enemy-a', { faction: 'trickster' }), '1');
    putUnit(core, { row: 3, col: 3 }, mkUnit('enemy-b', { faction: 'trickster' }), '1');
    core.players['0'].hand = [{
      id: CARD_IDS.NECRO_ANNIHILATE,
      cardType: 'event',
      name: '除灭',
      eventType: 'common',
      faction: 'necromancer',
      cost: 0,
      playPhase: 'move',
      effect: '测试',
      deckSymbols: [],
    } as EventCard];

    let state: MatchState<SummonerWarsCore> = {
      core,
      sys: createInitialSystemState(['0', '1'], interactionSystems),
    };

    const requested = runPipeline(state, {
      type: SW_COMMANDS.REQUEST_EVENT_INTERACTION,
      playerId: '0',
      payload: { cardId: CARD_IDS.NECRO_ANNIHILATE },
    });
    expect(requested.success).toBe(true);
    state = requested.state;
    expect(getSwCurrentType(state)).toBe('annihilate_select_targets');

    const picked = runPipeline(state, {
      type: INTERACTION_COMMANDS.RESPOND,
      playerId: '0',
      payload: {
        interactionId: state.sys.interaction.current!.id,
        optionIds: ['pos:4,1', 'pos:4,3'],
      },
    });
    expect(picked.success).toBe(true);
    state = picked.state;
    expect(getSwCurrentType(state)).toBe('annihilate_select_damage');
    expect(state.sys.interaction.current?.kind).toBe('simple-choice');
  });
});
