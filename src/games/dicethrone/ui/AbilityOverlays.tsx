import React from 'react';
import { useTranslation } from 'react-i18next';
import { buildLocalizedImageSet } from '../../../core';
import { ASSETS } from './assets';
import type { CardAtlasConfig } from './cardAtlas';
import { getCardAtlasStyle } from './cardAtlas';
import { MONK_CARDS } from '../monk/cards';

const INITIAL_SLOTS = [
    { id: 'fist', index: 0, x: 0.1, y: 1.5, w: 20.8, h: 38.5 },
    { id: 'chi', index: 1, x: 22.2, y: 1.4, w: 21.3, h: 39.4 },
    { id: 'sky', index: 2, x: 54.7, y: 1.4, w: 21.7, h: 39.6 },
    { id: 'lotus', index: 3, x: 77.0, y: 1.3, w: 21.5, h: 39.5 },
    { id: 'combo', index: 4, x: 0.1, y: 42.3, w: 20.9, h: 39.3 },
    { id: 'lightning', index: 5, x: 22.1, y: 42.4, w: 21.8, h: 38.7 },
    { id: 'calm', index: 6, x: 54.5, y: 42.0, w: 21.9, h: 40.2 },
    { id: 'meditate', index: 7, x: 77.3, y: 42.0, w: 21.7, h: 39.9 },
    { id: 'ultimate', index: 8, x: 0.1, y: 83.5, w: 55.0, h: 15.6 },
];

const ABILITY_SLOT_MAP: Record<string, { labelKey: string; ids: string[] }> = {
    // 拳术：基础(3/4/5拳)、II级(2-3/2-4/2-5拳)、III级(3-3/3-4/3-5拳)
    fist: { labelKey: 'abilitySlots.fist', ids: [
        'fist-technique-5', 'fist-technique-4', 'fist-technique-3',
        'fist-technique-2-5', 'fist-technique-2-4', 'fist-technique-2-3',
        'fist-technique-3-5', 'fist-technique-3-4', 'fist-technique-3-3',
    ] },
    // 物我两忘：基础、II级
    chi: { labelKey: 'abilitySlots.chi', ids: ['zen-forget', 'zen-forget-2'] },
    // 天人合一：基础、II级
    sky: { labelKey: 'abilitySlots.sky', ids: ['harmony', 'harmony-2'] },
    // 莲花掌：基础、II级(4/5/3莲花)
    lotus: { labelKey: 'abilitySlots.lotus', ids: [
        'lotus-palm',
        'lotus-palm-2-5', 'lotus-palm-2-4', 'lotus-palm-2-3',
    ] },
    // 太极连环掌：基础、II级
    combo: { labelKey: 'abilitySlots.combo', ids: ['taiji-combo', 'taiji-combo-2'] },
    // 雷霆万钧：基础、II级
    lightning: { labelKey: 'abilitySlots.lightning', ids: ['thunder-strike', 'thunder-strike-2'] },
    // 心如止水：基础、II级
    calm: { labelKey: 'abilitySlots.calm', ids: ['calm-water', 'calm-water-2'] },
    // 冒想：基础、II级、III级
    meditate: { labelKey: 'abilitySlots.meditate', ids: ['meditation', 'meditation-2', 'meditation-3'] },
    // 终极技能：超越（需要5莲花）
    ultimate: { labelKey: 'abilitySlots.ultimate', ids: ['transcendence'] },
};

export const getAbilitySlotId = (abilityId: string) => {
    for (const slotId of Object.keys(ABILITY_SLOT_MAP)) {
        const mapping = ABILITY_SLOT_MAP[slotId];
        if (mapping.ids.includes(abilityId)) return slotId;
    }
    return null;
};

// 技能槽到基础技能 ID 的映射（用于获取等级）
const SLOT_TO_ABILITY_ID: Record<string, string> = {
    fist: 'fist-technique',
    chi: 'zen-forget',
    sky: 'harmony',
    lotus: 'lotus-palm',
    combo: 'taiji-combo',
    lightning: 'thunder-strike',
    calm: 'calm-water',
    meditate: 'meditation',
};

/**
 * 从卡牌定义中动态查找升级卡的 atlasIndex
 * @param abilityId 目标技能 ID
 * @param level 升级后的等级
 * @returns 对应升级卡的 atlasIndex，未找到返回 undefined
 */
const getUpgradeCardAtlasIndex = (abilityId: string, level: number): number | undefined => {
    for (const card of MONK_CARDS) {
        if (card.type !== 'upgrade' || !card.effects) continue;
        for (const effect of card.effects) {
            const action = effect.action;
            if (
                action?.type === 'replaceAbility' &&
                action.targetAbilityId === abilityId &&
                action.newAbilityLevel === level
            ) {
                return card.atlasIndex;
            }
        }
    }
    return undefined;
};

export const AbilityOverlays = ({
    isEditing,
    availableAbilityIds,
    canSelect,
    canHighlight,
    onSelectAbility,
    onHighlightedAbilityClick,
    selectedAbilityId,
    activatingAbilityId,
    abilityLevels,
    cardAtlas,
    locale,
}: {
    isEditing: boolean;
    availableAbilityIds: string[];
    canSelect: boolean;
    canHighlight: boolean;
    onSelectAbility: (abilityId: string) => void;
    onHighlightedAbilityClick?: () => void;
    selectedAbilityId?: string;
    activatingAbilityId?: string;
    abilityLevels?: Record<string, number>;
    cardAtlas?: CardAtlasConfig;
    locale?: string;
}) => {
    const { t } = useTranslation('game-dicethrone');
    const [slots, setSlots] = React.useState(INITIAL_SLOTS);
    const [editingId, setEditingId] = React.useState<string | null>(null);
    const containerRef = React.useRef<HTMLDivElement>(null);
    const dragInfo = React.useRef<{ id: string, type: 'move' | 'resize', startX: number, startY: number, startVal: { x: number; y: number; w: number; h: number } } | null>(null);

    const resolveAbilityId = (slotId: string) => {
        const mapping = ABILITY_SLOT_MAP[slotId];
        if (!mapping) return null;
        return mapping.ids.find(id => availableAbilityIds.includes(id)) ?? null;
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
            setSlots(prev => prev.map(s => s.id === id ? {
                ...s,
                ...(type === 'move' ? { x: Number((startVal.x + deltaX).toFixed(1)), y: Number((startVal.y + deltaY).toFixed(1)) }
                    : { w: Number(Math.max(5, startVal.w + deltaX).toFixed(1)), h: Number(Math.max(5, startVal.h + deltaY).toFixed(1)) })
            } : s));
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
    }, [isEditing]);

    return (
        <div ref={containerRef} className="absolute inset-0 z-20 pointer-events-none">
            {slots.map((slot) => {
                const col = slot.index % 3;
                const row = Math.floor(slot.index / 3);
                const bgX = col * 50;
                const bgY = row * 50;
                const isResolved = resolveAbilityId(slot.id);
                const baseAbilityId = SLOT_TO_ABILITY_ID[slot.id];
                const level = baseAbilityId ? (abilityLevels?.[baseAbilityId] ?? 1) : 1;
                const upgradeAtlasIndex = baseAbilityId && level > 1 ? getUpgradeCardAtlasIndex(baseAbilityId, level) : undefined;
                const mapping = ABILITY_SLOT_MAP[slot.id];
                const slotLabel = mapping ? t(mapping.labelKey) : slot.id;
                const isAbilitySelected = !isEditing && selectedAbilityId === isResolved;
                const isAvailable = Boolean(isResolved);
                const canClick = !isEditing && canSelect && isAvailable;
                const isActivating = !isEditing && activatingAbilityId === isResolved;
                const shouldHighlight = !isEditing && canHighlight && isAvailable;
                const isUltimate = slot.id === 'ultimate';
                return (
                    <div
                        key={slot.id}
                        data-ability-slot={slot.id}
                        onMouseDown={(e) => handleMouseDown(e, slot.id, 'move')}
                        className={`
                            absolute transition-none rounded-lg
                            ${isEditing ? 'pointer-events-auto cursor-move border border-amber-500/30' : 'pointer-events-auto cursor-pointer group'}
                            ${isEditing && editingId === slot.id ? 'border-2 border-green-500 z-50 bg-green-500/10' : ''}
                            ${canClick ? 'hover:scale-[1.02] hover:z-30' : ''}
                            ${isActivating ? 'animate-ability-activate z-50' : ''}
                        `}
                        style={{ left: `${slot.x}%`, top: `${slot.y}%`, width: `${slot.w}%`, height: `${slot.h}%` }}
                        onClick={() => {
                            if (canClick && isResolved) {
                                onSelectAbility(isResolved);
                            } else if (!isEditing && shouldHighlight && !canSelect && onHighlightedAbilityClick) {
                                onHighlightedAbilityClick();
                            }
                        }}
                    >
                        {!isUltimate && (
                            <>
                                {/* 基础技能槽图片 */}
                                <div
                                    className="w-full h-full rounded-lg pointer-events-none"
                                    style={{
                                        backgroundImage: buildLocalizedImageSet(ASSETS.ABILITY_CARDS_BASE, locale),
                                        backgroundSize: '300% 300%',
                                        backgroundPosition: `${bgX}% ${bgY}%`,
                                        opacity: isEditing ? 0.7 : 1
                                    }}
                                />
                                {/* 升级卡叠加层（保持卡牌原始比例，居中覆盖） */}
                                {upgradeAtlasIndex !== undefined && cardAtlas && (
                                    <div
                                        className="absolute inset-0 flex items-center justify-center pointer-events-none"
                                    >
                                        <div
                                            className="h-full rounded-lg"
                                            style={{
                                                aspectRatio: `${cardAtlas.colWidths[upgradeAtlasIndex % cardAtlas.cols] ?? 330} / ${cardAtlas.rowHeights[Math.floor(upgradeAtlasIndex / cardAtlas.cols)] ?? 540}`,
                                                backgroundImage: buildLocalizedImageSet(ASSETS.CARDS_ATLAS, locale),
                                                ...getCardAtlasStyle(upgradeAtlasIndex, cardAtlas),
                                            }}
                                        />
                                    </div>
                                )}
                            </>
                        )}
                        {shouldHighlight && (
                            <div className={`absolute inset-0 rounded-lg border-[2.5px] pointer-events-none z-10 animate-pulse ${
                                isUltimate 
                                    ? 'border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.8),0_0_40px_rgba(251,191,36,0.4),inset_0_0_15px_rgba(251,191,36,0.3)]' 
                                    : 'border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.8),0_0_40px_rgba(34,211,238,0.4)]'
                            }`} />
                        )}
                        {isAbilitySelected && (
                            <div className={`absolute inset-0 rounded-lg border-[3px] pointer-events-none z-10 ${
                                isUltimate
                                    ? 'border-amber-500 shadow-[0_0_25px_rgba(245,158,11,0.9),0_0_50px_rgba(245,158,11,0.5)]'
                                    : 'border-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.9),0_0_50px_rgba(16,185,129,0.5)]'
                            }`}>
                                <div className="absolute -inset-[2px] rounded-lg border-2 border-white/60 animate-pulse" />
                            </div>
                        )}
                        {isEditing && (
                            <div className="absolute -top-3 left-0 bg-black/80 text-[8px] text-white px-1 rounded whitespace-nowrap pointer-events-none">
                                {slotLabel} {slot.x.toFixed(1)}% {slot.y.toFixed(1)}%
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};
