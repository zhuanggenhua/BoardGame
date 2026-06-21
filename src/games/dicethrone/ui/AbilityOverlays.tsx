import React from 'react';
import { useTranslation } from 'react-i18next';
import { CardPreview } from '../../../components/common/media/CardPreview';
import { saveDiceThroneAbilityLayout } from '../../../api/layout';
import { UI_Z_INDEX } from '../../../core';
import { playSound } from '../../../lib/audio/useGameAudio';
import { useTouchInspectGesture } from '../../../hooks/ui/useTouchInspectGesture';
import {
    DICETHRONE_ABILITY_SLOT_LAYOUTS,
    DICETHRONE_PLAYER_BOARD_UI_TUNING,
    getAbilitySlotLayoutForCharacter,
    getPlayerBoardLayoutVersion,
    type DiceThronePlayerBoardLayoutVersion,
} from './abilitySlotLayout';
import type { AbilityCard } from '../types';
import {
    ABILITY_SLOT_MAP as SHARED_ABILITY_SLOT_MAP,
    slotContainsAbilityIdForCharacter,
} from './abilitySlotMapping';
import {
    HERO_CARDS_MAP,
    getSlotAbilityId,
    getUpgradeCardForAbilityLevel,
} from './abilityOverlayHelpers';
import type { HeroState } from '../domain/types';

// 被动能力配置（按角色）
const PASSIVE_ABILITIES: Record<string, { slotId: string; cardId?: string }[]> = {
    paladin: [
        {
            slotId: 'fist',  // 使用 fist 槽位（左上角）
            cardId: 'card-tithes-2',  // 对应的升级卡
        }
    ],
    treant: [
        {
            slotId: 'sky',
        },
    ],
};

/** 从升级卡定义中提取目标技能 ID */
const getUpgradeTargetFromCard = (card?: AbilityCard): string | null => {
    if (!card || card.type !== 'upgrade' || !card.effects) return null;
    const action = card.effects.find(e => e.action?.type === 'replaceAbility')?.action;
    return action?.type === 'replaceAbility' ? (action.targetAbilityId ?? null) : null;
};


const ABILITY_SLOT_MAP = SHARED_ABILITY_SLOT_MAP;
    /** AbilityOverlays 通过 ref 暴露的方法 */
    export interface AbilityOverlaysHandle {
        /** 保存当前布局到服务端 */
        saveLayout: () => Promise<{ hint: string }>;
    }

    interface AbilityOverlaysProps {
        isEditing: boolean;
        availableAbilityIds: string[];
        canSelect: boolean;
        canHighlight: boolean;
        onSelectAbility: (abilityId: string) => void;
        onHighlightedAbilityClick?: () => void;
        selectedAbilityId?: string;
        activatingAbilityId?: string;
        abilityLevels?: Record<string, number>;
        characterId?: string;
        playerBoardFace?: HeroState['playerBoardFace'];
        locale?: string;
        onMagnifyCard?: (card: AbilityCard) => void;
        playerTokens?: Record<string, number>;  // 新增：玩家的 token 状态（用于显示被动能力激活状态）
    }

    export const AbilityOverlays = React.forwardRef<AbilityOverlaysHandle, AbilityOverlaysProps>(({
        isEditing,
        availableAbilityIds,
        canSelect,
        canHighlight,
        onSelectAbility,
        onHighlightedAbilityClick,
        selectedAbilityId,
        activatingAbilityId,
        abilityLevels,
        characterId = 'monk', // 用于查找对应角色的升级卡定义
        playerBoardFace,
        locale,
        onMagnifyCard,
        playerTokens: _playerTokens,
    }, ref) => {
        const { t } = useTranslation('game-dicethrone');
        const {
            showDesktopInspectButton,
            getTouchInspectProps,
            shouldBlockInspectClick,
        } = useTouchInspectGesture<string, AbilityCard>({
            enabled: Boolean(onMagnifyCard) && !isEditing,
            onInspect: (_key, card) => {
                onMagnifyCard?.(card);
            },
        });

        const layoutVersion = React.useMemo<DiceThronePlayerBoardLayoutVersion>(
            () => getPlayerBoardLayoutVersion(characterId),
            [characterId],
        );
        const [allLayouts, setAllLayouts] = React.useState(() => ({
            v1: DICETHRONE_ABILITY_SLOT_LAYOUTS.v1.map(slot => ({ ...slot })),
            v2: DICETHRONE_ABILITY_SLOT_LAYOUTS.v2.map(slot => ({ ...slot })),
        }));
        const slots = allLayouts[layoutVersion] ?? getAbilitySlotLayoutForCharacter(characterId);
        const [editingId, setEditingId] = React.useState<string | null>(null);
        const containerRef = React.useRef<HTMLDivElement>(null);
        const dragInfo = React.useRef<{ id: string, type: 'move' | 'resize', startX: number, startY: number, startVal: { x: number; y: number; w: number; h: number } } | null>(null);
        const editingGuideClassName = 'absolute inset-0 rounded-lg border-2 border-amber-300/90 bg-amber-200/10 shadow-[0_0_0_1px_rgba(120,53,15,0.7),0_0_14px_rgba(251,191,36,0.28)] pointer-events-none';
        const editingGuideInnerClassName = 'absolute inset-[3px] rounded-[10px] border border-dashed border-slate-950/65 pointer-events-none';
        const activeEditingGuideClassName = 'absolute inset-0 rounded-lg border-[2.5px] border-emerald-300 bg-emerald-400/12 shadow-[0_0_0_1px_rgba(6,95,70,0.95),0_0_18px_rgba(52,211,153,0.55)] pointer-events-none';
        const activeEditingGuideInnerClassName = 'absolute inset-[3px] rounded-[10px] border border-dashed border-emerald-950/80 pointer-events-none';
        const highlightOverlayClassName = 'absolute inset-0 rounded-lg border-[2.5px] border-rose-400 shadow-[0_0_20px_rgba(251,113,133,0.8),0_0_40px_rgba(251,113,133,0.4)] pointer-events-none z-10 animate-pulse';
        const selectedOverlayClassName = 'absolute inset-0 rounded-lg border-[3px] border-red-500 shadow-[0_0_25px_rgba(239,68,68,0.9),0_0_50px_rgba(239,68,68,0.5)] pointer-events-none z-10';
        const inspectButtonClassName = 'absolute right-[0.2vw] top-[0.2vw] z-20 flex h-[1.15vw] w-[1.15vw] min-h-[14px] min-w-[14px] items-center justify-center rounded-full border border-white/18 bg-black/68 text-white/92 shadow-[0_0.18vw_0.42vw_rgba(0,0,0,0.45)] transition-[background-color,border-color,opacity] duration-200 hover:border-amber-300/45 hover:bg-amber-500/78';

        // 通过 ref 暴露保存方法，供调试面板调用
        React.useImperativeHandle(ref, () => ({
            saveLayout: async () => {
                try {
                    const result = await saveDiceThroneAbilityLayout({
                        slotLayouts: allLayouts,
                        uiTuning: DICETHRONE_PLAYER_BOARD_UI_TUNING,
                    });
                    const hint = result.relativePath
                        ? `已写入 ${result.relativePath}（${layoutVersion.toUpperCase()} 布局配置）`
                        : `已写入布局配置文件（${layoutVersion.toUpperCase()}）`;
                    return { hint };
                } catch (error) {
                    const message = error instanceof Error ? error.message : '保存失败';
                    return { hint: message };
                }
            },
        }), [allLayouts, layoutVersion]);

        const resolveAbilityId = (slotId: string) => {
            const mapping = ABILITY_SLOT_MAP[slotId];
            if (!mapping) return null;
            return availableAbilityIds.find(id => slotContainsAbilityIdForCharacter(characterId, slotId, id, playerBoardFace)) ?? null;
        };

        const handleMouseDown = (e: React.MouseEvent, id: string, type: 'move' | 'resize') => {
            if (!isEditing) return;
            e.stopPropagation(); e.preventDefault();
            setEditingId(id);
            const slot = slots.find(s => s.id === id);
            if (!slot) return;
            dragInfo.current = { id, type, startX: e.clientX, startY: e.clientY, startVal: { ...slot } };
        };

        React.useEffect(() => {
            const handleMouseMove = (e: MouseEvent) => {
                if (!dragInfo.current || !containerRef.current) return;
                const { id, type, startX, startY, startVal } = dragInfo.current;
                const rect = containerRef.current.getBoundingClientRect();
                const deltaX = ((e.clientX - startX) / rect.width) * 100;
                const deltaY = ((e.clientY - startY) / rect.height) * 100;
                setAllLayouts(prev => ({
                    ...prev,
                    [layoutVersion]: prev[layoutVersion].map(s => s.id === id ? {
                        ...s,
                        ...(type === 'move'
                            ? { x: Number((startVal.x + deltaX).toFixed(2)), y: Number((startVal.y + deltaY).toFixed(2)) }
                            : { w: Number(Math.max(5, startVal.w + deltaX).toFixed(2)), h: Number(Math.max(5, startVal.h + deltaY).toFixed(2)) })
                    } : s),
                }));
            };
            const handleMouseUp = () => { dragInfo.current = null; };
            if (isEditing) {
                window.addEventListener('mousemove', handleMouseMove);
                window.addEventListener('mouseup', handleMouseUp);
            }
            return () => {
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);
            };
        }, [isEditing, layoutVersion]);

        return (
            <div
                ref={containerRef}
                className="absolute inset-0 pointer-events-none"
                style={{ zIndex: UI_Z_INDEX.hud }}
                data-tutorial-id="ability-slots"
            >
                {slots.map((slot) => {
                    // 检查是否是被动能力槽位
                    const passiveAbility = PASSIVE_ABILITIES[characterId]?.find(p => p.slotId === slot.id);
                    
                    if (passiveAbility) {
                        // 渲染被动能力
                        const heroCards = HERO_CARDS_MAP[characterId];
                        const passiveCard = heroCards?.find(c => c.id === passiveAbility.cardId);
                        // 通过 abilityLevels 判断是否已升级（与普通技能统一）
                        const passiveBaseId = getUpgradeTargetFromCard(passiveCard);
                        const isUpgraded = passiveBaseId
                            ? (abilityLevels?.[passiveBaseId] ?? 1) > 1
                            : false;
                        const passiveUpgradeCard = isUpgraded ? passiveCard : undefined;
                        const passiveInspectKey = `passive-${characterId}-${slot.id}-${passiveUpgradeCard?.id ?? 'none'}`;
                        const mapping = ABILITY_SLOT_MAP[slot.id];
                        const slotLabel = mapping ? t(mapping.labelKey) : slot.id;
                        
                        return (
                            <div
                                key={slot.id}
                                data-ability-slot={slot.id}
                                data-passive-ability="true"
                                data-upgrade-card-interactive={passiveUpgradeCard ? 'true' : 'false'}
                                onMouseDown={(e) => isEditing ? handleMouseDown(e, slot.id, 'move') : undefined}
                                className={`
                                    absolute transition-all duration-200 rounded-lg
                                    ${isEditing ? 'pointer-events-auto cursor-move' : passiveUpgradeCard ? 'pointer-events-auto cursor-zoom-in' : 'pointer-events-none'}
                                    ${isEditing && editingId === slot.id ? 'z-50' : ''}
                                `}
                                style={{ left: `${slot.x}%`, top: `${slot.y}%`, width: `${slot.w}%`, height: `${slot.h}%` }}
                                {...(passiveUpgradeCard ? getTouchInspectProps(passiveInspectKey, passiveUpgradeCard) : {})}
                                onClick={() => {
                                    if (!passiveUpgradeCard || shouldBlockInspectClick(passiveInspectKey)) return;
                                    onMagnifyCard?.(passiveUpgradeCard);
                                }}
                            >
                                {isEditing && (
                                    <>
                                        <div className={editingId === slot.id ? activeEditingGuideClassName : editingGuideClassName} />
                                        <div className={editingId === slot.id ? activeEditingGuideInnerClassName : editingGuideInnerClassName} />
                                    </>
                                )}
                                {/* 只有升级后才叠加升级卡图片，未升级时玩家面板底图已有基础被动图案 */}
                                {isUpgraded && passiveCard?.previewRef && (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <CardPreview
                                            previewRef={passiveCard.previewRef}
                                            locale={locale}
                                            className="w-full h-full rounded-lg"
                                        />
                                    </div>
                                )}
                                {/* 如果已升级，显示激活状态 */}
                                {isUpgraded && !isEditing && (
                                    <div className="absolute inset-0 rounded-lg border-2 border-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.6)]" />
                                )}
                                {isEditing && (
                                    <>
                                        <div className="absolute -top-3 left-0 bg-black/80 text-[8px] text-white px-1 rounded whitespace-nowrap pointer-events-none">
                                            {slotLabel} ({t('layout.passiveTag')}) {slot.x.toFixed(2)}% {slot.y.toFixed(2)}% ({slot.w.toFixed(2)}×{slot.h.toFixed(2)})
                                        </div>
                                        <div
                                            onMouseDown={(e) => handleMouseDown(e, slot.id, 'resize')}
                                            className="absolute -right-1 -bottom-1 w-3 h-3 bg-amber-400 border border-amber-600 rounded-sm cursor-nwse-resize pointer-events-auto z-50"
                                        />
                                    </>
                                )}
                            </div>
                        );
                    }
                    
                    // 方案 A：不再需要计算精灵图位置（col, row, bgX, bgY），玩家面板已包含基础技能
                    const isResolved = resolveAbilityId(slot.id);
                    const baseAbilityId = getSlotAbilityId(characterId, slot.id, playerBoardFace);
                    const level = baseAbilityId ? (abilityLevels?.[baseAbilityId] ?? 1) : 1;
                    const upgradeCard = baseAbilityId && level > 1
                        ? getUpgradeCardForAbilityLevel(characterId, baseAbilityId, level)
                        : undefined;
                    const upgradePreviewRef = upgradeCard?.previewRef;
                    const mapping = ABILITY_SLOT_MAP[slot.id];
                    const slotLabel = mapping ? t(mapping.labelKey) : slot.id;
                    const isAbilitySelected = !isEditing && selectedAbilityId === isResolved;
                    const isAvailable = Boolean(isResolved);
                    const canClick = !isEditing && canSelect && isAvailable;
                    const isActivating = !isEditing && activatingAbilityId === isResolved;
                    const shouldHighlight = !isEditing && canHighlight && isAvailable;
                    const hasPrimarySlotClick = canClick || (!isEditing && shouldHighlight && !canSelect && Boolean(onHighlightedAbilityClick));
                    const slotInspectKey = `upgrade-${characterId}-${slot.id}-${upgradeCard?.id ?? 'none'}`;
                    const isUltimate = slot.id === 'ultimate';
                    return (
                        <div
                            key={slot.id}
                            data-ability-slot={slot.id}
                            data-resolved-ability-id={isResolved ?? ''}
                            data-base-ability-id={baseAbilityId ?? ''}
                            data-can-click={canClick ? 'true' : 'false'}
                            data-should-highlight={shouldHighlight ? 'true' : 'false'}
                            data-is-selected={isAbilitySelected ? 'true' : 'false'}
                            data-is-activating={isActivating ? 'true' : 'false'}
                            data-upgrade-card-interactive={upgradeCard ? 'true' : 'false'}
                            onMouseDown={(e) => handleMouseDown(e, slot.id, 'move')}
                            className={`
                            absolute transition-all duration-200 rounded-lg
                            ${isEditing ? 'pointer-events-auto cursor-move' : `pointer-events-auto ${upgradeCard && !hasPrimarySlotClick ? 'cursor-zoom-in' : 'cursor-pointer'} group`}
                            ${isEditing && editingId === slot.id ? 'z-50' : ''}
                            ${canClick ? 'hover:border-2 hover:border-amber-400 hover:shadow-[0_0_15px_rgba(251,191,36,0.5)] hover:z-30' : ''}
                            ${isActivating ? 'animate-ability-activate z-50' : ''}
                        `}
                            style={{ left: `${slot.x}%`, top: `${slot.y}%`, width: `${slot.w}%`, height: `${slot.h}%` }}
                            {...(upgradeCard ? getTouchInspectProps(slotInspectKey, upgradeCard) : {})}
                            onClick={() => {
                                if (upgradeCard && !hasPrimarySlotClick) {
                                    if (shouldBlockInspectClick(slotInspectKey)) return;
                                    onMagnifyCard?.(upgradeCard);
                                    return;
                                }
                                if (canClick && isResolved) {
                                    // DiceThrone：选择技能统一使用 dialog_choice 点击音效
                                    playSound('ui.general.khron_studio_rpg_interface_essentials_inventory_dialog_ucs_system_192khz.dialog.dialog_choice.uiclick_dialog_choice_01_krst_none');
                                    onSelectAbility(isResolved);
                                } else if (!isEditing && shouldHighlight && !canSelect && onHighlightedAbilityClick) {
                                    onHighlightedAbilityClick();
                                }
                            }}
                        >
                            {isEditing && (
                                <>
                                    <div className={editingId === slot.id ? activeEditingGuideClassName : editingGuideClassName} />
                                    <div className={editingId === slot.id ? activeEditingGuideInnerClassName : editingGuideInnerClassName} />
                                </>
                            )}
                            {/* 方案 A：不渲染基础精灵图，玩家面板本身已包含基础技能图案 */}
                            {/* 升级卡叠加层（保持卡牌原始比例，居中覆盖） */}
                            {!isUltimate && upgradePreviewRef && (
                                <div
                                    className="absolute inset-0 flex items-center justify-center pointer-events-none"
                                >
                                    <CardPreview
                                        previewRef={upgradePreviewRef}
                                        locale={locale}
                                        className="w-full h-full rounded-lg"
                                    />
                                </div>
                            )}
                            {shouldHighlight && (
                                <div
                                    data-testid={`dt-ability-highlight-${slot.id}`}
                                    className={highlightOverlayClassName}
                                />
                            )}
                            {isAbilitySelected && (
                                <div
                                    data-testid={`dt-ability-selected-${slot.id}`}
                                    className={selectedOverlayClassName}
                                >
                                    <div className="absolute -inset-[2px] rounded-lg border-2 border-white/60 animate-pulse" />
                                </div>
                            )}
                            {upgradeCard && hasPrimarySlotClick && showDesktopInspectButton && !isEditing && (
                                <button
                                    type="button"
                                    className={inspectButtonClassName}
                                    aria-label={`查看${slotLabel}升级卡`}
                                    data-testid={`dt-upgrade-magnify-button-${slot.id}`}
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        onMagnifyCard?.(upgradeCard);
                                    }}
                                >
                                    <svg className="h-[0.44vw] w-[0.44vw] min-h-[8px] min-w-[8px] fill-current" viewBox="0 0 20 20" aria-hidden="true">
                                        <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                                    </svg>
                                </button>
                            )}
                            {isEditing && (
                                <>
                                    <div className="absolute -top-3 left-0 bg-black/80 text-[8px] text-white px-1 rounded whitespace-nowrap pointer-events-none">
                                        {slotLabel} {slot.x.toFixed(2)}% {slot.y.toFixed(2)}% ({slot.w.toFixed(2)}×{slot.h.toFixed(2)})
                                    </div>
                                    {/* 右下角 resize 手柄 */}
                                    <div
                                        onMouseDown={(e) => handleMouseDown(e, slot.id, 'resize')}
                                        className="absolute -right-1 -bottom-1 w-3 h-3 bg-amber-400 border border-amber-600 rounded-sm cursor-nwse-resize pointer-events-auto z-50"
                                    />
                                </>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    });

    AbilityOverlays.displayName = 'AbilityOverlays';
