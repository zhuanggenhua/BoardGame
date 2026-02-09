import { useTranslation } from 'react-i18next';
import { GameModal } from './components/GameModal';
import { GameButton } from './components/GameButton';
import { STATUS_EFFECT_META, TOKEN_META, getStatusEffectIconNode } from './statusEffects';
import type { StatusAtlases } from './statusEffects';

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
    statusIconAtlas?: StatusAtlases | null;
}) => {
    const { t } = useTranslation('game-dicethrone');

    // isOpen determination
    const isOpen = !!choice;

    const resolveOptionLabel = (label: string) => {
        if (label.startsWith('choices.option-')) {
            const index = Number(label.replace('choices.option-', ''));
            if (!Number.isNaN(index)) {
                return t('choices.option', { index: index + 1 });
            }
        }
        return t(label);
    };

    return (
        <GameModal
            isOpen={isOpen}
            title={t('choices.title')}
            width="md"
            closeOnBackdrop={false}
        >
            <div className="flex flex-col gap-6 w-full items-center">
                {choice && (
                    <p className="text-lg text-slate-200 font-medium">
                        {t(choice.title)}
                    </p>
                )}

                <div className="flex flex-wrap gap-4 w-full justify-center">
                    {choice?.options.map(option => {
                        const meta = (option.tokenId ? TOKEN_META[option.tokenId] : undefined)
                            || (option.statusId ? STATUS_EFFECT_META[option.statusId] : undefined)
                            || { icon: '❓', color: 'from-slate-500 to-slate-600' };

                        return (
                            <GameButton
                                key={option.id}
                                onClick={() => onResolve(option.id)}
                                disabled={!canResolve}
                                variant={canResolve ? 'primary' : 'secondary'}
                                className="min-w-[120px]"
                                icon={
                                    <span className="w-6 h-6 inline-block align-middle mr-1 rounded-full overflow-hidden border border-white/30 bg-black/30">
                                        {getStatusEffectIconNode(meta, locale, 'choice', statusIconAtlas)}
                                    </span>
                                }
                            >
                                {resolveOptionLabel(option.label)}
                            </GameButton>
                        );
                    })}
                </div>
            </div>
        </GameModal>
    );
};
