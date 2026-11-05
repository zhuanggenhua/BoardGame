import { useTranslation } from 'react-i18next';

/** 外站封面缺省沿用作品列表的首字占位，目录与详情共用同一承载。 */
export function PlatformExternalCover({ name, coverUrl }: { name: string; coverUrl?: string }) {
    const { t } = useTranslation('lobby');
    return coverUrl ? <img src={coverUrl} alt="" /> : <span className="platform-external-art" aria-hidden="true">
        <span className="platform-external-monogram">{name.slice(0, 1)}</span>
        <small>{t('platform.externalGamePage.externalGame')}</small>
    </span>;
}
