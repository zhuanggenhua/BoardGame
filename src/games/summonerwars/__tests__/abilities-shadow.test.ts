/**
 * 暗影精灵能力的 L2 合同测试；需要 InteractionSystem 参数的能力在
 * shadow-event-interactions.test.ts 中覆盖，复杂浏览器级 L3/L4 仍按 evidence 标记。
 */

import { describe, expect, it } from 'vitest';
import type { BoardUnit, UnitCard } from '../domain/types';
import type { GameEvent, RandomFn } from '../../../engine/types';
import { createInitializedCore, placeTestUnit } from './test-helpers';
import { SummonerWarsDomain } from '../domain';
import { triggerAbilities } from '../domain/abilityResolver';
import { getSummoner } from '../domain/helpers';
import { calculateEffectiveStrength } from '../domain/abilityResolver';
import { canAttackEnhanced } from '../domain/helpers';
import { reduceEvent } from '../domain/reduce';
import { SW_EVENTS } from '../domain/types';
import { getShadowBloodMagicChargeEvents } from '../domain/execute/helpers';
import { EVENT_CARDS_SHADOW } from '../config/factions/shadow';
import { executePlayEvent } from '../domain/execute/eventCards';

const random: RandomFn = {
  shuffle: <T>(items: T[]) => items,
  random: () => 0.5,
  d: (max: number) => Math.ceil(max / 2),
  range: (min: number) => min,
};

function unitCard(id: string, abilities: string[] = []): UnitCard {
  return {
    id,
    cardType: 'unit',
    name: id,
    unitClass: 'common',
    faction: 'shadow',
    strength: 1,
    life: 4,
    cost: 1,
    attackType: 'melee',
    attackRange: 1,
    abilities,
    deckSymbols: [],
  };
}

function sourceContext(core: ReturnType<typeof createInitializedCore>, source: BoardUnit, victim: BoardUnit, ownerId: '0' | '1') {
  return {
    state: core,
    sourceUnit: source,
    sourcePosition: source.position,
    ownerId,
    victimUnit: victim,
    victimPosition: victim.position,
    timestamp: 1,
  };
}

describe('暗影精灵能力', () => {
  it('黑暗预言只在己方单位离开战场时为来源单位充能', () => {
    const core = createInitializedCore(['0', '1'], random, { faction0: 'shadow', faction1: 'necromancer' });
    const source = placeTestUnit(core, { row: 3, col: 3 }, {
      card: unitCard('shadow-prophecy', ['shadow_dark_prophecy']),
      owner: '0',
    });
    const friendlyVictim = placeTestUnit(core, { row: 3, col: 4 }, {
      card: unitCard('friendly-victim'),
      owner: '0',
    });
    const enemyVictim = placeTestUnit(core, { row: 3, col: 2 }, {
      card: unitCard('enemy-victim'),
      owner: '1',
    });

    const friendlyEvents = triggerAbilities('onUnitDestroyed', sourceContext(core, source, friendlyVictim, '0'));
    expect(friendlyEvents.some((event: GameEvent) =>
      event.type === 'sw:unit_charged'
      && (event.payload as Record<string, unknown>).sourceAbilityId === 'shadow_dark_prophecy'
      && (event.payload as Record<string, unknown>).delta === 1,
    )).toBe(true);

    const enemyEvents = triggerAbilities('onUnitDestroyed', sourceContext(core, source, enemyVictim, '0'));
    expect(enemyEvents.some((event: GameEvent) => event.type === 'sw:unit_charged')).toBe(false);
  });

  it('死亡契约在来源单位被消灭后对己方召唤师造成 1 点伤害', () => {
    const core = createInitializedCore(['0', '1'], random, { faction0: 'shadow', faction1: 'necromancer' });
    const source = placeTestUnit(core, { row: 3, col: 3 }, {
      card: unitCard('shadow-pact', ['shadow_death_pact']),
      owner: '0',
    });
    const events = triggerAbilities('onDeath', {
      state: core,
      sourceUnit: source,
      sourcePosition: source.position,
      ownerId: '0',
      timestamp: 1,
    });
    const summoner = getSummoner(core, '0');
    expect(summoner).toBeDefined();

    expect(events).toContainEqual(expect.objectContaining({
      type: 'sw:unit_damaged',
      payload: expect.objectContaining({
        damage: 1,
        sourceAbilityId: 'shadow_death_pact',
        position: summoner?.position,
      }),
    }));
  });

  it('难逃厄运在攻击阶段结束按本回合击杀结果伤害对应召唤师', () => {
    const core = createInitializedCore(['0', '1'], random, { faction0: 'shadow', faction1: 'necromancer' });
    const source = placeTestUnit(core, { row: 3, col: 3 }, {
      card: unitCard('shadow-inescapable-doom', ['shadow_inescapable_doom']),
      owner: '0',
    });
    const enemySummoner = getSummoner(core, '1');
    const ownSummoner = getSummoner(core, '0');
    expect(enemySummoner).toBeDefined();
    expect(ownSummoner).toBeDefined();

    core.unitKillCountThisTurn = { [source.instanceId]: 1 };
    const killedEvents = triggerAbilities('onPhaseEnd', {
      state: core,
      sourceUnit: source,
      sourcePosition: source.position,
      ownerId: '0',
      timestamp: 1,
    });
    expect(killedEvents).toContainEqual(expect.objectContaining({
      type: SW_EVENTS.UNIT_DAMAGED,
      payload: expect.objectContaining({
        sourceAbilityId: 'shadow_inescapable_doom',
        position: enemySummoner?.position,
      }),
    }));

    core.unitKillCountThisTurn = {};
    const noKillEvents = triggerAbilities('onPhaseEnd', {
      state: core,
      sourceUnit: source,
      sourcePosition: source.position,
      ownerId: '0',
      timestamp: 2,
    });
    expect(noKillEvents).toContainEqual(expect.objectContaining({
      type: SW_EVENTS.UNIT_DAMAGED,
      payload: expect.objectContaining({
        sourceAbilityId: 'shadow_inescapable_doom',
        position: ownSummoner?.position,
      }),
    }));
  });

  it('暗影脉冲只伤害与受伤传送门相邻的已提交目标单位', () => {
    const core = createInitializedCore(['0', '1'], random, { faction0: 'shadow', faction1: 'necromancer' });
    const pulse = { ...EVENT_CARDS_SHADOW[3] };
    core.players['0'].hand.push(pulse);
    const target = placeTestUnit(core, { row: 3, col: 4 }, {
      card: unitCard('pulse-target'),
      owner: '1',
    });
    const safeTarget = placeTestUnit(core, { row: 1, col: 1 }, {
      card: unitCard('pulse-safe-target'),
      owner: '1',
    });
    core.board[3][3].structure = {
      cardType: 'structure',
      card: {
        id: 'shadow-wounded-gate',
        cardType: 'structure',
        faction: 'shadow',
        name: '受伤传送门',
        cost: 0,
        life: 5,
        isGate: true,
        deckSymbols: [],
      },
      owner: '0',
      position: { row: 3, col: 3 },
      damage: 1,
    };

    const events: GameEvent[] = [];
    executePlayEvent(events, core, '0', {
      cardId: pulse.id,
      targets: [target.position, safeTarget.position],
    }, 1);

    const pulseDamage = events.filter((event) =>
      event.type === 'sw:unit_damaged'
      && (event.payload as Record<string, unknown>).sourceAbilityId === 'shadow-shadow-pulse',
    );
    expect(pulseDamage).toHaveLength(1);
    expect((pulseDamage[0].payload as Record<string, unknown>).position).toEqual(target.position);
  });

  it('猛攻只在真实召唤当回合提供 2 点战力', () => {
    const core = createInitializedCore(['0', '1'], random, { faction0: 'shadow', faction1: 'necromancer' });
    const card = unitCard('shadow-fierce', ['shadow_fierce_assault']);
    const unit = placeTestUnit(core, { row: 3, col: 3 }, {
      card,
      owner: '0',
      summonedTurnNumber: core.turnNumber,
    });

    expect(calculateEffectiveStrength(unit, core).finalStrength).toBe(3);

    const laterTurnCore = { ...core, turnNumber: core.turnNumber + 1 };
    expect(calculateEffectiveStrength(unit, laterTurnCore).finalStrength).toBe(1);
  });

  it('穿透之光只在召唤当回合允许远程攻击穿过单位，建筑仍然阻挡', () => {
    const core = createInitializedCore(['0', '1'], random, { faction0: 'shadow', faction1: 'necromancer' });
    const attacker = placeTestUnit(core, { row: 3, col: 1 }, {
      card: { ...unitCard('shadow-piercing', ['shadow_piercing_light']), attackType: 'ranged', attackRange: 3 },
      owner: '0',
      summonedTurnNumber: core.turnNumber,
    });
    placeTestUnit(core, { row: 3, col: 2 }, { card: unitCard('screening-unit'), owner: '1' });
    placeTestUnit(core, { row: 3, col: 3 }, { card: unitCard('piercing-target'), owner: '1' });

    expect(canAttackEnhanced(core, attacker.position, { row: 3, col: 3 })).toBe(true);

    const laterTurnCore = { ...core, turnNumber: core.turnNumber + 1 };
    expect(canAttackEnhanced(laterTurnCore, attacker.position, { row: 3, col: 3 })).toBe(false);
  });

  it('鲜血魔法按当前回合内 3 格内友方卡牌的每次伤害分别充能', () => {
    const core = createInitializedCore(['0', '1'], random, { faction0: 'shadow', faction1: 'necromancer' });
    const summoner = placeTestUnit(core, { row: 3, col: 3 }, {
      card: { ...unitCard('shadow-blood-magic', ['shadow_blood_magic']), unitClass: 'summoner' },
      owner: '0',
    });
    const ally = placeTestUnit(core, { row: 3, col: 5 }, { card: unitCard('ally'), owner: '0' });
    const enemy = placeTestUnit(core, { row: 1, col: 1 }, { card: unitCard('enemy'), owner: '1' });

    const events = getShadowBloodMagicChargeEvents([
      {
        type: SW_EVENTS.UNIT_DAMAGED,
        payload: { position: ally.position, damage: 1 },
        timestamp: 1,
      },
      {
        type: SW_EVENTS.UNIT_DAMAGED,
        payload: { position: ally.position, damage: 2 },
        timestamp: 1,
      },
      {
        type: SW_EVENTS.UNIT_DAMAGED,
        payload: { position: enemy.position, damage: 1 },
        timestamp: 1,
      },
    ], core, 1);

    expect(events).toHaveLength(2);
    expect(events[0].payload).toEqual(expect.objectContaining({ position: summoner.position, delta: 1 }));

    const charged = reduceEvent(core, events[0]);
    expect(charged.board[summoner.position.row][summoner.position.col].unit?.boosts).toBe(1);

    const systemProcessed = SummonerWarsDomain.postProcessSystemEvents?.(core, [
      {
        type: SW_EVENTS.UNIT_DAMAGED,
        payload: { position: ally.position, damage: 1 },
        timestamp: 2,
      },
    ], random) ?? [];
    expect(systemProcessed.filter(event => event.type === SW_EVENTS.UNIT_CHARGED)).toHaveLength(1);
  });

  it('鲜血魔法后处理不会重复追加已经存在的充能事件', () => {
    const core = createInitializedCore(['0', '1'], random, { faction0: 'shadow', faction1: 'necromancer' });
    const summoner = placeTestUnit(core, { row: 3, col: 3 }, {
      card: { ...unitCard('shadow-blood-magic-dedup', ['shadow_blood_magic']), unitClass: 'summoner' },
      owner: '0',
    });
    const ally = placeTestUnit(core, { row: 3, col: 4 }, { card: unitCard('shadow-blood-magic-dedup-ally'), owner: '0' });
    const damageEvent: GameEvent = {
      type: SW_EVENTS.UNIT_DAMAGED,
      payload: { position: ally.position, damage: 1 },
      timestamp: 1,
    };
    const existingCharge: GameEvent = {
      type: SW_EVENTS.UNIT_CHARGED,
      payload: { position: summoner.position, delta: 1, sourceAbilityId: 'shadow_blood_magic' },
      timestamp: 1,
    };

    const processed = SummonerWarsDomain.postProcessSystemEvents?.(core, [damageEvent, existingCharge], random) ?? [];
    expect(processed.filter((event) => (
      event.type === SW_EVENTS.UNIT_CHARGED
      && (event.payload as Record<string, unknown>).sourceAbilityId === 'shadow_blood_magic'
    ))).toHaveLength(1);
  });
});
