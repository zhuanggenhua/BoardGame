import { expect, it } from 'vitest';
import { createInitialSystemState, createSeededRandom, executePipeline } from '../../../engine';
import { createRespondToPromptCommand, getCurrentInteractionSummary } from '../../../engine/testing/interactionTestFacade';
import type { Command } from '../../../engine/types';
import { FATE_SERVANT_BY_ID } from '../data';
import { createFateAttackDeck, FateDominationDomain } from '../domain';
import { projectFatePlayerView } from '../domain/playerView';
import { engineConfig } from '../game';
import { buildFateAiLegalActions } from '../ai';
import { FATE_RIDING_CHOICE_SOURCE } from '../domain/ridingChoice';

it.each([false, true])('最后一人结束行动时才结算石化，明置特殊保护对手（含骑乘=$0）', usingRiding => {
    const playerIds = ['0', '1', '2'];
    const random = createSeededRandom('petrifying-eyes');
    const core = FateDominationDomain.setup(playerIds, random);
    let state = { core, sys: createInitialSystemState(playerIds, engineConfig.systems, 'petrifying-eyes') };
    core.phase = 'action';
    core.currentPlayerId = '0';
    core.turnOrder = playerIds;
    core.battlefield.miyama.playerIds = playerIds;
    for (const player of Object.values(core.players)) {
        player.locationId = 'miyama';
        player.mana = 12;
        player.hand = [{ id: `${player.id}-special`, definitionId: 'cardSurveil' }, { id: `${player.id}-strength`, definitionId: 'cardB1' }];
    }
    const medusa = core.players['0'];
    medusa.servantId = 'servant-medusa';
    const printed = FATE_SERVANT_BY_ID[medusa.servantId].skillCards!.find(skill => skill.id === 'sc_medusa_2')!;
    const eyes = { ...printed, id: `${printed.id}:1` };
    medusa.skills = [eyes];

    const submit = (command: Command) => {
        const result = executePipeline({ domain: FateDominationDomain, systems: engineConfig.systems }, state, command, random, playerIds);
        expect(result.success, result.error).toBe(true);
        state = result.state;
        return result.events;
    };
    const playBoth = (playerId: string, first: string, faceDownIds: string[] = []) => submit({
        type: 'CONFIRM_ATTACK', playerId, payload: { cardIds: [first, `${playerId}-strength`], faceDownIds, round: core.round },
    });
    const pass = (playerId: string) => submit({ type: 'PASS_ACTION', playerId, payload: {} });

    playBoth('0', eyes.id);
    expect(buildFateAiLegalActions({ state, playerId: '0' }).flatMap(action => action.commands))
        .toContainEqual(expect.objectContaining({ type: 'PLAY_SKILL', payload: { skillId: eyes.id } }));
    expect(submit({ type: 'PLAY_SKILL', playerId: '0', payload: { skillId: eyes.id } })
        .some(event => event.type === 'FATE_DEFEAT_DECLARED')).toBe(false);
    pass('0');
    if (usingRiding) {
        const rider = state.core.players['1'];
        rider.servantId = 'servant-rider';
        const riding = FATE_SERVANT_BY_ID[rider.servantId].skillCards!.find(skill => skill.id === 'sc_iskandar_1')!;
        const ridingId = `${riding.id}:0`;
        rider.skills = [{ ...riding, id: ridingId }];
        const deck = createFateAttackDeck(rider.id, rider.servantId);
        const basic = deck.find(card => card.definitionId === 'cardB1')!;
        const special = deck.find(card => card.definitionId === 'cardSurveil')!;
        rider.hand = [basic, special];
        rider.deck = deck.filter(card => !rider.hand.includes(card));
        submit({ type: 'CONFIRM_ATTACK', playerId: rider.id, payload: {
            cardIds: [ridingId, basic.id], faceDownIds: [], round: state.core.round,
        } });
        submit({ type: 'PLAY_SKILL', playerId: rider.id, payload: { skillId: ridingId } });
        expect(getCurrentInteractionSummary(state)).toMatchObject({ sourceId: FATE_RIDING_CHOICE_SOURCE, playerId: rider.id });
        const added = submit(createRespondToPromptCommand(state, { playerId: rider.id, optionIds: [special.id] }));
        expect(added).toContainEqual(expect.objectContaining({
            type: 'FATE_RIDING_CARDS_PLAYED', payload: expect.objectContaining({ cardIds: [special.id], manaSpent: 1 }),
        }));
        expect(state.core.players[rider.id].activeAttackIds).toContain(special.id);
    } else {
        playBoth('1', '1-special');
    }
    pass('1');
    expect(state.core.players['2'].defeatMarkers).toHaveLength(0);
    playBoth('2', '2-special', ['2-special']);
    expect(state.core.players['1'].playedSpecialAttackThisRound).toBe(true);
    expect(state.core.players['2'].playedSpecialAttackThisRound).toBe(false);
    const oldCore = structuredClone(state.core);
    delete oldCore.players['1'].playedSpecialAttackThisRound;
    delete oldCore.players['2'].playedSpecialAttackThisRound;
    const oldView = projectFatePlayerView(oldCore, '0');
    expect(oldView.players['1'].playedSpecialAttackThisRound).toBe(true);
    expect(oldView.players['2'].playedSpecialAttackThisRound).toBe(false);
    expect(oldView.players['2'].activeAttackIds).toEqual([]);
    const events = pass('2');

    expect(events.slice(0, 2).map(event => event.type)).toEqual(['FATE_DEFEAT_DECLARED', 'ACTION_PASSED']);
    expect(state.core.phase).toBe('battle');
    expect(state.core.players['1'].defeatMarkers).toHaveLength(0);
    expect(state.core.players['2'].defeatMarkers).toEqual([expect.objectContaining({ sourceId: eyes.id, direct: true })]);
    expect(state.sys.actionLog.entries.filter(entry => entry.kind === 'FATE_DEFEAT_DECLARED')).toEqual([
        expect.objectContaining({ actorId: '2', segments: [expect.objectContaining({ key: 'log.battleDefeat' })] }),
    ]);
});
