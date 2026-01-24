import type { Ctx, Game } from 'boardgame.io';
import type {
    DiceThroneState,
    Die,
    HeroState,
} from './types';
import { MONK_STATUS_EFFECTS } from './monk/statusEffects';
import { MONK_ABILITIES } from './monk/abilities';
import { getMonkStartingDeck } from './monk/cards';
import { abilityManager, type AbilityContext, type EffectResolutionContext, type AbilityEffect, type GameContext, type EffectResolutionConfig } from '../../systems/AbilitySystem';

const INITIAL_HEALTH = 50;
const INITIAL_CP = 10; // TODO: 测试完成后改回0
const CP_MAX = 15;
const HAND_LIMIT = 6;

const PHASE_ORDER: DiceThroneState['turnPhase'][] = [
    'upkeep',
    'income',
    'main1',
    'offensiveRoll',
    'defensiveRoll',
    'main2',
    'discard',
];

// 注册僧侣技能到全局管理器
abilityManager.registerAbilities(MONK_ABILITIES);

const getDieFace = (value: number) => {
    if (value === 1 || value === 2) return 'fist';
    if (value === 3) return 'palm';
    if (value === 4 || value === 5) return 'taiji';
    return 'lotus';
};

const getFaceCounts = (dice: Die[]) => {
    return dice.reduce(
        (acc, die) => {
            const face = getDieFace(die.value);
            acc[face] += 1;
            return acc;
        },
        { fist: 0, palm: 0, taiji: 0, lotus: 0 }
    );
};

const setLastEffectSource = (G: DiceThroneState, playerId: string | undefined, sourceAbilityId?: string) => {
    if (!playerId || !sourceAbilityId) return;
    const sourceMap = G.lastEffectSourceByPlayerId ?? (G.lastEffectSourceByPlayerId = {});
    sourceMap[playerId] = sourceAbilityId;
};

const getActiveDice = (G: DiceThroneState) => G.dice.slice(0, G.rollDiceCount);

const getRollerId = (G: DiceThroneState): string => {
    if (G.turnPhase === 'defensiveRoll' && G.pendingAttack) {
        return G.pendingAttack.defenderId;
    }
    return G.activePlayerId;
};

const isMoveAllowed = (playerID: string | null | undefined, expectedId?: string) => {
    if (playerID === null || playerID === undefined) return true;
    return expectedId !== undefined && playerID === expectedId;
};

/**
 * 获取当前可用的技能 ID 列表
 * 使用通用 AbilitySystem 进行触发判断
 */
const getAvailableAbilityIds = (G: DiceThroneState, playerId: string): string[] => {
    const player = G.players[playerId];
    const dice = getActiveDice(G);
    const diceValues = dice.map(d => d.value);
    const faceCounts = getFaceCounts(dice);

    // 构建 AbilityContext
    const context: AbilityContext = {
        currentPhase: G.turnPhase,
        diceValues,
        faceCounts,
        resources: { cp: player.cp },
        statusEffects: player.statusEffects,
    };

    // 获取玩家技能 ID 列表
    const abilityIds = player.abilities.map(a => a.id);
    const expectedType = G.turnPhase === 'defensiveRoll'
        ? 'defensive'
        : G.turnPhase === 'offensiveRoll'
            ? 'offensive'
            : undefined;
    const filteredAbilityIds = expectedType
        ? abilityIds.filter(id => abilityManager.getDefinition(id)?.type === expectedType)
        : abilityIds;
    
    const available = abilityManager.getAvailableAbilities(filteredAbilityIds, context);
    if (G.turnPhase === 'defensiveRoll') {
        console.log('[DiceThrone][Defense] availableAbilities', {
            playerId,
            abilityIds,
            filteredAbilityIds,
            availableAbilityIds: available,
            context: {
                currentPhase: context.currentPhase,
                diceValues,
                faceCounts,
                resources: context.resources,
                statusEffects: context.statusEffects,
            },
        });
    }
    return available;
};

const getPlayerOrder = (G: DiceThroneState) => Object.keys(G.players);

const getNextPlayerId = (G: DiceThroneState) => {
    const order = getPlayerOrder(G);
    const currentIndex = order.indexOf(G.activePlayerId);
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % order.length;
    return order[nextIndex];
};

const resetDice = (G: DiceThroneState) => {
    G.dice.forEach((die, index) => {
        die.value = 1;
        die.isKept = index >= G.rollDiceCount ? true : false;
    });
};

const enterRollPhase = (G: DiceThroneState, diceCount: number, rollLimit: number) => {
    G.rollCount = 0;
    G.rollLimit = rollLimit;
    G.rollDiceCount = diceCount;
    G.rollConfirmed = false;
    G.availableAbilityIds = [];
    resetDice(G);
};

const queueChoice = (
    G: DiceThroneState,
    playerId: string,
    sourceAbilityId: string,
    options: Array<{ statusId: string; value: number }>,
    titleKey: string
) => {
    if (G.pendingChoice) return;
    G.pendingChoice = {
        id: `choice-${sourceAbilityId}-${G.turnNumber}-${playerId}`,
        playerId,
        sourceAbilityId,
        title: titleKey,
        options,
    };
};

/**
 * 获取技能的所有效果
 */
const getAbilityEffects = (abilityId: string): AbilityEffect[] => {
    // 检查是否是变体ID
    for (const ability of MONK_ABILITIES) {
        if (ability.variants) {
            const variant = ability.variants.find(v => v.id === abilityId);
            if (variant) return variant.effects;
        }
        if (ability.id === abilityId && ability.effects) {
            return ability.effects;
        }
    }
    return [];
};

const abilityHasDamage = (abilityId: string): boolean => {
    const effects = getAbilityEffects(abilityId);
    return effects.some(effect => effect.action?.type === 'damage' && (effect.action.value ?? 0) > 0);
};

/**
 * 创建游戏上下文（新版 API）
 * 实现 GameContext 接口，供 AbilityManager.resolveEffectsV2 使用
 */
const createGameContext = (G: DiceThroneState): GameContext => {
    return {
        applyDamage: (targetId: string, amount: number, sourceAbilityId?: string): number => {
            const target = G.players[targetId];
            if (!target) return 0;
            const beforeHealth = target.health;
            target.health = Math.max(0, target.health - amount);
            setLastEffectSource(G, targetId, sourceAbilityId);
            return Math.max(0, beforeHealth - target.health);
        },
        applyHeal: (targetId: string, amount: number, sourceAbilityId?: string): void => {
            const target = G.players[targetId];
            if (!target) return;
            target.health = Math.min(INITIAL_HEALTH, target.health + amount);
            setLastEffectSource(G, targetId, sourceAbilityId);
        },
        grantStatus: (targetId: string, statusId: string, stacks: number, sourceAbilityId?: string): void => {
            const target = G.players[targetId];
            if (!target) return;
            const currentStacks = target.statusEffects[statusId] || 0;
            const def = MONK_STATUS_EFFECTS.find(e => e.id === statusId);
            const maxStacks = def?.stackLimit || 99;
            target.statusEffects[statusId] = Math.min(currentStacks + stacks, maxStacks);
            setLastEffectSource(G, targetId, sourceAbilityId);
        },
        removeStatus: (targetId: string, statusId: string, stacks?: number, sourceAbilityId?: string): void => {
            const target = G.players[targetId];
            if (!target) return;
            const removeAmount = stacks ?? target.statusEffects[statusId] ?? 0;
            target.statusEffects[statusId] = Math.max(0, (target.statusEffects[statusId] || 0) - removeAmount);
            setLastEffectSource(G, targetId, sourceAbilityId);
        },
        getHealth: (targetId: string): number => {
            return G.players[targetId]?.health ?? 0;
        },
        getStatusStacks: (targetId: string, statusId: string): number => {
            return G.players[targetId]?.statusEffects[statusId] ?? 0;
        },
        executeCustomAction: (actionId: string, attackerId: string, defenderId: string, sourceAbilityId?: string): void => {
            const attacker = G.players[attackerId];
            const defender = G.players[defenderId];
            if (actionId === 'meditation-taiji') {
                const taijiCount = getFaceCounts(getActiveDice(G)).taiji;
                attacker.statusEffects.taiji = Math.min((attacker.statusEffects.taiji || 0) + taijiCount, 5);
                setLastEffectSource(G, attackerId, sourceAbilityId);
            } else if (actionId === 'meditation-damage') {
                const fistCount = getFaceCounts(getActiveDice(G)).fist;
                defender.health = Math.max(0, defender.health - fistCount);
                setLastEffectSource(G, defenderId, sourceAbilityId);
            }
        },
    };
};

const resolveOffensivePreDefenseEffects = (G: DiceThroneState) => {
    if (!G.pendingAttack || G.pendingAttack.preDefenseResolved) return;
    const { attackerId, defenderId, sourceAbilityId } = G.pendingAttack;
    if (!sourceAbilityId) {
        G.pendingAttack.preDefenseResolved = true;
        return;
    }

    const effects = getAbilityEffects(sourceAbilityId);
    if (import.meta.env.DEV) {
        console.info('[DiceThrone][PreDefense] effects', {
            attackerId,
            defenderId,
            sourceAbilityId,
            effectTypes: effects.map(effect => effect.action?.type ?? 'text'),
            timings: effects.map(effect => abilityManager.getEffectTiming(effect)),
        });
    }

    // 使用新版 API 结算 preDefense 时机的效果
    const resolutionCtx: EffectResolutionContext = {
        attackerId,
        defenderId,
        sourceAbilityId,
        damageDealt: 0,
        attackerStatusEffects: G.players[attackerId]?.statusEffects,
        defenderStatusEffects: G.players[defenderId]?.statusEffects,
    };
    const gameCtx = createGameContext(G);
    abilityManager.resolveEffects(effects, 'preDefense', resolutionCtx, gameCtx);

    // 特殊技能处理：禅忘的选择效果
    if (sourceAbilityId === 'zen-forget') {
        queueChoice(G, attackerId, sourceAbilityId, [
            { statusId: 'evasive', value: 1 },
            { statusId: 'purify', value: 1 },
        ], 'choices.evasiveOrPurify');
    }

    G.pendingAttack.preDefenseResolved = true;
};

/**
 * 结算攻击（使用条件系统）
 */
const resolveAttack = (G: DiceThroneState, options?: { includePreDefense?: boolean }): void => {
    if (!G.pendingAttack) return;

    const includePreDefense = options?.includePreDefense ?? false;
    if (includePreDefense) {
        resolveOffensivePreDefenseEffects(G);
        if (G.pendingChoice) return;
    }

    const { attackerId, defenderId, sourceAbilityId, defenseAbilityId } = G.pendingAttack;
    const bonusDamage = G.pendingAttack.bonusDamage ?? 0;

    // 创建结算上下文
    const resolutionCtx: EffectResolutionContext = {
        attackerId,
        defenderId,
        sourceAbilityId: sourceAbilityId ?? '',
        damageDealt: 0,
        attackerStatusEffects: G.players[attackerId]?.statusEffects,
        defenderStatusEffects: G.players[defenderId]?.statusEffects,
    };

    // 结算防御技能效果（使用新版 API）
    const gameCtx = createGameContext(G);
    if (defenseAbilityId) {
        const defenseEffects = getAbilityEffects(defenseAbilityId);
        const defenseCtx: EffectResolutionContext = {
            attackerId: defenderId,
            defenderId: attackerId,
            sourceAbilityId: defenseAbilityId,
            damageDealt: 0,
            attackerStatusEffects: G.players[defenderId]?.statusEffects,
            defenderStatusEffects: G.players[attackerId]?.statusEffects,
        };
        // 防御技能统一使用 withDamage 时机结算
        abilityManager.resolveEffects(defenseEffects, 'withDamage', defenseCtx, gameCtx);
        abilityManager.resolveEffects(defenseEffects, 'postDamage', defenseCtx, gameCtx);
    }

    // 结算进攻技能效果（使用新版 API）
    if (sourceAbilityId) {
        const effects = getAbilityEffects(sourceAbilityId);
        const config: EffectResolutionConfig = {
            bonusDamage,
            bonusDamageOnce: true,
        };

        // 1. 结算 withDamage 时机的效果（伤害）
        abilityManager.resolveEffects(effects, 'withDamage', resolutionCtx, gameCtx, config);

        if (import.meta.env.DEV) {
            console.info('[DiceThrone][Attack] damage resolved', {
                sourceAbilityId,
                damageDealt: resolutionCtx.damageDealt,
            });
        }

        // 2. 结算 postDamage 时机的效果（Then 语义，依赖 onHit 条件）
        abilityManager.resolveEffects(effects, 'postDamage', resolutionCtx, gameCtx);

        // 记录激活的技能ID（用于UI动画）
        G.activatingAbilityId = sourceAbilityId;
    } else if (defenseAbilityId) {
        G.activatingAbilityId = defenseAbilityId;
    }

    // 清除待处理攻击
    G.pendingAttack = null;
};


const buildPlayOrder = (ctx: Ctx): string[] => {
    if (Array.isArray(ctx.playOrder) && ctx.playOrder.length > 0) {
        return ctx.playOrder as string[];
    }
    return Array.from({ length: ctx.numPlayers }, (_, index) => index.toString());
};

export const DiceThroneGame: Game<DiceThroneState> = {
    name: 'dicethrone',

    // 占位版逻辑：仅初始化最小状态，确保游戏注册与大厅可运行。
    setup: ({ ctx }) => {
        const playOrder = buildPlayOrder(ctx);
        const players: Record<string, HeroState> = {};

        for (const pid of playOrder) {
            // 生成初始牌库并抽取起始手牌
            const deck = getMonkStartingDeck();
            const startingHand = deck.splice(0, 3); // 起始抽3张

            players[pid] = {
                id: `player-${pid}`,
                characterId: 'monk',
                health: INITIAL_HEALTH,
                cp: INITIAL_CP,
                hand: startingHand,
                deck,
                discard: [],
                statusEffects: {
                    evasive: 0,
                    taiji: 0,
                    stun: 0,
                    purify: 0,
                    chi: 0,
                },
                abilities: MONK_ABILITIES,
                abilityLevels: {
                    'fist-technique': 1,
                    'zen-forget': 1,
                    'harmony': 1,
                    'lotus-palm': 1,
                    'taiji-combo': 1,
                    'thunder-strike': 1,
                    'calm-water': 1,
                    'meditation': 1,
                },
            };
        }

        const dice: Die[] = Array.from({ length: 5 }, (_, index) => ({
            id: index,
            value: 1, // Default 1
            isKept: false,
        }));

        return {
            players,
            dice,
            rollCount: 0,
            rollLimit: 3,
            rollDiceCount: 5,
            rollConfirmed: false,
            turnPhase: 'upkeep',
            activePlayerId: playOrder[0],
            startingPlayerId: playOrder[0],
            turnNumber: 1,
            pendingAttack: null,
            pendingChoice: null,
            availableAbilityIds: [],
            statusDefinitions: MONK_STATUS_EFFECTS,
            lastEffectSourceByPlayerId: {},
        };
    },

    // 允许防御方在对手回合执行动作，具体权限由 move 内部校验
    turn: {
        activePlayers: { all: 'play' },
    },

    endIf: ({ G }) => {
        const playerIds = Object.keys(G.players);
        const defeated = playerIds.filter(id => G.players[id]?.health <= 0);
        if (defeated.length === 0) return undefined;
        if (defeated.length === playerIds.length) {
            return { draw: true };
        }
        if (defeated.length === 1) {
            const winner = playerIds.find(id => id !== defeated[0]);
            if (winner) return { winner };
        }
        return { draw: true };
    },

    moves: {
        rollDice: ({ G, random, playerID }) => {
            if (G.turnPhase !== 'offensiveRoll' && G.turnPhase !== 'defensiveRoll') return;
            const rollerId = getRollerId(G);
            if (!isMoveAllowed(playerID, rollerId)) {
                if (import.meta.env.DEV) {
                    console.warn('[DiceThrone][Roll] blocked: player mismatch', {
                        playerID,
                        rollerId,
                        turnPhase: G.turnPhase,
                    });
                }
                return;
            }
            // Roll specified dice (or all non-kept ones if we trusted state, 
            // but passing explicit IDs is safer/more explicit for the move)
            // Actually, typical implementation: Roll all !isKept.

            // Limit: Max 3 rolls (Standard Dice Throne Rule) using rollCount
            if (G.rollCount >= G.rollLimit) {
                if (import.meta.env.DEV) {
                    console.warn('[DiceThrone][Roll] blocked: limit reached', {
                        playerID,
                        rollerId,
                        rollCount: G.rollCount,
                        rollLimit: G.rollLimit,
                        turnPhase: G.turnPhase,
                    });
                }
                return;
            }

            G.rollConfirmed = false;
            G.availableAbilityIds = [];

            G.dice.slice(0, G.rollDiceCount).forEach(die => {
                if (!die.isKept) {
                    die.value = random.D6();
                }
            });

            G.rollCount++;
            G.availableAbilityIds = getAvailableAbilityIds(G, rollerId);
            if (G.turnPhase === 'defensiveRoll') {
                console.log('[DiceThrone][Defense] rollDice', {
                    rollerId,
                    availableAbilityIds: G.availableAbilityIds,
                });
            }
        },

        rollBonusDie: ({ G, playerID, random }) => {
            if (G.turnPhase !== 'offensiveRoll') return;
            if (!isMoveAllowed(playerID, G.activePlayerId)) return;
            if (!G.pendingAttack || G.pendingAttack.sourceAbilityId !== 'taiji-combo') return;
            if (G.pendingAttack.extraRoll?.resolved) return;

            const value = random.D6();
            G.pendingAttack.extraRoll = { value, resolved: true };

            const face = getDieFace(value);
            if (face === 'fist') {
                G.pendingAttack.bonusDamage = (G.pendingAttack.bonusDamage ?? 0) + 2;
            } else if (face === 'palm') {
                G.pendingAttack.bonusDamage = (G.pendingAttack.bonusDamage ?? 0) + 3;
            } else if (face === 'taiji') {
                const gameCtx = createGameContext(G);
                gameCtx.grantStatus(G.activePlayerId, 'taiji', 2, G.pendingAttack.sourceAbilityId);
            } else if (face === 'lotus') {
                queueChoice(G, G.activePlayerId, G.pendingAttack.sourceAbilityId, [
                    { statusId: 'evasive', value: 1 },
                    { statusId: 'purify', value: 1 },
                ], 'choices.evasiveOrPurify');
            }

            if (import.meta.env.DEV) {
                console.log('[DiceThrone][BonusRoll] taiji-combo', {
                    playerId: G.activePlayerId,
                    value,
                    face,
                    bonusDamage: G.pendingAttack.bonusDamage ?? 0,
                });
            }
        },

        toggleDieLock: ({ G, playerID }, dieId: number) => {
            if (G.turnPhase !== 'offensiveRoll') return;
            if (!isMoveAllowed(playerID, G.activePlayerId)) return;
            if (G.rollConfirmed) return;
            const die = G.dice.find(d => d.id === dieId);
            if (die) {
                die.isKept = !die.isKept;
            }
        },

        confirmRoll: ({ G, playerID }) => {
            if (G.turnPhase !== 'offensiveRoll' && G.turnPhase !== 'defensiveRoll') return;
            const rollerId = getRollerId(G);
            if (!isMoveAllowed(playerID, rollerId)) {
                if (import.meta.env.DEV) {
                    console.warn('[DiceThrone][Confirm] blocked: player mismatch', {
                        playerID,
                        rollerId,
                        rollCount: G.rollCount,
                        rollLimit: G.rollLimit,
                        turnPhase: G.turnPhase,
                    });
                }
                return;
            }
            if (G.rollCount === 0) {
                if (import.meta.env.DEV) {
                    console.warn('[DiceThrone][Confirm] blocked: no roll', {
                        playerID,
                        rollerId,
                        rollCount: G.rollCount,
                        turnPhase: G.turnPhase,
                    });
                }
                return;
            }
            G.rollConfirmed = true;
            G.availableAbilityIds = getAvailableAbilityIds(G, rollerId);
            if (G.turnPhase === 'defensiveRoll') {
                console.log('[DiceThrone][Defense] confirmRoll', {
                    rollerId,
                    availableAbilityIds: G.availableAbilityIds,
                });
                if (G.pendingAttack && !G.pendingAttack.defenseAbilityId && G.availableAbilityIds.length === 1) {
                    const autoAbilityId = G.availableAbilityIds[0];
                    G.pendingAttack.defenseAbilityId = autoAbilityId;
                    console.log('[DiceThrone][Defense] autoSelect', {
                        defenderId: G.pendingAttack.defenderId,
                        abilityId: autoAbilityId,
                    });
                }
            }
        },

        selectAbility: ({ G, playerID }, abilityId: string) => {
            if (G.turnPhase === 'defensiveRoll') {
                if (!G.pendingAttack) return;
                if (!isMoveAllowed(playerID, G.pendingAttack.defenderId)) return;
                if (!G.availableAbilityIds.includes(abilityId)) return;
                G.pendingAttack.defenseAbilityId = abilityId;
                console.log('[DiceThrone][Defense] selectAbility', {
                    defenderId: G.pendingAttack.defenderId,
                    abilityId,
                    rollConfirmed: G.rollConfirmed,
                });
                return;
            }
            if (G.turnPhase !== 'offensiveRoll') return;
            if (!isMoveAllowed(playerID, G.activePlayerId)) return;
            if (!G.rollConfirmed) return;
            if (!G.availableAbilityIds.includes(abilityId)) return;

            const defenderId = getNextPlayerId(G);
            const isDefendable = abilityHasDamage(abilityId);
            G.pendingAttack = {
                attackerId: G.activePlayerId,
                defenderId,
                isDefendable,
                sourceAbilityId: abilityId,
                extraRoll: abilityId === 'taiji-combo' ? { resolved: false } : undefined,
            };
        },

        // === 手牌系统 moves ===

        /** 抽牌 */
        drawCard: ({ G, playerID }) => {
            if (!isMoveAllowed(playerID, G.activePlayerId)) return;
            const player = G.players[G.activePlayerId];
            if (player.deck.length === 0) return;
            const card = player.deck.shift();
            if (card) player.hand.push(card);
        },

        /** 弃牌到弃牌堆 */
        discardCard: ({ G, playerID }, cardId: string) => {
            if (!isMoveAllowed(playerID, G.activePlayerId)) return;
            const player = G.players[G.activePlayerId];
            const cardIndex = player.hand.findIndex(c => c.id === cardId);
            if (cardIndex === -1) return;
            const [card] = player.hand.splice(cardIndex, 1);
            player.discard.push(card);
        },

        /** 出售卡牌（+1 CP，最多15） */
        sellCard: ({ G, playerID }, cardId: string) => {
            if (!isMoveAllowed(playerID, G.activePlayerId)) return;
            const player = G.players[G.activePlayerId];
            const cardIndex = player.hand.findIndex(c => c.id === cardId);
            if (cardIndex === -1) return;
            const [card] = player.hand.splice(cardIndex, 1);
            player.discard.push(card);
            player.cp = Math.min(CP_MAX, player.cp + 1);
            // 记录最后售出的卡牌ID，用于撤回
            G.lastSoldCardId = cardId;
        },

        /** 撤回售出的卡牌（仅限最后一张售出的卡牌） */
        undoSellCard: ({ G, playerID }) => {
            if (!isMoveAllowed(playerID, G.activePlayerId)) return;
            if (!G.lastSoldCardId) return;
            const player = G.players[G.activePlayerId];
            const cardIndex = player.discard.findIndex(c => c.id === G.lastSoldCardId);
            if (cardIndex === -1) return;
            const [card] = player.discard.splice(cardIndex, 1);
            player.hand.push(card);
            player.cp = Math.max(0, player.cp - 1);
            G.lastSoldCardId = undefined;
        },

        /** 将卡牌移动到手牌末尾（打出失败时调用） */
        reorderCardToEnd: ({ G, playerID }, cardId: string) => {
            if (!isMoveAllowed(playerID, G.activePlayerId)) return;
            const player = G.players[G.activePlayerId];
            const cardIndex = player.hand.findIndex(c => c.id === cardId);
            if (cardIndex === -1 || cardIndex === player.hand.length - 1) return;
            const [card] = player.hand.splice(cardIndex, 1);
            player.hand.push(card);
        },

        /** 打出卡牌（根据时机检查） */
        playCard: ({ G, playerID }, cardId: string) => {
            if (!isMoveAllowed(playerID, G.activePlayerId)) return;
            const player = G.players[G.activePlayerId];
            const cardIndex = player.hand.findIndex(c => c.id === cardId);
            if (cardIndex === -1) return;

            const card = player.hand[cardIndex];

            // 升级卡走单独流程
            if (card.type === 'upgrade') return;

            // 检查时机限制
            const phase = G.turnPhase;
            const validTiming = 
                (card.timing === 'main' && (phase === 'main1' || phase === 'main2')) ||
                (card.timing === 'roll' && (phase === 'offensiveRoll' || phase === 'defensiveRoll')) ||
                (card.timing === 'instant');

            if (!validTiming) return;

            // 检查 CP 消耗
            if (player.cp < card.cpCost) return;

            // 扣除 CP
            player.cp -= card.cpCost;

            // 移除卡牌
            player.hand.splice(cardIndex, 1);
            player.discard.push(card);

            // 打出卡牌后清除撤回状态（无法撤回之前售出的卡牌）
            G.lastSoldCardId = undefined;

            // TODO: 执行卡牌效果（需要根据卡牌类型实现）
        },

        /** 打出升级卡（仅 Main Phase 可用） */
        playUpgradeCard: ({ G, playerID }, cardId: string, targetAbilityId: string) => {
            if (!isMoveAllowed(playerID, G.activePlayerId)) return;
            const player = G.players[G.activePlayerId];
            const phase = G.turnPhase;

            // 仅 Main Phase 1/2 可打出升级卡
            if (phase !== 'main1' && phase !== 'main2') return;

            const cardIndex = player.hand.findIndex(c => c.id === cardId);
            if (cardIndex === -1) return;

            const card = player.hand[cardIndex];
            if (card.type !== 'upgrade') return;

            // 获取当前技能等级
            const currentLevel = player.abilityLevels[targetAbilityId] ?? 1;
            if (currentLevel >= 3) return; // 已满级

            // 计算实际 CP 消耗（已有 II 级升到 III 级时支付差价）
            let actualCost = card.cpCost;
            if (currentLevel === 2 && card.cpCost > 3) {
                // 差价逻辑：III级卡-II级卡成本差
                actualCost = card.cpCost - 3;
            }

            if (player.cp < actualCost) return;

            // 扣除 CP
            player.cp -= actualCost;

            // 升级技能
            player.abilityLevels[targetAbilityId] = currentLevel + 1;

            // 移除卡牌
            player.hand.splice(cardIndex, 1);
            player.discard.push(card);
        },

        /** 处理需要玩家选择的技能效果 */
        resolveChoice: ({ G, playerID }, statusId: string) => {
            const pendingChoice = G.pendingChoice;
            if (!pendingChoice) return;
            if (!isMoveAllowed(playerID, pendingChoice.playerId)) return;
            const option = pendingChoice.options.find(item => item.statusId === statusId);
            if (!option) return;
            const player = G.players[pendingChoice.playerId];
            if (!player) return;

            const currentStacks = player.statusEffects[option.statusId] || 0;
            const def = MONK_STATUS_EFFECTS.find(e => e.id === option.statusId);
            const maxStacks = def?.stackLimit || 99;
            player.statusEffects[option.statusId] = Math.min(currentStacks + option.value, maxStacks);
            setLastEffectSource(G, pendingChoice.playerId, pendingChoice.sourceAbilityId);

            G.pendingChoice = null;
        },

        advancePhase: ({ G, playerID }) => {
            if (!isMoveAllowed(playerID, G.activePlayerId)) return;
            if (G.pendingChoice) return;
            if (G.turnPhase === 'offensiveRoll' && G.pendingAttack?.extraRoll && !G.pendingAttack.extraRoll.resolved) return;
            if (G.turnPhase === 'discard') {
                const player = G.players[G.activePlayerId];
                if (player.hand.length > HAND_LIMIT) return;
            }
            const currentIndex = PHASE_ORDER.indexOf(G.turnPhase);
            let nextPhase = PHASE_ORDER[(currentIndex + 1) % PHASE_ORDER.length];

            if (G.turnPhase === 'upkeep' && G.turnNumber === 1 && G.activePlayerId === G.startingPlayerId) {
                nextPhase = 'main1';
            }

            if (G.turnPhase === 'offensiveRoll') {
                if (G.pendingAttack && G.pendingAttack.isDefendable) {
                    resolveOffensivePreDefenseEffects(G);
                    if (G.pendingChoice) return;
                    nextPhase = 'defensiveRoll';
                } else if (G.pendingAttack) {
                    // 不可防御攻击，直接结算
                    resolveAttack(G, { includePreDefense: true });
                    if (G.pendingChoice) return;
                    nextPhase = 'main2';
                } else {
                    nextPhase = 'main2';
                }
            }

            // 防御阶段结束后结算攻击
            if (G.turnPhase === 'defensiveRoll' && G.pendingAttack) {
                console.log('[DiceThrone][Defense] resolveAttack', {
                    defenseAbilityId: G.pendingAttack.defenseAbilityId,
                    sourceAbilityId: G.pendingAttack.sourceAbilityId,
                });
                resolveAttack(G);
            }

            if (nextPhase === 'income') {
                const player = G.players[G.activePlayerId];
                player.cp = Math.min(CP_MAX, player.cp + 1);
                if (player.deck.length > 0) {
                    const card = player.deck.shift();
                    if (card) player.hand.push(card);
                }
            }

            if (G.turnPhase === 'discard') {
                G.activePlayerId = getNextPlayerId(G);
                G.turnNumber += 1;
                nextPhase = 'upkeep';
            }

            G.turnPhase = nextPhase;

            if (nextPhase === 'offensiveRoll') {
                enterRollPhase(G, 5, 3);
                G.pendingAttack = null;
            }

            if (nextPhase === 'defensiveRoll') {
                enterRollPhase(G, 4, 1);
                if (G.pendingAttack) {
                    G.availableAbilityIds = getAvailableAbilityIds(G, G.pendingAttack.defenderId);
                    console.log('[DiceThrone][Defense] enterPhase', {
                        defenderId: G.pendingAttack.defenderId,
                        availableAbilityIds: G.availableAbilityIds,
                    });
                }
            }
        },

    },
};

export default DiceThroneGame;
