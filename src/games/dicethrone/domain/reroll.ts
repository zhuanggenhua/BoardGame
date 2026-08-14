import type { PlayerId, RandomFn } from '../../../engine/types';
import type {
    DiceThroneCore,
    DiceThroneEvent,
    DiceThroneRollContextKind,
    DieRerolledEvent,
    TurnPhase,
} from './types';
import { findCurrentRollDie, getCurrentRollOwnerId, resolveCurrentRollContext } from './rollContext';

/** DiceThrone 的所有重投入口共享同一个随机点数原语。 */
export const rollDieValue = (random: RandomFn): number => random.d(6);

const getRerollTarget = (
    rollKind: DiceThroneRollContextKind,
): DieRerolledEvent['payload']['target'] => {
    if (rollKind === 'evasion') return 'evasionDie';
    if (rollKind === 'bonus') return 'pendingBonusDie';
    if (rollKind === 'compare') return 'activeDie';
    return undefined;
};

export interface BuildCurrentRollRerollEventsOptions {
    state: DiceThroneCore;
    phase: TurnPhase;
    dieId: number;
    playerId: PlayerId;
    random: RandomFn;
    timestamp: number;
    sourceCommandType: string;
    skipAbilityReselection?: boolean;
}

/** 只有主进攻骰变更会使已选攻击技能失效；临时骰不改变攻击骰型。 */
export const shouldRequireAbilityReselectionForCurrentRoll = (
    state: DiceThroneCore,
    phase: TurnPhase,
): boolean => (
    phase === 'offensiveRoll'
    && typeof state.pendingAttack?.sourceAbilityId === 'string'
    && resolveCurrentRollContext(state, phase)?.kind === 'offensive'
);

/**
 * 当前骰区指定一颗骰子的唯一重投执行路径。
 *
 * 入口命令仍负责各自的时机、目标、Token/CP 和交互校验；一旦进入这里，
 * 随机点数、DIE_REROLLED 事件以及进攻技能重选的派生行为只能由这一处生成。
 */
export const buildCurrentRollRerollEvents = ({
    state,
    phase,
    dieId,
    playerId,
    random,
    timestamp,
    sourceCommandType,
    skipAbilityReselection = false,
}: BuildCurrentRollRerollEventsOptions): DiceThroneEvent[] => {
    const currentRollContext = resolveCurrentRollContext(state, phase);
    const currentDie = findCurrentRollDie(state, dieId, phase);
    if (!currentRollContext || !currentDie) return [];

    const oldValue = currentDie.die.value;
    const newValue = rollDieValue(random);
    const events: DiceThroneEvent[] = [{
        type: 'DIE_REROLLED',
        payload: {
            dieId,
            oldValue,
            newValue,
            playerId,
            ownerId: currentDie.die.ownerId ?? getCurrentRollOwnerId(state, phase),
            target: getRerollTarget(currentRollContext.kind),
        },
        sourceCommandType,
        timestamp,
    } as DieRerolledEvent];

    if (!skipAbilityReselection && shouldRequireAbilityReselectionForCurrentRoll(state, phase)) {
        events.push({
            type: 'ABILITY_RESELECTION_REQUIRED',
            payload: {
                playerId: state.activePlayerId,
                previousAbilityId: state.pendingAttack.sourceAbilityId,
                reason: 'dieRerolled',
            },
            sourceCommandType,
            timestamp: timestamp + 1,
        } as DiceThroneEvent);
    }

    return events;
};
