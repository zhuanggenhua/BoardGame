import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { OptimizedImage } from '../../../components/common/media/OptimizedImage';

/** 背景属于页面视口，不能被牌桌的等比缩放和裁切限制。 */
export function DiceThronePageBackground({ children }: { children: ReactNode }) {
    const { t, i18n } = useTranslation('game-dicethrone');

    return (
        <div className="relative isolate w-full h-full">
            <div className="absolute inset-0 bg-black pointer-events-none" aria-hidden="true">
                <OptimizedImage
                    src="dicethrone/images/Common/background"
                    locale={i18n.resolvedLanguage ?? i18n.language}
                    className="w-full h-full object-cover"
                    alt={t('imageAlt.background')}
                    data-testid="dicethrone-page-background"
                />
                <div className="absolute inset-0 bg-black/40" />
            </div>
            <div className="relative z-10 w-full h-full">
                {children}
            </div>
        </div>
    );
}
