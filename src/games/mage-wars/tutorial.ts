import type { TutorialAiAction, TutorialCollection, TutorialManifest } from '../../engine/types';
import { FLOW_COMMANDS } from '../../engine/systems/FlowSystem';
import { MAGE_WARS_COMMANDS, MAGE_WARS_EVENTS } from './domain';

const JUNGLE_WOLF_CARD_ID = 2819;
const ROUSE_THE_BEAST_CARD_ID = 3403;
const ASYRAN_CLERIC_CARD_ID = 2811;
const PILLAR_OF_LIGHT_CARD_ID = 1706;
const PLAYER_ONE_CLERIC_OBJECT_ID = 'mwobj-1-2811-1';

const advancePhase = (playerId: string): TutorialAiAction => ({
    commandType: FLOW_COMMANDS.ADVANCE_PHASE,
    playerId,
    payload: {},
});

export const MageWarsTutorial: TutorialManifest = {
    id: 'mage-wars-basic',
    numPlayers: 2,
    allowManualSkip: true,
    randomPolicy: {
        mode: 'fixed',
        values: [3],
    },
    steps: [
        {
            id: 'intro',
            content: 'game-mage-wars:tutorial.steps.intro',
            highlightTarget: 'mw-board',
            position: 'center',
            showMask: true,
            infoStep: true,
        },
        {
            id: 'self-hud',
            content: 'game-mage-wars:tutorial.steps.selfHud',
            highlightTarget: 'mw-self-hud',
            position: 'right',
            infoStep: true,
        },
        {
            id: 'opponent-hud',
            content: 'game-mage-wars:tutorial.steps.opponentHud',
            highlightTarget: 'mw-opponent-hud',
            position: 'left',
            infoStep: true,
        },
        {
            id: 'stage',
            content: 'game-mage-wars:tutorial.steps.stage',
            highlightTarget: 'mw-stage',
            position: 'bottom',
            infoStep: true,
        },
        {
            id: 'channel-result',
            content: 'game-mage-wars:tutorial.steps.channelResult',
            highlightTarget: 'mw-self-hud',
            position: 'right',
            infoStep: true,
        },
        {
            id: 'plan-open-creature-category',
            content: 'game-mage-wars:tutorial.steps.planOpenCreatureCategory',
            highlightTarget: 'mw-spellbook-category-creature',
            position: 'top',
            requireAction: true,
            allowedCommands: [],
            allowedTargets: ['mw-spellbook-category-creature'],
        },
        {
            id: 'plan-creature-next-page',
            content: 'game-mage-wars:tutorial.steps.planCreatureNextPage',
            highlightTarget: 'mw-spellbook-next-page',
            position: 'top',
            requireAction: true,
            allowedCommands: [],
            allowedTargets: ['mw-spellbook-next-page'],
        },
        {
            id: 'plan-select-wolf',
            content: 'game-mage-wars:tutorial.steps.planSelectWolf',
            highlightTarget: `mw-spellbook-card-${JUNGLE_WOLF_CARD_ID}`,
            position: 'top',
            requireAction: true,
            allowedCommands: [],
            allowedTargets: [`mw-spellbook-card-${JUNGLE_WOLF_CARD_ID}`],
        },
        {
            id: 'plan-open-incantation-category',
            content: 'game-mage-wars:tutorial.steps.planOpenIncantationCategory',
            highlightTarget: 'mw-spellbook-category-incantation',
            position: 'top',
            requireAction: true,
            allowedCommands: [],
            allowedTargets: ['mw-spellbook-category-incantation'],
        },
        {
            id: 'plan-select-rouse',
            content: 'game-mage-wars:tutorial.steps.planSelectRouse',
            highlightTarget: `mw-spellbook-card-${ROUSE_THE_BEAST_CARD_ID}`,
            position: 'top',
            requireAction: true,
            allowedCommands: [],
            allowedTargets: [`mw-spellbook-card-${ROUSE_THE_BEAST_CARD_ID}`],
        },
        {
            id: 'plan-confirm',
            content: 'game-mage-wars:tutorial.steps.planConfirm',
            highlightTarget: 'mw-plan-spells',
            position: 'top',
            requireAction: true,
            allowedCommands: [MAGE_WARS_COMMANDS.PLAN_SPELLS],
            allowedTargets: ['mw-plan-spells'],
            advanceOnEvents: [{ type: MAGE_WARS_EVENTS.SPELLS_PLANNED, match: { playerId: '0' } }],
        },
        {
            id: 'prepare-opponent-spells',
            content: 'game-mage-wars:tutorial.steps.prepareOpponentSpells',
            allowedCommands: [MAGE_WARS_COMMANDS.PLAN_SPELLS],
            aiActions: [{
                commandType: MAGE_WARS_COMMANDS.PLAN_SPELLS,
                playerId: '1',
                payload: { spellCardIds: [ASYRAN_CLERIC_CARD_ID, PILLAR_OF_LIGHT_CARD_ID] },
            }],
        },
        {
            id: 'prepared-and-hidden',
            content: 'game-mage-wars:tutorial.steps.preparedAndHidden',
            highlightTarget: 'mw-opponent-prepared',
            position: 'right',
            infoStep: true,
        },
        {
            id: 'deploy-select-wolf',
            content: 'game-mage-wars:tutorial.steps.deploySelectWolf',
            highlightTarget: `mw-prepared-card-${JUNGLE_WOLF_CARD_ID}`,
            position: 'top',
            requireAction: true,
            allowedCommands: [MAGE_WARS_COMMANDS.CAST_SPELL],
            allowedTargets: [`mw-prepared-card-${JUNGLE_WOLF_CARD_ID}`],
        },
        {
            id: 'deploy-target-zone',
            content: 'game-mage-wars:tutorial.steps.deployTargetZone',
            highlightTarget: 'mw-zone-a3',
            position: 'top',
            requireAction: true,
            allowedCommands: [MAGE_WARS_COMMANDS.CAST_SPELL],
            allowedTargets: ['mw-zone-a3'],
            advanceOnEvents: [{ type: MAGE_WARS_EVENTS.ARENA_OBJECT_SUMMONED }],
        },
        {
            id: 'wolf-summoned',
            content: 'game-mage-wars:tutorial.steps.wolfSummoned',
            highlightTarget: `mw-field-object-${JUNGLE_WOLF_CARD_ID}`,
            position: 'top',
            infoStep: true,
        },
        {
            id: 'rouse-select-spell',
            content: 'game-mage-wars:tutorial.steps.rouseSelectSpell',
            highlightTarget: `mw-prepared-card-${ROUSE_THE_BEAST_CARD_ID}`,
            position: 'top',
            requireAction: true,
            allowedCommands: [MAGE_WARS_COMMANDS.CAST_SPELL],
            allowedTargets: [`mw-prepared-card-${ROUSE_THE_BEAST_CARD_ID}`],
        },
        {
            id: 'rouse-target-wolf',
            content: 'game-mage-wars:tutorial.steps.rouseTargetWolf',
            highlightTarget: `mw-field-object-${JUNGLE_WOLF_CARD_ID}`,
            position: 'top',
            requireAction: true,
            allowedCommands: [MAGE_WARS_COMMANDS.CAST_SPELL],
            allowedTargets: [`mw-field-object-${JUNGLE_WOLF_CARD_ID}`],
            advanceOnEvents: [{
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_ROUSED,
                match: { ownerId: '0' },
            }],
        },
        {
            id: 'pass-your-deployment',
            content: 'game-mage-wars:tutorial.steps.passYourDeployment',
            highlightTarget: 'mw-turn-end',
            position: 'left',
            requireAction: true,
            allowedCommands: [FLOW_COMMANDS.ADVANCE_PHASE],
            allowedTargets: ['mw-turn-end'],
            advanceOnEvents: [{
                type: MAGE_WARS_EVENTS.PHASE_WINDOW_COMPLETED,
                match: { playerId: '0', phase: 'deployment' },
            }],
        },
        {
            id: 'opponent-deployment-results',
            content: 'game-mage-wars:tutorial.steps.opponentDeploymentResults',
            allowedCommands: [MAGE_WARS_COMMANDS.CAST_SPELL],
            aiActions: [
                {
                    commandType: MAGE_WARS_COMMANDS.CAST_SPELL,
                    playerId: '1',
                    payload: {
                        spellCardId: ASYRAN_CLERIC_CARD_ID,
                        manaCost: 5,
                        targetZoneId: 'd1',
                    },
                    waitForBoardSyncAfter: true,
                },
                {
                    commandType: MAGE_WARS_COMMANDS.CAST_SPELL,
                    playerId: '1',
                    payload: {
                        spellCardId: PILLAR_OF_LIGHT_CARD_ID,
                        manaCost: 5,
                        targetObjectId: PLAYER_ONE_CLERIC_OBJECT_ID,
                    },
                },
            ],
        },
        {
            id: 'opponent-public-view',
            content: 'game-mage-wars:tutorial.steps.opponentPublicView',
            highlightTarget: 'mw-opponent-view-toggle',
            position: 'left',
            requireAction: true,
            infoStep: true,
        },
        {
            id: 'discard-reading',
            content: 'game-mage-wars:tutorial.steps.discardReading',
            highlightTarget: 'mw-discard',
            position: 'left',
            infoStep: true,
        },
        {
            id: 'back-to-self-view',
            content: 'game-mage-wars:tutorial.steps.backToSelfView',
            highlightTarget: 'mw-back-to-self-view',
            position: 'left',
            requireAction: true,
            infoStep: true,
        },
        {
            id: 'opponent-pass-deployment',
            content: 'game-mage-wars:tutorial.steps.opponentPassDeployment',
            position: 'center',
            allowedCommands: [FLOW_COMMANDS.ADVANCE_PHASE],
            aiActions: [advancePhase('1')],
        },
        {
            id: 'skip-initiative-quickcast',
            content: 'game-mage-wars:tutorial.steps.skipInitiativeQuickcast',
            highlightTarget: 'mw-turn-end',
            position: 'left',
            requireAction: true,
            allowedCommands: [FLOW_COMMANDS.ADVANCE_PHASE],
            allowedTargets: ['mw-turn-end'],
            advanceOnEvents: [{
                type: MAGE_WARS_EVENTS.PHASE_WINDOW_COMPLETED,
                match: { playerId: '0', phase: 'initiativeQuickcast' },
            }],
        },
        {
            id: 'opponent-pass-initiative-quickcast',
            content: 'game-mage-wars:tutorial.steps.opponentPassInitiativeQuickcast',
            position: 'center',
            allowedCommands: [FLOW_COMMANDS.ADVANCE_PHASE],
            aiActions: [advancePhase('1')],
        },
        {
            id: 'move-select-wolf',
            content: 'game-mage-wars:tutorial.steps.moveSelectWolf',
            highlightTarget: `mw-field-object-${JUNGLE_WOLF_CARD_ID}`,
            position: 'top',
            requireAction: true,
            allowedCommands: [MAGE_WARS_COMMANDS.MOVE_ARENA_OBJECT],
            allowedTargets: [`mw-field-object-${JUNGLE_WOLF_CARD_ID}`],
        },
        {
            id: 'move-target-zone',
            content: 'game-mage-wars:tutorial.steps.moveTargetZone',
            highlightTarget: 'mw-zone-a2',
            position: 'top',
            requireAction: true,
            allowedCommands: [MAGE_WARS_COMMANDS.MOVE_ARENA_OBJECT],
            allowedTargets: ['mw-zone-a2'],
            advanceOnEvents: [{ type: MAGE_WARS_EVENTS.ARENA_OBJECT_MOVED, match: { ownerId: '0' } }],
        },
        {
            id: 'finish',
            content: 'game-mage-wars:tutorial.steps.finish',
            highlightTarget: 'mw-board',
            position: 'center',
            infoStep: true,
        },
    ],
};

export const MageWarsTutorialCatalog: TutorialCollection = {
    defaultTutorialId: MageWarsTutorial.id,
    tutorials: {
        [MageWarsTutorial.id]: {
            titleKey: 'tutorial.catalog.basic.title',
            descriptionKey: 'tutorial.catalog.basic.description',
            manifest: MageWarsTutorial,
        },
    },
};

export default MageWarsTutorialCatalog;
