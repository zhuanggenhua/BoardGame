import { useTranslation } from 'react-i18next';
import { STATUS_EFFECT_META, getStatusEffectIconNode } from './statusEffects';
import type { StatusIconAtlasConfig } from './statusEffects';

export const ChoiceModal = ({
    choice,
    canResolve,
    onResolve,
    locale,
    statusIconAtlas,
}: {
    choice:
        | {
              title: string;
              options: Array<{ id: string; label: string; statusId: string }>;
          }
        | null
        | undefined;
    canResolve: boolean;
    onResolve: (optionId: string) => void;
    locale?: string;
    statusIconAtlas?: StatusIconAtlasConfig | null;
}) => {
    const { t } = useTranslation('game-dicethrone');

    if (!choice) return null;

    return (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-slate-900/95 border border-amber-500/40 backdrop-blur-xl p-[2vw] rounded-[1.6vw] shadow-2xl max-w-[32vw] flex flex-col items-center text-center gap-[1.5vw]">
                <div className="flex flex-col gap-[0.6vw]">
                    <h3 className="text-[1.2vw] font-black text-white">{t('choices.title')}</h3>
                    <p className="text-[0.9vw] text-slate-400 leading-relaxed px-[1vw]">{t(choice.title)}</p>
                </div>
                <div className="flex gap-[1vw] w-full pt-[0.5vw]">
                    {choice.options.map(option => {
                        const meta = STATUS_EFFECT_META[option.statusId] || { icon: '❓', color: 'from-slate-500 to-slate-600' };
                        return (
                            <button
                                key={option.id}
                                onClick={() => onResolve(option.id)}
                                disabled={!canResolve}
                                className={`flex-1 py-[0.8vw] rounded-[0.8vw] font-bold text-[0.85vw] shadow-lg transition-all border ${canResolve ? 'bg-slate-800 hover:bg-amber-600 text-white border-amber-500/40' : 'bg-slate-900 text-slate-600 border-slate-800 cursor-not-allowed'}`}
                            >
                                <div className="flex items-center justify-center gap-[0.5vw]">
                                    <span className="w-[2vw] h-[2vw] rounded-full overflow-hidden border border-white/30">
                                        {getStatusEffectIconNode(meta, locale, 'choice', statusIconAtlas)}
                                    </span>
                                    <span>{t(`statusEffects.${option.statusId}.name`, { defaultValue: option.statusId })}</span>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
