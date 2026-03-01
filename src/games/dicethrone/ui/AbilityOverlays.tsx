import React from 'react';
import { useTranslation } from 'react-i18next';
import { CardPreview } from '../../../components/common/media/CardPreview';
import { saveDiceThroneAbilityLayout } from '../../../api/layout';
import { UI_Z_INDEX } from '../../../core';
import { playSound } from '../../../lib/audio/useGameAudio';
import { DEFAULT_ABILITY_SLOT_LAYOUT } from './abilitySlotLayout';
import type { CardPreviewRef } from '../../../core';
import type { AbilityCard } from '../types';
// 导入所有英雄的卡牌定义
import { MONK_CARDS } from '../heroes/monk/cards';
import { BARBARIAN_CARDS } from '../heroes/barbarian/cards';
import { PYROMANCER_CARDS } from '../heroes/pyromancer/cards';
import { PALADIN_CARDS } from '../heroes/paladin/cards';
import { MOON_ELF_CARDS } from '../heroes/moon_elf/cards';
import { SHADOW_THIEF_CARDS } from '../heroes/shadow_thief/cards';

// 角色 ID 到卡牌定义的映射
const HERO_CARDS_MAP: Record<string, AbilityCard[]> = {
    monk: MONK_CARDS,
    barbarian: BARBARIAN_CARDS,
    pyromancer: PYROMANCER_CARDS,
    paladin: PALADIN_CARDS,
    moon_elf: MOON_ELF_CARDS,
    shadow_thief: SHADOW_THIEF_CARDS,
};

// 被动能力配置（按角色）
const PASSIVE_ABILITIES: Record<string, { slotId: string; cardId: string }[]> = {
    paladin: [
        {
            slotId: 'fist',  // 使用 fist 槽位（左上角）
            cardId: 'card-tithes-2',  // 对应的升级卡
        }
    ],
};

/** 从升级卡定义中提取目标技能 ID */
const getUpgradeTargetFromCard = (card?: AbilityCard): string | null => {
    if (!card || card.type !== 'upgrade' || !card.effects) return null;
    const action = card.effects.find(e => e.action?.type === 'replaceAbility')?.action;
    return action?.type === 'replaceAbility' ? (action.targetAbilityId ?? null) : null;
};


export const ABILITY_SLOT_MAP: Record<string, { labelKey: string; ids: string[] }> = {
    // 基础技能 ID（跨英雄）— 每个槽位包含所有英雄对应的技能 ID
    fist: { labelKey: 'abilitySlots.fist', ids: ['fist-technique', 'fireball', 'slap', 'longbow', 'dagger-strike'] },
    chi: { labelKey: 'abilitySlots.chi', ids: ['zen-forget', 'soul-burn', 'all-out-strike', 'vengeance', 'covert-fire', 'pickpocket'] },
    sky: { labelKey: 'abilitySlots.sky', ids: ['harmony', 'fiery-combo', 'powerful-strike', 'holy-strike', 'entangling-shot', 'shadow-dance'] },
    lotus: { labelKey: 'abilitySlots.lotus', ids: ['lotus-palm', 'meteor', 'violent-assault', 'righteous-prayer', 'eclipse', 'shadow-defense'] },
    combo: { labelKey: 'abilitySlots.combo', ids: ['taiji-combo', 'pyro-blast', 'steadfast', 'righteous-combat', 'covering-fire', 'steal'] },
    lightning: { labelKey: 'abilitySlots.lightning', ids: ['thunder-strike', 'burn-down', 'suppress', 'blessing-of-might', 'exploding-arrow', 'kidney-shot'] },
    calm: { labelKey: 'abilitySlots.calm', ids: ['calm-water', 'ignite', 'reckless-strike', 'holy-light', 'blinding-shot', 'cornucopia'] },
    meditate: { labelKey: 'abilitySlots.meditate', ids: ['meditation', 'magma-armor', 'thick-skin', 'holy-defense', 'elusive-step', 'fearless-riposte'] },
    ultimate: { labelKey: 'abilitySlots.ultimate', ids: ['transcendence', 'ultimate-inferno', 'unyielding-faith', 'lunar-eclipse', 'shadow-shank'] },
};

export const getAbilitySlotId = (abilityId: string) => {
    for (const slotId of Object.keys(ABILITY_SLOT_MAP)) {
        const mapping = ABILITY_SLOT_MAP[slotId];
        if (mapping.ids.some(baseId => abilityId === baseId || abilityId.startsWith(`${baseId}-`))) {
            return slotId;
        }
    }
    return null;
};

// 技能槽到基础技能 ID 的映射（按角色分类）
const HERO_SLOT_TO_ABILITY: Record<string, Record<string, string>> = {
    monk: {
        fist: 'fist-technique',
        chi: 'zen-forget',
        sky: 'harmony',
        lotus: 'lotus-palm',
        combo: 'taiji-combo',
        lightning: 'thunder-strike',
        calm: 'calm-water',
        meditate: 'meditation',
        ultimate: 'transcendence',   // 超越
    },
    pyromancer: {
        fist: 'fireball',
        chi: 'soul-burn',
        sky: 'fiery-combo',
        lotus: 'meteor',
        combo: 'pyro-blast',
        lightning: 'burn-down',
        calm: 'ignite',
        meditate: 'magma-armor',
        ultimate: 'ultimate-inferno', // 终极炼狱
    },
    barbarian: {
        fist: 'slap',
        chi: 'all-out-strike',
        sky: 'powerful-strike',
        lotus: 'violent-assault',
        combo: 'steadfast',
        lightning: 'suppress',
        calm: 'reckless-strike',
        meditate: 'thick-skin',
        // 野蛮人无终极技能（abilities 中未定义 ultimate）
    },
    paladin: {
        // 顶部左侧为被动“教皇税”，不映射为可选技能
        chi: 'vengeance',             // 复仇 (3 Helm + 1 Pray)
        sky: 'holy-strike',           // 神圣冲击 小顺子 (Small Straight)
        lotus: 'righteous-prayer',    // 正义祈祷 (4 Pray)
        combo: 'righteous-combat',    // 正义冲击 (3 Sword + 1 Helm)
        lightning: 'blessing-of-might', // 力量祝福 (3 Sword + 1 Pray)
        calm: 'holy-light',           // 圣光 (2 Heart)
        meditate: 'holy-defense',     // 神圣防御
        ultimate: 'unyielding-faith', // 坚毅信念
    },
    moon_elf: {
        fist: 'longbow',              // 长弓 (3/4/5 Arrow)
        chi: 'covert-fire',           // 隐蔽射击 (2 Moon)
        sky: 'entangling-shot',       // 缠绕射击 (Small Straight)
        lotus: 'eclipse',             // 月蚀 (4 Moon)
        combo: 'covering-fire',       // 掩护射击 (2 Bow + 2 Foot)
        lightning: 'exploding-arrow', // 爆裂箭 (1 Bow + 3 Moon)
        calm: 'blinding-shot',        // 致盲射击 (Large Straight)
        meditate: 'elusive-step',     // 迷影步 (防御)
        ultimate: 'lunar-eclipse',    // 月蚀终极
    },
    shadow_thief: {
        fist: 'dagger-strike',        // 匕首打击 (3/4/5 Dagger)
        chi: 'pickpocket',            // 抢夺 (2 Shadow)
        sky: 'shadow-dance',          // 暗影之舞 (3 Shadow)
        lotus: 'shadow-defense',      // 暗影守护 (防御)
        combo: 'steal',               // 偷窃 (2/3/4 Bag)
        lightning: 'kidney-shot',     // 肾击 (Large Straight)
        calm: 'cornucopia',           // 聚宝盆 (2 Card)
        meditate: 'fearless-riposte', // 恐惧反击 (防御)
        ultimate: 'shadow-shank',     // 暗影刺杀 (终极)
    },
};

    // 获取槽位对应的基础技能 ID
    export const getSlotAbilityId = (characterId: string, slotId: string): string | undefined => {
        return HERO_SLOT_TO_ABILITY[characterId]?.[slotId];
    };

    /**
     * 从卡牌定义中动态查找升级卡的预览引用
     * @param characterId 角色 ID
     * @param abilityId 目标技能 ID
     * @param level 升级后的等级
     * @returns 对应升级卡的预览引用，未找到返回 undefined
     */
    export const getUpgradeCardPreviewRef = (characterId: string, abilityId: string, level: number): CardPreviewRef | undefined => {
        // 根据角色 ID 获取对应的卡牌定义
        const heroCards = HERO_CARDS_MAP[characterId];
        if (!heroCards) return undefined;

        for (const card of heroCards) {
            if (card.type !== 'upgrade' || !card.effects) continue;
            for (const effect of card.effects) {
                const action = effect.action;
                if (
                    action?.type === 'replaceAbility' &&
                    action.targetAbilityId === abilityId &&
                    action.newAbilityLevel === level
                ) {
                    return card.previewRef;
                }
            }
        }
        return undefined;
    };

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
        locale?: string;
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
        locale,
        playerTokens: _playerTokens,
    }, ref) => {
        const { t } = useTranslation('game-dicethrone');

        // 游戏级布局配置：所有用户共享一致的默认布局
        const [slots, setSlots] = React.useState(() => {
            const initial = DEFAULT_ABILITY_SLOT_LAYOUT.map(slot => ({ ...slot }));
            return initial;
        });
        const [editingId, setEditingId] = React.useState<string | null>(null);
        const containerRef = React.useRef<HTMLDivElement>(null);
        const dragInfo = React.useRef<{ id: string, type: 'move' | 'resize', startX: number, startY: number, startVal: { x: number; y: number; w: number; h: number } } | null>(null);

        // 通过 ref 暴露保存方法，供调试面板调用
        React.useImperativeHandle(ref, () => ({
            saveLayout: async () => {
                try {
                    const result = await saveDiceThroneAbilityLayout(slots);
                    const hint = result.relativePath ? `已写入 ${result.relativePath}` : '已写入布局文件';
                    return { hint };
                } catch (error) {
                    const message = error instanceof Error ? error.message : '保存失败';
                    return { hint: message };
                }
            },
        }), [slots]);

        const resolveAbilityId = (slotId: string) => {
            const mapping = ABILITY_SLOT_MAP[slotId];
            if (!mapping) return null;
            return availableAbilityIds.find(id =>
                mapping.ids.some(baseId => id === baseId || id.startsWith(`${baseId}-`))
            ) ?? null;
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
                    ...(type === 'move'
                        ? { x: Number((startVal.x + deltaX).toFixed(2)), y: Number((startVal.y + deltaY).toFixed(2)) }
                        : { w: Number(Math.max(5, startVal.w + deltaX).toFixed(2)), h: Number(Math.max(5, startVal.h + deltaY).toFixed(2)) })
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
                        const mapping = ABILITY_SLOT_MAP[slot.id];
                        const slotLabel = mapping ? t(mapping.labelKey) : slot.id;
                        
                        return (
                            <div
                                key={slot.id}
                                data-ability-slot={slot.id}
                                data-passive-ability="true"
                                onMouseDown={(e) => isEditing ? handleMouseDown(e, slot.id, 'move') : undefined}
                                className={`
                                    absolute transition-all duration-200 rounded-lg
                                    ${isEditing ? 'pointer-events-auto cursor-move border border-amber-500/30' : 'pointer-events-none'}
                                    ${isEditing && editingId === slot.id ? 'border-2 border-green-500 z-50 bg-green-500/10' : ''}
                                `}
                                style={{ left: `${slot.x}%`, top: `${slot.y}%`, width: `${slot.w}%`, height: `${slot.h}%` }}
                            >
                                {/* 只有升级后才叠加升级卡图片，未升级时玩家面板底图已有基础被动图案 */}
                                {isUpgraded && passiveCard?.previewRef && (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <CardPreview
                                            previewRef={passiveCard.previewRef}
                                            locale={locale}
                                            className="h-full aspect-[0.61] rounded-lg"
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
                                            {slotLabel} (被动) {slot.x.toFixed(2)}% {slot.y.toFixed(2)}% ({slot.w.toFixed(2)}×{slot.h.toFixed(2)})
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
                    const baseAbilityId = getSlotAbilityId(characterId, slot.id);
                    const level = baseAbilityId ? (abilityLevels?.[baseAbilityId] ?? 1) : 1;
                    const upgradePreviewRef = baseAbilityId && level > 1
                        ? getUpgradeCardPreviewRef(characterId, baseAbilityId, level)
                        : undefined;
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
                            absolute transition-all duration-200 rounded-lg
                            ${isEditing ? 'pointer-events-auto cursor-move border border-amber-500/30' : 'pointer-events-auto cursor-pointer group'}
                            ${isEditing && editingId === slot.id ? 'border-2 border-green-500 z-50 bg-green-500/10' : ''}
                            ${canClick ? 'hover:border-2 hover:border-amber-400 hover:shadow-[0_0_15px_rgba(251,191,36,0.5)] hover:z-30' : ''}
                            ${isActivating ? 'animate-ability-activate z-50' : ''}
                        `}
                            style={{ left: `${slot.x}%`, top: `${slot.y}%`, width: `${slot.w}%`, height: `${slot.h}%` }}
                            onClick={() => {
                                if (canClick && isResolved) {
                                    // DiceThrone：选择技能统一使用 dialog_choice 点击音效
                                    playSound('ui.general.khron_studio_rpg_interface_essentials_inventory_dialog_ucs_system_192khz.dialog.dialog_choice.uiclick_dialog_choice_01_krst_none');
                                    onSelectAbility(isResolved);
                                } else if (!isEditing && shouldHighlight && !canSelect && onHighlightedAbilityClick) {
                                    onHighlightedAbilityClick();
                                }
                            }}
                        >
                            {/* 方案 A：不渲染基础精灵图，玩家面板本身已包含基础技能图案 */}
                            {/* 升级卡叠加层（保持卡牌原始比例，居中覆盖） */}
                            {!isUltimate && upgradePreviewRef && (
                                <div
                                    className="absolute inset-0 flex items-center justify-center pointer-events-none"
                                >
                                    <CardPreview
                                        previewRef={upgradePreviewRef}
                                        locale={locale}
                                        className="h-full aspect-[0.61] rounded-lg"
                                    />
                                </div>
                            )}
                            {shouldHighlight && (
                                <div className="absolute inset-0 rounded-lg border-[2.5px] border-rose-400 shadow-[0_0_20px_rgba(251,113,133,0.8),0_0_40px_rgba(251,113,133,0.4)] pointer-events-none z-10 animate-pulse" />
                            )}
                            {isAbilitySelected && (
                                <div className="absolute inset-0 rounded-lg border-[3px] border-red-500 shadow-[0_0_25px_rgba(239,68,68,0.9),0_0_50px_rgba(239,68,68,0.5)] pointer-events-none z-10">
                                    <div className="absolute -inset-[2px] rounded-lg border-2 border-white/60 animate-pulse" />
                                </div>
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
