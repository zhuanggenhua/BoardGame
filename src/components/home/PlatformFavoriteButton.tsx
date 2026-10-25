import { Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../contexts/ToastContext';
import { useGameLibrary } from './useGameLibrary';

/** Reuses the collection's query owner so catalog and details cannot diverge. */
export function PlatformFavoriteButton({ gameId, title }: { gameId: string; title: string }) {
    const { t } = useTranslation('lobby');
    const toast = useToast();
    const library = useGameLibrary();
    const favorite = library.gameIds.includes(gameId);
    return <button type="button" className="platform-details-favorite" aria-pressed={favorite}
        disabled={library.isLoading || library.isSaving} aria-label={t(favorite ? 'platform.removeFavorite' : 'platform.addFavorite', { game: t(title, { defaultValue: title }) })}
        onClick={() => void library.setFavorite({ gameId, favorite: !favorite }).catch(error => {
            toast.error(error instanceof Error ? error.message : t('platform.favoriteError'));
        })}>
        <Star size={18} aria-hidden="true" fill={favorite ? 'currentColor' : 'none'} />
        <span className="platform-details-favorite-label">{t(favorite ? 'platform.saved' : 'platform.save')}</span>
    </button>;
}
