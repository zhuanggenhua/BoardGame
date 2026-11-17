import { expect, it } from 'vitest';
import {
    applyBetrayalCommand,
    BETRAYAL_COMMANDS,
    BetrayalDomain,
    createBetrayalCommand,
    createBetrayalScriptedRandom,
    createDustFeverishAttackReadyCore,
} from './helpers/firstScenarioRuntimeHarness';
import { createHeroAttackTraitorReadyCore } from '../testing/firstScenarioTestUtils';

it('怪物攻击伤害先由攻击方确认骰，再由受伤英雄分配', () => {
    const core = applyBetrayalCommand(createDustFeverishAttackReadyCore(),
        BETRAYAL_COMMANDS.MONSTER_ATTACK_HERO, '0', { monsterId: 'feverish-0', targetPlayerId: '1' },
        100, createBetrayalScriptedRandom(2, 1, 1, 1, 1, 1, 1, 1, 1, 1));
    expect(core.pendingDamageAllocation).toMatchObject({ playerId: '1', amount: 1 });
    const validate = (type: typeof BETRAYAL_COMMANDS.ACKNOWLEDGE_RECENT_ROLL | typeof BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
        playerId: string, payload: Record<string, unknown>) => BetrayalDomain.validate(
        { core, sys: {} as never }, createBetrayalCommand(type, playerId, payload as never),
    );
    expect(validate(BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION, '1', { traits: ['might'] }).valid).toBe(false);
    expect(validate(BETRAYAL_COMMANDS.ACKNOWLEDGE_RECENT_ROLL, '1', {}).valid).toBe(false);
    expect(validate(BETRAYAL_COMMANDS.ACKNOWLEDGE_RECENT_ROLL, '0', {}).valid).toBe(true);
    const confirmed = applyBetrayalCommand(core, BETRAYAL_COMMANDS.ACKNOWLEDGE_RECENT_ROLL, '0', {});
    const resolved = applyBetrayalCommand(confirmed, BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION, '1', { traits: ['might'] });
    expect(resolved.pendingDamageAllocation).toBeNull();
});

it('攻击者确认前可用兔脚重掷，确认后关闭重掷并按新结果分配', () => {
    const ready = createHeroAttackTraitorReadyCore();
    ready.currentExplorer.inventory.push({ id: 'rope', name: '兔脚', kind: 'item' });
    ready.currentExplorerInventory = [...ready.currentExplorer.inventory];
    ready.turnStartInventoryCardIds.push('rope');
    const attacked = applyBetrayalCommand(ready, BETRAYAL_COMMANDS.HAUNT_ATTACK, '0',
        { target: 'traitor' }, 100, createBetrayalScriptedRandom(2, 2, 2, 2, 1, 1, 1, 1, 1, 1));
    expect(attacked.pendingDamageAllocation).not.toBeNull();
    const rerolled = applyBetrayalCommand(attacked, BETRAYAL_COMMANDS.USE_RABBIT_FOOT, '0',
        { cardId: 'rope', dieIndex: 0 }, 101, createBetrayalScriptedRandom(3));
    expect(rerolled.recentRoll?.dice[0]).not.toBe(attacked.recentRoll?.dice[0]);
    const confirmed = applyBetrayalCommand(rerolled, BETRAYAL_COMMANDS.ACKNOWLEDGE_RECENT_ROLL, '0', {});
    expect(confirmed.recentRoll).toBeNull();
    expect(BetrayalDomain.validate({ core: confirmed, sys: {} as never },
        createBetrayalCommand(BETRAYAL_COMMANDS.USE_RABBIT_FOOT, '0', { cardId: 'rope', dieIndex: 0 })).valid).toBe(false);
    expect(confirmed.pendingDamageAllocation?.amount).toBe(rerolled.pendingDamageAllocation?.amount);
});
