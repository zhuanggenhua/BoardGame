import { describe, expect, it } from 'vitest';
import type { DiceThroneCore, DiceThroneEvent } from '../domain/types';
import { reduce } from '../domain/reducer';
import { RESOURCE_IDS } from '../domain/resources';
import { TOKEN_IDS, TREANT_DICE_FACE_IDS } from '../domain/ids';
import { resolveAttack, resolveOffensivePreDefenseEffects } from '../domain/attack';
import { resolveEffectsToEvents } from '../domain/effects';
import { getAvailableAbilityIds } from '../domain/rules';
import { NATURE_TOUCH_2, ROOTED_2, SHATTERING_FIST_2, SHATTERING_FIST_3, TEND_CARE_2, WILD_GROWTH_2 } from '../heroes/treant/abilities';
import { TREANT_CARDS } from '../heroes/treant/cards';
import { getAbilitySlotIdForCharacter, slotContainsAbilityIdForCharacter } from '../ui/abilitySlotMapping';
import { createHeroMatchup, createQueuedRandom } from './test-utils';

const applyEvents = (core: DiceThroneCore, events: DiceThroneEvent[]): DiceThroneCore =>
    events.reduce((current, event) => reduce(current, event), core);

describe('DiceThrone Treant 能力与卡牌合同', () => {
    it('Treant v2 面板槽位应把 passive / defense 绑定到真实槽位', () => {
        expect(getAbilitySlotIdForCharacter('treant', 'quiet-cultivation')).toBe('sky');
        expect(getAbilitySlotIdForCharacter('treant', 'wild-growth')).toBe('lotus');
        expect(getAbilitySlotIdForCharacter('treant', 'vengeful-vines')).toBe('combo');
        expect(getAbilitySlotIdForCharacter('treant', 'nature-touch')).toBe('lightning');
        expect(getAbilitySlotIdForCharacter('treant', 'rooted')).toBe('meditate');

        expect(slotContainsAbilityIdForCharacter('treant', 'sky', 'quiet-cultivation')).toBe(true);
        expect(slotContainsAbilityIdForCharacter('treant', 'sky', 'vengeful-vines')).toBe(false);
        expect(slotContainsAbilityIdForCharacter('treant', 'calm', 'rooted')).toBe(false);
        expect(slotContainsAbilityIdForCharacter('treant', 'meditate', 'rooted')).toBe(true);
    });

    it('Treant 末尾专属卡不应继续使用越界图集索引', () => {
        const shatteringFist2 = TREANT_CARDS.find(card => card.id === 'upgrade-shattering-fist-2');
        const planting = TREANT_CARDS.find(card => card.id === 'treant-card-planting');

        expect(shatteringFist2?.sourceAtlasIndex).toBe(30);
        expect(shatteringFist2?.previewRef).toMatchObject({ type: 'atlas', index: 30 });
        expect(planting?.sourceAtlasIndex).toBe(31);
        expect(planting?.previewRef).toMatchObject({ type: 'atlas', index: 31 });
    });

    it('Rooted 防御应按树枝与树灵总数防止伤害，不再按树枝反击或逐骰发 token', () => {
        const state = createHeroMatchup('ninja', 'treant')(['0', '1'], createQueuedRandom([1]));
        state.core.players['0'].resources[RESOURCE_IDS.HP] = 30;
        state.core.players['1'].resources[RESOURCE_IDS.HP] = 50;
        state.core.players['1'].tokens[TOKEN_IDS.TREANT_SEEDLING] = 0;
        state.core.players['1'].tokens[TOKEN_IDS.LIFE_SAP] = 0;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'slash-3',
            defenseAbilityId: 'rooted',
            isDefendable: true,
            damage: 0,
        };

        const events = resolveAttack(state.core, createQueuedRandom([1, 4, 6]), undefined, 100);
        const next = applyEvents(state.core, events);

        expect(events.filter(event => event.type === 'BONUS_DIE_ROLLED')).toHaveLength(3);
        expect(events.some(event => event.type === 'ATTACK_DEFENSE_RESOLVED')).toBe(true);
        expect(events.some(event => event.type === 'CHOICE_REQUESTED')).toBe(false);
        expect(next.players['0'].resources[RESOURCE_IDS.HP]).toBe(30);
        expect(next.players['1'].resources[RESOURCE_IDS.HP]).toBe(47);
        expect(next.players['1'].tokens[TOKEN_IDS.TREANT_SEEDLING]).toBe(0);
        expect(next.players['1'].tokens[TOKEN_IDS.LIFE_SAP]).toBe(0);
    });

    it('Rooted 防御投出两树叶时应选择养成 1 树灵后再结算伤害', () => {
        const state = createHeroMatchup('ninja', 'treant')(['0', '1'], createQueuedRandom([1]));
        state.core.players['1'].resources[RESOURCE_IDS.HP] = 50;
        state.core.players['1'].tokens[TOKEN_IDS.TREANT_SEEDLING] = 1;
        state.core.players['1'].tokens[TOKEN_IDS.TREANT_SAPLING] = 0;
        state.core.players['1'].tokens[TOKEN_IDS.TREANT_DIVINE] = 0;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'slash-3',
            defenseAbilityId: 'rooted',
            isDefendable: true,
            damage: 0,
        };

        const defenseEvents = resolveAttack(state.core, createQueuedRandom([4, 5, 1]), undefined, 100);
        const choiceEvent = defenseEvents.find(event => event.type === 'CHOICE_REQUESTED');
        expect(choiceEvent).toBeDefined();
        const selectedOption = (choiceEvent as any).payload.options.find((option: { labelKey?: string }) =>
            option.labelKey === 'choices.treantRooted.s2_a0_d0_none'
        );
        expect(selectedOption).toBeDefined();

        let next = applyEvents(state.core, defenseEvents);
        next = reduce(next, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '1',
                sourceAbilityId: 'rooted',
                customId: selectedOption.customId,
                value: selectedOption.value,
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 101,
        } as DiceThroneEvent);
        expect(next.players['1'].tokens[TOKEN_IDS.TREANT_SEEDLING]).toBe(2);

        const attackEvents = resolveAttack(next, createQueuedRandom([1]), { includePreDefense: false }, 200);
        next = applyEvents(next, attackEvents);
        expect(next.players['1'].resources[RESOURCE_IDS.HP]).toBe(46);
    });

    it('Rooted II 防御应掷 4 骰，并在两树灵时选择 1 名玩家获得生命源泉', () => {
        const state = createHeroMatchup('ninja', 'treant')(['0', '1'], createQueuedRandom([1]));
        const treant = state.core.players['1'];
        const abilityIndex = treant.abilities.findIndex(ability => ability.id === 'rooted');
        treant.abilities[abilityIndex] = ROOTED_2;
        treant.abilityLevels['rooted'] = 2;
        treant.resources[RESOURCE_IDS.HP] = 50;
        treant.tokens[TOKEN_IDS.LIFE_SAP] = 0;
        state.core.players['0'].tokens[TOKEN_IDS.LIFE_SAP] = 0;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'slash-3',
            defenseAbilityId: 'rooted',
            isDefendable: true,
            damage: 0,
        };

        const defenseEvents = resolveAttack(state.core, createQueuedRandom([6, 6, 1, 4]), undefined, 100);
        expect(defenseEvents.filter(event => event.type === 'BONUS_DIE_ROLLED')).toHaveLength(4);
        const choiceEvent = defenseEvents.find(event => event.type === 'CHOICE_REQUESTED');
        expect(choiceEvent).toBeDefined();
        const selectedOption = (choiceEvent as any).payload.options.find((option: { labelKey?: string }) =>
            option.labelKey === 'choices.treantRooted.none_p0'
        );
        expect(selectedOption).toBeDefined();

        let next = applyEvents(state.core, defenseEvents);
        next = reduce(next, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '1',
                sourceAbilityId: 'rooted',
                customId: selectedOption.customId,
                value: selectedOption.value,
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 101,
        } as DiceThroneEvent);
        expect(next.players['1'].tokens[TOKEN_IDS.LIFE_SAP]).toBe(1);

        const attackEvents = resolveAttack(next, createQueuedRandom([1]), { includePreDefense: false }, 200);
        next = applyEvents(next, attackEvents);
        expect(next.players['1'].resources[RESOURCE_IDS.HP]).toBe(48);
    });

    it('Rooted 防御在不可防御攻击中不得执行', () => {
        const state = createHeroMatchup('ninja', 'treant')(['0', '1'], createQueuedRandom([1]));
        state.core.players['0'].resources[RESOURCE_IDS.HP] = 30;
        state.core.players['1'].tokens[TOKEN_IDS.TREANT_SEEDLING] = 0;
        state.core.players['1'].tokens[TOKEN_IDS.LIFE_SAP] = 0;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: undefined,
            defenseAbilityId: 'rooted',
            isDefendable: false,
            damage: 0,
        };

        const events = resolveAttack(state.core, createQueuedRandom([1, 4, 6]), undefined, 100);
        const next = applyEvents(state.core, events);

        expect(events.some(event => event.type === 'BONUS_DIE_ROLLED')).toBe(false);
        expect(events.some(event => event.type === 'ATTACK_DEFENSE_RESOLVED')).toBe(false);
        expect(next.players['0'].resources[RESOURCE_IDS.HP]).toBe(30);
        expect(next.players['1'].tokens[TOKEN_IDS.TREANT_SEEDLING]).toBe(0);
        expect(next.players['1'].tokens[TOKEN_IDS.LIFE_SAP]).toBe(0);
    });

    it('Quiet Cultivation 应按养成 1 树灵选择最终分布，而不是固定获得幼种', () => {
        const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        const treant = state.core.players['0'];
        treant.tokens[TOKEN_IDS.TREANT_SEEDLING] = 1;
        treant.tokens[TOKEN_IDS.TREANT_SAPLING] = 0;
        treant.tokens[TOKEN_IDS.TREANT_DIVINE] = 0;
        const quietCultivation = treant.abilities.find(ability => ability.id === 'quiet-cultivation');
        expect(quietCultivation).toBeDefined();

        const events = resolveEffectsToEvents(
            quietCultivation?.effects ?? [],
            'immediate',
            {
                attackerId: '0',
                defenderId: '0',
                sourceAbilityId: 'quiet-cultivation',
                state: state.core,
                damageDealt: 0,
                timestamp: 100,
            },
            { random: createQueuedRandom([1]) },
        );
        const choiceEvent = events.find(event => event.type === 'CHOICE_REQUESTED');
        expect(choiceEvent).toBeDefined();
        const selectedOption = (choiceEvent as any).payload.options.find((option: { labelKey?: string }) =>
            option.labelKey === 'choices.treantCultivate.s0_a1_d0'
        );
        expect(selectedOption).toBeDefined();

        let next = applyEvents(state.core, events);
        next = reduce(next, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '0',
                sourceAbilityId: 'quiet-cultivation',
                customId: selectedOption.customId,
                value: selectedOption.value,
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 101,
        } as DiceThroneEvent);

        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING]).toBe(0);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING]).toBe(1);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_DIVINE]).toBe(0);
    });

    it('Wild Growth II 升级后仍应在 2 树枝 + 3 树叶骰面下可选择', () => {
        const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        const treant = state.core.players['0'];
        const abilityIndex = treant.abilities.findIndex(ability => ability.id === 'wild-growth');
        treant.abilities[abilityIndex] = WILD_GROWTH_2;
        treant.abilityLevels['wild-growth'] = 2;
        state.core.activePlayerId = '0';
        state.core.rollDiceCount = 5;
        state.core.dice = state.core.dice.slice(0, 5).map((die, index) => ({
            ...die,
            id: index,
            value: [1, 2, 4, 4, 5][index],
            symbol: [
                TREANT_DICE_FACE_IDS.BRANCH,
                TREANT_DICE_FACE_IDS.BRANCH,
                TREANT_DICE_FACE_IDS.LEAF,
                TREANT_DICE_FACE_IDS.LEAF,
                TREANT_DICE_FACE_IDS.LEAF,
            ][index],
            ownerId: '0',
        }));

        expect(getAvailableAbilityIds(state.core, '0', 'offensiveRoll')).toContain('wild-growth');
    });

    it('Wild Growth II 应可移除至多 2 树灵加伤，并弃生命源泉使攻击不可防御', () => {
        const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        const treant = state.core.players['0'];
        const abilityIndex = treant.abilities.findIndex(ability => ability.id === 'wild-growth');
        treant.abilities[abilityIndex] = WILD_GROWTH_2;
        treant.abilityLevels['wild-growth'] = 2;
        treant.tokens[TOKEN_IDS.TREANT_SEEDLING] = 1;
        treant.tokens[TOKEN_IDS.TREANT_SAPLING] = 1;
        treant.tokens[TOKEN_IDS.LIFE_SAP] = 1;
        state.core.players['1'].resources[RESOURCE_IDS.HP] = 50;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'wild-growth',
            isDefendable: true,
            damage: 0,
        };

        const preDefenseEvents = resolveOffensivePreDefenseEffects(state.core, createQueuedRandom([1]), 100);
        const choiceEvent = preDefenseEvents.find(event => event.type === 'CHOICE_REQUESTED');
        expect(choiceEvent).toBeDefined();
        const selectedOption = (choiceEvent as any).payload.options.find((option: { labelKey?: string }) =>
            option.labelKey === 'choices.treantWildGrowth.seedling1_sapling1_life'
        );
        expect(selectedOption).toBeDefined();

        let next = applyEvents(state.core, preDefenseEvents);
        next = reduce(next, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '0',
                sourceAbilityId: 'wild-growth',
                customId: selectedOption.customId,
                value: selectedOption.value,
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 101,
        } as DiceThroneEvent);

        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING]).toBe(0);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING]).toBe(0);
        expect(next.players['0'].tokens[TOKEN_IDS.LIFE_SAP]).toBe(0);
        expect(next.pendingAttack?.bonusDamage).toBe(8);
        expect(next.pendingAttack?.isDefendable).toBe(false);

        const attackEvents = resolveAttack(next, createQueuedRandom([1]), { includePreDefense: false }, 200);
        expect(attackEvents.some(event => event.type === 'HEAL_APPLIED')).toBe(false);
        const damageEvent = attackEvents.find(event => event.type === 'DAMAGE_DEALT');
        expect((damageEvent as any).payload.amount).toBe(12);
        next = applyEvents(next, attackEvents);
        expect(next.players['1'].resources[RESOURCE_IDS.HP]).toBe(38);
    });

    it('Shattering Fist 基础版应可移除 1 树灵施加刺藤，并保留 5/6/7 伤害', () => {
        const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        const treant = state.core.players['0'];
        treant.tokens[TOKEN_IDS.TREANT_SEEDLING] = 1;
        state.core.players['1'].tokens[TOKEN_IDS.THORN] = 0;
        state.core.players['1'].resources[RESOURCE_IDS.HP] = 50;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'shattering-fist-3',
            isDefendable: true,
            damage: 0,
        };

        const preDefenseEvents = resolveOffensivePreDefenseEffects(state.core, createQueuedRandom([1]), 100);
        const choiceEvent = preDefenseEvents.find(event => event.type === 'CHOICE_REQUESTED');
        expect(choiceEvent).toBeDefined();
        const selectedOption = (choiceEvent as any).payload.options.find((option: { labelKey?: string }) =>
            option.labelKey === 'choices.treantShatteringFist.seedling'
        );
        expect(selectedOption).toBeDefined();

        let next = applyEvents(state.core, preDefenseEvents);
        next = reduce(next, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '0',
                sourceAbilityId: 'shattering-fist-3',
                customId: selectedOption.customId,
                value: selectedOption.value,
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 101,
        } as DiceThroneEvent);

        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING]).toBe(0);
        expect(next.players['1'].tokens[TOKEN_IDS.THORN]).toBe(1);

        const attackEvents = resolveAttack(next, createQueuedRandom([1]), { includePreDefense: false }, 200);
        const damageEvent = attackEvents.find(event => event.type === 'DAMAGE_DEALT');
        expect((damageEvent as any).payload.amount).toBe(5);
        next = applyEvents(next, attackEvents);
        expect(next.players['1'].resources[RESOURCE_IDS.HP]).toBe(45);
    });

    it('Shattering Fist II 应施加刺藤，并按图片造成 5/6/7 伤害', () => {
        const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        const treant = state.core.players['0'];
        const abilityIndex = treant.abilities.findIndex(ability => ability.id === 'shattering-fist');
        treant.abilities[abilityIndex] = SHATTERING_FIST_2;
        treant.abilityLevels['shattering-fist'] = 2;
        state.core.players['1'].tokens[TOKEN_IDS.THORN] = 0;
        state.core.players['1'].resources[RESOURCE_IDS.HP] = 50;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'shattering-fist-2-5',
            isDefendable: true,
            damage: 0,
        };

        const preDefenseEvents = resolveOffensivePreDefenseEffects(state.core, createQueuedRandom([1]), 100);
        expect(preDefenseEvents.some(event => event.type === 'CHOICE_REQUESTED')).toBe(false);
        let next = applyEvents(state.core, preDefenseEvents);
        expect(next.players['1'].tokens[TOKEN_IDS.THORN]).toBe(1);

        const attackEvents = resolveAttack(next, createQueuedRandom([1]), { includePreDefense: false }, 200);
        const damageEvent = attackEvents.find(event => event.type === 'DAMAGE_DEALT');
        expect((damageEvent as any).payload.amount).toBe(7);
        next = applyEvents(next, attackEvents);
        expect(next.players['1'].resources[RESOURCE_IDS.HP]).toBe(43);
    });

    it('Shattering Fist III 应在三同点时选择养成 1 树灵，并施加刺藤与 5/6/7 伤害', () => {
        const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        const treant = state.core.players['0'];
        const abilityIndex = treant.abilities.findIndex(ability => ability.id === 'shattering-fist');
        treant.abilities[abilityIndex] = SHATTERING_FIST_3;
        treant.abilityLevels['shattering-fist'] = 3;
        treant.tokens[TOKEN_IDS.TREANT_SEEDLING] = 0;
        treant.tokens[TOKEN_IDS.TREANT_SAPLING] = 0;
        treant.tokens[TOKEN_IDS.TREANT_DIVINE] = 0;
        state.core.players['1'].tokens[TOKEN_IDS.THORN] = 0;
        state.core.players['1'].resources[RESOURCE_IDS.HP] = 50;
        state.core.rollDiceCount = 5;
        state.core.dice = state.core.dice.slice(0, 5).map((die, index) => ({
            ...die,
            id: index,
            value: [2, 2, 2, 3, 4][index],
            symbol: TREANT_DICE_FACE_IDS.BRANCH,
            ownerId: '0',
        }));
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'shattering-fist-3-5',
            isDefendable: true,
            damage: 0,
        };

        const preDefenseEvents = resolveOffensivePreDefenseEffects(state.core, createQueuedRandom([1]), 100);
        const choiceEvent = preDefenseEvents.find(event => event.type === 'CHOICE_REQUESTED');
        expect(choiceEvent).toBeDefined();
        let next = applyEvents(state.core, preDefenseEvents);
        expect(next.players['1'].tokens[TOKEN_IDS.THORN]).toBe(1);

        const selectedOption = (choiceEvent as any).payload.options.find((option: { labelKey?: string }) =>
            option.labelKey === 'choices.treantCultivate.s1_a0_d0'
        );
        expect(selectedOption).toBeDefined();
        next = reduce(next, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '0',
                sourceAbilityId: 'shattering-fist-3-5',
                customId: selectedOption.customId,
                value: selectedOption.value,
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 101,
        } as DiceThroneEvent);

        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING]).toBe(1);

        const attackEvents = resolveAttack(next, createQueuedRandom([1]), { includePreDefense: false }, 200);
        const damageEvent = attackEvents.find(event => event.type === 'DAMAGE_DEALT');
        expect((damageEvent as any).payload.amount).toBe(7);
        next = applyEvents(next, attackEvents);
        expect(next.players['1'].resources[RESOURCE_IDS.HP]).toBe(43);
    });

    it('Tend & Care 应抽 1，并选择养成 3 树灵、生命源泉目标和刺藤目标', () => {
        const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING] = 1;
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING] = 0;
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_DIVINE] = 0;
        state.core.players['0'].tokens[TOKEN_IDS.LIFE_SAP] = 0;
        state.core.players['1'].tokens[TOKEN_IDS.LIFE_SAP] = 0;
        state.core.players['1'].tokens[TOKEN_IDS.THORN] = 0;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'tend-care',
            isDefendable: true,
            damage: 0,
        };
        const handBefore = state.core.players['0'].hand.length;

        const preDefenseEvents = resolveOffensivePreDefenseEffects(state.core, createQueuedRandom([1]), 100);
        const nextAfterEvents = applyEvents(state.core, preDefenseEvents);
        const choiceEvent = preDefenseEvents.find(event => event.type === 'CHOICE_REQUESTED');
        expect(choiceEvent).toBeDefined();
        expect(nextAfterEvents.players['0'].hand.length).toBe(handBefore + 1);

        const selectedOption = (choiceEvent as any).payload.options.find((option: { labelParams?: Record<string, unknown> }) =>
            option.labelParams?.seedling === 0
            && option.labelParams?.sapling === 2
            && option.labelParams?.divine === 0
            && option.labelParams?.lifeSapTarget === 'P2'
            && option.labelParams?.thornTarget === 'P2'
        );
        expect(selectedOption).toBeDefined();

        const next = reduce(nextAfterEvents, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '0',
                sourceAbilityId: 'tend-care',
                customId: selectedOption.customId,
                value: selectedOption.value,
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 101,
        } as DiceThroneEvent);

        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING]).toBe(0);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING]).toBe(2);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_DIVINE]).toBe(0);
        expect(next.players['1'].tokens[TOKEN_IDS.LIFE_SAP]).toBe(1);
        expect(next.players['1'].tokens[TOKEN_IDS.THORN]).toBe(1);
    });

    it('Tend & Care II 应按升级文本养成 4 树灵，而不是固定幼种 3 + 木苗 1', () => {
        const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        const treant = state.core.players['0'];
        const abilityIndex = treant.abilities.findIndex(ability => ability.id === 'tend-care');
        treant.abilities[abilityIndex] = TEND_CARE_2;
        treant.abilityLevels['tend-care'] = 2;
        treant.tokens[TOKEN_IDS.TREANT_SEEDLING] = 0;
        treant.tokens[TOKEN_IDS.TREANT_SAPLING] = 0;
        treant.tokens[TOKEN_IDS.TREANT_DIVINE] = 0;
        treant.tokens[TOKEN_IDS.LIFE_SAP] = 0;
        state.core.players['1'].tokens[TOKEN_IDS.THORN] = 0;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'tend-care',
            isDefendable: true,
            damage: 0,
        };

        const preDefenseEvents = resolveOffensivePreDefenseEffects(state.core, createQueuedRandom([1]), 100);
        const choiceEvent = preDefenseEvents.find(event => event.type === 'CHOICE_REQUESTED');
        expect(choiceEvent).toBeDefined();
        const selectedOption = (choiceEvent as any).payload.options.find((option: { labelParams?: Record<string, unknown> }) =>
            option.labelParams?.seedling === 2
            && option.labelParams?.sapling === 1
            && option.labelParams?.divine === 0
            && option.labelParams?.lifeSapTarget === 'P1'
            && option.labelParams?.thornTarget === 'P2'
        );
        expect(selectedOption).toBeDefined();

        let next = applyEvents(state.core, preDefenseEvents);
        next = reduce(next, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '0',
                sourceAbilityId: 'tend-care',
                customId: selectedOption.customId,
                value: selectedOption.value,
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 101,
        } as DiceThroneEvent);

        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING]).toBe(2);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING]).toBe(1);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_DIVINE]).toBe(0);
        expect(next.players['0'].tokens[TOKEN_IDS.LIFE_SAP]).toBe(1);
        expect(next.players['1'].tokens[TOKEN_IDS.THORN]).toBe(1);
    });

    it('Forest Awakens 应让自己和队友获得生命源泉，养成 5 树灵，施加刺藤后造成 10 伤害', () => {
        const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        state.core.players['2'] = JSON.parse(JSON.stringify(state.core.players['0']));
        state.core.players['2'].id = '2';
        state.core.players['3'] = JSON.parse(JSON.stringify(state.core.players['1']));
        state.core.players['3'].id = '3';
        state.core.seatingOrder = ['0', '1', '2', '3'];
        state.core.teamIdByPlayerId = { '0': 'A', '1': 'B', '2': 'A', '3': 'B' };
        state.core.teamHealth = { A: 50, B: 50 };
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING] = 0;
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING] = 0;
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_DIVINE] = 0;
        state.core.players['0'].tokens[TOKEN_IDS.LIFE_SAP] = 0;
        state.core.players['2'].tokens[TOKEN_IDS.LIFE_SAP] = 0;
        state.core.players['1'].tokens[TOKEN_IDS.THORN] = 0;
        state.core.players['1'].resources[RESOURCE_IDS.HP] = 50;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'forest-awakens',
            isDefendable: true,
            isUltimate: true,
            damage: 0,
        };

        const preDefenseEvents = resolveOffensivePreDefenseEffects(state.core, createQueuedRandom([1]), 100);
        const choiceEvent = preDefenseEvents.find(event => event.type === 'CHOICE_REQUESTED');
        expect(choiceEvent).toBeDefined();
        const selectedOption = (choiceEvent as any).payload.options.find((option: { labelKey?: string }) =>
            option.labelKey === 'choices.treantCultivate.s1_a2_d0'
        );
        expect(selectedOption).toBeDefined();

        let next = applyEvents(state.core, preDefenseEvents);
        next = reduce(next, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '0',
                sourceAbilityId: 'forest-awakens',
                customId: selectedOption.customId,
                value: selectedOption.value,
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 101,
        } as DiceThroneEvent);

        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING]).toBe(1);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING]).toBe(2);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_DIVINE]).toBe(0);
        expect(next.players['0'].tokens[TOKEN_IDS.LIFE_SAP]).toBe(1);
        expect(next.players['2'].tokens[TOKEN_IDS.LIFE_SAP]).toBe(1);
        expect(next.players['1'].tokens[TOKEN_IDS.THORN]).toBe(1);

        const attackEvents = resolveAttack(next, createQueuedRandom([1]), { includePreDefense: false }, 200);
        const damageEvent = attackEvents.find(event => event.type === 'DAMAGE_DEALT');
        expect((damageEvent as any).payload.amount).toBe(10);
        next = applyEvents(next, attackEvents);
        expect(next.players['1'].resources[RESOURCE_IDS.HP]).toBe(40);
    });

    it('Nature Touch II 应选择养成 2 树灵，并按养成后的树灵总数增加不可防御伤害', () => {
        const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        const treant = state.core.players['0'];
        const abilityIndex = treant.abilities.findIndex(ability => ability.id === 'nature-touch');
        treant.abilities[abilityIndex] = NATURE_TOUCH_2;
        treant.abilityLevels['nature-touch'] = 2;
        treant.tokens[TOKEN_IDS.TREANT_SEEDLING] = 1;
        treant.tokens[TOKEN_IDS.TREANT_SAPLING] = 1;
        treant.tokens[TOKEN_IDS.TREANT_DIVINE] = 0;
        state.core.players['1'].resources[RESOURCE_IDS.HP] = 50;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'nature-touch',
            isDefendable: false,
            damage: 0,
        };

        const preDefenseEvents = resolveOffensivePreDefenseEffects(state.core, createQueuedRandom([1]), 100);
        const choiceEvent = preDefenseEvents.find(event => event.type === 'CHOICE_REQUESTED');
        expect(choiceEvent).toBeDefined();
        const selectedOption = (choiceEvent as any).payload.options.find((option: { labelKey?: string }) =>
            option.labelKey === 'choices.treantCultivate.s3_a1_d0'
        );
        expect(selectedOption).toBeDefined();

        let next = applyEvents(state.core, preDefenseEvents);
        next = reduce(next, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '0',
                sourceAbilityId: 'nature-touch',
                customId: selectedOption.customId,
                value: selectedOption.value,
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 101,
        } as DiceThroneEvent);

        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING]).toBe(3);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING]).toBe(1);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_DIVINE]).toBe(0);
        expect(next.pendingAttack?.bonusDamage).toBe(4);

        const attackEvents = resolveAttack(next, createQueuedRandom([1]), { includePreDefense: false }, 200);
        expect(attackEvents.some(event => event.type === 'ATTACK_DEFENSE_RESOLVED')).toBe(false);
        const damageEvent = attackEvents.find(event => event.type === 'DAMAGE_DEALT');
        expect((damageEvent as any).payload.amount).toBe(10);
        expect((damageEvent as any).payload.unblockable).toBe(true);
        next = applyEvents(next, attackEvents);
        expect(next.players['1'].resources[RESOURCE_IDS.HP]).toBe(40);
    });

    it('Treant 专属主阶段卡应按图片语义选择玩家、移除树灵和正式养成', () => {
        const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        const treant = state.core.players['0'];
        const opponent = state.core.players['1'];
        treant.tokens[TOKEN_IDS.TREANT_SEEDLING] = 2;
        treant.tokens[TOKEN_IDS.TREANT_SAPLING] = 0;
        treant.tokens[TOKEN_IDS.TREANT_DIVINE] = 0;
        treant.tokens[TOKEN_IDS.LIFE_SAP] = 0;
        opponent.tokens[TOKEN_IDS.LIFE_SAP] = 0;
        treant.resources[RESOURCE_IDS.CP] = 0;

        const drinkDeep = TREANT_CARDS.find(card => card.id === 'treant-card-drink-deep');
        expect(drinkDeep).toBeDefined();
        let events = resolveEffectsToEvents(
            drinkDeep?.effects ?? [],
            'immediate',
            { attackerId: '0', defenderId: '1', sourceAbilityId: 'treant-card-drink-deep', state: state.core, damageDealt: 0, timestamp: 100 },
            { random: createQueuedRandom([1]) },
        );
        let choiceEvent = events.find(event => event.type === 'CHOICE_REQUESTED');
        let selectedOption = (choiceEvent as any).payload.options.find((option: { labelParams?: Record<string, unknown> }) =>
            option.labelParams?.player === 'P2'
        );
        expect(selectedOption).toBeDefined();
        let next = applyEvents(state.core, events);
        next = reduce(next, {
            type: 'CHOICE_RESOLVED',
            payload: { playerId: '0', sourceAbilityId: 'treant-card-drink-deep', customId: selectedOption.customId, value: selectedOption.value },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 101,
        } as DiceThroneEvent);
        expect(next.players['1'].tokens[TOKEN_IDS.LIFE_SAP]).toBe(1);

        const harvest = TREANT_CARDS.find(card => card.id === 'treant-card-harvest');
        expect(harvest).toBeDefined();
        events = resolveEffectsToEvents(
            harvest?.effects ?? [],
            'immediate',
            { attackerId: '0', defenderId: '1', sourceAbilityId: 'treant-card-harvest', state: next, damageDealt: 0, timestamp: 200 },
            { random: createQueuedRandom([1]) },
        );
        choiceEvent = events.find(event => event.type === 'CHOICE_REQUESTED');
        selectedOption = (choiceEvent as any).payload.options.find((option: { labelParams?: Record<string, unknown> }) =>
            option.labelParams?.seedling === 2
            && option.labelParams?.cp === 2
            && option.labelParams?.targets === 'P1, P2'
        );
        expect(selectedOption).toBeDefined();
        next = applyEvents(next, events);
        next = reduce(next, {
            type: 'CHOICE_RESOLVED',
            payload: { playerId: '0', sourceAbilityId: 'treant-card-harvest', customId: selectedOption.customId, value: selectedOption.value },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 201,
        } as DiceThroneEvent);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING]).toBe(0);
        expect(next.players['0'].resources[RESOURCE_IDS.CP]).toBe(2);
        expect(next.players['0'].tokens[TOKEN_IDS.LIFE_SAP]).toBe(1);
        expect(next.players['1'].tokens[TOKEN_IDS.LIFE_SAP]).toBe(1);

        const planting = TREANT_CARDS.find(card => card.id === 'treant-card-planting');
        expect(planting).toBeDefined();
        events = resolveEffectsToEvents(
            planting?.effects ?? [],
            'immediate',
            { attackerId: '0', defenderId: '1', sourceAbilityId: 'treant-card-planting', state: next, damageDealt: 0, timestamp: 300 },
            { random: createQueuedRandom([1]) },
        );
        choiceEvent = events.find(event => event.type === 'CHOICE_REQUESTED');
        selectedOption = (choiceEvent as any).payload.options.find((option: { labelKey?: string }) =>
            option.labelKey === 'choices.treantCultivate.s1_a1_d0'
        );
        expect(selectedOption).toBeDefined();
        next = applyEvents(next, events);
        next = reduce(next, {
            type: 'CHOICE_RESOLVED',
            payload: { playerId: '0', sourceAbilityId: 'treant-card-planting', customId: selectedOption.customId, value: selectedOption.value },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 301,
        } as DiceThroneEvent);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING]).toBe(1);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING]).toBe(1);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_DIVINE]).toBe(0);
    });

    it('Treant 的 Downpour 和 Mother Tree 不应再把养成写死为幼种', () => {
        const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING] = 2;
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING] = 0;
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_DIVINE] = 0;

        const downpour = TREANT_CARDS.find(card => card.id === 'treant-card-downpour');
        expect(downpour).toBeDefined();
        let events = resolveEffectsToEvents(
            downpour?.effects ?? [],
            'immediate',
            { attackerId: '0', defenderId: '1', sourceAbilityId: 'treant-card-downpour', state: state.core, damageDealt: 0, timestamp: 100 },
            { random: createQueuedRandom([1]) },
        );
        let choiceEvent = events.find(event => event.type === 'CHOICE_REQUESTED');
        let selectedOption = (choiceEvent as any).payload.options.find((option: { labelKey?: string }) =>
            option.labelKey === 'choices.treantCultivate.s0_a2_d0'
        );
        expect(selectedOption).toBeDefined();
        let next = applyEvents(state.core, events);
        next = reduce(next, {
            type: 'CHOICE_RESOLVED',
            payload: { playerId: '0', sourceAbilityId: 'treant-card-downpour', customId: selectedOption.customId, value: selectedOption.value },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 101,
        } as DiceThroneEvent);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING]).toBe(0);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING]).toBe(2);

        const motherTree = TREANT_CARDS.find(card => card.id === 'treant-card-mother-tree');
        expect(motherTree).toBeDefined();
        next.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING] = 0;
        next.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING] = 0;
        next.players['0'].tokens[TOKEN_IDS.TREANT_DIVINE] = 0;
        events = resolveEffectsToEvents(
            motherTree?.effects ?? [],
            'immediate',
            { attackerId: '0', defenderId: '1', sourceAbilityId: 'treant-card-mother-tree', state: next, damageDealt: 0, timestamp: 200 },
            { random: createQueuedRandom([6]) },
        );
        choiceEvent = events.find(event => event.type === 'CHOICE_REQUESTED');
        selectedOption = (choiceEvent as any).payload.options.find((option: { labelKey?: string }) =>
            option.labelKey === 'choices.treantCultivate.s2_a1_d0'
        );
        expect(selectedOption).toBeDefined();
        next = applyEvents(next, events);
        next = reduce(next, {
            type: 'CHOICE_RESOLVED',
            payload: { playerId: '0', sourceAbilityId: 'treant-card-mother-tree', customId: selectedOption.customId, value: selectedOption.value },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 201,
        } as DiceThroneEvent);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING]).toBe(2);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING]).toBe(1);
    });

    it('Treant 攻击修正卡 Trample 与 Soulfire 应按各自骰面语义结算', () => {
        const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        state.core.players['0'].tokens[TOKEN_IDS.LIFE_SAP] = 0;
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING] = 0;
        state.core.players['1'].tokens[TOKEN_IDS.THORN] = 0;
        state.core.players['1'].resources[RESOURCE_IDS.HP] = 50;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'shattering-fist',
            isDefendable: true,
            damage: 0,
        };

        const trample = TREANT_CARDS.find(card => card.id === 'treant-card-trample');
        expect(trample).toBeDefined();
        let events = resolveEffectsToEvents(
            trample?.effects ?? [],
            'immediate',
            { attackerId: '0', defenderId: '1', sourceAbilityId: 'treant-card-trample', state: state.core, damageDealt: 0, timestamp: 100 },
            { random: createQueuedRandom([1, 2, 1, 4, 6]) },
        );
        let next = applyEvents(state.core, events);
        expect(next.pendingAttack?.bonusDamage).toBe(3);
        expect(next.pendingAttack?.attackModifierBonusDamage).toBe(3);
        expect(next.players['1'].tokens[TOKEN_IDS.THORN]).toBe(1);

        const soulfire = TREANT_CARDS.find(card => card.id === 'treant-card-soulfire');
        expect(soulfire).toBeDefined();
        events = resolveEffectsToEvents(
            soulfire?.effects ?? [],
            'immediate',
            { attackerId: '0', defenderId: '1', sourceAbilityId: 'treant-card-soulfire', state: next, damageDealt: 0, timestamp: 200 },
            { random: createQueuedRandom([1, 4, 6]) },
        );
        next = applyEvents(next, events);
        expect(next.players['1'].resources[RESOURCE_IDS.HP]).toBe(49);
        expect(next.players['0'].tokens[TOKEN_IDS.LIFE_SAP]).toBe(1);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING]).toBe(1);
        expect(next.pendingAttack?.attackModifierBonusDamage).toBe(3);
    });
});
