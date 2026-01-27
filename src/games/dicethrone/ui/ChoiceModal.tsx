import { useTranslation } from 'react-i18next';
import { ModalBase } from '../../../components/common/overlays/ModalBase';
import { STATUS_EFFECT_META, TOKEN_META, getStatusEffectIconNode } from './statusEffects';
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
              options: Array<{ id: string; label: string; statusId?: string; tokenId?: string; customId?: string }>;
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
        <ModalBase
            closeOnBackdrop={false}
            overlayClassName="z-[1100] bg-black/70"
            containerClassName="z-[1101]"
        >
            <div className="bg-slate-900/95 border border-amber-500/40 backdrop-blur-xl p-[2vw] rounded-[1.6vw] shadow-2xl max-w-[36vw] flex flex-col items-center text-center gap-[1.2vw] pointer-events-auto">
                <div className="flex flex-col gap-[0.5vw]">
                    <h3 className="text-[1.2vw] font-black text-white">{t('choices.title')}</h3>
                    <p className="text-[0.85vw] text-slate-400 leading-relaxed px-[1vw]">{t(choice.title)}</p>
                </div>
                <div className="flex gap-[1.5vw] w-full justify-center pt-[0.3vw]">
                    {choice.options.map(option => {
                        const meta = (option.tokenId ? TOKEN_META[option.tokenId] : undefined)
                            || (option.statusId ? STATUS_EFFECT_META[option.statusId] : undefined)
                            || { icon: '❓', color: 'from-slate-500 to-slate-600' };
                        return (
                            <button
                                key={option.id}
                                onClick={() => onResolve(option.id)}
                                disabled={!canResolve}
                                className={`flex flex-col items-center gap-[0.6vw] px-[1.5vw] py-[1vw] rounded-[0.8vw] font-bold text-[0.8vw] shadow-lg transition-all duration-200 border ${canResolve ? 'bg-slate-800 hover:bg-amber-600 hover:scale-105 text-white border-amber-500/40' : 'bg-slate-900 text-slate-600 border-slate-800 cursor-not-allowed'}`}
                            >
                                <span className="w-[2.5vw] h-[2.5vw] rounded-full overflow-hidden border border-white/30">
                                    {getStatusEffectIconNode(meta, locale, 'choice', statusIconAtlas)}
                                </span>
                                <span>{t(option.label, { defaultValue: option.label })}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </ModalBase>
    );
};
