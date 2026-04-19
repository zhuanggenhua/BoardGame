import { useCallback, useEffect, useRef, useState } from 'react';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { ModalBase } from '../common/overlays/ModalBase';

interface AvatarUpdateModalProps {
    isOpen: boolean;
    onClose: () => void;
    closeOnBackdrop?: boolean;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

type Step = 'select' | 'crop' | 'uploading';

export const AvatarUpdateModal = ({ isOpen, onClose, closeOnBackdrop }: AvatarUpdateModalProps) => {
    const { t } = useTranslation('auth');
    const { uploadAvatar, user } = useAuth();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const previewUrlRef = useRef<string>('');

    const [step, setStep] = useState<Step>('select');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string>('');
    const [error, setError] = useState('');

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

        setStep('uploading');
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

    if (!isOpen) return null;

    return (
        <ModalBase
            onClose={handleClose}
            closeOnBackdrop={closeOnBackdrop}
            containerClassName="p-4 sm:p-6"
            containerStyle={{
                paddingTop: 'max(1rem, var(--safe-area-top))',
                paddingRight: 'max(1rem, var(--safe-area-right))',
                paddingBottom: 'max(1rem, var(--runtime-modal-bottom-inset))',
                paddingLeft: 'max(1rem, var(--safe-area-left))',
            }}
        >
            <div className="bg-parchment-card-bg pointer-events-auto w-full max-w-[420px] max-h-[var(--runtime-modal-max-height)] overflow-y-auto shadow-parchment-card-hover border border-parchment-card-border/50 p-6 sm:p-8 relative rounded-sm font-serif">
                {/* 标题 */}
                <div className="text-center mb-5">
                    <div className="text-xs sm:text-sm text-parchment-light-text font-bold uppercase tracking-wider">
                        {t('avatar.title')}
                    </div>
                    <div className="h-px w-10 bg-parchment-card-border/70 mx-auto mt-2" />
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-100 text-red-600 text-xs px-3 py-2 mb-4 text-center rounded">
                        {error}
                    </div>
                )}

                {/* 步骤一：选择图片 */}
                {step === 'select' && (
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

                        {/* 拖拽区域 */}
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            onDrop={handleDrop}
                            onDragOver={(e) => e.preventDefault()}
                            className="border-2 border-dashed border-parchment-card-border/50 rounded-lg p-8 text-center cursor-pointer hover:border-parchment-base-text hover:bg-parchment-base-bg/20 transition-colors"
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
                        >
                            <div className="text-3xl mb-2 opacity-40">📷</div>
                            <div className="text-sm text-parchment-base-text font-bold">
                                {t('avatar.dropzone.title')}
                            </div>
                            <div className="text-xs text-parchment-light-text mt-1">
                                {t('avatar.dropzone.hint')}
                            </div>
                        </div>

                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/gif"
                            onChange={handleFileSelect}
                            className="hidden"
                        />

                        <div className="flex justify-center">
                            <button
                                type="button"
                                onClick={handleClose}
                                className="px-4 py-2 text-xs sm:text-sm font-bold uppercase tracking-wider border border-parchment-card-border/50 text-parchment-base-text bg-parchment-card-bg hover:bg-parchment-base-bg transition-colors rounded-[4px]"
                            >
                                {t('avatar.button.cancel')}
                            </button>
                        </div>
                    </div>
                )}

                {/* 步骤二：裁剪 */}
                {step === 'crop' && previewUrl && (
                    <div className="space-y-4">
                        <div className="relative w-full aspect-square bg-black/10 rounded-lg overflow-hidden">
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

                        <div className="flex items-center justify-center gap-3">
                            <button
                                type="button"
                                onClick={handleReselect}
                                className="px-4 py-2 text-xs sm:text-sm font-bold uppercase tracking-wider border border-parchment-card-border/50 text-parchment-base-text bg-parchment-card-bg hover:bg-parchment-base-bg transition-colors rounded-[4px]"
                            >
                                {t('avatar.button.reselect')}
                            </button>
                            <button
                                type="button"
                                onClick={handleUpload}
                                className="px-4 py-2 text-xs sm:text-sm font-bold uppercase tracking-wider bg-parchment-base-text text-parchment-card-bg hover:bg-parchment-brown transition-colors rounded-[4px]"
                            >
                                {t('avatar.button.upload')}
                            </button>
                        </div>
                    </div>
                )}

                {/* 步骤三：上传中 */}
                {step === 'uploading' && (
                    <div className="flex flex-col items-center py-8 gap-3">
                        <div className="w-8 h-8 border-2 border-parchment-base-text/30 border-t-parchment-base-text rounded-full animate-spin" />
                        <div className="text-sm text-parchment-light-text">
                            {t('avatar.button.uploading')}
                        </div>
                    </div>
                )}
            </div>
        </ModalBase>
    );
};
