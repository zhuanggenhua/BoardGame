/**
 * DiceThrone 游戏定义（新引擎架构）
 * 
 * 使用领域内核 + 引擎适配器
 */

import type { ActionLogEntry, ActionLogSegment, Command, GameEvent, MatchState, PlayerId } from '../../engine/types';
import {
    createActionLogSystem,
    createCheatSystem,
    createEventStreamSystem,
    createFlowSystem,
    createInteractionSystem,
    createSimpleChoiceSystem,
    createMultistepChoiceSystem,
    createRematchSystem,
    createResponseWindowSystem,
    createTutorialSystem,
    createUndoSystem,
    CharacterSelectionSystem,
} from '../../engine';
import { createGameEngine } from '../../engine/adapter';
import { buildDamageBreakdownSegment, type DamageSourceResolver } from '../../engine/primitives/actionLogHelpers';
import { DiceThroneDomain } from './domain';
import { getDiceDefinition } from './domain/diceRegistry';
import { DICETHRONE_COMMANDS, TOKEN_IDS } from './domain/ids';
import type {
    AbilityCard,
    DiceThroneCore,
    TurnPhase,
    ChoiceResolvedEvent,
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
    DamageShieldGrantedEvent,
} from './domain/types';
import { getCommandCategory, CommandCategory, validateCommandCategories } from './domain/commandCategories';
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
    // 交互确认会承载关键选择结果（如暴击/精准），需要进入操作日志
    'SYS_INTERACTION_RESPOND',
] as const;

const UNDO_ALLOWLIST = [
    'PLAY_CARD',
    'PLAY_UPGRADE_CARD',
    'SELL_CARD',
    'SELECT_ABILITY',
    'ADVANCE_PHASE',
] as const;

const DT_NS = 'game-dicethrone';

const OFFENSIVE_ROLL_END_TOKEN_EFFECT_KEYS: Partial<Record<string, string>> = {
    [TOKEN_IDS.CRIT]: 'actionLog.offensiveRollEndTokenEffect.crit',
    [TOKEN_IDS.ACCURACY]: 'actionLog.offensiveRollEndTokenEffect.accuracy',
};

function getOffensiveRollEndTokenEffectKey(
    tokenId?: string,
    customId?: string,
): string | null {
    if (!tokenId || !customId?.startsWith('use-')) return null;
    return OFFENSIVE_ROLL_END_TOKEN_EFFECT_KEYS[tokenId] ?? null;
}

/** DiceThrone 伤害来源解析器（实现 DamageSourceResolver 接口） */
const dtDamageSourceResolver: DamageSourceResolver = {
    resolve(sourceAbilityId: string) {
        // 系统来源映射
        switch (sourceAbilityId) {
            case 'upkeep-burn': return { label: 'actionLog.damageSource.upkeepBurn', isI18n: true, ns: DT_NS };
            case 'upkeep-poison': return { label: 'actionLog.damageSource.upkeepPoison', isI18n: true, ns: DT_NS };
            case 'retribution-reflect': return { label: 'actionLog.damageSource.retribution', isI18n: true, ns: DT_NS };
        }
        return null;
    },
};

/**
 * 将 sourceAbilityId 解析为可读的 i18n 来源标签
 * 需要访问 core 状态（技能表查找），所以保留为独立函数而非 resolver 方法
 */
function resolveAbilitySourceLabel(
    sourceAbilityId: string | undefined,
    core: DiceThroneCore,
    _playerId: PlayerId,
): { label: string; isI18n: boolean; ns?: string } | null {
    if (!sourceAbilityId) return null;
    // 先走 resolver（系统来源）
    const fromResolver = dtDamageSourceResolver.resolve(sourceAbilityId);
    if (fromResolver) return fromResolver;
    // 从双方玩家技能表中查找（支持变体 ID）
    for (const pid of Object.keys(core.players)) {
        const found = findPlayerAbility(core, pid, sourceAbilityId);
        if (found) {
            const label = found.variant?.name ?? found.ability.name;
            if (label) {
                return { label, isI18n: label.includes('.'), ns: DT_NS };
            }
        }
    }
    // 卡牌 ID 解析
    if (sourceAbilityId.startsWith('card-')) {
        const card = findDiceThroneCard(core, sourceAbilityId);
        if (card?.name) {
            return { label: card.name, isI18n: card.name.includes('.'), ns: DT_NS };
        }
    }
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
            previewRef: card.previewRef,
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

    if (command.type === 'SELL_CARD') {
        const cardId = (command.payload as { cardId: string }).cardId;
        const card = findDiceThroneCard(core, cardId, command.playerId);

        const segments: ActionLogSegment[] = [
            i18nSeg('actionLog.sellCard'),
        ];
        if (card?.previewRef) {
            const isI18nKey = card.name?.includes('.');
            segments.push({
                type: 'card',
                cardId: card.id,
                previewText: card.name ?? cardId,
                previewRef: card.previewRef,
                ...(isI18nKey ? { previewTextNs: DT_NS } : {}),
            });
        } else {
            const displayName = card?.name ?? cardId;
            segments.push({ type: 'text', text: displayName });
        }
        segments.push(i18nSeg('actionLog.sellCardCp'));

        entries.push({
            id: `SELL_CARD-${command.playerId}-${timestamp}`,
            timestamp,
            actorId: command.playerId,
            kind: 'SELL_CARD',
            segments,
        });
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

        // 检查是否有自动防御技能触发（onPhaseEnter 触发的防御技能）
        // 这些 ABILITY_ACTIVATED 事件在 ADVANCE_PHASE 命令后产生，需要单独记录
        const autoDefenseEvent = events.find(
            (e): e is AbilityActivatedEvent =>
                e.type === 'ABILITY_ACTIVATED' && (e as AbilityActivatedEvent).payload.isDefense === true
        );
        if (autoDefenseEvent) {
            const { abilityId, playerId } = autoDefenseEvent.payload;
            const match = findPlayerAbility(core, playerId, abilityId);
            const rawAbilityName = match?.variant?.name ?? match?.ability.name ?? abilityId;
            const abilityNameKey = getAbilityI18nKey(rawAbilityName) || abilityId;
            const isI18nKey = abilityNameKey.includes('.');
            entries.push({
                id: `AUTO_DEFENSE-${playerId}-${abilityId}-${timestamp}`,
                timestamp: timestamp + 0.5,
                actorId: playerId,
                kind: 'SELECT_ABILITY',
                segments: [i18nSeg(
                    'actionLog.abilityActivatedDefense',
                    { abilityName: abilityNameKey },
                    isI18nKey ? ['abilityName'] : undefined,
                )],
            });
        }
    }

    if (command.type === 'SELECT_ABILITY') {
        const abilityEvent = events.find(
            event => event.type === 'ABILITY_ACTIVATED'
        ) as AbilityActivatedEvent | undefined;
        const abilityId = abilityEvent?.payload.abilityId
            ?? (command.payload as { abilityId?: string }).abilityId;
        const playerId = abilityEvent?.payload.playerId ?? command.playerId;
        if (abilityId && playerId) {
            const match = findPlayerAbility(core, playerId, abilityId);
            // 分层型变体有独立名称时优先使用（如战斗"而非父级"力大无穷 II"）
            const rawAbilityName = match?.variant?.name ?? match?.ability.name ?? abilityId;
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
            const spriteAsset = getDiceDefinition(activeDice[0]?.definitionId)?.assets?.spriteSheet
                ?? ASSETS.DICE_SPRITE(characterId);
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
                const match = findPlayerAbility(core, rollerId, abilityId);
                const rawName = match?.variant?.name ?? match?.ability.name ?? abilityId;
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

        if (command.type === 'SYS_INTERACTION_RESPOND' && event.type === 'CHOICE_RESOLVED') {
            const choiceEvent = event as ChoiceResolvedEvent;
            const { tokenId, customId, playerId } = choiceEvent.payload;
            const effectKey = getOffensiveRollEndTokenEffectKey(tokenId, customId);

            if (tokenId && effectKey) {
                const tokenKey = getTokenI18nKey(tokenId);
                const paramI18nKeys = ['effectLabel'];
                if (tokenKey.includes('.')) {
                    paramI18nKeys.push('tokenLabel');
                }

                entries.push({
                    id: `TOKEN_USED-${playerId}-${entryTimestamp}-${index}`,
                    timestamp: entryTimestamp,
                    actorId: playerId,
                    kind: 'TOKEN_USED',
                    segments: [
                        i18nSeg(
                            'actionLog.offensiveRollEndTokenUsed',
                            { tokenLabel: tokenKey, effectLabel: effectKey },
                            paramI18nKeys,
                        ),
                    ],
                });
                return;
            }
        }

        if (event.type === 'DAMAGE_DEALT') {
            const damageEvent = event as DamageDealtEvent;
            const { targetId, amount, actualDamage, sourceAbilityId, modifiers, breakdown, sourcePlayerId, shieldsConsumed } = damageEvent.payload;
            let actorId = targetId;
            if (attackResolved) {
                if (targetId === attackResolved.payload.defenderId) {
                    actorId = attackResolved.payload.attackerId;
                } else if (sourceAbilityId === 'retribution-reflect') {
                    actorId = attackResolved.payload.defenderId;
                }
            } else if (sourcePlayerId && sourcePlayerId !== targetId) {
                // Token 响应窗口关闭后产生的伤害：用 sourcePlayerId 推断攻击方
                actorId = sourcePlayerId;
            }
            const dealt = actualDamage ?? amount ?? 0;
            
            // 计算最终伤害（扣除护盾后）
            const totalShieldAbsorbed = shieldsConsumed?.reduce((sum, s) => sum + s.absorbed, 0) ?? 0;
            const finalDamage = Math.max(0, dealt - totalShieldAbsorbed);
            
            const isSelfDamage = actorId === targetId;

            // 解析来源技能名
            const effectiveSourceId = sourceAbilityId ?? attackResolved?.payload.sourceAbilityId;
            const source = resolveAbilitySourceLabel(effectiveSourceId, core, actorId);

            // 使用引擎层通用工具构建 breakdown segment
            const breakdownSeg = buildDamageBreakdownSegment(
                finalDamage,
                {
                    sourceAbilityId: effectiveSourceId,
                    breakdown,
                    modifiers,
                    shieldsConsumed,
                },
                {
                    resolve: (sid) => resolveAbilitySourceLabel(sid, core, actorId),
                    // 自定义护盾渲染：解析护盾来源名称
                    renderShields: (shields) => shields.map(shield => {
                        const shieldSource = shield.sourceId
                            ? resolveAbilitySourceLabel(shield.sourceId, core, targetId)
                            : null;
                        return {
                            label: shieldSource?.label ?? 'actionLog.damageSource.shield',
                            labelIsI18n: shieldSource?.isI18n ?? true,
                            labelNs: shieldSource?.isI18n ? shieldSource.ns : DT_NS,
                            value: -shield.absorbed,
                            color: 'negative' as const,
                        };
                    }),
                },
                DT_NS,
            );

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

            // 使用引擎层通用工具构建 breakdown segment
            const healBreakdown = buildDamageBreakdownSegment(
                amount,
                { sourceAbilityId: healSourceId },
                { resolve: (sid) => resolveAbilitySourceLabel(sid, core, command.playerId) },
                DT_NS,
            );

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
            
            // 伏击 Token：damageModifier 在 reducer 层为 0，真正的伤害值在 BONUS_DIE_ROLLED 的 pendingDamageBonus
            // 优先使用 BONUS_DIE_ROLLED 的值（如果存在）
            let actualDamageModifier = damageModifier;
            if (tokenId === 'sneak_attack' && typeof damageModifier === 'number') {
                const bonusDieEvent = events.find(
                    (e): e is BonusDieRolledEvent => e.type === 'BONUS_DIE_ROLLED'
                ) as BonusDieRolledEvent | undefined;
                if (bonusDieEvent?.payload.pendingDamageBonus !== undefined) {
                    actualDamageModifier = bonusDieEvent.payload.pendingDamageBonus;
                }
            }
            
            if (typeof actualDamageModifier === 'number') {
                segments.push(i18nSeg('actionLog.tokenModifier', { amount: actualDamageModifier }));
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

        if (event.type === 'DAMAGE_SHIELD_GRANTED') {
            const shieldEvent = event as DamageShieldGrantedEvent;
            const { targetId, sourceId, reductionPercent } = shieldEvent.payload;
            // 只为百分比减免护盾生成日志（固定值护盾由 PREVENT_DAMAGE 处理）
            if (reductionPercent == null) return;

            const source = resolveAbilitySourceLabel(sourceId, core, command.playerId);
            const key = source ? 'actionLog.damageShieldPercent' : 'actionLog.damageShieldPercentPlain';
            const params: Record<string, string | number> = { percent: reductionPercent };
            const paramI18nKeys: string[] = [];
            if (source) {
                params.source = source.label;
                if (source.isI18n) paramI18nKeys.push('source');
            }

            entries.push({
                id: `DAMAGE_SHIELD-${targetId}-${entryTimestamp}-${index}`,
                timestamp: entryTimestamp,
                actorId: targetId,
                kind: 'DAMAGE_SHIELD_GRANTED',
                segments: [
                    i18nSeg(key, params, paramI18nKeys.length > 0 ? paramI18nKeys : undefined),
                ],
            });
        }

        if (event.type === 'DIE_MODIFIED') {
            const modEvent = event as DieModifiedEvent;
            const { dieId, oldValue, newValue, playerId, sourceCardId } = modEvent.payload;
            const card = sourceCardId ? findDiceThroneCard(core, sourceCardId, playerId) : undefined;
            const cardName = card?.name ?? sourceCardId;
            const isCardI18n = cardName?.includes('.');
            
            const segments: ActionLogSegment[] = [
                i18nSeg('actionLog.dieModified', { 
                    dieId: dieId + 1, 
                    oldValue, 
                    newValue 
                }),
            ];
            if (sourceCardId && cardName) {
                segments.push(i18nSeg('actionLog.dieModifiedSource', { 
                    source: cardName 
                }, isCardI18n ? ['source'] : undefined));
            }
            
            entries.push({
                id: `DIE_MODIFIED-${playerId}-${entryTimestamp}-${index}`,
                timestamp: entryTimestamp,
                actorId: playerId,
                kind: 'DIE_MODIFIED',
                segments,
            });
            return;
        }

        if (event.type === 'DIE_REROLLED') {
            const rerollEvent = event as DieRerolledEvent;
            const { dieId, oldValue, newValue, playerId, sourceCardId } = rerollEvent.payload;
            const card = sourceCardId ? findDiceThroneCard(core, sourceCardId, playerId) : undefined;
            const cardName = card?.name ?? sourceCardId;
            const isCardI18n = cardName?.includes('.');
            
            const segments: ActionLogSegment[] = [
                i18nSeg('actionLog.dieRerolled', {
                    dieId: dieId + 1, 
                    oldValue, 
                    newValue 
                }),
            ];
            if (sourceCardId && cardName) {
                segments.push(i18nSeg('actionLog.dieRerolledSource', { 
                    source: cardName 
                }, isCardI18n ? ['source'] : undefined));
            }
            
            entries.push({
                id: `DIE_REROLLED-${playerId}-${entryTimestamp}-${index}`,
                timestamp: entryTimestamp,
                actorId: playerId,
                kind: 'DIE_REROLLED',
                segments,
            });
            return;
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
    new CharacterSelectionSystem({ setupPhaseName: 'setup' }),
    createFlowSystem<DiceThroneCore>({ hooks: diceThroneFlowHooks }),
    createEventStreamSystem(),
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
    createSimpleChoiceSystem(),
    createMultistepChoiceSystem(),
    createRematchSystem(),
    createResponseWindowSystem({
        // 使用分类系统（推荐）
        allowedCommandCategories: [
            CommandCategory.TACTICAL,
            CommandCategory.UI_INTERACTION,
            CommandCategory.STATE_MANAGEMENT,
        ],
        getCommandCategory,
        
        // 保留旧的白名单配置作为补充（可选）
        // 如果某些命令需要特殊处理，可以在这里添加
        allowedCommands: [
            // 所有命令都已通过分类系统管理，这里留空
            // 如果需要添加特殊命令，可以在这里添加
        ],
        
        responderExemptCommands: ['USE_TOKEN', 'SKIP_TOKEN_RESPONSE', 'USE_PASSIVE_ABILITY'],
        responseAdvanceEvents: [
            { eventType: 'CARD_PLAYED' },
        ],
        interactionLock: {
            requestEvent: 'INTERACTION_REQUESTED',
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
    'GRANT_TOKENS',
    // CONFIRM_INTERACTION 和 CANCEL_INTERACTION 已废弃 - 使用 InteractionSystem 的 RESPOND/CANCEL
    // 选角相关
    'SELECT_CHARACTER',
    'HOST_START_GAME',
    'PLAYER_READY',
    'PLAYER_UNREADY',
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
    'SYS_INTERACTION_CONFIRM',
];

// 开发环境：验证所有命令都已分类
// 只在浏览器环境中运行（Node.js 环境中 import.meta.env 不存在）
if (typeof window !== 'undefined' && typeof import.meta.env !== 'undefined' && import.meta.env.DEV) {
    validateCommandCategories(COMMAND_TYPES);
}

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
