import type { SituationCardDefinition } from '../domain/types';
import { DEMO_SITUATIONS } from './demo-data';

export const FATE_SITUATIONS: SituationCardDefinition[] = DEMO_SITUATIONS.map((situation) => ({
    id: situation.id,
    name: situation.name,
    assetPath: `fate-domination/situations/${situation.id}`,
    printedMana: situation.mana,
    sourceStatus: 'verified',
    effectSummary: situation.desc,
    climax: situation.isClimax,
}));
const fallbackSituations: SituationCardDefinition[] = [
    { id: 'situation-turning-point', name: '转机', assetPath: 'fate-domination/situations/turning-point', printedMana: 2, sourceStatus: 'verified', effectSummary: '于深山町和新都各增加一张正面事件牌。' },
    { id: 'situation-calm-before-storm', name: '暴风雨前的宁静', assetPath: 'fate-domination/situations/calm-before-storm', printedMana: 0, sourceStatus: 'partial' },
    { id: 'situation-future-hope', name: '对未来的憧憬', assetPath: 'fate-domination/situations/future-hope', printedMana: 0, sourceStatus: 'partial' },
    { id: 'situation-rage', name: '怒不可遏', assetPath: 'fate-domination/situations/rage', printedMana: 0, sourceStatus: 'partial' },
    { id: 'situation-miyama-killer', name: '深山町的杀人魔', assetPath: 'fate-domination/situations/miyama-killer', printedMana: 0, sourceStatus: 'partial' },
    { id: 'situation-new-city-battle', name: '新都之战', assetPath: 'fate-domination/situations/new-city-battle', printedMana: 0, sourceStatus: 'partial' },
    { id: 'situation-perfect-flow', name: '完美的流动', assetPath: 'fate-domination/situations/perfect-flow', printedMana: 0, sourceStatus: 'partial' },
    { id: 'situation-angra-substance', name: '安哥拉·曼纽的实质', assetPath: 'fate-domination/situations/angra-substance', printedMana: 0, sourceStatus: 'partial' },
    { id: 'situation-angra-shadow', name: '安哥拉·曼纽的阴影', assetPath: 'fate-domination/situations/angra-shadow', printedMana: 0, sourceStatus: 'partial' },
    { id: 'situation-angra-curse', name: '安哥拉·曼纽的诅咒', assetPath: 'fate-domination/situations/angra-curse', printedMana: 0, sourceStatus: 'partial' },
    { id: 'situation-fate-night', name: '命运之夜', assetPath: 'fate-domination/situations/fate-night', printedMana: 4, sourceStatus: 'partial', climax: true },
    { id: 'situation-hell-gate', name: '身处地狱之门', assetPath: 'fate-domination/situations/hell-gate', printedMana: 4, sourceStatus: 'partial', climax: true },
    { id: 'situation-heavens-feel', name: '天之杯', assetPath: 'fate-domination/situations/heavens-feel', printedMana: 6, sourceStatus: 'partial', climax: true },
];
if (FATE_SITUATIONS.length === 0) FATE_SITUATIONS.push(...fallbackSituations);

export const FATE_SITUATION_BACK = 'fate-domination/situations/back';
