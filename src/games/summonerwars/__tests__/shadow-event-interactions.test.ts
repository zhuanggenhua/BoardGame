import { describe, expect, it } from 'vitest';
import type { MatchState, RandomFn } from '../../../engine/types';
import { executePipeline } from '../../../engine/pipeline';
import { createInteractionSystem, INTERACTION_COMMANDS } from '../../../engine/systems/InteractionSystem';
import { createSimpleChoiceSystem as createSimpleChoiceStateSystem } from '../../../engine/systems/SimpleChoiceSystem';
import { SW_COMMANDS, SW_EVENTS } from '../domain/types';
import type { BoardUnit, CellCoord, SummonerWarsCore, UnitCard } from '../domain/types';
import { SummonerWarsDomain } from '../domain';
import { createSummonerWarsInteractionSystem } from '../domain/systems';
import { getSummoner } from '../domain/helpers';
import { EVENT_CARDS_SHADOW } from '../config/factions/shadow';
import {
  createInitializedCore,
  createPromptResponseCommand,
  getPromptOptionIds,
  getPromptSwType,
  placeTestUnit,
} from './test-helpers';
import { createInitialSystemState } from '../../../engine/pipeline';

const random: RandomFn = {
  shuffle: <T>(items: T[]) => items,
  random: () => 0.5,
  d: (max: number) => Math.ceil(max / 2),
  range: (min: number) => min,
};

const systems = [
  createInteractionSystem<SummonerWarsCore>(),
  createSimpleChoiceStateSystem<SummonerWarsCore>(),
  createSummonerWarsInteractionSystem(),
];

function makeState(targetPosition: { row: number; col: number }, targetOwner: '0' | '1' = '1'): {
  state: MatchState<SummonerWarsCore>;
  summoner: BoardUnit;
  target: BoardUnit;
  judgmentSource: BoardUnit;
} {
  const core = createInitializedCore(['0', '1'], random, { faction0: 'shadow', faction1: 'necromancer' });
  core.phase = 'attack';
  core.currentPlayer = '0';
  const lightningStep = { ...EVENT_CARDS_SHADOW[2], id: 'shadow-lightning-step-0-99' };
  core.players['0'].hand.push(lightningStep);

  const summoner = getSummoner(core, '0');
  if (!summoner) throw new Error('测试夹具缺少暗影精灵召唤师');

  const target = placeTestUnit(core, targetPosition, {
    card: {
      id: 'shadow-lightning-target',
      cardType: 'unit',
      name: '离场目标',
      unitClass: 'common',
      faction: 'necromancer',
      strength: 1,
      life: 1,
      cost: 0,
      attackType: 'melee',
      attackRange: 1,
      deckSymbols: [],
    },
    owner: targetOwner,
  });
  const judgmentSource = placeTestUnit(core, { row: targetPosition.row, col: targetPosition.col + 1 }, {
    card: {
      id: 'shadow-judgment-source',
      cardType: 'unit',
      name: '审判来源',
      unitClass: 'champion',
      faction: 'shadow',
      strength: 3,
      life: 7,
      cost: 5,
      attackType: 'melee',
      attackRange: 1,
      abilities: ['shadow_judgment'],
      deckSymbols: [],
    } satisfies UnitCard,
    owner: '0',
    boosts: 1,
  });

  const state: MatchState<SummonerWarsCore> = {
    core,
    sys: createInitialSystemState(['0', '1'], systems),
  };
  return { state, summoner, target, judgmentSource };
}

function run(
  state: MatchState<SummonerWarsCore>,
  command: { type: string; playerId: '0' | '1'; payload: Record<string, unknown> },
) {
  return executePipeline(
    { domain: SummonerWarsDomain, systems },
    state,
    command,
    random,
    ['0', '1'],
  );
}

function cancelPrompt(state: MatchState<SummonerWarsCore>, playerId: '0' | '1' = '0') {
  const interactionId = state.sys.interaction.current?.id;
  if (!interactionId) throw new Error('测试夹具缺少待取消交互');
  return run(state, {
    type: INTERACTION_COMMANDS.CANCEL,
    playerId,
    payload: { interactionId },
  });
}

function playLightningStep(state: MatchState<SummonerWarsCore>) {
  return run(state, {
    type: SW_COMMANDS.PLAY_EVENT,
    playerId: '0',
    payload: { cardId: 'shadow-lightning-step-0-99' },
  });
}

function triggerUnitLeaving(
  state: MatchState<SummonerWarsCore>,
  sourceUnitId: string,
  targetPosition: { row: number; col: number },
) {
  return run(state, {
    type: SW_COMMANDS.ACTIVATE_ABILITY,
    playerId: '0',
    payload: {
      abilityId: 'shadow_judgment',
      sourceUnitId,
      targetPosition,
      amount: 1,
    },
  });
}

function shadowAbilityCard(
  id: string,
  abilities: string[],
  overrides: Partial<UnitCard> = {},
): UnitCard {
  return {
    id,
    cardType: 'unit',
    name: id,
    unitClass: 'common',
    faction: 'shadow',
    strength: 2,
    life: 5,
    cost: 1,
    attackType: 'melee',
    attackRange: 1,
    abilities,
    deckSymbols: [],
    ...overrides,
  };
}

function makeMoveAbilityState(
  card: UnitCard,
  sourcePosition: CellCoord = { row: 4, col: 2 },
): { state: MatchState<SummonerWarsCore>; source: BoardUnit } {
  const core = createInitializedCore(['0', '1'], random, { faction0: 'shadow', faction1: 'necromancer' });
  core.phase = 'move';
  core.currentPlayer = '0';
  const source = placeTestUnit(core, sourcePosition, { card, owner: '0' });
  return {
    state: {
      core,
      sys: createInitialSystemState(['0', '1'], systems),
    },
    source,
  };
}

describe('暗影精灵事件卡：迅如闪电', () => {
  it('真实管线中打出持续事件后，单位离场会产生可选替换交互并完成召唤师替换', () => {
    const fixture = makeState({ row: 7, col: 0 });
    const played = playLightningStep(fixture.state);
    expect(played.success).toBe(true);
    expect(played.state.core.players['0'].activeEvents.some((card) => card.id === 'shadow-lightning-step-0-99')).toBe(true);

    const destroyed = triggerUnitLeaving(played.state, fixture.judgmentSource.instanceId, fixture.target.position);
    expect(destroyed.success).toBe(true);
    expect(getPromptSwType(destroyed.state)).toBe('shadow_lightning_step');
    expect(destroyed.state.sys.interaction.current).toBeDefined();

    const resolved = run(
      destroyed.state,
      createPromptResponseCommand(destroyed.state, '0', 'replace'),
    );
    expect(resolved.success).toBe(true);
    expect(resolved.events).toContainEqual(expect.objectContaining({
      type: SW_EVENTS.UNIT_MOVED,
      payload: expect.objectContaining({
        unitId: fixture.summoner.instanceId,
        to: fixture.target.position,
        reason: 'shadow_lightning_step',
      }),
    }));
    expect(resolved.state.core.board[fixture.target.position.row][fixture.target.position.col].unit?.instanceId)
      .toBe(fixture.summoner.instanceId);
    expect(resolved.state.core.board[fixture.summoner.position.row][fixture.summoner.position.col].unit).toBeUndefined();
    expect(resolved.state.core.players['0'].moveCount).toBe(0);
    expect(resolved.state.core.players['0'].activeEvents.some((card) => card.id === 'shadow-lightning-step-0-99')).toBe(true);
  });

  it('玩家选择跳过时不移动召唤师，持续事件仍保留', () => {
    const fixture = makeState({ row: 7, col: 0 });
    const played = playLightningStep(fixture.state);
    const destroyed = triggerUnitLeaving(played.state, fixture.judgmentSource.instanceId, fixture.target.position);
    expect(getPromptSwType(destroyed.state)).toBe('shadow_lightning_step');

    const skipped = run(
      destroyed.state,
      createPromptResponseCommand(destroyed.state, '0', 'skip'),
    );
    expect(skipped.success).toBe(true);
    expect(skipped.state.core.board[fixture.summoner.position.row][fixture.summoner.position.col].unit?.instanceId)
      .toBe(fixture.summoner.instanceId);
    expect(skipped.state.core.players['0'].activeEvents.some((card) => card.id === 'shadow-lightning-step-0-99')).toBe(true);
  });

  it('单位返回手牌同样会触发迅闪步提示', () => {
    const fixture = makeState({ row: 7, col: 0 }, '0');
    fixture.summoner.boosts = 2;
    const played = playLightningStep(fixture.state);
    const returned = run(played.state, {
      type: SW_COMMANDS.ACTIVATE_ABILITY,
      playerId: '0',
      payload: {
        abilityId: 'shadow_return_to_shadow',
        sourceUnitId: fixture.summoner.instanceId,
        targetPosition: fixture.target.position,
      },
    });

    expect(returned.success).toBe(true);
    expect(returned.events).toContainEqual(expect.objectContaining({ type: SW_EVENTS.UNIT_RETURNED_TO_HAND }));
    expect(getPromptSwType(returned.state)).toBe('shadow_lightning_step');
  });

  it('超过召唤师 3 格的单位离场不会打开迅闪步交互', () => {
    const fixture = makeState({ row: 3, col: 0 });
    const played = playLightningStep(fixture.state);
    const destroyed = triggerUnitLeaving(played.state, fixture.judgmentSource.instanceId, fixture.target.position);
    expect(destroyed.success).toBe(true);
    expect(destroyed.state.sys.interaction.current).toBeUndefined();
  });
});

describe('暗影精灵能力：移动后与主动交互', () => {
  it('审判在移动后创建充能伤害选择，并按选择消耗充能', () => {
    const fixture = makeMoveAbilityState(shadowAbilityCard(
      'shadow-judgment-source',
      ['shadow_judgment'],
      { unitClass: 'champion', strength: 3, life: 7 },
    ));
    fixture.source.boosts = 2;
    const target = placeTestUnit(fixture.state.core, { row: 4, col: 4 }, {
      card: shadowAbilityCard('shadow-judgment-target', [], { faction: 'necromancer' }),
      owner: '1',
    });

    const moved = run(fixture.state, {
      type: SW_COMMANDS.MOVE_UNIT,
      playerId: '0',
      payload: { from: fixture.source.position, to: { row: 4, col: 3 } },
    });
    expect(moved.success).toBe(true);
    expect(getPromptSwType(moved.state)).toBe('shadow_judgment_select_target');
    expect(getPromptOptionIds(moved.state)).toContain(`target:${target.instanceId}`);
    expect(getPromptOptionIds(moved.state)).not.toContain('skip');

    const selectedTarget = run(
      moved.state,
      createPromptResponseCommand(moved.state, '0', `target:${target.instanceId}`),
    );
    expect(selectedTarget.success).toBe(true);
    expect(getPromptSwType(selectedTarget.state)).toBe('shadow_judgment_select_amount');
    expect(getPromptOptionIds(selectedTarget.state)).toEqual(['amount:1', 'amount:2']);

    const resolved = run(
      selectedTarget.state,
      createPromptResponseCommand(selectedTarget.state, '0', 'amount:2'),
    );
    expect(resolved.success).toBe(true);
    expect(resolved.state.core.board[4][4].unit?.damage).toBe(2);
    expect(resolved.state.core.board[4][3].unit?.boosts).toBe(0);
  });

  it('撕裂帷幕移动后可把友方士兵传送到受伤敌方传送门旁，并受每回合一次限制', () => {
    const fixture = makeMoveAbilityState(shadowAbilityCard(
      'shadow-veil-source',
      ['shadow_tear_the_veil'],
      { unitClass: 'champion', strength: 3, life: 7 },
    ));
    const friendlySoldier = placeTestUnit(fixture.state.core, { row: 4, col: 1 }, {
      card: shadowAbilityCard('shadow-veil-soldier', []),
      owner: '0',
    });
    fixture.state.core.board[4][4].structure = {
      cardType: 'structure',
      card: {
        id: 'shadow-wounded-gate', cardType: 'structure', name: '受伤传送门', faction: 'necromancer',
        cost: 0, life: 5, isGate: true, deckSymbols: [],
      },
      owner: '1',
      position: { row: 4, col: 4 },
      damage: 1,
    };

    const moved = run(fixture.state, {
      type: SW_COMMANDS.MOVE_UNIT,
      playerId: '0',
      payload: { from: fixture.source.position, to: { row: 4, col: 3 } },
    });
    const targetUnitOptionId = `unit:${friendlySoldier.instanceId}`;
    expect(getPromptSwType(moved.state)).toBe('shadow_tear_the_veil_select_unit');
    expect(getPromptOptionIds(moved.state)).toContain(targetUnitOptionId);
    expect(getPromptOptionIds(moved.state)).not.toContain('skip');

    const skipped = cancelPrompt(moved.state);
    expect(skipped.success).toBe(true);
    expect(skipped.state.core.board[4][1].unit?.instanceId).toBe(friendlySoldier.instanceId);
    expect(skipped.state.core.board[3][4].unit).toBeUndefined();

    const selectedUnit = run(
      moved.state,
      createPromptResponseCommand(moved.state, '0', targetUnitOptionId),
    );
    expect(selectedUnit.success).toBe(true);
    expect(getPromptSwType(selectedUnit.state)).toBe('shadow_tear_the_veil_select_gate');
    expect(getPromptOptionIds(selectedUnit.state)).toEqual(['gate:4,4']);
    const selectedGate = run(
      selectedUnit.state,
      createPromptResponseCommand(selectedUnit.state, '0', 'gate:4,4'),
    );
    expect(selectedGate.success).toBe(true);
    expect(getPromptSwType(selectedGate.state)).toBe('shadow_tear_the_veil_select_position');
    expect(getPromptOptionIds(selectedGate.state)).toContain('pos:3,4');
    expect(getPromptOptionIds(selectedGate.state)).not.toContain('skip');
    const resolved = run(
      selectedGate.state,
      createPromptResponseCommand(selectedGate.state, '0', 'pos:3,4'),
    );
    expect(resolved.success).toBe(true);
    expect(resolved.state.core.board[4][1].unit).toBeUndefined();
    expect(resolved.state.core.board[3][4].unit?.instanceId).toBe(friendlySoldier.instanceId);

    const sourceAfterMove = resolved.state.core.board[4][3].unit!;
    const blocked = run(resolved.state, {
      type: SW_COMMANDS.ACTIVATE_ABILITY,
      playerId: '0',
      payload: { abilityId: 'shadow_tear_the_veil', sourceUnitId: sourceAfterMove.instanceId },
    });
    expect(blocked.success).toBe(true);
    expect(blocked.events.some((event) => event.type === SW_EVENTS.UNIT_MOVED)).toBe(false);
    expect(blocked.state.sys.interaction.current).toBeUndefined();
  });

  it('佯攻在攻击后创建推拉选择，跳过不移动来源单位', () => {
    const core = createInitializedCore(['0', '1'], random, { faction0: 'shadow', faction1: 'necromancer' });
    core.phase = 'attack';
    core.currentPlayer = '0';
    const source = placeTestUnit(core, { row: 4, col: 2 }, {
      card: shadowAbilityCard('shadow-feint-source', ['shadow_feint'], { strength: 2 }),
      owner: '0',
    });
    placeTestUnit(core, { row: 4, col: 3 }, {
      card: shadowAbilityCard('shadow-feint-target', [], { faction: 'necromancer', life: 20 }),
      owner: '1',
    });
    const state: MatchState<SummonerWarsCore> = {
      core,
      sys: createInitialSystemState(['0', '1'], systems),
    };

    const attacked = run(state, {
      type: SW_COMMANDS.DECLARE_ATTACK,
      playerId: '0',
      payload: { attacker: source.position, target: { row: 4, col: 3 } },
    });
    expect(attacked.success).toBe(true);
    expect(getPromptSwType(attacked.state)).toBe('shadow_feint_select_position');
    expect(getPromptOptionIds(attacked.state)).not.toContain('skip');

    const skipped = cancelPrompt(attacked.state);
    expect(skipped.success).toBe(true);
    expect(skipped.state.core.board[4][2].unit?.instanceId).toBe(source.instanceId);
  });

  it('暗影骑士召唤后可选择无暗影召唤技能的友方卡牌并造成1点伤害', () => {
    const core = createInitializedCore(['0', '1'], random, { faction0: 'shadow', faction1: 'necromancer' });
    core.phase = 'summon';
    core.currentPlayer = '0';
    core.board[4][2].structure = {
      cardType: 'structure',
      card: {
        id: 'shadow-summon-gate', cardType: 'structure', name: '暗影城门', faction: 'shadow',
        cost: 0, life: 10, isGate: true, deckSymbols: [],
      },
      owner: '0',
      position: { row: 4, col: 2 },
      damage: 0,
    };
    const knight = shadowAbilityCard('shadow-knight-hand', ['shadow_shadow_summon', 'shadow_death_pact']);
    core.players['0'].hand.push(knight);
    const target = placeTestUnit(core, { row: 3, col: 4 }, {
      card: shadowAbilityCard('shadow-summon-target', []),
      owner: '0',
    });
    const state: MatchState<SummonerWarsCore> = {
      core,
      sys: createInitialSystemState(['0', '1'], systems),
    };

    const summoned = run(state, {
      type: SW_COMMANDS.SUMMON_UNIT,
      playerId: '0',
      payload: { cardId: knight.id, position: { row: 4, col: 3 } },
    });
    expect(summoned.success).toBe(true);
    expect(getPromptSwType(summoned.state)).toBe('shadow_shadow_summon_select_target');
    const targetOptionId = `unit:${target.instanceId}`;
    expect(getPromptOptionIds(summoned.state)).toContain(targetOptionId);
    expect(getPromptOptionIds(summoned.state)).not.toContain('skip');

    const skipped = cancelPrompt(summoned.state);
    expect(skipped.success).toBe(true);
    expect(skipped.state.core.board[4][3].unit?.cardId).toBe(knight.id);
    expect(skipped.state.core.board[3][4].unit?.damage).toBe(0);

    const selectedTarget = run(
      summoned.state,
      createPromptResponseCommand(summoned.state, '0', targetOptionId),
    );
    expect(selectedTarget.success).toBe(true);
    expect(getPromptSwType(selectedTarget.state)).toBe('shadow_shadow_summon_select_position');
    expect(getPromptOptionIds(selectedTarget.state)).toContain('pos:4,4');
    expect(getPromptOptionIds(selectedTarget.state)).not.toContain('skip');
    const resolved = run(
      selectedTarget.state,
      createPromptResponseCommand(selectedTarget.state, '0', 'pos:4,4'),
    );
    expect(resolved.success).toBe(true);
    expect(resolved.state.core.board[4][3].unit).toBeUndefined();
    expect(resolved.state.core.board[4][4].unit?.cardId).toBe(knight.id);
    expect(resolved.state.core.board[3][4].unit?.damage).toBe(1);
  });

  it('圣贤巡游者召唤后可选择急袭位移，跳过不会移动', () => {
    const core = createInitializedCore(['0', '1'], random, { faction0: 'shadow', faction1: 'necromancer' });
    core.phase = 'summon';
    core.currentPlayer = '0';
    core.board[4][2].structure = {
      cardType: 'structure',
      card: {
        id: 'shadow-assault-gate', cardType: 'structure', name: '暗影城门', faction: 'shadow',
        cost: 0, life: 10, isGate: true, deckSymbols: [],
      },
      owner: '0',
      position: { row: 4, col: 2 },
      damage: 0,
    };
    const rover = shadowAbilityCard('shadow-rover-hand', ['shadow_sudden_assault'], { attackType: 'ranged', attackRange: 3 });
    core.players['0'].hand.push(rover);
    const state: MatchState<SummonerWarsCore> = {
      core,
      sys: createInitialSystemState(['0', '1'], systems),
    };

    const summoned = run(state, {
      type: SW_COMMANDS.SUMMON_UNIT,
      playerId: '0',
      payload: { cardId: rover.id, position: { row: 4, col: 3 } },
    });
    expect(summoned.success).toBe(true);
    expect(getPromptSwType(summoned.state)).toBe('shadow_sudden_assault_select_position');
    expect(getPromptOptionIds(summoned.state)).toContain('pos:4,4');

    const skipped = cancelPrompt(summoned.state);
    expect(skipped.success).toBe(true);
    expect(skipped.state.core.board[4][3].unit?.cardId).toBe(rover.id);
    expect(skipped.state.core.board[4][4].unit).toBeUndefined();
  });

  it('审判可以跳过，跳过不会消耗充能或伤害目标', () => {
    const fixture = makeMoveAbilityState(shadowAbilityCard(
      'shadow-judgment-skip-source',
      ['shadow_judgment'],
      { unitClass: 'champion', strength: 3, life: 7 },
    ));
    fixture.source.boosts = 2;
    placeTestUnit(fixture.state.core, { row: 4, col: 4 }, {
      card: shadowAbilityCard('shadow-judgment-skip-target', [], { faction: 'necromancer' }),
      owner: '1',
    });

    const moved = run(fixture.state, {
      type: SW_COMMANDS.MOVE_UNIT,
      playerId: '0',
      payload: { from: fixture.source.position, to: { row: 4, col: 3 } },
    });
    const skipped = cancelPrompt(moved.state);
    expect(skipped.success).toBe(true);
    expect(skipped.state.core.board[4][4].unit?.damage).toBe(0);
    expect(skipped.state.core.board[4][3].unit?.boosts).toBe(2);
  });

  it('禁忌学识移动后选择自伤并抓一张牌，跳过则不改变状态', () => {
    const fixture = makeMoveAbilityState(shadowAbilityCard('shadow-forbidden-source', ['shadow_forbidden_knowledge']));
    const handBefore = fixture.state.core.players['0'].hand.length;

    const moved = run(fixture.state, {
      type: SW_COMMANDS.MOVE_UNIT,
      playerId: '0',
      payload: { from: fixture.source.position, to: { row: 4, col: 3 } },
    });
    expect(getPromptSwType(moved.state)).toBe('shadow_forbidden_knowledge_select_target');
    expect(getPromptOptionIds(moved.state)).toEqual(['target:4,3']);

    const resolved = run(
      moved.state,
      createPromptResponseCommand(moved.state, '0', 'target:4,3'),
    );
    expect(resolved.success).toBe(true);
    expect(resolved.state.core.board[4][3].unit?.damage).toBe(1);
    expect(resolved.state.core.players['0'].hand.length).toBe(handBefore + 1);

    const skipFixture = makeMoveAbilityState(shadowAbilityCard('shadow-forbidden-skip-source', ['shadow_forbidden_knowledge']));
    const skipMoved = run(skipFixture.state, {
      type: SW_COMMANDS.MOVE_UNIT,
      playerId: '0',
      payload: { from: skipFixture.source.position, to: { row: 4, col: 3 } },
    });
    const skipped = cancelPrompt(skipMoved.state);
    expect(skipped.success).toBe(true);
    expect(skipped.state.core.board[4][3].unit?.damage).toBe(0);
    expect(skipped.state.core.players['0'].hand.length).toBe(skipFixture.state.core.players['0'].hand.length);
  });

  it('回归暗影先选择3格内友方单位，再消耗2点充能并将其返回手牌', () => {
    const core = createInitializedCore(['0', '1'], random, { faction0: 'shadow', faction1: 'necromancer' });
    core.phase = 'move';
    core.currentPlayer = '0';
    const summoner = getSummoner(core, '0');
    if (!summoner) throw new Error('测试夹具缺少暗影精灵召唤师');
    summoner.boosts = 2;
    const targetPosition = [
      { row: summoner.position.row, col: summoner.position.col + 1 },
      { row: summoner.position.row + 1, col: summoner.position.col },
      { row: summoner.position.row, col: summoner.position.col - 1 },
    ].find((position) => (
      position.row >= 0 && position.row < core.board.length
      && position.col >= 0 && position.col < core.board[position.row].length
      && !core.board[position.row][position.col].unit
      && !core.board[position.row][position.col].structure
    ));
    if (!targetPosition) throw new Error('测试夹具没有找到召回目标空格');
    const target = placeTestUnit(core, targetPosition, {
      card: shadowAbilityCard('shadow-return-target', []),
      owner: '0',
    });
    const state: MatchState<SummonerWarsCore> = {
      core,
      sys: createInitialSystemState(['0', '1'], systems),
    };

    const requested = run(state, {
      type: SW_COMMANDS.ACTIVATE_ABILITY,
      playerId: '0',
      payload: { abilityId: 'shadow_return_to_shadow', sourceUnitId: summoner.instanceId },
    });
    expect(requested.success).toBe(true);
    expect(getPromptSwType(requested.state)).toBe('activated_ability_target');
    const optionId = `pos:${targetPosition.row},${targetPosition.col}`;
    expect(getPromptOptionIds(requested.state)).toContain(optionId);

    const resolved = run(
      requested.state,
      createPromptResponseCommand(requested.state, '0', optionId),
    );
    expect(resolved.success).toBe(true);
    expect(resolved.state.core.board[targetPosition.row][targetPosition.col].unit).toBeUndefined();
    expect(resolved.state.core.board[summoner.position.row][summoner.position.col].unit?.boosts).toBe(0);
    expect(resolved.state.core.players['0'].hand.some((card) => card.id === target.cardId)).toBe(true);
  });

  it('玛尔典籍真实管线先回收合法弃牌，再连续选择两次友方伤害并完成清理', () => {
    const core = createInitializedCore(['0', '1'], random, { faction0: 'shadow', faction1: 'necromancer' });
    core.phase = 'summon';
    core.currentPlayer = '0';
    const marl = { ...EVENT_CARDS_SHADOW[1], id: 'shadow-marl-grimoire-0-99' };
    const retrieved = shadowAbilityCard('shadow-marl-retrieved-card', []);
    core.players['0'].hand.push(marl);
    core.players['0'].discard.push(
      retrieved,
      { ...EVENT_CARDS_SHADOW[0], id: 'shadow-hide-in-darkness-0-100' },
      { ...EVENT_CARDS_SHADOW[1], id: 'shadow-marl-grimoire-0-100' },
    );
    const firstTarget = placeTestUnit(core, { row: 4, col: 3 }, {
      card: shadowAbilityCard('shadow-marl-target-a', []),
      owner: '0',
    });
    const secondTarget = placeTestUnit(core, { row: 4, col: 4 }, {
      card: shadowAbilityCard('shadow-marl-target-b', []),
      owner: '0',
    });
    const state: MatchState<SummonerWarsCore> = {
      core,
      sys: createInitialSystemState(['0', '1'], systems),
    };

    const requested = run(state, {
      type: SW_COMMANDS.REQUEST_EVENT_INTERACTION,
      playerId: '0',
      payload: { cardId: marl.id },
    });
    expect(requested.success).toBe(true);
    expect(getPromptSwType(requested.state)).toBe('shadow_marl_select_card');
    expect(getPromptOptionIds(requested.state)).toContain(retrieved.id);
    expect(getPromptOptionIds(requested.state)).not.toContain('shadow-hide-in-darkness-0-100');
    expect(getPromptOptionIds(requested.state)).not.toContain('shadow-marl-grimoire-0-100');

    const pickedCard = run(
      requested.state,
      createPromptResponseCommand(requested.state, '0', retrieved.id),
    );
    expect(getPromptSwType(pickedCard.state)).toBe('shadow_marl_select_damage');
    const pickedFirst = run(
      pickedCard.state,
      createPromptResponseCommand(pickedCard.state, '0', `pos:${firstTarget.position.row},${firstTarget.position.col}`),
    );
    expect(getPromptSwType(pickedFirst.state)).toBe('shadow_marl_select_damage');
    const resolved = run(
      pickedFirst.state,
      createPromptResponseCommand(pickedFirst.state, '0', `pos:${secondTarget.position.row},${secondTarget.position.col}`),
    );
    expect(resolved.success).toBe(true);
    expect(getPromptSwType(resolved.state)).toBeUndefined();
    expect(resolved.state.core.board[4][3].unit?.damage).toBe(1);
    expect(resolved.state.core.board[4][4].unit?.damage).toBe(1);
    expect(resolved.state.core.players['0'].hand.some((card) => card.id === retrieved.id)).toBe(true);
    expect(resolved.state.core.players['0'].hand.some((card) => card.id === marl.id)).toBe(false);
    expect(resolved.state.core.players['0'].discard.some((card) => card.id === marl.id)).toBe(true);
  });

  it('暗影脉冲真实管线允许多选与受伤传送门相邻的单位，并排除安全单位', () => {
    const core = createInitializedCore(['0', '1'], random, { faction0: 'shadow', faction1: 'necromancer' });
    core.phase = 'attack';
    core.currentPlayer = '0';
    const pulse = { ...EVENT_CARDS_SHADOW[3], id: 'shadow-shadow-pulse-0-99' };
    core.players['0'].hand.push(pulse);
    core.board[4][4].structure = {
      cardType: 'structure',
      card: {
        id: 'pulse-wounded-gate', cardType: 'structure', name: '受伤传送门', faction: 'necromancer',
        cost: 0, life: 5, isGate: true, deckSymbols: [],
      },
      owner: '1',
      position: { row: 4, col: 4 },
      damage: 1,
    };
    const firstTarget = placeTestUnit(core, { row: 4, col: 3 }, {
      card: shadowAbilityCard('shadow-pulse-target-a', [], { faction: 'necromancer' }),
      owner: '1',
    });
    const secondTarget = placeTestUnit(core, { row: 3, col: 4 }, {
      card: shadowAbilityCard('shadow-pulse-target-b', [], { faction: 'shadow' }),
      owner: '0',
    });
    const safeTarget = placeTestUnit(core, { row: 1, col: 1 }, {
      card: shadowAbilityCard('shadow-pulse-safe-target', [], { faction: 'necromancer' }),
      owner: '1',
    });
    const state: MatchState<SummonerWarsCore> = {
      core,
      sys: createInitialSystemState(['0', '1'], systems),
    };

    const requested = run(state, {
      type: SW_COMMANDS.REQUEST_EVENT_INTERACTION,
      playerId: '0',
      payload: { cardId: pulse.id },
    });
    expect(requested.success).toBe(true);
    expect(getPromptSwType(requested.state)).toBe('shadow_pulse_select_targets');
    expect(getPromptOptionIds(requested.state)).toContain(`pos:${firstTarget.position.row},${firstTarget.position.col}`);
    expect(getPromptOptionIds(requested.state)).toContain(`pos:${secondTarget.position.row},${secondTarget.position.col}`);
    expect(getPromptOptionIds(requested.state)).not.toContain(`pos:${safeTarget.position.row},${safeTarget.position.col}`);

    const finished = run(requested.state, {
      type: INTERACTION_COMMANDS.RESPOND,
      playerId: '0',
      payload: {
        interactionId: requested.state.sys.interaction.current!.id,
        optionId: 'finish',
      },
    });
    expect(finished.success).toBe(true);
    expect(finished.state.core.board[4][3].unit?.damage).toBe(0);
    expect(finished.state.core.board[3][4].unit?.damage).toBe(0);

    const resolved = run(requested.state, {
      type: INTERACTION_COMMANDS.RESPOND,
      playerId: '0',
      payload: {
        interactionId: requested.state.sys.interaction.current!.id,
        optionIds: [
          `pos:${firstTarget.position.row},${firstTarget.position.col}`,
          `pos:${secondTarget.position.row},${secondTarget.position.col}`,
        ],
      },
    });
    expect(resolved.success).toBe(true);
    expect(getPromptSwType(resolved.state)).toBeUndefined();
    expect(resolved.state.core.board[4][3].unit?.damage).toBe(1);
    expect(resolved.state.core.board[3][4].unit?.damage).toBe(1);
    expect(resolved.state.core.board[1][1].unit?.damage).toBe(0);
  });

  it('隐入黑暗可以从真实交互中选择距离内的敌方受伤士兵并将其返回拥有者手牌', () => {
    const core = createInitializedCore(['0', '1'], random, { faction0: 'shadow', faction1: 'necromancer' });
    core.phase = 'build';
    core.currentPlayer = '0';
    const hide = { ...EVENT_CARDS_SHADOW[0], id: 'shadow-hide-in-darkness-0-99' };
    core.players['0'].hand.push(hide);
    const hideSummoner = getSummoner(core, '0');
    if (!hideSummoner) throw new Error('测试夹具缺少暗影精灵召唤师');
    const enemyPosition = [
      { row: hideSummoner.position.row, col: hideSummoner.position.col - 1 },
      { row: hideSummoner.position.row, col: hideSummoner.position.col + 1 },
      { row: hideSummoner.position.row + 1, col: hideSummoner.position.col },
    ].find((position) => (
      position.row >= 0 && position.row < core.board.length
      && position.col >= 0 && position.col < core.board[position.row].length
      && !core.board[position.row][position.col].unit
      && !core.board[position.row][position.col].structure
    ));
    if (!enemyPosition) throw new Error('测试夹具没有找到隐入黑暗目标空位');
    const enemy = placeTestUnit(core, enemyPosition, {
      card: shadowAbilityCard('shadow-hide-enemy-soldier', [], { faction: 'necromancer', life: 4 }),
      owner: '1',
      damage: 1,
    });
    const state: MatchState<SummonerWarsCore> = {
      core,
      sys: createInitialSystemState(['0', '1'], systems),
    };

    const requested = run(state, {
      type: SW_COMMANDS.REQUEST_EVENT_INTERACTION,
      playerId: '0',
      payload: { cardId: hide.id },
    });
    expect(requested.success).toBe(true);
    expect(getPromptSwType(requested.state)).toBe('event_target');
    const optionId = `pos:${enemy.position.row},${enemy.position.col}`;
    expect(getPromptOptionIds(requested.state)).toContain(optionId);

    const resolved = run(
      requested.state,
      createPromptResponseCommand(requested.state, '0', optionId),
    );
    expect(resolved.success).toBe(true);
    expect(resolved.state.core.board[enemy.position.row][enemy.position.col].unit).toBeUndefined();
    expect(resolved.state.core.players['1'].hand.some((card) => card.id === enemy.cardId)).toBe(true);
  });
});
