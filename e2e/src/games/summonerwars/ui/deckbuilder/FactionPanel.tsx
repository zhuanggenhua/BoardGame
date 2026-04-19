
import React from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { FACTION_CATALOG } from '../../config/factions';
import type { FactionId } from '../../domain/types';

interface FactionPanelProps {
    selectedFactionId: FactionId | null;
    onSelect: (factionId: FactionId) => void;
}

export const FactionPanel: React.FC<FactionPanelProps> = ({ selectedFactionId, onSelect }) => {
    const { t } = useTranslation('game-summonerwars');
    const availableFactions = FACTION_CATALOG.filter(f => f.selectable !== false);

    return (
        <div className="w-36 h-full bg-black/40 border-r border-white/10 flex flex-col flex-shrink-0">
            <div className="px-3 py-3 border-b border-white/10">
                <h2 className="text-amber-400 font-bold uppercase tracking-wider text-xs">
                    {t('deckBuilder.factions')}
                </h2>
            </div>

            <div className="flex-1 overflow-y-auto p-1.5 scrollbar-hide">
                <div className="flex flex-col gap-1">
                    {availableFactions.map(faction => {
                        const isSelected = selectedFactionId === faction.id;

                        return (
                            <motion.button
                                key={faction.id}
                                onClick={() => onSelect(faction.id)}
                                whileHover={{ x: 2 }}
                                whileTap={{ scale: 0.98 }}
                                className={clsx(
                                    'relative w-full text-left px-3 py-2 rounded-md border transition-all duration-200 group',
                                    isSelected
                                        ? 'bg-amber-900/40 border-amber-500/50'
                                        : 'bg-transparent border-transparent hover:bg-white/5 hover:border-white/10'
                                )}
                            >
                                {isSelected && (
                                    <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-amber-400 rounded-r" />
                                )}

                                <div className="flex items-center gap-2">
                                    <span className={clsx(
                                        "w-7 h-7 rounded-full border text-xs font-bold flex items-center justify-center bg-black/40",
                                        isSelected ? "border-amber-400 text-amber-300" : "border-white/20 text-white/40"
                                    )}>
                                        {t(faction.nameKey).charAt(0)}
                                    </span>
                                    <span className={clsx(
                                        "text-sm font-medium truncate",
                                        isSelected ? "text-amber-100" : "text-white/60 group-hover:text-white/80"
                                    )}>
                                        {t(faction.nameKey)}
                                    </span>
                                </div>
                            </motion.button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
