import { describe, expect, it } from 'vitest';
import { createInitialSystemState, executePipeline } from '../../../engine/pipeline';
import type { RandomFn } from '../../../engine/types';
import { engineConfig } from '../game';
import { QidahenDomain } from '../domain';
import { createInitialCore } from '../domain/initialCoreSetup';
import { getQidahenTurnResolutionFrame } from '../domain/turnResolutionOpportunities';
import { buildQidahenTurnChoice, isQidahenTurnChoiceSelectionValid } from '../domain/turnResolutionChoices';
import { advanceQidahenTurnResolutionData, getQidahenAutomaticTurnFact, normalizeQidahenTurnResolutionData } from '../domain/turnResolutionProgress';
import { reduceQidahenTurnResolutionFact } from '../domain/turnResolutionFacts';
import { getQidahenChronologyClaimOrder } from '../domain/chronologyResolution';
import { buildQidahenCharacterJudgementTasks } from '../domain/characterJudgement';
import { discardQidahenHandCards } from '../domain/handCardState';
import { buildRegularTroopStack } from '../domain/troopStacks';
import type { QidahenCore } from '../domain/types';
import type { QidahenTurnResolutionAppliedEvent, QidahenTurnResolutionData, QidahenTurnResolutionFact } from '../domain/turnResolutionTypes';

const players = ['0', '1', '2'];
const random: RandomFn = { random: () => 0.5, d: () => 1, range: min => min, shuffle: items => [...items] };
const initial = () => createInitialCore(players, 'post-sarhu-1619', true);
// 窄语义回归使用正式首步创建的frame数据；完整权限/随机/重放另由管线回归覆盖。
function baseData(): QidahenTurnResolutionData {
    const result = executePipeline({ domain: QidahenDomain, systems: engineConfig.systems }, {
        core: initial(), sys: createInitialSystemState(players, engineConfig.systems, 'season-choice-boundaries'),
    }, { type: 'EXECUTE_WHEEL_MOVE', playerId: '1', payload: { moveId: 'move-1-free' }, timestamp: 100 }, random, players);
    expect(result.success).toBe(true);
    return getQidahenTurnResolutionFrame(result.state)!.metadata.qidahenTurn;
}
function apply(core: QidahenCore, data: QidahenTurnResolutionData, fact: QidahenTurnResolutionFact) {
    const event: QidahenTurnResolutionAppliedEvent = { type: 'TURN_RESOLUTION_APPLIED', timestamp: 100,
        payload: { frameId: 'season-choice-boundaries', factionId: data.factionId, fromStep: data.step, fact } };
    const next = reduceQidahenTurnResolutionFact(core, event);
    return { core: next, data: advanceQidahenTurnResolutionData(next, data, event) };
}
function choose(core: QidahenCore, data: QidahenTurnResolutionData, id: string) {
    const choice = buildQidahenTurnChoice(core, data)!;
    expect(isQidahenTurnChoiceSelectionValid(core, data, core.factions[choice.factionId].playerId, [id])).toBe(true);
    return apply(core, data, choice.resolve([id]));
}

describe('季节规则的接受、拒绝与动态剩余机会', () => {
    it.each(['draw-bonus', 'decline-bonus'])('范文程%s只计算控制的两个汉区，抽牌分支增加4张实体', decision => {
        const core = initial();
        core.factions.jin.characters = core.factions.jin.characters.map(character => ({ ...character, inPlay: character.id === 'jin-fan-wencheng' }));
        for (const id of ['xuan-fu', 'city-region-15-liaodong']) Object.assign(core.regions.find(region => region.id === id)!, {
            controller: 'jin', troops: 1, specialTroops: [buildRegularTroopStack('jin', id, 1)],
        });
        Object.assign(core.regions.find(region => region.id === 'city-region-27')!, { controller: 'neutral', diplomacyMarkerFaction: 'jin', diplomacyMarkerSide: 'friendly', troops: 0, specialTroops: [] });
        const afterIncome = apply(core, { ...baseData(), step: 'midyear-income' }, { kind: 'midyear-income' });
        expect(afterIncome.data.incomeBonusTasks).toEqual([{ factionId: 'jin', cards: 4, label: '范文程额外抽4张' }]);
        const selected = choose(afterIncome.core, afterIncome.data, decision);
        const count = decision === 'draw-bonus' ? 4 : 0;
        expect(selected.core.factions.jin.handCount).toBe(afterIncome.core.factions.jin.handCount + count);
        expect(selected.core.handCards.filter(card => card.faction === 'jin')).toHaveLength(afterIncome.core.handCards.filter(card => card.faction === 'jin').length + count);
        expect(selected.core.factions.jin.drawPile.length).toBe(afterIncome.core.factions.jin.drawPile.length - count);
    });
    it('有足够手牌仍可拒绝纪年，下一位按已算定资格接手；全拒绝后仍正常换年', () => {
        let core = initial();
        let data = { ...baseData(), step: 'chronology' as const, chronologyCandidates: getQidahenChronologyClaimOrder(core), chronologyIndex: 0 } as QidahenTurnResolutionData;
        const cards = core.handCards;
        const order = [...data.chronologyCandidates];
        for (const faction of order) {
            expect(buildQidahenTurnChoice(core, data)?.factionId).toBe(faction);
            ({ core, data } = choose(core, data, 'decline'));
        }
        expect(core.handCards).toEqual(cards);
        expect(Object.values(core.chronology.claimedCardIds).flat()).toEqual([]);
        data = normalizeQidahenTurnResolutionData(core, data);
        expect(getQidahenAutomaticTurnFact(core, data)).toEqual({ kind: 'year-transition' });
        ({ core } = apply(core, data, { kind: 'year-transition' }));
        expect(core.currentYearIndex).toBe(1);
        expect(core.chronology.currentCardId).toBe(1303);
    });
    it.each([false, true])('纪年领取手牌为零=%s，奇数向上取半，只支付选中的实体且只获得一次', empty => {
        let core = initial();
        if (empty) core = { ...core, ...discardQidahenHandCards(core, core.handCards.filter(card => card.faction === 'ming').map(card => card.id)) };
        let data: QidahenTurnResolutionData = { ...baseData(), step: 'chronology', chronologyCandidates: ['ming'], chronologyIndex: 0 };
        const hand = core.factions.ming.handCount;
        ({ core, data } = choose(core, data, 'claim'));
        for (let i = 0; i < Math.ceil(hand / 2); i++) ({ core, data } = choose(core, data, buildQidahenTurnChoice(core, data)!.candidates[0].id));
        const fact = getQidahenAutomaticTurnFact(core, data)!;
        expect(fact.kind).toBe('chronology');
        ({ core, data } = apply(core, data, fact));
        expect(core.factions.ming.handCount).toBe(hand - Math.ceil(hand / 2));
        expect(core.chronology.claimedCardIds.ming).toEqual([1301]);
        expect(core.factions.ming.vp).toBe(1);
        expect(data.step).toBe('year-characters');
    });
    it('魏先离场取消孙元化额外骰，同人首骰离场跳过剩余败标', () => {
        const core = initial();
        core.factions.ming.characters = core.factions.ming.characters.map(character => ({ ...character,
            inPlay: ['ming-wei-zhongxian', 'ming-sun-yuanhua', 'ming-yang-gao'].includes(character.id), defeatMarkers: character.id === 'ming-yang-gao' ? 2 : 0 }));
        const data: QidahenTurnResolutionData = { ...baseData(), step: 'character-judgement', judgementTasks: buildQidahenCharacterJudgementTasks(core), judgementIndex: 0 };
        const task = data.judgementTasks[0];
        expect(task.characterId).toBe('ming-wei-zhongxian');
        let next = apply(core, data, { kind: 'judgement', task, rawRoll: 1, outcome: 'remove' });
        next.data = normalizeQidahenTurnResolutionData(next.core, next.data);
        const yang = next.data.judgementTasks[next.data.judgementIndex];
        expect(yang.characterId).toBe('ming-yang-gao');
        next = apply(next.core, next.data, { kind: 'judgement', task: yang, rawRoll: 1, outcome: 'jin' });
        next.data = normalizeQidahenTurnResolutionData(next.core, next.data);
        expect(next.data.step).toBe('complete');
        expect(next.core.factions.jin.characters.find(character => character.id === 'ming-yang-gao')?.inPlay).toBe(false);
    });
});
