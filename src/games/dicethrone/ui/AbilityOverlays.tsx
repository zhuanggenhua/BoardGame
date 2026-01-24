import React from 'react';
import { useTranslation } from 'react-i18next';
import { buildLocalizedImageSet } from '../../../core';
import { ASSETS } from './assets';

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
    fist: { labelKey: 'abilitySlots.fist', ids: ['fist-technique-5', 'fist-technique-4', 'fist-technique-3'] },
    chi: { labelKey: 'abilitySlots.chi', ids: ['zen-forget'] },
    sky: { labelKey: 'abilitySlots.sky', ids: ['harmony'] },
    lotus: { labelKey: 'abilitySlots.lotus', ids: ['lotus-palm'] },
    combo: { labelKey: 'abilitySlots.combo', ids: ['taiji-combo'] },
    lightning: { labelKey: 'abilitySlots.lightning', ids: ['thunder-strike'] },
    calm: { labelKey: 'abilitySlots.calm', ids: ['calm-water'] },
    meditate: { labelKey: 'abilitySlots.meditate', ids: ['meditation'] },
};

export const getAbilitySlotId = (abilityId: string) => {
    for (const slotId of Object.keys(ABILITY_SLOT_MAP)) {
        const mapping = ABILITY_SLOT_MAP[slotId];
        if (mapping.ids.includes(abilityId)) return slotId;
    }
    return null;
};

export const AbilityOverlays = ({
    isEditing,
    availableAbilityIds,
    canSelect,
    canHighlight,
    onSelectAbility,
    selectedAbilityId,
    activatingAbilityId,
    locale,
}: {
    isEditing: boolean;
    availableAbilityIds: string[];
    canSelect: boolean;
    canHighlight: boolean;
    onSelectAbility: (abilityId: string) => void;
    selectedAbilityId?: string;
    activatingAbilityId?: string;
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
                const mapping = ABILITY_SLOT_MAP[slot.id];
                const slotLabel = mapping ? t(mapping.labelKey) : slot.id;
                const isAbilitySelected = !isEditing && selectedAbilityId === isResolved;
                const isAvailable = Boolean(isResolved);
                const canClick = !isEditing && canSelect && isAvailable;
                const isActivating = !isEditing && activatingAbilityId === isResolved;
                const shouldHighlight = !isEditing && canHighlight && isAvailable;
                const shouldDim = !isEditing && canHighlight && !isAvailable;
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
                            ${shouldDim ? 'opacity-35 grayscale' : ''}
                            ${isActivating ? 'animate-ability-activate z-50' : ''}
                        `}
                        style={{ left: `${slot.x}%`, top: `${slot.y}%`, width: `${slot.w}%`, height: `${slot.h}%` }}
                        onClick={() => canClick && isResolved && onSelectAbility(isResolved)}
                    >
                        {!isUltimate && (
                            <div
                                className="w-full h-full rounded-lg pointer-events-none"
                                style={{
                                    backgroundImage: buildLocalizedImageSet(ASSETS.ABILITY_CARDS_BASE, locale),
                                    backgroundSize: '300% 300%',
                                    backgroundPosition: `${bgX}% ${bgY}%`,
                                    opacity: isEditing ? 0.7 : 1
                                }}
                            />
                        )}
                        {shouldHighlight && (
                            <div className="absolute inset-0 rounded-lg border-[2px] border-amber-400/80 shadow-[0_0_24px_rgba(251,191,36,0.65)] pointer-events-none z-10" />
                        )}
                        {isAbilitySelected && (
                            <div className="absolute inset-0 rounded-lg border-[4px] border-emerald-400 shadow-[0_0_30px_rgba(52,211,153,0.8)] pointer-events-none z-10">
                                <div className="absolute -inset-[2px] rounded-lg border-2 border-white/50 animate-pulse" />
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
