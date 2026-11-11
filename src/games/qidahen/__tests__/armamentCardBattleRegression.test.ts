import { expect, it } from 'vitest';
import type { RandomFn } from '../../../engine/types';
import { QidahenDomain } from '../domain';
import { createQidahenStructuredBattleRolls } from '../domain/battleRollMath';
import type { QidahenCore, QidahenFactionId, QidahenTroopKind } from '../domain/types';

const random: RandomFn = { random: () => 0.5, d: () => 4, range: min => min, shuffle: cards => [...cards] };

function battle(kind: QidahenTroopKind, owner: QidahenFactionId, armamentId: string, sourceCardDefId: string) {
    const initial = QidahenDomain.setup(['0', '1', '2'], random);
    const defender = owner === 'ming' ? 'jin' : 'ming';
    const stack = (id: string, faction: QidahenFactionId, troopKind: QidahenTroopKind) => ({
        id, label: id, faction, troopKind, count: 1, level: 2,
    });
    const core: QidahenCore = { ...initial, factions: { ...initial.factions,
        [owner]: { ...initial.factions[owner], armaments: initial.factions[owner].armaments.map(item => item.id === armamentId
            ? { ...item, level: 1, sourceCardDefIds: [sourceCardDefId] } : item) } },
        regions: initial.regions.map(region => region.id === 'city-region-16' ? { ...region, controller: owner,
            troops: kind === 'artillery' ? 2 : 1, specialTroops: kind === 'artillery'
                ? [stack('attacker-artillery', owner, 'artillery'), stack('attacker-infantry', owner, 'infantry')]
                : [stack('attacker', owner, kind)] }
            : region.id === 'city-region-14' ? { ...region, controller: defender, troops: 1, population: 0,
                specialTroops: [stack('defender', defender, 'infantry')], cityState: null, siegeState: null } : region),
        pendingTargetAction: { actionId: 'raid', title: 'test', attackerFactionId: owner, battleMode: 'field',
            sourceRegionId: 'city-region-16', sourceRegionName: 'source', targetRegionId: 'city-region-14',
            targetRegionName: 'target', targetRuntimeRegionId: 'city-region-14', defenderFactionId: defender,
            defenderLabel: 'defender', restriction: '', battleWidth: 3, boundaryUnitCap: null,
            sourceAvailableTroops: kind === 'artillery' ? 2 : 1, committedTroops: kind === 'artillery' ? 2 : 1,
            movementProfileId: null, attackPressure: 2, attackBoundaryType: 'plain', resolutionHint: '', defenderPayCost: null } };
    return core;
}

const rollsFor = (core: QidahenCore) => createQidahenStructuredBattleRolls(core, core.pendingTargetAction!, random,
    { defenderHoldCity: false, defenderSortieBattle: false, defenderCavalryEvasion: false, attackerCavalryPlunder: false })!;

it('长管火铳让明军步兵每骰点数 +1，不多掷骰，并先于对手结算', () => {
    const core = battle('infantry', 'ming', 'long-barreled-musket', 'qidahen-atlas05-1646-linked-muskets');
    const stage = rollsFor(core).stages.find(item => item.phase === 'infantry')!;
    expect(stage.attackerRolls).toHaveLength(1);
    expect(stage.attackerRolls[0]).toMatchObject({ raw: 4, value: 5 });
    expect(stage.priorityNote).toContain('长管火铳');
    core.pendingTargetAction = { ...core.pendingTargetAction!, tacticModifiers: [{ id: 'reject', side: 'defender',
        sourceCardDefId: 'qidahen-atlas05-1636-cheval-de-frise', label: '拒马', troopKind: 'infantry', levelBonus: 0,
        cancelEnemyPrioritySourceCardDefIds: ['qidahen-atlas05-1646-linked-muskets'] }] };
    expect(rollsFor(core).stages.find(item => item.phase === 'infantry')?.priorityNote).toContain('长管火铳');
    const other = battle('infantry', 'jin', 'long-barreled-musket', 'qidahen-atlas05-1646-linked-muskets');
    other.factions.jin.characters = other.factions.jin.characters.map(character => ({ ...character, inPlay: false }));
    const otherStage = rollsFor(other).stages.find(item => item.phase === 'infantry')!;
    expect(otherStage.attackerRolls[0]).toMatchObject({ raw: 4, value: 4 });
    expect(otherStage.priorityNote).toBeNull();
});

it('西式棱堡只让大明城战守方每个参战部队掷 2 颗骰', () => {
    for (const defender of ['ming', 'jin'] as const) {
        const attacker = defender === 'ming' ? 'jin' : 'ming';
        const core = battle('infantry', attacker, 'western-bastion', 'qidahen-atlas05-1642-western-bastion');
        core.factions[defender].armaments = core.factions[defender].armaments.map(item => item.id === 'western-bastion'
            ? { ...item, level: 1, sourceCardDefIds: ['qidahen-atlas05-1642-western-bastion'] } : item);
        const source = core.regions.find(region => region.id === 'city-region-14')!;
        core.regions = core.regions.map(region => region.id === 'city-region-25' ? { ...region, controller: defender,
            troops: source.troops, specialTroops: source.specialTroops, cityState: null, siegeState: null } : region);
        core.pendingTargetAction = { ...core.pendingTargetAction!, battleMode: 'city', targetRegionId: 'city-region-25', targetRuntimeRegionId: 'city-region-25' };
        expect(rollsFor(core).stages.find(item => item.phase === 'melee')!.defenderRolls).toHaveLength(defender === 'ming' ? 2 : 1);
    }
});

it('骑兵火器让明军骑兵每骰点数 +1；后金使用相同牌无效果', () => {
    for (const faction of ['ming', 'jin'] as const) {
        const core = battle('cavalry', faction, 'cavalry-firearm', 'qidahen-atlas05-1639-cavalry-firearm');
        const stage = rollsFor(core).stages.find(item => item.phase === 'cavalry')!;
        expect(stage.attackerRolls).toHaveLength(1);
        expect(stage.attackerRolls[0]).toMatchObject({ raw: 4, value: faction === 'ming' ? 5 : 4 });
    }
});

it('红衣大炮不改变火炮科技数，野战进攻时不增炮兵骰点', () => {
    const core = battle('artillery', 'ming', 'red-coat-cannon', 'qidahen-atlas05-1634-red-coat-cannon');
    core.factions.ming.armaments = core.factions.ming.armaments.map(item => item.id === 'artillery-tech'
        ? { ...item, level: 0, sourceCardDefIds: [] } : item);
    const stage = rollsFor(core).stages.find(item => item.phase === 'artillery')!;
    expect(stage.attackerRolls).toHaveLength(1);
    expect(stage.attackerRolls[0]).toMatchObject({ raw: 4, value: 4 });
});

it('红衣大炮仅大明野战防守时为炮兵每骰 +1，其他势力无效果', () => {
    for (const defender of ['ming', 'jin'] as const) {
        const attacker = defender === 'ming' ? 'jin' : 'ming';
        const core = battle('infantry', attacker, 'red-coat-cannon', 'qidahen-atlas05-1634-red-coat-cannon');
        core.factions[defender].armaments = core.factions[defender].armaments.map(item => item.id === 'red-coat-cannon'
            ? { ...item, level: 1, sourceCardDefIds: ['qidahen-atlas05-1634-red-coat-cannon'] }
            : item.id === 'artillery-tech' ? { ...item, level: 0, sourceCardDefIds: [] } : item);
        core.regions = core.regions.map(region => region.id === 'city-region-14' ? { ...region, troops: 2,
            specialTroops: [...region.specialTroops, { id: `${defender}-artillery`, label: '炮兵', faction: defender,
                troopKind: 'artillery', count: 1, level: 2 }] } : region);
        const stage = rollsFor(core).stages.find(item => item.phase === 'artillery')!;
        expect(stage.defenderRolls).toHaveLength(1);
        expect(stage.defenderRolls[0]).toMatchObject({ raw: 4, value: defender === 'ming' ? 5 : 4 });
    }
});

it('红衣大炮城战进攻炮兵每骰 +2；长管火铳在城战肉搏阶段先掷', () => {
    const city = (core: QidahenCore) => {
        const defender = core.regions.find(region => region.id === 'city-region-14')!;
        core.regions = core.regions.map(region => region.id === 'city-region-25'
            ? { ...region, controller: defender.controller, troops: defender.troops,
                specialTroops: defender.specialTroops, cityState: null, siegeState: null } : region);
        core.pendingTargetAction = { ...core.pendingTargetAction!, battleMode: 'city', targetRegionId: 'city-region-25',
            targetRuntimeRegionId: 'city-region-25' };
        return core;
    };
    const red = city(battle('artillery', 'ming', 'red-coat-cannon', 'qidahen-atlas05-1634-red-coat-cannon'));
    red.factions.ming.armaments = red.factions.ming.armaments.map(item => item.id === 'artillery-tech'
        ? { ...item, level: 0, sourceCardDefIds: [] } : item);
    const shot = rollsFor(red).stages.find(item => item.phase === 'artillery')!;
    expect(shot.attackerRolls).toHaveLength(1);
    expect(shot.attackerRolls[0]).toMatchObject({ raw: 4, value: 6 });
    const musket = city(battle('infantry', 'ming', 'long-barreled-musket', 'qidahen-atlas05-1646-linked-muskets'));
    const melee = rollsFor(musket).stages.find(item => item.phase === 'melee')!;
    expect(melee.priorityNote).toContain('长管火铳');
    expect(melee.attackerRolls[0]).toMatchObject({ raw: 4, value: 5 });
});
