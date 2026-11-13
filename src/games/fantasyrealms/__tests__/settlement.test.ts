import { describe, expect, it } from 'vitest';
import { ALL_FANTASY_REALMS_CARDS } from '../data/cards';
import { FantasyRealmsDomain } from '../domain';
import { beginSettlement, applySettlementChoice, getSettlementOptions } from '../domain/settlement';
import { evaluateFantasyRealmsResolvedScore } from '../domain/scoring';
import type { FantasyRealmsCore } from '../domain/types';

const card = (id: string) => ({ ...ALL_FANTASY_REALMS_CARDS.find((entry) => entry.id === id)! });
const random = { random: () => .5, d: () => 1, range: (min: number) => min, shuffle: <T,>(v: T[]) => v };
function setup(hands: string[][], discard: string[] = [], draw: string[] = []): FantasyRealmsCore {
    const core = FantasyRealmsDomain.setup(['0', '1', '2'], random);
    for (let i = 0; i < 3; i++) core.players[String(i)]!.hand = hands[i]!.map(card);
    core.drawPile = draw.map(card);
    core.discardPile = discard.map(card);
    return beginSettlement({ ...core, stage: 'settlement' });
}

describe('终局选择的服务端状态', () => {
    it('死灵术士可由本人选择弃牌，不能悄悄选最高分', () => {
        let core = setup([['wizard-necromancer'], [], []], ['leader-king', 'beast-dragon']);
        expect(core.currentPlayer).toBe('0');
        expect(core.settlement?.step).toBe('necromancer');
        expect(getSettlementOptions(core).map((x) => x.choice.cardId)).toEqual([undefined, 'leader-king', 'beast-dragon']);
        core = applySettlementChoice(core, { cardId: 'leader-king' });
        expect(core.players['0']!.hand.map((x) => x.id)).toEqual(['wizard-necromancer', 'leader-king']);
        expect(core.discardPile.map((x) => x.id)).toEqual(['beast-dragon']);
        expect(core.settlement?.step).toBe('done');
    });
    it('变形怪的选定名称及花色改变实际计分', () => {
        let core = setup([['wild-shapeshifter', 'beast-warhorse'], [], []]);
        expect(core.settlement?.step).toBe('shapeshifter');
        core = applySettlementChoice(core, { cardId: 'leader-king' });
        const score = evaluateFantasyRealmsResolvedScore(core.players['0']!.hand, [], core.settlement!.selections['0']!);
        expect(score.totalScore).toBe(20);
    });
    it('二重身先复制变形前的自然牌，变形怪后来选择领导不改变二重身', () => {
        let core = setup([['wild-doppelganger', 'wild-shapeshifter', 'beast-warhorse'], [], []]);
        core = applySettlementChoice(core, { cardId: 'wild-shapeshifter' });
        core = applySettlementChoice(core, { cardId: 'leader-king' });
        const result = evaluateFantasyRealmsResolvedScore(core.players['0']!.hand, [], core.settlement!.selections['0']!);
        expect(result.cardDeltas.find((entry) => entry.cardId === 'beast-warhorse')?.totalDelta).toBe(20);
    });
    it('岛屿候选按二重身复制时的类别判断，不跟随幻象之后的变化', () => {
        let core = setup([['wild-doppelganger', 'wild-mirage', 'flood-island'], [], []]);
        core = applySettlementChoice(core, { cardId: 'wild-mirage' });
        core = applySettlementChoice(core, { cardId: 'flood-swamp' });
        expect(core.settlement?.step).toBe('island');
        expect(getSettlementOptions(core).some((entry) => entry.choice.cardId === 'wild-mirage')).toBe(true);
        expect(getSettlementOptions(core).some((entry) => entry.choice.cardId === 'wild-doppelganger')).toBe(false);
    });
    it('变化之书改变原牌后，二重身保留先前复制的类别', () => {
        let core = setup([['wild-doppelganger', 'flood-island', 'artifact-book-of-changes'], [], []]);
        core = applySettlementChoice(core, { cardId: 'flood-island' });
        core = applySettlementChoice(core, { cardId: 'flood-island', suit: '武器' });
        expect(core.settlement?.step).toBe('island');
        const candidates = getSettlementOptions(core).map((entry) => entry.choice.cardId);
        expect(candidates).toContain('wild-doppelganger');
        expect(candidates).not.toContain('flood-island');
    });
    it('森林按牌面为两张同名精灵射手分别加分', () => {
        let core = setup([['wild-doppelganger', 'army-elven-archers', 'land-forest'], [], []]);
        core = applySettlementChoice(core, { cardId: 'army-elven-archers' });
        const result = evaluateFantasyRealmsResolvedScore(core.players['0']!.hand, [], core.settlement!.selections['0']!);
        expect(result.cardDeltas.find((entry) => entry.cardId === 'land-forest')?.totalDelta).toBe(31);
    });
    it('二重身复制烟雾且无火时，两张烟雾均无效，不影响飞艇', () => {
        let core = setup([['wild-doppelganger', 'weather-smoke', 'weapon-war-dirigible', 'army-dwarvish-infantry'], [], []]);
        core = applySettlementChoice(core, { cardId: 'weather-smoke' });
        const result = evaluateFantasyRealmsResolvedScore(core.players['0']!.hand, [], core.settlement!.selections['0']!);
        expect(result.cardDeltas.find((entry) => entry.cardId === 'wild-doppelganger')?.isBlanked).toBe(true);
        expect(result.cardDeltas.find((entry) => entry.cardId === 'weather-smoke')?.isBlanked).toBe(true);
        expect(result.cardDeltas.find((entry) => entry.cardId === 'weapon-war-dirigible')?.isBlanked).toBe(false);
    });
    it('巫妖对二重身复制出的两张同名死灵术士分别加分', () => {
        let core = setup([['undead-lich', 'wizard-necromancer', 'wild-doppelganger'], [], []]);
        expect(core.settlement?.step).toBe('doppelganger');
        core = applySettlementChoice(core, { cardId: 'wizard-necromancer' });
        const result = evaluateFantasyRealmsResolvedScore(core.players['0']!.hand, [], core.settlement!.selections['0']!);
        expect(result.cardDeltas.find((entry) => entry.cardId === 'undead-lich')?.totalDelta).toBe(43);
    });
    it('小妖精先摸牌，巨灵随后可检索剩余牌库', () => {
        const core = setup([['outsider-leprechaun', 'outsider-genie'], [], []], [], ['leader-king', 'leader-queen']);
        expect(core.players['0']!.hand.some((x) => x.id === 'leader-king')).toBe(true);
        expect(core.settlement?.step).toBe('genie');
        expect(getSettlementOptions(core).map((x) => x.choice.cardId)).toEqual(['leader-queen']);
    });
    it('跨玩家按效果阶段处理，不能替玩家自动选择', () => {
        let core = setup([['wizard-necromancer'], ['outsider-genie'], []], ['leader-king'], ['leader-queen', 'beast-dragon']);
        expect(core.settlement?.step).toBe('genie');
        expect(core.currentPlayer).toBe('1');
        core = applySettlementChoice(core, { cardId: 'beast-dragon' });
        expect(core.players['1']!.hand.map((entry) => entry.id)).toEqual(['outsider-genie', 'beast-dragon']);
        expect(core.settlement?.step).toBe('necromancer');
        expect(core.currentPlayer).toBe('0');
        expect(core.players['0']!.hand.map((entry) => entry.id)).toEqual(['wizard-necromancer']);
        core = applySettlementChoice(core, { skip: true });
        expect(core.discardPile.map((entry) => entry.id)).toEqual(['leader-king']);
        expect(core.settlement?.step).toBe('done');
    });
    it('岛屿只接受指定的洪流或烈焰，玩家选中后才结算', () => {
        let core = setup([['flood-island', 'flame-wildfire', 'leader-queen'], [], []]);
        expect(core.settlement?.step).toBe('island');
        expect(getSettlementOptions(core).some((x) => x.choice.cardId === 'leader-queen')).toBe(false);
        core = applySettlementChoice(core, { cardId: 'flame-wildfire' });
        expect(core.settlement!.selections['0']!.islandTargetId).toBe('flame-wildfire');
        expect(core.settlement?.step).toBe('done');
    });
    it('拿走最后公开牌后仍能终局，计分使用真人明确选项', () => {
        let core = setup([['wizard-necromancer', 'flame-wildfire', 'flood-island', 'leader-princess'], [], []], ['leader-king']);
        core = applySettlementChoice(core, { cardId: 'leader-king' });
        expect(core.discardPile).toHaveLength(0);
        expect(core.settlement?.step).toBe('island');
        core = applySettlementChoice(core, { cardId: 'flame-wildfire' });
        const result = FantasyRealmsDomain.isGameOver?.(core);
        expect(result?.scores?.['0']).toBe(evaluateFantasyRealmsResolvedScore(core.players['0']!.hand, [], core.settlement!.selections['0']!).totalScore);
    });
    it('九张上限强制弃牌且不能弃掉已用于取牌的小妖精', () => {
        const hand = ['outsider-leprechaun', 'leader-king', 'leader-queen', 'leader-princess', 'flame-candle', 'flame-lightning', 'weather-smoke', 'weather-rainstorm', 'beast-dragon'];
        let core = setup([hand, [], []], [], ['army-rangers']);
        expect(core.settlement?.overflowPlayerId).toBe('0');
        const options = getSettlementOptions(core);
        expect(options.some((x) => x.choice.cardId === 'outsider-leprechaun')).toBe(false);
        core = applySettlementChoice(core, { cardId: 'leader-king' });
        expect(core.players['0']!.hand).toHaveLength(9);
        expect(core.discardPile.some((x) => x.id === 'leader-king')).toBe(true);
    });
    it('只能由当前决策者提交合法候选，其他玩家不能代选', () => {
        const core = setup([['wizard-necromancer'], [], []], ['leader-king']);
        const state = { core, sys: {} } as any;
        expect(FantasyRealmsDomain.validate(state, { type: 'RESOLVE_SETTLEMENT', playerId: '1', payload: { cardId: 'leader-king' } })).toMatchObject({ valid: false });
        expect(FantasyRealmsDomain.validate(state, { type: 'RESOLVE_SETTLEMENT', playerId: '0', payload: { cardId: 'beast-dragon' } })).toMatchObject({ valid: false });
        expect(FantasyRealmsDomain.validate(state, { type: 'RESOLVE_SETTLEMENT', playerId: '0', payload: { cardId: 'leader-king' } })).toMatchObject({ valid: true });
    });
    it('仅巨灵的操作者可在检索时查看牌库，其他人仍是背面', () => {
        const core = setup([['outsider-genie'], [], []], [], ['leader-king', 'leader-queen']);
        const owner = FantasyRealmsDomain.playerView!(core, '0');
        const opponent = FantasyRealmsDomain.playerView!(core, '1');
        expect(owner.drawPile?.map((x) => x.id)).toEqual(['leader-king', 'leader-queen']);
        expect(opponent.drawPile?.every((x) => x.id.startsWith('__fantasyrealms_hidden_draw__'))).toBe(true);
    });

    it('天使选择烟雾时能阻止其因缺少烈焰自行无效化', () => {
        let core = setup([['outsider-angel', 'weather-smoke'], [], []]);
        expect(core.settlement?.step).toBe('angel');
        core = applySettlementChoice(core, { cardId: 'weather-smoke' });
        const result = evaluateFantasyRealmsResolvedScore(core.players['0']!.hand, [], core.settlement!.selections['0']!);
        expect(result.cardDeltas.find((entry) => entry.cardId === 'weather-smoke')?.totalDelta).toBe(27);
    });

    it('受天使保护的野火不会被大洪水排除，仍会无效化领导', () => {
        let core = setup([['outsider-angel', 'flood-great-flood', 'flame-wildfire', 'leader-princess'], [], []]);
        core = applySettlementChoice(core, { cardId: 'flame-wildfire' });
        const result = evaluateFantasyRealmsResolvedScore(core.players['0']!.hand, [], core.settlement!.selections['0']!);
        expect(result.cardDeltas.find((entry) => entry.cardId === 'flame-wildfire')?.isBlanked).toBe(false);
        expect(result.cardDeltas.find((entry) => entry.cardId === 'leader-princess')?.isBlanked).toBe(true);
    });

    it('死灵术士被恶魔无效后，终局已确定的亡灵免疫仍对野火生效', () => {
        let core = setup([['wizard-necromancer', 'undead-ghoul', 'outsider-demon', 'flame-wildfire', 'flame-candle'], [], []]);
        expect(core.settlement?.step).toBe('done');
        const result = evaluateFantasyRealmsResolvedScore(core.players['0']!.hand, [], core.settlement!.selections['0']!);
        expect(result.cardDeltas.find((entry) => entry.cardId === 'wizard-necromancer')?.isBlanked).toBe(true);
        expect(result.cardDeltas.find((entry) => entry.cardId === 'undead-ghoul')?.isBlanked).toBe(false);
    });

    it('变化之书按本人选择的花色改变组合，而非自动选择高分', () => {
        let core = setup([['flame-candle', 'artifact-book-of-changes', 'land-bell-tower', 'artifact-protection-rune'], [], []]);
        expect(core.settlement?.step).toBe('book');
        core = applySettlementChoice(core, { cardId: 'artifact-protection-rune', suit: '法师' });
        const result = evaluateFantasyRealmsResolvedScore(core.players['0']!.hand, [], core.settlement!.selections['0']!);
        expect(result.cardDeltas.find((entry) => entry.cardId === 'flame-candle')?.bonus).toBe(100);
        expect(core.settlement!.selections['0']!.bookTargetId).toBe('artifact-protection-rune');
    });

    it.each(['flood-fountain-of-life', 'flood-fountain-of-life-ch'])('生命之泉 %s 使用玩家选择的牌计算奖励', (fountainId) => {
        let core = setup([[fountainId, 'land-mountain', 'flame-candle'], [], []]);
        expect(core.settlement?.step).toBe('fountain');
        core = applySettlementChoice(core, { cardId: 'flame-candle' });
        const result = evaluateFantasyRealmsResolvedScore(core.players['0']!.hand, [], core.settlement!.selections['0']!);
        expect(result.cardDeltas.find((entry) => entry.cardId === fountainId)?.bonus).toBe(2);
    });

    it('未变形的野牌被野火无效，变成武器后则免于野火', () => {
        const hand = [card('flame-wildfire'), card('wild-shapeshifter'), card('flame-forge')];
        let core = setup([hand.map((x) => x.id), [], []]);
        const skipped = applySettlementChoice(core, { skip: true });
        expect(evaluateFantasyRealmsResolvedScore(skipped.players['0']!.hand, [], skipped.settlement!.selections['0']!).cardDeltas.find((x) => x.cardId === 'wild-shapeshifter')?.isBlanked).toBe(true);
        core = applySettlementChoice(core, { cardId: 'weapon-magic-wand' });
        const withWeapon = evaluateFantasyRealmsResolvedScore(core.players['0']!.hand, [], core.settlement!.selections['0']!);
        expect(withWeapon.cardDeltas.find((x) => x.cardId === 'wild-shapeshifter')?.isBlanked).toBe(false);
        expect(withWeapon.cardDeltas.find((x) => x.cardId === 'flame-forge')?.bonus).toBe(9);
    });

});
