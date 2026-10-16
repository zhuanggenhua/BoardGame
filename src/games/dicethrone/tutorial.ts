import { withDiceThroneTutorialSurfaces } from './tutorialLayout';
import type { TutorialHiddenAutomationContract, TutorialManifest, TutorialEventMatcher } from '../../engine/types';
import { TOKEN_IDS, STATUS_IDS } from './domain/ids';
import { MONK_CARDS } from './heroes/monk/cards';
import type { TutorialCollection } from '../../engine/types';
import { DiceThroneDamagePractice, DiceThroneDiscardPractice, DiceThroneResponsePractice, DiceThroneUltimatePractice, DiceThroneUpgradePractice, DiceThroneStraightPractice, DiceThroneKnockdownPractice } from './tutorialPractices';

const setupPrecondition = (reason: string): TutorialHiddenAutomationContract => ({
    kind: 'setup-precondition',
    reason,
});

// ============================================================================
// 牌组配置
// ============================================================================

/** 玩家起手牌（教程流程顺序） */
const TUTORIAL_STARTING_HAND = [
    'card-deep-thought',   // 弃牌+撤回教学用（卖掉后撤回）
    'card-play-six',
    'card-enlightenment',
    'card-inner-peace',
];

/** 牌库顶部顺序（起手牌之后，income 阶段依次抽到） */
const TUTORIAL_DECK_TOP = [
    'card-meditation-2',   // Turn 2 income 抽到，用于升级清修
];

/** AI 起手牌（保证 card-palm-strike 在手中） */
const AI_STARTING_HAND = [
    'card-palm-strike',
    'card-inner-peace',
    'card-deep-thought',
    'card-boss-generous',
];

/**
 * 构建教程牌组：startingHand 在最前（抽为起手牌），deckTop 紧随其后，剩余卡牌在末尾
 */
const buildTutorialDeck = (startingHand: string[], deckTop: string[] = []): string[] => {
    // 每张卡牌 1 份（与 getMonkStartingDeck 一致，共 33 张）
    const baseDeck = MONK_CARDS.map(card => card.id);
    const remaining = [...baseDeck];
    // 移除起手牌和牌库顶部的卡牌
    [...startingHand, ...deckTop].forEach(id => {
        const index = remaining.indexOf(id);
        if (index !== -1) remaining.splice(index, 1);
    });
    return [...startingHand, ...deckTop, ...remaining];
};

const TUTORIAL_INITIAL_DECK = buildTutorialDeck(TUTORIAL_STARTING_HAND, TUTORIAL_DECK_TOP);
const AI_TUTORIAL_DECK = buildTutorialDeck(AI_STARTING_HAND);

// ============================================================================
// 事件匹配器
// ============================================================================

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

const MATCH_RESPONSE_WINDOW_CLOSED: TutorialEventMatcher = {
    type: 'RESPONSE_WINDOW_CLOSED',
};

// ============================================================================
// 教程定义
// ============================================================================

export const DiceThroneTutorial: TutorialManifest = {
    id: 'dicethrone-basic',
    playerId: '0',
    revision: 4,
    randomPolicy: {
        mode: 'fixed',
        values: [6],
    },
    stepValidator: (state, step) => {
        if (step.id === 'inner-peace-response') return Boolean(state.sys.responseWindow?.current);
        const core = state.core as import('./domain/types').DiceThroneCore;
        if (step.id === 'discard-finish') return state.sys.phase === 'discard' && core.activePlayerId === '0';
        if (step.id === 'token-response-pass') return Boolean(core.pendingDamage);
        if (step.id.startsWith('evasive-')) {
            if (!core.pendingDamage) return false;
            const rolling = core.currentRollContext?.kind === 'evasion' && core.currentRollContext.status === 'open';
            if (step.id === 'evasive-use') return !rolling && (core.players['0'].tokens[TOKEN_IDS.EVASIVE] ?? 0) > 0;
            if (step.id === 'evasive-confirm') return rolling;
            return rolling || (core.players['0'].tokens[TOKEN_IDS.EVASIVE] ?? 0) > 0;
        }
        return true;
    },
    steps: withDiceThroneTutorialSurfaces([
        // ==== 段 A：初始化 + UI 介绍 ====
        {
            id: 'setup',
            content: 'game-dicethrone:tutorial.steps.setup',
            position: 'center',
            requireAction: false,
            showMask: true,
            aiActions: [
                { commandType: 'SELECT_CHARACTER', playerId: '0', payload: { characterId: 'monk', initialDeckCardIds: TUTORIAL_INITIAL_DECK } },
                { commandType: 'SELECT_CHARACTER', playerId: '1', payload: { characterId: 'monk', initialDeckCardIds: AI_TUTORIAL_DECK } },
                { commandType: 'PLAYER_READY', playerId: '1', payload: {} },
                { commandType: 'HOST_START_GAME', playerId: '0', payload: {} },
            ],
            hiddenAutomation: setupPrecondition('Create the legal Dice Throne tutorial match before the first visible step.'),
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
            infoStep: true,
        },
        {
            id: 'stats',
            content: 'game-dicethrone:tutorial.steps.stats',
            highlightTarget: 'player-stats',
            position: 'right',
            infoStep: true,
        },
        {
            id: 'phases',
            content: 'game-dicethrone:tutorial.steps.phases',
            highlightTarget: 'phase-indicator',
            position: 'right',
            infoStep: true,
        },
        {
            id: 'player-board',
            content: 'game-dicethrone:tutorial.steps.playerBoard',
            highlightTarget: 'player-board',
            position: 'right',
            infoStep: true,
        },
        {
            id: 'tip-board',
            content: 'game-dicethrone:tutorial.steps.tipBoard',
            highlightTarget: 'tip-board',
            position: 'right',
            infoStep: true,
        },
        { id: 'tip-inspect', content: 'game-dicethrone:tutorial.steps.tip-inspect', highlightTarget: 'tip-board-magnify-button', position: 'left', requireAction: true, allowedCommands: [] },
        { id: 'tip-inspect-close', content: 'game-dicethrone:tutorial.steps.tip-inspect-close', highlightTarget: 'board-magnify-overlay-close', position: 'right', tooltipMaxWidth: 300, requireAction: true, allowedCommands: [] },
        { id: 'card-types', content: 'game-dicethrone:tutorial.steps.card-types', highlightTarget: 'hand-area', position: 'top', infoStep: true },
        {
            id: 'hand',
            content: 'game-dicethrone:tutorial.steps.hand',
            highlightTarget: 'hand-area',
            position: 'top',
            infoStep: true,
        },
        { id: 'hand-inspect', content: 'game-dicethrone:tutorial.steps.hand-inspect', highlightTarget: 'hand-card-card-deep-thought', position: 'top', requireAction: true, allowedCommands: [] },
        { id: 'hand-inspect-close', content: 'game-dicethrone:tutorial.steps.hand-inspect-close', highlightTarget: 'board-magnify-overlay-close', position: 'right', tooltipMaxWidth: 300, requireAction: true, allowedCommands: [] },
        {
            id: 'discard',
            content: 'game-dicethrone:tutorial.steps.discard',
            highlightTarget: 'discard-pile',
            position: 'left',
            infoStep: true,
        },

        // ==== 段 A2：弃牌教学（Turn 1 P0 main1，起手就有 4 张牌） ====
        { id: 'response-control', content: 'game-dicethrone:tutorial.steps.response-control', highlightTarget: 'response-toggle', position: 'center', tooltipMaxWidth: 400, infoStep: true },
        { id: 'main-actions-rule', content: 'game-dicethrone:tutorial.steps.main-actions-rule', highlightTarget: 'hand-area', position: 'top', infoStep: true },
        {
            id: 'sell-card-intro',
            content: 'game-dicethrone:tutorial.steps.sellCardIntro',
            highlightTarget: 'hand-card-card-deep-thought',
            position: 'top',
            requireAction: true,
            allowedCommands: ['SELL_CARD'],
            advanceOnEvents: [
                { type: 'CARD_SOLD', match: { playerId: '0' } },
            ],
        },
        // 撤回弃牌教学：告知玩家可以撤回最近一张弃牌
        { id: 'sell-result', content: 'game-dicethrone:tutorial.steps.sell-result', highlightTarget: 'player-stats', position: 'left', infoStep: true },
        {
            id: 'undo-sell-intro',
            content: 'game-dicethrone:tutorial.steps.undoSellIntro',
            highlightTarget: 'discard-pile',
            position: 'left',
            infoStep: true,
        },
        {
            id: 'undo-sell',
            content: 'game-dicethrone:tutorial.steps.undoSell',
            highlightTarget: 'discard-pile',
            position: 'left',
            requireAction: true,
            allowedCommands: ['UNDO_SELL_CARD'],
            advanceOnEvents: [
                { type: 'SELL_UNDONE', match: { playerId: '0' } },
            ],
        },

        // ==== 段 B：首次攻击 (Turn 1, P0) ====
        { id: 'undo-result', content: 'game-dicethrone:tutorial.steps.undo-result', highlightTarget: 'hand-area', position: 'top', infoStep: true },
        {
            id: 'advance',
            content: 'game-dicethrone:tutorial.steps.advance',
            highlightTarget: 'advance-phase-button',
            position: 'left',
            requireAction: true,
            allowedCommands: ['ADVANCE_PHASE'],
            advanceOnEvents: [
                MATCH_PHASE_OFFENSIVE,
            ],
        },
        {
            id: 'dice-tray',
            content: 'game-dicethrone:tutorial.steps.dice',
            highlightTarget: 'dice-tray',
            position: 'left',
            infoStep: true,
        },
        { id: 'roll-rule', content: 'game-dicethrone:tutorial.steps.roll-rule', highlightTarget: 'dice-tray', position: 'left', infoStep: true },
        {
            id: 'dice-roll', randomPolicy: { mode: 'fixed', values: [1] },
            content: 'game-dicethrone:tutorial.steps.rollButton',
            highlightTarget: 'dice-roll-button',
            position: 'left',
            requireAction: true,
            allowedCommands: ['ROLL_DICE'],
            advanceOnEvents: [{ type: 'DICE_ROLLED' }],
        },
        {
            id: 'dice-lock', content: 'game-dicethrone:tutorial.steps.dice-lock', highlightTarget: 'dice-tray',
            position: 'left', requireAction: true, allowManualSkip: false,
            allowedCommands: ["TOGGLE_DIE_LOCK"], advanceOnEvents: [{ type: 'DIE_LOCK_TOGGLED' }],
        },
        {
            id: 'dice-reroll', randomPolicy: { mode: 'fixed', values: [1] }, content: 'game-dicethrone:tutorial.steps.dice-reroll', highlightTarget: 'dice-roll-button',
            position: 'left', requireAction: true, allowManualSkip: false,
            allowedCommands: ["ROLL_DICE","TOGGLE_DIE_LOCK"], advanceOnEvents: [{ type: 'DICE_ROLLED' }],
        },
        { id: 'dice-symbols', content: 'game-dicethrone:tutorial.steps.dice-symbols', highlightTarget: 'dice-tray', position: 'left', infoStep: true },
        { id: 'play-six-rule', content: 'game-dicethrone:tutorial.steps.play-six-rule', highlightTarget: 'hand-card-card-play-six', position: 'top', infoStep: true },
        {
            id: 'play-six',
            content: 'game-dicethrone:tutorial.steps.playSix',
            highlightTarget: 'hand-card-card-play-six',
            position: 'top',
            requireAction: true,
            allowedCommands: ['PLAY_CARD'],
            advanceOnEvents: [
                { type: 'CARD_PLAYED', match: { playerId: '0', cardId: 'card-play-six' } },
            ],
        },
        {
            id: 'play-six-modify',
            content: 'game-dicethrone:tutorial.steps.playSixModify',
            highlightTarget: 'dice-tray',
            position: 'left',
            requireAction: true,
            allowedCommands: ['MODIFY_DIE', 'SYS_INTERACTION_RESPOND', 'SYS_INTERACTION_CONFIRM'],
            advanceOnEvents: [
                { type: 'DIE_MODIFIED' },
            ],
        },
        {
            id: 'dice-confirm',
            content: 'game-dicethrone:tutorial.steps.confirmButton',
            highlightTarget: 'dice-confirm-button',
            position: 'left',
            requireAction: true,
            allowedCommands: ['CONFIRM_ROLL', 'SYS_INTERACTION_RESPOND', 'SYS_INTERACTION_CONFIRM'],
            advanceOnEvents: [{ type: 'ROLL_CONFIRMED' }],
        },
        { id: 'ability-rule', content: 'game-dicethrone:tutorial.steps.ability-rule', highlightTarget: 'ability-slot-fist', position: 'right', tooltipMaxWidth: 330, infoStep: true },
        {
            id: 'abilities',
            content: 'game-dicethrone:tutorial.steps.abilities',
            highlightTarget: 'ability-slot-fist',
            position: 'right',
            tooltipMaxWidth: 330,
            requireAction: true,
            allowedCommands: ['SELECT_ABILITY'],
            advanceOnEvents: [{ type: 'ABILITY_ACTIVATED' }],
        },
        { id: 'attack-rule', content: 'game-dicethrone:tutorial.steps.attack-rule', highlightTarget: 'ability-slots', position: 'left', infoStep: true },
        {
            id: 'resolve-attack',
            content: 'game-dicethrone:tutorial.steps.resolveAttack',
            highlightTarget: 'advance-phase-button',
            position: 'left',
            requireAction: true,
            allowedCommands: ['ADVANCE_PHASE'],
            advanceOnEvents: [MATCH_PHASE_DEFENSE, MATCH_PHASE_MAIN2],
        },
        {
            id: 'opponent-defense', randomPolicy: { mode: 'fixed', values: [1] },
            content: 'game-dicethrone:tutorial.steps.opponentDefense',
            position: 'center',
            requireAction: false,
            allowManualSkip: true,
            aiActions: [
                { commandType: 'ROLL_DICE', playerId: '1', payload: {} },
                { commandType: 'CONFIRM_ROLL', playerId: '1', payload: {} },
                { commandType: 'ADVANCE_PHASE', playerId: '1', payload: {} },
            ],
            autoAdvanceAfterAi: false,
        },

        // ==== 段 C：main2 阶段打出顿悟和静心 ====
        // 顿悟 timing='main'，只能在 main1/main2 打出
        // 此时处于 P0 的 main2 阶段，正确时机
        {
            id: 'main2-intro',
            content: 'game-dicethrone:tutorial.steps.main2Intro',
            highlightTarget: 'hand-area',
            position: 'top',
            infoStep: true,
        },
        { id: 'enlightenment-rule', content: 'game-dicethrone:tutorial.steps.enlightenment-rule', highlightTarget: 'hand-card-card-enlightenment', position: 'top', infoStep: true },
        {
            id: 'enlightenment-play',
            content: 'game-dicethrone:tutorial.steps.enlightenmentPlay',
            highlightTarget: 'hand-card-card-enlightenment',
            position: 'top',
            requireAction: true,
            allowedCommands: ['PLAY_CARD', 'SELL_CARD', 'REORDER_CARD_TO_END'],
            advanceOnEvents: [
                { type: 'CARD_PLAYED', match: { playerId: '0', cardId: 'card-enlightenment' } },
            ],
        },
        {
            id: 'enlightenment-confirm',
            content: 'game-dicethrone:tutorial.steps.enlightenmentConfirm',
            highlightTarget: 'dice-confirm-button',
            position: 'left',
            requireAction: true,
            allowedCommands: ['CONFIRM_ROLL', 'SKIP_BONUS_DICE_REROLL'],
            advanceOnEvents: [
                { type: 'BONUS_DICE_SETTLED' },
            ],
        },
        { id: 'enlightenment-result', content: 'game-dicethrone:tutorial.steps.enlightenment-result', highlightTarget: 'status-tokens', position: 'left', infoStep: true },
        {
            id: 'status-tokens',
            content: 'game-dicethrone:tutorial.steps.statusTokens',
            highlightTarget: 'status-tokens',
            position: 'right',
            infoStep: true,
        },
        { id: 'inner-peace-rule', content: 'game-dicethrone:tutorial.steps.inner-peace-rule', highlightTarget: 'hand-card-card-inner-peace', position: 'top', infoStep: true },
        {
            id: 'inner-peace',
            content: 'game-dicethrone:tutorial.steps.innerPeace',
            highlightTarget: 'hand-card-card-inner-peace',
            position: 'top',
            requireAction: true,
            allowedCommands: ['PLAY_CARD', 'SELL_CARD', 'REORDER_CARD_TO_END'],
            advanceOnEvents: [
                { type: 'CARD_PLAYED', match: { playerId: '0', cardId: 'card-inner-peace' } },
            ],
        },
        {
            id: 'inner-peace-response',
            content: 'game-dicethrone:tutorial.steps.innerPeaceResponse',
            highlightTarget: 'response-pass-button',
            position: 'top',
            requireAction: true,
            allowManualSkip: false,
            allowedCommands: ['RESPONSE_PASS'],
            advanceOnEvents: [MATCH_RESPONSE_WINDOW_CLOSED],
        },

        // ==== 段 D：AI 回合（P0 main2 已操作完，推进到 AI 回合） ====
        // infoStep 作为缓冲，避免 AI_CONSUMED 清除下一个有 aiActions 步骤的数据
        {
            id: 'ai-turn-intro',
            content: 'game-dicethrone:tutorial.steps.aiTurnIntro',
            position: 'center',
            infoStep: true,
        },
        { id: 'discard-rule', content: 'game-dicethrone:tutorial.steps.discard-rule', highlightTarget: 'hand-area', position: 'top', infoStep: true },
        {
            id: 'end-turn', content: 'game-dicethrone:tutorial.steps.end-turn', highlightTarget: 'advance-phase-button',
            position: 'left', requireAction: true, allowManualSkip: false,
            allowedCommands: ["ADVANCE_PHASE"], advanceOnEvents: [{ type: 'TURN_CHANGED' }],
        },
        {
            id: 'ai-turn', randomPolicy: { mode: 'fixed', values: [1] }, content: 'game-dicethrone:tutorial.steps.aiTurn', position: 'center',
            requireAction: false, allowManualSkip: true, autoAdvanceAfterAi: false,
            aiActions: [
                { commandType: 'PLAY_CARD', playerId: '1', payload: {"cardId":"card-palm-strike"} },
                { commandType: 'ADVANCE_PHASE', playerId: '1', payload: {} },
                { commandType: 'ROLL_DICE', playerId: '1', payload: {} },
                { commandType: 'CONFIRM_ROLL', playerId: '1', payload: {} },
                { commandType: 'SELECT_ABILITY', playerId: '1', payload: {"abilityId":"fist-technique-5"} },
                { commandType: 'ADVANCE_PHASE', playerId: '1', payload: {} },
            ],
        },
        {
            id: 'defense-start', content: 'game-dicethrone:tutorial.steps.defense-start',
            highlightTarget: 'defense-start-button', position: 'left',
            requireAction: true, allowManualSkip: true, allowedCommands: [],
        },
        { id: 'defense-rule', content: 'game-dicethrone:tutorial.steps.defense-rule', highlightTarget: 'dice-tray', position: 'left', infoStep: true },
        {
            id: 'defense-roll', randomPolicy: { mode: 'fixed', values: [1] }, content: 'game-dicethrone:tutorial.steps.defense-roll', highlightTarget: 'dice-roll-button',
            position: 'left', requireAction: true, allowManualSkip: false,
            allowedCommands: ["ROLL_DICE"], advanceOnEvents: [{ type: 'DICE_ROLLED' }],
        },
        {
            id: 'defense-confirm', content: 'game-dicethrone:tutorial.steps.defense-confirm', highlightTarget: 'dice-confirm-button',
            position: 'left', requireAction: true, allowManualSkip: false,
            allowedCommands: ["CONFIRM_ROLL"], advanceOnEvents: [{ type: 'ROLL_CONFIRMED' }],
        },
        {
            id: 'defense-resolve', content: 'game-dicethrone:tutorial.steps.defense-resolve', highlightTarget: 'advance-phase-button',
            position: 'left', requireAction: true, allowManualSkip: false,
            allowedCommands: ["ADVANCE_PHASE"], advanceOnEvents: [{ type: 'TOKEN_RESPONSE_REQUESTED' }],
        },
        { id: 'token-response-rule', content: 'game-dicethrone:tutorial.steps.token-response-rule', highlightTarget: 'status-tokens', position: 'left', infoStep: true },
        {
            id: 'token-response-use', content: 'game-dicethrone:tutorial.steps.token-response-use', highlightTarget: 'status-tokens',
            position: 'left', requireAction: true, allowManualSkip: false,
            allowedCommands: ["USE_TOKEN","SKIP_TOKEN_RESPONSE","SYS_INTERACTION_RESPOND","SYS_INTERACTION_CONFIRM"], advanceOnEvents: [{ type: 'TOKEN_USED', match: { playerId: '0' } }, { type: 'TOKEN_RESPONSE_CLOSED' }],
        },
        { id: 'evasive-rule', content: 'game-dicethrone:tutorial.steps.evasive-rule', highlightTarget: 'status-tokens', position: 'right', infoStep: true },
        {
            id: 'evasive-use', content: 'game-dicethrone:tutorial.steps.evasive-use', highlightTarget: 'status-tokens', position: 'right',
            requireAction: true, allowManualSkip: false, randomPolicy: { mode: 'fixed', values: [1] },
            allowedCommands: ['USE_TOKEN', 'SKIP_TOKEN_RESPONSE', 'SYS_INTERACTION_RESPOND', 'SYS_INTERACTION_CONFIRM'],
            advanceOnEvents: [{ type: 'TOKEN_USED', match: { playerId: '0' } }, { type: 'TOKEN_RESPONSE_CLOSED' }],
        },
        {
            id: 'evasive-confirm', content: 'game-dicethrone:tutorial.steps.evasive-confirm', highlightTarget: 'dice-confirm-button', position: 'left',
            requireAction: true, allowManualSkip: false,
            allowedCommands: ['SKIP_TOKEN_RESPONSE', 'SYS_INTERACTION_RESPOND', 'SYS_INTERACTION_CONFIRM'],
            advanceOnEvents: [{ type: 'TOKEN_RESPONSE_CLOSED' }],
        },
        {
            id: 'token-response-pass', content: 'game-dicethrone:tutorial.steps.token-response-pass', highlightTarget: 'response-pass-button',
            position: 'left', requireAction: true, allowManualSkip: false,
            allowedCommands: ["USE_TOKEN","SKIP_TOKEN_RESPONSE","SYS_INTERACTION_RESPOND","SYS_INTERACTION_CONFIRM"], advanceOnEvents: [{ type: 'TOKEN_RESPONSE_CLOSED' }],
        },
        { id: 'damage-result', content: 'game-dicethrone:tutorial.steps.damage-result', highlightTarget: 'player-stats', position: 'left', infoStep: true },
        {
            id: 'opponent-end-turn', content: 'game-dicethrone:tutorial.steps.opponentEndTurn', position: 'center',
            requireAction: false, allowManualSkip: true, autoAdvanceAfterAi: false,
            aiActions: [
                { commandType: 'ADVANCE_PHASE', playerId: '1', payload: {} },
                { commandType: 'ADVANCE_PHASE', playerId: '1', payload: {} },
            ],
        },
        { id: 'income-result', content: 'game-dicethrone:tutorial.steps.income-result', highlightTarget: 'hand-card-card-meditation-2', position: 'top', tooltipMaxWidth: 330, infoStep: true },
        // ==== 段 E：净化教程 + 升级（Turn 2 P0 main1） ====
        {
            id: 'knockdown-explain',
            content: 'game-dicethrone:tutorial.steps.knockdownExplain',
            highlightTarget: 'status-tokens',
            position: 'right',
            infoStep: true,
        },
        { id: 'purify-rule', content: 'game-dicethrone:tutorial.steps.purify-rule', highlightTarget: 'status-tokens', position: 'left', infoStep: true },
        {
            id: 'purify-use',
            content: 'game-dicethrone:tutorial.steps.purifyUse',
            highlightTarget: 'status-tokens',
            position: 'top',
            tooltipMaxWidth: 300,
            requireAction: true,
            allowManualSkip: false,
            allowedCommands: ['USE_PURIFY', 'USE_TOKEN'],
            advanceOnEvents: [
                { type: 'TOKEN_USED', match: { playerId: '0', tokenId: TOKEN_IDS.PURIFY, effectType: 'removeDebuff' } },
                { type: 'STATUS_REMOVED', match: { targetId: '0', statusId: STATUS_IDS.KNOCKDOWN } },
            ],
        },
        { id: 'purify-result', content: 'game-dicethrone:tutorial.steps.purify-result', highlightTarget: 'status-tokens', position: 'left', infoStep: true },
        { id: 'upgrade-rule', content: 'game-dicethrone:tutorial.steps.upgrade-rule', highlightTarget: 'hand-area', position: 'top', infoStep: true },
        {
            id: 'meditation-2',
            content: 'game-dicethrone:tutorial.steps.meditation2',
            highlightTarget: 'hand-card-card-meditation-2',
            position: 'top',
            requireAction: true,
            allowedCommands: ['PLAY_CARD', 'PLAY_UPGRADE_CARD', 'SELL_CARD', 'REORDER_CARD_TO_END'],
            advanceOnEvents: [
                { type: 'ABILITY_REPLACED', match: { playerId: '0', oldAbilityId: 'meditation' } },
            ],
        },
        { id: 'upgrade-result', content: 'game-dicethrone:tutorial.steps.upgrade-result', highlightTarget: 'player-board', position: 'left', infoStep: true },
        {
            id: 'finish',
            content: 'game-dicethrone:tutorial.steps.finish',
            position: 'center',
            infoStep: true,
        },
    ]),
};

const DiceThroneTutorials: TutorialCollection = {
    defaultTutorialId: DiceThroneTutorial.id,
    tutorials: {
        [DiceThroneTutorial.id]: { titleKey: 'tutorial.chapters.basic', manifest: DiceThroneTutorial },
        [DiceThroneResponsePractice.id]: { titleKey: 'tutorial.chapters.response', manifest: DiceThroneResponsePractice },
        [DiceThroneDiscardPractice.id]: { titleKey: 'tutorial.chapters.limit', manifest: DiceThroneDiscardPractice },
        [DiceThroneUltimatePractice.id]: { titleKey: 'tutorial.chapters.ultimate', manifest: DiceThroneUltimatePractice },
        [DiceThroneDamagePractice.id]: { titleKey: 'tutorial.chapters.damage', manifest: DiceThroneDamagePractice },
        [DiceThroneUpgradePractice.id]: { titleKey: 'tutorial.chapters.upgrade', manifest: DiceThroneUpgradePractice },
        [DiceThroneStraightPractice.id]: { titleKey: 'tutorial.chapters.straight', manifest: DiceThroneStraightPractice },
        [DiceThroneKnockdownPractice.id]: { titleKey: 'tutorial.chapters.knockdown', manifest: DiceThroneKnockdownPractice },
    },
};

export default DiceThroneTutorials;
