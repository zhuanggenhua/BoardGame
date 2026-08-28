/**
 * Shadow Thief Shadow Shank + Sneak Attack regression coverage.
 *
 * User-facing symptoms covered here:
 * - 暗影贼用了隐匿攻击后，伤害没加到总伤害。
 * - 武士给暗影贼挂的耻辱，攻击完了也没有移除。
 *
 * The Chinese UI calls the card reward "隐匿攻击"; the runtime token is
 * sneak_attack / 伏击.
 */

import { describe, expect, it } from 'vitest';
import { DiceThroneDomain } from '../domain';
import { TOKEN_IDS } from '../domain/ids';
import { RESOURCE_IDS } from '../domain/resources';
import { INITIAL_HEALTH } from '../domain/types';
import type { DiceThroneCommand, DiceThroneCore, DiceThroneEvent } from '../domain/types';
import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import { executePipeline } from '../../../engine/pipeline';
import { formatDiceThroneActionEntry } from '../game';
import {
    advanceTo,
    assertState,
    cmd,
    createHeroMatchup,
    createQueuedRandom,
    testSystems,
    type CommandInput,
} from './test-utils';

const PLAYER_IDS: PlayerId[] = ['0', '1'];
const pipelineConfig = { domain: DiceThroneDomain, systems: testSystems };

interface CommandStep {
    input: CommandInput;
    events: DiceThroneEvent[];
}

function runCommands(
    state: MatchState<DiceThroneCore>,
    commands: CommandInput[],
    random: RandomFn,
): { state: MatchState<DiceThroneCore>; steps: CommandStep[] } {
    let current = state;
    const steps: CommandStep[] = [];

    for (const input of commands) {
        const result = executePipeline(
            pipelineConfig,
            current,
            {
                type: input.type,
                playerId: input.playerId,
                payload: input.payload,
                timestamp: steps.length + 1,
            } as DiceThroneCommand,
            random,
            PLAYER_IDS,
        );

        expect(result.success, `${input.type} failed: ${result.error ?? 'unknown'}`).toBe(true);
        steps.push({ input, events: result.events as DiceThroneEvent[] });
        current = result.state as MatchState<DiceThroneCore>;
    }

    return { state: current, steps };
}

function setupShadowThiefVsSamurai(
    random: RandomFn,
    mutate?: (core: DiceThroneCore) => void,
): MatchState<DiceThroneCore> {
    return createHeroMatchup('shadow_thief', 'samurai', (core) => {
        core.players['0'].tokens[TOKEN_IDS.SNEAK_ATTACK] = 1;
        core.players['1'].tokens[TOKEN_IDS.SAMURAI_RETRIBUTION] = 0;
        core.players['1'].tokens[TOKEN_IDS.TAIJI] = 0;
        core.players['1'].tokens[TOKEN_IDS.EVASIVE] = 0;
        mutate?.(core);
    })(PLAYER_IDS, random);
}

function openShadowShankTokenResponse(
    random: RandomFn,
    mutate?: (core: DiceThroneCore) => void,
): { state: MatchState<DiceThroneCore>; steps: CommandStep[] } {
    const state = setupShadowThiefVsSamurai(random, mutate);
    const opened = runCommands(state, [
        ...advanceTo('offensiveRoll'),
        cmd('ROLL_DICE', '0'),
        cmd('CONFIRM_ROLL', '0'),
        cmd('SELECT_ABILITY', '0', { abilityId: 'shadow-shank' }),
        cmd('ADVANCE_PHASE', '0'),
    ], random);

    expect(opened.state.core.pendingDamage?.responseType).toBe('beforeDamageDealt');
    expect(opened.state.core.pendingDamage?.responderId).toBe('0');
    return opened;
}

function requirePendingDamageId(core: DiceThroneCore): string {
    const pendingDamageId = core.pendingDamage?.id;
    if (!pendingDamageId) {
        throw new Error('Expected current token response to have a pending damage id.');
    }
    return pendingDamageId;
}

function useSneakAttackAndClose(
    state: MatchState<DiceThroneCore>,
    random: RandomFn,
    pendingDamageId: string,
): { state: MatchState<DiceThroneCore>; steps: CommandStep[] } {
    return runCommands(state, [
        cmd('USE_TOKEN', '0', { tokenId: TOKEN_IDS.SNEAK_ATTACK, amount: 1, pendingDamageId }),
        cmd('SKIP_BONUS_DICE_REROLL', '0'),
        cmd('SKIP_TOKEN_RESPONSE', '0', { pendingDamageId }),
    ], random);
}

function flattenEvents(...groups: Array<{ steps: CommandStep[] }>): DiceThroneEvent[] {
    return groups.flatMap(group => group.steps.flatMap(step => step.events));
}

function findDamageEvent(events: DiceThroneEvent[]): Extract<DiceThroneEvent, { type: 'DAMAGE_DEALT' }> {
    const event = events.find((candidate): candidate is Extract<DiceThroneEvent, { type: 'DAMAGE_DEALT' }> => (
        candidate.type === 'DAMAGE_DEALT'
        && candidate.payload.sourceAbilityId === 'shadow-shank'
        && candidate.payload.targetId === '1'
    ));
    expect(event).toBeDefined();
    return event!;
}

describe('暗影穿刺 + 伏击 伤害丢失 Bug 复现', () => {
    it('终极技能 shadow-shank + sneak_attack：伤害应包含伏击奖励骰', () => {
        const random = createQueuedRandom([
            6, 6, 6, 6, 6,
            5,
        ]);

        const opened = openShadowShankTokenResponse(random);
        const pendingDamageId = requirePendingDamageId(opened.state.core);
        const closed = useSneakAttackAndClose(opened.state, random, pendingDamageId);

        expect(assertState(closed.state, {
            players: {
                '0': {
                    tokens: {
                        [TOKEN_IDS.SNEAK_ATTACK]: 0,
                    },
                    cp: 5,
                },
                '1': {
                    hp: 35,
                },
            },
        })).toEqual([]);

        const events = flattenEvents(opened, closed);
        expect(events.map(event => event.type)).toEqual(expect.arrayContaining([
            'TOKEN_RESPONSE_REQUESTED',
            'TOKEN_USED',
            'BONUS_DIE_ROLLED',
            'DAMAGE_DEALT',
        ]));
        expect(findDamageEvent(events).payload.amount).toBe(15);
    });

    it('复现线上场景：CP=6 + gainCp(3) = 9, damage 应为 9+5+dieValue', () => {
        const random = createQueuedRandom([
            6, 6, 6, 6, 6,
            3,
        ]);

        const opened = openShadowShankTokenResponse(random, (core) => {
            core.players['0'].resources[RESOURCE_IDS.CP] = 6;
        });
        const pendingDamageId = requirePendingDamageId(opened.state.core);
        const closed = useSneakAttackAndClose(opened.state, random, pendingDamageId);

        expect(assertState(closed.state, {
            players: {
                '0': {
                    cp: 9,
                    tokens: { [TOKEN_IDS.SNEAK_ATTACK]: 0 },
                },
                '1': {
                    hp: 33,
                },
            },
        })).toEqual([]);

        expect(findDamageEvent(flattenEvents(opened, closed)).payload.amount).toBe(17);
    });

    it('伏击确认后：武士耻辱不应降低终极伤害，但应在攻击结算链路中移除', () => {
        const random = createQueuedRandom([
            6, 6, 6, 6, 6,
            3,
        ]);

        const opened = openShadowShankTokenResponse(random, (core) => {
            core.players['0'].resources[RESOURCE_IDS.CP] = 6;
            core.players['0'].tokens[TOKEN_IDS.SHAME] = 2;
        });

        expect(opened.state.core.pendingDamage?.currentDamage).toBe(14);
        const pendingDamageId = requirePendingDamageId(opened.state.core);
        const closed = useSneakAttackAndClose(opened.state, random, pendingDamageId);

        expect(assertState(closed.state, {
            players: {
                '0': {
                    cp: 9,
                    tokens: {
                        [TOKEN_IDS.SNEAK_ATTACK]: 0,
                        [TOKEN_IDS.SHAME]: 0,
                    },
                },
                '1': {
                    hp: 33,
                },
            },
        })).toEqual([]);

        const events = flattenEvents(opened, closed);
        const shameConsumed = events.find((event): event is Extract<DiceThroneEvent, { type: 'TOKEN_CONSUMED' }> => (
            event.type === 'TOKEN_CONSUMED'
            && event.payload.playerId === '0'
            && event.payload.tokenId === TOKEN_IDS.SHAME
        ));
        expect(shameConsumed?.payload).toMatchObject({ amount: 2, newTotal: 0 });

        const damageEvent = findDamageEvent(events);
        expect(damageEvent.payload.amount).toBe(17);
        expect(damageEvent.payload.modifiers).toEqual(expect.arrayContaining([
            expect.objectContaining({ sourceId: TOKEN_IDS.SNEAK_ATTACK, value: 3 }),
        ]));
        expect(damageEvent.payload.modifiers ?? []).not.toEqual(expect.arrayContaining([
            expect.objectContaining({ sourceId: TOKEN_IDS.SHAME }),
        ]));
    });

    it('ActionLog：TOKEN_USED 显示伏击掷骰值，DAMAGE_DEALT 包含总伤害', () => {
        const random = createQueuedRandom([
            6, 6, 6, 6, 6,
            3,
        ]);

        const opened = openShadowShankTokenResponse(random, (core) => {
            core.players['0'].resources[RESOURCE_IDS.CP] = 6;
        });
        const pendingDamageId = requirePendingDamageId(opened.state.core);
        const closed = useSneakAttackAndClose(opened.state, random, pendingDamageId);

        const useTokenStep = closed.steps[0];
        const confirmBonusDieStep = closed.steps[1];
        const closeTokenResponseStep = closed.steps[2];

        const tokenUsedEvent = useTokenStep.events.find((event): event is Extract<DiceThroneEvent, { type: 'TOKEN_USED' }> => (
            event.type === 'TOKEN_USED'
        ));
        expect(tokenUsedEvent?.payload.damageModifier).toBe(0);

        const bonusDieEvent = confirmBonusDieStep.events.find((event): event is Extract<DiceThroneEvent, { type: 'BONUS_DIE_ROLLED' }> => (
            event.type === 'BONUS_DIE_ROLLED'
        ));
        expect(bonusDieEvent?.payload.pendingDamageBonus).toBe(3);

        const damageEvent = closeTokenResponseStep.events.find((event): event is Extract<DiceThroneEvent, { type: 'DAMAGE_DEALT' }> => (
            event.type === 'DAMAGE_DEALT'
            && event.payload.targetId === '1'
        ));
        expect(damageEvent?.payload.amount).toBe(17);
        expect(damageEvent?.payload.modifiers).toEqual(expect.arrayContaining([
            expect.objectContaining({ sourceId: TOKEN_IDS.SNEAK_ATTACK, value: 3 }),
        ]));

        const logEntries = formatDiceThroneActionEntry({
            command: {
                type: 'USE_TOKEN',
                playerId: '0',
                payload: { tokenId: TOKEN_IDS.SNEAK_ATTACK, amount: 1, pendingDamageId },
                timestamp: 1,
            } as never,
            state: closed.state as never,
            events: [...useTokenStep.events, ...confirmBonusDieStep.events] as never,
        });
        const tokenLogEntries = Array.isArray(logEntries) ? logEntries : logEntries ? [logEntries] : [];
        const tokenUsedLog = tokenLogEntries.find((entry: any) => entry.kind === 'TOKEN_USED');
        expect(tokenUsedLog).toBeDefined();

        const modifierSegment = tokenUsedLog!.segments.find(
            (segment: any) => segment.type === 'i18n' && segment.key === 'actionLog.tokenModifier',
        ) as any;
        expect(modifierSegment?.params.amount).toBe(3);
    });
});
