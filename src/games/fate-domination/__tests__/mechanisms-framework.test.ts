import { describe, expect, it } from 'vitest';
import { createReplayAdapter } from '../../../engine/adapter';
import { createInitialSystemState, createSeededRandom, executePipeline } from '../../../engine';
import { FateDominationDomain } from '../domain';
import { engineConfig } from '../game';
import { FATE_SERVANTS } from '../data/identities';
import { addFateRuleModifier, canUseFateAbility, createFateCopyRecord, expandFateCopyRecord, resolveFatePowerValue } from '../domain/mechanics';
import { createFateCopyChoiceOpportunity, executeFateAbility, fateAbilityExecutorRegistry, fateAbilityRegistry } from '../domain/abilityRegistry';
import { FATE_BATTLE_LOCATION_ORDER } from '../domain/types';
import type { FateDominationCore } from '../domain/types';
import { resolveFateMovement } from '../domain/movement';

const adapter = createReplayAdapter(FateDominationDomain, 'fate-domination-mechanisms-framework');

const command = (type: string, playerId: string, payload: unknown) => ({ type, playerId, payload, timestamp: 1 }) as never;

function deployedCore(): FateDominationCore {
  let state = adapter.setup(['0', '1', '2']);
  state = adapter.execute(state, command('ADVANCE_PHASE', '0', {})).state;
  state = adapter.execute(state, command('DEPLOY_MASTER', '0', { locationId: 'miyama' })).state;
  state = adapter.execute(state, command('DEPLOY_MASTER', '1', { locationId: 'miyama' })).state;
  state = adapter.execute(state, command('DEPLOY_MASTER', '2', { locationId: 'shinto' })).state;
  return state.core;
}

describe('Fate mechanism framework', () => {
  it('注册表保留已锁能力，并把技能执行转换为规则事件', () => {
    expect(fateAbilityRegistry.has('sc_sasaki_2')).toBe(true);
    expect(fateAbilityExecutorRegistry.has('sc_sasaki_2')).toBe(true);
    const skill = FATE_SERVANTS.find((servant) => servant.id === 'servant-sasaki')?.skillCards?.find((item) => item.id === 'sc_sasaki_2');
    expect(skill).toBeDefined();
    const core = deployedCore();
    const result = executeFateAbility({
      sourceId: 'sc_sasaki_2:0',
      ownerId: '0',
      playerId: '0',
      timestamp: 1,
      core,
      skill: { ...skill!, id: 'sc_sasaki_2:0' },
    });
    expect(result.events.map((event) => event.type)).toEqual(['FATE_RULE_MODIFIER_ATTACHED']);
    const modifier = (result.events[0] as Extract<typeof result.events[number], { type: 'FATE_RULE_MODIFIER_ATTACHED' }>).payload.modifier;
    const blockedCore = { ...core, ruleState: addFateRuleModifier(core.ruleState, modifier) };
    expect(canUseFateAbility(blockedCore, '1', 'action').valid).toBe(false);
    expect(canUseFateAbility(blockedCore, '2', 'action').valid).toBe(true);
  });

  it('攻击属性归零只影响匹配属性，且保留来源修正', () => {
    const core = deployedCore();
    const source = { sourceId: 'sc_saber_1:0', sourceKind: 'ability' as const, ownerId: '0', controllerId: '0' };
    const withModifier = {
      ...core,
      ruleState: addFateRuleModifier(core.ruleState, {
        id: 'magic-zero',
        kind: 'power-transform',
        source,
        selector: 'attack',
        target: 'opponents-at-location',
        locationId: 'miyama',
        attackTypes: ['魔术'],
        operation: 'set',
        value: 0,
        duration: 'round-end',
      }),
    };
    expect(resolveFatePowerValue(withModifier, 5, { selector: 'attack', actorId: '1', locationId: 'miyama', attackTypes: ['魔术'] })).toMatchObject({ value: 0, appliedModifierIds: ['magic-zero'] });
    expect(resolveFatePowerValue(withModifier, 5, { selector: 'attack', actorId: '1', locationId: 'miyama', attackTypes: ['力量'] }).value).toBe(5);
  });

  it('EventCommit 重新验证移动，不能用伪造路径绕过限制', () => {
    const state = adapter.setup(['0', '1', '2']);
    const core = {
      ...state.core,
      phase: 'action' as const,
      players: { ...state.core.players, '0': { ...state.core.players['0'], locationId: 'miyama' as const } },
      battlefield: { ...state.core.battlefield, miyama: { ...state.core.battlefield.miyama, playerIds: ['0'] } },
      ruleState: addFateRuleModifier(state.core.ruleState, {
        id: 'lock-miyama',
        kind: 'location-lock',
        source: { sourceId: 'fuyuki_E16', sourceKind: 'event', ownerId: '0', controllerId: '0' },
        locationId: 'miyama',
        denyLeave: true,
      }),
    };
    const committed = FateDominationDomain.commitEvent?.({
      state: { ...state, core },
      event: { type: 'PLAYER_MOVED', payload: { playerId: '0', from: 'miyama', to: 'shinto', path: ['miyama', 'shinto'], mode: 'normal', manaSpent: 0 }, timestamp: 1 },
      timing: { id: 'test', position: 'eventCommit', factKind: 'move' },
    });
    expect(committed).toBeNull();
  });

  it('地点移动限制可以只作用于指定玩家，不会误锁整张地点', () => {
    const state = adapter.setup(['0', '1', '2']);
    const core = {
      ...state.core,
      phase: 'action' as const,
      players: {
        ...state.core.players,
        '0': { ...state.core.players['0'], locationId: 'miyama' as const },
        '1': { ...state.core.players['1'], locationId: 'miyama' as const },
      },
      battlefield: {
        ...state.core.battlefield,
        miyama: { ...state.core.battlefield.miyama, playerIds: ['1'] },
      },
      ruleState: addFateRuleModifier(state.core.ruleState, {
        id: 'enemy-lock',
        kind: 'location-lock',
        source: { sourceId: 'master-kariya:enemy', sourceKind: 'master', ownerId: '0', controllerId: '0' },
        locationId: 'miyama',
        playerIds: ['1'],
        denyLeave: true,
      }),
    };
    expect(resolveFateMovement(core, '1', 'shinto', 'normal').valid).toBe(false);
    const otherPlayerCore = {
      ...core,
      battlefield: { ...core.battlefield, miyama: { ...core.battlefield.miyama, playerIds: ['0'] } },
    };
    expect(resolveFateMovement(otherPlayerCore, '0', 'shinto', 'normal').valid).toBe(true);
  });

  it('复制记录保留 owner/controller/sourceController 并阻断循环展开', () => {
    const record = createFateCopyRecord({
      id: 'proxy-1',
      sourceCardId: 'card-source',
      proxyCardId: 'card-proxy',
      printedDefinitionId: 'Card_Origin',
      source: { sourceId: 'card-source', abilityId: 'copy' },
      copierId: 'p1',
      executorId: 'p1',
      ownerId: 'p2',
      controllerId: 'p1',
      sourceControllerId: 'p2',
    });
    expect(record.context.ownerId).toBe('p2');
    expect(record.context.controllerId).toBe('p1');
    expect(record.context.sourceControllerId).toBe('p2');
    expect(expandFateCopyRecord(record, { sourceId: 'card-next', abilityId: 'nested' }).allowed).toBe(true);
    expect(expandFateCopyRecord(record, { sourceId: 'card-source', abilityId: 'copy' }).rejection).toBe('cycle');
  });

  it('复制卡牌先建立选择合同，再以 proxy 事件落地', () => {
    const core = deployedCore();
    const skill = FATE_SERVANTS.find((servant) => servant.id === 'servant-berserker')?.skillCards?.find((item) => item.id === 'sc_lance_3');
    expect(skill).toBeDefined();
    const cardId = core.players['0'].hand[0].id;
    const opportunity = createFateCopyChoiceOpportunity({
      core,
      playerId: '0',
      skillId: 'sc_lance_3:0',
      timing: { id: 'copy-choice', position: 'before', factKind: 'action' },
      candidateCardIds: [cardId],
    });
    expect(opportunity?.resolution.type).toBe('child-frame');
    expect(opportunity?.choice?.candidates[0].commands?.[0].payload).toMatchObject({ targetCardId: cardId });

    const result = executeFateAbility({
      sourceId: 'sc_lance_3:0',
      ownerId: '0',
      playerId: '0',
      timestamp: 1,
      core,
      skill: { ...skill!, id: 'sc_lance_3:0' },
      targetCardId: cardId,
    });
    expect(result.events.map((event) => event.type)).toEqual(['FATE_COPY_PROXY_CREATED']);
  });

  it('旧快照缺少机制字段时由 domain 入口归一化', () => {
    const state = adapter.setup(['0', '1', '2']);
    const legacy = {
      ...state,
      core: {
        ...state.core,
        ruleState: undefined as never,
        players: {
          ...state.core.players,
          '0': {
            ...state.core.players['0'],
            defeatMarkers: undefined as never,
            eliminationProtectionUsed: undefined as never,
          },
        },
      },
    };
    const normalize = FateDominationDomain.normalizeRuntimeState;
    expect(normalize).toBeDefined();
    const normalized = normalize ? normalize(legacy) : legacy;
    expect(normalized.core.ruleState).toEqual({ modifiers: [], delayed: [], copies: [] });
    expect(normalized.core.players['0'].defeatMarkers).toEqual([]);
    expect(normalized.core.players['0'].eliminationProtectionUsed).toBe(false);
    const replayed = adapter.execute(legacy, command('ADVANCE_PHASE', '0', {}));
    expect(replayed.state.core.ruleState).toEqual({ modifiers: [], delayed: [], copies: [] });
  });

  it('直接败北保护在 EventCommit 被消费，不可阻止效果可穿透', () => {
    const state = deployedCore();
    const withProtection = {
      ...state,
      ruleState: addFateRuleModifier(state.ruleState, {
        id: 'lucky-protection',
        kind: 'direct-defeat-protection',
        source: { sourceId: 'sc_saber_1', sourceKind: 'ability', ownerId: '0', controllerId: '0' },
        playerId: '0',
        scope: 'battle',
        duration: 'turn-end',
      }),
    };
    const prevented = FateDominationDomain.commitEvent?.({
      state: { ...adapter.setup(['0', '1', '2']), core: withProtection },
      event: { type: 'FATE_DEFEAT_DECLARED', payload: { playerId: '0', sourceId: 'gil-np', direct: true, markerId: 'm1' }, timestamp: 1 },
      timing: { id: 'defeat', position: 'prevent', factKind: 'gameover' },
    });
    expect(prevented?.type).toBe('FATE_DEFEAT_PREVENTED');
    const forced = FateDominationDomain.commitEvent?.({
      state: { ...adapter.setup(['0', '1', '2']), core: withProtection },
      event: { type: 'FATE_DEFEAT_DECLARED', payload: { playerId: '0', sourceId: 'gil-np', direct: true, unpreventable: true, markerId: 'm2' }, timestamp: 1 },
      timing: { id: 'defeat-force', position: 'prevent', factKind: 'gameover' },
    });
    expect(forced?.type).toBe('FATE_DEFEAT_DECLARED');
    const defeated = FateDominationDomain.reduce(withProtection, forced as never);
    expect(defeated.players['0'].defeatMarkers).toHaveLength(1);
  });

  it('卫宫士郎首次回合末淘汰被替代为失去全部魔力，第二次才淘汰', () => {
    const state = deployedCore();
    const request = { type: 'FATE_ELIMINATION_REQUESTED', payload: { playerId: '0', reason: 'round-cut' as const }, timestamp: 1 } as never;
    const first = FateDominationDomain.reduce(state, request);
    expect(first.players['0'].eliminated).toBe(false);
    expect(first.players['0'].mana).toBe(0);
    expect(first.players['0'].eliminationProtectionUsed).toBe(true);
    const second = FateDominationDomain.reduce(first, request);
    expect(second.players['0'].eliminated).toBe(true);
  });

  it('战斗结算通过共享 ResolutionFrame 合同进入长事务边界', () => {
    const state = adapter.setup(['0', '1', '2']);
    const discovery = FateDominationDomain.discoverTimingOpportunities?.({
      state,
      timing: {
        id: 'battle-frame-timing',
        gameId: 'fate-domination',
        position: 'postCommit',
        factKind: 'attack',
        event: {
          type: 'FATE_BATTLE_RESOLUTION_STARTED',
          payload: { frameId: 'fate:battle:1', round: 1, locationIds: ['workshop', 'miyama', 'shinto', 'recon'] },
          timestamp: 1,
        },
      },
    });
    expect(discovery?.opportunities[0]?.resolution).toMatchObject({
      type: 'child-frame',
      frameId: 'fate:battle:1',
      frameKind: 'fate:battle-resolution',
      phaseGate: 'block-advance-when-blocked',
    });
  });

  it('真实 Fate pipeline 会创建并收束战斗 ResolutionFrame', () => {
    const core = {
      ...deployedCore(),
      phase: 'battle' as const,
      currentPlayerId: '0',
      battleResult: {
        playerId: '0',
        locationId: 'miyama' as const,
        power: 5,
        eventVictoryPoints: 1,
        competitionVictoryPoints: 2,
        totalVictoryPoints: 3,
        status: 'representative-win' as const,
      },
      pendingChoice: { kind: 'battle' as const, playerId: '0' },
    };
    const state = {
      core,
      sys: createInitialSystemState(['0', '1', '2'], engineConfig.systems, 'fate-frame-test'),
    };
    const result = executePipeline(
      { domain: FateDominationDomain, systems: engineConfig.systems },
      state,
      command('ADVANCE_PHASE', '0', {}),
      createSeededRandom('fate-frame-test'),
      ['0', '1', '2'],
    );
    expect(result.success).toBe(true);
    expect(result.events.some((event) => event.type === 'FATE_BATTLE_RESOLUTION_STARTED')).toBe(true);
    expect(result.state.sys.resolution?.activeFrameId).toBe('fate:battle:1');

    let resolvedState = result.state;
    for (const locationId of FATE_BATTLE_LOCATION_ORDER) {
      const locationResult = executePipeline(
        { domain: FateDominationDomain, systems: engineConfig.systems },
        resolvedState,
        command('RESOLVE_LOCATION', '0', { locationId }),
        createSeededRandom(`fate-frame-location-${locationId}`),
        ['0', '1', '2'],
      );
      expect(locationResult.success).toBe(true);
      resolvedState = locationResult.state;
    }
    expect(resolvedState.core.phase).toBe('preparation');
    expect(resolvedState.sys.resolution).toBeUndefined();
  });
});
