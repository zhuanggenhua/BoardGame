/**
 * Cardia 状态快照工具
 * 
 * 用于调试和测试，支持：
 * - 保存游戏状态到 JSON
 * - 从 JSON 恢复游戏状态
 * - 状态对比和差异显示
 */

import type { CardiaCore, PlayerState, CardInstance, PlayedCard } from '../domain/core-types';
import type { PlayerId } from '../../../engine/types';

/**
 * 状态快照接口
 */
export interface StateSnapshot {
    timestamp: number;
    turnNumber: number;
    phase: string;
    currentPlayerId: PlayerId;
    players: Record<PlayerId, PlayerSnapshot>;
    encounterCount: number;
    ongoingAbilitiesCount: number;
    modifierTokensCount: number;
    delayedEffectsCount: number;
    specialStates: {
        revealFirstNextEncounter: PlayerId | null;
        mechanicalSpiritActive: boolean;
    };
}

/**
 * 玩家快照
 */
export interface PlayerSnapshot {
    id: PlayerId;
    name: string;
    handCount: number;
    deckCount: number;
    discardCount: number;
    playedCardsCount: number;
    totalSignets: number;
    hasPlayed: boolean;
    cardRevealed: boolean;
    currentCard?: {
        uid: string;
        defId: string;
        baseInfluence: number;
        faction: string;
    };
}

/**
 * 状态差异
 */
export interface StateDiff {
    field: string;
    before: any;
    after: any;
    path: string;
}

/**
 * 创建状态快照
 */
export function createSnapshot(core: CardiaCore): StateSnapshot {
    const players: Record<PlayerId, PlayerSnapshot> = {} as any;
    
    for (const [playerId, player] of Object.entries(core.players)) {
        players[playerId as PlayerId] = {
            id: player.id,
            name: player.name,
            handCount: player.hand.length,
            deckCount: player.deck.length,
            discardCount: player.discard.length,
            playedCardsCount: player.playedCards.length,
            totalSignets: calculateTotalSignets(player),
            hasPlayed: player.hasPlayed,
            cardRevealed: player.cardRevealed,
            currentCard: player.currentCard ? {
                uid: player.currentCard.uid,
                defId: player.currentCard.defId,
                baseInfluence: player.currentCard.baseInfluence,
                faction: player.currentCard.faction,
            } : undefined,
        };
    }
    
    return {
        timestamp: Date.now(),
        turnNumber: core.turnNumber,
        phase: core.phase,
        currentPlayerId: core.currentPlayerId,
        players,
        encounterCount: core.encounterHistory.length,
        ongoingAbilitiesCount: core.ongoingAbilities.length,
        modifierTokensCount: core.modifierTokens.length,
        delayedEffectsCount: core.delayedEffects.length,
        specialStates: {
            revealFirstNextEncounter: core.revealFirstNextEncounter,
            mechanicalSpiritActive: core.mechanicalSpiritActive !== null,
        },
    };
}

/**
 * 计算玩家总印戒数
 */
function calculateTotalSignets(player: PlayerState): number {
    return player.playedCards.reduce((sum, card) => sum + card.signets, 0);
}

/**
 * 保存状态到 JSON 字符串
 */
export function saveStateToJson(core: CardiaCore, pretty = true): string {
    const snapshot = createSnapshot(core);
    return JSON.stringify(snapshot, null, pretty ? 2 : 0);
}

/**
 * 对比两个状态快照
 */
export function compareSnapshots(before: StateSnapshot, after: StateSnapshot): StateDiff[] {
    const diffs: StateDiff[] = [];
    
    // 对比基础字段
    if (before.turnNumber !== after.turnNumber) {
        diffs.push({
            field: 'turnNumber',
            before: before.turnNumber,
            after: after.turnNumber,
            path: 'core.turnNumber',
        });
    }
    
    if (before.phase !== after.phase) {
        diffs.push({
            field: 'phase',
            before: before.phase,
            after: after.phase,
            path: 'core.phase',
        });
    }
    
    if (before.currentPlayerId !== after.currentPlayerId) {
        diffs.push({
            field: 'currentPlayerId',
            before: before.currentPlayerId,
            after: after.currentPlayerId,
            path: 'core.currentPlayerId',
        });
    }
    
    // 对比玩家状态
    for (const playerId of Object.keys(before.players)) {
        const beforePlayer = before.players[playerId as PlayerId];
        const afterPlayer = after.players[playerId as PlayerId];
        
        if (!afterPlayer) continue;
        
        if (beforePlayer.handCount !== afterPlayer.handCount) {
            diffs.push({
                field: `player[${playerId}].handCount`,
                before: beforePlayer.handCount,
                after: afterPlayer.handCount,
                path: `core.players.${playerId}.hand.length`,
            });
        }
        
        if (beforePlayer.deckCount !== afterPlayer.deckCount) {
            diffs.push({
                field: `player[${playerId}].deckCount`,
                before: beforePlayer.deckCount,
                after: afterPlayer.deckCount,
                path: `core.players.${playerId}.deck.length`,
            });
        }
        
        if (beforePlayer.discardCount !== afterPlayer.discardCount) {
            diffs.push({
                field: `player[${playerId}].discardCount`,
                before: beforePlayer.discardCount,
                after: afterPlayer.discardCount,
                path: `core.players.${playerId}.discard.length`,
            });
        }
        
        if (beforePlayer.playedCardsCount !== afterPlayer.playedCardsCount) {
            diffs.push({
                field: `player[${playerId}].playedCardsCount`,
                before: beforePlayer.playedCardsCount,
                after: afterPlayer.playedCardsCount,
                path: `core.players.${playerId}.playedCards.length`,
            });
        }
        
        if (beforePlayer.totalSignets !== afterPlayer.totalSignets) {
            diffs.push({
                field: `player[${playerId}].totalSignets`,
                before: beforePlayer.totalSignets,
                after: afterPlayer.totalSignets,
                path: `core.players.${playerId}.totalSignets`,
            });
        }
        
        if (beforePlayer.hasPlayed !== afterPlayer.hasPlayed) {
            diffs.push({
                field: `player[${playerId}].hasPlayed`,
                before: beforePlayer.hasPlayed,
                after: afterPlayer.hasPlayed,
                path: `core.players.${playerId}.hasPlayed`,
            });
        }
    }
    
    // 对比能力系统状态
    if (before.encounterCount !== after.encounterCount) {
        diffs.push({
            field: 'encounterCount',
            before: before.encounterCount,
            after: after.encounterCount,
            path: 'core.encounterHistory.length',
        });
    }
    
    if (before.ongoingAbilitiesCount !== after.ongoingAbilitiesCount) {
        diffs.push({
            field: 'ongoingAbilitiesCount',
            before: before.ongoingAbilitiesCount,
            after: after.ongoingAbilitiesCount,
            path: 'core.ongoingAbilities.length',
        });
    }
    
    if (before.modifierTokensCount !== after.modifierTokensCount) {
        diffs.push({
            field: 'modifierTokensCount',
            before: before.modifierTokensCount,
            after: after.modifierTokensCount,
            path: 'core.modifierTokens.length',
        });
    }
    
    if (before.delayedEffectsCount !== after.delayedEffectsCount) {
        diffs.push({
            field: 'delayedEffectsCount',
            before: before.delayedEffectsCount,
            after: after.delayedEffectsCount,
            path: 'core.delayedEffects.length',
        });
    }
    
    return diffs;
}

/**
 * 格式化差异为可读字符串
 */
export function formatDiffs(diffs: StateDiff[]): string {
    if (diffs.length === 0) {
        return '无差异';
    }
    
    const lines = ['状态差异：'];
    for (const diff of diffs) {
        lines.push(`  ${diff.field}:`);
        lines.push(`    之前: ${JSON.stringify(diff.before)}`);
        lines.push(`    之后: ${JSON.stringify(diff.after)}`);
        lines.push(`    路径: ${diff.path}`);
    }
    
    return lines.join('\n');
}

/**
 * 打印状态快照（用于调试）
 */
export function printSnapshot(snapshot: StateSnapshot): void {
    console.log('=== Cardia 状态快照 ===');
    console.log(`时间戳: ${new Date(snapshot.timestamp).toISOString()}`);
    console.log(`回合: ${snapshot.turnNumber}`);
    console.log(`阶段: ${snapshot.phase}`);
    console.log(`当前玩家: ${snapshot.currentPlayerId}`);
    console.log('');
    
    console.log('玩家状态:');
    for (const [playerId, player] of Object.entries(snapshot.players)) {
        console.log(`  ${player.name} (${playerId}):`);
        console.log(`    手牌: ${player.handCount}`);
        console.log(`    牌库: ${player.deckCount}`);
        console.log(`    弃牌堆: ${player.discardCount}`);
        console.log(`    场上卡牌: ${player.playedCardsCount}`);
        console.log(`    印戒总数: ${player.totalSignets}`);
        console.log(`    已打牌: ${player.hasPlayed}`);
        console.log(`    已揭示: ${player.cardRevealed}`);
        if (player.currentCard) {
            console.log(`    当前卡牌: ${player.currentCard.defId} (影响力 ${player.currentCard.baseInfluence})`);
        }
    }
    console.log('');
    
    console.log('能力系统:');
    console.log(`  遭遇次数: ${snapshot.encounterCount}`);
    console.log(`  持续能力: ${snapshot.ongoingAbilitiesCount}`);
    console.log(`  修正标记: ${snapshot.modifierTokensCount}`);
    console.log(`  延迟效果: ${snapshot.delayedEffectsCount}`);
    console.log('');
    
    console.log('特殊状态:');
    console.log(`  下次先揭示: ${snapshot.specialStates.revealFirstNextEncounter || '无'}`);
    console.log(`  机械精灵激活: ${snapshot.specialStates.mechanicalSpiritActive ? '是' : '否'}`);
    console.log('========================');
}

/**
 * 创建详细的状态快照（包含完整数据）
 */
export interface DetailedSnapshot {
    basic: StateSnapshot;
    fullState: {
        players: Record<PlayerId, {
            hand: Array<{ uid: string; defId: string; baseInfluence: number }>;
            deck: Array<{ uid: string; defId: string }>;
            discard: Array<{ uid: string; defId: string }>;
            playedCards: Array<{
                uid: string;
                defId: string;
                baseInfluence: number;
                signets: number;
                encounterIndex: number;
                ongoingMarkers: string[];
            }>;
        }>;
        ongoingAbilities: Array<{
            abilityId: string;
            cardId: string;
            playerId: PlayerId;
            effectType: string;
        }>;
        modifierTokens: Array<{
            cardId: string;
            value: number;
            source: string;
        }>;
    };
}

/**
 * 创建详细快照
 */
export function createDetailedSnapshot(core: CardiaCore): DetailedSnapshot {
    const players: Record<PlayerId, any> = {} as any;
    
    for (const [playerId, player] of Object.entries(core.players)) {
        players[playerId as PlayerId] = {
            hand: player.hand.map(c => ({
                uid: c.uid,
                defId: c.defId,
                baseInfluence: c.baseInfluence,
            })),
            deck: player.deck.map(c => ({
                uid: c.uid,
                defId: c.defId,
            })),
            discard: player.discard.map(c => ({
                uid: c.uid,
                defId: c.defId,
            })),
            playedCards: player.playedCards.map(c => ({
                uid: c.uid,
                defId: c.defId,
                baseInfluence: c.baseInfluence,
                signets: c.signets,
                encounterIndex: c.encounterIndex,
                ongoingMarkers: c.ongoingMarkers,
            })),
        };
    }
    
    return {
        basic: createSnapshot(core),
        fullState: {
            players,
            ongoingAbilities: core.ongoingAbilities.map(a => ({
                abilityId: a.abilityId,
                cardId: a.cardId,
                playerId: a.playerId,
                effectType: a.effectType,
            })),
            modifierTokens: core.modifierTokens.map(t => ({
                cardId: t.cardId,
                value: t.value,
                source: t.source,
            })),
        },
    };
}

/**
 * 保存详细快照到 JSON
 */
export function saveDetailedSnapshotToJson(core: CardiaCore, pretty = true): string {
    const snapshot = createDetailedSnapshot(core);
    return JSON.stringify(snapshot, null, pretty ? 2 : 0);
}
