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

type AbilityHighlightTone = {
    highlightBorderColor: string;
    highlightRimColor: string;
    highlightGlowColor: string;
    highlightHaloColor: string;
    selectedBorderColor: string;
    selectedRimColor: string;
    selectedGlowColor: string;
    selectedHaloColor: string;
    selectedPulseBorderColor: string;
};

const DEFAULT_ABILITY_HIGHLIGHT_TONE: AbilityHighlightTone = {
    highlightBorderColor: '#ff3347',
    highlightRimColor: 'rgba(255,255,255,0.34)',
    highlightGlowColor: 'rgba(255,51,71,0.94)',
    highlightHaloColor: 'rgba(255,51,71,0.56)',
    selectedBorderColor: '#e11d48',
    selectedRimColor: 'rgba(255,255,255,0.42)',
    selectedGlowColor: 'rgba(225,29,72,0.98)',
    selectedHaloColor: 'rgba(225,29,72,0.64)',
    selectedPulseBorderColor: 'rgba(255,244,246,0.78)',
};

const ABILITY_HIGHLIGHT_TONES: Partial<Record<string, Partial<AbilityHighlightTone>>> = {
    monk: {
        highlightBorderColor: '#f59e0b',
        highlightRimColor: 'rgba(255,251,235,0.4)',
        highlightGlowColor: 'rgba(245,158,11,0.92)',
        highlightHaloColor: 'rgba(251,191,36,0.5)',
        selectedBorderColor: '#fbbf24',
        selectedRimColor: 'rgba(255,251,235,0.5)',
        selectedGlowColor: 'rgba(251,191,36,0.96)',
        selectedHaloColor: 'rgba(245,158,11,0.58)',
        selectedPulseBorderColor: 'rgba(255,247,237,0.82)',
    },
    barbarian: {
        highlightBorderColor: '#ef4444',
        highlightGlowColor: 'rgba(239,68,68,0.94)',
        highlightHaloColor: 'rgba(251,113,133,0.5)',
        selectedBorderColor: '#fb7185',
        selectedGlowColor: 'rgba(251,113,133,0.98)',
        selectedHaloColor: 'rgba(239,68,68,0.6)',
    },
    pyromancer: {
        highlightBorderColor: '#f97316',
        highlightGlowColor: 'rgba(249,115,22,0.94)',
        highlightHaloColor: 'rgba(251,146,60,0.52)',
        selectedBorderColor: '#fb923c',
        selectedGlowColor: 'rgba(251,146,60,0.98)',
        selectedHaloColor: 'rgba(249,115,22,0.62)',
    },
    moon_elf: {
        highlightBorderColor: '#38bdf8',
        highlightGlowColor: 'rgba(56,189,248,0.92)',
        highlightHaloColor: 'rgba(125,211,252,0.5)',
        selectedBorderColor: '#7dd3fc',
        selectedGlowColor: 'rgba(125,211,252,0.98)',
        selectedHaloColor: 'rgba(56,189,248,0.6)',
        selectedPulseBorderColor: 'rgba(224,242,254,0.84)',
    },
    shadow_thief: {
        highlightBorderColor: '#8b5cf6',
        highlightGlowColor: 'rgba(139,92,246,0.92)',
        highlightHaloColor: 'rgba(167,139,250,0.52)',
        selectedBorderColor: '#a78bfa',
        selectedGlowColor: 'rgba(167,139,250,0.98)',
        selectedHaloColor: 'rgba(139,92,246,0.6)',
        selectedPulseBorderColor: 'rgba(245,243,255,0.82)',
    },
    paladin: {
        highlightBorderColor: '#facc15',
        highlightGlowColor: 'rgba(250,204,21,0.92)',
        highlightHaloColor: 'rgba(253,224,71,0.5)',
        selectedBorderColor: '#fde047',
        selectedGlowColor: 'rgba(253,224,71,0.98)',
        selectedHaloColor: 'rgba(250,204,21,0.58)',
        selectedPulseBorderColor: 'rgba(254,252,232,0.84)',
    },
    gunslinger: {
        highlightBorderColor: '#22d3ee',
        highlightGlowColor: 'rgba(34,211,238,0.92)',
        highlightHaloColor: 'rgba(103,232,249,0.48)',
        selectedBorderColor: '#67e8f9',
        selectedGlowColor: 'rgba(103,232,249,0.98)',
        selectedHaloColor: 'rgba(34,211,238,0.58)',
        selectedPulseBorderColor: 'rgba(236,254,255,0.82)',
    },
    samurai: {
        highlightBorderColor: '#22c55e',
        highlightGlowColor: 'rgba(34,197,94,0.92)',
        highlightHaloColor: 'rgba(134,239,172,0.48)',
        selectedBorderColor: '#86efac',
        selectedGlowColor: 'rgba(134,239,172,0.98)',
        selectedHaloColor: 'rgba(34,197,94,0.58)',
        selectedPulseBorderColor: 'rgba(240,253,244,0.82)',
    },
    treant: {
        highlightBorderColor: '#34d399',
        highlightGlowColor: 'rgba(52,211,153,0.92)',
        highlightHaloColor: 'rgba(110,231,183,0.48)',
        selectedBorderColor: '#6ee7b7',
        selectedGlowColor: 'rgba(110,231,183,0.98)',
        selectedHaloColor: 'rgba(52,211,153,0.58)',
        selectedPulseBorderColor: 'rgba(236,253,245,0.82)',
    },
    ninja: {
        highlightBorderColor: '#a3e635',
        highlightGlowColor: 'rgba(163,230,53,0.92)',
        highlightHaloColor: 'rgba(190,242,100,0.48)',
        selectedBorderColor: '#bef264',
        selectedGlowColor: 'rgba(190,242,100,0.98)',
        selectedHaloColor: 'rgba(132,204,22,0.58)',
        selectedPulseBorderColor: 'rgba(247,254,231,0.82)',
    },
    zhanshujia: {
        highlightBorderColor: '#f59e0b',
        highlightGlowColor: 'rgba(245,158,11,0.92)',
        highlightHaloColor: 'rgba(252,211,77,0.5)',
        selectedBorderColor: '#fcd34d',
        selectedGlowColor: 'rgba(252,211,77,0.98)',
        selectedHaloColor: 'rgba(245,158,11,0.58)',
        selectedPulseBorderColor: 'rgba(255,251,235,0.82)',
    },
    cursed_pirate: {
        highlightBorderColor: '#22d3ee',
        highlightRimColor: 'rgba(236,254,255,0.42)',
        highlightGlowColor: 'rgba(34,211,238,0.94)',
        highlightHaloColor: 'rgba(45,212,191,0.54)',
        selectedBorderColor: '#67e8f9',
        selectedRimColor: 'rgba(236,254,255,0.54)',
        selectedGlowColor: 'rgba(103,232,249,0.98)',
        selectedHaloColor: 'rgba(14,165,233,0.62)',
        selectedPulseBorderColor: 'rgba(236,254,255,0.86)',
    },
    artificer: {
        highlightBorderColor: '#60a5fa',
        highlightGlowColor: 'rgba(96,165,250,0.92)',
        highlightHaloColor: 'rgba(147,197,253,0.5)',
        selectedBorderColor: '#93c5fd',
        selectedGlowColor: 'rgba(147,197,253,0.98)',
        selectedHaloColor: 'rgba(96,165,250,0.58)',
        selectedPulseBorderColor: 'rgba(239,246,255,0.84)',
    },
};

type RgbColor = { r: number; g: number; b: number };

const parseHexColor = (color: string): RgbColor | null => {
    const normalized = color.trim().replace(/^#/, '');
    if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null;
    return {
        r: Number.parseInt(normalized.slice(0, 2), 16),
        g: Number.parseInt(normalized.slice(2, 4), 16),
        b: Number.parseInt(normalized.slice(4, 6), 16),
    };
};

const toHexChannel = (value: number): string => (
    Math.round(Math.max(0, Math.min(255, value))).toString(16).padStart(2, '0')
);

const rgbToHsl = ({ r, g, b }: RgbColor): { h: number; s: number; l: number } => {
    const rn = r / 255;
    const gn = g / 255;
    const bn = b / 255;
    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    const delta = max - min;
    const l = (max + min) / 2;
    const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
    let h = 0;

    if (delta !== 0) {
        if (max === rn) h = 60 * (((gn - bn) / delta) % 6);
        else if (max === gn) h = 60 * ((bn - rn) / delta + 2);
        else h = 60 * ((rn - gn) / delta + 4);
    }

    return { h: (h + 360) % 360, s, l };
};

const hslToRgb = ({ h, s, l }: { h: number; s: number; l: number }): RgbColor => {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let rn = 0;
    let gn = 0;
    let bn = 0;

    if (h < 60) [rn, gn, bn] = [c, x, 0];
    else if (h < 120) [rn, gn, bn] = [x, c, 0];
    else if (h < 180) [rn, gn, bn] = [0, c, x];
    else if (h < 240) [rn, gn, bn] = [0, x, c];
    else if (h < 300) [rn, gn, bn] = [x, 0, c];
    else [rn, gn, bn] = [c, 0, x];

    return {
        r: (rn + m) * 255,
        g: (gn + m) * 255,
        b: (bn + m) * 255,
    };
};

const toRgbString = ({ r, g, b }: RgbColor, alpha: number): string => (
    `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${alpha})`
);

const toHexString = ({ r, g, b }: RgbColor): string => (
    `#${toHexChannel(r)}${toHexChannel(g)}${toHexChannel(b)}`
);

const buildComplementaryHighlightTone = (baseColor: string): Pick<
    AbilityHighlightTone,
    'highlightBorderColor' | 'highlightRimColor' | 'highlightGlowColor' | 'highlightHaloColor'
> => {
    const parsed = parseHexColor(baseColor);
    if (!parsed) {
        return {
            highlightBorderColor: baseColor,
            highlightRimColor: 'rgba(255,255,255,0.58)',
            highlightGlowColor: 'rgba(255,255,255,0.88)',
            highlightHaloColor: 'rgba(255,255,255,0.54)',
        };
    }

    const baseHsl = rgbToHsl(parsed);
    const contrastRgb = hslToRgb({
        h: (baseHsl.h + 180) % 360,
        s: Math.max(baseHsl.s, 0.72),
        l: Math.min(Math.max(baseHsl.l, 0.46), 0.58),
    });

    return {
        highlightBorderColor: toHexString(contrastRgb),
        highlightRimColor: 'rgba(255,255,255,0.58)',
        highlightGlowColor: toRgbString(contrastRgb, 0.9),
        highlightHaloColor: toRgbString(contrastRgb, 0.56),
    };
};

const getAbilityHighlightTone = (characterId?: string): AbilityHighlightTone => {
    const roleTone = {
        ...DEFAULT_ABILITY_HIGHLIGHT_TONE,
        ...(characterId ? ABILITY_HIGHLIGHT_TONES[characterId] : undefined),
    };

    return {
        ...roleTone,
        // 可选技能用角色主题色的互补色；选中态继续保留角色主题色。
        ...buildComplementaryHighlightTone(roleTone.highlightBorderColor),
    };
};

const buildAbilityHighlightStyle = (
    tone: AbilityHighlightTone,
    variant: 'highlight' | 'selected',
): React.CSSProperties => {
    if (variant === 'selected') {
        return {
            padding: '3px',
            background: `linear-gradient(135deg, ${tone.selectedPulseBorderColor}, ${tone.selectedBorderColor} 45%, ${tone.selectedRimColor})`,
            WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude',
            boxShadow: `0 0 20px ${tone.selectedGlowColor}, 0 0 34px ${tone.selectedHaloColor}`,
        };
    }
    return {
        borderStyle: 'solid',
        borderWidth: '2px',
        borderColor: tone.highlightBorderColor,
        boxShadow: `0 0 0 1px ${tone.highlightRimColor}, 0 0 16px ${tone.highlightGlowColor}, 0 0 26px ${tone.highlightHaloColor}`,
    };
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
        playerBoardFace?: HeroState['playerBoardFace'];
        locale?: string;
        onMagnifyCard?: (card: AbilityCard) => void;
        slotScope?: 'main-board' | 'magnified-preview';
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
        slotScope = 'main-board',
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
        const highlightOverlayClassName = 'absolute inset-0 rounded-lg pointer-events-none z-10 animate-pulse';
        const selectedOverlayClassName = 'absolute inset-0 rounded-lg pointer-events-none z-20';
        const inspectButtonClassName = 'absolute right-[0.2vw] top-[0.2vw] z-20 flex h-[1.15vw] w-[1.15vw] min-h-[14px] min-w-[14px] items-center justify-center rounded-full border border-white/18 bg-black/68 text-white/92 shadow-[0_0.18vw_0.42vw_rgba(0,0,0,0.45)] transition-[background-color,border-color,opacity] duration-200 hover:border-amber-300/45 hover:bg-amber-500/78';
        const abilityHighlightTone = React.useMemo(
            () => getAbilityHighlightTone(characterId),
            [characterId],
        );
        const highlightOverlayStyle = React.useMemo(
            () => buildAbilityHighlightStyle(abilityHighlightTone, 'highlight'),
            [abilityHighlightTone],
        );
        const selectedOverlayStyle = React.useMemo(
            () => buildAbilityHighlightStyle(abilityHighlightTone, 'selected'),
            [abilityHighlightTone],
        );
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
                        const passiveResolvedId = passiveBaseId && slotContainsAbilityIdForCharacter(characterId, slot.id, passiveBaseId, playerBoardFace)
                            ? passiveBaseId
                            : null;
                        const passiveUpgradeCard = isUpgraded ? passiveCard : undefined;
                        const passiveInspectKey = `passive-${characterId}-${slot.id}-${passiveUpgradeCard?.id ?? 'none'}`;
                        const mapping = ABILITY_SLOT_MAP[slot.id];
                        const slotLabel = mapping ? t(mapping.labelKey) : slot.id;
                        
                        return (
                            <div
                                key={slot.id}
                                data-ability-slot={slot.id}
                                data-ability-slot-scope={slotScope}
                                data-resolved-ability-id={passiveResolvedId ?? ''}
                                data-base-ability-id={passiveBaseId ?? ''}
                                data-can-click="false"
                                data-should-highlight="false"
                                data-is-selected="false"
                                data-is-activating="false"
                                data-passive-ability="true"
                                data-upgrade-preview-slot={passiveUpgradeCard ? slot.id : undefined}
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
                            data-ability-slot-scope={slotScope}
                            data-resolved-ability-id={isResolved ?? ''}
                            data-base-ability-id={baseAbilityId ?? ''}
                            data-upgrade-preview-slot={upgradeCard ? slot.id : undefined}
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
                            {shouldHighlight && !isAbilitySelected && (
                                <div
                                    data-testid={`dt-ability-highlight-${slot.id}`}
                                    className={highlightOverlayClassName}
                                    style={highlightOverlayStyle}
                                />
                            )}
                            {isAbilitySelected && (
                                <div
                                    data-testid={`dt-ability-selected-${slot.id}`}
                                    className={selectedOverlayClassName}
                                    style={selectedOverlayStyle}
                                />
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
