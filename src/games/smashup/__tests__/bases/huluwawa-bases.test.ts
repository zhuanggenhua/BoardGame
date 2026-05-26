import { beforeEach, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { getBaseDef } from '../../data/cards';
import { SMASHUP_ATLAS_IDS, SMASHUP_FACTION_IDS } from '../../domain/ids';
import { isMinionProtected } from '../../domain/ongoingEffects';
import {
    expectNoPrompt,
    getPromptOption,
    getSimpleChoicePrompt,
    makeBase,
    makeCard,
    makeMatchState,
    makeMinion,
    makePlayer,
    respondToPrompt,
    triggerBaseAbilityWithMS,
} from '../helpers';

describe('葫芦娃基地能力', () => {
    beforeEach(() => {
        resetAbilityInit();
        initAllAbilities();
    });

    it('葫芦娃基地静态定义绑定专用基地图集', () => {
        const mountain = getBaseDef('base_huluwawa_mountain');
        const lotus = getBaseDef('base_seven_colored_lotus');
        expect(mountain?.faction).toBe(SMASHUP_FACTION_IDS.HULUWAWA);
        expect(lotus?.faction).toBe(SMASHUP_FACTION_IDS.HULUWAWA);
        expect(mountain?.previewRef).toEqual({ type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.HULUWAWA_BASES, index: 0 });
        expect(lotus?.previewRef).toEqual({ type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.HULUWAWA_BASES, index: 1 });
    });

    it('葫芦山保护印刷力量 4 或更高的仆从不受其他玩家能力影响', () => {
        const core = {
            players: { '0': makePlayer('0'), '1': makePlayer('1') },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_huluwawa_mountain', [
                makeMinion('big', 'huluwawa_da_wa', '0', 4),
                makeMinion('small', 'robot_microbot_alpha', '0', 2),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        expect(isMinionProtected(core as any, core.bases[0].minions[0], 0, '1', 'destroy')).toBe(true);
        expect(isMinionProtected(core as any, core.bases[0].minions[1], 0, '1', 'destroy')).toBe(false);
        expect(isMinionProtected(core as any, core.bases[0].minions[0], 0, '0', 'destroy')).toBe(false);
    });

    it('七彩莲蓬提示后可真实额外打出同印刷力量仆从且不重复触发', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('same-power', 'huluwawa_da_wa', 'minion', '0'),
                        makeCard('wrong-power', 'robot_microbot_alpha', 'minion', '0'),
                    ],
                    minionsPlayedPerBase: { 0: 1 },
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_seven_colored_lotus', [
                makeMinion('played', 'huluwawa_er_wa', '0', 4),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };
        const matchState = makeMatchState(core);
        const result = triggerBaseAbilityWithMS('base_seven_colored_lotus', 'onMinionPlayed', {
            state: core as any,
            matchState,
            playerId: '0',
            baseIndex: 0,
            baseDefId: 'base_seven_colored_lotus',
            minionUid: 'played',
            minionDefId: 'huluwawa_er_wa',
            now: 1000,
        } as any);

        const prompt = getSimpleChoicePrompt(result.matchState!, 'base_seven_colored_lotus');
        expect(prompt.options.some((option: any) => option.value?.cardUid === 'same-power')).toBe(true);
        expect(prompt.options.some((option: any) => option.value?.cardUid === 'wrong-power')).toBe(false);

        const option = getPromptOption(prompt, entry => entry.value?.cardUid === 'same-power', '七彩莲蓬同力量仆从选项');
        const resolved = respondToPrompt(result.matchState!, option.id, '0');
        expect(resolved.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['played', 'same-power']);
        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['wrong-power']);
        expectNoPrompt(resolved.finalState);
    });
});
