import { useRef, useState, type DragEvent } from 'react';
import { ImagePlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface SubmissionCoverFieldProps {
    preview: string;
    fileName?: string;
    disabled: boolean;
    onSelect: (file: File | undefined) => void;
    onPreviewError: () => void;
}

/** 只管理封面选择与反馈；预览地址、上传和投稿仍由表单持有。 */
export function SubmissionCoverField({ preview, fileName, disabled, onSelect, onPreviewError }: SubmissionCoverFieldProps) {
    const { t } = useTranslation('lobby');
    const input = useRef<HTMLInputElement>(null);
    const [dragging, setDragging] = useState(false);
    const [error, setError] = useState('');
    const choose = (file: File) => {
        if (disabled) return;
        const supported = file.type ? ['image/png', 'image/jpeg', 'image/webp', 'image/avif'].includes(file.type) : /\.(png|jpe?g|webp|avif)$/i.test(file.name);
        if (!supported || file.size > 10 * 1024 * 1024) {
            onSelect(undefined);
            setError(t(supported ? 'platform.uploadWorkspace.coverTooLarge' : 'platform.uploadWorkspace.coverInvalidType'));
        } else {
            setError('');
            onSelect(file);
        }
        if (input.current) input.current.value = '';
    };
    const drop = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setDragging(false);
        const file = event.dataTransfer.files[0];
        if (file) choose(file);
    };
    return <div className={`platform-cover-upload${dragging && !disabled ? ' is-dragging' : ''}`}
        onDragOver={event => { event.preventDefault(); if (!disabled) setDragging(true); }}
        onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }} onDrop={drop}>
        <input ref={input} type="file" hidden accept="image/png,image/jpeg,image/webp,image/avif" disabled={disabled}
            aria-label={t('platform.uploadWorkspace.cover')} onChange={event => { const file = event.target.files?.[0]; if (file) choose(file); }} />
        <button type="button" className={`platform-cover-picker${preview ? ' has-preview' : ''}`} disabled={disabled}
            onClick={() => input.current?.click()} aria-label={t(preview ? 'platform.uploadWorkspace.replaceCover' : 'platform.uploadWorkspace.addCover')}>
            {preview ? <img src={preview} alt={t('platform.uploadWorkspace.coverPreviewAlt')} onError={onPreviewError} /> : <ImagePlus aria-hidden="true" size={32} />}
            <span>{t(preview ? 'platform.uploadWorkspace.replaceCover' : 'platform.uploadWorkspace.addCover')}</span>
            <small className="platform-cover-drag-hint">{t('platform.uploadWorkspace.dropCover')}</small>
        </button>
        {fileName && <p className="platform-cover-file-name" title={fileName}>{fileName}</p>}
        <p className="platform-cover-help">{t('platform.uploadWorkspace.coverFormats')}</p>
        {error && <p role="alert">{error}</p>}
    </div>;
}
