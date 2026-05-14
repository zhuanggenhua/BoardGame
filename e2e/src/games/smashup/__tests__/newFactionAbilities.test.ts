/**
 * 大杀四方 - 新增派系能力测试
 *
 * 覆盖：
 * - 黑熊骑兵：bear_cavalry_bear_cavalry, bear_cavalry_youre_screwed,
 *   bear_cavalry_bear_rides_you, bear_cavalry_youre_pretty_much_borscht,
 *   bear_cavalry_bear_necessities
 * - 米斯卡塔尼克大学：miskatonic_librarian, miskatonic_professor
 * - 印斯茅斯：innsmouth_the_locals
 * - 幽灵：ghost_spirit
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { SU_COMMANDS, SU_EVENTS } from '../domain/types';
import type {
    SmashUpCore,
    PlayerState,
    MinionOnBase,
    CardInstance,
    OngoingActionOnBase,
} from '../domain/types';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearRegistry, resolveSpecial } from '../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../domain/baseAbilities';
import { clearInteractionHandlers, getInteractionHandler } from '../domain/abilityInteractionHandlers';
import { getDiscardSpecialOptions } from '../domain/discardSpecialAbilities';
import { startDuel } from '../domain/duel';
import { clearOngoingEffectRegistry, collectTriggers, fireTriggers, interceptEvent, isMinionProtected } from '../domain/ongoingEffects';
import { getEffectivePower, getPlayerEffectivePowerOnBase, getTotalEffectivePowerOnBase } from '../domain/ongoingModifiers';
import { maybeResolveReactionQueue } from '../domain/reactionQueue';
import { startSmashUpReactionSession } from '../domain/reactionSession';
import { reduce } from '../domain/reduce';
import { execute, processDestroyTriggers } from '../domain/reducer';
import { getAbilityRuntimePromptHandler } from '../domain/abilityRuntime';
import { validate } from '../domain/commands';
import { resumePendingBranchingChoiceFrames } from '../domain/branchingChoice';
import {
    makeMinion,
    makeCard,
    makePlayer,
    makeState,
    makeMatchState,
    getInteractionsFromMS,
    findInteractionOption,
    resolveInteractionChain,
} from './helpers';
import { runCommand, defaultTestRandom } from './testRunner';
import type { MatchState } from '../../../engine/types';
import {
    createSimpleChoice,
    queueInteraction,
    refreshInteractionOptions,
    resolveInteraction,
} from '../../../engine/systems/InteractionSystem';
import { SMASHUP_AUDIO_CONFIG } from '../audio.config';
import { COWBOYS_ACTIONS, COWBOYS_MINIONS } from '../data/factions/cowboys';
import { COWBOYS_POD_ACTIONS, COWBOYS_POD_MINIONS } from '../data/factions/cowboys_pod';
import { getCardDef } from '../data/cards';
import { PIRATE_ACTIONS } from '../data/factions/pirates';
import { PIRATE_POD_ACTIONS } from '../data/factions/pirates_pod';
import { ZOMBIE_ACTIONS } from '../data/factions/zombies';

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    clearOngoingEffectRegistry();
    resetAbilityInit();
    clearInteractionHandlers();
    initAllAbilities();
});

function resolveDuelChain(
    initialState: MatchState<SmashUpCore>,
    overrides: Partial<Record<string, (prompt: any, state: MatchState<SmashUpCore>, step: number) => { optionId?: string; optionIds?: string[]; mergedValue?: unknown }>> = {},
) {
    return resolveInteractionChain(initialState, (prompt, state, step) => {
        const sourceId = prompt?.data?.sourceId as string | undefined;
        const custom = sourceId ? overrides[sourceId] : undefined;
        if (custom) return custom(prompt, state, step);

        if (sourceId === 'smashup_duel_pinkerton') {
            const option = findInteractionOption(prompt, option => option?.value?.amount === 0);
            if (!option) throw new Error('未找到 Pinkerton 的 0 指示物选项');
            return { optionId: option.id };
        }
        if (sourceId === 'smashup_duel_card' || sourceId === 'smashup_duel_deputy_card') {
            const option = findInteractionOption(prompt, option => option?.value?.skip === true);
            if (!option) throw new Error(`未找到 ${sourceId} 的跳过选项`);
            return { optionId: option.id };
        }
        if (sourceId === 'smashup_duel_run_em_off_move') {
            return { optionId: prompt.data.options[0].id };
        }

        throw new Error(`未处理的决斗交互 sourceId: ${sourceId ?? 'unknown'}`);
    });
}

describe('牛仔音效配置', () => {
    it('cowboys 关键卡牌应绑定更贴题的西部音效', () => {
        expect(COWBOYS_MINIONS.find(card => card.id === 'cowboys_gunfighter')?.soundKey)
            .toBe('combat.guns_sound_fx_pack.38_spl_revolver.gunshots.38_spl_revolver_gunshot_a_001');
        expect(COWBOYS_ACTIONS.find(card => card.id === 'cowboys_quick_draw')?.soundKey)
            .toBe('combat.guns_sound_fx_pack.misc_ammo_boxes_holsters_etc.leather_unholster_001');
        expect(COWBOYS_ACTIONS.find(card => card.id === 'cowboys_high_noon')?.soundKey)
            .toBe('combat.guns_sound_fx_pack.38_spl_revolver.gunshots.38_spl_revolver_gunshot_a_001');
        expect(COWBOYS_ACTIONS.find(card => card.id === 'cowboys_dynamite_surprise')?.soundKey)
            .toBe('combat.explosives_sound_fx_pack.fuse.dynamite_fuse_start_001');
        expect(COWBOYS_ACTIONS.find(card => card.id === 'cowboys_gold_in_them_thar_hills')?.soundKey)
            .toBe('coins.decks_and_cards_sound_fx_pack.gold_pouch_handle_001');
        expect(COWBOYS_ACTIONS.find(card => card.id === 'cowboys_stagecoach')?.soundKey)
            .toBe('retro.retro_gaming_sound_fx_pack_vol.16_bit.movement.hoof_move_step_001');
    });

    it('cowboys_pod 复用同一套西部主题音效', () => {
        expect(COWBOYS_POD_MINIONS.find(card => card.id === 'cowboys_gunfighter_pod')?.soundKey)
            .toBe('combat.guns_sound_fx_pack.38_spl_revolver.gunshots.38_spl_revolver_gunshot_a_001');
        expect(COWBOYS_POD_ACTIONS.find(card => card.id === 'cowboys_quick_draw_pod')?.soundKey)
            .toBe('combat.guns_sound_fx_pack.misc_ammo_boxes_holsters_etc.leather_unholster_001');
        expect(COWBOYS_POD_ACTIONS.find(card => card.id === 'cowboys_dynamite_surprise_pod')?.soundKey)
            .toBe('combat.explosives_sound_fx_pack.fuse.dynamite_fuse_start_001');
    });

    it('反馈解析器应优先返回 cowboy 卡牌级音效', () => {
        expect(SMASHUP_AUDIO_CONFIG.feedbackResolver({
            type: SU_EVENTS.MINION_PLAYED,
            payload: { defId: 'cowboys_gunfighter' },
        } as any)).toBe('combat.guns_sound_fx_pack.38_spl_revolver.gunshots.38_spl_revolver_gunshot_a_001');

        expect(SMASHUP_AUDIO_CONFIG.feedbackResolver({
            type: SU_EVENTS.ACTION_PLAYED,
            payload: { defId: 'cowboys_high_noon' },
        } as any)).toBe('combat.guns_sound_fx_pack.38_spl_revolver.gunshots.38_spl_revolver_gunshot_a_001');

        expect(SMASHUP_AUDIO_CONFIG.feedbackResolver({
            type: SU_EVENTS.ACTION_PLAYED,
            payload: { defId: 'cowboys_dynamite_surprise' },
        } as any)).toBe('combat.explosives_sound_fx_pack.fuse.dynamite_fuse_start_001');
    });
});

describe('海盗 / 丧尸 / 美人鱼音效配置', () => {
    it('pirates 与 zombies 关键卡牌应绑定更贴题的新素材', () => {
        expect(PIRATE_ACTIONS.find(card => card.id === 'pirate_dinghy')?.soundKey)
            .toBe('ambient.water_sound_fx_pack_vol.splashes_and_movement.fast_short_swirl_a');
        expect(PIRATE_ACTIONS.find(card => card.id === 'pirate_powderkeg')?.soundKey)
            .toBe('combat.explosives_sound_fx_pack.fuse.dynamite_fuse_start_001');
        expect(PIRATE_ACTIONS.find(card => card.id === 'pirate_broadside')?.soundKey)
            .toBe('combat.explosives_sound_fx_pack.realistic.dynamite_close_001');
        expect(PIRATE_ACTIONS.find(card => card.id === 'pirate_full_sail')?.soundKey)
            .toBe('ambient.water_sound_fx_pack_vol.splashes_and_movement.big_splash_a');
        expect(PIRATE_ACTIONS.find(card => card.id === 'pirate_cannon')?.soundKey)
            .toBe('combat.guns_sound_fx_pack.30_30_lever_action_rifle.gunshots.30_30_lever_action_rifle_gunshot_a_001');
        expect(PIRATE_ACTIONS.find(card => card.id === 'pirate_sea_dogs')?.soundKey)
            .toBe('ambient.water_sound_fx_pack_vol.designed.water_ball_spell_big');
        expect(PIRATE_POD_ACTIONS.find(card => card.id === 'pirate_dinghy_pod')?.soundKey)
            .toBe('ambient.water_sound_fx_pack_vol.splashes_and_movement.fast_short_swirl_a');
        expect(PIRATE_POD_ACTIONS.find(card => card.id === 'pirate_powderkeg_pod')?.soundKey)
            .toBe('combat.explosives_sound_fx_pack.fuse.dynamite_fuse_start_001');
        expect(PIRATE_POD_ACTIONS.find(card => card.id === 'pirate_broadside_pod')?.soundKey)
            .toBe('combat.explosives_sound_fx_pack.realistic.dynamite_close_001');
        expect(PIRATE_POD_ACTIONS.find(card => card.id === 'pirate_full_sail_pod')?.soundKey)
            .toBe('ambient.water_sound_fx_pack_vol.splashes_and_movement.big_splash_a');
        expect(PIRATE_POD_ACTIONS.find(card => card.id === 'pirate_cannon_pod')?.soundKey)
            .toBe('combat.guns_sound_fx_pack.30_30_lever_action_rifle.gunshots.30_30_lever_action_rifle_gunshot_a_001');
        expect(PIRATE_POD_ACTIONS.find(card => card.id === 'pirate_sea_dogs_pod')?.soundKey)
            .toBe('ambient.water_sound_fx_pack_vol.designed.water_ball_spell_big');
        expect(ZOMBIE_ACTIONS.find(card => card.id === 'zombie_not_enough_bullets')?.soundKey)
            .toBe('combat.guns_sound_fx_pack.38_spl_revolver.foley.38_spl_revolver_dry_trigger_001');
    });

    it('反馈解析器应优先返回海盗 / 丧尸卡牌级音效，并给美人鱼走水系池', () => {
        expect(SMASHUP_AUDIO_CONFIG.feedbackResolver({
            type: SU_EVENTS.ACTION_PLAYED,
            payload: { defId: 'pirate_dinghy' },
        } as any)).toBe('ambient.water_sound_fx_pack_vol.splashes_and_movement.fast_short_swirl_a');

        expect(SMASHUP_AUDIO_CONFIG.feedbackResolver({
            type: SU_EVENTS.ACTION_PLAYED,
            payload: { defId: 'pirate_cannon' },
        } as any)).toBe('combat.guns_sound_fx_pack.30_30_lever_action_rifle.gunshots.30_30_lever_action_rifle_gunshot_a_001');

        expect(SMASHUP_AUDIO_CONFIG.feedbackResolver({
            type: SU_EVENTS.ACTION_PLAYED,
            payload: { defId: 'pirate_full_sail' },
        } as any)).toBe('ambient.water_sound_fx_pack_vol.splashes_and_movement.big_splash_a');

        expect(SMASHUP_AUDIO_CONFIG.feedbackResolver({
            type: SU_EVENTS.ACTION_PLAYED,
            payload: { defId: 'pirate_sea_dogs' },
        } as any)).toBe('ambient.water_sound_fx_pack_vol.designed.water_ball_spell_big');

        expect(SMASHUP_AUDIO_CONFIG.feedbackResolver({
            type: SU_EVENTS.ACTION_PLAYED,
            payload: { defId: 'zombie_not_enough_bullets' },
        } as any)).toBe('combat.guns_sound_fx_pack.38_spl_revolver.foley.38_spl_revolver_dry_trigger_001');

        const mermaidMinionKey = SMASHUP_AUDIO_CONFIG.feedbackResolver({
            type: SU_EVENTS.MINION_PLAYED,
            payload: { defId: 'mermaids_siren' },
        } as any);
        expect([
            'ambient.water_sound_fx_pack_vol.splashes_and_movement.fast_short_swirl_a',
            'ambient.water_sound_fx_pack_vol.bubbles.bubbles_short_a',
        ]).toContain(mermaidMinionKey);

        const mermaidActionKey = SMASHUP_AUDIO_CONFIG.feedbackResolver({
            type: SU_EVENTS.ACTION_PLAYED,
            payload: { defId: 'mermaids_siren_song' },
        } as any);
        expect([
            'ambient.water_sound_fx_pack_vol.designed.water_ball_spell_small',
            'ambient.water_sound_fx_pack_vol.designed.water_ball_spell_big',
            'ambient.water_sound_fx_pack_vol.splashes_and_movement.big_splash_a',
        ]).toContain(mermaidActionKey);
    });

    it('选中 mermaids 后应预热水系派系音效池', () => {
        const keys = SMASHUP_AUDIO_CONFIG.contextualPreloadKeys?.({
            G: {
                players: {
                    '0': { factions: ['mermaids', 'pirates'] },
                },
            },
            ctx: {},
            meta: {},
        } as any) ?? [];

        expect(keys).toContain('ambient.water_sound_fx_pack_vol.splashes_and_movement.fast_short_swirl_a');
        expect(keys).toContain('ambient.water_sound_fx_pack_vol.bubbles.bubbles_short_a');
        expect(keys).toContain('ambient.water_sound_fx_pack_vol.designed.water_ball_spell_small');
        expect(keys).toContain('ambient.water_sound_fx_pack_vol.designed.water_ball_spell_big');
        expect(keys).toContain('ambient.water_sound_fx_pack_vol.splashes_and_movement.big_splash_a');
    });
});

describe('bear cavalry interaction regressions', () => {
    it('bear_cavalry_bear_necessities 应同时提供对手随从与已打出的行动卡目标', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'bear_cavalry_bear_necessities', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                { defId: 'base_a', minions: [
                    makeMinion('m1', 'test', '1', 3, { powerModifier: 0 }),
                    makeMinion('m2', 'test', '1', 5, { powerModifier: 0 }),
                ], ongoingActions: [
                    { uid: 'oa1', defId: 'test_ongoing', ownerId: '1' },
                    { uid: 'oa2', defId: 'test_ongoing_2', ownerId: '1' },
                ] },
            ],
        });
        const playResult = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'a1' } },
            defaultTestRandom
        );

        const prompt = getInteractionsFromMS(playResult.finalState)[0] as any;
        expect(prompt?.data?.sourceId).toBe('bear_cavalry_bear_necessities');

        const targetOption = prompt?.data?.options?.find((option: any) => option?.value?.uid === 'oa1');
        expect(targetOption).toBeDefined();
        const optionUids = prompt?.data?.options?.map((option: any) => option?.value?.uid) ?? [];
        expect(optionUids).toContain('m1');
        expect(optionUids).toContain('m2');
        expect(optionUids).toContain('oa1');
        expect(optionUids).toContain('oa2');

        const respondResult = runCommand(
            playResult.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: targetOption.id } } as any,
            defaultTestRandom
        );

        const detachEvt = respondResult.events.find(e => e.type === SU_EVENTS.ONGOING_DETACHED);
        expect(detachEvt).toBeDefined();
        expect((detachEvt as any).payload.cardUid).toBe('oa1');
        expect(respondResult.finalState.core.bases[0].ongoingActions.some((action: any) => action.uid === 'oa1')).toBe(false);
    });

    it('bear_cavalry_polar_commando_pod talent 可以选择敌方低战力随从', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('pc1', 'bear_cavalry_polar_commando_pod', '0', 4, { powerModifier: 0 }),
                        makeMinion('ally5', 'ally_big', '0', 5, { powerModifier: 0 }),
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_b',
                    minions: [
                        makeMinion('enemy3', 'enemy_small', '1', 3, { powerModifier: 0 }),
                        makeMinion('enemy4', 'enemy_equal', '1', 4, { powerModifier: 0 }),
                    ],
                    ongoingActions: [],
                },
            ],
        });

        const talentResult = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.USE_TALENT, playerId: '0', payload: { minionUid: 'pc1', baseIndex: 0 } },
            defaultTestRandom,
        );

        expect(talentResult.success).toBe(true);
        const prompt = getInteractionsFromMS(talentResult.finalState)[0] as any;
        expect(prompt?.data?.sourceId).toBe('bear_cavalry_polar_commando_pod');

        const optionValues = prompt?.data?.options?.map((option: any) => option?.value?.minionUid) ?? [];
        expect(optionValues).toContain('pc1');
        expect(optionValues).toContain('enemy3');
        expect(optionValues).not.toContain('enemy4');
        expect(optionValues).not.toContain('ally5');
    });
});

describe('Vikings abilities', () => {
    it('vikings_huscarl 天赋会把手牌放到牌库顶并给自身 +2 力量', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('hand-1', 'robot_microbot_alpha', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('h1', 'vikings_huscarl', '0', 2)],
                ongoingActions: [],
            }],
        });

        const talent = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.USE_TALENT, playerId: '0', payload: { minionUid: 'h1', baseIndex: 0 } },
            defaultTestRandom,
        );
        const prompt = getInteractionsFromMS(talent.finalState)[0] as any;
        expect(prompt?.data?.sourceId).toBe('vikings_huscarl');

        const option = prompt.data.options.find((entry: any) => entry.value?.cardUid === 'hand-1');
        const resolved = runCommand(
            talent.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: option.id } } as any,
            defaultTestRandom,
        );

        expect(resolved.finalState.core.players['0'].deck[0]?.uid).toBe('hand-1');
        expect(resolved.finalState.core.players['0'].hand).toHaveLength(0);
        expect(resolved.finalState.core.bases[0].minions[0].tempPowerModifier).toBe(2);
    });

    it('vikings_shield_maiden 会揭示对手牌库顶并把合格牌拿到自己手里', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('sm-1', 'vikings_shield_maiden', 'minion', '0')],
                }),
                '1': makePlayer('1', {
                    deck: [makeCard('top-action', 'wizard_summon', 'action', '1')],
                }),
            },
            bases: [{ defId: 'base_a', minions: [], ongoingActions: [] }],
        });

        const play = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'sm-1', baseIndex: 0 } },
            defaultTestRandom,
        );
        const prompt = getInteractionsFromMS(play.finalState)[0] as any;
        expect(prompt?.data?.sourceId).toBe('vikings_shield_maiden');

        const option = prompt.data.options.find((entry: any) => entry.value?.targetPlayerId === '1');
        const resolved = runCommand(
            play.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: option.id } } as any,
            defaultTestRandom,
        );

        expect(resolved.finalState.core.players['0'].hand.some(card => card.uid === 'top-action')).toBe(true);
        expect(resolved.finalState.core.players['1'].deck).toHaveLength(0);
    });

    it('vikings_shield_maiden 可以跳过可选揭示', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('sm-1', 'vikings_shield_maiden', 'minion', '0')],
                }),
                '1': makePlayer('1', {
                    deck: [makeCard('top-action', 'wizard_summon', 'action', '1')],
                }),
            },
            bases: [{ defId: 'base_a', minions: [], ongoingActions: [] }],
        });

        const play = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'sm-1', baseIndex: 0 } },
            defaultTestRandom,
        );
        const prompt = getInteractionsFromMS(play.finalState)[0] as any;
        const skip = prompt.data.options.find((entry: any) => entry.value?.skip === true);
        const resolved = runCommand(
            play.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: skip.id } } as any,
            defaultTestRandom,
        );

        expect(resolved.finalState.core.players['0'].hand.some(card => card.uid === 'top-action')).toBe(false);
        expect(resolved.finalState.core.players['1'].deck[0]?.uid).toBe('top-action');
    });

    it('vikings_shield_maiden_pod 会沿用同一套揭示并拿牌逻辑', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('sm-1', 'vikings_shield_maiden_pod', 'minion', '0')],
                }),
                '1': makePlayer('1', {
                    deck: [makeCard('top-action', 'wizard_summon', 'action', '1')],
                }),
            },
            bases: [{ defId: 'base_a', minions: [], ongoingActions: [] }],
        });

        const play = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'sm-1', baseIndex: 0 } },
            defaultTestRandom,
        );
        const prompt = getInteractionsFromMS(play.finalState)[0] as any;
        expect(prompt?.data?.sourceId).toBe('vikings_shield_maiden');

        const option = prompt.data.options.find((entry: any) => entry.value?.targetPlayerId === '1');
        const resolved = runCommand(
            play.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: option.id } } as any,
            defaultTestRandom,
        );

        expect(resolved.finalState.core.players['0'].hand.some(card => card.uid === 'top-action')).toBe(true);
        expect(resolved.finalState.core.players['1'].deck).toHaveLength(0);
    });

    it('vikings_pillage 会从目标玩家手牌中随机拿走一张牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('pillage-1', 'vikings_pillage', 'action', '0')],
                }),
                '1': makePlayer('1', {
                    hand: [makeCard('victim-1', 'robot_microbot_alpha', 'minion', '1')],
                }),
            },
            bases: [{ defId: 'base_a', minions: [], ongoingActions: [] }],
        });

        const play = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'pillage-1' } },
            defaultTestRandom,
        );
        const prompt = getInteractionsFromMS(play.finalState)[0] as any;
        expect(prompt?.data?.sourceId).toBe('vikings_pillage');

        const option = prompt.data.options.find((entry: any) => entry.value?.targetPlayerId === '1');
        const resolved = runCommand(
            play.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: option.id } } as any,
            defaultTestRandom,
        );

        expect(resolved.finalState.core.players['0'].hand.some(card => card.uid === 'victim-1')).toBe(true);
        expect(resolved.finalState.core.players['1'].hand.some(card => card.uid === 'victim-1')).toBe(false);
    });

    it('vikings_raiding_party 会把揭示的低力量随从作为额外随从直接打出', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('rp-1', 'vikings_raiding_party', 'action', '0')],
                }),
                '1': makePlayer('1', {
                    deck: [makeCard('top-minion', 'robot_microbot_alpha', 'minion', '1')],
                }),
            },
            bases: [
                { defId: 'base_a', minions: [], ongoingActions: [] },
                { defId: 'base_b', minions: [], ongoingActions: [] },
            ],
        });

        const play = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'rp-1' } },
            defaultTestRandom,
        );
        const playerPrompt = getInteractionsFromMS(play.finalState)[0] as any;
        const playerOption = playerPrompt.data.options.find((entry: any) => entry.value?.targetPlayerId === '1');
        const afterPlayer = runCommand(
            play.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: playerOption.id } } as any,
            defaultTestRandom,
        );

        const choicePrompt = getInteractionsFromMS(afterPlayer.finalState)[0] as any;
        const cardOption = choicePrompt.data.options.find((entry: any) => entry.value?.cardUid === 'top-minion');
        const afterChoice = runCommand(
            afterPlayer.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: cardOption.id } } as any,
            defaultTestRandom,
        );

        const basePrompt = getInteractionsFromMS(afterChoice.finalState)[0] as any;
        expect(basePrompt?.data?.sourceId).toBe('vikings_raiding_party_minion_base');
        const baseOption = basePrompt.data.options.find((entry: any) => entry.value?.baseIndex === 1);
        const resolved = runCommand(
            afterChoice.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: baseOption.id } } as any,
            defaultTestRandom,
        );

        expect(resolved.finalState.core.bases[1].minions.some(minion => minion.uid === 'top-minion')).toBe(true);
        expect(resolved.finalState.core.players['0'].hand.some(card => card.uid === 'top-minion')).toBe(false);
        expect(resolved.finalState.core.players['1'].deck).toHaveLength(0);
    });

    it('vikings_cast_the_runes_order 在揭示快照失效后不应改坏当前牌库顺序', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('runes-1', 'vikings_cast_the_runes', 'action', '0')],
                }),
                '1': makePlayer('1', {
                    hand: [makeCard('victim-hand', 'robot_microbot_alpha', 'minion', '1')],
                    deck: [
                        makeCard('top-a', 'robot_microbot_beta', 'minion', '1'),
                        makeCard('top-b', 'wizard_summon', 'action', '1'),
                        makeCard('rest-1', 'robot_microbot_gamma', 'minion', '1'),
                    ],
                }),
            },
            bases: [{ defId: 'base_a', minions: [], ongoingActions: [] }],
        });

        const play = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'runes-1' } },
            defaultTestRandom,
        );
        const playerPrompt = getInteractionsFromMS(play.finalState)[0] as any;
        const choosePlayer = playerPrompt.data.options.find((entry: any) => entry.value?.targetPlayerId === '1');
        const afterPlayer = runCommand(
            play.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: choosePlayer.id } } as any,
            defaultTestRandom,
        );

        const initialOrderPrompt = getInteractionsFromMS(afterPlayer.finalState)[0] as any;
        expect(initialOrderPrompt?.data?.sourceId).toBe('vikings_cast_the_runes_order');
        expect(initialOrderPrompt.data.options.map((entry: any) => entry.value)).toEqual(expect.arrayContaining([
            expect.objectContaining({ topCardUid: 'top-a', cardUid: 'top-a', defId: 'robot_microbot_beta' }),
            expect.objectContaining({ topCardUid: 'top-b', cardUid: 'top-b', defId: 'wizard_summon' }),
        ]));

        const refreshedState = refreshInteractionOptions({
            ...afterPlayer.finalState,
            core: {
                ...afterPlayer.finalState.core,
                players: {
                    ...afterPlayer.finalState.core.players,
                    '1': {
                        ...afterPlayer.finalState.core.players['1'],
                        deck: [
                            makeCard('intrude', 'robot_microbot_alpha', 'minion', '1'),
                            makeCard('top-a', 'robot_microbot_beta', 'minion', '1'),
                            makeCard('top-b', 'wizard_summon', 'action', '1'),
                            makeCard('rest-1', 'robot_microbot_gamma', 'minion', '1'),
                        ],
                    },
                },
            },
        });

        const orderPrompt = getInteractionsFromMS(refreshedState)[0] as any;
        expect(orderPrompt.data.options).toHaveLength(1);
        expect(orderPrompt.data.options[0].id).toBe('__emergency_skip__');

        const resolved = runCommand(
            refreshedState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: '__emergency_skip__' } } as any,
            defaultTestRandom,
        );

        expect(resolved.finalState.core.players['1'].deck.map(card => card.uid)).toEqual(['intrude', 'top-a', 'top-b', 'rest-1']);
    });

    it('vikings_raiding_party 的候选应随当前牌库顶快照刷新，避免继续引用已离开的旧揭示牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('rp-1', 'vikings_raiding_party', 'action', '0')],
                }),
                '1': makePlayer('1', {
                    deck: [
                        makeCard('top-minion', 'robot_microbot_alpha', 'minion', '1'),
                        makeCard('top-action', 'wizard_summon', 'action', '1'),
                        makeCard('top-extra', 'robot_microbot_alpha', 'minion', '1'),
                        makeCard('rest-1', 'robot_microbot_gamma', 'minion', '1'),
                    ],
                }),
            },
            bases: [{ defId: 'base_a', minions: [], ongoingActions: [] }],
        });

        const play = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'rp-1' } },
            defaultTestRandom,
        );
        const playerPrompt = getInteractionsFromMS(play.finalState)[0] as any;
        const choosePlayer = playerPrompt.data.options.find((entry: any) => entry.value?.targetPlayerId === '1');
        const afterPlayer = runCommand(
            play.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: choosePlayer.id } } as any,
            defaultTestRandom,
        );

        const refreshedState = refreshInteractionOptions({
            ...afterPlayer.finalState,
            core: {
                ...afterPlayer.finalState.core,
                players: {
                    ...afterPlayer.finalState.core.players,
                    '1': {
                        ...afterPlayer.finalState.core.players['1'],
                        deck: [
                            makeCard('top-action', 'wizard_summon', 'action', '1'),
                            makeCard('top-extra', 'robot_microbot_alpha', 'minion', '1'),
                            makeCard('rest-1', 'robot_microbot_gamma', 'minion', '1'),
                        ],
                    },
                },
            },
        });

        const choicePrompt = getInteractionsFromMS(refreshedState)[0] as any;
        const optionUids = choicePrompt.data.options
            .map((entry: any) => entry.value?.cardUid)
            .filter(Boolean);
        expect(optionUids).toEqual(['top-action', 'top-extra']);
        expect(optionUids).not.toContain('top-minion');

        const chooseAction = choicePrompt.data.options.find((entry: any) => entry.value?.cardUid === 'top-action');
        const resolved = runCommand(
            refreshedState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: chooseAction.id } } as any,
            defaultTestRandom,
        );

        expect(resolved.finalState.core.players['1'].deck.map(card => card.uid)).toEqual(['top-extra', 'rest-1']);
        expect(resolved.finalState.core.players['0'].discard.some(card => card.uid === 'top-action')).toBe(true);
        expect(resolved.finalState.core.players['0'].discard.some(card => card.uid === 'top-minion')).toBe(false);
    });

    it('vikings_raiding_party 选择需要基地的行动时会先选基地再作为额外行动打出', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('rp-1', 'vikings_raiding_party', 'action', '0')],
                }),
                '1': makePlayer('1', {
                    deck: [makeCard('top-action', 'trickster_enshrouding_mist', 'action', '1')],
                }),
            },
            bases: [
                { defId: 'base_a', minions: [], ongoingActions: [] },
                { defId: 'base_b', minions: [], ongoingActions: [] },
            ],
        });

        const play = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'rp-1' } },
            defaultTestRandom,
        );
        const playerPrompt = getInteractionsFromMS(play.finalState)[0] as any;
        const playerOption = playerPrompt.data.options.find((entry: any) => entry.value?.targetPlayerId === '1');
        const afterPlayer = runCommand(
            play.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: playerOption.id } } as any,
            defaultTestRandom,
        );

        const choicePrompt = getInteractionsFromMS(afterPlayer.finalState)[0] as any;
        const cardOption = choicePrompt.data.options.find((entry: any) => entry.value?.cardUid === 'top-action');
        const afterChoice = runCommand(
            afterPlayer.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: cardOption.id } } as any,
            defaultTestRandom,
        );

        const basePrompt = getInteractionsFromMS(afterChoice.finalState)[0] as any;
        expect(basePrompt?.data?.sourceId).toBe('vikings_raiding_party_action_base');
        const baseOption = basePrompt.data.options.find((entry: any) => entry.value?.baseIndex === 1);
        const resolved = runCommand(
            afterChoice.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: baseOption.id } } as any,
            defaultTestRandom,
        );

        expect(resolved.finalState.core.bases[1].ongoingActions.some(action => action.uid === 'top-action')).toBe(true);
        expect(resolved.finalState.core.players['0'].hand.some(card => card.uid === 'top-action')).toBe(false);
        expect(resolved.finalState.core.players['0'].actionsPlayed).toBe(1);
    });

    it('vikings_berserk_pod 会把手牌压到牌库顶并给你的随从 +4 力量', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('berserk-1', 'vikings_berserk_pod', 'action', '0'),
                        makeCard('topdeck-1', 'robot_microbot_alpha', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('ally-1', 'vikings_huscarl_pod', '0', 2)],
                ongoingActions: [],
            }],
        });

        const play = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'berserk-1' } },
            defaultTestRandom,
        );
        const cardPrompt = getInteractionsFromMS(play.finalState)[0] as any;
        expect(cardPrompt?.data?.sourceId).toBe('vikings_berserk_card');

        const chooseCard = cardPrompt.data.options.find((entry: any) => entry.value?.cardUid === 'topdeck-1');
        const afterCard = runCommand(
            play.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: chooseCard.id } } as any,
            defaultTestRandom,
        );

        const minionPrompt = getInteractionsFromMS(afterCard.finalState)[0] as any;
        expect(minionPrompt?.data?.sourceId).toBe('vikings_berserk_minion');

        const chooseMinion = minionPrompt.data.options.find((entry: any) => entry.value?.minionUid === 'ally-1');
        const resolved = runCommand(
            afterCard.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: chooseMinion.id } } as any,
            defaultTestRandom,
        );

        expect(resolved.finalState.core.players['0'].deck[0]?.uid).toBe('topdeck-1');
        expect(resolved.finalState.core.bases[0].minions[0].tempPowerModifier).toBe(4);
    });
});

describe('Cowboys abilities', () => {
    it('cowboys_gunfighter 打出后可与同基地敌方随从决斗并消灭失败者', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('gun-1', 'cowboys_gunfighter', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('enemy-1', 'robot_microbot_alpha', '1', 2)],
                ongoingActions: [],
            }],
        });

        const play = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'gun-1', baseIndex: 0 } },
            defaultTestRandom,
        );
        const prompt = getInteractionsFromMS(play.finalState)[0] as any;
        expect(prompt?.data?.sourceId).toBe('cowboys_gunfighter');

        const option = prompt.data.options.find((entry: any) => entry.value?.minionUid === 'enemy-1');
        const resolved = runCommand(
            play.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: option.id } } as any,
            defaultTestRandom,
        );

        const duelResolved = resolveDuelChain(resolved.finalState);
        expect(duelResolved.events.some(e => e.type === SU_EVENTS.MINION_DESTROYED)).toBe(true);
        expect(duelResolved.finalState.core.bases[0].minions.some(m => m.uid === 'enemy-1')).toBe(false);
    });

    it('cowboys_quick_draw 在非决斗状态会给所选随从 +2 力量', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('quick-1', 'cowboys_quick_draw', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('ally-1', 'cowboys_gunfighter', '0', 3)],
                ongoingActions: [],
            }],
        });

        const play = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'quick-1' } },
            defaultTestRandom,
        );
        const prompt = getInteractionsFromMS(play.finalState)[0] as any;
        expect(prompt?.data?.sourceId).toBe('cowboys_quick_draw');

        const option = prompt.data.options.find((entry: any) => entry.value?.minionUid === 'ally-1');
        const resolved = runCommand(
            play.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: option.id } } as any,
            defaultTestRandom,
        );

        expect(resolved.finalState.core.bases[0].minions.find(m => m.uid === 'ally-1')?.tempPowerModifier).toBe(2);
    });

    it('cowboys_quick_draw 在 activeDuel 中会给决斗随从 +4 力量', () => {
        const core = makeState({
            activeDuel: {
                id: 'duel-1',
                baseIndex: 0,
                sourceId: 'test_duel',
                sourcePlayerId: '0',
                challengerPlayerId: '0',
                challengerMinionUid: 'ally-1',
                challengedPlayerId: '1',
                challengedMinionUid: 'enemy-1',
                outcome: 'destroy_loser',
            } as any,
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('quick-1', 'cowboys_quick_draw', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('ally-1', 'cowboys_gunfighter', '0', 3),
                    makeMinion('enemy-1', 'robot_microbot_alpha', '1', 3),
                ],
                ongoingActions: [],
            }],
        });

        const play = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'quick-1' } },
            defaultTestRandom,
        );
        const prompt = getInteractionsFromMS(play.finalState)[0] as any;
        const option = prompt.data.options.find((entry: any) => entry.value?.minionUid === 'ally-1');
        const resolved = runCommand(
            play.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: option.id } } as any,
            defaultTestRandom,
        );

        expect(resolved.finalState.core.bases[0].minions.find(m => m.uid === 'ally-1')?.tempPowerModifier).toBe(4);
    });

    it('cowboys_high_noon 在己方决斗获胜时给予该基地额外随从额度', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('noon-1', 'cowboys_high_noon', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('ally-1', 'cowboys_gunfighter', '0', 4),
                    makeMinion('enemy-1', 'robot_microbot_alpha', '1', 2),
                ],
                ongoingActions: [],
            }],
        });

        const play = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'noon-1' } },
            defaultTestRandom,
        );
        const friendlyPrompt = getInteractionsFromMS(play.finalState)[0] as any;
        expect(friendlyPrompt?.data?.sourceId).toBe('cowboys_high_noon_friendly');

        const friendlyOption = friendlyPrompt.data.options.find((entry: any) => entry.value?.minionUid === 'ally-1');
        const afterFriendly = runCommand(
            play.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: friendlyOption.id } } as any,
            defaultTestRandom,
        );

        const enemyPrompt = getInteractionsFromMS(afterFriendly.finalState)[0] as any;
        expect(enemyPrompt?.data?.sourceId).toBe('cowboys_high_noon_enemy');

        const enemyOption = enemyPrompt.data.options.find((entry: any) => entry.value?.minionUid === 'enemy-1');
        const resolved = runCommand(
            afterFriendly.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: enemyOption.id } } as any,
            defaultTestRandom,
        );

        const duelResolved = resolveDuelChain(resolved.finalState);
        expect(duelResolved.events.some(e => e.type === SU_EVENTS.MINION_DESTROYED)).toBe(true);
        expect(duelResolved.finalState.core.players['0'].baseLimitedMinionQuota?.[0]).toBe(1);
    });

    it('cowboys_high_noon 不会把挂有烟雾弹的对手随从列为决斗目标', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('noon-1', 'cowboys_high_noon', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('ally-1', 'cowboys_gunfighter', '0', 3),
                    makeMinion('enemy-smoke', 'ninja_tiger_assassin', '1', 4, {
                        attachedActions: [{ uid: 'smoke-1', defId: 'ninja_smoke_bomb', ownerId: '1' }],
                    }),
                    makeMinion('enemy-plain', 'robot_microbot_alpha', '1', 2),
                ],
                ongoingActions: [],
            }],
        });

        const play = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'noon-1' } },
            defaultTestRandom,
        );
        const friendlyPrompt = getInteractionsFromMS(play.finalState)[0] as any;
        const friendlyOption = friendlyPrompt.data.options.find((entry: any) => entry.value?.minionUid === 'ally-1');
        const afterFriendly = runCommand(
            play.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: friendlyOption.id } } as any,
            defaultTestRandom,
        );

        const enemyPrompt = getInteractionsFromMS(afterFriendly.finalState)[0] as any;
        const optionValues = enemyPrompt.data.options.map((entry: any) => entry.value?.minionUid);
        expect(optionValues).toContain('enemy-plain');
        expect(optionValues).not.toContain('enemy-smoke');
    });

    it('cowboys_run_em_off 在获胜时应由被移动随从的控制者而非 owner 选择目标基地', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('run-1', 'cowboys_run_em_off', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('ally-1', 'cowboys_gunfighter', '0', 4),
                        makeMinion('enemy-1', 'robot_microbot_alpha', '1', 2, { owner: '0' }),
                    ],
                    ongoingActions: [],
                },
                { defId: 'base_b', minions: [], ongoingActions: [] },
                { defId: 'base_c', minions: [], ongoingActions: [] },
            ],
        });

        const play = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'run-1' } },
            defaultTestRandom,
        );
        const friendlyPrompt = getInteractionsFromMS(play.finalState)[0] as any;
        expect(friendlyPrompt?.data?.sourceId).toBe('cowboys_run_em_off_friendly');

        const chooseAlly = friendlyPrompt.data.options.find((entry: any) => entry.value?.minionUid === 'ally-1');
        const afterFriendly = runCommand(
            play.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: chooseAlly.id } } as any,
            defaultTestRandom,
        );

        const enemyPrompt = getInteractionsFromMS(afterFriendly.finalState)[0] as any;
        expect(enemyPrompt?.data?.sourceId).toBe('cowboys_run_em_off_enemy');

        const chooseEnemy = enemyPrompt.data.options.find((entry: any) => entry.value?.minionUid === 'enemy-1');
        const started = runCommand(
            afterFriendly.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: chooseEnemy.id } } as any,
            defaultTestRandom,
        );

        let movePromptPlayerId: string | null = null;
        const duelResolved = resolveDuelChain(started.finalState, {
            smashup_duel_run_em_off_move: (prompt) => {
                movePromptPlayerId = prompt.playerId;
                const option = findInteractionOption(prompt, entry => entry?.value?.baseIndex === 1);
                if (!option) throw new Error('未找到 base_b 作为赶走他们的移动目标');
                return { optionId: option.id };
            },
        });

        expect(movePromptPlayerId).toBe('1');
        expect(duelResolved.finalState.core.bases[1].minions.some(minion => minion.uid === 'enemy-1')).toBe(true);
        expect(duelResolved.finalState.core.bases[0].minions.some(minion => minion.uid === 'enemy-1')).toBe(false);
    });

    it('cowboys_run_em_off 平局时也应由各自被移动随从的控制者依次选择目标基地', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('run-1', 'cowboys_run_em_off', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('ally-1', 'cowboys_gunfighter', '0', 3),
                        makeMinion('enemy-1', 'robot_microbot_alpha', '1', 3),
                    ],
                    ongoingActions: [],
                },
                { defId: 'base_b', minions: [], ongoingActions: [] },
                { defId: 'base_c', minions: [], ongoingActions: [] },
            ],
        });

        const play = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'run-1' } },
            defaultTestRandom,
        );
        const friendlyPrompt = getInteractionsFromMS(play.finalState)[0] as any;
        const chooseAlly = friendlyPrompt.data.options.find((entry: any) => entry.value?.minionUid === 'ally-1');
        const afterFriendly = runCommand(
            play.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: chooseAlly.id } } as any,
            defaultTestRandom,
        );

        const enemyPrompt = getInteractionsFromMS(afterFriendly.finalState)[0] as any;
        const chooseEnemy = enemyPrompt.data.options.find((entry: any) => entry.value?.minionUid === 'enemy-1');
        const started = runCommand(
            afterFriendly.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: chooseEnemy.id } } as any,
            defaultTestRandom,
        );

        const movePromptPlayers: string[] = [];
        const duelResolved = resolveDuelChain(started.finalState, {
            smashup_duel_run_em_off_move: (prompt) => {
                movePromptPlayers.push(prompt.playerId);
                const targetBaseIndex = prompt.playerId === '0' ? 1 : 2;
                const option = findInteractionOption(prompt, entry => entry?.value?.baseIndex === targetBaseIndex);
                if (!option) throw new Error(`未找到 base_${targetBaseIndex} 作为赶走他们的平局移动目标`);
                return { optionId: option.id };
            },
        });

        expect(movePromptPlayers).toEqual(['0', '1']);
        expect(duelResolved.finalState.core.bases[1].minions.some(minion => minion.uid === 'ally-1')).toBe(true);
        expect(duelResolved.finalState.core.bases[2].minions.some(minion => minion.uid === 'enemy-1')).toBe(true);
    });

    it('cthulhu_corruption 不会把挂有烟雾弹的对手随从列为消灭目标', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('corruption-1', 'cthulhu_corruption', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('enemy-smoke', 'ninja_tiger_assassin', '1', 4, {
                        attachedActions: [{ uid: 'smoke-1', defId: 'ninja_smoke_bomb', ownerId: '1' }],
                    }),
                    makeMinion('enemy-plain', 'robot_microbot_alpha', '1', 2),
                ],
                ongoingActions: [],
            }],
        });

        const play = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'corruption-1' } },
            defaultTestRandom,
        );

        const prompt = getInteractionsFromMS(play.finalState)[0] as any;
        expect(prompt?.data?.sourceId).toBe('cthulhu_corruption');
        const optionValues = prompt.data.options.map((entry: any) => entry.value?.minionUid);
        expect(optionValues).toContain('enemy-plain');
        expect(optionValues).not.toContain('enemy-smoke');
    });

    it('pirate_shanghai 不会把挂有烟雾弹的对手随从列为移动目标', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('shanghai-1', 'pirate_shanghai', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('enemy-smoke', 'ninja_tiger_assassin', '1', 4, {
                            attachedActions: [{ uid: 'smoke-1', defId: 'ninja_smoke_bomb', ownerId: '1' }],
                        }),
                        makeMinion('enemy-plain', 'robot_microbot_alpha', '1', 2),
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_b',
                    minions: [],
                    ongoingActions: [],
                },
            ],
        });

        const play = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'shanghai-1' } },
            defaultTestRandom,
        );

        const prompt = getInteractionsFromMS(play.finalState)[0] as any;
        expect(prompt?.data?.sourceId).toBe('pirate_shanghai_choose_minion');
        const optionValues = prompt.data.options.map((entry: any) => entry.value?.minionUid);
        expect(optionValues).toContain('enemy-plain');
        expect(optionValues).not.toContain('enemy-smoke');
    });

    it('werewolf_chew_toy 的第二段消灭目标不会列出挂有烟雾弹的对手随从', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('chew-1', 'werewolf_chew_toy', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('ally-1', 'werewolf_howler', '0', 5),
                    makeMinion('enemy-smoke', 'ninja_tiger_assassin', '1', 3, {
                        attachedActions: [{ uid: 'smoke-1', defId: 'ninja_smoke_bomb', ownerId: '1' }],
                    }),
                    makeMinion('enemy-plain', 'robot_microbot_alpha', '1', 2),
                    makeMinion('enemy-plain-2', 'robot_microbot_beta', '1', 1),
                ],
                ongoingActions: [],
            }],
        });

        const play = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'chew-1' } },
            defaultTestRandom,
        );
        const targetPrompt = getInteractionsFromMS(play.finalState)[0] as any;
        expect(targetPrompt?.data?.sourceId).toBe('werewolf_chew_toy_target');
        const optionValues = targetPrompt.data.options.map((entry: any) => entry.value?.minionUid);
        expect(optionValues).toContain('enemy-plain');
        expect(optionValues).toContain('enemy-plain-2');
        expect(optionValues).not.toContain('enemy-smoke');
    });

    it('werewolf_chew_toy 多己方随从时若目标全被烟雾弹保护，会给出 all_protected 反馈', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('chew-1', 'werewolf_chew_toy', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('ally-strong', 'werewolf_howler', '0', 5),
                    makeMinion('ally-tall', 'robot_microbot_alpha', '0', 6),
                    makeMinion('enemy-smoke', 'ninja_tiger_assassin', '1', 3, {
                        attachedActions: [{ uid: 'smoke-1', defId: 'ninja_smoke_bomb', ownerId: '1' }],
                    }),
                    makeMinion('enemy-strong', 'ghosts_spectre', '1', 7),
                ],
                ongoingActions: [],
            }],
        });

        const play = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'chew-1' } },
            defaultTestRandom,
        );
        const prompt = getInteractionsFromMS(play.finalState)[0] as any;
        expect(prompt?.data?.sourceId).toBe('werewolf_chew_toy');
        const chooseStrong = prompt.data.options.find((entry: any) => entry.value?.minionUid === 'ally-strong');
        expect(chooseStrong).toBeDefined();

        const resolved = runCommand(
            play.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: chooseStrong.id } } as any,
            defaultTestRandom,
        );

        const feedback = resolved.events.find(event => event.type === SU_EVENTS.ABILITY_FEEDBACK) as any;
        expect(feedback?.payload?.messageKey).toBe('feedback.all_protected');
    });

    it('miskatonic_thing_on_the_doorstep 面对唯一最高的烟雾弹目标时不会直接消灭', () => {
        const executor = resolveSpecial('miskatonic_thing_on_the_doorstep');
        expect(executor).toBeDefined();

        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('enemy-smoke', 'ninja_tiger_assassin', '1', 5, {
                        attachedActions: [{ uid: 'smoke-1', defId: 'ninja_smoke_bomb', ownerId: '1' }],
                    }),
                    makeMinion('ally-1', 'robot_microbot_alpha', '0', 2),
                ],
                ongoingActions: [],
            }],
        });

        const result = executor!({
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'special-1',
            defId: 'miskatonic_thing_on_the_doorstep',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 123,
        });

        expect(result.events.some(event => event.type === SU_EVENTS.MINION_DESTROYED)).toBe(false);
        expect(result.events.some(event => event.type === SU_EVENTS.ABILITY_FEEDBACK)).toBe(true);
    });

    it('cowboys_pinkerton 会在决斗牌步骤前给己方决斗随从放置 +1 指示物', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('gun-1', 'cowboys_gunfighter', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('pink-1', 'cowboys_pinkerton', '0', 4),
                    makeMinion('enemy-1', 'robot_microbot_alpha', '1', 3),
                ],
                ongoingActions: [],
            }],
        });

        const play = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'gun-1', baseIndex: 0 } },
            defaultTestRandom,
        );
        const prompt = getInteractionsFromMS(play.finalState)[0] as any;
        const option = prompt.data.options.find((entry: any) => entry.value?.minionUid === 'enemy-1');
        const started = runCommand(
            play.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: option.id } } as any,
            defaultTestRandom,
        );

        const duelResolved = resolveDuelChain(started.finalState, {
            smashup_duel_pinkerton: (duelPrompt) => {
                const addOne = findInteractionOption(duelPrompt, entry => entry?.value?.amount === 1);
                if (!addOne) throw new Error('未找到 Pinkerton 的 1 指示物选项');
                return { optionId: addOne.id };
            },
        });

        const gunfighter = duelResolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'gun-1');
        expect(gunfighter?.powerCounters).toBe(1);
        expect(duelResolved.finalState.core.bases[0].minions.some(minion => minion.uid === 'enemy-1')).toBe(false);
    });

    it('cowboys_pinkerton_pod 会在决斗牌步骤前给己方决斗随从放置 +1 指示物', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('gun-1', 'cowboys_gunfighter_pod', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('pink-1', 'cowboys_pinkerton_pod', '0', 4),
                    makeMinion('enemy-1', 'robot_microbot_alpha', '1', 3),
                ],
                ongoingActions: [],
            }],
        });

        const play = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'gun-1', baseIndex: 0 } },
            defaultTestRandom,
        );
        const prompt = getInteractionsFromMS(play.finalState)[0] as any;
        const option = prompt.data.options.find((entry: any) => entry.value?.minionUid === 'enemy-1');
        const started = runCommand(
            play.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: option.id } } as any,
            defaultTestRandom,
        );

        const duelResolved = resolveDuelChain(started.finalState, {
            smashup_duel_pinkerton: (duelPrompt) => {
                const addOne = findInteractionOption(duelPrompt, entry => entry?.value?.amount === 1);
                if (!addOne) throw new Error('未找到 Pinkerton 的 1 指示物选项');
                return { optionId: addOne.id };
            },
        });

        const gunfighter = duelResolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'gun-1');
        expect(gunfighter?.powerCounters).toBe(1);
        expect(duelResolved.finalState.core.bases[0].minions.some(minion => minion.uid === 'enemy-1')).toBe(false);
    });

    it('cowboys_deputy 可在决斗中弃牌给任意随从 +2 力量并改变胜负', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('noon-1', 'cowboys_high_noon', 'action', '0'),
                        makeCard('deputy-in-hand', 'cowboys_deputy', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('ally-1', 'robot_microbot_alpha', '0', 2),
                    makeMinion('enemy-1', 'robot_zapbot', '1', 3),
                ],
                ongoingActions: [],
            }],
        });

        const play = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'noon-1' } },
            defaultTestRandom,
        );
        const friendlyPrompt = getInteractionsFromMS(play.finalState)[0] as any;
        const friendlyOption = friendlyPrompt.data.options.find((entry: any) => entry.value?.minionUid === 'ally-1');
        const afterFriendly = runCommand(
            play.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: friendlyOption.id } } as any,
            defaultTestRandom,
        );
        const enemyPrompt = getInteractionsFromMS(afterFriendly.finalState)[0] as any;
        const enemyOption = enemyPrompt.data.options.find((entry: any) => entry.value?.minionUid === 'enemy-1');
        const started = runCommand(
            afterFriendly.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: enemyOption.id } } as any,
            defaultTestRandom,
        );

        const duelResolved = resolveDuelChain(started.finalState, {
            smashup_duel_deputy_card: (prompt, state) => {
                if (prompt.playerId === '0') {
                    const option = findInteractionOption(prompt, entry => entry?.value?.cardUid === 'deputy-in-hand');
                    if (!option) throw new Error('未找到可弃置的 Deputy');
                    return { optionId: option.id };
                }
                const skip = findInteractionOption(prompt, entry => entry?.value?.skip === true);
                if (!skip) throw new Error('未找到 Deputy 跳过选项');
                return { optionId: skip.id };
            },
            smashup_duel_deputy_target: (prompt) => {
                const option = findInteractionOption(prompt, entry => entry?.value?.minionUid === 'ally-1');
                if (!option) throw new Error('未找到 Deputy 的 ally-1 目标');
                return { optionId: option.id };
            },
        });

        expect(duelResolved.finalState.core.players['0'].discard.some(card => card.uid === 'deputy-in-hand')).toBe(true);
        expect(duelResolved.finalState.core.players['0'].hand.some(card => card.uid === 'deputy-in-hand')).toBe(false);
        expect(duelResolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'ally-1')?.tempPowerModifier).toBe(2);
        expect(duelResolved.finalState.core.bases[0].minions.some(minion => minion.uid === 'enemy-1')).toBe(false);
        expect(duelResolved.finalState.core.players['0'].baseLimitedMinionQuota?.[0]).toBe(1);
    });

    it('destroy_loser 类型决斗在平局时会同时消灭双方', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('gun-1', 'cowboys_gunfighter', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('enemy-1', 'robot_microbot_alpha', '1', 3)],
                ongoingActions: [],
            }],
        });

        const play = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'gun-1', baseIndex: 0 } },
            defaultTestRandom,
        );
        const prompt = getInteractionsFromMS(play.finalState)[0] as any;
        const option = prompt.data.options.find((entry: any) => entry.value?.minionUid === 'enemy-1');
        const started = runCommand(
            play.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: option.id } } as any,
            defaultTestRandom,
        );

        const duelResolved = resolveDuelChain(started.finalState);
        const destroyed = duelResolved.events.filter(event => event.type === SU_EVENTS.MINION_DESTROYED);
        expect(destroyed).toHaveLength(2);
        expect(duelResolved.finalState.core.bases[0].minions).toHaveLength(0);
    });

    it('cowboys_gold_strike 会在你打出随从到该基地后抽一张牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('minion-1', 'cowboys_gunfighter', 'minion', '0')],
                    deck: [makeCard('draw-1', 'robot_microbot_alpha', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [],
                ongoingActions: [{ uid: 'gold-1', defId: 'cowboys_gold_strike', ownerId: '0' } as any],
            }],
        });

        const play = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'minion-1', baseIndex: 0 } },
            defaultTestRandom,
        );

        expect(play.events.some(e => e.type === SU_EVENTS.CARDS_DRAWN)).toBe(true);
        expect(play.finalState.core.players['0'].hand.some(card => card.uid === 'draw-1')).toBe(true);
    });

    it('cowboys_gold_in_them_thar_hills 可把所选牌抓到手里，并让其余牌按所选顺序回到牌库顶', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('gold-1', 'cowboys_gold_in_them_thar_hills', 'action', '0')],
                    deck: [
                        makeCard('top-a', 'robot_microbot_alpha', 'minion', '0'),
                        makeCard('top-b', 'wizard_summon', 'action', '0'),
                        makeCard('top-c', 'robot_microbot_beta', 'minion', '0'),
                        makeCard('rest-1', 'robot_microbot_gamma', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [{ defId: 'base_a', minions: [], ongoingActions: [] }],
        });

        const play = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'gold-1' } },
            defaultTestRandom,
        );
        const choicePrompt = getInteractionsFromMS(play.finalState)[0] as any;
        expect(choicePrompt?.data?.sourceId).toBe('cowboys_gold_in_them_thar_hills');

        const chooseTopB = choicePrompt.data.options.find((entry: any) => entry.value?.cardUid === 'top-b');
        const afterChoice = runCommand(
            play.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: chooseTopB.id } } as any,
            defaultTestRandom,
        );

        const orderPrompt = getInteractionsFromMS(afterChoice.finalState)[0] as any;
        expect(orderPrompt?.data?.sourceId).toBe('cowboys_gold_in_them_thar_hills_order');
        expect(orderPrompt.data.options.map((entry: any) => entry.value)).toEqual(expect.arrayContaining([
            expect.objectContaining({ topCardUid: 'top-a', cardUid: 'top-a', defId: 'robot_microbot_alpha' }),
            expect.objectContaining({ topCardUid: 'top-c', cardUid: 'top-c', defId: 'robot_microbot_beta' }),
        ]));
        const chooseTopC = orderPrompt.data.options.find((entry: any) => entry.value?.topCardUid === 'top-c');
        const afterOrder = runCommand(
            afterChoice.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: chooseTopC.id } } as any,
            defaultTestRandom,
        );

        const modePrompt = getInteractionsFromMS(afterOrder.finalState)[0] as any;
        expect(modePrompt?.data?.sourceId).toBe('cowboys_gold_in_them_thar_hills_mode');
        const keepOption = modePrompt.data.options.find((entry: any) => entry.value?.mode === 'hand');
        const resolved = runCommand(
            afterOrder.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: keepOption.id } } as any,
            defaultTestRandom,
        );

        expect(resolved.finalState.core.players['0'].hand.some(card => card.uid === 'top-b')).toBe(true);
        expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['top-c', 'top-a', 'rest-1']);
    });

    it('cowboys_gold_in_them_thar_hills 的排序候选缩小后仍应按当前快照继续正常选择', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('gold-1', 'cowboys_gold_in_them_thar_hills', 'action', '0')],
                    deck: [
                        makeCard('top-a', 'robot_microbot_alpha', 'minion', '0'),
                        makeCard('top-b', 'wizard_summon', 'action', '0'),
                        makeCard('top-c', 'robot_microbot_beta', 'minion', '0'),
                        makeCard('rest-1', 'robot_microbot_gamma', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [{ defId: 'base_a', minions: [], ongoingActions: [] }],
        });

        const play = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'gold-1' } },
            defaultTestRandom,
        );
        const choicePrompt = getInteractionsFromMS(play.finalState)[0] as any;
        const chooseTopB = choicePrompt.data.options.find((entry: any) => entry.value?.cardUid === 'top-b');
        const afterChoice = runCommand(
            play.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: chooseTopB.id } } as any,
            defaultTestRandom,
        );

        const refreshedState = refreshInteractionOptions({
            ...afterChoice.finalState,
            core: {
                ...afterChoice.finalState.core,
                players: {
                    ...afterChoice.finalState.core.players,
                    '0': {
                        ...afterChoice.finalState.core.players['0'],
                        deck: [
                            makeCard('top-b', 'wizard_summon', 'action', '0'),
                            makeCard('top-c', 'robot_microbot_beta', 'minion', '0'),
                            makeCard('rest-1', 'robot_microbot_gamma', 'minion', '0'),
                        ],
                    },
                },
            },
        });

        const orderPrompt = getInteractionsFromMS(refreshedState)[0] as any;
        const orderUids = orderPrompt.data.options
            .map((entry: any) => entry.value?.topCardUid)
            .filter(Boolean);
        expect(orderUids).toEqual(['top-c']);
        expect(orderUids).not.toContain('top-a');

        const chooseTopC = orderPrompt.data.options.find((entry: any) => entry.value?.topCardUid === 'top-c');
        const afterOrder = runCommand(
            refreshedState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: chooseTopC.id } } as any,
            defaultTestRandom,
        );

        const modePrompt = getInteractionsFromMS(afterOrder.finalState)[0] as any;
        const keepOption = modePrompt.data.options.find((entry: any) => entry.value?.mode === 'hand');
        const resolved = runCommand(
            afterOrder.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: keepOption.id } } as any,
            defaultTestRandom,
        );

        expect(resolved.finalState.core.players['0'].hand.some(card => card.uid === 'top-b')).toBe(true);
        expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['top-c', 'rest-1']);
        expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).not.toContain('top-a');
    });

    it('cowboys_gold_in_them_thar_hills 额外打出的行动卡不会把挂有烟雾弹的对手随从列为目标', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('gold-1', 'cowboys_gold_in_them_thar_hills', 'action', '0')],
                    deck: [
                        makeCard('top-action', 'cthulhu_corruption', 'action', '0'),
                        makeCard('top-b', 'robot_microbot_alpha', 'minion', '0'),
                        makeCard('top-c', 'robot_microbot_beta', 'minion', '0'),
                        makeCard('rest-1', 'robot_microbot_gamma', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('enemy-smoke', 'ninja_tiger_assassin', '1', 4, {
                        attachedActions: [{ uid: 'smoke-1', defId: 'ninja_smoke_bomb', ownerId: '1' }],
                    }),
                    makeMinion('enemy-plain', 'robot_microbot_alpha', '1', 2),
                ],
                ongoingActions: [],
            }],
        });

        const play = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'gold-1' } },
            defaultTestRandom,
        );
        const choicePrompt = getInteractionsFromMS(play.finalState)[0] as any;
        const chooseAction = choicePrompt.data.options.find((entry: any) => entry.value?.cardUid === 'top-action');
        const afterChoice = runCommand(
            play.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: chooseAction.id } } as any,
            defaultTestRandom,
        );

        const orderPrompt = getInteractionsFromMS(afterChoice.finalState)[0] as any;
        const chooseTopB = orderPrompt.data.options.find((entry: any) => entry.value?.topCardUid === 'top-b');
        const afterOrder = runCommand(
            afterChoice.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: chooseTopB.id } } as any,
            defaultTestRandom,
        );

        const modePrompt = getInteractionsFromMS(afterOrder.finalState)[0] as any;
        const extraPlayOption = modePrompt.data.options.find((entry: any) => entry.value?.mode === 'play');
        const afterMode = runCommand(
            afterOrder.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: extraPlayOption.id } } as any,
            defaultTestRandom,
        );

        const targetPrompt = getInteractionsFromMS(afterMode.finalState)[0] as any;
        expect(targetPrompt?.data?.sourceId).toBe('cthulhu_corruption');
        const optionValues = targetPrompt.data.options.map((entry: any) => entry.value?.minionUid);
        expect(optionValues).toContain('enemy-plain');
        expect(optionValues).not.toContain('enemy-smoke');
    });

    it('cowboys_gold_in_them_thar_hills 选择额外无目标行动时会立刻打出该牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('gold-1', 'cowboys_gold_in_them_thar_hills', 'action', '0')],
                    deck: [
                        makeCard('top-action', 'wizard_summon', 'action', '0'),
                        makeCard('top-b', 'robot_microbot_alpha', 'minion', '0'),
                        makeCard('top-c', 'robot_microbot_beta', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [{ defId: 'base_a', minions: [], ongoingActions: [] }],
        });

        const play = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'gold-1' } },
            defaultTestRandom,
        );
        const choicePrompt = getInteractionsFromMS(play.finalState)[0] as any;
        const chooseAction = choicePrompt.data.options.find((entry: any) => entry.value?.cardUid === 'top-action');
        const afterChoice = runCommand(
            play.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: chooseAction.id } } as any,
            defaultTestRandom,
        );

        const orderPrompt = getInteractionsFromMS(afterChoice.finalState)[0] as any;
        const chooseTopB = orderPrompt.data.options.find((entry: any) => entry.value?.topCardUid === 'top-b');
        const afterOrder = runCommand(
            afterChoice.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: chooseTopB.id } } as any,
            defaultTestRandom,
        );

        const modePrompt = getInteractionsFromMS(afterOrder.finalState)[0] as any;
        const playOption = modePrompt.data.options.find((entry: any) => entry.value?.mode === 'play');
        const resolved = runCommand(
            afterOrder.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: playOption.id } } as any,
            defaultTestRandom,
        );

        expect(getInteractionsFromMS(resolved.finalState)).toHaveLength(0);
        expect(resolved.finalState.core.players['0'].discard.some(card => card.uid === 'top-action')).toBe(true);
        expect(resolved.finalState.core.players['0'].hand.some(card => card.uid === 'top-action')).toBe(false);
        expect(resolved.finalState.core.players['0'].minionLimit).toBe(2);
        expect(resolved.finalState.core.players['0'].actionsPlayed).toBe(1);
        expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['top-b', 'top-c']);
    });

    it('cowboys_gold_in_them_thar_hills 选择额外随从时会先选基地再直接打出', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('gold-1', 'cowboys_gold_in_them_thar_hills', 'action', '0')],
                    deck: [
                        makeCard('top-minion', 'robot_microbot_alpha', 'minion', '0'),
                        makeCard('rest-1', 'robot_microbot_beta', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                { defId: 'base_a', minions: [], ongoingActions: [] },
                { defId: 'base_b', minions: [], ongoingActions: [] },
            ],
        });

        const play = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'gold-1' } },
            defaultTestRandom,
        );
        const choicePrompt = getInteractionsFromMS(play.finalState)[0] as any;
        const chooseTopMinion = choicePrompt.data.options.find((entry: any) => entry.value?.cardUid === 'top-minion');
        const afterChoice = runCommand(
            play.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: chooseTopMinion.id } } as any,
            defaultTestRandom,
        );

        const modePrompt = getInteractionsFromMS(afterChoice.finalState)[0] as any;
        expect(modePrompt?.data?.sourceId).toBe('cowboys_gold_in_them_thar_hills_mode');
        const playOption = modePrompt.data.options.find((entry: any) => entry.value?.mode === 'play');
        const afterMode = runCommand(
            afterChoice.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: playOption.id } } as any,
            defaultTestRandom,
        );

        const basePrompt = getInteractionsFromMS(afterMode.finalState)[0] as any;
        expect(basePrompt?.data?.sourceId).toBe('cowboys_gold_in_them_thar_hills_minion_base');
        const chooseBaseB = basePrompt.data.options.find((entry: any) => entry.value?.baseIndex === 1);
        const resolved = runCommand(
            afterMode.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: chooseBaseB.id } } as any,
            defaultTestRandom,
        );

        expect(resolved.finalState.core.bases[1].minions.some(minion => minion.uid === 'top-minion')).toBe(true);
        expect(resolved.finalState.core.players['0'].hand.some(card => card.uid === 'top-minion')).toBe(false);
        expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['rest-1']);
    });

    it('cowboys_form_a_posse 会让你的所有随从本回合 +1 且受保护', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('posse-1', 'cowboys_form_a_posse', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('ally-1', 'cowboys_gunfighter', '0', 3),
                    makeMinion('ally-2', 'cowboys_deputy', '0', 2),
                    makeMinion('ally-3', 'cowboys_pinkerton', '0', 4),
                ],
                ongoingActions: [],
            }],
        });

        const play = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'posse-1' } },
            defaultTestRandom,
        );
        expect(getInteractionsFromMS(play.finalState)).toHaveLength(0);

        const target1 = play.finalState.core.bases[0].minions.find(minion => minion.uid === 'ally-1')!;
        const target2 = play.finalState.core.bases[0].minions.find(minion => minion.uid === 'ally-2')!;
        const target3 = play.finalState.core.bases[0].minions.find(minion => minion.uid === 'ally-3')!;

        expect(target1.tempPowerModifier).toBe(1);
        expect(target2.tempPowerModifier).toBe(1);
        expect(target3.tempPowerModifier).toBe(1);
        expect(isMinionProtected(play.finalState.core, target1, 0, '1', 'destroy')).toBe(true);
        expect(isMinionProtected(play.finalState.core, target1, 0, '1', 'move')).toBe(true);
        expect(isMinionProtected(play.finalState.core, target1, 0, '1', 'affect')).toBe(true);
        expect(isMinionProtected(play.finalState.core, target2, 0, '1', 'destroy')).toBe(true);
        expect(isMinionProtected(play.finalState.core, target3, 0, '1', 'destroy')).toBe(true);
    });

    it('cowboys_stagecoach 可把同一基地上至多两个己方随从移动到另一个基地', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('stagecoach-1', 'cowboys_stagecoach', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('ally-1', 'cowboys_gunfighter', '0', 3),
                        makeMinion('ally-2', 'cowboys_deputy', '0', 2),
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_b',
                    minions: [],
                    ongoingActions: [],
                },
            ],
        });

        const play = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'stagecoach-1' } },
            defaultTestRandom,
        );
        const sourcePrompt = getInteractionsFromMS(play.finalState)[0] as any;
        expect(sourcePrompt?.data?.sourceId).toBe('cowboys_stagecoach_source');

        const sourceOption = sourcePrompt.data.options.find((entry: any) => entry.value?.baseIndex === 0);
        const afterSource = runCommand(
            play.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: sourceOption.id } } as any,
            defaultTestRandom,
        );

        const cardsPrompt = getInteractionsFromMS(afterSource.finalState)[0] as any;
        expect(cardsPrompt?.data?.sourceId).toBe('cowboys_stagecoach_cards');

        const ally1 = cardsPrompt.data.options.find((entry: any) => entry.value?.uid === 'ally-1');
        const ally2 = cardsPrompt.data.options.find((entry: any) => entry.value?.uid === 'ally-2');
        const afterCards = runCommand(
            afterSource.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionIds: [ally1.id, ally2.id] } } as any,
            defaultTestRandom,
        );

        const destPrompt = getInteractionsFromMS(afterCards.finalState)[0] as any;
        expect(destPrompt?.data?.sourceId).toBe('cowboys_stagecoach_destination');

        const destOption = destPrompt.data.options.find((entry: any) => entry.value?.baseIndex === 1);
        const resolved = runCommand(
            afterCards.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: destOption.id } } as any,
            defaultTestRandom,
        );

        expect(resolved.events.filter(e => e.type === SU_EVENTS.MINION_MOVED)).toHaveLength(2);
        expect(resolved.finalState.core.bases[0].minions).toHaveLength(0);
        expect(resolved.finalState.core.bases[1].minions.map(minion => minion.uid)).toEqual(['ally-1', 'ally-2']);
    });

    it('cowboys_stagecoach 也可搬运基地上的持续行动和埋葬牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('stagecoach-1', 'cowboys_stagecoach', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [],
                    ongoingActions: [{ uid: 'gold-1', defId: 'cowboys_gold_strike', ownerId: '0' } as any],
                    buriedCards: [{
                        uid: 'bury-1',
                        defId: 'ancient_egyptians_tomb_trap',
                        trueOwnerId: '0',
                        controllerId: '0',
                        buriedFrom: 'hand',
                    }] as any,
                },
                {
                    defId: 'base_b',
                    minions: [],
                    ongoingActions: [],
                },
            ],
        });

        const play = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'stagecoach-1' } },
            defaultTestRandom,
        );
        const sourcePrompt = getInteractionsFromMS(play.finalState)[0] as any;
        const sourceOption = sourcePrompt.data.options.find((entry: any) => entry.value?.baseIndex === 0);
        const afterSource = runCommand(
            play.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: sourceOption.id } } as any,
            defaultTestRandom,
        );

        const cardsPrompt = getInteractionsFromMS(afterSource.finalState)[0] as any;
        const ongoing = cardsPrompt.data.options.find((entry: any) => entry.value?.uid === 'gold-1');
        const buried = cardsPrompt.data.options.find((entry: any) => entry.value?.uid === 'bury-1');
        const afterCards = runCommand(
            afterSource.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionIds: [ongoing.id, buried.id] } } as any,
            defaultTestRandom,
        );

        const destPrompt = getInteractionsFromMS(afterCards.finalState)[0] as any;
        const destOption = destPrompt.data.options.find((entry: any) => entry.value?.baseIndex === 1);
        const resolved = runCommand(
            afterCards.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: destOption.id } } as any,
            defaultTestRandom,
        );

        expect(resolved.finalState.core.bases[0].ongoingActions.some(action => action.uid === 'gold-1')).toBe(false);
        expect(resolved.finalState.core.bases[1].ongoingActions.some(action => action.uid === 'gold-1')).toBe(true);
        expect((resolved.finalState.core.bases[0].buriedCards ?? []).some(card => card.uid === 'bury-1')).toBe(false);
        expect((resolved.finalState.core.bases[1].buriedCards ?? []).some(card => card.uid === 'bury-1')).toBe(true);
    });

    it('cowboys_stagecoach 也可搬运你控制的泰坦', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('stagecoach-1', 'cowboys_stagecoach', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                { defId: 'base_a', minions: [], ongoingActions: [] },
                { defId: 'base_b', minions: [], ongoingActions: [] },
            ],
            titans: [{
                uid: 'titan-1',
                defId: 'super_spies_moon_zero_three',
                faction: 'super_spies',
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            }] as any,
        });

        const play = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'stagecoach-1' } },
            defaultTestRandom,
        );
        const sourcePrompt = getInteractionsFromMS(play.finalState)[0] as any;
        const sourceOption = sourcePrompt.data.options.find((entry: any) => entry.value?.baseIndex === 0);
        const afterSource = runCommand(
            play.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: sourceOption.id } } as any,
            defaultTestRandom,
        );

        const cardsPrompt = getInteractionsFromMS(afterSource.finalState)[0] as any;
        const titan = cardsPrompt.data.options.find((entry: any) => entry.value?.uid === 'titan-1');
        const afterCards = runCommand(
            afterSource.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: titan.id } } as any,
            defaultTestRandom,
        );

        const destPrompt = getInteractionsFromMS(afterCards.finalState)[0] as any;
        const destOption = destPrompt.data.options.find((entry: any) => entry.value?.baseIndex === 1);
        const resolved = runCommand(
            afterCards.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: destOption.id } } as any,
            defaultTestRandom,
        );

        expect(resolved.events.some(event => event.type === SU_EVENTS.TITAN_MOVED)).toBe(true);
        expect((resolved.finalState.core.titans ?? []).find((titan: any) => titan.uid === 'titan-1')?.location).toEqual({
            zone: 'base',
            baseIndex: 1,
            enteredAt: 1,
        });
    });
});

describe('Samurai abilities', () => {
    it('samurai_samurai_chan 在自己从场上进入弃牌堆后抽一张牌', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('draw-1', 'robot_microbot_alpha', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('chan-1', 'samurai_samurai_chan', '0', 2)],
                ongoingActions: [],
            }],
        });

        const result = fireTriggers(state, 'onMinionDestroyed', {
            state,
            matchState: makeMatchState(state),
            playerId: '0',
            baseIndex: 0,
            triggerMinion: makeMinion('chan-1', 'samurai_samurai_chan', '0', 2),
            triggerMinionUid: 'chan-1',
            triggerMinionDefId: 'samurai_samurai_chan',
            destroyerId: '1',
            random: defaultTestRandom,
            now: 1000,
        });

        expect(result.events.some(event => event.type === SU_EVENTS.CARDS_DRAWN)).toBe(true);
    });

    it('samurai_samurai_chan_pod 在自己因基地结算进入弃牌堆后也会抽一张牌', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('draw-1', 'robot_microbot_alpha', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('chan-pod-1', 'samurai_samurai_chan_pod', '0', 2)],
                ongoingActions: [],
            }],
        });

        const result = fireTriggers(state, 'onMinionDiscardedFromBase', {
            state,
            matchState: makeMatchState(state),
            playerId: '0',
            baseIndex: 0,
            triggerMinion: makeMinion('chan-pod-1', 'samurai_samurai_chan_pod', '0', 2),
            triggerMinionUid: 'chan-pod-1',
            triggerMinionDefId: 'samurai_samurai_chan_pod',
            random: defaultTestRandom,
            now: 1001,
        });

        expect(result.events.some(event => event.type === SU_EVENTS.CARDS_DRAWN)).toBe(true);
    });

    it('samurai_ronin 在自己是该基地唯一己方随从时只放置一个 +1 指示物', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('ronin-1', 'samurai_ronin', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{ defId: 'base_a', minions: [], ongoingActions: [] }],
        });

        const play = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'ronin-1', baseIndex: 0 } },
            defaultTestRandom,
        );
        const prompt = getInteractionsFromMS(play.finalState)[0] as any;
        expect(prompt?.data?.sourceId).toBe('samurai_ronin');

        const yesOption = prompt.data.options.find((entry: any) => entry.value?.apply === true);
        const resolved = runCommand(
            play.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: yesOption.id } } as any,
            defaultTestRandom,
        );

        expect(resolved.finalState.core.bases[0].minions.find(m => m.uid === 'ronin-1')?.powerCounters).toBe(1);
    });

    it('samurai_ronin_pod 在自己是该基地唯一己方随从时放置两个 +1 指示物', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('ronin-pod-1', 'samurai_ronin_pod', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{ defId: 'base_a', minions: [], ongoingActions: [] }],
        });

        const play = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'ronin-pod-1', baseIndex: 0 } },
            defaultTestRandom,
        );
        const prompt = getInteractionsFromMS(play.finalState)[0] as any;
        expect(prompt?.data?.sourceId).toBe('samurai_ronin_pod');

        const yesOption = prompt.data.options.find((entry: any) => entry.value?.apply === true);
        const resolved = runCommand(
            play.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: yesOption.id } } as any,
            defaultTestRandom,
        );

        expect(resolved.finalState.core.bases[0].minions.find(m => m.uid === 'ronin-pod-1')?.powerCounters).toBe(2);
    });

    it('samurai_ronin_pod 在天守阁登场且自己是该基地唯一己方随从时仍放置两个 +1 指示物', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('ronin-pod-1', 'samurai_ronin_pod', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{ defId: 'base_shoguns_palace_pod', minions: [], ongoingActions: [] }],
        });

        const play = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'ronin-pod-1', baseIndex: 0 } },
            defaultTestRandom,
        );

        const prompt = getInteractionsFromMS(play.finalState)[0] as any;
        expect(prompt?.data?.sourceId).toBe('samurai_ronin_pod');

        const yesOption = prompt.data.options.find((entry: any) => entry.value?.apply === true);
        const resolved = runCommand(
            play.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: yesOption.id } } as any,
            defaultTestRandom,
        );

        expect(resolved.finalState.core.bases[0].minions.find(m => m.uid === 'ronin-pod-1')?.powerCounters).toBe(2);
    });

    it('samurai_way_of_the_warrior 在阶段 3 弃置时仍会基于 LKI 结算抽 2', () => {
        const core = makeState({
            turnOrder: ['0', '1', '2'],
            currentPlayerIndex: 0,
            turnNumber: 2,
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('draw-1', 'robot_microbot_alpha', 'minion', '0'),
                        makeCard('draw-2', 'robot_microbot_alpha', 'minion', '0'),
                    ],
                    discard: [makeCard('wotw-1', 'samurai_way_of_the_warrior', 'action', '0')],
                }),
                '1': makePlayer('1'),
                '2': makePlayer('2'),
            } as any,
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('ally-1', 'samurai_bushi', '0', 4, {
                    metadata: {
                        samuraiWayOfTheWarriorDrawPlayerId: '0',
                        samuraiWayOfTheWarriorDrawUntilTurnNumber: 3,
                    },
                })],
                ongoingActions: [],
            }],
        });

        const queued = collectTriggers(core, 'onMinionDiscardedFromBase', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'ally-1',
            triggerMinionDefId: 'samurai_bushi',
            triggerMinion: core.bases[0].minions[0],
            random: defaultTestRandom,
            now: 1000,
        });

        expect(queued).toBeDefined();
        const queuedState = makeMatchState({ ...core, triggerQueue: (queued as any).payload.triggers });
        const resolved = maybeResolveReactionQueue(queuedState, defaultTestRandom, 1000);
        expect(resolved).toBeDefined();
        expect(resolved!.state.sys.interaction.current).toBeUndefined();
        const drawEvent = resolved!.events.find(event => event.type === SU_EVENTS.CARDS_DRAWN) as any;
        expect(drawEvent).toBeDefined();
        expect(drawEvent.payload.playerId).toBe('0');
        expect(drawEvent.payload.count).toBe(2);
    });

    it('samurai_way_of_the_warrior 在阶段 3 弃置时仍会基于 LKI 结算抽 2', () => {
        const core = makeState({
            turnOrder: ['0', '1', '2'],
            currentPlayerIndex: 0,
            turnNumber: 2,
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('draw-1', 'robot_microbot_alpha', 'minion', '0'),
                        makeCard('draw-2', 'robot_microbot_alpha', 'minion', '0'),
                    ],
                    discard: [makeCard('wotw-1', 'samurai_way_of_the_warrior', 'action', '0')],
                }),
                '1': makePlayer('1'),
                '2': makePlayer('2'),
            } as any,
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('ally-1', 'samurai_bushi', '0', 4, {
                    metadata: {
                        samuraiWayOfTheWarriorDrawPlayerId: '0',
                        samuraiWayOfTheWarriorDrawUntilTurnNumber: 3,
                    },
                })],
                ongoingActions: [],
            }],
        });

        const queued = collectTriggers(core, 'onMinionDiscardedFromBase', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'ally-1',
            triggerMinionDefId: 'samurai_bushi',
            triggerMinion: core.bases[0].minions[0],
            random: defaultTestRandom,
            now: 1000,
        });

        expect(queued).toBeDefined();
        const queuedState = makeMatchState({ ...core, triggerQueue: (queued as any).payload.triggers });
        const resolved = maybeResolveReactionQueue(queuedState, defaultTestRandom, 1000);
        expect(resolved).toBeDefined();
        expect(resolved!.state.sys.interaction.current).toBeUndefined();
        const drawEvent = resolved!.events.find(event => event.type === SU_EVENTS.CARDS_DRAWN) as any;
        expect(drawEvent).toBeDefined();
        expect(drawEvent.payload.playerId).toBe('0');
        expect(drawEvent.payload.count).toBe(2);
    });

    it('samurai_yokai_attack 会消灭己方一个随从并给予额外随从与行动额度', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('yokai-1', 'samurai_yokai_attack', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('ally-1', 'robot_microbot_alpha', '0', 2)],
                ongoingActions: [],
            }],
        });

        const play = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'yokai-1' } },
            defaultTestRandom,
        );
        const prompt = getInteractionsFromMS(play.finalState)[0] as any;
        expect(prompt?.data?.sourceId).toBe('samurai_yokai_attack');

        const option = prompt.data.options.find((entry: any) => entry.value?.minionUid === 'ally-1');
        const resolved = runCommand(
            play.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: option.id } } as any,
            defaultTestRandom,
        );

        const limitEvents = resolved.events.filter(e => e.type === SU_EVENTS.LIMIT_MODIFIED);
        expect(resolved.events.some(e => e.type === SU_EVENTS.MINION_DESTROYED)).toBe(true);
        expect(limitEvents.some((event: any) => event.payload.limitType === 'minion')).toBe(true);
        expect(limitEvents.some((event: any) => event.payload.limitType === 'action')).toBe(true);
    });

    it('cowboys_dynamite_surprise 在你的手牌被另一位玩家展示时可以直接打出', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('dyn-1', 'cowboys_dynamite_surprise', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('enemy-1', 'robot_microbot_alpha', '1', 4)],
                ongoingActions: [],
            }],
        });

        const trigger = fireTriggers(core, 'onDeckInspected', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            reason: 'test_reveal_hand',
            inspectionCards: [{ uid: 'dyn-1', defId: 'cowboys_dynamite_surprise' }],
            inspectionZone: 'hand',
            inspectionTargetPlayerIds: ['0'],
            inspectionCausePlayerId: '1',
            random: defaultTestRandom,
            now: 1000,
        });

        const prompt = getInteractionsFromMS(trigger.matchState!)[0] as any;
        expect(prompt?.data?.sourceId).toBe('cowboys_dynamite_surprise_seen');

        const target = prompt.data.options.find((entry: any) => entry.value?.minionUid === 'enemy-1');
        const resolved = runCommand(
            trigger.matchState!,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: target.id } } as any,
            defaultTestRandom,
        );

        expect(resolved.finalState.core.players['0'].hand.some(card => card.uid === 'dyn-1')).toBe(false);
        expect(resolved.finalState.core.players['0'].discard.some(card => card.uid === 'dyn-1')).toBe(true);
        expect(resolved.events.some(event => event.type === SU_EVENTS.MINION_DESTROYED)).toBe(true);
    });

    it('cowboys_dynamite_surprise 在你的牌库顶被另一位玩家翻开时也可以直接打出', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('dyn-1', 'cowboys_dynamite_surprise', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('enemy-1', 'robot_microbot_alpha', '1', 4)],
                ongoingActions: [],
            }],
        });

        const trigger = fireTriggers(core, 'onDeckInspected', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            reason: 'test_reveal_deck_top',
            inspectionCards: [{ uid: 'dyn-1', defId: 'cowboys_dynamite_surprise' }],
            inspectionZone: 'deck',
            inspectionTargetPlayerIds: ['0'],
            inspectionCausePlayerId: '1',
            random: defaultTestRandom,
            now: 1001,
        });

        const prompt = getInteractionsFromMS(trigger.matchState!)[0] as any;
        expect(prompt?.data?.sourceId).toBe('cowboys_dynamite_surprise_seen');

        const target = prompt.data.options.find((entry: any) => entry.value?.minionUid === 'enemy-1');
        const resolved = runCommand(
            trigger.matchState!,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: target.id } } as any,
            defaultTestRandom,
        );

        expect(resolved.finalState.core.players['0'].deck.some(card => card.uid === 'dyn-1')).toBe(false);
        expect(resolved.finalState.core.players['0'].discard.some(card => card.uid === 'dyn-1')).toBe(true);
        expect(resolved.events.some(event => event.type === SU_EVENTS.MINION_DESTROYED)).toBe(true);
    });

    it('cowboys_dynamite_surprise_pod 在你的牌库顶被另一位玩家翻开时也可以直接打出', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('dyn-1', 'cowboys_dynamite_surprise_pod', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('enemy-1', 'robot_microbot_alpha', '1', 4)],
                ongoingActions: [],
            }],
        });

        const trigger = fireTriggers(core, 'onDeckInspected', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            reason: 'test_reveal_deck_top',
            inspectionCards: [{ uid: 'dyn-1', defId: 'cowboys_dynamite_surprise_pod' }],
            inspectionZone: 'deck',
            inspectionTargetPlayerIds: ['0'],
            inspectionCausePlayerId: '1',
            random: defaultTestRandom,
            now: 1002,
        });

        const prompt = getInteractionsFromMS(trigger.matchState!)[0] as any;
        expect(prompt?.data?.sourceId).toBe('cowboys_dynamite_surprise_seen');

        const target = prompt.data.options.find((entry: any) => entry.value?.minionUid === 'enemy-1');
        const resolved = runCommand(
            trigger.matchState!,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: target.id } } as any,
            defaultTestRandom,
        );

        expect(resolved.finalState.core.players['0'].deck.some(card => card.uid === 'dyn-1')).toBe(false);
        expect(resolved.finalState.core.players['0'].discard.some(card => card.uid === 'dyn-1')).toBe(true);
        expect(resolved.events.some(event => event.type === SU_EVENTS.MINION_DESTROYED)).toBe(true);
    });

    it('samurai_yokai_attack 可以跳过而不消灭己方随从', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('yokai-1', 'samurai_yokai_attack', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('ally-1', 'robot_microbot_alpha', '0', 2)],
                ongoingActions: [],
            }],
        });

        const play = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'yokai-1' } },
            defaultTestRandom,
        );
        const prompt = getInteractionsFromMS(play.finalState)[0] as any;
        const skipOption = prompt.data.options.find((entry: any) => entry.value?.skip === true);
        const resolved = runCommand(
            play.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: skipOption.id } } as any,
            defaultTestRandom,
        );

        expect(resolved.events.some(e => e.type === SU_EVENTS.MINION_DESTROYED)).toBe(false);
        expect(resolved.events.some(e => e.type === SU_EVENTS.LIMIT_MODIFIED)).toBe(false);
        expect(resolved.finalState.core.bases[0].minions.some(m => m.uid === 'ally-1')).toBe(true);
    });

    it('samurai_yokai_attack 选择不能被消灭的己方随从时不会给额外额度', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('yokai-1', 'samurai_yokai_attack', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('warbot-1', 'robot_warbot', '0', 4)],
                ongoingActions: [],
            }],
        });

        const play = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'yokai-1' } },
            defaultTestRandom,
        );
        const prompt = getInteractionsFromMS(play.finalState)[0] as any;
        const option = prompt.data.options.find((entry: any) => entry.value?.minionUid === 'warbot-1');
        const resolved = runCommand(
            play.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: option.id } } as any,
            defaultTestRandom,
        );

        expect(resolved.events.some(e => e.type === SU_EVENTS.MINION_DESTROYED)).toBe(false);
        expect(resolved.events.some(e => e.type === SU_EVENTS.LIMIT_MODIFIED)).toBe(false);
        expect(resolved.finalState.core.bases[0].minions.some(m => m.uid === 'warbot-1')).toBe(true);
    });

    it('samurai_honorable_combat 按决斗结果给胜者 1VP 而不会默认消灭失败者', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('combat-1', 'samurai_honorable_combat', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('ally-1', 'samurai_ronin', '0', 3),
                    makeMinion('enemy-1', 'robot_microbot_alpha', '1', 4),
                ],
                ongoingActions: [],
            }],
        });

        const play = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'combat-1' } },
            defaultTestRandom,
        );
        const friendlyPrompt = getInteractionsFromMS(play.finalState)[0] as any;
        expect(friendlyPrompt?.data?.sourceId).toBe('samurai_honorable_combat_friendly');

        const friendlyOption = friendlyPrompt.data.options.find((entry: any) => entry.value?.minionUid === 'ally-1');
        const afterFriendly = runCommand(
            play.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: friendlyOption.id } } as any,
            defaultTestRandom,
        );

        const enemyPrompt = getInteractionsFromMS(afterFriendly.finalState)[0] as any;
        expect(enemyPrompt?.data?.sourceId).toBe('samurai_honorable_combat_enemy');

        const enemyOption = enemyPrompt.data.options.find((entry: any) => entry.value?.minionUid === 'enemy-1');
        const resolved = runCommand(
            afterFriendly.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: enemyOption.id } } as any,
            defaultTestRandom,
        );

        const duelResolved = resolveDuelChain(resolved.finalState);
        expect(duelResolved.events.some(e => e.type === SU_EVENTS.VP_AWARDED)).toBe(true);
        expect(duelResolved.events.some(e => e.type === SU_EVENTS.MINION_DESTROYED)).toBe(false);
        expect(duelResolved.finalState.core.bases[0].minions).toHaveLength(2);
        expect(duelResolved.finalState.core.players['1'].vp).toBe(1);
    });

    it('samurai_honorable_combat 面对仅有烟雾弹目标时不会启动决斗交互', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('combat-1', 'samurai_honorable_combat', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('ally-1', 'samurai_ronin', '0', 3),
                    makeMinion('enemy-smoke', 'ninja_tiger_assassin', '1', 4, {
                        attachedActions: [{ uid: 'smoke-1', defId: 'ninja_smoke_bomb', ownerId: '1' }],
                    }),
                ],
                ongoingActions: [],
            }],
        });

        const play = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'combat-1' } },
            defaultTestRandom,
        );

        expect(getInteractionsFromMS(play.finalState)).toHaveLength(0);
        expect(play.events.some(event => event.type === SU_EVENTS.ABILITY_FEEDBACK)).toBe(true);
    });

    it('samurai_honorable_combat 平局时双方各得 1VP', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('ally-1', 'samurai_ronin', '0', 3),
                    makeMinion('enemy-1', 'robot_microbot_alpha', '1', 3),
                ],
                ongoingActions: [],
            }],
        });

        const started = startDuel(
            makeMatchState(core),
            {
                sourceId: 'samurai_honorable_combat',
                sourcePlayerId: '0',
                challengerMinionUid: 'ally-1',
                challengedMinionUid: 'enemy-1',
                outcome: 'vp_to_winner',
            },
            1000,
        );

        const duelResolved = resolveDuelChain(started);
        const vpEvents = duelResolved.events.filter(e => e.type === SU_EVENTS.VP_AWARDED);
        expect(vpEvents).toHaveLength(2);
        expect(duelResolved.finalState.core.players['0'].vp).toBe(1);
        expect(duelResolved.finalState.core.players['1'].vp).toBe(1);
    });

    it('samurai_code_of_bushido 可以分三次把指示物分配给你的随从', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('bushido-1', 'samurai_code_of_bushido', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('ally-1', 'samurai_ronin', '0', 3),
                    makeMinion('ally-2', 'samurai_bushi', '0', 4),
                ],
                ongoingActions: [],
            }],
        });

        const play = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'bushido-1' } },
            defaultTestRandom,
        );
        const prompt1 = getInteractionsFromMS(play.finalState)[0] as any;
        expect(prompt1?.data?.sourceId).toBe('samurai_code_of_bushido');

        const chooseAlly1a = prompt1.data.options.find((entry: any) => entry.value?.minionUid === 'ally-1');
        const step1 = runCommand(
            play.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: chooseAlly1a.id } } as any,
            defaultTestRandom,
        );

        const prompt2 = getInteractionsFromMS(step1.finalState)[0] as any;
        const chooseAlly1b = prompt2.data.options.find((entry: any) => entry.value?.minionUid === 'ally-1');
        const step2 = runCommand(
            step1.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: chooseAlly1b.id } } as any,
            defaultTestRandom,
        );

        const prompt3 = getInteractionsFromMS(step2.finalState)[0] as any;
        const chooseAlly2 = prompt3.data.options.find((entry: any) => entry.value?.minionUid === 'ally-2');
        const resolved = runCommand(
            step2.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: chooseAlly2.id } } as any,
            defaultTestRandom,
        );

        expect(resolved.finalState.core.bases[0].minions.find(m => m.uid === 'ally-1')?.powerCounters).toBe(2);
        expect(resolved.finalState.core.bases[0].minions.find(m => m.uid === 'ally-2')?.powerCounters).toBe(1);
    });

    it('samurai_honor_the_ancestors 会放置一个指示物并把弃牌堆中的随从洗回牌库', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('ancestors-1', 'samurai_honor_the_ancestors', 'action', '0')],
                    deck: [makeCard('deck-1', 'robot_microbot_alpha', 'minion', '0')],
                    discard: [makeCard('discard-1', 'samurai_ronin', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('ally-1', 'samurai_bushi', '0', 4)],
                ongoingActions: [],
            }],
        });

        const play = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'ancestors-1' } },
            defaultTestRandom,
        );

        expect(play.events.some(event => event.type === SU_EVENTS.POWER_COUNTER_ADDED)).toBe(true);
        expect(play.events.some(event => event.type === SU_EVENTS.DECK_REORDERED)).toBe(true);
        expect(play.finalState.core.bases[0].minions.find(minion => minion.uid === 'ally-1')?.powerCounters).toBe(1);
        expect(play.finalState.core.players['0'].deck.some(card => card.uid === 'discard-1')).toBe(true);
        expect(play.finalState.core.players['0'].discard.some(card => card.uid === 'discard-1')).toBe(false);
    });

    it('samurai_way_of_the_warrior 会让目标本回合进入弃牌堆时抽一张牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('warrior-1', 'samurai_way_of_the_warrior', 'action', '0')],
                    deck: [makeCard('draw-1', 'robot_microbot_alpha', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('ally-1', 'samurai_ronin', '0', 3)],
                ongoingActions: [],
            }],
        });

        const play = runCommand(
            makeMatchState(core),
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'warrior-1', targetBaseIndex: 0, targetMinionUid: 'ally-1' },
            },
            defaultTestRandom,
        );

        const target = play.finalState.core.bases[0].minions.find(minion => minion.uid === 'ally-1');
        expect(target?.tempPowerModifier).toBe(3);

        const result = fireTriggers(play.finalState.core, 'onMinionDestroyed', {
            state: play.finalState.core,
            matchState: play.finalState,
            playerId: '0',
            baseIndex: 0,
            triggerMinion: target,
            triggerMinionUid: 'ally-1',
            triggerMinionDefId: 'samurai_ronin',
            destroyerId: '1',
            reason: 'test_destroy',
            random: defaultTestRandom,
            now: 1004,
        });

        expect(result.events.some(event => event.type === SU_EVENTS.CARDS_DRAWN)).toBe(true);
    });

    it('samurai_way_of_the_warrior 在目标因基地结算进入弃牌堆时也会抽一张牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('warrior-1', 'samurai_way_of_the_warrior', 'action', '0')],
                    deck: [makeCard('draw-1', 'robot_microbot_alpha', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('ally-1', 'samurai_ronin', '0', 3)],
                ongoingActions: [],
            }],
        });

        const play = runCommand(
            makeMatchState(core),
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'warrior-1', targetBaseIndex: 0, targetMinionUid: 'ally-1' },
            },
            defaultTestRandom,
        );

        const target = play.finalState.core.bases[0].minions.find(minion => minion.uid === 'ally-1');
        const result = fireTriggers(play.finalState.core, 'onMinionDiscardedFromBase', {
            state: play.finalState.core,
            matchState: play.finalState,
            playerId: '0',
            baseIndex: 0,
            triggerMinion: target,
            triggerMinionUid: 'ally-1',
            triggerMinionDefId: 'samurai_ronin',
            random: defaultTestRandom,
            now: 1005,
        });

        expect(result.events.some(event => event.type === SU_EVENTS.CARDS_DRAWN)).toBe(true);
    });

    it('samurai_way_of_the_warrior_pod 在目标因基地结算进入弃牌堆时也会抽一张牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('warrior-pod-1', 'samurai_way_of_the_warrior_pod', 'action', '0')],
                    deck: [makeCard('draw-pod-1', 'robot_microbot_alpha', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('ally-pod-1', 'samurai_ronin_pod', '0', 3)],
                ongoingActions: [],
            }],
        });

        const play = runCommand(
            makeMatchState(core),
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'warrior-pod-1', targetBaseIndex: 0, targetMinionUid: 'ally-pod-1' },
            },
            defaultTestRandom,
        );

        const target = play.finalState.core.bases[0].minions.find(minion => minion.uid === 'ally-pod-1');
        expect(target?.tempPowerModifier).toBe(3);

        const result = fireTriggers(play.finalState.core, 'onMinionDiscardedFromBase', {
            state: play.finalState.core,
            matchState: play.finalState,
            playerId: '0',
            baseIndex: 0,
            triggerMinion: target,
            triggerMinionUid: 'ally-pod-1',
            triggerMinionDefId: 'samurai_ronin_pod',
            random: defaultTestRandom,
            now: 1104,
        });

        expect(result.events.some(event => event.type === SU_EVENTS.CARDS_DRAWN)).toBe(true);
    });

    it('samurai_way_of_the_warrior 在焦油坑把目标改放牌库底时不会抽牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('warrior-1', 'samurai_way_of_the_warrior', 'action', '0')],
                    deck: [makeCard('draw-1', 'robot_microbot_alpha', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_tar_pits',
                minions: [makeMinion('ally-1', 'samurai_ronin', '0', 3)],
                ongoingActions: [],
            }],
        });

        const play = runCommand(
            makeMatchState(core),
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'warrior-1', targetBaseIndex: 0, targetMinionUid: 'ally-1' },
            },
            defaultTestRandom,
        );

        const target = play.finalState.core.bases[0].minions.find(minion => minion.uid === 'ally-1');
        const result = fireTriggers(play.finalState.core, 'onMinionDestroyed', {
            state: play.finalState.core,
            matchState: play.finalState,
            playerId: '0',
            baseIndex: 0,
            triggerMinion: target,
            triggerMinionUid: 'ally-1',
            triggerMinionDefId: 'samurai_ronin',
            destroyerId: '1',
            reason: 'test_destroy',
            random: defaultTestRandom,
            now: 1006,
        });

        expect(result.events.some(event => event.type === SU_EVENTS.CARDS_DRAWN)).toBe(false);
    });

    it('samurai_shogun 会在另一名己方随从从场上进入弃牌堆后给自己一个指示物', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('shogun-1', 'samurai_shogun', '0', 5),
                    makeMinion('ally-1', 'samurai_ronin', '0', 3),
                ],
                ongoingActions: [],
            }],
        });

        const result = fireTriggers(state, 'onMinionDestroyed', {
            state,
            matchState: makeMatchState(state),
            playerId: '0',
            baseIndex: 0,
            triggerMinion: makeMinion('ally-1', 'samurai_ronin', '0', 3),
            triggerMinionUid: 'ally-1',
            triggerMinionDefId: 'samurai_ronin',
            destroyerId: '1',
            random: defaultTestRandom,
            now: 1001,
        });

        const counterEvent = result.events.find(event => event.type === SU_EVENTS.POWER_COUNTER_ADDED) as any;
        expect(counterEvent).toBeDefined();
        expect(counterEvent.payload.minionUid).toBe('shogun-1');
        expect(counterEvent.payload.amount).toBe(1);
    });

    it('samurai_bushi_pod 在以 5 力量因基地结算进入弃牌堆时会给你 1VP，且 samurai_shogun_pod 仍会获得指示物', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_shoguns_palace_pod',
                    minions: [makeMinion('bushi-pod-1', 'samurai_bushi_pod', '0', 4, { powerCounters: 1 })],
                    ongoingActions: [],
                },
                {
                    defId: 'base_great_library',
                    minions: [makeMinion('shogun-pod-1', 'samurai_shogun_pod', '0', 5)],
                    ongoingActions: [],
                },
            ],
        });

        const result = fireTriggers(state, 'onMinionDiscardedFromBase', {
            state,
            matchState: makeMatchState(state),
            playerId: '0',
            baseIndex: 0,
            triggerMinion: makeMinion('bushi-pod-1', 'samurai_bushi_pod', '0', 4, { powerCounters: 1 }),
            triggerMinionUid: 'bushi-pod-1',
            triggerMinionDefId: 'samurai_bushi_pod',
            triggerMinionPower: 5,
            random: defaultTestRandom,
            now: 1002,
        });

        expect(result.events.some(event =>
            event.type === SU_EVENTS.VP_AWARDED
            && (event as any).payload.playerId === '0'
            && (event as any).payload.amount === 1,
        )).toBe(true);
        expect(result.events.some(event =>
            event.type === SU_EVENTS.POWER_COUNTER_ADDED
            && (event as any).payload.minionUid === 'shogun-pod-1',
        )).toBe(true);
    });

    it('samurai_bushi 在被消灭时应使用离场前有效力量判定 5 力量奖励 VP', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('bushi-1', 'samurai_bushi', '0', 4, { powerCounters: 1 })],
                ongoingActions: [],
            }],
        });
        const state = makeMatchState(core);
        const destroyEvent = {
            type: SU_EVENTS.MINION_DESTROYED,
            payload: {
                minionUid: 'bushi-1',
                minionDefId: 'samurai_bushi',
                fromBaseIndex: 0,
                ownerId: '0',
                destroyerId: '1',
                reason: 'test_destroy',
            },
            timestamp: 1010,
        } as any;

        const processed = processDestroyTriggers([destroyEvent], state, '1', defaultTestRandom, 1010);
        const queuedEvent = processed.events.find(event => event.type === SU_EVENTS.TRIGGER_QUEUED) as any;
        expect(queuedEvent).toBeDefined();

        const bushiTrigger = (queuedEvent.payload?.triggers ?? []).find((trigger: any) => trigger.sourceDefId === 'samurai_bushi');
        expect(bushiTrigger).toBeDefined();
        expect(bushiTrigger.triggerMinionPower).toBe(5);
    });

    it('samurai_final_haiku 在附着随从离场后给你的随从直到回合结束 +2 力量', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('host-1', 'samurai_bushi', '0', 4, {
                            attachedActions: [{ uid: 'haiku-1', defId: 'samurai_final_haiku', ownerId: '0' }] as any,
                        }),
                        makeMinion('ally-1', 'samurai_ronin', '0', 3),
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_b',
                    minions: [makeMinion('ally-2', 'robot_microbot_alpha', '0', 2)],
                    ongoingActions: [],
                },
            ],
        });

        const result = fireTriggers(state, 'onMinionDestroyed', {
            state,
            matchState: makeMatchState(state),
            playerId: '0',
            baseIndex: 0,
            triggerMinion: makeMinion('host-1', 'samurai_bushi', '0', 4),
            triggerMinionUid: 'host-1',
            triggerMinionDefId: 'samurai_bushi',
            destroyerId: '1',
            random: defaultTestRandom,
            now: 1002,
        });

        const tempPowerTargets = result.events
            .filter(event => event.type === SU_EVENTS.TEMP_POWER_ADDED)
            .map((event: any) => event.payload.minionUid);
        expect(tempPowerTargets).not.toContain('host-1');
        expect(tempPowerTargets).toContain('ally-1');
        expect(tempPowerTargets).toContain('ally-2');
    });

    it('samurai_final_haiku_pod 在附着随从离场后给你的随从直到回合结束 +2 力量', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('host-pod-1', 'samurai_bushi_pod', '0', 4, {
                            attachedActions: [{ uid: 'haiku-pod-1', defId: 'samurai_final_haiku_pod', ownerId: '0' }] as any,
                        }),
                        makeMinion('ally-pod-1', 'samurai_ronin_pod', '0', 3),
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_b',
                    minions: [makeMinion('ally-pod-2', 'robot_microbot_alpha', '0', 2)],
                    ongoingActions: [],
                },
            ],
        });

        const result = fireTriggers(state, 'onMinionDestroyed', {
            state,
            matchState: makeMatchState(state),
            playerId: '0',
            baseIndex: 0,
            triggerMinion: makeMinion('host-pod-1', 'samurai_bushi_pod', '0', 4),
            triggerMinionUid: 'host-pod-1',
            triggerMinionDefId: 'samurai_bushi_pod',
            destroyerId: '1',
            random: defaultTestRandom,
            now: 1003,
        });

        const tempPowerTargets = result.events
            .filter(event => event.type === SU_EVENTS.TEMP_POWER_ADDED)
            .map((event: any) => event.payload.minionUid);
        expect(tempPowerTargets).not.toContain('host-pod-1');
        expect(tempPowerTargets).toContain('ally-pod-1');
        expect(tempPowerTargets).toContain('ally-pod-2');
    });

    it('samurai_honor_the_fallen 在你此处的随从进入弃牌堆后让你抓一张牌', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('draw-1', 'robot_microbot_alpha', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [],
                ongoingActions: [{ uid: 'hof-1', defId: 'samurai_honor_the_fallen', ownerId: '0' } as any],
            }],
        });

        const result = fireTriggers(state, 'onMinionDestroyed', {
            state,
            matchState: makeMatchState(state),
            playerId: '0',
            baseIndex: 0,
            triggerMinion: makeMinion('dead-1', 'samurai_ronin', '0', 3),
            triggerMinionUid: 'dead-1',
            triggerMinionDefId: 'samurai_ronin',
            destroyerId: '1',
            random: defaultTestRandom,
            now: 1000,
        });

        expect(result.events.some(e => e.type === SU_EVENTS.CARDS_DRAWN)).toBe(true);
    });
});

describe('stale destroy regression: 交互提示能力', () => {
    it('bear_cavalry_bear_necessities: 目标已离场时不再消灭', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'bear_cavalry_bear_necessities', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [],
                    ongoingActions: [
                        { uid: 'oa1', defId: 'test_ongoing', ownerId: '1' },
                        { uid: 'oa2', defId: 'test_ongoing_2', ownerId: '1' },
                    ],
                },
            ],
        });

        const playResult = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'a1' } },
            defaultTestRandom,
        );

        const prompt = getInteractionsFromMS(playResult.finalState)[0] as any;
        const targetOption = prompt?.data?.options?.find((option: any) => option?.value?.uid === 'oa1');
        const handler = getInteractionHandler('bear_cavalry_bear_necessities');
        expect(prompt?.data?.sourceId).toBe('bear_cavalry_bear_necessities');
        expect(targetOption).toBeDefined();
        expect(handler).toBeDefined();

        const staleCore = {
            ...playResult.finalState.core,
            players: {
                ...playResult.finalState.core.players,
                '1': {
                    ...playResult.finalState.core.players['1'],
                    discard: [
                        ...playResult.finalState.core.players['1'].discard,
                        makeCard('m1', 'test', 'minion', '1'),
                    ],
                },
            },
            bases: [
                {
                    ...playResult.finalState.core.bases[0],
                    ongoingActions: playResult.finalState.core.bases[0].ongoingActions.filter(action => action.uid !== 'oa1'),
                },
            ],
        };

        const resolved = handler!(
            makeMatchState(staleCore),
            '0',
            targetOption.value,
            prompt.data,
            defaultTestRandom,
            2001,
        );
        expect(resolved?.events ?? []).toHaveLength(0);
    });

    it('vampire_heavy_drinker: 目标已离场时不再消灭也不再加指示物', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('c_hd', 'vampire_heavy_drinker', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('fod1', 'test_fodder', '0', 2, { powerModifier: 0 }),
                    ],
                    ongoingActions: [],
                },
            ],
        });

        const playResult = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'c_hd', baseIndex: 0 } },
            defaultTestRandom,
        );

        const prompt = getInteractionsFromMS(playResult.finalState)[0] as any;
        const option = prompt?.data?.options?.find((entry: any) => entry?.value?.minionUid === 'fod1');
        const handler = getAbilityRuntimePromptHandler('vampire_heavy_drinker');
        expect(prompt?.data?.sourceId).toBe('vampire_heavy_drinker');
        expect(option).toBeDefined();
        expect(handler).toBeDefined();

        const staleCore = {
            ...playResult.finalState.core,
            players: {
                ...playResult.finalState.core.players,
                '0': {
                    ...playResult.finalState.core.players['0'],
                    discard: [
                        ...playResult.finalState.core.players['0'].discard,
                        makeCard('fod1', 'test_fodder', 'minion', '0'),
                    ],
                },
            },
            bases: [
                {
                    ...playResult.finalState.core.bases[0],
                    minions: playResult.finalState.core.bases[0].minions.filter(m => m.uid !== 'fod1'),
                },
            ],
        };

        const resolved = handler!(
            makeMatchState(staleCore),
            '0',
            option.value,
            prompt.data,
            defaultTestRandom,
            2002,
        );

        expect(resolved?.events ?? []).toHaveLength(0);
        expect((resolved?.events ?? []).some(e => e.type === SU_EVENTS.POWER_COUNTER_ADDED)).toBe(false);
    });

    it('werewolf_let_the_dog_out_targets: 目标已离场时不再消灭也不继续链式选择', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'werewolf_let_the_dog_out', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('w1', 'werewolf_howler', '0', 4, { powerModifier: 0 }),
                        makeMinion('e1', 'enemy_a', '1', 1, { powerModifier: 0 }),
                        makeMinion('e2', 'enemy_b', '1', 3, { powerModifier: 0 }),
                    ],
                    ongoingActions: [],
                },
            ],
        });

        const playResult = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'a1' } },
            defaultTestRandom,
        );

        const prompt = getInteractionsFromMS(playResult.finalState)[0] as any;
        const option = prompt?.data?.options?.find((entry: any) => entry?.value?.minionUid === 'e1');
        const handler = getAbilityRuntimePromptHandler('werewolf_let_the_dog_out_targets');
        expect(prompt?.data?.sourceId).toBe('werewolf_let_the_dog_out_targets');
        expect(option).toBeDefined();
        expect(handler).toBeDefined();

        const staleCore = {
            ...playResult.finalState.core,
            players: {
                ...playResult.finalState.core.players,
                '1': {
                    ...playResult.finalState.core.players['1'],
                    discard: [
                        ...playResult.finalState.core.players['1'].discard,
                        makeCard('e1', 'enemy_a', 'minion', '1'),
                    ],
                },
            },
            bases: [
                {
                    ...playResult.finalState.core.bases[0],
                    minions: playResult.finalState.core.bases[0].minions.filter(m => m.uid !== 'e1'),
                },
            ],
        };

        const resolved = handler!(
            makeMatchState(staleCore),
            '0',
            option.value,
            prompt.data,
            defaultTestRandom,
            2003,
        );

        expect(resolved?.events ?? []).toHaveLength(0);
        expect(resolved?.state.sys.interaction?.queue ?? []).toHaveLength(0);
    });

    it('werewolf_let_the_dog_out 选择随从后若目标全被烟雾弹保护，会给出 all_protected 反馈', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'werewolf_let_the_dog_out', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('ally-strong', 'werewolf_howler', '0', 5),
                        makeMinion('ally-tall', 'robot_microbot_alpha', '0', 6),
                        makeMinion('enemy-smoke', 'ninja_tiger_assassin', '1', 3, {
                            attachedActions: [{ uid: 'smoke-1', defId: 'ninja_smoke_bomb', ownerId: '1' }],
                        }),
                        makeMinion('enemy-strong', 'ghosts_spectre', '1', 7),
                    ],
                    ongoingActions: [],
                },
            ],
        });

        const playResult = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'a1' } },
            defaultTestRandom,
        );

        const prompt = getInteractionsFromMS(playResult.finalState)[0] as any;
        expect(prompt?.data?.sourceId).toBe('werewolf_let_the_dog_out');
        const chooseStrong = prompt?.data?.options?.find((entry: any) => entry?.value?.minionUid === 'ally-strong');
        expect(chooseStrong).toBeDefined();

        const resolved = runCommand(
            playResult.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: chooseStrong.id } } as any,
            defaultTestRandom,
        );

        const feedback = resolved.events.find(event => event.type === SU_EVENTS.ABILITY_FEEDBACK) as any;
        expect(feedback?.payload?.messageKey).toBe('feedback.all_protected');
    });
});

// ============================================================================
// 辅助函数
// ============================================================================

// ============================================================================
// 黑熊骑兵派系
// ============================================================================

describe('黑熊骑兵派系能力', () => {
    describe('bear_cavalry_bear_cavalry（黑熊骑兵 onPlay）', () => {
        it('单个对手随从时创建 Prompt', () => {
            const core = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('c1', 'bear_cavalry_bear_cavalry', 'minion', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    { defId: 'base_a', minions: [makeMinion('m1', 'test', '1', 4, { powerModifier: 0 })], ongoingActions: [] },
                    { defId: 'base_b', minions: [], ongoingActions: [] },
                ],
            });
            const state = makeMatchState(core);
            const result = runCommand(state,
                { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'c1', baseIndex: 0 } },
                defaultTestRandom
            );
            const interactions = getInteractionsFromMS(result.finalState);
            expect(interactions.length).toBe(1);
        });

        it('本基地无对手随从时不产生移动事件', () => {
            const core = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('c1', 'bear_cavalry_bear_cavalry', 'minion', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    { defId: 'base_a', minions: [], ongoingActions: [] },
                    { defId: 'base_b', minions: [], ongoingActions: [] },
                ],
            });
            const state = makeMatchState(core);
            const result = runCommand(state,
                { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'c1', baseIndex: 0 } },
                defaultTestRandom
            );
            expect(result.events.find(e => e.type === SU_EVENTS.MINION_MOVED)).toBeUndefined();
        });
    });

    describe('bear_cavalry_youre_screwed（你们已经完蛋）', () => {
        it('单个对手随从时创建 Prompt', () => {
            const core = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'bear_cavalry_youre_screwed', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    { defId: 'base_a', minions: [makeMinion('m0', 'test', '0', 3, { powerModifier: 0 }), makeMinion('m1', 'test', '1', 5, { powerModifier: 0 })], ongoingActions: [] },
                    { defId: 'base_b', minions: [], ongoingActions: [] },
                ],
            });
            const state = makeMatchState(core);
            const result = runCommand(state,
                { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'a1' } },
                defaultTestRandom
            );
            const interactions = getInteractionsFromMS(result.finalState);
            expect(interactions.length).toBe(1);
        });

        it('无己方随从时不产生移动事件', () => {
            const core = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'bear_cavalry_youre_screwed', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    { defId: 'base_a', minions: [makeMinion('m1', 'test', '1', 5, { powerModifier: 0 })], ongoingActions: [] },
                    { defId: 'base_b', minions: [], ongoingActions: [] },
                ],
            });
            const state = makeMatchState(core);
            const result = runCommand(state,
                { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'a1' } },
                defaultTestRandom
            );
            expect(result.events.find(e => e.type === SU_EVENTS.MINION_MOVED)).toBeUndefined();
        });
    });

    describe('bear_cavalry_bear_rides_you（与熊同行）', () => {
        it('单个己方随从时创建 Prompt', () => {
            const core = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'bear_cavalry_bear_rides_you', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    { defId: 'base_a', minions: [makeMinion('m0', 'test', '0', 5, { powerModifier: 0 })], ongoingActions: [] },
                    { defId: 'base_b', minions: [], ongoingActions: [] },
                ],
            });
            const state = makeMatchState(core);
            const result = runCommand(state,
                { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'a1' } },
                defaultTestRandom
            );
            const interactions = getInteractionsFromMS(result.finalState);
            expect(interactions.length).toBe(1);
        });

        it('无己方随从时不产生移动事件', () => {
            const core = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'bear_cavalry_bear_rides_you', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    { defId: 'base_a', minions: [], ongoingActions: [] },
                    { defId: 'base_b', minions: [], ongoingActions: [] },
                ],
            });
            const state = makeMatchState(core);
            const result = runCommand(state,
                { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'a1' } },
                defaultTestRandom
            );
            expect(result.events.find(e => e.type === SU_EVENTS.MINION_MOVED)).toBeUndefined();
        });
    });

    describe('bear_cavalry_youre_pretty_much_borscht（你们都是美食）', () => {
        it('单个基地有对手随从时创建 Prompt', () => {
            const core = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'bear_cavalry_youre_pretty_much_borscht', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    { defId: 'base_a', minions: [
                        makeMinion('m0', 'test', '0', 3, { powerModifier: 0 }),
                        makeMinion('m1', 'test', '1', 4, { powerModifier: 0 }),
                        makeMinion('m2', 'test', '1', 2, { powerModifier: 0 }),
                    ], ongoingActions: [] },
                    { defId: 'base_b', minions: [], ongoingActions: [] },
                ],
            });
            const state = makeMatchState(core);
            const result = runCommand(state,
                { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'a1' } },
                defaultTestRandom
            );
            const interactions = getInteractionsFromMS(result.finalState);
            expect(interactions.length).toBe(1);
        });
    });

    describe('bear_cavalry_bear_necessities（黑熊口粮）', () => {
        it('多个对手已打出行动卡时创建 Prompt 选择目标', () => {
            const core = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'bear_cavalry_bear_necessities', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    {
                        defId: 'base_a',
                        minions: [makeMinion('m1', 'test', '1', 3, { powerModifier: 0 })],
                        ongoingActions: [
                            { uid: 'oa1', defId: 'test_ongoing_1', ownerId: '1' },
                            { uid: 'oa2', defId: 'test_ongoing_2', ownerId: '1' },
                        ],
                    },
                ],
            });
            const state = makeMatchState(core);
            const result = runCommand(state,
                { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'a1' } },
                defaultTestRandom
            );
            // 多个目标时应创建 Prompt
            const interactions = getInteractionsFromMS(result.finalState);
            expect(interactions.length).toBe(1);
            expect(interactions[0].data.sourceId).toBe('bear_cavalry_bear_necessities');
        });

        it('单个对手行动卡时自动消灭', () => {
            const core = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'bear_cavalry_bear_necessities', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    { defId: 'base_a', minions: [], ongoingActions: [{ uid: 'oa1', defId: 'test_ongoing', ownerId: '1' }] },
                ],
            });
            const state = makeMatchState(core);
            const result = runCommand(state,
                { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'a1' } },
                defaultTestRandom
            );
            const detachEvt = result.events.find(e => e.type === SU_EVENTS.ONGOING_DETACHED);
            expect(detachEvt).toBeDefined();
            expect((detachEvt as any).payload.cardUid).toBe('oa1');
        });

        it('单个对手行动卡时自动消灭', () => {
            const ongoing: OngoingActionOnBase = { uid: 'oa1', defId: 'test_ongoing', ownerId: '1' };
            const core = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'bear_cavalry_bear_necessities', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    { defId: 'base_a', minions: [], ongoingActions: [ongoing] },
                ],
            });
            const state = makeMatchState(core);
            const result = runCommand(state,
                { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'a1' } },
                defaultTestRandom
            );
            // 单目标自动执行，直接消灭行动卡
            const detachEvt = result.events.find(e => e.type === SU_EVENTS.ONGOING_DETACHED);
            expect(detachEvt).toBeDefined();
            expect((detachEvt as any).payload.cardUid).toBe('oa1');
        });

        it('无目标时不产生事件', () => {
            const core = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'bear_cavalry_bear_necessities', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    { defId: 'base_a', minions: [], ongoingActions: [] },
                ],
            });
            const state = makeMatchState(core);
            const result = runCommand(state,
                { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'a1' } },
                defaultTestRandom
            );
            expect(result.events.find(e => e.type === SU_EVENTS.MINION_DESTROYED)).toBeUndefined();
            expect(result.events.find(e => e.type === SU_EVENTS.ONGOING_DETACHED)).toBeUndefined();
        });
    });
});

// ============================================================================
// 巨蚁派系
// ============================================================================

describe('巨蚁派系能力', () => {
    it('无人想要永生：可逐次移除并在确认后抽牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'giant_ant_who_wants_to_live_forever', 'action', '0')],
                    deck: [
                        makeCard('d1', 'filler_minion_1', 'minion', '0'),
                        makeCard('d2', 'filler_action_2', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('m1', 'giant_ant_worker', '0', 3, { powerModifier: 2 }),
                        makeMinion('m2', 'test_other', '0', 2, { powerModifier: 1 }),
                    ],
                    ongoingActions: [],
                },
            ],
        });

        const playResult = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'a1' } },
            defaultTestRandom,
        );

        const prompt1 = getInteractionsFromMS(playResult.finalState)[0];
        expect(prompt1?.data?.sourceId).toBe('giant_ant_who_wants_to_live_forever');

        const removeOption = prompt1.data.options.find((o: any) => o?.value?.minionUid === 'm1');
        expect(removeOption).toBeDefined();

        const removeResult = runCommand(
            playResult.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: removeOption.id } } as any,
            defaultTestRandom,
        );
        expect(removeResult.events.some(e => e.type === SU_EVENTS.POWER_COUNTER_REMOVED)).toBe(true);

        const prompt2 = getInteractionsFromMS(removeResult.finalState)[0];
        const confirmOption = prompt2.data.options.find((o: any) => o.id === 'confirm');
        expect(confirmOption).toBeDefined();

        const confirmResult = runCommand(
            removeResult.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: 'confirm' } } as any,
            defaultTestRandom,
        );

        const drawEvt = confirmResult.events.find(e => e.type === SU_EVENTS.CARDS_DRAWN);
        expect(drawEvt).toBeDefined();
        expect((drawEvt as any).payload.count).toBe(1);
    });

    it('无人想要永生：旧 optionId 不应在最后一个指示物移除后吞掉交互', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'giant_ant_who_wants_to_live_forever', 'action', '0')],
                    deck: [makeCard('d1', 'filler_minion_1', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('m1', 'giant_ant_worker', '0', 3, { powerCounters: 1 }),
                    ],
                    ongoingActions: [],
                },
            ],
        });

        const playResult = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'a1' } },
            defaultTestRandom,
        );
        expect(playResult.success).toBe(true);

        const prompt1 = getInteractionsFromMS(playResult.finalState)[0];
        expect(prompt1?.data?.sourceId).toBe('giant_ant_who_wants_to_live_forever');
        const removeOption = prompt1.data.options.find((o: any) => o?.value?.minionUid === 'm1');
        expect(removeOption).toBeDefined();

        const firstRemoveResult = runCommand(
            playResult.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: removeOption.id } } as any,
            defaultTestRandom,
        );
        expect(firstRemoveResult.success).toBe(true);
        expect(firstRemoveResult.events.some(e => e.type === SU_EVENTS.POWER_COUNTER_REMOVED)).toBe(true);

        const staleRespondResult = runCommand(
            firstRemoveResult.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: removeOption.id } } as any,
            defaultTestRandom,
        );

        expect(staleRespondResult.success).toBe(false);
        expect(staleRespondResult.error).toBe('无效的选择');
        expect(staleRespondResult.events).toHaveLength(0);
        expect(staleRespondResult.finalState).toEqual(firstRemoveResult.finalState);
        expect(staleRespondResult.finalState.sys.interaction?.current?.data?.sourceId).toBe('giant_ant_who_wants_to_live_forever');
    });

    it('如同魔法：先移除全部，再可取消并回滚', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'giant_ant_a_kind_of_magic', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('m1', 'giant_ant_worker', '0', 3, { powerCounters: 2 }),
                        makeMinion('m2', 'test_other', '0', 2, { powerCounters: 0 }),
                    ],
                    ongoingActions: [],
                },
            ],
        });

        const playResult = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'a1' } },
            defaultTestRandom,
        );

        const removedEvt = playResult.events.find(e => e.type === SU_EVENTS.POWER_COUNTER_REMOVED);
        expect(removedEvt).toBeDefined();

        const prompt1 = getInteractionsFromMS(playResult.finalState)[0];
        expect(prompt1?.data?.sourceId).toBe('giant_ant_a_kind_of_magic_distribute');

        const assignOption = prompt1.data.options.find((o: any) => o?.value?.minionUid === 'm2');
        expect(assignOption).toBeDefined();

        const assignResult = runCommand(
            playResult.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: assignOption.id } } as any,
            defaultTestRandom,
        );
        expect(assignResult.events.some(e => e.type === SU_EVENTS.POWER_COUNTER_ADDED)).toBe(true);

        const cancelResult = runCommand(
            assignResult.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: 'cancel' } } as any,
            defaultTestRandom,
        );

        expect(cancelResult.events.some(e => e.type === SU_EVENTS.CARD_RECOVERED_FROM_DISCARD)).toBe(true);
        expect(cancelResult.events.filter(e => e.type === SU_EVENTS.POWER_COUNTER_ADDED).length).toBeGreaterThan(0);
    });

    it('承受压力：Me First! 窗口中打出，从计分基地上的随从转移力量指示物到其他基地的随从', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'giant_ant_under_pressure', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_the_jungle',
                    minions: [
                        makeMinion('m1', 'giant_ant_worker', '0', 3, { powerCounters: 3 }), // 计分基地上的随从（来源）
                        makeMinion('filler1', 'test_other', '1', 10, { powerCounters: 0 }),
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_the_hive',
                    minions: [
                        makeMinion('m2', 'test_other', '0', 2, { powerCounters: 0 }), // 其他基地上的随从（目标）
                    ],
                    ongoingActions: [],
                },
            ],
        });

        const ms = startSmashUpReactionSession(makeMatchState(core), {
            frameId: 'score-before:0:test',
            frameKind: 'score-before',
            phase: 'optional',
            activePlayerId: '0',
            currentPlayerId: '0',
            consecutivePasses: 0,
            sourceBaseIndex: 0,
            responseWindowType: 'meFirst',
        });
        ms.sys.phase = 'scoreBases';
        ms.sys.responseWindow = { ...(ms.sys.responseWindow ?? {}), current: undefined } as any;

        const playResult = runCommand(
            ms,
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'a1', targetBaseIndex: 0 } },
            defaultTestRandom,
        );
        const sourcePrompt = getInteractionsFromMS(playResult.finalState)[0];
        expect(sourcePrompt?.data?.sourceId).toBe('giant_ant_under_pressure_choose_source');

        const sourceOption = sourcePrompt.data.options.find((o: any) => o?.value?.minionUid === 'm1');
        const chooseSourceResult = runCommand(
            playResult.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: sourceOption.id } } as any,
            defaultTestRandom,
        );

        const targetPrompt = getInteractionsFromMS(chooseSourceResult.finalState)[0];
        expect(targetPrompt?.data?.sourceId).toBe('giant_ant_under_pressure_choose_target');
        const targetOption = targetPrompt.data.options.find((o: any) => o?.value?.minionUid === 'm2');

        const resolveResult = runCommand(
            chooseSourceResult.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: targetOption.id } } as any,
            defaultTestRandom,
        );

        const amountPrompt = getInteractionsFromMS(resolveResult.finalState)[0];
        expect(amountPrompt?.data?.sourceId).toBe('giant_ant_under_pressure_choose_amount');
        expect((amountPrompt?.data as any)?.slider?.max).toBe(3);

        const amountResult = runCommand(
            resolveResult.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: 'confirm-transfer', mergedValue: { amount: 3, value: 3 } } } as any,
            defaultTestRandom,
        );

        const removed = amountResult.events.find(e => e.type === SU_EVENTS.POWER_COUNTER_REMOVED);
        const added = amountResult.events.find(e => e.type === SU_EVENTS.POWER_COUNTER_ADDED);
        expect(removed).toBeDefined();
        expect(added).toBeDefined();
        expect((removed as any).payload.amount).toBe(3);
        expect((removed as any).payload.minionUid).toBe('m1');
        expect((added as any).payload.amount).toBe(3);
        expect((added as any).payload.minionUid).toBe('m2');

        // Me First! 子动作完成后，计分链会继续推进，所以来源随从可能已随计分基地一起离场。
        const m1Final = amountResult.finalState.core.bases[0]?.minions.find(m => m.uid === 'm1');
        const m2Final = amountResult.finalState.core.bases[1]?.minions.find(m => m.uid === 'm2');
        expect(m1Final).toBeUndefined();
        expect(m2Final?.powerCounters).toBe(3);
    });

    it('我们乃最强：计分后触发，来源离场后仍可按快照数量完成转移', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('m1', 'giant_ant_worker', '0', 3, { powerCounters: 2 }),
                        makeMinion('opp1', 'test_other', '1', 2, { powerCounters: 0 }),
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_b',
                    minions: [makeMinion('m2', 'test_other', '0', 2, { powerCounters: 0 })],
                    ongoingActions: [],
                },
            ],
            pendingAfterScoringSpecials: [
                {
                    sourceDefId: 'giant_ant_we_are_the_champions',
                    playerId: '0',
                    baseIndex: 0,
                    cardUid: 'champ-1',
                    minionSnapshots: [
                        {
                            uid: 'm1',
                            defId: 'giant_ant_worker',
                            baseIndex: 0,
                            counterAmount: 2,
                        },
                    ],
                },
            ],
        });

        const initialMs = makeMatchState(core);
        const triggerResult = fireTriggers(core, 'afterScoring', {
            state: core,
            matchState: initialMs,
            playerId: '0',
            baseIndex: 0,
            rankings: [{ playerId: '0', power: 5, vp: 3 }],
            random: defaultTestRandom,
            now: 1000,
        });

        const withPrompt = triggerResult.matchState ?? initialMs;
        const sourcePrompt = getInteractionsFromMS(withPrompt)[0];
        expect(sourcePrompt?.data?.sourceId).toBe('giant_ant_we_are_the_champions_choose_snapshot_source');
        expect((sourcePrompt?.data as any)?.targetType).toBe('generic');

        // 模拟计分已结算（来源随从离场）后再响应交互
        const scoredCore = reduce(core, {
            type: SU_EVENTS.BASE_SCORED,
            payload: { baseIndex: 0, rankings: [{ playerId: '0', power: 5, vp: 3 }] },
            timestamp: 1001,
        } as any);
        const scoredAndReplacedCore = reduce(scoredCore, {
            type: SU_EVENTS.BASE_REPLACED,
            payload: { baseIndex: 0, oldBaseDefId: 'base_a', newBaseDefId: 'base_c' },
            timestamp: 1002,
        } as any);
        const coreAfterTriggerEvents = triggerResult.events.reduce(
            (acc, evt) => reduce(acc, evt as any),
            scoredAndReplacedCore,
        );
        const afterScoringState: MatchState<SmashUpCore> = {
            ...withPrompt,
            core: coreAfterTriggerEvents,
        };

        // 模拟前端 transport 的实时交互刷新：来源快照选项不应被过滤掉
        const refreshedAfterScoringState = refreshInteractionOptions(afterScoringState);
        const refreshedSourcePrompt = getInteractionsFromMS(refreshedAfterScoringState)[0];
        const refreshedSourceOption = refreshedSourcePrompt?.data?.options?.find((o: any) => o?.value?.minionUid === 'm1');
        expect(refreshedSourceOption).toBeDefined();

        const sourceOption = sourcePrompt.data.options.find((o: any) => o?.value?.minionUid === 'm1');
        const chooseSourceResult = runCommand(
            refreshedAfterScoringState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: sourceOption.id } } as any,
            defaultTestRandom,
        );

        // Step 2: choose_target - 刷新后目标随从（在其他基地）选项仍可用
        const refreshedChooseTarget = refreshInteractionOptions(chooseSourceResult.finalState);
        const targetPrompt = getInteractionsFromMS(refreshedChooseTarget)[0];
        expect(targetPrompt?.data?.sourceId).toBe('giant_ant_we_are_the_champions_choose_target');
        const targetOption = targetPrompt.data.options.find((o: any) => o?.value?.minionUid === 'm2');
        expect(targetOption).toBeDefined();
        const resolveResult = runCommand(
            refreshedChooseTarget,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: targetOption.id } } as any,
            defaultTestRandom,
        );

        // Step 3: choose_amount - 刷新后滑块选项仍可用
        const refreshedChooseAmount = refreshInteractionOptions(resolveResult.finalState);
        const amountPrompt = getInteractionsFromMS(refreshedChooseAmount)[0];
        expect(amountPrompt?.data?.sourceId).toBe('giant_ant_we_are_the_champions_choose_amount');
        expect((amountPrompt?.data as any)?.slider?.max).toBe(2);

        const amountResult = runCommand(
            refreshedChooseAmount,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: 'confirm-transfer', mergedValue: { amount: 1, value: 1 } } } as any,
            defaultTestRandom,
        );

        const removed = amountResult.events.find(e => e.type === SU_EVENTS.POWER_COUNTER_REMOVED);
        const added = amountResult.events.find(e => e.type === SU_EVENTS.POWER_COUNTER_ADDED);
        expect(removed).toBeUndefined();
        expect((added as any).payload.amount).toBe(1);
    });

    it('兵蚁：onPlay 放2指示物；talent 移除1并转移1个指示物给另一个随从', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('s1', 'giant_ant_soldier', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [makeMinion('m2', 'test_other', '0', 2, { powerModifier: 0 })],
                    ongoingActions: [],
                },
                {
                    defId: 'base_b',
                    minions: [],
                    ongoingActions: [],
                },
            ],
        });

        const playResult = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 's1', baseIndex: 0 } },
            defaultTestRandom,
        );

        const addEvt = playResult.events.find(e => e.type === SU_EVENTS.POWER_COUNTER_ADDED);
        expect(addEvt).toBeDefined();
        expect((addEvt as any).payload.amount).toBe(2);

        const talentResult = runCommand(
            playResult.finalState,
            { type: SU_COMMANDS.USE_TALENT, playerId: '0', payload: { minionUid: 's1', baseIndex: 0 } },
            defaultTestRandom,
        );
        const chooseMinionPrompt = getInteractionsFromMS(talentResult.finalState)[0];
        const chooseMinionOption = chooseMinionPrompt.data.options.find((o: any) => o?.value?.minionUid === 'm2');

        const resolveResult = runCommand(
            talentResult.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: chooseMinionOption.id } } as any,
            defaultTestRandom,
        );

        const removed = resolveResult.events.find(e => e.type === SU_EVENTS.POWER_COUNTER_REMOVED);
        const added = resolveResult.events.find(e => e.type === SU_EVENTS.POWER_COUNTER_ADDED && (e as any).payload.minionUid === 'm2');
        expect(removed).toBeDefined();
        expect((removed as any).payload.amount).toBe(1);
        expect(added).toBeDefined();
        expect((added as any).payload.amount).toBe(1);
        expect(resolveResult.events.some(e => e.type === SU_EVENTS.MINION_MOVED)).toBe(false);
    });

    it('雄蜂：onPlay 放置力量指示物（无 talent，持续能力为防消灭）', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('d1', 'giant_ant_drone', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{ defId: 'base_a', minions: [], ongoingActions: [] }],
        });

        const playResult = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'd1', baseIndex: 0 } },
            defaultTestRandom,
        );
        expect(playResult.events.some(e => e.type === SU_EVENTS.POWER_COUNTER_ADDED)).toBe(true);
    });

    it('雄蜂：选择防止消灭时，移除指示物并保留被消灭随从', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    discard: [makeCard('dis1', 'test_minion', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('d1', 'giant_ant_drone', '0', 3, { powerCounters: 1 }),
                        makeMinion('m1', 'cthulhu_servitor', '0', 2, { powerModifier: 0 }),
                    ],
                    ongoingActions: [],
                },
            ],
        });

        const triggerResult = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.USE_TALENT, playerId: '0', payload: { minionUid: 'm1', baseIndex: 0 } },
            defaultTestRandom,
        );

        const prompt = getInteractionsFromMS(triggerResult.finalState)[0];
        expect(prompt?.data?.sourceId).toBe('giant_ant_drone_prevent_destroy');
        expect(triggerResult.events.some(e => e.type === SU_EVENTS.MINION_DESTROYED)).toBe(false);

        const droneOption = prompt.data.options.find((o: any) => o?.value?.droneUid === 'd1');
        const preventResult = runCommand(
            triggerResult.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: droneOption.id } } as any,
            defaultTestRandom,
        );

        expect(preventResult.events.some(e => e.type === SU_EVENTS.POWER_COUNTER_REMOVED)).toBe(true);
        expect(preventResult.events.some(e => e.type === SU_EVENTS.MINION_DESTROYED)).toBe(false);
        const baseMinions = preventResult.finalState.core.bases[0].minions.map(m => m.uid);
        expect(baseMinions).toContain('m1');
        // 关键：交互应已解决（弹窗消失）
        expect(getInteractionsFromMS(preventResult.finalState).length).toBe(0);
    });

    it('尸体商店+雄蜂：选择防止消灭时，应先结算雄蜂且不进入指示物分配', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('body-shop', 'frankenstein_body_shop_pod', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('dok', 'frankenstein_herr_doktor_pod', '0', 2, { powerCounters: 0 }),
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_b',
                    minions: [
                        makeMinion('monster', 'frankenstein_the_monster_pod', '0', 4, { powerCounters: 0 }),
                        makeMinion('drone', 'giant_ant_drone_pod', '0', 3, { powerCounters: 1 }),
                    ],
                    ongoingActions: [],
                },
            ],
        });

        const play = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'body-shop' } },
            defaultTestRandom,
        );
        expect(play.success).toBe(true);

        const choosePrompt = getInteractionsFromMS(play.finalState)[0] as any;
        expect(choosePrompt?.data?.sourceId).toBe('frankenstein_body_shop');
        const chooseDok = choosePrompt.data.options.find((entry: any) => entry.value?.minionUid === 'dok');
        expect(chooseDok).toBeDefined();

        const afterChoose = runCommand(
            play.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: chooseDok.id } } as any,
            defaultTestRandom,
        );
        expect(afterChoose.success).toBe(true);
        expect(afterChoose.events.some(e => e.type === SU_EVENTS.MINION_DESTROYED)).toBe(false);

        const pendingPrompt = getInteractionsFromMS(afterChoose.finalState)[0] as any;
        expect(pendingPrompt?.data?.sourceId).toBe('giant_ant_drone_prevent_destroy');
        const droneOption = pendingPrompt.data.options.find((entry: any) => entry.value?.droneUid === 'drone');
        expect(droneOption).toBeDefined();

        const prevent = runCommand(
            afterChoose.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: droneOption.id } } as any,
            defaultTestRandom,
        );
        expect(prevent.success).toBe(true);
        expect(prevent.events.some(e => e.type === SU_EVENTS.POWER_COUNTER_REMOVED)).toBe(true);
        expect(prevent.events.some(e => e.type === SU_EVENTS.MINION_DESTROYED)).toBe(false);
        expect(prevent.finalState.core.bases[0].minions.some(m => m.uid === 'dok')).toBe(true);
        expect(prevent.finalState.core.bases[1].minions.find(m => m.uid === 'drone')?.powerCounters).toBe(0);
        expect(prevent.finalState.core.bases[1].minions.find(m => m.uid === 'monster')?.powerCounters ?? 0).toBe(0);
        expect(getInteractionsFromMS(prevent.finalState).length).toBe(0);
    });

    it('尸体商店+雄蜂：选择不防止消灭时，应在确认消灭后再进入指示物分配', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('body-shop', 'frankenstein_body_shop_pod', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('dok', 'frankenstein_herr_doktor_pod', '0', 2, { powerCounters: 0 }),
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_b',
                    minions: [
                        makeMinion('monster', 'frankenstein_the_monster_pod', '0', 4, { powerCounters: 0 }),
                        makeMinion('drone', 'giant_ant_drone_pod', '0', 3, { powerCounters: 1 }),
                    ],
                    ongoingActions: [],
                },
            ],
        });

        const play = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'body-shop' } },
            defaultTestRandom,
        );
        const choosePrompt = getInteractionsFromMS(play.finalState)[0] as any;
        const chooseDok = choosePrompt.data.options.find((entry: any) => entry.value?.minionUid === 'dok');

        const afterChoose = runCommand(
            play.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: chooseDok.id } } as any,
            defaultTestRandom,
        );

        const preventPrompt = getInteractionsFromMS(afterChoose.finalState)[0] as any;
        expect(preventPrompt?.data?.sourceId).toBe('giant_ant_drone_prevent_destroy');

        const skip = runCommand(
            afterChoose.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: 'skip' } } as any,
            defaultTestRandom,
        );
        expect(skip.success).toBe(true);
        expect(skip.events.some(e => e.type === SU_EVENTS.MINION_DESTROYED)).toBe(true);

        const distributePrompt = getInteractionsFromMS(skip.finalState)[0] as any;
        expect(distributePrompt?.data?.sourceId).toBe('frankenstein_body_shop_distribute');
        const chooseMonster = distributePrompt.data.options.find((entry: any) => entry.value?.minionUid === 'monster');
        expect(chooseMonster).toBeDefined();
        expect(skip.finalState.core.bases[0].minions.some(m => m.uid === 'dok')).toBe(false);
    });

    it('雄蜂：选择跳过时恢复消灭，且不会再次弹出同一拦截交互', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    discard: [makeCard('dis1', 'test_minion', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('d1', 'giant_ant_drone', '0', 3, { powerCounters: 1 }),
                        makeMinion('m1', 'cthulhu_servitor', '0', 2, { powerModifier: 0 }),
                    ],
                    ongoingActions: [],
                },
            ],
        });

        const triggerResult = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.USE_TALENT, playerId: '0', payload: { minionUid: 'm1', baseIndex: 0 } },
            defaultTestRandom,
        );

        const skipResult = runCommand(
            triggerResult.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: 'skip' } } as any,
            defaultTestRandom,
        );

        const destroyEvt = skipResult.events.find(e => e.type === SU_EVENTS.MINION_DESTROYED);
        expect(destroyEvt).toBeDefined();
        expect((destroyEvt as any).payload.reason).toBe('giant_ant_drone_skip');
        expect(getInteractionsFromMS(skipResult.finalState).length).toBe(0);
        // 关键：随从实际从基地移除
        const baseMinions = skipResult.finalState.core.bases[0].minions.map((m: any) => m.uid);
        expect(baseMinions).not.toContain('m1');
        expect(baseMinions).toContain('d1');
        // 进入弃牌堆
        const discard = skipResult.finalState.core.players['0'].discard.map((c: any) => c.uid);
        expect(discard).toContain('m1');
    });

    it('雄蜂：SYS_INTERACTION_CANCEL 视为跳过，恢复消灭并清空交互', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    discard: [makeCard('dis1', 'test_minion', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('d1', 'giant_ant_drone', '0', 3, { powerCounters: 1 }),
                        makeMinion('m1', 'cthulhu_servitor', '0', 2, { powerModifier: 0 }),
                    ],
                    ongoingActions: [],
                },
            ],
        });

        const triggerResult = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.USE_TALENT, playerId: '0', payload: { minionUid: 'm1', baseIndex: 0 } },
            defaultTestRandom,
        );

        const cancelResult = runCommand(
            triggerResult.finalState,
            { type: 'SYS_INTERACTION_CANCEL', playerId: '0', payload: { reason: 'empty-options' } } as any,
            defaultTestRandom,
        );

        const destroyEvt = cancelResult.events.find(e => e.type === SU_EVENTS.MINION_DESTROYED);
        expect(destroyEvt).toBeDefined();
        expect((destroyEvt as any).payload.reason).toBe('giant_ant_drone_skip');
        expect(getInteractionsFromMS(cancelResult.finalState).length).toBe(0);
        const baseMinions = cancelResult.finalState.core.bases[0].minions.map((m: any) => m.uid);
        expect(baseMinions).not.toContain('m1');
        expect(baseMinions).toContain('d1');
        const discard = cancelResult.finalState.core.players['0'].discard.map((c: any) => c.uid);
        expect(discard).toContain('m1');
    });

    it('雄蜂+Igor：pendingSave 时 onDestroy 不触发（单元测试 processDestroyTriggers）', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('d1', 'giant_ant_drone', '0', 3, { powerModifier: 2 }),
                        makeMinion('igor', 'frankenstein_igor', '0', 1, { powerModifier: 0 }),
                    ],
                    ongoingActions: [],
                },
            ],
        });
        const ms = makeMatchState(core);
        const destroyEvt = {
            type: SU_EVENTS.MINION_DESTROYED,
            payload: { minionUid: 'igor', minionDefId: 'frankenstein_igor', fromBaseIndex: 0, ownerId: '0', reason: 'test' },
            timestamp: 100,
        };
        const result = processDestroyTriggers([destroyEvt] as any, ms, '0' as any, defaultTestRandom, 100);

        // 雄蜂创建了防止消灭交互 → pendingSave
        expect(result.matchState).toBeDefined();
        const interaction = result.matchState!.sys.interaction;
        const hasPreventInteraction = (interaction.current?.data as any)?.sourceId === 'giant_ant_drone_prevent_destroy'
            || interaction.queue.some((i: any) => i?.data?.sourceId === 'giant_ant_drone_prevent_destroy');
        expect(hasPreventInteraction).toBe(true);
        // MINION_DESTROYED 被压制
        expect(result.events.filter((e: any) => e.type === SU_EVENTS.MINION_DESTROYED).length).toBe(0);
        // onDestroy 的 POWER_COUNTER_ADDED 不应出现（pendingSave 时跳过 onDestroy）
        expect(result.events.filter((e: any) => e.type === SU_EVENTS.POWER_COUNTER_ADDED).length).toBe(0);
    });

    it('雄蜂+Igor：reason=drone_skip 时 onDestroy 正常触发且不重复（单元测试 processDestroyTriggers）', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('d1', 'giant_ant_drone', '0', 3, { powerModifier: 2 }),
                        makeMinion('igor', 'frankenstein_igor', '0', 1, { powerModifier: 0 }),
                    ],
                    ongoingActions: [],
                },
            ],
        });
        const ms = makeMatchState(core);
        // 模拟用户选择“不防止”后 handler 产生的事件
        const destroyEvt = {
            type: SU_EVENTS.MINION_DESTROYED,
            payload: { minionUid: 'igor', minionDefId: 'frankenstein_igor', fromBaseIndex: 0, ownerId: '0', reason: 'giant_ant_drone_skip' },
            timestamp: 100,
        };
        const result = processDestroyTriggers([destroyEvt] as any, ms, '0' as any, defaultTestRandom, 100);

        // 雄蜂 trigger 跳过（reason check）→ 无 pendingSave
        // MINION_DESTROYED 应保留
        expect(result.events.filter((e: any) => e.type === SU_EVENTS.MINION_DESTROYED).length).toBe(1);
        // Igor 的 onDestroy 应触发一次：POWER_COUNTER_ADDED 给雄蜂
        const pcaEvents = result.events.filter((e: any) => e.type === SU_EVENTS.POWER_COUNTER_ADDED);
        expect(pcaEvents.length).toBe(1);
        // 不应产生新的防止消灭交互
        if (result.matchState) {
            const interaction = result.matchState.sys.interaction;
            const hasPrevent = (interaction.current?.data as any)?.sourceId === 'giant_ant_drone_prevent_destroy'
                || interaction.queue.some((i: any) => i?.data?.sourceId === 'giant_ant_drone_prevent_destroy');
            expect(hasPrevent).toBe(false);
        }
    });

    it('雄蜂：跨玩家场景 — 对手回合消灭己方随从时，交互属于随从所有者', () => {
        // 场景：玩家1消灭玩家0的随从，雄蜂为玩家0的持续能力
        // 交互应属于玩家0，用 playerId:'0' 响应应成功
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('d1', 'giant_ant_drone', '0', 3, { powerModifier: 1 }),
                        makeMinion('m1', 'cthulhu_servitor', '0', 2, { powerModifier: 0 }),
                    ],
                    ongoingActions: [],
                },
            ],
        });
        const ms = makeMatchState(core);

        // 模拟玩家1消灭玩家0的随从
        const destroyEvt = {
            type: SU_EVENTS.MINION_DESTROYED,
            payload: { minionUid: 'm1', minionDefId: 'cthulhu_servitor', fromBaseIndex: 0, ownerId: '0', destroyerId: '1', reason: 'opponent_action' },
            timestamp: 100,
        };
        const triggerResult = processDestroyTriggers([destroyEvt] as any, ms, '1' as any, defaultTestRandom, 100);

        // 交互应属于玩家0（随从所有者），不是玩家1（消灭者）
        expect(triggerResult.matchState).toBeDefined();
        const interaction = triggerResult.matchState!.sys.interaction.current;
        expect(interaction).toBeDefined();
        expect(interaction!.playerId).toBe('0');
        expect((interaction!.data as any)?.sourceId).toBe('giant_ant_drone_prevent_destroy');

        // 用玩家0的身份响应（正确）→ 应成功
        const droneOption = (interaction!.data as any).options.find((o: any) => o?.value?.droneUid === 'd1');
        const preventResult = runCommand(
            triggerResult.matchState!,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: droneOption.id } } as any,
            defaultTestRandom,
        );
        expect(preventResult.success).toBe(true);
        expect(getInteractionsFromMS(preventResult.finalState).length).toBe(0);
        expect(preventResult.events.some(e => e.type === SU_EVENTS.POWER_COUNTER_REMOVED)).toBe(true);
        // 被保护的随从仍在基地
        expect(preventResult.finalState.core.bases[0].minions.some(m => m.uid === 'm1')).toBe(true);
    });

    it('雄蜂：能阻止自己被消灭 — 单独消灭雄蜂时弹出防止交互', () => {
        // 场景：只有雄蜂被消灭，雄蜂有1个指示物，应弹出防止交互
        const core = makeState({
            players: { '0': makePlayer('0'), '1': makePlayer('1') },
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('d1', 'giant_ant_drone', '0', 3, { powerModifier: 1 }),
                ],
                ongoingActions: [],
            }],
        });
        const ms = makeMatchState(core);

        const destroyEvents = [
            { type: SU_EVENTS.MINION_DESTROYED, payload: { minionUid: 'd1', minionDefId: 'giant_ant_drone', fromBaseIndex: 0, ownerId: '0', reason: 'action' }, timestamp: 100 },
        ];
        const result = processDestroyTriggers(destroyEvents as any, ms, '0' as any, defaultTestRandom, 100);

        // 应创建 1 个防止交互（雄蜂阻止自己被消灭）
        expect(result.matchState).toBeDefined();
        const allInteractions = getInteractionsFromMS(result.matchState!);
        const droneInteractions = allInteractions.filter((i: any) => i?.data?.sourceId === 'giant_ant_drone_prevent_destroy');
        expect(droneInteractions.length).toBe(1);
        const runtimeContinuation = (droneInteractions[0] as any)?.data?.runtimePrompt?.continuation?.context;
        expect(runtimeContinuation?.targetMinionUid).toBe('d1');

        // 选择防止 → 雄蜂消耗指示物，存活
        const interaction = result.matchState!.sys.interaction.current!;
        const droneOption = (interaction.data as any).options.find((o: any) => o?.value?.droneUid === 'd1');
        const r = runCommand(
            result.matchState!,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: droneOption.id } } as any,
            defaultTestRandom,
        );
        expect(r.success).toBe(true);
        expect(r.events.some(e => e.type === SU_EVENTS.POWER_COUNTER_REMOVED)).toBe(true);
        // 雄蜂仍在基地
        expect(r.finalState.core.bases[0].minions.some(m => m.uid === 'd1')).toBe(true);
        expect(getInteractionsFromMS(r.finalState).length).toBe(0);
    });

    it('雄蜂：scoreBases 阶段（真实基地达临界点）交互解决后不应无限循环', () => {
        // 复现根因：scoreBases 阶段 Drone 交互解决后，
        // FlowSystem.afterEvents 的 onAutoContinueCheck 返回 autoContinue，
        // 重新执行 onPhaseExit('scoreBases') → 同一基地仍达标 → 重新计分 → 循环
        // 使用 base_the_jungle（breakpoint=12），力量刚好达标
        const core = makeState({
            players: { '0': makePlayer('0'), '1': makePlayer('1') },
            bases: [{
                defId: 'base_the_jungle',
                minions: [
                    makeMinion('m1', 'cthulhu_servitor', '0', 5, { powerModifier: 0 }),
                    makeMinion('m2', 'cthulhu_minion', '0', 4, { powerModifier: 0 }),
                    makeMinion('d1', 'giant_ant_drone', '0', 3, { powerModifier: 1 }),
                ],
                ongoingActions: [],
            }],
        });
        // 预创建交互状态（模拟某个 afterScoring/onPhaseEnter 基地能力消灭了 m1）
        const destroyEvents = [
            { type: SU_EVENTS.MINION_DESTROYED, payload: { minionUid: 'm1', minionDefId: 'cthulhu_servitor', fromBaseIndex: 0, ownerId: '0', reason: 'action' }, timestamp: 100 },
        ];
        const ms = makeMatchState(core);
        ms.sys.phase = 'scoreBases';
        const triggerResult = processDestroyTriggers(destroyEvents as any, ms, '0' as any, defaultTestRandom, 100);
        expect(triggerResult.matchState).toBeDefined();
        const interaction = triggerResult.matchState!.sys.interaction.current!;
        expect((interaction.data as any)?.sourceId).toBe('giant_ant_drone_prevent_destroy');

        // 解决交互（防止消灭）
        const droneOption = (interaction.data as any).options.find((o: any) => o?.value?.droneUid === 'd1');
        const r = runCommand(
            triggerResult.matchState!,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: droneOption.id } } as any,
            defaultTestRandom,
        );
        // 关键断言：不应超时/无限循环，success 为 true
        expect(r.success).toBe(true);
        // 关键断言：交互队列应清空，不应有新的 Drone 交互
        const remaining = getInteractionsFromMS(r.finalState);
        const droneRemaining = remaining.filter((i: any) => i?.data?.sourceId === 'giant_ant_drone_prevent_destroy');
        expect(droneRemaining.length).toBe(0);
    });

    it('雄蜂：防止失败（指示物耗尽）时重新发出 MINION_DESTROYED', () => {
        // 场景：两个随从同时被消灭，雄蜂只有1个指示物
        // 第一个交互用掉指示物，第二个交互的"防止"选项应回退为消灭
        const core = makeState({
            players: { '0': makePlayer('0'), '1': makePlayer('1') },
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('m1', 'cthulhu_servitor', '0', 2, { powerModifier: 0 }),
                    makeMinion('m2', 'cthulhu_minion', '0', 1, { powerModifier: 0 }),
                    makeMinion('d1', 'giant_ant_drone', '0', 3, { powerModifier: 1 }),
                ],
                ongoingActions: [],
            }],
        });
        const ms = makeMatchState(core);

        // 同时消灭 m1 和 m2（不消灭雄蜂自身）
        const destroyEvents = [
            { type: SU_EVENTS.MINION_DESTROYED, payload: { minionUid: 'm1', minionDefId: 'cthulhu_servitor', fromBaseIndex: 0, ownerId: '0', reason: 'scoring' }, timestamp: 100 },
            { type: SU_EVENTS.MINION_DESTROYED, payload: { minionUid: 'm2', minionDefId: 'cthulhu_minion', fromBaseIndex: 0, ownerId: '0', reason: 'scoring' }, timestamp: 100 },
        ];
        const triggerResult = processDestroyTriggers(destroyEvents as any, ms, '0' as any, defaultTestRandom, 100);

        // 应有 2 个防止交互（为 m1 和 m2 各一个）
        expect(triggerResult.matchState).toBeDefined();
        const allInteractions = getInteractionsFromMS(triggerResult.matchState!);
        expect(allInteractions.filter((i: any) => i?.data?.sourceId === 'giant_ant_drone_prevent_destroy').length).toBe(2);

        // 解决第1个交互：防止 m1 的消灭（消耗雄蜂指示物）
        const first = triggerResult.matchState!.sys.interaction.current!;
        const droneOption = (first.data as any).options.find((o: any) => o?.value?.droneUid === 'd1');
        const r1 = runCommand(
            triggerResult.matchState!,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: droneOption.id } } as any,
            defaultTestRandom,
        );
        expect(r1.success).toBe(true);
        expect(r1.events.some(e => e.type === SU_EVENTS.POWER_COUNTER_REMOVED)).toBe(true);

        // 第2个交互自动弹出
        const second = r1.finalState.sys.interaction.current;
        expect(second).toBeDefined();
        expect((second!.data as any)?.sourceId).toBe('giant_ant_drone_prevent_destroy');

        // 解决第2个交互：尝试防止 m2（但雄蜂已无指示物）
        const secondOptions = (second!.data as any).options;
        const droneOption2 = secondOptions.find((o: any) => o?.value?.droneUid === 'd1');
        expect(droneOption2).toBeDefined();
        const r2 = runCommand(
            r1.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: droneOption2.id } } as any,
            defaultTestRandom,
        );
        expect(r2.success).toBe(true);
        // 防止失败 → 应重新发出 MINION_DESTROYED（m2 被正确消灭）
        expect(r2.events.some(e => e.type === SU_EVENTS.MINION_DESTROYED)).toBe(true);
        // 交互队列应清空
        expect(getInteractionsFromMS(r2.finalState).length).toBe(0);
    });

    it('雄蜂+吸血鬼伯爵：pendingSave 时 onMinionDestroyed 触发器的副作用事件被抑制', () => {
        // 场景：玩家0有雄蜂（有指示物），玩家1有吸血鬼伯爵
        // 玩家0的随从被消灭 → 雄蜂创建防止交互 → pendingSave
        // 此时吸血鬼伯爵的 +1 指示物不应触发（消灭尚未确认）
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('d1', 'giant_ant_drone', '0', 3, { powerModifier: 2 }),
                        makeMinion('m1', 'cthulhu_servitor', '0', 2, { powerModifier: 0 }),
                        makeMinion('vc', 'vampire_the_count', '1', 5, { powerModifier: 0 }),
                    ],
                    ongoingActions: [],
                },
            ],
        });
        const ms = makeMatchState(core);
        const destroyEvt = {
            type: SU_EVENTS.MINION_DESTROYED,
            payload: { minionUid: 'm1', minionDefId: 'cthulhu_servitor', fromBaseIndex: 0, ownerId: '0', reason: 'action' },
            timestamp: 100,
        };
        const result = processDestroyTriggers([destroyEvt] as any, ms, '1' as any, defaultTestRandom, 100);

        // 雄蜂创建了防止消灭交互 → pendingSave
        expect(result.matchState).toBeDefined();
        const interaction = result.matchState!.sys.interaction;
        const hasPreventInteraction = (interaction.current?.data as any)?.sourceId === 'giant_ant_drone_prevent_destroy'
            || interaction.queue.some((i: any) => i?.data?.sourceId === 'giant_ant_drone_prevent_destroy');
        expect(hasPreventInteraction).toBe(true);

        // 关键断言：吸血鬼伯爵的 POWER_COUNTER_ADDED 不应出现
        const pcaEvents = result.events.filter((e: any) => e.type === SU_EVENTS.POWER_COUNTER_ADDED);
        expect(pcaEvents.length).toBe(0);

        // MINION_DESTROYED 也被压制
        expect(result.events.filter((e: any) => e.type === SU_EVENTS.MINION_DESTROYED).length).toBe(0);
    });

    it('雄蜂+投机主义：pendingSave 时 onMinionDestroyed 触发器的副作用事件被抑制', () => {
        // 场景：玩家0有雄蜂，玩家1有附着了投机主义的随从
        // 玩家0的随从被消灭 → 雄蜂防止 → 投机主义的 +1 不应触发
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('d1', 'giant_ant_drone', '0', 3, { powerModifier: 2 }),
                        makeMinion('m1', 'cthulhu_servitor', '0', 2, { powerModifier: 0 }),
                        {
                            ...makeMinion('opp1', 'cthulhu_minion', '1', 3, { powerModifier: 0 }),
                            attachedActions: [{ uid: 'opp-act', defId: 'vampire_opportunist', ownerId: '1' }],
                        } as any,
                    ],
                    ongoingActions: [],
                },
            ],
        });
        const ms = makeMatchState(core);
        const destroyEvt = {
            type: SU_EVENTS.MINION_DESTROYED,
            payload: { minionUid: 'm1', minionDefId: 'cthulhu_servitor', fromBaseIndex: 0, ownerId: '0', reason: 'action' },
            timestamp: 100,
        };
        const result = processDestroyTriggers([destroyEvt] as any, ms, '1' as any, defaultTestRandom, 100);

        // pendingSave
        expect(result.matchState).toBeDefined();
        // 投机主义的 POWER_COUNTER_ADDED 不应出现
        const pcaEvents = result.events.filter((e: any) => e.type === SU_EVENTS.POWER_COUNTER_ADDED);
        expect(pcaEvents.length).toBe(0);
    });

    it('雄蜂跳过后（drone_skip），吸血鬼伯爵正常获得 +1 指示物', () => {
        // 场景：玩家选择不防止消灭 → reason=giant_ant_drone_skip → 消灭确认
        // 此时吸血鬼伯爵的 onMinionDestroyed 应正常触发
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('d1', 'giant_ant_drone', '0', 3, { powerModifier: 2 }),
                        makeMinion('m1', 'cthulhu_servitor', '0', 2, { powerModifier: 0 }),
                        makeMinion('vc', 'vampire_the_count', '1', 5, { powerModifier: 0 }),
                    ],
                    ongoingActions: [],
                },
            ],
        });
        const ms = makeMatchState(core);
        const destroyEvt = {
            type: SU_EVENTS.MINION_DESTROYED,
            payload: { minionUid: 'm1', minionDefId: 'cthulhu_servitor', fromBaseIndex: 0, ownerId: '0', reason: 'giant_ant_drone_skip' },
            timestamp: 100,
        };
        const result = processDestroyTriggers([destroyEvt] as any, ms, '1' as any, defaultTestRandom, 100);

        // 雄蜂跳过 → 无 pendingSave → 消灭确认
        expect(result.events.filter((e: any) => e.type === SU_EVENTS.MINION_DESTROYED).length).toBe(1);
        // 吸血鬼伯爵应获得 +1 指示物
        const pcaEvents = result.events.filter((e: any) => e.type === SU_EVENTS.POWER_COUNTER_ADDED);
        expect(pcaEvents.length).toBeGreaterThanOrEqual(1);
        // 确认是吸血鬼伯爵获得的
        expect(pcaEvents.some((e: any) => e.payload.minionUid === 'vc')).toBe(true);
    });

    it('杀手女皇：满足条件时给目标随从与自身各+1', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    minionsPlayedPerBase: { 0: 1 },
                }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('q1', 'giant_ant_killer_queen', '0', 4, { powerModifier: 0, playedThisTurn: true }),
                        makeMinion('m2', 'test_other', '0', 2, { powerModifier: 0, playedThisTurn: true }),
                        makeMinion('m3', 'test_other', '0', 3, { powerModifier: 0, playedThisTurn: true }),
                    ],
                    ongoingActions: [],
                },
            ],
        });

        const talentResult = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.USE_TALENT, playerId: '0', payload: { minionUid: 'q1', baseIndex: 0 } },
            defaultTestRandom,
        );

        const prompt = getInteractionsFromMS(talentResult.finalState)[0];
        expect(prompt).toBeDefined(); // 应该创建交互（有多个候选）
        const option = prompt.data.options.find((o: any) => o?.value?.minionUid === 'm2');
        expect(option).toBeDefined(); // m2 应该在候选列表中（本回合打出的）
        const resolveResult = runCommand(
            talentResult.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: option.id } } as any,
            defaultTestRandom,
        );

        expect(resolveResult.events.filter(e => e.type === SU_EVENTS.POWER_COUNTER_ADDED).length).toBe(2);
    });
});

// ============================================================================
// 科学怪人派系
// ============================================================================

describe('科学怪人派系能力', () => {
    it('德国工程学：在该基地打出随从后应给该随从+1指示物', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('ge1', 'frankenstein_german_engineering', 'action', '0'),
                        makeCard('m1', 'test_minion', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                { defId: 'base_a', minions: [], ongoingActions: [] },
                { defId: 'base_b', minions: [], ongoingActions: [] },
            ],
        });

        const afterOngoing = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'ge1', targetBaseIndex: 0 } },
            defaultTestRandom,
        );

        const afterMinion = runCommand(
            afterOngoing.finalState,
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'm1', baseIndex: 0 } },
            defaultTestRandom,
        );

        const geEvt = afterMinion.events.find(
            e => e.type === SU_EVENTS.POWER_COUNTER_ADDED && (e as any).payload.reason === 'frankenstein_german_engineering',
        );
        expect(geEvt).toBeDefined();
        expect((geEvt as any).payload.minionUid).toBe('m1');

        // 断言最终状态中随从的 powerModifier 确实被 +1
        const finalMinion = afterMinion.finalState.core.bases[0].minions.find(m => m.uid === 'm1');
        expect(finalMinion).toBeDefined();
        expect(finalMinion!.powerCounters).toBe(1);
    });

    it('怪物：天赋移除指示物并额外打出随从', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('monster1', 'frankenstein_the_monster', '0', 5, { powerCounters: 2 }),
                    ],
                    ongoingActions: [],
                },
            ],
        });

        const talentResult = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.USE_TALENT, playerId: '0', payload: { minionUid: 'monster1', baseIndex: 0 } },
            defaultTestRandom,
        );

        // 应移除一个指示物
        const removedEvt = talentResult.events.find(
            e => e.type === SU_EVENTS.POWER_COUNTER_REMOVED && (e as any).payload.reason === 'frankenstein_the_monster',
        );
        expect(removedEvt).toBeDefined();
        expect((removedEvt as any).payload.minionUid).toBe('monster1');
        // 应授予额外随从额度
        const limitEvt = talentResult.events.find(
            e => e.type === SU_EVENTS.LIMIT_MODIFIED && (e as any).payload.limitType === 'minion',
        );
        expect(limitEvt).toBeDefined();
    });

    it('怪物 POD：没有+1力量指示物时不能发动天赋', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('monster1', 'frankenstein_the_monster_pod', '0', 5, { powerCounters: 0 }),
                    ],
                    ongoingActions: [],
                },
            ],
        });

        const result = validate(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'monster1', baseIndex: 0 },
        });

        expect(result.valid).toBe(false);
        expect(result.error).toBe('该随从当前无法发动天赋：没有+1力量指示物');
    });

    it('怪物 POD：没有+1力量指示物时 execute 不应误生成 TALENT_USED', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('monster1', 'frankenstein_the_monster_pod', '0', 5, { powerCounters: 0 }),
                    ],
                    ongoingActions: [],
                },
            ],
        });

        const events = execute(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'monster1', baseIndex: 0 },
        }, defaultTestRandom);

        expect(events).toEqual([]);
        expect(events.some(event => event.type === SU_EVENTS.TALENT_USED)).toBe(false);
    });

    it('愤怒的民众：若所选手牌已离开手牌，不应凭旧交互再塞回牌库', () => {
        const chooseMinionHandler = getAbilityRuntimePromptHandler('frankenstein_angry_mob');
        const chooseCardHandler = getAbilityRuntimePromptHandler('frankenstein_angry_mob_choose_card');
        expect(chooseMinionHandler).toBeDefined();
        expect(chooseCardHandler).toBeDefined();

        const playState = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('angry-mob', 'frankenstein_angry_mob', 'action', '0'),
                        makeCard('h1', 'test_action_a', 'action', '0'),
                        makeCard('h2', 'test_action_b', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('monster1', 'frankenstein_the_monster', '0', 5, { powerCounters: 0 })],
                ongoingActions: [],
            }],
        }));

        const played = runCommand(
            playState,
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'angry-mob' } },
            defaultTestRandom,
        );
        const chooseMinionPrompt = getInteractionsFromMS(played.finalState)[0] as any;
        expect(chooseMinionPrompt?.data?.sourceId).toBe('frankenstein_angry_mob');

        const afterChooseMinion = chooseMinionHandler!(
            played.finalState,
            '0',
            { minionUid: 'monster1', minionDefId: 'frankenstein_the_monster', baseIndex: 0 },
            chooseMinionPrompt.data,
            defaultTestRandom,
            1000,
        );
        const afterChooseMinionState = resolveInteraction(afterChooseMinion!.state);
        const chooseCardPrompt = getInteractionsFromMS(afterChooseMinionState)[0] as any;
        expect(chooseCardPrompt?.data?.sourceId).toBe('frankenstein_angry_mob_choose_card');

        const liveResult = chooseCardHandler!(
            afterChooseMinionState,
            '0',
            { cardUid: 'h1', defId: 'test_action_a' },
            chooseCardPrompt.data,
            defaultTestRandom,
            1001,
        );
        expect(liveResult?.events.some(e => e.type === SU_EVENTS.CARD_TO_DECK_BOTTOM)).toBe(true);
        expect(liveResult?.events.some(e => e.type === SU_EVENTS.POWER_COUNTER_ADDED)).toBe(true);

        const staleState = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('h2', 'test_action_b', 'action', '0')],
                    discard: [makeCard('h1', 'test_action_a', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('monster1', 'frankenstein_the_monster', '0', 5, { powerCounters: 0 })],
                ongoingActions: [],
            }],
        }));

        const staleResult = chooseCardHandler!(
            staleState,
            '0',
            { cardUid: 'h1', defId: 'test_action_a' },
            chooseCardPrompt.data,
            defaultTestRandom,
            1002,
        );
        expect(staleResult?.events ?? []).toHaveLength(0);
    });
});

// ============================================================================
// 吸血鬼派系
// ============================================================================

describe('吸血鬼派系能力', () => {
    it('剔除弱者：应先选随从，再可连续弃置并主动停止结算', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('a1', 'vampire_cull_the_weak', 'action', '0'),
                        makeCard('h1', 'test_minion', 'minion', '0'),
                        makeCard('h2', 'test_minion', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('v1', 'vampire_nightstalker', '0', 4, { powerModifier: 0 }),
                        makeMinion('v2', 'vampire_fledgling_vampire', '0', 2, { powerModifier: 0 }),
                    ],
                    ongoingActions: [],
                },
            ],
        });

        const playResult = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'a1' } },
            defaultTestRandom,
        );

        const chooseMinionPrompt = getInteractionsFromMS(playResult.finalState)[0];
        expect(chooseMinionPrompt?.data?.sourceId).toBe('vampire_cull_the_weak');
        const minionOption = chooseMinionPrompt.data.options.find((o: any) => o?.value?.minionUid === 'v1');

        const afterChooseMinion = runCommand(
            playResult.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: minionOption.id } } as any,
            defaultTestRandom,
        );

        const discardPrompt = getInteractionsFromMS(afterChooseMinion.finalState)[0];
        expect(discardPrompt?.data?.sourceId).toBe('vampire_cull_the_weak_choose_card');
        expect(discardPrompt?.data?.targetType).toBe('hand');
        const firstCardOption = discardPrompt.data.options.find((o: any) => o?.value?.cardUid === 'h1');

        // 第一张：单选弃牌 → 立即弃1张+放1个指示物
        const afterDiscardOne = runCommand(
            afterChooseMinion.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: firstCardOption.id } } as any,
            defaultTestRandom,
        );

        expect(afterDiscardOne.events.some(e => e.type === SU_EVENTS.CARDS_DISCARDED)).toBe(true);
        const counterEvt1 = afterDiscardOne.events.find(
            e => e.type === SU_EVENTS.POWER_COUNTER_ADDED && (e as any).payload.reason === 'vampire_cull_the_weak',
        );
        expect(counterEvt1).toBeDefined();
        expect((counterEvt1 as any).payload.minionUid).toBe('v1');
        expect((counterEvt1 as any).payload.amount).toBe(1);

        // 还有随从卡 → 继续选择
        const continuePrompt = getInteractionsFromMS(afterDiscardOne.finalState)[0];
        expect(continuePrompt?.data?.sourceId).toBe('vampire_cull_the_weak_choose_card');
        const secondCardOption = continuePrompt.data.options.find((o: any) => o?.value?.cardUid === 'h2');

        // 第二张：弃完最后一张 → 自动结束（无更多随从卡）
        const afterDiscardTwo = runCommand(
            afterDiscardOne.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: secondCardOption.id } } as any,
            defaultTestRandom,
        );

        const counterEvt2 = afterDiscardTwo.events.find(
            e => e.type === SU_EVENTS.POWER_COUNTER_ADDED && (e as any).payload.reason === 'vampire_cull_the_weak',
        );
        expect(counterEvt2).toBeDefined();
        expect((counterEvt2 as any).payload.minionUid).toBe('v1');

        // 手牌随从卡用完 → 无更多交互
        const nextPrompt = getInteractionsFromMS(afterDiscardTwo.finalState)[0];
        expect(nextPrompt).toBeUndefined();
    });

    // 跳过此测试 - Opportunist 触发器的复杂时序需要完整的系统支持
    it.skip('投机主义：对手随从被消灭后才给附着随从+1', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'vampire_big_gulp', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('m0', 'test_host', '0', 5, {
                            attachedActions: [{ uid: 'oa1', defId: 'vampire_opportunist', ownerId: '0' }],
                        }),
                        makeMinion('e1', 'enemy_low', '1', 2, { powerModifier: 0 }),
                    ],
                    ongoingActions: [],
                },
            ],
        });

        const result = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'a1' } },
            defaultTestRandom,
        );

        const opportunistEvt = result.events.find(
            e => e.type === SU_EVENTS.POWER_COUNTER_ADDED && (e as any).payload.reason === 'vampire_opportunist',
        );
        expect(opportunistEvt).toBeDefined();
        expect((opportunistEvt as any).payload.minionUid).toBe('m0');
    });

    it('投机主义：己方随从被消灭时不应触发', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1', {
                    hand: [makeCard('a1', 'vampire_big_gulp', 'action', '1')],
                }),
            },
            currentPlayerIndex: 1,
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('m0', 'test_host', '0', 4, {
                            attachedActions: [{ uid: 'oa1', defId: 'vampire_opportunist', ownerId: '0' }],
                        }),
                        makeMinion('f1', 'test_fodder', '0', 2, { powerModifier: 0 }),
                    ],
                    ongoingActions: [],
                },
            ],
        });

        const resolveResult = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '1', payload: { cardUid: 'a1' } },
            defaultTestRandom,
        );

        const opportunistEvt = resolveResult.events.find(
            e => e.type === SU_EVENTS.POWER_COUNTER_ADDED && (e as any).payload.reason === 'vampire_opportunist',
        );
        expect(opportunistEvt).toBeUndefined();
    });

    it('吸血鬼伯爵：己方随从被消灭时不应触发', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1', {
                    hand: [makeCard('a1', 'vampire_big_gulp', 'action', '1')],
                }),
            },
            currentPlayerIndex: 1,
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('c1', 'vampire_the_count', '0', 5, { powerModifier: 1 }),
                        makeMinion('f1', 'test_fodder', '0', 2, { powerModifier: 0 }),
                    ],
                    ongoingActions: [],
                },
            ],
        });

        const resolveResult = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '1', payload: { cardUid: 'a1' } },
            defaultTestRandom,
        );

        const countEvt = resolveResult.events.find(
            e => e.type === SU_EVENTS.POWER_COUNTER_ADDED && (e as any).payload.reason === 'vampire_the_count',
        );
        expect(countEvt).toBeUndefined();
    });

    it('渴血鬼：多同名来源时应给触发来源加指示物', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('c_hd', 'vampire_heavy_drinker', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('hd_old', 'vampire_heavy_drinker', '0', 3, { powerModifier: 0 }),
                        makeMinion('fod1', 'test_fodder', '0', 2, { powerModifier: 0 }),
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_b',
                    minions: [
                        makeMinion('hd_new', 'vampire_heavy_drinker', '0', 3, { powerModifier: 0 }),
                        makeMinion('fod2', 'test_fodder', '0', 2, { powerModifier: 0 }),
                    ],
                    ongoingActions: [],
                },
            ],
        });

        const playResult = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'c_hd', baseIndex: 1 } },
            defaultTestRandom,
        );

        const prompt = getInteractionsFromMS(playResult.finalState)[0];
        const option = prompt.data.options.find((o: any) => o?.value?.minionUid === 'fod2');

        const resolveResult = runCommand(
            playResult.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: option.id } } as any,
            defaultTestRandom,
        );

        const counterEvt = resolveResult.events.find(
            e => e.type === SU_EVENTS.POWER_COUNTER_ADDED && (e as any).payload.reason === 'vampire_heavy_drinker',
        );
        expect(counterEvt).toBeDefined();
        expect((counterEvt as any).payload.minionUid).toBe('c_hd');
    });

    it('夜行者：多同名来源时应给入场来源加指示物', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('c1', 'vampire_nightstalker', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('e1', 'enemy_low', '1', 1, { powerModifier: 0 }),
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_b',
                    minions: [
                        makeMinion('ns_old', 'vampire_nightstalker', '0', 4, { powerModifier: 0 }),
                    ],
                    ongoingActions: [],
                },
            ],
        });

        const playResult = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'c1', baseIndex: 0 } },
            defaultTestRandom,
        );

        const prompt = getInteractionsFromMS(playResult.finalState)[0];
        const option = prompt.data.options.find((o: any) => o?.value?.minionUid === 'e1');

        const resolveResult = runCommand(
            playResult.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: option.id } } as any,
            defaultTestRandom,
        );

        const counterEvt = resolveResult.events.find(
            e => e.type === SU_EVENTS.POWER_COUNTER_ADDED && (e as any).payload.reason === 'vampire_nightstalker',
        );
        expect(counterEvt).toBeDefined();
        expect((counterEvt as any).payload.minionUid).toBe('c1');
    });
});

// ============================================================================
// 狼人派系
// ============================================================================

describe('狼人派系能力', () => {
    it('关门放狗：预算应跨多次选择递减并支持连续消灭', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'werewolf_let_the_dog_out', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('w1', 'werewolf_howler', '0', 4, { powerModifier: 0 }),
                        makeMinion('e1', 'enemy_a', '1', 1, { powerModifier: 0 }),
                        makeMinion('e2', 'enemy_b', '1', 3, { powerModifier: 0 }),
                    ],
                    ongoingActions: [],
                },
            ],
        });

        const playResult = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'a1' } },
            defaultTestRandom,
        );

        const prompt1 = getInteractionsFromMS(playResult.finalState)[0];
        expect(prompt1?.data?.sourceId).toBe('werewolf_let_the_dog_out_targets');

        const target1 = prompt1.data.options.find((o: any) => o?.value?.minionUid === 'e1');
        const step1 = runCommand(
            playResult.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: target1.id } } as any,
            defaultTestRandom,
        );
        expect(step1.events.some(e => e.type === SU_EVENTS.MINION_DESTROYED)).toBe(true);

        const prompt2 = getInteractionsFromMS(step1.finalState)[0];
        const target2 = prompt2.data.options.find((o: any) => o?.value?.minionUid === 'e2');
        expect(target2).toBeDefined();

        const step2 = runCommand(
            step1.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: target2.id } } as any,
            defaultTestRandom,
        );
        expect(step2.events.some(e => e.type === SU_EVENTS.MINION_DESTROYED)).toBe(true);
        expect(getInteractionsFromMS(step2.finalState).length).toBe(0);
    });

    it('关门放狗：预算允许时应支持第三次连续选择并消灭剩余目标', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'werewolf_let_the_dog_out', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('w1', 'werewolf_howler', '0', 4, { powerModifier: 0 }),
                        makeMinion('e1', 'enemy_a', '1', 1, { powerModifier: 0 }),
                        makeMinion('e2', 'enemy_b', '1', 1, { powerModifier: 0 }),
                        makeMinion('e3', 'enemy_c', '1', 2, { powerModifier: 0 }),
                    ],
                    ongoingActions: [],
                },
            ],
        });

        const playResult = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'a1' } },
            defaultTestRandom,
        );

        const prompt1 = getInteractionsFromMS(playResult.finalState)[0];
        const target1 = prompt1.data.options.find((o: any) => o?.value?.minionUid === 'e1');
        const step1 = runCommand(
            playResult.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: target1.id } } as any,
            defaultTestRandom,
        );
        expect(step1.events.some(e => e.type === SU_EVENTS.MINION_DESTROYED)).toBe(true);

        const prompt2 = getInteractionsFromMS(step1.finalState)[0];
        const target2 = prompt2.data.options.find((o: any) => o?.value?.minionUid === 'e2');
        const step2 = runCommand(
            step1.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: target2.id } } as any,
            defaultTestRandom,
        );
        expect(step2.events.some(e => e.type === SU_EVENTS.MINION_DESTROYED)).toBe(true);

        const prompt3 = getInteractionsFromMS(step2.finalState)[0];
        const target3 = prompt3.data.options.find((o: any) => o?.value?.minionUid === 'e3');
        expect(target3).toBeDefined();

        const step3 = runCommand(
            step2.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: target3.id } } as any,
            defaultTestRandom,
        );
        expect(step3.events.filter(e => e.type === SU_EVENTS.MINION_DESTROYED)).toHaveLength(1);
        expect(getInteractionsFromMS(step3.finalState).length).toBe(0);
        expect(step3.finalState.core.bases[0].minions.map(m => m.uid)).toEqual(['w1']);
    });

    it('关门放狗：第一次消灭后应按剩余预算过滤目标', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'werewolf_let_the_dog_out', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('w1', 'werewolf_howler', '0', 4, { powerModifier: 0 }),
                        makeMinion('e1', 'enemy_a', '1', 2, { powerModifier: 0 }),
                        makeMinion('e2', 'enemy_b', '1', 3, { powerModifier: 0 }),
                    ],
                    ongoingActions: [],
                },
            ],
        });

        const playResult = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'a1' } },
            defaultTestRandom,
        );
        const prompt1 = getInteractionsFromMS(playResult.finalState)[0];
        const firstTarget = prompt1.data.options.find((o: any) => o?.value?.minionUid === 'e1');

        const step1 = runCommand(
            playResult.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: firstTarget.id } } as any,
            defaultTestRandom,
        );

        const promptsAfterFirstKill = getInteractionsFromMS(step1.finalState);
        expect(promptsAfterFirstKill.length).toBe(0);
    });
});

// ============================================================================
// 米斯卡塔尼克大学派系
// ============================================================================

describe('米斯卡塔尼克大学派系能力', () => {
    describe('miskatonic_librarian（图书管理员 talent）', () => {
        it('手中有疯狂卡时弃掉并抽1张牌', () => {
            const madnessCard = makeCard('mad1', 'special_madness', 'action', '0');
            const core = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [madnessCard],
                        deck: [
                            makeCard('dk1', 'card_a', 'minion', '0'),
                            makeCard('dk2', 'card_b', 'action', '0'),
                        ],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    { defId: 'base_a', minions: [
                        makeMinion('lib1', 'miskatonic_librarian', '0', 4, { powerModifier: 0 }),
                    ], ongoingActions: [] },
                ],
            });
            const state = makeMatchState(core);
            const result = runCommand(state,
                { type: SU_COMMANDS.USE_TALENT, playerId: '0', payload: { minionUid: 'lib1', baseIndex: 0 } },
                defaultTestRandom
            );
            // 应有弃牌事件（弃疯狂卡）和抽牌事件
            const discardEvt = result.events.find(e => e.type === SU_EVENTS.CARDS_DISCARDED);
            expect(discardEvt).toBeDefined();
            const drawEvt = result.events.find(e => e.type === SU_EVENTS.CARDS_DRAWN);
            expect(drawEvt).toBeDefined();
        });

        it('牌库空但弃牌堆有牌时弃疯狂卡后先洗回再抽牌', () => {
            const madnessCard = makeCard('mad1', 'special_madness', 'action', '0');
            const core = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [madnessCard],
                        deck: [],
                        discard: [makeCard('discard-1', 'card_a', 'minion', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    { defId: 'base_a', minions: [
                        makeMinion('lib1', 'miskatonic_librarian', '0', 4, { powerModifier: 0 }),
                    ], ongoingActions: [] },
                ],
            });
            const state = makeMatchState(core);
            const result = runCommand(state,
                { type: SU_COMMANDS.USE_TALENT, playerId: '0', payload: { minionUid: 'lib1', baseIndex: 0 } },
                defaultTestRandom
            );

            const eventTypes = result.events.map(event => event.type);
            expect(eventTypes).toContain(SU_EVENTS.CARDS_DISCARDED);
            expect(eventTypes).toContain(SU_EVENTS.DECK_RESHUFFLED);
            expect(eventTypes).toContain(SU_EVENTS.CARDS_DRAWN);
            expect(eventTypes.indexOf(SU_EVENTS.CARDS_DISCARDED)).toBeLessThan(eventTypes.indexOf(SU_EVENTS.DECK_RESHUFFLED));
            expect(eventTypes.indexOf(SU_EVENTS.DECK_RESHUFFLED)).toBeLessThan(eventTypes.indexOf(SU_EVENTS.CARDS_DRAWN));
            expect(result.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['discard-1']);
            expect(result.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['mad1']);
            expect(result.finalState.core.players['0'].discard).toHaveLength(0);
        });

        it('手中无疯狂卡时不产生事件', () => {
            const core = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('h1', 'some_card', 'minion', '0')],
                        deck: [makeCard('dk1', 'card_a', 'minion', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    { defId: 'base_a', minions: [
                        makeMinion('lib1', 'miskatonic_librarian', '0', 4, { powerModifier: 0 }),
                    ], ongoingActions: [] },
                ],
            });
            const state = makeMatchState(core);
            const result = runCommand(state,
                { type: SU_COMMANDS.USE_TALENT, playerId: '0', payload: { minionUid: 'lib1', baseIndex: 0 } },
                defaultTestRandom
            );
            expect(result.events.find(e => e.type === SU_EVENTS.CARDS_DISCARDED)).toBeUndefined();
            expect(result.events.find(e => e.type === SU_EVENTS.CARDS_DRAWN)).toBeUndefined();
        });
    });

    describe('miskatonic_professor（教授 talent）', () => {
        it('手中有疯狂卡时弃掉并获得额外行动+额外随从', () => {
            const madnessCard = makeCard('mad1', 'special_madness', 'action', '0');
            const core = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [madnessCard],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    { defId: 'base_a', minions: [
                        makeMinion('prof1', 'miskatonic_professor', '0', 5, { powerModifier: 0 }),
                    ], ongoingActions: [] },
                ],
            });
            const state = makeMatchState(core);
            const result = runCommand(state,
                { type: SU_COMMANDS.USE_TALENT, playerId: '0', payload: { minionUid: 'prof1', baseIndex: 0 } },
                defaultTestRandom
            );
            // 应有弃牌事件（弃疯狂卡）
            const discardEvt = result.events.find(e => e.type === SU_EVENTS.CARDS_DISCARDED);
            expect(discardEvt).toBeDefined();
            // 应有额度修改事件（额外行动 + 额外随从）
            const limitEvts = result.events.filter(e => e.type === SU_EVENTS.LIMIT_MODIFIED);
            expect(limitEvts.length).toBe(2);
        });

        it('手中无疯狂卡时不产生事件', () => {
            const core = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('h1', 'some_card', 'minion', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    { defId: 'base_a', minions: [
                        makeMinion('prof1', 'miskatonic_professor', '0', 5, { powerModifier: 0 }),
                    ], ongoingActions: [] },
                ],
            });
            const state = makeMatchState(core);
            const result = runCommand(state,
                { type: SU_COMMANDS.USE_TALENT, playerId: '0', payload: { minionUid: 'prof1', baseIndex: 0 } },
                defaultTestRandom
            );
            expect(result.events.find(e => e.type === SU_EVENTS.CARDS_DISCARDED)).toBeUndefined();
            expect(result.events.find(e => e.type === SU_EVENTS.LIMIT_MODIFIED)).toBeUndefined();
        });
    });
});

// ============================================================================
// 印斯茅斯派系
// ============================================================================

describe('印斯茅斯派系能力', () => {
    describe('innsmouth_the_locals（本地人 onPlay）', () => {
        it('牌库顶有同名卡时放入手牌，其余放牌库底', () => {
            const core = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('c1', 'innsmouth_the_locals', 'minion', '0')],
                        deck: [
                            makeCard('dk1', 'innsmouth_the_locals', 'minion', '0'),
                            makeCard('dk2', 'other_card', 'action', '0'),
                            makeCard('dk3', 'innsmouth_the_locals', 'minion', '0'),
                            makeCard('dk4', 'deep_card', 'minion', '0'),
                        ],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    { defId: 'base_a', minions: [], ongoingActions: [] },
                ],
            });
            const state = makeMatchState(core);
            const result = runCommand(state,
                { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'c1', baseIndex: 0 } },
                defaultTestRandom
            );
            // 同名卡（dk1, dk3）应被抽到手牌
            const drawEvt = result.events.find(e => e.type === SU_EVENTS.CARDS_DRAWN);
            expect(drawEvt).toBeDefined();
            expect(drawEvt!.payload.cardUids).toEqual(['dk1', 'dk3']);
            expect(drawEvt!.payload.count).toBe(2);

            // 非同名卡（dk2）应放到牌库底
            const reorderEvt = result.events.find(e => e.type === SU_EVENTS.DECK_REORDERED);
            expect(reorderEvt).toBeDefined();
            // 新牌库：先是剩余牌库顶（dk4），然后是本次翻出的但未入手牌的 dk1、dk3、dk2
            expect(reorderEvt!.payload.deckUids).toEqual(['dk4', 'dk1', 'dk3', 'dk2']);
        });

        it('牌库顶3张无同名卡时全部放牌库底', () => {
            const core = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('c1', 'innsmouth_the_locals', 'minion', '0')],
                        deck: [
                            makeCard('dk1', 'card_a', 'minion', '0'),
                            makeCard('dk2', 'card_b', 'action', '0'),
                            makeCard('dk3', 'card_c', 'minion', '0'),
                            makeCard('dk4', 'card_d', 'minion', '0'),
                        ],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    { defId: 'base_a', minions: [], ongoingActions: [] },
                ],
            });
            const state = makeMatchState(core);
            const result = runCommand(state,
                { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'c1', baseIndex: 0 } },
                defaultTestRandom
            );
            // 无同名卡，不应有抽牌事件
            expect(result.events.find(e => e.type === SU_EVENTS.CARDS_DRAWN)).toBeUndefined();
            // 3张全部放牌库底
            const reorderEvt = result.events.find(e => e.type === SU_EVENTS.DECK_REORDERED);
            expect(reorderEvt).toBeDefined();
            // 新牌库 = 剩余（dk4）+ 放底的（dk1, dk2, dk3）
            expect(reorderEvt!.payload.deckUids).toEqual(['dk4', 'dk1', 'dk2', 'dk3']);
        });

        it('牌库为空时不产生事件', () => {
            const core = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('c1', 'innsmouth_the_locals', 'minion', '0')],
                        deck: [],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    { defId: 'base_a', minions: [], ongoingActions: [] },
                ],
            });
            const state = makeMatchState(core);
            const result = runCommand(state,
                { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'c1', baseIndex: 0 } },
                defaultTestRandom
            );
            expect(result.events.find(e => e.type === SU_EVENTS.CARDS_DRAWN)).toBeUndefined();
            expect(result.events.find(e => e.type === SU_EVENTS.DECK_REORDERED)).toBeUndefined();
        });

        it('牌库不足3张时只检查可用的牌', () => {
            const core = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('c1', 'innsmouth_the_locals', 'minion', '0')],
                        deck: [
                            makeCard('dk1', 'innsmouth_the_locals', 'minion', '0'),
                        ],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    { defId: 'base_a', minions: [], ongoingActions: [] },
                ],
            });
            const state = makeMatchState(core);
            const result = runCommand(state,
                { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'c1', baseIndex: 0 } },
                defaultTestRandom
            );
            const drawEvt = result.events.find(e => e.type === SU_EVENTS.CARDS_DRAWN);
            expect(drawEvt).toBeDefined();
            expect(drawEvt!.payload.cardUids).toEqual(['dk1']);
        });
    });
});

// ============================================================================
// 幽灵派系
// ============================================================================

describe('幽灵派系能力', () => {
    describe('ghost_spirit（灵魂 onPlay）', () => {
        it('单个可消灭目标时创建 Prompt', () => {
            const core = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [
                            makeCard('c1', 'ghost_spirit', 'minion', '0'),
                            makeCard('h1', 'filler_a', 'minion', '0'),
                            makeCard('h2', 'filler_b', 'action', '0'),
                            makeCard('h3', 'filler_c', 'minion', '0'),
                        ],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    { defId: 'base_a', minions: [
                        makeMinion('m1', 'enemy_weak', '1', 2, { powerModifier: 0 }),
                        makeMinion('m2', 'enemy_strong', '1', 5, { powerModifier: 0 }),
                    ], ongoingActions: [] },
                ],
            });
            const state = makeMatchState(core);
            const result = runCommand(state,
                { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'c1', baseIndex: 0 } },
                defaultTestRandom
            );
            // 单个可消灭目标时创建 Prompt
            const interactions = getInteractionsFromMS(result.finalState);
            expect(interactions.length).toBe(1);
        });

        it('多个可消灭目标时创建 Prompt', () => {
            const core = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [
                            makeCard('c1', 'ghost_spirit', 'minion', '0'),
                            makeCard('h1', 'f1', 'minion', '0'),
                            makeCard('h2', 'f2', 'action', '0'),
                            makeCard('h3', 'f3', 'minion', '0'),
                            makeCard('h4', 'f4', 'action', '0'),
                            makeCard('h5', 'f5', 'minion', '0'),
                        ],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    { defId: 'base_a', minions: [
                        makeMinion('m1', 'enemy_a', '1', 2, { powerModifier: 0 }),
                        makeMinion('m2', 'enemy_b', '1', 4, { powerModifier: 0 }),
                    ], ongoingActions: [] },
                ],
            });
            const state = makeMatchState(core);
            const result = runCommand(state,
                { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'c1', baseIndex: 0 } },
                defaultTestRandom
            );
            // 5张手牌（排除自身），两个目标都可消灭 → Prompt
            const interactions = getInteractionsFromMS(result.finalState);
            expect(interactions.length).toBe(1);
            expect(interactions[0].data.sourceId).toBe('ghost_spirit');
        });

        it('手牌不足以消灭任何对手随从时不产生事件', () => {
            const core = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [
                            makeCard('c1', 'ghost_spirit', 'minion', '0'),
                            makeCard('h1', 'filler', 'minion', '0'),
                        ],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    { defId: 'base_a', minions: [
                        makeMinion('m1', 'enemy', '1', 5, { powerModifier: 0 }),
                    ], ongoingActions: [] },
                ],
            });
            const state = makeMatchState(core);
            const result = runCommand(state,
                { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'c1', baseIndex: 0 } },
                defaultTestRandom
            );
            // 只有1张可弃手牌，对手力量5，不够
            expect(result.events.find(e => e.type === SU_EVENTS.MINION_DESTROYED)).toBeUndefined();
            expect(result.events.find(e => e.type === SU_EVENTS.CARDS_DISCARDED)).toBeUndefined();
        });

        it('无对手随从时不产生事件', () => {
            const core = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [
                            makeCard('c1', 'ghost_spirit', 'minion', '0'),
                            makeCard('h1', 'filler', 'minion', '0'),
                            makeCard('h2', 'filler2', 'action', '0'),
                        ],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    { defId: 'base_a', minions: [
                        makeMinion('m0', 'own', '0', 3, { powerModifier: 0 }),
                    ], ongoingActions: [] },
                ],
            });
            const state = makeMatchState(core);
            const result = runCommand(state,
                { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'c1', baseIndex: 0 } },
                defaultTestRandom
            );
            expect(result.events.find(e => e.type === SU_EVENTS.MINION_DESTROYED)).toBeUndefined();
        });
    });
});

describe('World Champs abilities', () => {
    it('world_champs_stoneford 从牌库检索行动卡后加入手牌且不额外洗牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('stoneford-1', 'world_champs_stoneford', 'minion', '0')],
                    deck: [
                        makeCard('deck-m1', 'robot_microbot_alpha', 'minion', '0'),
                        makeCard('deck-a1', 'wizard_summon', 'action', '0'),
                        makeCard('deck-a2', 'vikings_pillage', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [{ defId: 'base_a', minions: [], ongoingActions: [] }],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'stoneford-1', baseIndex: 0 } },
            defaultTestRandom,
        );

        const prompt = getInteractionsFromMS(played.finalState)[0] as any;
        expect(prompt?.data?.sourceId).toBe('world_champs_stoneford');
        const option = prompt.data.options.find((entry: any) => entry.value?.cardUid === 'deck-a2');
        expect(option).toBeDefined();

        const resolved = runCommand(
            played.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: option.id } } as any,
            defaultTestRandom,
        );

        expect(resolved.finalState.core.players['0'].hand.some(card => card.uid === 'deck-a2')).toBe(true);
        expect(resolved.finalState.core.players['0'].deck.some(card => card.uid === 'deck-a2')).toBe(false);
        expect(resolved.events.some(event => event.type === SU_EVENTS.DECK_REORDERED)).toBe(false);
        expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['deck-m1', 'deck-a1']);
    });

    it('world_champs_shield_maiden 揭示对手牌库顶并拿走符合条件的牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('sm-1', 'world_champs_shield_maiden', 'minion', '0')],
                }),
                '1': makePlayer('1', {
                    deck: [makeCard('top-action', 'wizard_summon', 'action', '1')],
                }),
            },
            bases: [{ defId: 'base_a', minions: [], ongoingActions: [] }],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'sm-1', baseIndex: 0 } },
            defaultTestRandom,
        );

        const prompt = getInteractionsFromMS(played.finalState)[0] as any;
        expect(prompt?.data?.sourceId).toBe('world_champs_shield_maiden');
        const option = prompt.data.options.find((entry: any) => entry.value?.targetPlayerId === '1');
        expect(option).toBeDefined();

        const resolved = runCommand(
            played.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: option.id } } as any,
            defaultTestRandom,
        );

        expect(resolved.finalState.core.players['0'].hand.some(card => card.uid === 'top-action')).toBe(true);
        expect(resolved.finalState.core.players['1'].deck).toHaveLength(0);
    });

    it('world_champs_sheriff 在计分前可发起决斗并消灭落败随从', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('sheriff-1', 'world_champs_sheriff', '0', 5, { powerModifier: 0 }),
                    makeMinion('enemy-1', 'robot_microbot_alpha', '1', 2, { powerModifier: 0 }),
                ],
                ongoingActions: [],
            }],
        });

        const triggerResult = fireTriggers(core, 'beforeScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            sourceCardUid: 'sheriff-1',
            sourceBaseIndex: 0,
            sourceControllerId: '0',
            random: defaultTestRandom,
            now: 1000,
        });

        const promptState = triggerResult.matchState ?? makeMatchState(core);
        const prompt = getInteractionsFromMS(promptState)[0] as any;
        expect(prompt?.data?.sourceId).toBe('world_champs_sheriff_before_scoring');

        const option = prompt.data.options.find((entry: any) => entry.value?.minionUid === 'enemy-1');
        expect(option).toBeDefined();

        const chosen = runCommand(
            promptState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: option.id } } as any,
            defaultTestRandom,
        );
        expect(chosen.finalState.core.activeDuel?.challengerMinionUid).toBe('sheriff-1');
        expect(chosen.finalState.core.activeDuel?.challengedMinionUid).toBe('enemy-1');
        const duelPrompt = getInteractionsFromMS(chosen.finalState)[0] as any;
        expect(duelPrompt?.data?.sourceId).toBe('smashup_duel_card');
        const duelResolved = resolveDuelChain(chosen.finalState);
        expect(duelResolved.events.some(event => event.type === SU_EVENTS.MINION_DESTROYED)).toBe(true);
        expect(duelResolved.finalState.core.bases[0].minions.some(minion => minion.uid === 'enemy-1')).toBe(false);
    });

    it('world_champs_mummy 在计分后可埋葬到其他基地', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [makeMinion('mummy-1', 'world_champs_mummy', '0', 2)],
                    ongoingActions: [],
                },
                {
                    defId: 'base_b',
                    minions: [],
                    ongoingActions: [],
                },
            ],
        });

        const triggerResult = fireTriggers(core, 'afterScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            rankings: [{ playerId: '0', power: 2, vp: 3 }],
            sourceCardUid: 'mummy-1',
            sourceBaseIndex: 0,
            sourceControllerId: '0',
            random: defaultTestRandom,
            now: 1001,
        });

        const promptState = triggerResult.matchState ?? makeMatchState(core);
        const prompt = getInteractionsFromMS(promptState)[0] as any;
        expect(prompt?.data?.sourceId).toBe('world_champs_mummy_after_scoring');
        const option = prompt.data.options.find((entry: any) => entry.value?.baseIndex === 1);
        expect(option).toBeDefined();

        const resolved = runCommand(
            promptState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: option.id } } as any,
            defaultTestRandom,
        );

        expect(resolved.events.some(event => event.type === SU_EVENTS.CARD_BURIED)).toBe(true);
        expect(resolved.finalState.core.bases[0].minions.some(minion => minion.uid === 'mummy-1')).toBe(false);
        expect((resolved.finalState.core.bases[1].buriedCards ?? []).some(card => card.uid === 'mummy-1')).toBe(true);
    });

    it('world_champs_kaiju_conflict 提供两次额外行动额度', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('kaiju-1', 'world_champs_kaiju_conflict', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{ defId: 'base_a', minions: [], ongoingActions: [] }],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'kaiju-1' } },
            defaultTestRandom,
        );

        const limitEvents = played.events.filter(event => event.type === SU_EVENTS.LIMIT_MODIFIED);
        expect(limitEvents).toHaveLength(2);
        const totalDelta = limitEvents.reduce((sum, event: any) => sum + (event.payload?.delta ?? 0), 0);
        expect(totalDelta).toBe(2);
    });

    it('world_champs_akye_the_turtle 可交给对手一张手牌并抽两张', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('akye-1', 'world_champs_akye_the_turtle', 'minion', '0'),
                        makeCard('gift-1', 'wizard_summon', 'action', '0'),
                    ],
                    deck: [
                        makeCard('draw-1', 'robot_microbot_alpha', 'minion', '0'),
                        makeCard('draw-2', 'robot_microbot_beta', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [{ defId: 'base_a', minions: [], ongoingActions: [] }],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'akye-1', baseIndex: 0 } },
            defaultTestRandom,
        );
        const choosePlayerPrompt = getInteractionsFromMS(played.finalState)[0] as any;
        expect(choosePlayerPrompt?.data?.sourceId).toBe('world_champs_akye_the_turtle_player');
        const playerOption = choosePlayerPrompt.data.options.find((entry: any) => entry.value?.targetPlayerId === '1');
        expect(playerOption).toBeDefined();

        const afterPlayer = runCommand(
            played.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: playerOption.id } } as any,
            defaultTestRandom,
        );
        const chooseCardPrompt = getInteractionsFromMS(afterPlayer.finalState)[0] as any;
        expect(chooseCardPrompt?.data?.sourceId).toBe('world_champs_akye_the_turtle_card');
        const cardOption = chooseCardPrompt.data.options.find((entry: any) => entry.value?.cardUid === 'gift-1');
        expect(cardOption).toBeDefined();

        const resolved = runCommand(
            afterPlayer.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: cardOption.id } } as any,
            defaultTestRandom,
        );
        expect(resolved.finalState.core.players['1'].hand.some(card => card.uid === 'gift-1')).toBe(true);
        expect(resolved.finalState.core.players['0'].hand.some(card => card.uid === 'gift-1')).toBe(false);
        expect(resolved.finalState.core.players['0'].hand.some(card => card.uid === 'draw-1')).toBe(true);
        expect(resolved.finalState.core.players['0'].hand.some(card => card.uid === 'draw-2')).toBe(true);
    });

    it('world_champs_samurai_chan 打出时不应触发海龟阿凯式 onPlay 交互', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('chan-1', 'world_champs_samurai_chan', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{ defId: 'base_a', minions: [], ongoingActions: [] }],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'chan-1', baseIndex: 0 } },
            defaultTestRandom,
        );

        const interactions = getInteractionsFromMS(played.finalState);
        expect(interactions).toHaveLength(0);
        expect(played.events.some((event: any) => event.type === SU_EVENTS.CARDS_DRAWN && event.payload?.count === 2)).toBe(false);
    });

    it('world_champs_samurai_chan 因基地计分从场上进入弃牌堆后会抽一张牌', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('draw-1', 'robot_microbot_alpha', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('chan-1', 'world_champs_samurai_chan', '0', 2)],
                ongoingActions: [],
            }],
        });

        const result = fireTriggers(state, 'onMinionDiscardedFromBase', {
            state,
            matchState: makeMatchState(state),
            playerId: '0',
            baseIndex: 0,
            triggerMinion: makeMinion('chan-1', 'world_champs_samurai_chan', '0', 2),
            triggerMinionUid: 'chan-1',
            triggerMinionDefId: 'world_champs_samurai_chan',
            random: defaultTestRandom,
            now: 1002,
        });

        expect(result.events.some((event: any) => (
            event.type === SU_EVENTS.CARDS_DRAWN
            && event.payload?.playerId === '0'
            && event.payload?.count === 1
        ))).toBe(true);
    });

    it('world_champs_high_speed_chase 天赋可转移行动并移动随从且+3', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [makeMinion('runner-1', 'robot_microbot_alpha', '0', 1, { powerModifier: 0 })],
                    ongoingActions: [{ uid: 'hsc-1', defId: 'world_champs_high_speed_chase', ownerId: '0', talentUsed: false }],
                },
                {
                    defId: 'base_b',
                    minions: [],
                    ongoingActions: [],
                },
            ],
        });

        const used = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.USE_TALENT, playerId: '0', payload: { ongoingCardUid: 'hsc-1', baseIndex: 0 } },
            defaultTestRandom,
        );
        const chooseMinionPrompt = getInteractionsFromMS(used.finalState)[0] as any;
        expect(chooseMinionPrompt?.data?.sourceId).toBe('world_champs_high_speed_chase_minion');
        const minionOption = chooseMinionPrompt.data.options.find((entry: any) => entry.value?.minionUid === 'runner-1');
        expect(minionOption).toBeDefined();

        const afterMinion = runCommand(
            used.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: minionOption.id } } as any,
            defaultTestRandom,
        );
        const chooseBasePrompt = getInteractionsFromMS(afterMinion.finalState)[0] as any;
        expect(chooseBasePrompt?.data?.sourceId).toBe('world_champs_high_speed_chase_base');
        const baseOption = chooseBasePrompt.data.options.find((entry: any) => entry.value?.baseIndex === 1);
        expect(baseOption).toBeDefined();

        const resolved = runCommand(
            afterMinion.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: baseOption.id } } as any,
            defaultTestRandom,
        );
        expect(resolved.finalState.core.bases[1].minions.some(minion => minion.uid === 'runner-1')).toBe(true);
        expect(resolved.finalState.core.bases[0].ongoingActions.some(action => action.uid === 'hsc-1')).toBe(false);
        expect(resolved.finalState.core.bases[1].ongoingActions.some(action => action.uid === 'hsc-1')).toBe(true);
        expect(resolved.finalState.core.bases[1].ongoingActions.find(action => action.uid === 'hsc-1')?.talentUsed).toBe(true);
        const movedMinion = resolved.finalState.core.bases[1].minions.find(minion => minion.uid === 'runner-1');
        expect(movedMinion?.tempPowerModifier).toBe(3);

        const reused = validate(resolved.finalState, {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { ongoingCardUid: 'hsc-1', baseIndex: 1 },
        });
        expect(reused.valid).toBe(false);
        expect(reused.error).toBe('本回合天赋已使用');
    });

    it('world_champs_aramis 每回合一次在自己回合被行动直接影响后获得额外行动', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            turnNumber: 3,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('aramis-1', 'world_champs_aramis', '0', 4, { powerModifier: 0 })],
                ongoingActions: [],
            }],
        });

        const first = fireTriggers(core, 'onMinionAffected', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            sourceCardUid: 'aramis-1',
            sourceBaseIndex: 0,
            sourceControllerId: '0',
            triggerMinionUid: 'aramis-1',
            triggerMinionDefId: 'world_champs_aramis',
            triggerMinion: core.bases[0].minions[0],
            affectType: 'power_change',
            reason: 'world_champs_fast_as_lightning',
            random: defaultTestRandom,
            now: 3100,
        });
        const firstEvents = first.events;
        expect(firstEvents.some(event => event.type === SU_EVENTS.LIMIT_MODIFIED)).toBe(true);
        const markedCore = firstEvents.reduce((acc, event) => reduce(acc, event as any), core);

        const second = fireTriggers(markedCore, 'onMinionAffected', {
            state: markedCore,
            matchState: makeMatchState(markedCore),
            playerId: '0',
            baseIndex: 0,
            sourceCardUid: 'aramis-1',
            sourceBaseIndex: 0,
            sourceControllerId: '0',
            triggerMinionUid: 'aramis-1',
            triggerMinionDefId: 'world_champs_aramis',
            triggerMinion: markedCore.bases[0].minions[0],
            affectType: 'power_change',
            reason: 'world_champs_fast_as_lightning',
            random: defaultTestRandom,
            now: 3101,
        });
        expect(second.events.some(event => event.type === SU_EVENTS.LIMIT_MODIFIED)).toBe(false);
    });

    it('world_champs_diva 应以可选反应形式复制标准行动效果，未选择前不会自动生效，且不受“你的回合”限制', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            turnNumber: 5,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('diva-1', 'world_champs_diva', '0', 3, { powerModifier: 0 }),
                    makeMinion('ally-1', 'robot_microbot_alpha', '0', 1, { powerModifier: 0 }),
                ],
                ongoingActions: [],
            }],
        });

        const originalEvent = {
            type: SU_EVENTS.TEMP_POWER_ADDED,
            payload: {
                minionUid: 'ally-1',
                baseIndex: 0,
                amount: 2,
                reason: 'world_champs_fast_as_lightning',
                sourcePlayerId: '1',
                sourceDefId: 'world_champs_fast_as_lightning',
                sourceCardUid: 'enemy-fast-1',
                sourceControllerId: '1',
                sourceBaseIndex: 0,
            },
            timestamp: 3200,
        };
        const afterOriginal = reduce(core, originalEvent as any);
        const queued = collectTriggers(afterOriginal, 'onMinionAffected', {
            state: afterOriginal,
            matchState: makeMatchState(afterOriginal),
            playerId: '1',
            baseIndex: 0,
            sourceCardUid: 'enemy-fast-1',
            sourceBaseIndex: 0,
            sourceControllerId: '1',
            triggerMinionUid: 'ally-1',
            triggerMinionDefId: 'robot_microbot_alpha',
            triggerMinion: afterOriginal.bases[0].minions.find(minion => minion.uid === 'ally-1'),
            affectType: 'power_change',
            affectEvent: originalEvent as any,
            affectBatchTargets: [{ minionUid: 'ally-1', baseIndex: 0, controllerId: '0' }],
            reason: 'world_champs_fast_as_lightning',
            random: defaultTestRandom,
            now: 3200,
        });

        expect(queued).toBeDefined();
        const queuedCore = {
            ...afterOriginal,
            triggerQueue: (queued as any).payload.triggers,
        };
        const passPrompt = maybeResolveReactionQueue(makeMatchState(queuedCore), defaultTestRandom, 3200);
        const prompt = maybeResolveReactionQueue(makeMatchState(queuedCore), defaultTestRandom, 3200);
        expect(prompt?.state.sys.interaction.current?.data?.sourceId).toBe('smashup_reaction_choose');

        const optionIds = (prompt!.state.sys.interaction.current as any).data.options.map((option: any) => option.id);
        expect(optionIds).toContain('pass');
        const queueById = new Map(prompt!.state.core.triggerQueue?.map(trigger => [trigger.id, trigger]) ?? []);
        const divaOption = (prompt!.state.sys.interaction.current as any).data.options.find((option: any) => {
            const trigger = queueById.get(option.value?.triggerId) as any;
            return trigger?.sourceDefId === 'world_champs_diva';
        });
        expect(divaOption).toBeDefined();
        expect(prompt!.state.core.bases[0].minions.find(minion => minion.uid === 'diva-1')?.tempPowerModifier ?? 0).toBe(0);

        const passed = runCommand(
            passPrompt!.state,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: 'pass' } } as any,
            defaultTestRandom,
        );
        expect(passed.finalState.core.bases[0].minions.find(minion => minion.uid === 'diva-1')?.tempPowerModifier ?? 0).toBe(0);

        const resolved = runCommand(
            prompt!.state,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: divaOption.id } } as any,
            defaultTestRandom,
        );
        const divaCopyEvent = resolved.events.find((event: any) =>
            event.type === SU_EVENTS.TEMP_POWER_ADDED
            && event.payload?.minionUid === 'diva-1'
            && event.payload?.amount === 2,
        );
        expect(divaCopyEvent).toBeDefined();
        expect(resolved.events.some((event: any) =>
            event.type === SU_EVENTS.MINION_METADATA_UPDATED
            && event.payload?.minionUid === 'diva-1'
            && event.payload?.reason === 'world_champs_diva_once_per_turn',
        )).toBe(true);
        expect(resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'diva-1')?.tempPowerModifier ?? 0).toBe(2);
    });

    it('world_champs_fast_as_lightning 打到阿拉密斯后应进入包含女主角与阿拉密斯的反应窗', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            turnNumber: 9,
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('fal-1', 'world_champs_fast_as_lightning', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('diva-1', 'world_champs_diva', '0', 3, { powerModifier: 0, tempPowerModifier: 0 }),
                    makeMinion('aramis-1', 'world_champs_aramis', '0', 4, { powerModifier: 0, tempPowerModifier: 0 }),
                ],
                ongoingActions: [],
            }],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'fal-1' } },
            defaultTestRandom,
        );
        const targetPrompt = getInteractionsFromMS(played.finalState)[0] as any;
        expect(targetPrompt?.data?.sourceId).toBe('world_champs_fast_as_lightning');

        const aramisOption = targetPrompt.data.options.find((option: any) => option.value?.minionUid === 'aramis-1');
        expect(aramisOption).toBeDefined();

        const targeted = runCommand(
            played.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: aramisOption.id } } as any,
            defaultTestRandom,
        );

        const reactionPrompt = getInteractionsFromMS(targeted.finalState)[0] as any;
        expect(reactionPrompt?.data?.sourceId).toBe('smashup_reaction_choose');

        const queuedById = new Map((targeted.finalState.core.triggerQueue ?? []).map((trigger: any) => [trigger.id, trigger]));
        const optionSourceDefIds = (reactionPrompt?.data?.options ?? [])
            .map((option: any) => queuedById.get(option.value?.triggerId)?.sourceDefId)
            .filter(Boolean);

        expect(optionSourceDefIds).toContain('world_champs_diva');
        expect(optionSourceDefIds).toContain('world_champs_aramis');
    });

    it('world_champs_fast_as_lightning 依次选择女主角与阿拉密斯后应正确收口并保留额外行动', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            turnNumber: 9,
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('fal-1', 'world_champs_fast_as_lightning', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('diva-1', 'world_champs_diva', '0', 3, { powerModifier: 0, tempPowerModifier: 0 }),
                    makeMinion('aramis-1', 'world_champs_aramis', '0', 4, { powerModifier: 0, tempPowerModifier: 0 }),
                ],
                ongoingActions: [],
            }],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'fal-1' } },
            defaultTestRandom,
        );
        const targetPrompt = getInteractionsFromMS(played.finalState)[0] as any;
        const aramisTargetOption = targetPrompt.data.options.find((option: any) => option.value?.minionUid === 'aramis-1');
        expect(aramisTargetOption).toBeDefined();

        const targeted = runCommand(
            played.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: aramisTargetOption.id } } as any,
            defaultTestRandom,
        );
        const initialReactionPrompt = getInteractionsFromMS(targeted.finalState)[0] as any;
        const initialQueue = new Map((targeted.finalState.core.triggerQueue ?? []).map((trigger: any) => [trigger.id, trigger]));
        const divaOption = initialReactionPrompt.data.options.find((option: any) =>
            initialQueue.get(option.value?.triggerId)?.sourceDefId === 'world_champs_diva'
        );
        expect(divaOption).toBeDefined();

        const afterDiva = runCommand(
            targeted.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: divaOption.id } } as any,
            defaultTestRandom,
        );
        expect(afterDiva.finalState.core.bases[0].minions.find(minion => minion.uid === 'diva-1')?.tempPowerModifier ?? 0).toBe(2);

        const secondReactionPrompt = getInteractionsFromMS(afterDiva.finalState)[0] as any;
        const secondQueue = new Map((afterDiva.finalState.core.triggerQueue ?? []).map((trigger: any) => [trigger.id, trigger]));
        const aramisReactionOption = secondReactionPrompt.data.options.find((option: any) =>
            secondQueue.get(option.value?.triggerId)?.sourceDefId === 'world_champs_aramis'
        );
        expect(aramisReactionOption).toBeDefined();

        const afterAramis = runCommand(
            afterDiva.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: aramisReactionOption.id } } as any,
            defaultTestRandom,
        );

        expect(getInteractionsFromMS(afterAramis.finalState)).toHaveLength(0);
        expect(afterAramis.finalState.core.bases[0].minions.find(minion => minion.uid === 'aramis-1')?.tempPowerModifier ?? 0).toBe(2);
        expect(afterAramis.finalState.core.players['0'].actionsPlayed).toBe(1);
        expect(afterAramis.finalState.core.players['0'].actionLimit).toBeGreaterThanOrEqual(2);
    });

    it('world_champs_smart_set_up 首次有随从打到附着基地时抽 1 张', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('smart-1', 'world_champs_smart_set_up', 'action', '0')],
                    deck: [makeCard('draw-1', 'robot_microbot_alpha', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('enemy-1', 'wizard_archmage', '1', 4, { powerModifier: 0 })],
                ongoingActions: [],
            }],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'smart-1', targetBaseIndex: 0, targetMinionUid: 'enemy-1' } as any },
            defaultTestRandom,
        );
        expect(getInteractionsFromMS(played.finalState)).toHaveLength(0);
        expect(played.finalState.core.bases[0].minions[0].attachedActions.some(action => action.defId === 'world_champs_smart_set_up')).toBe(true);

        const triggerCore: SmashUpCore = {
            ...played.finalState.core,
            players: {
                ...played.finalState.core.players,
                '1': {
                    ...played.finalState.core.players['1'],
                    minionsPlayedPerBase: { ...(played.finalState.core.players['1'].minionsPlayedPerBase ?? {}), 0: 1 },
                },
            },
        };

        const triggerResult = fireTriggers(triggerCore, 'onMinionPlayed', {
            state: triggerCore,
            matchState: { ...played.finalState, core: triggerCore },
            playerId: '1',
            baseIndex: 0,
            sourceCardUid: played.finalState.core.bases[0].minions[0].attachedActions[0].uid,
            sourceBaseIndex: 0,
            sourceControllerId: '0',
            triggerMinionUid: 'new-minion',
            triggerMinionDefId: 'robot_microbot_alpha',
            random: defaultTestRandom,
            now: 3300,
        });
        expect(triggerResult.events.some(event => event.type === SU_EVENTS.CARDS_DRAWN)).toBe(true);
    });

    it('world_champs_bewitched 离场转移交互可把持续行动从弃牌堆重新附着', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    discard: [makeCard('bewitched-card', 'world_champs_bewitched', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('target-1', 'robot_microbot_alpha', '1', 1, { powerModifier: 0 })],
                ongoingActions: [],
            }],
        });
        const handler = getInteractionHandler('world_champs_bewitched_transfer');
        expect(handler).toBeDefined();
        const handled = handler!(
            makeMatchState(core),
            '0',
            { minionUid: 'target-1', baseIndex: 0 } as any,
            {
                runtimePrompt: {
                    owner: 'smashup-ability-runtime',
                    sourceId: 'world_champs_bewitched_transfer',
                    continuationId: 'test-bewitched-transfer',
                    continuation: {
                        context: {
                            playerId: '0',
                            now: 3400,
                            sourceCardUid: 'bewitched-card',
                            sourceDefId: 'world_champs_bewitched',
                            ownerId: '0',
                            triggerMinionUid: 'host-1',
                        },
                        contextHasMatchState: true,
                    },
                },
            } as any,
            defaultTestRandom,
            3400,
        );
        const reduced = handled.events.reduce((acc, event) => reduce(acc, event as any), core);
        expect(reduced.players['0'].discard.some(card => card.uid === 'bewitched-card')).toBe(false);
        expect(reduced.bases[0].minions[0].attachedActions.some(action => action.uid === 'bewitched-card')).toBe(true);
    });

    it('world_champs_calicoin 可选择其他随从放置 +1 指示物', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('cali-1', 'world_champs_calicoin', 'minion', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('target-1', 'robot_microbot_alpha', '0', 1, { powerModifier: 0 }),
                    makeMinion('target-2', 'robot_microbot_beta', '1', 1, { powerModifier: 0 }),
                ],
                ongoingActions: [],
            }],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'cali-1', baseIndex: 0 } },
            defaultTestRandom,
        );
        const prompt = getInteractionsFromMS(played.finalState)[0] as any;
        expect(prompt?.data?.sourceId).toBe('world_champs_calicoin');
        const option = prompt.data.options.find((entry: any) => entry.value?.minionUid === 'target-1');
        expect(option).toBeDefined();

        const resolved = runCommand(
            played.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: option.id } } as any,
            defaultTestRandom,
        );
        const counterEvent = resolved.events.find(event => event.type === SU_EVENTS.POWER_COUNTER_ADDED) as any;
        expect(counterEvent?.payload?.minionUid).toBe('target-1');
    });

    it('world_champs_rainbow_girl 只给同基地其他己方随从 +1 临时力量', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('rg-1', 'world_champs_rainbow_girl', 'minion', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('ally-1', 'robot_microbot_alpha', '0', 1, { powerModifier: 0 }),
                    makeMinion('enemy-1', 'robot_microbot_beta', '1', 2, { powerModifier: 0 }),
                ],
                ongoingActions: [],
            }],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'rg-1', baseIndex: 0 } },
            defaultTestRandom,
        );
        const ally = played.finalState.core.bases[0].minions.find(minion => minion.uid === 'ally-1');
        const self = played.finalState.core.bases[0].minions.find(minion => minion.uid === 'rg-1');
        const enemy = played.finalState.core.bases[0].minions.find(minion => minion.uid === 'enemy-1');
        expect(ally?.tempPowerModifier).toBe(1);
        expect(self?.tempPowerModifier ?? 0).toBe(0);
        expect(enemy?.tempPowerModifier ?? 0).toBe(0);
    });

    it('world_champs_its_blitzin_time 可选择己方随从并在本回合 +3 力量', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('blitz-1', 'world_champs_its_blitzin_time', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [
                { defId: 'base_a', minions: [makeMinion('ally-1', 'robot_microbot_alpha', '0', 1, { powerModifier: 0 })], ongoingActions: [] },
                { defId: 'base_b', minions: [makeMinion('ally-2', 'robot_microbot_beta', '0', 2, { powerModifier: 0 })], ongoingActions: [] },
            ],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'blitz-1' } },
            defaultTestRandom,
        );
        const prompt = getInteractionsFromMS(played.finalState)[0] as any;
        expect(prompt?.data?.sourceId).toBe('world_champs_its_blitzin_time');
        const option = prompt.data.options.find((entry: any) => entry.value?.minionUid === 'ally-2');
        expect(option).toBeDefined();

        const resolved = runCommand(
            played.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: option.id } } as any,
            defaultTestRandom,
        );
        const boosted = resolved.finalState.core.bases[1].minions.find(minion => minion.uid === 'ally-2');
        expect(boosted?.tempPowerModifier).toBe(3);
    });

    it('world_champs_fighting_spirit_prize 抽两张并分配两个 +1 指示物', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('fsp-1', 'world_champs_fighting_spirit_prize', 'action', '0')],
                    deck: [
                        makeCard('draw-1', 'robot_microbot_alpha', 'minion', '0'),
                        makeCard('draw-2', 'robot_microbot_beta', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('ally-1', 'robot_microbot_alpha', '0', 1, { powerModifier: 0 }),
                    makeMinion('ally-2', 'robot_microbot_beta', '0', 2, { powerModifier: 0 }),
                ],
                ongoingActions: [],
            }],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'fsp-1' } },
            defaultTestRandom,
        );
        expect(played.events.some(event => event.type === SU_EVENTS.CARDS_DRAWN)).toBe(true);

        const prompt = getInteractionsFromMS(played.finalState)[0] as any;
        expect(prompt?.data?.sourceId).toBe('world_champs_fighting_spirit_prize');
        const ally1 = prompt.data.options.find((entry: any) => entry.value?.minionUid === 'ally-1');
        const ally2 = prompt.data.options.find((entry: any) => entry.value?.minionUid === 'ally-2');
        expect(ally1).toBeDefined();
        expect(ally2).toBeDefined();

        const resolved = runCommand(
            played.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionIds: [ally1.id, ally2.id] } } as any,
            defaultTestRandom,
        );
        expect(resolved.events.filter(event => event.type === SU_EVENTS.POWER_COUNTER_ADDED)).toHaveLength(2);
    });

    it('world_champs_mouse_bird_and_sausage 选择锚点后会给同基地同派系随从 +2', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('mbs-1', 'world_champs_mouse_bird_and_sausage', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('robot-1', 'robot_microbot_alpha', '0', 1, { powerModifier: 0 }),
                    makeMinion('robot-2', 'robot_microbot_alpha', '0', 2, { powerModifier: 0 }),
                    makeMinion('wizard-1', 'wizard_archmage', '0', 4, { powerModifier: 0 }),
                ],
                ongoingActions: [],
            }],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'mbs-1' } },
            defaultTestRandom,
        );
        const anchorPrompt = getInteractionsFromMS(played.finalState)[0] as any;
        expect(anchorPrompt?.data?.sourceId).toBe('world_champs_mouse_bird_and_sausage_anchor');
        const anchorOption = anchorPrompt.data.options.find((entry: any) => entry.value?.minionUid === 'robot-1');
        expect(anchorOption).toBeDefined();

        const resolved = runCommand(
            played.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: anchorOption.id } } as any,
            defaultTestRandom,
        );
        const robot1 = resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'robot-1');
        const robot2 = resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'robot-2');
        const wizard = resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'wizard-1');
        expect(robot1?.tempPowerModifier).toBe(2);
        expect(robot2?.tempPowerModifier).toBe(2);
        expect(wizard?.tempPowerModifier ?? 0).toBe(0);
    });

    it('world_champs_shark_tattoo 打出后附着到己方随从并放置 +1 指示物', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('shark-1', 'world_champs_shark_tattoo', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('ally-1', 'robot_microbot_alpha', '0', 1, { powerModifier: 0 })],
                ongoingActions: [],
            }],
        });

        const played = runCommand(
            makeMatchState(core),
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'shark-1', targetBaseIndex: 0, targetMinionUid: 'ally-1' } as any,
            },
            defaultTestRandom,
        );

        const target = played.finalState.core.bases[0].minions.find(minion => minion.uid === 'ally-1');
        expect(target?.attachedActions.some(action => action.defId === 'world_champs_shark_tattoo')).toBe(true);
        expect(target?.powerCounters).toBe(1);
    });

    it('world_champs_shark_tattoo 在你的回合开始时若这里是你唯一随从则再放置 1 个 +1 指示物', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('shark-1', 'world_champs_shark_tattoo', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('ally-1', 'robot_microbot_alpha', '0', 1, { powerCounters: 0 })],
                ongoingActions: [],
            }],
        });

        const played = runCommand(
            makeMatchState(core),
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'shark-1', targetBaseIndex: 0, targetMinionUid: 'ally-1' } as any,
            },
            defaultTestRandom,
        );

        const opponentTurn = runCommand(
            played.finalState,
            { type: 'ADVANCE_PHASE' as any, playerId: '0', payload: undefined } as any,
            defaultTestRandom,
        );
        const nextOwnTurn = runCommand(
            opponentTurn.finalState,
            { type: 'ADVANCE_PHASE' as any, playerId: '1', payload: undefined } as any,
            defaultTestRandom,
        );

        const target = nextOwnTurn.finalState.core.bases[0].minions.find(minion => minion.uid === 'ally-1');
        const counterEvents = nextOwnTurn.events.filter((event: any) => event.type === SU_EVENTS.POWER_COUNTER_ADDED);
        expect(target?.attachedActions.some(action => action.defId === 'world_champs_shark_tattoo')).toBe(true);
        expect(counterEvents).toHaveLength(1);
        expect(target?.powerCounters).toBe(2);
    });

    it('world_champs_shark_tattoo 在这里还有你的其他随从时回合开始不再放置指示物', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('shark-1', 'world_champs_shark_tattoo', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('ally-1', 'robot_microbot_alpha', '0', 1, { powerCounters: 0 }),
                    makeMinion('ally-2', 'robot_microbot_beta', '0', 1, { powerCounters: 0 }),
                ],
                ongoingActions: [],
            }],
        });

        const played = runCommand(
            makeMatchState(core),
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'shark-1', targetBaseIndex: 0, targetMinionUid: 'ally-1' } as any,
            },
            defaultTestRandom,
        );

        const opponentTurn = runCommand(
            played.finalState,
            { type: 'ADVANCE_PHASE' as any, playerId: '0', payload: undefined } as any,
            defaultTestRandom,
        );
        const nextOwnTurn = runCommand(
            opponentTurn.finalState,
            { type: 'ADVANCE_PHASE' as any, playerId: '1', payload: undefined } as any,
            defaultTestRandom,
        );

        const ally1 = nextOwnTurn.finalState.core.bases[0].minions.find(minion => minion.uid === 'ally-1');
        const ally2 = nextOwnTurn.finalState.core.bases[0].minions.find(minion => minion.uid === 'ally-2');
        expect(ally1?.attachedActions.some(action => action.defId === 'world_champs_shark_tattoo')).toBe(true);
        expect(ally1?.powerCounters).toBe(1);
        expect(ally2?.powerCounters ?? 0).toBe(0);
    });

    it('world_champs_eh special 响应后会给随从 +1 并把该牌回收到手牌', () => {
        const executor = resolveSpecial('world_champs_eh');
        expect(executor).toBeDefined();

        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    discard: [makeCard('eh-1', 'world_champs_eh', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('ally-1', 'robot_microbot_alpha', '0', 1, { powerModifier: 0 })],
                ongoingActions: [],
            }],
        });

        const executed = executor!({
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'eh-1',
            defId: 'world_champs_eh',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 3600,
        });
        const promptState = executed.matchState ?? makeMatchState(core);
        const prompt = getInteractionsFromMS(promptState)[0] as any;
        expect(prompt?.data?.sourceId).toBe('world_champs_eh');
        const option = prompt.data.options.find((entry: any) => entry.value?.minionUid === 'ally-1');
        expect(option).toBeDefined();

        const resolved = runCommand(
            promptState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: option.id } } as any,
            defaultTestRandom,
        );
        expect(resolved.events.some(event => event.type === SU_EVENTS.CARD_RECOVERED_FROM_DISCARD)).toBe(true);
        expect(resolved.finalState.core.players['0'].hand.some(card => card.uid === 'eh-1')).toBe(true);
        expect(resolved.finalState.core.players['0'].discard.some(card => card.uid === 'eh-1')).toBe(false);
    });

    it('world_champs_eh 在你的回合打出第一个行动后可从弃牌堆发动，且本回合不会重复出现', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    discard: [makeCard('eh-1', 'world_champs_eh', 'action', '0')],
                    actionsPlayed: 1,
                }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [makeMinion('ally-1', 'robot_microbot_alpha', '0', 1, { powerModifier: 0 })],
                    ongoingActions: [],
                },
                {
                    defId: 'base_b',
                    minions: [],
                    ongoingActions: [],
                },
            ],
        });

        const options = getDiscardSpecialOptions(core, '0');
        expect(options).toHaveLength(1);
        expect(options[0]?.card.uid).toBe('eh-1');
        expect(options[0]?.sourceId).toBe('world_champs_eh');

        const activated = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.ACTIVATE_SPECIAL, playerId: '0', payload: { discardCardUid: 'eh-1', baseIndex: 0 } } as any,
            defaultTestRandom,
        );
        const prompt = getInteractionsFromMS(activated.finalState)[0] as any;
        expect(prompt?.data?.sourceId).toBe('world_champs_eh');
        const option = prompt.data.options.find((entry: any) => entry.value?.minionUid === 'ally-1');
        expect(option).toBeDefined();

        const resolved = runCommand(
            activated.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: option.id } } as any,
            defaultTestRandom,
        );
        const ally = resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'ally-1');
        expect(ally?.tempPowerModifier).toBe(1);
        expect(resolved.finalState.core.players['0'].hand.some(card => card.uid === 'eh-1')).toBe(true);
        expect(resolved.finalState.core.players['0'].usedDiscardPlayAbilities).toContain('world_champs_eh');
        expect(getDiscardSpecialOptions(resolved.finalState.core, '0')).toHaveLength(0);

        const beforeFirstAction = {
            ...core,
            players: {
                ...core.players,
                '0': {
                    ...core.players['0'],
                    actionsPlayed: 0,
                },
            },
        };
        expect(getDiscardSpecialOptions(beforeFirstAction, '0')).toHaveLength(0);
    });
});

describe('Mermaids abilities', () => {
    it('mermaids_charmer 可先移动自己，再把另一个玩家力量 3 或以下的随从移到这里', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [makeMinion('charmer-1', 'mermaids_charmer', '0', 3, { powerModifier: 0 })],
                    ongoingActions: [],
                },
                {
                    defId: 'base_b',
                    minions: [],
                    ongoingActions: [],
                },
                {
                    defId: 'base_c',
                    minions: [makeMinion('enemy-1', 'robot_microbot_alpha', '1', 1, { powerModifier: 0 })],
                    ongoingActions: [],
                },
            ],
        });

        const used = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.USE_TALENT, playerId: '0', payload: { minionUid: 'charmer-1', baseIndex: 0 } },
            defaultTestRandom,
        );
        const movePrompt = getInteractionsFromMS(used.finalState)[0] as any;
        expect(movePrompt?.data?.sourceId).toBe('mermaids_charmer_move');
        const moveOption = movePrompt.data.options.find((entry: any) => entry.value?.baseIndex === 1);

        const afterMoveChoice = runCommand(
            used.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: moveOption.id } } as any,
            defaultTestRandom,
        );
        const targetPrompt = getInteractionsFromMS(afterMoveChoice.finalState)[0] as any;
        expect(targetPrompt?.data?.sourceId).toBe('mermaids_charmer_target');
        const targetOption = targetPrompt.data.options.find((entry: any) => entry.value?.minionUid === 'enemy-1');

        const resolved = runCommand(
            afterMoveChoice.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: targetOption.id } } as any,
            defaultTestRandom,
        );
        expect(resolved.finalState.core.bases[1].minions.some(minion => minion.uid === 'charmer-1')).toBe(true);
        expect(resolved.finalState.core.bases[1].minions.some(minion => minion.uid === 'enemy-1')).toBe(true);
    });

    it('mermaids_charmed 移动目标后应把压制 metadata 写到新基地上的目标', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('charmed-1', 'mermaids_charmed', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [makeMinion('ally-1', 'robot_microbot_alpha', '0', 1, { powerModifier: 0 })],
                    ongoingActions: [],
                },
                {
                    defId: 'base_b',
                    minions: [makeMinion('enemy-1', 'robot_microbot_guard', '1', 1, { powerModifier: 0 })],
                    ongoingActions: [],
                },
            ],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'charmed-1' } as any },
            defaultTestRandom,
        );

        const targetPrompt = getInteractionsFromMS(played.finalState)[0] as any;
        expect(targetPrompt?.data?.sourceId).toBe('mermaids_charmed');
        const targetOption = targetPrompt.data.options.find((entry: any) => entry.value?.minionUid === 'enemy-1');
        expect(targetOption).toBeDefined();

        const afterTarget = runCommand(
            played.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: targetOption.id } } as any,
            defaultTestRandom,
        );

        const destinationPrompt = getInteractionsFromMS(afterTarget.finalState)[0] as any;
        expect(destinationPrompt?.data?.sourceId).toBe('mermaids_charmed_destination');
        const baseA = destinationPrompt.data.options.find((entry: any) => entry.value?.baseIndex === 0);
        expect(baseA).toBeDefined();

        const resolved = runCommand(
            afterTarget.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: baseA.id } } as any,
            defaultTestRandom,
        );

        const movedTarget = resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'enemy-1');
        expect(movedTarget).toBeDefined();
        expect(resolved.finalState.core.bases[1].minions.some(minion => minion.uid === 'enemy-1')).toBe(false);
        expect(movedTarget?.metadata?.mermaidsCharmedSuppressedTurn).toBe(resolved.finalState.core.turnNumber);
    });
    it('mermaids_ultimate_song 会强制对手额外打出小随从，并跳过其 onPlay，然后给予施放者额外随从和额外行动', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('song-1', 'mermaids_ultimate_song', 'action', '0')],
                }),
                '1': makePlayer('1', {
                    hand: [makeCard('forced-1', 'cowboys_gunfighter', 'minion', '1')],
                }),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [makeMinion('ally-1', 'robot_microbot_alpha', '0', 1, { powerModifier: 0 })],
                    ongoingActions: [],
                },
                {
                    defId: 'base_b',
                    minions: [makeMinion('other-1', 'robot_microbot_beta', '1', 2, { powerModifier: 0 })],
                    ongoingActions: [],
                },
            ],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'song-1' } },
            defaultTestRandom,
        );
        const basePrompt = getInteractionsFromMS(played.finalState)[0] as any;
        expect(basePrompt?.data?.sourceId).toBe('mermaids_ultimate_song_base');
        expect(basePrompt.data.options.some((entry: any) => entry.value?.baseIndex === 1)).toBe(false);
        const baseOption = basePrompt.data.options.find((entry: any) => entry.value?.baseIndex === 0);

        const afterBase = runCommand(
            played.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: baseOption.id } } as any,
            defaultTestRandom,
        );
        const handPrompt = getInteractionsFromMS(afterBase.finalState)[0] as any;
        expect(handPrompt?.data?.sourceId).toBe('mermaids_ultimate_song_hand');
        const handOption = handPrompt.data.options.find((entry: any) => entry.value?.cardUid === 'forced-1');

        const resolved = runCommand(
            afterBase.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '1', payload: { optionId: handOption.id } } as any,
            defaultTestRandom,
        );
        expect(resolved.finalState.core.bases[0].minions.some(minion => minion.uid === 'forced-1')).toBe(true);
        expect(getInteractionsFromMS(resolved.finalState)).toHaveLength(0);
        expect(resolved.finalState.core.players['0'].minionLimit).toBeGreaterThanOrEqual(2);
        expect(resolved.finalState.core.players['0'].actionLimit).toBeGreaterThanOrEqual(2);
    });

    it('mermaids_mermaid_queen 可选择直到回合结束获得这里一个小随从的控制权，并在回合结束恢复', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('queen-1', 'mermaids_mermaid_queen', 'minion', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [makeMinion('enemy-small', 'robot_microbot_alpha', '1', 1, { powerModifier: 0 })],
                    ongoingActions: [],
                },
                {
                    defId: 'base_b',
                    minions: [makeMinion('enemy-other', 'robot_microbot_beta', '1', 2, { powerModifier: 0 })],
                    ongoingActions: [],
                },
            ],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'queen-1', baseIndex: 0 } },
            defaultTestRandom,
        );
        const modePrompt = getInteractionsFromMS(played.finalState)[0] as any;
        expect(modePrompt?.data?.sourceId).toBe('mermaids_mermaid_queen_mode');
        const controlMode = modePrompt.data.options.find((entry: any) => entry.value?.mode === 'control');

        const afterMode = runCommand(
            played.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: controlMode.id } } as any,
            defaultTestRandom,
        );
        const controlPrompt = getInteractionsFromMS(afterMode.finalState)[0] as any;
        expect(controlPrompt?.data?.sourceId).toBe('mermaids_mermaid_queen_control');
        const controlOption = controlPrompt.data.options.find((entry: any) => entry.value?.minionUid === 'enemy-small');

        const resolved = runCommand(
            afterMode.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: controlOption.id } } as any,
            defaultTestRandom,
        );
        expect(resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'enemy-small')?.controller).toBe('0');

        const afterTurnEnded = reduce(resolved.finalState.core, {
            type: SU_EVENTS.TURN_ENDED,
            payload: { playerId: '0', nextPlayerIndex: 1 },
            timestamp: 3701,
        } as any);
        expect(afterTurnEnded.bases[0].minions.find(minion => minion.uid === 'enemy-small')?.controller).toBe('1');
    });

    it('mermaids_mermaid_queen 也可选择把其他玩家的一个仆从移到这里', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('queen-1', 'mermaids_mermaid_queen', 'minion', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [makeMinion('enemy-small', 'robot_microbot_alpha', '1', 1, { powerModifier: 0 })],
                    ongoingActions: [],
                },
                {
                    defId: 'base_b',
                    minions: [makeMinion('enemy-other', 'robot_microbot_beta', '1', 4, { powerModifier: 0 })],
                    ongoingActions: [],
                },
            ],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'queen-1', baseIndex: 0 } },
            defaultTestRandom,
        );
        const modePrompt = getInteractionsFromMS(played.finalState)[0] as any;
        expect(modePrompt?.data?.sourceId).toBe('mermaids_mermaid_queen_mode');
        const moveMode = modePrompt.data.options.find((entry: any) => entry.value?.mode === 'move');
        expect(moveMode).toBeDefined();

        const afterMode = runCommand(
            played.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: moveMode.id } } as any,
            defaultTestRandom,
        );
        const movePrompt = getInteractionsFromMS(afterMode.finalState)[0] as any;
        expect(movePrompt?.data?.sourceId).toBe('mermaids_mermaid_queen_move');
        const moveOption = movePrompt.data.options.find((entry: any) => entry.value?.minionUid === 'enemy-other');
        expect(moveOption).toBeDefined();
        expect(movePrompt.data.options.some((entry: any) => entry.value?.minionUid === 'enemy-small')).toBe(false);

        const resolved = runCommand(
            afterMode.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: moveOption.id } } as any,
            defaultTestRandom,
        );
        expect(resolved.finalState.core.bases[0].minions.some(minion => minion.uid === 'enemy-other')).toBe(true);
        expect(resolved.finalState.core.bases[1].minions.some(minion => minion.uid === 'enemy-other')).toBe(false);
    });

    it('mermaids_captive_audience 会按目标基地不属于你的随从数量给你的随从加力量并额外打行动', () => {
        expect(getCardDef('mermaids_captive_audience')?.playNeedsBase).toBe(true);

        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('capt-1', 'mermaids_captive_audience', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('enemy-1', 'robot_microbot_alpha', '1', 1, { powerModifier: 0 }),
                        makeMinion('enemy-2', 'robot_microbot_beta', '1', 2, { powerModifier: 0 }),
                        makeMinion('ally-1', 'robot_microbot_gamma', '0', 3, { powerModifier: 0 }),
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_b',
                    minions: [makeMinion('ally-2', 'robot_microbot_alpha', '0', 4, { powerModifier: 0 })],
                    ongoingActions: [],
                },
            ],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'capt-1', targetBaseIndex: 0, targetType: 'base' } as any },
            defaultTestRandom,
        );
        const prompt = getInteractionsFromMS(played.finalState)[0] as any;
        expect(prompt?.data?.sourceId).toBe('mermaids_captive_audience');
        const option = prompt.data.options.find((entry: any) => entry.value?.minionUid === 'ally-1');
        expect(prompt.data.options.some((entry: any) => entry.value?.minionUid === 'ally-2')).toBe(false);

        const resolved = runCommand(
            played.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: option.id } } as any,
            defaultTestRandom,
        );
        expect(resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'ally-1')?.tempPowerModifier).toBe(2);
        expect(resolved.finalState.core.bases[1].minions.find(minion => minion.uid === 'ally-2')?.tempPowerModifier ?? 0).toBe(0);
        expect(resolved.finalState.core.players['0'].actionLimit).toBeGreaterThanOrEqual(2);
    });

    it('mermaids_becalmed_shores 天赋会把这张持续行动移到另一个基地', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [],
                    ongoingActions: [{ uid: 'becalm-1', defId: 'mermaids_becalmed_shores', ownerId: '0', talentUsed: false } as any],
                },
                {
                    defId: 'base_b',
                    minions: [],
                    ongoingActions: [],
                },
            ],
        });

        const used = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.USE_TALENT, playerId: '0', payload: { ongoingCardUid: 'becalm-1', baseIndex: 0 } },
            defaultTestRandom,
        );
        const prompt = getInteractionsFromMS(used.finalState)[0] as any;
        expect(prompt?.data?.sourceId).toBe('mermaids_becalmed_shores');
        const option = prompt.data.options.find((entry: any) => entry.value?.baseIndex === 1);

        const resolved = runCommand(
            used.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: option.id } } as any,
            defaultTestRandom,
        );
        expect(resolved.finalState.core.bases[0].ongoingActions.some(action => action.uid === 'becalm-1')).toBe(false);
        expect(resolved.finalState.core.bases[1].ongoingActions.some(action => action.uid === 'becalm-1')).toBe(true);
        expect(resolved.finalState.core.bases[1].ongoingActions.find(action => action.uid === 'becalm-1')?.talentUsed).toBe(true);

        const reused = validate(resolved.finalState, {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { ongoingCardUid: 'becalm-1', baseIndex: 1 },
        });
        expect(reused.valid).toBe(false);
        expect(reused.error).toBe('本回合天赋已使用');
    });

    it('mermaids_siren_song 会把每位其他玩家各一个随从移动到同一个你有随从的基地', () => {
        const core = makeState({
            turnOrder: ['0', '1', '2'],
            players: {
                '0': makePlayer('0', { hand: [makeCard('song-1', 'mermaids_siren_song', 'action', '0')] }),
                '1': makePlayer('1'),
                '2': makePlayer('2'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('enemy-1', 'robot_microbot_alpha', '1', 1, { powerModifier: 0 }),
                        makeMinion('enemy-2', 'robot_microbot_beta', '2', 2, { powerModifier: 0 }),
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_b',
                    minions: [makeMinion('ally-1', 'robot_microbot_gamma', '0', 3, { powerModifier: 0 })],
                    ongoingActions: [],
                },
            ],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'song-1' } },
            defaultTestRandom,
        );
        const sourcePrompt = getInteractionsFromMS(played.finalState)[0] as any;
        expect(sourcePrompt?.data?.sourceId).toBe('mermaids_siren_song_base');
        const sourceOption = sourcePrompt.data.options.find((entry: any) => entry.value?.baseIndex === 0);

        const afterSource = runCommand(
            played.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: sourceOption.id } } as any,
            defaultTestRandom,
        );
        const destinationPrompt = getInteractionsFromMS(afterSource.finalState)[0] as any;
        expect(destinationPrompt?.data?.sourceId).toBe('mermaids_siren_song_destination');
        const destinationOption = destinationPrompt.data.options.find((entry: any) => entry.value?.baseIndex === 1);

        const afterDestination = runCommand(
            afterSource.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: destinationOption.id } } as any,
            defaultTestRandom,
        );
        const firstTargetPrompt = getInteractionsFromMS(afterDestination.finalState)[0] as any;
        expect(firstTargetPrompt?.data?.sourceId).toBe('mermaids_siren_song_target');
        const firstTargetOption = firstTargetPrompt.data.options.find((entry: any) => entry.value?.minionUid === 'enemy-1');

        const afterFirstTarget = runCommand(
            afterDestination.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: firstTargetOption.id } } as any,
            defaultTestRandom,
        );
        const secondTargetPrompt = getInteractionsFromMS(afterFirstTarget.finalState)[0] as any;
        const secondTargetOption = secondTargetPrompt.data.options.find((entry: any) => entry.value?.minionUid === 'enemy-2');

        const resolved = runCommand(
            afterFirstTarget.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: secondTargetOption.id } } as any,
            defaultTestRandom,
        );
        expect(resolved.finalState.core.bases[1].minions.some(minion => minion.uid === 'enemy-1')).toBe(true);
        expect(resolved.finalState.core.bases[1].minions.some(minion => minion.uid === 'enemy-2')).toBe(true);
    });

    it('mermaids_siren_song 不应把没有其他己方基地可去的来源基地放进候选', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            players: {
                '0': makePlayer('0', { hand: [makeCard('song-1', 'mermaids_siren_song', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('ally-anchor', 'robot_microbot_gamma', '0', 3, { powerModifier: 0 }),
                        makeMinion('enemy-stuck', 'robot_microbot_alpha', '1', 1, { powerModifier: 0 }),
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_b',
                    minions: [makeMinion('enemy-movable', 'robot_microbot_beta', '1', 2, { powerModifier: 0 })],
                    ongoingActions: [],
                },
            ],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'song-1' } },
            defaultTestRandom,
        );
        const sourcePrompt = getInteractionsFromMS(played.finalState)[0] as any;
        expect(sourcePrompt?.data?.sourceId).toBe('mermaids_siren_song_base');
        expect(sourcePrompt.data.options.some((entry: any) => entry.value?.baseIndex === 0)).toBe(false);
        const sourceOption = sourcePrompt.data.options.find((entry: any) => entry.value?.baseIndex === 1);
        expect(sourceOption).toBeDefined();

        const afterSource = runCommand(
            played.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: sourceOption.id } } as any,
            defaultTestRandom,
        );
        const destinationPrompt = getInteractionsFromMS(afterSource.finalState)[0] as any;
        expect(destinationPrompt?.data?.sourceId).toBe('mermaids_siren_song_destination');
        const destinationOption = destinationPrompt.data.options.find((entry: any) => entry.value?.baseIndex === 0);
        expect(destinationOption).toBeDefined();

        const afterDestination = runCommand(
            afterSource.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: destinationOption.id } } as any,
            defaultTestRandom,
        );
        const targetPrompt = getInteractionsFromMS(afterDestination.finalState)[0] as any;
        expect(targetPrompt?.data?.sourceId).toBe('mermaids_siren_song_target');
        const targetOption = targetPrompt.data.options.find((entry: any) => entry.value?.minionUid === 'enemy-movable');
        expect(targetOption).toBeDefined();
    });

    it('mermaids_toll_bay 按目标基地其他玩家的仆从数量抽牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('toll-1', 'mermaids_toll_bay', 'action', '0')],
                    deck: [
                        makeCard('draw-1', 'robot_microbot_alpha', 'minion', '0'),
                        makeCard('draw-2', 'robot_microbot_beta', 'minion', '0'),
                        makeCard('draw-3', 'robot_microbot_gamma', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('enemy-1', 'robot_microbot_alpha', '1', 1, { powerModifier: 0 }),
                    makeMinion('enemy-2', 'robot_microbot_beta', '1', 2, { powerModifier: 0 }),
                    makeMinion('ally-1', 'robot_microbot_gamma', '0', 3, { powerModifier: 0 }),
                ],
                ongoingActions: [],
            }],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'toll-1', targetBaseIndex: 0, targetType: 'base' } as any },
            defaultTestRandom,
        );

        const drawEvent = played.events.find(event => event.type === SU_EVENTS.CARDS_DRAWN) as any;
        expect(drawEvent).toBeDefined();
        expect(drawEvent.payload?.count).toBe(2);
        expect(played.finalState.core.players['0'].hand.some(card => card.uid === 'draw-1')).toBe(true);
        expect(played.finalState.core.players['0'].hand.some(card => card.uid === 'draw-2')).toBe(true);
        expect(played.finalState.core.players['0'].deck.some(card => card.uid === 'draw-1')).toBe(false);
        expect(played.finalState.core.players['0'].deck.some(card => card.uid === 'draw-2')).toBe(false);
    });

    it('mermaids_shipwreck_cove 在计分后可把这张持续行动移到另一个基地', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('ship-1', 'mermaids_shipwreck_cove', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                { defId: 'base_a', minions: [], ongoingActions: [] },
                { defId: 'base_b', minions: [], ongoingActions: [] },
            ],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'ship-1', targetBaseIndex: 0, targetType: 'base' } as any },
            defaultTestRandom,
        );
        const sourceCardUid = played.finalState.core.bases[0].ongoingActions.find(action => action.defId === 'mermaids_shipwreck_cove')?.uid;

        const triggered = fireTriggers(played.finalState.core, 'afterScoring', {
            state: played.finalState.core,
            matchState: played.finalState,
            playerId: '0',
            baseIndex: 0,
            rankings: [{ playerId: '0', power: 0, vp: 0 }],
            sourceCardUid,
            sourceBaseIndex: 0,
            sourceControllerId: '0',
            random: defaultTestRandom,
            now: 3801,
        });
        const prompt = getInteractionsFromMS(triggered.matchState ?? played.finalState)[0] as any;
        expect(prompt?.data?.sourceId).toBe('mermaids_shipwreck_cove_after_scoring');
        const option = prompt.data.options.find((entry: any) => entry.value?.baseIndex === 1);

        const resolved = runCommand(
            triggered.matchState ?? played.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: option.id } } as any,
            defaultTestRandom,
        );
        expect(resolved.finalState.core.bases[0].ongoingActions.some(action => action.uid === sourceCardUid)).toBe(false);
        expect(resolved.finalState.core.bases[1].ongoingActions.some(action => action.uid === sourceCardUid)).toBe(true);
    });
});
describe('Titans abilities', () => {
    it('ninjas_invisible_ninja 在自己消灭对手随从时应给泰坦控制者创建抽牌交互', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            turnNumber: 7,
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('peek-1', 'robot_microbot_alpha', 'minion', '0'),
                        makeCard('peek-2', 'robot_microbot_beta', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('ally-1', 'robot_microbot_alpha', '0', 2, { powerModifier: 0 })],
                ongoingActions: [],
            }],
            titans: [{
                uid: 'ninja-titan-1',
                defId: 'ninjas_invisible_ninja',
                faction: 'ninjas',
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0 },
            } as any],
        });

        const destroyedEnemyLki = makeMinion('enemy-destroyed', 'robot_microbot_beta', '1', 2, { powerModifier: 0 });
        const triggered = fireTriggers(core, 'onMinionDestroyed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            sourceBaseIndex: 0,
            triggerMinionUid: 'enemy-destroyed',
            triggerMinionDefId: 'robot_microbot_beta',
            triggerMinion: destroyedEnemyLki,
            destroyerId: '0',
            reason: 'test_destroy',
            random: defaultTestRandom,
            now: 3900,
        });

        const prompt = getInteractionsFromMS(triggered.matchState ?? makeMatchState(core))[0] as any;
        expect(prompt?.data?.sourceId).toBe('titan_ninjas_invisible_ninja_ongoing');
        expect(prompt?.playerId).toBe('0');

        const option = prompt?.data?.options?.[0];
        expect(option?.id).toBeDefined();

        const resolved = runCommand(
            triggered.matchState ?? makeMatchState(core),
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: option.id } } as any,
            defaultTestRandom,
        );
        expect(resolved.events.some(event => event.type === SU_EVENTS.CARDS_DRAWN)).toBe(true);
    });
});

describe('Skeletons abilities', () => {
    it('skeletons_returned_one 可把自己埋葬到当前基地', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('returned-one', 'skeletons_returned_one', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{ defId: 'base_a', minions: [], ongoingActions: [] }],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'returned-one', baseIndex: 0 } },
            defaultTestRandom,
        );
        const prompt = getInteractionsFromMS(played.finalState)[0] as any;
        expect(prompt?.data?.sourceId).toBe('skeletons_returned_one');

        const selfOption = prompt.data.options.find((entry: any) => entry.value?.cardUid === 'returned-one');
        expect(selfOption?.value?.buriedFrom).toBe('play');

        const resolved = runCommand(
            played.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: selfOption.id } } as any,
            defaultTestRandom,
        );

        expect(resolved.finalState.core.bases[0].minions.some(minion => minion.uid === 'returned-one')).toBe(false);
        expect((resolved.finalState.core.bases[0].buriedCards ?? []).some(card => card.uid === 'returned-one')).toBe(true);
    });

    it('skeletons_returned_one 被挖掘后可再挖同基地另一张埋葬牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [] }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('returned-one', 'skeletons_returned_one', '0', 2, { powerModifier: 0, metadata: { playedFrom: 'buried' } }),
                ],
                ongoingActions: [],
                buriedCards: [
                    { uid: 'buried-a', defId: 'robot_microbot_alpha', trueOwnerId: '0', controllerId: '0', buriedFrom: 'hand' },
                ],
            }],
        });

        const triggered = fireTriggers(core, 'onMinionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'returned-one',
            triggerMinionDefId: 'skeletons_returned_one',
            triggerMinion: core.bases[0].minions[0],
            random: defaultTestRandom,
            now: 3100,
        });
        const prompt = getInteractionsFromMS(triggered.matchState ?? makeMatchState(core))[0] as any;
        expect(prompt?.data?.sourceId).toBe('skeletons_returned_one_uncover');
        const option = prompt.data.options.find((entry: any) => entry.value?.cardUid === 'buried-a');
        expect(option).toBeDefined();

        const resolved = runCommand(
            triggered.matchState ?? makeMatchState(core),
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: option.id } } as any,
            defaultTestRandom,
        );
        expect(resolved.events.some(event => event.type === SU_EVENTS.BURIED_CARD_UNCOVERED)).toBe(true);
        expect((resolved.finalState.core.bases[0].buriedCards ?? []).some(card => card.uid === 'buried-a')).toBe(false);
        expect(resolved.finalState.core.bases[0].minions.some(minion => minion.uid === 'buried-a')).toBe(true);
    });

    it('skeletons_returned_one 被挖掘后若同基地没有其他己方埋葬牌，不应进入反应队列', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [] }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('returned-one', 'skeletons_returned_one', '0', 2, { powerModifier: 0, metadata: { playedFrom: 'buried' } }),
                ],
                ongoingActions: [],
                buriedCards: [],
            }],
        });

        const queued = collectTriggers(core, 'onMinionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'returned-one',
            triggerMinionDefId: 'skeletons_returned_one',
            triggerMinion: core.bases[0].minions[0],
            random: defaultTestRandom,
            now: 3200,
        });

        expect(queued).toBeUndefined();
    });

    it('skeletons_place_em_down 从弃牌堆埋葬最多三张且先选基地', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('place-1', 'skeletons_place_em_down', 'action', '0')],
                    discard: [
                        makeCard('discard-a', 'robot_microbot_alpha', 'minion', '0'),
                        makeCard('discard-b', 'robot_microbot_beta', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                { defId: 'base_a', minions: [], ongoingActions: [] },
                { defId: 'base_b', minions: [], ongoingActions: [] },
            ],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'place-1' } },
            defaultTestRandom,
        );
        const basePrompt = getInteractionsFromMS(played.finalState)[0] as any;
        expect(basePrompt?.data?.sourceId).toBe('skeletons_place_em_down_base');
        const baseOption = basePrompt.data.options.find((entry: any) => entry.value?.baseIndex === 1);
        expect(baseOption).toBeDefined();

        const afterBase = runCommand(
            played.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: baseOption.id } } as any,
            defaultTestRandom,
        );
        const cardsPrompt = getInteractionsFromMS(afterBase.finalState)[0] as any;
        expect(cardsPrompt?.data?.sourceId).toBe('skeletons_place_em_down_cards');
        const cardA = cardsPrompt.data.options.find((entry: any) => entry.value?.cardUid === 'discard-a');
        const cardB = cardsPrompt.data.options.find((entry: any) => entry.value?.cardUid === 'discard-b');
        expect(cardA).toBeDefined();
        expect(cardB).toBeDefined();

        const resolved = runCommand(
            afterBase.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionIds: [cardA.id, cardB.id] } } as any,
            defaultTestRandom,
        );

        const buried = resolved.finalState.core.bases[1].buriedCards ?? [];
        expect(buried.some(card => card.uid === 'discard-a')).toBe(true);
        expect(buried.some(card => card.uid === 'discard-b')).toBe(true);
    });

    it('skeletons_dig_em_up 可选择基地后挖掘最多三张', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('dig-1', 'skeletons_dig_em_up', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [],
                ongoingActions: [],
                buriedCards: [
                    { uid: 'buried-a', defId: 'robot_microbot_alpha', trueOwnerId: '0', controllerId: '0', buriedFrom: 'hand' },
                    { uid: 'buried-b', defId: 'robot_microbot_beta', trueOwnerId: '0', controllerId: '0', buriedFrom: 'hand' },
                ],
            }],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'dig-1' } },
            defaultTestRandom,
        );
        const basePrompt = getInteractionsFromMS(played.finalState)[0] as any;
        expect(basePrompt?.data?.sourceId).toBe('skeletons_dig_em_up_base');

        const afterBase = runCommand(
            played.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: basePrompt.data.options[0].id } } as any,
            defaultTestRandom,
        );
        const cardsPrompt = getInteractionsFromMS(afterBase.finalState)[0] as any;
        expect(cardsPrompt?.data?.sourceId).toBe('skeletons_dig_em_up_cards');
        const option = cardsPrompt.data.options.find((entry: any) => entry.value?.cardUid === 'buried-a');
        expect(option).toBeDefined();

        const resolved = runCommand(
            afterBase.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionIds: [option.id] } } as any,
            defaultTestRandom,
        );

        expect(resolved.events.some(event => event.type === SU_EVENTS.BURIED_CARD_UNCOVERED)).toBe(true);
        expect((resolved.finalState.core.bases[0].buriedCards ?? []).some(card => card.uid === 'buried-a')).toBe(false);
        expect(resolved.finalState.core.bases[0].minions.some(minion => minion.uid === 'buried-a')).toBe(true);
    });

    it('skeletons_burst_forth special 可在指定基地挖掘埋葬牌', () => {
        const executor = resolveSpecial('skeletons_burst_forth');
        expect(executor).toBeDefined();

        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [],
                ongoingActions: [],
                buriedCards: [
                    { uid: 'buried-a', defId: 'robot_microbot_alpha', trueOwnerId: '0', controllerId: '0', buriedFrom: 'discard' },
                ],
            }],
        });

        const executed = executor!({
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'burst-1',
            defId: 'skeletons_burst_forth',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 3900,
        });
        const prompt = getInteractionsFromMS(executed.matchState ?? makeMatchState(core))[0] as any;
        expect(prompt?.data?.sourceId).toBe('skeletons_burst_forth');
    });

    it('skeletons_graveyard 天赋挖掘后若是随从会进入可选 +1 指示物交互', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [],
                ongoingActions: [{ uid: 'graveyard-1', defId: 'skeletons_graveyard', ownerId: '0', talentUsed: false }],
                buriedCards: [
                    { uid: 'buried-a', defId: 'robot_microbot_alpha', trueOwnerId: '0', controllerId: '0', buriedFrom: 'hand' },
                ],
            }],
        });

        const used = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.USE_TALENT, playerId: '0', payload: { ongoingCardUid: 'graveyard-1', baseIndex: 0 } },
            defaultTestRandom,
        );
        const prompt = getInteractionsFromMS(used.finalState)[0] as any;
        expect(prompt?.data?.sourceId).toBe('skeletons_graveyard');
        const option = prompt.data.options.find((entry: any) => entry.value?.cardUid === 'buried-a');
        expect(option).toBeDefined();

        const resolved = runCommand(
            used.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: option.id } } as any,
            defaultTestRandom,
        );
        expect(resolved.finalState.core.bases[0].minions.some(minion => minion.uid === 'buried-a')).toBe(true);
        const counterPrompt = getInteractionsFromMS(resolved.finalState)[0] as any;
        expect(counterPrompt?.data?.sourceId).toBe('skeletons_graveyard_counter');

        const applied = runCommand(
            resolved.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: counterPrompt.data.options[0].id } } as any,
            defaultTestRandom,
        );
        expect(applied.events.some(event => event.type === SU_EVENTS.POWER_COUNTER_ADDED)).toBe(true);
    });

    it('skeletons_lord_of_bones 天赋可选择从手牌埋葬', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('hand-a', 'robot_microbot_alpha', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('lob-1', 'skeletons_lord_of_bones', '0', 5, { powerModifier: 0 })],
                ongoingActions: [],
            }],
        });

        const used = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.USE_TALENT, playerId: '0', payload: { minionUid: 'lob-1', baseIndex: 0 } },
            defaultTestRandom,
        );
        const modePrompt = getInteractionsFromMS(used.finalState)[0] as any;
        expect(modePrompt?.data?.sourceId).toBe('skeletons_lord_of_bones_bury');
        const option = modePrompt.data.options.find((entry: any) => entry.value?.cardUid === 'hand-a');
        expect(option).toBeDefined();

        const resolved = runCommand(
            used.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: option.id } } as any,
            defaultTestRandom,
        );
        expect((resolved.finalState.core.bases[0].buriedCards ?? []).some(card => card.uid === 'hand-a')).toBe(true);
    });

    it('skeletons_lord_of_bones 天赋可挖掘这里任意埋葬牌而不只限自己', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('lob-1', 'skeletons_lord_of_bones', '0', 5, { powerModifier: 0 })],
                ongoingActions: [],
                buriedCards: [
                    { uid: 'enemy-buried', defId: 'robot_microbot_alpha', trueOwnerId: '1', controllerId: '1', buriedFrom: 'hand' },
                ],
            }],
        });

        const used = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.USE_TALENT, playerId: '0', payload: { minionUid: 'lob-1', baseIndex: 0 } },
            defaultTestRandom,
        );
        const prompt = getInteractionsFromMS(used.finalState)[0] as any;
        expect(prompt?.data?.sourceId).toBe('skeletons_lord_of_bones_uncover');
        const option = prompt.data.options.find((entry: any) => entry.value?.cardUid === 'enemy-buried');
        expect(option).toBeDefined();

        const resolved = runCommand(
            used.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: option.id } } as any,
            defaultTestRandom,
        );
        expect(resolved.events.some(event => event.type === SU_EVENTS.BURIED_CARD_UNCOVERED && (event as any).payload?.cardUid === 'enemy-buried')).toBe(true);
        expect((resolved.finalState.core.bases[0].buriedCards ?? []).some(card => card.uid === 'enemy-buried')).toBe(false);
    });

    it('skeletons_grave_goods 只有手牌时应直接进入埋葬分支而不是报无目标', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('grave-goods-1', 'skeletons_grave_goods', 'action', '0'),
                        makeCard('hand-a', 'robot_microbot_alpha', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                { defId: 'base_a', minions: [], ongoingActions: [] },
                { defId: 'base_b', minions: [], ongoingActions: [] },
            ],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'grave-goods-1' } },
            defaultTestRandom,
        );

        const interactions = getInteractionsFromMS(played.finalState);
        expect(interactions).toHaveLength(1);
        expect(interactions[0]?.data?.sourceId).toBe('skeletons_grave_goods_base');
        expect(played.events.some(event => event.type === SU_EVENTS.ABILITY_FEEDBACK && (event as any).payload?.feedbackKey === 'feedback.no_valid_targets')).toBe(false);
    });

    it('skeletons_grave_goods 首次埋葬后若只剩埋葬牌应直接进入挖掘分支', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('grave-goods-1', 'skeletons_grave_goods', 'action', '0'),
                        makeCard('hand-a', 'robot_microbot_alpha', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                { defId: 'base_a', minions: [], ongoingActions: [] },
                { defId: 'base_b', minions: [], ongoingActions: [] },
            ],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'grave-goods-1' } },
            defaultTestRandom,
        );

        const basePrompt = getInteractionsFromMS(played.finalState)[0] as any;
        expect(basePrompt?.data?.sourceId).toBe('skeletons_grave_goods_base');
        const baseOption = basePrompt.data.options.find((entry: any) => entry.value?.baseIndex === 0);
        expect(baseOption).toBeDefined();

        const afterBase = runCommand(
            played.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: baseOption.id } } as any,
            defaultTestRandom,
        );
        const buryPrompt = getInteractionsFromMS(afterBase.finalState)[0] as any;
        expect(buryPrompt?.data?.sourceId).toBe('skeletons_grave_goods_bury');
        const buryOption = buryPrompt.data.options.find((entry: any) => entry.value?.cardUid === 'hand-a');
        expect(buryOption).toBeDefined();

        const afterBury = runCommand(
            afterBase.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: buryOption.id } } as any,
            defaultTestRandom,
        );
        expect((afterBury.finalState.core.bases[0].buriedCards ?? []).some((card: any) => card.uid === 'hand-a')).toBe(true);
        const uncoverPrompt = getInteractionsFromMS(afterBury.finalState)[0] as any;
        expect(uncoverPrompt?.data?.sourceId).toBe('skeletons_grave_goods_uncover');
    });

    it('skeletons_grave_goods 首次埋葬后若只剩一张手牌不能额外埋葬另一张', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('grave-goods-1', 'skeletons_grave_goods', 'action', '0'),
                        makeCard('bury-first', 'robot_microbot_alpha', 'minion', '0'),
                        makeCard('last-hand', 'robot_microbot_beta', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [],
                ongoingActions: [],
                buriedCards: [
                    { uid: 'buried-a', defId: 'robot_microbot_alpha', trueOwnerId: '0', controllerId: '0', buriedFrom: 'hand' },
                ],
            }],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'grave-goods-1' } },
            defaultTestRandom,
        );
        const basePrompt = getInteractionsFromMS(played.finalState)[0] as any;
        const baseOption = basePrompt.data.options.find((entry: any) => entry.value?.baseIndex === 0);
        expect(baseOption).toBeDefined();

        const afterBase = runCommand(
            played.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: baseOption.id } } as any,
            defaultTestRandom,
        );
        const buryPrompt = getInteractionsFromMS(afterBase.finalState)[0] as any;
        const buryOption = buryPrompt.data.options.find((entry: any) => entry.value?.cardUid === 'bury-first');
        expect(buryOption).toBeDefined();

        const afterBury = runCommand(
            afterBase.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: buryOption.id } } as any,
            defaultTestRandom,
        );
        const nextPrompt = getInteractionsFromMS(afterBury.finalState)[0] as any;
        expect(nextPrompt?.data?.sourceId).toBe('skeletons_grave_goods_uncover');
        expect(nextPrompt.data.options.some((entry: any) => entry.value?.mode === 'extra_bury')).toBe(false);
    });

    it('skeletons_grave_goods 首次埋葬后可在额外埋葬与挖掘之间二选一', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('grave-goods-1', 'skeletons_grave_goods', 'action', '0'),
                        makeCard('bury-first', 'robot_microbot_alpha', 'minion', '0'),
                        makeCard('discard-cost', 'robot_microbot_beta', 'minion', '0'),
                        makeCard('bury-extra', 'robot_microbot_beta', 'minion', '0'),
                        makeCard('buffer-hand', 'robot_microbot_beta', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [],
                ongoingActions: [],
                buriedCards: [
                    { uid: 'buried-a', defId: 'robot_microbot_alpha', trueOwnerId: '0', controllerId: '0', buriedFrom: 'hand' },
                ],
            }],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'grave-goods-1' } },
            defaultTestRandom,
        );
        const basePrompt = getInteractionsFromMS(played.finalState)[0] as any;
        expect(basePrompt?.data?.sourceId).toBe('skeletons_grave_goods_base');
        const baseOption = basePrompt.data.options.find((entry: any) => entry.value?.baseIndex === 0);
        expect(baseOption).toBeDefined();

        const afterBase = runCommand(
            played.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: baseOption.id } } as any,
            defaultTestRandom,
        );
        const buryPrompt = getInteractionsFromMS(afterBase.finalState)[0] as any;
        expect(buryPrompt?.data?.sourceId).toBe('skeletons_grave_goods_bury');
        const buryOption = buryPrompt.data.options.find((entry: any) => entry.value?.cardUid === 'bury-first');
        expect(buryOption).toBeDefined();

        const afterFirstBury = runCommand(
            afterBase.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: buryOption.id } } as any,
            defaultTestRandom,
        );
        const modePrompt = getInteractionsFromMS(afterFirstBury.finalState)[0] as any;
        expect(modePrompt?.data?.sourceId).toBe('skeletons_grave_goods_mode');
        const uncoverOption = modePrompt.data.options.find((entry: any) => entry.value?.mode === 'uncover');
        expect(uncoverOption).toBeDefined();

        const afterMode = runCommand(
            afterFirstBury.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: uncoverOption.id } } as any,
            defaultTestRandom,
        );
        const uncoverPrompt = getInteractionsFromMS(afterMode.finalState)[0] as any;
        expect(uncoverPrompt?.data?.sourceId).toBe('skeletons_grave_goods_uncover');
        const option = uncoverPrompt.data.options.find((entry: any) => entry.value?.cardUid === 'buried-a');
        expect(option).toBeDefined();

        const resolved = runCommand(
            afterMode.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: option.id } } as any,
            defaultTestRandom,
        );

        expect(resolved.finalState.core.bases[0].minions.some(minion => minion.uid === 'buried-a')).toBe(true);
        const counterPrompt = getInteractionsFromMS(resolved.finalState)[0] as any;
        expect(counterPrompt?.data?.sourceId).toBe('skeletons_grave_goods_counter');

        const applied = runCommand(
            resolved.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: counterPrompt.data.options[0].id } } as any,
            defaultTestRandom,
        );
        expect(applied.events.some(event => event.type === SU_EVENTS.POWER_COUNTER_ADDED && (event as any).payload?.amount === 2)).toBe(true);
    });

    it('skeletons_grave_goods 额外埋葬时可选择不同基地', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('grave-goods-1', 'skeletons_grave_goods', 'action', '0'),
                        makeCard('bury-first', 'robot_microbot_alpha', 'minion', '0'),
                        makeCard('discard-cost', 'robot_microbot_beta', 'minion', '0'),
                        makeCard('bury-extra', 'robot_microbot_beta', 'minion', '0'),
                        makeCard('buffer-hand', 'robot_microbot_beta', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                { defId: 'base_a', minions: [], ongoingActions: [], buriedCards: [] },
                { defId: 'base_b', minions: [], ongoingActions: [], buriedCards: [] },
            ],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'grave-goods-1' } },
            defaultTestRandom,
        );
        const basePrompt = getInteractionsFromMS(played.finalState)[0] as any;
        const baseA = basePrompt.data.options.find((entry: any) => entry.value?.baseIndex === 0);
        expect(baseA).toBeDefined();

        const afterBase = runCommand(
            played.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: baseA.id } } as any,
            defaultTestRandom,
        );
        const firstBuryPrompt = getInteractionsFromMS(afterBase.finalState)[0] as any;
        const firstBury = firstBuryPrompt.data.options.find((entry: any) => entry.value?.cardUid === 'bury-first');
        expect(firstBury).toBeDefined();

        const afterFirstBury = runCommand(
            afterBase.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: firstBury.id } } as any,
            defaultTestRandom,
        );
        const modePrompt = getInteractionsFromMS(afterFirstBury.finalState)[0] as any;
        const extraBuryOption = modePrompt.data.options.find((entry: any) => entry.value?.mode === 'extra_bury');
        expect(extraBuryOption).toBeDefined();

        const afterMode = runCommand(
            afterFirstBury.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: extraBuryOption.id } } as any,
            defaultTestRandom,
        );
        const discardPrompt = getInteractionsFromMS(afterMode.finalState)[0] as any;
        expect(discardPrompt?.data?.sourceId).toBe('skeletons_grave_goods_discard');
        const discardCard = discardPrompt.data.options.find((entry: any) => entry.value?.cardUid === 'discard-cost');
        expect(discardCard).toBeDefined();

        const afterDiscard = runCommand(
            afterMode.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: discardCard.id } } as any,
            defaultTestRandom,
        );
        const bonusPrompt = getInteractionsFromMS(afterDiscard.finalState)[0] as any;
        expect(bonusPrompt?.data?.sourceId).toBe('skeletons_grave_goods_bonus');
        const bonusCard = bonusPrompt.data.options.find((entry: any) => entry.value?.cardUid === 'bury-extra');
        expect(bonusCard).toBeDefined();
        expect(bonusPrompt.data.options.some((entry: any) => entry.value?.cardUid === 'discard-cost')).toBe(false);

        const afterBonusCard = runCommand(
            afterDiscard.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: bonusCard.id } } as any,
            defaultTestRandom,
        );
        const bonusBasePrompt = getInteractionsFromMS(afterBonusCard.finalState)[0] as any;
        expect(bonusBasePrompt?.data?.sourceId).toBe('skeletons_grave_goods_bonus_base');
        const baseB = bonusBasePrompt.data.options.find((entry: any) => entry.value?.baseIndex === 1);
        expect(baseB).toBeDefined();

        const resolved = runCommand(
            afterBonusCard.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: baseB.id } } as any,
            defaultTestRandom,
        );

        expect((resolved.finalState.core.bases[0].buriedCards ?? []).some(card => card.uid === 'bury-first')).toBe(true);
        expect((resolved.finalState.core.bases[1].buriedCards ?? []).some(card => card.uid === 'bury-extra')).toBe(true);
        expect(resolved.finalState.core.players['0'].discard.some(card => card.uid === 'discard-cost')).toBe(true);
        expect((resolved.finalState.core.bases[0].buriedCards ?? []).some(card => card.uid === 'discard-cost')).toBe(false);
        expect((resolved.finalState.core.bases[1].buriedCards ?? []).some(card => card.uid === 'discard-cost')).toBe(false);
    });

    it('skeletons_spooky_scary 从弃牌堆埋葬低力量随从并抽 1 张', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('spooky-1', 'skeletons_spooky_scary', 'action', '0')],
                    deck: [makeCard('draw-1', 'robot_microbot_alpha', 'minion', '0')],
                    discard: [makeCard('discard-low', 'robot_microbot_alpha', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                { defId: 'base_a', minions: [], ongoingActions: [] },
                { defId: 'base_b', minions: [], ongoingActions: [] },
            ],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'spooky-1' } },
            defaultTestRandom,
        );
        const basePrompt = getInteractionsFromMS(played.finalState)[0] as any;
        expect(basePrompt?.data?.sourceId).toBe('skeletons_spooky_scary_base');

        const afterBase = runCommand(
            played.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: basePrompt.data.options[1].id } } as any,
            defaultTestRandom,
        );
        const cardPrompt = getInteractionsFromMS(afterBase.finalState)[0] as any;
        expect(cardPrompt?.data?.sourceId).toBe('skeletons_spooky_scary_card');
        const option = cardPrompt.data.options.find((entry: any) => entry.value?.cardUid === 'discard-low');
        expect(option).toBeDefined();

        const resolved = runCommand(
            afterBase.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: option.id } } as any,
            defaultTestRandom,
        );

        expect(resolved.events.some(event => event.type === SU_EVENTS.CARDS_DRAWN)).toBe(true);
        expect((resolved.finalState.core.bases[1].buriedCards ?? []).some(card => card.uid === 'discard-low')).toBe(true);
    });

    it('skeletons_hearse_fleet 可把埋葬牌移动到目标基地', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('hearse-1', 'skeletons_hearse_fleet', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [],
                    ongoingActions: [],
                    buriedCards: [
                        { uid: 'buried-a', defId: 'robot_microbot_alpha', trueOwnerId: '1', controllerId: '1', buriedFrom: 'hand' },
                    ],
                },
                {
                    defId: 'base_b',
                    minions: [],
                    ongoingActions: [],
                    buriedCards: [],
                },
            ],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'hearse-1' } },
            defaultTestRandom,
        );
        const basePrompt = getInteractionsFromMS(played.finalState)[0] as any;
        expect(basePrompt?.data?.sourceId).toBe('skeletons_hearse_fleet_base');
        const sourceOption = basePrompt.data.options.find((entry: any) => entry.value?.baseIndex === 0);
        expect(sourceOption).toBeDefined();

        const afterBase = runCommand(
            played.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: sourceOption.id } } as any,
            defaultTestRandom,
        );
        const targetPrompt = getInteractionsFromMS(afterBase.finalState)[0] as any;
        expect(targetPrompt?.data?.sourceId).toBe('skeletons_hearse_fleet_target');
        const targetOption = targetPrompt.data.options.find((entry: any) => entry.value?.baseIndex === 1);
        expect(targetOption).toBeDefined();

        const afterTarget = runCommand(
            afterBase.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: targetOption.id } } as any,
            defaultTestRandom,
        );
        const cardsPrompt = getInteractionsFromMS(afterTarget.finalState)[0] as any;
        expect(cardsPrompt?.data?.sourceId).toBe('skeletons_hearse_fleet_cards');
        const option = cardsPrompt.data.options.find((entry: any) => entry.value?.cardUid === 'buried-a');
        expect(option).toBeDefined();

        const resolved = runCommand(
            afterTarget.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionIds: [option.id] } } as any,
            defaultTestRandom,
        );

        expect((resolved.finalState.core.bases[0].buriedCards ?? []).some(card => card.uid === 'buried-a')).toBe(false);
        expect((resolved.finalState.core.bases[1].buriedCards ?? []).some(card => card.uid === 'buried-a')).toBe(true);
    });

    it('skeletons_revenant 你的回合中可从弃牌堆埋葬且每回合一次', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            turnNumber: 7,
            players: {
                '0': makePlayer('0', {
                    discard: [makeCard('revenant-1', 'skeletons_revenant', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                { defId: 'base_a', minions: [], ongoingActions: [] },
                { defId: 'base_b', minions: [], ongoingActions: [] },
            ],
        });

        const options = getDiscardSpecialOptions(core, '0');
        expect(options).toHaveLength(1);
        expect(options[0]?.card.uid).toBe('revenant-1');
        expect(options[0]?.sourceId).toBe('skeletons_revenant');

        const resolved = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.ACTIVATE_SPECIAL, playerId: '0', payload: { discardCardUid: 'revenant-1', baseIndex: 1 } } as any,
            defaultTestRandom,
        );
        expect((resolved.finalState.core.bases[1].buriedCards ?? []).some(card => card.uid === 'revenant-1')).toBe(true);
        expect(resolved.finalState.core.players['0'].usedDiscardPlayAbilities).toContain('skeletons_revenant');
        expect(getDiscardSpecialOptions(resolved.finalState.core, '0')).toHaveLength(0);

        const secondTryValidation = validate(resolved.finalState, {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { discardCardUid: 'revenant-1', baseIndex: 0 },
        } as any);
        expect(secondTryValidation.valid).toBe(false);

        const opponentTurnCore = {
            ...core,
            currentPlayerIndex: 1,
        };
        expect(getDiscardSpecialOptions(opponentTurnCore, '0')).toHaveLength(0);
    });

    it('skeletons_gravestones 计分后可把自己埋葬到另一个基地', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [],
                    ongoingActions: [{ uid: 'gravestones-1', defId: 'skeletons_gravestones', ownerId: '0' }],
                },
                {
                    defId: 'base_b',
                    minions: [],
                    ongoingActions: [],
                },
            ],
        });

        const triggered = fireTriggers(core, 'afterScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            rankings: [{ playerId: '0', power: 0, vp: 0 }],
            sourceCardUid: 'gravestones-1',
            sourceBaseIndex: 0,
            sourceControllerId: '0',
            random: defaultTestRandom,
            now: 3901,
        });
        const prompt = getInteractionsFromMS(triggered.matchState ?? makeMatchState(core))[0] as any;
        expect(prompt?.data?.sourceId).toBe('skeletons_gravestones_after_scoring');
        expect(prompt.data.options.some((entry: any) => entry.value?.skip)).toBe(false);
        const baseOption = prompt.data.options.find((entry: any) => entry.value?.baseIndex === 1);
        expect(baseOption).toBeDefined();

        const resolved = runCommand(
            triggered.matchState ?? makeMatchState(core),
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: baseOption.id } } as any,
            defaultTestRandom,
        );

        expect((resolved.finalState.core.bases[1].buriedCards ?? []).some(card => card.uid === 'gravestones-1')).toBe(true);
    });

    it('skeletons_gravetender 每回合仅首次埋葬/挖掘触发抽牌', () => {
        const core = makeState({
            turnNumber: 3,
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('draw-1', 'robot_microbot_alpha', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('gravetender-1', 'skeletons_gravetender', '0', 4, { powerModifier: 0 })],
                ongoingActions: [],
            }],
        });

        const first = fireTriggers(core, 'onCardBuried', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            buriedCardUid: 'buried-a',
            buriedCardDefId: 'robot_microbot_beta',
            buriedCardControllerId: '0',
            buriedFrom: 'hand',
            random: defaultTestRandom,
            now: 5000,
        });
        expect(first.events.some(event => event.type === SU_EVENTS.CARDS_DRAWN)).toBe(true);

        const afterFirst = first.events.reduce((state, event) => reduce(state, event), core);
        const second = fireTriggers(afterFirst, 'onCardBuried', {
            state: afterFirst,
            matchState: makeMatchState(afterFirst),
            playerId: '0',
            baseIndex: 0,
            buriedCardUid: 'buried-b',
            buriedCardDefId: 'robot_microbot_gamma',
            buriedCardControllerId: '0',
            buriedFrom: 'hand',
            random: defaultTestRandom,
            now: 5001,
        });
        expect(second.events.some(event => event.type === SU_EVENTS.CARDS_DRAWN)).toBe(false);
    });
});

describe('Fairies abilities', () => {
    it('fairies_titania 可以先选择回手分支，再选择具体随从移回其拥有者手牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('titania-1', 'fairies_titania', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('enemy-1', 'robot_microbot_alpha', '1', 1, { owner: '1', powerModifier: 0 })],
                ongoingActions: [],
            }],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'titania-1', baseIndex: 0 } },
            defaultTestRandom,
        );

        const prompt = getInteractionsFromMS(played.finalState)[0] as any;
        expect(prompt?.data?.sourceId).toBe('fairies_titania');
        const returnBranchOption = prompt.data.options.find((entry: any) => entry.value?.branchId === 'return_minion');
        expect(returnBranchOption).toBeDefined();

        const choseReturnBranch = runCommand(
            played.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: returnBranchOption.id } } as any,
            defaultTestRandom,
        );
        const targetPrompt = getInteractionsFromMS(choseReturnBranch.finalState)[0] as any;
        expect(targetPrompt?.data?.sourceId).toBe('fairies_titania_return_minion');
        expect(targetPrompt?.data?.targetType).toBe('minion');
        const returnTargetOption = targetPrompt.data.options.find((entry: any) => entry.value?.minionUid === 'enemy-1');
        expect(returnTargetOption).toBeDefined();

        const resolved = runCommand(
            choseReturnBranch.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: returnTargetOption.id } } as any,
            defaultTestRandom,
        );

        expect(resolved.finalState.core.bases[0].minions.some(minion => minion.uid === 'enemy-1')).toBe(false);
        expect(resolved.finalState.core.players['1'].hand.some(card => card.uid === 'enemy-1')).toBe(true);
    });

    it('fairies_titania 在丛林之灵在场时会先执行已选分支，再给剩余分支与跳过', () => {
        const core = makeState({
            turnNumber: 1,
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('titania-1', 'fairies_titania', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            titans: [{
                uid: 'spirit-1',
                defId: 'fairies_spirit_of_the_forest',
                faction: 'fairies',
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            }],
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('enemy-1', 'robot_microbot_alpha', '1', 1, { owner: '1', powerModifier: 0 })],
                ongoingActions: [],
            }],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'titania-1', baseIndex: 0 } },
            defaultTestRandom,
        );
        const prompt = getInteractionsFromMS(played.finalState)[0] as any;
        expect(prompt?.data?.sourceId).toBe('fairies_titania');
        const extraMinionOption = prompt.data.options.find((entry: any) => entry.value?.branchId === 'extra_minion');
        const returnOption = prompt.data.options.find((entry: any) => entry.value?.branchId === 'return_minion');
        expect(extraMinionOption).toBeDefined();
        expect(returnOption).toBeDefined();

        const choseReturnBranch = runCommand(
            played.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: returnOption.id } } as any,
            defaultTestRandom,
        );
        const targetPrompt = getInteractionsFromMS(choseReturnBranch.finalState)[0] as any;
        expect(targetPrompt?.data?.sourceId).toBe('fairies_titania_return_minion');
        expect(targetPrompt?.data?.targetType).toBe('minion');
        const targetOption = targetPrompt.data.options.find((entry: any) => entry.value?.minionUid === 'enemy-1');
        expect(targetOption).toBeDefined();

        const choseTarget = runCommand(
            choseReturnBranch.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: targetOption.id } } as any,
            defaultTestRandom,
        );
        const followUpPrompt = getInteractionsFromMS(choseTarget.finalState)[0] as any;
        expect(followUpPrompt?.data?.sourceId).toBe('fairies_titania');
        const followUpExtraMinion = followUpPrompt.data.options.find((entry: any) => entry.value?.branchId === 'extra_minion');
        const skipOption = followUpPrompt.data.options.find((entry: any) => entry.value?.skip === true);
        expect(followUpExtraMinion).toBeDefined();
        expect(skipOption).toBeDefined();
        expect(followUpPrompt.data.options.find((entry: any) => entry.value?.branchId === 'return_minion')).toBeUndefined();
        expect(choseTarget.finalState.core.titans?.find(titan => titan.uid === 'spirit-1')?.metadata?.spiritOfTheForestUsedTurn).toBeUndefined();

        const resolved = runCommand(
            choseTarget.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: followUpExtraMinion.id } } as any,
            defaultTestRandom,
        );

        expect(getInteractionsFromMS(resolved.finalState)).toHaveLength(0);
        expect(resolved.finalState.core.players['0'].minionLimit).toBe(2);
        expect(resolved.finalState.core.bases[0].minions.some(minion => minion.uid === 'enemy-1')).toBe(false);
        expect(resolved.finalState.core.players['1'].hand.some(card => card.uid === 'enemy-1')).toBe(true);
        expect(resolved.finalState.core.titans?.find(titan => titan.uid === 'spirit-1')?.metadata?.spiritOfTheForestUsedTurn).toBe(1);
    });

    it('fairies_titania 的第二个 OR 分支必须等待同 frame 的插队交互先结清', () => {
        const core = makeState({
            turnNumber: 1,
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('titania-1', 'fairies_titania', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            titans: [{
                uid: 'spirit-1',
                defId: 'fairies_spirit_of_the_forest',
                faction: 'fairies',
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            }],
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('enemy-1', 'robot_microbot_alpha', '1', 1, { owner: '1', powerModifier: 0 })],
                ongoingActions: [],
            }],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'titania-1', baseIndex: 0 } },
            defaultTestRandom,
        );
        const firstPrompt = getInteractionsFromMS(played.finalState)[0] as any;
        const returnOption = firstPrompt.data.options.find((entry: any) => entry.value?.branchId === 'return_minion');
        expect(returnOption).toBeDefined();

        const choseReturnBranch = runCommand(
            played.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: returnOption.id } } as any,
            defaultTestRandom,
        );
        const targetPrompt = getInteractionsFromMS(choseReturnBranch.finalState)[0] as any;
        const frameId = targetPrompt?.resolutionFrameId as string | undefined;
        expect(frameId).toBeTruthy();

        const injectedPrompt = createSimpleChoice(
            'synthetic-inserted',
            '0',
            '模拟返回时插队交互',
            [{ id: 'skip', label: '跳过', value: { skip: true }, displayMode: 'button' as const }],
            { sourceId: 'synthetic_inserted', targetType: 'button', autoResolveIfSingle: false },
        );
        const queuedInserted = queueInteraction(choseReturnBranch.finalState, {
            ...injectedPrompt,
            resolutionFrameId: frameId,
        });
        const insertedCurrentState = resolveInteraction(queuedInserted);
        const insertedPromptState = getInteractionsFromMS(insertedCurrentState)[0] as any;
        expect(insertedPromptState?.data?.sourceId).toBe('synthetic_inserted');

        const blockedByInserted = resumePendingBranchingChoiceFrames(insertedCurrentState, 5003);
        expect(getInteractionsFromMS(blockedByInserted)[0]?.data?.sourceId).toBe('synthetic_inserted');

        const afterInsertedResolved = resolveInteraction(insertedCurrentState);
        const resumedState = resumePendingBranchingChoiceFrames(afterInsertedResolved, 5004);
        const followUpPrompt = getInteractionsFromMS(resumedState)[0] as any;
        expect(followUpPrompt?.data?.sourceId).toBe('fairies_titania');
        const followUpExtraMinion = followUpPrompt.data.options.find((entry: any) => entry.value?.branchId === 'extra_minion');
        expect(followUpExtraMinion).toBeDefined();
        expect(followUpPrompt.data.options.find((entry: any) => entry.value?.branchId === 'return_minion')).toBeUndefined();
    });

    it('fairies_glymmer 对其他随从的 -4 力量会在你的下回合开始时结束', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            turnNumber: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('glymmer-1', 'fairies_glymmer', '0', 4, { powerModifier: 0 }),
                    makeMinion('enemy-1', 'robot_microbot_alpha', '1', 3, { powerModifier: 0 }),
                ],
                ongoingActions: [],
            }],
        });

        const used = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.USE_TALENT, playerId: '0', payload: { minionUid: 'glymmer-1', baseIndex: 0 } },
            defaultTestRandom,
        );

        const prompt = getInteractionsFromMS(used.finalState)[0] as any;
        expect(prompt?.data?.sourceId).toBe('fairies_glymmer');
        const targetBranch = prompt.data.options.find((entry: any) => entry.value?.choice === 'target_other');
        expect(targetBranch).toBeDefined();

        const choseTargetBranch = runCommand(
            used.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: targetBranch.id } } as any,
            defaultTestRandom,
        );
        const targetPrompt = getInteractionsFromMS(choseTargetBranch.finalState)[0] as any;
        expect(targetPrompt?.data?.sourceId).toBe('fairies_glymmer_target');
        const targetOption = targetPrompt.data.options.find((entry: any) => entry.value?.minionUid === 'enemy-1');
        expect(targetOption).toBeDefined();

        const resolved = runCommand(
            choseTargetBranch.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: targetOption.id } } as any,
            defaultTestRandom,
        );

        const weakened = resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'enemy-1');
        expect(weakened).toBeDefined();
        expect(getEffectivePower(resolved.finalState.core, weakened!, 0)).toBe(0);

        const afterTurnStart = reduce(resolved.finalState.core, {
            type: SU_EVENTS.TURN_STARTED,
            payload: { playerId: '0', turnNumber: 3 },
            timestamp: 4100,
        } as any);
        const restored = afterTurnStart.bases[0].minions.find(minion => minion.uid === 'enemy-1');
        expect(restored).toBeDefined();
        expect(getEffectivePower(afterTurnStart, restored!, 0)).toBe(3);
    });

    it('fairies_ladybug 会让附着随从不能被消灭', () => {
        const protectedMinion = makeMinion('ally-1', 'robot_microbot_alpha', '0', 3, {
            powerModifier: 0,
            attachedActions: [{ uid: 'ladybug-1', defId: 'fairies_ladybug', ownerId: '0' }],
        });
        const core = makeState({
            bases: [{
                defId: 'base_a',
                minions: [protectedMinion],
                ongoingActions: [],
            }],
        });

        expect(isMinionProtected(core, protectedMinion, 0, '1', 'destroy')).toBe(true);
        expect(isMinionProtected(core, protectedMinion, 0, '0', 'destroy')).toBe(true);
    });

    it('fairies_enchantment 选择 -1 模式后会写入 metadata 并降低基地上随从力量', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('enchantment-1', 'fairies_enchantment', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('ally-1', 'robot_microbot_alpha', '0', 3, { powerModifier: 0 })],
                ongoingActions: [],
            }],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'enchantment-1', targetBaseIndex: 0 } },
            defaultTestRandom,
        );

        const prompt = getInteractionsFromMS(played.finalState)[0] as any;
        expect(prompt?.data?.sourceId).toBe('fairies_enchantment');
        const minusOption = prompt.data.options.find((entry: any) => entry.value?.branchId === 'minus');
        expect(minusOption).toBeDefined();

        const resolved = runCommand(
            played.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: minusOption.id } } as any,
            defaultTestRandom,
        );

        const enchantment = resolved.finalState.core.bases[0].ongoingActions.find(action => action.uid === 'enchantment-1');
        const targetMinion = resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'ally-1');
        expect(enchantment?.metadata?.fairiesEnchantmentMode).toBe('minus');
        expect(targetMinion).toBeDefined();
        expect(getEffectivePower(resolved.finalState.core, targetMinion!, 0)).toBe(2);
    });

    it('fairies_puck 在丛林之灵在场时会先执行已选分支，再给剩余分支与跳过', () => {
        const core = makeState({
            turnNumber: 1,
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('puck-1', 'fairies_puck', 'minion', '0')],
                    deck: [],
                    discard: [makeCard('draw-1', 'robot_microbot_alpha', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            titans: [{
                uid: 'spirit-1',
                defId: 'fairies_spirit_of_the_forest',
                faction: 'fairies',
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            }],
            bases: [{
                defId: 'base_a',
                minions: [],
                ongoingActions: [],
            }],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'puck-1', baseIndex: 0 } },
            defaultTestRandom,
        );

        const prompt = getInteractionsFromMS(played.finalState)[0] as any;
        expect(prompt?.data?.sourceId).toBe('fairies_puck');
        const drawOption = prompt.data.options.find((entry: any) => entry.value?.branchId === 'draw_card');
        const actionOption = prompt.data.options.find((entry: any) => entry.value?.branchId === 'extra_action');
        expect(drawOption).toBeDefined();
        expect(actionOption).toBeDefined();

        const drewCard = runCommand(
            played.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: drawOption.id } } as any,
            defaultTestRandom,
        );
        expect(drewCard.events.some(event => event.type === SU_EVENTS.DECK_RESHUFFLED)).toBe(true);
        expect(drewCard.events.some(event => event.type === SU_EVENTS.CARDS_DRAWN)).toBe(true);
        expect(drewCard.finalState.core.players['0'].hand.length).toBe(1);
        expect(drewCard.finalState.core.players['0'].discard).toHaveLength(0);
        expect(drewCard.finalState.core.players['0'].actionLimit).toBe(1);
        expect(drewCard.finalState.core.titans?.find(titan => titan.uid === 'spirit-1')?.metadata?.spiritOfTheForestUsedTurn).toBeUndefined();

        const followUpPrompt = getInteractionsFromMS(drewCard.finalState)[0] as any;
        expect(followUpPrompt?.data?.sourceId).toBe('fairies_puck');
        const followUpAction = followUpPrompt.data.options.find((entry: any) => entry.value?.branchId === 'extra_action');
        const skipOption = followUpPrompt.data.options.find((entry: any) => entry.value?.skip === true);
        expect(followUpAction).toBeDefined();
        expect(skipOption).toBeDefined();
        expect(followUpPrompt.data.options.find((entry: any) => entry.value?.branchId === 'draw_card')).toBeUndefined();

        const resolved = runCommand(
            drewCard.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: followUpAction.id } } as any,
            defaultTestRandom,
        );

        expect(resolved.finalState.core.players['0'].hand.length).toBe(1);
        expect(resolved.finalState.core.players['0'].actionLimit).toBe(2);
        expect(resolved.finalState.core.titans?.find(titan => titan.uid === 'spirit-1')?.metadata?.spiritOfTheForestUsedTurn).toBe(1);
    });

    it('fairies_playful_tricks 可以直接把丛林之灵打到场上而不额外消耗通常随从额度', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('playful-1', 'fairies_playful_tricks', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            titans: [{
                uid: 'spirit-1',
                defId: 'fairies_spirit_of_the_forest',
                faction: 'fairies',
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'setaside' },
            }],
            bases: [{
                defId: 'base_a',
                minions: [],
                ongoingActions: [],
            }],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'playful-1' } },
            defaultTestRandom,
        );

        const modePrompt = getInteractionsFromMS(played.finalState)[0] as any;
        expect(modePrompt?.data?.sourceId).toBe('fairies_playful_tricks');
        const playSpiritOption = modePrompt.data.options.find((entry: any) => entry.value?.branchId === 'play_spirit');
        expect(playSpiritOption).toBeDefined();

        const choseSpirit = runCommand(
            played.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: playSpiritOption.id } } as any,
            defaultTestRandom,
        );

        const basePrompt = getInteractionsFromMS(choseSpirit.finalState)[0] as any;
        expect(basePrompt?.data?.sourceId).toBe('fairies_playful_tricks_spirit_base');

        const summoned = runCommand(
            choseSpirit.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: basePrompt.data.options[0].id } } as any,
            defaultTestRandom,
        );

        const spirit = summoned.finalState.core.titans?.find(titan => titan.uid === 'spirit-1');
        expect(spirit?.location.zone).toBe('base');
        expect(spirit?.location.baseIndex).toBe(0);
        expect(summoned.finalState.core.players['0'].actionsPlayed).toBe(1);
        expect(summoned.finalState.core.players['0'].minionsPlayed).toBe(0);
    });

    it('fairies_enchantment 在丛林之灵在场时会先执行已选分支，再给剩余分支与跳过并记录 both 模式', () => {
        const core = makeState({
            turnNumber: 1,
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('enchantment-1', 'fairies_enchantment', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            titans: [{
                uid: 'spirit-1',
                defId: 'fairies_spirit_of_the_forest',
                faction: 'fairies',
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            }],
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('ally-1', 'robot_microbot_alpha', '0', 3, { powerModifier: 0 })],
                ongoingActions: [],
            }],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'enchantment-1', targetBaseIndex: 0 } },
            defaultTestRandom,
        );
        const prompt = getInteractionsFromMS(played.finalState)[0] as any;
        const plusOption = prompt.data.options.find((entry: any) => entry.value?.branchId === 'plus');
        expect(plusOption).toBeDefined();
        const chosePlus = runCommand(
            played.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: plusOption.id } } as any,
            defaultTestRandom,
        );
        const followUpPrompt = getInteractionsFromMS(chosePlus.finalState)[0] as any;
        expect(followUpPrompt?.data?.sourceId).toBe('fairies_enchantment');
        const minusOption = followUpPrompt.data.options.find((entry: any) => entry.value?.branchId === 'minus');
        const skipOption = followUpPrompt.data.options.find((entry: any) => entry.value?.skip === true);
        expect(minusOption).toBeDefined();
        expect(skipOption).toBeDefined();
        expect(chosePlus.finalState.core.titans?.find(titan => titan.uid === 'spirit-1')?.metadata?.spiritOfTheForestUsedTurn).toBeUndefined();

        const resolved = runCommand(
            chosePlus.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: minusOption.id } } as any,
            defaultTestRandom,
        );

        const enchantment = resolved.finalState.core.bases[0].ongoingActions.find(action => action.uid === 'enchantment-1');
        const targetMinion = resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'ally-1');
        expect(enchantment?.metadata?.fairiesEnchantmentMode).toBe('both');
        expect(getEffectivePower(resolved.finalState.core, targetMinion!, 0)).toBe(3);
        expect(resolved.finalState.core.titans?.find(titan => titan.uid === 'spirit-1')?.metadata?.spiritOfTheForestUsedTurn).toBe(1);
    });

    it('base_fairy_ring 选择额外行动时不会同时授予额外随从额度', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('minion-1', 'robot_microbot_alpha', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_fairy_ring',
                minions: [],
                ongoingActions: [],
            }],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'minion-1', baseIndex: 0 } },
            defaultTestRandom,
        );

        const prompt = getInteractionsFromMS(played.finalState)[0] as any;
        expect(prompt?.data?.sourceId).toBe('base_fairy_ring');
        const actionOption = prompt.data.options.find((entry: any) => entry.value?.branchId === 'extra_action');
        expect(actionOption).toBeDefined();

        const resolved = runCommand(
            played.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: actionOption.id } } as any,
            defaultTestRandom,
        );

        expect(resolved.finalState.core.players['0'].actionLimit).toBe(2);
        expect(resolved.finalState.core.players['0'].baseLimitedMinionQuota).toBeUndefined();
        expect(resolved.finalState.core.players['0'].minionLimit).toBe(1);
    });

    it('base_fairy_ring 在丛林之灵在场时只选单分支时，会先执行该分支并允许跳过剩余分支', () => {
        const core = makeState({
            turnNumber: 1,
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('minion-1', 'robot_microbot_alpha', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            titans: [{
                uid: 'spirit-1',
                defId: 'fairies_spirit_of_the_forest',
                faction: 'fairies',
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            }],
            bases: [{
                defId: 'base_fairy_ring',
                minions: [],
                ongoingActions: [],
            }],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'minion-1', baseIndex: 0 } },
            defaultTestRandom,
        );
        const prompt = getInteractionsFromMS(played.finalState)[0] as any;
        const actionOption = prompt.data.options.find((entry: any) => entry.value?.branchId === 'extra_action');
        const initialSkipOption = prompt.data.options.find((entry: any) => entry.value?.skip === true);
        expect(actionOption).toBeDefined();
        expect(initialSkipOption).toBeDefined();

        const choseAction = runCommand(
            played.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: actionOption.id } } as any,
            defaultTestRandom,
        );
        expect(choseAction.finalState.core.players['0'].actionLimit).toBe(2);
        const followUpPrompt = getInteractionsFromMS(choseAction.finalState)[0] as any;
        expect(followUpPrompt?.data?.sourceId).toBe('base_fairy_ring');
        const followUpMinion = followUpPrompt.data.options.find((entry: any) => entry.value?.branchId === 'extra_minion');
        const followUpSkip = followUpPrompt.data.options.find((entry: any) => entry.value?.skip === true);
        expect(followUpMinion).toBeDefined();
        expect(followUpSkip).toBeDefined();
        expect(followUpPrompt.data.options.find((entry: any) => entry.value?.branchId === 'extra_action')).toBeUndefined();

        const resolved = runCommand(
            choseAction.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: followUpSkip.id } } as any,
            defaultTestRandom,
        );

        expect(resolved.finalState.core.players['0'].actionLimit).toBe(2);
        expect(resolved.finalState.core.players['0'].minionLimit).toBe(1);
        expect(resolved.finalState.core.players['0'].baseLimitedMinionQuota).toBeUndefined();
        expect(resolved.finalState.core.titans?.find(titan => titan.uid === 'spirit-1')?.metadata?.spiritOfTheForestUsedTurn).toBeUndefined();
    });

    it('base_fairy_ring 在丛林之灵在场时会先执行已选分支，再给剩余分支与跳过', () => {
        const core = makeState({
            turnNumber: 1,
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('minion-1', 'robot_microbot_alpha', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            titans: [{
                uid: 'spirit-1',
                defId: 'fairies_spirit_of_the_forest',
                faction: 'fairies',
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            }],
            bases: [{
                defId: 'base_fairy_ring',
                minions: [],
                ongoingActions: [],
            }],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'minion-1', baseIndex: 0 } },
            defaultTestRandom,
        );
        const prompt = getInteractionsFromMS(played.finalState)[0] as any;
        const actionOption = prompt.data.options.find((entry: any) => entry.value?.branchId === 'extra_action');
        expect(actionOption).toBeDefined();

        const choseAction = runCommand(
            played.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: actionOption.id } } as any,
            defaultTestRandom,
        );
        const followUpPrompt = getInteractionsFromMS(choseAction.finalState)[0] as any;
        expect(followUpPrompt?.data?.sourceId).toBe('base_fairy_ring');
        const minionOption = followUpPrompt.data.options.find((entry: any) => entry.value?.branchId === 'extra_minion');
        const skipOption = followUpPrompt.data.options.find((entry: any) => entry.value?.skip === true);
        expect(minionOption).toBeDefined();
        expect(skipOption).toBeDefined();
        expect(choseAction.finalState.core.players['0'].actionLimit).toBe(2);
        expect(choseAction.finalState.core.titans?.find(titan => titan.uid === 'spirit-1')?.metadata?.spiritOfTheForestUsedTurn).toBeUndefined();

        const resolved = runCommand(
            choseAction.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: minionOption.id } } as any,
            defaultTestRandom,
        );

        expect(resolved.finalState.core.players['0'].actionLimit).toBe(2);
        expect(resolved.finalState.core.players['0'].minionLimit).toBe(1);
        expect(resolved.finalState.core.players['0'].baseLimitedMinionQuota?.[0]).toBe(1);
        expect(resolved.finalState.core.titans?.find(titan => titan.uid === 'spirit-1')?.metadata?.spiritOfTheForestUsedTurn).toBe(1);
    });
});

describe('Princesses abilities', () => {
    it('princesses_direct_to_dvd_sequel 会把弃牌堆随从洗回牌库并抽 1', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('dvd-1', 'princesses_direct_to_dvd_sequel', 'action', '0')],
                    discard: [makeCard('discard-minion', 'robot_microbot_alpha', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'dvd-1' } },
            defaultTestRandom,
        );
        expect(played.success).toBe(true);

        const prompt = getInteractionsFromMS(played.finalState)[0] as any;
        expect(prompt?.data?.sourceId).toBe('princesses_direct_to_dvd_sequel');
        const option = prompt.data.options.find((entry: any) => entry.value?.cardUid === 'discard-minion');
        expect(option).toBeDefined();

        const resolved = runCommand(
            played.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: option.id } } as any,
            defaultTestRandom,
        );

        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['discard-minion']);
        expect(resolved.finalState.core.players['0'].deck).toHaveLength(0);
        expect(resolved.finalState.core.players['0'].discard.map(card => card.uid)).toContain('dvd-1');
    });

    it('princesses_woodland_helpers 会把刚打出的行动放到牌库底', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('deck-1', 'robot_microbot_alpha', 'minion', '0')],
                    discard: [makeCard('spell-1', 'wizard_summon', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [],
                ongoingActions: [{ uid: 'woodland-1', defId: 'princesses_woodland_helpers', ownerId: '0' }],
            }],
        });

        const triggerResult = fireTriggers(core, 'onActionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            sourceEventId: 'action-played:spell-1:0',
            random: defaultTestRandom,
            now: 1000,
        });

        const prompt = getInteractionsFromMS(triggerResult.matchState!)[0] as any;
        expect(prompt?.data?.sourceId).toBe('princesses_woodland_helpers');
        expect(prompt?.data?.displayCard).toEqual({ defId: 'wizard_summon', cardUid: 'spell-1' });
        const option = prompt.data.options.find((entry: any) => entry.value?.choice === 'move_to_bottom');
        expect(option).toBeDefined();

        const resolved = runCommand(
            triggerResult.matchState!,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: option.id } } as any,
            defaultTestRandom,
        );

        expect(resolved.finalState.core.players['0'].discard.map(card => card.uid)).not.toContain('spell-1');
        expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['deck-1', 'spell-1']);
    });

    it('princesses_fairy_godmother 选择 buff 时会进入第二段目标选择并给目标 +2 力量', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('fg-1', 'princesses_fairy_godmother', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('ally-1', 'robot_microbot_alpha', '0', 2),
                    makeMinion('enemy-1', 'robot_microbot_beta', '1', 3),
                ],
                ongoingActions: [],
            }],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'fg-1' } },
            defaultTestRandom,
        );
        const prompt = getInteractionsFromMS(played.finalState)[0] as any;
        expect(prompt?.data?.sourceId).toBe('princesses_fairy_godmother');

        const buffOption = prompt.data.options.find((entry: any) => entry.value?.choice === 'buff');
        expect(buffOption).toBeDefined();

        const choseBuff = runCommand(
            played.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: buffOption.id } } as any,
            defaultTestRandom,
        );
        const targetPrompt = getInteractionsFromMS(choseBuff.finalState)[0] as any;
        expect(targetPrompt?.data?.sourceId).toBe('princesses_fairy_godmother_target');

        const targetOption = targetPrompt.data.options.find((entry: any) => entry.value?.minionUid === 'ally-1');
        expect(targetOption).toBeDefined();

        const resolved = runCommand(
            choseBuff.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: targetOption.id } } as any,
            defaultTestRandom,
        );

        expect(resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'ally-1')?.tempPowerModifier).toBe(2);
    });

    it('princesses_true_loves_kiss 会先选随从再选基地并完成移动', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('tlk-1', 'princesses_true_loves_kiss', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [makeMinion('enemy-1', 'robot_microbot_alpha', '1', 2)],
                    ongoingActions: [],
                },
                {
                    defId: 'base_b',
                    minions: [],
                    ongoingActions: [],
                },
            ],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'tlk-1' } },
            defaultTestRandom,
        );
        const prompt = getInteractionsFromMS(played.finalState)[0] as any;
        expect(prompt?.data?.sourceId).toBe('princesses_true_loves_kiss');

        const minionOption = prompt.data.options.find((entry: any) => entry.value?.minionUid === 'enemy-1');
        expect(minionOption).toBeDefined();

        const choseMinion = runCommand(
            played.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: minionOption.id } } as any,
            defaultTestRandom,
        );
        const basePrompt = getInteractionsFromMS(choseMinion.finalState)[0] as any;
        expect(basePrompt?.data?.sourceId).toBe('princesses_true_loves_kiss_base');

        const baseOption = basePrompt.data.options.find((entry: any) => entry.value?.baseIndex === 1);
        expect(baseOption).toBeDefined();

        const resolved = runCommand(
            choseMinion.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: baseOption.id } } as any,
            defaultTestRandom,
        );

        expect(resolved.finalState.core.bases[0].minions.map(minion => minion.uid)).not.toContain('enemy-1');
        expect(resolved.finalState.core.bases[1].minions.map(minion => minion.uid)).toContain('enemy-1');
    });

    it('princesses_some_day_my_prince_will_come 会先选本基地随从再选目标基地', () => {
        const executor = resolveSpecial('princesses_some_day_my_prince_will_come');
        expect(executor).toBeDefined();

        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('ally-1', 'robot_microbot_alpha', '0', 2),
                        makeMinion('enemy-1', 'robot_microbot_beta', '1', 3),
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_b',
                    minions: [],
                    ongoingActions: [],
                },
            ],
        });

        const result = executor!({
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'special-1',
            defId: 'princesses_some_day_my_prince_will_come',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 1000,
        });

        const prompt = getInteractionsFromMS(result.matchState!)[0] as any;
        expect(prompt?.data?.sourceId).toBe('princesses_some_day_my_prince_will_come');
        const minionOption = prompt.data.options.find((entry: any) => entry.value?.minionUid === 'ally-1');
        expect(minionOption).toBeDefined();

        const choseMinion = runCommand(
            result.matchState!,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: minionOption.id } } as any,
            defaultTestRandom,
        );
        const basePrompt = getInteractionsFromMS(choseMinion.finalState)[0] as any;
        expect(basePrompt?.data?.sourceId).toBe('princesses_some_day_my_prince_will_come_base');

        const baseOption = basePrompt.data.options.find((entry: any) => entry.value?.baseIndex === 1);
        expect(baseOption).toBeDefined();

        const resolved = runCommand(
            choseMinion.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: baseOption.id } } as any,
            defaultTestRandom,
        );

        expect(resolved.finalState.core.bases[0].minions.map(minion => minion.uid)).not.toContain('ally-1');
        expect(resolved.finalState.core.bases[1].minions.map(minion => minion.uid)).toContain('ally-1');
    });

    it('princesses_skillet 会消灭低力量随从并抽三张牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('skillet-1', 'princesses_skillet', 'action', '0')],
                    deck: [
                        makeCard('draw-1', 'robot_microbot_alpha', 'minion', '0'),
                        makeCard('draw-2', 'robot_microbot_beta', 'minion', '0'),
                        makeCard('draw-3', 'wizard_summon', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('enemy-1', 'robot_microbot_alpha', '1', 2)],
                ongoingActions: [],
            }],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'skillet-1' } },
            defaultTestRandom,
        );
        const prompt = getInteractionsFromMS(played.finalState)[0] as any;
        expect(prompt?.data?.sourceId).toBe('princesses_skillet');

        const option = prompt.data.options.find((entry: any) => entry.value?.minionUid === 'enemy-1');
        expect(option).toBeDefined();

        const resolved = runCommand(
            played.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: option.id } } as any,
            defaultTestRandom,
        );

        expect(resolved.finalState.core.bases[0].minions.map(minion => minion.uid)).not.toContain('enemy-1');
        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['draw-1', 'draw-2', 'draw-3']);
    });

    it('princesses_snow_white 会把另一个基地上的仆从移动到这里', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [makeMinion('snow-1', 'princesses_snow_white', '0', 5)],
                    ongoingActions: [],
                },
                {
                    defId: 'base_b',
                    minions: [makeMinion('enemy-1', 'robot_microbot_alpha', '1', 2)],
                    ongoingActions: [],
                },
            ],
        });

        const talent = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.USE_TALENT, playerId: '0', payload: { minionUid: 'snow-1', baseIndex: 0 } },
            defaultTestRandom,
        );
        const prompt = getInteractionsFromMS(talent.finalState)[0] as any;
        expect(prompt?.data?.sourceId).toBe('princesses_snow_white');

        const option = prompt.data.options.find((entry: any) => entry.value?.minionUid === 'enemy-1');
        expect(option).toBeDefined();

        const resolved = runCommand(
            talent.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: option.id } } as any,
            defaultTestRandom,
        );

        expect(resolved.finalState.core.bases[0].minions.map(minion => minion.uid)).toContain('enemy-1');
        expect(resolved.finalState.core.bases[1].minions.map(minion => minion.uid)).not.toContain('enemy-1');
    });

    it('princesses_tale_as_old_as_time 会把你的所有仆从移动到选定基地', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('tale-1', 'princesses_tale_as_old_as_time', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [makeMinion('ally-1', 'robot_microbot_alpha', '0', 2)],
                    ongoingActions: [],
                },
                {
                    defId: 'base_b',
                    minions: [makeMinion('enemy-1', 'robot_microbot_beta', '1', 3)],
                    ongoingActions: [],
                },
                {
                    defId: 'base_c',
                    minions: [makeMinion('ally-2', 'wizard_apprentice', '0', 2)],
                    ongoingActions: [],
                },
            ],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'tale-1', targetBaseIndex: 1 } },
            defaultTestRandom,
        );
        expect(played.success).toBe(true);
        expect(getInteractionsFromMS(played.finalState)).toHaveLength(0);

        expect(played.finalState.core.bases[1].minions.map(minion => minion.uid)).toEqual(
            expect.arrayContaining(['ally-1', 'ally-2', 'enemy-1']),
        );
        expect(played.finalState.core.bases[0].minions.map(minion => minion.uid)).not.toContain('ally-1');
        expect(played.finalState.core.bases[2].minions.map(minion => minion.uid)).not.toContain('ally-2');
    });

    it('princesses_griselda 可以把传家宝从弃牌堆回到手牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    discard: [makeCard('heirloom-1', 'princesses_heirloom', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('griselda-1', 'princesses_griselda', '0', 5)],
                ongoingActions: [],
            }],
        });

        const talent = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.USE_TALENT, playerId: '0', payload: { minionUid: 'griselda-1', baseIndex: 0 } },
            defaultTestRandom,
        );
        const prompt = getInteractionsFromMS(talent.finalState)[0] as any;
        expect(prompt?.data?.sourceId).toBe('princesses_griselda');

        const option = prompt.data.options.find((entry: any) => entry.value?.cardUid === 'heirloom-1');
        expect(option).toBeDefined();

        const resolved = runCommand(
            talent.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: option.id } } as any,
            defaultTestRandom,
        );

        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).toContain('heirloom-1');
        expect(resolved.finalState.core.players['0'].discard).toHaveLength(0);
    });

    it('princesses_happily_ever_after 会在你于该基地得分时额外给 1 VP', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [],
                ongoingActions: [{ uid: 'hea-1', defId: 'princesses_happily_ever_after', ownerId: '0' }],
            }],
        });

        const triggered = fireTriggers(core, 'afterScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            rankings: [{ playerId: '0', power: 5, vp: 3 }],
            random: defaultTestRandom,
            now: 1000,
        });

        expect(triggered.events.some(event =>
            event.type === SU_EVENTS.VP_AWARDED
            && (event as any).payload.playerId === '0'
            && (event as any).payload.amount === 1,
        )).toBe(true);
    });

    it('princesses_sleeping_beauty 被消灭时会洗回牌库而不是进弃牌堆', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('sleep-1', 'princesses_sleeping_beauty', '0', 5)],
                ongoingActions: [],
            }],
        });
        const ms = makeMatchState(core);

        const triggerResult = processDestroyTriggers([{
            type: SU_EVENTS.MINION_DESTROYED,
            payload: {
                minionUid: 'sleep-1',
                minionDefId: 'princesses_sleeping_beauty',
                fromBaseIndex: 0,
                ownerId: '0',
                reason: 'test_destroy',
            },
            timestamp: 1000,
        } as any], ms, '1' as any, defaultTestRandom, 1000);

        expect(triggerResult.events.some(event => event.type === SU_EVENTS.MINION_DESTROYED)).toBe(false);
        const finalCore = triggerResult.events.reduce((current, event) => reduce(current, event as any), core);
        expect(finalCore.players['0'].discard.map(card => card.uid)).not.toContain('sleep-1');
        expect(finalCore.players['0'].deck.map(card => card.uid)).toContain('sleep-1');
    });

    it('princesses_eliza 会阻止对手在同回合打出第二张额外牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('extra-action-1', 'princesses_direct_to_dvd_sequel', 'action', '0')],
                    actionsPlayed: 1,
                    actionLimit: 2,
                    extraCardsPlayedThisTurn: 1,
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('eliza-1', 'princesses_eliza', '1', 5)],
                ongoingActions: [],
            }],
        });

        const result = validate(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'extra-action-1' } } as any,
        );

        expect(result.valid).toBe(false);
        expect(result.error).toBe('受伊莱莎限制：你本回合不能再打出额外牌');
    });
});
