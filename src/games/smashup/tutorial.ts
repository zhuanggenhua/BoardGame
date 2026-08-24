/**
 * 大杀四方 (Smash Up) - 教学配置
 *
 * - 默认教程：巫师 + 机器人基础组合教学
 * - 子教程：牛仔决斗机制教学
 */

import type { TutorialCollection, TutorialManifest } from '../../engine/types';
import type { BaseInPlay, CardInstance, MinionOnBase } from './domain/types';
import { SU_COMMANDS, SU_EVENTS } from './domain/types';
import { FLOW_COMMANDS, FLOW_EVENTS } from '../../engine/systems/FlowSystem';
import { CHEAT_COMMANDS } from '../../engine/systems/CheatSystem';
import { INTERACTION_COMMANDS, INTERACTION_EVENTS } from '../../engine/systems/InteractionSystem';
import { SMASHUP_FACTION_IDS } from './domain/ids';

// ============================================================================
// 事件匹配器常量
// ============================================================================

/** 匹配进入出牌阶段 */
const MATCH_PHASE_PLAY = { type: FLOW_EVENTS.PHASE_CHANGED, match: { to: 'playCards' } };

/** 匹配进入基地记分阶段 */
const MATCH_PHASE_SCORE = { type: FLOW_EVENTS.PHASE_CHANGED, match: { to: 'scoreBases' } };

/** 匹配进入抽牌阶段 */
const MATCH_PHASE_DRAW = { type: FLOW_EVENTS.PHASE_CHANGED, match: { to: 'draw' } };

/** 匹配进入回合结束阶段 */
const MATCH_PHASE_END_TURN = { type: FLOW_EVENTS.PHASE_CHANGED, match: { to: 'endTurn' } };

/** 匹配进入回合开始阶段 */
const MATCH_PHASE_START_TURN = { type: FLOW_EVENTS.PHASE_CHANGED, match: { to: 'startTurn' } };

export {
    MATCH_PHASE_PLAY,
    MATCH_PHASE_SCORE,
    MATCH_PHASE_DRAW,
    MATCH_PHASE_END_TURN,
    MATCH_PHASE_START_TURN,
    SU_COMMANDS,
    SU_EVENTS,
    FLOW_COMMANDS,
    FLOW_EVENTS,
    CHEAT_COMMANDS,
    INTERACTION_COMMANDS,
    INTERACTION_EVENTS,
};

// ============================================================================
// 默认基础教程固定手牌（P0）
// ============================================================================

const createTutorialMinion = (
    uid: string,
    defId: string,
    owner: '0' | '1',
    basePower: number,
): MinionOnBase => ({
    uid,
    defId,
    controller: owner,
    owner,
    basePower,
    powerCounters: 0,
    powerModifier: 0,
    tempPowerModifier: 0,
    talentUsed: false,
    attachedActions: [],
});

const TUTORIAL_HAND_P0: CardInstance[] = [
    { uid: 'tut-chrono', defId: 'wizard_chronomage', type: 'minion', owner: '0' },
    { uid: 'tut-summon', defId: 'wizard_summon', type: 'action', owner: '0' },
    { uid: 'tut-zapbot', defId: 'robot_zapbot', type: 'minion', owner: '0' },
    { uid: 'tut-tech', defId: 'robot_tech_center', type: 'action', owner: '0' },
];

const TUTORIAL_DECK_P0: CardInstance[] = [
    { uid: 'tut-hoverbot', defId: 'robot_hoverbot', type: 'minion', owner: '0' },
    { uid: 'tut-enchantress', defId: 'wizard_enchantress', type: 'minion', owner: '0' },
    { uid: 'tut-fixer', defId: 'robot_microbot_fixer', type: 'minion', owner: '0' },
];

const TUTORIAL_BASES: BaseInPlay[] = [
    {
        defId: 'base_central_brain',
        minions: [
            createTutorialMinion('enemy-brain-1', 'robot_microbot_alpha', '1', 1),
            createTutorialMinion('enemy-brain-2', 'robot_zapbot', '1', 2),
        ],
        ongoingActions: [],
        buriedCards: [],
    },
    {
        defId: 'base_great_library',
        minions: [
            createTutorialMinion('enemy-library-1', 'wizard_enchantress', '1', 2),
        ],
        ongoingActions: [],
        buriedCards: [],
    },
];

// ============================================================================
// 默认基础教程
// ============================================================================

export const SMASH_UP_BASIC_TUTORIAL: TutorialManifest = {
    id: 'smashup-basic',
    randomPolicy: { mode: 'fixed', values: [1] },
    steps: [
        {
            id: 'setup',
            content: 'game-smashup:tutorial.steps.setup',
            position: 'center',
            requireAction: false,
            showMask: true,
            aiActions: [
                { commandType: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.WIZARDS } },
                { commandType: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.PIRATES } },
                { commandType: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.NINJAS } },
                { commandType: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.ROBOTS } },
                {
                    commandType: CHEAT_COMMANDS.MERGE_STATE,
                    payload: {
                        fields: {
                            turnOrder: ['0', '1'],
                            currentPlayerIndex: 0,
                            turnNumber: 1,
                            nextUid: 5000,
                            bases: TUTORIAL_BASES,
                            baseDeck: [
                                { defId: 'base_wizard_academy', minions: [], ongoingActions: [], buriedCards: [] },
                                { defId: 'base_the_factory', minions: [], ongoingActions: [], buriedCards: [] },
                            ],
                            deckQueryEnabled: true,
                            players: {
                                '0': {
                                    hand: TUTORIAL_HAND_P0,
                                    deck: TUTORIAL_DECK_P0,
                                    discard: [],
                                    minionsPlayed: 0,
                                    minionLimit: 1,
                                    actionsPlayed: 0,
                                    actionLimit: 1,
                                },
                                '1': {
                                    hand: [],
                                    deck: [],
                                    discard: [],
                                    minionsPlayed: 0,
                                    minionLimit: 1,
                                    actionsPlayed: 0,
                                    actionLimit: 1,
                                },
                            },
                        },
                    },
                },
            ],
        },
        {
            id: 'welcome',
            content: 'game-smashup:tutorial.steps.welcome',
            highlightTarget: 'su-base-area',
            position: 'bottom',
            infoStep: true,
        },
        {
            id: 'scoreboard',
            content: 'game-smashup:tutorial.steps.scoreboard',
            highlightTarget: 'su-scoreboard',
            position: 'left',
            infoStep: true,
        },
        {
            id: 'opponentView',
            content: 'game-smashup:tutorial.steps.opponentView',
            highlightTarget: 'su-scoreboard',
            position: 'left',
            infoStep: true,
        },
        {
            id: 'deckDiscardIntro',
            content: 'game-smashup:tutorial.steps.deckDiscardIntro',
            highlightTarget: 'su-deck-discard',
            position: 'top',
            infoStep: true,
        },
        {
            id: 'handIntro',
            content: 'game-smashup:tutorial.steps.handIntro',
            highlightTarget: 'su-hand-area',
            position: 'top',
            infoStep: true,
        },
        {
            id: 'turnTracker',
            content: 'game-smashup:tutorial.steps.turnTracker',
            highlightTarget: 'su-turn-tracker',
            position: 'right',
            infoStep: true,
        },
        {
            id: 'endTurnBtn',
            content: 'game-smashup:tutorial.steps.endTurnBtn',
            highlightTarget: 'su-end-turn-btn',
            position: 'left',
            infoStep: true,
        },
        {
            id: 'playCardsExplain',
            content: 'game-smashup:tutorial.steps.playCardsExplain',
            highlightTarget: 'su-hand-area',
            position: 'top',
            infoStep: true,
        },
        {
            id: 'playChronomage',
            content: 'game-smashup:tutorial.steps.playChronomage',
            highlightTarget: 'su-hand-area',
            position: 'top',
            requireAction: true,
            allowedCommands: [SU_COMMANDS.PLAY_MINION],
            allowedTargets: ['tut-chrono'],
            advanceOnEvents: [{ type: SU_EVENTS.MINION_PLAYED }],
        },
        {
            id: 'playSummon',
            content: 'game-smashup:tutorial.steps.playSummon',
            highlightTarget: 'su-hand-area',
            position: 'top',
            requireAction: true,
            allowedCommands: [SU_COMMANDS.PLAY_ACTION],
            allowedTargets: ['tut-summon'],
            advanceOnEvents: [{ type: SU_EVENTS.ACTION_PLAYED }],
        },
        {
            id: 'extraZapbot',
            content: 'game-smashup:tutorial.steps.extraZapbot',
            highlightTarget: 'su-hand-area',
            position: 'top',
            requireAction: true,
            allowedCommands: [SU_COMMANDS.PLAY_MINION],
            allowedTargets: ['tut-zapbot'],
            advanceOnEvents: [{ type: SU_EVENTS.MINION_PLAYED }],
        },
        {
            id: 'comboBoardRead',
            content: 'game-smashup:tutorial.steps.comboBoardRead',
            highlightTarget: 'su-base-area',
            position: 'bottom',
            infoStep: true,
        },
        {
            id: 'playTechCenter',
            content: 'game-smashup:tutorial.steps.playTechCenter',
            highlightTarget: 'su-hand-area',
            position: 'top',
            requireAction: true,
            allowedCommands: [SU_COMMANDS.PLAY_ACTION],
            allowedTargets: ['tut-tech'],
            advanceOnEvents: [
                {
                    type: INTERACTION_EVENTS.RESOLVED,
                    match: { sourceId: 'robot_tech_center', playerId: '0' },
                },
            ],
        },
        {
            id: 'deckAfterDraw',
            content: 'game-smashup:tutorial.steps.deckAfterDraw',
            highlightTarget: 'su-deck-discard',
            position: 'top',
            infoStep: true,
        },
        {
            id: 'endPlayCards',
            content: 'game-smashup:tutorial.steps.endPlayCards',
            highlightTarget: 'su-end-turn-btn',
            position: 'left',
            requireAction: true,
            allowedCommands: [FLOW_COMMANDS.ADVANCE_PHASE],
            advanceOnEvents: [MATCH_PHASE_SCORE],
        },
        {
            id: 'baseScoring',
            content: 'game-smashup:tutorial.steps.baseScoring',
            position: 'center',
            infoStep: true,
        },
        {
            id: 'vpAwards',
            content: 'game-smashup:tutorial.steps.vpAwards',
            highlightTarget: 'su-scoreboard',
            position: 'left',
            infoStep: true,
        },
        {
            id: 'scoringPhase',
            content: 'game-smashup:tutorial.steps.scoringPhase',
            position: 'center',
            requireAction: false,
            showMask: true,
        },
        {
            id: 'drawExplain',
            content: 'game-smashup:tutorial.steps.drawExplain',
            highlightTarget: 'su-deck-discard',
            position: 'top',
            infoStep: true,
        },
        {
            id: 'handLimit',
            content: 'game-smashup:tutorial.steps.handLimit',
            position: 'center',
            infoStep: true,
        },
        {
            id: 'endDraw',
            content: 'game-smashup:tutorial.steps.endDraw',
            position: 'center',
            infoStep: true,
        },
        {
            id: 'opponentTurn',
            content: 'game-smashup:tutorial.steps.opponentTurn',
            position: 'center',
            requireAction: false,
            showMask: true,
            viewAs: '1',
            aiActions: [
                { commandType: FLOW_COMMANDS.ADVANCE_PHASE, payload: undefined, playerId: '1' },
            ],
            advanceOnEvents: [
                { type: SU_EVENTS.TURN_STARTED, match: { playerId: '0' } },
            ],
        },
        {
            id: 'turnCycle',
            content: 'game-smashup:tutorial.steps.turnCycle',
            position: 'center',
            requireAction: false,
        },
        {
            id: 'summary',
            content: 'game-smashup:tutorial.steps.summary',
            position: 'center',
            requireAction: false,
        },
        {
            id: 'finish',
            content: 'game-smashup:tutorial.steps.finish',
            highlightTarget: 'su-base-area',
            position: 'bottom',
            infoStep: true,
        },
    ],
};

// ============================================================================
// 牛仔决斗子教程固定场面
// ============================================================================

const COWBOYS_DUEL_HAND_P0: CardInstance[] = [
    { uid: 'gun-1', defId: 'cowboys_gunfighter', type: 'minion', owner: '0' },
    { uid: 'deputy-1', defId: 'cowboys_deputy', type: 'minion', owner: '0' },
];

const COWBOYS_DUEL_DECK_P0: CardInstance[] = [
    { uid: 'duel-draw-filler-1', defId: 'robot_microbot_alpha', type: 'minion', owner: '0' },
];

const COWBOYS_DUEL_BASES: BaseInPlay[] = [
    {
        defId: 'base_saloon',
        minions: [
            createTutorialMinion('pink-1', 'cowboys_pinkerton', '0', 4),
            createTutorialMinion('enemy-1', 'robot_microbot_alpha', '1', 1),
        ],
        ongoingActions: [],
        buriedCards: [],
    },
];

export const SMASH_UP_COWBOYS_DUEL_TUTORIAL: TutorialManifest = {
    id: 'smashup-cowboys-duel',
    randomPolicy: { mode: 'fixed', values: [1] },
    steps: [
        {
            id: 'setup',
            content: 'game-smashup:tutorial.subTutorials.cowboysDuel.steps.setup',
            position: 'center',
            requireAction: false,
            showMask: true,
            aiActions: [
                { commandType: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.COWBOYS } },
                { commandType: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.SAMURAI } },
                { commandType: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.VIKINGS } },
                { commandType: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.ROBOTS } },
                {
                    commandType: CHEAT_COMMANDS.MERGE_STATE,
                    payload: {
                        fields: {
                            turnOrder: ['0', '1'],
                            currentPlayerIndex: 0,
                            turnNumber: 1,
                            nextUid: 6000,
                            bases: COWBOYS_DUEL_BASES,
                            activeDuel: undefined,
                            players: {
                                '0': {
                                    hand: COWBOYS_DUEL_HAND_P0,
                                    deck: COWBOYS_DUEL_DECK_P0,
                                    discard: [],
                                    minionsPlayed: 0,
                                    minionLimit: 1,
                                    actionsPlayed: 0,
                                    actionLimit: 1,
                                },
                                '1': {
                                    hand: [],
                                    deck: [],
                                    discard: [],
                                    minionsPlayed: 0,
                                    minionLimit: 1,
                                    actionsPlayed: 0,
                                    actionLimit: 1,
                                },
                            },
                        },
                    },
                },
            ],
        },
        {
            id: 'duelIntro',
            content: 'game-smashup:tutorial.subTutorials.cowboysDuel.steps.duelIntro',
            highlightTarget: 'su-base-area',
            position: 'bottom',
            infoStep: true,
        },
        {
            id: 'playGunfighter',
            content: 'game-smashup:tutorial.subTutorials.cowboysDuel.steps.playGunfighter',
            highlightTarget: 'su-hand-area',
            position: 'top',
            requireAction: true,
            allowedCommands: [SU_COMMANDS.PLAY_MINION],
            allowedTargets: ['gun-1', 'enemy-1'],
            advanceOnEvents: [
                {
                    type: INTERACTION_EVENTS.RESOLVED,
                    match: { sourceId: 'cowboys_gunfighter', playerId: '0' },
                },
            ],
        },
        {
            id: 'pecosBillWindow',
            content: 'game-smashup:tutorial.subTutorials.cowboysDuel.steps.pecosBillWindow',
            highlightTarget: 'su-hand-prompt-skip-option',
            position: 'left',
            requireAction: true,
            advanceOnEvents: [
                {
                    type: INTERACTION_EVENTS.RESOLVED,
                    match: { sourceId: 'titan_pecos_bill_duel_start', playerId: '0' },
                },
            ],
        },
        {
            id: 'pinkertonCounter',
            content: 'game-smashup:tutorial.subTutorials.cowboysDuel.steps.pinkertonCounter',
            highlightTarget: 'su-base-area',
            position: 'bottom',
            requireAction: true,
            advanceOnEvents: [
                {
                    type: INTERACTION_EVENTS.RESOLVED,
                    match: { sourceId: 'smashup_duel_pinkerton', playerId: '0' },
                },
            ],
        },
        {
            id: 'duelCard',
            content: 'game-smashup:tutorial.subTutorials.cowboysDuel.steps.duelCard',
            highlightTarget: 'su-hand-prompt-skip-option',
            position: 'left',
            requireAction: true,
            advanceOnEvents: [
                {
                    type: INTERACTION_EVENTS.RESOLVED,
                    match: { sourceId: 'smashup_duel_card', playerId: '0' },
                },
            ],
        },
        {
            id: 'opponentDuelCard',
            content: 'game-smashup:tutorial.subTutorials.cowboysDuel.steps.opponentDuelCard',
            position: 'center',
            requireAction: false,
            showMask: true,
            aiActions: [
                {
                    commandType: INTERACTION_COMMANDS.RESPOND,
                    playerId: '1',
                    payload: { optionId: 'skip' },
                },
            ],
            advanceOnEvents: [
                {
                    type: INTERACTION_EVENTS.RESOLVED,
                    match: { sourceId: 'smashup_duel_card', playerId: '1' },
                },
            ],
        },
        {
            id: 'deputyBoost',
            content: 'game-smashup:tutorial.subTutorials.cowboysDuel.steps.deputyBoost',
            highlightTarget: 'su-hand-area',
            position: 'top',
            requireAction: true,
            allowedTargets: ['deputy-1', 'gun-1'],
            advanceOnEvents: [
                {
                    type: INTERACTION_EVENTS.RESOLVED,
                    match: { sourceId: 'smashup_duel_deputy_target', playerId: '0' },
                },
            ],
        },
        {
            id: 'finish',
            content: 'game-smashup:tutorial.subTutorials.cowboysDuel.steps.finish',
            highlightTarget: 'su-base-area',
            position: 'bottom',
            infoStep: true,
        },
    ],
};

export const SMASH_UP_TUTORIAL_CATALOG: TutorialCollection = {
    defaultTutorialId: 'smashup-basic',
    tutorials: {
        'smashup-basic': {
            manifest: SMASH_UP_BASIC_TUTORIAL,
        },
        'cowboys-duel': {
            titleKey: 'tutorial.subTutorials.cowboysDuel.title',
            descriptionKey: 'tutorial.subTutorials.cowboysDuel.description',
            manifest: SMASH_UP_COWBOYS_DUEL_TUTORIAL,
        },
    },
};

export default SMASH_UP_TUTORIAL_CATALOG;
