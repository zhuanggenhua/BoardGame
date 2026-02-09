
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { PROMPT_COMMANDS } from '../../../engine/systems/PromptSystem';
import type { PromptState, PlayerId } from '../../../engine/types';

interface Props {
    prompt: PromptState['current'] | undefined;
    moves: Record<string, any>;
    playerID: PlayerId | null;
}

export const PromptOverlay: React.FC<Props> = ({ prompt, moves, playerID }) => {
    const { t } = useTranslation('game-smashup');
    if (!prompt) return null;

    const isMyPrompt = prompt.playerId === playerID;

    const handleOptionSelect = (optionId: string) => {
        if (!isMyPrompt) return;
        moves[PROMPT_COMMANDS.RESPOND]?.({ optionId });
    };

    return (
        <AnimatePresence>
            <motion.div
                key="prompt-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 pointer-events-auto"
            >
                {/* Modal Container */}
                <motion.div
                    initial={{ scale: 0.9, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border-4 border-slate-800"
                >
                    {/* Header */}
                    <div className="bg-slate-800 p-6 text-center">
                        <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-2">
                            {prompt.title}
                        </h2>
                        {!isMyPrompt && (
                            <div className="mt-4 bg-yellow-500/20 text-yellow-300 px-3 py-1 rounded text-xs font-bold uppercase border border-yellow-500/50 inline-block animate-pulse">
                                {t('ui.waiting_for_player', { id: prompt.playerId })}
                            </div>
                        )}
                    </div>

                    {/* Options List */}
                    <div className="p-6 bg-slate-50 max-h-[60vh] overflow-y-auto custom-scrollbar flex flex-col gap-3">
                        {prompt.options.map((option, idx) => (
                            <button
                                key={`${idx}-${option.label}`}
                                onClick={() => handleOptionSelect(option.id)}
                                disabled={!isMyPrompt || option.disabled}
                                className={`
                                    w-full text-left px-6 py-4 rounded-lg font-bold text-lg transition-all duration-200 border-2
                                    ${!isMyPrompt || option.disabled
                                        ? 'bg-slate-200 text-slate-400 border-transparent cursor-not-allowed'
                                        : 'bg-white text-slate-800 border-slate-200 hover:border-blue-500 hover:bg-blue-50 hover:shadow-md hover:translate-x-1 active:bg-blue-100 active:scale-[0.99]'
                                    }
                                `}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>

                    {/* Footer (Cancel/Details could go here if design allowed cancelling) */}
                    <div className="bg-slate-100 p-3 text-center text-xs text-slate-400 font-mono border-t border-slate-200 uppercase tracking-widest">
                        {isMyPrompt ? t('ui.prompt_select_option') : t('ui.prompt_wait')}
                    </div>

                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};
