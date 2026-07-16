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
import { FLOW_COMMANDS } from '../../../engine/systems/FlowSystem';
import { INTERACTION_EVENTS } from '../../../engine/systems/InteractionSystem';
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

function runGamePipeline(
  state: MatchState<SummonerWarsCore>,
  command: { type: string; playerId: PlayerId; payload: Record<string, unknown> },
) {
  return executePipeline(
    { domain: engineConfig.domain, systems: engineConfig.systems as any },
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
  it('[fortress_power] 攻击后选牌交互应完整收口到手牌/弃牌堆最终状态', () => {
    resetInstanceCounter();
    const core = createInitializedCore(['0', '1'], testRandom(), { faction0: 'paladin', faction1: 'necromancer' });
    clearRect(core, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);
    core.phase = 'attack';
    core.currentPlayer = '0';

    const seraPos = { row: 4, col: 2 };
    const enemyPos = { row: 4, col: 4 };
    const fortressCardId = 'fortress-warrior-discard';
    putUnit(
      core,
      seraPos,
      mkUnit('paladin-sera-test', {
        faction: 'paladin',
        unitClass: 'summoner',
        name: '瑟拉·艾德温',
        abilities: ['fortress_power'],
        strength: 2,
        life: 12,
        attackType: 'ranged',
        attackRange: 3,
      }),
      '0',
    );
    putUnit(
      core,
      { row: 3, col: 2 },
      mkUnit('paladin-fortress-knight-board', {
        faction: 'paladin',
        name: '城塞骑士',
        abilities: [],
      }),
      '0',
    );
    putUnit(
      core,
      enemyPos,
      mkUnit('fortress-power-enemy', {
        faction: 'necromancer',
        unitClass: 'common',
        strength: 1,
        life: 8,
        attackType: 'melee',
        attackRange: 1,
      }),
      '1',
    );
    core.players['0'].discard.push(mkUnit(fortressCardId, {
      faction: 'paladin',
      name: '城塞圣武士',
      abilities: ['judgment'],
    }));

    let state: MatchState<SummonerWarsCore> = {
      core,
      sys: createInitialSystemState(['0', '1'], interactionSystems),
    };

    const requested = runPipeline(state, {
      type: SW_COMMANDS.DECLARE_ATTACK,
      playerId: '0',
      payload: { attacker: seraPos, target: enemyPos },
    });
    expect(requested.success).toBe(true);
    state = requested.state;
    expect(getSwCurrentType(state)).toBe('activated_ability_target');

    const current = state.sys.interaction.current;
    expect(current?.kind).toBe('simple-choice');
    const options = ((current?.data as { options?: PromptOption[] } | undefined)?.options ?? []) as PromptOption[];
    const fortressOptionId = options.find((option) => {
      const value = option.value as { action?: string; abilityId?: string; targetCardId?: string } | undefined;
      return value?.action === 'activated_ability_target'
        && value.abilityId === 'fortress_power'
        && value.targetCardId === fortressCardId;
    })?.id;
    expect(fortressOptionId).toBe(fortressCardId);

    const picked = runPipeline(state, {
      type: INTERACTION_COMMANDS.RESPOND,
      playerId: '0',
      payload: { interactionId: current!.id, optionId: fortressOptionId },
    });
    expect(picked.success).toBe(true);
    state = picked.state;

    expect(state.sys.interaction.current).toBeUndefined();
    expect(state.sys.interaction.queue.length).toBe(0);
    expect(state.core.players['0'].hand.some((card) => card.id === fortressCardId)).toBe(true);
    expect(state.core.players['0'].discard.some((card) => card.id === fortressCardId)).toBe(false);

    const duplicateResponse = runPipeline(state, {
      type: INTERACTION_COMMANDS.RESPOND,
      playerId: '0',
      payload: { interactionId: current!.id, optionId: fortressOptionId },
    });
    expect(duplicateResponse.success).toBe(false);
    expect(duplicateResponse.state.core.players['0'].hand.filter((card) => card.id === fortressCardId)).toHaveLength(1);
  });

  it('[fortress_power] 同一触发事件重复处理时不应重复创建选牌入口', () => {
    resetInstanceCounter();
    const core = createInitializedCore(['0', '1'], testRandom(), { faction0: 'paladin', faction1: 'necromancer' });
    clearRect(core, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);
    core.phase = 'attack';
    core.currentPlayer = '0';

    const seraPos = { row: 4, col: 2 };
    const sourceUnit = putUnit(
      core,
      seraPos,
      mkUnit('paladin-sera-duplicate-test', {
        faction: 'paladin',
        unitClass: 'summoner',
        name: '瑟拉·艾德温',
        abilities: ['fortress_power'],
        strength: 2,
        life: 12,
        attackType: 'ranged',
        attackRange: 3,
      }),
      '0',
    );
    putUnit(
      core,
      { row: 3, col: 2 },
      mkUnit('paladin-fortress-guard-board', {
        faction: 'paladin',
        name: '城塞守卫',
        abilities: [],
      }),
      '0',
    );
    core.players['0'].discard.push(mkUnit('fortress-guard-discard', {
      faction: 'paladin',
      name: '城塞守卫',
      abilities: [],
    }));

    let state: MatchState<SummonerWarsCore> = {
      core,
      sys: createInitialSystemState(['0', '1'], interactionSystems),
    };
    const duplicateTrigger = {
      type: SW_EVENTS.ABILITY_TRIGGERED,
      payload: {
        abilityId: 'fortress_power',
        actionId: 'fortress_power_retrieve',
        sourceUnitId: sourceUnit.instanceId,
        sourcePosition: seraPos,
      },
      timestamp: 42,
    };
    const command = {
      type: SW_COMMANDS.END_PHASE,
      playerId: '0' as PlayerId,
      payload: {},
    };

    for (const system of interactionSystems) {
      const result = system.afterEvents?.({
        state,
        command,
        events: [duplicateTrigger, duplicateTrigger],
        random: testRandom(),
        playerIds: ['0', '1'],
      });
      if (result?.state) state = result.state;
    }

    expect(getSwCurrentType(state)).toBe('activated_ability_target');
    expect(state.sys.interaction.current?.id).toBe(`sw-after-attack-fortress-power-42-${sourceUnit.instanceId}`);
    expect(state.sys.interaction.queue).toHaveLength(0);
  });

  it('[revive_undead] 真实交互链应自伤、选弃牌堆亡灵、召唤落位且重复响应不二次执行', () => {
    resetInstanceCounter();
    const core = createInitializedCore(['0', '1'], testRandom(), { faction0: 'necromancer', faction1: 'necromancer' });
    clearRect(core, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);
    core.phase = 'summon';
    core.currentPlayer = '0';

    const source = putUnit(core, { row: 4, col: 3 }, mkUnit('ret-talus-l4', {
      abilities: ['revive_undead'],
      faction: 'necromancer',
      unitClass: 'summoner',
      name: '雷塔勒斯',
      life: 8,
    }), '0');
    const undeadCard = mkUnit('skeleton-warrior-l4', {
      faction: 'necromancer',
      unitClass: 'common',
      name: '骷髅战士',
    });
    const discardCard = { ...undeadCard, id: 'skeleton-warrior-l4-discard' };
    core.players['0'].discard.push(discardCard as UnitCard);

    let state: MatchState<SummonerWarsCore> = {
      core,
      sys: createInitialSystemState(['0', '1'], interactionSystems),
    };

    const opened = runPipeline(state, {
      type: SW_COMMANDS.ACTIVATE_ABILITY,
      playerId: '0',
      payload: { abilityId: 'revive_undead', sourceUnitId: source.instanceId },
    });
    expect(opened.success).toBe(true);
    state = opened.state;
    expect(getSwCurrentType(state)).toBe('activated_ability_target');

    const selectCard = state.sys.interaction.current;
    expect(selectCard?.kind).toBe('simple-choice');
    expect((selectCard?.data as { sw?: { abilityId?: string; step?: string; sourceUnitId?: string } } | undefined)?.sw).toMatchObject({
      abilityId: 'revive_undead',
      step: 'selectCard',
      sourceUnitId: source.instanceId,
    });
    const cardOptions = ((selectCard?.data as { options?: Array<{ id: string }> } | undefined)?.options ?? []);
    expect(cardOptions.map((option) => option.id)).toContain(discardCard.id);

    const pickedCard = runPipeline(state, {
      type: INTERACTION_COMMANDS.RESPOND,
      playerId: '0',
      payload: { interactionId: selectCard!.id, optionId: discardCard.id },
    });
    expect(pickedCard.success).toBe(true);
    state = pickedCard.state;

    const selectPosition = state.sys.interaction.current;
    expect(selectPosition?.kind).toBe('simple-choice');
    expect((selectPosition?.data as { sw?: { abilityId?: string; step?: string; targetCardId?: string } } | undefined)?.sw).toMatchObject({
      abilityId: 'revive_undead',
      step: 'selectPosition',
      targetCardId: discardCard.id,
    });
    const targetPosition = { row: 4, col: 4 };
    const positionOptions = ((selectPosition?.data as { options?: Array<{ id: string; value?: { targetPosition?: CellCoord } }> } | undefined)?.options ?? []);
    const targetOptionId = positionOptions.find((option) =>
      option.value?.targetPosition?.row === targetPosition.row
      && option.value?.targetPosition?.col === targetPosition.col
    )?.id;
    expect(targetOptionId).toBeTruthy();

    const resolved = runPipeline(state, {
      type: INTERACTION_COMMANDS.RESPOND,
      playerId: '0',
      payload: { interactionId: selectPosition!.id, optionId: targetOptionId },
    });
    expect(resolved.success).toBe(true);
    state = resolved.state;

    expect(state.sys.interaction.current).toBeUndefined();
    expect(getUnitAt(state.core, source.position)?.damage).toBe(2);
    expect(getUnitAt(state.core, targetPosition)?.card.id).toBe(discardCard.id);
    expect(state.core.players['0'].discard.some((card) => card.id === discardCard.id)).toBe(false);
    expect(resolved.events.filter((event) =>
      event.type === SW_EVENTS.UNIT_DAMAGED
      && (event.payload as Record<string, unknown>).reason === 'revive_undead'
    )).toHaveLength(1);
    expect(resolved.events.filter((event) => event.type === SW_EVENTS.UNIT_SUMMONED)).toHaveLength(1);

    const duplicateResponse = runPipeline(state, {
      type: INTERACTION_COMMANDS.RESPOND,
      playerId: '0',
      payload: { interactionId: selectPosition!.id, optionId: targetOptionId },
    });
    expect(duplicateResponse.success).toBe(false);
    expect(getUnitAt(duplicateResponse.state.core, source.position)?.damage).toBe(2);
    expect(getUnitAt(duplicateResponse.state.core, targetPosition)?.card.id).toBe(discardCard.id);
  });

  it('[mind_transmission] 攻击敌方建筑后应按敌方卡牌入口生成传念选择', () => {
    resetInstanceCounter();
    const core = createInitializedCore(['0', '1'], testRandom(), { faction0: 'trickster', faction1: 'necromancer' });
    clearRect(core, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);
    core.phase = 'attack';
    core.currentPlayer = '0';

    const gurzhuangPos = { row: 4, col: 2 };
    const structurePos = { row: 4, col: 3 };
    const allyPos = { row: 3, col: 2 };
    putUnit(
      core,
      gurzhuangPos,
      mkUnit('gurzhuang-system-test', {
        abilities: ['mind_transmission'],
        unitClass: 'champion',
        faction: 'trickster',
        strength: 2,
        life: 6,
      }),
      '0',
    );
    putStructure(core, structurePos, '1', mkStructure('enemy-structure-card', { faction: 'necromancer', life: 8 }));
    putUnit(core, allyPos, mkUnit('mind-transmission-ally-common', { unitClass: 'common', faction: 'trickster' }), '0');

    let state: MatchState<SummonerWarsCore> = {
      core,
      sys: createInitialSystemState(['0', '1'], interactionSystems),
    };
    const result = runPipeline(state, {
      type: SW_COMMANDS.DECLARE_ATTACK,
      playerId: '0',
      payload: { attacker: gurzhuangPos, target: structurePos },
    });
    expect(result.success).toBe(true);
    state = result.state;

    expect(getSwCurrentType(state)).toBe('after_attack_mind_transmission');
    const current = state.sys.interaction.current;
    const options = ((current?.data as { options?: PromptOption[] } | undefined)?.options ?? []) as PromptOption[];
    expect(options.some((option) => {
      const value = option.value as { action?: string; targetPosition?: CellCoord } | undefined;
      return value?.action === 'after_attack_mind_transmission'
        && value.targetPosition?.row === allyPos.row
        && value.targetPosition?.col === allyPos.col;
    })).toBe(true);
  });

  it('[mind_transmission] 选择友方士兵后只授予一次额外攻击，重复响应不应二次授予', () => {
    resetInstanceCounter();
    const core = createInitializedCore(['0', '1'], testRandom(), { faction0: 'trickster', faction1: 'necromancer' });
    clearRect(core, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);
    core.phase = 'attack';
    core.currentPlayer = '0';

    const gurzhuangPos = { row: 4, col: 2 };
    const structurePos = { row: 4, col: 3 };
    const allyPos = { row: 3, col: 2 };
    const ally = putUnit(core, allyPos, mkUnit('mind-transmission-l4-ally', {
      unitClass: 'common',
      faction: 'trickster',
    }), '0');
    putUnit(core, gurzhuangPos, mkUnit('gurzhuang-l4-test', {
      abilities: ['mind_transmission'],
      unitClass: 'champion',
      faction: 'trickster',
      strength: 2,
      life: 6,
    }), '0');
    putStructure(core, structurePos, '1', mkStructure('mind-transmission-l4-enemy-structure', {
      faction: 'necromancer',
      life: 8,
    }));

    let state: MatchState<SummonerWarsCore> = {
      core,
      sys: createInitialSystemState(['0', '1'], interactionSystems),
    };

    const requested = runPipeline(state, {
      type: SW_COMMANDS.DECLARE_ATTACK,
      playerId: '0',
      payload: { attacker: gurzhuangPos, target: structurePos },
    });
    expect(requested.success).toBe(true);
    state = requested.state;
    expect(getSwCurrentType(state)).toBe('after_attack_mind_transmission');

    const current = state.sys.interaction.current;
    expect(current?.kind).toBe('simple-choice');
    const options = ((current?.data as { options?: PromptOption[] } | undefined)?.options ?? []) as PromptOption[];
    const targetOptionId = options.find((option) => {
      const value = option.value as { action?: string; targetPosition?: CellCoord } | undefined;
      return value?.action === 'after_attack_mind_transmission'
        && value.targetPosition?.row === allyPos.row
        && value.targetPosition?.col === allyPos.col;
    })?.id;
    expect(targetOptionId).toBeTruthy();

    const picked = runPipeline(state, {
      type: INTERACTION_COMMANDS.RESPOND,
      playerId: '0',
      payload: { interactionId: current!.id, optionId: targetOptionId },
    });
    expect(picked.success).toBe(true);
    state = picked.state;

    expect(state.sys.interaction.current).toBeUndefined();
    expect(state.sys.interaction.queue.length).toBe(0);
    expect(getUnitAt(state.core, allyPos)?.extraAttacks).toBe(1);
    expect(getUnitAt(state.core, allyPos)?.hasAttacked).toBe(false);

    const duplicateResponse = runPipeline(state, {
      type: INTERACTION_COMMANDS.RESPOND,
      playerId: '0',
      payload: { interactionId: current!.id, optionId: targetOptionId },
    });
    expect(duplicateResponse.success).toBe(false);
    expect(getUnitAt(duplicateResponse.state.core, allyPos)?.instanceId).toBe(ally.instanceId);
    expect(getUnitAt(duplicateResponse.state.core, allyPos)?.extraAttacks).toBe(1);
  });

  it('[rapid_fire] 确认后只授予本单位一次额外攻击，重复响应不应再次消耗或授予', () => {
    resetInstanceCounter();
    const core = createInitializedCore(['0', '1'], testRandom(), { faction0: 'barbaric', faction1: 'necromancer' });
    clearRect(core, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);
    core.phase = 'attack';
    core.currentPlayer = '0';

    const archerPos = { row: 4, col: 2 };
    const enemyPos = { row: 4, col: 3 };
    const archer = putUnit(core, archerPos, mkUnit('barbaric-frontier-archer-l4-test', {
      faction: 'barbaric',
      unitClass: 'common',
      abilities: ['prepare', 'rapid_fire'],
      strength: 2,
      life: 4,
      attackType: 'ranged',
      attackRange: 3,
    }), '0', { boosts: 1, hasAttacked: false });
    putUnit(core, enemyPos, mkUnit('rapid-fire-l4-enemy', {
      faction: 'necromancer',
      unitClass: 'common',
      strength: 1,
      life: 8,
      attackType: 'melee',
      attackRange: 1,
    }), '1');

    let state: MatchState<SummonerWarsCore> = {
      core,
      sys: createInitialSystemState(['0', '1'], interactionSystems),
    };

    const requested = runPipeline(state, {
      type: SW_COMMANDS.DECLARE_ATTACK,
      playerId: '0',
      payload: { attacker: archerPos, target: enemyPos },
    });
    expect(requested.success).toBe(true);
    state = requested.state;
    expect(getSwCurrentType(state)).toBe('after_attack_rapid_fire');

    const current = state.sys.interaction.current;
    expect(current?.kind).toBe('simple-choice');
    const options = ((current?.data as { options?: PromptOption[] } | undefined)?.options ?? []) as PromptOption[];
    const confirmOptionId = options.find((option) => {
      const value = option.value as { action?: string; confirm?: boolean } | undefined;
      return value?.action === 'after_attack_rapid_fire' && value.confirm === true;
    })?.id;
    expect(confirmOptionId).toBe('confirm');

    const confirmed = runPipeline(state, {
      type: INTERACTION_COMMANDS.RESPOND,
      playerId: '0',
      payload: { interactionId: current!.id, optionId: confirmOptionId },
    });
    expect(confirmed.success).toBe(true);
    state = confirmed.state;

    expect(state.sys.interaction.current).toBeUndefined();
    expect(state.sys.interaction.queue.length).toBe(0);
    const archerAfterConfirm = getUnitAt(state.core, archerPos);
    expect(archerAfterConfirm?.instanceId).toBe(archer.instanceId);
    expect(archerAfterConfirm?.boosts).toBe(0);
    expect(archerAfterConfirm?.extraAttacks).toBe(1);
    expect(archerAfterConfirm?.hasAttacked).toBe(false);

    const duplicateResponse = runPipeline(state, {
      type: INTERACTION_COMMANDS.RESPOND,
      playerId: '0',
      payload: { interactionId: current!.id, optionId: confirmOptionId },
    });
    expect(duplicateResponse.success).toBe(false);
    const archerAfterDuplicate = getUnitAt(duplicateResponse.state.core, archerPos);
    expect(archerAfterDuplicate?.boosts).toBe(0);
    expect(archerAfterDuplicate?.extraAttacks).toBe(1);
  });

  it('[mind_transmission] 非治疗单位不能攻击友方目标，因此不会生成传念入口', () => {
    resetInstanceCounter();
    const core = createInitializedCore(['0', '1'], testRandom(), { faction0: 'trickster', faction1: 'necromancer' });
    clearRect(core, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);
    core.phase = 'attack';
    core.currentPlayer = '0';

    const gurzhuangPos = { row: 4, col: 2 };
    const friendlyTargetPos = { row: 4, col: 3 };
    putUnit(
      core,
      gurzhuangPos,
      mkUnit('gurzhuang-friendly-attack-test', {
        abilities: ['mind_transmission'],
        unitClass: 'champion',
        faction: 'trickster',
      }),
      '0',
    );
    putUnit(core, friendlyTargetPos, mkUnit('friendly-target-card', { unitClass: 'common', faction: 'trickster' }), '0');

    const state: MatchState<SummonerWarsCore> = {
      core,
      sys: createInitialSystemState(['0', '1'], interactionSystems),
    };
    const result = runPipeline(state, {
      type: SW_COMMANDS.DECLARE_ATTACK,
      playerId: '0',
      payload: { attacker: gurzhuangPos, target: friendlyTargetPos },
    });

    expect(result.success).toBe(false);
    expect(getSwCurrentType(result.state)).toBeUndefined();
  });

  it('[withdraw] DECLARE_ATTACK 后应排出费用交互，并可完成两步撤退链', () => {
    resetInstanceCounter();
    const core = createInitializedCore(['0', '1'], testRandom(), { faction0: 'barbaric', faction1: 'necromancer' });
    clearRect(core, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);
    core.phase = 'attack';
    core.currentPlayer = '0';
    core.players['0'].magic = 3;

    const kairuPos = { row: 4, col: 2 };
    const enemyPos = { row: 4, col: 3 };
    const withdrawPos = { row: 4, col: 1 };
    const kairu = putUnit(
      core,
      kairuPos,
      mkUnit('barbaric-kairu-test', {
        faction: 'barbaric',
        unitClass: 'champion',
        abilities: ['inspire', 'withdraw'],
        strength: 3,
        life: 7,
        attackType: 'melee',
        attackRange: 1,
      }),
      '0',
      { boosts: 2, hasAttacked: false },
    );
    putUnit(
      core,
      enemyPos,
      mkUnit('withdraw-enemy', {
        faction: 'necromancer',
        unitClass: 'common',
        strength: 1,
        life: 2,
        attackType: 'melee',
        attackRange: 1,
      }),
      '1',
    );

    let state: MatchState<SummonerWarsCore> = {
      core,
      sys: createInitialSystemState(['0', '1'], interactionSystems),
    };

    const requested = runPipeline(state, {
      type: SW_COMMANDS.DECLARE_ATTACK,
      playerId: '0',
      payload: { attacker: kairuPos, target: enemyPos },
    });
    expect(requested.success).toBe(true);
    state = requested.state;
    expect(getSwCurrentType(state)).toBe('after_attack_withdraw_cost');

    const costCurrent = state.sys.interaction.current;
    expect(costCurrent?.kind).toBe('simple-choice');
    const costOptions = ((costCurrent?.data as { options?: PromptOption[] } | undefined)?.options ?? []) as PromptOption[];
    const chargeOptionId = costOptions.find((option) => {
      const value = option.value as { action?: string; costType?: string } | undefined;
      return value?.action === 'after_attack_withdraw_cost' && value.costType === 'charge';
    })?.id;
    expect(chargeOptionId).toBeTruthy();

    const pickCost = runPipeline(state, {
      type: INTERACTION_COMMANDS.RESPOND,
      playerId: '0',
      payload: { interactionId: costCurrent!.id, optionId: chargeOptionId },
    });
    expect(pickCost.success).toBe(true);
    state = pickCost.state;
    expect(getSwCurrentType(state)).toBe('after_attack_withdraw_position');

    const positionCurrent = state.sys.interaction.current;
    expect(positionCurrent?.kind).toBe('simple-choice');
    const positionOptions = ((positionCurrent?.data as { options?: PromptOption[] } | undefined)?.options ?? []) as PromptOption[];
    const positionOptionId = positionOptions.find((option) => {
      const value = option.value as { action?: string; targetPosition?: CellCoord } | undefined;
      return value?.action === 'after_attack_withdraw_position'
        && value.targetPosition?.row === withdrawPos.row
        && value.targetPosition?.col === withdrawPos.col;
    })?.id;
    expect(positionOptionId).toBeTruthy();

    const pickPosition = runPipeline(state, {
      type: INTERACTION_COMMANDS.RESPOND,
      playerId: '0',
      payload: { interactionId: positionCurrent!.id, optionId: positionOptionId },
    });
    expect(pickPosition.success).toBe(true);
    state = pickPosition.state;

    expect(state.sys.interaction.current).toBeUndefined();
    expect(state.sys.interaction.queue.length).toBe(0);
    expect(getUnitAt(state.core, kairuPos)).toBeUndefined();
    const moved = getUnitAt(state.core, withdrawPos);
    expect(moved?.instanceId).toBe(kairu.instanceId);
    expect(moved?.boosts).toBe(1);
  });

  it('[fire_sacrifice_summon/L4] 召唤后只列己方非召唤师并且重复响应不二次结算', () => {
    resetInstanceCounter();
    const core = createInitializedCore(['0', '1'], testRandom(), { faction0: 'necromancer', faction1: 'trickster' });
    clearRect(core, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);
    core.phase = 'summon';
    core.currentPlayer = '0';

    const summonPos = { row: 4, col: 2 };
    const sacrificePos = { row: 5, col: 2 };
    const sacrifice = putUnit(core, sacrificePos, mkUnit('fire-sacrifice-target', { unitClass: 'common', faction: 'necromancer' }), '0');
    const allySummoner = putUnit(core, { row: 5, col: 3 }, mkUnit('fire-sacrifice-ally-summoner', {
      unitClass: 'summoner',
      faction: 'necromancer',
    }), '0');
    const enemyCommon = putUnit(core, { row: 5, col: 4 }, mkUnit('fire-sacrifice-enemy-common', {
      unitClass: 'common',
      faction: 'trickster',
    }), '1');

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
    const sacrificeIds = currentOptions.map((option) => {
      const value = option.value as { action?: string; sacrificeUnitId?: string } | undefined;
      return value?.sacrificeUnitId;
    });
    expect(sacrificeIds).toContain(sacrifice.instanceId);
    expect(sacrificeIds).not.toContain(allySummoner.instanceId);
    expect(sacrificeIds).not.toContain(enemyCommon.instanceId);

    const optionId = currentOptions.find((option) => {
      const value = option.value as { action?: string; sacrificeUnitId?: string } | undefined;
      return value?.action === 'fire_sacrifice_summon' && value.sacrificeUnitId === sacrifice.instanceId;
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
    expect(state.sys.interaction.queue.length).toBe(0);
    expect(state.core.players['0'].magic).toBe(8);
    const summoned = getUnitAt(state.core, sacrificePos);
    expect(summoned?.card.id).toBe(fireSacrificeCard.id);
    expect(getUnitAt(state.core, summonPos)).toBeUndefined();
    expect(state.core.players['0'].hand.some((card) => card.id === fireSacrificeCard.id)).toBe(false);
    expect(getUnitAt(state.core, { row: 5, col: 3 })?.instanceId).toBe(allySummoner.instanceId);
    expect(getUnitAt(state.core, { row: 5, col: 4 })?.instanceId).toBe(enemyCommon.instanceId);

    const repeatResult = runPipeline(state, {
      type: INTERACTION_COMMANDS.RESPOND,
      playerId: '0',
      payload: { interactionId: current!.id, optionId },
    });
    expect(repeatResult.success).toBe(false);
    expect(getUnitAt(state.core, sacrificePos)?.instanceId).toBe(summoned?.instanceId);
    expect(getUnitAt(state.core, summonPos)).toBeUndefined();
    expect(state.core.players['0'].magic).toBe(8);
  });

  it('[ice_ram] 两步系统交互可完成推拉且不会重触发', () => {
    resetInstanceCounter();
    const core = createInitializedCore(['0', '1'], testRandom(), { faction0: 'frost', faction1: 'barbaric' });
    clearRect(core, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);
    core.phase = 'move';
    core.currentPlayer = '0';
    core.players['0'].activeEvents.push({
      id: `${CARD_IDS.FROST_ICE_RAM}-0-0`,
      cardType: 'event',
      name: '寒冰冲撞',
      eventType: 'normal',
      faction: 'frost',
      cost: 1,
      playPhase: 'summon',
      effect: '持续效果',
      isActive: true,
      deckSymbols: [],
    });

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
    // 注入真实 active event 后，二步响应会实际完成推拉；这里验证交互链能收口且不会重触发
    expect(getUnitAt(state.core, targetPos)).toBeUndefined();
    expect(getUnitAt(state.core, pushPos)?.instanceId).toBe(target.instanceId);
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

  it('[ice_ram] 目标选择和执行器应排除召唤师', () => {
    resetInstanceCounter();
    const core = createInitializedCore(['0', '1'], testRandom(), { faction0: 'frost', faction1: 'barbaric' });
    clearRect(core, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);
    core.phase = 'move';
    core.currentPlayer = '0';
    core.players['0'].activeEvents.push({
      id: `${CARD_IDS.FROST_ICE_RAM}-0-0`,
      cardType: 'event',
      name: '寒冰冲撞',
      eventType: 'normal',
      faction: 'frost',
      cost: 1,
      playPhase: 'summon',
      effect: '持续效果',
      isActive: true,
      deckSymbols: [],
    });

    const structurePos = { row: 4, col: 3 };
    const structureFrom = { row: 4, col: 2 };
    const summonerPos = { row: 4, col: 4 };
    const commonPos = { row: 3, col: 3 };
    const structureTargetPos = { row: 5, col: 3 };
    putUnit(core, structureFrom, mkUnit('mobile-structure', {
      abilities: ['mobile_structure'],
      faction: 'frost',
      unitClass: 'common',
    }), '0');
    putStructure(core, structureTargetPos, '1');
    const summoner = putUnit(core, summonerPos, mkUnit('ice-ram-summoner', {
      faction: 'barbaric',
      unitClass: 'summoner',
    }), '1');
    putUnit(core, commonPos, mkUnit('ice-ram-common', {
      faction: 'barbaric',
      unitClass: 'common',
    }), '1');

    const state: MatchState<SummonerWarsCore> = {
      core,
      sys: createInitialSystemState(['0', '1'], engineConfig.systems as any),
    };

    const moveResult = runGamePipeline(state, {
      type: SW_COMMANDS.MOVE_UNIT,
      playerId: '0',
      payload: {
        from: structureFrom,
        to: structurePos,
        path: [structureFrom, structurePos],
      },
    });

    expect(moveResult.success).toBe(true);
    const current = moveResult.state.sys.interaction.current;
    expect(current?.kind).toBe('simple-choice');
    expect(getSwCurrentType(moveResult.state)).toBe('ice_ram_target');
    const targetOptions = ((current?.data as { options?: PromptOption[] } | undefined)?.options ?? []) as PromptOption[];
    const targetPositions = targetOptions
      .map((option) => (option.value as { targetPosition?: CellCoord } | undefined)?.targetPosition)
      .filter((pos): pos is CellCoord => !!pos);

    expect(targetPositions).toContainEqual(commonPos);
    expect(targetPositions).not.toContainEqual(summonerPos);
    expect(targetPositions).not.toContainEqual(structureTargetPos);

    const summonerEvents = exec(core, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'ice_ram',
      sourceUnitId: 'ice_ram',
      targetPosition: summonerPos,
      structurePosition: structurePos,
    });
    expect(summonerEvents.some(e =>
      e.type === SW_EVENTS.UNIT_DAMAGED
      && (e.payload as Record<string, unknown>).reason === 'ice_ram'
    )).toBe(false);
    expect(getUnitAt(core, summonerPos)?.instanceId).toBe(summoner.instanceId);

    const structureEvents = exec(core, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'ice_ram',
      sourceUnitId: 'ice_ram',
      targetPosition: structureTargetPos,
      structurePosition: structurePos,
    });
    expect(structureEvents.some(e =>
      e.type === SW_EVENTS.UNIT_DAMAGED
      && (e.payload as Record<string, unknown>).reason === 'ice_ram'
    )).toBe(false);
  });

  it('[infection] 真实击杀后应生成选弃牌堆疫病体交互并收口到召唤落位', () => {
    resetInstanceCounter();
    const core = createInitializedCore(['0', '1'], testRandom(), { faction0: 'necromancer', faction1: 'trickster' });
    clearRect(core, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);
    core.phase = 'attack';
    core.currentPlayer = '0';

    const plaguePos = { row: 4, col: 2 };
    const enemyPos = { row: 4, col: 3 };
    const discardedPlague = mkUnit('infection-discard-plague', {
      name: '亡灵疫病体',
      faction: 'necromancer',
      unitClass: 'common',
      abilities: ['soulless', 'infection'],
      life: 1,
    });
    core.players['0'].discard = [discardedPlague];
    putUnit(core, plaguePos, mkUnit('infection-attacker', {
      name: '亡灵疫病体',
      faction: 'necromancer',
      unitClass: 'common',
      abilities: ['soulless', 'infection'],
      strength: 2,
      life: 2,
    }), '0');
    putUnit(core, enemyPos, mkUnit('infection-enemy', {
      faction: 'trickster',
      unitClass: 'common',
      life: 1,
    }), '1');

    let state: MatchState<SummonerWarsCore> = {
      core,
      sys: createInitialSystemState(['0', '1'], interactionSystems),
    };

    const requested = runPipeline(state, {
      type: SW_COMMANDS.DECLARE_ATTACK,
      playerId: '0',
      payload: { attacker: plaguePos, target: enemyPos },
    });
    expect(requested.success).toBe(true);
    state = requested.state;
    expect(getSwCurrentType(state)).toBe('infection');
    expect(getUnitAt(state.core, enemyPos)).toBeUndefined();
    expect(state.core.players['0'].discard.some(card => card.id === discardedPlague.id)).toBe(true);

    const current = state.sys.interaction.current;
    expect(current?.kind).toBe('simple-choice');
    const options = ((current?.data as { options?: PromptOption[] } | undefined)?.options ?? []) as PromptOption[];
    expect(options.map(option => option.id)).toContain(discardedPlague.id);

    const picked = runPipeline(state, {
      type: INTERACTION_COMMANDS.RESPOND,
      playerId: '0',
      payload: { interactionId: current!.id, optionId: discardedPlague.id },
    });
    expect(picked.success).toBe(true);
    state = picked.state;

    expect(state.sys.interaction.current).toBeUndefined();
    expect(state.sys.interaction.queue).toHaveLength(0);
    expect(getUnitAt(state.core, enemyPos)?.card.id).toBe(discardedPlague.id);
    expect(state.core.players['0'].discard.some(card => card.id === discardedPlague.id)).toBe(false);
    expect(picked.events.filter(e => e.type === SW_EVENTS.UNIT_SUMMONED)).toHaveLength(1);

    const duplicateResponse = runPipeline(state, {
      type: INTERACTION_COMMANDS.RESPOND,
      playerId: '0',
      payload: { interactionId: current!.id, optionId: discardedPlague.id },
    });
    expect(duplicateResponse.success).toBe(false);
    expect(getUnitAt(duplicateResponse.state.core, enemyPos)?.card.id).toBe(discardedPlague.id);
  });

  it('[soul_transfer] 确认移动后应收口，重复响应不应再次移动', () => {
    resetInstanceCounter();
    const core = createInitializedCore(['0', '1'], testRandom(), { faction0: 'necromancer', faction1: 'trickster' });
    clearRect(core, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);
    core.phase = 'attack';
    core.currentPlayer = '0';

    const archerPos = { row: 4, col: 1 };
    const attackerPos = { row: 4, col: 2 };
    const victimPos = { row: 4, col: 3 };
    const archer = putUnit(core, archerPos, mkUnit('soul-transfer-archer', {
      faction: 'necromancer',
      unitClass: 'common',
      abilities: ['soul_transfer'],
      attackType: 'ranged',
      attackRange: 3,
    }), '0');
    putUnit(core, attackerPos, mkUnit('soul-transfer-attacker', {
      faction: 'necromancer',
      unitClass: 'common',
      strength: 2,
      life: 2,
    }), '0');
    putUnit(core, victimPos, mkUnit('soul-transfer-victim', {
      faction: 'trickster',
      unitClass: 'common',
      life: 1,
    }), '1');

    let state: MatchState<SummonerWarsCore> = {
      core,
      sys: createInitialSystemState(['0', '1'], interactionSystems),
    };

    const requested = runPipeline(state, {
      type: SW_COMMANDS.DECLARE_ATTACK,
      playerId: '0',
      payload: { attacker: attackerPos, target: victimPos },
    });
    expect(requested.success).toBe(true);
    state = requested.state;
    expect(getSwCurrentType(state)).toBe('soul_transfer');
    expect(getUnitAt(state.core, archerPos)?.instanceId).toBe(archer.instanceId);
    expect(getUnitAt(state.core, victimPos)).toBeUndefined();

    const current = state.sys.interaction.current;
    expect(current?.kind).toBe('simple-choice');
    const confirmed = runPipeline(state, {
      type: INTERACTION_COMMANDS.RESPOND,
      playerId: '0',
      payload: { interactionId: current!.id, optionId: 'confirm' },
    });
    expect(confirmed.success).toBe(true);
    state = confirmed.state;

    expect(state.sys.interaction.current).toBeUndefined();
    expect(state.sys.interaction.queue).toHaveLength(0);
    expect(getUnitAt(state.core, archerPos)).toBeUndefined();
    expect(getUnitAt(state.core, victimPos)?.instanceId).toBe(archer.instanceId);
    expect(confirmed.events.filter(e =>
      e.type === SW_EVENTS.UNIT_MOVED
      && (e.payload as Record<string, unknown>).reason === 'soul_transfer'
    )).toHaveLength(1);

    const duplicateResponse = runPipeline(state, {
      type: INTERACTION_COMMANDS.RESPOND,
      playerId: '0',
      payload: { interactionId: current!.id, optionId: 'confirm' },
    });
    expect(duplicateResponse.success).toBe(false);
    expect(getUnitAt(duplicateResponse.state.core, victimPos)?.instanceId).toBe(archer.instanceId);
  });

  it('[life_drain] 攻击前选择牺牲或跳过应分别收口且不重复牺牲', () => {
    resetInstanceCounter();
    const core = createInitializedCore(['0', '1'], testRandom(), { faction0: 'necromancer', faction1: 'trickster' });
    clearRect(core, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);
    core.phase = 'attack';
    core.currentPlayer = '0';

    const dragosPos = { row: 4, col: 2 };
    const enemyPos = { row: 4, col: 3 };
    const sacrificePos = { row: 3, col: 2 };
    const sacrifice = putUnit(core, sacrificePos, mkUnit('life-drain-sacrifice', {
      faction: 'necromancer',
      unitClass: 'common',
      life: 2,
    }), '0');
    putUnit(core, dragosPos, mkUnit('life-drain-dragos', {
      abilities: ['life_drain'],
      faction: 'necromancer',
      unitClass: 'champion',
      strength: 2,
      life: 8,
      attackType: 'melee',
      attackRange: 1,
    }), '0');
    putUnit(core, enemyPos, mkUnit('life-drain-enemy', {
      faction: 'trickster',
      unitClass: 'common',
      life: 3,
    }), '1');

    let state: MatchState<SummonerWarsCore> = {
      core,
      sys: createInitialSystemState(['0', '1'], interactionSystems),
    };

    const requested = runPipeline(state, {
      type: SW_COMMANDS.DECLARE_ATTACK,
      playerId: '0',
      payload: { attacker: dragosPos, target: enemyPos },
    });
    expect(requested.success).toBe(true);
    state = requested.state;
    expect(getSwCurrentType(state)).toBe('before_attack_life_drain');

    const current = state.sys.interaction.current;
    expect(current?.kind).toBe('simple-choice');
    const options = ((current?.data as { options?: PromptOption[] } | undefined)?.options ?? []) as PromptOption[];
    const sacrificeOptionId = options.find((option) => {
      const value = option.value as { action?: string; targetUnitId?: string } | undefined;
      return value?.action === 'before_attack_life_drain' && value.targetUnitId === sacrifice.instanceId;
    })?.id;
    expect(sacrificeOptionId).toBeTruthy();
    expect(options.some(option => option.id === 'skip')).toBe(true);

    const picked = runPipeline(state, {
      type: INTERACTION_COMMANDS.RESPOND,
      playerId: '0',
      payload: { interactionId: current!.id, optionId: sacrificeOptionId },
    });
    expect(picked.success).toBe(true);
    state = picked.state;
    expect(state.sys.interaction.current).toBeUndefined();
    expect(getUnitAt(state.core, sacrificePos)).toBeUndefined();
    expect(picked.events.filter(e =>
      e.type === SW_EVENTS.UNIT_DESTROYED
      && (e.payload as Record<string, unknown>).cardId === sacrifice.cardId
    )).toHaveLength(1);

    const duplicateResponse = runPipeline(state, {
      type: INTERACTION_COMMANDS.RESPOND,
      playerId: '0',
      payload: { interactionId: current!.id, optionId: sacrificeOptionId },
    });
    expect(duplicateResponse.success).toBe(false);
    expect(getUnitAt(duplicateResponse.state.core, sacrificePos)).toBeUndefined();
  });

  it('[healing] 攻击前选牌后应只治疗本次攻击并在攻击后清理', () => {
    resetInstanceCounter();
    const core = createInitializedCore(['0', '1'], testRandom(), { faction0: 'paladin', faction1: 'necromancer' });
    clearRect(core, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);
    core.phase = 'attack';
    core.currentPlayer = '0';
    core.players['0'].attackCount = 0;
    core.players['0'].hand = [
      mkUnit('healing-discard', { faction: 'paladin', unitClass: 'common' }),
    ];

    const priestPos = { row: 4, col: 2 };
    const allyPos = { row: 4, col: 3 };
    const priest = putUnit(core, priestPos, mkUnit('temple-priest-l4', {
      abilities: ['healing'],
      faction: 'paladin',
      unitClass: 'common',
      strength: 2,
      attackType: 'melee',
      attackRange: 1,
    }), '0');
    putUnit(core, allyPos, mkUnit('healing-ally-l4', {
      faction: 'paladin',
      unitClass: 'common',
      life: 5,
    }), '0', { damage: 3 });

    let state: MatchState<SummonerWarsCore> = {
      core,
      sys: createInitialSystemState(['0', '1'], interactionSystems),
    };

    const requested = runPipeline(state, {
      type: SW_COMMANDS.DECLARE_ATTACK,
      playerId: '0',
      payload: { attacker: priestPos, target: allyPos },
    });
    expect(requested.success).toBe(true);
    state = requested.state;
    expect(getSwCurrentType(state)).toBe('before_attack_healing');
    expect(getUnitAt(state.core, priestPos)?.healingMode).toBeFalsy();
    expect(getUnitAt(state.core, allyPos)?.damage).toBe(3);

    const current = state.sys.interaction.current;
    expect(current?.kind).toBe('simple-choice');
    const options = ((current?.data as { options?: PromptOption[] } | undefined)?.options ?? []) as PromptOption[];
    const discardOptionId = options.find((option) => {
      const value = option.value as { action?: string; cardId?: string } | undefined;
      return value?.action === 'before_attack_healing' && value.cardId === 'healing-discard';
    })?.id;
    expect(discardOptionId).toBe('healing-discard');
    expect(options.some(option => option.id === 'skip')).toBe(true);

    const specialDiceRandom: RandomFn = {
      shuffle: <T>(arr: T[]) => arr,
      random: () => 0.75,
      d: (max: number) => Math.max(1, Math.ceil(max * 0.5)),
      range: (min: number) => min,
    };
    const picked = executePipeline(
      { domain: SummonerWarsDomain, systems: interactionSystems },
      state,
      {
        type: INTERACTION_COMMANDS.RESPOND,
        playerId: '0',
        payload: { interactionId: current!.id, optionId: discardOptionId },
      },
      specialDiceRandom,
      ['0', '1'],
    );
    expect(picked.success).toBe(true);
    state = picked.state;

    expect(state.sys.interaction.current).toBeUndefined();
    expect(state.sys.interaction.queue).toHaveLength(0);
    expect(state.core.players['0'].hand.some(card => card.id === 'healing-discard')).toBe(false);
    expect(getUnitAt(state.core, priestPos)?.instanceId).toBe(priest.instanceId);
    expect(getUnitAt(state.core, priestPos)?.healingMode).toBe(false);
    expect(getUnitAt(state.core, priestPos)?.hasAttacked).toBe(true);
    expect(getUnitAt(state.core, allyPos)?.damage).toBe(0);

    expect(picked.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: SW_EVENTS.CARD_DISCARDED,
        payload: expect.objectContaining({ playerId: '0', cardId: 'healing-discard' }),
      }),
      expect.objectContaining({
        type: SW_EVENTS.HEALING_MODE_SET,
        payload: expect.objectContaining({ position: priestPos, unitId: priest.instanceId }),
      }),
      expect.objectContaining({
        type: SW_EVENTS.UNIT_ATTACKED,
        payload: expect.objectContaining({ attacker: priestPos, target: allyPos, healingMode: true, hits: 0 }),
      }),
      expect.objectContaining({
        type: SW_EVENTS.UNIT_HEALED,
        payload: expect.objectContaining({ position: allyPos, amount: 4, sourceAbilityId: 'healing' }),
      }),
    ]));
    expect(picked.events.some(e =>
      e.type === SW_EVENTS.UNIT_DAMAGED
      && (e.payload as { position?: CellCoord }).position?.row === allyPos.row
      && (e.payload as { position?: CellCoord }).position?.col === allyPos.col
    )).toBe(false);

    const duplicateResponse = runPipeline(state, {
      type: INTERACTION_COMMANDS.RESPOND,
      playerId: '0',
      payload: { interactionId: current!.id, optionId: discardOptionId },
    });
    expect(duplicateResponse.success).toBe(false);
    expect(getUnitAt(duplicateResponse.state.core, allyPos)?.damage).toBe(0);
    expect(getUnitAt(duplicateResponse.state.core, priestPos)?.healingMode).toBe(false);
    expect(duplicateResponse.state.core.players['0'].hand.some(card => card.id === 'healing-discard')).toBe(false);
  });

  it('[healing] 圣殿牧师攻击敌方单位时不应进入治疗选牌', () => {
    resetInstanceCounter();
    const core = createInitializedCore(['0', '1'], testRandom(), { faction0: 'paladin', faction1: 'necromancer' });
    clearRect(core, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);
    core.phase = 'attack';
    core.currentPlayer = '0';
    core.players['0'].attackCount = 0;
    core.players['0'].hand = [
      mkUnit('healing-discard', { faction: 'paladin', unitClass: 'common' }),
    ];

    const priestPos = { row: 4, col: 2 };
    const enemyPos = { row: 4, col: 3 };
    putUnit(core, priestPos, mkUnit('temple-priest-attack-enemy', {
      abilities: ['healing'],
      faction: 'paladin',
      unitClass: 'common',
      strength: 2,
      attackType: 'melee',
      attackRange: 1,
    }), '0');
    putUnit(core, enemyPos, mkUnit('enemy-for-priest', {
      faction: 'necromancer',
      unitClass: 'common',
      life: 3,
    }), '1');

    const state: MatchState<SummonerWarsCore> = {
      core,
      sys: createInitialSystemState(['0', '1'], interactionSystems),
    };

    const attacked = runPipeline(state, {
      type: SW_COMMANDS.DECLARE_ATTACK,
      playerId: '0',
      payload: { attacker: priestPos, target: enemyPos },
    });

    expect(attacked.success).toBe(true);
    expect(attacked.state.sys.interaction.current).toBeUndefined();
    expect(attacked.state.sys.interaction.queue).toHaveLength(0);
    expect(getUnitAt(attacked.state.core, priestPos)?.hasAttacked).toBe(true);
    expect(attacked.state.core.players['0'].attackCount).toBe(1);
    const attackEvent = attacked.events.find(e => e.type === SW_EVENTS.UNIT_ATTACKED);
    expect(attackEvent?.payload).toEqual(expect.objectContaining({ attacker: priestPos, target: enemyPos }));
    expect((attackEvent?.payload as { healingMode?: unknown } | undefined)?.healingMode).not.toBe(true);
    expect(attacked.events.some(e => e.type === SW_EVENTS.HEALING_MODE_SET)).toBe(false);
  });

  it('[holy_arrow] 攻击前真实多选应去重同名候选，只给本次攻击临时加成', () => {
    resetInstanceCounter();
    const core = createInitializedCore(['0', '1'], testRandom(), { faction0: 'paladin', faction1: 'necromancer' });
    clearRect(core, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);
    core.phase = 'attack';
    core.currentPlayer = '0';
    core.players['0'].attackCount = 0;

    const archerPos = { row: 4, col: 2 };
    const enemyPos = { row: 4, col: 4 };
    const archer = putUnit(core, archerPos, mkUnit('fortress-archer-l4', {
      name: '城塞弓箭手',
      abilities: ['holy_arrow'],
      faction: 'paladin',
      unitClass: 'common',
      strength: 2,
      attackType: 'ranged',
      attackRange: 3,
    }), '0', { boosts: 0 });
    putUnit(core, enemyPos, mkUnit('holy-arrow-enemy-l4', {
      faction: 'necromancer',
      unitClass: 'common',
      life: 8,
    }), '1');
    core.players['0'].hand = [
      mkUnit('discard-knight-a', { name: '城塞骑士', faction: 'paladin', unitClass: 'common' }),
      mkUnit('discard-knight-b', { name: '城塞骑士', faction: 'paladin', unitClass: 'common' }),
      mkUnit('discard-warrior', { name: '城塞战士', faction: 'paladin', unitClass: 'common' }),
      mkUnit('discard-same-name', { name: '城塞弓箭手', faction: 'paladin', unitClass: 'common' }),
      { id: 'discard-event', cardType: 'event', name: '测试事件', faction: 'paladin', deckSymbols: [] } as EventCard,
    ];
    const magicBefore = core.players['0'].magic;

    let state: MatchState<SummonerWarsCore> = {
      core,
      sys: createInitialSystemState(['0', '1'], interactionSystems),
    };

    const requested = runPipeline(state, {
      type: SW_COMMANDS.DECLARE_ATTACK,
      playerId: '0',
      payload: { attacker: archerPos, target: enemyPos },
    });
    expect(requested.success).toBe(true);
    state = requested.state;
    expect(getSwCurrentType(state)).toBe('before_attack_holy_arrow');
    expect(getUnitAt(state.core, archerPos)?.boosts).toBe(0);

    const current = state.sys.interaction.current;
    expect(current?.kind).toBe('simple-choice');
    const options = ((current?.data as { options?: PromptOption[] } | undefined)?.options ?? []) as PromptOption[];
    const holyArrowOptions = options.filter((option) => {
      const value = option.value as { action?: string } | undefined;
      return value?.action === 'before_attack_holy_arrow';
    });
    expect(holyArrowOptions.map(option => option.id).sort()).toEqual(['discard-knight-a', 'discard-warrior']);
    expect(options.map(option => option.id)).toContain('skip');

    const picked = runPipeline(state, {
      type: INTERACTION_COMMANDS.RESPOND,
      playerId: '0',
      payload: { interactionId: current!.id, optionIds: ['discard-knight-a', 'discard-warrior'] },
    });
    expect(picked.success).toBe(true);
    state = picked.state;

    expect(state.sys.interaction.current).toBeUndefined();
    expect(state.sys.interaction.queue).toHaveLength(0);
    expect(state.core.players['0'].magic).toBe(magicBefore + 2);
    expect(state.core.players['0'].hand.map(card => card.id).sort()).toEqual([
      'discard-event',
      'discard-knight-b',
      'discard-same-name',
    ]);
    expect(getUnitAt(state.core, archerPos)?.instanceId).toBe(archer.instanceId);
    expect(getUnitAt(state.core, archerPos)?.boosts).toBe(0);
    expect(getUnitAt(state.core, archerPos)?.hasAttacked).toBe(true);
    expect(picked.events.filter(e => e.type === SW_EVENTS.CARD_DISCARDED)).toHaveLength(2);
    expect(picked.events.filter(e => e.type === SW_EVENTS.UNIT_CHARGED)).toHaveLength(0);
    expect(picked.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: SW_EVENTS.MAGIC_CHANGED,
        payload: expect.objectContaining({ playerId: '0', delta: 2 }),
      }),
      expect.objectContaining({
        type: SW_EVENTS.UNIT_ATTACKED,
        payload: expect.objectContaining({ attacker: archerPos, target: enemyPos, diceCount: 4 }),
      }),
    ]));

    const duplicateResponse = runPipeline(state, {
      type: INTERACTION_COMMANDS.RESPOND,
      playerId: '0',
      payload: { interactionId: current!.id, optionIds: ['discard-knight-a', 'discard-warrior'] },
    });
    expect(duplicateResponse.success).toBe(false);
    expect(duplicateResponse.state.core.players['0'].magic).toBe(magicBefore + 2);
    expect(duplicateResponse.state.core.players['0'].hand.map(card => card.id).sort()).toEqual([
      'discard-event',
      'discard-knight-b',
      'discard-same-name',
    ]);
    expect(getUnitAt(duplicateResponse.state.core, archerPos)?.boosts).toBe(0);
  });

  it('[telekinesis_instead] 二段选择应推拉目标并只消耗一次攻击行动', () => {
    resetInstanceCounter();
    const core = createInitializedCore(['0', '1'], testRandom(), { faction0: 'trickster', faction1: 'necromancer' });
    clearRect(core, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);
    core.phase = 'attack';
    core.currentPlayer = '0';
    core.players['0'].attackCount = 0;

    const magePos = { row: 4, col: 2 };
    const targetPos = { row: 4, col: 4 };
    const pushedPos = { row: 4, col: 5 };
    const mage = putUnit(core, magePos, mkUnit('wind-mage-l4', {
      abilities: ['telekinesis_instead'],
      faction: 'trickster',
      unitClass: 'common',
      attackType: 'ranged',
      attackRange: 3,
    }), '0', { hasAttacked: false });
    const target = putUnit(core, targetPos, mkUnit('telekinesis-target-l4', {
      faction: 'necromancer',
      unitClass: 'common',
    }), '1');

    let state: MatchState<SummonerWarsCore> = {
      core,
      sys: createInitialSystemState(['0', '1'], interactionSystems),
    };

    const requested = runPipeline(state, {
      type: SW_COMMANDS.ACTIVATE_ABILITY,
      playerId: '0',
      payload: { abilityId: 'telekinesis_instead', sourceUnitId: mage.instanceId },
    });
    expect(requested.success).toBe(true);
    state = requested.state;
    expect(getSwCurrentType(state)).toBe('activated_ability_target');

    const targetCurrent = state.sys.interaction.current;
    const targetOptions = ((targetCurrent?.data as { options?: PromptOption[] } | undefined)?.options ?? []) as PromptOption[];
    const targetOptionId = targetOptions.find((option) => {
      const value = option.value as { action?: string; targetPosition?: CellCoord } | undefined;
      return value?.action === 'after_attack_telekinesis_target'
        && value.targetPosition?.row === targetPos.row
        && value.targetPosition?.col === targetPos.col;
    })?.id;
    expect(targetOptionId).toBeTruthy();

    const pickedTarget = runPipeline(state, {
      type: INTERACTION_COMMANDS.RESPOND,
      playerId: '0',
      payload: { interactionId: targetCurrent!.id, optionId: targetOptionId },
    });
    expect(pickedTarget.success).toBe(true);
    state = pickedTarget.state;
    expect(getSwCurrentType(state)).toBe('activated_ability_target');

    const directionCurrent = state.sys.interaction.current;
    const directionOptions = ((directionCurrent?.data as { options?: PromptOption[] } | undefined)?.options ?? []) as PromptOption[];
    const pushOptionId = directionOptions.find((option) => {
      const value = option.value as { action?: string; moveRow?: number; moveCol?: number } | undefined;
      return value?.action === 'after_attack_telekinesis_direction'
        && value.moveRow === 0
        && value.moveCol === 1;
    })?.id;
    expect(pushOptionId).toBeTruthy();

    const pickedDirection = runPipeline(state, {
      type: INTERACTION_COMMANDS.RESPOND,
      playerId: '0',
      payload: { interactionId: directionCurrent!.id, optionId: pushOptionId },
    });
    expect(pickedDirection.success).toBe(true);
    state = pickedDirection.state;

    expect(state.sys.interaction.current).toBeUndefined();
    expect(state.sys.interaction.queue).toHaveLength(0);
    expect(getUnitAt(state.core, targetPos)).toBeUndefined();
    expect(getUnitAt(state.core, pushedPos)?.instanceId).toBe(target.instanceId);
    expect(getUnitAt(state.core, magePos)?.hasAttacked).toBe(true);
    expect(state.core.players['0'].attackCount).toBe(1);
    expect(pickedDirection.events.filter(e => e.type === SW_EVENTS.ATTACK_ACTION_CONSUMED)).toHaveLength(1);

    const duplicateResponse = runPipeline(state, {
      type: INTERACTION_COMMANDS.RESPOND,
      playerId: '0',
      payload: { interactionId: directionCurrent!.id, optionId: pushOptionId },
    });
    expect(duplicateResponse.success).toBe(false);
    expect(duplicateResponse.state.core.players['0'].attackCount).toBe(1);
    expect(getUnitAt(duplicateResponse.state.core, pushedPos)?.instanceId).toBe(target.instanceId);
  });

  it('[structure_shift] 移动后两步真实交互应移动友方建筑且重复响应不二次移动', () => {
    resetInstanceCounter();
    const core = createInitializedCore(['0', '1'], testRandom(), { faction0: 'frost', faction1: 'barbaric' });
    clearRect(core, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);
    core.phase = 'move';
    core.currentPlayer = '0';

    const from = { row: 4, col: 2 };
    const to = { row: 4, col: 3 };
    const structurePos = { row: 4, col: 5 };
    const shiftedPos = { row: 3, col: 5 };
    const farStructurePos = { row: 6, col: 5 };
    const svara = putUnit(core, from, mkUnit('svara-l4', {
      abilities: ['structure_shift'],
      unitClass: 'summoner',
      faction: 'frost',
    }), '0');
    putStructure(core, structurePos, '0');
    putStructure(core, farStructurePos, '0');
    putStructure(core, { row: 3, col: 4 }, '1');

    let state: MatchState<SummonerWarsCore> = {
      core,
      sys: createInitialSystemState(['0', '1'], engineConfig.systems as any),
    };

    const moved = runGamePipeline(state, {
      type: SW_COMMANDS.MOVE_UNIT,
      playerId: '0',
      payload: { from, to, path: [from, to] },
    });
    expect(moved.success).toBe(true);
    state = moved.state;
    expect(getUnitAt(state.core, to)?.instanceId).toBe(svara.instanceId);
    expect(getSwCurrentType(state)).toBe('after_move_structure_shift_target');

    const targetCurrent = state.sys.interaction.current;
    expect(targetCurrent?.kind).toBe('simple-choice');
    const targetOptions = ((targetCurrent?.data as { options?: PromptOption[] } | undefined)?.options ?? []) as PromptOption[];
    const targetOptionId = targetOptions.find((option) => {
      const value = option.value as { action?: string; targetPosition?: CellCoord } | undefined;
      return value?.action === 'after_move_structure_shift_target'
        && value.targetPosition?.row === structurePos.row
        && value.targetPosition?.col === structurePos.col;
    })?.id;
    expect(targetOptionId).toBeTruthy();
    expect(targetOptions.some((option) => option.id === 'skip')).toBe(true);
    expect(targetOptions.some((option) => {
      const value = option.value as { action?: string; targetPosition?: CellCoord } | undefined;
      return value?.action === 'after_move_structure_shift_target'
        && value.targetPosition?.row === farStructurePos.row
        && value.targetPosition?.col === farStructurePos.col;
    })).toBe(false);

    const pickedTarget = runPipeline(state, {
      type: INTERACTION_COMMANDS.RESPOND,
      playerId: '0',
      payload: { interactionId: targetCurrent!.id, optionId: targetOptionId },
    });
    expect(pickedTarget.success).toBe(true);
    state = pickedTarget.state;
    expect(getSwCurrentType(state)).toBe('after_move_structure_shift_direction');

    const directionCurrent = state.sys.interaction.current;
    expect(directionCurrent?.kind).toBe('simple-choice');
    const directionOptions = ((directionCurrent?.data as { options?: PromptOption[] } | undefined)?.options ?? []) as PromptOption[];
    const shiftedOptionId = directionOptions.find((option) => {
      const value = option.value as { action?: string; targetPosition?: CellCoord; newPosition?: CellCoord } | undefined;
      return value?.action === 'after_move_structure_shift_direction'
        && value.targetPosition?.row === structurePos.row
        && value.targetPosition?.col === structurePos.col
        && value.newPosition?.row === shiftedPos.row
        && value.newPosition?.col === shiftedPos.col;
    })?.id;
    expect(shiftedOptionId).toBeTruthy();
    expect(directionOptions.some((option) => option.id === 'skip')).toBe(true);
    expect(directionOptions.some((option) => {
      const value = option.value as { action?: string; newPosition?: CellCoord } | undefined;
      return value?.action === 'after_move_structure_shift_direction'
        && value.newPosition?.row === 3
        && value.newPosition?.col === 4;
    })).toBe(false);

    const shifted = runPipeline(state, {
      type: INTERACTION_COMMANDS.RESPOND,
      playerId: '0',
      payload: { interactionId: directionCurrent!.id, optionId: shiftedOptionId },
    });
    expect(shifted.success).toBe(true);
    state = shifted.state;

    expect(state.sys.interaction.current).toBeUndefined();
    expect(state.sys.interaction.queue).toHaveLength(0);
    expect(state.core.board[structurePos.row][structurePos.col].structure).toBeUndefined();
    expect(state.core.board[shiftedPos.row][shiftedPos.col].structure?.owner).toBe('0');
    expect(shifted.events.filter(e => e.type === SW_EVENTS.UNIT_PUSHED)).toHaveLength(1);

    const duplicateResponse = runPipeline(state, {
      type: INTERACTION_COMMANDS.RESPOND,
      playerId: '0',
      payload: { interactionId: directionCurrent!.id, optionId: shiftedOptionId },
    });
    expect(duplicateResponse.success).toBe(false);
    expect(duplicateResponse.state.core.board[structurePos.row][structurePos.col].structure).toBeUndefined();
    expect(duplicateResponse.state.core.board[shiftedPos.row][shiftedPos.col].structure?.owner).toBe('0');
    expect(duplicateResponse.events.filter(e => e.type === SW_EVENTS.UNIT_PUSHED)).toHaveLength(0);
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
    expect(pushEvent?.payload).toEqual(expect.objectContaining({
      targetPosition: { row: 4, col: 4 },
      newPosition: { row: 4, col: 5 },
      isStructure: true,
    }));
    expect(events.find(e => e.type === SW_EVENTS.ATTACK_ACTION_CONSUMED)).toBeUndefined();
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
    const spendEvent = events.find(e => e.type === SW_EVENTS.UNIT_CHARGED);
    expect(spendEvent).toBeDefined();
    expect((spendEvent!.payload as Record<string, unknown>).delta).toBe(-1);
    expect((spendEvent!.payload as Record<string, unknown>).newValue).toBeUndefined();
  });

  it('[frost_axe] 移动后真实交互附加后，士兵攻击时 special 应按2个命中结算', () => {
    core.phase = 'move';
    core.currentPlayer = '0' as PlayerId;
    const from = { row: 4, col: 2 };
    const to = { row: 4, col: 3 };
    const targetPos = { row: 4, col: 4 };
    const enemyPos = { row: 2, col: 4 };
    const smith = putUnit(core, from, mkUnit('smith', {
      abilities: ['frost_axe'],
      faction: 'frost',
      unitClass: 'common',
      strength: 2,
      attackType: 'melee',
      attackRange: 1,
    }), '0', { boosts: 1 });
    const target = putUnit(core, targetPos, mkUnit('frost-archer', {
      faction: 'frost',
      unitClass: 'common',
      strength: 1,
      attackType: 'ranged',
      attackRange: 3,
    }), '0');
    putUnit(core, enemyPos, mkUnit('frost-axe-enemy', {
      faction: 'necromancer',
      unitClass: 'common',
      life: 5,
    }), '1');

    let state: MatchState<SummonerWarsCore> = {
      core,
      sys: createInitialSystemState(['0', '1'], engineConfig.systems as any),
    };

    const moved = runGamePipeline(state, {
      type: SW_COMMANDS.MOVE_UNIT,
      playerId: '0',
      payload: { from, to, path: [from, to] },
    });
    expect(moved.success).toBe(true);
    state = moved.state;
    expect(getUnitAt(state.core, to)?.instanceId).toBe(smith.instanceId);
    expect(getSwCurrentType(state)).toBe('after_move_frost_axe');

    const current = state.sys.interaction.current;
    expect(current?.kind).toBe('simple-choice');
    const options = ((current?.data as { options?: PromptOption[] } | undefined)?.options ?? []) as PromptOption[];
    const attachOptionId = options.find((option) => {
      const value = option.value as { action?: string; choice?: string; targetPosition?: CellCoord } | undefined;
      return value?.action === 'after_move_frost_axe'
        && value.choice === 'attach'
        && value.targetPosition?.row === targetPos.row
        && value.targetPosition?.col === targetPos.col;
    })?.id;
    expect(attachOptionId).toBeTruthy();
    expect(options.some((option) => option.id === 'self')).toBe(true);
    expect(options.some((option) => option.id === 'skip')).toBe(true);

    const attached = runPipeline(state, {
      type: INTERACTION_COMMANDS.RESPOND,
      playerId: '0',
      payload: { interactionId: current!.id, optionId: attachOptionId },
    });
    expect(attached.success).toBe(true);
    state = attached.state;
    expect(state.sys.interaction.current).toBeUndefined();
    expect(state.sys.interaction.queue).toHaveLength(0);
    expect(getUnitAt(state.core, to)).toBeUndefined();
    const targetAfterAttach = getUnitAt(state.core, targetPos);
    expect(targetAfterAttach?.instanceId).toBe(target.instanceId);
    expect(targetAfterAttach?.attachedUnits?.some(attachment => attachment.card.abilities?.includes('frost_axe'))).toBe(true);
    expect(attached.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: SW_EVENTS.UNIT_CHARGED,
        payload: expect.objectContaining({ position: to, delta: -1, sourceAbilityId: 'frost_axe' }),
      }),
      expect.objectContaining({
        type: SW_EVENTS.UNIT_ATTACHED,
        payload: expect.objectContaining({ sourcePosition: to, targetPosition: targetPos }),
      }),
    ]));

    state = {
      ...state,
      core: { ...state.core, phase: 'attack', currentPlayer: '0' as PlayerId },
    };
    const specialDiceRandom: RandomFn = {
      shuffle: <T>(arr: T[]) => arr,
      random: () => 0.75,
      d: (max: number) => Math.max(1, Math.ceil(max * 0.5)),
      range: (min: number) => min,
    };
    const attacked = executePipeline(
      { domain: engineConfig.domain, systems: engineConfig.systems as any },
      state,
      {
        type: SW_COMMANDS.DECLARE_ATTACK,
        playerId: '0',
        payload: { attacker: targetPos, target: enemyPos },
      },
      specialDiceRandom,
      ['0', '1'],
    );
    expect(attacked.success).toBe(true);
    const attackEvent = attacked.events.find(e => e.type === SW_EVENTS.UNIT_ATTACKED);
    expect(attackEvent).toBeDefined();
    const attackPayload = attackEvent!.payload as { diceResults?: Array<{ marks: string[] }>; hits?: number };
    expect(attackPayload.diceResults?.every(die => die.marks.includes('special'))).toBe(true);
    expect(attackPayload.hits).toBe((attackPayload.diceResults?.length ?? 0) * 2);
    expect(getUnitAt(attacked.state.core, enemyPos)?.damage).toBe(attackPayload.hits);
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

  it('[telekinesis] 目标是建筑时验证失败', () => {
    core.phase = 'attack';
    core.currentPlayer = '0' as PlayerId;
    const mage = mkUnit('wind-mage', { abilities: ['telekinesis'], faction: 'trickster' });
    const unit = putUnit(core, { row: 4, col: 3 }, mage, '0');
    putStructure(core, { row: 4, col: 4 }, '1', mkStructure('telekinesis-target-structure', { faction: 'necromancer' }));

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

  it('[revive_undead] 非亡灵目标卡时验证失败', () => {
    core.phase = 'summon';
    core.currentPlayer = '0' as PlayerId;
    const summoner = mkUnit('ret-summoner', {
      abilities: ['revive_undead'], unitClass: 'summoner', faction: 'necromancer', life: 8,
    });
    const unit = putUnit(core, { row: 4, col: 3 }, summoner, '0');
    const goblin = mkUnit('goblin-fighter', { faction: 'goblin', name: '地精战士' });
    core.players['0'].discard.push({ ...goblin, id: 'goblin-discard' } as any);

    const result = validate(core, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'revive_undead',
      sourceUnitId: unit.instanceId,
      targetCardId: 'goblin-discard',
      targetPosition: { row: 4, col: 4 },
    });

    expect(result.valid).toBe(false);
  });

  it('[revive_undead] 非相邻目标位置时验证失败', () => {
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
      targetPosition: { row: 2, col: 3 },
    });

    expect(result.valid).toBe(false);
  });

  it('[revive_undead] 目标格有单位或建筑时验证失败', () => {
    core.phase = 'summon';
    core.currentPlayer = '0' as PlayerId;
    const summoner = mkUnit('ret-summoner', {
      abilities: ['revive_undead'], unitClass: 'summoner', faction: 'necromancer', life: 8,
    });
    const unit = putUnit(core, { row: 4, col: 3 }, summoner, '0');
    const discardCard = mkUnit('skeleton_warrior', { faction: 'necromancer' });
    core.players['0'].discard.push({ ...discardCard, id: 'sk-discard' } as any);
    putUnit(core, { row: 4, col: 4 }, mkUnit('occupied', { faction: 'necromancer' }), '0');

    const occupiedByUnit = validate(core, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'revive_undead',
      sourceUnitId: unit.instanceId,
      targetCardId: 'sk-discard',
      targetPosition: { row: 4, col: 4 },
    });
    expect(occupiedByUnit.valid).toBe(false);

    core.board[4][4].unit = undefined;
    putStructure(core, { row: 4, col: 4 }, '0');

    const occupiedByStructure = validate(core, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'revive_undead',
      sourceUnitId: unit.instanceId,
      targetCardId: 'sk-discard',
      targetPosition: { row: 4, col: 4 },
    });
    expect(occupiedByStructure.valid).toBe(false);
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

  it('[ancestral_bond] 移动后真实交互应转移充能且重复响应不二次执行', () => {
    core.phase = 'move';
    core.currentPlayer = '1' as PlayerId;
    const from = { row: 4, col: 2 };
    const to = { row: 4, col: 3 };
    const targetPos = { row: 4, col: 5 };
    const farAllyPos = { row: 6, col: 5 };
    const summoner = mkUnit('abuya', { abilities: ['ancestral_bond'], unitClass: 'summoner', faction: 'barbaric' });
    const unit = putUnit(core, from, summoner, '1', { boosts: 3 });
    putUnit(core, targetPos, mkUnit('ally', { faction: 'barbaric' }), '1', { boosts: 1 });
    putUnit(core, farAllyPos, mkUnit('far-ally', { faction: 'barbaric' }), '1', { boosts: 0 });
    putUnit(core, { row: 3, col: 3 }, mkUnit('enemy', { faction: 'necromancer' }), '0', { boosts: 0 });

    let state: MatchState<SummonerWarsCore> = {
      core,
      sys: createInitialSystemState(['0', '1'], engineConfig.systems as any),
    };

    const moved = runGamePipeline(state, {
      type: SW_COMMANDS.MOVE_UNIT,
      playerId: '1',
      payload: { from, to, path: [from, to] },
    });
    expect(moved.success).toBe(true);
    state = moved.state;
    expect(getUnitAt(state.core, to)?.instanceId).toBe(unit.instanceId);
    expect(getSwCurrentType(state)).toBe('after_move_ancestral_bond');

    const current = state.sys.interaction.current;
    expect(current?.kind).toBe('simple-choice');
    const options = ((current?.data as { options?: PromptOption[] } | undefined)?.options ?? []) as PromptOption[];
    const targetOptionId = options.find((option) => {
      const value = option.value as { action?: string; targetPosition?: CellCoord } | undefined;
      return value?.action === 'after_move_ancestral_bond'
        && value.targetPosition?.row === targetPos.row
        && value.targetPosition?.col === targetPos.col;
    })?.id;
    expect(targetOptionId).toBeTruthy();
    expect(options.some((option) => option.id === 'skip')).toBe(true);
    expect(options.some((option) => {
      const value = option.value as { action?: string; targetPosition?: CellCoord } | undefined;
      return value?.action === 'after_move_ancestral_bond'
        && value.targetPosition?.row === farAllyPos.row
        && value.targetPosition?.col === farAllyPos.col;
    })).toBe(false);

    const picked = runPipeline(state, {
      type: INTERACTION_COMMANDS.RESPOND,
      playerId: '1',
      payload: { interactionId: current!.id, optionId: targetOptionId },
    });
    expect(picked.success).toBe(true);
    state = picked.state;

    expect(state.sys.interaction.current).toBeUndefined();
    expect(state.sys.interaction.queue).toHaveLength(0);
    expect(getUnitAt(state.core, to)?.boosts).toBe(0);
    expect(getUnitAt(state.core, targetPos)?.boosts).toBe(5);
    const chargeEvents = picked.events.filter(e => e.type === SW_EVENTS.UNIT_CHARGED);
    expect(chargeEvents.map(e => e.payload)).toEqual(expect.arrayContaining([
      expect.objectContaining({ position: targetPos, delta: 1, sourceAbilityId: 'ancestral_bond' }),
      expect.objectContaining({ position: to, delta: -3, sourceAbilityId: 'ancestral_bond' }),
      expect.objectContaining({ position: targetPos, delta: 3, sourceAbilityId: 'ancestral_bond' }),
    ]));

    const duplicateResponse = runPipeline(state, {
      type: INTERACTION_COMMANDS.RESPOND,
      playerId: '1',
      payload: { interactionId: current!.id, optionId: targetOptionId },
    });
    expect(duplicateResponse.success).toBe(false);
    expect(getUnitAt(duplicateResponse.state.core, to)?.boosts).toBe(0);
    expect(getUnitAt(duplicateResponse.state.core, targetPos)?.boosts).toBe(5);
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

  it('[vanish] 真实入口应选择0费友方并在重复响应时不二次交换', () => {
    core.phase = 'attack';
    core.currentPlayer = '0' as PlayerId;
    const summonerPos = { row: 4, col: 3 };
    const targetPos = { row: 4, col: 5 };
    const expensivePos = { row: 3, col: 3 };
    const enemyPos = { row: 5, col: 3 };
    const summoner = putUnit(core, summonerPos, mkUnit('sneeks', {
      abilities: ['vanish'],
      unitClass: 'summoner',
      faction: 'goblin',
    }), '0');
    const target = putUnit(core, targetPos, mkUnit('zero-cost-ally', {
      cost: 0,
      faction: 'goblin',
    }), '0');
    putUnit(core, expensivePos, mkUnit('expensive-ally', {
      cost: 2,
      faction: 'goblin',
    }), '0');
    putUnit(core, enemyPos, mkUnit('enemy-zero-cost', {
      cost: 0,
      faction: 'necromancer',
    }), '1');

    let state: MatchState<SummonerWarsCore> = {
      core,
      sys: createInitialSystemState(['0', '1'], engineConfig.systems as any),
    };

    const requested = runGamePipeline(state, {
      type: SW_COMMANDS.ACTIVATE_ABILITY,
      playerId: '0',
      payload: { abilityId: 'vanish', sourceUnitId: summoner.instanceId },
    });
    expect(requested.success).toBe(true);
    state = requested.state;

    expect(getSwCurrentType(state)).toBe('activated_ability_target');
    const current = state.sys.interaction.current;
    expect(current?.kind).toBe('simple-choice');
    const options = ((current?.data as { options?: PromptOption[] } | undefined)?.options ?? []) as PromptOption[];
    const targetOptionId = options.find((option) => {
      const value = option.value as { action?: string; abilityId?: string; targetPosition?: CellCoord } | undefined;
      return value?.action === 'activated_ability_target'
        && value.abilityId === 'vanish'
        && value.targetPosition?.row === targetPos.row
        && value.targetPosition?.col === targetPos.col;
    })?.id;
    expect(targetOptionId).toBe(`pos:${targetPos.row},${targetPos.col}`);
    expect(options.some((option) => {
      const value = option.value as { targetPosition?: CellCoord } | undefined;
      return value?.targetPosition?.row === expensivePos.row && value.targetPosition.col === expensivePos.col;
    })).toBe(false);
    expect(options.some((option) => {
      const value = option.value as { targetPosition?: CellCoord } | undefined;
      return value?.targetPosition?.row === enemyPos.row && value.targetPosition.col === enemyPos.col;
    })).toBe(false);

    const picked = runPipeline(state, {
      type: INTERACTION_COMMANDS.RESPOND,
      playerId: '0',
      payload: { interactionId: current!.id, optionId: targetOptionId },
    });
    expect(picked.success).toBe(true);
    state = picked.state;

    expect(state.sys.interaction.current).toBeUndefined();
    expect(state.sys.interaction.queue).toHaveLength(0);
    expect(getUnitAt(state.core, summonerPos)?.instanceId).toBe(target.instanceId);
    expect(getUnitAt(state.core, targetPos)?.instanceId).toBe(summoner.instanceId);
    expect(picked.events.filter(e => e.type === SW_EVENTS.UNITS_SWAPPED)).toHaveLength(1);

    const duplicateResponse = runPipeline(state, {
      type: INTERACTION_COMMANDS.RESPOND,
      playerId: '0',
      payload: { interactionId: current!.id, optionId: targetOptionId },
    });
    expect(duplicateResponse.success).toBe(false);
    expect(getUnitAt(duplicateResponse.state.core, summonerPos)?.instanceId).toBe(target.instanceId);
    expect(getUnitAt(duplicateResponse.state.core, targetPos)?.instanceId).toBe(summoner.instanceId);

    const secondUse = validate(duplicateResponse.state.core, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'vanish',
      sourceUnitId: summoner.instanceId,
      targetPosition: summonerPos,
    });
    expect(secondUse.valid).toBe(false);
  });

  it('[mogu_blood_infusion] 结算后同回合按钮命令不应再次打开目标选择', () => {
    core.phase = 'move';
    core.currentPlayer = '0' as PlayerId;
    const magePos = { row: 4, col: 3 };
    const allyPos = { row: 4, col: 5 };
    const mage = putUnit(core, magePos, mkUnit('mogu-withering-mage-l4', {
      abilities: ['mogu_blood_infusion'],
      faction: 'mogu',
      unitClass: 'common',
    }), '0');
    const ally = putUnit(core, allyPos, mkUnit('mogu-ally-l4', {
      faction: 'mogu',
      unitClass: 'common',
    }), '0');

    let state: MatchState<SummonerWarsCore> = {
      core,
      sys: createInitialSystemState(['0', '1'], engineConfig.systems as any),
    };

    const requested = runGamePipeline(state, {
      type: SW_COMMANDS.ACTIVATE_ABILITY,
      playerId: '0',
      payload: { abilityId: 'mogu_blood_infusion', sourceUnitId: mage.instanceId },
    });
    expect(requested.success).toBe(true);
    state = requested.state;

    expect(getSwCurrentType(state)).toBe('activated_ability_target');
    const current = state.sys.interaction.current;
    const optionId = `pos:${allyPos.row},${allyPos.col}`;

    const resolved = runPipeline(state, {
      type: INTERACTION_COMMANDS.RESPOND,
      playerId: '0',
      payload: { interactionId: current!.id, optionId },
    });
    expect(resolved.success).toBe(true);
    state = resolved.state;
    expect(state.sys.interaction.current).toBeUndefined();
    expect(state.sys.interaction.queue).toHaveLength(0);
    expect(getUnitAt(state.core, ally.position)?.boosts).toBe(1);
    expect(getUnitAt(state.core, ally.position)?.damage).toBe(1);

    const secondButtonCommand = runGamePipeline(state, {
      type: SW_COMMANDS.ACTIVATE_ABILITY,
      playerId: '0',
      payload: { abilityId: 'mogu_blood_infusion', sourceUnitId: mage.instanceId },
    });
    expect(secondButtonCommand.success).toBe(false);
    expect(secondButtonCommand.error).toBe('每回合只能使用一次');
    expect(secondButtonCommand.state.sys.interaction.current).toBeUndefined();
    expect(secondButtonCommand.state.sys.interaction.queue).toHaveLength(0);
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

  it('[guidance] 进入己方召唤阶段时应自动抽 2 张牌', () => {
    const core = createInitializedCore(['0', '1'], testRandom(), { faction0: 'paladin', faction1: 'necromancer' });
    clearRect(core, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);
    core.phase = 'draw';
    core.currentPlayer = '1';
    core.players['0'].hand = [];
    core.players['0'].deck = [
      mkUnit('guidance-draw-1', { faction: 'paladin' }),
      mkUnit('guidance-draw-2', { faction: 'paladin' }),
      mkUnit('guidance-draw-3', { faction: 'paladin' }),
    ];

    putUnit(core, { row: 4, col: 3 }, mkUnit('valentina', {
      abilities: ['guidance'],
      faction: 'paladin',
      unitClass: 'champion',
    }), '0');

    const state: MatchState<SummonerWarsCore> = {
      core,
      sys: { ...createInitialSystemState(['0', '1'], engineConfig.systems as any), phase: 'draw' },
    };

    const result = runGamePipeline(state, {
      type: FLOW_COMMANDS.ADVANCE_PHASE,
      playerId: '1',
      payload: {},
    });

    expect(result.success).toBe(true);
    expect(result.state.core.currentPlayer).toBe('0');
    expect(result.state.core.phase).toBe('summon');
    const guidanceDraw = result.events.find(e =>
      e.type === SW_EVENTS.CARD_DRAWN
      && (e.payload as Record<string, unknown>).playerId === '0'
      && (e.payload as Record<string, unknown>).count === 2
    );
    expect(guidanceDraw).toBeDefined();
    expect(result.state.core.players['0'].hand.map(card => card.id)).toEqual(['guidance-draw-1', 'guidance-draw-2']);
    expect(result.state.core.players['0'].deck.map(card => card.id)).toEqual(['guidance-draw-3']);
  });

  it('[guidance] 真实召唤阶段入口在牌库不足时只抽实际剩余牌数', () => {
    const core = createInitializedCore(['0', '1'], testRandom(), { faction0: 'paladin', faction1: 'necromancer' });
    clearRect(core, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);
    core.phase = 'draw';
    core.currentPlayer = '1';
    core.players['0'].hand = [];
    core.players['0'].deck = [
      mkUnit('guidance-short-deck-1', { faction: 'paladin' }),
    ];

    putUnit(core, { row: 4, col: 3 }, mkUnit('valentina', {
      abilities: ['guidance'],
      faction: 'paladin',
      unitClass: 'champion',
    }), '0');

    const state: MatchState<SummonerWarsCore> = {
      core,
      sys: { ...createInitialSystemState(['0', '1'], engineConfig.systems as any), phase: 'draw' },
    };

    const result = runGamePipeline(state, {
      type: FLOW_COMMANDS.ADVANCE_PHASE,
      playerId: '1',
      payload: {},
    });

    expect(result.success).toBe(true);
    expect(result.state.core.currentPlayer).toBe('0');
    expect(result.state.core.phase).toBe('summon');
    const guidanceDraw = result.events.find(e =>
      e.type === SW_EVENTS.CARD_DRAWN
      && (e.payload as Record<string, unknown>).playerId === '0'
    );
    expect(guidanceDraw?.payload).toMatchObject({ count: 1, sourceAbilityId: 'guidance' });
    expect(result.state.core.players['0'].hand.map(card => card.id)).toEqual(['guidance-short-deck-1']);
    expect(result.state.core.players['0'].deck).toHaveLength(0);
  });

  it('[magic_addiction] 回合结束时有魔力应自动花费 1 魔力', () => {
    const core = createInitializedCore(['0', '1'], testRandom(), { faction0: 'goblin', faction1: 'necromancer' });
    clearRect(core, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);
    core.phase = 'draw';
    core.currentPlayer = '0';
    core.players['0'].magic = 1;

    putUnit(core, { row: 4, col: 3 }, mkUnit('smeege', {
      abilities: ['magic_addiction'],
      faction: 'goblin',
      unitClass: 'champion',
    }), '0');

    const state: MatchState<SummonerWarsCore> = {
      core,
      sys: { ...createInitialSystemState(['0', '1'], engineConfig.systems as any), phase: 'draw' },
    };

    const result = runGamePipeline(state, {
      type: FLOW_COMMANDS.ADVANCE_PHASE,
      playerId: '0',
      payload: {},
    });

    expect(result.success).toBe(true);
    const magicEvent = result.events.find(e =>
      e.type === SW_EVENTS.MAGIC_CHANGED
      && (e.payload as Record<string, unknown>).playerId === '0'
      && (e.payload as Record<string, unknown>).delta === -1
    );
    expect(magicEvent).toBeDefined();
    expect(result.state.core.players['0'].magic).toBe(0);
    expect(result.state.core.board[4][3].unit?.card.id).toBe('smeege');
  });

  it('[magic_addiction] 回合结束时无魔力应自动弃置本单位', () => {
    const core = createInitializedCore(['0', '1'], testRandom(), { faction0: 'goblin', faction1: 'necromancer' });
    clearRect(core, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);
    core.phase = 'draw';
    core.currentPlayer = '0';
    core.players['0'].magic = 0;

    putUnit(core, { row: 4, col: 3 }, mkUnit('smeege', {
      abilities: ['magic_addiction'],
      faction: 'goblin',
      unitClass: 'champion',
    }), '0');

    const state: MatchState<SummonerWarsCore> = {
      core,
      sys: { ...createInitialSystemState(['0', '1'], engineConfig.systems as any), phase: 'draw' },
    };

    const result = runGamePipeline(state, {
      type: FLOW_COMMANDS.ADVANCE_PHASE,
      playerId: '0',
      payload: {},
    });

    expect(result.success).toBe(true);
    const destroyEvent = result.events.find(e =>
      e.type === SW_EVENTS.UNIT_DESTROYED
      && (e.payload as Record<string, unknown>).reason === 'magic_addiction'
    );
    expect(destroyEvent).toBeDefined();
    expect(result.state.core.board[4][3].unit).toBeUndefined();
  });

  it('[magic_addiction] 多个史米革回合结束时应按顺序消费魔力，不共享同一份魔力快照', () => {
    const core = createInitializedCore(['0', '1'], testRandom(), { faction0: 'goblin', faction1: 'necromancer' });
    clearRect(core, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);
    core.phase = 'draw';
    core.currentPlayer = '0';
    core.players['0'].magic = 1;

    const first = putUnit(core, { row: 4, col: 2 }, mkUnit('smeege-first', {
      abilities: ['magic_addiction'],
      faction: 'goblin',
      unitClass: 'champion',
    }), '0');
    const second = putUnit(core, { row: 4, col: 4 }, mkUnit('smeege-second', {
      abilities: ['magic_addiction'],
      faction: 'goblin',
      unitClass: 'champion',
    }), '0');

    const state: MatchState<SummonerWarsCore> = {
      core,
      sys: { ...createInitialSystemState(['0', '1'], engineConfig.systems as any), phase: 'draw' },
    };

    const result = runGamePipeline(state, {
      type: FLOW_COMMANDS.ADVANCE_PHASE,
      playerId: '0',
      payload: {},
    });

    expect(result.success).toBe(true);
    const magicEvents = result.events.filter(e =>
      e.type === SW_EVENTS.MAGIC_CHANGED
      && (e.payload as Record<string, unknown>).playerId === '0'
      && (e.payload as Record<string, unknown>).delta === -1
    );
    const destroyEvents = result.events.filter(e =>
      e.type === SW_EVENTS.UNIT_DESTROYED
      && (e.payload as Record<string, unknown>).reason === 'magic_addiction'
    );
    expect(magicEvents).toHaveLength(1);
    expect(destroyEvents).toHaveLength(1);
    expect(result.state.core.players['0'].magic).toBe(0);
    const survivors = [
      result.state.core.board[first.position.row][first.position.col].unit,
      result.state.core.board[second.position.row][second.position.col].unit,
    ].filter(Boolean);
    expect(survivors).toHaveLength(1);
    expect(destroyEvents[0]?.payload).toMatchObject({ owner: '0' });
  });

  it('[blood_rage_decay/L4] 真实抽牌阶段结束时按当前充能清理亡灵战士', () => {
    const core = createInitializedCore(['0', '1'], testRandom(), { faction0: 'necromancer', faction1: 'trickster' });
    clearRect(core, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);
    core.phase = 'draw';
    core.currentPlayer = '0';

    const highCharge = putUnit(core, { row: 4, col: 2 }, mkUnit('undead-high-charge', {
      abilities: ['blood_rage_decay'],
      faction: 'necromancer',
    }), '0', { boosts: 3 });
    const oneCharge = putUnit(core, { row: 4, col: 3 }, mkUnit('undead-one-charge', {
      abilities: ['blood_rage_decay'],
      faction: 'necromancer',
    }), '0', { boosts: 1 });
    const noCharge = putUnit(core, { row: 4, col: 4 }, mkUnit('undead-no-charge', {
      abilities: ['blood_rage_decay'],
      faction: 'necromancer',
    }), '0', { boosts: 0 });

    const state: MatchState<SummonerWarsCore> = {
      core,
      sys: { ...createInitialSystemState(['0', '1'], engineConfig.systems as any), phase: 'draw' },
    };

    const result = runGamePipeline(state, {
      type: FLOW_COMMANDS.ADVANCE_PHASE,
      playerId: '0',
      payload: {},
    });

    expect(result.success).toBe(true);
    expect(result.state.core.currentPlayer).toBe('1');
    expect(result.state.core.phase).toBe('summon');

    const decayEvents = result.events.filter(
      e => e.type === SW_EVENTS.UNIT_CHARGED
        && (e.payload as Record<string, unknown>).sourceAbilityId === 'blood_rage_decay'
    );
    expect(decayEvents).toHaveLength(2);
    expect(decayEvents.map(e => (e.payload as Record<string, unknown>).position)).toEqual([
      highCharge.position,
      oneCharge.position,
    ]);
    expect(decayEvents.map(e => (e.payload as Record<string, unknown>).delta)).toEqual([-2, -2]);

    expect(result.state.core.board[4][2].unit?.boosts).toBe(1);
    expect(result.state.core.board[4][3].unit?.boosts).toBe(0);
    expect(result.state.core.board[4][4].unit?.boosts).toBe(0);
    expect(result.state.core.board[noCharge.position.row][noCharge.position.col].unit?.card.id).toBe('undead-no-charge');
  });

  it('[blood_rune] 进入攻击阶段时应创建强制二选一交互', () => {
    const core = createInitializedCore(['0', '1'], testRandom(), { faction0: 'goblin', faction1: 'necromancer' });
    clearRect(core, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);
    core.phase = 'build';
    core.currentPlayer = '0';
    core.players['0'].magic = 2;

    const blarf = mkUnit('blarf', { abilities: ['blood_rune'], unitClass: 'champion', faction: 'goblin' });
    putUnit(core, { row: 4, col: 3 }, blarf, '0');

    const state: MatchState<SummonerWarsCore> = {
      core,
      sys: createInitialSystemState(['0', '1'], engineConfig.systems as any),
    };

    const result = runGamePipeline(state, {
      type: FLOW_COMMANDS.ADVANCE_PHASE,
      playerId: '0',
      payload: {},
    });

    expect(result.success).toBe(true);
    const current = result.state.sys.interaction.current;
    expect(current?.kind).toBe('simple-choice');
    const data = current?.data as { sw?: { type?: string; sourceUnitId?: string }; options?: Array<{ id: string }> } | undefined;
    expect(data?.sw?.type).toBe('on_phase_start_blood_rune');
    expect(data?.sw?.sourceUnitId).toBeDefined();
    expect(data?.options?.map((option) => option.id).sort()).toEqual(['charge', 'damage']);
  });

  it('[blood_rune] 无魔力时阶段开始只保留自伤选项并自动结算', () => {
    const core = createInitializedCore(['0', '1'], testRandom(), { faction0: 'goblin', faction1: 'necromancer' });
    clearRect(core, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);
    core.phase = 'build';
    core.currentPlayer = '0';
    core.players['0'].magic = 0;

    const blarf = mkUnit('blarf', { abilities: ['blood_rune'], unitClass: 'champion', faction: 'goblin' });
    putUnit(core, { row: 4, col: 3 }, blarf, '0');

    const state: MatchState<SummonerWarsCore> = {
      core,
      sys: createInitialSystemState(['0', '1'], engineConfig.systems as any),
    };

    const result = runGamePipeline(state, {
      type: FLOW_COMMANDS.ADVANCE_PHASE,
      playerId: '0',
      payload: {},
    });

    expect(result.success).toBe(true);
    expect(result.state.sys.interaction.current).toBeUndefined();
    const resolved = result.events.find((event) => event.type === INTERACTION_EVENTS.RESOLVED);
    expect((resolved?.payload as Record<string, unknown> | undefined)?.optionId).toBe('damage');
    const damageEvent = result.events.find(e =>
      e.type === SW_EVENTS.UNIT_DAMAGED
      && (e.payload as Record<string, unknown>).reason === 'blood_rune'
    );
    expect(damageEvent).toBeDefined();
    expect(result.state.core.board[4][3].unit?.damage).toBe(1);
  });

  it('[blood_rune] 多个布拉夫阶段开始时应按响应后的魔力状态处理后续选择', () => {
    const core = createInitializedCore(['0', '1'], testRandom(), { faction0: 'goblin', faction1: 'necromancer' });
    clearRect(core, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);
    core.phase = 'build';
    core.currentPlayer = '0';
    core.players['0'].magic = 1;

    const first = putUnit(core, { row: 4, col: 2 }, mkUnit('blarf-first', {
      abilities: ['blood_rune'],
      unitClass: 'champion',
      faction: 'goblin',
    }), '0');
    const second = putUnit(core, { row: 4, col: 4 }, mkUnit('blarf-second', {
      abilities: ['blood_rune'],
      unitClass: 'champion',
      faction: 'goblin',
    }), '0');

    let state: MatchState<SummonerWarsCore> = {
      core,
      sys: createInitialSystemState(['0', '1'], engineConfig.systems as any),
    };

    const advanced = runGamePipeline(state, {
      type: FLOW_COMMANDS.ADVANCE_PHASE,
      playerId: '0',
      payload: {},
    });

    expect(advanced.success).toBe(true);
    state = advanced.state;
    const firstInteraction = state.sys.interaction.current;
    expect(firstInteraction?.kind).toBe('simple-choice');
    expect((firstInteraction?.data as { sw?: { type?: string; sourceUnitId?: string } } | undefined)?.sw).toMatchObject({
      type: 'on_phase_start_blood_rune',
      sourceUnitId: first.instanceId,
    });
    const firstOptions = ((firstInteraction?.data as { options?: Array<{ id: string }> } | undefined)?.options ?? []);
    expect(firstOptions.map((option) => option.id).sort()).toEqual(['charge', 'damage']);

    const chargedFirst = runGamePipeline(state, {
      type: INTERACTION_COMMANDS.RESPOND,
      playerId: '0',
      payload: { interactionId: firstInteraction!.id, optionId: 'charge' },
    });

    expect(chargedFirst.success).toBe(true);
    state = chargedFirst.state;
    expect(state.core.players['0'].magic).toBe(0);
    expect(state.core.board[first.position.row][first.position.col].unit?.boosts).toBe(1);

    expect(state.sys.interaction.current).toBeUndefined();
    expect(state.core.players['0'].magic).toBe(0);
    expect(state.core.board[first.position.row][first.position.col].unit?.boosts).toBe(1);
    expect(state.core.board[second.position.row][second.position.col].unit?.damage).toBe(1);
  });

  it('[illusion] 进入移动阶段时应创建可跳过的士兵目标选择交互', () => {
    const core = createInitializedCore(['0', '1'], testRandom(), { faction0: 'trickster', faction1: 'necromancer' });
    clearRect(core, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);
    core.phase = 'summon';
    core.currentPlayer = '0';

    const witch = mkUnit('mind-witch', { abilities: ['illusion'], unitClass: 'common', faction: 'trickster' });
    const targetCommon = mkUnit('copy-target', { abilities: ['evasion'], unitClass: 'common', faction: 'trickster' });
    const farCommon = mkUnit('far-copy-target', { abilities: ['rebound'], unitClass: 'common', faction: 'trickster' });
    const champion = mkUnit('champion-target', { abilities: ['vanish'], unitClass: 'champion', faction: 'trickster' });
    const source = putUnit(core, { row: 4, col: 3 }, witch, '0');
    const validTarget = putUnit(core, { row: 4, col: 5 }, targetCommon, '0');
    putUnit(core, { row: 1, col: 1 }, farCommon, '0');
    putUnit(core, { row: 4, col: 4 }, champion, '0');

    const state: MatchState<SummonerWarsCore> = {
      core,
      sys: createInitialSystemState(['0', '1'], engineConfig.systems as any),
    };

    const result = runGamePipeline(state, {
      type: FLOW_COMMANDS.ADVANCE_PHASE,
      playerId: '0',
      payload: {},
    });

    expect(result.success).toBe(true);
    const current = result.state.sys.interaction.current;
    expect(current?.kind).toBe('simple-choice');
    const data = current?.data as {
      sw?: { type?: string; sourceUnitId?: string };
      options?: Array<{ id: string; value?: { targetPosition?: CellCoord; skip?: boolean } }>;
    } | undefined;
    expect(data?.sw?.type).toBe('on_phase_start_illusion');
    expect(data?.sw?.sourceUnitId).toBe(source.instanceId);
    expect(data?.options?.some((option) => option.value?.skip)).toBe(true);
    expect(data?.options?.filter((option) =>
      option.value?.targetPosition?.row === validTarget.position.row
      && option.value.targetPosition.col === validTarget.position.col
    )).toHaveLength(1);
    expect(data?.options?.filter((option) => option.id.startsWith('pos:'))).toHaveLength(1);
  });

  it('[illusion] 选择士兵后应复制能力到回合结束且重复响应不二次复制', () => {
    const core = createInitializedCore(['0', '1'], testRandom(), { faction0: 'trickster', faction1: 'necromancer' });
    clearRect(core, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);
    core.phase = 'summon';
    core.currentPlayer = '0';

    const witch = mkUnit('mind-witch', { abilities: ['illusion'], unitClass: 'common', faction: 'trickster' });
    const targetCommon = mkUnit('copy-target', { abilities: ['evasion'], unitClass: 'common', faction: 'trickster' });
    const source = putUnit(core, { row: 4, col: 3 }, witch, '0');
    const validTarget = putUnit(core, { row: 4, col: 5 }, targetCommon, '0');

    let state: MatchState<SummonerWarsCore> = {
      core,
      sys: createInitialSystemState(['0', '1'], engineConfig.systems as any),
    };

    const movedToMove = runGamePipeline(state, {
      type: FLOW_COMMANDS.ADVANCE_PHASE,
      playerId: '0',
      payload: {},
    });
    expect(movedToMove.success).toBe(true);
    state = movedToMove.state;
    expect(getSwCurrentType(state)).toBe('on_phase_start_illusion');

    const current = state.sys.interaction.current;
    const optionId = `pos:${validTarget.position.row},${validTarget.position.col}`;
    const picked = runPipeline(state, {
      type: INTERACTION_COMMANDS.RESPOND,
      playerId: '0',
      payload: { interactionId: current!.id, optionId },
    });
    expect(picked.success).toBe(true);
    state = picked.state;

    expect(state.sys.interaction.current).toBeUndefined();
    expect(state.sys.interaction.queue).toHaveLength(0);
    const copied = getUnitAt(state.core, source.position);
    expect(copied?.tempAbilities).toContain('evasion');
    expect(picked.events.filter(e =>
      e.type === SW_EVENTS.ABILITIES_COPIED
      && e.payload?.sourceUnitId === source.instanceId
      && e.payload?.targetUnitId === validTarget.instanceId
    )).toHaveLength(1);

    const duplicateResponse = runPipeline(state, {
      type: INTERACTION_COMMANDS.RESPOND,
      playerId: '0',
      payload: { interactionId: current!.id, optionId },
    });
    expect(duplicateResponse.success).toBe(false);
    expect(getUnitAt(duplicateResponse.state.core, source.position)?.tempAbilities).toEqual(copied?.tempAbilities);
  });

  it('[spirit_bond] 移动后应强制二选一且不提供跳过', () => {
    const core = createInitializedCore(['0', '1'], testRandom(), { faction0: 'barbaric', faction1: 'necromancer' });
    clearRect(core, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);
    core.phase = 'move';
    core.currentPlayer = '0';

    const shaman = mkUnit('spirit-shaman', { abilities: ['spirit_bond'], faction: 'barbaric' });
    const ally = mkUnit('spirit-ally', { faction: 'barbaric' });
    const source = putUnit(core, { row: 4, col: 3 }, shaman, '0', { boosts: 1 });
    const transferTarget = putUnit(core, { row: 4, col: 5 }, ally, '0');

    const state: MatchState<SummonerWarsCore> = {
      core,
      sys: createInitialSystemState(['0', '1'], engineConfig.systems as any),
    };

    const result = runGamePipeline(state, {
      type: SW_COMMANDS.MOVE_UNIT,
      playerId: '0',
      payload: {
        from: { row: 4, col: 3 },
        to: { row: 4, col: 4 },
        path: [{ row: 4, col: 3 }, { row: 4, col: 4 }],
      },
    });

    expect(result.success).toBe(true);
    const current = result.state.sys.interaction.current;
    expect(current?.kind).toBe('simple-choice');
    const data = current?.data as {
      sw?: { type?: string; sourceUnitId?: string };
      options?: Array<{ id: string; value?: { choice?: string; targetPosition?: CellCoord; skip?: boolean } }>;
    } | undefined;
    expect(data?.sw?.type).toBe('after_move_spirit_bond');
    expect(data?.sw?.sourceUnitId).toBe(source.instanceId);
    expect(data?.options?.some((option) => option.value?.skip)).toBe(false);
    expect(data?.options?.some((option) => option.id === 'self' && option.value?.choice === 'self')).toBe(true);
    expect(data?.options?.filter((option) =>
      option.value?.choice === 'transfer'
      && option.value.targetPosition?.row === transferTarget.position.row
      && option.value.targetPosition.col === transferTarget.position.col
    )).toHaveLength(1);
  });

  it('[ice_shards] 攻击阶段开始确认后应花费 1 充能并对多建筑相邻敌方只伤一次', () => {
    const core = createInitializedCore(['0', '1'], testRandom(), { faction0: 'frost', faction1: 'barbaric' });
    clearRect(core, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);
    core.phase = 'build';
    core.currentPlayer = '0';

    const jarmund = putUnit(core, { row: 5, col: 3 }, mkUnit('jarmund', {
      abilities: ['ice_shards'],
      faction: 'frost',
      unitClass: 'champion',
    }), '0', { boosts: 1 });
    putStructure(core, { row: 4, col: 3 }, '0');
    putStructure(core, { row: 4, col: 5 }, '0');
    const enemy = putUnit(core, { row: 4, col: 4 }, mkUnit('ice-shards-enemy', {
      faction: 'barbaric',
      unitClass: 'common',
      life: 5,
    }), '1');

    let state: MatchState<SummonerWarsCore> = {
      core,
      sys: { ...createInitialSystemState(['0', '1'], engineConfig.systems as any), phase: 'build' },
    };

    const phaseExit = runGamePipeline(state, {
      type: FLOW_COMMANDS.ADVANCE_PHASE,
      playerId: '0',
      payload: {},
    });

    expect(phaseExit.success).toBe(true);
    state = phaseExit.state;
    expect(state.core.phase).toBe('attack');
    expect(state.sys.flowHalted).toBe(false);
    expect(getSwCurrentType(state)).toBe('ice_shards');
    const current = state.sys.interaction.current;
    expect(current?.kind).toBe('simple-choice');
    const options = ((current?.data as { options?: Array<{ id: string; disabled?: boolean }> } | undefined)?.options ?? []);
    expect(options.find((option) => option.id === 'confirm')?.disabled).toBe(false);
    expect(options.some((option) => option.id === 'skip')).toBe(true);

    const confirmed = runPipeline(state, {
      type: INTERACTION_COMMANDS.RESPOND,
      playerId: '0',
      payload: { interactionId: current!.id, optionId: 'confirm' },
    });

    expect(confirmed.success).toBe(true);
    state = confirmed.state;
    expect(state.sys.interaction.current).toBeUndefined();
    expect(state.sys.interaction.queue).toHaveLength(0);
    expect(getUnitAt(state.core, jarmund.position)?.boosts).toBe(0);
    expect(getUnitAt(state.core, enemy.position)?.damage).toBe(1);
    const damageEvents = confirmed.events.filter(e =>
      e.type === SW_EVENTS.UNIT_DAMAGED
      && (e.payload as Record<string, unknown>).reason === 'ice_shards'
    );
    expect(damageEvents).toHaveLength(1);

    expect(state.core.phase).toBe('attack');
  });

  it('[ice_shards] 攻击阶段开始跳过时不应消耗充能或造成伤害', () => {
    const core = createInitializedCore(['0', '1'], testRandom(), { faction0: 'frost', faction1: 'barbaric' });
    clearRect(core, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);
    core.phase = 'build';
    core.currentPlayer = '0';

    const jarmund = putUnit(core, { row: 5, col: 3 }, mkUnit('jarmund-skip', {
      abilities: ['ice_shards'],
      faction: 'frost',
      unitClass: 'champion',
    }), '0', { boosts: 1 });
    putStructure(core, { row: 4, col: 3 }, '0');
    const enemy = putUnit(core, { row: 4, col: 4 }, mkUnit('ice-shards-skip-enemy', {
      faction: 'barbaric',
      unitClass: 'common',
      life: 5,
    }), '1');

    let state: MatchState<SummonerWarsCore> = {
      core,
      sys: { ...createInitialSystemState(['0', '1'], engineConfig.systems as any), phase: 'build' },
    };

    const phaseExit = runGamePipeline(state, {
      type: FLOW_COMMANDS.ADVANCE_PHASE,
      playerId: '0',
      payload: {},
    });
    expect(phaseExit.success).toBe(true);
    state = phaseExit.state;
    expect(getSwCurrentType(state)).toBe('ice_shards');

    const skipped = runPipeline(state, {
      type: INTERACTION_COMMANDS.RESPOND,
      playerId: '0',
      payload: { interactionId: state.sys.interaction.current!.id, optionId: 'skip' },
    });

    expect(skipped.success).toBe(true);
    state = skipped.state;
    expect(getUnitAt(state.core, jarmund.position)?.boosts).toBe(1);
    expect(getUnitAt(state.core, enemy.position)?.damage).toBe(0);
    expect(skipped.events.some(e =>
      e.type === SW_EVENTS.UNIT_DAMAGED
      && (e.payload as Record<string, unknown>).reason === 'ice_shards'
    )).toBe(false);

    expect(state.core.phase).toBe('attack');
  });

  it('[ice_shards] 多个贾穆德在同一攻击阶段开始时应逐个收口', () => {
    const core = createInitializedCore(['0', '1'], testRandom(), { faction0: 'frost', faction1: 'barbaric' });
    clearRect(core, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);
    core.phase = 'build';
    core.currentPlayer = '0';

    const first = putUnit(core, { row: 5, col: 2 }, mkUnit('jarmund-first', {
      abilities: ['ice_shards'],
      faction: 'frost',
      unitClass: 'champion',
    }), '0', { boosts: 1 });
    const second = putUnit(core, { row: 5, col: 5 }, mkUnit('jarmund-second', {
      abilities: ['ice_shards'],
      faction: 'frost',
      unitClass: 'champion',
    }), '0', { boosts: 1 });
    putStructure(core, { row: 4, col: 3 }, '0');
    const enemy = putUnit(core, { row: 4, col: 4 }, mkUnit('ice-shards-multi-enemy', {
      faction: 'barbaric',
      unitClass: 'common',
      life: 5,
    }), '1');

    let state: MatchState<SummonerWarsCore> = {
      core,
      sys: { ...createInitialSystemState(['0', '1'], engineConfig.systems as any), phase: 'build' },
    };

    const phaseExit = runGamePipeline(state, {
      type: FLOW_COMMANDS.ADVANCE_PHASE,
      playerId: '0',
      payload: {},
    });

    expect(phaseExit.success).toBe(true);
    state = phaseExit.state;
    expect(state.core.phase).toBe('attack');
    expect(state.sys.flowHalted).toBe(false);
    expect(getSwCurrentType(state)).toBe('ice_shards');
    expect(state.sys.interaction.queue).toHaveLength(1);

    const firstInteraction = state.sys.interaction.current!;
    const firstSource = (firstInteraction.data as { sw?: { sourceUnitId?: string } }).sw?.sourceUnitId;
    const secondSource = ((state.sys.interaction.queue[0]?.data as { sw?: { sourceUnitId?: string } } | undefined)?.sw?.sourceUnitId);
    expect(new Set([firstSource, secondSource])).toEqual(new Set([first.instanceId, second.instanceId]));

    const firstConfirmed = runPipeline(state, {
      type: INTERACTION_COMMANDS.RESPOND,
      playerId: '0',
      payload: { interactionId: firstInteraction.id, optionId: 'confirm' },
    });
    expect(firstConfirmed.success).toBe(true);
    state = firstConfirmed.state;
    expect(state.core.phase).toBe('attack');
    expect(state.sys.flowHalted).toBe(false);
    expect(getUnitAt(state.core, enemy.position)?.damage).toBe(1);
    expect([getUnitAt(state.core, first.position)?.boosts, getUnitAt(state.core, second.position)?.boosts].sort()).toEqual([0, 1]);
    expect(getSwCurrentType(state)).toBe('ice_shards');
    expect(state.sys.interaction.queue).toHaveLength(0);

    const secondInteraction = state.sys.interaction.current!;
    const secondConfirmed = runPipeline(state, {
      type: INTERACTION_COMMANDS.RESPOND,
      playerId: '0',
      payload: { interactionId: secondInteraction.id, optionId: 'confirm' },
    });
    expect(secondConfirmed.success).toBe(true);
    state = secondConfirmed.state;
    expect(getUnitAt(state.core, enemy.position)?.damage).toBe(2);
    expect(getUnitAt(state.core, first.position)?.boosts).toBe(0);
    expect(getUnitAt(state.core, second.position)?.boosts).toBe(0);
    expect(state.sys.interaction.current).toBeUndefined();
    expect(state.sys.interaction.queue).toHaveLength(0);
  });

  it('[feed_beast] 攻击阶段结束吃友方后应收口并继续推进，不重复二次弃置', () => {
    const core = createInitializedCore(['0', '1'], testRandom(), { faction0: 'goblin', faction1: 'necromancer' });
    clearRect(core, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);
    core.phase = 'attack';
    core.currentPlayer = '0';

    const beast = putUnit(core, { row: 4, col: 2 }, mkUnit('feed-beast-l4', {
      abilities: ['feed_beast'],
      faction: 'goblin',
      unitClass: 'champion',
      life: 6,
    }), '0');
    const ally = putUnit(core, { row: 4, col: 3 }, mkUnit('feed-beast-l4-ally', {
      faction: 'goblin',
      unitClass: 'common',
      life: 2,
    }), '0');

    let state: MatchState<SummonerWarsCore> = {
      core,
      sys: { ...createInitialSystemState(['0', '1'], engineConfig.systems as any), phase: 'attack' },
    };

    const phaseExit = runGamePipeline(state, {
      type: FLOW_COMMANDS.ADVANCE_PHASE,
      playerId: '0',
      payload: {},
    });
    expect(phaseExit.success).toBe(true);
    state = phaseExit.state;
    expect(state.core.phase).toBe('attack');
    expect(state.sys.flowHalted).toBe(true);
    expect(getSwCurrentType(state)).toBe('feed_beast');

    const current = state.sys.interaction.current;
    expect(current?.kind).toBe('simple-choice');
    const options = ((current?.data as { options?: PromptOption[] } | undefined)?.options ?? []) as PromptOption[];
    const allyOptionId = options.find((option) => {
      const value = option.value as { action?: string; choice?: string; targetPosition?: CellCoord } | undefined;
      return value?.action === 'feed_beast'
        && value.choice === 'destroy_adjacent'
        && value.targetPosition?.row === ally.position.row
        && value.targetPosition?.col === ally.position.col;
    })?.id;
    expect(allyOptionId).toBeTruthy();
    expect(options.some(option => option.id === 'self_destroy')).toBe(true);

    const picked = runPipeline(state, {
      type: INTERACTION_COMMANDS.RESPOND,
      playerId: '0',
      payload: { interactionId: current!.id, optionId: allyOptionId },
    });
    expect(picked.success).toBe(true);
    state = picked.state;

    expect(state.sys.interaction.current).toBeUndefined();
    expect(state.sys.interaction.queue).toHaveLength(0);
    expect(getUnitAt(state.core, beast.position)?.instanceId).toBe(beast.instanceId);
    expect(getUnitAt(state.core, ally.position)).toBeUndefined();
    expect(picked.events.filter(e =>
      e.type === SW_EVENTS.UNIT_DESTROYED
      && (e.payload as Record<string, unknown>).reason === 'feed_beast'
    )).toHaveLength(1);

    const duplicateResponse = runPipeline(state, {
      type: INTERACTION_COMMANDS.RESPOND,
      playerId: '0',
      payload: { interactionId: current!.id, optionId: allyOptionId },
    });
    expect(duplicateResponse.success).toBe(false);
    expect(getUnitAt(duplicateResponse.state.core, ally.position)).toBeUndefined();
    expect(getUnitAt(duplicateResponse.state.core, beast.position)?.instanceId).toBe(beast.instanceId);

    const repeatedExit = runGamePipeline(state, {
      type: FLOW_COMMANDS.ADVANCE_PHASE,
      playerId: '0',
      payload: {},
    });
    expect(repeatedExit.success).toBe(true);
    expect(repeatedExit.state.core.phase).toBe('magic');
    expect(repeatedExit.state.sys.flowHalted).toBe(false);
    expect(repeatedExit.state.sys.interaction.current).toBeUndefined();
  });

  it('[mogu_parasite] 攻击阶段结束有充能时应出现消耗充能/自伤选择，确认后再收口推进', () => {
    const core = createInitializedCore(['0', '1'], testRandom(), { faction0: 'mogu', faction1: 'necromancer' });
    clearRect(core, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);
    core.phase = 'attack';
    core.currentPlayer = '0';
    core.players['0'].hasAttackedEnemy = true;

    const beast = putUnit(core, { row: 4, col: 2 }, mkUnit('mogu-parasite-l4', {
      abilities: ['mogu_parasite'],
      faction: 'mogu',
      unitClass: 'common',
      life: 5,
    }), '0', { boosts: 1 });

    let state: MatchState<SummonerWarsCore> = {
      core,
      sys: createInitialSystemState(['0', '1'], engineConfig.systems as any),
    };

    const phaseExit = runGamePipeline(state, {
      type: SW_COMMANDS.END_PHASE,
      playerId: '0',
      payload: {},
    });
    expect(phaseExit.success).toBe(true);
    state = phaseExit.state;
    expect(state.core.phase).toBe('attack');
    expect(getSwCurrentType(state)).toBe('mogu_parasite');
    expect(getUnitAt(state.core, beast.position)?.boosts).toBe(1);
    expect(getUnitAt(state.core, beast.position)?.damage).toBe(0);

    const current = state.sys.interaction.current;
    expect(current?.kind).toBe('simple-choice');
    const options = ((current?.data as { options?: PromptOption[] } | undefined)?.options ?? []) as PromptOption[];
    const consumeOptionId = options.find((option) => {
      const value = option.value as { action?: string; choice?: string } | undefined;
      return value?.action === 'mogu_parasite' && value.choice === 'consume_charge';
    })?.id;
    const damageOptionId = options.find((option) => {
      const value = option.value as { action?: string; choice?: string } | undefined;
      return value?.action === 'mogu_parasite' && value.choice === 'take_damage';
    })?.id;
    expect(consumeOptionId).toBeTruthy();
    expect(damageOptionId).toBeTruthy();

    const picked = runPipeline(state, {
      type: INTERACTION_COMMANDS.RESPOND,
      playerId: '0',
      payload: { interactionId: current!.id, optionId: consumeOptionId },
    });
    expect(picked.success).toBe(true);
    state = picked.state;
    expect(state.sys.interaction.current).toBeUndefined();
    expect(getUnitAt(state.core, beast.position)?.boosts).toBe(0);
    expect(getUnitAt(state.core, beast.position)?.damage).toBe(0);

    const repeatedExit = runGamePipeline(state, {
      type: SW_COMMANDS.END_PHASE,
      playerId: '0',
      payload: {},
    });
    expect(repeatedExit.success).toBe(true);
    expect(repeatedExit.state.core.phase).toBe('magic');
    expect(repeatedExit.state.sys.interaction.current).toBeUndefined();
    expect(getUnitAt(repeatedExit.state.core, beast.position)?.boosts).toBe(0);
    expect(getUnitAt(repeatedExit.state.core, beast.position)?.damage).toBe(0);
  });

  it('[huijin_call_guards] 真实结束阶段应先选择手牌士兵，再召唤到相邻空格', () => {
    const core = createInitializedCore(['0', '1'], testRandom(), { faction0: 'huijin', faction1: 'necromancer' });
    clearRect(core, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);
    core.phase = 'attack';
    core.currentPlayer = '0';
    core.players['0'].hasAttackedEnemy = true;

    const summonPosition = { row: 4, col: 3 };
    const summoner = putUnit(core, { row: 4, col: 2 }, mkUnit('huijin-summoner-l4', {
      abilities: ['huijin_call_guards'],
      faction: 'huijin',
      unitClass: 'summoner',
      name: '玛达莉雅女王',
      life: 7,
    }), '0', { boosts: 1 });
    const guardCard = mkUnit('huijin-ash-archer-hand-l4', {
      abilities: ['huijin_quick_shot'],
      faction: 'huijin',
      unitClass: 'common',
      name: '灰烬弓箭手',
    });
    core.players['0'].hand.push(guardCard);

    let state: MatchState<SummonerWarsCore> = {
      core,
      sys: createInitialSystemState(['0', '1'], engineConfig.systems as any),
    };

    const phaseExit = runGamePipeline(state, {
      type: SW_COMMANDS.END_PHASE,
      playerId: '0',
      payload: {},
    });
    expect(phaseExit.success).toBe(true);
    state = phaseExit.state;
    expect(state.core.phase).toBe('attack');
    expect(getSwCurrentType(state)).toBe('huijin_call_guards_select_card');
    expect(getUnitAt(state.core, summoner.position)?.boosts).toBe(1);

    const cardCurrent = state.sys.interaction.current;
    expect(cardCurrent?.kind).toBe('simple-choice');
    const cardOptions = ((cardCurrent?.data as { options?: PromptOption[] } | undefined)?.options ?? []) as PromptOption[];
    expect(cardOptions.some(option => option.id === guardCard.id)).toBe(true);
    expect(cardOptions.some(option => option.id === 'skip')).toBe(true);

    const pickedCard = runGamePipeline(state, {
      type: INTERACTION_COMMANDS.RESPOND,
      playerId: '0',
      payload: { interactionId: cardCurrent!.id, optionId: guardCard.id },
    });
    expect(pickedCard.success).toBe(true);
    state = pickedCard.state;
    expect(getSwCurrentType(state)).toBe('huijin_call_guards_select_position');

    const positionCurrent = state.sys.interaction.current;
    expect(positionCurrent?.kind).toBe('simple-choice');
    const positionOptions = ((positionCurrent?.data as { options?: PromptOption[] } | undefined)?.options ?? []) as PromptOption[];
    const summonOptionId = positionOptions.find((option) => {
      const value = option.value as { action?: string; position?: CellCoord } | undefined;
      return value?.action === 'huijin_call_guards_position'
        && value.position?.row === summonPosition.row
        && value.position.col === summonPosition.col;
    })?.id;
    expect(summonOptionId).toBeTruthy();

    const pickedPosition = runGamePipeline(state, {
      type: INTERACTION_COMMANDS.RESPOND,
      playerId: '0',
      payload: { interactionId: positionCurrent!.id, optionId: summonOptionId },
    });
    expect(pickedPosition.success).toBe(true);
    state = pickedPosition.state;
    expect(state.sys.interaction.current).toBeUndefined();
    expect(getUnitAt(state.core, summonPosition)?.card.id).toBe(guardCard.id);
    expect(getUnitAt(state.core, summoner.position)?.boosts).toBe(0);
    expect(state.core.players['0'].hand.some(card => card.id === guardCard.id)).toBe(false);

    const repeatedExit = runGamePipeline(state, {
      type: SW_COMMANDS.END_PHASE,
      playerId: '0',
      payload: {},
    });
    expect(repeatedExit.success).toBe(true);
    expect(repeatedExit.state.core.phase).toBe('magic');
    expect(repeatedExit.state.sys.interaction.current).toBeUndefined();
  });

  it('[huijin_call_guards] 合法手牌存在时跳过不应消耗充能或召唤单位，并可继续阶段', () => {
    const core = createInitializedCore(['0', '1'], testRandom(), { faction0: 'huijin', faction1: 'necromancer' });
    clearRect(core, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);
    core.phase = 'attack';
    core.currentPlayer = '0';
    core.players['0'].hasAttackedEnemy = true;

    const summonPosition = { row: 4, col: 3 };
    const summoner = putUnit(core, { row: 4, col: 2 }, mkUnit('huijin-summoner-skip-l4', {
      abilities: ['huijin_call_guards'],
      faction: 'huijin',
      unitClass: 'summoner',
      name: '玛达莉雅女王',
      life: 7,
    }), '0', { boosts: 1 });
    const guardCard = mkUnit('huijin-ash-archer-hand-skip-l4', {
      abilities: ['huijin_quick_shot'],
      faction: 'huijin',
      unitClass: 'common',
      name: '灰烬弓箭手',
    });
    core.players['0'].hand.push(guardCard);

    let state: MatchState<SummonerWarsCore> = {
      core,
      sys: createInitialSystemState(['0', '1'], engineConfig.systems as any),
    };

    const phaseExit = runGamePipeline(state, {
      type: SW_COMMANDS.END_PHASE,
      playerId: '0',
      payload: {},
    });
    expect(phaseExit.success).toBe(true);
    state = phaseExit.state;
    expect(getSwCurrentType(state)).toBe('huijin_call_guards_select_card');

    const current = state.sys.interaction.current;
    const options = ((current?.data as { options?: PromptOption[] } | undefined)?.options ?? []) as PromptOption[];
    expect(options.some(option => option.id === guardCard.id)).toBe(true);
    expect(options.some(option => option.id === 'skip')).toBe(true);

    const skipped = runGamePipeline(state, {
      type: INTERACTION_COMMANDS.RESPOND,
      playerId: '0',
      payload: { interactionId: current!.id, optionId: 'skip' },
    });
    expect(skipped.success).toBe(true);
    state = skipped.state;
    expect(state.sys.interaction.current).toBeUndefined();
    expect(getUnitAt(state.core, summoner.position)?.boosts).toBe(1);
    expect(getUnitAt(state.core, summonPosition)).toBeUndefined();
    expect(state.core.players['0'].hand.some(card => card.id === guardCard.id)).toBe(true);

    const repeatedExit = runGamePipeline(state, {
      type: SW_COMMANDS.END_PHASE,
      playerId: '0',
      payload: {},
    });
    expect(repeatedExit.success).toBe(true);
    expect(repeatedExit.state.core.phase).toBe('magic');
    expect(repeatedExit.state.sys.interaction.current).toBeUndefined();
  });

  it('[huijin_ram] 合法目标存在时跳过目标选择或落点选择均不应移动目标', () => {
    const core = createInitializedCore(['0', '1'], testRandom(), { faction0: 'huijin', faction1: 'necromancer' });
    clearRect(core, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);
    core.phase = 'attack';
    core.currentPlayer = '0';

    const guardPosition = { row: 4, col: 2 };
    const enemyPosition = { row: 4, col: 3 };
    const pushPosition = { row: 4, col: 4 };
    putUnit(core, guardPosition, mkUnit('huijin-royal-guard-skip-l4', {
      abilities: ['huijin_ram'],
      faction: 'huijin',
      unitClass: 'common',
      name: '皇家守卫',
      strength: 1,
    }), '0');
    const enemy = putUnit(core, enemyPosition, mkUnit('huijin-ram-enemy-skip-l4', {
      faction: 'necromancer',
      unitClass: 'common',
      name: '敌方士兵',
      life: 8,
    }), '1');

    let state: MatchState<SummonerWarsCore> = {
      core,
      sys: createInitialSystemState(['0', '1'], interactionSystems),
    };

    const attacked = runPipeline(state, {
      type: SW_COMMANDS.DECLARE_ATTACK,
      playerId: '0',
      payload: { attacker: guardPosition, target: enemyPosition },
    });
    expect(attacked.success).toBe(true);
    state = attacked.state;
    expect(getSwCurrentType(state)).toBe('after_attack_huijin_ram_target');

    const targetCurrent = state.sys.interaction.current;
    const targetOptions = ((targetCurrent?.data as { options?: PromptOption[] } | undefined)?.options ?? []) as PromptOption[];
    const targetOptionId = targetOptions.find((option) => {
      const value = option.value as { action?: string; targetPosition?: CellCoord } | undefined;
      return value?.action === 'after_attack_huijin_ram_target'
        && value.targetPosition?.row === enemyPosition.row
        && value.targetPosition?.col === enemyPosition.col;
    })?.id;
    expect(targetOptionId).toBeTruthy();
    expect(targetOptions.some(option => option.id === 'skip')).toBe(true);

    const skippedTarget = runPipeline(state, {
      type: INTERACTION_COMMANDS.RESPOND,
      playerId: '0',
      payload: { interactionId: targetCurrent!.id, optionId: 'skip' },
    });
    expect(skippedTarget.success).toBe(true);
    expect(skippedTarget.state.sys.interaction.current).toBeUndefined();
    expect(getUnitAt(skippedTarget.state.core, enemyPosition)?.instanceId).toBe(enemy.instanceId);
    expect(getUnitAt(skippedTarget.state.core, pushPosition)).toBeUndefined();
    expect(skippedTarget.events.some(e => e.type === SW_EVENTS.UNIT_PUSHED)).toBe(false);

    const pickedTarget = runPipeline(state, {
      type: INTERACTION_COMMANDS.RESPOND,
      playerId: '0',
      payload: { interactionId: targetCurrent!.id, optionId: targetOptionId },
    });
    expect(pickedTarget.success).toBe(true);
    state = pickedTarget.state;
    expect(getSwCurrentType(state)).toBe('after_attack_huijin_ram_position');

    const positionCurrent = state.sys.interaction.current;
    const positionOptions = ((positionCurrent?.data as { options?: PromptOption[] } | undefined)?.options ?? []) as PromptOption[];
    expect(positionOptions.some(option => option.id === 'skip')).toBe(true);

    const skippedPosition = runPipeline(state, {
      type: INTERACTION_COMMANDS.RESPOND,
      playerId: '0',
      payload: { interactionId: positionCurrent!.id, optionId: 'skip' },
    });
    expect(skippedPosition.success).toBe(true);
    expect(skippedPosition.state.sys.interaction.current).toBeUndefined();
    expect(getUnitAt(skippedPosition.state.core, enemyPosition)?.instanceId).toBe(enemy.instanceId);
    expect(getUnitAt(skippedPosition.state.core, pushPosition)).toBeUndefined();
    expect(skippedPosition.events.some(e => e.type === SW_EVENTS.UNIT_PUSHED)).toBe(false);
  });

  it('[huijin_quick_shot] 合法目标存在时跳过不应造成伤害，并保留移动结果', () => {
    const core = createInitializedCore(['0', '1'], testRandom(), { faction0: 'huijin', faction1: 'necromancer' });
    clearRect(core, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);
    core.phase = 'move';
    core.currentPlayer = '0';

    const start = { row: 4, col: 2 };
    const movedTo = { row: 4, col: 3 };
    const enemyPosition = { row: 4, col: 5 };
    const archer = putUnit(core, start, mkUnit('huijin-ash-archer-skip-l4', {
      abilities: ['huijin_quick_shot'],
      faction: 'huijin',
      unitClass: 'common',
      name: '灰烬弓箭手',
      attackType: 'ranged',
      attackRange: 3,
    }), '0');
    const enemy = putUnit(core, enemyPosition, mkUnit('huijin-quick-shot-enemy-skip-l4', {
      faction: 'necromancer',
      unitClass: 'common',
      name: '敌方士兵',
      life: 8,
    }), '1');

    let state: MatchState<SummonerWarsCore> = {
      core,
      sys: createInitialSystemState(['0', '1'], engineConfig.systems as any),
    };

    const moved = runGamePipeline(state, {
      type: SW_COMMANDS.MOVE_UNIT,
      playerId: '0',
      payload: { from: start, to: movedTo, path: [start, movedTo] },
    });
    expect(moved.success).toBe(true);
    state = moved.state;
    expect(getSwCurrentType(state)).toBe('after_move_huijin_quick_shot');

    const current = state.sys.interaction.current;
    const options = ((current?.data as { options?: PromptOption[] } | undefined)?.options ?? []) as PromptOption[];
    expect(options.some((option) => {
      const value = option.value as { action?: string; targetPosition?: CellCoord } | undefined;
      return value?.action === 'after_move_huijin_quick_shot'
        && value.targetPosition?.row === enemyPosition.row
        && value.targetPosition?.col === enemyPosition.col;
    })).toBe(true);
    expect(options.some(option => option.id === 'skip')).toBe(true);

    const skipped = runGamePipeline(state, {
      type: INTERACTION_COMMANDS.RESPOND,
      playerId: '0',
      payload: { interactionId: current!.id, optionId: 'skip' },
    });
    expect(skipped.success).toBe(true);
    expect(skipped.state.sys.interaction.current).toBeUndefined();
    expect(getUnitAt(skipped.state.core, start)).toBeUndefined();
    expect(getUnitAt(skipped.state.core, movedTo)?.instanceId).toBe(archer.instanceId);
    expect(getUnitAt(skipped.state.core, enemyPosition)?.instanceId).toBe(enemy.instanceId);
    expect(getUnitAt(skipped.state.core, enemyPosition)?.damage).toBe(0);
    expect(skipped.events.some(e =>
      e.type === SW_EVENTS.UNIT_DAMAGED
      && (e.payload as Record<string, unknown>).reason === 'huijin_quick_shot'
    )).toBe(false);
  });

  it('[mind_capture] 致命攻击后选择控制应忽略伤害并转移目标控制权', () => {
    const core = createInitializedCore(['0', '1'], testRandom(), { faction0: 'trickster', faction1: 'necromancer' });
    clearRect(core, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);
    core.phase = 'attack';
    core.currentPlayer = '0';

    const tekelu = putUnit(core, { row: 4, col: 2 }, mkUnit('tekelu', {
      abilities: ['mind_capture', 'imposing'],
      faction: 'trickster',
      unitClass: 'summoner',
      strength: 2,
      attackType: 'ranged',
      attackRange: 3,
    }), '0');
    const enemy = putUnit(core, { row: 4, col: 4 }, mkUnit('mind-capture-enemy', {
      faction: 'necromancer',
      unitClass: 'common',
      life: 1,
    }), '1');

    let state: MatchState<SummonerWarsCore> = {
      core,
      sys: createInitialSystemState(['0', '1'], interactionSystems),
    };

    const requested = runPipeline(state, {
      type: SW_COMMANDS.DECLARE_ATTACK,
      playerId: '0',
      payload: { attacker: tekelu.position, target: enemy.position },
    });

    expect(requested.success).toBe(true);
    state = requested.state;
    expect(getSwCurrentType(state)).toBe('mind_capture');
    expect(getUnitAt(state.core, enemy.position)?.owner).toBe('1');
    expect(getUnitAt(state.core, enemy.position)?.damage).toBe(0);
    expect(requested.events.some(e => e.type === SW_EVENTS.MIND_CAPTURE_REQUESTED)).toBe(true);
    expect(requested.events.some(e =>
      e.type === SW_EVENTS.UNIT_DAMAGED
      && (e.payload as Record<string, unknown>).position
      && ((e.payload as { position: CellCoord }).position.row === enemy.position.row)
      && ((e.payload as { position: CellCoord }).position.col === enemy.position.col)
    )).toBe(false);
    expect(requested.events.some(e =>
      e.type === SW_EVENTS.ABILITY_TRIGGERED
      && (e.payload as Record<string, unknown>).abilityId === 'imposing'
    )).toBe(false);

    const current = state.sys.interaction.current;
    expect(current?.kind).toBe('simple-choice');
    const options = ((current?.data as { options?: PromptOption[] } | undefined)?.options ?? []) as PromptOption[];
    expect(options.map((option) => option.id).sort()).toEqual(['control', 'damage']);

    const resolved = runPipeline(state, {
      type: INTERACTION_COMMANDS.RESPOND,
      playerId: '0',
      payload: { interactionId: current!.id, optionId: 'control' },
    });

    expect(resolved.success).toBe(true);
    state = resolved.state;
    expect(state.sys.interaction.current).toBeUndefined();
    expect(getUnitAt(state.core, enemy.position)?.owner).toBe('0');
    expect(getUnitAt(state.core, enemy.position)?.damage).toBe(0);
    expect(resolved.events.some(e => e.type === SW_EVENTS.CONTROL_TRANSFERRED)).toBe(true);
    expect(resolved.events.some(e =>
      e.type === SW_EVENTS.UNIT_DAMAGED
      && (e.payload as Record<string, unknown>).position
      && ((e.payload as { position: CellCoord }).position.row === enemy.position.row)
      && ((e.payload as { position: CellCoord }).position.col === enemy.position.col)
    )).toBe(false);
    expect(resolved.events.some(e =>
      e.type === SW_EVENTS.ABILITY_TRIGGERED
      && (e.payload as Record<string, unknown>).abilityId === 'imposing'
    )).toBe(true);
    expect(getUnitAt(state.core, tekelu.position)?.boosts).toBe(1);
  });

  it('[mind_capture] 致命攻击后选择伤害应摧毁目标且重复响应不二次伤害', () => {
    const core = createInitializedCore(['0', '1'], testRandom(), { faction0: 'trickster', faction1: 'necromancer' });
    clearRect(core, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);
    core.phase = 'attack';
    core.currentPlayer = '0';

    const tekelu = putUnit(core, { row: 4, col: 2 }, mkUnit('tekelu-damage', {
      abilities: ['mind_capture', 'imposing'],
      faction: 'trickster',
      unitClass: 'summoner',
      strength: 2,
      attackType: 'ranged',
      attackRange: 3,
    }), '0');
    const enemy = putUnit(core, { row: 4, col: 4 }, mkUnit('mind-capture-damage-enemy', {
      faction: 'necromancer',
      unitClass: 'common',
      life: 1,
    }), '1');

    let state: MatchState<SummonerWarsCore> = {
      core,
      sys: createInitialSystemState(['0', '1'], interactionSystems),
    };

    const requested = runPipeline(state, {
      type: SW_COMMANDS.DECLARE_ATTACK,
      playerId: '0',
      payload: { attacker: tekelu.position, target: enemy.position },
    });

    expect(requested.success).toBe(true);
    state = requested.state;
    expect(getSwCurrentType(state)).toBe('mind_capture');
    expect(getUnitAt(state.core, enemy.position)?.owner).toBe('1');
    expect(getUnitAt(state.core, enemy.position)?.damage).toBe(0);
    expect(requested.events.some(e => e.type === SW_EVENTS.MIND_CAPTURE_REQUESTED)).toBe(true);
    expect(requested.events.some(e =>
      e.type === SW_EVENTS.UNIT_DAMAGED
      && (e.payload as Record<string, unknown>).position
      && ((e.payload as { position: CellCoord }).position.row === enemy.position.row)
      && ((e.payload as { position: CellCoord }).position.col === enemy.position.col)
    )).toBe(false);
    expect(requested.events.some(e =>
      e.type === SW_EVENTS.ABILITY_TRIGGERED
      && (e.payload as Record<string, unknown>).abilityId === 'imposing'
    )).toBe(false);

    const current = state.sys.interaction.current;
    expect(current?.kind).toBe('simple-choice');
    const options = ((current?.data as { options?: PromptOption[] } | undefined)?.options ?? []) as PromptOption[];
    expect(options.map((option) => option.id).sort()).toEqual(['control', 'damage']);

    const resolved = runPipeline(state, {
      type: INTERACTION_COMMANDS.RESPOND,
      playerId: '0',
      payload: { interactionId: current!.id, optionId: 'damage' },
    });

    expect(resolved.success).toBe(true);
    state = resolved.state;
    expect(state.sys.interaction.current).toBeUndefined();
    expect(state.sys.interaction.queue).toHaveLength(0);
    expect(getUnitAt(state.core, enemy.position)).toBeUndefined();
    expect(resolved.events.some(e => e.type === SW_EVENTS.CONTROL_TRANSFERRED)).toBe(false);
    expect(resolved.events.some(e =>
      e.type === SW_EVENTS.UNIT_DAMAGED
      && (e.payload as Record<string, unknown>).position
      && ((e.payload as { position: CellCoord }).position.row === enemy.position.row)
      && ((e.payload as { position: CellCoord }).position.col === enemy.position.col)
    )).toBe(true);
    expect(resolved.events.some(e =>
      e.type === SW_EVENTS.UNIT_DESTROYED
      && (e.payload as Record<string, unknown>).position
      && ((e.payload as { position: CellCoord }).position.row === enemy.position.row)
      && ((e.payload as { position: CellCoord }).position.col === enemy.position.col)
    )).toBe(true);
    expect(resolved.events.some(e =>
      e.type === SW_EVENTS.ABILITY_TRIGGERED
      && (e.payload as Record<string, unknown>).abilityId === 'imposing'
    )).toBe(true);
    expect(getUnitAt(state.core, tekelu.position)?.boosts).toBe(1);

    const duplicateResponse = runPipeline(state, {
      type: INTERACTION_COMMANDS.RESPOND,
      playerId: '0',
      payload: { interactionId: current!.id, optionId: 'damage' },
    });
    expect(duplicateResponse.success).toBe(false);
    expect(getUnitAt(duplicateResponse.state.core, enemy.position)).toBeUndefined();
    expect(getUnitAt(duplicateResponse.state.core, tekelu.position)?.boosts).toBe(1);
    expect(duplicateResponse.events.filter(e => e.type === SW_EVENTS.UNIT_DAMAGED)).toHaveLength(0);
    expect(duplicateResponse.events.filter(e => e.type === SW_EVENTS.UNIT_DESTROYED)).toHaveLength(0);
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

  it('[high_telekinesis] 目标是建筑时验证失败', () => {
    core.phase = 'attack';
    core.currentPlayer = '0' as PlayerId;
    const kara = mkUnit('kara', { abilities: ['high_telekinesis'], unitClass: 'champion', faction: 'trickster' });
    const unit = putUnit(core, { row: 4, col: 3 }, kara, '0');
    putStructure(core, { row: 4, col: 4 }, '1', mkStructure('high-telekinesis-target-structure', { faction: 'necromancer' }));

    const result = validate(core, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'high_telekinesis',
      sourceUnitId: unit.instanceId,
      targetPosition: { row: 4, col: 4 },
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

  it('[prepare] 准备后应等价消耗移动并给自身1个充能', () => {
    core.phase = 'move';
    core.currentPlayer = '0' as PlayerId;
    const archer = mkUnit('frontier-archer', { abilities: ['prepare'], faction: 'barbaric' });
    const unit = putUnit(core, { row: 4, col: 3 }, archer, '0', { hasMoved: false, boosts: 0 });

    const before = validate(core, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'prepare',
      sourceUnitId: unit.instanceId,
    });
    expect(before.valid).toBe(true);

    const events = exec(core, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'prepare',
      sourceUnitId: unit.instanceId,
    });
    expect(events.find(e => e.type === SW_EVENTS.UNIT_CHARGED)).toMatchObject({
      payload: { position: unit.position, delta: 1 },
    });

    for (const event of events) {
      core = SummonerWarsDomain.reduce(core, event);
    }

    const prepared = getUnitAt(core, unit.position);
    expect(prepared?.boosts).toBe(1);
    expect(prepared?.hasMoved).toBe(true);

    const moveAfterPrepare = validate(core, SW_COMMANDS.MOVE_UNIT, {
      from: unit.position,
      to: { row: 4, col: 4 },
    });
    expect(moveAfterPrepare.valid).toBe(false);
  });

  it('[prepare] 完整管线中应直接充能并消耗本次移动', () => {
    core.phase = 'move';
    core.currentPlayer = '0' as PlayerId;
    const archer = mkUnit('frontier-archer', { abilities: ['prepare'], faction: 'barbaric' });
    const unit = putUnit(core, { row: 4, col: 3 }, archer, '0', { hasMoved: false, boosts: 0 });

    let state: MatchState<SummonerWarsCore> = {
      core,
      sys: createInitialSystemState(['0', '1'], engineConfig.systems as any),
    };

    const prepared = runGamePipeline(state, {
      type: SW_COMMANDS.ACTIVATE_ABILITY,
      playerId: '0',
      payload: { abilityId: 'prepare', sourceUnitId: unit.instanceId },
    });
    expect(prepared.success).toBe(true);
    state = prepared.state;

    expect(state.sys.interaction.current).toBeUndefined();
    expect(state.sys.interaction.queue).toHaveLength(0);
    expect(getUnitAt(state.core, unit.position)?.boosts).toBe(1);
    expect(getUnitAt(state.core, unit.position)?.hasMoved).toBe(true);
    expect(prepared.events.filter(e =>
      e.type === SW_EVENTS.UNIT_CHARGED
      && e.payload?.sourceAbilityId === 'prepare'
    )).toHaveLength(1);

    const moveAfterPrepare = runGamePipeline(state, {
      type: SW_COMMANDS.MOVE_UNIT,
      playerId: '0',
      payload: { from: unit.position, to: { row: 4, col: 4 } },
    });
    expect(moveAfterPrepare.success).toBe(false);
    expect(getUnitAt(moveAfterPrepare.state.core, unit.position)?.boosts).toBe(1);
  });

  it('[inspire] 凯鲁尊者移动后应强制充能每个相邻友方单位', () => {
    core.phase = 'move';
    core.currentPlayer = '0' as PlayerId;
    const kairu = mkUnit('kairu', { abilities: ['inspire'], unitClass: 'champion', faction: 'barbaric' });
    const from = { row: 4, col: 3 };
    const to = { row: 4, col: 4 };
    const allyUp = putUnit(core, { row: 3, col: 4 }, mkUnit('ally-up', { faction: 'barbaric' }), '0', { boosts: 0 });
    const allyDown = putUnit(core, { row: 5, col: 4 }, mkUnit('ally-down', { faction: 'barbaric' }), '0', { boosts: 2 });
    const enemyRight = putUnit(core, { row: 4, col: 5 }, mkUnit('enemy-right', { faction: 'necromancer' }), '1', { boosts: 0 });
    const nonAdjacent = putUnit(core, { row: 6, col: 4 }, mkUnit('far-ally', { faction: 'barbaric' }), '0', { boosts: 0 });

    putUnit(core, from, kairu, '0');

    const events = exec(core, SW_COMMANDS.MOVE_UNIT, { from, to });
    const inspireEvents = events.filter(e => e.type === SW_EVENTS.UNIT_CHARGED && e.payload?.sourceAbilityId === 'inspire');
    expect(inspireEvents).toHaveLength(2);
    expect(inspireEvents.map(e => e.payload?.position)).toEqual(
      expect.arrayContaining([
        { row: allyUp.position.row, col: allyUp.position.col },
        { row: allyDown.position.row, col: allyDown.position.col },
      ]),
    );
    expect(inspireEvents.map(e => e.payload?.position)).not.toEqual(
      expect.arrayContaining([
        { row: enemyRight.position.row, col: enemyRight.position.col },
        { row: nonAdjacent.position.row, col: nonAdjacent.position.col },
      ]),
    );

    for (const event of events) {
      core = SummonerWarsDomain.reduce(core, event);
    }

    expect(getUnitAt(core, allyUp.position)?.boosts).toBe(1);
    expect(getUnitAt(core, allyDown.position)?.boosts).toBe(3);
    expect(getUnitAt(core, enemyRight.position)?.boosts).toBe(0);
    expect(getUnitAt(core, nonAdjacent.position)?.boosts).toBe(0);
  });

  it('[inspire] 完整管线中应只充能移动后相邻友方且不作用自身', () => {
    core.phase = 'move';
    core.currentPlayer = '0' as PlayerId;
    const kairu = mkUnit('kairu', { abilities: ['inspire'], unitClass: 'champion', faction: 'barbaric' });
    const from = { row: 4, col: 3 };
    const to = { row: 4, col: 4 };
    const source = putUnit(core, from, kairu, '0', { boosts: 0 });
    const allyUp = putUnit(core, { row: 3, col: 4 }, mkUnit('ally-up', { faction: 'barbaric' }), '0', { boosts: 0 });
    const allyDown = putUnit(core, { row: 5, col: 4 }, mkUnit('ally-down', { faction: 'barbaric' }), '0', { boosts: 1 });
    const enemyRight = putUnit(core, { row: 4, col: 5 }, mkUnit('enemy-right', { faction: 'necromancer' }), '1', { boosts: 0 });
    const oldAdjacentOnly = putUnit(core, { row: 4, col: 2 }, mkUnit('old-adjacent', { faction: 'barbaric' }), '0', { boosts: 0 });

    let state: MatchState<SummonerWarsCore> = {
      core,
      sys: createInitialSystemState(['0', '1'], engineConfig.systems as any),
    };

    const moved = runGamePipeline(state, {
      type: SW_COMMANDS.MOVE_UNIT,
      playerId: '0',
      payload: { from, to, path: [from, to] },
    });
    expect(moved.success).toBe(true);
    state = moved.state;

    expect(state.sys.interaction.current).toBeUndefined();
    expect(state.sys.interaction.queue).toHaveLength(0);
    expect(getUnitAt(state.core, to)?.instanceId).toBe(source.instanceId);
    expect(getUnitAt(state.core, to)?.boosts).toBe(0);
    expect(getUnitAt(state.core, allyUp.position)?.boosts).toBe(1);
    expect(getUnitAt(state.core, allyDown.position)?.boosts).toBe(2);
    expect(getUnitAt(state.core, enemyRight.position)?.boosts).toBe(0);
    expect(getUnitAt(state.core, oldAdjacentOnly.position)?.boosts).toBe(0);
    expect(moved.events.filter(e =>
      e.type === SW_EVENTS.UNIT_CHARGED
      && e.payload?.sourceAbilityId === 'inspire'
    )).toHaveLength(2);
  });

  it('[spirit_bond] 移动后真实入口应结算转移路径且重复响应不二次转移', () => {
    core.phase = 'move';
    core.currentPlayer = '0' as PlayerId;
    const from = { row: 4, col: 3 };
    const to = { row: 4, col: 4 };
    const targetPos = { row: 4, col: 5 };
    const shaman = putUnit(core, from, mkUnit('spirit-shaman', {
      abilities: ['spirit_bond'],
      faction: 'barbaric',
      unitClass: 'common',
    }), '0', { boosts: 1 });
    const ally = putUnit(core, targetPos, mkUnit('spirit-ally', {
      faction: 'barbaric',
      unitClass: 'common',
    }), '0', { boosts: 0 });

    let state: MatchState<SummonerWarsCore> = {
      core,
      sys: createInitialSystemState(['0', '1'], engineConfig.systems as any),
    };

    const moved = runGamePipeline(state, {
      type: SW_COMMANDS.MOVE_UNIT,
      playerId: '0',
      payload: { from, to, path: [from, to] },
    });
    expect(moved.success).toBe(true);
    state = moved.state;
    expect(getSwCurrentType(state)).toBe('after_move_spirit_bond');

    const current = state.sys.interaction.current;
    expect(current?.kind).toBe('simple-choice');
    const options = ((current?.data as { options?: PromptOption[] } | undefined)?.options ?? []) as PromptOption[];
    expect(options.some((option) => option.id === 'skip')).toBe(false);
    const transferOptionId = options.find((option) => {
      const value = option.value as { action?: string; choice?: string; targetPosition?: CellCoord } | undefined;
      return value?.action === 'after_move_spirit_bond'
        && value.choice === 'transfer'
        && value.targetPosition?.row === targetPos.row
        && value.targetPosition?.col === targetPos.col;
    })?.id;
    expect(transferOptionId).toBeTruthy();

    const picked = runPipeline(state, {
      type: INTERACTION_COMMANDS.RESPOND,
      playerId: '0',
      payload: { interactionId: current!.id, optionId: transferOptionId },
    });
    expect(picked.success).toBe(true);
    state = picked.state;

    expect(state.sys.interaction.current).toBeUndefined();
    expect(state.sys.interaction.queue).toHaveLength(0);
    expect(getUnitAt(state.core, to)?.instanceId).toBe(shaman.instanceId);
    expect(getUnitAt(state.core, to)?.boosts).toBe(0);
    expect(getUnitAt(state.core, ally.position)?.boosts).toBe(1);
    expect(picked.events.filter(e =>
      e.type === SW_EVENTS.UNIT_CHARGED
      && e.payload?.sourceAbilityId === 'spirit_bond'
    )).toHaveLength(2);

    const duplicateResponse = runPipeline(state, {
      type: INTERACTION_COMMANDS.RESPOND,
      playerId: '0',
      payload: { interactionId: current!.id, optionId: transferOptionId },
    });
    expect(duplicateResponse.success).toBe(false);
    expect(getUnitAt(duplicateResponse.state.core, to)?.boosts).toBe(0);
    expect(getUnitAt(duplicateResponse.state.core, ally.position)?.boosts).toBe(1);
  });

  it('[grab] 友方从相邻处移动后应生成跟随选择且重复响应不二次移动', () => {
    core.phase = 'move';
    core.currentPlayer = '0' as PlayerId;
    const grabberPos = { row: 4, col: 2 };
    const moverFrom = { row: 4, col: 3 };
    const moverTo = { row: 3, col: 3 };
    const followTo = { row: 3, col: 2 };
    const grabber = putUnit(core, grabberPos, mkUnit('goblin-grabber', {
      abilities: ['grab'],
      faction: 'goblin',
      unitClass: 'common',
    }), '0');
    const mover = putUnit(core, moverFrom, mkUnit('goblin-mover', {
      faction: 'goblin',
      unitClass: 'common',
    }), '0');
    putUnit(core, { row: 2, col: 3 }, mkUnit('block-up', { faction: 'goblin' }), '0');
    putUnit(core, { row: 3, col: 4 }, mkUnit('block-right', { faction: 'goblin' }), '0');

    let state: MatchState<SummonerWarsCore> = {
      core,
      sys: createInitialSystemState(['0', '1'], engineConfig.systems as any),
    };

    const moved = runGamePipeline(state, {
      type: SW_COMMANDS.MOVE_UNIT,
      playerId: '0',
      payload: { from: moverFrom, to: moverTo, path: [moverFrom, moverTo] },
    });
    expect(moved.success).toBe(true);
    state = moved.state;

    expect(getUnitAt(state.core, moverTo)?.instanceId).toBe(mover.instanceId);
    expect(getUnitAt(state.core, grabberPos)?.instanceId).toBe(grabber.instanceId);
    expect(getSwCurrentType(state)).toBe('grab_follow');

    const current = state.sys.interaction.current;
    expect(current?.kind).toBe('simple-choice');
    const options = ((current?.data as { options?: PromptOption[] } | undefined)?.options ?? []) as PromptOption[];
    const followOptionId = options.find((option) => {
      const value = option.value as { action?: string; targetPosition?: CellCoord } | undefined;
      return value?.action === 'grab_follow'
        && value.targetPosition?.row === followTo.row
        && value.targetPosition?.col === followTo.col;
    })?.id;
    expect(followOptionId).toBeTruthy();
    expect(options.some((option) => option.id === 'skip')).toBe(true);

    const picked = runPipeline(state, {
      type: INTERACTION_COMMANDS.RESPOND,
      playerId: '0',
      payload: { interactionId: current!.id, optionId: followOptionId },
    });
    expect(picked.success).toBe(true);
    state = picked.state;

    expect(state.sys.interaction.current).toBeUndefined();
    expect(state.sys.interaction.queue).toHaveLength(0);
    expect(getUnitAt(state.core, followTo)?.instanceId).toBe(grabber.instanceId);
    expect(getUnitAt(state.core, grabberPos)).toBeUndefined();
    expect(picked.events.filter(e =>
      e.type === SW_EVENTS.UNIT_MOVED
      && e.payload?.unitId === grabber.instanceId
      && e.payload?.reason === 'grab'
    )).toHaveLength(1);

    const duplicateResponse = runPipeline(state, {
      type: INTERACTION_COMMANDS.RESPOND,
      playerId: '0',
      payload: { interactionId: current!.id, optionId: followOptionId },
    });
    expect(duplicateResponse.success).toBe(false);
    expect(getUnitAt(duplicateResponse.state.core, followTo)?.instanceId).toBe(grabber.instanceId);
    expect(getUnitAt(duplicateResponse.state.core, grabberPos)).toBeUndefined();
  });

  it('[grab] 两个抓附手应逐个结算，跳过第一个不应跳过第二个，抓附跟随不消耗移动', () => {
    core.phase = 'move';
    core.currentPlayer = '0' as PlayerId;
    core.players['0'].moveCount = 0;
    const firstGrabberPos = { row: 4, col: 2 };
    const secondGrabberPos = { row: 4, col: 4 };
    const moverFrom = { row: 4, col: 3 };
    const moverTo = { row: 3, col: 3 };
    const secondFollowTo = { row: 3, col: 4 };
    const firstGrabber = putUnit(core, firstGrabberPos, mkUnit('goblin-grabber-a', {
      name: '左侧抓附手',
      abilities: ['grab'],
      faction: 'goblin',
      unitClass: 'common',
    }), '0');
    const secondGrabber = putUnit(core, secondGrabberPos, mkUnit('goblin-grabber-b', {
      name: '右侧抓附手',
      abilities: ['grab'],
      faction: 'goblin',
      unitClass: 'common',
    }), '0');
    const mover = putUnit(core, moverFrom, mkUnit('goblin-mover', {
      faction: 'goblin',
      unitClass: 'common',
    }), '0');
    putUnit(core, { row: 2, col: 3 }, mkUnit('block-up', { faction: 'goblin' }), '0');
    putUnit(core, { row: 3, col: 2 }, mkUnit('block-left', { faction: 'goblin' }), '0');

    let state: MatchState<SummonerWarsCore> = {
      core,
      sys: createInitialSystemState(['0', '1'], engineConfig.systems as any),
    };

    const moved = runGamePipeline(state, {
      type: SW_COMMANDS.MOVE_UNIT,
      playerId: '0',
      payload: { from: moverFrom, to: moverTo, path: [moverFrom, moverTo] },
    });
    expect(moved.success).toBe(true);
    state = moved.state;

    expect(getUnitAt(state.core, moverTo)?.instanceId).toBe(mover.instanceId);
    expect(state.core.players['0'].moveCount).toBe(1);
    expect(getSwCurrentType(state)).toBe('grab_follow');
    expect(state.sys.interaction.queue).toHaveLength(1);

    let current = state.sys.interaction.current;
    expect(current?.id).toContain(firstGrabber.instanceId);
    const firstData = current?.data as {
      titleKey?: string;
      titleParams?: { unit?: string; position?: string };
    } | undefined;
    expect(firstData?.titleKey).toBe('interaction.sw.grabFollowWithSource');
    expect(firstData?.titleParams).toMatchObject({ unit: '左侧抓附手', position: '5,3' });
    expect(getUnitAt(state.core, firstGrabberPos)?.hasMoved).toBe(false);
    expect(getUnitAt(state.core, secondGrabberPos)?.hasMoved).toBe(false);

    const skipFirst = runPipeline(state, {
      type: INTERACTION_COMMANDS.RESPOND,
      playerId: '0',
      payload: { interactionId: current!.id, optionId: 'skip' },
    });
    expect(skipFirst.success).toBe(true);
    state = skipFirst.state;

    expect(getUnitAt(state.core, firstGrabberPos)?.instanceId).toBe(firstGrabber.instanceId);
    expect(getUnitAt(state.core, firstGrabberPos)?.hasMoved).toBe(false);
    expect(state.core.players['0'].moveCount).toBe(1);
    expect(getSwCurrentType(state)).toBe('grab_follow');
    expect(state.sys.interaction.queue).toHaveLength(0);
    current = state.sys.interaction.current;
    expect(current?.id).toContain(secondGrabber.instanceId);
    const secondData = current?.data as {
      titleKey?: string;
      titleParams?: { unit?: string; position?: string };
      options?: PromptOption[];
    } | undefined;
    expect(secondData?.titleKey).toBe('interaction.sw.grabFollowWithSource');
    expect(secondData?.titleParams).toMatchObject({ unit: '右侧抓附手', position: '5,5' });

    const followOptionId = secondData?.options?.find((option) => {
      const value = option.value as { action?: string; targetPosition?: CellCoord } | undefined;
      return value?.action === 'grab_follow'
        && value.targetPosition?.row === secondFollowTo.row
        && value.targetPosition?.col === secondFollowTo.col;
    })?.id;
    expect(followOptionId).toBeTruthy();

    const pickedSecond = runPipeline(state, {
      type: INTERACTION_COMMANDS.RESPOND,
      playerId: '0',
      payload: { interactionId: current!.id, optionId: followOptionId },
    });
    expect(pickedSecond.success).toBe(true);
    state = pickedSecond.state;

    expect(state.sys.interaction.current).toBeUndefined();
    expect(state.sys.interaction.queue).toHaveLength(0);
    expect(getUnitAt(state.core, secondFollowTo)?.instanceId).toBe(secondGrabber.instanceId);
    expect(getUnitAt(state.core, secondFollowTo)?.hasMoved).toBe(false);
    expect(getUnitAt(state.core, secondGrabberPos)).toBeUndefined();
    expect(state.core.players['0'].moveCount).toBe(1);
    expect(pickedSecond.events.filter(e =>
      e.type === SW_EVENTS.UNIT_MOVED
      && e.payload?.unitId === secondGrabber.instanceId
      && e.payload?.reason === 'grab'
    )).toHaveLength(1);
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

  it('[annihilate] 完整交互链最终应产生 EVENT_PLAYED，并写入打出事件日志', () => {
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
      sys: createInitialSystemState(['0', '1'], engineConfig.systems as any, undefined),
    };

    const requested = runGamePipeline(state, {
      type: SW_COMMANDS.REQUEST_EVENT_INTERACTION,
      playerId: '0',
      payload: { cardId: CARD_IDS.NECRO_ANNIHILATE },
    });
    expect(requested.success).toBe(true);
    state = requested.state;
    expect(getSwCurrentType(state)).toBe('annihilate_select_targets');

    const pickTargets = runGamePipeline(state, {
      type: INTERACTION_COMMANDS.RESPOND,
      playerId: '0',
      payload: {
        interactionId: state.sys.interaction.current!.id,
        optionIds: ['pos:4,1', 'pos:4,3'],
      },
    });
    expect(pickTargets.success).toBe(true);
    state = pickTargets.state;
    expect(getSwCurrentType(state)).toBe('annihilate_select_damage');

    const firstDamage = runGamePipeline(state, {
      type: INTERACTION_COMMANDS.RESPOND,
      playerId: '0',
      payload: {
        interactionId: state.sys.interaction.current!.id,
        optionId: 'pos:4,2',
      },
    });
    expect(firstDamage.success).toBe(true);
    state = firstDamage.state;
    expect(getSwCurrentType(state)).toBe('annihilate_select_damage');

    const secondDamage = runGamePipeline(state, {
      type: INTERACTION_COMMANDS.RESPOND,
      playerId: '0',
      payload: {
        interactionId: state.sys.interaction.current!.id,
        optionId: 'pos:3,3',
      },
    });
    expect(secondDamage.success).toBe(true);

    const finalState = secondDamage.state;
    const eventPlayedEvents = secondDamage.events.filter((event) => event.type === SW_EVENTS.EVENT_PLAYED);
    const actionLogEntries = finalState.sys.actionLog?.entries ?? [];
    const playEventEntries = actionLogEntries.filter((entry) =>
      entry.kind === SW_EVENTS.EVENT_PLAYED
      && entry.segments.some((segment) => segment.type === 'i18n' && (segment as { key?: string }).key === 'actionLog.playEvent')
    );

    expect(finalState.sys.interaction.current).toBeUndefined();
    expect(eventPlayedEvents).toHaveLength(1);
    expect(finalState.core.players['0'].discard.some((card) => card.id === CARD_IDS.NECRO_ANNIHILATE)).toBe(true);
    expect(playEventEntries).toHaveLength(1);
  });
});
