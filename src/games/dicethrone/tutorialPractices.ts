import { withDiceThroneTutorialSurfaces } from './tutorialLayout';
import type { TutorialAiAction, TutorialManifest, TutorialStepSnapshot } from '../../engine/types';
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

const card = (id: string) => {
    const result = MONK_CARDS.find(card => card.id === id);
    if (!result) throw new Error(`Unknown Dice Throne tutorial card: ${id}`);
    return result;
};

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

const observe = (id: string, aiActions: TutorialAiAction[]): Step => ({
    id, content: `game-dicethrone:tutorial.practice.${id}`, position: 'center',
    requireAction: false, allowManualSkip: true, autoAdvanceAfterAi: false, aiActions,
});

export const DiceThroneResponsePractice: TutorialManifest = {
    id: 'dicethrone-response', playerId: '0', revision: 2, randomPolicy: { mode: 'fixed', values: [1] },
    stepValidator: (state, step) => step.id !== 'interference-pass' || Boolean(state.sys.responseWindow?.current),
    steps: withDiceThroneTutorialSurfaces([
        setup({
            activePlayerId: '1', turnNumber: 2,
            players: {
                '0': { hand: [card('card-boss-generous'), card('card-give-hand')], deck: MONK_CARDS.filter(c => !['card-boss-generous', 'card-give-hand'].includes(c.id)), resources: { cp: 2 } },
                '1': { hand: [], deck: [...MONK_CARDS] },
            },
        }, 'main1'),
        read('response-start', 'phase-indicator'),
        read('instant-rule', 'hand-card-card-boss-generous'),
        act('instant-play', 'hand-card-card-boss-generous', ['PLAY_CARD'], [{ type: 'CARD_PLAYED', match: { playerId: '0', cardId: 'card-boss-generous' } }]),
        read('instant-result', 'player-stats'),
        { ...observe('opponent-declares', [
            { commandType: 'ADVANCE_PHASE', playerId: '1', payload: {} },
            { commandType: 'ROLL_DICE', playerId: '1', payload: {} },
            { commandType: 'CONFIRM_ROLL', playerId: '1', payload: {} },
        ]), randomPolicy: { mode: 'fixed', values: [6] } },
        read('ultimate-prevention', 'dice-tray'),
        read('interference-rule', 'hand-card-card-give-hand'),
        act('interference-play', 'hand-card-card-give-hand', ['PLAY_CARD'], [{ type: 'CARD_PLAYED', match: { playerId: '0', cardId: 'card-give-hand' } }]),
        { ...act('interference-target', 'dice-tray', [], []), allowManualSkip: false },
        act('interference-confirm', 'dice-tray', ['REROLL_DIE', 'SYS_INTERACTION_CONFIRM'], [{ type: 'SYS_INTERACTION_CONFIRMED' }]),
        read('interference-result', 'dice-tray'),
        act('interference-pass', 'response-pass-button', ['RESPONSE_PASS'], [{ type: 'RESPONSE_WINDOW_CLOSED' }]),
        observe('response-finish', [
            { commandType: 'CONFIRM_ROLL', playerId: '1', payload: {} },
            { commandType: 'SELECT_ABILITY', playerId: '1', payload: { abilityId: 'lotus-palm' } },
        ]),
    ]),
};

export const DiceThroneDiscardPractice: TutorialManifest = {
    id: 'dicethrone-hand-limit', playerId: '0', revision: 2, randomPolicy: { mode: 'fixed', values: [1] },
    steps: withDiceThroneTutorialSurfaces([
        setup({
            activePlayerId: '0', turnNumber: 3,
            players: {
                '0': { hand: MONK_CARDS.slice(0, 7), deck: [], discard: MONK_CARDS.slice(7), resources: { cp: 14 } },
                '1': { hand: [], deck: [...MONK_CARDS] },
            },
        }, 'discard'),
        read('limit-start', 'hand-area'),
        read('limit-rule', 'hand-area'),
        act('limit-discard', 'hand-area', ['SELL_CARD'], [{ type: 'CARD_SOLD', match: { playerId: '0' } }]),
        read('limit-result', 'player-stats'),
        read('limit-end', 'phase-indicator'),
        observe('limit-opponent', [
            { commandType: 'ADVANCE_PHASE', playerId: '1', payload: {} },
            { commandType: 'ADVANCE_PHASE', playerId: '1', payload: {} },
            { commandType: 'ADVANCE_PHASE', playerId: '1', payload: {} },
            { commandType: 'ADVANCE_PHASE', playerId: '1', payload: {} },
        ]),
        read('reshuffle-result', 'hand-area'),
        read('limit-finish', 'player-stats'),
    ]),
};

export const DiceThroneUltimatePractice: TutorialManifest = {
    id: 'dicethrone-ultimate', playerId: '0', revision: 3, randomPolicy: { mode: 'fixed', values: [6] },
    steps: withDiceThroneTutorialSurfaces([
        setup({
            activePlayerId: '0', turnNumber: 5,
            players: { '0': { hand: [], deck: [...MONK_CARDS] }, '1': { hand: [], deck: [...MONK_CARDS], resources: { hp: 5 } } },
        }, 'main1'),
        read('ultimate-start', 'phase-indicator'),
        act('ultimate-advance', 'advance-phase-button', ['ADVANCE_PHASE'], [{ type: 'SYS_PHASE_CHANGED', match: { to: 'offensiveRoll' } }]),
        act('ultimate-roll', 'dice-roll-button', ['ROLL_DICE'], [{ type: 'DICE_ROLLED' }]),
        read('ultimate-rule', 'dice-tray'),
        act('ultimate-confirm', 'dice-confirm-button', ['CONFIRM_ROLL'], [{ type: 'ROLL_CONFIRMED' }]),
        { ...act('ultimate-select', 'ability-slot-ultimate', ['SELECT_ABILITY'], [{ type: 'ABILITY_ACTIVATED' }]), position: 'top', tooltipMaxWidth: 330 },
        read('ultimate-lock-rule', 'phase-indicator'),
        act('ultimate-resolve', 'advance-phase-button', ['ADVANCE_PHASE'], [{ type: 'DAMAGE_DEALT' }]),
        read('ultimate-finish', 'opponent-health'),
    ]),
};

export const DiceThroneDamagePractice: TutorialManifest = {
    id: 'dicethrone-damage', playerId: '0', revision: 2, randomPolicy: { mode: 'fixed', values: [1] },
    steps: withDiceThroneTutorialSurfaces([
        setup({
            activePlayerId: '0', turnNumber: 3, taijiGainedThisTurn: { '0': 0, '1': 0 },
            players: {
                '0': { hand: [], deck: [...MONK_CARDS], tokens: { taiji: 3 } },
                '1': { hand: [], deck: [...MONK_CARDS], tokens: { evasive: 1 } },
            },
        }, 'main1'),
        read('damage-start', 'status-tokens'),
        act('damage-advance', 'advance-phase-button', ['ADVANCE_PHASE'], [{ type: 'SYS_PHASE_CHANGED', match: { to: 'offensiveRoll' } }]),
        { ...act('damage-roll', 'dice-roll-button', ['ROLL_DICE'], [{ type: 'DICE_ROLLED' }]), randomPolicy: { mode: 'sequence', values: [6, 6, 6, 6, 1] } },
        act('damage-confirm', 'dice-confirm-button', ['CONFIRM_ROLL'], [{ type: 'ROLL_CONFIRMED' }]),
        read('undefendable-rule', 'ability-slot-lightning'),
        act('damage-select', 'ability-slot-lightning', ['SELECT_ABILITY'], [{ type: 'ABILITY_ACTIVATED' }]),
        act('damage-resolve', 'advance-phase-button', ['ADVANCE_PHASE'], [{ type: 'TOKEN_RESPONSE_REQUESTED' }]),
        read('boost-rule', 'status-tokens'),
        act('boost-use', 'status-tokens', ['USE_TOKEN'], [{ type: 'TOKEN_USED', match: { playerId: '0', tokenId: 'taiji' } }]),
        act('boost-pass', 'response-pass-button', ['USE_TOKEN', 'SKIP_TOKEN_RESPONSE', 'SYS_INTERACTION_RESPOND', 'SYS_INTERACTION_CONFIRM'], [{ type: 'TOKEN_RESPONSE_REQUESTED' }]),
        observe('opponent-evades', [
            { commandType: 'USE_TOKEN', playerId: '1', payload: { __tutorialChoiceCandidateId: 'use-token:evasive:1' }, waitForBoardSyncAfter: true },
            { commandType: 'SKIP_TOKEN_RESPONSE', playerId: '1', payload: { __tutorialChoiceCandidateId: 'skip' }, waitForBoardSyncAfter: true },
        ]),
        read('cap-result', 'status-tokens'),
        { id: 'pure-rule', content: 'game-dicethrone:tutorial.practice.pure-rule', position: 'center', tooltipMaxWidth: 400, infoStep: true },
        { id: 'collateral-rule', content: 'game-dicethrone:tutorial.practice.collateral-rule', position: 'center', tooltipMaxWidth: 400, infoStep: true },
        read('damage-finish', 'opponent-health'),
    ]),
};

export const DiceThroneUpgradePractice: TutorialManifest = {
    id: 'dicethrone-upgrade', playerId: '0', revision: 1, randomPolicy: { mode: 'fixed', values: [1] },
    steps: withDiceThroneTutorialSurfaces([
        setup({ activePlayerId: '0', turnNumber: 3, players: {
            '0': { hand: [card('card-meditation-2'), card('card-meditation-3')], deck: MONK_CARDS.filter(c => !['card-meditation-2', 'card-meditation-3'].includes(c.id)), resources: { cp: 6 } },
            '1': { hand: [], deck: [...MONK_CARDS] },
        } }, 'main1'),
        read('upgrade-start', 'hand-area'),
        act('upgrade-two', 'hand-card-card-meditation-2', ['PLAY_UPGRADE_CARD'], [{ type: 'ABILITY_REPLACED', match: { playerId: '0' } }]),
        read('upgrade-two-result', 'ability-slot-meditate'),
        read('upgrade-three-rule', 'hand-card-card-meditation-3'),
        act('upgrade-three', 'hand-card-card-meditation-3', ['PLAY_UPGRADE_CARD'], [{ type: 'ABILITY_REPLACED', match: { playerId: '0' } }]),
        read('upgrade-three-result', 'ability-slot-meditate'),
        read('upgrade-finish', 'player-stats'),
    ]),
};

export const DiceThroneStraightPractice: TutorialManifest = {
    id: 'dicethrone-straight', playerId: '0', revision: 1, randomPolicy: { mode: 'fixed', values: [1] },
    stepValidator: (state, step) => {
        const core = state.core as import('./domain/types').DiceThroneCore;
        if (step.id === 'straight-large-result') return (core.players['0'].tokens.evasive ?? 0) > 0;
        if (step.id === 'straight-small-result') return (core.players['0'].tokens.evasive ?? 0) === 0;
        return true;
    },
    steps: withDiceThroneTutorialSurfaces([
        setup({ activePlayerId: '0', turnNumber: 3, players: {
            '0': { hand: [], deck: [...MONK_CARDS] }, '1': { hand: [], deck: [...MONK_CARDS] },
        } }, 'main1'),
        read('straight-start', 'phase-indicator'),
        act('straight-advance', 'advance-phase-button', ['ADVANCE_PHASE'], [{ type: 'SYS_PHASE_CHANGED', match: { to: 'offensiveRoll' } }]),
        { ...act('straight-roll', 'dice-roll-button', ['ROLL_DICE'], [{ type: 'DICE_ROLLED' }]), randomPolicy: { mode: 'sequence', values: [1, 2, 3, 4, 5] } },
        read('straight-rule', 'dice-tray'),
        act('straight-confirm', 'dice-confirm-button', ['CONFIRM_ROLL'], [{ type: 'ROLL_CONFIRMED' }]),
        act('straight-select', 'ability-slot-calm', ['SELECT_ABILITY'], [{ type: 'ABILITY_ACTIVATED' }]),
        act('straight-resolve', 'advance-phase-button', ['ADVANCE_PHASE'], [{ type: 'SYS_PHASE_CHANGED', match: { to: 'defensiveRoll' } }]),
        observe('straight-defense', [
            { commandType: 'ROLL_DICE', playerId: '1', payload: {} },
            { commandType: 'CONFIRM_ROLL', playerId: '1', payload: {} },
            { commandType: 'ADVANCE_PHASE', playerId: '1', payload: {} },
        ]),
        read('straight-large-result', 'status-tokens'),
        read('straight-small-result', 'status-tokens'),
        read('straight-finish', 'player-stats'),
    ]),
};

export const DiceThroneKnockdownPractice: TutorialManifest = {
    id: 'dicethrone-knockdown', playerId: '0', revision: 1, randomPolicy: { mode: 'fixed', values: [1] },
    stepValidator: (state, step) => {
        if (['knockdown-pay', 'knockdown-paid-result', 'knockdown-enter'].includes(step.id)) return state.sys.phase === 'main1';
        const core = state.core as import('./domain/types').DiceThroneCore;
        if (step.id.startsWith('no-ability-')) return core.players['0'].resources.cp === 0;
        if (step.id === 'knockdown-skip-result') return state.sys.phase === 'main2' && core.players['0'].resources.cp === 2;
        return true;
    },
    steps: withDiceThroneTutorialSurfaces([
        setup({ activePlayerId: '0', turnNumber: 3, players: {
            '0': { hand: [], deck: [...MONK_CARDS], resources: { cp: 2 }, statusEffects: { knockdown: 1 } },
            '1': { hand: [], deck: [...MONK_CARDS] },
        } }, 'main1'),
        read('knockdown-start', 'status-tokens'),
        { ...act('knockdown-choice', 'status-tokens', ['ADVANCE_PHASE'], [{ type: 'SYS_PHASE_CHANGED', match: { to: 'main2' } }]), allowManualSkip: true },
        act('knockdown-pay', 'knockdown-pay-button', ['PAY_TO_REMOVE_KNOCKDOWN'], [{ type: 'STATUS_REMOVED', match: { targetId: '0', statusId: 'knockdown' } }]),
        read('knockdown-paid-result', 'player-stats'),
        act('knockdown-enter', 'advance-phase-button', ['ADVANCE_PHASE'], [{ type: 'SYS_PHASE_CHANGED', match: { to: 'offensiveRoll' } }]),
        read('no-ability-rule', 'dice-tray'),
        act('no-ability-roll', 'dice-roll-button', ['ROLL_DICE'], [{ type: 'DICE_ROLLED' }]),
        act('no-ability-confirm', 'dice-confirm-button', ['CONFIRM_ROLL'], [{ type: 'ROLL_CONFIRMED' }]),
        act('no-ability-pass', 'advance-phase-button', ['ADVANCE_PHASE'], []),
        act('no-ability-confirm-pass', 'skip-ability-confirm', ['ADVANCE_PHASE'], [{ type: 'SYS_PHASE_CHANGED', match: { to: 'main2' } }]),
        read('no-ability-result', 'player-stats'),
        read('knockdown-skip-result', 'phase-indicator'),
        read('knockdown-finish', 'phase-indicator'),
    ]),
};
