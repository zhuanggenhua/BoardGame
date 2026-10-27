import { useCallback, useEffect, useRef, useState } from 'react';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import { useTranslation } from 'react-i18next';
import { ImagePlus, Images, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { ModalBase } from '../common/overlays/ModalBase';
import { AVATAR_PRESETS, DEFAULT_AVATAR_URL } from '../../lib/avatarPresets';
import './avatar-update.css';
import { useAuthModalSession } from '../../hooks/ui/useAuthModalSession';

interface AvatarUpdateModalProps {
    isOpen: boolean;
    onClose: () => void;
    closeOnBackdrop?: boolean;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

type Step = 'select' | 'presets' | 'crop' | 'saving';
type AvatarSource = 'default' | 'preset' | 'upload';

export const AvatarUpdateModal = ({ isOpen, onClose, closeOnBackdrop }: AvatarUpdateModalProps) => {
    useAuthModalSession(isOpen, onClose);
    const { t } = useTranslation('auth');
    const { uploadAvatar, updateAvatar, user } = useAuth();
    const isModernHome = typeof document !== 'undefined'
        && document.documentElement.dataset.homeEntryStyle === 'modern';
    const fileInputRef = useRef<HTMLInputElement>(null);
    const previewUrlRef = useRef<string>('');

    const [step, setStep] = useState<Step>('select');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string>('');
    const [error, setError] = useState('');
    const currentPreset = AVATAR_PRESETS.find(preset => preset.src === user?.avatar);
    const [source, setSource] = useState<AvatarSource>(() => currentPreset ? 'preset'
        : user?.avatar && user.avatar !== DEFAULT_AVATAR_URL ? 'upload' : 'default');
    const [selectedPreset, setSelectedPreset] = useState<string>(currentPreset?.src ?? AVATAR_PRESETS[0].src);
    const currentAvatar = user?.avatar || DEFAULT_AVATAR_URL;
    const selectedAvatar = source === 'default' ? DEFAULT_AVATAR_URL : selectedPreset;
    const hasAvatarChange = source !== 'upload' && selectedAvatar !== currentAvatar;

    // 裁剪状态
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedArea, setCroppedArea] = useState<Area | null>(null);

    // 释放旧 ObjectURL 的工具函数
    const revokePreview = useCallback(() => {
        if (previewUrlRef.current) {
            URL.revokeObjectURL(previewUrlRef.current);
            previewUrlRef.current = '';
        }
    }, []);

    const resetForm = useCallback(() => {
        revokePreview();
        if (fileInputRef.current) fileInputRef.current.value = '';
        setStep('select');
        setSelectedFile(null);
        setPreviewUrl('');
        setError('');
        setCrop({ x: 0, y: 0 });
        setZoom(1);
        setCroppedArea(null);
    }, [revokePreview]);

    const handleClose = useCallback(() => {
        resetForm();
        onClose();
    }, [onClose, resetForm]);

    useEffect(() => {
        return revokePreview;
    }, [revokePreview]);

    // 提取公共的文件校验+进入裁剪逻辑（DRY）
    const processFile = useCallback((file: File) => {
        if (!ACCEPTED_TYPES.includes(file.type)) {
            setError(t('avatar.error.invalidType'));
            return;
        }
        if (file.size > MAX_FILE_SIZE) {
            setError(t('avatar.error.tooLarge'));
            return;
        }

        // 释放旧的 ObjectURL
        revokePreview();

        setError('');
        setSelectedFile(file);
        const url = URL.createObjectURL(file);
        previewUrlRef.current = url;
        setPreviewUrl(url);
        setStep('crop');
        setCrop({ x: 0, y: 0 });
        setZoom(1);
    }, [t, revokePreview]);

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) processFile(file);
    }, [processFile]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) processFile(file);
    }, [processFile]);

    const onCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
        setCroppedArea(croppedAreaPixels);
    }, []);

    const handleUpload = async () => {
        if (!selectedFile || !croppedArea) return;

        setStep('saving');
        setError('');

        try {
            await uploadAvatar(selectedFile, {
                x: croppedArea.x,
                y: croppedArea.y,
                width: croppedArea.width,
                height: croppedArea.height,
            });
            handleClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : t('avatar.error.uploadFailed'));
            setStep('crop');
        }
    };

    const handleReselect = useCallback(() => {
        resetForm();
    }, [resetForm]);

    const selectSource = (next: AvatarSource) => {
        resetForm();
        setSource(next);
    };

    const saveChoice = async (avatar: string) => {
        if (step === 'saving') return;
        setError(''); setStep('saving');
        try { await updateAvatar(avatar); handleClose(); }
        catch (cause) { setError(cause instanceof Error ? cause.message : t('avatar.error.updateFailed')); setStep(isModernHome ? 'presets' : 'select'); }
    };

    if (!isOpen) return null;

    return (
        <ModalBase
            onClose={handleClose}
            closeOnBackdrop={closeOnBackdrop}
            preserveKeyboardLayout
            containerClassName="p-4 sm:p-6"
            containerStyle={{
                paddingTop: 'max(1rem, var(--safe-area-top))',
                paddingRight: 'max(1rem, var(--safe-area-right))',
                paddingBottom: 'max(1rem, var(--modal-active-bottom-inset, var(--runtime-modal-bottom-inset)))',
                paddingLeft: 'max(1rem, var(--safe-area-left))',
            }}
        >
            <div data-platform-dialog="avatar" data-avatar-step={step} className="bg-parchment-card-bg pointer-events-auto w-full max-w-[420px] max-h-[var(--modal-max-height,var(--runtime-modal-max-height))] overflow-y-auto shadow-parchment-card-hover border border-parchment-card-border/50 p-6 sm:p-8 relative rounded-sm font-serif">
                {isModernHome && <>
                    {step !== 'select' && step !== 'saving' && <button type="button" className="avatar-step-back" aria-label={t('common:back')} onClick={resetForm}><ChevronLeft size={20} /></button>}
                    <button type="button" className="platform-dialog-close avatar-modal-close" aria-label={t('common:close')} onClick={handleClose}><X size={20} /></button>
                </>}
                {/* 标题 */}
                <div className="text-center mb-5">
                    <div className="avatar-modal-title text-xs sm:text-sm text-parchment-light-text font-bold uppercase tracking-wider">
                        {isModernHome && step === 'crop' ? t('avatar.cropTitle') : t('avatar.title')}
                    </div>
                    <div className="h-px w-10 bg-parchment-card-border/70 mx-auto mt-2" />
                </div>

                {step !== 'saving' && !isModernHome && <div className="avatar-sources" role="group" aria-label={t('avatar.sourceLabel')}>
                    {(['default', 'preset', 'upload'] as const).map(value => <button type="button" key={value}
                        aria-pressed={source === value} onClick={() => selectSource(value)}>{t(`avatar.source.${value}`)}</button>)}
                </div>}

                {error && (
                    <div role="alert" className="bg-red-50 border border-red-100 text-red-600 text-xs px-3 py-2 mb-4 text-center rounded">
                        {error}
                    </div>
                )}

                {isModernHome && step === 'select' && <>
                    <div className="avatar-default-preview"><img src={currentAvatar} width="112" height="112" alt={user?.username ?? ''} /></div>
                    <div className="avatar-source-actions">
                        <button type="button" onClick={() => fileInputRef.current?.click()}><ImagePlus size={20} /><span>{t('avatar.button.upload')}</span><ChevronRight size={18} /></button>
                        <button type="button" onClick={() => { setSelectedPreset(currentAvatar); setSource('preset'); setStep('presets'); }}><Images size={20} /><span>{t('avatar.choosePreset')}</span><ChevronRight size={18} /></button>
                    </div>
                    <p className="avatar-file-hint text-xs text-parchment-light-text text-center">{t('avatar.dropzone.hint')}</p>
                </>}
                {!isModernHome && step === 'select' && source === 'default' && <div className="avatar-default-preview">
                    <img src={DEFAULT_AVATAR_URL} width="112" height="112" alt={t('avatar.source.default')} />
                </div>}
                {(isModernHome ? step === 'presets' : step === 'select' && source === 'preset') && <div className="avatar-presets">
                    {isModernHome && <button type="button" aria-label={t('avatar.source.default')} aria-pressed={selectedAvatar === DEFAULT_AVATAR_URL} onClick={() => { setSelectedPreset(DEFAULT_AVATAR_URL); setSource('default'); }}>
                        <img src={DEFAULT_AVATAR_URL} alt="" width="64" height="64" /><span>{t('avatar.source.default')}</span>
                    </button>}
                    {AVATAR_PRESETS.map(preset => <button type="button" key={preset.id} aria-label={t(preset.labelKey)}
                        aria-pressed={selectedAvatar === preset.src} onClick={() => { setSelectedPreset(preset.src); setSource('preset'); }}>
                        <img src={preset.src} alt="" width="64" height="64" /><span>{t(preset.labelKey)}</span>
                    </button>)}
                </div>}

                {/* 上传继续使用原校验、裁剪和文件保存链。 */}
                {!isModernHome && step === 'select' && source === 'upload' && (
                    <div className="space-y-4">
                        {/* 当前头像预览 */}
                        {user?.avatar && (
                            <div className="flex justify-center mb-2">
                                <img
                                    src={user.avatar}
                                    alt={user.username}
                                    className="w-20 h-20 rounded-full object-cover border-2 border-parchment-card-border/50"
                                />
                            </div>
                        )}

                        {/* 点按唤起系统选图；桌面也保留拖放接收能力。 */}
                        <button type="button" aria-label={isModernHome ? t('avatar.button.upload') : t('avatar.chooseImage')}
                            onClick={() => fileInputRef.current?.click()}
                            onDrop={handleDrop}
                            onDragOver={(e) => e.preventDefault()}
                            className="avatar-file-picker border-2 border-parchment-card-border/50 rounded-lg p-4 text-center cursor-pointer hover:border-parchment-base-text hover:bg-parchment-base-bg/20 transition-colors"
                        >
                            <ImagePlus size={20} aria-hidden="true" />
                            <span className="text-sm text-parchment-base-text font-bold">{isModernHome ? t('avatar.button.upload') : t('avatar.chooseImage')}</span>
                        </button>
                        <p className="avatar-file-hint text-xs text-parchment-light-text text-center">{t('avatar.dropzone.hint')}</p>

                    </div>
                )}

                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleFileSelect} className="hidden" />
                {(isModernHome ? step === 'presets' : step === 'select') && <div className="avatar-selection-actions">
                    {hasAvatarChange && <button type="button" className="avatar-confirm"
                        onClick={() => void saveChoice(selectedAvatar)}>
                        {t('avatar.button.save')}
                    </button>}
                    {!isModernHome && <button type="button" onClick={handleClose}>{t('avatar.button.cancel')}</button>}
                </div>}

                {/* 步骤二：裁剪 */}
                {step === 'crop' && previewUrl && (
                    <div className="space-y-4">
                        <div
                            className="relative w-full bg-black/10 rounded-lg overflow-hidden"
                            style={{ height: 0, paddingTop: '100%' }}
                            data-testid="avatar-crop-frame"
                        >
                            <div className="absolute inset-0">
                                <Cropper
                                    image={previewUrl}
                                    crop={crop}
                                    zoom={zoom}
                                    aspect={1}
                                    cropShape="round"
                                    showGrid={false}
                                    onCropChange={setCrop}
                                    onZoomChange={setZoom}
                                    onCropComplete={onCropComplete}
                                />
                            </div>
                        </div>

                        {isModernHome && <p className="avatar-crop-hint">
                            <span className="avatar-crop-hint-desktop">{t('avatar.cropHint.desktop')}</span>
                            <span className="avatar-crop-hint-touch">{t('avatar.cropHint.touch')}</span>
                        </p>}

                        {/* 缩放滑块 */}
                        <div className="flex items-center gap-3 px-2">
                            <span className="text-xs text-parchment-light-text">🔍</span>
                            <input
                                type="range"
                                min={1}
                                max={3}
                                step={0.05}
                                value={zoom}
                                onChange={(e) => setZoom(Number(e.target.value))}
                                className="flex-1 h-1 accent-parchment-base-text"
                                aria-label={t('avatar.zoom')}
                            />
                            <span className="text-xs text-parchment-light-text min-w-[2.5rem] text-right">
                                {Math.round(zoom * 100)}%
                            </span>
                        </div>

                        <div className="avatar-crop-actions flex items-center justify-center gap-3">
                            <button
                                type="button"
                                onClick={isModernHome ? () => fileInputRef.current?.click() : handleReselect}
                                className="avatar-crop-reselect px-4 py-2 text-xs sm:text-sm font-bold uppercase tracking-wider border border-parchment-card-border/50 text-parchment-base-text bg-parchment-card-bg hover:bg-parchment-base-bg transition-colors rounded-[4px]"
                            >
                                {t('avatar.button.reselect')}
                            </button>
                            <button
                                type="button"
                                onClick={handleUpload}
                                disabled={!croppedArea}
                                className="avatar-confirm px-4 py-2 text-xs sm:text-sm font-bold uppercase tracking-wider bg-parchment-base-text text-parchment-card-bg hover:bg-parchment-brown transition-colors rounded-[4px]"
                            >
                                {t(isModernHome ? 'avatar.button.save' : 'avatar.button.upload')}
                            </button>
                        </div>
                    </div>
                )}

                {/* 步骤三：上传中 */}
                {step === 'saving' && (
                    <div className="flex flex-col items-center py-8 gap-3">
                        <div className="w-8 h-8 border-2 border-parchment-base-text/30 border-t-parchment-base-text rounded-full animate-spin" />
                        <div className="text-sm text-parchment-light-text">
                            {t('avatar.button.saving')}
                        </div>
                    </div>
                )}
            </div>
        </ModalBase>
    );
};
