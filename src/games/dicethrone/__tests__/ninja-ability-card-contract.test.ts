import { describe, expect, it } from 'vitest';
import type { DiceThroneCore, DiceThroneEvent } from '../domain/types';
import type { Die } from '../domain/types';
import { execute } from '../domain/execute';
import { reduce } from '../domain/reducer';
import { RESOURCE_IDS } from '../domain/resources';
import { NINJA_DICE_FACE_IDS, TOKEN_IDS } from '../domain/ids';
import { resolveAttack } from '../domain/attack';
import { resolveEffectsToEvents } from '../domain/effects';
import { checkPlayCard, getAvailableAbilityIds } from '../domain/rules';
import { getAbilitySlotIdForCharacter, slotContainsAbilityIdForCharacter } from '../ui/abilitySlotMapping';
import { NINJA_CARDS } from '../heroes/ninja/cards';
import { BLINK_2, GOING_FORWARD_2, SHADOW_FANG_2, SHADOW_STEP_2 } from '../heroes/ninja/abilities';
import { createHeroMatchup, createQueuedRandom } from './test-utils';

const applyEvents = (core: DiceThroneCore, events: DiceThroneEvent[]): DiceThroneCore =>
    events.reduce((current, event) => reduce(current, event), core);

function createNinjaDie(value: number): Die {
    const faceMap: Record<number, string> = {
        1: NINJA_DICE_FACE_IDS.KATANA,
        2: NINJA_DICE_FACE_IDS.KATANA,
        3: NINJA_DICE_FACE_IDS.KATANA,
        4: NINJA_DICE_FACE_IDS.SHURIKEN,
        5: NINJA_DICE_FACE_IDS.SHURIKEN,
        6: NINJA_DICE_FACE_IDS.MASK,
    };

    return {
        id: `ninja-die-${value}`,
        definitionId: 'ninja-dice',
        value,
        symbol: faceMap[value] as any,
        symbols: [faceMap[value]],
        isKept: false,
    };
}

describe('DiceThrone Ninja 能力与卡牌合同', () => {
    const command = (type: string, playerId: string, payload: Record<string, unknown> = {}) => ({
        type,
        playerId,
        payload,
        timestamp: 100,
    } as any);

    it('Ninja v2 面板槽位应按角色实图映射四个中间技能槽', () => {
        expect(getAbilitySlotIdForCharacter('ninja', 'poison-blade')).toBe('combo');
        expect(getAbilitySlotIdForCharacter('ninja', 'death-blossom')).toBe('sky');
        expect(getAbilitySlotIdForCharacter('ninja', 'smoke-screen')).toBe('lotus');
        expect(getAbilitySlotIdForCharacter('ninja', 'shadow-step')).toBe('lightning');

        expect(slotContainsAbilityIdForCharacter('ninja', 'lotus', 'smoke-screen')).toBe(true);
        expect(slotContainsAbilityIdForCharacter('ninja', 'lotus', 'shadow-step')).toBe(false);
        expect(slotContainsAbilityIdForCharacter('ninja', 'lightning', 'shadow-step')).toBe(true);
        expect(slotContainsAbilityIdForCharacter('ninja', 'lightning', 'smoke-screen')).toBe(false);

        expect(getAbilitySlotIdForCharacter('moon_elf', 'entangling-shot')).toBe('sky');
        expect(getAbilitySlotIdForCharacter('monk', 'taiji-combo')).toBe('combo');
    });

    it('Ninja 的骰面合同应分别命中烟雾阵和暗影步，不应互相串槽', () => {
        const smokeState = createHeroMatchup('ninja', 'treant')(['0', '1'], createQueuedRandom([1]));
        smokeState.core.activePlayerId = '0';
        smokeState.core.rollDiceCount = 4;
        smokeState.core.dice = [1, 4, 5, 6].map(createNinjaDie);

        expect(getAvailableAbilityIds(smokeState.core, '0', 'offensiveRoll')).toContain('smoke-screen');
        expect(getAvailableAbilityIds(smokeState.core, '0', 'offensiveRoll')).not.toContain('shadow-step');

        const shadowState = createHeroMatchup('ninja', 'treant')(['0', '1'], createQueuedRandom([1]));
        shadowState.core.activePlayerId = '0';
        shadowState.core.rollDiceCount = 4;
        shadowState.core.dice = [6, 6, 6, 6].map(createNinjaDie);

        expect(getAvailableAbilityIds(shadowState.core, '0', 'offensiveRoll')).toContain('shadow-step');
        expect(getAvailableAbilityIds(shadowState.core, '0', 'offensiveRoll')).not.toContain('smoke-screen');
    });

    it('Shadow Step II 在 4 个面具时应同时暴露 3 面具和 4 面具两个分支', () => {
        const state = createHeroMatchup('ninja', 'treant')(['0', '1'], createQueuedRandom([1]));
        state.core.activePlayerId = '0';
        state.core.rollDiceCount = 5;
        state.core.rollConfirmed = true;
        state.core.players['0'].abilities = state.core.players['0'].abilities.map(ability => (
            ability.id === 'shadow-step' ? SHADOW_STEP_2 : ability
        ));
        state.core.players['0'].abilityLevels['shadow-step'] = 2;
        state.core.dice = [6, 6, 6, 6, 1].map(createNinjaDie);

        expect(getAvailableAbilityIds(state.core, '0', 'offensiveRoll')).toEqual(
            expect.arrayContaining(['shadow-step-2-main', 'shadow-step-2-strangle'])
        );
    });

    it('同卡双分支升级技能应按卡面上方主技能在前、下方分支在后展示', () => {
        expect(GOING_FORWARD_2.variants?.map(variant => variant.id)).toEqual([
            'going-forward-2-main',
            'going-forward-2-bleed',
        ]);
        expect(SHADOW_STEP_2.variants?.map(variant => variant.id)).toEqual([
            'shadow-step-2-main',
            'shadow-step-2-strangle',
        ]);
        expect(SHADOW_FANG_2.variants?.map(variant => variant.id)).toEqual([
            'shadow-fang-2-main',
            'shadow-fang-2-deceive',
        ]);
    });

    it('Blink 基础版应按防御投已出的骰面结算固定反击与烟雾弹，而不是额外奖励骰累计', () => {
        const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        state.core.players['0'].resources[RESOURCE_IDS.HP] = 30;
        state.core.players['1'].tokens[TOKEN_IDS.SMOKE_BOMB] = 0;
        state.core.dice = [1, 4, 6].map(createNinjaDie);
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: undefined,
            defenseAbilityId: 'blink',
            isDefendable: true,
            damage: 0,
        };

        const events = resolveAttack(state.core, createQueuedRandom([1]), undefined, 100);
        const next = applyEvents(state.core, events);

        expect(events.filter(event => event.type === 'BONUS_DIE_ROLLED')).toHaveLength(0);
        expect(events.some(event => event.type === 'ATTACK_DEFENSE_RESOLVED')).toBe(true);
        expect(next.players['0'].resources[RESOURCE_IDS.HP]).toBe(27);
        expect(next.players['1'].tokens[TOKEN_IDS.SMOKE_BOMB]).toBe(1);
    });

    it('Blink II 应按忍刀数量结算伤害，手里剑固定 +2，且只有两个面具才给烟雾弹', () => {
        const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        state.core.players['0'].resources[RESOURCE_IDS.HP] = 30;
        state.core.players['1'].tokens[TOKEN_IDS.SMOKE_BOMB] = 0;
        state.core.players['1'].abilities = state.core.players['1'].abilities.map(ability => (
            ability.id === 'blink' ? BLINK_2 : ability
        ));
        state.core.players['1'].abilityLevels.blink = 2;
        state.core.dice = [1, 2, 4].map(createNinjaDie);
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: undefined,
            defenseAbilityId: 'blink',
            isDefendable: true,
            damage: 0,
        };

        let events = resolveAttack(state.core, createQueuedRandom([1]), undefined, 100);
        let next = applyEvents(state.core, events);

        expect(events.filter(event => event.type === 'BONUS_DIE_ROLLED')).toHaveLength(0);
        expect(next.players['0'].resources[RESOURCE_IDS.HP]).toBe(26);
        expect(next.players['1'].tokens[TOKEN_IDS.SMOKE_BOMB]).toBe(0);

        state.core.players['0'].resources[RESOURCE_IDS.HP] = 30;
        state.core.players['1'].tokens[TOKEN_IDS.SMOKE_BOMB] = 0;
        state.core.dice = [1, 6, 6].map(createNinjaDie);

        events = resolveAttack(state.core, createQueuedRandom([1]), undefined, 200);
        next = applyEvents(state.core, events);

        expect(next.players['0'].resources[RESOURCE_IDS.HP]).toBe(29);
        expect(next.players['1'].tokens[TOKEN_IDS.SMOKE_BOMB]).toBe(1);
    });

    it('upgrade-blink-2 打出后应通过真实升级链替换防御技能并按 Blink II 结算', () => {
        const state = createHeroMatchup('ninja', 'treant')(['0', '1'], createQueuedRandom([1]));
        state.sys.phase = 'main1';
        state.core.players['0'].hand = [
            JSON.parse(JSON.stringify(NINJA_CARDS.find(card => card.id === 'upgrade-blink-2'))),
        ];
        state.core.players['0'].resources[RESOURCE_IDS.CP] = 3;

        const upgradeEvents = execute(state, command('PLAY_CARD', '0', { cardId: 'upgrade-blink-2' }), createQueuedRandom([1]));
        const upgradedCore = applyEvents(state.core, upgradeEvents);

        expect(upgradedCore.players['0'].abilityLevels.blink).toBe(2);
        expect(upgradedCore.players['0'].abilities.find(ability => ability.id === 'blink')).toMatchObject({
            id: 'blink',
            effects: BLINK_2.effects,
        });

        const defenseState = {
            core: {
                ...upgradedCore,
                pendingAttack: {
                    attackerId: '1',
                    defenderId: '0',
                    sourceAbilityId: 'shattering-fist',
                    defenseAbilityId: 'blink',
                    isDefendable: true,
                    damage: 0,
                },
                dice: [1, 2, 4].map(createNinjaDie),
            },
            sys: { phase: 'defensiveRoll' },
        };

        const next = applyEvents(defenseState.core, resolveAttack(defenseState.core, createQueuedRandom([1]), undefined, 200));
        expect(next.players['1'].resources[RESOURCE_IDS.HP]).toBe(46);
        expect(next.players['0'].tokens[TOKEN_IDS.SMOKE_BOMB]).toBe(0);
    });

    it('攻击被 Ninja 忍术改成不可防御后，不应再执行已挂载的防御技能', () => {
        const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        state.core.players['0'].resources[RESOURCE_IDS.HP] = 30;
        state.core.players['1'].tokens[TOKEN_IDS.SMOKE_BOMB] = 0;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: undefined,
            defenseAbilityId: 'blink',
            isDefendable: false,
            damage: 0,
        };

        const events = resolveAttack(state.core, createQueuedRandom([1, 4, 6]), undefined, 100);
        const next = applyEvents(state.core, events);

        expect(events.some(event => event.type === 'BONUS_DIE_ROLLED')).toBe(false);
        expect(events.some(event => event.type === 'ATTACK_DEFENSE_RESOLVED')).toBe(false);
        expect(next.players['0'].resources[RESOURCE_IDS.HP]).toBe(30);
        expect(next.players['1'].tokens[TOKEN_IDS.SMOKE_BOMB]).toBe(0);
    });

    it('刀扇应为主要阶段行动牌，不得作为投掷阶段攻击修正打出', () => {
        const state = createHeroMatchup('ninja', 'treant')(['0', '1'], createQueuedRandom([1]));
        const card = NINJA_CARDS.find(item => item.id === 'ninja-card-knife-fan');

        expect(card).toBeDefined();
        expect(card?.timing).toBe('main');
        expect(card?.isAttackModifier).not.toBe(true);

        state.core.players['0'].resources[RESOURCE_IDS.CP] = 2;
        expect(checkPlayCard(state.core, '0', card!, 'main1')).toEqual({ ok: true });
        expect(checkPlayCard(state.core, '0', card!, 'offensiveRoll')).toEqual({
            ok: false,
            reason: 'wrongPhaseForMain',
        });
    });

    it('道场应按卡图投 1 骰：面具获得烟雾弹和 2 忍术，否则抽 1', () => {
        const dojo = NINJA_CARDS.find(item => item.id === 'ninja-card-dojo');
        expect(dojo).toBeDefined();

        let state = createHeroMatchup('ninja', 'treant')(['0', '1'], createQueuedRandom([1]));
        state.core.players['0'].tokens[TOKEN_IDS.SMOKE_BOMB] = 0;
        state.core.players['0'].tokens[TOKEN_IDS.NINJUTSU] = 0;

        let events = resolveEffectsToEvents(
            dojo?.effects ?? [],
            'immediate',
            { attackerId: '0', defenderId: '1', sourceAbilityId: 'ninja-card-dojo', state: state.core, damageDealt: 0, timestamp: 100 },
            { random: createQueuedRandom([6]) },
        );
        let next = applyEvents(state.core, events);

        expect(events.filter(event => event.type === 'BONUS_DIE_ROLLED')).toHaveLength(1);
        expect(events.some(event => event.type === 'CARD_DRAWN')).toBe(false);
        expect(next.players['0'].tokens[TOKEN_IDS.SMOKE_BOMB]).toBe(1);
        expect(next.players['0'].tokens[TOKEN_IDS.NINJUTSU]).toBe(2);

        state = createHeroMatchup('ninja', 'treant')(['0', '1'], createQueuedRandom([1]));
        state.core.players['0'].tokens[TOKEN_IDS.SMOKE_BOMB] = 0;
        state.core.players['0'].tokens[TOKEN_IDS.NINJUTSU] = 0;
        const handBefore = state.core.players['0'].hand.length;
        const deckBefore = state.core.players['0'].deck.length;

        events = resolveEffectsToEvents(
            dojo?.effects ?? [],
            'immediate',
            { attackerId: '0', defenderId: '1', sourceAbilityId: 'ninja-card-dojo', state: state.core, damageDealt: 0, timestamp: 200 },
            { random: createQueuedRandom([1]) },
        );
        next = applyEvents(state.core, events);

        expect(events.filter(event => event.type === 'BONUS_DIE_ROLLED')).toHaveLength(1);
        expect(events.filter(event => event.type === 'CARD_DRAWN')).toHaveLength(1);
        expect(next.players['0'].tokens[TOKEN_IDS.SMOKE_BOMB]).toBe(0);
        expect(next.players['0'].tokens[TOKEN_IDS.NINJUTSU]).toBe(0);
        expect(next.players['0'].hand).toHaveLength(handBefore + 1);
        expect(next.players['0'].deck).toHaveLength(deckBefore - 1);
    });
});
