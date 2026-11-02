import { FileText, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { GameRulesDocument } from '../../shared/externalGames';
import './game-rules-document.css';

/** 详情与审核共用已上传文件的打开入口，不复制文件内容。 */
export function GameRulesDocumentLink({ document }: { document?: GameRulesDocument }) {
    const { t } = useTranslation('lobby');
    if (!document) return null;
    return <a className="external-rules-document" href={document.url} target="_blank" rel="noopener noreferrer">
        <FileText size={20} aria-hidden="true" /><span>{t('platform.uploadWorkspace.openRulesFile')}<small>{document.name}</small></span><ExternalLink size={16} aria-hidden="true" />
    </a>;
}
