import { describe, expect, it } from 'vitest';
import type { DiceThroneCore, DiceThroneEvent } from '../domain/types';
import type { Die } from '../domain/types';
import { execute } from '../domain/execute';
import { validateCommand } from '../domain/commandValidation';
import { reduce } from '../domain/reducer';
import { RESOURCE_IDS } from '../domain/resources';
import { NINJA_DICE_FACE_IDS, TOKEN_IDS } from '../domain/ids';
import { resolveAttack } from '../domain/attack';
import { resolveEffectsToEvents } from '../domain/effects';
import { getChoiceResolvedEventHandler } from '../domain/choiceResolvedEvents';
import { checkPlayCard, getAvailableAbilityIds } from '../domain/rules';
import { getAbilitySlotIdForCharacter, slotContainsAbilityIdForCharacter } from '../ui/abilitySlotMapping';
import { NINJA_CARDS } from '../heroes/ninja/cards';
import { BLINK_2, DEATH_BLOSSOM_2, GOING_FORWARD_2, POISON_BLADE_2, SHADOW_FANG_2, SHADOW_STEP_2, SLASH_2, SMOKE_SCREEN_2 } from '../heroes/ninja/abilities';
import { createHeroMatchup, createQueuedRandom } from './test-utils';

const applyEvents = (core: DiceThroneCore, events: DiceThroneEvent[]): DiceThroneCore =>
    events.reduce((current, event) => reduce(current, event), core);

const createNinjaTeamMatchup = () => {
    const state = createHeroMatchup('ninja', 'treant')(['0', '1'], createQueuedRandom([1]));
    state.core.players['2'] = JSON.parse(JSON.stringify(state.core.players['0']));
    state.core.players['2'].id = '2';
    state.core.players['3'] = JSON.parse(JSON.stringify(state.core.players['1']));
    state.core.players['3'].id = '3';
    state.core.seatingOrder = ['0', '1', '2', '3'];
    state.core.teamIdByPlayerId = { '0': 'A', '1': 'B', '2': 'A', '3': 'B' };
    state.core.teamHealth = { A: 50, B: 50 };
    return state;
};

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

    it('暗影步 II 的勒杀分支应施加 3 忍术与 2 慢性中毒，并作为非攻击分支收口', () => {
        const state = createHeroMatchup('ninja', 'treant')(['0', '1'], createQueuedRandom([1]));
        state.core.players['0'].tokens[TOKEN_IDS.NINJUTSU] = 0;
        state.core.players['1'].tokens[TOKEN_IDS.DELAYED_POISON] = 0;
        state.core.players['1'].resources[RESOURCE_IDS.HP] = 30;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'shadow-step-2-strangle',
            isDefendable: true,
            damage: 0,
        };

        const events = resolveEffectsToEvents(
            SHADOW_STEP_2.variants?.[1].effects ?? [],
            'preDefense',
            {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'shadow-step-2-strangle',
                state: state.core,
                damageDealt: 0,
                timestamp: 120,
            },
            { random: createQueuedRandom([1]) },
        );
        const next = applyEvents(state.core, events);

        expect(events.some(event => event.type === 'DAMAGE_DEALT')).toBe(false);
        expect(events.some(event => event.type === 'TOKEN_RESPONSE_REQUESTED')).toBe(false);
        expect(next.players['0'].tokens[TOKEN_IDS.NINJUTSU]).toBe(3);
        expect(next.players['1'].tokens[TOKEN_IDS.DELAYED_POISON]).toBe(2);
        expect(next.players['1'].resources[RESOURCE_IDS.HP]).toBe(30);
        expect(next.pendingAttack?.isDefendable).toBe(false);
        expect(next.pendingDamage).toBeUndefined();
    });

    it('烟雾阵 II 主分支应在选择目标后给目标玩家烟雾弹与 3 忍术，并对目标对手施加慢性中毒', () => {
        const state = createHeroMatchup('ninja', 'treant')(['0', '1'], createQueuedRandom([1]));
        state.core.players['0'].tokens[TOKEN_IDS.SMOKE_BOMB] = 0;
        state.core.players['0'].tokens[TOKEN_IDS.NINJUTSU] = 0;
        state.core.players['1'].tokens[TOKEN_IDS.DELAYED_POISON] = 0;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'smoke-screen-2-main',
            isDefendable: true,
            damage: 0,
        };

        const events = resolveEffectsToEvents(
            SMOKE_SCREEN_2.variants?.[0].effects ?? [],
            'preDefense',
            {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'smoke-screen-2-main',
                state: state.core,
                damageDealt: 0,
                timestamp: 140,
            },
            { random: createQueuedRandom([1]) },
        );
        const choiceEvent = events.find(event => event.type === 'CHOICE_REQUESTED');
        const selectedOption = (choiceEvent as any)?.payload?.options?.find((option: { labelKey?: string }) =>
            option.labelKey === '令1号玩家获得烟雾弹与3忍术；对2号玩家施加慢性中毒'
        );
        expect(selectedOption).toBeDefined();

        let next = applyEvents(state.core, events);
        const followupHandler = getChoiceResolvedEventHandler(selectedOption.customId);
        expect(followupHandler).toBeDefined();
        const followupEvents = followupHandler?.({
            state: next,
            playerId: '0',
            customId: selectedOption.customId,
            sourceAbilityId: 'smoke-screen-2-main',
            value: selectedOption.value,
            timestamp: 141,
        }) ?? [];

        next = reduce(next, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '0',
                sourceAbilityId: 'smoke-screen-2-main',
                customId: selectedOption.customId,
                value: selectedOption.value,
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 141,
        } as DiceThroneEvent);
        next = applyEvents(next, followupEvents);

        expect(next.players['0'].tokens[TOKEN_IDS.SMOKE_BOMB]).toBe(1);
        expect(next.players['0'].tokens[TOKEN_IDS.NINJUTSU]).toBe(3);
        expect(next.players['1'].tokens[TOKEN_IDS.DELAYED_POISON]).toBe(1);
        expect(next.pendingAttack?.isDefendable).toBe(false);
        expect(next.pendingDamage).toBeUndefined();
    });

    it('烟雾阵 II 的九字切分支应允许同一名对手吃两次 4 点真实伤害，并作为非攻击分支收口', () => {
        const state = createHeroMatchup('ninja', 'treant')(['0', '1'], createQueuedRandom([1]));
        state.core.players['1'].resources[RESOURCE_IDS.HP] = 30;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'smoke-screen-2-kuji-kiri',
            isDefendable: true,
            damage: 0,
        };

        const events = resolveEffectsToEvents(
            SMOKE_SCREEN_2.variants?.[1].effects ?? [],
            'preDefense',
            {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'smoke-screen-2-kuji-kiri',
                state: state.core,
                damageDealt: 0,
                timestamp: 160,
            },
            { random: createQueuedRandom([1]) },
        );
        const choiceEvent = events.find(event => event.type === 'CHOICE_REQUESTED');
        const selectedOption = (choiceEvent as any)?.payload?.options?.find((option: { labelKey?: string }) =>
            option.labelKey === '对2号玩家造成两次 4 点真实伤害'
        );
        expect(selectedOption).toBeDefined();

        let next = applyEvents(state.core, events);
        const followupHandler = getChoiceResolvedEventHandler(selectedOption.customId);
        expect(followupHandler).toBeDefined();
        const followupEvents = followupHandler?.({
            state: next,
            playerId: '0',
            customId: selectedOption.customId,
            sourceAbilityId: 'smoke-screen-2-kuji-kiri',
            value: selectedOption.value,
            timestamp: 161,
        }) ?? [];

        next = reduce(next, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '0',
                sourceAbilityId: 'smoke-screen-2-kuji-kiri',
                customId: selectedOption.customId,
                value: selectedOption.value,
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 161,
        } as DiceThroneEvent);
        next = applyEvents(next, followupEvents);

        expect(next.players['1'].resources[RESOURCE_IDS.HP]).toBe(22);
        expect(next.pendingAttack?.isDefendable).toBe(false);
        expect(next.pendingDamage).toBeUndefined();
    });

    it('烟雾阵 II 主分支在 4 人局应暴露完整玩家-对手目标矩阵，并允许把增益给队友、把慢性中毒给另一名对手', () => {
        const state = createNinjaTeamMatchup();
        state.core.players['0'].tokens[TOKEN_IDS.SMOKE_BOMB] = 0;
        state.core.players['0'].tokens[TOKEN_IDS.NINJUTSU] = 0;
        state.core.players['2'].tokens[TOKEN_IDS.SMOKE_BOMB] = 0;
        state.core.players['2'].tokens[TOKEN_IDS.NINJUTSU] = 0;
        state.core.players['1'].tokens[TOKEN_IDS.DELAYED_POISON] = 0;
        state.core.players['3'].tokens[TOKEN_IDS.DELAYED_POISON] = 0;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'smoke-screen-2-main',
            isDefendable: true,
            damage: 0,
        };

        const events = resolveEffectsToEvents(
            SMOKE_SCREEN_2.variants?.[0].effects ?? [],
            'preDefense',
            {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'smoke-screen-2-main',
                state: state.core,
                damageDealt: 0,
                timestamp: 150,
            },
            { random: createQueuedRandom([1]) },
        );
        const choiceEvent = events.find(event => event.type === 'CHOICE_REQUESTED');
        const options = ((choiceEvent as any)?.payload?.options ?? []) as Array<{ labelKey?: string; customId: string; value: number }>;

        expect(options).toHaveLength(8);
        const selectedOption = options.find((option) =>
            option.labelKey === '令3号玩家获得烟雾弹与3忍术；对4号玩家施加慢性中毒'
        );
        expect(selectedOption).toBeDefined();

        let next = applyEvents(state.core, events);
        const followupHandler = getChoiceResolvedEventHandler(selectedOption!.customId);
        expect(followupHandler).toBeDefined();
        const followupEvents = followupHandler?.({
            state: next,
            playerId: '0',
            customId: selectedOption!.customId,
            sourceAbilityId: 'smoke-screen-2-main',
            value: selectedOption!.value,
            timestamp: 151,
        }) ?? [];

        next = reduce(next, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '0',
                sourceAbilityId: 'smoke-screen-2-main',
                customId: selectedOption!.customId,
                value: selectedOption!.value,
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 151,
        } as DiceThroneEvent);
        next = applyEvents(next, followupEvents);

        expect(next.players['2'].tokens[TOKEN_IDS.SMOKE_BOMB]).toBe(1);
        expect(next.players['2'].tokens[TOKEN_IDS.NINJUTSU]).toBe(3);
        expect(next.players['3'].tokens[TOKEN_IDS.DELAYED_POISON]).toBe(1);
        expect(next.players['1'].tokens[TOKEN_IDS.DELAYED_POISON]).toBe(0);
        expect(next.pendingAttack?.isDefendable).toBe(false);
        expect(next.pendingDamage).toBeUndefined();
    });

    it('烟雾阵 II 的九字切分支在 4 人局应允许两个不同对手各吃 4 点真实伤害', () => {
        const state = createNinjaTeamMatchup();
        state.core.players['1'].resources[RESOURCE_IDS.HP] = 30;
        state.core.players['3'].resources[RESOURCE_IDS.HP] = 30;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'smoke-screen-2-kuji-kiri',
            isDefendable: true,
            damage: 0,
        };

        const events = resolveEffectsToEvents(
            SMOKE_SCREEN_2.variants?.[1].effects ?? [],
            'preDefense',
            {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'smoke-screen-2-kuji-kiri',
                state: state.core,
                damageDealt: 0,
                timestamp: 160,
            },
            { random: createQueuedRandom([1]) },
        );
        const choiceEvent = events.find(event => event.type === 'CHOICE_REQUESTED');
        const options = ((choiceEvent as any)?.payload?.options ?? []) as Array<{ labelKey?: string; customId: string; value: number }>;

        expect(options).toHaveLength(3);
        const selectedOption = options.find((option) =>
            option.labelKey === '对2号与4号玩家各造成 4 点真实伤害'
        );
        expect(selectedOption).toBeDefined();

        let next = applyEvents(state.core, events);
        const followupHandler = getChoiceResolvedEventHandler(selectedOption!.customId);
        expect(followupHandler).toBeDefined();
        const followupEvents = followupHandler?.({
            state: next,
            playerId: '0',
            customId: selectedOption!.customId,
            sourceAbilityId: 'smoke-screen-2-kuji-kiri',
            value: selectedOption!.value,
            timestamp: 161,
        }) ?? [];

        next = reduce(next, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '0',
                sourceAbilityId: 'smoke-screen-2-kuji-kiri',
                customId: selectedOption!.customId,
                value: selectedOption!.value,
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 161,
        } as DiceThroneEvent);
        next = applyEvents(next, followupEvents);

        expect(next.players['1'].resources[RESOURCE_IDS.HP]).toBe(22);
        expect(next.players['3'].resources[RESOURCE_IDS.HP]).toBe(22);
        expect(next.teamHealth?.B).toBe(22);
        expect(next.pendingAttack?.isDefendable).toBe(false);
        expect(next.pendingDamage).toBeUndefined();
    });

    it('烟雾阵 II 的选择 followup 应拒绝越界的 forged choice value，避免把效果路由到错误目标', () => {
        const mainState = createNinjaTeamMatchup();
        mainState.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'smoke-screen-2-main',
            isDefendable: true,
            damage: 0,
        };
        const mainHandler = getChoiceResolvedEventHandler('ninja-smoke-screen-2-choice');
        expect(mainHandler).toBeDefined();
        const forgedMainEvents = mainHandler?.({
            state: mainState.core,
            playerId: '0',
            customId: 'ninja-smoke-screen-2-choice',
            sourceAbilityId: 'smoke-screen-2-main',
            value: 99,
            timestamp: 170,
        }) ?? [];
        expect(forgedMainEvents).toEqual([]);

        const kujiState = createNinjaTeamMatchup();
        kujiState.core.players['1'].resources[RESOURCE_IDS.HP] = 30;
        kujiState.core.players['3'].resources[RESOURCE_IDS.HP] = 30;
        kujiState.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'smoke-screen-2-kuji-kiri',
            isDefendable: true,
            damage: 0,
        };
        const kujiHandler = getChoiceResolvedEventHandler('ninja-smoke-screen-kuji-kiri-choice');
        expect(kujiHandler).toBeDefined();
        const forgedKujiEvents = kujiHandler?.({
            state: kujiState.core,
            playerId: '0',
            customId: 'ninja-smoke-screen-kuji-kiri-choice',
            sourceAbilityId: 'smoke-screen-2-kuji-kiri',
            value: 99,
            timestamp: 171,
        }) ?? [];
        expect(forgedKujiEvents).toEqual([]);
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

    it('Blink II 被选为防御技能后应把防御投掷上限提升到 2，以允许重掷至多 2 颗', () => {
        const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        state.core.players['1'].abilities = state.core.players['1'].abilities.map(ability => (
            ability.id === 'blink' ? BLINK_2 : ability
        ));
        state.core.players['1'].abilityLevels.blink = 2;
        state.core.rollCount = 0;
        state.core.rollLimit = 1;
        state.core.rollDiceCount = 0;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'shattering-fist',
            defenseAbilityId: undefined,
            isDefendable: true,
            damage: 0,
        };

        const next = reduce(state.core, {
            type: 'ABILITY_ACTIVATED',
            payload: {
                abilityId: 'blink',
                playerId: '1',
                isDefense: true,
            },
            sourceCommandType: 'TEST',
            timestamp: 100,
        } as DiceThroneEvent);

        expect(next.pendingAttack?.defenseAbilityId).toBe('blink');
        expect(next.rollDiceCount).toBe(3);
        expect(next.rollLimit).toBe(2);
    });

    it('一往无前 II 主分支应通过共享奖励骰链限制为至多重掷 1 次，并在总和小于等于 6 时改成不可防御', () => {
        const state = createHeroMatchup('ninja', 'treant')(['0', '1'], createQueuedRandom([1]));
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'going-forward-2-main',
            isDefendable: true,
            damage: 0,
        };

        const openEvents = resolveEffectsToEvents(
            GOING_FORWARD_2.variants?.[0].effects ?? [],
            'preDefense',
            {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'going-forward-2-main',
                state: state.core,
                damageDealt: 0,
                timestamp: 100,
            },
            { random: createQueuedRandom([2, 3]) },
        );
        let next = applyEvents(state.core, openEvents);

        expect(openEvents.filter(event => event.type === 'BONUS_DIE_ROLLED')).toHaveLength(2);
        expect(next.pendingBonusDiceSettlement).toMatchObject({
            sourceAbilityId: 'going-forward-2-main',
            attackerId: '0',
            targetId: '1',
            maxRerollCount: 1,
            rerollCount: 0,
            customResolutionId: 'ninja-going-forward-2',
            resolutionMode: 'attackBonus',
        });

        const firstRerollValidation = validateCommand(
            next,
            command('REROLL_BONUS_DIE', '0', { dieIndex: 0 }),
            'offensiveRoll',
        );
        expect(firstRerollValidation.valid).toBe(true);

        const rerollEvents = execute(
            { core: next, sys: { phase: 'offensiveRoll' } },
            command('REROLL_BONUS_DIE', '0', { dieIndex: 0 }),
            createQueuedRandom([1]),
        );
        next = applyEvents(next, rerollEvents);

        expect(next.pendingBonusDiceSettlement?.rerollCount).toBe(1);
        expect(next.pendingBonusDiceSettlement?.dice.find(die => die.index === 0)?.value).toBe(1);

        const secondRerollValidation = validateCommand(
            next,
            command('REROLL_BONUS_DIE', '0', { dieIndex: 1 }),
            'offensiveRoll',
        );
        expect(secondRerollValidation).toEqual({
            valid: false,
            error: 'bonus_reroll_limit_reached',
        });

        const settleEvents = execute(
            { core: next, sys: { phase: 'offensiveRoll' } },
            command('SKIP_BONUS_DICE_REROLL', '0'),
            createQueuedRandom([1]),
        );
        next = applyEvents(next, settleEvents);

        expect(next.pendingBonusDiceSettlement).toBeUndefined();
        expect(next.pendingAttack?.bonusDamage).toBe(4);
        expect(next.pendingAttack?.isDefendable).toBe(false);
    });

    it('一往无前 II 主分支在奖励骰总和大于 6 时不应错误改成不可防御', () => {
        const state = createHeroMatchup('ninja', 'treant')(['0', '1'], createQueuedRandom([1]));
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'going-forward-2-main',
            isDefendable: true,
            damage: 0,
        };

        const openEvents = resolveEffectsToEvents(
            GOING_FORWARD_2.variants?.[0].effects ?? [],
            'preDefense',
            {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'going-forward-2-main',
                state: state.core,
                damageDealt: 0,
                timestamp: 130,
            },
            { random: createQueuedRandom([4, 4]) },
        );
        let next = applyEvents(state.core, openEvents);

        expect(next.pendingBonusDiceSettlement).toMatchObject({
            sourceAbilityId: 'going-forward-2-main',
            rerollCount: 0,
            maxRerollCount: 1,
        });

        const settleEvents = execute(
            { core: next, sys: { phase: 'offensiveRoll' } },
            command('SKIP_BONUS_DICE_REROLL', '0'),
            createQueuedRandom([1]),
        );
        next = applyEvents(next, settleEvents);

        expect(next.pendingBonusDiceSettlement).toBeUndefined();
        expect(next.pendingAttack?.bonusDamage).toBe(8);
        expect(next.pendingAttack?.isDefendable).toBe(true);
    });

    it('一往无前 II 的刀尖舔血分支应按单骰结果造成等值真实伤害并直接收口攻击链', () => {
        const state = createHeroMatchup('ninja', 'treant')(['0', '1'], createQueuedRandom([1]));
        state.core.players['1'].resources[RESOURCE_IDS.HP] = 30;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'going-forward-2-bleed',
            isDefendable: true,
            damage: 0,
        };

        const events = resolveEffectsToEvents(
            GOING_FORWARD_2.variants?.[1].effects ?? [],
            'preDefense',
            {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'going-forward-2-bleed',
                state: state.core,
                damageDealt: 0,
                timestamp: 150,
            },
            { random: createQueuedRandom([5]) },
        );
        const next = applyEvents(state.core, events);

        expect(events.filter(event => event.type === 'BONUS_DIE_ROLLED')).toHaveLength(1);
        const damageEvent = events.find(event => event.type === 'DAMAGE_DEALT');
        expect(damageEvent?.payload).toMatchObject({
            targetId: '1',
            amount: 5,
            unblockable: true,
            damageScope: 'direct',
        });
        expect(next.players['1'].resources[RESOURCE_IDS.HP]).toBe(25);
        expect(next.pendingAttack?.isDefendable).toBe(false);
    });

    it('斩击 II 在 3 忍刀时应造成 4 点伤害，并在攻击骰为 3 个同点后于 postDamage 获得 1 忍术', () => {
        const state = createHeroMatchup('ninja', 'treant')(['0', '1'], createQueuedRandom([1]));
        state.core.players['0'].abilities = state.core.players['0'].abilities.map((ability) => (
            ability.id === 'slash' ? SLASH_2 : ability
        ));
        state.core.players['0'].abilityLevels.slash = 2;
        state.core.players['0'].tokens[TOKEN_IDS.NINJUTSU] = 0;
        state.core.players['1'].resources[RESOURCE_IDS.HP] = 30;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'slash-2-3',
            isDefendable: true,
            damage: 0,
            attackDiceValues: [1, 1, 1, 4, 5],
        };

        const events = resolveAttack(state.core, createQueuedRandom([1]), { includePreDefense: true }, 165);
        const next = applyEvents(state.core, events);

        const damageEvent = events.find(event => event.type === 'DAMAGE_DEALT');
        expect((damageEvent as any)?.payload?.amount).toBe(4);
        expect(next.players['1'].resources[RESOURCE_IDS.HP]).toBe(26);
        expect(next.players['0'].tokens[TOKEN_IDS.NINJUTSU]).toBe(1);
    });

    it('斩击 II 在 5 忍刀时应造成 8 点伤害，且非 3 同点时不授予额外忍术', () => {
        const state = createHeroMatchup('ninja', 'treant')(['0', '1'], createQueuedRandom([1]));
        state.core.players['0'].abilities = state.core.players['0'].abilities.map((ability) => (
            ability.id === 'slash' ? SLASH_2 : ability
        ));
        state.core.players['0'].abilityLevels.slash = 2;
        state.core.players['0'].tokens[TOKEN_IDS.NINJUTSU] = 0;
        state.core.players['1'].resources[RESOURCE_IDS.HP] = 30;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'slash-2-5',
            isDefendable: true,
            damage: 0,
            attackDiceValues: [1, 2, 3, 4, 5],
        };

        const events = resolveAttack(state.core, createQueuedRandom([1]), { includePreDefense: true }, 166);
        const next = applyEvents(state.core, events);

        const damageEvent = events.find(event => event.type === 'DAMAGE_DEALT');
        expect((damageEvent as any)?.payload?.amount).toBe(8);
        expect(next.players['1'].resources[RESOURCE_IDS.HP]).toBe(22);
        expect(next.players['0'].tokens[TOKEN_IDS.NINJUTSU]).toBe(0);
    });

    it('斩击 II 的 postDamage 忍术奖励应只读取攻击快照，而不是当前活跃骰面', () => {
        const tripletAttackState = createHeroMatchup('ninja', 'treant')(['0', '1'], createQueuedRandom([1]));
        tripletAttackState.core.players['0'].abilities = tripletAttackState.core.players['0'].abilities.map((ability) => (
            ability.id === 'slash' ? SLASH_2 : ability
        ));
        tripletAttackState.core.players['0'].abilityLevels.slash = 2;
        tripletAttackState.core.players['0'].tokens[TOKEN_IDS.NINJUTSU] = 0;
        tripletAttackState.core.players['1'].resources[RESOURCE_IDS.HP] = 30;
        tripletAttackState.core.dice = [1, 2, 4].map(createNinjaDie);
        tripletAttackState.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'slash-2-4',
            isDefendable: true,
            damage: 0,
            attackDiceValues: [2, 2, 2, 4, 5],
        };

        const tripletEvents = resolveAttack(tripletAttackState.core, createQueuedRandom([1]), { includePreDefense: true }, 167);
        const tripletNext = applyEvents(tripletAttackState.core, tripletEvents);

        expect(tripletNext.players['0'].tokens[TOKEN_IDS.NINJUTSU]).toBe(1);

        const nonTripletAttackState = createHeroMatchup('ninja', 'treant')(['0', '1'], createQueuedRandom([1]));
        nonTripletAttackState.core.players['0'].abilities = nonTripletAttackState.core.players['0'].abilities.map((ability) => (
            ability.id === 'slash' ? SLASH_2 : ability
        ));
        nonTripletAttackState.core.players['0'].abilityLevels.slash = 2;
        nonTripletAttackState.core.players['0'].tokens[TOKEN_IDS.NINJUTSU] = 0;
        nonTripletAttackState.core.players['1'].resources[RESOURCE_IDS.HP] = 30;
        nonTripletAttackState.core.dice = [6, 6, 6].map(createNinjaDie);
        nonTripletAttackState.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'slash-2-4',
            isDefendable: true,
            damage: 0,
            attackDiceValues: [1, 2, 3, 4, 5],
        };

        const nonTripletEvents = resolveAttack(nonTripletAttackState.core, createQueuedRandom([1]), { includePreDefense: true }, 168);
        const nonTripletNext = applyEvents(nonTripletAttackState.core, nonTripletEvents);

        expect(nonTripletNext.players['0'].tokens[TOKEN_IDS.NINJUTSU]).toBe(0);
    });

    it('影牙 II 主分支应获得 1 烟雾弹、2 忍术并造成 8 点伤害', () => {
        const state = createHeroMatchup('ninja', 'treant')(['0', '1'], createQueuedRandom([1]));
        state.core.players['0'].abilities = state.core.players['0'].abilities.map((ability) => (
            ability.id === 'shadow-fang' ? SHADOW_FANG_2 : ability
        ));
        state.core.players['0'].abilityLevels['shadow-fang'] = 2;
        state.core.players['0'].tokens[TOKEN_IDS.SMOKE_BOMB] = 0;
        state.core.players['0'].tokens[TOKEN_IDS.NINJUTSU] = 0;
        state.core.players['1'].resources[RESOURCE_IDS.HP] = 30;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'shadow-fang-2-main',
            isDefendable: true,
            damage: 0,
        };

        const events = resolveAttack(state.core, createQueuedRandom([1]), { includePreDefense: true }, 167);
        let next = applyEvents(state.core, events);

        expect(events.some(event => event.type === 'TOKEN_RESPONSE_REQUESTED')).toBe(true);
        expect(next.players['0'].tokens[TOKEN_IDS.SMOKE_BOMB]).toBe(1);
        expect(next.players['0'].tokens[TOKEN_IDS.NINJUTSU]).toBe(2);
        expect(next.players['1'].resources[RESOURCE_IDS.HP]).toBe(30);
        expect(next.pendingDamage?.responseType).toBe('beforeDamageDealt');
        expect(next.pendingDamage?.currentDamage).toBe(8);
        expect(next.pendingDamage?.responderId).toBe('0');

        const skipEvents = execute(
            { core: next, sys: { phase: 'offensiveRoll' } },
            command('SKIP_TOKEN_RESPONSE', '0'),
            createQueuedRandom([1]),
        );
        next = applyEvents(next, skipEvents);

        expect(next.players['1'].resources[RESOURCE_IDS.HP]).toBe(22);
        expect(next.pendingDamage).toBeUndefined();
        expect(next.pendingAttack).toMatchObject({
            sourceAbilityId: 'shadow-fang-2-main',
            damageResolved: true,
            resolvedDamage: 8,
        });
    });

    it('影牙 II 的诳惑分支应获得 1 烟雾弹并造成 2 点不可防御伤害', () => {
        const state = createHeroMatchup('ninja', 'treant')(['0', '1'], createQueuedRandom([1]));
        state.core.players['0'].abilities = state.core.players['0'].abilities.map((ability) => (
            ability.id === 'shadow-fang' ? SHADOW_FANG_2 : ability
        ));
        state.core.players['0'].abilityLevels['shadow-fang'] = 2;
        state.core.players['0'].tokens[TOKEN_IDS.SMOKE_BOMB] = 0;
        state.core.players['1'].resources[RESOURCE_IDS.HP] = 30;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'shadow-fang-2-deceive',
            isDefendable: false,
            damage: 0,
        };

        const events = resolveAttack(state.core, createQueuedRandom([1]), { includePreDefense: true }, 168);
        const next = applyEvents(state.core, events);

        const damageEvent = events.find(event => event.type === 'DAMAGE_DEALT');
        expect(events.some(event => event.type === 'TOKEN_RESPONSE_REQUESTED')).toBe(false);
        expect((damageEvent as any)?.payload?.amount).toBe(2);
        expect((damageEvent as any)?.payload?.unblockable).toBe(true);
        expect(next.players['0'].tokens[TOKEN_IDS.SMOKE_BOMB]).toBe(1);
        expect(next.players['1'].resources[RESOURCE_IDS.HP]).toBe(28);
        expect(next.pendingDamage).toBeUndefined();
    });

    it('毒刃 II 在奖励骰投出忍刀时应完成 1 个慢性中毒 + 5 点伤害的完整攻击收口', () => {
        const state = createHeroMatchup('ninja', 'treant')(['0', '1'], createQueuedRandom([1]));
        state.core.players['1'].resources[RESOURCE_IDS.HP] = 30;
        state.core.players['1'].tokens[TOKEN_IDS.DELAYED_POISON] = 0;
        state.core.players['0'].abilities = state.core.players['0'].abilities.map(ability => (
            ability.id === 'poison-blade' ? POISON_BLADE_2 : ability
        ));
        state.core.players['0'].abilityLevels['poison-blade'] = 2;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'poison-blade',
            isDefendable: true,
            damage: 0,
        };

        const events = resolveAttack(state.core, createQueuedRandom([1]), { includePreDefense: true }, 170);
        const next = applyEvents(state.core, events);

        expect(events.filter(event => event.type === 'BONUS_DIE_ROLLED')).toHaveLength(1);
        expect(events.filter(event => event.type === 'BONUS_DICE_REROLL_REQUESTED')).toHaveLength(1);
        expect(events.some(event => event.type === 'ATTACK_PRE_DEFENSE_RESOLVED')).toBe(true);
        expect(events.some(event => event.type === 'ATTACK_RESOLVED')).toBe(true);
        expect(next.players['1'].tokens[TOKEN_IDS.DELAYED_POISON]).toBe(1);
        expect(next.players['1'].resources[RESOURCE_IDS.HP]).toBe(25);
    });

    it('毒刃 II 在奖励骰投出手里剑或面具时应完成 2 个慢性中毒 + 5 点伤害的完整攻击收口', () => {
        const state = createHeroMatchup('ninja', 'treant')(['0', '1'], createQueuedRandom([1]));
        state.core.players['1'].resources[RESOURCE_IDS.HP] = 30;
        state.core.players['1'].tokens[TOKEN_IDS.DELAYED_POISON] = 0;
        state.core.players['0'].abilities = state.core.players['0'].abilities.map(ability => (
            ability.id === 'poison-blade' ? POISON_BLADE_2 : ability
        ));
        state.core.players['0'].abilityLevels['poison-blade'] = 2;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'poison-blade',
            isDefendable: true,
            damage: 0,
        };

        const events = resolveAttack(state.core, createQueuedRandom([6]), { includePreDefense: true }, 180);
        const next = applyEvents(state.core, events);

        expect(events.filter(event => event.type === 'BONUS_DIE_ROLLED')).toHaveLength(1);
        expect(events.filter(event => event.type === 'BONUS_DICE_REROLL_REQUESTED')).toHaveLength(1);
        expect(events.some(event => event.type === 'ATTACK_PRE_DEFENSE_RESOLVED')).toBe(true);
        expect(events.some(event => event.type === 'ATTACK_RESOLVED')).toBe(true);
        expect(next.players['1'].tokens[TOKEN_IDS.DELAYED_POISON]).toBe(2);
        expect(next.players['1'].resources[RESOURCE_IDS.HP]).toBe(25);
    });

    it('死亡盛放 II 应通过共享奖励骰链限制为至多重掷 2 次，并在双面具时施加慢性中毒且改成不可防御', () => {
        const state = createHeroMatchup('ninja', 'treant')(['0', '1'], createQueuedRandom([1]));
        state.core.players['1'].tokens[TOKEN_IDS.DELAYED_POISON] = 0;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'death-blossom-2',
            isDefendable: true,
            damage: 0,
        };

        const openEvents = resolveEffectsToEvents(
            DEATH_BLOSSOM_2.effects ?? [],
            'preDefense',
            {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'death-blossom-2',
                state: state.core,
                damageDealt: 0,
                timestamp: 200,
            },
            { random: createQueuedRandom([1, 1, 1, 4, 4]) },
        );
        let next = applyEvents(state.core, openEvents);

        expect(openEvents.filter(event => event.type === 'BONUS_DIE_ROLLED')).toHaveLength(5);
        expect(next.pendingBonusDiceSettlement).toMatchObject({
            sourceAbilityId: 'death-blossom-2',
            attackerId: '0',
            targetId: '1',
            maxRerollCount: 2,
            rerollCount: 0,
            customResolutionId: 'ninja-death-blossom-2',
            resolutionMode: 'attackBonus',
        });

        const firstRerollEvents = execute(
            { core: next, sys: { phase: 'offensiveRoll' } },
            command('REROLL_BONUS_DIE', '0', { dieIndex: 0 }),
            createQueuedRandom([6]),
        );
        next = applyEvents(next, firstRerollEvents);

        const secondRerollEvents = execute(
            { core: next, sys: { phase: 'offensiveRoll' } },
            command('REROLL_BONUS_DIE', '0', { dieIndex: 1 }),
            createQueuedRandom([6]),
        );
        next = applyEvents(next, secondRerollEvents);

        expect(next.pendingBonusDiceSettlement?.rerollCount).toBe(2);
        expect(next.pendingBonusDiceSettlement?.dice.filter(die => die.face === NINJA_DICE_FACE_IDS.MASK)).toHaveLength(2);

        const thirdRerollValidation = validateCommand(
            next,
            command('REROLL_BONUS_DIE', '0', { dieIndex: 2 }),
            'offensiveRoll',
        );
        expect(thirdRerollValidation).toEqual({
            valid: false,
            error: 'bonus_reroll_limit_reached',
        });

        const settleEvents = execute(
            { core: next, sys: { phase: 'offensiveRoll' } },
            command('SKIP_BONUS_DICE_REROLL', '0'),
            createQueuedRandom([1]),
        );
        next = applyEvents(next, settleEvents);

        expect(next.pendingBonusDiceSettlement).toBeUndefined();
        expect(next.pendingAttack?.bonusDamage).toBe(5);
        expect(next.pendingAttack?.isDefendable).toBe(false);
        expect(next.players['1'].tokens[TOKEN_IDS.DELAYED_POISON]).toBe(1);
    });

    it('死亡盛放 II 应按面具数量分别收口为无追加、仅不可防御、不可防御加慢性中毒', () => {
        const scenarios = [
            {
                label: '0 面具',
                diceValues: [1, 1, 4, 4, 4],
                expectedBonusDamage: 8,
                expectedDefendable: true,
                expectedPoison: 0,
            },
            {
                label: '1 面具',
                diceValues: [1, 4, 4, 4, 6],
                expectedBonusDamage: 7,
                expectedDefendable: false,
                expectedPoison: 0,
            },
            {
                label: '2 面具',
                diceValues: [1, 4, 4, 6, 6],
                expectedBonusDamage: 5,
                expectedDefendable: false,
                expectedPoison: 1,
            },
        ] as const;

        for (const scenario of scenarios) {
            const state = createHeroMatchup('ninja', 'treant')(['0', '1'], createQueuedRandom([1]));
            state.core.players['1'].tokens[TOKEN_IDS.DELAYED_POISON] = 0;
            state.core.pendingAttack = {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'death-blossom-2',
                isDefendable: true,
                damage: 0,
            };

            const openEvents = resolveEffectsToEvents(
                DEATH_BLOSSOM_2.effects ?? [],
                'preDefense',
                {
                    attackerId: '0',
                    defenderId: '1',
                    sourceAbilityId: 'death-blossom-2',
                    state: state.core,
                    damageDealt: 0,
                    timestamp: 230,
                },
                { random: createQueuedRandom([...scenario.diceValues]) },
            );
            let next = applyEvents(state.core, openEvents);

            expect(next.pendingBonusDiceSettlement, `${scenario.label} 应创建奖励骰结算`).toMatchObject({
                sourceAbilityId: 'death-blossom-2',
                rerollCount: 0,
                maxRerollCount: 2,
            });

            const settleEvents = execute(
                { core: next, sys: { phase: 'offensiveRoll' } },
                command('SKIP_BONUS_DICE_REROLL', '0'),
                createQueuedRandom([1]),
            );
            next = applyEvents(next, settleEvents);

            expect(next.pendingBonusDiceSettlement, `${scenario.label} 收口后应清空奖励骰结算`).toBeUndefined();
            expect(next.pendingAttack?.bonusDamage, `${scenario.label} 应写入正确 bonusDamage`).toBe(scenario.expectedBonusDamage);
            expect(next.pendingAttack?.isDefendable, `${scenario.label} 应命中正确可防御状态`).toBe(scenario.expectedDefendable);
            expect(next.players['1'].tokens[TOKEN_IDS.DELAYED_POISON], `${scenario.label} 应命中正确慢性中毒`).toBe(scenario.expectedPoison);
        }
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
