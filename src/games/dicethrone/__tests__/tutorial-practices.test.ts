import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { MatchState, TutorialManifest } from '../../../engine/types';
import { createInitialSystemState, executePipeline } from '../../../engine/pipeline';
import { TUTORIAL_COMMANDS } from '../../../engine/systems/TutorialSystem';
import { buildLocalDispatchCommand } from '../../../engine/transport/localDispatchCommand';
import { DiceThroneDomain } from '../domain';
import type { DiceThroneCommand, DiceThroneCore } from '../domain/types';
import { testSystems, fixedRandom } from './test-utils';
import { DiceThroneDamagePractice, DiceThroneDiscardPractice, DiceThroneResponsePractice, DiceThroneUltimatePractice, DiceThroneUpgradePractice, DiceThroneStraightPractice, DiceThroneKnockdownPractice } from '../tutorialPractices';

const play = (manifest: TutorialManifest, alternate = false) => {
    let state: MatchState<DiceThroneCore> = {
        core: DiceThroneDomain.setup(['0', '1'], fixedRandom),
        sys: createInitialSystemState(['0', '1'], testSystems),
    };
    const dispatch = (type: string, payload: Record<string, unknown> = {}, playerId = '0') => {
        const result = executePipeline({ domain: DiceThroneDomain, systems: testSystems }, state,
            { type, payload, playerId, timestamp: 1 } as DiceThroneCommand, fixedRandom, ['0', '1']);
        if (!result.success) throw new Error(`${state.sys.tutorial.step?.id}: ${type}: ${result.error}`);
        state = result.state as MatchState<DiceThroneCore>;
    };
    dispatch(TUTORIAL_COMMANDS.START, { manifest });
    const visited = new Set<string>();
    for (let count = 0; count < manifest.steps.length + 10; count++) {
        const step = state.sys.tutorial.step!;
        if (!step) return state;
        if (visited.has(step.id)) throw new Error(`Stalled tutorial practice: ${step.id}`);
        visited.add(step.id);
        if (step.aiActions?.length) {
            for (const action of step.aiActions) {
                const { command } = buildLocalDispatchCommand({
                    state, commandType: action.commandType, localPregameControlledPlayerId: null,
                    payload: { ...(action.payload as Record<string, unknown> ?? {}), __tutorialAiCommand: true, __tutorialPlayerId: action.playerId ?? '0' },
                });
                dispatch(command.type, command.payload as Record<string, unknown>, command.playerId);
            }
            dispatch(TUTORIAL_COMMANDS.AI_CONSUMED, { stepId: step.id });
            if (state.sys.tutorial.step?.id !== step.id) continue;
        }
        if (step.infoStep || step.aiActions?.length) {
            dispatch(TUTORIAL_COMMANDS.NEXT, { reason: 'manual' });
            continue;
        }
        switch (step.id) {
            case 'upgrade-two': dispatch('PLAY_UPGRADE_CARD', { cardId: 'card-meditation-2', targetAbilityId: 'meditation' }); break;
            case 'upgrade-three': dispatch('PLAY_UPGRADE_CARD', { cardId: 'card-meditation-3', targetAbilityId: 'meditation' }); break;
            case 'straight-advance': case 'straight-resolve': case 'knockdown-enter': dispatch('ADVANCE_PHASE'); break;
            case 'straight-roll': case 'no-ability-roll': dispatch('ROLL_DICE'); break;
            case 'straight-confirm': case 'no-ability-confirm': dispatch('CONFIRM_ROLL'); break;
            case 'no-ability-pass': dispatch(TUTORIAL_COMMANDS.NEXT, { reason: 'auto' }); break;
            case 'no-ability-confirm-pass': dispatch('ADVANCE_PHASE'); break;
            case 'straight-select': dispatch('SELECT_ABILITY', { abilityId: alternate ? 'harmony' : 'calm-water' }); break;
            case 'knockdown-choice':
                if (alternate) dispatch('ADVANCE_PHASE');
                else dispatch(TUTORIAL_COMMANDS.NEXT, { reason: 'manual' });
                break;
            case 'knockdown-pay': dispatch('PAY_TO_REMOVE_KNOCKDOWN'); break;
            case 'instant-play': dispatch('PLAY_CARD', { cardId: 'card-boss-generous' }); break;
            case 'interference-play': dispatch('PLAY_CARD', { cardId: 'card-give-hand' }); break;
            case 'interference-target': {
                const manualNext = executePipeline({ domain: DiceThroneDomain, systems: testSystems }, state,
                    { type: TUTORIAL_COMMANDS.NEXT, payload: { reason: 'manual' }, playerId: '0', timestamp: 1 } as DiceThroneCommand,
                    fixedRandom, ['0', '1']);
                expect(manualNext.success).toBe(false);
                dispatch(TUTORIAL_COMMANDS.NEXT, { reason: 'auto' });
                break;
            }
            case 'interference-confirm':
                dispatch('REROLL_DIE', { dieId: 0 });
                dispatch('SYS_INTERACTION_CONFIRM');
                break;
            case 'interference-pass': dispatch('RESPONSE_PASS'); break;
            case 'limit-discard':
                dispatch('SELL_CARD', { cardId: state.core.players['0'].hand[0].id });
                expect(state.core.players['0'].hand).toHaveLength(6);
                expect(state.core.players['0'].resources.cp).toBe(15);
                dispatch('ADVANCE_PHASE');
                break;
            case 'ultimate-advance': case 'ultimate-resolve': dispatch('ADVANCE_PHASE'); break;
            case 'damage-advance': case 'damage-resolve': dispatch('ADVANCE_PHASE'); break;
            case 'ultimate-roll': dispatch('ROLL_DICE'); break;
            case 'damage-roll': dispatch('ROLL_DICE'); break;
            case 'ultimate-confirm': dispatch('CONFIRM_ROLL'); break;
            case 'damage-confirm': dispatch('CONFIRM_ROLL'); break;
            case 'ultimate-select': dispatch('SELECT_ABILITY', { abilityId: 'transcendence' }); break;
            case 'damage-select': dispatch('SELECT_ABILITY', { abilityId: 'lotus-palm' }); break;
            case 'boost-use': dispatch('USE_TOKEN', { tokenId: 'taiji', amount: 1, pendingDamageId: state.core.pendingDamage!.id }); break;
            case 'boost-pass': dispatch('SKIP_TOKEN_RESPONSE', { pendingDamageId: state.core.pendingDamage!.id }); break;
            default: throw new Error(`Unknown tutorial practice action: ${step.id}`);
        }
    }
    throw new Error('Tutorial practice did not finish');
};

describe('独立机制练习必须从合法起点经过正式决策', () => {
    beforeEach(() => { (globalThis as Record<string, unknown>).__BG_GAME_MODE__ = 'tutorial'; });
    afterEach(() => { delete (globalThis as Record<string, unknown>).__BG_GAME_MODE__; });
    it('升级II后只支付1CP差价升级III', () => {
        const state = play(DiceThroneUpgradePractice);
        expect(state.core.players['0'].resources.cp).toBe(3);
        expect(state.core.players['0'].abilityLevels.meditation).toBe(3);
    });
    it.each([false, true])('同组顺子允许选择大小顺技能，分支%s', alternate => {
        const state = play(DiceThroneStraightPractice, alternate);
        expect(state.core.players['1'].resources.hp).toBe(alternate ? 45 : 43);
        expect(state.core.players['0'].resources.hp).toBe(46);
        expect(state.core.players['0'].tokens.taiji).toBe(2);
        expect(state.core.players['0'].tokens.evasive).toBe(alternate ? 0 : 1);
    });
    it.each([false, true])('击倒允许支付保留进攻，也允许不支付跳过，分支%s', alternate => {
        const state = play(DiceThroneKnockdownPractice, alternate);
        expect(state.sys.phase).toBe('main2');
        expect(state.core.players['0'].resources.cp).toBe(alternate ? 2 : 0);
        expect(state.core.players['0'].statusEffects.knockdown).toBe(0);
        expect(state.core.players['0'].resources.hp).toBe(50);
        expect(state.core.players['1'].resources.hp).toBe(50);
    });
    it('对手回合红牌获得 CP、橙牌响应重掷并交回处理', () => {
        expect(DiceThroneResponsePractice.steps.find(step => step.id === 'interference-target')?.allowManualSkip).toBe(false);
        const state = play(DiceThroneResponsePractice);
        expect(state.core.players['0'].resources.cp).toBe(3);
        expect(state.core.players['0'].discard.map(card => card.id)).toEqual(expect.arrayContaining(['card-boss-generous', 'card-give-hand']));
        expect(state.sys.responseWindow.current).toBeUndefined();
    });
    it('超限出售、CP 上限、牌库耗尽后收入重洗抽牌', () => {
        const state = play(DiceThroneDiscardPractice);
        expect(state.core.activePlayerId).toBe('0');
        expect(state.core.players['0'].hand).toHaveLength(7);
        expect(state.core.players['0'].resources.cp).toBe(15);
        expect(state.core.players['0'].deck.length).toBeGreaterThan(0);
        expect(state.core.players['0'].discard).toHaveLength(0);
    });
    it('终极不可防御并在真实伤害结算后获胜', () => {
        const state = play(DiceThroneUltimatePractice);
        expect(state.core.players['1'].resources.hp).toBe(0);
        expect(state.sys.gameover).toBeDefined();
    });
    it('不可防御仍允许太极增伤和对手闪避，不能误作终极', () => {
        const state = play(DiceThroneDamagePractice);
        expect(state.core.players['1'].resources.hp).toBe(50);
        expect(state.core.players['1'].tokens.evasive).toBe(0);
        expect(state.core.players['0'].tokenStackLimits.taiji).toBe(6);
        expect(state.core.players['0'].tokens.taiji).toBe(6);
        expect(state.core.pendingDamage).toBeUndefined();
    });
});
