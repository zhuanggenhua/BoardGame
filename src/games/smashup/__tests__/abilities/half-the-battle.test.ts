import { beforeEach, describe, expect, it } from 'vitest';

import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { clearRegistry } from '../../domain/abilityRegistry';
import { clearInteractionHandlers } from '../../domain/abilityInteractionHandlers';
import { clearBaseAbilityRegistry } from '../../domain/baseAbilities';
import { clearOngoingEffectRegistry, fireTriggers, isMinionProtected } from '../../domain/ongoingEffects';
import { getPlayerEffectivePowerOnBase } from '../../domain/ongoingModifiers';
import { SU_COMMANDS, SU_EVENTS } from '../../domain/types';
import { reduce } from '../../domain/reduce';
import {
    applyEvents,
    expectNoPrompt,
    getPromptOption,
    getSimpleChoicePrompt,
    invokeRegisteredAbilityContract,
    makeBase,
    makeCard,
    makeMatchState,
    makeMinion,
    makePlayer,
    makeState,
    respondToPromptOption,
    respondToPromptOptions,
    triggerBaseAbilityWithMS,
} from '../helpers';
import { defaultTestRandom, runCommand } from '../testRunner';

beforeEach(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    clearOngoingEffectRegistry();
    clearInteractionHandlers();
    resetAbilityInit();
    initAllAbilities();
});

describe('半场战争扩 prompt 型能力', () => {
    it('路霸行动面会让玩家选择战力≤3随从置于牌库底', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_a', [
                makeMinion('weak-1', 'test_weak', '1', 3),
                makeMinion('weak-2', 'test_weak_two', '0', 2),
                makeMinion('big-1', 'test_big', '1', 4),
            ])],
        });

        const result = invokeRegisteredAbilityContract('gi_gerald_obstruction', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'obstruction-action',
            defId: 'gi_gerald_obstruction',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 10,
        });

        expect(result.events.some(event => event.type === SU_EVENTS.CARD_TO_DECK_BOTTOM)).toBe(false);
        const prompt = getSimpleChoicePrompt(result.matchState!, 'gi_gerald_obstruction_action');
        expect(prompt.options.some((option: any) => option.value?.minionUid === 'big-1')).toBe(false);

        const resolved = respondToPromptOption(
            result.matchState!,
            option => option.value?.minionUid === 'weak-1',
            '路霸可置底目标',
            '0',
            defaultTestRandom,
        );

        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.CARD_TO_DECK_BOTTOM,
                payload: expect.objectContaining({ cardUid: 'weak-1', ownerId: '1' }),
            }),
        ]));
    });

    it('现在你知道：校园暴力 special 会选择计分基地己方随从返回手牌', () => {
        const core = makeState({
            bases: [makeBase('base_a', [
                makeMinion('own-1', 'geckos_hokusai', '0', 2),
                makeMinion('own-2', 'geckos_monet', '0', 3),
                makeMinion('enemy-1', 'test_enemy', '1', 3),
            ])],
        });

        const result = invokeRegisteredAbilityContract('geckos_now_you_know_bullying', 'special', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'bullying',
            defId: 'geckos_now_you_know_bullying',
            baseIndex: 0,
            targetBaseIndex: 0,
            random: defaultTestRandom,
            now: 20,
        });

        const prompt = getSimpleChoicePrompt(result.matchState!, 'geckos_now_you_know_bullying_special');
        expect(prompt.options.some((option: any) => option.value?.minionUid === 'enemy-1')).toBe(false);

        const returned = respondToPromptOption(
            result.matchState!,
            option => option.value?.minionUid === 'own-2',
            '校园暴力返回目标',
            '0',
            defaultTestRandom,
        );

        expect(returned.success, returned.error).toBe(true);
        expect(returned.finalState.core.bases[0].minions.some(minion => minion.uid === 'own-2')).toBe(false);
        expect(returned.finalState.core.players['0'].hand.some(card => card.uid === 'own-2')).toBe(true);
    });

    it('老水手随从面会选择另一个非老水手融合牌返回手牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_a', [
                makeMinion('shellback', 'gi_gerald_shellback', '0', 2),
                makeMinion('mowat', 'gi_gerald_mowat', '0', 2),
                makeMinion('other-shellback', 'gi_gerald_shellback', '0', 2),
                makeMinion('enemy-fusion', 'gi_gerald_rosie', '1', 2),
            ])],
        });

        const result = invokeRegisteredAbilityContract('gi_gerald_shellback', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'shellback',
            defId: 'gi_gerald_shellback',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 30,
        });

        const prompt = getSimpleChoicePrompt(result.matchState!, 'gi_gerald_shellback_minion');
        expect(prompt.options.some((option: any) => option.value?.minionUid === 'other-shellback')).toBe(false);
        expect(prompt.options.some((option: any) => option.value?.minionUid === 'enemy-fusion')).toBe(false);

        const returned = respondToPromptOption(
            result.matchState!,
            option => option.value?.minionUid === 'mowat',
            '老水手返回目标',
            '0',
            defaultTestRandom,
        );

        expect(returned.success, returned.error).toBe(true);
        expect(returned.finalState.core.bases[0].minions.some(minion => minion.uid === 'mowat')).toBe(false);
        expect(returned.finalState.core.players['0'].hand.some(card => card.uid === 'mowat')).toBe(true);
    });

    it('奥克天赋会选择无附着战术随从并限定额外战术目标', () => {
        const core = makeState({
            bases: [makeBase('base_a', [
                makeMinion('andko', 'rulers_cosmos_andko', '0', 3),
                makeMinion('empty-target', 'geckos_hokusai', '0', 2),
                makeMinion('with-action', 'geckos_monet', '0', 3, {
                    attachedActions: [{ uid: 'gear', defId: 'rulers_cosmos_magic_weapon', ownerId: '0' }],
                }),
            ])],
        });

        const result = invokeRegisteredAbilityContract('rulers_cosmos_andko', 'talent', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'andko',
            defId: 'rulers_cosmos_andko',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 40,
        });

        const prompt = getSimpleChoicePrompt(result.matchState!, 'rulers_cosmos_andko');
        expect(prompt.options.some((option: any) => option.value?.minionUid === 'with-action')).toBe(false);

        const granted = respondToPromptOption(
            result.matchState!,
            option => option.value?.minionUid === 'empty-target',
            '奥克额外战术目标',
            '0',
            defaultTestRandom,
        );

        expect(granted.success, granted.error).toBe(true);
        expect(granted.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.LIMIT_MODIFIED,
                payload: expect.objectContaining({
                    reason: 'rulers_cosmos_andko',
                    restrictToMinionUid: 'empty-target',
                }),
            }),
        ]));
    });

    it('魔法之剑可让宿主直到下回合开始不受其他玩家卡牌影响', () => {
        const core = makeState({
            bases: [makeBase('base_a', [
                makeMinion('hero', 'rulers_cosmos_andko', '0', 3, {
                    attachedActions: [{ uid: 'sword', defId: 'rulers_cosmos_powerful_sword', ownerId: '0' }],
                }),
            ])],
        });

        const result = invokeRegisteredAbilityContract('rulers_cosmos_powerful_sword', 'talent', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'sword',
            defId: 'rulers_cosmos_powerful_sword',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 50,
        });

        const protectedResult = respondToPromptOption(
            result.matchState!,
            option => option.value?.choice === 'protect',
            '魔法之剑保护分支',
            '0',
            defaultTestRandom,
        );

        expect(protectedResult.success, protectedResult.error).toBe(true);
        const protectedHero = protectedResult.finalState.core.bases[0].minions.find(minion => minion.uid === 'hero')!;
        expect(protectedHero.metadata?.tempProtectAffectUntilTurnNumber).toBe(2);
        expect(isMinionProtected(protectedResult.finalState.core, protectedHero, 0, '1', 'affect')).toBe(true);

        const expiredCore = { ...protectedResult.finalState.core, turnNumber: 3 };
        expect(isMinionProtected(expiredCore, protectedHero, 0, '1', 'affect')).toBe(false);
    });

    it('魔法之剑可把宿主上的另一张战术转移到己方另一个随从', () => {
        const core = makeState({
            bases: [makeBase('base_a', [
                makeMinion('hero', 'rulers_cosmos_andko', '0', 3, {
                    attachedActions: [
                        { uid: 'sword', defId: 'rulers_cosmos_powerful_sword', ownerId: '0' },
                        { uid: 'weapon', defId: 'rulers_cosmos_magic_weapon', ownerId: '0' },
                    ],
                }),
                makeMinion('friend', 'geckos_hokusai', '0', 2),
            ])],
        });

        const result = invokeRegisteredAbilityContract('rulers_cosmos_powerful_sword', 'talent', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'sword',
            defId: 'rulers_cosmos_powerful_sword',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 60,
        });

        const transferChoice = respondToPromptOption(
            result.matchState!,
            option => option.value?.choice === 'transfer',
            '魔法之剑转移分支',
            '0',
            defaultTestRandom,
        );
        expect(transferChoice.success, transferChoice.error).toBe(true);

        const sourcePrompt = getSimpleChoicePrompt(transferChoice.finalState, 'rulers_cosmos_powerful_sword_transfer_source');
        expect(sourcePrompt.options.some((option: any) => option.value?.cardUid === 'sword')).toBe(false);
        const pickedAction = respondToPromptOption(
            transferChoice.finalState,
            option => option.value?.cardUid === 'weapon',
            '魔法之剑被转移战术',
            '0',
            defaultTestRandom,
        );
        expect(pickedAction.success, pickedAction.error).toBe(true);

        const moved = respondToPromptOption(
            pickedAction.finalState,
            option => option.value?.minionUid === 'friend',
            '魔法之剑转移目的随从',
            '0',
            defaultTestRandom,
        );

        expect(moved.success, moved.error).toBe(true);
        expect(moved.finalState.core.bases[0].minions.find(minion => minion.uid === 'hero')?.attachedActions.map(action => action.uid)).toEqual(['sword']);
        expect(moved.finalState.core.bases[0].minions.find(minion => minion.uid === 'friend')?.attachedActions).toEqual([
            expect.objectContaining({ uid: 'weapon', defId: 'rulers_cosmos_magic_weapon' }),
        ]);
    });

    it('现在你知道：有毒废弃物 special 可转移己方随从上的战术', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('drawn-card', 'geckos_june', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_a', [
                makeMinion('hero', 'rulers_cosmos_andko', '0', 3, {
                    attachedActions: [{ uid: 'weapon', defId: 'rulers_cosmos_magic_weapon', ownerId: '0' }],
                }),
                makeMinion('friend', 'geckos_hokusai', '0', 2),
            ])],
        });

        const result = invokeRegisteredAbilityContract('rulers_cosmos_now_you_know_toxic_waste', 'special', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'toxic',
            defId: 'rulers_cosmos_now_you_know_toxic_waste',
            baseIndex: 0,
            targetBaseIndex: 0,
            random: defaultTestRandom,
            now: 70,
        });

        const pickedAction = respondToPromptOption(
            result.matchState!,
            option => option.value?.cardUid === 'weapon',
            '有毒废弃物转移来源战术',
            '0',
            defaultTestRandom,
        );
        expect(pickedAction.success, pickedAction.error).toBe(true);

        const moved = respondToPromptOption(
            pickedAction.finalState,
            option => option.value?.minionUid === 'friend',
            '有毒废弃物转移目的随从',
            '0',
            defaultTestRandom,
        );

        expect(moved.success, moved.error).toBe(true);
        expect(moved.finalState.core.bases[0].minions.find(minion => minion.uid === 'hero')?.attachedActions).toEqual([]);
        expect(moved.finalState.core.bases[0].minions.find(minion => minion.uid === 'friend')?.attachedActions).toEqual([
            expect.objectContaining({ uid: 'weapon', defId: 'rulers_cosmos_magic_weapon' }),
        ]);

        const followupPrompt = getSimpleChoicePrompt(moved.finalState, 'rulers_cosmos_toxic_waste_special_talent_followup');
        expect(followupPrompt.options.some((option: any) => option.value?.cardUid === 'weapon')).toBe(true);

        const usedWeaponTalent = respondToPromptOption(
            moved.finalState,
            option => option.value?.cardUid === 'weapon',
            '有毒废弃物后续使用魔法武器天赋',
            '0',
            defaultTestRandom,
        );
        expect(usedWeaponTalent.success, usedWeaponTalent.error).toBe(true);
        expect(usedWeaponTalent.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.TALENT_USED,
                payload: expect.objectContaining({
                    ongoingCardUid: 'weapon',
                    defId: 'rulers_cosmos_magic_weapon',
                }),
            }),
        ]));

        const drew = respondToPromptOption(
            usedWeaponTalent.finalState,
            option => option.value?.choice === 'draw',
            '魔法武器后续抓牌分支',
            '0',
            defaultTestRandom,
        );
        expect(drew.success, drew.error).toBe(true);
        expect(drew.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.CARDS_DRAWN,
                payload: expect.objectContaining({ playerId: '0', cardUids: ['drawn-card'] }),
            }),
        ]));
    });

    it('神秘转移可在宿主与另一个己方随从之间转移己方战术', () => {
        const core = makeState({
            bases: [makeBase('base_a', [
                makeMinion('host', 'rulers_cosmos_andko', '0', 3, {
                    attachedActions: [
                        { uid: 'mystic', defId: 'rulers_cosmos_mystic_transference', ownerId: '0' },
                        { uid: 'weapon', defId: 'rulers_cosmos_magic_weapon', ownerId: '0' },
                    ],
                }),
                makeMinion('friend', 'geckos_hokusai', '0', 2),
            ])],
        });

        const result = invokeRegisteredAbilityContract('rulers_cosmos_mystic_transference', 'talent', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'mystic',
            defId: 'rulers_cosmos_mystic_transference',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 80,
        });

        const pickedAction = respondToPromptOption(
            result.matchState!,
            option => option.value?.cardUid === 'weapon',
            '神秘转移来源战术',
            '0',
            defaultTestRandom,
        );
        expect(pickedAction.success, pickedAction.error).toBe(true);

        const moved = respondToPromptOption(
            pickedAction.finalState,
            option => option.value?.minionUid === 'friend',
            '神秘转移目的随从',
            '0',
            defaultTestRandom,
        );

        expect(moved.success, moved.error).toBe(true);
        expect(moved.finalState.core.bases[0].minions.find(minion => minion.uid === 'host')?.attachedActions.map(action => action.uid)).toEqual(['mystic']);
        expect(moved.finalState.core.bases[0].minions.find(minion => minion.uid === 'friend')?.attachedActions).toEqual([
            expect.objectContaining({ uid: 'weapon', defId: 'rulers_cosmos_magic_weapon' }),
        ]);
    });

    it('希曼可复制另一个己方随从的天赋并以自己作为来源结算', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { actionsPlayed: 2 }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_a', [
                makeMinion('guy', 'rulers_cosmos_guy_man', '0', 5),
                makeMinion('kandinsky', 'geckos_kandinsky', '0', 3),
            ])],
        });

        const result = invokeRegisteredAbilityContract('rulers_cosmos_guy_man', 'talent', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'guy',
            defId: 'rulers_cosmos_guy_man',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 85,
        });

        const copied = respondToPromptOption(
            result.matchState!,
            option => option.value?.minionUid === 'kandinsky',
            '希曼复制康定斯基天赋',
            '0',
            defaultTestRandom,
        );
        expect(copied.success, copied.error).toBe(true);

        const applied = respondToPromptOption(
            copied.finalState,
            option => option.value?.choice === 'temp',
            '复制后的康定斯基 +2 分支',
            '0',
            defaultTestRandom,
        );

        expect(applied.success, applied.error).toBe(true);
        expect(applied.finalState.core.bases[0].minions.find(minion => minion.uid === 'guy')?.tempPowerModifier).toBe(2);
        expect(applied.finalState.core.bases[0].minions.find(minion => minion.uid === 'kandinsky')?.tempPowerModifier ?? 0).toBe(0);
    });

    it('我们上，你们下会让其他玩家随从只按印刷战力计入该基地', () => {
        const core = makeState({
            bases: [makeBase('base_a', [
                makeMinion('topaz', 'pearl_images_topaz', '0', 3, { powerCounters: 2 }),
                makeMinion('enemy-buffed', 'test_enemy', '1', 4, {
                    powerCounters: 2,
                    powerModifier: 1,
                    tempPowerModifier: 1,
                }),
            ])],
        });

        const result = invokeRegisteredAbilityContract('pearl_images_were_up_youre_down', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'were-up',
            defId: 'pearl_images_were_up_youre_down',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 90,
        });

        const applied = respondToPromptOption(
            result.matchState!,
            option => option.value?.baseIndex === 0,
            '我们上，你们下目标基地',
            '0',
            defaultTestRandom,
        );

        expect(applied.success, applied.error).toBe(true);
        expect(applied.finalState.core.bases[0].metadata?.halfTheBattleWereUpYoureDown).toEqual(expect.objectContaining({
            sourcePlayerId: '0',
            expiresOnTurnNumber: 2,
            expiresOnPlayerId: '0',
        }));
        expect(getPlayerEffectivePowerOnBase(applied.finalState.core, applied.finalState.core.bases[0], 0, '1')).toBe(4);
        expect(getPlayerEffectivePowerOnBase(applied.finalState.core, applied.finalState.core.bases[0], 0, '0')).toBe(5);

        const expiredCore = { ...applied.finalState.core, turnNumber: 2, currentPlayerIndex: 0 };
        expect(getPlayerEffectivePowerOnBase(expiredCore, expiredCore.bases[0], 0, '1')).toBe(8);
    });

    it('傻瓜们！可连续转移己方随从上的任意数量战术并给接收者 +1 标记', () => {
        const core = makeState({
            bases: [makeBase('base_a', [
                makeMinion('source', 'rulers_cosmos_andko', '0', 3, {
                    attachedActions: [
                        { uid: 'weapon', defId: 'rulers_cosmos_magic_weapon', ownerId: '0' },
                        { uid: 'mystic', defId: 'rulers_cosmos_mystic_transference', ownerId: '0' },
                    ],
                }),
                makeMinion('receiver', 'rulers_cosmos_frogga', '0', 2),
            ])],
        });

        const result = invokeRegisteredAbilityContract('rulers_cosmos_dolts_halfwits_fools_morons', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'dolts',
            defId: 'rulers_cosmos_dolts_halfwits_fools_morons',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 100,
        });

        const pickedAction = respondToPromptOption(
            result.matchState!,
            option => option.value?.cardUid === 'weapon',
            '傻瓜们！来源战术',
            '0',
            defaultTestRandom,
        );
        expect(pickedAction.success, pickedAction.error).toBe(true);

        const moved = respondToPromptOption(
            pickedAction.finalState,
            option => option.value?.minionUid === 'receiver',
            '傻瓜们！目的随从',
            '0',
            defaultTestRandom,
        );

        expect(moved.success, moved.error).toBe(true);
        expect(moved.finalState.core.bases[0].minions.find(minion => minion.uid === 'source')?.attachedActions.map(action => action.uid)).toEqual(['mystic']);
        const receiver = moved.finalState.core.bases[0].minions.find(minion => minion.uid === 'receiver')!;
        expect(receiver.attachedActions).toEqual([expect.objectContaining({ uid: 'weapon', defId: 'rulers_cosmos_magic_weapon' })]);
        expect(receiver.powerCounters).toBe(1);

        const nextPrompt = getSimpleChoicePrompt(moved.finalState, 'rulers_cosmos_dolts_halfwits_fools_morons_transfer_source');
        expect(nextPrompt.options.some((option: any) => option.value?.cardUid === 'weapon')).toBe(false);
        expect(nextPrompt.options.some((option: any) => option.value?.cardUid === 'mystic')).toBe(true);

        const skipped = respondToPromptOption(
            moved.finalState,
            option => option.value?.skip,
            '傻瓜们！结束转移',
            '0',
            defaultTestRandom,
        );
        expect(skipped.success, skipped.error).toBe(true);
        expectNoPrompt(skipped.finalState);
    });

    it('爱普莉尔·奥尼尔会用印刷战力4随从与手牌/牌库随从交换', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('incoming', 'geckos_june', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_a', [
                makeMinion('source', 'geckos_hokusai', '0', 4),
            ])],
        });

        const result = invokeRegisteredAbilityContract('geckos_june', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'june-played',
            defId: 'geckos_june',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 111,
        });

        const swapped = respondToPromptOption(
            result.matchState!,
            option => option.value?.cardUid === 'incoming',
            '爱普莉尔交换入场随从',
            '0',
            defaultTestRandom,
        );

        expect(swapped.success, swapped.error).toBe(true);
        expect(swapped.events).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.MINION_SWAPPED }),
        ]));
        expect(swapped.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['incoming']);
        expect(swapped.finalState.core.players['0'].hand.some(card => card.uid === 'source')).toBe(true);
    });

    it('壁虎说唱非首张行动会交换随从并给新随从 +1 标记', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    actionsPlayed: 2,
                    discard: [makeCard('incoming', 'geckos_june', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_a', [
                makeMinion('source', 'geckos_hokusai', '0', 4),
            ])],
        });

        const result = invokeRegisteredAbilityContract('geckos_gecko_rap', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'rap',
            defId: 'geckos_gecko_rap',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 112,
        });

        const swapped = respondToPromptOption(
            result.matchState!,
            option => option.value?.cardUid === 'incoming',
            '壁虎说唱交换入场随从',
            '0',
            defaultTestRandom,
        );

        expect(swapped.success, swapped.error).toBe(true);
        const incoming = swapped.finalState.core.bases[0].minions.find(minion => minion.uid === 'incoming')!;
        expect(incoming.powerCounters).toBe(1);
        expect(swapped.finalState.core.players['0'].discard.some(card => card.uid === 'source')).toBe(true);
    });

    it('年轻的贵族有剑时会与战力5以上随从交换并弃置原附着战术', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('guy', 'rulers_cosmos_guy_man', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_a', [
                makeMinion('noble', 'rulers_cosmos_young_noble', '0', 2, {
                    attachedActions: [{ uid: 'sword', defId: 'rulers_cosmos_powerful_sword', ownerId: '0' }],
                }),
            ])],
        });

        const result = invokeRegisteredAbilityContract('rulers_cosmos_young_noble', 'talent', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'noble',
            defId: 'rulers_cosmos_young_noble',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 113,
        });

        const swapped = respondToPromptOption(
            result.matchState!,
            option => option.value?.cardUid === 'guy',
            '年轻的贵族交换入场随从',
            '0',
            defaultTestRandom,
        );

        expect(swapped.success, swapped.error).toBe(true);
        expect(swapped.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['guy']);
        expect(swapped.finalState.core.players['0'].hand.some(card => card.uid === 'noble')).toBe(true);
        expect(swapped.finalState.core.players['0'].discard.some(card => card.uid === 'sword')).toBe(true);
    });

    it('老水手行动面会复制另一个己方融合牌的战术能力', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('draw-1', 'geckos_june', 'minion', '0'),
                        makeCard('draw-2', 'geckos_june', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_a', [
                makeMinion('dice', 'gi_gerald_dice_ninja', '0', 2),
            ])],
        });

        const result = invokeRegisteredAbilityContract('gi_gerald_shellback', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'shellback-action',
            defId: 'gi_gerald_shellback',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 114,
        });

        const copied = respondToPromptOption(
            result.matchState!,
            option => option.value?.minionUid === 'dice',
            '老水手复制骰子忍者战术面',
            '0',
            defaultTestRandom,
        );

        expect(copied.success, copied.error).toBe(true);
        expect(copied.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.CARDS_DRAWN,
                payload: expect.objectContaining({ playerId: '0', cardUids: ['draw-1', 'draw-2'] }),
            }),
        ]));
    });

    it('现在你知道：家庭安全 special 会复制计分基地己方融合牌的战术能力', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('draw-1', 'geckos_june', 'minion', '0'),
                        makeCard('draw-2', 'geckos_june', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_a', [
                makeMinion('dice', 'gi_gerald_dice_ninja', '0', 2),
                makeMinion('enemy-dice', 'gi_gerald_dice_ninja', '1', 2),
            ])],
        });

        const result = invokeRegisteredAbilityContract('gi_gerald_now_you_know_home_safety', 'special', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'home-safety',
            defId: 'gi_gerald_now_you_know_home_safety',
            baseIndex: 0,
            targetBaseIndex: 0,
            random: defaultTestRandom,
            now: 115,
        });

        const prompt = getSimpleChoicePrompt(result.matchState!, 'gi_gerald_home_safety_special_copy');
        expect(prompt.options.some((option: any) => option.value?.minionUid === 'enemy-dice')).toBe(false);

        const copied = respondToPromptOption(
            result.matchState!,
            option => option.value?.minionUid === 'dice',
            '家庭安全复制骰子忍者战术面',
            '0',
            defaultTestRandom,
        );

        expect(copied.success, copied.error).toBe(true);
        expect(copied.events).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.CARDS_DRAWN }),
        ]));
    });

    it('希瑞会从任意玩家弃牌堆把打在随从上的战术临时贴到目标上并在回合结束置底', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1', {
                    discard: [makeCard('weapon', 'rulers_cosmos_magic_weapon', 'action', '1')],
                }),
            },
            bases: [makeBase('base_a', [
                makeMinion('gal', 'rulers_cosmos_gal_woman', '0', 5),
                makeMinion('target', 'geckos_hokusai', '0', 4),
            ])],
        });

        const result = invokeRegisteredAbilityContract('rulers_cosmos_gal_woman', 'talent', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'gal',
            defId: 'rulers_cosmos_gal_woman',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 116,
        });

        const pickedAction = respondToPromptOption(
            result.matchState!,
            option => option.value?.cardUid === 'weapon',
            '希瑞选择弃牌堆战术',
            '0',
            defaultTestRandom,
        );
        expect(pickedAction.success, pickedAction.error).toBe(true);

        const attached = respondToPromptOption(
            pickedAction.finalState,
            option => option.value?.minionUid === 'target',
            '希瑞选择附着目标',
            '0',
            defaultTestRandom,
        );

        expect(attached.success, attached.error).toBe(true);
        const target = attached.finalState.core.bases[0].minions.find(minion => minion.uid === 'target')!;
        expect(target.attachedActions).toEqual([
            expect.objectContaining({
                uid: 'weapon',
                ownerId: '1',
                metadata: expect.objectContaining({ halfTheBattleGalWomanTemporary: true }),
            }),
        ]);
        expect(attached.finalState.core.players['1'].discard).toEqual([]);

        const ended = reduce(attached.finalState.core, {
            type: SU_EVENTS.TURN_ENDED,
            payload: { playerId: '0', nextPlayerIndex: 1 },
            timestamp: 117,
        } as any);
        expect(ended.bases[0].minions.find(minion => minion.uid === 'target')?.attachedActions).toEqual([]);
        expect(ended.players['1'].deck.at(-1)).toEqual(expect.objectContaining({ uid: 'weapon' }));
    });

    it('希瑞临时贴上的战术提前离场时也会置于所有者牌库底', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_a', [
                makeMinion('target', 'geckos_hokusai', '0', 4, {
                    attachedActions: [{
                        uid: 'weapon',
                        defId: 'rulers_cosmos_magic_weapon',
                        ownerId: '1',
                        metadata: {
                            halfTheBattleGalWomanTemporary: true,
                            halfTheBattleGalWomanControllerId: '0',
                        },
                    }],
                }),
            ])],
        });

        const detached = reduce(core, {
            type: SU_EVENTS.ONGOING_DETACHED,
            payload: {
                cardUid: 'weapon',
                defId: 'rulers_cosmos_magic_weapon',
                ownerId: '1',
                reason: 'test_detach',
            },
            timestamp: 118,
        } as any);

        expect(detached.bases[0].minions.find(minion => minion.uid === 'target')?.attachedActions).toEqual([]);
        expect(detached.players['1'].discard).toEqual([]);
        expect(detached.players['1'].deck.at(-1)).toEqual(expect.objectContaining({ uid: 'weapon' }));
    });

    it('玩乐一整夜会让被选玩家在该基地打战力≤2随从，选别人成功后可奖励自己', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('reward', 'geckos_june', 'minion', '0')],
                }),
                '1': makePlayer('1', {
                    hand: [makeCard('guest', 'geckos_june', 'minion', '1')],
                }),
            },
            bases: [makeBase({
                defId: 'base_a',
                minions: [makeMinion('pearl', 'pearl_images_pearl', '0', 5)],
                ongoingActions: [{ uid: 'jam', defId: 'pearl_images_jam_all_night_long', ownerId: '0' }],
            })],
        });

        const result = invokeRegisteredAbilityContract('pearl_images_jam_all_night_long', 'talent', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'jam',
            defId: 'pearl_images_jam_all_night_long',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 118,
        });

        const pickedPlayer = respondToPromptOption(
            result.matchState!,
            option => option.value?.playerId === '1',
            '玩乐一整夜选择其他玩家',
            '0',
            defaultTestRandom,
        );
        expect(pickedPlayer.success, pickedPlayer.error).toBe(true);

        const played = respondToPromptOption(
            pickedPlayer.finalState,
            option => option.value?.cardUid === 'guest',
            '玩乐一整夜被选玩家打出随从',
            '1',
            defaultTestRandom,
        );

        expect(played.success, played.error).toBe(true);
        expect(played.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.MINION_PLAYED,
                payload: expect.objectContaining({ playerId: '1', cardUid: 'guest', baseIndex: 0, consumesNormalLimit: false }),
            }),
        ]));
        expect(played.finalState.core.bases[0].minions.some(minion => minion.uid === 'guest')).toBe(true);

        const rewarded = respondToPromptOption(
            played.finalState,
            option => option.value?.choice === 'draw',
            '玩乐一整夜奖励抓牌',
            '0',
            defaultTestRandom,
        );
        expect(rewarded.success, rewarded.error).toBe(true);
        expect(rewarded.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.CARDS_DRAWN,
                payload: expect.objectContaining({ playerId: '0', cardUids: ['reward'] }),
            }),
        ]));
    });
    it('粘液池可替代常规战术从牌库顶将打在随从上的战术贴到这里的随从', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('weapon', 'rulers_cosmos_magic_weapon', 'action', '0'),
                    ],
                    actionsPlayed: 0,
                    actionLimit: 1,
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_slime_pool', [
                makeMinion('target', 'rulers_cosmos_frogga', '0', 2),
            ])],
        });

        const initial = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.USE_BASE_ABILITY,
            playerId: '0',
            payload: { baseIndex: 0 },
        } as any, defaultTestRandom);

        expect(initial.success, initial.error).toBe(true);
        const prompt = getSimpleChoicePrompt(initial.finalState, 'base_slime_pool');
        expect(prompt.options.some((option: any) => option.value?.minionUid === 'target')).toBe(true);

        const resolved = respondToPromptOption(
            initial.finalState,
            option => option.value?.minionUid === 'target',
            '粘液池目标随从',
            '0',
            defaultTestRandom,
        );

        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.ACTION_PLAYED,
                payload: expect.objectContaining({
                    playerId: '0',
                    cardUid: 'weapon',
                    defId: 'rulers_cosmos_magic_weapon',
                    targetType: 'minion',
                    targetMinionUid: 'target',
                }),
            }),
            expect.objectContaining({
                type: SU_EVENTS.ONGOING_ATTACHED,
                payload: expect.objectContaining({
                    cardUid: 'weapon',
                    targetType: 'minion',
                    targetMinionUid: 'target',
                }),
            }),
        ]));
        expect(resolved.finalState.core.players['0'].deck).toEqual([]);
        expect(resolved.finalState.core.players['0'].actionsPlayed).toBe(1);
        expect(resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'target')?.attachedActions).toEqual([
            expect.objectContaining({ uid: 'weapon', defId: 'rulers_cosmos_magic_weapon' }),
        ]);
    });

    it('忍者神龟随从与检索链覆盖北斋、康定斯基、莫奈、梵高', () => {
        const baseCore = makeState({
            players: {
                '0': makePlayer('0', {
                    actionsPlayed: 2,
                    deck: [makeCard('draw-1', 'geckos_june', 'minion', '0')],
                    discard: [
                        makeCard('discard-action', 'geckos_flip_kick', 'action', '0'),
                        makeCard('discard-minion', 'geckos_june', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_a', [
                    makeMinion('hokusai', 'geckos_hokusai', '0', 4),
                    makeMinion('ally-a', 'geckos_june', '0', 2),
                    makeMinion('kandinsky', 'geckos_kandinsky', '0', 4),
                ]),
                makeBase('base_b', [makeMinion('ally-b', 'geckos_june', '0', 2)]),
            ],
        });

        const hokusai = invokeRegisteredAbilityContract('geckos_hokusai', 'onPlay', {
            state: baseCore,
            matchState: makeMatchState(baseCore),
            playerId: '0',
            cardUid: 'hokusai',
            defId: 'geckos_hokusai',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 119,
        });
        const hokusaiResolved = respondToPromptOption(
            hokusai.matchState!,
            option => option.value?.minionUid === 'ally-a',
            '北斋 +1 目标',
            '0',
            defaultTestRandom,
        );
        expect(hokusaiResolved.success, hokusaiResolved.error).toBe(true);
        expect(hokusaiResolved.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.POWER_COUNTER_ADDED,
                payload: expect.objectContaining({ minionUid: 'ally-a', amount: 1 }),
            }),
        ]));

        const hokusaiTalent = invokeRegisteredAbilityContract('geckos_hokusai', 'talent', {
            state: baseCore,
            matchState: makeMatchState(baseCore),
            playerId: '0',
            cardUid: 'hokusai',
            defId: 'geckos_hokusai',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 120,
        });
        const talentPrompt = getSimpleChoicePrompt(hokusaiTalent.matchState!, 'geckos_hokusai_talent');
        const talentOptionIds = ['ally-a', 'ally-b'].map(uid =>
            getPromptOption(talentPrompt, option => option.value?.minionUid === uid, `北斋天赋目标 ${uid}`).id);
        const talentResolved = respondToPromptOptions(hokusaiTalent.matchState!, talentOptionIds, '0', defaultTestRandom);
        expect(talentResolved.success, talentResolved.error).toBe(true);
        expect(talentResolved.events.filter(event => event.type === SU_EVENTS.POWER_COUNTER_ADDED)).toHaveLength(2);

        const kandinsky = invokeRegisteredAbilityContract('geckos_kandinsky', 'onPlay', {
            state: baseCore,
            matchState: makeMatchState(baseCore),
            playerId: '0',
            cardUid: 'kandinsky',
            defId: 'geckos_kandinsky',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 121,
        });
        expect(kandinsky.events).toEqual([expect.objectContaining({
            type: SU_EVENTS.TEMP_POWER_ADDED,
            payload: expect.objectContaining({ minionUid: 'kandinsky', amount: 1 }),
        })]);

        const kandinskyTalent = invokeRegisteredAbilityContract('geckos_kandinsky', 'talent', {
            state: baseCore,
            matchState: makeMatchState(baseCore),
            playerId: '0',
            cardUid: 'kandinsky',
            defId: 'geckos_kandinsky',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 122,
        });
        const pickedMove = respondToPromptOption(
            kandinskyTalent.matchState!,
            option => option.value?.choice === 'move',
            '康定斯基移动分支',
            '0',
            defaultTestRandom,
        );
        expect(pickedMove.success, pickedMove.error).toBe(true);
        const movedByTalent = respondToPromptOption(
            pickedMove.finalState,
            option => option.value?.minionUid === 'ally-b',
            '康定斯基移动目标',
            '0',
            defaultTestRandom,
        );
        expect(movedByTalent.success, movedByTalent.error).toBe(true);
        expect(movedByTalent.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.MINION_MOVED,
                payload: expect.objectContaining({ minionUid: 'ally-b', fromBaseIndex: 1, toBaseIndex: 0 }),
            }),
        ]));

        const monet = invokeRegisteredAbilityContract('geckos_monet', 'onPlay', {
            state: baseCore,
            matchState: makeMatchState(baseCore),
            playerId: '0',
            cardUid: 'monet',
            defId: 'geckos_monet',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 123,
        });
        expect(monet.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.CARDS_DRAWN,
                payload: expect.objectContaining({ playerId: '0', cardUids: ['draw-1'] }),
            }),
        ]));

        const vanGogh = invokeRegisteredAbilityContract('geckos_van_gogh', 'onPlay', {
            state: baseCore,
            matchState: makeMatchState(baseCore),
            playerId: '0',
            cardUid: 'van-gogh',
            defId: 'geckos_van_gogh',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 124,
        });
        const vanGoghPrompt = getSimpleChoicePrompt(vanGogh.matchState!, 'geckos_van_gogh');
        expect(vanGoghPrompt.options.some((option: any) => option.value?.cardUid === 'discard-minion')).toBe(false);
        const shuffled = respondToPromptOption(
            vanGogh.matchState!,
            option => option.value?.cardUid === 'discard-action',
            '梵高标准战术',
            '0',
            defaultTestRandom,
        );
        expect(shuffled.success, shuffled.error).toBe(true);
        expect(shuffled.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.DECK_REORDERED,
                payload: expect.objectContaining({ playerId: '0', deckUids: ['discard-action', 'draw-1'] }),
            }),
        ]));
    });

    it('忍者神龟标准战术、持续战术和基地能力覆盖额外战术族', () => {
        const newsCore = makeState({
            players: {
                '0': makePlayer('0', {
                    actionsPlayed: 1,
                    deck: [
                        makeCard('news-1', 'geckos_june', 'minion', '0'),
                        makeCard('news-2', 'geckos_monet', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });
        const breakingNews = invokeRegisteredAbilityContract('geckos_breaking_news', 'onPlay', {
            state: newsCore,
            matchState: makeMatchState(newsCore),
            playerId: '0',
            cardUid: 'breaking-news',
            defId: 'geckos_breaking_news',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 125,
        });
        expect(breakingNews.events).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.DECK_INSPECTED }),
            expect.objectContaining({ type: SU_EVENTS.REVEAL_DECK_TOP }),
            expect.objectContaining({
                type: SU_EVENTS.LIMIT_MODIFIED,
                payload: expect.objectContaining({ reason: 'geckos_breaking_news' }),
            }),
        ]));
        const newsDrawn = respondToPromptOption(
            breakingNews.matchState!,
            option => option.value?.cardUid === 'news-2',
            '爆炸新闻抓取牌',
            '0',
            defaultTestRandom,
        );
        expect(newsDrawn.success, newsDrawn.error).toBe(true);
        expect(newsDrawn.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.CARDS_DRAWN,
                payload: expect.objectContaining({ cardUids: ['news-2'] }),
            }),
        ]));

        const firstKick = invokeRegisteredAbilityContract('geckos_flip_kick', 'onPlay', {
            state: newsCore,
            matchState: makeMatchState(newsCore),
            playerId: '0',
            cardUid: 'flip-kick',
            defId: 'geckos_flip_kick',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 126,
        });
        expect(firstKick.events).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.CARDS_DRAWN, payload: expect.objectContaining({ count: 1 }) }),
            expect.objectContaining({ type: SU_EVENTS.LIMIT_MODIFIED, payload: expect.objectContaining({ reason: 'geckos_flip_kick' }) }),
        ]));

        const lateKickCore = makeState({
            players: {
                '0': makePlayer('0', {
                    actionsPlayed: 2,
                    deck: [
                        makeCard('late-1', 'geckos_june', 'minion', '0'),
                        makeCard('late-2', 'geckos_june', 'minion', '0'),
                        makeCard('late-3', 'geckos_june', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });
        const lateKick = invokeRegisteredAbilityContract('geckos_flip_kick', 'onPlay', {
            state: lateKickCore,
            matchState: makeMatchState(lateKickCore),
            playerId: '0',
            cardUid: 'late-flip',
            defId: 'geckos_flip_kick',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 127,
        });
        expect(lateKick.events).toEqual([expect.objectContaining({
            type: SU_EVENTS.CARDS_DRAWN,
            payload: expect.objectContaining({ count: 3, cardUids: ['late-1', 'late-2', 'late-3'] }),
        })]);

        const moveCore = makeState({
            players: {
                '0': makePlayer('0', { actionsPlayed: 1 }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_a', [makeMinion('blimp-target', 'geckos_june', '0', 2)]),
                makeBase('base_b', [makeMinion('other-own', 'geckos_monet', '0', 4)]),
            ],
        });
        const blimp = invokeRegisteredAbilityContract('geckos_gecko_blimp', 'onPlay', {
            state: moveCore,
            matchState: makeMatchState(moveCore),
            playerId: '0',
            cardUid: 'blimp',
            defId: 'geckos_gecko_blimp',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 128,
        });
        expect(blimp.events).toEqual([expect.objectContaining({
            type: SU_EVENTS.LIMIT_MODIFIED,
            payload: expect.objectContaining({ reason: 'geckos_gecko_blimp' }),
        })]);
        const choseBlimpTarget = respondToPromptOption(
            blimp.matchState!,
            option => option.value?.minionUid === 'blimp-target',
            '壁虎飞艇移动随从',
            '0',
            defaultTestRandom,
        );
        expect(choseBlimpTarget.success, choseBlimpTarget.error).toBe(true);
        const blimpMoved = respondToPromptOption(
            choseBlimpTarget.finalState,
            option => option.value?.baseIndex === 1,
            '壁虎飞艇目标基地',
            '0',
            defaultTestRandom,
        );
        expect(blimpMoved.success, blimpMoved.error).toBe(true);
        expect(blimpMoved.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.MINION_MOVED,
                payload: expect.objectContaining({ minionUid: 'blimp-target', toBaseIndex: 1 }),
            }),
        ]));

        const geckoPowerCore = makeState({
            players: { '0': makePlayer('0', { actionsPlayed: 2 }), '1': makePlayer('1') },
            bases: [makeBase('base_a', [
                makeMinion('power-host', 'geckos_june', '0', 2, {
                    attachedActions: [{ uid: 'gecko-power', defId: 'geckos_gecko_power', ownerId: '0' }],
                }),
            ])],
        });
        const geckoPower = invokeRegisteredAbilityContract('geckos_gecko_power', 'talent', {
            state: geckoPowerCore,
            matchState: makeMatchState(geckoPowerCore),
            playerId: '0',
            cardUid: 'gecko-power',
            defId: 'geckos_gecko_power',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 129,
        });
        const powerCounter = respondToPromptOption(
            geckoPower.matchState!,
            option => option.value?.choice === 'counter',
            '壁虎力量 +1 分支',
            '0',
            defaultTestRandom,
        );
        expect(powerCounter.success, powerCounter.error).toBe(true);
        expect(powerCounter.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.POWER_COUNTER_ADDED,
                payload: expect.objectContaining({ minionUid: 'power-host', amount: 1 }),
            }),
        ]));

        const lasagnaCore = makeState({
            players: { '0': makePlayer('0', { actionsPlayed: 2 }), '1': makePlayer('1') },
            bases: [makeBase('base_a', [makeMinion('lasagna-target', 'geckos_june', '0', 2)])],
        });
        const lasagna = invokeRegisteredAbilityContract('geckos_lasagna_party', 'onPlay', {
            state: lasagnaCore,
            matchState: makeMatchState(lasagnaCore),
            playerId: '0',
            cardUid: 'lasagna',
            defId: 'geckos_lasagna_party',
            baseIndex: 0,
            targetBaseIndex: 0,
            random: defaultTestRandom,
            now: 130,
        });
        expect(lasagna.events).toEqual([expect.objectContaining({
            type: SU_EVENTS.LIMIT_MODIFIED,
            payload: expect.objectContaining({ reason: 'geckos_lasagna_party', powerMax: 2 }),
        })]);
        const lasagnaResolved = respondToPromptOption(
            lasagna.matchState!,
            option => option.value?.minionUid === 'lasagna-target',
            '千层饼派对 +2 目标',
            '0',
            defaultTestRandom,
        );
        expect(lasagnaResolved.success, lasagnaResolved.error).toBe(true);
        expect(lasagnaResolved.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.POWER_COUNTER_ADDED,
                payload: expect.objectContaining({ minionUid: 'lasagna-target', amount: 2 }),
            }),
        ]));

        const kc = invokeRegisteredAbilityContract('geckos_kc_smith', 'onPlay', {
            state: lasagnaCore,
            matchState: makeMatchState(lasagnaCore),
            playerId: '0',
            cardUid: 'kc',
            defId: 'geckos_kc_smith',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 131,
        });
        expect(kc.events).toEqual([expect.objectContaining({
            type: SU_EVENTS.LIMIT_MODIFIED,
            payload: expect.objectContaining({ reason: 'geckos_kc_smith' }),
        })]);

        const sewer = triggerBaseAbilityWithMS('base_sewer_hideout', 'onActionPlayed', {
            state: lasagnaCore,
            baseIndex: 0,
            baseDefId: 'base_sewer_hideout',
            playerId: '0',
            now: 132,
            random: defaultTestRandom,
        });
        const sewerResolved = respondToPromptOption(
            sewer.matchState!,
            option => option.value?.minionUid === 'lasagna-target',
            '下水道隐蔽处 +1 目标',
            '0',
            defaultTestRandom,
        );
        expect(sewerResolved.success, sewerResolved.error).toBe(true);
        expect(sewerResolved.events).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.POWER_COUNTER_ADDED }),
        ]));

        const technoball = triggerBaseAbilityWithMS('base_technoball', 'onMinionPlayed', {
            state: lasagnaCore,
            baseIndex: 0,
            baseDefId: 'base_technoball',
            playerId: '0',
            minionUid: 'lasagna-target',
            minionDefId: 'geckos_june',
            now: 133,
            random: defaultTestRandom,
        });
        const technoballResolved = respondToPromptOption(
            technoball.matchState!,
            option => option.value?.choice === 'apply',
            '科技球额外战术',
            '0',
            defaultTestRandom,
        );
        expect(technoballResolved.success, technoballResolved.error).toBe(true);
        expect(technoballResolved.events).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.BASE_ABILITY_USED }),
            expect.objectContaining({
                type: SU_EVENTS.LIMIT_MODIFIED,
                payload: expect.objectContaining({ reason: 'base_technoball' }),
            }),
        ]));
    });

    it('忍者神龟剩余分支覆盖爱普莉尔 fallback、壁虎说唱首张、大师教学和校园暴力移动', () => {
        const noSwapCore = makeState({
            players: {
                '0': makePlayer('0', { deck: [makeCard('fallback-draw', 'geckos_june', 'minion', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_a', [makeMinion('small-own', 'geckos_june', '0', 2)])],
        });
        const juneFallback = invokeRegisteredAbilityContract('geckos_june', 'onPlay', {
            state: noSwapCore,
            matchState: makeMatchState(noSwapCore),
            playerId: '0',
            cardUid: 'june-played',
            defId: 'geckos_june',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 170,
        });
        expect(juneFallback.events).toEqual([expect.objectContaining({
            type: SU_EVENTS.CARDS_DRAWN,
            payload: expect.objectContaining({ cardUids: ['fallback-draw'] }),
        })]);

        const firstRap = invokeRegisteredAbilityContract('geckos_gecko_rap', 'onPlay', {
            state: makeState({ players: { '0': makePlayer('0', { actionsPlayed: 1 }), '1': makePlayer('1') }, bases: [makeBase('base_a', [])] }),
            matchState: makeMatchState(makeState({ players: { '0': makePlayer('0', { actionsPlayed: 1 }), '1': makePlayer('1') }, bases: [makeBase('base_a', [])] })),
            playerId: '0',
            cardUid: 'rap-first',
            defId: 'geckos_gecko_rap',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 171,
        });
        expect(firstRap.events).toEqual([expect.objectContaining({
            type: SU_EVENTS.LIMIT_MODIFIED,
            payload: expect.objectContaining({ reason: 'geckos_gecko_rap' }),
        })]);

        const moveCore = makeState({
            players: { '0': makePlayer('0'), '1': makePlayer('1') },
            bases: [
                makeBase('base_a', [makeMinion('bullying-target', 'geckos_june', '0', 2)]),
                makeBase('base_b', []),
            ],
        });
        const bullying = invokeRegisteredAbilityContract('geckos_now_you_know_bullying', 'onPlay', {
            state: moveCore,
            matchState: makeMatchState(moveCore),
            playerId: '0',
            cardUid: 'bullying-action',
            defId: 'geckos_now_you_know_bullying',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 172,
        });
        const bullyingPicked = respondToPromptOption(
            bullying.matchState!,
            option => option.value?.minionUid === 'bullying-target',
            '校园暴力移动随从',
            '0',
            defaultTestRandom,
        );
        expect(bullyingPicked.success, bullyingPicked.error).toBe(true);
        const bullyingMoved = respondToPromptOption(
            bullyingPicked.finalState,
            option => option.value?.baseIndex === 1,
            '校园暴力目标基地',
            '0',
            defaultTestRandom,
        );
        expect(bullyingMoved.success, bullyingMoved.error).toBe(true);
        expect(bullyingMoved.events).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.MINION_MOVED, payload: expect.objectContaining({ minionUid: 'bullying-target', toBaseIndex: 1 }) }),
        ]));

        const mastersCore = makeState({
            players: { '0': makePlayer('0', { actionsPlayed: 2 }), '1': makePlayer('1') },
            bases: [makeBase('base_a', [makeMinion('masters-target', 'geckos_june', '0', 2)])],
        });
        const masters = invokeRegisteredAbilityContract('geckos_masters_teachings', 'onPlay', {
            state: mastersCore,
            matchState: makeMatchState(mastersCore),
            playerId: '0',
            cardUid: 'masters',
            defId: 'geckos_masters_teachings',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 173,
        });
        const mastersCounter = respondToPromptOption(
            masters.matchState!,
            option => option.value?.minionUid === 'masters-target',
            '大师的教学 +2 标记',
            '0',
            defaultTestRandom,
        );
        expect(mastersCounter.success, mastersCounter.error).toBe(true);
        expect(mastersCounter.events).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.POWER_COUNTER_ADDED, payload: expect.objectContaining({ minionUid: 'masters-target', amount: 2 }) }),
        ]));
        const mastersTemp = respondToPromptOption(
            mastersCounter.finalState,
            option => option.value?.choice === 'apply',
            '大师的教学临时 +2',
            '0',
            defaultTestRandom,
        );
        expect(mastersTemp.success, mastersTemp.error).toBe(true);
        expect(mastersTemp.events).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.TEMP_POWER_ADDED, payload: expect.objectContaining({ minionUid: 'masters-target', amount: 2 }) }),
        ]));
    });

    it('特种部队杰拉尔德融合牌两面能力覆盖移动、洗回、额外出牌和指示物', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('hand-low', 'geckos_june', 'minion', '0')],
                    deck: [
                        makeCard('draw-1', 'geckos_june', 'minion', '0'),
                        makeCard('draw-2', 'geckos_june', 'minion', '0'),
                    ],
                    discard: [
                        makeCard('discard-action-a', 'geckos_flip_kick', 'action', '0'),
                        makeCard('discard-action-b', 'geckos_gecko_blimp', 'action', '0'),
                        makeCard('discard-minion-a', 'geckos_june', 'minion', '0'),
                        makeCard('discard-minion-b', 'rulers_cosmos_frogga', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_a', [
                    makeMinion('mowat', 'gi_gerald_mowat', '0', 2),
                    makeMinion('obstruction', 'gi_gerald_obstruction', '0', 2),
                    makeMinion('sawbones', 'gi_gerald_sawbones', '0', 2),
                    makeMinion('ski', 'gi_gerald_ski_lift', '0', 2),
                    makeMinion('can-do', 'gi_gerald_can_do', '0', 4),
                    makeMinion('mabel', 'gi_gerald_mabel_lean', '0', 2),
                    makeMinion('dice', 'gi_gerald_dice_ninja', '0', 2),
                    makeMinion('rosie', 'gi_gerald_rosie', '0', 2),
                    makeMinion('ally', 'geckos_june', '0', 2),
                ]),
                makeBase('base_b', [makeMinion('remote-own', 'geckos_june', '0', 2)]),
            ],
        });

        const mowatMinion = invokeRegisteredAbilityContract('gi_gerald_mowat', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'mowat',
            defId: 'gi_gerald_mowat',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 134,
        });
        const mowatResolved = respondToPromptOption(
            mowatMinion.matchState!,
            option => option.value?.minionUid === 'ally',
            '卡车式火炮随从面目标',
            '0',
            defaultTestRandom,
        );
        expect(mowatResolved.success, mowatResolved.error).toBe(true);
        expect(mowatResolved.events).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.TEMP_POWER_ADDED, payload: expect.objectContaining({ amount: 1 }) }),
        ]));

        const mowatActionCore = makeState({ bases: [makeBase('base_a', [makeMinion('target', 'geckos_june', '0', 2)])] });
        const mowatAction = invokeRegisteredAbilityContract('gi_gerald_mowat', 'onPlay', {
            state: mowatActionCore,
            matchState: makeMatchState(mowatActionCore),
            playerId: '0',
            cardUid: 'mowat-action',
            defId: 'gi_gerald_mowat',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 135,
        });
        expect(mowatAction.events).toEqual([expect.objectContaining({
            type: SU_EVENTS.TEMP_POWER_ADDED,
            payload: expect.objectContaining({ minionUid: 'target', amount: 3 }),
        })]);

        const obstruction = invokeRegisteredAbilityContract('gi_gerald_obstruction', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'obstruction',
            defId: 'gi_gerald_obstruction',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 136,
        });
        expect(obstruction.events.filter(event => event.type === SU_EVENTS.TEMP_POWER_ADDED)).toHaveLength(9);

        const sawbonesMinion = invokeRegisteredAbilityContract('gi_gerald_sawbones', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'sawbones',
            defId: 'gi_gerald_sawbones',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 137,
        });
        const actionShuffled = respondToPromptOption(
            sawbonesMinion.matchState!,
            option => option.value?.cardUid === 'discard-action-a',
            '外科医生随从面战术',
            '0',
            defaultTestRandom,
        );
        expect(actionShuffled.success, actionShuffled.error).toBe(true);
        expect(actionShuffled.events).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.DECK_REORDERED }),
        ]));

        const sawbonesAction = invokeRegisteredAbilityContract('gi_gerald_sawbones', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'sawbones-action',
            defId: 'gi_gerald_sawbones',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 138,
        });
        const minionShuffled = respondToPromptOption(
            sawbonesAction.matchState!,
            option => option.value?.cardUid === 'discard-minion-b',
            '外科医生行动面随从',
            '0',
            defaultTestRandom,
        );
        expect(minionShuffled.success, minionShuffled.error).toBe(true);
        expect(minionShuffled.events).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.DECK_REORDERED }),
        ]));

        const ski = invokeRegisteredAbilityContract('gi_gerald_ski_lift', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'ski',
            defId: 'gi_gerald_ski_lift',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 139,
        });
        const skiResolved = respondToPromptOption(
            ski.matchState!,
            option => option.value?.minionUid === 'remote-own',
            '滑雪缆车随从面移动目标',
            '0',
            defaultTestRandom,
        );
        expect(skiResolved.success, skiResolved.error).toBe(true);
        expect(skiResolved.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.MINION_MOVED,
                payload: expect.objectContaining({ minionUid: 'remote-own', fromBaseIndex: 1, toBaseIndex: 0 }),
            }),
        ]));

        const canDoMinion = invokeRegisteredAbilityContract('gi_gerald_can_do', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'can-do',
            defId: 'gi_gerald_can_do',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 140,
        });
        const canDoActionBranch = respondToPromptOption(
            canDoMinion.matchState!,
            option => option.value?.choice === 'action',
            '偏激者随从面额外战术',
            '0',
            defaultTestRandom,
        );
        expect(canDoActionBranch.success, canDoActionBranch.error).toBe(true);
        expect(canDoActionBranch.events).toEqual(expect.arrayContaining([expect.objectContaining({
            type: SU_EVENTS.LIMIT_MODIFIED,
            payload: expect.objectContaining({ reason: 'gi_gerald_can_do_minion' }),
        })]));

        const canDoAction = invokeRegisteredAbilityContract('gi_gerald_can_do', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'can-do-action',
            defId: 'gi_gerald_can_do',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 141,
        });
        expect(canDoAction.events).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.LIMIT_MODIFIED, payload: expect.objectContaining({ powerMax: 2 }) }),
            expect.objectContaining({ type: SU_EVENTS.LIMIT_MODIFIED, payload: expect.objectContaining({ reason: 'gi_gerald_can_do' }) }),
        ]));

        const mabel = invokeRegisteredAbilityContract('gi_gerald_mabel_lean', 'onPlay', {
            state: makeState({ bases: [makeBase('base_a', [makeMinion('mabel', 'gi_gerald_mabel_lean', '0', 2)])] }),
            matchState: makeMatchState(makeState({ bases: [makeBase('base_a', [makeMinion('mabel', 'gi_gerald_mabel_lean', '0', 2)])] })),
            playerId: '0',
            cardUid: 'mabel',
            defId: 'gi_gerald_mabel_lean',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 142,
        });
        const mabelResolved = respondToPromptOption(
            mabel.matchState!,
            option => option.value?.minionUid === 'mabel',
            '封面女郎自身 +1',
            '0',
            defaultTestRandom,
        );
        expect(mabelResolved.success, mabelResolved.error).toBe(true);
        expect(mabelResolved.events).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.POWER_COUNTER_ADDED }),
        ]));

        const diceMinion = invokeRegisteredAbilityContract('gi_gerald_dice_ninja', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'dice',
            defId: 'gi_gerald_dice_ninja',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 143,
        });
        expect(diceMinion.events).toEqual([expect.objectContaining({
            type: SU_EVENTS.CARDS_DRAWN,
            payload: expect.objectContaining({ count: 1 }),
        })]);
        const diceAction = invokeRegisteredAbilityContract('gi_gerald_dice_ninja', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'dice-action',
            defId: 'gi_gerald_dice_ninja',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 144,
        });
        expect(diceAction.events).toEqual([expect.objectContaining({
            type: SU_EVENTS.CARDS_DRAWN,
            payload: expect.objectContaining({ count: 2 }),
        })]);

        const rosie = invokeRegisteredAbilityContract('gi_gerald_rosie', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'rosie',
            defId: 'gi_gerald_rosie',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 145,
        });
        const rosieResolved = respondToPromptOption(
            rosie.matchState!,
            option => option.value?.minionUid === 'ally',
            '罗西随从面 +1 目标',
            '0',
            defaultTestRandom,
        );
        expect(rosieResolved.success, rosieResolved.error).toBe(true);
        expect(rosieResolved.events).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.POWER_COUNTER_ADDED }),
        ]));
    });

    it('特种部队杰拉尔德剩余行动面覆盖家庭安全、滑雪缆车、封面女郎和罗西', () => {
        const core = makeState({
            players: { '0': makePlayer('0'), '1': makePlayer('1') },
            bases: [
                makeBase('base_a', [
                    makeMinion('own-a', 'geckos_june', '0', 2),
                    makeMinion('own-b', 'rulers_cosmos_frogga', '0', 2),
                    makeMinion('enemy', 'geckos_june', '1', 2),
                ]),
                makeBase('base_b', []),
            ],
        });

        const homeSafety = invokeRegisteredAbilityContract('gi_gerald_now_you_know_home_safety', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'home-safety',
            defId: 'gi_gerald_now_you_know_home_safety',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 174,
        });
        expect(homeSafety.events).toEqual([expect.objectContaining({
            type: SU_EVENTS.LIMIT_MODIFIED,
            payload: expect.objectContaining({ reason: 'gi_gerald_now_you_know_home_safety', powerMax: 2 }),
        })]);

        const mabelAction = invokeRegisteredAbilityContract('gi_gerald_mabel_lean', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'mabel-action',
            defId: 'gi_gerald_mabel_lean',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 175,
        });
        expect(mabelAction.events).toEqual([expect.objectContaining({
            type: SU_EVENTS.LIMIT_MODIFIED,
            payload: expect.objectContaining({ reason: 'gi_gerald_mabel_lean', powerMax: 2 }),
        })]);

        const skiAction = invokeRegisteredAbilityContract('gi_gerald_ski_lift', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'ski-action',
            defId: 'gi_gerald_ski_lift',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 176,
        });
        const skiPicked = respondToPromptOption(
            skiAction.matchState!,
            option => option.value?.minionUid === 'enemy',
            '滑雪缆车行动面移动随从',
            '0',
            defaultTestRandom,
        );
        expect(skiPicked.success, skiPicked.error).toBe(true);
        const skiMoved = respondToPromptOption(
            skiPicked.finalState,
            option => option.value?.baseIndex === 1,
            '滑雪缆车行动面目标基地',
            '0',
            defaultTestRandom,
        );
        expect(skiMoved.success, skiMoved.error).toBe(true);
        expect(skiMoved.events).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.MINION_MOVED, payload: expect.objectContaining({ minionUid: 'enemy', toBaseIndex: 1 }) }),
        ]));

        const rosieAction = invokeRegisteredAbilityContract('gi_gerald_rosie', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'rosie-action',
            defId: 'gi_gerald_rosie',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 177,
        });
        const rosiePrompt = getSimpleChoicePrompt(rosieAction.matchState!, 'gi_gerald_rosie_action');
        const rosieOptionIds = ['own-a', 'own-b'].map(uid =>
            getPromptOption(rosiePrompt, option => option.value?.minionUid === uid, `罗西行动面目标 ${uid}`).id);
        const rosieActionResolved = respondToPromptOptions(rosieAction.matchState!, rosieOptionIds, '0', defaultTestRandom);
        expect(rosieActionResolved.success, rosieActionResolved.error).toBe(true);
        expect(rosieActionResolved.events.filter(event => event.type === SU_EVENTS.POWER_COUNTER_ADDED)).toHaveLength(2);
    });

    it('特种部队杰拉尔德触发器与基地覆盖子爵、出发杰拉尔德、杰拉尔德基地、美国海军旗帜号', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('hand-card', 'geckos_june', 'minion', '0')],
                    deck: [makeCard('drawn', 'geckos_june', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_a', [
                    makeMinion('viscount', 'gi_gerald_viscount', '0', 5),
                    makeMinion('played-minion', 'geckos_june', '0', 2, { playedThisTurn: true }),
                    makeMinion('old-minion', 'geckos_june', '0', 2),
                ]),
                makeBase('base_b', []),
                makeBase('base_gi_geralds_base', [makeMinion('gerald-guest', 'geckos_june', '0', 2)]),
                makeBase('base_uss_banner', []),
            ],
        });

        const goGerald = invokeRegisteredAbilityContract('gi_gerald_go_gerald', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'go-gerald',
            defId: 'gi_gerald_go_gerald',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 146,
        });
        const goResolved = respondToPromptOption(
            goGerald.matchState!,
            option => option.value?.baseIndex === 0,
            '出发，杰拉尔德！基地',
            '0',
            defaultTestRandom,
        );
        expect(goResolved.success, goResolved.error).toBe(true);
        expect(goResolved.events).toEqual(expect.arrayContaining([expect.objectContaining({
            type: SU_EVENTS.TEMP_POWER_ADDED,
            payload: expect.objectContaining({ minionUid: 'played-minion', amount: 2 }),
        })]));

        const triggered = fireTriggers(core, 'onActionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            triggerCardDefId: 'gi_gerald_dice_ninja',
            random: defaultTestRandom,
            now: 147,
        });
        const viscountCounter = respondToPromptOption(
            triggered.matchState!,
            option => option.value?.choice === 'counter',
            '子爵 +1 分支',
            '0',
            defaultTestRandom,
        );
        expect(viscountCounter.success, viscountCounter.error).toBe(true);
        expect(viscountCounter.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.POWER_COUNTER_ADDED,
                payload: expect.objectContaining({ minionUid: 'viscount', amount: 1 }),
            }),
            expect.objectContaining({
                type: SU_EVENTS.MINION_METADATA_UPDATED,
                payload: expect.objectContaining({ minionUid: 'viscount' }),
            }),
        ]));

        const geraldBase = triggerBaseAbilityWithMS('base_gi_geralds_base', 'onMinionPlayed', {
            state: core,
            baseIndex: 2,
            baseDefId: 'base_gi_geralds_base',
            playerId: '0',
            minionUid: 'gerald-guest',
            minionDefId: 'geckos_june',
            now: 148,
            random: defaultTestRandom,
        });
        expect(geraldBase.events).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.BASE_ABILITY_USED }),
            expect.objectContaining({ type: SU_EVENTS.CARDS_DRAWN, payload: expect.objectContaining({ cardUids: ['drawn'] }) }),
        ]));
        const bottomed = respondToPromptOption(
            geraldBase.matchState!,
            option => option.value?.cardUid === 'hand-card',
            '杰拉尔德基地置底手牌',
            '0',
            defaultTestRandom,
        );
        expect(bottomed.success, bottomed.error).toBe(true);
        expect(bottomed.events).toEqual(expect.arrayContaining([expect.objectContaining({
            type: SU_EVENTS.CARD_TO_DECK_BOTTOM,
            payload: expect.objectContaining({ cardUid: 'hand-card', reason: 'base_gi_geralds_base_bottom' }),
        })]));

        const bannerUsed = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.USE_BASE_ABILITY,
            playerId: '0',
            payload: { baseIndex: 3 },
        } as any, defaultTestRandom);
        expect(bannerUsed.success, bannerUsed.error).toBe(true);
        expect(bannerUsed.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.LIMIT_MODIFIED,
                payload: expect.objectContaining({ reason: 'base_uss_banner', restrictToBase: 3, powerMax: 2 }),
            }),
        ]));
    });

    it('宇宙的巨人希曼对象级链覆盖检索、附着战术天赋、临界点和力量城堡', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('normal-top', 'geckos_june', 'minion', '0'),
                        makeCard('weapon-card', 'rulers_cosmos_magic_weapon', 'action', '0'),
                    ],
                    discard: [makeCard('discard-weapon', 'rulers_cosmos_magic_weapon', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_power_castle', [
                    makeMinion('frogga', 'rulers_cosmos_frogga', '0', 2),
                    makeMinion('duncan', 'rulers_cosmos_man_with_arms', '0', 3, {
                        attachedActions: [{ uid: 'attached-weapon', defId: 'rulers_cosmos_magic_weapon', ownerId: '0' }],
                    }),
                    makeMinion('host', 'rulers_cosmos_frogga', '0', 2, {
                        attachedActions: [
                            { uid: 'armor', defId: 'rulers_cosmos_armor_of_battle', ownerId: '0' },
                            { uid: 'fearless', defId: 'rulers_cosmos_fearless_friend', ownerId: '0' },
                            { uid: 'magic', defId: 'rulers_cosmos_magic_weapon', ownerId: '0' },
                            { uid: 'power-sword', defId: 'rulers_cosmos_sword_thats_powerful', ownerId: '0' },
                        ],
                    }),
                    makeMinion('enemy', 'geckos_june', '1', 2),
                ]),
                makeBase('base_b', []),
            ],
        });

        const frogga = invokeRegisteredAbilityContract('rulers_cosmos_frogga', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'frogga',
            defId: 'rulers_cosmos_frogga',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 149,
        });
        expect(frogga.events).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.DECK_INSPECTED, payload: expect.objectContaining({ count: 2 }) }),
            expect.objectContaining({ type: SU_EVENTS.CARDS_DRAWN, payload: expect.objectContaining({ cardUids: ['weapon-card'] }) }),
        ]));

        const duncan = invokeRegisteredAbilityContract('rulers_cosmos_man_with_arms', 'talent', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'duncan',
            defId: 'rulers_cosmos_man_with_arms',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 150,
        });
        expect(duncan.events).toEqual([expect.objectContaining({
            type: SU_EVENTS.PERMANENT_POWER_ADDED,
            payload: expect.objectContaining({ minionUid: 'duncan', amount: 2, expiresOnTurnNumber: 2 }),
        })]);

        const myaaah = invokeRegisteredAbilityContract('rulers_cosmos_myaaah', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'myaaah',
            defId: 'rulers_cosmos_myaaah',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 151,
        });
        const returnedAttached = respondToPromptOption(
            myaaah.matchState!,
            option => option.value?.cardUid === 'attached-weapon',
            '玛雅! 附着战术',
            '0',
            defaultTestRandom,
        );
        expect(returnedAttached.success, returnedAttached.error).toBe(true);
        expect(returnedAttached.events).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.ONGOING_DETACHED }),
            expect.objectContaining({
                type: SU_EVENTS.LIMIT_MODIFIED,
                payload: expect.objectContaining({ reason: 'rulers_cosmos_myaaah', restrictToCardUid: 'attached-weapon' }),
            }),
        ]));

        const armor = invokeRegisteredAbilityContract('rulers_cosmos_armor_of_battle', 'talent', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'armor',
            defId: 'rulers_cosmos_armor_of_battle',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 152,
        });
        const armorResolved = respondToPromptOption(
            armor.matchState!,
            option => option.value?.baseIndex === 0,
            '战斗盔甲基地',
            '0',
            defaultTestRandom,
        );
        expect(armorResolved.success, armorResolved.error).toBe(true);
        expect(armorResolved.events).toEqual(expect.arrayContaining([expect.objectContaining({
            type: SU_EVENTS.BREAKPOINT_MODIFIED,
            payload: expect.objectContaining({ baseIndex: 0, delta: 4 }),
        })]));

        const fearless = invokeRegisteredAbilityContract('rulers_cosmos_fearless_friend', 'talent', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'fearless',
            defId: 'rulers_cosmos_fearless_friend',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 153,
        });
        const fearlessPicked = respondToPromptOption(
            fearless.matchState!,
            option => option.value?.minionUid === 'host',
            '无畏的伙伴移动随从',
            '0',
            defaultTestRandom,
        );
        expect(fearlessPicked.success, fearlessPicked.error).toBe(true);
        const fearlessMoved = respondToPromptOption(
            fearlessPicked.finalState,
            option => option.value?.baseIndex === 1,
            '无畏的伙伴移动目的地',
            '0',
            defaultTestRandom,
        );
        expect(fearlessMoved.success, fearlessMoved.error).toBe(true);
        expect(fearlessMoved.events).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.MINION_MOVED, payload: expect.objectContaining({ minionUid: 'host', toBaseIndex: 1 }) }),
        ]));

        const magic = invokeRegisteredAbilityContract('rulers_cosmos_magic_weapon', 'talent', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'magic',
            defId: 'rulers_cosmos_magic_weapon',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 154,
        });
        const magicPower = respondToPromptOption(
            magic.matchState!,
            option => option.value?.choice === 'power',
            '魔法武器按玩家数加战力',
            '0',
            defaultTestRandom,
        );
        expect(magicPower.success, magicPower.error).toBe(true);
        expect(magicPower.events).toEqual(expect.arrayContaining([expect.objectContaining({
            type: SU_EVENTS.PERMANENT_POWER_ADDED,
            payload: expect.objectContaining({ minionUid: 'host', amount: 2 }),
        })]));

        const powerfulSword = invokeRegisteredAbilityContract('rulers_cosmos_sword_thats_powerful', 'talent', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'power-sword',
            defId: 'rulers_cosmos_sword_thats_powerful',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 155,
        });
        expect(powerfulSword.events).toEqual([expect.objectContaining({
            type: SU_EVENTS.POWER_COUNTER_ADDED,
            payload: expect.objectContaining({ minionUid: 'host', amount: 1 }),
        })]);

        const toxicWaste = invokeRegisteredAbilityContract('rulers_cosmos_now_you_know_toxic_waste', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'toxic-waste',
            defId: 'rulers_cosmos_now_you_know_toxic_waste',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 156,
        });
        expect(toxicWaste.events).toEqual([expect.objectContaining({
            type: SU_EVENTS.CARDS_DRAWN,
            payload: expect.objectContaining({ cardUids: ['weapon-card'] }),
        })]);

        const powerCastle = triggerBaseAbilityWithMS('base_power_castle', 'onActionPlayed', {
            state: core,
            baseIndex: 0,
            baseDefId: 'base_power_castle',
            playerId: '0',
            actionTargetType: 'minion',
            actionTargetMinionUid: 'host',
            now: 157,
            random: defaultTestRandom,
        });
        const castleResolved = respondToPromptOption(
            powerCastle.matchState!,
            option => option.value?.choice === 'apply',
            '力量城堡 +1',
            '0',
            defaultTestRandom,
        );
        expect(castleResolved.success, castleResolved.error).toBe(true);
        expect(castleResolved.events).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.BASE_ABILITY_USED }),
            expect.objectContaining({ type: SU_EVENTS.POWER_COUNTER_ADDED, payload: expect.objectContaining({ minionUid: 'host' }) }),
        ]));
    });

    it('珍珠和幻像对象级链覆盖天赋、移动、影响触发和两个基地', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('pearl-draw', 'pearl_images_ruby', 'minion', '0'),
                        makeCard('self-dress-a', 'geckos_june', 'minion', '0'),
                        makeCard('self-dress-b', 'geckos_june', 'minion', '0'),
                        makeCard('self-dress-c', 'geckos_june', 'minion', '0'),
                    ],
                    discard: [makeCard('own-low', 'pearl_images_ruby', 'minion', '0')],
                }),
                '1': makePlayer('1', {
                    deck: [makeCard('enemy-dress', 'geckos_june', 'minion', '1')],
                    discard: [makeCard('enemy-low', 'rulers_cosmos_frogga', 'minion', '1')],
                }),
            },
            bases: [
                makeBase('base_concert_venue', [
                    makeMinion('pearl', 'pearl_images_pearl', '0', 5),
                    makeMinion('crystal', 'pearl_images_crystal', '0', 4),
                    makeMinion('ruby', 'pearl_images_ruby', '0', 2),
                    makeMinion('topaz', 'pearl_images_topaz', '0', 2),
                    makeMinion('own-a', 'geckos_june', '0', 2),
                    makeMinion('enemy-a', 'geckos_june', '1', 2),
                    makeMinion('enemy-b', 'rulers_cosmos_frogga', '1', 2),
                    makeMinion('power-host', 'geckos_june', '0', 2, {
                        attachedActions: [{ uid: 'shes-power', defId: 'pearl_images_shes_got_the_power', ownerId: '0' }],
                    }),
                ]),
                makeBase('base_recording_studio', [makeMinion('own-b', 'geckos_june', '0', 2)]),
            ],
        });

        const ruby = invokeRegisteredAbilityContract('pearl_images_ruby', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'ruby',
            defId: 'pearl_images_ruby',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 158,
        });
        const rubyApplied = respondToPromptOption(
            ruby.matchState!,
            option => option.value?.choice === 'apply',
            '红宝石全体 +1',
            '0',
            defaultTestRandom,
        );
        expect(rubyApplied.success, rubyApplied.error).toBe(true);
        expect(rubyApplied.events.filter(event => event.type === SU_EVENTS.TEMP_POWER_ADDED)).toHaveLength(8);

        const love = invokeRegisteredAbilityContract('pearl_images_love_unites_us', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'love',
            defId: 'pearl_images_love_unites_us',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 159,
        });
        expect(love.events.filter(event => event.type === SU_EVENTS.DECK_REORDERED)).toHaveLength(2);

        const pearl = invokeRegisteredAbilityContract('pearl_images_pearl', 'talent', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'pearl',
            defId: 'pearl_images_pearl',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 160,
        });
        const pearlDraw = respondToPromptOption(
            pearl.matchState!,
            option => option.value?.choice === 'draw',
            '珍珠抓牌分支',
            '0',
            defaultTestRandom,
        );
        expect(pearlDraw.success, pearlDraw.error).toBe(true);
        expect(pearlDraw.events).toEqual(expect.arrayContaining([expect.objectContaining({
            type: SU_EVENTS.CARDS_DRAWN,
            payload: expect.objectContaining({ cardUids: ['pearl-draw'] }),
        })]));

        const crystal = invokeRegisteredAbilityContract('pearl_images_crystal', 'talent', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'crystal',
            defId: 'pearl_images_crystal',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 161,
        });
        const crystalEnemy = respondToPromptOption(
            crystal.matchState!,
            option => option.value?.minionUid === 'enemy-a',
            '水晶另一玩家目标',
            '0',
            defaultTestRandom,
        );
        expect(crystalEnemy.success, crystalEnemy.error).toBe(true);
        const crystalOwn = respondToPromptOption(
            crystalEnemy.finalState,
            option => option.value?.minionUid === 'own-a',
            '水晶同基地己方目标',
            '0',
            defaultTestRandom,
        );
        expect(crystalOwn.success, crystalOwn.error).toBe(true);
        expect(crystalOwn.events).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.POWER_COUNTER_ADDED, payload: expect.objectContaining({ minionUid: 'own-a' }) }),
        ]));

        const dressing = invokeRegisteredAbilityContract('pearl_images_dressing_room', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'dressing',
            defId: 'pearl_images_dressing_room',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 162,
        });
        expect(dressing.events.filter(event => event.type === SU_EVENTS.CARDS_DRAWN)).toHaveLength(3);

        const allsRight = invokeRegisteredAbilityContract('pearl_images_alls_right_with_the_world', 'talent', {
            state: {
                ...core,
                bases: [
                    makeBase({
                        defId: 'base_concert_venue',
                        minions: core.bases[0].minions,
                        ongoingActions: [{ uid: 'alls-right', defId: 'pearl_images_alls_right_with_the_world', ownerId: '0' }],
                    }),
                    core.bases[1],
                ],
            },
            matchState: makeMatchState({
                ...core,
                bases: [
                    makeBase({
                        defId: 'base_concert_venue',
                        minions: core.bases[0].minions,
                        ongoingActions: [{ uid: 'alls-right', defId: 'pearl_images_alls_right_with_the_world', ownerId: '0' }],
                    }),
                    core.bases[1],
                ],
            }),
            playerId: '0',
            cardUid: 'alls-right',
            defId: 'pearl_images_alls_right_with_the_world',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 163,
        });
        const allBuffed = respondToPromptOption(
            allsRight.matchState!,
            option => option.value?.choice === 'all',
            '世界一切安好全体 +1',
            '0',
            defaultTestRandom,
        );
        expect(allBuffed.success, allBuffed.error).toBe(true);
        expect(allBuffed.events.filter(event => event.type === SU_EVENTS.TEMP_POWER_ADDED)).toHaveLength(8);

        const bike = invokeRegisteredAbilityContract('pearl_images_now_you_know_bike_safety', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'bike',
            defId: 'pearl_images_now_you_know_bike_safety',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 164,
        });
        const bikeOwn = respondToPromptOption(
            bike.matchState!,
            option => option.value?.minionUid === 'own-a',
            '自行车安全己方随从',
            '0',
            defaultTestRandom,
        );
        expect(bikeOwn.success, bikeOwn.error).toBe(true);
        const bikeEnemy = respondToPromptOption(
            bikeOwn.finalState,
            option => option.value?.minionUid === 'enemy-a',
            '自行车安全另一玩家随从',
            '0',
            defaultTestRandom,
        );
        expect(bikeEnemy.success, bikeEnemy.error).toBe(true);
        const bikeMoved = respondToPromptOption(
            bikeEnemy.finalState,
            option => option.value?.baseIndex === 1,
            '自行车安全目标基地',
            '0',
            defaultTestRandom,
        );
        expect(bikeMoved.success, bikeMoved.error).toBe(true);
        expect(bikeMoved.events.filter(event => event.type === SU_EVENTS.MINION_MOVED)).toHaveLength(2);

        const outstanding = invokeRegisteredAbilityContract('pearl_images_truly_outstanding', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'outstanding',
            defId: 'pearl_images_truly_outstanding',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 165,
        });
        const outstandingPrompt = getSimpleChoicePrompt(outstanding.matchState!, 'pearl_images_truly_outstanding');
        const enemyOptionIds = ['enemy-a', 'enemy-b'].map(uid =>
            getPromptOption(outstandingPrompt, option => option.value?.minionUid === uid, `杰出表彰另一玩家目标 ${uid}`).id);
        const outstandingEnemies = respondToPromptOptions(outstanding.matchState!, enemyOptionIds, '0', defaultTestRandom);
        expect(outstandingEnemies.success, outstandingEnemies.error).toBe(true);
        const outstandingOwn = respondToPromptOption(
            outstandingEnemies.finalState,
            option => option.value?.minionUid === 'own-a',
            '杰出表彰己方目标',
            '0',
            defaultTestRandom,
        );
        expect(outstandingOwn.success, outstandingOwn.error).toBe(true);
        expect(outstandingOwn.events).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.POWER_COUNTER_ADDED, payload: expect.objectContaining({ minionUid: 'own-a' }) }),
        ]));

        const topaz = fireTriggers(core, 'onMinionAffected', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            triggerMinionUid: 'enemy-a',
            triggerMinionDefId: 'geckos_june',
            triggerMinion: core.bases[0].minions.find(minion => minion.uid === 'enemy-a'),
            random: defaultTestRandom,
            now: 166,
        });
        const topazCountered = respondToPromptOption(
            topaz.matchState!,
            option => option.value?.choice === 'counter',
            '黄玉 +1 分支',
            '0',
            defaultTestRandom,
        );
        expect(topazCountered.success, topazCountered.error).toBe(true);
        expect(topazCountered.events).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.POWER_COUNTER_ADDED, payload: expect.objectContaining({ minionUid: 'topaz', amount: 1 }) }),
            expect.objectContaining({ type: SU_EVENTS.MINION_METADATA_UPDATED }),
        ]));

        const shesPower = fireTriggers(core, 'onMinionAffected', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            triggerMinionUid: 'enemy-a',
            triggerMinionDefId: 'geckos_june',
            triggerMinion: core.bases[0].minions.find(minion => minion.uid === 'enemy-a'),
            sourceCardUid: 'shes-power',
            sourceBaseIndex: 0,
            sourceControllerId: '0',
            random: defaultTestRandom,
            now: 167,
        });
        expect(shesPower.events).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.TEMP_POWER_ADDED, payload: expect.objectContaining({ minionUid: 'power-host', amount: 3 }) }),
            expect.objectContaining({ type: SU_EVENTS.MINION_METADATA_UPDATED, payload: expect.objectContaining({ minionUid: 'power-host' }) }),
        ]));

        const concert = triggerBaseAbilityWithMS('base_concert_venue', 'onMinionPlayed', {
            state: core,
            baseIndex: 0,
            baseDefId: 'base_concert_venue',
            playerId: '0',
            minionUid: 'own-a',
            minionDefId: 'geckos_june',
            now: 168,
            random: defaultTestRandom,
        });
        const concertResolved = respondToPromptOption(
            concert.matchState!,
            option => option.value?.choice === 'apply',
            '音乐会场地 +1',
            '0',
            defaultTestRandom,
        );
        expect(concertResolved.success, concertResolved.error).toBe(true);
        expect(concertResolved.events).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.BASE_ABILITY_USED }),
            expect.objectContaining({ type: SU_EVENTS.POWER_COUNTER_ADDED, payload: expect.objectContaining({ minionUid: 'own-a' }) }),
        ]));

        const recording = triggerBaseAbilityWithMS('base_recording_studio', 'onTurnStart', {
            state: core,
            baseIndex: 1,
            baseDefId: 'base_recording_studio',
            playerId: '0',
            now: 169,
            random: defaultTestRandom,
        });
        expect(recording.events).toEqual([expect.objectContaining({
            type: SU_EVENTS.TEMP_POWER_ADDED,
            payload: expect.objectContaining({ minionUid: 'own-b', amount: 1 }),
        })]);

        const afterBuff = applyEvents(core, recording.events);
        expect(afterBuff.bases[1].minions.find(minion => minion.uid === 'own-b')?.tempPowerModifier).toBe(1);
    });

    it('珍珠和幻像剩余可选分支覆盖珍珠临时力量、世界一切安好按玩家和黄玉临时力量', () => {
        const core = makeState({
            players: { '0': makePlayer('0'), '1': makePlayer('1') },
            bases: [
                makeBase({
                    defId: 'base_a',
                    minions: [
                        makeMinion('pearl', 'pearl_images_pearl', '0', 5),
                        makeMinion('topaz', 'pearl_images_topaz', '0', 2),
                        makeMinion('own-a', 'geckos_june', '0', 2),
                        makeMinion('enemy-a', 'geckos_june', '1', 2),
                    ],
                    ongoingActions: [{ uid: 'alls-right', defId: 'pearl_images_alls_right_with_the_world', ownerId: '0' }],
                }),
            ],
        });

        const pearl = invokeRegisteredAbilityContract('pearl_images_pearl', 'talent', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'pearl',
            defId: 'pearl_images_pearl',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 178,
        });
        const pearlTempBranch = respondToPromptOption(
            pearl.matchState!,
            option => option.value?.choice === 'temp',
            '珍珠临时力量分支',
            '0',
            defaultTestRandom,
        );
        expect(pearlTempBranch.success, pearlTempBranch.error).toBe(true);
        const pearlTempResolved = respondToPromptOption(
            pearlTempBranch.finalState,
            option => option.value?.minionUid === 'own-a',
            '珍珠临时力量目标',
            '0',
            defaultTestRandom,
        );
        expect(pearlTempResolved.success, pearlTempResolved.error).toBe(true);
        expect(pearlTempResolved.events).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.TEMP_POWER_ADDED, payload: expect.objectContaining({ minionUid: 'own-a', amount: 1 }) }),
        ]));

        const allsRight = invokeRegisteredAbilityContract('pearl_images_alls_right_with_the_world', 'talent', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'alls-right',
            defId: 'pearl_images_alls_right_with_the_world',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 179,
        });
        const perPlayer = respondToPromptOption(
            allsRight.matchState!,
            option => option.value?.choice === 'per-player',
            '世界一切安好按玩家 +2',
            '0',
            defaultTestRandom,
        );
        expect(perPlayer.success, perPlayer.error).toBe(true);
        expect(perPlayer.events.filter(event => event.type === SU_EVENTS.TEMP_POWER_ADDED)).toHaveLength(2);
        expect(perPlayer.events).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.TEMP_POWER_ADDED, payload: expect.objectContaining({ amount: 2 }) }),
        ]));

        const topaz = fireTriggers(core, 'onMinionAffected', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            triggerMinionUid: 'enemy-a',
            triggerMinionDefId: 'geckos_june',
            triggerMinion: core.bases[0].minions.find(minion => minion.uid === 'enemy-a'),
            random: defaultTestRandom,
            now: 180,
        });
        const topazTemp = respondToPromptOption(
            topaz.matchState!,
            option => option.value?.choice === 'temp',
            '黄玉临时力量分支',
            '0',
            defaultTestRandom,
        );
        expect(topazTemp.success, topazTemp.error).toBe(true);
        expect(topazTemp.events).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.TEMP_POWER_ADDED, payload: expect.objectContaining({ minionUid: 'topaz', amount: 2 }) }),
            expect.objectContaining({ type: SU_EVENTS.MINION_METADATA_UPDATED, payload: expect.objectContaining({ minionUid: 'topaz' }) }),
        ]));
    });
});
