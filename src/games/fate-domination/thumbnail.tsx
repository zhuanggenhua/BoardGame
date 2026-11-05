import { useTranslation } from 'react-i18next';
import { OptimizedImage } from '../../components/common/media/OptimizedImage';

const FateDominationThumbnail = () => {
    const { t } = useTranslation('game-fate-domination');
    return (
        <div className="h-full w-full overflow-hidden bg-[#111b22]">
            <OptimizedImage src="fate-domination/thumbnails/cover" alt={t('title')} className="h-full w-full object-cover" />
        </div>
    );
};

export default FateDominationThumbnail;
