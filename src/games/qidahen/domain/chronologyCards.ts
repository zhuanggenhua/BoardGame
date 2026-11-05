import { qidahenChronologyPreview, qidahenMongolHandPreview } from '../ui/cardAtlas';
import type { CardPreviewRef } from '../../../core/types';
import type { QidahenCore, QidahenFactionId, QidahenScenarioId } from './types';
import { countQidahenControlledRuntimeRegions } from './victoryResolution';

export type QidahenChronologyScore = 'built-troops' | 'victories' | 'controlled-growth' | 'population-growth' | 'hand-cards';
export type QidahenChronologyCharacterRule = 'any' | 'none' | 'taiji' | 'beile' | 'donglin' | 'eunuch' | readonly string[];

export interface QidahenChronologyCardDefinition {
    cardId: number;
    previewRef: CardPreviewRef;
    factionOrder: QidahenFactionId[];
    score: QidahenChronologyScore | null;
    clearsDrought: boolean;
    characterRules: Record<QidahenFactionId, QidahenChronologyCharacterRule>;
}

const ming = (...ids: string[]) => ids.map(id => `ming-${id}`);
const mongol = (...ids: string[]) => ids.map(id => `mongol-${id}`);
const jin = (...ids: string[]) => ids.map(id => `jin-${id}`);

/** 卡面身份决定顺位、得分和人物；年份只用于显示历史纪年。来源逐卡表见年度来源审查。 */
export const QIDAHEN_ORDINARY_CHRONOLOGY_CARDS: QidahenChronologyCardDefinition[] = [
    { cardId: 1303, previewRef: qidahenChronologyPreview(0), factionOrder: ['ming', 'mongol', 'jin'], score: 'built-troops', clearsDrought: true,
        characterRules: { ming: ming('gao-di', 'xiong-tingbi', 'yang-gao'), mongol: 'taiji', jin: 'any' } },
    { cardId: 1304, previewRef: qidahenChronologyPreview(1), factionOrder: ['mongol', 'jin', 'ming'], score: 'built-troops', clearsDrought: false,
        characterRules: { ming: 'none', mongol: mongol('choghtu-taiji'), jin: 'beile' } },
    { cardId: 1305, previewRef: qidahenChronologyPreview(2), factionOrder: ['mongol', 'ming', 'jin'], score: 'victories', clearsDrought: false,
        characterRules: { ming: ming('yuan-chonghuan', 'sun-yuanhua', 'gao-di', 'wang-huazhen'), mongol: mongol('oba-taiji'), jin: jin('daisan', 'eidu', 'fan-wencheng') } },
    { cardId: 1306, previewRef: qidahenChronologyPreview(3), factionOrder: ['mongol', 'ming', 'jin'], score: 'controlled-growth', clearsDrought: false,
        characterRules: { ming: ming('xiong-tingbi', 'sun-yuanhua', 'mao-wenlong', 'yang-gao'), mongol: mongol('gunchu-ketuji'), jin: jin('daisan', 'eidu', 'amin') } },
    { cardId: 1307, previewRef: qidahenChronologyPreview(4), factionOrder: ['jin', 'ming', 'mongol'], score: 'population-growth', clearsDrought: false,
        characterRules: { ming: 'eunuch', mongol: 'any', jin: 'none' } },
    { cardId: 1308, previewRef: qidahenChronologyPreview(5), factionOrder: ['ming', 'jin', 'mongol'], score: 'hand-cards', clearsDrought: false,
        characterRules: { ming: 'none', mongol: mongol('lindan-hutuktu', 'qisai-noyan', 'choghtu-taiji'), jin: jin('daisan', 'eidu', 'yanguli') } },
    { cardId: 1309, previewRef: qidahenChronologyPreview(6), factionOrder: ['jin', 'mongol', 'ming'], score: 'victories', clearsDrought: false,
        characterRules: { ming: 'donglin', mongol: 'taiji', jin: 'none' } },
    { cardId: 1310, previewRef: qidahenChronologyPreview(7), factionOrder: ['jin', 'mongol', 'ming'], score: 'victories', clearsDrought: false,
        characterRules: { ming: 'any', mongol: mongol('qisai-noyan', 'oba-taiji', 'choghtu-taiji'), jin: jin('yanguli', 'fan-wencheng') } },
    { cardId: 1320, previewRef: qidahenChronologyPreview(8), factionOrder: ['jin', 'ming', 'mongol'], score: 'hand-cards', clearsDrought: true,
        characterRules: { ming: ming('yuan-chonghuan', 'sun-yuanhua', 'gao-di', 'wei-zhongxian'), mongol: 'any', jin: jin('yanguli', 'fan-wencheng') } },
    { cardId: 1330, previewRef: qidahenChronologyPreview(9), factionOrder: ['ming', 'mongol', 'jin'], score: 'hand-cards', clearsDrought: false,
        characterRules: { ming: 'none', mongol: 'taiji', jin: 'any' } },
    { cardId: 1340, previewRef: qidahenChronologyPreview(10), factionOrder: ['mongol', 'jin', 'ming'], score: 'victories', clearsDrought: true,
        characterRules: { ming: ming('sun-chengzong', 'wei-zhongxian'), mongol: mongol('qisai-noyan'), jin: jin('amin', 'eidu', 'manggultai') } },
    { cardId: 1350, previewRef: qidahenChronologyPreview(11), factionOrder: ['ming', 'mongol', 'jin'], score: 'population-growth', clearsDrought: true,
        characterRules: { ming: ming('xiong-tingbi', 'wang-huazhen'), mongol: 'any', jin: jin('daisan', 'amin', 'manggultai') } },
];

export interface QidahenChronologyState {
    currentCardId: number;
    /** 首张公开，其余隐藏；新年按真实顺序推进，不按年份重建。 */
    drawPile: number[];
    claimedCardIds: Partial<Record<QidahenFactionId, number[]>>;
    yearStats: Record<QidahenFactionId, { controlledAtStart: number; populationAtStart: number; builtTroops: number; victories: number }>;
}

export const getQidahenScenarioChronologyCardId = (scenario: QidahenScenarioId): number => (
    scenario === 'post-sarhu-1619' ? 1301 : scenario === 'shanhaiguan-1622' ? 1302 : 1300
);

export function getQidahenChronologyPreview(cardId: number): CardPreviewRef {
    if (cardId >= 1300 && cardId <= 1302) return qidahenMongolHandPreview(cardId - 1300);
    const card = QIDAHEN_ORDINARY_CHRONOLOGY_CARDS.find(item => item.cardId === cardId);
    if (!card) throw new Error(`Unknown chronology card ${cardId}`);
    return card.previewRef;
}

export function buildQidahenActualYearCardSlots(chronology: Pick<QidahenChronologyState, 'currentCardId' | 'drawPile'>): QidahenCore['yearCards'] {
    return [
        { id: 'current-year', label: '今年纪年卡', previewRef: getQidahenChronologyPreview(chronology.currentCardId) },
        ...(chronology.drawPile.length > 0 ? [{ id: 'next-year', label: '下一年纪年卡', previewRef: getQidahenChronologyPreview(chronology.drawPile[0]) }] : []),
    ];
}

export function buildQidahenYearStats(core: Pick<QidahenCore, 'regions'>): QidahenChronologyState['yearStats'] {
    return Object.fromEntries((['ming', 'mongol', 'jin'] as const).map(factionId => {
        const controlled = core.regions.filter(region => !region.isLogicalRegion && region.controller === factionId);
        return [factionId, { controlledAtStart: countQidahenControlledRuntimeRegions(core.regions, factionId), populationAtStart: controlled.reduce((sum, region) => sum + region.population + (region.cityState?.population ?? 0), 0), builtTroops: 0, victories: 0 }];
    })) as QidahenChronologyState['yearStats'];
}

export function buildInitialQidahenChronology(scenario: QidahenScenarioId, regions: QidahenCore['regions'], shuffle?: (cards: number[]) => number[]): QidahenChronologyState {
    const ids = QIDAHEN_ORDINARY_CHRONOLOGY_CARDS.map(card => card.cardId);
    return { currentCardId: getQidahenScenarioChronologyCardId(scenario), drawPile: shuffle ? shuffle(ids) : ids, claimedCardIds: {}, yearStats: buildQidahenYearStats({ regions }) };
}
