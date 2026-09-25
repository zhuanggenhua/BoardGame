import type { AttackCardDefinition } from '../domain/types';
import { DEMO_CARDS } from './demo-data';

const cardAssets: Record<string, string> = {
    cardA1: 'fate-domination/cards/attack-magic-low', cardA2: 'fate-domination/cards/attack-magic-mid', cardA3: 'fate-domination/cards/attack-magic-high', cardA4: 'fate-domination/cards/attack-magic-super',
    cardB1: 'fate-domination/cards/attack-strength-low', cardB2: 'fate-domination/cards/attack-strength-mid', cardB3: 'fate-domination/cards/attack-strength-high', cardB4: 'fate-domination/cards/attack-strength-super',
};
const migratedCards: AttackCardDefinition[] = DEMO_CARDS.map((card) => ({
    id: card.id,
    name: card.name,
    kind: card.kind,
    assetPath: cardAssets[card.id] ?? `fate-domination/cards/${card.id}`,
    manaCost: card.cost,
    basePower: card.power,
    sourceStatus: 'verified',
    type: card.type,
    cost: card.cost,
    power: card.power,
    desc: card.desc,
    effectSummary: card.desc,
}));

export const FATE_ATTACK_CARDS: AttackCardDefinition[] = migratedCards.length ? migratedCards : [
    { id: 'cardA1', name: '低位魔术', kind: 'attack', assetPath: 'fate-domination/cards/attack-magic-low', manaCost: 0, basePower: 2, sourceStatus: 'verified' },
    { id: 'cardA2', name: '中位魔术', kind: 'attack', assetPath: 'fate-domination/cards/attack-magic-mid', manaCost: 0, basePower: 3, sourceStatus: 'verified' },
    { id: 'cardA3', name: '高位魔术', kind: 'attack', assetPath: 'fate-domination/cards/attack-magic-high', manaCost: 0, basePower: 4, sourceStatus: 'verified' },
    { id: 'cardA4', name: '超高位魔术', kind: 'attack', assetPath: 'fate-domination/cards/attack-magic-super', manaCost: 1, basePower: 5, sourceStatus: 'verified' },
    { id: 'cardB1', name: '力量 I', kind: 'attack', assetPath: 'fate-domination/cards/attack-strength-low', manaCost: 0, basePower: 2, sourceStatus: 'verified' },
    { id: 'cardB2', name: '力量 II', kind: 'attack', assetPath: 'fate-domination/cards/attack-strength-mid', manaCost: 0, basePower: 3, sourceStatus: 'verified' },
    { id: 'cardB3', name: '瞬间的一击', kind: 'attack', assetPath: 'fate-domination/cards/attack-strength-high', manaCost: 0, basePower: 4, sourceStatus: 'verified' },
    { id: 'cardB4', name: '决胜一击', kind: 'attack', assetPath: 'fate-domination/cards/attack-strength-super', manaCost: 1, basePower: 5, sourceStatus: 'verified' },
    { id: 'cardluck', name: '幸运', kind: 'skill', assetPath: 'fate-domination/cards/skill-luck', manaCost: 0, basePower: 4, sourceStatus: 'verified', effectSummary: '战斗中可直接击败对手。' },
    { id: 'cardPreparation', name: '快速移动', kind: 'skill', assetPath: 'fate-domination/cards/skill-preparation', manaCost: 1, basePower: 3, sourceStatus: 'verified', effectSummary: '行动阶段移动一格。' },
    { id: 'cardSurveil', name: '远程操作', kind: 'skill', assetPath: 'fate-domination/cards/skill-surveil', manaCost: 1, basePower: 2, sourceStatus: 'verified', effectSummary: '行动阶段使地形效果翻倍；战斗胜利获得额外 VP。' },
    { id: 'cardFumble', name: '翻弄', kind: 'skill', assetPath: 'fate-domination/cards/skill-fumble', manaCost: 0, basePower: 0, sourceStatus: 'unverified' },
    { id: 'cardMoment', name: '刹那的一击', kind: 'skill', assetPath: 'fate-domination/cards/skill-moment', manaCost: 0, basePower: 0, sourceStatus: 'unverified' },
    { id: 'cardInstant', name: '瞬间移动', kind: 'skill', assetPath: 'fate-domination/cards/skill-instant-move', manaCost: 0, basePower: 0, sourceStatus: 'unverified' },
    { id: 'cardUnknownSkill', name: '技能牌（待核验）', kind: 'skill', assetPath: 'fate-domination/cards/skill-unknown', manaCost: 0, basePower: 0, sourceStatus: 'unverified' },
];

export const FATE_ATTACK_BY_ID = Object.fromEntries(FATE_ATTACK_CARDS.map((card) => [card.id, card])) as Record<string, AttackCardDefinition>;
