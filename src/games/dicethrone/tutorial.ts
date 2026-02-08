import type { TutorialManifest, TutorialEventMatcher } from '../../engine/types';
import { CHEAT_COMMANDS } from '../../engine';
import { TOKEN_IDS, STATUS_IDS } from './domain/ids';

const MATCH_PHASE_OFFENSIVE: TutorialEventMatcher = {
    type: 'SYS_PHASE_CHANGED',
    match: { to: 'offensiveRoll' },
};

const MATCH_PHASE_DEFENSE: TutorialEventMatcher = {
    type: 'SYS_PHASE_CHANGED',
    match: { to: 'defensiveRoll' },
};

const MATCH_PHASE_MAIN2: TutorialEventMatcher = {
    type: 'SYS_PHASE_CHANGED',
    match: { to: 'main2' },
};

export const DiceThroneTutorial: TutorialManifest = {
    id: 'dicethrone-basic',
    randomPolicy: {
        mode: 'fixed',
        values: [1],
    },
    steps: [
        {
            id: 'setup',
            content: 'game-dicethrone:tutorial.steps.setup',
            position: 'center',
            requireAction: false,
            showMask: true,
            aiActions: [
                { commandType: 'SELECT_CHARACTER', payload: { characterId: 'monk' } },
                { commandType: 'HOST_START_GAME', payload: {} },
            ],
            advanceOnEvents: [
                { type: 'HOST_STARTED' },
                { type: 'SYS_PHASE_CHANGED', match: { to: 'upkeep' } },
                { type: 'SYS_PHASE_CHANGED', match: { to: 'income' } },
                { type: 'SYS_PHASE_CHANGED', match: { to: 'main1' } },
            ],
        },
        {
            id: 'intro',
            content: 'game-dicethrone:tutorial.steps.intro',
            position: 'center',
            requireAction: false,
            showMask: true,
        },
        {
            id: 'stats',
            content: 'game-dicethrone:tutorial.steps.stats',
            highlightTarget: 'player-stats',
            position: 'right',
            requireAction: false,
        },
        {
            id: 'phases',
            content: 'game-dicethrone:tutorial.steps.phases',
            highlightTarget: 'phase-indicator',
            position: 'right',
            requireAction: false,
        },
        {
            id: 'player-board',
            content: 'game-dicethrone:tutorial.steps.playerBoard',
            highlightTarget: 'player-board',
            position: 'right',
            requireAction: false,
        },
        {
            id: 'tip-board',
            content: 'game-dicethrone:tutorial.steps.tipBoard',
            highlightTarget: 'tip-board',
            position: 'right',
            requireAction: false,
        },
        {
            id: 'hand',
            content: 'game-dicethrone:tutorial.steps.hand',
            highlightTarget: 'hand-area',
            position: 'top',
            requireAction: false,
        },
        {
            id: 'discard',
            content: 'game-dicethrone:tutorial.steps.discard',
            highlightTarget: 'discard-pile',
            position: 'left',
            requireAction: false,
        },
        {
            id: 'status-tokens',
            content: 'game-dicethrone:tutorial.steps.statusTokens',
            highlightTarget: 'status-tokens',
            position: 'right',
            requireAction: false,
        },
        {
            id: 'advance',
            content: 'game-dicethrone:tutorial.steps.advance',
            highlightTarget: 'advance-phase-button',
            position: 'left',
            requireAction: true,
            advanceOnEvents: [
                { type: 'SYS_PHASE_CHANGED' },
                MATCH_PHASE_OFFENSIVE,
            ],
        },
        {
            id: 'dice-tray',
            content: 'game-dicethrone:tutorial.steps.dice',
            highlightTarget: 'dice-tray',
            position: 'left',
            requireAction: false,
            advanceOnEvents: [
                { type: 'SYS_PHASE_CHANGED', match: { to: 'offensiveRoll' } },
            ],
        },
        {
            id: 'dice-roll',
            content: 'game-dicethrone:tutorial.steps.rollButton',
            highlightTarget: 'dice-roll-button',
            position: 'left',
            requireAction: true,
            advanceOnEvents: [{ type: 'DICE_ROLLED' }],
        },
        {
            id: 'dice-confirm',
            content: 'game-dicethrone:tutorial.steps.confirmButton',
            highlightTarget: 'dice-confirm-button',
            position: 'left',
            requireAction: true,
            advanceOnEvents: [{ type: 'ROLL_CONFIRMED' }],
        },
        {
            id: 'abilities',
            content: 'game-dicethrone:tutorial.steps.abilities',
            highlightTarget: 'ability-slots',
            position: 'left',
            requireAction: true,
            aiActions: [
                // 确保阶段在 offensiveRoll，否则 canSelectAbility 会为 false
                { commandType: CHEAT_COMMANDS.SET_PHASE, payload: { phase: 'offensiveRoll' } },
            ],
            advanceOnEvents: [{ type: 'ABILITY_ACTIVATED' }],
        },
        {
            id: 'resolve-attack',
            content: 'game-dicethrone:tutorial.steps.resolveAttack',
            highlightTarget: 'advance-phase-button',
            position: 'left',
            requireAction: true,
            advanceOnEvents: [MATCH_PHASE_DEFENSE, MATCH_PHASE_MAIN2],
        },
        {
            id: 'taiji-response',
            content: 'game-dicethrone:tutorial.steps.taijiResponse',
            highlightTarget: 'status-tokens',
            position: 'right',
            requireAction: true,
            showMask: true,
            aiActions: [
                { commandType: CHEAT_COMMANDS.SET_TOKEN, payload: { playerId: '0', tokenId: TOKEN_IDS.TAIJI, amount: 1 } },
                { commandType: CHEAT_COMMANDS.SET_PHASE, payload: { phase: 'defensiveRoll' } },
                // 注入 pendingAttack 以确定防御方（rollerId）
                { commandType: CHEAT_COMMANDS.MERGE_STATE, payload: { fields: {
                    pendingAttack: {
                        id: 'tutorial-taiji-attack',
                        attackerId: '1',
                        defenderId: '0',
                        sourceAbilityId: 'dummy-attack',
                        isDefendable: true,
                        damageResolved: false,
                    },
                } } },
                // 注入 pendingDamage 以触发 Token 响应窗口
                { commandType: CHEAT_COMMANDS.MERGE_STATE, payload: { fields: {
                    pendingDamage: {
                        id: 'tutorial-taiji',
                        sourcePlayerId: '0',
                        targetPlayerId: '1',
                        originalDamage: 2,
                        currentDamage: 2,
                        responseType: 'beforeDamageDealt',
                        responderId: '0',
                        isFullyEvaded: false,
                    },
                } } },
            ],
            advanceOnEvents: [
                { type: 'TOKEN_USED', match: { playerId: '0', tokenId: TOKEN_IDS.TAIJI } },
                { type: 'TOKEN_RESPONSE_CLOSED', match: { pendingDamageId: 'tutorial-taiji' } },
            ],
        },
        {
            id: 'evasive-response',
            content: 'game-dicethrone:tutorial.steps.evasiveResponse',
            highlightTarget: 'status-tokens',
            position: 'right',
            requireAction: true,
            showMask: true,
            aiActions: [
                { commandType: CHEAT_COMMANDS.SET_TOKEN, payload: { playerId: '0', tokenId: TOKEN_IDS.EVASIVE, amount: 1 } },
                { commandType: CHEAT_COMMANDS.SET_PHASE, payload: { phase: 'defensiveRoll' } },
                // 注入 pendingAttack 以确定防御方（rollerId）
                { commandType: CHEAT_COMMANDS.MERGE_STATE, payload: { fields: {
                    pendingAttack: {
                        id: 'tutorial-evasive-attack',
                        attackerId: '1',
                        defenderId: '0',
                        sourceAbilityId: 'dummy-attack',
                        isDefendable: true,
                        damageResolved: false,
                    },
                } } },
                // 注入 pendingDamage 以触发 Token 响应窗口（防御方视角）
                { commandType: CHEAT_COMMANDS.MERGE_STATE, payload: { fields: {
                    pendingDamage: {
                        id: 'tutorial-evasive',
                        sourcePlayerId: '1',
                        targetPlayerId: '0',
                        originalDamage: 2,
                        currentDamage: 2,
                        responseType: 'beforeDamageReceived',
                        responderId: '0',
                        isFullyEvaded: false,
                    },
                } } },
            ],
            advanceOnEvents: [
                { type: 'TOKEN_USED', match: { playerId: '0', tokenId: TOKEN_IDS.EVASIVE } },
                { type: 'TOKEN_RESPONSE_CLOSED', match: { pendingDamageId: 'tutorial-evasive' } },
            ],
        },
        {
            id: 'purify-setup',
            content: 'game-dicethrone:tutorial.steps.purifySetup',
            highlightTarget: 'status-tokens',
            position: 'right',
            requireAction: false,
            showMask: true,
            aiActions: [
                { commandType: CHEAT_COMMANDS.SET_STATUS, payload: { playerId: '0', statusId: STATUS_IDS.KNOCKDOWN, amount: 1 } },
                { commandType: CHEAT_COMMANDS.SET_TOKEN, payload: { playerId: '0', tokenId: TOKEN_IDS.PURIFY, amount: 1 } },
            ],
            advanceOnEvents: [
                { type: 'AI_CONSUMED', match: { stepId: 'purify-setup' } },
            ],
        },
        {
            id: 'purify-use',
            content: 'game-dicethrone:tutorial.steps.purifyUse',
            highlightTarget: 'status-tokens',
            position: 'right',
            requireAction: true,
            showMask: true,
            advanceOnEvents: [
                { type: 'TOKEN_USED', match: { playerId: '0', tokenId: TOKEN_IDS.PURIFY } },
                { type: 'STATUS_REMOVED', match: { targetId: '0', statusId: STATUS_IDS.KNOCKDOWN } },
            ],
        },
        {
            id: 'inner-peace',
            content: 'game-dicethrone:tutorial.steps.innerPeace',
            highlightTarget: 'hand-area',
            position: 'top',
            requireAction: true,
            aiActions: [
                { commandType: CHEAT_COMMANDS.DEAL_CARD_BY_ATLAS_INDEX, payload: { playerId: '0', atlasIndex: 1 } },
                { commandType: CHEAT_COMMANDS.SET_PHASE, payload: { phase: 'main1' } },
            ],
            advanceOnEvents: [
                { type: 'CARD_PLAYED', match: { playerId: '0', cardId: 'card-inner-peace' } },
            ],
        },
        {
            id: 'play-six',
            content: 'game-dicethrone:tutorial.steps.playSix',
            highlightTarget: 'hand-area',
            position: 'top',
            requireAction: true,
            aiActions: [
                { commandType: CHEAT_COMMANDS.DEAL_CARD_BY_ATLAS_INDEX, payload: { playerId: '0', atlasIndex: 0 } },
                { commandType: CHEAT_COMMANDS.SET_PHASE, payload: { phase: 'offensiveRoll' } },
                { commandType: CHEAT_COMMANDS.SET_DICE, payload: { diceValues: [1, 1, 1, 1, 1] } },
            ],
            advanceOnEvents: [
                { type: 'DIE_MODIFIED' },
            ],
        },
        {
            id: 'meditation-2',
            content: 'game-dicethrone:tutorial.steps.meditation2',
            highlightTarget: 'hand-area',
            position: 'top',
            requireAction: true,
            aiActions: [
                { commandType: CHEAT_COMMANDS.DEAL_CARD_BY_ATLAS_INDEX, payload: { playerId: '0', atlasIndex: 6 } },
                { commandType: CHEAT_COMMANDS.SET_PHASE, payload: { phase: 'main1' } },
            ],
            advanceOnEvents: [
                { type: 'ABILITY_REPLACED', match: { playerId: '0', oldAbilityId: 'meditation' } },
            ],
        },
        {
            id: 'defense-roll',
            content: 'game-dicethrone:tutorial.steps.defenseRoll',
            highlightTarget: 'dice-tray',
            position: 'left',
            requireAction: false,
            advanceOnEvents: [{ type: 'DICE_ROLLED' }],
        },
        {
            id: 'defense-end',
            content: 'game-dicethrone:tutorial.steps.defenseEnd',
            highlightTarget: 'advance-phase-button',
            position: 'left',
            requireAction: false,
            advanceOnEvents: [MATCH_PHASE_MAIN2],
        },
        {
            id: 'finish',
            content: 'game-dicethrone:tutorial.steps.finish',
            position: 'center',
            requireAction: false,
        },
    ],
};

export default DiceThroneTutorial;
