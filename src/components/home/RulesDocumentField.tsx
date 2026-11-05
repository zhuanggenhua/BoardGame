import { useRef, useState, type DragEvent } from 'react';
import { FileText, Upload, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { GameRulesDocument } from '../../shared/externalGames';

interface RulesDocumentFieldProps {
    document?: GameRulesDocument;
    file?: File;
    disabled: boolean;
    error: string;
    onSelect: (file: File) => void;
    onRemove: () => void;
}

/** 文件选择与已保存附件的展示；持久化由投稿或作品表单完成。 */
export function RulesDocumentField({ document, file, disabled, error, onSelect, onRemove }: RulesDocumentFieldProps) {
    const { t } = useTranslation('lobby');
    const input = useRef<HTMLInputElement>(null);
    const [dragging, setDragging] = useState(false);
    const selected = file ?? document;
    const drop = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault(); setDragging(false);
        const next = event.dataTransfer.files[0];
        if (!disabled && next) onSelect(next);
    };
    return <div className={`platform-rules-upload${dragging && !disabled ? ' is-dragging' : ''}`} onDrop={drop}
        onDragOver={event => { event.preventDefault(); if (!disabled) setDragging(true); }}
        onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }}>
        <span className="platform-rules-label">{t('platform.uploadWorkspace.rulesFile')}</span>
        <input ref={input} type="file" hidden accept="application/pdf,.pdf" disabled={disabled} aria-label={t('platform.uploadWorkspace.rulesFile')}
            onChange={event => { const next = event.target.files?.[0]; if (next) onSelect(next); event.currentTarget.value = ''; }} />
        {selected ? <div className="platform-rules-file-row">
            <FileText size={24} aria-hidden="true" />
            <div className="platform-rules-file-info">
                {file ? <span title={file.name}>{file.name}</span> : <a href={document!.url} target="_blank" rel="noopener noreferrer" title={document!.name}>{document!.name}</a>}
                <small>{Math.max(1, Math.ceil(selected.size / 1024))} KB{file && ` · ${t('platform.uploadWorkspace.fileNotSaved')}`}</small>
            </div>
            <button type="button" className="platform-rules-replace" disabled={disabled} onClick={() => input.current?.click()}>{t('platform.uploadWorkspace.replaceRulesFile')}</button>
            <button type="button" className="platform-rules-remove" disabled={disabled} aria-label={t('platform.uploadWorkspace.removeRulesFile')} onClick={onRemove}><X size={18} /></button>
        </div> : <button type="button" className="platform-rules-picker" disabled={disabled} onClick={() => input.current?.click()}>
            <Upload size={20} aria-hidden="true" /><span>{t('platform.uploadWorkspace.addRulesFile')}</span>
        </button>}
        <small className="platform-rules-help">{t('platform.uploadWorkspace.rulesFileFormats')}</small>
        {error && <p role="alert" className="platform-rules-error"><span>{error}</span>{!selected && <button type="button" className="platform-rules-remove" disabled={disabled}
            aria-label={t('platform.uploadWorkspace.removeRulesFile')} onClick={onRemove}><X size={18} /></button>}</p>}
    </div>;
}
