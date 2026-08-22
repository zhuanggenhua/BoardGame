import type { TutorialManifest } from '../../engine/types';
import { FLOW_COMMANDS, FLOW_EVENTS } from '../../engine/systems/FlowSystem';
import { MAGE_WARS_COMMANDS, MAGE_WARS_EVENTS } from './domain';

const JUNGLE_WOLF_CARD_ID = 2819;
const ROUSE_THE_BEAST_CARD_ID = 3403;
const ASYRAN_CLERIC_CARD_ID = 2811;
const PILLAR_OF_LIGHT_CARD_ID = 1706;
const PLAYER_ONE_CLERIC_OBJECT_ID = 'mwobj-1-2811-1';

const advancePhase = (playerId: string) => ({
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
            id: 'stage',
            content: 'game-mage-wars:tutorial.steps.stage',
            highlightTarget: 'mw-stage',
            position: 'bottom',
            infoStep: true,
        },
        {
            id: 'advance-channel',
            content: 'game-mage-wars:tutorial.steps.advanceChannel',
            highlightTarget: 'mw-turn-end',
            position: 'left',
            requireAction: true,
            allowedCommands: [FLOW_COMMANDS.ADVANCE_PHASE],
            aiActions: [advancePhase('1')],
            advanceOnEvents: [{ type: FLOW_EVENTS.PHASE_CHANGED, match: { to: 'channel' } }],
        },
        {
            id: 'channel-result',
            content: 'game-mage-wars:tutorial.steps.channelResult',
            highlightTarget: 'mw-self-hud',
            position: 'right',
            infoStep: true,
        },
        {
            id: 'advance-upkeep',
            content: 'game-mage-wars:tutorial.steps.advanceUpkeep',
            highlightTarget: 'mw-turn-end',
            position: 'left',
            requireAction: true,
            allowedCommands: [FLOW_COMMANDS.ADVANCE_PHASE],
            aiActions: [advancePhase('1')],
            advanceOnEvents: [{ type: FLOW_EVENTS.PHASE_CHANGED, match: { to: 'upkeep' } }],
        },
        {
            id: 'advance-planning',
            content: 'game-mage-wars:tutorial.steps.advancePlanning',
            highlightTarget: 'mw-turn-end',
            position: 'left',
            requireAction: true,
            allowedCommands: [FLOW_COMMANDS.ADVANCE_PHASE],
            aiActions: [advancePhase('1')],
            advanceOnEvents: [{ type: FLOW_EVENTS.PHASE_CHANGED, match: { to: 'planning' } }],
        },
        {
            id: 'plan-wolf',
            content: 'game-mage-wars:tutorial.steps.planWolf',
            highlightTarget: 'mw-spellbook',
            position: 'top',
            requireAction: true,
            allowedCommands: [MAGE_WARS_COMMANDS.PLAN_SPELLS],
            allowedTargets: [
                `mw-spellbook-card-${JUNGLE_WOLF_CARD_ID}`,
                `mw-spellbook-card-${ROUSE_THE_BEAST_CARD_ID}`,
                'mw-plan-spells',
            ],
            aiActions: [{
                commandType: MAGE_WARS_COMMANDS.PLAN_SPELLS,
                playerId: '1',
                payload: { spellCardIds: [ASYRAN_CLERIC_CARD_ID, PILLAR_OF_LIGHT_CARD_ID] },
            }],
            advanceOnEvents: [{ type: MAGE_WARS_EVENTS.SPELLS_PLANNED, match: { playerId: '0' } }],
        },
        {
            id: 'prepared-and-hidden',
            content: 'game-mage-wars:tutorial.steps.preparedAndHidden',
            highlightTarget: 'mw-opponent-prepared',
            position: 'right',
            infoStep: true,
        },
        {
            id: 'deploy-wolf',
            content: 'game-mage-wars:tutorial.steps.deployWolf',
            highlightTarget: `mw-prepared-card-${JUNGLE_WOLF_CARD_ID}`,
            position: 'top',
            requireAction: true,
            allowedCommands: [MAGE_WARS_COMMANDS.CAST_SPELL],
            allowedTargets: [`mw-prepared-card-${JUNGLE_WOLF_CARD_ID}`, 'mw-zone-a3'],
            advanceOnEvents: [{ type: MAGE_WARS_EVENTS.ARENA_OBJECT_SUMMONED }],
        },
        {
            id: 'rouse-wolf',
            content: 'game-mage-wars:tutorial.steps.rouseWolf',
            highlightTarget: `mw-prepared-card-${ROUSE_THE_BEAST_CARD_ID}`,
            position: 'top',
            requireAction: true,
            allowedCommands: [MAGE_WARS_COMMANDS.CAST_SPELL],
            allowedTargets: [
                `mw-prepared-card-${ROUSE_THE_BEAST_CARD_ID}`,
                `mw-field-object-${JUNGLE_WOLF_CARD_ID}`,
            ],
            advanceOnEvents: [{
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_ROUSED,
                match: { ownerId: '0' },
            }],
        },
        {
            id: 'pass-your-deployment',
            content: 'game-mage-wars:tutorial.steps.passYourDeployment',
            position: 'center',
            allowedCommands: [FLOW_COMMANDS.ADVANCE_PHASE],
            aiActions: [advancePhase('0')],
        },
        {
            id: 'opponent-deploy',
            content: 'game-mage-wars:tutorial.steps.opponentDeploy',
            highlightTarget: 'mw-zone-d1',
            position: 'left',
            allowedCommands: [MAGE_WARS_COMMANDS.CAST_SPELL],
            aiActions: [{
                commandType: MAGE_WARS_COMMANDS.CAST_SPELL,
                playerId: '1',
                payload: {
                    spellCardId: ASYRAN_CLERIC_CARD_ID,
                    manaCost: 5,
                    targetZoneId: 'd1',
                },
            }],
            autoAdvanceAfterAi: false,
        },
        {
            id: 'opponent-attack-spell',
            content: 'game-mage-wars:tutorial.steps.opponentAttackSpell',
            highlightTarget: `mw-field-object-${ASYRAN_CLERIC_CARD_ID}`,
            position: 'left',
            allowedCommands: [MAGE_WARS_COMMANDS.CAST_SPELL],
            aiActions: [{
                commandType: MAGE_WARS_COMMANDS.CAST_SPELL,
                playerId: '1',
                payload: {
                    spellCardId: PILLAR_OF_LIGHT_CARD_ID,
                    manaCost: 5,
                    targetObjectId: PLAYER_ONE_CLERIC_OBJECT_ID,
                },
            }],
            autoAdvanceAfterAi: false,
        },
        {
            id: 'discard-reading',
            content: 'game-mage-wars:tutorial.steps.discardReading',
            highlightTarget: 'mw-discard',
            position: 'left',
            infoStep: true,
        },
        {
            id: 'skip-to-creature-action',
            content: 'game-mage-wars:tutorial.steps.skipToCreatureAction',
            position: 'center',
            allowedCommands: [FLOW_COMMANDS.ADVANCE_PHASE],
            aiActions: [
                advancePhase('1'),
                advancePhase('0'),
                advancePhase('1'),
            ],
        },
        {
            id: 'move-wolf',
            content: 'game-mage-wars:tutorial.steps.moveWolf',
            highlightTarget: `mw-field-object-${JUNGLE_WOLF_CARD_ID}`,
            position: 'top',
            requireAction: true,
            allowedCommands: [MAGE_WARS_COMMANDS.MOVE_ARENA_OBJECT],
            allowedTargets: [`mw-field-object-${JUNGLE_WOLF_CARD_ID}`, 'mw-zone-a2', 'mw-zone-b3'],
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

export default MageWarsTutorial;
