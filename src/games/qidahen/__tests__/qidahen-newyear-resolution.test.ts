import { describe, expect, it } from 'vitest';
import { createInitialCore } from '../domain/initialCoreSetup';
import { buildQidahenUpkeepTasks, canMaintainQidahenFortification, getQidahenFortificationMaintenanceCost } from '../domain/seasonTasks';
import { reduceQidahenTurnResolutionFact } from '../domain/turnResolutionFacts';
import { buildMercenaryTroopStack, buildRegularTroopStack } from '../domain/troopStacks';
import { expandSpecialTroopStacksToCompatPieces } from '../domain/troopCompat';
import { resolveQidahenPrimaryRuntimeRegionId } from '../domain/regionConfig';
import type { QidahenCore, QidahenFactionId } from '../domain/types';
import type { QidahenTurnResolutionFact } from '../domain/turnResolutionTypes';

const initial = () => createInitialCore(['0', '1', '2'], 'post-sarhu-1619', true);
const applyFact = (core: QidahenCore, fact: QidahenTurnResolutionFact) => reduceQidahenTurnResolutionFact(core, {
    type: 'TURN_RESOLUTION_APPLIED', timestamp: 100, payload: { frameId: 'season-regression', factionId: 'ming', fromStep: 'upkeep', fact },
});
function activate(core: QidahenCore, faction: QidahenFactionId, id: string) {
    core.factions[faction].characters = core.factions[faction].characters.map(character => ({ ...character, inPlay: character.id === id }));
}
function force(core: QidahenCore, regionId: string, owner: QidahenFactionId, troops: number, population: number) {
    const region = core.regions.find(region => region.id === regionId)!;
    Object.assign(region, { controller: owner, troops, population, specialTroops: [buildRegularTroopStack(owner, 'upkeep-regression', troops)] });
    return region;
}
const task = (core: QidahenCore, regionId: string, location = 'field') => buildQidahenUpkeepTasks(core).find(task => task.regionId === regionId && task.location === location);

// 完整正常命令/事务往返由turnResolution.test覆盖；这里迁移有效季节边界，废弃自动扣费和自动减员期望。
describe('新年维护与由所属玩家分配的耗损', () => {
    it('阿敏只为后金实际控制的朝鲜区域额外朝贡，友好中立不计入', () => {
        const core = initial();
        for (const id of ['xian-xing', 'city-region-18']) core.regions.find(region => region.id === id)!.controller = 'jin';
        Object.assign(core.regions.find(region => region.id === 'city-region-29')!, { controller: 'neutral', diplomacyMarkerFaction: 'jin', diplomacyMarkerSide: 'friendly' });
        const base = applyFact(core, { kind: 'tribute' });
        activate(core, 'jin', 'jin-amin');
        const withAmin = applyFact(core, { kind: 'tribute' });
        expect(base.handCards.filter(card => card.faction === 'jin' && card.originDeck === 'korea')).toHaveLength(3);
        expect(withAmin.handCards.filter(card => card.faction === 'jin' && card.originDeck === 'korea')).toHaveLength(5);
        expect(withAmin.koreaDrawPile.length).toBe(base.koreaDrawPile.length - 2);
        expect(withAmin.factions.jin.handCount).toBe(base.factions.jin.handCount + 2);
    });
    it('五项防线各自收费，孙承宗每项减1', () => {
        const core = initial();
        expect(core.fortifications.map(item => getQidahenFortificationMaintenanceCost(core, item.id))).toEqual(core.fortifications.map(item => item.maintenanceCost));
        activate(core, 'ming', 'ming-sun-chengzong');
        for (const item of core.fortifications) expect(getQidahenFortificationMaintenanceCost(core, item.id)).toBe(Math.max(0, item.maintenanceCost - 1));
    });
    it('辽西或蓟镇失守时，对应防线不能维护', () => {
        const core = initial();
        for (const item of core.fortifications.filter(item => item.dependencyRegionId)) {
            const region = core.regions.find(region => region.id === resolveQidahenPrimaryRuntimeRegionId(item.dependencyRegionId!))!;
            const previous = region.controller;
            region.controller = 'jin';
            expect(canMaintainQidahenFortification(core, item.id)).toBe(false);
            region.controller = previous;
        }
    });
    it('维护只弃指定实体牌，放弃只损毁当前一项', () => {
        const core = initial();
        const cards = core.handCards.filter(card => card.faction === 'ming').slice(0, 2);
        const card = cards[0];
        const paid = applyFact(core, { kind: 'maintenance', fortificationId: 'shanhaiguan', maintain: true, cardIds: cards.map(card => card.id) });
        expect(paid.handCards.some(item => item.id === card.id)).toBe(false);
        expect(paid.factions.ming.discardPile.some(item => item.id === card.id)).toBe(true);
        const abandoned = applyFact(paid, { kind: 'maintenance', fortificationId: 'outer-wall', maintain: false, cardIds: [] });
        expect(abandoned.fortifications.find(item => item.id === 'outer-wall')?.ruined).toBe(true);
        expect(abandoned.fortifications.find(item => item.id === 'shanhaiguan')?.ruined).toBe(false);
        expect(abandoned.handCards).toEqual(paid.handCards);
    });
    it('普通地区用人口支持，旱灾人口视0，中立友好区不使用当地人口', () => {
        const core = initial();
        const region = force(core, 'city-region-15-liaodong', 'ming', 4, 3);
        expect(task(core, region.id)?.required).toBe(1);
        region.eventMarkers = [{ id: 'drought', kind: 'drought' }];
        expect(task(core, region.id)?.required).toBe(4);
        region.eventMarkers = []; region.controller = 'neutral'; region.diplomacyMarkerFaction = 'ming';
        expect(task(core, region.id)).toMatchObject({ required: 4, reason: 'neutral', factionId: 'ming' });
    });
    it('朝鲜驻军全部需要支持，毛文龙免除大明在朝鲜的耗损', () => {
        const core = initial();
        const region = force(core, 'city-region-18', 'ming', 3, 0);
        expect(task(core, region.id)).toMatchObject({ required: 3, reason: 'korea' });
        activate(core, 'ming', 'ming-mao-wenlong');
        expect(task(core, region.id)).toBeUndefined();
    });
    it('非汉人区域大明正规军不吃人口，雇佣军仍可获得支持', () => {
        const core = initial();
        const region = force(core, 'city-region-20', 'ming', 3, 3);
        region.specialTroops = [buildRegularTroopStack('ming', 'regular', 2), buildMercenaryTroopStack('ming', 'mercenary', 1)];
        expect(task(core, region.id)).toMatchObject({ required: 2, reason: 'desert' });
    });
    it('围城攻方不吃人口，城内守军使用实际城内人口支持', () => {
        const core = initial();
        const region = force(core, 'city-region-25', 'ming', 0, 5);
        region.cityState = { population: 2, troops: 3, specialTroops: [buildRegularTroopStack('ming', 'garrison', 3)] };
        expect(task(core, region.id, 'city')?.required).toBe(1);
        region.siegeState = { attackerFactionId: 'jin', attackerTroops: 3, attackerSpecialTroops: [buildRegularTroopStack('jin', 'siege', 3)], sourceRegionId: 'city-region-28' };
        expect(task(core, region.id, 'siege')).toMatchObject({ required: 3, factionId: 'jin' });
        expect(task(core, region.id, 'city')).toMatchObject({ required: 1, factionId: 'ming' });
    });
    it('王化贞每地区免费支持1，包含围城攻方', () => {
        const core = initial();
        const left = force(core, 'city-region-15-liaodong', 'ming', 3, 0);
        const right = force(core, 'city-region-18', 'ming', 3, 0);
        const siege = force(core, 'city-region-25', 'jin', 0, 2);
        siege.siegeState = { attackerFactionId: 'ming', attackerTroops: 3, attackerSpecialTroops: [buildRegularTroopStack('ming', 'siege', 3)], sourceRegionId: left.id };
        activate(core, 'ming', 'ming-wang-huazhen');
        for (const [id, location] of [[left.id, 'field'], [right.id, 'field'], [siege.id, 'siege']]) expect(task(core, id, location)?.required).toBe(2);
    });
    it.each(['field', 'city', 'siege'] as const)('%s耗损移除指定高级兵，保留低级兵与其它地区', location => {
        const core = initial();
        const region = force(core, 'city-region-25', 'ming', 2, 0);
        const troops = [buildRegularTroopStack('ming', 'low', 1, 1), buildRegularTroopStack('ming', 'high', 1, 4)];
        if (location === 'field') region.specialTroops = troops;
        if (location === 'city') { region.troops = 0; region.specialTroops = []; region.cityState = { population: 0, troops: 2, specialTroops: troops }; }
        if (location === 'siege') { region.troops = 0; region.specialTroops = []; region.controller = 'jin'; region.siegeState = { attackerFactionId: 'ming', attackerTroops: 2, attackerSpecialTroops: troops, sourceRegionId: 'city-region-15' }; }
        const high = expandSpecialTroopStacksToCompatPieces(troops).find(piece => piece.level === 4)!;
        const next = applyFact(core, { kind: 'upkeep', task: task(core, region.id, location)!, cardIds: [], removedPieceIds: [high.id] });
        expect(next.pieces.some(piece => piece.id === high.id)).toBe(false);
        expect(next.pieces.some(piece => piece.level === 1 && piece.regionId === region.id)).toBe(true);
        expect(next.regions.find(item => item.id === 'city-region-15')?.troops).toBe(core.regions.find(item => item.id === 'city-region-15')?.troops);
    });
});
