import { useTranslation } from 'react-i18next';
import { type EmoteDefinition } from '../../../../shared/emotes';
import { OptimizedImage } from '../../../common/media/OptimizedImage';

interface EmotePickerProps {
    emotes: readonly EmoteDefinition[];
    onSelect: (emoteId: string) => void;
    disabled?: boolean;
}

export const EmotePicker = ({ emotes, onSelect, disabled = false }: EmotePickerProps) => {
    const { t } = useTranslation('game');

    if (emotes.length === 0) {
        return (
            <div className="px-3 py-4 text-center text-xs text-white/45">
                {t('hud.emotes.empty')}
            </div>
        );
    }

    return (
        <div className="grid grid-cols-3 gap-2 p-1" data-testid="hud-emote-picker">
            {emotes.slice(0, 6).map((emote) => (
                <button
                    key={emote.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => onSelect(emote.id)}
                    title={emote.label}
                    aria-label={emote.label}
                    className="group flex h-16 w-16 items-center justify-center rounded-md border border-white/12 bg-white/8 p-1.5 transition-all hover:-translate-y-0.5 hover:border-cyan-200/50 hover:bg-cyan-300/14 disabled:cursor-not-allowed disabled:opacity-50"
                    data-testid={`hud-emote-option-${emote.id}`}
                >
                    <OptimizedImage
                        src={emote.assetPath}
                        alt={emote.label}
                        placeholder={false}
                        className="h-full w-full object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.45)] transition-transform group-hover:scale-110"
                        draggable={false}
                    />
                </button>
            ))}
        </div>
    );
};
