import { beforeEach, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { getFactionCards } from '../../data/cards';
import { getDiscardActionPlayOptions } from '../../domain/discardActionPlayability';
import { getDiscardSpecialOptions } from '../../domain/discardSpecialAbilities';
import { getEffectivePower } from '../../domain/ongoingModifiers';
import { fireTriggers, isMinionProtected } from '../../domain/ongoingEffects';
import { reduce } from '../../domain/reduce';
import { getVisibleFactionMetadata } from '../../ui/factionMeta';
import { SMASHUP_ATLAS_IDS, SMASHUP_FACTION_IDS } from '../../domain/ids';
import { SU_COMMANDS, SU_EVENTS } from '../../domain/types';
import {
    applyEvents,
    getPromptOption,
    getPromptOptions,
    getSimpleChoicePrompt,
    expectNoPrompt,
    invokeRegisteredInteractionHandlerContract,
    makeBase,
    makeCard,
    makeMatchState,
    makeMinion,
    makePlayer,
    makeState,
    respondToPrompt,
} from '../helpers';
import { defaultTestRandom, runCommand } from '../testRunner';

const reverseRandom = {
    ...defaultTestRandom,
    shuffle: <T>(items: T[]) => [...items].reverse(),
};

describe('葫芦娃派系作者 PR 级行为合同', () => {
    beforeEach(() => {
        resetAbilityInit();
        initAllAbilities();
    });

    it('静态接入为中文可见、英文隐藏，并绑定专用卡牌图集', () => {
        const cards = getFactionCards(SMASHUP_FACTION_IDS.HULUWAWA as any);
        expect(cards).toHaveLength(18);
        expect(cards.every(card => card.faction === SMASHUP_FACTION_IDS.HULUWAWA)).toBe(true);
        expect(cards.every(card => card.previewRef?.type === 'atlas')).toBe(true);
        expect(cards.map(card => card.previewRef?.atlasId)).toEqual(
            Array.from({ length: 18 }, () => SMASHUP_ATLAS_IDS.HULUWAWA_CARDS),
        );

        expect(getVisibleFactionMetadata('zh-CN').map(meta => meta.id)).toContain(SMASHUP_FACTION_IDS.HULUWAWA);
        expect(getVisibleFactionMetadata('en').map(meta => meta.id)).not.toContain(SMASHUP_FACTION_IDS.HULUWAWA);
    });

    it('大娃天赋会让自己直到回合结束获得 +2 力量', () => {
        const core = makeState({
            bases: [makeBase('base_huluwawa_mountain', [
                makeMinion('dawa', 'huluwawa_da_wa', '0', 4),
            ])],
        });

        const talent = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'dawa', baseIndex: 0 },
        } as any);

        expect(talent.success).toBe(true);
        expect(talent.finalState.core.bases[0].minions[0].tempPowerModifier).toBe(2);
        expect(talent.finalState.core.bases[0].minions[0].talentUsed).toBe(true);
    });

    it('葫芦小金刚会在己方仆从发动天赋后提示复制另一个仆从天赋', () => {
        const core = makeState({
            bases: [makeBase('base_huluwawa_mountain', [
                makeMinion('source-da', 'huluwawa_da_wa', '0', 4),
                makeMinion('copy-da', 'huluwawa_da_wa', '0', 4),
            ])],
            titans: [{
                uid: 'king-kong',
                defId: 'huluwawa_little_king_kong',
                faction: SMASHUP_FACTION_IDS.HULUWAWA,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0 },
            }],
        });

        const talent = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'source-da', baseIndex: 0 },
        } as any);
        expect(talent.success).toBe(true);
        const prompt = getSimpleChoicePrompt(talent.finalState, 'huluwawa_little_king_kong_copy_talent');
        expect(prompt.options.some(option => option.value?.minionUid === 'source-da')).toBe(false);
        const option = getPromptOption(prompt, entry => entry.value?.minionUid === 'copy-da', '葫芦小金刚复制大娃天赋');
        const resolved = respondToPrompt(talent.finalState, option.id, '0');

        const sourceDa = resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'source-da');
        const copyDa = resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'copy-da');
        const titan = resolved.finalState.core.titans?.find(candidate => candidate.uid === 'king-kong');
        expect(sourceDa?.tempPowerModifier).toBe(2);
        expect(sourceDa?.talentUsed).toBe(true);
        expect(copyDa?.tempPowerModifier).toBe(2);
        expect(copyDa?.talentUsed).toBe(true);
        expect(titan?.metadata?.huluwawaCopiedTalentTurn).toBe(core.turnNumber);
        expectNoPrompt(resolved.finalState);
    });

    it('葫芦小金刚本回合已复制过时不会再次弹出复制提示', () => {
        const core = makeState({
            bases: [makeBase('base_huluwawa_mountain', [
                makeMinion('source-da', 'huluwawa_da_wa', '0', 4),
                makeMinion('copy-da', 'huluwawa_da_wa', '0', 4),
            ])],
            titans: [{
                uid: 'king-kong',
                defId: 'huluwawa_little_king_kong',
                faction: SMASHUP_FACTION_IDS.HULUWAWA,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0 },
                metadata: { huluwawaCopiedTalentTurn: 1 },
            }],
        });

        const talent = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'source-da', baseIndex: 0 },
        } as any);

        expect(talent.success).toBe(true);
        expectNoPrompt(talent.finalState);
        expect(talent.finalState.core.bases[0].minions.find(minion => minion.uid === 'copy-da')?.tempPowerModifier ?? 0).toBe(0);
    });

    it('四娃打出后可摧毁这里力量 3 或更小仆从并获得 +1 指示物', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('siwa-card', 'huluwawa_si_wa', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_huluwawa_mountain', [
                makeMinion('enemy-small', 'alien_invader', '1', 3),
            ])],
        });

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'siwa-card', baseIndex: 0 },
        } as any);
        const prompt = getSimpleChoicePrompt(played.finalState, 'huluwawa_si_wa');
        const option = getPromptOption(prompt, entry => entry.value?.minionUid === 'enemy-small', '四娃摧毁目标');
        const resolved = respondToPrompt(played.finalState, option.id, '0');

        expect(resolved.finalState.core.bases[0].minions.some(minion => minion.uid === 'enemy-small')).toBe(false);
        const siwa = resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'siwa-card');
        expect(siwa?.powerCounters).toBe(1);
        expectNoPrompt(resolved.finalState);
    });

    it('五娃天赋会把另一个基地的力量 3 或更小仆从移动到这里', () => {
        const core = makeState({
            bases: [
                makeBase('base_huluwawa_mountain', [
                    makeMinion('wuwa', 'huluwawa_wu_wa', '0', 4),
                ]),
                makeBase('base_seven_colored_lotus', [
                    makeMinion('enemy-small', 'alien_invader', '1', 3),
                    makeMinion('enemy-big', 'dinosaur_king_rex', '1', 7),
                ]),
            ],
        });

        const talent = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'wuwa', baseIndex: 0 },
        } as any);
        const prompt = getSimpleChoicePrompt(talent.finalState, 'huluwawa_move_to_source');
        const option = getPromptOption(prompt, entry => entry.value?.minionUid === 'enemy-small', '五娃移动目标');
        const resolved = respondToPrompt(talent.finalState, option.id, '0');

        expect(resolved.finalState.core.bases[0].minions.map(minion => minion.uid)).toContain('enemy-small');
        expect(resolved.finalState.core.bases[1].minions.map(minion => minion.uid)).not.toContain('enemy-small');
    });

    it('三娃不受其他玩家摧毁且离场时可洗回牌库替代弃牌', () => {
        const sanwa = makeMinion('sanwa', 'huluwawa_san_wa', '0', 4);
        const core = makeState({
            players: {
                '0': makePlayer('0', { deck: [makeCard('deck-card', 'huluwawa_da_wa', 'minion', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_huluwawa_mountain', [sanwa])],
        });

        expect(isMinionProtected(core, sanwa, 0, '1', 'destroy')).toBe(true);
        expect(isMinionProtected(core, sanwa, 0, '0', 'destroy')).toBe(false);

        const result = fireTriggers(core, 'onMinionDiscardedFromBase', {
            state: core,
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'sanwa',
            triggerMinionDefId: 'huluwawa_san_wa',
            triggerMinion: sanwa,
            random: reverseRandom,
            now: 1000,
        });
        expect(result.events.some(event => event.type === SU_EVENTS.CARD_TO_DECK_BOTTOM)).toBe(true);
        expect(result.events.some(event => event.type === SU_EVENTS.DECK_REORDERED)).toBe(true);
    });

    it('七娃从牌库选择行动牌加入手牌后会重洗剩余牌库', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('action-picked', 'huluwawa_jade_ruyi', 'action', '0'),
                        makeCard('deck-a', 'huluwawa_da_wa', 'minion', '0'),
                        makeCard('deck-b', 'huluwawa_er_wa', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_huluwawa_mountain', [
                makeMinion('qiwa', 'huluwawa_qi_wa', '0', 4),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const talent = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'qiwa', baseIndex: 0 },
        } as any, reverseRandom);
        expect(talent.success).toBe(true);
        const prompt = getSimpleChoicePrompt(talent.finalState, 'huluwawa_search_card');
        const option = getPromptOption(prompt, entry => entry.value?.cardUid === 'action-picked', '七娃行动牌选项');
        const resolved = respondToPrompt(talent.finalState, option.id, '0', reverseRandom);

        const player = resolved.finalState.core.players['0'];
        expect(player.hand.map(card => card.uid)).toContain('action-picked');
        expect(player.deck.map(card => card.uid)).toEqual(['deck-b', 'deck-a']);
    });

    it('紫金宝葫芦弃牌堆行动牌放牌库底有真实 handler', () => {
        const state = makeMatchState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('deck-a', 'huluwawa_da_wa', 'minion', '0')],
                    discard: [makeCard('discard-action', 'huluwawa_pop', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_huluwawa_mountain', [])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        });

        const handled = invokeRegisteredInteractionHandlerContract(
            'huluwawa_purple_gold_gourd_bottom',
            state,
            '0',
            { cardUid: 'discard-action', defId: 'huluwawa_pop', sourceZone: 'discard' },
            undefined,
            1000,
        );
        const core = applyEvents(handled!.state.core, handled!.events);
        expect(core.players['0'].deck.map(card => card.uid)).toEqual(['deck-a', 'discard-action']);
        expect(core.players['0'].discard.map(card => card.uid)).toEqual([]);
    });

    it('紫金宝葫芦在七娃在场时会作为弃牌堆附着行动入口暴露，而不是 discard special', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    discard: [makeCard('gourd-card', 'huluwawa_purple_gold_gourd', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_huluwawa_mountain', [
                makeMinion('qiwa', 'huluwawa_qi_wa', '0', 4),
                makeMinion('other-self', 'huluwawa_da_wa', '0', 4),
            ])],
        });

        const options = getDiscardActionPlayOptions(core, '0');
        expect(options).toHaveLength(1);
        expect(options[0]?.card.uid).toBe('gourd-card');
        expect(options[0]?.sourceId).toBe('huluwawa_purple_gold_gourd');
        expect(options[0]?.allowedBaseIndices).toEqual([0]);
        expect(options[0]?.allowedMinionUids).toEqual(['qiwa']);
        expect(getDiscardSpecialOptions(core, '0')).toEqual([]);
    });

    it('行动额度已用完时，不应继续把紫金宝葫芦暴露为弃牌堆可打行动', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    discard: [makeCard('gourd-card', 'huluwawa_purple_gold_gourd', 'action', '0')],
                    actionsPlayed: 1,
                    actionLimit: 1,
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_huluwawa_mountain', [
                makeMinion('qiwa', 'huluwawa_qi_wa', '0', 4),
            ])],
        });

        expect(getDiscardActionPlayOptions(core, '0')).toEqual([]);
    });

    it('紫金宝葫芦从弃牌堆额外打出时只能附着到己方七娃身上', () => {
        const initial = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', {
                    discard: [makeCard('gourd-card', 'huluwawa_purple_gold_gourd', 'action', '0')],
                    actionsPlayed: 0,
                    actionLimit: 1,
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_huluwawa_mountain', [
                makeMinion('qiwa', 'huluwawa_qi_wa', '0', 4),
                makeMinion('other-self', 'huluwawa_da_wa', '0', 4),
            ])],
            turnNumber: 1,
            nextUid: 100,
        }));

        const illegal = runCommand(initial, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: {
                cardUid: 'gourd-card',
                targetBaseIndex: 0,
                targetMinionUid: 'other-self',
                fromDiscard: true,
            },
        } as any);
        expect(illegal.success).toBe(false);
        expect(illegal.error).toContain('不能从弃牌堆');

        const legal = runCommand(initial, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: {
                cardUid: 'gourd-card',
                targetBaseIndex: 0,
                targetMinionUid: 'qiwa',
                fromDiscard: true,
            },
        } as any);
        expect(legal.success).toBe(true);
        const qiwa = legal.finalState.core.bases[0].minions.find(minion => minion.uid === 'qiwa');
        expect(qiwa?.attachedActions.map(action => action.uid)).toContain('gourd-card');
        expect(legal.finalState.core.players['0'].discard.some(card => card.uid === 'gourd-card')).toBe(false);
    });

    it('一根藤上七朵花会把弃牌堆中不同名仆从各一张洗回牌库', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('vine-card', 'huluwawa_one_vine_seven_flowers', 'action', '0')],
                    discard: [
                        makeCard('dawa-a', 'huluwawa_da_wa', 'minion', '0'),
                        makeCard('dawa-b', 'huluwawa_da_wa', 'minion', '0'),
                        makeCard('erwa-a', 'huluwawa_er_wa', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'vine-card' },
        } as any);
        const deckUids = played.finalState.core.players['0'].deck.map(card => card.uid);
        const discardUids = played.finalState.core.players['0'].discard.map(card => card.uid);

        expect(deckUids).toEqual(expect.arrayContaining(['dawa-a', 'erwa-a']));
        expect(deckUids).not.toContain('dawa-b');
        expect(discardUids).toContain('dawa-b');
    });

    it('人多力量大会给目标基地所有己方仆从临时 +1', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('strength-card', 'huluwawa_strength_in_numbers', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_huluwawa_mountain', [
                makeMinion('ally-a', 'huluwawa_da_wa', '0', 4),
                makeMinion('ally-b', 'huluwawa_er_wa', '0', 4),
                makeMinion('enemy-a', 'alien_invader', '1', 3),
            ])],
        });

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'strength-card', targetBaseIndex: 0 },
        } as any);

        const minions = new Map(played.finalState.core.bases[0].minions.map(minion => [minion.uid, minion]));
        expect(minions.get('ally-a')?.tempPowerModifier).toBe(1);
        expect(minions.get('ally-b')?.tempPowerModifier).toBe(1);
        expect(minions.get('enemy-a')?.tempPowerModifier ?? 0).toBe(0);
    });

    it('妖精哪里逃可在摧毁小仆从和移动仆从之间创建真实选择', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('where-card', 'huluwawa_where_do_you_think_youre_going', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_huluwawa_mountain', [
                    makeMinion('enemy-small', 'alien_invader', '1', 3),
                ]),
                makeBase('base_seven_colored_lotus', []),
            ],
        });

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'where-card' },
        } as any);
        const prompt = getSimpleChoicePrompt(played.finalState, 'huluwawa_where_do_you_think');
        const destroyOption = getPromptOption(prompt, entry => entry.value?.choice === 'destroy', '妖精哪里逃摧毁分支');
        const choseDestroy = respondToPrompt(played.finalState, destroyOption.id, '0');
        const targetPrompt = getSimpleChoicePrompt(choseDestroy.finalState, 'huluwawa_destroy_any');
        const targetOption = getPromptOption(targetPrompt, entry => entry.value?.minionUid === 'enemy-small', '妖精哪里逃摧毁目标');
        const resolved = respondToPrompt(choseDestroy.finalState, targetOption.id, '0');

        expect(resolved.finalState.core.bases[0].minions.some(minion => minion.uid === 'enemy-small')).toBe(false);
        expectNoPrompt(resolved.finalState);
    });

    it('碰和快放了我爷爷分别落实摸牌、额外行动和自身回牌库底', () => {
        const popCore = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('pop-card', 'huluwawa_pop', 'action', '0')],
                    deck: [
                        makeCard('draw-a', 'huluwawa_da_wa', 'minion', '0'),
                        makeCard('draw-b', 'huluwawa_er_wa', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });
        const pop = runCommand(makeMatchState(popCore), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'pop-card' },
        } as any);
        expect(pop.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(expect.arrayContaining(['draw-a', 'draw-b']));

        const releaseCore = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('release-card', 'huluwawa_release_my_grandpa', 'action', '0')],
                    deck: [makeCard('deck-card', 'huluwawa_da_wa', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
        });
        const release = runCommand(makeMatchState(releaseCore), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'release-card' },
        } as any);
        expect(release.events.filter(event =>
            event.type === 'su:limit_modified'
            && (event as any).payload?.limitType === 'action'
            && (event as any).payload?.reason === 'huluwawa_release_my_grandpa'
        )).toHaveLength(2);
        expect(release.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['deck-card', 'release-card']);
    });

    it('六娃计分前取消天赋会移除待回退记录并恢复力量修正', () => {
        const state = makeMatchState({
            players: { '0': makePlayer('0'), '1': makePlayer('1') },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_huluwawa_mountain', [
                makeMinion('liuwa', 'huluwawa_liu_wa', '0', 4, { powerModifier: -4 }),
            ])],
            baseDeck: [],
            turnNumber: 2,
            nextUid: 100,
            timedPowerModifiers: [{ minionUid: 'liuwa', amount: -4, expiresOnTurnNumber: 4, reason: 'huluwawa_liu_wa_talent' }],
        });

        const handled = invokeRegisteredInteractionHandlerContract(
            'huluwawa_liu_wa_before_scoring',
            state,
            '0',
            { cancel: true },
            { continuationContext: { minionUid: 'liuwa' } },
            1000,
        );
        const core = applyEvents(handled!.state.core, handled!.events);
        expect(core.timedPowerModifiers).toBeUndefined();
        expect(core.bases[0].minions[0].powerModifier).toBe(0);
    });

    it('六娃计分前取消天赋必须从六娃本体入口发动', () => {
        const core = makeState({
            players: { '0': makePlayer('0'), '1': makePlayer('1') },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_huluwawa_mountain', [
                makeMinion('liuwa', 'huluwawa_liu_wa', '0', 4, { powerModifier: -4 }),
            ])],
            baseDeck: [],
            turnNumber: 2,
            nextUid: 100,
            timedPowerModifiers: [{ minionUid: 'liuwa', amount: -4, expiresOnTurnNumber: 4, reason: 'huluwawa_liu_wa_talent' }],
        });

        const triggered = fireTriggers(core, 'beforeScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            now: 1000,
        });

        const prompt = getSimpleChoicePrompt(triggered.matchState!, 'huluwawa_liu_wa_before_scoring');
        expect(prompt.targetType).toBe('field-source-action');

        const cancelOption = getPromptOption(
            prompt,
            option =>
                option.value?.fieldInteractionType === 'source-action'
                && option.value?.fieldSourceType === 'minion'
                && option.value?.sourceUid === 'liuwa'
                && option.value?.minionUid === 'liuwa'
                && option.value?.cancel === true,
            'Liu Wa field-source-action cancel option',
        );
        expect(cancelOption.displayMode).toBe('card');

        const resolved = respondToPrompt(triggered.matchState!, cancelOption.id);
        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.finalState.core.timedPowerModifiers).toBeUndefined();
        expect(resolved.finalState.core.bases[0].minions[0].powerModifier).toBe(0);
    });

    it('六娃发动天赋后不应成为毛茸茸女王的控制目标', () => {
        const queenUsed = runCommand(makeMatchState({
            players: { '0': makePlayer('0'), '1': makePlayer('1') },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            turnNumber: 3,
            bases: [makeBase('base_a', [
                makeMinion('queen', 'kitty_cats_queen_fluffy', '0', 5),
                makeMinion('liuwa', 'huluwawa_liu_wa', '1', 4, { powerModifier: -4 }),
            ])],
            baseDeck: [],
            timedPowerModifiers: [{ minionUid: 'liuwa', amount: -4, expiresOnTurnNumber: 4, reason: 'huluwawa_liu_wa_talent' }],
        }), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'queen', baseIndex: 0 },
        } as any);

        expect(queenUsed.success).toBe(true);
        expectNoPrompt(queenUsed.finalState);
        expect(queenUsed.events.some(event =>
            event.type === SU_EVENTS.ABILITY_FEEDBACK
            && ((event as any).payload?.feedbackKey === 'feedback.no_valid_targets'
                || (event as any).payload?.messageKey === 'feedback.no_valid_targets')
        )).toBe(true);
    });

    it('六娃发动天赋后到自己下个回合开始会恢复力量', () => {
        const nextTurn = reduce(makeState({
            players: { '0': makePlayer('0'), '1': makePlayer('1') },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            turnNumber: 3,
            bases: [makeBase('base_a', [
                makeMinion('liuwa', 'huluwawa_liu_wa', '1', 4, { powerModifier: -4 }),
            ])],
            baseDeck: [],
            timedPowerModifiers: [{ minionUid: 'liuwa', amount: -4, expiresOnTurnNumber: 4, reason: 'huluwawa_liu_wa_talent' }],
        }), {
            type: SU_EVENTS.TURN_STARTED,
            payload: { playerId: '1', turnNumber: 4 },
            timestamp: 2000,
        } as any);

        const liuwa = nextTurn.bases[0].minions.find(minion => minion.uid === 'liuwa');
        expect(liuwa?.powerModifier).toBe(0);
        expect(nextTurn.timedPowerModifiers).toBeUndefined();
        expect(getEffectivePower(nextTurn, liuwa!, 0)).toBe(4);
    });

    it('二娃展示顶三张后可额外打出选中的真实仆从并清空交互', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('top-minion', 'huluwawa_da_wa', 'minion', '0'),
                        makeCard('top-action', 'huluwawa_pop', 'action', '0'),
                        makeCard('top-minion-2', 'huluwawa_san_wa', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase('base_huluwawa_mountain', [makeMinion('erwa', 'huluwawa_er_wa', '0', 4)]),
                makeBase('base_seven_colored_lotus', []),
            ],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const talent = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'erwa', baseIndex: 0 },
        } as any);
        const pickPrompt = getSimpleChoicePrompt(talent.finalState, 'huluwawa_er_wa');
        const pick = getPromptOption(pickPrompt, option => option.value?.cardUid === 'top-minion', '二娃顶牌仆从选项');
        const picked = respondToPrompt(talent.finalState, pick.id, '0');

        const basePrompt = getSimpleChoicePrompt(picked.finalState, 'huluwawa_extra_minion_base');
        const base = getPromptOption(basePrompt, option => option.value?.baseIndex === 1, '二娃额外打出基地选项');
        const targetChosen = respondToPrompt(picked.finalState, base.id, '0');
        const reorderPrompt = getSimpleChoicePrompt(targetChosen.finalState, 'huluwawa_er_wa_reorder');
        const reorder = getPromptOption(
            reorderPrompt,
            option =>
                option.value?.topUids?.join(',') === 'top-action'
                && option.value?.bottomUids?.join(',') === 'top-minion-2',
            '二娃其余牌顶/底重排选项',
        );
        const resolved = respondToPrompt(targetChosen.finalState, reorder.id, '0');

        expect(resolved.finalState.core.bases[1].minions.map(minion => minion.uid)).toContain('top-minion');
        expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['top-action', 'top-minion-2']);
        expectNoPrompt(resolved.finalState);
    });

    it('二娃跳过额外打出时仍可选择顶三张的顶/底分配顺序', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('top-a', 'huluwawa_da_wa', 'minion', '0'),
                        makeCard('top-b', 'huluwawa_pop', 'action', '0'),
                        makeCard('top-c', 'huluwawa_san_wa', 'minion', '0'),
                        makeCard('rest', 'huluwawa_wu_wa', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_huluwawa_mountain', [makeMinion('erwa', 'huluwawa_er_wa', '0', 4)])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const talent = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'erwa', baseIndex: 0 },
        } as any);
        const pickPrompt = getSimpleChoicePrompt(talent.finalState, 'huluwawa_er_wa');
        const skip = getPromptOption(pickPrompt, option => option.value?.skip, '二娃不打出选项');
        const skipped = respondToPrompt(talent.finalState, skip.id, '0');
        const reorderPrompt = getSimpleChoicePrompt(skipped.finalState, 'huluwawa_er_wa_reorder');
        const reorder = getPromptOption(
            reorderPrompt,
            option =>
                option.value?.topUids?.join(',') === 'top-c,top-a'
                && option.value?.bottomUids?.join(',') === 'top-b',
            '二娃跳过后的顶/底重排选项',
        );
        const resolved = respondToPrompt(skipped.finalState, reorder.id, '0');

        expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['top-c', 'top-a', 'rest', 'top-b']);
        expectNoPrompt(resolved.finalState);
    });

    it('一个一个来会返还目标仆从并允许其拥有者立即打出不同名字仆从到这里', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1', {
                    hand: [makeCard('replacement', 'robot_microbot_alpha', 'minion', '1')],
                }),
            },
            bases: [makeBase({
                defId: 'base_huluwawa_mountain',
                minions: [makeMinion('enemy-source', 'alien_invader', '1', 3)],
                ongoingActions: [{ uid: 'one-at-a-time', defId: 'huluwawa_one_at_a_time', ownerId: '0' }],
            })],
        });

        const talent = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { ongoingCardUid: 'one-at-a-time', baseIndex: 0 },
        } as any);
        const targetPrompt = getSimpleChoicePrompt(talent.finalState, 'huluwawa_one_at_a_time_target');
        const target = getPromptOption(targetPrompt, entry => entry.value?.minionUid === 'enemy-source', '一个一个来返回目标');
        const returned = respondToPrompt(talent.finalState, target.id, '0');
        const playPrompt = getSimpleChoicePrompt(returned.finalState, 'huluwawa_one_at_a_time_play');
        expect(playPrompt.playerId).toBe('1');
        const replacement = getPromptOption(playPrompt, entry => entry.value?.cardUid === 'replacement', '一个一个来替换仆从');
        const resolved = respondToPrompt(returned.finalState, replacement.id, '1');

        expect(resolved.finalState.core.players['1'].hand.map(card => card.uid)).toContain('enemy-source');
        expect(resolved.finalState.core.bases[0].minions.map(minion => minion.uid)).toContain('replacement');
        expectNoPrompt(resolved.finalState);
    });

    it('毫无存在感与蝴蝶妹妹的帮助覆盖替代式离场/摧毁入口', () => {
        const host = makeMinion('host', 'huluwawa_da_wa', '0', 4, {
            attachedActions: [
                { uid: 'no-presence', defId: 'huluwawa_no_presence', ownerId: '0' },
                { uid: 'butterfly', defId: 'huluwawa_butterfly_sisters_help', ownerId: '0' },
            ],
        });
        const core = makeState({
            players: {
                '0': makePlayer('0', { deck: [makeCard('deck-card', 'huluwawa_er_wa', 'minion', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_huluwawa_mountain', [host])],
        });

        const noPresence = fireTriggers(core, 'onMinionDiscardedFromBase', {
            state: core,
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'host',
            triggerMinionDefId: 'huluwawa_da_wa',
            triggerMinion: host,
            sourceCardUid: 'no-presence',
            random: reverseRandom,
            now: 1000,
        });
        expect(noPresence.events.some(event => event.type === SU_EVENTS.CARD_TO_DECK_BOTTOM)).toBe(true);
        expect(noPresence.events.some(event => event.type === SU_EVENTS.DECK_REORDERED)).toBe(true);

        const butterfly = fireTriggers(core, 'onMinionDestroyed', {
            state: core,
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'host',
            triggerMinionDefId: 'huluwawa_da_wa',
            triggerMinion: host,
            sourceCardUid: 'butterfly',
            random: defaultTestRandom,
            now: 1000,
        });
        const detach = butterfly.events.find(event => event.type === SU_EVENTS.ONGOING_DETACHED) as any;
        expect(detach?.payload?.cardUid).toBe('butterfly');
    });
});
