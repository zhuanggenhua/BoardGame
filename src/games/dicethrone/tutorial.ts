import type { TutorialManifest, TutorialEventMatcher } from '../../engine/types';
import { TOKEN_IDS, STATUS_IDS } from './domain/ids';
import { MONK_CARDS } from './heroes/monk/cards';

// ============================================================================
// 牌组配置
// ============================================================================

/** 玩家起手牌（教程流程顺序） */
const TUTORIAL_STARTING_HAND = [
    'card-play-six',
    'card-enlightenment',
    'card-inner-peace',
    'card-meditation-2',
];

/** AI 起手牌（保证 card-palm-strike 在手中） */
const AI_STARTING_HAND = [
    'card-palm-strike',
    'card-inner-peace',
    'card-inner-peace',
    'card-boss-generous',
];

const buildTutorialDeck = (startingHand: string[]): string[] => {
    const baseDeck = MONK_CARDS.flatMap(card => (card.type === 'upgrade' ? [card.id] : [card.id, card.id]));
    const remaining = [...baseDeck];
    startingHand.forEach(id => {
        const index = remaining.indexOf(id);
        if (index !== -1) remaining.splice(index, 1);
    });
    return [...startingHand, ...remaining];
};

const TUTORIAL_INITIAL_DECK = buildTutorialDeck(TUTORIAL_STARTING_HAND);
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

const MATCH_PHASE_MAIN1: TutorialEventMatcher = {
    type: 'SYS_PHASE_CHANGED',
    match: { to: 'main1' },
};

// ============================================================================
// 教程定义
// ============================================================================

export const DiceThroneTutorial: TutorialManifest = {
    id: 'dicethrone-basic',
    randomPolicy: {
        mode: 'fixed',
        values: [6],
    },
    steps: [
        // ==== 段 A：初始化 + UI 介绍 ====
        {
            id: 'setup',
            content: 'game-dicethrone:tutorial.steps.setup',
            position: 'center',
            requireAction: false,
            showMask: true,
            aiActions: [
                { commandType: 'SELECT_CHARACTER', payload: { characterId: 'monk', initialDeckCardIds: TUTORIAL_INITIAL_DECK } },
                { commandType: 'SELECT_CHARACTER', playerId: '1', payload: { characterId: 'monk', initialDeckCardIds: AI_TUTORIAL_DECK } },
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
        {
            id: 'hand',
            content: 'game-dicethrone:tutorial.steps.hand',
            highlightTarget: 'hand-area',
            position: 'top',
            infoStep: true,
        },
        {
            id: 'discard',
            content: 'game-dicethrone:tutorial.steps.discard',
            highlightTarget: 'discard-pile',
            position: 'left',
            infoStep: true,
        },
        {
            id: 'status-tokens',
            content: 'game-dicethrone:tutorial.steps.statusTokens',
            highlightTarget: 'status-tokens',
            position: 'right',
            infoStep: true,
        },

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
            id: 'dice-tray',
            content: 'game-dicethrone:tutorial.steps.dice',
            highlightTarget: 'dice-tray',
            position: 'left',
            infoStep: true,
        },
        {
            id: 'dice-roll',
            content: 'game-dicethrone:tutorial.steps.rollButton',
            highlightTarget: 'dice-roll-button',
            position: 'left',
            requireAction: true,
            allowedCommands: ['ROLL_DICE'],
            advanceOnEvents: [{ type: 'DICE_ROLLED' }],
        },
        {
            id: 'play-six',
            content: 'game-dicethrone:tutorial.steps.playSix',
            highlightTarget: 'hand-area',
            position: 'top',
            requireAction: true,
            allowedCommands: ['PLAY_CARD', 'MODIFY_DIE'],
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
            allowedCommands: ['CONFIRM_ROLL', 'CONFIRM_INTERACTION'],
            advanceOnEvents: [{ type: 'ROLL_CONFIRMED' }],
        },
        {
            id: 'abilities',
            content: 'game-dicethrone:tutorial.steps.abilities',
            highlightTarget: 'ability-slots',
            position: 'left',
            requireAction: true,
            allowedCommands: ['SELECT_ABILITY'],
            advanceOnEvents: [{ type: 'ABILITY_ACTIVATED' }],
        },
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
            id: 'opponent-defense',
            content: 'game-dicethrone:tutorial.steps.opponentDefense',
            position: 'center',
            requireAction: false,
            aiActions: [
                { commandType: 'ROLL_DICE', playerId: '1', payload: {} },
                { commandType: 'CONFIRM_ROLL', playerId: '1', payload: {} },
                { commandType: 'ADVANCE_PHASE', playerId: '0', payload: {} },
            ],
            advanceOnEvents: [MATCH_PHASE_MAIN2],
        },

        // ==== 段 C：卡牌介绍 + AI 回合 ====
        {
            id: 'card-enlightenment',
            content: 'game-dicethrone:tutorial.steps.cardEnlightenment',
            highlightTarget: 'hand-area',
            position: 'top',
            infoStep: true,
        },
        {
            id: 'ai-turn',
            content: 'game-dicethrone:tutorial.steps.aiTurn',
            position: 'center',
            requireAction: false,
            aiActions: [
                // 结束 P0 当前回合 (main2 → discard → auto-chain → P1 main1)
                { commandType: 'ADVANCE_PHASE', playerId: '0', payload: {} },
                { commandType: 'ADVANCE_PHASE', playerId: '0', payload: {} },
                // AI 在 main1 打出掌击（对 P0 施加击倒 + 触发卡牌特写）
                { commandType: 'PLAY_CARD', playerId: '1', payload: { cardId: 'card-palm-strike' } },
                // AI 推进到攻击掷骰
                { commandType: 'ADVANCE_PHASE', playerId: '1', payload: {} },
                // AI 掷骰 + 确认（全1 = 5拳 → 拳法-5, 8伤害）
                { commandType: 'ROLL_DICE', playerId: '1', payload: {} },
                { commandType: 'CONFIRM_ROLL', playerId: '1', payload: {} },
                { commandType: 'SELECT_ABILITY', playerId: '1', payload: { abilityId: 'fist-technique-5' } },
                // 进入防御（自动选中清修），P0 掷骰防御
                { commandType: 'ADVANCE_PHASE', playerId: '1', payload: {} },
                { commandType: 'ROLL_DICE', playerId: '0', payload: {} },
                { commandType: 'CONFIRM_ROLL', playerId: '0', payload: {} },
                // 结算攻击 → P1 main2
                { commandType: 'ADVANCE_PHASE', playerId: '0', payload: {} },
                // 结束 AI 回合 (main2 → discard → auto-chain → P0 main1)
                { commandType: 'ADVANCE_PHASE', playerId: '1', payload: {} },
                { commandType: 'ADVANCE_PHASE', playerId: '1', payload: {} },
            ],
            advanceOnEvents: [
                { type: 'SYS_TUTORIAL_AI_CONSUMED', match: { stepId: 'ai-turn' } },
            ],
        },

        // ==== 段 D：净化教程（通过自然游戏流） ====
        {
            id: 'knockdown-explain',
            content: 'game-dicethrone:tutorial.steps.knockdownExplain',
            highlightTarget: 'status-tokens',
            position: 'right',
            infoStep: true,
        },
        {
            id: 'enlightenment-play',
            content: 'game-dicethrone:tutorial.steps.enlightenmentPlay',
            highlightTarget: 'hand-area',
            position: 'top',
            requireAction: true,
            allowedCommands: ['PLAY_CARD', 'SELL_CARD', 'REORDER_CARD_TO_END'],
            advanceOnEvents: [
                { type: 'CARD_PLAYED', match: { playerId: '0', cardId: 'card-enlightenment' } },
            ],
        },
        {
            id: 'purify-use',
            content: 'game-dicethrone:tutorial.steps.purifyUse',
            highlightTarget: 'status-tokens',
            position: 'right',
            requireAction: true,
            allowManualSkip: false,
            allowedCommands: ['USE_PURIFY', 'USE_TOKEN'],
            advanceOnEvents: [
                { type: 'TOKEN_USED', match: { playerId: '0', tokenId: TOKEN_IDS.PURIFY, effectType: 'removeDebuff' } },
                { type: 'STATUS_REMOVED', match: { targetId: '0', statusId: STATUS_IDS.KNOCKDOWN } },
            ],
        },

        // ==== 段 E：补充卡牌教学 ====
        {
            id: 'inner-peace',
            content: 'game-dicethrone:tutorial.steps.innerPeace',
            highlightTarget: 'hand-area',
            position: 'top',
            requireAction: true,
            allowedCommands: ['PLAY_CARD', 'SELL_CARD', 'REORDER_CARD_TO_END'],
            advanceOnEvents: [
                { type: 'CARD_PLAYED', match: { playerId: '0', cardId: 'card-inner-peace' } },
            ],
        },
        {
            id: 'meditation-2',
            content: 'game-dicethrone:tutorial.steps.meditation2',
            highlightTarget: 'hand-area',
            position: 'top',
            requireAction: true,
            allowedCommands: ['PLAY_CARD', 'SELL_CARD', 'REORDER_CARD_TO_END'],
            advanceOnEvents: [
                { type: 'ABILITY_REPLACED', match: { playerId: '0', oldAbilityId: 'meditation' } },
            ],
        },
        {
            id: 'finish',
            content: 'game-dicethrone:tutorial.steps.finish',
            position: 'center',
            infoStep: true,
        },
    ],
};

export default DiceThroneTutorial;
