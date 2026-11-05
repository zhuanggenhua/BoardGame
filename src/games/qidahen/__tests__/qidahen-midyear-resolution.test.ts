import { describe, expect, it } from 'vitest';
import { createInitialCore } from '../domain/initialCoreSetup';
import { reduceQidahenTurnResolutionFact } from '../domain/turnResolutionFacts';
import { applyQidahenCharacterJudgement, buildQidahenCharacterJudgementTasks, getQidahenCharacterJudgementOutcome } from '../domain/characterJudgement';
import { applyQidahenChronologyTransition, getQidahenChronologyCharacterCandidates } from '../domain/chronologyResolution';
import type { QidahenCore, QidahenFactionId } from '../domain/types';
import type { QidahenCharacterJudgementTask } from '../domain/turnResolutionTypes';

const initial = () => createInitialCore(['0', '1', '2'], 'post-sarhu-1619', true);
const income = (core: QidahenCore) => reduceQidahenTurnResolutionFact(core, {
    type: 'TURN_RESOLUTION_APPLIED', timestamp: 100, payload: { frameId: 'midyear-regression', factionId: 'ming', fromStep: 'midyear-income', fact: { kind: 'midyear-income' } },
});
function setCharacters(core: QidahenCore, faction: QidahenFactionId, ids: string[]) {
    core.factions[faction].characters = core.factions[faction].characters.map(character => ({ ...character, inPlay: ids.includes(character.id) }));
}
const judgement = (factionId: QidahenFactionId, characterId: string): QidahenCharacterJudgementTask => ({ factionId, characterId, reason: 'defeat-marker' });

// 不再依赖已退休的自动季节入口、虚构手牌计数和哈希产生的判定骰。
describe('年中真实税赋、人物额外判定与战败标记', () => {
    it.each(['field', 'city'] as const)('%s人口严格大于同地区全部部队才收1张土地税，江南漕运另抽5张', location => {
        const core = initial();
        core.regions = core.regions.map(region => ({ ...region, population: 0, cityState: region.cityState ? { ...region.cityState, population: 0 } : undefined }));
        const region = core.regions.find(region => region.id === 'city-region-15-liaodong')!;
        Object.assign(region, { controller: 'ming', troops: 1, population: location === 'field' ? 2 : 0 });
        if (location === 'city') { region.troops = 0; region.cityState = { population: 2, troops: 1, specialTroops: [] }; }
        const next = income(core);
        expect(next.factions.ming.handCount).toBe(core.factions.ming.handCount + 6);
        expect(next.handCards.filter(card => card.faction === 'ming')).toHaveLength(core.handCards.filter(card => card.faction === 'ming').length + 6);
        expect(next.factions.ming.landTax).toBe(core.factions.ming.landTax + 1);
        region.population = 1; region.troops = 1; region.cityState = undefined;
        expect(income(core).factions.ming.handCount).toBe(core.factions.ming.handCount + 5);
    });
    it.each(['siege', 'drought'] as const)('%s地区不产生土地税，漕运仍独立结算', condition => {
        const core = initial();
        core.regions = core.regions.map(region => ({ ...region, population: 0, cityState: region.cityState ? { ...region.cityState, population: 0 } : undefined }));
        const region = core.regions.find(region => region.id === 'city-region-15-liaodong')!;
        Object.assign(region, { controller: 'ming', population: 5, troops: 1 });
        if (condition === 'siege') region.siegeState = { attackerFactionId: 'jin', attackerTroops: 1, attackerSpecialTroops: [], sourceRegionId: 'city-region-28' };
        else region.eventMarkers = [{ id: 'drought', kind: 'drought' }];
        expect(income(core).factions.ming.handCount).toBe(core.factions.ming.handCount + 5);
    });
    it('普通在场人物没有凭空额外骰，每个实际人物战败标记才安排一次', () => {
        const core = initial();
        setCharacters(core, 'ming', ['ming-yang-gao']);
        setCharacters(core, 'mongol', []);
        setCharacters(core, 'jin', []);
        const yang = core.factions.ming.characters.find(character => character.id === 'ming-yang-gao')!;
        yang.defeatMarkers = 2;
        expect(buildQidahenCharacterJudgementTasks(core)).toEqual([judgement('ming', yang.id), judgement('ming', yang.id)]);
        const next = applyQidahenCharacterJudgement(core, judgement('ming', yang.id), 'none');
        expect(next.factions.ming.characters.find(character => character.id === yang.id)?.defeatMarkers).toBe(1);
    });
    it('魏忠贤额外一次、其在场使孙元化额外两次；东江被敌占领才触发毛文龙额外骰', () => {
        const core = initial();
        setCharacters(core, 'ming', ['ming-wei-zhongxian', 'ming-sun-yuanhua', 'ming-mao-wenlong']);
        setCharacters(core, 'mongol', []); setCharacters(core, 'jin', []);
        core.regions.find(region => region.id === 'city-region-22')!.controller = 'jin';
        const tasks = buildQidahenCharacterJudgementTasks(core);
        expect(tasks[0].characterId).toBe('ming-wei-zhongxian');
        expect(tasks.filter(task => task.reason === 'extra').map(task => task.characterId).sort()).toEqual(['ming-wei-zhongxian', 'ming-sun-yuanhua', 'ming-sun-yuanhua', 'ming-mao-wenlong'].sort());
        core.regions.find(region => region.id === 'city-region-22')!.controller = 'ming';
        expect(buildQidahenCharacterJudgementTasks(core).some(task => task.characterId === 'ming-mao-wenlong')).toBe(false);
    });
    it('林丹修正其它人物而不修正自己，代善保护同势力人物', () => {
        const core = initial();
        setCharacters(core, 'mongol', ['mongol-lindan-hutuktu']);
        setCharacters(core, 'jin', ['jin-daisan', 'jin-eidu']);
        expect(getQidahenCharacterJudgementOutcome(core, judgement('ming', 'ming-yang-gao'), 3)).toEqual({ outcome: 'mongol', roll: 2 });
        expect(getQidahenCharacterJudgementOutcome(core, judgement('mongol', 'mongol-lindan-hutuktu'), 5)).toEqual({ outcome: 'none', roll: 5 });
        expect(getQidahenCharacterJudgementOutcome(core, judgement('jin', 'jin-eidu'), 3)).toEqual({ outcome: 'none', roll: 3 });
    });
    it('阿敏叛逃转移同一人物实体，后续纪年转换不将其复制回后金', () => {
        const core = initial();
        setCharacters(core, 'mongol', []); setCharacters(core, 'jin', ['jin-amin']);
        const task = judgement('jin', 'jin-amin');
        const { outcome } = getQidahenCharacterJudgementOutcome(core, task, 1);
        expect(outcome).toBe('ming');
        const next = applyQidahenChronologyTransition(applyQidahenCharacterJudgement(core, task, outcome));
        expect(next.factions.jin.characters.some(character => character.id === 'jin-amin')).toBe(false);
        expect(next.factions.ming.characters.filter(character => character.id === 'jin-amin')).toHaveLength(1);
        expect(next.factions.ming.characters.find(character => character.id === 'jin-amin')).toMatchObject({ faction: 'ming', inPlay: false });
        expect(getQidahenChronologyCharacterCandidates(next, 'ming').every(character => !character.inPlay)).toBe(true);
    });
    it('印刷表未解决的重叠和缺项明确报出，不凭实现编造答案', () => {
        const core = initial(); setCharacters(core, 'mongol', []);
        for (const raw of [3, 9, 10]) expect(() => getQidahenCharacterJudgementOutcome(core, judgement('jin', 'jin-amin'), raw)).toThrow(/authoritative errata/);
    });
});
