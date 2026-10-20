import { withDiceThroneTutorialSurfaces } from './tutorialLayout';
import type { TutorialCollection, TutorialHiddenAutomationContract, TutorialManifest, TutorialEventMatcher } from '../../engine/types';
import { TOKEN_IDS, STATUS_IDS } from './domain/ids';
import { MONK_CARDS } from './heroes/monk/cards';
import { DiceThroneDiscardPractice } from './tutorialPractices';

const setupPrecondition = (reason: string): TutorialHiddenAutomationContract => ({
    kind: 'setup-precondition',
    reason,
});

// ============================================================================
// 牌组配置
// ============================================================================

/** 玩家起手牌（教程流程顺序） */
const TUTORIAL_STARTING_HAND = [
    'card-enlightenment',  // 蓝框牌与奖励骰；真实获得后续要用的状态标记
    'card-double',         // 付费即时牌；抽到升级牌并保留响应预算
    'card-give-hand',      // 对手进攻掷骰后响应教学用
    'card-palm-strike',    // 抽到升级牌后出售换 CP，兼顾升级与响应预算
];

/** 加倍抽到升级牌和静心；之后收入继续使用同一合法牌库。 */
const TUTORIAL_DECK_TOP = [
    'card-meditation-2',   // 加倍抽到，保留至下一收入后升级
    'card-inner-peace',
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

// ============================================================================
// 教程定义
// ============================================================================

export const DiceThroneTutorial: TutorialManifest = {
    id: 'dicethrone-basic',
    playerId: '0',
    revision: 15,
    randomPolicy: {
        mode: 'fixed',
        values: [6],
    },
    stepValidator: (state, step) => {
        if (step.id === 'opponent-defense-response-pass') return Boolean(state.sys.responseWindow?.current);
        const core = state.core as import('./domain/types').DiceThroneCore;
        if (step.id === 'token-response-pass' || step.id === 'attack-token-pass') return Boolean(core.pendingDamage);
        if (step.id === 'sale-branch-recovery') return ['card-meditation-2', 'card-give-hand'].some(id => !core.players['0'].hand.some(card => card.id === id));
        if (step.id === 'ability-branch-recovery') return state.sys.phase === 'main2' && !core.pendingAttack;
        if (step.id === 'double-play') return core.players['0'].hand.some(card => card.id === 'card-double');
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
            highlightTarget: 'opponent-health',
            position: 'bottom',
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
        { id: 'hand-inspect', content: 'game-dicethrone:tutorial.steps.hand-inspect', highlightTarget: 'hand-card-card-enlightenment', position: 'top', requireAction: true, allowedCommands: [] },

        // ==== 段 A2：蓝框牌与状态的真实来源 ====
        { id: 'main-actions-rule', content: 'game-dicethrone:tutorial.steps.main-actions-rule', highlightTarget: 'hand-area', position: 'top', infoStep: true },
        {
            id: 'enlightenment-play', randomPolicy: { mode: 'fixed', values: [6] },
            content: 'game-dicethrone:tutorial.steps.enlightenmentPlay', highlightTarget: 'hand-card-card-enlightenment',
            position: 'top', requireAction: true, allowedCommands: ['PLAY_CARD'],
            advanceOnEvents: [{ type: 'CARD_PLAYED', match: { playerId: '0', cardId: 'card-enlightenment' } }],
        },
        {
            id: 'enlightenment-confirm', content: 'game-dicethrone:tutorial.steps.enlightenmentConfirm',
            highlightTarget: 'dice-confirm-button', position: 'left', requireAction: true, allowManualSkip: false,
            allowedCommands: ['CONFIRM_ROLL'], advanceOnEvents: [{ type: 'BONUS_DICE_SETTLED' }],
        },
        { id: 'status-tokens', content: 'game-dicethrone:tutorial.steps.statusTokens', highlightTarget: 'status-tokens', position: 'right', infoStep: true },
        { id: 'response-control', content: 'game-dicethrone:tutorial.steps.response-control', highlightTarget: 'response-toggle', position: 'center', tooltipMaxWidth: 400, infoStep: true },
        // ==== 段 B：首次攻击 (Turn 1, P0) ====
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
            id: 'dice-reroll', randomPolicy: { mode: 'sequence', values: [2, 3, 4, 5] }, content: 'game-dicethrone:tutorial.steps.dice-reroll', highlightTarget: 'dice-roll-button',
            position: 'left', requireAction: true, allowManualSkip: false,
            allowedCommands: ["ROLL_DICE","TOGGLE_DIE_LOCK"], advanceOnEvents: [{ type: 'DICE_ROLLED' }],
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
        { id: 'ability-rule', content: 'game-dicethrone:tutorial.steps.ability-rule', highlightTarget: 'ability-slots', position: 'right', tooltipMaxWidth: 280, infoStep: true },
        {
            id: 'abilities',
            content: 'game-dicethrone:tutorial.steps.abilities',
            highlightTarget: 'ability-slots',
            position: 'right',
            tooltipMaxWidth: 280,
            requireAction: true,
            allowedCommands: ['SELECT_ABILITY', 'ADVANCE_PHASE'],
            advanceOnEvents: [{ type: 'ABILITY_ACTIVATED' }, MATCH_PHASE_MAIN2],
        },
        {
            id: 'ability-branch-recovery', content: '',
            aiActions: [{ commandType: 'SYS_TUTORIAL_PREVIOUS', playerId: '0', payload: {} }],
            hiddenAutomation: {
                kind: 'branch-recovery', recoveryStepId: 'abilities',
                reason: '不发动能力是合法选择；恢复能力选择前的完整检查点，让首次攻防教学仍有真实来源。',
            },
        },
        { id: 'attack-rule', content: 'game-dicethrone:tutorial.steps.attack-rule', highlightTarget: 'ability-slots', position: 'left', tooltipMaxWidth: 420, infoStep: true },
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
            id: 'opponent-defense', randomPolicy: { mode: 'fixed', values: [6] },
            content: 'game-dicethrone:tutorial.steps.opponentDefense',
            position: 'center',
            requireAction: false,
            allowManualSkip: true,
            aiActions: [
                { commandType: 'ROLL_DICE', playerId: '1', payload: {} },
                { commandType: 'CONFIRM_ROLL', playerId: '1', payload: {} },
            ],
            autoAdvanceAfterAi: false,
        },
        { id: 'opponent-defense-response-rule', content: 'game-dicethrone:tutorial.steps.opponent-defense-response-rule', position: 'center', infoStep: true },
        {
            id: 'opponent-defense-response-pass', content: 'game-dicethrone:tutorial.steps.opponent-defense-response-pass', highlightTarget: 'response-pass-button',
            position: 'left', requireAction: true, allowManualSkip: false,
            allowedCommands: ['RESPONSE_PASS'], advanceOnEvents: [{ type: 'RESPONSE_WINDOW_CLOSED' }],
        },
        {
            id: 'opponent-defense-resolve', content: 'game-dicethrone:tutorial.steps.opponent-defense-resolve',
            position: 'center', requireAction: false, allowManualSkip: true, autoAdvanceAfterAi: false,
            aiActions: [{ commandType: 'ADVANCE_PHASE', playerId: '1', payload: {} }],
        },
        {
            id: 'attack-token-pass', content: 'game-dicethrone:tutorial.steps.attackTokenPass',
            highlightTarget: 'response-pass-button', position: 'left', requireAction: true, allowManualSkip: false,
            allowedCommands: ['SKIP_TOKEN_RESPONSE', 'SYS_INTERACTION_RESPOND', 'SYS_INTERACTION_CONFIRM'],
            advanceOnEvents: [{ type: 'TOKEN_RESPONSE_CLOSED' }],
        },
        { id: 'main2-return', content: 'game-dicethrone:tutorial.steps.main2Return', highlightTarget: 'phase-indicator', position: 'right', infoStep: true },
        {
            id: 'double-play',
            content: 'game-dicethrone:tutorial.steps.doublePlay',
            highlightTarget: 'hand-card-card-double',
            position: 'top', requireAction: true,
            allowedCommands: ['PLAY_CARD'],
            advanceOnEvents: [
                { type: 'CARD_PLAYED', match: { playerId: '0', cardId: 'card-double' } },
            ],
        },
        { id: 'draw-result', content: 'game-dicethrone:tutorial.steps.drawResult', highlightTarget: 'hand-card-card-meditation-2', position: 'top', infoStep: true },
        {
            id: 'sell-card-intro',
            content: 'game-dicethrone:tutorial.steps.sellCardIntro',
            highlightTarget: 'hand-card-card-palm-strike',
            position: 'top',
            requireAction: true,
            allowedCommands: ['SELL_CARD', 'UNDO_SELL_CARD'],
            advanceOnEvents: [
                { type: 'CARD_SOLD', match: { playerId: '0', cardId: 'card-palm-strike' } },
            ],
        },
        {
            id: 'sale-branch-recovery', content: '',
            aiActions: [{ commandType: 'SYS_TUTORIAL_PREVIOUS', playerId: '0', payload: {} }],
            hiddenAutomation: {
                kind: 'branch-recovery', recoveryStepId: 'sell-card-intro',
                reason: '连续出售非推荐牌后缺少后续必需对象，恢复出售前完整检查点；单次出售可在正式弃牌堆亲手撤回。',
            },
        },
        // ==== 弃牌与对手回合 ====
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
            ],
        },
        {
            id: 'interference-play', content: 'game-dicethrone:tutorial.steps.interference-play', highlightTarget: 'hand-card-card-give-hand',
            position: 'top', requireAction: true, allowedCommands: ['PLAY_CARD'],
            advanceOnEvents: [{ type: 'CARD_PLAYED', match: { playerId: '0', cardId: 'card-give-hand' } }],
        },
        {
            id: 'interference-target', content: 'game-dicethrone:tutorial.steps.interference-target', highlightTarget: 'dice-tray',
            position: 'left', requireAction: true, allowManualSkip: false, allowedCommands: [],
        },
        {
            id: 'interference-confirm', randomPolicy: { mode: 'fixed', values: [6] }, content: 'game-dicethrone:tutorial.steps.interference-confirm', highlightTarget: 'dice-tray',
            position: 'left', requireAction: true, allowManualSkip: false,
            allowedCommands: ['REROLL_DIE', 'SYS_INTERACTION_CONFIRM'], advanceOnEvents: [{ type: 'SYS_INTERACTION_CONFIRMED' }],
        },
        { id: 'interference-result', content: 'game-dicethrone:tutorial.steps.interference-result', highlightTarget: 'dice-tray', position: 'left', infoStep: true },
        {
            id: 'response-finish', content: 'game-dicethrone:tutorial.steps.response-finish', position: 'center',
            requireAction: false, allowManualSkip: true, autoAdvanceAfterAi: false,
            aiActions: [
                { commandType: 'CONFIRM_ROLL', playerId: '1', payload: {} },
                { commandType: 'SELECT_ABILITY', playerId: '1', payload: { abilityId: 'fist-technique-4' } },
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
            id: 'defense-roll', randomPolicy: { mode: 'fixed', values: [4] }, content: 'game-dicethrone:tutorial.steps.defense-roll', highlightTarget: 'dice-roll-button',
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
        {
            id: 'opponent-end-turn', content: 'game-dicethrone:tutorial.steps.opponentEndTurn', position: 'center',
            requireAction: false, allowManualSkip: true, autoAdvanceAfterAi: false,
            aiActions: [
                { commandType: 'ADVANCE_PHASE', playerId: '1', payload: {} },
                { commandType: 'ADVANCE_PHASE', playerId: '1', payload: {} },
            ],
        },
        { id: 'income-result', content: 'game-dicethrone:tutorial.steps.income-result', highlightTarget: 'hand-card-card-meditation-2', position: 'top', tooltipMaxWidth: 330, infoStep: true },
        // ==== 段 E：净化保留进攻权与 CP，再升级（Turn 3 P0 main1） ====
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
            requireAction: true,
            allowManualSkip: false,
            allowedCommands: ['USE_PURIFY', 'USE_TOKEN'],
            advanceOnEvents: [{ type: 'STATUS_REMOVED', match: { targetId: '0', statusId: STATUS_IDS.KNOCKDOWN } }],
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
        [DiceThroneDiscardPractice.id]: { titleKey: 'tutorial.chapters.limit', manifest: DiceThroneDiscardPractice },
    },
};

export default DiceThroneTutorials;
