/**
 * DiceThrone 游戏定义（新引擎架构）
 * 
 * 使用领域内核 + 引擎适配器
 */

import type { ActionLogEntry, ActionLogSegment, BreakdownLine, Command, GameEvent, MatchState, PlayerId } from '../../engine/types';
import {
    createActionLogSystem,
    createCheatSystem,
    createEventStreamSystem,
    createFlowSystem,
    createLogSystem,
    createInteractionSystem,
    createRematchSystem,
    createResponseWindowSystem,
    createTutorialSystem,
    createUndoSystem,
} from '../../engine';
import { createGameEngine } from '../../engine/adapter';
import { DiceThroneDomain } from './domain';
import { DICETHRONE_COMMANDS } from './domain/ids';
import type {
    AbilityCard,
    DiceThroneCore,
    TurnPhase,
    DamageDealtEvent,
    AttackResolvedEvent,
    HealAppliedEvent,
    StatusAppliedEvent,
    StatusRemovedEvent,
    AbilityActivatedEvent,
    TokenGrantedEvent,
    TokenConsumedEvent,
    TokenUsedEvent,
    CpChangedEvent,
    CardDrawnEvent,
    BonusDieRolledEvent,
} from './domain/types';
import { createDiceThroneEventSystem } from './domain/systems';
import { getNextPhase, getRollerId, getActiveDice } from './domain/rules';
import { findPlayerAbility } from './domain/abilityLookup';
import { diceThroneCheatModifier } from './domain/cheatModifier';
import { diceThroneFlowHooks } from './domain/flowHooks';
import { ASSETS } from './ui/assets';

// ============================================================================
// ActionLog 共享白名单 + 格式化
// ============================================================================

const ACTION_LOG_ALLOWLIST = [
    'PLAY_CARD',
    'PLAY_UPGRADE_CARD',
    // 注意：阶段推进属于明确的规则行为，允许撤回 + 记录。
    'ADVANCE_PHASE',
    'SELECT_ABILITY',
    'USE_TOKEN',
    'SKIP_TOKEN_RESPONSE',
    'USE_PURIFY',
    'PAY_TO_REMOVE_KNOCKDOWN',
    'USE_PASSIVE_ABILITY',
    // 确认投掷：记录最终骰面结果
    'CONFIRM_ROLL',
] as const;

const UNDO_ALLOWLIST = [
    'PLAY_CARD',
    'PLAY_UPGRADE_CARD',
    'ADVANCE_PHASE',
] as const;

const DT_NS = 'game-dicethrone';

/** 将 sourceAbilityId 解析为可读的 i18n 来源标签 */
function resolveAbilitySourceLabel(
    sourceAbilityId: string | undefined,
    core: DiceThroneCore,
    _playerId: PlayerId,
): { label: string; isI18n: boolean } | null {
    if (!sourceAbilityId) return null;
    // 系统来源映射
    switch (sourceAbilityId) {
        case 'upkeep-burn': return { label: 'actionLog.damageSource.upkeepBurn', isI18n: true };
        case 'upkeep-poison': return { label: 'actionLog.damageSource.upkeepPoison', isI18n: true };
        case 'retribution-reflect': return { label: 'actionLog.damageSource.retribution', isI18n: true };
    }
    // 从双方玩家技能表中查找（支持变体 ID）
    for (const pid of Object.keys(core.players)) {
        const found = findPlayerAbility(core, pid, sourceAbilityId);
        if (found?.ability.name) {
            return { label: found.ability.name, isI18n: found.ability.name.includes('.') };
        }
    }
    // 卡牌 ID 解析：sourceAbilityId 以 'card-' 开头时，查找卡牌名称
    if (sourceAbilityId.startsWith('card-')) {
        const card = findDiceThroneCard(core, sourceAbilityId);
        if (card?.name) {
            return { label: card.name, isI18n: card.name.includes('.') };
        }
    }
    // fallback：用 sourceAbilityId 本身作为文本
    return { label: sourceAbilityId, isI18n: false };
}

function formatDiceThroneActionEntry({
    command,
    state,
    events,
}: {
    command: Command;
    state: MatchState<unknown>;
    events: GameEvent[];
}): ActionLogEntry | ActionLogEntry[] | null {
    const core = (state as MatchState<DiceThroneCore>).core;
    const timestamp = typeof command.timestamp === 'number' ? command.timestamp : 0;
    const entries: ActionLogEntry[] = [];
    const tokenDefinitions = core.tokenDefinitions ?? [];

    // i18n segment 工厂：延迟翻译，渲染时由客户端 useTranslation 翻译
    const i18nSeg = (
        key: string,
        params?: Record<string, string | number>,
        paramI18nKeys?: string[],
    ) => ({
        type: 'i18n' as const,
        ns: DT_NS,
        key,
        ...(params ? { params } : {}),
        ...(paramI18nKeys ? { paramI18nKeys } : {}),
    });

    const getTokenI18nKey = (tokenId: string): string => {
        const def = tokenDefinitions.find(item => item.id === tokenId);
        if (!def?.name) return tokenId;
        // 如果 name 包含 '.'，说明是 i18n key（如 'token.shield.name'）
        if (def.name.includes('.')) return def.name;
        return def.name;
    };

    const getAbilityI18nKey = (rawName?: string): string => {
        if (!rawName) return '';
        // 如果包含 '.'，说明是 i18n key
        if (rawName.includes('.')) return rawName;
        return rawName;
    };

    if (command.type === 'PLAY_CARD' || command.type === 'PLAY_UPGRADE_CARD') {
        const cardId = (command.payload as { cardId: string }).cardId;
        const card = findDiceThroneCard(core, cardId, command.playerId);
        if (!card || !card.previewRef) return null;

        const actionKey = command.type === 'PLAY_UPGRADE_CARD'
            ? 'actionLog.playUpgradeCard'
            : 'actionLog.playCard';

        // card segment：如果 card.name 是 i18n key（含 .），存原始 key + ns，渲染时翻译
        const isI18nKey = card.name?.includes('.');
        const cardSegment: ActionLogSegment = {
            type: 'card',
            cardId: card.id,
            previewText: card.name ?? cardId,
            ...(isI18nKey ? { previewTextNs: DT_NS } : {}),
        };

        entries.push({
            id: `${command.type}-${command.playerId}-${timestamp}`,
            timestamp,
            actorId: command.playerId,
            kind: command.type,
            segments: [
                i18nSeg(actionKey),
                cardSegment,
            ],
        });

        // 卡牌效果包含投掷时，记录投掷结果
        const bonusDieEvents = events.filter(
            (e): e is BonusDieRolledEvent => e.type === 'BONUS_DIE_ROLLED'
        );
        if (bonusDieEvents.length > 0) {
            const rollSegments: ActionLogSegment[] = [
                i18nSeg('actionLog.cardRollResult'),
            ];
            for (const bde of bonusDieEvents) {
                const effectKey = bde.payload.effectKey;
                if (effectKey) {
                    rollSegments.push(i18nSeg(effectKey, bde.payload.effectParams));
                }
            }
            entries.push({
                id: `${command.type}-ROLL-${command.playerId}-${timestamp}`,
                timestamp: timestamp + 1,
                actorId: command.playerId,
                kind: 'CARD_ROLL_RESULT',
                segments: rollSegments,
            });
        }
    }

    if (command.type === 'ADVANCE_PHASE') {
        const phaseChanged = [...events]
            .reverse()
            .find(event => event.type === 'SYS_PHASE_CHANGED') as
            | { payload?: { to?: string } }
            | undefined;
        const currentPhase = (state as MatchState<DiceThroneCore>).sys?.phase as TurnPhase | undefined;
        const nextPhase = phaseChanged?.payload?.to ?? (currentPhase ? getNextPhase(core, currentPhase) : undefined);
        const phaseI18nKey = nextPhase ? `phase.${nextPhase}.label` : '';
        entries.push({
            id: `${command.type}-${command.playerId}-${timestamp}`,
            timestamp,
            actorId: command.playerId,
            kind: command.type,
            segments: [i18nSeg('actionLog.advancePhase', { phase: phaseI18nKey }, ['phase'])],
        });
    }

    if (command.type === 'SELECT_ABILITY') {
        const abilityEvent = events.find(
            event => event.type === 'ABILITY_ACTIVATED'
        ) as AbilityActivatedEvent | undefined;
        const abilityId = abilityEvent?.payload.abilityId
            ?? (command.payload as { abilityId?: string }).abilityId;
        const playerId = abilityEvent?.payload.playerId ?? command.playerId;
        if (abilityId && playerId) {
            const rawAbilityName = findPlayerAbility(core, playerId, abilityId)?.ability.name ?? abilityId;
            const abilityNameKey = getAbilityI18nKey(rawAbilityName) || abilityId;
            const isI18nKey = abilityNameKey.includes('.');
            const actionKey = abilityEvent?.payload.isDefense
                ? 'actionLog.abilityActivatedDefense'
                : 'actionLog.abilityActivated';
            entries.push({
                id: `${command.type}-${playerId}-${timestamp}`,
                timestamp,
                actorId: playerId,
                kind: command.type,
                segments: [i18nSeg(
                    actionKey,
                    { abilityName: abilityNameKey },
                    isI18nKey ? ['abilityName'] : undefined,
                )],
            });
        }
    }

    if (command.type === 'USE_PURIFY') {
        const statusId = (command.payload as { statusId?: string }).statusId;
        if (statusId) {
            const tokenKey = getTokenI18nKey(statusId);
            const isI18nKey = tokenKey.includes('.');
            entries.push({
                id: `USE_PURIFY-${command.playerId}-${timestamp}`,
                timestamp,
                actorId: command.playerId,
                kind: 'USE_PURIFY',
                segments: [
                    i18nSeg('actionLog.usePurify', { statusLabel: tokenKey }, isI18nKey ? ['statusLabel'] : undefined),
                ],
            });
        }
    }

    if (command.type === 'PAY_TO_REMOVE_KNOCKDOWN') {
        entries.push({
            id: `PAY_TO_REMOVE_KNOCKDOWN-${command.playerId}-${timestamp}`,
            timestamp,
            actorId: command.playerId,
            kind: 'PAY_TO_REMOVE_KNOCKDOWN',
            segments: [
                i18nSeg('actionLog.payToRemoveKnockdown'),
            ],
        });
    }

    if (command.type === 'USE_PASSIVE_ABILITY') {
        const passiveId = (command.payload as { passiveId?: string }).passiveId;
        if (passiveId) {
            const source = resolveAbilitySourceLabel(passiveId, core, command.playerId);
            const label = source?.label ?? passiveId;
            const isI18nKey = source?.isI18n ?? false;
            entries.push({
                id: `USE_PASSIVE_ABILITY-${command.playerId}-${timestamp}`,
                timestamp,
                actorId: command.playerId,
                kind: 'USE_PASSIVE_ABILITY',
                segments: [
                    i18nSeg('actionLog.usePassiveAbility', { abilityName: label }, isI18nKey ? ['abilityName'] : undefined),
                ],
            });
        }
    }

    if (command.type === 'CONFIRM_ROLL') {
        const phase = (state as MatchState<DiceThroneCore>).sys?.phase as TurnPhase | undefined;
        const rollerId = getRollerId(core, phase);
        const activeDice = getActiveDice(core);
        const characterId = core.players[rollerId]?.characterId;

        if (characterId && characterId !== 'unselected' && activeDice.length > 0) {
            const spriteAsset = ASSETS.DICE_SPRITE(characterId);
            const SPRITE_COLS = 3;
            const SPRITE_ROWS = 3;
            // 精灵图中骰面值→网格位置的映射
            const FACE_MAP: Record<number, { col: number; row: number }> = {
                1: { col: 0, row: 2 },
                2: { col: 0, row: 1 },
                3: { col: 1, row: 2 },
                4: { col: 1, row: 1 },
                5: { col: 2, row: 1 },
                6: { col: 2, row: 2 },
            };

            const diceData = activeDice.map(die => {
                const mapping = FACE_MAP[die.value] ?? FACE_MAP[1];
                return { value: die.value, col: mapping.col, row: mapping.row };
            });

            const isDefense = phase === 'defensiveRoll';

            // 获取当前选中的技能名
            const abilityId = isDefense
                ? core.pendingAttack?.defenseAbilityId
                : core.activatingAbilityId;
            const segments: ActionLogSegment[] = [];
            if (abilityId) {
                const rawName = findPlayerAbility(core, rollerId, abilityId)?.ability.name ?? abilityId;
                const abilityNameKey = getAbilityI18nKey(rawName) || abilityId;
                const isI18nKey = abilityNameKey.includes('.');
                const actionKey = isDefense ? 'actionLog.confirmRollDefenseWithAbility' : 'actionLog.confirmRollWithAbility';
                segments.push(i18nSeg(actionKey, { abilityName: abilityNameKey }, isI18nKey ? ['abilityName'] : undefined));
            } else {
                const actionKey = isDefense ? 'actionLog.confirmRollDefense' : 'actionLog.confirmRoll';
                segments.push(i18nSeg(actionKey));
            }
            segments.push({
                type: 'diceResult',
                spriteAsset,
                spriteCols: SPRITE_COLS,
                spriteRows: SPRITE_ROWS,
                dice: diceData,
            });

            entries.push({
                id: `CONFIRM_ROLL-${rollerId}-${timestamp}`,
                timestamp,
                actorId: rollerId,
                kind: 'CONFIRM_ROLL',
                segments,
            });
        }
    }

    const attackResolved = [...events].reverse().find(
        (event): event is AttackResolvedEvent => event.type === 'ATTACK_RESOLVED'
    );

    events.forEach((event, index) => {
        // 效果事件的 timestamp 必须严格大于命令 entry 的 timestamp，
        // 否则 newest-first 排序时效果会显示在命令下方（看起来先于命令发生）
        const rawEventTs = typeof event.timestamp === 'number' ? event.timestamp : timestamp;
        const entryTimestamp = Math.max(rawEventTs, timestamp + 1 + index);

        if (event.type === 'DAMAGE_DEALT') {
            const damageEvent = event as DamageDealtEvent;
            const { targetId, amount, actualDamage, sourceAbilityId, modifiers, breakdown } = damageEvent.payload;
            let actorId = targetId;
            if (attackResolved) {
                if (targetId === attackResolved.payload.defenderId) {
                    actorId = attackResolved.payload.attackerId;
                } else if (sourceAbilityId === 'retribution-reflect') {
                    actorId = attackResolved.payload.defenderId;
                }
            }
            const dealt = actualDamage ?? amount ?? 0;
            const isSelfDamage = actorId === targetId;

            // 解析来源技能名
            const effectiveSourceId = sourceAbilityId ?? attackResolved?.payload.sourceAbilityId;
            const source = resolveAbilitySourceLabel(effectiveSourceId, core, actorId);

            // 构建 breakdown 明细行（所有伤害都用 breakdown，统一虚线下划线风格）
            const breakdownLines: BreakdownLine[] = [];
            
            // 优先使用新管线的 breakdown 格式
            if (breakdown) {
                // 新格式：基础伤害 + 修正步骤
                // 引擎层 resolveAbilityName 只返回 abilityId（如 'pickpocket'），
                // 需要用游戏层 resolveAbilitySourceLabel 获取 i18n key（如 'abilities.pickpocket.name'）
                let baseLabel = breakdown.base.sourceName || breakdown.base.sourceId;
                let baseLabelIsI18n = breakdown.base.sourceNameIsI18n ?? false;
                if (!baseLabelIsI18n && source) {
                    baseLabel = source.label;
                    baseLabelIsI18n = source.isI18n;
                }
                breakdownLines.push({
                    label: baseLabel,
                    labelIsI18n: baseLabelIsI18n,
                    labelNs: baseLabelIsI18n ? DT_NS : undefined,
                    value: breakdown.base.value,
                    color: 'neutral',
                });
                breakdown.steps.forEach(step => {
                    breakdownLines.push({
                        label: step.sourceName || step.sourceId,
                        labelIsI18n: step.sourceNameIsI18n ?? false,
                        labelNs: step.sourceNameIsI18n ? DT_NS : undefined,
                        value: step.value,
                        color: step.value > 0 ? 'positive' : 'negative',
                    });
                });
            } else if (modifiers && modifiers.length > 0) {
                // 旧格式（向后兼容）：推算基础伤害 + 各修改器
                const modTotal = modifiers.reduce((sum, m) => sum + m.value, 0);
                const baseDamage = dealt - modTotal;
                breakdownLines.push({
                    label: 'actionLog.damageSource.original', labelIsI18n: true, labelNs: DT_NS,
                    value: baseDamage, color: 'neutral',
                });
                modifiers.forEach(mod => {
                    const isI18n = !!mod.sourceName?.includes('.');
                    breakdownLines.push({
                        label: mod.sourceName || mod.sourceId || mod.type,
                        labelIsI18n: isI18n,
                        labelNs: isI18n ? DT_NS : undefined,
                        value: mod.value,
                        color: mod.value > 0 ? 'positive' : 'negative',
                    });
                });
            } else if (source) {
                // 无修改器但有来源：显示来源名 + 数值
                breakdownLines.push({
                    label: source.label, labelIsI18n: source.isI18n, labelNs: source.isI18n ? DT_NS : undefined,
                    value: dealt, color: 'neutral',
                });
            }

            const breakdownSeg: ActionLogSegment = {
                type: 'breakdown',
                displayText: String(dealt),
                lines: breakdownLines,
            };

            // 统一用 before + breakdown + after 模式
            let segments: ActionLogSegment[];
            if (isSelfDamage) {
                const afterKey = source ? 'actionLog.damageAfter.takenWithSource' : 'actionLog.damageAfter.taken';
                const afterParams = source ? { source: source.label } : undefined;
                const afterI18nKeys = source?.isI18n ? ['source'] : undefined;
                segments = [
                    i18nSeg('actionLog.damageBefore.taken'),
                    breakdownSeg,
                    i18nSeg(afterKey, afterParams, afterI18nKeys),
                ];
            } else {
                if (source) {
                    segments = [
                        i18nSeg('actionLog.damageBefore.dealt', { targetPlayerId: targetId, source: source.label }, source.isI18n ? ['source'] : undefined),
                        breakdownSeg,
                        i18nSeg('actionLog.damageAfter.dealt', { targetPlayerId: targetId, source: source.label }, source.isI18n ? ['source'] : undefined),
                    ];
                } else {
                    segments = [
                        i18nSeg('actionLog.damageBefore.dealtPlain', { targetPlayerId: targetId }),
                        breakdownSeg,
                        i18nSeg('actionLog.damageAfter.dealtPlain', { targetPlayerId: targetId }),
                    ];
                }
            }

            entries.push({
                id: `DAMAGE_DEALT-${targetId}-${entryTimestamp}-${index}`,
                timestamp: entryTimestamp,
                actorId,
                kind: 'DAMAGE_DEALT',
                segments,
            });
            return;
        }

        if (event.type === 'HEAL_APPLIED') {
            const healEvent = event as HealAppliedEvent;
            const { targetId, amount, sourceAbilityId: healSourceId } = healEvent.payload;

            // 解析治疗来源
            const healSource = resolveAbilitySourceLabel(healSourceId, core, command.playerId);

            // 构建 breakdown 明细行
            const healLines: BreakdownLine[] = [];
            if (healSource) {
                healLines.push({
                    label: healSource.label,
                    labelIsI18n: healSource.isI18n,
                    labelNs: healSource.isI18n ? DT_NS : undefined,
                    value: amount,
                    color: 'positive',
                });
            }

            const healBreakdown: ActionLogSegment = {
                type: 'breakdown',
                displayText: String(amount),
                lines: healLines,
            };

            const afterKey = healSource ? 'actionLog.healAfter.withSource' : 'actionLog.healAfter.plain';
            const afterParams = healSource ? { source: healSource.label } : undefined;
            const afterI18nKeys = healSource?.isI18n ? ['source'] : undefined;

            entries.push({
                id: `HEAL_APPLIED-${targetId}-${entryTimestamp}-${index}`,
                timestamp: entryTimestamp,
                actorId: command.playerId,
                kind: 'HEAL_APPLIED',
                segments: [
                    i18nSeg('actionLog.healBefore', { targetPlayerId: targetId }),
                    healBreakdown,
                    i18nSeg(afterKey, afterParams, afterI18nKeys),
                ],
            });
            return;
        }

        if (event.type === 'STATUS_APPLIED') {
            const statusEvent = event as StatusAppliedEvent;
            const { targetId, statusId, stacks, newTotal } = statusEvent.payload;
            const tokenKey = getTokenI18nKey(statusId);
            const isI18nKey = tokenKey.includes('.');
            entries.push({
                id: `STATUS_APPLIED-${targetId}-${entryTimestamp}-${index}`,
                timestamp: entryTimestamp,
                actorId: command.playerId,
                kind: 'STATUS_APPLIED',
                segments: [
                    i18nSeg('actionLog.statusApplied', {
                        targetPlayerId: targetId,
                        statusLabel: tokenKey,
                    }, isI18nKey ? ['statusLabel'] : undefined),
                    i18nSeg('actionLog.statusAppliedDelta', { stacks, total: newTotal }),
                ],
            });
            return;
        }

        if (event.type === 'STATUS_REMOVED') {
            const statusEvent = event as StatusRemovedEvent;
            const { targetId, statusId, stacks } = statusEvent.payload;
            const tokenKey = getTokenI18nKey(statusId);
            const isI18nKey = tokenKey.includes('.');
            entries.push({
                id: `STATUS_REMOVED-${targetId}-${entryTimestamp}-${index}`,
                timestamp: entryTimestamp,
                actorId: command.playerId,
                kind: 'STATUS_REMOVED',
                segments: [
                    i18nSeg('actionLog.statusRemoved', {
                        targetPlayerId: targetId,
                        statusLabel: tokenKey,
                    }, isI18nKey ? ['statusLabel'] : undefined),
                    i18nSeg('actionLog.statusRemovedDelta', { stacks }),
                ],
            });
            return;
        }

        if (event.type === 'TOKEN_GRANTED') {
            const tokenEvent = event as TokenGrantedEvent;
            const { targetId, tokenId, amount, newTotal } = tokenEvent.payload;
            const tokenKey = getTokenI18nKey(tokenId);
            const isI18nKey = tokenKey.includes('.');
            entries.push({
                id: `TOKEN_GRANTED-${targetId}-${entryTimestamp}-${index}`,
                timestamp: entryTimestamp,
                actorId: command.playerId,
                kind: 'TOKEN_GRANTED',
                segments: [
                    i18nSeg('actionLog.tokenGranted', {
                        targetPlayerId: targetId,
                        tokenLabel: tokenKey,
                        amount,
                    }, isI18nKey ? ['tokenLabel'] : undefined),
                    i18nSeg('actionLog.tokenTotal', { total: newTotal }),
                ],
            });
            return;
        }

        if (event.type === 'TOKEN_CONSUMED') {
            const tokenEvent = event as TokenConsumedEvent;
            const { playerId, tokenId, amount, newTotal } = tokenEvent.payload;
            const tokenKey = getTokenI18nKey(tokenId);
            const isI18nKey = tokenKey.includes('.');
            entries.push({
                id: `TOKEN_CONSUMED-${playerId}-${entryTimestamp}-${index}`,
                timestamp: entryTimestamp,
                actorId: playerId,
                kind: 'TOKEN_CONSUMED',
                segments: [
                    i18nSeg('actionLog.tokenConsumed', { tokenLabel: tokenKey, amount }, isI18nKey ? ['tokenLabel'] : undefined),
                    i18nSeg('actionLog.tokenRemaining', { total: newTotal }),
                ],
            });
            return;
        }

        if (event.type === 'TOKEN_USED') {
            const tokenEvent = event as TokenUsedEvent;
            const { playerId, tokenId, effectType, damageModifier, evasionRoll } = tokenEvent.payload;
            const tokenKey = getTokenI18nKey(tokenId);
            const isTokenI18n = tokenKey.includes('.');
            const effectLabelKey = `actionLog.tokenEffect.${effectType}`;
            const paramI18nKeys = ['effectLabel'];
            if (isTokenI18n) paramI18nKeys.push('tokenLabel');
            const segments = [
                i18nSeg('actionLog.tokenUsed', { tokenLabel: tokenKey, effectLabel: effectLabelKey }, paramI18nKeys),
            ];
            if (typeof damageModifier === 'number') {
                segments.push(i18nSeg('actionLog.tokenModifier', { amount: damageModifier }));
            }
            if (evasionRoll) {
                const resultKey = evasionRoll.success ? 'actionLog.tokenEvasionSuccess' : 'actionLog.tokenEvasionFail';
                segments.push(i18nSeg('actionLog.tokenEvasion', {
                    value: evasionRoll.value,
                    result: resultKey,
                }, ['result']));
            }
            entries.push({
                id: `TOKEN_USED-${playerId}-${entryTimestamp}-${index}`,
                timestamp: entryTimestamp,
                actorId: playerId,
                kind: 'TOKEN_USED',
                segments,
            });
        }

        if (event.type === 'CP_CHANGED') {
            const cpEvent = event as CpChangedEvent;
            const { playerId, delta, newValue, sourceAbilityId } = cpEvent.payload;
            if (delta === 0) return;
            const source = resolveAbilitySourceLabel(sourceAbilityId, core, command.playerId);
            const isGain = delta > 0;
            const key = isGain
                ? (source ? 'actionLog.cpGained' : 'actionLog.cpGainedPlain')
                : (source ? 'actionLog.cpSpent' : 'actionLog.cpSpentPlain');
            const params: Record<string, string | number> = {
                amount: Math.abs(delta),
                newValue,
            };
            const paramI18nKeys: string[] = [];
            if (source) {
                params.source = source.label;
                if (source.isI18n) paramI18nKeys.push('source');
            }
            entries.push({
                id: `CP_CHANGED-${playerId}-${entryTimestamp}-${index}`,
                timestamp: entryTimestamp,
                actorId: playerId,
                kind: 'CP_CHANGED',
                segments: [
                    i18nSeg(key, params, paramI18nKeys.length > 0 ? paramI18nKeys : undefined),
                ],
            });
        }

        if (event.type === 'CARD_DRAWN') {
            // 抽牌事件在 forEach 外合并处理，跳过单条
        }
    });

    // 合并同一批的 CARD_DRAWN 事件，按 (playerId, sourceAbilityId) 分组
    const drawGroups = new Map<string, { playerId: string; count: number; sourceAbilityId?: string; lastTimestamp: number; lastIndex: number }>();
    events.forEach((event, index) => {
        if (event.type !== 'CARD_DRAWN') return;
        const { playerId, sourceAbilityId } = (event as CardDrawnEvent).payload;
        const groupKey = `${playerId}|${sourceAbilityId ?? ''}`;
        const existing = drawGroups.get(groupKey);
        const rawTs = typeof event.timestamp === 'number' ? event.timestamp : timestamp;
        const entryTs = Math.max(rawTs, timestamp + 1 + index);
        if (existing) {
            existing.count++;
            existing.lastTimestamp = entryTs;
            existing.lastIndex = index;
        } else {
            drawGroups.set(groupKey, { playerId, count: 1, sourceAbilityId, lastTimestamp: entryTs, lastIndex: index });
        }
    });
    for (const [, group] of drawGroups) {
        const source = resolveAbilitySourceLabel(group.sourceAbilityId, core, command.playerId);
        const key = source ? 'actionLog.cardDrawn' : 'actionLog.cardDrawnPlain';
        const params: Record<string, string | number> = { count: group.count };
        const paramI18nKeys: string[] = [];
        if (source) {
            params.source = source.label;
            if (source.isI18n) paramI18nKeys.push('source');
        }
        entries.push({
            id: `CARD_DRAWN-${group.playerId}-${group.lastTimestamp}-${group.lastIndex}`,
            timestamp: group.lastTimestamp,
            actorId: group.playerId,
            kind: 'CARD_DRAWN',
            segments: [
                i18nSeg(key, params, paramI18nKeys.length > 0 ? paramI18nKeys : undefined),
            ],
        });
    }

    if (entries.length === 0) return null;
    return entries.length === 1 ? entries[0] : entries;
}

function findDiceThroneCard(
    core: DiceThroneCore,
    cardId: string,
    playerId?: PlayerId
): AbilityCard | undefined {
    if (playerId && core.players[playerId]) {
        const player = core.players[playerId];
        return (
            player.hand.find(card => card.id === cardId)
            ?? player.deck.find(card => card.id === cardId)
            ?? player.discard.find(card => card.id === cardId)
        );
    }

    for (const player of Object.values(core.players)) {
        const found = player.hand.find(card => card.id === cardId)
            ?? player.deck.find(card => card.id === cardId)
            ?? player.discard.find(card => card.id === cardId);
        if (found) return found;
    }

    return undefined;
}

// 创建系统集合（默认系统 + FlowSystem + DiceThrone 专用系统 + 作弊系统）
// FlowSystem 配置由 FlowHooks 提供，符合设计规范
// 注意：撤销快照保留 1 个 + 极度缩减日志（maxEntries: 20）以避免 MongoDB 16MB 限制
const systems = [
    createFlowSystem<DiceThroneCore>({ hooks: diceThroneFlowHooks }),
    createEventStreamSystem(),
    createLogSystem({ maxEntries: 20 }),  // 极度减少，不考虑回放
    createActionLogSystem({
        commandAllowlist: ACTION_LOG_ALLOWLIST,
        formatEntry: formatDiceThroneActionEntry,
    }),
    createUndoSystem({
        maxSnapshots: 3,
        // 只对白名单命令做撤回快照，避免 UI/系统行为导致“一进局就可撤回”。
        snapshotCommandAllowlist: UNDO_ALLOWLIST,
    }),
    createInteractionSystem(),
    createRematchSystem(),
    createResponseWindowSystem({
        allowedCommands: [
            'PLAY_CARD',
            'USE_TOKEN', 'SKIP_TOKEN_RESPONSE',
            'MODIFY_DIE', 'REROLL_DIE',
            'REMOVE_STATUS', 'TRANSFER_STATUS',
            'CONFIRM_INTERACTION', 'CANCEL_INTERACTION',
            'USE_PASSIVE_ABILITY',
        ],
        responderExemptCommands: ['USE_TOKEN', 'SKIP_TOKEN_RESPONSE', 'USE_PASSIVE_ABILITY'],
        responseAdvanceEvents: [
            { eventType: 'CARD_PLAYED' },
        ],
        interactionLock: {
            requestEvent: 'INTERACTION_REQUESTED',
            resolveEvents: ['INTERACTION_COMPLETED', 'INTERACTION_CANCELLED'],
        },
    }),
    createTutorialSystem(),
    createDiceThroneEventSystem(),
    createCheatSystem<DiceThroneCore>(diceThroneCheatModifier),
];

// 导出系统配置供测试使用
export { systems as diceThroneSystemsForTest };

// 所有业务命令类型（系统命令由 adapter 自动合并，无需手动添加）
const COMMAND_TYPES = [
    // 骰子操作
    'ROLL_DICE',
    'TOGGLE_DIE_LOCK',
    'CONFIRM_ROLL',
    // 技能选择
    'SELECT_ABILITY',
    // 卡牌操作
    'DRAW_CARD',
    'DISCARD_CARD',
    'SELL_CARD',
    'UNDO_SELL_CARD',
    'REORDER_CARD_TO_END',
    'PLAY_CARD',
    'PLAY_UPGRADE_CARD',
    // 选择与阶段
    'RESOLVE_CHOICE',
    // 卡牌交互（骰子修改、状态移除/转移）
    'MODIFY_DIE',
    'REROLL_DIE',
    'REMOVE_STATUS',
    'TRANSFER_STATUS',
    'CONFIRM_INTERACTION',
    'CANCEL_INTERACTION',
    // 选角相关
    'SELECT_CHARACTER',
    'HOST_START_GAME',
    'PLAYER_READY',
    // Token 响应系统
    'USE_TOKEN',
    'SKIP_TOKEN_RESPONSE',
    'USE_PURIFY',
    // 击倒移除
    DICETHRONE_COMMANDS.PAY_TO_REMOVE_KNOCKDOWN,
    // 奖励骰重掷
    'REROLL_BONUS_DIE',
    'SKIP_BONUS_DICE_REROLL',
    // 被动能力（如教皇税）
    'USE_PASSIVE_ABILITY',
    // 系统命令（InteractionSystem）- 新交互系统需要
    'SYS_INTERACTION_RESPOND',
    'SYS_INTERACTION_TIMEOUT',
    'SYS_INTERACTION_CANCEL',
];

// 适配器配置
const adapterConfig = {
    domain: DiceThroneDomain,
    systems,
    minPlayers: 2,
    maxPlayers: 2,
    commandTypes: COMMAND_TYPES,
};

// 引擎配置
export const engineConfig = createGameEngine(adapterConfig);

export default engineConfig;

// 导出 ActionLog 格式化函数供测试
export { formatDiceThroneActionEntry };

// 注册卡牌预览获取函数
import { registerCardPreviewGetter } from '../../components/game/registry/cardPreviewRegistry';
import { getDiceThroneCardPreviewRef } from './ui/cardPreviewHelper';
registerCardPreviewGetter('dicethrone', getDiceThroneCardPreviewRef);

// 注册关键图片解析器
import { registerCriticalImageResolver } from '../../core';
import { diceThroneCriticalImageResolver } from './criticalImageResolver';
registerCriticalImageResolver('dicethrone', diceThroneCriticalImageResolver);

// 导出类型（兼容）
export type { DiceThroneCore } from './domain';
