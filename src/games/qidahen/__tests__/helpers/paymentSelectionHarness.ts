import { expect } from 'vitest';
import { getQidahenDiplomacySelectionForCore, getQidahenDriveTigerConsentSelectionForCore, getQidahenDriveTigerConsentSelectionFromInteraction, getQidahenFortificationMaintenanceSelectionFromInteraction, getQidahenKhanEdictSelectionForCore, getQidahenMaShiTradeSelectionForCore, getQidahenRecruitSelectionForCore, QidahenDomain } from '../../domain';

import { QIDAHEN_COMMANDS } from '../../domain/commands';
import { getQidahenCurrentWheelDispatchSelectionForCore, getQidahenInternalDispatchSelectionForCore } from '../../domain/dispatchSelectionBuilders';
import { getQidahenGrantPardonSelectionForCore } from '../../domain/selectionBuilders';
import { syncQidahenRuntimeInteractionState } from '../../domain/runtimeInteractions';import type { QidahenCommand, QidahenCore, QidahenEvent, QidahenFactionId } from '../../domain/types';

import type { MatchState, RandomFn } from '../../../../engine/types';import { executePipeline } from '../../../../engine/pipeline';
import { createRespondToPromptCommand, getCurrentInteractionSummary } from '../../../../engine/testing/interactionTestFacade';

import { engineConfig } from '../../game';

// 只承载七大恨领域测试的合法状态构造、命令执行和提示响应夹具。
export const random = () => 0.5;

export type QidahenDiplomacySelectionSnapshot = ReturnType<typeof getQidahenDiplomacySelectionForCore>;

export const testRandom: RandomFn = {
    random: () => 0.5,
    d: () => 4,
    range: (min) => min,
    shuffle: <T>(array: T[]) => [...array],
};

export const diceSequence = (...rolls: number[]): RandomFn => {
    let cursor = 0;
    return {
        random: () => 0.5,
        d: () => rolls[cursor++] ?? 4,
        range: (min) => min,
        shuffle: <T>(array: T[]) => [...array],
    };
};

export const dieSidesRandom: RandomFn = {
    random: () => 0.5,
    d: (sides) => sides,
    range: (min) => min,
    shuffle: <T>(array: T[]) => [...array],
};

export const lindanInfluenceRegionIds = new Set([
    'city-region-1',
    'city-region-2',
    'city-region-3',
    'city-region-6',
    'city-region-8',
    'city-region-10',
    'city-region-14',
    'city-region-16',
    'city-region-17',
    'city-region-19',
    'city-region-20',
    'city-region-26',
]);

export function stateOf(core: QidahenCore): MatchState<QidahenCore> {
    const normalizedCore = core.turnPhase === 'action-window'
        ? (
            core.postBattleSelection ? { ...core, turnPhase: 'post-battle-decision' }
                : core.pendingTargetAction ? { ...core, turnPhase: 'resolve-pending' }
                    : core.wheelDispatchProgress ? { ...core, turnPhase: 'dispatch-targeting' }
                        : getDiplomacySelection(core) ? { ...core, turnPhase: 'diplomacy-choice' }
                            : core.recruitSelection ? { ...core, turnPhase: 'recruit-choice' }
                                : core.maShiTradeSelection ? { ...core, turnPhase: 'ma-shi-trade-choice' }
                                    : core.khanEdictSelection ? { ...core, turnPhase: 'khan-edict-choice' }
                                        : getQidahenDriveTigerConsentSelectionForCore(core) ? { ...core, turnPhase: 'drive-tiger-consent' }
                                            : core
        )
        : core;
    return syncQidahenRuntimeInteractionState({
        core: normalizedCore,
        sys: {} as MatchState<QidahenCore>['sys'],
    });
}

export function apply(core: QidahenCore, command: QidahenCommand, randomFn: RandomFn = testRandom): QidahenCore {
    const validation = QidahenDomain.validate(stateOf(core), command);
    expect(validation.valid).toBe(true);
    return QidahenDomain.execute(stateOf(core), command, randomFn).reduce(
        (next, event) => QidahenDomain.reduce(next, event as QidahenEvent),
        core,
    );
}

export function getFortificationMaintenanceSelection(core: QidahenCore) {
    return getQidahenFortificationMaintenanceSelectionFromInteraction(stateOf(core).sys.interaction?.current);
}

export function getDriveTigerConsentSelection(core: QidahenCore) {
    return getQidahenDriveTigerConsentSelectionFromInteraction(stateOf(core).sys.interaction?.current);
}

export function getRecruitSelection(core: QidahenCore) {
    return getQidahenRecruitSelectionForCore(core);
}

export function getGrantPardonSelection(core: QidahenCore) {
    return getQidahenGrantPardonSelectionForCore(core);
}

export function getMaShiTradeSelection(core: QidahenCore) {
    return getQidahenMaShiTradeSelectionForCore(core);
}

export function payGrantPardonAndChooseTarget(
    core: QidahenCore,
    choiceId: string,
): QidahenCore {
    expect(core.turnPhase).toBe('action-window');
    expect(core.grantPardonSelection).toBeNull();
    expect(core.payment).toMatchObject({
        required: 3,
        selected: 0,
    });
    const first = apply(core, {
        type: QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD,
        playerId: '0',
        payload: { cardId: 'hand-1' },
    });
    const second = apply(first, {
        type: QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD,
        playerId: '0',
        payload: { cardId: 'hand-2' },
    });
    const third = apply(second, {
        type: QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD,
        playerId: '0',
        payload: { cardId: 'hand-3' },
    });
    const choosingTarget = apply(third, {
        type: QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION,
        playerId: '0',
        payload: {},
    });
    expect(choosingTarget.turnPhase).toBe('grant-pardon-choice');
    expect(getGrantPardonSelection(choosingTarget)?.choices.map((choice) => choice.id)).toContain(choiceId);
    return apply(choosingTarget, {
        type: QIDAHEN_COMMANDS.RESOLVE_GRANT_PARDON_CHOICE,
        playerId: '0',
        payload: { choiceId },
    });
}

export function getKhanEdictSelection(core: QidahenCore) {
    return getQidahenKhanEdictSelectionForCore(core);
}

export function getDiplomacySelection(core: QidahenCore) {
    return getQidahenDiplomacySelectionForCore(core);
}

export function getInternalDispatchSelection(core: QidahenCore) {
    return getQidahenInternalDispatchSelectionForCore(core);
}

export function getWheelDispatchSelection(core: QidahenCore) {
    return getQidahenCurrentWheelDispatchSelectionForCore(core);
}

export function applyPipeline(
    state: MatchState<QidahenCore>,
    command: { type: string; playerId: string; payload: Record<string, unknown> },
    playerIds: string[] = ['0', '1', '2'],
) {
    return executePipeline(
        { domain: engineConfig.domain, systems: engineConfig.systems as any },
        state,
        command as any,
        testRandom,
        playerIds,
    );
}

export function getPromptSummary(state: MatchState<QidahenCore>) {
    return getCurrentInteractionSummary(state);
}

export function getPromptData<T extends Record<string, unknown>>(state: MatchState<QidahenCore>): T {
    return (state.sys.interaction?.current?.data ?? {}) as T;
}

export function getPromptSourceId(state: MatchState<QidahenCore>) {
    return getPromptSummary(state).sourceId;
}

export function respondToPrompt(
    state: MatchState<QidahenCore>,
    playerId: string,
    args: { optionId?: string; optionIds?: string[]; mergedValue?: unknown },
): MatchState<QidahenCore> {
    return applyPipeline(state, createRespondToPromptCommand(state, { playerId, ...args })).state;
}

export function expectNoPrompt(state: MatchState<QidahenCore>) {
    expect(getPromptSummary(state).id).toBeUndefined();
}

export function setFactionCharactersInPlay(
    core: QidahenCore,
    factionId: QidahenFactionId,
    characterIds: string[],
): QidahenCore {
    core.factions = {
        ...core.factions,
        [factionId]: {
            ...core.factions[factionId],
            characters: core.factions[factionId].characters.map((character) => ({
                ...character,
                inPlay: characterIds.includes(character.id),
            })),
        },
    };
    return core;
}

export function factionHandCards(core: QidahenCore, factionId: QidahenFactionId) {
    return core.handCards.filter((card) => card.faction === factionId);
}

export function keepOnlyMingHomelandFallback(core: QidahenCore, fallbackRegionId = 'song-jin'): QidahenCore {
    core.regions = core.regions.map((region) => {
        if (region.isLogicalRegion) {
            return region;
        }
        if (region.id === fallbackRegionId) {
            return {
                ...region,
                controller: 'ming',
                controlLabel: '大明',
                diplomacyMarkerFaction: null,
                diplomacyMarkerSide: null,
            };
        }
        if (region.controller === 'ming' && region.id !== fallbackRegionId) {
            return {
                ...region,
                controller: 'neutral',
                controlLabel: '中立',
                diplomacyMarkerFaction: null,
                diplomacyMarkerSide: null,
                troops: 0,
                specialTroops: [],
                cityState: region.cityState
                    ? {
                        ...region.cityState,
                        troops: 0,
                        specialTroops: [],
                    }
                    : region.cityState,
                siegeState: null,
            };
        }
        return region;
    });
    return core;
}

export function clearRuntimeBattleFixture(core: QidahenCore): QidahenCore {
    core.regions = core.regions.map((region) => {
        if (region.isLogicalRegion) {
            return region;
        }
        return {
            ...region,
            controller: 'neutral',
            controlLabel: '中立',
            diplomacyMarkerFaction: null,
            diplomacyMarkerSide: null,
            troops: 0,
            population: 0,
            specialTroops: [],
            cityState: null,
            siegeState: null,
        };
    });
    return core;
}

export function setRegionCavalry(
    core: QidahenCore,
    regionId: string,
    faction: 'ming' | 'mongol' | 'jin',
    count: number,
    level = 1,
): QidahenCore {
    const factionLabel = faction === 'ming' ? '大明' : faction === 'mongol' ? '蒙古' : '后金';
    core.regions = core.regions.map((region) => (
        region.id === regionId
            ? {
                ...region,
                controller: faction,
                controlLabel: factionLabel,
                troops: count,
                specialTroops: [
                    {
                        id: `${faction}-${regionId}-cavalry-lv${level}`,
                        label: `${factionLabel}骑兵`,
                        faction,
                        troopKind: 'cavalry',
                        count,
                        level,
                    },
                ],
            }
            : region
    ));
    return core;
}
