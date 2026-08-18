import { describe, expect, it } from 'vitest';
import type { DiceThroneCore, DiceThroneEvent } from '../domain/types';
import { execute } from '../domain/execute';
import { reduce } from '../domain/reducer';
import { RESOURCE_IDS } from '../domain/resources';
import { TOKEN_IDS, TREANT_DICE_FACE_IDS } from '../domain/ids';
import { resolveAttack, resolveOffensivePreDefenseEffects } from '../domain/attack';
import { resolveEffectsToEvents } from '../domain/effects';
import { buildBonusDiceSettlementEvents } from '../domain/executeTokens';
import { getChoiceEffectHandler } from '../domain/choiceEffects';
import { getCurrentDamageSummary } from '../domain/damageSummary';
import { getAvailableAbilityIds } from '../domain/rules';
import { NATURE_TOUCH_2, ROOTED_2, SHATTERING_FIST_2, SHATTERING_FIST_3, TEND_CARE_2, VENGEFUL_VINES_2, WILD_GROWTH_2, WILD_ROAR_2 } from '../heroes/treant/abilities';
import { TREANT_CARDS } from '../heroes/treant/cards';
import { getAbilitySlotIdForCharacter, slotContainsAbilityIdForCharacter } from '../ui/abilitySlotMapping';
import { createHeroMatchup, createQueuedRandom } from './test-utils';

const applyEvents = (core: DiceThroneCore, events: DiceThroneEvent[]): DiceThroneCore =>
    events.reduce((current, event) => reduce(current, event), core);

const settleBonusDice = (core: DiceThroneCore, timestamp = 200): DiceThroneEvent[] => {
    const settlement = core.pendingBonusDiceSettlement;
    if (!settlement) return [];
    return buildBonusDiceSettlementEvents({
        state: core,
        settlement,
        random: createQueuedRandom([1]),
        timestamp,
        sourceCommandType: 'SKIP_BONUS_DICE_REROLL',
    });
};

const createTreantTeamMatchup = () => {
    const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
    state.core.players['2'] = JSON.parse(JSON.stringify(state.core.players['0']));
    state.core.players['2'].id = '2';
    state.core.players['3'] = JSON.parse(JSON.stringify(state.core.players['1']));
    state.core.players['3'].id = '3';
    state.core.seatingOrder = ['0', '1', '2', '3'];
    state.core.teamIdByPlayerId = { '0': 'A', '1': 'B', '2': 'A', '3': 'B' };
    state.core.teamHealth = { A: 50, B: 50 };
    return state;
};

describe('DiceThrone Treant 能力与卡牌合同', () => {
    const command = (type: string, playerId: string, payload: Record<string, unknown> = {}) => ({
        type,
        playerId,
        payload,
        timestamp: 100,
    } as any);

    it('Treant v2 面板槽位应把 passive / defense 绑定到真实槽位', () => {
        expect(getAbilitySlotIdForCharacter('treant', 'quiet-cultivation')).toBe('sky');
        expect(getAbilitySlotIdForCharacter('treant', 'wild-growth')).toBe('lotus');
        expect(getAbilitySlotIdForCharacter('treant', 'vengeful-vines')).toBe('combo');
        expect(getAbilitySlotIdForCharacter('treant', 'nature-touch')).toBe('lightning');
        expect(getAbilitySlotIdForCharacter('treant', 'wild-roar')).toBe('calm');
        expect(getAbilitySlotIdForCharacter('treant', 'rooted')).toBe('meditate');

        expect(slotContainsAbilityIdForCharacter('treant', 'sky', 'quiet-cultivation')).toBe(true);
        expect(slotContainsAbilityIdForCharacter('treant', 'sky', 'vengeful-vines')).toBe(false);
        expect(slotContainsAbilityIdForCharacter('treant', 'lightning', 'wild-roar')).toBe(false);
        expect(slotContainsAbilityIdForCharacter('treant', 'calm', 'wild-roar')).toBe(true);
        expect(slotContainsAbilityIdForCharacter('treant', 'calm', 'rooted')).toBe(false);
        expect(slotContainsAbilityIdForCharacter('treant', 'meditate', 'rooted')).toBe(true);
    });

    it('Treant 小顺子应在领域层识别为 vengeful-vines，而不是被动槽对象', () => {
        const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        state.core.activePlayerId = '0';
        state.core.rollDiceCount = 5;
        state.core.dice = state.core.dice.slice(0, 5).map((die, index) => ({
            ...die,
            id: index,
            value: [1, 2, 3, 4, 6][index],
            symbol: [
                TREANT_DICE_FACE_IDS.BRANCH,
                TREANT_DICE_FACE_IDS.BRANCH,
                TREANT_DICE_FACE_IDS.LEAF,
                TREANT_DICE_FACE_IDS.SPIRIT,
                TREANT_DICE_FACE_IDS.LEAF,
            ][index],
            ownerId: '0',
        }));

        const available = getAvailableAbilityIds(state.core, '0', 'offensiveRoll');
        expect(available).toContain('vengeful-vines');
        expect(available).not.toContain('quiet-cultivation');
    });

    it('Treant 末尾专属卡不应继续使用越界图集索引', () => {
        const shatteringFist2 = TREANT_CARDS.find(card => card.id === 'upgrade-shattering-fist-2');
        const planting = TREANT_CARDS.find(card => card.id === 'treant-card-planting');

        expect(shatteringFist2?.sourceAtlasIndex).toBe(30);
        expect(shatteringFist2?.previewRef).toMatchObject({ type: 'atlas', index: 30 });
        expect(planting?.sourceAtlasIndex).toBe(31);
        expect(planting?.previewRef).toMatchObject({ type: 'atlas', index: 31 });
    });

    it('Treant 升级卡应按卡图替换到正确的目标能力与等级', () => {
        const expectations = [
            { id: 'upgrade-tend-care-2', targetAbilityId: 'tend-care', newAbilityLevel: 2 },
            { id: 'upgrade-rooted-2', targetAbilityId: 'rooted', newAbilityLevel: 2 },
            { id: 'upgrade-shattering-fist-3', targetAbilityId: 'shattering-fist', newAbilityLevel: 3 },
            { id: 'upgrade-nature-touch-2', targetAbilityId: 'nature-touch', newAbilityLevel: 2 },
            { id: 'upgrade-vengeful-vines-2', targetAbilityId: 'vengeful-vines', newAbilityLevel: 2 },
            { id: 'upgrade-wild-growth-2', targetAbilityId: 'wild-roar', newAbilityLevel: 2 },
            { id: 'upgrade-shattering-fist-2', targetAbilityId: 'shattering-fist', newAbilityLevel: 2 },
        ] as const;

        for (const { id, targetAbilityId, newAbilityLevel } of expectations) {
            const card = TREANT_CARDS.find(current => current.id === id);
            expect(card).toBeDefined();
            expect(card?.type).toBe('upgrade');
            expect(card?.effects).toHaveLength(1);
            const effect = card?.effects[0];
            expect(effect?.action).toMatchObject({
                type: 'replaceAbility',
                target: 'self',
                targetAbilityId,
                newAbilityLevel,
            });
            expect((effect?.action as any)?.newAbilityDef?.id).toBe(targetAbilityId);
        }
    });

    it('同卡双分支升级技能应按卡面上方主技能在前、下方分支在后展示', () => {
        expect(TEND_CARE_2.variants?.map(variant => variant.id)).toEqual([
            'tend-care-2-main',
            'tend-care-2-cultivate',
        ]);
        expect(VENGEFUL_VINES_2.variants?.map(variant => variant.id)).toEqual([
            'vengeful-vines-2-main',
            'vengeful-vines-2-pain',
        ]);
        expect(NATURE_TOUCH_2.variants?.map(variant => variant.id)).toEqual([
            'nature-touch-2-main',
            'nature-touch-2-mercy',
        ]);
        expect(WILD_GROWTH_2.variants?.map(variant => variant.id)).toEqual([
            'wild-growth-2-main',
            'wild-growth-2-dazzle',
        ]);
        expect(WILD_ROAR_2.variants?.map(variant => variant.id)).toEqual([
            'wild-roar-2-main',
            'wild-roar-2-dazzle',
        ]);
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
        let next = applyEvents(state.core, events);

        expect(events.filter(event => event.type === 'BONUS_DIE_ROLLED')).toHaveLength(3);
        expect(events.some(event => event.type === 'ATTACK_DEFENSE_RESOLVED')).toBe(true);
        expect(events.some(event => event.type === 'CHOICE_REQUESTED')).toBe(false);
        expect(next.players['0'].resources[RESOURCE_IDS.HP]).toBe(30);
        const settlementEvents = settleBonusDice(next);
        expect(settlementEvents.some(event => event.type === 'CHOICE_REQUESTED')).toBe(false);
        next = applyEvents(next, settlementEvents);
        next = applyEvents(next, resolveAttack(next, createQueuedRandom([1]), { includePreDefense: false }, 300));
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
        let next = applyEvents(state.core, defenseEvents);
        const settlementEvents = settleBonusDice(next);
        const choiceEvent = settlementEvents.find(event => event.type === 'CHOICE_REQUESTED');
        expect(choiceEvent).toBeDefined();
        const selectedOption = (choiceEvent as any).payload.options.find((option: { labelKey?: string }) =>
            option.labelKey === 'choices.treantRooted.s2_a0_d0_none'
        );
        expect(selectedOption).toBeDefined();

        next = applyEvents(next, settlementEvents);
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
        let next = applyEvents(state.core, defenseEvents);
        const settlementEvents = settleBonusDice(next);
        const choiceEvent = settlementEvents.find(event => event.type === 'CHOICE_REQUESTED');
        expect(choiceEvent).toBeDefined();
        const selectedOption = (choiceEvent as any).payload.options.find((option: { labelKey?: string }) =>
            option.labelKey === 'choices.treantRooted.none_p0'
        );
        expect(selectedOption).toBeDefined();

        next = applyEvents(next, settlementEvents);
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
        expect(next.pendingAttack).toBeNull();
        expect(next.pendingDamage).toBeUndefined();
        expect(next.pendingBonusDiceSettlement).toBeUndefined();
        expect(next.lastResolvedAttackDamage).toBe(2);
    });

    it('upgrade-rooted-2 打出后应通过真实升级链把防御入口切到 4 骰 rooted', () => {
        const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        state.sys.phase = 'main1';
        state.core.players['0'].hand = [
            JSON.parse(JSON.stringify(TREANT_CARDS.find(card => card.id === 'upgrade-rooted-2'))),
        ];
        state.core.players['0'].resources[RESOURCE_IDS.CP] = 3;

        const upgradeEvents = execute(state, command('PLAY_CARD', '0', { cardId: 'upgrade-rooted-2' }), createQueuedRandom([1]));
        const upgradedCore = applyEvents(state.core, upgradeEvents);

        expect(upgradedCore.players['0'].abilityLevels.rooted).toBe(2);
        expect(upgradedCore.players['0'].abilities.find(ability => ability.id === 'rooted')).toMatchObject({
            id: 'rooted',
            trigger: ROOTED_2.trigger,
            effects: ROOTED_2.effects,
        });

        const selectState = {
            core: {
                ...upgradedCore,
                pendingAttack: {
                    attackerId: '1',
                    defenderId: '0',
                    sourceAbilityId: 'slash-3',
                    isDefendable: true,
                    damage: 0,
                },
                rollCount: 0,
            },
            sys: { phase: 'defensiveRoll' },
        };
        const selectedCore = applyEvents(selectState.core, execute(selectState, command('SELECT_ABILITY', '0', { abilityId: 'rooted' }), createQueuedRandom([1])));

        expect(selectedCore.pendingAttack?.defenseAbilityId).toBe('rooted');
        expect(selectedCore.rollDiceCount).toBe(4);
    });

    it('Rooted II 在 4 人模式下双树灵应允许任意玩家获得生命源泉', () => {
        const state = createHeroMatchup('ninja', 'treant')(['0', '1'], createQueuedRandom([1]));
        state.core.players['2'] = JSON.parse(JSON.stringify(state.core.players['0']));
        state.core.players['2'].id = '2';
        state.core.players['3'] = JSON.parse(JSON.stringify(state.core.players['1']));
        state.core.players['3'].id = '3';
        state.core.seatingOrder = ['0', '1', '2', '3'];
        state.core.teamIdByPlayerId = { '0': 'A', '1': 'B', '2': 'A', '3': 'B' };
        state.core.teamHealth = { A: 50, B: 50 };

        const treant = state.core.players['1'];
        const abilityIndex = treant.abilities.findIndex(ability => ability.id === 'rooted');
        treant.abilities[abilityIndex] = ROOTED_2;
        treant.abilityLevels['rooted'] = 2;
        for (const playerId of state.core.seatingOrder) {
            state.core.players[playerId].tokens[TOKEN_IDS.LIFE_SAP] = 0;
        }
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'slash-3',
            defenseAbilityId: 'rooted',
            isDefendable: true,
            damage: 0,
        };

        const defenseEvents = resolveAttack(state.core, createQueuedRandom([6, 6, 1, 4]), undefined, 100);
        let next = applyEvents(state.core, defenseEvents);
        const settlementEvents = settleBonusDice(next);
        const choiceEvent = settlementEvents.find(event => event.type === 'CHOICE_REQUESTED');
        expect(choiceEvent).toBeDefined();
        const options = (choiceEvent as any).payload.options as Array<{ labelKey?: string; customId: string; value: number }>;
        expect(options.map(option => option.labelKey).sort()).toEqual([
            'choices.treantRooted.none_p0',
            'choices.treantRooted.none_p1',
            'choices.treantRooted.none_p2',
            'choices.treantRooted.none_p3',
        ]);

        const selectedOption = options.find(option => option.labelKey === 'choices.treantRooted.none_p3');
        expect(selectedOption).toBeDefined();
        next = applyEvents(next, settlementEvents);
        next = reduce(next, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '1',
                sourceAbilityId: 'rooted',
                customId: selectedOption?.customId,
                value: selectedOption?.value,
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 101,
        } as DiceThroneEvent);

        expect(next.players['3'].tokens[TOKEN_IDS.LIFE_SAP]).toBe(1);
        expect(next.players['0'].tokens[TOKEN_IDS.LIFE_SAP]).toBe(0);
        expect(next.players['1'].tokens[TOKEN_IDS.LIFE_SAP]).toBe(0);
        expect(next.players['2'].tokens[TOKEN_IDS.LIFE_SAP]).toBe(0);
    });

    it('Rooted 过量防伤不应造成负伤害或治疗防守方', () => {
        const state = createHeroMatchup('gunslinger', 'treant')(['0', '1'], createQueuedRandom([1]));
        state.core.players['1'].resources[RESOURCE_IDS.HP] = 40;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'revolver-3',
            defenseAbilityId: 'rooted',
            isDefendable: true,
            damage: 0,
        };

        const events = resolveAttack(state.core, createQueuedRandom([1, 1, 1]), undefined, 100);
        let next = applyEvents(state.core, events);

        expect(events.filter(event => event.type === 'BONUS_DIE_ROLLED')).toHaveLength(3);
        expect(events.some(event => event.type === 'DAMAGE_DEALT')).toBe(false);
        next = applyEvents(next, settleBonusDice(next));
        const followupEvents = resolveAttack(next, createQueuedRandom([1]), { includePreDefense: false }, 300);
        expect(followupEvents.find(event => event.type === 'ATTACK_RESOLVED')?.payload).toMatchObject({
            totalDamage: 0,
        });
        next = applyEvents(next, followupEvents);
        expect(next.players['1'].resources[RESOURCE_IDS.HP]).toBe(40);
    });

    it('Rooted II 应拒绝不存在的生命源泉目标索引', () => {
        const state = createHeroMatchup('ninja', 'treant')(['0', '1'], createQueuedRandom([1]));
        const treant = state.core.players['1'];
        const abilityIndex = treant.abilities.findIndex(ability => ability.id === 'rooted');
        treant.abilities[abilityIndex] = ROOTED_2;
        treant.abilityLevels['rooted'] = 2;
        treant.tokens[TOKEN_IDS.LIFE_SAP] = 0;
        state.core.players['0'].tokens[TOKEN_IDS.LIFE_SAP] = 0;

        const next = reduce(state.core, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '1',
                sourceAbilityId: 'rooted',
                customId: 'treant-rooted-resolve',
                value: 23000,
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 101,
        } as DiceThroneEvent);

        expect(next.players['0'].tokens[TOKEN_IDS.LIFE_SAP]).toBe(0);
        expect(next.players['1'].tokens[TOKEN_IDS.LIFE_SAP]).toBe(0);
    });

    it('Rooted II 在需要养成时应拒绝伪造的“保持当前树灵”结果', () => {
        const state = createHeroMatchup('ninja', 'treant')(['0', '1'], createQueuedRandom([1]));
        const treant = state.core.players['1'];
        const abilityIndex = treant.abilities.findIndex(ability => ability.id === 'rooted');
        treant.abilities[abilityIndex] = ROOTED_2;
        treant.abilityLevels['rooted'] = 2;
        treant.tokens[TOKEN_IDS.TREANT_SEEDLING] = 1;
        treant.tokens[TOKEN_IDS.TREANT_SAPLING] = 0;
        treant.tokens[TOKEN_IDS.TREANT_DIVINE] = 0;
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

        const defenseEvents = resolveAttack(state.core, createQueuedRandom([4, 5, 1, 1]), undefined, 100);
        let next = applyEvents(state.core, defenseEvents);
        const settlementEvents = settleBonusDice(next);
        const choiceEvent = settlementEvents.find(event => event.type === 'CHOICE_REQUESTED');
        expect(choiceEvent).toBeDefined();

        next = applyEvents(next, settlementEvents);
        next = reduce(next, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '1',
                sourceAbilityId: 'rooted',
                customId: 'treant-rooted-resolve',
                value: 10000,
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 101,
        } as DiceThroneEvent);

        expect(next.players['1'].tokens[TOKEN_IDS.TREANT_SEEDLING]).toBe(1);
        expect(next.players['1'].tokens[TOKEN_IDS.TREANT_SAPLING]).toBe(0);
        expect(next.players['1'].tokens[TOKEN_IDS.TREANT_DIVINE]).toBe(0);
        expect(next.players['0'].tokens[TOKEN_IDS.LIFE_SAP]).toBe(0);
    });

    it('Rooted II 在双树叶双树灵时应拒绝缺少生命源泉标记的伪造结果', () => {
        const state = createTreantTeamMatchup();
        const treant = state.core.players['0'];
        const abilityIndex = treant.abilities.findIndex(ability => ability.id === 'rooted');
        treant.abilities[abilityIndex] = ROOTED_2;
        treant.abilityLevels['rooted'] = 2;
        treant.tokens[TOKEN_IDS.TREANT_SEEDLING] = 3;
        treant.tokens[TOKEN_IDS.TREANT_SAPLING] = 2;
        treant.tokens[TOKEN_IDS.TREANT_DIVINE] = 1;
        treant.tokens[TOKEN_IDS.LIFE_SAP] = 0;
        for (const playerId of state.core.seatingOrder) {
            state.core.players[playerId].tokens[TOKEN_IDS.LIFE_SAP] = 0;
        }
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '0',
            sourceAbilityId: 'slash-3',
            defenseAbilityId: 'rooted',
            isDefendable: true,
            damage: 0,
        };

        const defenseEvents = resolveAttack(state.core, createQueuedRandom([4, 5, 6, 6]), undefined, 100);
        let next = applyEvents(state.core, defenseEvents);
        const settlementEvents = settleBonusDice(next);
        expect(settlementEvents.find(event => event.type === 'CHOICE_REQUESTED')).toBeDefined();
        next = applyEvents(next, settlementEvents);

        const handler = getChoiceEffectHandler('treant-rooted-resolve');
        expect(handler).toBeDefined();
        const result = handler?.({
            state: next,
            playerId: '1',
            customId: 'treant-rooted-resolve',
            sourceAbilityId: 'rooted',
            value: 10123,
        });

        expect(result).toBeUndefined();
        expect(next.players['0'].tokens[TOKEN_IDS.LIFE_SAP]).toBe(0);
        expect(next.players['2'].tokens[TOKEN_IDS.LIFE_SAP]).toBe(0);
        expect(next.players['3'].tokens[TOKEN_IDS.LIFE_SAP]).toBe(0);
    });

    it('Rooted II 同时投出双树叶与双树灵时应同时处理养成和生命源泉目标', () => {
        const state = createHeroMatchup('ninja', 'treant')(['0', '1'], createQueuedRandom([1]));
        const treant = state.core.players['1'];
        const abilityIndex = treant.abilities.findIndex(ability => ability.id === 'rooted');
        treant.abilities[abilityIndex] = ROOTED_2;
        treant.abilityLevels['rooted'] = 2;
        treant.resources[RESOURCE_IDS.HP] = 50;
        treant.tokens[TOKEN_IDS.TREANT_SEEDLING] = 1;
        treant.tokens[TOKEN_IDS.TREANT_SAPLING] = 0;
        treant.tokens[TOKEN_IDS.TREANT_DIVINE] = 0;
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

        const defenseEvents = resolveAttack(state.core, createQueuedRandom([4, 5, 6, 6]), undefined, 100);
        expect(defenseEvents.filter(event => event.type === 'BONUS_DIE_ROLLED')).toHaveLength(4);
        let next = applyEvents(state.core, defenseEvents);
        const settlementEvents = settleBonusDice(next);
        const choiceEvent = settlementEvents.find(event => event.type === 'CHOICE_REQUESTED');
        expect(choiceEvent).toBeDefined();
        const selectedOption = (choiceEvent as any).payload.options.find((option: { labelKey?: string }) =>
            option.labelKey === 'choices.treantRooted.s0_a1_d0_p1'
        );
        expect(selectedOption).toBeDefined();

        next = applyEvents(next, settlementEvents);
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
        expect(next.players['1'].tokens[TOKEN_IDS.TREANT_SEEDLING]).toBe(0);
        expect(next.players['1'].tokens[TOKEN_IDS.TREANT_SAPLING]).toBe(1);
        expect(next.players['0'].tokens[TOKEN_IDS.LIFE_SAP]).toBe(1);

        const attackEvents = resolveAttack(next, createQueuedRandom([1]), { includePreDefense: false }, 200);
        const damageEvent = attackEvents.find(event => event.type === 'DAMAGE_DEALT');
        expect((damageEvent as any).payload.amount).toBe(3);
        next = applyEvents(next, attackEvents);
        expect(next.players['1'].resources[RESOURCE_IDS.HP]).toBe(47);
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

    it('Quiet Cultivation 应拒绝伪造的不可能养成结果', () => {
        const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING] = 0;
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING] = 0;
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_DIVINE] = 0;

        const next = reduce(state.core, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '0',
                sourceAbilityId: 'quiet-cultivation',
                customId: 'treant-quiet-cultivation-resolve',
                value: 999,
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 101,
        } as DiceThroneEvent);

        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING]).toBe(0);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING]).toBe(0);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_DIVINE]).toBe(0);
    });

    it('Treant 通用养成动作卡应只接受各自来源允许的 amount 与合法结果', () => {
        let state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING] = 1;
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING] = 0;
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_DIVINE] = 0;
        let soulfire = TREANT_CARDS.find(card => card.id === 'treant-card-soulfire');
        expect(soulfire).toBeDefined();
        let events = resolveEffectsToEvents(
            soulfire?.effects ?? [],
            'immediate',
            { attackerId: '0', defenderId: '1', sourceAbilityId: 'treant-card-soulfire', state: state.core, damageDealt: 0, timestamp: 100 },
            { random: createQueuedRandom([6, 1, 1]) },
        );
        let next = applyEvents(state.core, events);
        let settlementEvents = settleBonusDice(next);
        expect(settlementEvents.some(event => event.type === 'CHOICE_REQUESTED')).toBe(true);
        next = applyEvents(next, settlementEvents);
        next = reduce(next, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '0',
                sourceAbilityId: 'treant-card-soulfire',
                customId: 'treant-card-cultivate-1-resolve',
                value: 2,
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 101,
        } as DiceThroneEvent);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING]).toBe(2);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING]).toBe(0);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_DIVINE]).toBe(0);

        next = applyEvents(state.core, events);
        settlementEvents = settleBonusDice(next);
        next = applyEvents(next, settlementEvents);
        next = reduce(next, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '0',
                sourceAbilityId: 'treant-card-soulfire',
                customId: 'treant-card-cultivate-1-resolve',
                value: 100,
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 102,
        } as DiceThroneEvent);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING]).toBe(1);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING]).toBe(0);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_DIVINE]).toBe(0);

        state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING] = 0;
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING] = 0;
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_DIVINE] = 0;
        state.core.activatingAbilityId = 'treant-card-cultivate';
        state.core.currentChoiceSourceAbilityId = 'treant-card-cultivate';
        next = reduce(state.core, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '0',
                sourceAbilityId: 'treant-card-cultivate',
                customId: 'treant-card-cultivate-3-resolve',
                value: 3,
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 103,
        } as DiceThroneEvent);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING]).toBe(3);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING]).toBe(0);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_DIVINE]).toBe(0);

        next = reduce(state.core, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '0',
                sourceAbilityId: 'treant-card-cultivate',
                customId: 'treant-card-cultivate-3-resolve',
                value: 1,
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 104,
        } as DiceThroneEvent);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING]).toBe(0);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING]).toBe(0);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_DIVINE]).toBe(0);

        state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING] = 0;
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING] = 0;
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_DIVINE] = 0;
        const motherTree = TREANT_CARDS.find(card => card.id === 'treant-card-mother-tree');
        expect(motherTree).toBeDefined();
        events = resolveEffectsToEvents(
            motherTree?.effects ?? [],
            'immediate',
            { attackerId: '0', defenderId: '1', sourceAbilityId: 'treant-card-mother-tree', state: state.core, damageDealt: 0, timestamp: 200 },
            { random: createQueuedRandom([6]) },
        );
        next = applyEvents(state.core, events);
        next = applyEvents(next, settleBonusDice(next));
        next = reduce(next, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '0',
                sourceAbilityId: 'treant-card-mother-tree',
                customId: 'treant-card-cultivate-4-resolve',
                value: 12,
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 105,
        } as DiceThroneEvent);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING]).toBe(2);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING]).toBe(1);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_DIVINE]).toBe(0);

        next = applyEvents(state.core, events);
        next = applyEvents(next, settleBonusDice(next));
        next = reduce(next, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '0',
                sourceAbilityId: 'treant-card-mother-tree',
                customId: 'treant-card-cultivate-4-resolve',
                value: 30,
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 106,
        } as DiceThroneEvent);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING]).toBe(0);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING]).toBe(0);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_DIVINE]).toBe(0);
    });

    it('Treant 3 树灵养成卡应通过 treant-card-cultivate-3-resolve 正向路由并落地', () => {
        const cards = ['treant-card-cultivate', 'treant-card-planting'] as const;

        for (const cardId of cards) {
            const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
            state.core.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING] = 0;
            state.core.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING] = 0;
            state.core.players['0'].tokens[TOKEN_IDS.TREANT_DIVINE] = 0;

            const card = TREANT_CARDS.find(entry => entry.id === cardId);
            expect(card).toBeDefined();

            const events = resolveEffectsToEvents(
                card?.effects ?? [],
                'immediate',
                { attackerId: '0', defenderId: '1', sourceAbilityId: cardId, state: state.core, damageDealt: 0, timestamp: 100 },
                { random: createQueuedRandom([1]) },
            );
            const choiceEvent = events.find(event => event.type === 'CHOICE_REQUESTED');
            expect(choiceEvent).toBeDefined();

            const options = (choiceEvent as any).payload.options as Array<{ customId: string; labelKey?: string }>;
            expect(options.every(option => option.customId === 'treant-card-cultivate-3-resolve')).toBe(true);
            const selectedOption = options[0];
            expect(selectedOption?.labelKey).toMatch(/^choices\.treantCultivate\.s\d+_a\d+_d\d+$/);

            const match = selectedOption?.labelKey?.match(/^choices\.treantCultivate\.s(\d+)_a(\d+)_d(\d+)$/);
            expect(match).toBeDefined();

            let next = applyEvents(state.core, events);
            next = reduce(next, {
                type: 'CHOICE_RESOLVED',
                payload: {
                    playerId: '0',
                    sourceAbilityId: cardId,
                    customId: selectedOption.customId,
                    value: selectedOption.value,
                },
                sourceCommandType: 'RESOLVE_CHOICE',
                timestamp: 101,
            } as DiceThroneEvent);

            expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING]).toBe(Number(match?.[1]));
            expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING]).toBe(Number(match?.[2]));
            expect(next.players['0'].tokens[TOKEN_IDS.TREANT_DIVINE]).toBe(Number(match?.[3]));
        }
    });

    it('Wild Roar II 应在 2 树枝 + 2 树灵骰面下暴露乱花迷眼分支', () => {
        const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        const treant = state.core.players['0'];
        const abilityIndex = treant.abilities.findIndex(ability => ability.id === 'wild-roar');
        treant.abilities[abilityIndex] = WILD_ROAR_2;
        treant.abilityLevels['wild-roar'] = 2;
        state.core.activePlayerId = '0';
        state.core.rollDiceCount = 5;
        state.core.dice = state.core.dice.slice(0, 5).map((die, index) => ({
            ...die,
            id: index,
            value: [1, 2, 4, 6, 6][index],
            symbol: [
                TREANT_DICE_FACE_IDS.BRANCH,
                TREANT_DICE_FACE_IDS.BRANCH,
                TREANT_DICE_FACE_IDS.LEAF,
                TREANT_DICE_FACE_IDS.SPIRIT,
                TREANT_DICE_FACE_IDS.SPIRIT,
            ][index],
            ownerId: '0',
        }));

        const available = getAvailableAbilityIds(state.core, '0', 'offensiveRoll');
        expect(available).toContain('wild-roar-2-dazzle');
        expect(available).not.toContain('wild-roar-2-main');
    });

    it('Wild Roar II 的乱花迷眼分支应施加刺藤并造成 4 点不可防御伤害', () => {
        const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        const treant = state.core.players['0'];
        const abilityIndex = treant.abilities.findIndex(ability => ability.id === 'wild-roar');
        treant.abilities[abilityIndex] = WILD_ROAR_2;
        treant.abilityLevels['wild-roar'] = 2;
        state.core.players['1'].tokens[TOKEN_IDS.THORN] = 0;
        state.core.players['1'].resources[RESOURCE_IDS.HP] = 50;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'wild-roar-2-dazzle',
            isDefendable: false,
            damage: 0,
        };

        const attackEvents = resolveAttack(state.core, createQueuedRandom([1]), { includePreDefense: true }, 100);
        const damageEvent = attackEvents.find(event => event.type === 'DAMAGE_DEALT');
        expect((damageEvent as any).payload.amount).toBe(4);
        expect((damageEvent as any).payload.unblockable).toBe(true);

        const next = applyEvents(state.core, attackEvents);
        expect(next.players['1'].tokens[TOKEN_IDS.THORN]).toBe(1);
        expect(next.players['1'].resources[RESOURCE_IDS.HP]).toBe(46);
    });

    it('Wild Roar II 大顺子伤害摘要应按 8 基伤 + 奖励骰树枝加伤显示，并最终扣血', () => {
        const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        const treant = state.core.players['0'];
        const abilityIndex = treant.abilities.findIndex(ability => ability.id === 'wild-roar');
        treant.abilities[abilityIndex] = WILD_ROAR_2;
        treant.abilityLevels['wild-roar'] = 2;
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING] = 0;
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING] = 0;
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_DIVINE] = 0;
        state.core.players['0'].tokens[TOKEN_IDS.LIFE_SAP] = 0;
        state.core.players['1'].resources[RESOURCE_IDS.HP] = 50;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'wild-roar-2-main',
            isDefendable: true,
        };

        expect(getCurrentDamageSummary(state.core)).toEqual({
            currentDamage: 8,
            originalDamage: 8,
        });

        const preDefenseEvents = resolveOffensivePreDefenseEffects(state.core, createQueuedRandom([1, 2, 3, 4, 5]), 100);
        let next = applyEvents(state.core, preDefenseEvents);
        expect(next.pendingBonusDiceSettlement?.summaryEffectParams).toMatchObject({
            branchCount: 3,
            leafCount: 2,
            spiritCount: 0,
            bonusDamage: 3,
        });
        expect(getCurrentDamageSummary(next)).toEqual({
            currentDamage: 11,
            originalDamage: 8,
        });

        const settlementEvents = settleBonusDice(next);
        next = applyEvents(next, settlementEvents);
        expect(next.pendingAttack?.bonusDamage ?? 0).toBe(3);
        expect(getCurrentDamageSummary(next)).toEqual({
            currentDamage: 11,
            originalDamage: 8,
        });

        const attackEvents = resolveAttack(next, createQueuedRandom([1]), { includePreDefense: false }, 200);
        const damageEvent = attackEvents.find(event => event.type === 'DAMAGE_DEALT');
        expect((damageEvent as any).payload.amount).toBe(11);
        next = applyEvents(next, attackEvents);
        expect(next.players['1'].resources[RESOURCE_IDS.HP]).toBe(39);
    });

    it('Wild Growth II 主路线应在奖励骰只有 1 个树灵时自动完成 1 次养成', () => {
        const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        const treant = state.core.players['0'];
        const abilityIndex = treant.abilities.findIndex(ability => ability.id === 'wild-growth');
        treant.abilities[abilityIndex] = WILD_GROWTH_2;
        treant.abilityLevels['wild-growth'] = 2;
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING] = 0;
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING] = 0;
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_DIVINE] = 0;
        state.core.players['0'].tokens[TOKEN_IDS.LIFE_SAP] = 0;
        state.core.players['1'].resources[RESOURCE_IDS.HP] = 50;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'wild-growth-2-main',
            isDefendable: true,
            damage: 0,
        };

        const preDefenseEvents = resolveOffensivePreDefenseEffects(state.core, createQueuedRandom([1, 4, 6, 2, 5]), 100);
        expect(preDefenseEvents.some(event => event.type === 'CHOICE_REQUESTED')).toBe(false);
        let next = applyEvents(state.core, preDefenseEvents);
        expect(next.pendingBonusDiceSettlement).toBeDefined();
        const settlementEvents = settleBonusDice(next);
        expect(settlementEvents.some(event => event.type === 'CHOICE_REQUESTED')).toBe(false);
        next = applyEvents(next, settlementEvents);
        expect(next.pendingAttack?.bonusDamage ?? 0).toBe(2);
        expect(next.pendingAttack?.isDefendable).toBe(true);
        expect(next.players['0'].tokens[TOKEN_IDS.LIFE_SAP]).toBe(1);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING]).toBe(1);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING]).toBe(0);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_DIVINE]).toBe(0);

        const attackEvents = resolveAttack(next, createQueuedRandom([1]), { includePreDefense: false }, 200);
        const damageEvent = attackEvents.find(event => event.type === 'DAMAGE_DEALT');
        expect((damageEvent as any).payload.amount).toBe(6);
        next = applyEvents(next, attackEvents);
        expect(next.players['1'].resources[RESOURCE_IDS.HP]).toBe(44);
    });

    it('Wild Growth 基础版应在 2 树枝 + 3 树叶骰面下以 2 基伤结算，并允许移除 1 树灵加伤', () => {
        const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING] = 1;
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
            option.labelKey === 'choices.treantWildGrowth.seedling1'
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
        expect(next.pendingAttack?.bonusDamage).toBe(4);
        expect(next.pendingAttack?.isDefendable).toBe(true);

        const attackEvents = resolveAttack(next, createQueuedRandom([1]), { includePreDefense: false }, 200);
        const damageEvent = attackEvents.find(event => event.type === 'DAMAGE_DEALT');
        expect((damageEvent as any).payload.amount).toBe(6);
        next = applyEvents(next, attackEvents);
        expect(next.players['1'].resources[RESOURCE_IDS.HP]).toBe(44);
    });

    it('Wild Growth II 主路线在奖励骰投出 2 个树灵时应请求对应次数的养成选择', () => {
        const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        const treant = state.core.players['0'];
        const abilityIndex = treant.abilities.findIndex(ability => ability.id === 'wild-growth');
        treant.abilities[abilityIndex] = WILD_GROWTH_2;
        treant.abilityLevels['wild-growth'] = 2;
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING] = 0;
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING] = 0;
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_DIVINE] = 0;
        state.core.players['0'].tokens[TOKEN_IDS.LIFE_SAP] = 0;
        state.core.players['1'].resources[RESOURCE_IDS.HP] = 50;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'wild-growth-2-main',
            isDefendable: true,
            damage: 0,
        };

        const preDefenseEvents = resolveOffensivePreDefenseEffects(state.core, createQueuedRandom([1, 4, 6, 6, 2]), 100);
        let next = applyEvents(state.core, preDefenseEvents);
        const settlementEvents = settleBonusDice(next);
        const choiceEvent = settlementEvents.find(event => event.type === 'CHOICE_REQUESTED');
        expect(choiceEvent).toBeDefined();
        expect((choiceEvent as any).payload.options.every((option: { customId: string }) =>
            option.customId === 'treant-wild-growth-2-cultivate-2-resolve',
        )).toBe(true);
        const selectedOption = (choiceEvent as any).payload.options.find((option: { labelKey?: string }) =>
            option.labelKey === 'choices.treantCultivate.s2_a0_d0'
        );
        expect(selectedOption).toBeDefined();

        next = applyEvents(next, settlementEvents);
        next = reduce(next, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '0',
                sourceAbilityId: 'wild-growth-2-main',
                customId: selectedOption.customId,
                value: selectedOption.value,
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 101,
        } as DiceThroneEvent);

        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING]).toBe(2);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING]).toBe(0);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_DIVINE]).toBe(0);
        expect(next.players['0'].tokens[TOKEN_IDS.LIFE_SAP]).toBe(1);
        expect(next.pendingAttack?.bonusDamage).toBe(2);
        expect(next.pendingAttack?.isDefendable).toBe(true);

        const attackEvents = resolveAttack(next, createQueuedRandom([1]), { includePreDefense: false }, 200);
        const damageEvent = attackEvents.find(event => event.type === 'DAMAGE_DEALT');
        expect((damageEvent as any).payload.amount).toBe(6);
        next = applyEvents(next, attackEvents);
        expect(next.players['1'].resources[RESOURCE_IDS.HP]).toBe(44);
    });

    it('Wild Growth II 的 displayOnly 奖励骰应在养成选择后通过真实 SKIP 链清空，不把展示态残留为最终权威状态', () => {
        const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        const treant = state.core.players['0'];
        const abilityIndex = treant.abilities.findIndex(ability => ability.id === 'wild-growth');
        treant.abilities[abilityIndex] = WILD_GROWTH_2;
        treant.abilityLevels['wild-growth'] = 2;
        treant.tokens[TOKEN_IDS.TREANT_SEEDLING] = 0;
        treant.tokens[TOKEN_IDS.TREANT_SAPLING] = 0;
        treant.tokens[TOKEN_IDS.TREANT_DIVINE] = 0;
        treant.tokens[TOKEN_IDS.LIFE_SAP] = 0;
        state.core.players['1'].resources[RESOURCE_IDS.HP] = 50;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'wild-growth-2-main',
            isDefendable: true,
            damage: 0,
        };

        const preDefenseEvents = resolveOffensivePreDefenseEffects(state.core, createQueuedRandom([1, 4, 6, 6, 2]), 100);
        let next = applyEvents(state.core, preDefenseEvents);
        expect(next.pendingBonusDiceSettlement).toMatchObject({
            sourceAbilityId: 'wild-growth-2-main',
            displayOnly: true,
        });
        const settlementEvents = settleBonusDice(next);
        const selectedOption = settlementEvents
            .find(event => event.type === 'CHOICE_REQUESTED');
        const cultivateTwoSeedlings = (selectedOption as any).payload.options.find((option: { labelKey?: string }) =>
            option.labelKey === 'choices.treantCultivate.s2_a0_d0'
        );
        expect(cultivateTwoSeedlings).toBeDefined();

        next = applyEvents(next, settlementEvents);
        next = reduce(next, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '0',
                sourceAbilityId: 'wild-growth-2-main',
                customId: cultivateTwoSeedlings.customId,
                value: cultivateTwoSeedlings.value,
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 101,
        } as DiceThroneEvent);

        const attackEvents = resolveAttack(next, createQueuedRandom([1]), { includePreDefense: false }, 200);
        next = applyEvents(next, attackEvents);

        expect(next.players['1'].resources[RESOURCE_IDS.HP]).toBe(44);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING]).toBe(2);
        expect(next.players['0'].tokens[TOKEN_IDS.LIFE_SAP]).toBe(1);
        expect(next.pendingAttack).toBeNull();
        expect(next.pendingDamage).toBeUndefined();
        expect(next.pendingBonusDiceSettlement).toBeUndefined();
        expect(next.pendingAttack).toBeNull();
        expect(next.pendingDamage).toBeUndefined();
        expect(next.players['1'].resources[RESOURCE_IDS.HP]).toBe(44);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING]).toBe(2);
        expect(next.players['0'].tokens[TOKEN_IDS.LIFE_SAP]).toBe(1);
    });

    it('Wild Growth II 应拒绝伪造的移除 3 树灵选择', () => {
        const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        const treant = state.core.players['0'];
        const abilityIndex = treant.abilities.findIndex(ability => ability.id === 'wild-growth');
        treant.abilities[abilityIndex] = WILD_GROWTH_2;
        treant.abilityLevels['wild-growth'] = 2;
        treant.tokens[TOKEN_IDS.TREANT_SEEDLING] = 3;
        treant.tokens[TOKEN_IDS.TREANT_SAPLING] = 0;
        treant.tokens[TOKEN_IDS.TREANT_DIVINE] = 0;
        treant.tokens[TOKEN_IDS.LIFE_SAP] = 0;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'wild-growth',
            isDefendable: true,
            damage: 0,
            bonusDamage: 0,
        };

        const next = reduce(state.core, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '0',
                sourceAbilityId: 'wild-growth',
                customId: 'treant-wild-growth-resolve',
                value: 3,
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 101,
        } as DiceThroneEvent);

        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING]).toBe(3);
        expect(next.pendingAttack?.bonusDamage).toBe(0);
        expect(next.pendingAttack?.isDefendable).toBe(true);
    });

    it('Wild Growth II 应忽略字符串 choice value，不能按数字字符串消耗资源', () => {
        const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        const treant = state.core.players['0'];
        treant.tokens[TOKEN_IDS.TREANT_SEEDLING] = 1;
        treant.tokens[TOKEN_IDS.LIFE_SAP] = 1;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'wild-growth',
            isDefendable: true,
            damage: 0,
            bonusDamage: 0,
        };

        const next = reduce(state.core, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '0',
                sourceAbilityId: 'wild-growth',
                customId: 'treant-wild-growth-resolve',
                value: '1001' as unknown as number,
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 101,
        } as DiceThroneEvent);

        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING]).toBe(1);
        expect(next.players['0'].tokens[TOKEN_IDS.LIFE_SAP]).toBe(1);
        expect(next.pendingAttack?.bonusDamage).toBe(0);
        expect(next.pendingAttack?.isDefendable).toBe(true);
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

    it('Shattering Fist 基础版可选择不移除树灵，且不施加刺藤', () => {
        const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING] = 1;
        state.core.players['1'].tokens[TOKEN_IDS.THORN] = 0;

        const next = reduce(state.core, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '0',
                sourceAbilityId: 'shattering-fist-3',
                customId: 'treant-shattering-fist-resolve',
                value: 0,
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 101,
        } as DiceThroneEvent);

        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING]).toBe(1);
        expect(next.players['1'].tokens[TOKEN_IDS.THORN]).toBe(0);
    });

    it('Shattering Fist 基础版应拒绝伪造移除 2 个树灵', () => {
        const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING] = 2;
        state.core.players['1'].tokens[TOKEN_IDS.THORN] = 0;

        const next = reduce(state.core, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '0',
                sourceAbilityId: 'shattering-fist-3',
                customId: 'treant-shattering-fist-resolve',
                value: 2,
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 101,
        } as DiceThroneEvent);

        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING]).toBe(2);
        expect(next.players['1'].tokens[TOKEN_IDS.THORN]).toBe(0);
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

    it('Shattering Fist III 应拒绝伪造的不可能养成结果', () => {
        const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING] = 0;
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING] = 0;
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_DIVINE] = 0;

        const next = reduce(state.core, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '0',
                sourceAbilityId: 'shattering-fist-3-5',
                customId: 'treant-shattering-fist-3-cultivate-resolve',
                value: 999,
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 101,
        } as DiceThroneEvent);

        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING]).toBe(0);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING]).toBe(0);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_DIVINE]).toBe(0);
    });

    it('Shattering Fist III 未投出三同点时不应弹养成选择，但仍施加刺藤与伤害', () => {
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
            value: [1, 2, 3, 4, 5][index],
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
        expect(preDefenseEvents.some(event => event.type === 'CHOICE_REQUESTED')).toBe(false);
        let next = applyEvents(state.core, preDefenseEvents);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING]).toBe(0);
        expect(next.players['1'].tokens[TOKEN_IDS.THORN]).toBe(1);

        const attackEvents = resolveAttack(next, createQueuedRandom([1]), { includePreDefense: false }, 200);
        const damageEvent = attackEvents.find(event => event.type === 'DAMAGE_DEALT');
        expect((damageEvent as any).payload.amount).toBe(7);
        next = applyEvents(next, attackEvents);
        expect(next.players['1'].resources[RESOURCE_IDS.HP]).toBe(43);
    });

    it('Shattering Fist III 的三同点养成判断应只读取攻击快照，而不是当前活跃骰面', () => {
        const tripletAttackState = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        tripletAttackState.core.players['0'].abilities = tripletAttackState.core.players['0'].abilities.map((ability) => (
            ability.id === 'shattering-fist' ? SHATTERING_FIST_3 : ability
        ));
        tripletAttackState.core.players['0'].abilityLevels['shattering-fist'] = 3;
        tripletAttackState.core.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING] = 0;
        tripletAttackState.core.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING] = 0;
        tripletAttackState.core.players['0'].tokens[TOKEN_IDS.TREANT_DIVINE] = 0;
        tripletAttackState.core.rollDiceCount = 5;
        tripletAttackState.core.dice = tripletAttackState.core.dice.slice(0, 5).map((die, index) => ({
            ...die,
            id: index,
            value: [1, 2, 3, 4, 5][index],
            symbol: TREANT_DICE_FACE_IDS.BRANCH,
            ownerId: '0',
        }));
        tripletAttackState.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'shattering-fist-3-5',
            isDefendable: true,
            damage: 0,
            attackDiceValues: [2, 2, 2, 4, 5],
        };

        const tripletEvents = resolveOffensivePreDefenseEffects(tripletAttackState.core, createQueuedRandom([1]), 100);
        expect(tripletEvents.some(event => event.type === 'CHOICE_REQUESTED')).toBe(true);

        const nonTripletAttackState = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        nonTripletAttackState.core.players['0'].abilities = nonTripletAttackState.core.players['0'].abilities.map((ability) => (
            ability.id === 'shattering-fist' ? SHATTERING_FIST_3 : ability
        ));
        nonTripletAttackState.core.players['0'].abilityLevels['shattering-fist'] = 3;
        nonTripletAttackState.core.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING] = 0;
        nonTripletAttackState.core.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING] = 0;
        nonTripletAttackState.core.players['0'].tokens[TOKEN_IDS.TREANT_DIVINE] = 0;
        nonTripletAttackState.core.rollDiceCount = 5;
        nonTripletAttackState.core.dice = nonTripletAttackState.core.dice.slice(0, 5).map((die, index) => ({
            ...die,
            id: index,
            value: [6, 6, 6, 1, 2][index],
            symbol: TREANT_DICE_FACE_IDS.BRANCH,
            ownerId: '0',
        }));
        nonTripletAttackState.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'shattering-fist-3-5',
            isDefendable: true,
            damage: 0,
            attackDiceValues: [1, 2, 3, 4, 5],
        };

        const nonTripletEvents = resolveOffensivePreDefenseEffects(nonTripletAttackState.core, createQueuedRandom([1]), 101);
        expect(nonTripletEvents.some(event => event.type === 'CHOICE_REQUESTED')).toBe(false);
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

    it('Tend & Care II 主路线应按升级文本养成 4 树灵', () => {
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
            sourceAbilityId: 'tend-care-2-main',
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
                sourceAbilityId: 'tend-care-2-main',
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

    it('Tend & Care II 的培育分支应走独立 6 次养成路由', () => {
        const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        const treant = state.core.players['0'];
        const abilityIndex = treant.abilities.findIndex(ability => ability.id === 'tend-care');
        treant.abilities[abilityIndex] = TEND_CARE_2;
        treant.abilityLevels['tend-care'] = 2;
        treant.tokens[TOKEN_IDS.TREANT_SEEDLING] = 0;
        treant.tokens[TOKEN_IDS.TREANT_SAPLING] = 0;
        treant.tokens[TOKEN_IDS.TREANT_DIVINE] = 0;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'tend-care-2-cultivate',
            isDefendable: true,
            damage: 0,
        };

        const preDefenseEvents = resolveOffensivePreDefenseEffects(state.core, createQueuedRandom([1]), 100);
        const choiceEvent = preDefenseEvents.find(event => event.type === 'CHOICE_REQUESTED');
        expect(choiceEvent).toBeDefined();
        expect((choiceEvent as any).payload.options.every((option: { customId: string }) =>
            option.customId === 'treant-tend-care-2-cultivate-resolve',
        )).toBe(true);

        const selectedOption = (choiceEvent as any).payload.options[0];
        const selectedValue = Number(selectedOption.value);
        let next = applyEvents(state.core, preDefenseEvents);
        next = reduce(next, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '0',
                sourceAbilityId: 'tend-care-2-cultivate',
                customId: selectedOption.customId,
                value: selectedOption.value,
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 101,
        } as DiceThroneEvent);

        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING]).toBe(selectedValue % 10);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING]).toBe(Math.floor(selectedValue / 10) % 10);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_DIVINE]).toBe(Math.floor(selectedValue / 100) % 10);
    });

    it('Tend & Care II 的培育分支在选择后应按 nonattack closeout 收口，不得再进入防御链', () => {
        const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        const treant = state.core.players['0'];
        const abilityIndex = treant.abilities.findIndex(ability => ability.id === 'tend-care');
        treant.abilities[abilityIndex] = TEND_CARE_2;
        treant.abilityLevels['tend-care'] = 2;
        treant.tokens[TOKEN_IDS.TREANT_SEEDLING] = 0;
        treant.tokens[TOKEN_IDS.TREANT_SAPLING] = 0;
        treant.tokens[TOKEN_IDS.TREANT_DIVINE] = 0;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'tend-care-2-cultivate',
            defenseAbilityId: 'blink',
            isDefendable: true,
            damage: 0,
        };

        const preDefenseEvents = resolveOffensivePreDefenseEffects(state.core, createQueuedRandom([1]), 100);
        const choiceEvent = preDefenseEvents.find(event => event.type === 'CHOICE_REQUESTED');
        expect(choiceEvent).toBeDefined();
        const selectedOption = (choiceEvent as any).payload.options[0];

        let next = applyEvents(state.core, preDefenseEvents);
        next = reduce(next, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '0',
                sourceAbilityId: 'tend-care-2-cultivate',
                customId: selectedOption.customId,
                value: selectedOption.value,
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 101,
        } as DiceThroneEvent);

        expect(next.pendingAttack?.isDefendable).toBe(false);
        expect(next.pendingDamage).toBeUndefined();

        const attackEvents = resolveAttack(next, createQueuedRandom([1, 2, 4]), { includePreDefense: false }, 200);
        expect(attackEvents.some(event => event.type === 'ATTACK_DEFENSE_RESOLVED')).toBe(false);
        expect(attackEvents.some(event => event.type === 'BONUS_DIE_ROLLED')).toBe(false);
        expect(attackEvents.find(event => event.type === 'ATTACK_RESOLVED')?.payload).toMatchObject({
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'tend-care-2-cultivate',
            defenseAbilityId: 'blink',
            totalDamage: 0,
        });
    });

    it('Tend & Care II 在 4 人模式下生命源泉可给队友，但刺藤只能给对手', () => {
        const state = createTreantTeamMatchup();
        const treant = state.core.players['0'];
        const abilityIndex = treant.abilities.findIndex(ability => ability.id === 'tend-care');
        treant.abilities[abilityIndex] = TEND_CARE_2;
        treant.abilityLevels['tend-care'] = 2;
        treant.tokens[TOKEN_IDS.TREANT_SEEDLING] = 1;
        treant.tokens[TOKEN_IDS.TREANT_SAPLING] = 0;
        treant.tokens[TOKEN_IDS.TREANT_DIVINE] = 0;
        state.core.players['2'].tokens[TOKEN_IDS.LIFE_SAP] = 0;
        state.core.players['1'].tokens[TOKEN_IDS.THORN] = 0;
        state.core.players['3'].tokens[TOKEN_IDS.THORN] = 0;
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
        const options = (choiceEvent as any).payload.options as Array<{ labelParams?: Record<string, unknown>; customId: string; value: number }>;
        expect(options.some(option => option.labelParams?.thornTarget === 'P3')).toBe(false);
        const selectedOption = options.find(option =>
            option.labelParams?.lifeSapTarget === 'P3'
            && option.labelParams?.thornTarget === 'P4'
        );
        expect(selectedOption).toBeDefined();
        const expectedSeedling = Number(selectedOption?.labelParams?.seedling ?? 0);
        const expectedSapling = Number(selectedOption?.labelParams?.sapling ?? 0);
        const expectedDivine = Number(selectedOption?.labelParams?.divine ?? 0);

        let next = applyEvents(state.core, preDefenseEvents);
        next = reduce(next, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '0',
                sourceAbilityId: 'tend-care',
                customId: selectedOption?.customId,
                value: selectedOption?.value,
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 101,
        } as DiceThroneEvent);

        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING]).toBe(expectedSeedling);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING]).toBe(expectedSapling);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_DIVINE]).toBe(expectedDivine);
        expect(next.players['2'].tokens[TOKEN_IDS.LIFE_SAP]).toBe(1);
        expect(next.players['3'].tokens[TOKEN_IDS.THORN]).toBe(1);
        expect(next.players['1'].tokens[TOKEN_IDS.THORN]).toBe(0);
    });

    it('Tend & Care II 主路线在生命源泉和刺藤目标已满时不应越过 token 上限', () => {
        const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        const treant = state.core.players['0'];
        const abilityIndex = treant.abilities.findIndex(ability => ability.id === 'tend-care');
        treant.abilities[abilityIndex] = TEND_CARE_2;
        treant.abilityLevels['tend-care'] = 2;
        treant.tokens[TOKEN_IDS.TREANT_SEEDLING] = 0;
        treant.tokens[TOKEN_IDS.TREANT_SAPLING] = 0;
        treant.tokens[TOKEN_IDS.TREANT_DIVINE] = 0;
        treant.tokens[TOKEN_IDS.LIFE_SAP] = 1;
        state.core.players['1'].tokens[TOKEN_IDS.THORN] = 1;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'tend-care-2-main',
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
                sourceAbilityId: 'tend-care-2-main',
                customId: selectedOption.customId,
                value: selectedOption.value,
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 101,
        } as DiceThroneEvent);

        expect(next.players['0'].tokens[TOKEN_IDS.LIFE_SAP]).toBe(1);
        expect(next.players['1'].tokens[TOKEN_IDS.THORN]).toBe(1);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING]).toBe(2);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING]).toBe(1);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_DIVINE]).toBe(0);
    });

    it('Tend & Care II 应拒绝座位表外生命源泉目标和对手目标索引', () => {
        const state = createTreantTeamMatchup();
        const treant = state.core.players['0'];
        const abilityIndex = treant.abilities.findIndex(ability => ability.id === 'tend-care');
        treant.abilities[abilityIndex] = TEND_CARE_2;
        treant.abilityLevels['tend-care'] = 2;
        treant.tokens[TOKEN_IDS.TREANT_SEEDLING] = 0;
        treant.tokens[TOKEN_IDS.TREANT_SAPLING] = 0;
        treant.tokens[TOKEN_IDS.TREANT_DIVINE] = 0;
        for (const playerId of state.core.seatingOrder) {
            state.core.players[playerId].tokens[TOKEN_IDS.LIFE_SAP] = 0;
            state.core.players[playerId].tokens[TOKEN_IDS.THORN] = 0;
        }

        const forgedLifeSapTarget = reduce(state.core, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '0',
                sourceAbilityId: 'tend-care',
                customId: 'treant-tend-care-4-resolve',
                value: 16012,
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 101,
        } as DiceThroneEvent);
        expect(forgedLifeSapTarget.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING]).toBe(0);
        expect(forgedLifeSapTarget.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING]).toBe(0);
        expect(forgedLifeSapTarget.players['2'].tokens[TOKEN_IDS.LIFE_SAP]).toBe(0);
        expect(forgedLifeSapTarget.players['1'].tokens[TOKEN_IDS.THORN]).toBe(0);
        expect(forgedLifeSapTarget.players['3'].tokens[TOKEN_IDS.THORN]).toBe(0);

        const forgedThornTarget = reduce(state.core, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '0',
                sourceAbilityId: 'tend-care',
                customId: 'treant-tend-care-4-resolve',
                value: 61012,
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 102,
        } as DiceThroneEvent);
        expect(forgedThornTarget.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING]).toBe(0);
        expect(forgedThornTarget.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING]).toBe(0);
        expect(forgedThornTarget.players['0'].tokens[TOKEN_IDS.LIFE_SAP]).toBe(0);
        expect(forgedThornTarget.players['1'].tokens[TOKEN_IDS.THORN]).toBe(0);
        expect(forgedThornTarget.players['3'].tokens[TOKEN_IDS.THORN]).toBe(0);
    });

    it('Tend & Care 的 3/4 档应按当前技能版本路由，不能互相串线', () => {
        const baseState = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        const upgradeState = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        for (const state of [baseState.core, upgradeState.core]) {
            state.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING] = 0;
            state.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING] = 0;
            state.players['0'].tokens[TOKEN_IDS.TREANT_DIVINE] = 0;
            state.players['0'].tokens[TOKEN_IDS.LIFE_SAP] = 0;
            state.players['1'].tokens[TOKEN_IDS.LIFE_SAP] = 0;
            state.players['1'].tokens[TOKEN_IDS.THORN] = 0;
            state.pendingAttack = {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: state === baseState.core ? 'tend-care' : 'tend-care-2-main',
                isDefendable: true,
                damage: 0,
            };
        }

        const upgradeTreant = upgradeState.core.players['0'];
        const abilityIndex = upgradeTreant.abilities.findIndex(ability => ability.id === 'tend-care');
        upgradeTreant.abilities[abilityIndex] = TEND_CARE_2;
        upgradeTreant.abilityLevels['tend-care'] = 2;

        const baseChoiceEvent = resolveOffensivePreDefenseEffects(baseState.core, createQueuedRandom([1]), 100)
            .find(event => event.type === 'CHOICE_REQUESTED');
        expect(baseChoiceEvent).toBeDefined();
        expect((baseChoiceEvent as any).payload.options.every((option: { customId: string }) =>
            option.customId === 'treant-tend-care-3-resolve',
        )).toBe(true);

        const upgradeChoiceEvent = resolveOffensivePreDefenseEffects(upgradeState.core, createQueuedRandom([1]), 100)
            .find(event => event.type === 'CHOICE_REQUESTED');
        expect(upgradeChoiceEvent).toBeDefined();
        expect((upgradeChoiceEvent as any).payload.options.every((option: { customId: string }) =>
            option.customId === 'treant-tend-care-4-resolve',
        )).toBe(true);

        const baseForged = reduce(baseState.core, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '0',
                sourceAbilityId: 'tend-care',
                customId: 'treant-tend-care-4-resolve',
                value: (upgradeChoiceEvent as any).payload.options[0].value,
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 101,
        } as DiceThroneEvent);
        expect(baseForged.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING]).toBe(0);
        expect(baseForged.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING]).toBe(0);
        expect(baseForged.players['0'].tokens[TOKEN_IDS.TREANT_DIVINE]).toBe(0);
        expect(baseForged.players['0'].tokens[TOKEN_IDS.LIFE_SAP]).toBe(0);
        expect(baseForged.players['1'].tokens[TOKEN_IDS.THORN]).toBe(0);

        const upgradeForged = reduce(upgradeState.core, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '0',
                sourceAbilityId: 'tend-care-2-main',
                customId: 'treant-tend-care-3-resolve',
                value: (baseChoiceEvent as any).payload.options[0].value,
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 102,
        } as DiceThroneEvent);
        expect(upgradeForged.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING]).toBe(0);
        expect(upgradeForged.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING]).toBe(0);
        expect(upgradeForged.players['0'].tokens[TOKEN_IDS.TREANT_DIVINE]).toBe(0);
        expect(upgradeForged.players['0'].tokens[TOKEN_IDS.LIFE_SAP]).toBe(0);
        expect(upgradeForged.players['1'].tokens[TOKEN_IDS.THORN]).toBe(0);
    });

    it('Tend & Care 基础版应使用 3 树灵 choice handler，不接受 4 树灵结果', () => {
        const state = createTreantTeamMatchup();
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING] = 0;
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING] = 0;
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_DIVINE] = 0;
        state.core.activatingAbilityId = 'tend-care';
        state.core.currentChoiceSourceAbilityId = 'tend-care';
        for (const playerId of state.core.seatingOrder) {
            state.core.players[playerId].tokens[TOKEN_IDS.LIFE_SAP] = 0;
            state.core.players[playerId].tokens[TOKEN_IDS.THORN] = 0;
        }

        let next = reduce(state.core, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '0',
                sourceAbilityId: 'tend-care',
                customId: 'treant-tend-care-3-resolve',
                value: 11011,
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 101,
        } as DiceThroneEvent);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING]).toBe(1);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING]).toBe(1);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_DIVINE]).toBe(0);
        expect(next.players['0'].tokens[TOKEN_IDS.LIFE_SAP]).toBe(1);
        expect(next.players['1'].tokens[TOKEN_IDS.THORN]).toBe(1);

        next = reduce(state.core, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '0',
                sourceAbilityId: 'tend-care',
                customId: 'treant-tend-care-3-resolve',
                value: 11012,
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 102,
        } as DiceThroneEvent);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING]).toBe(0);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING]).toBe(0);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_DIVINE]).toBe(0);
        expect(next.players['0'].tokens[TOKEN_IDS.LIFE_SAP]).toBe(0);
        expect(next.players['1'].tokens[TOKEN_IDS.THORN]).toBe(0);
        expect(next.players['3'].tokens[TOKEN_IDS.THORN]).toBe(0);
    });

    it('Vengeful Vines 基础版应在小顺子时施加刺藤并造成 7 伤害', () => {
        const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        state.core.players['1'].tokens[TOKEN_IDS.THORN] = 0;
        state.core.players['1'].resources[RESOURCE_IDS.HP] = 50;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'vengeful-vines',
            isDefendable: true,
            damage: 0,
        };

        const events = resolveAttack(state.core, createQueuedRandom([1]), { includePreDefense: true }, 100);
        const damageEvent = events.find(event => event.type === 'DAMAGE_DEALT');
        expect((damageEvent as any).payload.amount).toBe(7);

        const next = applyEvents(state.core, events);
        expect(next.players['1'].tokens[TOKEN_IDS.THORN]).toBe(1);
        expect(next.players['1'].resources[RESOURCE_IDS.HP]).toBe(43);
    });

    it('Vengeful Vines II 主路线应在小顺子时施加刺藤并造成 8 伤害', () => {
        const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        const treant = state.core.players['0'];
        const abilityIndex = treant.abilities.findIndex(ability => ability.id === 'vengeful-vines');
        treant.abilities[abilityIndex] = VENGEFUL_VINES_2;
        treant.abilityLevels['vengeful-vines'] = 2;
        state.core.players['1'].tokens[TOKEN_IDS.THORN] = 0;
        state.core.players['1'].resources[RESOURCE_IDS.HP] = 50;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'vengeful-vines-2-main',
            isDefendable: true,
            damage: 0,
        };

        const events = resolveAttack(state.core, createQueuedRandom([1]), { includePreDefense: true }, 100);
        const damageEvent = events.find(event => event.type === 'DAMAGE_DEALT');
        expect((damageEvent as any).payload.amount).toBe(8);

        const next = applyEvents(state.core, events);
        expect(next.players['1'].tokens[TOKEN_IDS.THORN]).toBe(1);
        expect(next.players['1'].resources[RESOURCE_IDS.HP]).toBe(42);
    });

    it('Vengeful Vines II 的苦痛根系分支应按当前树灵总数造成真实伤害', () => {
        const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        const treant = state.core.players['0'];
        const abilityIndex = treant.abilities.findIndex(ability => ability.id === 'vengeful-vines');
        treant.abilities[abilityIndex] = VENGEFUL_VINES_2;
        treant.abilityLevels['vengeful-vines'] = 2;
        treant.tokens[TOKEN_IDS.TREANT_SEEDLING] = 1;
        treant.tokens[TOKEN_IDS.TREANT_SAPLING] = 1;
        treant.tokens[TOKEN_IDS.TREANT_DIVINE] = 1;
        state.core.players['1'].resources[RESOURCE_IDS.HP] = 50;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'vengeful-vines-2-pain',
            isDefendable: false,
            damage: 0,
        };

        const events = resolveAttack(state.core, createQueuedRandom([1]), { includePreDefense: true }, 100);
        const damageEvent = events.find(event => event.type === 'DAMAGE_DEALT');
        expect((damageEvent as any).payload.amount).toBe(3);
        expect((damageEvent as any).payload.unblockable).toBe(true);

        const next = applyEvents(state.core, events);
        expect(next.players['1'].resources[RESOURCE_IDS.HP]).toBe(47);
    });

    it('Vengeful Vines II 的苦痛根系分支应在直伤后保持 nonattack closeout，不得再触发防御', () => {
        const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        const treant = state.core.players['0'];
        const abilityIndex = treant.abilities.findIndex(ability => ability.id === 'vengeful-vines');
        treant.abilities[abilityIndex] = VENGEFUL_VINES_2;
        treant.abilityLevels['vengeful-vines'] = 2;
        treant.tokens[TOKEN_IDS.TREANT_SEEDLING] = 1;
        treant.tokens[TOKEN_IDS.TREANT_SAPLING] = 1;
        treant.tokens[TOKEN_IDS.TREANT_DIVINE] = 1;
        state.core.players['1'].resources[RESOURCE_IDS.HP] = 50;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'vengeful-vines-2-pain',
            defenseAbilityId: 'blink',
            isDefendable: false,
            damage: 0,
        };

        const events = resolveAttack(state.core, createQueuedRandom([1, 2, 4]), { includePreDefense: true }, 100);
        const next = applyEvents(state.core, events);

        expect(events.some(event => event.type === 'ATTACK_DEFENSE_RESOLVED')).toBe(false);
        expect(events.some(event => event.type === 'TOKEN_RESPONSE_REQUESTED')).toBe(false);
        expect(next.players['1'].resources[RESOURCE_IDS.HP]).toBe(47);
        expect(next.pendingAttack).toBeNull();
        expect(next.pendingDamage).toBeUndefined();
    });

    it('Forest Awakens 应让自己和队友获得生命源泉，养成 5 树灵，施加刺藤后造成 10 伤害', () => {
        const state = createTreantTeamMatchup();
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

    it('Forest Awakens 在无队友模式下只给自己生命源泉，不应误给对手', () => {
        const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING] = 0;
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING] = 0;
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_DIVINE] = 0;
        state.core.players['0'].tokens[TOKEN_IDS.LIFE_SAP] = 0;
        state.core.players['1'].tokens[TOKEN_IDS.LIFE_SAP] = 0;
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

        expect(next.players['0'].tokens[TOKEN_IDS.LIFE_SAP]).toBe(1);
        expect(next.players['1'].tokens[TOKEN_IDS.LIFE_SAP]).toBe(0);
        expect(next.players['1'].tokens[TOKEN_IDS.THORN]).toBe(1);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING]).toBe(1);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING]).toBe(2);

        const attackEvents = resolveAttack(next, createQueuedRandom([1]), { includePreDefense: false }, 200);
        const damageEvent = attackEvents.find(event => event.type === 'DAMAGE_DEALT');
        expect((damageEvent as any).payload.amount).toBe(10);
    });

    it('Forest Awakens 应拒绝伪造的不可能养成结果', () => {
        const state = createTreantTeamMatchup();
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING] = 0;
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING] = 0;
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_DIVINE] = 0;
        state.core.players['0'].tokens[TOKEN_IDS.LIFE_SAP] = 0;
        state.core.players['2'].tokens[TOKEN_IDS.LIFE_SAP] = 0;
        state.core.players['1'].tokens[TOKEN_IDS.THORN] = 0;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'forest-awakens',
            isDefendable: true,
            isUltimate: true,
            damage: 0,
        };

        const next = reduce(state.core, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '0',
                sourceAbilityId: 'forest-awakens',
                customId: 'treant-forest-awakens-resolve',
                value: 999,
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 101,
        } as DiceThroneEvent);

        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING]).toBe(0);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING]).toBe(0);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_DIVINE]).toBe(0);
        expect(next.players['0'].tokens[TOKEN_IDS.LIFE_SAP]).toBe(0);
        expect(next.players['2'].tokens[TOKEN_IDS.LIFE_SAP]).toBe(0);
        expect(next.players['1'].tokens[TOKEN_IDS.THORN]).toBe(0);
    });

    it('Forest Awakens 在生命源泉和刺藤已满时仍应钳制到 token 上限', () => {
        const state = createTreantTeamMatchup();
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING] = 0;
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING] = 0;
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_DIVINE] = 0;
        state.core.players['0'].tokens[TOKEN_IDS.LIFE_SAP] = 1;
        state.core.players['2'].tokens[TOKEN_IDS.LIFE_SAP] = 1;
        state.core.players['1'].tokens[TOKEN_IDS.THORN] = 1;
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

        expect(next.players['0'].tokens[TOKEN_IDS.LIFE_SAP]).toBe(1);
        expect(next.players['2'].tokens[TOKEN_IDS.LIFE_SAP]).toBe(1);
        expect(next.players['1'].tokens[TOKEN_IDS.THORN]).toBe(1);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING]).toBe(1);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING]).toBe(2);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_DIVINE]).toBe(0);

        const attackEvents = resolveAttack(next, createQueuedRandom([1]), { includePreDefense: false }, 200);
        const damageEvent = attackEvents.find(event => event.type === 'DAMAGE_DEALT');
        expect((damageEvent as any).payload.amount).toBe(10);
    });

    it('Nature Touch II 主路线应选择养成 2 树灵，并按养成后的树灵总数增加不可防御伤害', () => {
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
            sourceAbilityId: 'nature-touch-2-main',
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
                sourceAbilityId: 'nature-touch-2-main',
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

    it('Nature Touch II 的自然之怜分支应治疗、得 CP、抽牌并完成 1 次养成', () => {
        const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        const treant = state.core.players['0'];
        const abilityIndex = treant.abilities.findIndex(ability => ability.id === 'nature-touch');
        treant.abilities[abilityIndex] = NATURE_TOUCH_2;
        treant.abilityLevels['nature-touch'] = 2;
        treant.tokens[TOKEN_IDS.TREANT_SEEDLING] = 1;
        treant.tokens[TOKEN_IDS.TREANT_SAPLING] = 0;
        treant.tokens[TOKEN_IDS.TREANT_DIVINE] = 0;
        treant.resources[RESOURCE_IDS.HP] = 40;
        treant.resources[RESOURCE_IDS.CP] = 1;
        const deckBefore = treant.deck.length;
        const handBefore = treant.hand.length;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'nature-touch-2-mercy',
            isDefendable: true,
            damage: 0,
        };

        const preDefenseEvents = resolveOffensivePreDefenseEffects(state.core, createQueuedRandom([1]), 100);
        const choiceEvent = preDefenseEvents.find(event => event.type === 'CHOICE_REQUESTED');
        expect(choiceEvent).toBeDefined();
        expect((choiceEvent as any).payload.options.every((option: { customId: string }) =>
            option.customId === 'treant-nature-touch-2-mercy-resolve',
        )).toBe(true);
        const selectedOption = (choiceEvent as any).payload.options.find((option: { labelKey?: string }) =>
            option.labelKey === 'choices.treantCultivate.s2_a0_d0'
        );
        expect(selectedOption).toBeDefined();

        let next = applyEvents(state.core, preDefenseEvents);
        expect(next.players['0'].resources[RESOURCE_IDS.HP]).toBe(41);
        expect(next.players['0'].resources[RESOURCE_IDS.CP]).toBe(2);
        expect(next.players['0'].deck.length).toBe(deckBefore - 1);
        expect(next.players['0'].hand.length).toBe(handBefore + 1);

        next = reduce(next, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '0',
                sourceAbilityId: 'nature-touch-2-mercy',
                customId: selectedOption.customId,
                value: selectedOption.value,
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 101,
        } as DiceThroneEvent);

        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING]).toBe(2);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING]).toBe(0);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_DIVINE]).toBe(0);
        expect(next.pendingAttack?.isDefendable).toBe(false);
    });

    it('Nature Touch II 的自然之怜分支在养成后应保持 nonattack closeout，不得再进入防御链', () => {
        const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        const treant = state.core.players['0'];
        const abilityIndex = treant.abilities.findIndex(ability => ability.id === 'nature-touch');
        treant.abilities[abilityIndex] = NATURE_TOUCH_2;
        treant.abilityLevels['nature-touch'] = 2;
        treant.tokens[TOKEN_IDS.TREANT_SEEDLING] = 1;
        treant.tokens[TOKEN_IDS.TREANT_SAPLING] = 0;
        treant.tokens[TOKEN_IDS.TREANT_DIVINE] = 0;
        treant.resources[RESOURCE_IDS.HP] = 40;
        treant.resources[RESOURCE_IDS.CP] = 1;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'nature-touch-2-mercy',
            defenseAbilityId: 'blink',
            isDefendable: true,
            damage: 0,
        };

        const preDefenseEvents = resolveOffensivePreDefenseEffects(state.core, createQueuedRandom([1]), 100);
        const choiceEvent = preDefenseEvents.find(event => event.type === 'CHOICE_REQUESTED');
        expect(choiceEvent).toBeDefined();
        const selectedOption = (choiceEvent as any).payload.options.find((option: { labelKey?: string }) =>
            option.labelKey === 'choices.treantCultivate.s2_a0_d0'
        );
        expect(selectedOption).toBeDefined();

        let next = applyEvents(state.core, preDefenseEvents);
        next = reduce(next, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '0',
                sourceAbilityId: 'nature-touch-2-mercy',
                customId: selectedOption.customId,
                value: selectedOption.value,
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 101,
        } as DiceThroneEvent);

        expect(next.pendingAttack?.isDefendable).toBe(false);
        expect(next.pendingDamage).toBeUndefined();

        const attackEvents = resolveAttack(next, createQueuedRandom([1, 2, 4]), { includePreDefense: false }, 200);
        expect(attackEvents.some(event => event.type === 'ATTACK_DEFENSE_RESOLVED')).toBe(false);
        expect(attackEvents.some(event => event.type === 'BONUS_DIE_ROLLED')).toBe(false);
        expect(attackEvents.find(event => event.type === 'ATTACK_RESOLVED')?.payload).toMatchObject({
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'nature-touch-2-mercy',
            defenseAbilityId: 'blink',
            totalDamage: 0,
        });
    });

    it('Nature Touch 基础版应按养成后的树灵总数增加不可防御伤害', () => {
        const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        const treant = state.core.players['0'];
        treant.tokens[TOKEN_IDS.TREANT_SEEDLING] = 0;
        treant.tokens[TOKEN_IDS.TREANT_SAPLING] = 0;
        treant.tokens[TOKEN_IDS.TREANT_DIVINE] = 0;
        state.core.players['1'].resources[RESOURCE_IDS.HP] = 50;
        state.core.players['1'].tokens[TOKEN_IDS.THORN] = 0;
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
            option.labelKey === 'choices.treantCultivate.s2_a0_d0'
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

        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING]).toBe(2);
        expect(next.pendingAttack?.bonusDamage).toBe(2);

        const attackEvents = resolveAttack(next, createQueuedRandom([1]), { includePreDefense: false }, 200);
        expect(attackEvents.some(event => event.type === 'ATTACK_DEFENSE_RESOLVED')).toBe(false);
        const damageEvent = attackEvents.find(event => event.type === 'DAMAGE_DEALT');
        expect((damageEvent as any).payload.amount).toBe(7);
        expect((damageEvent as any).payload.unblockable).toBe(true);
        next = applyEvents(next, attackEvents);
        expect(next.players['1'].resources[RESOURCE_IDS.HP]).toBe(43);
    });

    it('Nature Touch 应拒绝伪造的不可能养成结果且不追加伤害', () => {
        const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING] = 0;
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING] = 0;
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_DIVINE] = 0;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'nature-touch',
            isDefendable: false,
            damage: 0,
            bonusDamage: 0,
        };

        const next = reduce(state.core, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '0',
                sourceAbilityId: 'nature-touch',
                customId: 'treant-nature-touch-cultivate-resolve',
                value: 999,
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 101,
        } as DiceThroneEvent);

        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING]).toBe(0);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING]).toBe(0);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_DIVINE]).toBe(0);
        expect(next.pendingAttack?.bonusDamage).toBe(0);
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

    it('Treant 通用养成动作卡应拒绝伪造的不可能养成结果', () => {
        const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING] = 0;
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING] = 0;
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_DIVINE] = 0;

        const next = reduce(state.core, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '0',
                sourceAbilityId: 'treant-card-cultivate',
                customId: 'treant-card-cultivate-3-resolve',
                value: 999,
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 101,
        } as DiceThroneEvent);

        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING]).toBe(0);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING]).toBe(0);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_DIVINE]).toBe(0);
    });

    it('Treant 通用养成动作卡应拒绝跨卡伪造的 amount 路由', () => {
        const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING] = 0;
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING] = 0;
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_DIVINE] = 0;

        let next = reduce(state.core, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '0',
                sourceAbilityId: 'treant-card-soulfire',
                customId: 'treant-card-cultivate-4-resolve',
                value: 12,
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 101,
        } as DiceThroneEvent);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING]).toBe(0);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING]).toBe(0);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_DIVINE]).toBe(0);

        next = reduce(state.core, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '0',
                sourceAbilityId: 'treant-card-mother-tree',
                customId: 'treant-card-cultivate-1-resolve',
                value: 1,
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 102,
        } as DiceThroneEvent);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING]).toBe(0);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING]).toBe(0);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_DIVINE]).toBe(0);

        next = reduce(state.core, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '0',
                sourceAbilityId: 'treant-card-planting',
                customId: 'treant-card-cultivate-4-resolve',
                value: 12,
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 103,
        } as DiceThroneEvent);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING]).toBe(0);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING]).toBe(0);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_DIVINE]).toBe(0);
    });

    it('Treant 选择处理器应拒绝合法值但错误来源的 CHOICE_RESOLVED', () => {
        const cases = [
            {
                customId: 'treant-quiet-cultivation-resolve',
                playerId: '0',
                sourceAbilityId: 'quiet-cultivation',
                value: 1,
                createState: () => createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1])).core,
            },
            {
                customId: 'treant-wild-growth-resolve',
                playerId: '0',
                sourceAbilityId: 'wild-growth',
                value: 1,
                createState: () => {
                    const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1])).core;
                    state.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING] = 1;
                    state.pendingAttack = {
                        attackerId: '0',
                        defenderId: '1',
                        sourceAbilityId: 'wild-growth',
                        isDefendable: true,
                        damage: 0,
                    };
                    return state;
                },
            },
            {
                customId: 'treant-shattering-fist-resolve',
                playerId: '0',
                sourceAbilityId: 'shattering-fist-3',
                value: 1,
                createState: () => {
                    const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1])).core;
                    state.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING] = 1;
                    return state;
                },
            },
            {
                customId: 'treant-nature-touch-cultivate-resolve',
                playerId: '0',
                sourceAbilityId: 'nature-touch',
                value: 2,
                createState: () => {
                    const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1])).core;
                    state.pendingAttack = {
                        attackerId: '0',
                        defenderId: '1',
                        sourceAbilityId: 'nature-touch',
                        isDefendable: false,
                        damage: 0,
                    };
                    return state;
                },
            },
            {
                customId: 'treant-shattering-fist-3-cultivate-resolve',
                playerId: '0',
                sourceAbilityId: 'shattering-fist-3-5',
                value: 1,
                createState: () => createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1])).core,
            },
            {
                customId: 'treant-tend-care-3-resolve',
                playerId: '0',
                sourceAbilityId: 'tend-care',
                value: 11003,
                createState: () => createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1])).core,
            },
            {
                customId: 'treant-forest-awakens-resolve',
                playerId: '0',
                sourceAbilityId: 'forest-awakens',
                value: 5,
                createState: () => createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1])).core,
            },
            {
                customId: 'treant-rooted-resolve',
                playerId: '1',
                sourceAbilityId: 'rooted',
                value: 10002,
                createState: () => {
                    const state = createHeroMatchup('ninja', 'treant')(['0', '1'], createQueuedRandom([1])).core;
                    state.players['1'].tokens[TOKEN_IDS.TREANT_SEEDLING] = 1;
                    state.pendingBonusDiceSettlement = {
                        sourceAbilityId: 'rooted',
                        dice: [
                            { face: TREANT_DICE_FACE_IDS.LEAF },
                            { face: TREANT_DICE_FACE_IDS.LEAF },
                            { face: TREANT_DICE_FACE_IDS.BRANCH },
                        ],
                    } as NonNullable<DiceThroneCore['pendingBonusDiceSettlement']>;
                    return state;
                },
            },
            {
                customId: 'treant-card-cultivate-3-resolve',
                playerId: '0',
                sourceAbilityId: 'treant-card-cultivate',
                value: 3,
                createState: () => createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1])).core,
            },
            {
                customId: 'treant-card-cultivate-3-resolve',
                playerId: '0',
                sourceAbilityId: 'treant-card-planting',
                value: 3,
                createState: () => createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1])).core,
            },
            {
                customId: 'treant-card-drink-deep-resolve',
                playerId: '0',
                sourceAbilityId: 'treant-card-drink-deep',
                value: 0,
                createState: () => createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1])).core,
            },
            {
                customId: 'treant-card-harvest-resolve',
                playerId: '0',
                sourceAbilityId: 'treant-card-harvest',
                value: 2,
                createState: () => {
                    const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1])).core;
                    state.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING] = 2;
                    return state;
                },
            },
            {
                customId: 'treant-card-downpour-resolve',
                playerId: '0',
                sourceAbilityId: 'treant-card-downpour',
                value: 10,
                createState: () => {
                    const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1])).core;
                    state.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING] = 1;
                    return state;
                },
            },
        ] as const;

        for (const testCase of cases) {
            const handler = getChoiceEffectHandler(testCase.customId);
            expect(handler).toBeDefined();

            const forgedState = testCase.createState();
            expect(handler?.({
                state: forgedState,
                playerId: testCase.playerId,
                customId: testCase.customId,
                sourceAbilityId: 'forged-source',
                value: testCase.value,
            })).toBeUndefined();
        }
    });

    it('Treant 非攻击链选择应拒绝 source 正确但没有当前 choice 锚点的 CHOICE_RESOLVED', () => {
        const cases = [
            {
                customId: 'treant-quiet-cultivation-resolve',
                playerId: '0',
                sourceAbilityId: 'quiet-cultivation',
                value: 1,
                createState: () => createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1])).core,
            },
            {
                customId: 'treant-tend-care-3-resolve',
                playerId: '0',
                sourceAbilityId: 'tend-care',
                value: 11003,
                createState: () => createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1])).core,
            },
            {
                customId: 'treant-card-cultivate-3-resolve',
                playerId: '0',
                sourceAbilityId: 'treant-card-cultivate',
                value: 3,
                createState: () => createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1])).core,
            },
            {
                customId: 'treant-card-drink-deep-resolve',
                playerId: '0',
                sourceAbilityId: 'treant-card-drink-deep',
                value: 0,
                createState: () => createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1])).core,
            },
            {
                customId: 'treant-card-harvest-resolve',
                playerId: '0',
                sourceAbilityId: 'treant-card-harvest',
                value: 2,
                createState: () => {
                    const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1])).core;
                    state.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING] = 2;
                    return state;
                },
            },
            {
                customId: 'treant-card-downpour-resolve',
                playerId: '0',
                sourceAbilityId: 'treant-card-downpour',
                value: 10,
                createState: () => {
                    const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1])).core;
                    state.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING] = 1;
                    return state;
                },
            },
            {
                customId: 'treant-rooted-resolve',
                playerId: '1',
                sourceAbilityId: 'rooted',
                value: 10002,
                createState: () => {
                    const state = createHeroMatchup('ninja', 'treant')(['0', '1'], createQueuedRandom([1])).core;
                    state.pendingAttack = {
                        attackerId: '0',
                        defenderId: '1',
                        sourceAbilityId: 'slash-3',
                        defenseAbilityId: 'rooted',
                        isDefendable: true,
                        damage: 0,
                    };
                    state.players['1'].tokens[TOKEN_IDS.TREANT_SEEDLING] = 1;
                    state.pendingBonusDiceSettlement = {
                        sourceAbilityId: 'rooted',
                        attackerId: '1',
                        targetId: '1',
                        dice: [
                            { face: TREANT_DICE_FACE_IDS.LEAF },
                            { face: TREANT_DICE_FACE_IDS.LEAF },
                            { face: TREANT_DICE_FACE_IDS.BRANCH },
                        ],
                    } as NonNullable<DiceThroneCore['pendingBonusDiceSettlement']>;
                    return state;
                },
            },
        ] as const;

        for (const testCase of cases) {
            const handler = getChoiceEffectHandler(testCase.customId);
            expect(handler).toBeDefined();

            const state = testCase.createState();
            expect(state.activatingAbilityId).toBeUndefined();
            expect(handler?.({
                state,
                playerId: testCase.playerId,
                customId: testCase.customId,
                sourceAbilityId: testCase.sourceAbilityId,
                value: testCase.value,
            })).toBeUndefined();
        }
    });

    it('Treant 攻击链选择应校验当前 pendingAttack 来源，拒绝错链路的 CHOICE_RESOLVED', () => {
        const cases = [
            {
                customId: 'treant-wild-growth-resolve',
                playerId: '0',
                sourceAbilityId: 'wild-growth',
                value: 1,
            },
            {
                customId: 'treant-shattering-fist-resolve',
                playerId: '0',
                sourceAbilityId: 'shattering-fist-3',
                value: 1,
            },
            {
                customId: 'treant-shattering-fist-3-cultivate-resolve',
                playerId: '0',
                sourceAbilityId: 'shattering-fist-3-5',
                value: 1,
            },
            {
                customId: 'treant-nature-touch-cultivate-resolve',
                playerId: '0',
                sourceAbilityId: 'nature-touch',
                value: 2,
            },
            {
                customId: 'treant-forest-awakens-resolve',
                playerId: '0',
                sourceAbilityId: 'forest-awakens',
                value: 5,
            },
        ] as const;

        for (const testCase of cases) {
            const handler = getChoiceEffectHandler(testCase.customId);
            expect(handler).toBeDefined();

            const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1])).core;
            state.pendingAttack = {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'slash-3',
                isDefendable: true,
                damage: 0,
            };
            expect(handler?.({
                state,
                playerId: testCase.playerId,
                customId: testCase.customId,
                sourceAbilityId: testCase.sourceAbilityId,
                value: testCase.value,
            })).toBeUndefined();
        }
    });

    it('Treant 选择处理器应拒绝合法值但错误玩家的 CHOICE_RESOLVED', () => {
        const cases = [
            {
                customId: 'treant-quiet-cultivation-resolve',
                playerId: '1',
                sourceAbilityId: 'quiet-cultivation',
                value: 1,
                createState: () => {
                    const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1])).core;
                    state.activePlayerId = '0';
                    state.players['1'].tokens[TOKEN_IDS.TREANT_SEEDLING] = 1;
                    return state;
                },
            },
            {
                customId: 'treant-card-drink-deep-resolve',
                playerId: '1',
                sourceAbilityId: 'treant-card-drink-deep',
                value: 0,
                createState: () => {
                    const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1])).core;
                    state.activePlayerId = '0';
                    return state;
                },
            },
            {
                customId: 'treant-shattering-fist-resolve',
                playerId: '1',
                sourceAbilityId: 'shattering-fist-3',
                value: 1,
                createState: () => {
                    const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1])).core;
                    state.pendingAttack = {
                        attackerId: '0',
                        defenderId: '1',
                        sourceAbilityId: 'shattering-fist-3',
                        isDefendable: true,
                        damage: 0,
                    };
                    state.players['1'].tokens[TOKEN_IDS.TREANT_SEEDLING] = 1;
                    return state;
                },
            },
            {
                customId: 'treant-forest-awakens-resolve',
                playerId: '1',
                sourceAbilityId: 'forest-awakens',
                value: 0,
                createState: () => {
                    const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1])).core;
                    state.pendingAttack = {
                        attackerId: '0',
                        defenderId: '1',
                        sourceAbilityId: 'forest-awakens',
                        isDefendable: false,
                        damage: 0,
                    };
                    return state;
                },
            },
            {
                customId: 'treant-rooted-resolve',
                playerId: '1',
                sourceAbilityId: 'rooted',
                value: 10001,
                createState: () => {
                    const state = createHeroMatchup('ninja', 'treant')(['0', '1'], createQueuedRandom([1])).core;
                    state.pendingAttack = {
                        attackerId: '0',
                        defenderId: '1',
                        sourceAbilityId: 'slash-3',
                        defenseAbilityId: 'rooted',
                        isDefendable: true,
                        damage: 0,
                    };
                    state.pendingBonusDiceSettlement = {
                        sourceAbilityId: 'rooted',
                        attackerId: '0',
                        targetId: '0',
                        dice: [
                            { face: TREANT_DICE_FACE_IDS.LEAF },
                            { face: TREANT_DICE_FACE_IDS.LEAF },
                            { face: TREANT_DICE_FACE_IDS.BRANCH },
                        ],
                    } as NonNullable<DiceThroneCore['pendingBonusDiceSettlement']>;
                    return state;
                },
            },
        ] as const;

        for (const testCase of cases) {
            const handler = getChoiceEffectHandler(testCase.customId);
            expect(handler).toBeDefined();

            const forgedState = testCase.createState();
            expect(handler?.({
                state: forgedState,
                playerId: testCase.playerId,
                customId: testCase.customId,
                sourceAbilityId: testCase.sourceAbilityId,
                value: testCase.value,
            })).toBeUndefined();
        }
    });

    it('rooted 在旧 pendingBonusDiceSettlement 脏 dice shape 下不应因 reduce/map 崩溃，而应拒绝非法结算', () => {
        const handler = getChoiceEffectHandler('treant-rooted-resolve');
        expect(handler).toBeDefined();

        const state = createHeroMatchup('ninja', 'treant')(['0', '1'], createQueuedRandom([1])).core;
        state.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'slash-3',
            defenseAbilityId: 'rooted',
            isDefendable: true,
            damage: 0,
        };
        state.pendingBonusDiceSettlement = {
            sourceAbilityId: 'rooted',
            attackerId: '1',
            targetId: '1',
            dice: { legacy: true } as any,
        } as NonNullable<DiceThroneCore['pendingBonusDiceSettlement']>;

        expect(() => handler?.({
            state,
            playerId: '1',
            customId: 'treant-rooted-resolve',
            sourceAbilityId: 'rooted',
            value: 10002,
        })).not.toThrow();

        expect(handler?.({
            state,
            playerId: '1',
            customId: 'treant-rooted-resolve',
            sourceAbilityId: 'rooted',
            value: 10002,
        })).toBeUndefined();
    });

    it('Drink Deep 对已满生命源泉目标不应越过 token 上限', () => {
        const state = createTreantTeamMatchup();
        for (const playerId of state.core.seatingOrder) {
            state.core.players[playerId].tokens[TOKEN_IDS.LIFE_SAP] = 0;
        }
        state.core.players['2'].tokens[TOKEN_IDS.LIFE_SAP] = 1;

        const drinkDeep = TREANT_CARDS.find(card => card.id === 'treant-card-drink-deep');
        expect(drinkDeep).toBeDefined();
        const events = resolveEffectsToEvents(
            drinkDeep?.effects ?? [],
            'immediate',
            { attackerId: '0', defenderId: '1', sourceAbilityId: 'treant-card-drink-deep', state: state.core, damageDealt: 0, timestamp: 100 },
            { random: createQueuedRandom([1]) },
        );
        const choiceEvent = events.find(event => event.type === 'CHOICE_REQUESTED');
        expect(choiceEvent).toBeDefined();
        const selectedOption = (choiceEvent as any).payload.options.find((option: { labelParams?: Record<string, unknown> }) =>
            option.labelParams?.player === 'P3'
        );
        expect(selectedOption).toBeDefined();

        let next = applyEvents(state.core, events);
        next = reduce(next, {
            type: 'CHOICE_RESOLVED',
            payload: { playerId: '0', sourceAbilityId: 'treant-card-drink-deep', customId: selectedOption.customId, value: selectedOption.value },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 101,
        } as DiceThroneEvent);

        expect(next.players['2'].tokens[TOKEN_IDS.LIFE_SAP]).toBe(1);
    });

    it('Harvest 在 4 人模式下应支持至多 2 名生命源泉目标，且移除 1 树灵不应发生命源泉', () => {
        const state = createTreantTeamMatchup();
        const treant = state.core.players['0'];
        treant.tokens[TOKEN_IDS.TREANT_SEEDLING] = 2;
        treant.tokens[TOKEN_IDS.TREANT_SAPLING] = 1;
        treant.tokens[TOKEN_IDS.TREANT_DIVINE] = 0;
        treant.resources[RESOURCE_IDS.CP] = 0;
        for (const playerId of state.core.seatingOrder) {
            state.core.players[playerId].tokens[TOKEN_IDS.LIFE_SAP] = 0;
        }

        const harvest = TREANT_CARDS.find(card => card.id === 'treant-card-harvest');
        expect(harvest).toBeDefined();
        const events = resolveEffectsToEvents(
            harvest?.effects ?? [],
            'immediate',
            { attackerId: '0', defenderId: '1', sourceAbilityId: 'treant-card-harvest', state: state.core, damageDealt: 0, timestamp: 100 },
            { random: createQueuedRandom([1]) },
        );
        const choiceEvent = events.find(event => event.type === 'CHOICE_REQUESTED');
        expect(choiceEvent).toBeDefined();
        const options = (choiceEvent as any).payload.options as Array<{ labelParams?: Record<string, unknown>; customId: string; value: number }>;
        expect(options.some(option =>
            option.labelParams?.cp === 1
            && option.labelParams?.targets !== 'none'
        )).toBe(false);

        let selectedOption = options.find(option =>
            option.labelParams?.seedling === 1
            && option.labelParams?.sapling === 0
            && option.labelParams?.divine === 0
            && option.labelParams?.cp === 1
            && option.labelParams?.targets === 'none'
        );
        expect(selectedOption).toBeDefined();

        let next = applyEvents(state.core, events);
        next = reduce(next, {
            type: 'CHOICE_RESOLVED',
            payload: { playerId: '0', sourceAbilityId: 'treant-card-harvest', customId: selectedOption?.customId, value: selectedOption?.value },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 101,
        } as DiceThroneEvent);
        expect(next.players['0'].resources[RESOURCE_IDS.CP]).toBe(1);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING]).toBe(1);
        expect(Object.values(next.players).every(player => (player.tokens[TOKEN_IDS.LIFE_SAP] ?? 0) === 0)).toBe(true);

        selectedOption = options.find(option =>
            option.labelParams?.seedling === 2
            && option.labelParams?.sapling === 0
            && option.labelParams?.divine === 0
            && option.labelParams?.cp === 2
            && option.labelParams?.targets === 'P3, P4'
        );
        expect(selectedOption).toBeDefined();
        next = applyEvents(state.core, events);
        next = reduce(next, {
            type: 'CHOICE_RESOLVED',
            payload: { playerId: '0', sourceAbilityId: 'treant-card-harvest', customId: selectedOption?.customId, value: selectedOption?.value },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 102,
        } as DiceThroneEvent);
        expect(next.players['0'].resources[RESOURCE_IDS.CP]).toBe(2);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING]).toBe(0);
        expect(next.players['2'].tokens[TOKEN_IDS.LIFE_SAP]).toBe(1);
        expect(next.players['3'].tokens[TOKEN_IDS.LIFE_SAP]).toBe(1);
        expect(next.players['1'].tokens[TOKEN_IDS.LIFE_SAP]).toBe(0);
    });

    it('Drink Deep 与 Harvest 在 4 人模式下应按座位目标全集和最多 2 名目标结算', () => {
        const state = createTreantTeamMatchup();
        const treant = state.core.players['0'];
        treant.tokens[TOKEN_IDS.TREANT_SEEDLING] = 1;
        treant.tokens[TOKEN_IDS.TREANT_SAPLING] = 1;
        treant.tokens[TOKEN_IDS.TREANT_DIVINE] = 1;
        treant.resources[RESOURCE_IDS.CP] = 0;
        for (const playerId of state.core.seatingOrder) {
            state.core.players[playerId].tokens[TOKEN_IDS.LIFE_SAP] = 0;
        }

        const drinkDeep = TREANT_CARDS.find(card => card.id === 'treant-card-drink-deep');
        expect(drinkDeep).toBeDefined();
        let events = resolveEffectsToEvents(
            drinkDeep?.effects ?? [],
            'immediate',
            { attackerId: '0', defenderId: '1', sourceAbilityId: 'treant-card-drink-deep', state: state.core, damageDealt: 0, timestamp: 100 },
            { random: createQueuedRandom([1]) },
        );
        let choiceEvent = events.find(event => event.type === 'CHOICE_REQUESTED');
        expect(choiceEvent).toBeDefined();
        let options = (choiceEvent as any).payload.options as Array<{ labelParams?: Record<string, unknown>; customId: string; value: number }>;
        expect(options.map(option => option.labelParams?.player)).toEqual(['P1', 'P2', 'P3', 'P4']);

        let selectedOption = options.find(option => option.labelParams?.player === 'P3');
        expect(selectedOption).toBeDefined();
        let next = applyEvents(state.core, events);
        next = reduce(next, {
            type: 'CHOICE_RESOLVED',
            payload: { playerId: '0', sourceAbilityId: 'treant-card-drink-deep', customId: selectedOption?.customId, value: selectedOption?.value },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 101,
        } as DiceThroneEvent);
        expect(next.players['2'].tokens[TOKEN_IDS.LIFE_SAP]).toBe(1);
        expect(next.players['0'].tokens[TOKEN_IDS.LIFE_SAP]).toBe(0);
        expect(next.players['1'].tokens[TOKEN_IDS.LIFE_SAP]).toBe(0);
        expect(next.players['3'].tokens[TOKEN_IDS.LIFE_SAP]).toBe(0);

        const harvest = TREANT_CARDS.find(card => card.id === 'treant-card-harvest');
        expect(harvest).toBeDefined();
        events = resolveEffectsToEvents(
            harvest?.effects ?? [],
            'immediate',
            { attackerId: '0', defenderId: '1', sourceAbilityId: 'treant-card-harvest', state: next, damageDealt: 0, timestamp: 200 },
            { random: createQueuedRandom([1]) },
        );
        choiceEvent = events.find(event => event.type === 'CHOICE_REQUESTED');
        expect(choiceEvent).toBeDefined();
        options = (choiceEvent as any).payload.options as Array<{ labelParams?: Record<string, unknown>; customId: string; value: number }>;
        expect(options.some(option => String(option.labelParams?.targets ?? '').split(', ').filter(Boolean).length > 2)).toBe(false);

        selectedOption = options.find(option =>
            option.labelParams?.seedling === 1
            && option.labelParams?.sapling === 1
            && option.labelParams?.divine === 1
            && option.labelParams?.cp === 3
            && option.labelParams?.targets === 'P1, P4'
        );
        expect(selectedOption).toBeDefined();
        next = applyEvents(next, events);
        next = reduce(next, {
            type: 'CHOICE_RESOLVED',
            payload: { playerId: '0', sourceAbilityId: 'treant-card-harvest', customId: selectedOption?.customId, value: selectedOption?.value },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 201,
        } as DiceThroneEvent);
        expect(next.players['0'].resources[RESOURCE_IDS.CP]).toBe(3);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING]).toBe(0);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING]).toBe(0);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_DIVINE]).toBe(0);
        expect(next.players['0'].tokens[TOKEN_IDS.LIFE_SAP]).toBe(1);
        expect(next.players['3'].tokens[TOKEN_IDS.LIFE_SAP]).toBe(1);
        expect(next.players['1'].tokens[TOKEN_IDS.LIFE_SAP]).toBe(0);
        expect(next.players['2'].tokens[TOKEN_IDS.LIFE_SAP]).toBe(1);
    });

    it('Drink Deep 应拒绝负数、字符串和座位表外目标索引', () => {
        const state = createTreantTeamMatchup();
        for (const playerId of state.core.seatingOrder) {
            state.core.players[playerId].tokens[TOKEN_IDS.LIFE_SAP] = 0;
        }

        for (const value of [-1, '0' as unknown as number, Number.NaN, 4]) {
            const next = reduce(state.core, {
                type: 'CHOICE_RESOLVED',
                payload: {
                    playerId: '0',
                    sourceAbilityId: 'treant-card-drink-deep',
                    customId: 'treant-card-drink-deep-resolve',
                    value,
                },
                sourceCommandType: 'RESOLVE_CHOICE',
                timestamp: 101,
            } as DiceThroneEvent);

            for (const playerId of state.core.seatingOrder) {
                expect(next.players[playerId].tokens[TOKEN_IDS.LIFE_SAP]).toBe(0);
            }
        }
    });

    it('Harvest 应拒绝字符串或 NaN choice value，不能写出 NaN 资源', () => {
        const state = createTreantTeamMatchup();
        const treant = state.core.players['0'];
        treant.tokens[TOKEN_IDS.TREANT_SEEDLING] = 2;
        treant.tokens[TOKEN_IDS.TREANT_SAPLING] = 0;
        treant.tokens[TOKEN_IDS.TREANT_DIVINE] = 0;
        treant.resources[RESOURCE_IDS.CP] = 0;
        for (const playerId of state.core.seatingOrder) {
            state.core.players[playerId].tokens[TOKEN_IDS.LIFE_SAP] = 0;
        }

        for (const value of ['2002' as unknown as number, Number.NaN]) {
            const next = reduce(state.core, {
                type: 'CHOICE_RESOLVED',
                payload: {
                    playerId: '0',
                    sourceAbilityId: 'treant-card-harvest',
                    customId: 'treant-card-harvest-resolve',
                    value,
                },
                sourceCommandType: 'RESOLVE_CHOICE',
                timestamp: 101,
            } as DiceThroneEvent);

            expect(next.players['0'].resources[RESOURCE_IDS.CP]).toBe(0);
            expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING]).toBe(2);
            expect(Number.isNaN(next.players['0'].resources[RESOURCE_IDS.CP])).toBe(false);
            expect(Number.isNaN(next.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING])).toBe(false);
            for (const playerId of state.core.seatingOrder) {
                expect(next.players[playerId].tokens[TOKEN_IDS.LIFE_SAP]).toBe(0);
            }
        }
    });

    it('Drink Deep 应拒绝座位表外目标索引', () => {
        const state = createTreantTeamMatchup();
        for (const playerId of state.core.seatingOrder) {
            state.core.players[playerId].tokens[TOKEN_IDS.LIFE_SAP] = 0;
        }

        const next = reduce(state.core, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '0',
                sourceAbilityId: 'treant-card-drink-deep',
                customId: 'treant-card-drink-deep-resolve',
                value: 4,
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 101,
        } as DiceThroneEvent);

        for (const playerId of state.core.seatingOrder) {
            expect(next.players[playerId].tokens[TOKEN_IDS.LIFE_SAP]).toBe(0);
        }
    });

    it('Harvest 无树灵时只能选择移除 0 且不改写 CP 或生命源泉', () => {
        const state = createTreantTeamMatchup();
        const treant = state.core.players['0'];
        treant.tokens[TOKEN_IDS.TREANT_SEEDLING] = 0;
        treant.tokens[TOKEN_IDS.TREANT_SAPLING] = 0;
        treant.tokens[TOKEN_IDS.TREANT_DIVINE] = 0;
        treant.resources[RESOURCE_IDS.CP] = 2;
        for (const playerId of state.core.seatingOrder) {
            state.core.players[playerId].tokens[TOKEN_IDS.LIFE_SAP] = 0;
        }

        const harvest = TREANT_CARDS.find(card => card.id === 'treant-card-harvest');
        expect(harvest).toBeDefined();
        const events = resolveEffectsToEvents(
            harvest?.effects ?? [],
            'immediate',
            { attackerId: '0', defenderId: '1', sourceAbilityId: 'treant-card-harvest', state: state.core, damageDealt: 0, timestamp: 100 },
            { random: createQueuedRandom([1]) },
        );
        const choiceEvent = events.find(event => event.type === 'CHOICE_REQUESTED');
        expect(choiceEvent).toBeDefined();
        const options = (choiceEvent as any).payload.options as Array<{ labelParams?: Record<string, unknown>; customId: string; value: number }>;
        expect(options).toHaveLength(1);
        expect(options[0].labelParams).toMatchObject({
            seedling: 0,
            sapling: 0,
            divine: 0,
            cp: 0,
            targets: 'none',
        });

        let next = applyEvents(state.core, events);
        next = reduce(next, {
            type: 'CHOICE_RESOLVED',
            payload: { playerId: '0', sourceAbilityId: 'treant-card-harvest', customId: options[0].customId, value: options[0].value },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 101,
        } as DiceThroneEvent);

        expect(next.players['0'].resources[RESOURCE_IDS.CP]).toBe(2);
        for (const playerId of state.core.seatingOrder) {
            expect(next.players[playerId].tokens[TOKEN_IDS.LIFE_SAP]).toBe(0);
        }
    });

    it('Harvest 在 CP 与生命源泉目标接近上限时应钳制资源与 token', () => {
        const state = createTreantTeamMatchup();
        const treant = state.core.players['0'];
        treant.tokens[TOKEN_IDS.TREANT_SEEDLING] = 3;
        treant.tokens[TOKEN_IDS.TREANT_SAPLING] = 0;
        treant.tokens[TOKEN_IDS.TREANT_DIVINE] = 0;
        treant.resources[RESOURCE_IDS.CP] = 14;
        state.core.players['0'].tokens[TOKEN_IDS.LIFE_SAP] = 1;
        state.core.players['1'].tokens[TOKEN_IDS.LIFE_SAP] = 1;

        const harvest = TREANT_CARDS.find(card => card.id === 'treant-card-harvest');
        expect(harvest).toBeDefined();
        const events = resolveEffectsToEvents(
            harvest?.effects ?? [],
            'immediate',
            { attackerId: '0', defenderId: '1', sourceAbilityId: 'treant-card-harvest', state: state.core, damageDealt: 0, timestamp: 100 },
            { random: createQueuedRandom([1]) },
        );
        const choiceEvent = events.find(event => event.type === 'CHOICE_REQUESTED');
        expect(choiceEvent).toBeDefined();
        const selectedOption = (choiceEvent as any).payload.options.find((option: { labelParams?: Record<string, unknown> }) =>
            option.labelParams?.seedling === 3
            && option.labelParams?.sapling === 0
            && option.labelParams?.divine === 0
            && option.labelParams?.cp === 3
            && option.labelParams?.targets === 'P1, P2'
        );
        expect(selectedOption).toBeDefined();

        let next = applyEvents(state.core, events);
        next = reduce(next, {
            type: 'CHOICE_RESOLVED',
            payload: { playerId: '0', sourceAbilityId: 'treant-card-harvest', customId: selectedOption.customId, value: selectedOption.value },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 101,
        } as DiceThroneEvent);

        expect(next.players['0'].resources[RESOURCE_IDS.CP]).toBe(15);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING]).toBe(0);
        expect(next.players['0'].tokens[TOKEN_IDS.LIFE_SAP]).toBe(1);
        expect(next.players['1'].tokens[TOKEN_IDS.LIFE_SAP]).toBe(1);
    });

    it('Harvest 应拒绝座位表外的生命源泉目标 mask', () => {
        const state = createTreantTeamMatchup();
        const treant = state.core.players['0'];
        treant.tokens[TOKEN_IDS.TREANT_SEEDLING] = 2;
        treant.tokens[TOKEN_IDS.TREANT_SAPLING] = 0;
        treant.tokens[TOKEN_IDS.TREANT_DIVINE] = 0;
        treant.resources[RESOURCE_IDS.CP] = 0;
        for (const playerId of state.core.seatingOrder) {
            state.core.players[playerId].tokens[TOKEN_IDS.LIFE_SAP] = 0;
        }

        const next = reduce(state.core, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '0',
                sourceAbilityId: 'treant-card-harvest',
                customId: 'treant-card-harvest-resolve',
                value: 16002,
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 101,
        } as DiceThroneEvent);

        expect(next.players['0'].resources[RESOURCE_IDS.CP]).toBe(0);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING]).toBe(2);
        for (const playerId of state.core.seatingOrder) {
            expect(next.players[playerId].tokens[TOKEN_IDS.LIFE_SAP]).toBe(0);
        }
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
        next = applyEvents(next, events);
        const motherTreeSettlementEvents = settleBonusDice(next, 300);
        choiceEvent = motherTreeSettlementEvents.find(event => event.type === 'CHOICE_REQUESTED');
        selectedOption = (choiceEvent as any).payload.options.find((option: { labelKey?: string }) =>
            option.labelKey === 'choices.treantCultivate.s2_a1_d0'
        );
        expect(selectedOption).toBeDefined();
        next = applyEvents(next, motherTreeSettlementEvents);
        next = reduce(next, {
            type: 'CHOICE_RESOLVED',
            payload: { playerId: '0', sourceAbilityId: 'treant-card-mother-tree', customId: selectedOption.customId, value: selectedOption.value },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 201,
        } as DiceThroneEvent);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING]).toBe(2);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING]).toBe(1);
    });

    it('Downpour 应只允许跳过或把所有现有树灵各升级一次，不应允许部分升级', () => {
        const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING] = 1;
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING] = 1;
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_DIVINE] = 1;

        const downpour = TREANT_CARDS.find(card => card.id === 'treant-card-downpour');
        expect(downpour).toBeDefined();
        const events = resolveEffectsToEvents(
            downpour?.effects ?? [],
            'immediate',
            { attackerId: '0', defenderId: '1', sourceAbilityId: 'treant-card-downpour', state: state.core, damageDealt: 0, timestamp: 100 },
            { random: createQueuedRandom([1]) },
        );
        const choiceEvent = events.find(event => event.type === 'CHOICE_REQUESTED');
        expect(choiceEvent).toBeDefined();
        const options = (choiceEvent as any).payload.options as Array<{ labelKey?: string; customId: string; value: number }>;
        expect(options.map(option => option.labelKey).sort()).toEqual([
            'choices.treantCultivate.s0_a2_d1',
            'choices.treantCultivate.s1_a1_d1',
        ]);

        const selectedOption = options.find(option => option.labelKey === 'choices.treantCultivate.s0_a2_d1');
        expect(selectedOption).toBeDefined();
        let next = applyEvents(state.core, events);
        next = reduce(next, {
            type: 'CHOICE_RESOLVED',
            payload: { playerId: '0', sourceAbilityId: 'treant-card-downpour', customId: selectedOption?.customId, value: selectedOption?.value },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 101,
        } as DiceThroneEvent);

        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING]).toBe(0);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING]).toBe(2);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_DIVINE]).toBe(1);

        const skipOption = options.find(option => option.labelKey === 'choices.treantCultivate.s1_a1_d1');
        expect(skipOption).toBeDefined();
        next = applyEvents(state.core, events);
        next = reduce(next, {
            type: 'CHOICE_RESOLVED',
            payload: { playerId: '0', sourceAbilityId: 'treant-card-downpour', customId: skipOption?.customId, value: skipOption?.value },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 102,
        } as DiceThroneEvent);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING]).toBe(1);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING]).toBe(1);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_DIVINE]).toBe(1);
    });

    it('Downpour 在没有可升级树灵时不应弹选择或改写 token', () => {
        const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING] = 0;
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING] = 0;
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_DIVINE] = 1;

        const downpour = TREANT_CARDS.find(card => card.id === 'treant-card-downpour');
        expect(downpour).toBeDefined();
        const events = resolveEffectsToEvents(
            downpour?.effects ?? [],
            'immediate',
            { attackerId: '0', defenderId: '1', sourceAbilityId: 'treant-card-downpour', state: state.core, damageDealt: 0, timestamp: 100 },
            { random: createQueuedRandom([1]) },
        );
        const next = applyEvents(state.core, events);

        expect(events).toHaveLength(0);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING]).toBe(0);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING]).toBe(0);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_DIVINE]).toBe(1);
    });

    it('Mother Tree 非树灵分支应抽 1 且不弹养成选择', () => {
        const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        state.core.players['0'].hand = [];
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING] = 0;
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING] = 0;
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_DIVINE] = 0;
        const deckBefore = state.core.players['0'].deck.length;

        const motherTree = TREANT_CARDS.find(card => card.id === 'treant-card-mother-tree');
        expect(motherTree).toBeDefined();
        const events = resolveEffectsToEvents(
            motherTree?.effects ?? [],
            'immediate',
            { attackerId: '0', defenderId: '1', sourceAbilityId: 'treant-card-mother-tree', state: state.core, damageDealt: 0, timestamp: 100 },
            { random: createQueuedRandom([1, 1]) },
        );
        let next = applyEvents(state.core, events);
        const settlementEvents = settleBonusDice(next);
        next = applyEvents(next, settlementEvents);

        expect(events.filter(event => event.type === 'BONUS_DIE_ROLLED')).toHaveLength(1);
        expect(settlementEvents.some(event => event.type === 'CHOICE_REQUESTED')).toBe(false);
        expect(next.players['0'].hand).toHaveLength(1);
        expect(next.players['0'].deck).toHaveLength(deckBefore - 1);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING]).toBe(0);
    });

    it('Mother Tree 非树灵分支应拒绝伪造的 4 树灵养成路由', () => {
        const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING] = 0;
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING] = 0;
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_DIVINE] = 0;
        state.core.players['1'].resources[RESOURCE_IDS.HP] = 50;

        const motherTree = TREANT_CARDS.find(card => card.id === 'treant-card-mother-tree');
        expect(motherTree).toBeDefined();
        const events = resolveEffectsToEvents(
            motherTree?.effects ?? [],
            'immediate',
            { attackerId: '0', defenderId: '1', sourceAbilityId: 'treant-card-mother-tree', state: state.core, damageDealt: 0, timestamp: 100 },
            { random: createQueuedRandom([1]) },
        );
        const next = applyEvents(state.core, events);
        const forged = reduce(next, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '0',
                sourceAbilityId: 'treant-card-mother-tree',
                customId: 'treant-card-cultivate-4-resolve',
                value: 4,
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 101,
        } as DiceThroneEvent);

        expect(forged.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING]).toBe(0);
        expect(forged.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING]).toBe(0);
        expect(forged.players['0'].tokens[TOKEN_IDS.TREANT_DIVINE]).toBe(0);
    });

    it('Mother Tree 树灵分支在树灵全满时不应弹空选择或越过上限', () => {
        const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING] = 3;
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING] = 2;
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_DIVINE] = 1;

        const motherTree = TREANT_CARDS.find(card => card.id === 'treant-card-mother-tree');
        expect(motherTree).toBeDefined();
        const events = resolveEffectsToEvents(
            motherTree?.effects ?? [],
            'immediate',
            { attackerId: '0', defenderId: '1', sourceAbilityId: 'treant-card-mother-tree', state: state.core, damageDealt: 0, timestamp: 100 },
            { random: createQueuedRandom([6]) },
        );
        let next = applyEvents(state.core, events);
        const settlementEvents = settleBonusDice(next);
        next = applyEvents(next, settlementEvents);

        expect(events.filter(event => event.type === 'BONUS_DIE_ROLLED')).toHaveLength(1);
        expect(settlementEvents.some(event => event.type === 'CHOICE_REQUESTED')).toBe(false);
        expect(settlementEvents.some(event => event.type === 'TOKEN_GRANTED' || event.type === 'TOKEN_CONSUMED')).toBe(false);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING]).toBe(3);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING]).toBe(2);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_DIVINE]).toBe(1);
    });

    it('Soulfire 纯树灵骰面应进入正式养成选择并按选择落地', () => {
        const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING] = 1;
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING] = 0;
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_DIVINE] = 0;
        state.core.players['1'].resources[RESOURCE_IDS.HP] = 50;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'shattering-fist',
            isDefendable: true,
            damage: 0,
        };

        const soulfire = TREANT_CARDS.find(card => card.id === 'treant-card-soulfire');
        expect(soulfire).toBeDefined();
        const events = resolveEffectsToEvents(
            soulfire?.effects ?? [],
            'immediate',
            { attackerId: '0', defenderId: '1', sourceAbilityId: 'treant-card-soulfire', state: state.core, damageDealt: 0, timestamp: 100 },
            { random: createQueuedRandom([6, 6, 6]) },
        );
        let next = applyEvents(state.core, events);
        const settlementEvents = settleBonusDice(next);
        const choiceEvent = settlementEvents.find(event => event.type === 'CHOICE_REQUESTED');
        expect(choiceEvent).toBeDefined();
        const selectedOption = (choiceEvent as any).payload.options.find((option: { labelKey?: string }) =>
            option.labelKey === 'choices.treantCultivate.s1_a0_d1'
        );
        expect(selectedOption).toBeDefined();

        next = applyEvents(next, settlementEvents);
        next = reduce(next, {
            type: 'CHOICE_RESOLVED',
            payload: { playerId: '0', sourceAbilityId: 'treant-card-soulfire', customId: selectedOption.customId, value: selectedOption.value },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 101,
        } as DiceThroneEvent);

        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING]).toBe(1);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING]).toBe(0);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_DIVINE]).toBe(1);
        expect(next.players['1'].resources[RESOURCE_IDS.HP]).toBe(50);
    });

    it('Soulfire 纯树灵骰面应拒绝伪造的 3 树灵养成路由', () => {
        const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING] = 0;
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING] = 0;
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_DIVINE] = 0;
        state.core.players['1'].resources[RESOURCE_IDS.HP] = 50;

        const soulfire = TREANT_CARDS.find(card => card.id === 'treant-card-soulfire');
        expect(soulfire).toBeDefined();
        const events = resolveEffectsToEvents(
            soulfire?.effects ?? [],
            'immediate',
            { attackerId: '0', defenderId: '1', sourceAbilityId: 'treant-card-soulfire', state: state.core, damageDealt: 0, timestamp: 100 },
            { random: createQueuedRandom([6, 6, 1]) },
        );
        let next = applyEvents(state.core, events);
        const settlementEvents = settleBonusDice(next);
        const choiceEvent = settlementEvents.find(event => event.type === 'CHOICE_REQUESTED');
        expect(choiceEvent).toBeDefined();
        next = applyEvents(next, settlementEvents);
        const forged = reduce(next, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '0',
                sourceAbilityId: 'treant-card-soulfire',
                customId: 'treant-card-cultivate-3-resolve',
                value: 3,
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 101,
        } as DiceThroneEvent);

        expect(forged.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING]).toBe(0);
        expect(forged.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING]).toBe(0);
        expect(forged.players['0'].tokens[TOKEN_IDS.TREANT_DIVINE]).toBe(0);
    });

    it('Soulfire 在生命源泉和树灵都满栈时不应越过上限或弹空养成选择', () => {
        const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        state.core.players['0'].tokens[TOKEN_IDS.LIFE_SAP] = 1;
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING] = 3;
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING] = 2;
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_DIVINE] = 1;
        state.core.players['1'].resources[RESOURCE_IDS.HP] = 50;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'shattering-fist',
            isDefendable: true,
            damage: 0,
        };

        const soulfire = TREANT_CARDS.find(card => card.id === 'treant-card-soulfire');
        expect(soulfire).toBeDefined();
        const events = resolveEffectsToEvents(
            soulfire?.effects ?? [],
            'immediate',
            { attackerId: '0', defenderId: '1', sourceAbilityId: 'treant-card-soulfire', state: state.core, damageDealt: 0, timestamp: 100 },
            { random: createQueuedRandom([4, 5, 6]) },
        );
        let next = applyEvents(state.core, events);
        const settlementEvents = settleBonusDice(next);
        next = applyEvents(next, settlementEvents);

        expect(settlementEvents.some(event => event.type === 'CHOICE_REQUESTED')).toBe(false);
        expect(settlementEvents.find(event => event.type === 'TOKEN_GRANTED' && event.payload.tokenId === TOKEN_IDS.LIFE_SAP)?.payload).toMatchObject({
            amount: 0,
            newTotal: 1,
        });
        expect(next.players['0'].tokens[TOKEN_IDS.LIFE_SAP]).toBe(1);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING]).toBe(3);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING]).toBe(2);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_DIVINE]).toBe(1);
        expect(next.players['1'].resources[RESOURCE_IDS.HP]).toBe(50);
    });

    it('Soulfire 三树枝在 4 人队伍模式下应只伤害所有对手且按树枝数结算', () => {
        const state = createTreantTeamMatchup();
        state.core.players['1'].resources[RESOURCE_IDS.HP] = 50;
        state.core.players['2'].resources[RESOURCE_IDS.HP] = 50;
        state.core.players['3'].resources[RESOURCE_IDS.HP] = 50;
        state.core.teamHealth = { A: 50, B: 50 };
        state.core.players['0'].tokens[TOKEN_IDS.LIFE_SAP] = 0;
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING] = 0;

        const soulfire = TREANT_CARDS.find(card => card.id === 'treant-card-soulfire');
        expect(soulfire).toBeDefined();
        const events = resolveEffectsToEvents(
            soulfire?.effects ?? [],
            'immediate',
            { attackerId: '0', defenderId: '1', sourceAbilityId: 'treant-card-soulfire', state: state.core, damageDealt: 0, timestamp: 100 },
            { random: createQueuedRandom([1, 2, 3]) },
        );
        let next = applyEvents(state.core, events);
        const settlementEvents = settleBonusDice(next);
        const damageEvents = settlementEvents.filter(event => event.type === 'DAMAGE_DEALT');
        expect(damageEvents).toHaveLength(2);
        expect(damageEvents.every(event => event.payload.amount === 3)).toBe(true);
        next = applyEvents(next, settlementEvents);

        expect(next.players['1'].resources[RESOURCE_IDS.HP]).toBe(44);
        expect(next.players['3'].resources[RESOURCE_IDS.HP]).toBe(44);
        expect(next.players['2'].resources[RESOURCE_IDS.HP]).toBe(50);
        expect(next.players['0'].resources[RESOURCE_IDS.HP]).toBe(50);
        expect(next.players['0'].tokens[TOKEN_IDS.LIFE_SAP] ?? 0).toBe(0);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING] ?? 0).toBe(0);
    });

    it('Soulfire 三树叶只获得生命源泉且不得超过 token 上限', () => {
        const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        state.core.players['0'].tokens[TOKEN_IDS.LIFE_SAP] = 0;
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING] = 0;
        state.core.players['1'].resources[RESOURCE_IDS.HP] = 50;

        const soulfire = TREANT_CARDS.find(card => card.id === 'treant-card-soulfire');
        expect(soulfire).toBeDefined();
        const events = resolveEffectsToEvents(
            soulfire?.effects ?? [],
            'immediate',
            { attackerId: '0', defenderId: '1', sourceAbilityId: 'treant-card-soulfire', state: state.core, damageDealt: 0, timestamp: 100 },
            { random: createQueuedRandom([4, 5, 4]) },
        );
        let next = applyEvents(state.core, events);
        const settlementEvents = settleBonusDice(next);
        next = applyEvents(next, settlementEvents);

        expect(settlementEvents.some(event => event.type === 'DAMAGE_DEALT')).toBe(false);
        expect(settlementEvents.some(event => event.type === 'CHOICE_REQUESTED')).toBe(false);
        expect(settlementEvents.find(event => event.type === 'TOKEN_GRANTED' && event.payload.tokenId === TOKEN_IDS.LIFE_SAP)?.payload).toMatchObject({
            amount: 1,
            newTotal: 1,
        });
        expect(next.players['0'].tokens[TOKEN_IDS.LIFE_SAP]).toBe(1);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING] ?? 0).toBe(0);
        expect(next.players['1'].resources[RESOURCE_IDS.HP]).toBe(50);
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
        const trampleSettlementEvents = settleBonusDice(next);
        next = applyEvents(next, trampleSettlementEvents);
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
        next = applyEvents(next, settleBonusDice(next, 300));
        expect(next.players['1'].resources[RESOURCE_IDS.HP]).toBe(49);
        expect(next.players['0'].tokens[TOKEN_IDS.LIFE_SAP]).toBe(1);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING]).toBe(1);
        expect(next.pendingAttack?.attackModifierBonusDamage).toBe(3);
    });

    it('Trample 少于 3 个树枝时只加对应伤害，不应施加刺藤', () => {
        const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        state.core.players['1'].tokens[TOKEN_IDS.THORN] = 0;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'shattering-fist',
            isDefendable: true,
            damage: 0,
        };

        const trample = TREANT_CARDS.find(card => card.id === 'treant-card-trample');
        expect(trample).toBeDefined();
        const events = resolveEffectsToEvents(
            trample?.effects ?? [],
            'immediate',
            { attackerId: '0', defenderId: '1', sourceAbilityId: 'treant-card-trample', state: state.core, damageDealt: 0, timestamp: 100 },
            { random: createQueuedRandom([1, 2, 4, 5, 6]) },
        );
        let next = applyEvents(state.core, events);
        const settlementEvents = settleBonusDice(next);
        next = applyEvents(next, settlementEvents);

        expect(events.filter(event => event.type === 'BONUS_DIE_ROLLED')).toHaveLength(5);
        expect(next.pendingAttack?.bonusDamage).toBe(2);
        expect(next.pendingAttack?.attackModifierBonusDamage).toBe(2);
        expect(next.players['1'].tokens[TOKEN_IDS.THORN]).toBe(0);
    });

    it('Trample 五个树枝时应加 5 伤害，刺藤满栈时不得超过上限', () => {
        const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        state.core.players['1'].tokens[TOKEN_IDS.THORN] = 1;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'shattering-fist',
            isDefendable: true,
            damage: 0,
        };

        const trample = TREANT_CARDS.find(card => card.id === 'treant-card-trample');
        expect(trample).toBeDefined();
        const events = resolveEffectsToEvents(
            trample?.effects ?? [],
            'immediate',
            { attackerId: '0', defenderId: '1', sourceAbilityId: 'treant-card-trample', state: state.core, damageDealt: 0, timestamp: 100 },
            { random: createQueuedRandom([1, 2, 3, 1, 2]) },
        );
        let next = applyEvents(state.core, events);
        const settlementEvents = settleBonusDice(next);
        next = applyEvents(next, settlementEvents);

        expect(events.filter(event => event.type === 'BONUS_DIE_ROLLED')).toHaveLength(5);
        expect(next.pendingAttack?.bonusDamage).toBe(5);
        expect(next.pendingAttack?.attackModifierBonusDamage).toBe(5);
        expect(settlementEvents.find(event => event.type === 'TOKEN_GRANTED' && event.payload.tokenId === TOKEN_IDS.THORN)?.payload).toMatchObject({
            amount: 0,
            newTotal: 1,
        });
        expect(next.players['1'].tokens[TOKEN_IDS.THORN]).toBe(1);
    });

    it('Soulfire 在 4 人队伍模式下树枝只伤害所有对手，不应伤害队友', () => {
        const state = createTreantTeamMatchup();
        state.core.players['1'].resources[RESOURCE_IDS.HP] = 50;
        state.core.players['2'].resources[RESOURCE_IDS.HP] = 50;
        state.core.players['3'].resources[RESOURCE_IDS.HP] = 50;
        state.core.players['0'].tokens[TOKEN_IDS.LIFE_SAP] = 0;
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING] = 0;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'shattering-fist',
            isDefendable: true,
            damage: 0,
        };

        const soulfire = TREANT_CARDS.find(card => card.id === 'treant-card-soulfire');
        expect(soulfire).toBeDefined();
        const events = resolveEffectsToEvents(
            soulfire?.effects ?? [],
            'immediate',
            { attackerId: '0', defenderId: '1', sourceAbilityId: 'treant-card-soulfire', state: state.core, damageDealt: 0, timestamp: 100 },
            { random: createQueuedRandom([1, 2, 4]) },
        );
        let next = applyEvents(state.core, events);
        const settlementEvents = settleBonusDice(next);
        next = applyEvents(next, settlementEvents);

        expect(settlementEvents.filter(event => event.type === 'DAMAGE_DEALT')).toHaveLength(2);
        expect(next.players['1'].resources[RESOURCE_IDS.HP]).toBe(46);
        expect(next.players['3'].resources[RESOURCE_IDS.HP]).toBe(46);
        expect(next.players['2'].resources[RESOURCE_IDS.HP]).toBe(50);
        expect(next.players['0'].tokens[TOKEN_IDS.LIFE_SAP]).toBe(1);
    });
});
