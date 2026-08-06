import { beforeAll, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { clearRegistry } from '../../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../../domain/baseAbilities';
import { clearInteractionHandlers } from '../../domain/abilityInteractionHandlers';
import { clearOngoingEffectRegistry, fireTriggers } from '../../domain/ongoingEffects';
import { clearPowerModifierRegistry, getEffectivePower } from '../../domain/ongoingModifiers';
import { postProcessSystemEvents } from '../../domain';
import { SU_EVENTS, type SmashUpCore } from '../../domain/types';
import {
    applyEvents,
    getSimpleChoicePrompt,
    invokeRegisteredAbilityContract,
    makeBase,
    makeMatchState,
    makeMinion,
    makePlayer,
    makeState,
    respondToPromptOption,
} from '../helpers';
import { defaultTestRandom } from '../testRunner';

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    clearPowerModifierRegistry();
    clearOngoingEffectRegistry();
    clearInteractionHandlers();
    resetAbilityInit();
    initAllAbilities();
});

function invoke(core: SmashUpCore, defId: string, tag: 'onPlay' | 'talent', cardUid: string, baseIndex = 0) {
    return invokeRegisteredAbilityContract(defId, tag, {
        state: core,
        matchState: makeMatchState(core),
        playerId: '0',
        cardUid,
        defId,
        baseIndex,
        random: defaultTestRandom,
        now: 100,
    });
}

describe('萌奇金勇士派系', () => {
    it('大英雄只有一个合法模式时仍先手动选择模式和怪物', () => {
        const core = makeState({
            players: { '0': makePlayer('0'), '1': makePlayer('1') },
            monsterDeck: [],
            treasureDeck: ['munchkin_treasure_spiky_boots'],
            bases: [makeBase('base_bastion', [
                makeMinion('hero', 'munchkin_warriors_big_hero', '0', 5),
            ])],
        });
        core.bases[0].monsters = [{ uid: 'monster-1', defId: 'munchkin_monster_ghoul' }];

        const played = invoke(core, 'munchkin_warriors_big_hero', 'talent', 'hero');
        const mode = getSimpleChoicePrompt(played.matchState!, 'munchkin_warriors_big_hero_mode');
        expect(mode.options).toHaveLength(1);
        expect(mode.autoResolveIfSingle).toBe(false);

        const choseMode = respondToPromptOption(played.matchState!, option => option.value?.mode === 'destroyMonster', '选择大英雄模式', '0');
        const monster = getSimpleChoicePrompt(choseMode.finalState, 'munchkin_warriors_big_hero_monster');
        expect(monster.options).toHaveLength(1);
        expect(monster.autoResolveIfSingle).toBe(false);

        const resolved = respondToPromptOption(choseMode.finalState, option => option.value?.monsterUid === 'monster-1', '选择大英雄目标怪物', '0');
        expect(resolved.finalState.core.bases[0].monsters).toEqual([]);
        expect(resolved.finalState.core.players['0'].hand.map(card => card.defId)).toContain('munchkin_treasure_spiky_boots');
    });

    it('狂战士单候选手动选择后摧毁怪物并获得力量指示物', () => {
        const core = makeState({
            bases: [makeBase('test_base', [makeMinion('berserker', 'munchkin_warriors_berserker', '0', 3)])],
            treasureDeck: ['munchkin_treasure_spiky_boots'],
        });
        core.bases[0].monsters = [{ uid: 'monster-1', defId: 'munchkin_monster_ghoul' }];
        const played = invoke(core, BERSERKER, 'onPlay', 'berserker');
        const prompt = getSimpleChoicePrompt(played.matchState!, 'munchkin_warriors_berserker_monster');
        expect(prompt.options).toHaveLength(1);
        expect(prompt.autoResolveIfSingle).toBe(false);

        const resolved = respondToPromptOption(played.matchState!, option => option.value?.monsterUid === 'monster-1', '选择狂战士目标', '0');
        const source = resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'berserker');
        expect(resolved.finalState.core.bases[0].monsters).toEqual([]);
        expect(source?.powerCounters).toBe(1);
    });

    it('骚乱摧毁怪物分支不产生宝藏奖励，打出两个怪物分支逐张入场', () => {
        const destroyCore = makeState({
            treasureDeck: ['munchkin_treasure_spiky_boots'],
            bases: [makeBase('base_the_gauntlet')],
        });
        destroyCore.bases[0].monsters = [{ uid: 'monster-1', defId: 'munchkin_monster_bigfoot' }];
        const destroyPlayed = invoke(destroyCore, 'munchkin_warriors_ruckus', 'onPlay', 'ruckus');
        const basePrompt = getSimpleChoicePrompt(destroyPlayed.matchState!, 'munchkin_warriors_ruckus_base');
        expect(basePrompt.autoResolveIfSingle).toBe(false);
        const choseBase = respondToPromptOption(destroyPlayed.matchState!, option => option.value?.baseIndex === 0, '选择骚乱基地', '0');
        const modePrompt = getSimpleChoicePrompt(choseBase.finalState, 'munchkin_warriors_ruckus_mode');
        expect(modePrompt.options.some(option => option.value?.mode === 'destroyAll')).toBe(true);
        const destroyed = respondToPromptOption(choseBase.finalState, option => option.value?.mode === 'destroyAll', '选择骚乱摧毁模式', '0');
        expect(destroyed.finalState.core.bases[0].monsters).toEqual([]);
        expect(destroyed.finalState.core.players['0'].hand).toEqual([]);

        const playCore = makeState({
            monsterDeck: ['munchkin_monster_bigfoot', 'munchkin_monster_ghoul'],
            bases: [makeBase('base_the_gauntlet')],
        });
        const play = invoke(playCore, 'munchkin_warriors_ruckus', 'onPlay', 'ruckus-play');
        const playBase = respondToPromptOption(play.matchState!, option => option.value?.baseIndex === 0, '选择骚乱入场基地', '0');
        const playMode = getSimpleChoicePrompt(playBase.finalState, 'munchkin_warriors_ruckus_mode');
        const playedTwo = respondToPromptOption(playBase.finalState, option => option.value?.mode === 'playTwo', '选择骚乱打出两个怪物', '0');
        expect(playedTwo.finalState.core.bases[0].monsters?.map(monster => monster.defId)).toEqual([
            'munchkin_monster_bigfoot',
            'munchkin_monster_ghoul',
        ]);
        expect(playMode.autoResolveIfSingle).toBe(false);
    });

    it('哑铃和无处不在之盾通过统一力量修正随附着和怪物数量生效', () => {
        const core = makeState({
            bases: [makeBase({
                defId: 'test_base',
                minions: [makeMinion('host', 'test_minion', '0', 2, {
                    attachedActions: [
                        { uid: 'dumbbells', defId: 'munchkin_warriors_dumbbells', ownerId: '0' },
                        { uid: 'shield', defId: 'munchkin_warriors_shield_of_ubiquity', ownerId: '0' },
                    ],
                })],
                monsters: [
                    { uid: 'monster-1', defId: 'munchkin_monster_bigfoot' },
                    { uid: 'monster-2', defId: 'munchkin_monster_ghoul' },
                ],
            })],
        });
        expect(getEffectivePower(core, core.bases[0].minions[0], 0)).toBe(9);
        core.bases[0].monsters = core.bases[0].monsters?.slice(0, 1);
        expect(getEffectivePower(core, core.bases[0].minions[0], 0)).toBe(7);
    });

    it('永恒的英雄替代宿主回手，并只把本行动一起带回手牌', () => {
        const core = makeState({
            bases: [makeBase('test_base', [makeMinion('host', 'test_minion', '0', 3, {
                attachedActions: [
                    { uid: 'eternal', defId: 'munchkin_warriors_eternal_hero', ownerId: '0' },
                    { uid: 'other-action', defId: 'test_action', ownerId: '1' },
                ],
            })])],
        });
        const result = fireTriggers(core, 'onMinionDestroyed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'host',
            triggerMinionDefId: 'test_minion',
            triggerMinion: core.bases[0].minions[0],
            destroyerId: '0',
            random: defaultTestRandom,
            now: 100,
        }, { phase: 'replacement' });
        expect(result.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.MINION_RETURNED,
            payload: expect.objectContaining({ returnAttachedActionUids: ['eternal'] }),
        }));
        const finalCore = applyEvents(core, result.events);
        expect(finalCore.players['0'].hand.map(card => card.uid)).toEqual(['host', 'eternal']);
        expect(finalCore.players['1'].discard.map(card => card.uid)).toEqual(['other-action']);
    });

    it('怪物摧毁触发只在同基地触发明星勇士和堡垒', () => {
        const core = makeState({
            treasureDeck: ['munchkin_treasure_spiky_boots'],
            bases: [
                makeBase('base_bastion', [makeMinion('star', 'munchkin_warriors_star_player', '0', 4)]),
                makeBase('base_bastion', [makeMinion('other-star', 'munchkin_warriors_star_player', '0', 4)]),
            ],
        });
        core.bases[0].monsters = [{ uid: 'monster-1', defId: 'munchkin_monster_bigfoot' }];
        const event: SmashUpEvent = {
            type: SU_EVENTS.MUNCHKIN_MONSTER_DEFEATED,
            payload: {
                playerId: '0',
                baseIndex: 0,
                monsterUid: 'monster-1',
                monsterDefId: 'munchkin_monster_bigfoot',
                treasureUids: ['treasure-1'],
                reason: 'test_defeat',
            },
            timestamp: 100,
        } as SmashUpEvent;
        const processed = postProcessSystemEvents(core, [event], defaultTestRandom, makeMatchState(core));
        const reduced = applyEvents(core, processed.events);
        expect(reduced.bases[0].minions[0].powerCounters).toBe(1);
        expect(reduced.bases[1].minions[0].powerCounters ?? 0).toBe(0);
    });

    it('堡垒只在己方摧毁同基地怪物后抽宝藏，锦标赛补一个怪物', () => {
        const core = makeState({
            treasureDeck: ['munchkin_treasure_spiky_boots'],
            monsterDeck: ['munchkin_monster_ghoul'],
            bases: [makeBase('base_bastion', [makeMinion('hero', 'test_minion', '0', 3)])],
        });
        core.bases[0].monsters = [{ uid: 'monster-1', defId: 'munchkin_monster_bigfoot' }];
        const event: SmashUpEvent = {
            type: SU_EVENTS.MUNCHKIN_MONSTER_DEFEATED,
            payload: { playerId: '0', baseIndex: 0, monsterUid: 'monster-1', monsterDefId: 'munchkin_monster_bigfoot', reason: 'test_bastion' },
            timestamp: 100,
        } as SmashUpEvent;
        const bastionProcessed = postProcessSystemEvents(core, [event], defaultTestRandom, makeMatchState(core));
        const bastionFinal = applyEvents(core, bastionProcessed.events);
        expect(bastionFinal.players['0'].hand.map(card => card.defId)).toContain('munchkin_treasure_spiky_boots');

        const gauntlet = makeState({
            monsterDeck: ['munchkin_monster_ghoul'],
            bases: [makeBase('base_the_gauntlet')],
        });
        gauntlet.bases[0].monsters = [{ uid: 'monster-1', defId: 'munchkin_monster_bigfoot' }];
        const gauntletEvent = { ...event, payload: { ...event.payload, monsterUid: 'monster-1', monsterDefId: 'munchkin_monster_bigfoot' } } as SmashUpEvent;
        const gauntletProcessed = postProcessSystemEvents(gauntlet, [gauntletEvent], defaultTestRandom, makeMatchState(gauntlet));
        const gauntletFinal = applyEvents(gauntlet, gauntletProcessed.events);
        expect(gauntletFinal.bases[0].monsters?.map(monster => monster.defId)).toContain('munchkin_monster_ghoul');
    });

    it('斩杀击败怪物后逐张提供宝藏额外出牌，不自动吞掉单张奖励', () => {
        const core = makeState({
            treasureDeck: ['munchkin_treasure_dwarf_hireling'],
            bases: [makeBase('test_base')],
        });
        core.bases[0].monsters = [{ uid: 'monster-1', defId: 'munchkin_monster_ghoul' }];
        const played = invoke(core, 'munchkin_warriors_cleave', 'onPlay', 'cleave');
        const target = getSimpleChoicePrompt(played.matchState!, 'munchkin_warriors_cleave_monster');
        expect(target.autoResolveIfSingle).toBe(false);
        const resolved = respondToPromptOption(played.matchState!, option => option.value?.monsterUid === 'monster-1', '选择斩杀目标', '0');
        const extra = getSimpleChoicePrompt(resolved.finalState, 'smashup_immediate_extra_minion');
        expect(extra.autoResolveIfSingle).toBe(false);
        expect(extra.options.some(option => option.value?.cardUid === 'munchkin_treasure_100')).toBe(true);
        const skipped = respondToPromptOption(resolved.finalState, option => option.value?.skip === true, '跳过宝藏额外随从', '0');
        expect(skipped.finalState.core.players['0'].hand.map(card => card.defId)).toContain('munchkin_treasure_dwarf_hireling');
    });
});

const BERSERKER = 'munchkin_warriors_berserker';
