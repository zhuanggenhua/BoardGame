import { withDiceThroneTutorialSurfaces } from './tutorialLayout';
import type { TutorialManifest, TutorialStepSnapshot } from '../../engine/types';
import { CHEAT_COMMANDS } from '../../engine/systems/CheatSystem';
import { MONK_CARDS } from './heroes/monk/cards';

type Step = TutorialStepSnapshot;

const read = (id: string, highlightTarget: string): Step => ({
    id, content: `game-dicethrone:tutorial.practice.${id}`, highlightTarget,
    position: highlightTarget.startsWith('hand') ? 'top' : 'left', infoStep: true,
});

const act = (id: string, highlightTarget: string, allowedCommands: string[], advanceOnEvents: Step['advanceOnEvents']): Step => ({
    id, content: `game-dicethrone:tutorial.practice.${id}`, highlightTarget,
    position: highlightTarget.startsWith('hand') ? 'top' : 'left',
    requireAction: true, allowManualSkip: false, allowedCommands, advanceOnEvents,
});

/** 独立机制练习只在首帧前建立合法代表态；主线不消费这些预设。 */
const setup = (fields: Record<string, unknown>, phase: string): Step => ({
    id: 'practice-setup', content: 'game-dicethrone:tutorial.steps.setup',
    hiddenAutomation: { kind: 'setup-precondition', reason: 'Create the declared independent mechanism practice before its first visible frame.' },
    aiActions: (() => {
        const players = (fields.players ?? {}) as Record<string, { hand?: Array<{ id: string }>; [key: string]: unknown }>;
        const handCards = Object.entries(players).flatMap(([playerId, player]) =>
            (player.hand ?? []).map(({ id }) => ({ playerId, cardId: id })),
        );
        const fieldsWithEmptyHands = {
            ...fields,
            players: Object.fromEntries(Object.entries(players).map(([playerId, player]) => [playerId, { ...player, hand: [] }])),
        };
        return [
        { commandType: 'SELECT_CHARACTER', playerId: '0', payload: { characterId: 'monk' } },
        { commandType: 'SELECT_CHARACTER', playerId: '1', payload: { characterId: 'monk' } },
        { commandType: 'PLAYER_READY', playerId: '1', payload: {} },
        { commandType: 'HOST_START_GAME', playerId: '0', payload: {} },
        { commandType: CHEAT_COMMANDS.MERGE_STATE, playerId: '0', payload: { fields: fieldsWithEmptyHands, sysFields: { phase } } },
        ...handCards.map(({ playerId, cardId }) => ({
            commandType: CHEAT_COMMANDS.ADD_CARD_TO_HAND_BY_CARD_ID,
            playerId,
            payload: { playerId, cardId },
        })),
        ];
    })(),
});

export const DiceThroneDiscardPractice: TutorialManifest = {
    id: 'dicethrone-hand-limit', playerId: '0', revision: 5, randomPolicy: { mode: 'fixed', values: [1] },
    steps: withDiceThroneTutorialSurfaces([
        setup({
            activePlayerId: '0', turnNumber: 3,
            players: {
                '0': { hand: MONK_CARDS.slice(0, 7), deck: [], discard: MONK_CARDS.slice(7), resources: { cp: 15 } },
                '1': { hand: [], deck: [...MONK_CARDS] },
            },
        }, 'discard'),
        act('limit-start', 'hand-area', ['SELL_CARD'], [{ type: 'CARD_SOLD', match: { playerId: '0' } }]),
        read('limit-result', 'player-stats'),
    ]),
};
