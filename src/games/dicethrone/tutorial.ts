import { withDiceThroneTutorialSurfaces } from './tutorialLayout';
import type { TutorialCollection, TutorialHiddenAutomationContract, TutorialManifest, TutorialEventMatcher } from '../../engine/types';
import { TOKEN_IDS } from './domain/ids';
import { MONK_CARDS } from './heroes/monk/cards';
import { DiceThroneDiscardPractice } from './tutorialPractices';

const setupPrecondition = (reason: string): TutorialHiddenAutomationContract => ({
    kind: 'setup-precondition',
    reason,
});

// ============================================================================
// 牌组配置
// ============================================================================

/** 玩家起手牌：主阶段行动牌、即时牌、掷骰响应牌与出售对象各有用途。 */
const TUTORIAL_STARTING_HAND = [
    'card-one-throw-fortune', // M 标记主阶段行动：掷 1 骰获得 CP
    'card-double',            // 即时牌抽到升级牌
    'card-give-hand',         // 对手确认攻击骰后重掷 1 骰
    'card-palm-strike',       // 主阶段出售，筹出响应牌费用
];

/** 加倍抽到与本次进攻能力对应的升级牌；之后仍使用同一合法牌库。 */
const TUTORIAL_DECK_TOP = [
    'card-thrust-punch-2', // 加倍抽到；主要阶段花 2 CP 升级冲拳
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
    revision: 19,
    randomPolicy: {
        mode: 'fixed',
        values: [6],
    },
    stepValidator: (state, step) => {
        const core = state.core as import('./domain/types').DiceThroneCore;
        if (step.id === 'opponent-token-response') return core.pendingDamage?.responderId === '1';
        if (step.id === 'token-response') return core.pendingDamage?.responderId === '0' && (core.players['0'].tokens[TOKEN_IDS.TAIJI] ?? 0) > 0;
        if (step.id === 'sale-branch-recovery') return !core.players['0'].hand.some(card => card.id === 'card-give-hand');
        if (step.id === 'ability-branch-recovery') return state.sys.phase === 'main2' && !core.pendingAttack;
        if (step.id === 'double-play') return core.players['0'].hand.some(card => card.id === 'card-double');
        return true;
    },
    steps: withDiceThroneTutorialSurfaces([
        {
            id: 'setup', content: 'game-dicethrone:tutorial.steps.setup', position: 'center', requireAction: false, showMask: true,
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
        { id: 'intro', content: 'game-dicethrone:tutorial.steps.intro', highlightTarget: 'opponent-health', position: 'bottom', requireAction: false, showMask: true, infoStep: true },
        {
            id: 'double-play', content: 'game-dicethrone:tutorial.steps.doublePlay', highlightTarget: 'hand-card-card-double', highlightFrame: 'none',
            position: 'top', requireAction: true, allowedCommands: ['PLAY_CARD'],
            advanceOnEvents: [{ type: 'CARD_PLAYED', match: { playerId: '0', cardId: 'card-double' } }],
        },
        {
            id: 'one-throw-play', randomPolicy: { mode: 'fixed', values: [1] },
            content: 'game-dicethrone:tutorial.steps.one-throw-play', highlightTarget: 'hand-card-card-one-throw-fortune', highlightFrame: 'none',
            position: 'top', requireAction: true, allowedCommands: ['PLAY_CARD'],
            advanceOnEvents: [{ type: 'CARD_PLAYED', match: { playerId: '0', cardId: 'card-one-throw-fortune' } }],
        },
        {
            id: 'one-throw-confirm', randomPolicy: { mode: 'fixed', values: [1] },
            content: 'game-dicethrone:tutorial.steps.one-throw-confirm', highlightTarget: 'dice-confirm-button',
            position: 'left', requireAction: true, allowedCommands: ['CONFIRM_ROLL', 'SYS_INTERACTION_RESPOND', 'SYS_INTERACTION_CONFIRM'],
            advanceOnEvents: [{ type: 'BONUS_DICE_SETTLED' }],
        },
        {
            id: 'upgrade-card', content: 'game-dicethrone:tutorial.steps.upgradeCard', highlightTarget: 'hand-card-card-thrust-punch-2', highlightFrame: 'none',
            position: 'top', requireAction: true, allowedCommands: ['PLAY_CARD', 'PLAY_UPGRADE_CARD', 'SELL_CARD', 'REORDER_CARD_TO_END'],
            advanceOnEvents: [{ type: 'ABILITY_REPLACED', match: { playerId: '0', oldAbilityId: 'fist-technique' } }],
        },
        { id: 'advance', content: 'game-dicethrone:tutorial.steps.advance', highlightTarget: 'advance-phase-button', position: 'left', requireAction: true, allowedCommands: ['ADVANCE_PHASE'], advanceOnEvents: [MATCH_PHASE_OFFENSIVE] },
        {
            id: 'dice-play', randomPolicy: { mode: 'sequence', values: [1, 1, 1, 1, 3, 4] },
            content: 'game-dicethrone:tutorial.steps.dice-play', highlightTarget: 'dice-tray', position: 'left', requireAction: true, allowManualSkip: false,
            allowedCommands: ['ROLL_DICE'], advanceOnEvents: [{ type: 'DICE_ROLLED', match: { rollerId: '0' } }],
        },
        {
            id: 'dice-reroll', randomPolicy: { mode: 'sequence', values: [1, 1, 1, 1, 3, 4] },
            content: 'game-dicethrone:tutorial.steps.dice-reroll', highlightTarget: 'dice-tray', position: 'left', requireAction: true, allowManualSkip: false,
            allowedCommands: ['TOGGLE_DIE_LOCK', 'ROLL_DICE', 'CONFIRM_ROLL'], advanceOnEvents: [{ type: 'ROLL_CONFIRMED' }],
        },
        {
            id: 'abilities', content: 'game-dicethrone:tutorial.steps.abilities', highlightTarget: 'ability-slot-fist', highlightFrame: 'none', position: 'right', tooltipMaxWidth: 280,
            requireAction: true, allowedCommands: ['SELECT_ABILITY', 'ADVANCE_PHASE'], advanceOnEvents: [{ type: 'ABILITY_ACTIVATED' }, MATCH_PHASE_MAIN2],
        },
        {
            id: 'ability-branch-recovery', content: '', aiActions: [{ commandType: 'SYS_TUTORIAL_PREVIOUS', playerId: '0', payload: {} }],
            hiddenAutomation: { kind: 'branch-recovery', recoveryStepId: 'abilities', reason: '不发动能力是合法选择；恢复同一骰面，让首次攻防仍由玩家完成。' },
        },
        {
            id: 'resolve-attack', content: 'game-dicethrone:tutorial.steps.resolveAttack', highlightTarget: 'advance-phase-button', position: 'left',
            requireAction: true, allowedCommands: ['ADVANCE_PHASE'], advanceOnEvents: [MATCH_PHASE_DEFENSE, MATCH_PHASE_MAIN2],
        },
        {
            id: 'opponent-defense', randomPolicy: { mode: 'fixed', values: [4] }, content: 'game-dicethrone:tutorial.steps.opponentDefense', position: 'center',
            requireAction: false, allowManualSkip: true, infoStep: true,
            aiActions: [
                { commandType: 'ROLL_DICE', playerId: '1', payload: {} },
                { commandType: 'CONFIRM_ROLL', playerId: '1', payload: {} },
                { commandType: 'RESPONSE_PASS', playerId: '0', payload: {} },
                { commandType: 'ADVANCE_PHASE', playerId: '1', payload: {} },
                { commandType: 'SKIP_TOKEN_RESPONSE', playerId: '1', payload: { __tutorialChoiceCandidateId: 'skip' } },
            ],
            autoAdvanceAfterAi: false,
        },
        {
            id: 'sell-card-intro', content: 'game-dicethrone:tutorial.steps.sellCardIntro', highlightTarget: 'hand-card-card-palm-strike', position: 'top',
            requireAction: true, allowedCommands: ['SELL_CARD'],
            advanceOnEvents: [{ type: 'CARD_SOLD', match: { playerId: '0' } }],
        },
        {
            id: 'sale-branch-recovery', content: '', aiActions: [{ commandType: 'SYS_TUTORIAL_PREVIOUS', playerId: '0', payload: {} }],
            hiddenAutomation: { kind: 'branch-recovery', recoveryStepId: 'sell-card-intro', reason: '出售了后续响应所需的牌，恢复出售前完整检查点；正常主线只出售掌击筹费。' },
        },
        { id: 'response-control', content: 'game-dicethrone:tutorial.steps.response-control', highlightTarget: 'response-toggle', position: 'center', tooltipMaxWidth: 360, infoStep: true },
        {
            id: 'end-turn', content: 'game-dicethrone:tutorial.steps.end-turn', highlightTarget: 'advance-phase-button', position: 'left',
            requireAction: true, allowManualSkip: false, allowedCommands: ['ADVANCE_PHASE'], advanceOnEvents: [{ type: 'TURN_CHANGED' }],
        },
        {
            id: 'opponent-roll', randomPolicy: { mode: 'fixed', values: [1] }, content: 'game-dicethrone:tutorial.steps.opponent-roll', position: 'center',
            requireAction: false, allowManualSkip: true, infoStep: true, autoAdvanceAfterAi: false,
            aiActions: [
                { commandType: 'ADVANCE_PHASE', playerId: '1', payload: {} },
                { commandType: 'ROLL_DICE', playerId: '1', payload: {} },
                { commandType: 'CONFIRM_ROLL', playerId: '1', payload: {} },
            ],
        },
        {
            id: 'interference-play', content: 'game-dicethrone:tutorial.steps.interference-play', highlightTarget: 'hand-card-card-give-hand', highlightFrame: 'none',
            position: 'top', requireAction: true, allowedCommands: ['PLAY_CARD'],
            advanceOnEvents: [{ type: 'CARD_PLAYED', match: { playerId: '0', cardId: 'card-give-hand' } }],
        },
        {
            id: 'interference-target', randomPolicy: { mode: 'fixed', values: [6] },
            content: 'game-dicethrone:tutorial.steps.interference-target', highlightTarget: 'dice-tray', position: 'left', requireAction: true, allowManualSkip: false,
            allowedCommands: ['REROLL_DIE', 'SYS_INTERACTION_CONFIRM'],
            advanceOnEvents: [{ type: 'DIE_REROLLED', match: { playerId: '0', sourceCardId: 'card-give-hand' } }],
        },
        {
            id: 'defense-start', content: 'game-dicethrone:tutorial.steps.defense-start', highlightTarget: 'defense-start-button', position: 'left',
            requireAction: true, allowManualSkip: true, allowedCommands: ['CONFIRM_ROLL', 'SELECT_ABILITY', 'ADVANCE_PHASE', 'REROLL_DIE'],
            aiActions: [
                { commandType: 'CONFIRM_ROLL', playerId: '1', payload: {} },
                { commandType: 'SELECT_ABILITY', playerId: '1', payload: { abilityId: 'fist-technique-4' } },
                { commandType: 'ADVANCE_PHASE', playerId: '1', payload: {} },
            ],
            autoAdvanceAfterAi: false,
        },
        {
            id: 'defense-roll', randomPolicy: { mode: 'fixed', values: [4] }, content: 'game-dicethrone:tutorial.steps.defense-roll', highlightTarget: 'dice-roll-button',
            position: 'left', requireAction: true, allowManualSkip: false,
            allowedCommands: ['ROLL_DICE', 'CONFIRM_ROLL'], advanceOnEvents: [{ type: 'ROLL_CONFIRMED' }],
        },
        {
            id: 'defense-resolve', content: 'game-dicethrone:tutorial.steps.defenseResolve', highlightTarget: 'advance-phase-button', position: 'left',
            requireAction: true, allowManualSkip: false, allowedCommands: ['ADVANCE_PHASE'], advanceOnEvents: [{ type: 'TOKEN_RESPONSE_REQUESTED' }],
        },
        {
            id: 'opponent-token-response', content: 'game-dicethrone:tutorial.steps.opponent-token-response', position: 'center',
            requireAction: false, allowManualSkip: true, infoStep: true, autoAdvanceAfterAi: false,
            aiActions: [{ commandType: 'SKIP_TOKEN_RESPONSE', playerId: '1', payload: { __tutorialChoiceCandidateId: 'skip' } }],
        },
        {
            id: 'token-response', content: 'game-dicethrone:tutorial.steps.token-response', highlightTarget: 'status-tokens', position: 'left',
            requireAction: true, allowManualSkip: false,
            allowedCommands: ['USE_TOKEN', 'SKIP_TOKEN_RESPONSE', 'SYS_INTERACTION_RESPOND', 'SYS_INTERACTION_CONFIRM'],
            advanceOnEvents: [{ type: 'TOKEN_RESPONSE_CLOSED' }],
        },
        {
            id: 'income-result', content: 'game-dicethrone:tutorial.steps.income-result', highlightTarget: 'hand-area', position: 'top', infoStep: true, allowManualSkip: true,
            aiActions: [
                { commandType: 'ADVANCE_PHASE', playerId: '1', payload: {} },
                { commandType: 'ADVANCE_PHASE', playerId: '1', payload: {} },
            ],
            autoAdvanceAfterAi: false,
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
