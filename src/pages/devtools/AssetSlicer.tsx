import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// 辅助函数：合并类名
function cn(...inputs: (string | undefined | null | false)[]) {
    return twMerge(clsx(inputs));
}

// 图标组件 (SVG)
const UploadIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
);

const DownloadIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
);

const XIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
);

const ResetIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
);

const ChevronLeftIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
);

const LockIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
);

const UnlockIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 9.9-1" /></svg>
);

const ChevronRightIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
);

const GridIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>
);

const LightningIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
);

const SquareIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /></svg>
);

const CircleIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /></svg>
);



interface ExtractedAsset {
    id: string;
    dataUrl: string;
    timestamp: number;
    // 用于重建精灵图的元数据
    srcX: number;
    srcY: number;
    width: number;
    height: number;
    shape: 'circle' | 'square';
}

interface CropSize {
    width: number;
    height: number;
}

interface Transform {
    x: number;
    y: number;
    scale: number;
}

export const AssetSlicer = () => {
    // 基础状态
    const [sourceImage, setSourceImage] = useState<string | null>(null);
    const [imageName, setImageName] = useState<string>('图片');
    const [cropSize, setCropSize] = useState<CropSize>({ width: 64, height: 64 }); // 默认尺寸
    const [isSizeLocked, setIsSizeLocked] = useState(false); // 默认不锁定
    const [isQuickSlice, setIsQuickSlice] = useState(false); // 快裁模式
    const [shape, setShape] = useState<'circle' | 'square'>('square'); // 默认方形
    const [extractedAssets, setExtractedAssets] = useState<ExtractedAsset[]>([]);

    // UI 状态
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    // 视图状态 (Transform Engine)
    const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, scale: 1 });
    const [isDraggingFile, setIsDraggingFile] = useState(false);

    // 交互状态
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, y: 0 });
    const [isDrawing, setIsDrawing] = useState(false);
    const [isHoveringImage, setIsHoveringImage] = useState(false);
    const [isAltPressed, setIsAltPressed] = useState(false);

    // 动态锚点：支持从任意方向拖拽后，光标相对选区的位置
    // { x: 0, y: 0 } = 鼠标在左上角 (默认)
    // { x: 1, y: 1 } = 鼠标在右下角
    const [anchorPoint, setAnchorPoint] = useState({ x: 0.5, y: 0.5 });
    const anchorPointRef = useRef({ x: 0.5, y: 0.5 }); // 同步版本，避免 setState 延迟
    const mousePos = useRef({ x: 0, y: 0 }); // 记录鼠标位置用于非移动时的更新

    // 封装 setAnchorPoint，同时更新 ref
    const updateAnchorPoint = (newAnchor: { x: number; y: number }) => {
        anchorPointRef.current = newAnchor;
        setAnchorPoint(newAnchor);
    };

    // 高级功能状态


    // 引用
    const imageRef = useRef<HTMLImageElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cursorRef = useRef<HTMLDivElement>(null);

    // 使用 Ref 确保事件处理中的状态实时性
    const isDrawingRef = useRef(false);
    const drawStartRef = useRef({ x: 0, y: 0 });

    const dragAspectRatio = useRef<number>(1);

    const getCursorCenter = (scale: number, size: CropSize, anchor = anchorPoint) => {
        const currentWidth = size.width * scale;
        const currentHeight = size.height * scale;

        return {
            x: mousePos.current.x + currentWidth * (0.5 - anchor.x),
            y: mousePos.current.y + currentHeight * (0.5 - anchor.y)
        };
    };

    const updateCursorStyle = () => {
        if (!cursorRef.current || !sourceImage) return;

        const transformScale = transform.scale;
        const currentWidth = cropSize.width * transformScale;
        const currentHeight = cropSize.height * transformScale;

        cursorRef.current.style.width = `${currentWidth}px`;
        cursorRef.current.style.height = `${currentHeight}px`;

        // 使用 ref 的值（同步），避免 setState 延迟导致的跳动
        const anchor = anchorPointRef.current;
        const left = mousePos.current.x - (currentWidth * anchor.x);
        const top = mousePos.current.y - (currentHeight * anchor.y);

        cursorRef.current.style.left = `${left}px`;
        cursorRef.current.style.top = `${top}px`;
    };

    // 当尺寸或视角变化时，更新光标
    useEffect(() => {
        if (!isDrawingRef.current) {
            updateCursorStyle();
        }
    }, [cropSize, transform, anchorPoint, isDrawing]); // 补充 isDrawing 依赖

    // 快捷键与粘贴支持
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.altKey) setIsAltPressed(true);

            // 图像缩放快捷键
            if ((e.key === '=' || e.key === '+') && !e.ctrlKey && !e.metaKey) {
                handleImageZoom(0.25);
            }
            if ((e.key === '-' || e.key === '_') && !e.ctrlKey && !e.metaKey) {
                handleImageZoom(-0.25);
            }
            if (e.key === '0' && !e.ctrlKey && !e.metaKey) {
                resetView();
            }

            // 提取尺寸快捷键 (Photoshop 风格: [ 减小, ] 增大) - 统一缩放
            if (e.key === '[') {
                updateSize(4);  // 正值 -> 缩小
            }
            if (e.key === ']') {
                updateSize(-4); // 负值 -> 放大
            }


        };
        const handleKeyUp = (e: KeyboardEvent) => {
            if (!e.altKey) setIsAltPressed(false);
        };

        const handlePaste = (e: ClipboardEvent) => {
            const items = e.clipboardData?.items;
            if (!items) return;

            // 检查是否有文件项
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    const blob = items[i].getAsFile();
                    if (blob) {
                        e.preventDefault(); // 阻止默认粘贴行为（如将图片粘贴到输入框中）
                        loadFile(blob);
                        return; // 只处理第一张图片
                    }
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        document.addEventListener('paste', handlePaste); // 使用 document 监听确保在任何焦点下生效
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            document.removeEventListener('paste', handlePaste);
        };
    }, [cropSize]); // 依赖 cropSize

    // 失焦时清理 Alt / 拖拽状态，避免进入页面处于“拖拽模式”
    useEffect(() => {
        const handleBlur = () => {
            setIsAltPressed(false);
            setIsPanning(false);
        };
        const handleVisibility = () => {
            if (document.hidden) {
                setIsAltPressed(false);
                setIsPanning(false);
            }
        };
        window.addEventListener('blur', handleBlur);
        document.addEventListener('visibilitychange', handleVisibility);
        return () => {
            window.removeEventListener('blur', handleBlur);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, []);

    // 图像缩放逻辑封装 (支持以特定点为中心缩放)
    const handleImageZoom = (deltaY: number, mouseX?: number, mouseY?: number) => {
        const zoomIntensity = 0.001;
        const zoomFactor = Math.exp(-deltaY * zoomIntensity);
        const currentCenter = getCursorCenter(transform.scale, cropSize, anchorPoint);

        if (!isDrawingRef.current) {
            // 缩放时以裁剪框中心为锚点，保持视觉位置稳定
            mousePos.current = currentCenter;
            updateAnchorPoint({ x: 0.5, y: 0.5 });
        }

        setTransform(prev => {
            const newScale = Math.min(Math.max(0.01, prev.scale * zoomFactor), 50);
            const scaleRatio = newScale / prev.scale;

            if (!isDrawingRef.current) {
                // 视觉恒定：介于“世界恒定”和“屏幕恒定”之间的折中缩放
                const visualExponent = 0.5;
                const sizeRatio = Math.pow(scaleRatio, visualExponent - 1);

                setCropSize(prevSize => {
                    const nextW = Math.max(1, Math.round(prevSize.width * sizeRatio));
                    const nextH = Math.max(1, Math.round(prevSize.height * sizeRatio));

                    if (shape === 'circle') {
                        const s = Math.max(nextW, nextH);
                        return { width: s, height: s };
                    }

                    return { width: nextW, height: nextH };
                });
            }

            // 如果没有提供鼠标位置（如快捷键缩放），则默认以容器中心为缩放中心
            let cx: number;
            let cy: number;

            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                if (isHoveringImage) {
                    cx = currentCenter.x - rect.left;
                    cy = currentCenter.y - rect.top;
                } else if (mouseX !== undefined && mouseY !== undefined) {
                    cx = mouseX - rect.left;
                    cy = mouseY - rect.top;
                } else {
                    // 使用容器中心（视口中心）
                    cx = rect.width / 2;
                    cy = rect.height / 2;
                }

                const newX = cx - (cx - prev.x) * scaleRatio;
                const newY = cy - (cy - prev.y) * scaleRatio;

                return { x: newX, y: newY, scale: newScale };
            }

            return { ...prev, scale: newScale };
        });
    };

    // 提取区域尺寸逻辑封装 (指数增长更丝滑，保持宽高比)
    const updateSize = (deltaY: number) => {
        // 调整尺寸时，强制将锚点设为中心，解决"以右下角为原点"的问题
        updateAnchorPoint({ x: 0.5, y: 0.5 });

        setCropSize(prev => {
            const zoomIntensity = 0.001;
            const step = Math.exp(-deltaY * zoomIntensity);

            const nextW = Math.max(1, Math.round(prev.width * step));
            const nextH = Math.max(1, Math.round(prev.height * step));

            return { width: nextW, height: nextH };
        });
    };

    // 使用非被动监听处理滚轮，确保能拦截浏览器缩放并分流逻辑
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleNativeWheel = (e: WheelEvent) => {
            if (!sourceImage) return;
            e.preventDefault();

            // 如果按下了 Ctrl 或 Meta，则专门缩放提取区域
            if (e.ctrlKey || e.metaKey) {
                updateSize(e.deltaY);
            } else {
                // 普通滚轮，缩放视角，以鼠标位置为中心
                handleImageZoom(e.deltaY, e.clientX, e.clientY);
            }
        };

        container.addEventListener('wheel', handleNativeWheel, { passive: false });
        return () => container.removeEventListener('wheel', handleNativeWheel);
    }, [sourceImage]);

    // 文件处理
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) loadFile(file);
    };

    const loadFile = (file: File) => {
        // 释放旧的 URL 以避免内存泄漏
        if (sourceImage) URL.revokeObjectURL(sourceImage);

        const url = URL.createObjectURL(file);
        setSourceImage(url);
        setImageName(file.name.replace(/\.[^/.]+$/, ""));
        setExtractedAssets([]);
        setTransform({ x: 0, y: 0, scale: 1 });
        setIsPanning(false);
        setIsAltPressed(false);
        // 重置状态，默认使用中心锚点，符合用户"以中心缩放"的直觉
        updateAnchorPoint({ x: 0.5, y: 0.5 });
        setCropSize({ width: 64, height: 64 });
        isDrawingRef.current = false;
    };

    // 全局事件监听：防止拖拽出区域后无法结束
    useEffect(() => {
        const handleGlobalEnd = () => {
            if (isDrawingRef.current) {
                isDrawingRef.current = false;
                setIsDrawing(false);
            }
        };

        window.addEventListener('mouseup', handleGlobalEnd);
        // window.addEventListener('mouseleave', handleGlobalEnd); // MouseLeave window 也可以视为结束，视需求而定

        return () => {
            window.removeEventListener('mouseup', handleGlobalEnd);
        };
    }, []);

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDraggingFile(false);
        const file = e.dataTransfer.files?.[0];
        if (file && file.type.startsWith('image/')) loadFile(file);
    };



    // 核心功能：提取切片 (抽取通用逻辑)
    const performExtraction = (imgCenterX: number, imgCenterY: number, width: number, height: number, customShape?: 'circle' | 'square') => {
        if (!imageRef.current) return;
        const img = imageRef.current;
        const targetShape = customShape || shape;

        let targetX = imgCenterX - (width / 2);
        let targetY = imgCenterY - (height / 2);
        const targetW = width;
        const targetH = height;

        // 生成预览图
        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // 根据形状裁切
        if (targetShape === 'circle') {
            ctx.beginPath();
            const r = Math.min(targetW, targetH) / 2;
            ctx.arc(targetW / 2, targetH / 2, r, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
        }

        ctx.drawImage(img, targetX, targetY, targetW, targetH, 0, 0, targetW, targetH);

        const dataUrl = canvas.toDataURL('image/png');
        setExtractedAssets(prev => [...prev, {
            id: Math.random().toString(36).substring(2, 9),
            dataUrl,
            srcX: targetX,
            srcY: targetY,
            width: targetW,
            height: targetH,
            shape: targetShape,
            timestamp: Date.now()
        }]);
    };

    const handleExtractClick = (e: React.MouseEvent) => {
        if (!imageRef.current || isPanning || isAltPressed) return;

        const img = imageRef.current;
        const rect = img.getBoundingClientRect();

        const displayX = e.clientX - rect.left;
        const displayY = e.clientY - rect.top;
        const scaleFactor = img.naturalWidth / rect.width;

        // 由于光标位置受 anchorPoint 影响，点击时的坐标 (e.clientX) 是光标的定位点
        // 定位点 = BoxLeft + (Width * AnchorX)
        // 所以 BoxLeft = MouseX - (Width * AnchorX)

        const sourceMouseX = displayX * scaleFactor;
        const sourceMouseY = displayY * scaleFactor;

        // 计算选区原本的 TopLeft (Source Coordinates)
        const boxLeft = sourceMouseX - (cropSize.width * anchorPoint.x);
        const boxTop = sourceMouseY - (cropSize.height * anchorPoint.y);

        const centerX = boxLeft + (cropSize.width / 2);
        const centerY = boxTop + (cropSize.height / 2);

        performExtraction(centerX, centerY, cropSize.width, cropSize.height);
    };

    const downloadAsset = (asset: ExtractedAsset, index: number) => {
        const link = document.createElement('a');
        link.href = asset.dataUrl;
        link.download = `${imageName}_slice_${index + 1}.png`;
        link.click();
    };

    // 导出帮助函数
    const triggerDownload = (url: string, filename: string) => {
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // 导出精灵图 (纯图片版)
    const exportSpriteSheet = () => {
        if (extractedAssets.length === 0 || !imageRef.current) return;

        const count = extractedAssets.length;
        const cols = Math.ceil(Math.sqrt(count));
        // 确保行数足够
        const rows = Math.ceil(count / cols);

        let maxWidth = 0;
        let maxHeight = 0;
        // 计算最大单元格尺寸
        extractedAssets.forEach(a => {
            maxWidth = Math.max(maxWidth, a.width);
            maxHeight = Math.max(maxHeight, a.height);
        });

        const sheetWidth = cols * maxWidth;
        const sheetHeight = rows * maxHeight;

        const canvas = document.createElement('canvas');
        canvas.width = sheetWidth;
        canvas.height = sheetHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        extractedAssets.forEach((asset, i) => {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const destX = col * maxWidth;
            const destY = row * maxHeight;

            // 自动居中对齐
            const offsetX = (maxWidth - asset.width) / 2;
            const offsetY = (maxHeight - asset.height) / 2;

            ctx.save();
            ctx.beginPath();
            const drawX = destX + offsetX;
            const drawY = destY + offsetY;

            if (asset.shape === 'circle') {
                ctx.arc(drawX + asset.width / 2, drawY + asset.height / 2, asset.width / 2, 0, Math.PI * 2);
                ctx.clip();
            }

            ctx.drawImage(imageRef.current!, asset.srcX, asset.srcY, asset.width, asset.height, drawX, drawY, asset.width, asset.height);
            ctx.restore();
        });

        // 仅下载图片
        const pngUrl = canvas.toDataURL('image/png');
        triggerDownload(pngUrl, `${imageName}_spritesheet.png`);
    };



    const handleMouseDown = (e: React.MouseEvent) => {
        // 右键拖拽（平移）或 Alt+左键拖拽
        if (e.button === 2 || (e.button === 0 && isAltPressed)) {
            e.preventDefault();
            e.stopPropagation();
            setIsPanning(true);
            setPanStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
            return; // 右键/Alt拖拽时不执行后续逻辑
        }
        
        // 左键逻辑 - 必须在图片上才能开始框选
        if (e.button === 0 && !isAltPressed && isHoveringImage) {
            e.preventDefault(); // 阻止默认行为（如文本选择、图片拖拽）
            
            // 开始框选
            isDrawingRef.current = true;
            drawStartRef.current = { x: e.clientX, y: e.clientY };
            setIsDrawing(true);

            // 记录开始拖拽时的宽高比，用于锁定比例模式
            if (isSizeLocked && cropSize.height > 0) {
                dragAspectRatio.current = cropSize.width / cropSize.height;
            } else {
                dragAspectRatio.current = 1;
            }
            return; // 框选时不执行后续逻辑
        }
        
        // 如果不是上述任何情况，阻止默认行为（防止意外拖拽）
        if (e.button === 0) {
            e.preventDefault();
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        mousePos.current = { x: e.clientX, y: e.clientY };

        if (isPanning) {
            e.preventDefault();
            setTransform(prev => ({ ...prev, x: e.clientX - panStart.x, y: e.clientY - panStart.y }));
            return;
        }

        if (isDrawingRef.current) {
            const startX = drawStartRef.current.x;
            const startY = drawStartRef.current.y;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            let w = Math.abs(dx) / transform.scale;
            let h = Math.abs(dy) / transform.scale;

            if (shape === 'circle') {
                const s = Math.max(w, h);
                w = s;
                h = s;
            } else if (isSizeLocked) {
                const ratio = dragAspectRatio.current;
                if (w / ratio > h) {
                    h = w / ratio;
                } else {
                    w = h * ratio;
                }
            }

            setCropSize({ width: Math.round(w), height: Math.round(h) });

            if (cursorRef.current) {
                const screenW = w * transform.scale;
                const screenH = h * transform.scale;
                cursorRef.current.style.width = `${screenW}px`;
                cursorRef.current.style.height = `${screenH}px`;
                // 框覆盖从起点到鼠标的区域，使用 >= 避免 dx=dy=0 时跳到右下角
                cursorRef.current.style.left = `${dx >= 0 ? startX : startX - screenW}px`;
                cursorRef.current.style.top = `${dy >= 0 ? startY : startY - screenH}px`;
            }
        } else {
            updateCursorStyle();
        }
    };

    const handleMouseUp = (e: React.MouseEvent) => {
        if (isPanning) {
            setIsPanning(false);
            return;
        }

        if (isDrawingRef.current) {
            const startX = drawStartRef.current.x;
            const startY = drawStartRef.current.y;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            const dragDist = Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2));

            // 阈值调大预防误触 (原 10 -> 30)
            if (dragDist > 30) {
                if (isQuickSlice && imageRef.current) {
                    // 快裁模式：直接提取
                    const img = imageRef.current;
                    const rect = img.getBoundingClientRect();
                    const screenCenterX = (e.clientX + startX) / 2;
                    const screenCenterY = (e.clientY + startY) / 2;
                    const displayX = screenCenterX - rect.left;
                    const displayY = screenCenterY - rect.top;
                    const scaleFactor = img.naturalWidth / rect.width;
                    const imgCenterX = displayX * scaleFactor;
                    const imgCenterY = displayY * scaleFactor;
                    performExtraction(imgCenterX, imgCenterY, cropSize.width, cropSize.height);
                }
                
                // 拖拽结束后，始终重置锚点为中心，避免瞬移
                updateAnchorPoint({ x: 0.5, y: 0.5 });
            } else {
                handleExtractClick(e);
            }

            isDrawingRef.current = false;
            setIsDrawing(false);
        }
    };
    const resetView = () => { setTransform({ x: 0, y: 0, scale: 1 }); };



    return (
        <div
            className={cn(
                "flex h-screen w-screen bg-gray-950 text-gray-100 overflow-hidden font-sans transition-colors duration-300",
                isDraggingFile && "bg-teal-900/30"
            )}
            onDragOver={(e) => { e.preventDefault(); setIsDraggingFile(true); }}
            onDragLeave={() => setIsDraggingFile(false)}
            onDrop={handleDrop}
            onMouseUp={handleMouseUp}
            tabIndex={0}
        >
            <motion.div
                animate={{ width: isSidebarOpen ? 320 : 0, opacity: isSidebarOpen ? 1 : 0 }}
                transition={{ type: 'spring', damping: 20, stiffness: 100 }}
                className="flex-shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col z-20 shadow-2xl relative overflow-hidden"
            >
                <div className="p-6 border-b border-gray-800 bg-gray-900/50 backdrop-blur shrink-0">
                    <div className="flex items-center justify-between mb-1">
                        <Link to="/" className="text-[10px] text-gray-500 hover:text-teal-400 font-bold flex items-center gap-1 transition-colors uppercase tracking-wider">
                            ← 返回主页
                        </Link>
                    </div>
                    <h1 className="text-2xl font-black bg-gradient-to-r from-teal-400 to-blue-500 bg-clip-text text-transparent truncate cursor-pointer" onClick={resetView}>
                        素材切片机
                    </h1>
                    <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-widest font-bold">Creative Workshop</p>
                </div>

                <div className="p-6 space-y-8 flex-1 overflow-y-auto custom-scrollbar min-w-[320px]">
                    <div
                        className={cn(
                            "border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer group",
                            isDraggingFile ? "border-teal-500 bg-teal-500/10 scale-95" : "border-gray-800 hover:border-gray-600 hover:bg-gray-800/30"
                        )}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                        <div className="flex flex-col items-center gap-3 text-gray-500 group-hover:text-gray-300 transition-colors">
                            <UploadIcon />
                            <span className="text-xs font-bold leading-tight">更换图片 (Ctrl+V)<br />或拖入此处</span>
                        </div>
                    </div>

                    {sourceImage && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-500">
                            {/* 功能切换栏 */}
                            <div className="flex bg-gray-800 p-1 rounded-lg">
                                <button
                                    onClick={() => setShape('square')}
                                    className={cn("flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-xs font-bold transition-all", shape === 'square' ? "bg-teal-500 text-white shadow-lg" : "text-gray-400 hover:text-white")}
                                >
                                    <SquareIcon /> 矩形
                                </button>
                                <button
                                    onClick={() => {
                                        setShape('circle');
                                        // 切换回圆形是强制正圆 (取最大边)
                                        const s = Math.max(cropSize.width, cropSize.height);
                                        setCropSize({ width: s, height: s });
                                    }}
                                    className={cn("flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-xs font-bold transition-all", shape === 'circle' ? "bg-teal-500 text-white shadow-lg" : "text-gray-400 hover:text-white")}
                                >
                                    <CircleIcon /> 圆形
                                </button>
                            </div>



                            <div>
                                <div className="flex justify-between items-end mb-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">裁切尺寸 (宽 x 高)</label>
                                </div>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-gray-500 text-xs font-medium">裁剪尺寸</span>
                                    <button
                                        onClick={() => setIsQuickSlice(!isQuickSlice)}
                                        className={cn(
                                            "flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border transition-all",
                                            isQuickSlice
                                                ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                                                : "bg-gray-800 border-gray-700 text-gray-500 hover:text-gray-400"
                                        )}
                                        title="快裁模式：松开鼠标立即裁剪"
                                    >
                                        <LightningIcon />
                                        <span>快裁</span>
                                    </button>
                                </div>
                                <div className="flex items-center gap-2">
                                    {/* 宽度输入 */}
                                    <div className="flex-1 bg-gray-800 rounded-lg flex items-center px-2 py-1.5 border border-transparent focus-within:border-teal-500/50 transition-colors">
                                        <span className="text-[9px] text-gray-500 font-bold mr-1.5">W</span>
                                        <input
                                            type="number"
                                            value={cropSize.width}
                                            onChange={(e) => {
                                                const val = Math.max(1, Number(e.target.value));
                                                setCropSize(prev => {
                                                    if (shape === 'circle') return { width: val, height: val };
                                                    if (isSizeLocked) {
                                                        const ratio = prev.width / prev.height;
                                                        return { width: val, height: Math.max(1, Math.round(val / ratio)) };
                                                    }
                                                    return { ...prev, width: val };
                                                });
                                            }}
                                            className="w-full bg-transparent border-none text-teal-400 font-mono font-bold p-0 focus:ring-0 text-sm"
                                        />
                                    </div>

                                    {/* 锁定按钮 */}
                                    <button
                                        onClick={() => setIsSizeLocked(!isSizeLocked)}
                                        className={cn(
                                            "p-1.5 rounded-md transition-all active:scale-95",
                                            isSizeLocked ? "bg-teal-500/10 text-teal-400" : "bg-gray-800 text-gray-500 hover:text-gray-300"
                                        )}
                                        title={isSizeLocked ? "解除锁定" : "锁定比例"}
                                        disabled={shape === 'circle'}
                                    >
                                        {isSizeLocked ? <LockIcon /> : <UnlockIcon />}
                                    </button>

                                    {/* 高度输入 */}
                                    <div className="flex-1 bg-gray-800 rounded-lg flex items-center px-2 py-1.5 border border-transparent focus-within:border-teal-500/50 transition-colors">
                                        <span className="text-[9px] text-gray-500 font-bold mr-1.5">H</span>
                                        <input
                                            type="number"
                                            value={cropSize.height}
                                            onChange={(e) => {
                                                const val = Math.max(1, Number(e.target.value));
                                                setCropSize(prev => {
                                                    if (shape === 'circle') return { width: val, height: val };
                                                    if (isSizeLocked) {
                                                        const ratio = prev.width / prev.height;
                                                        return { width: Math.max(1, Math.round(val * ratio)), height: val };
                                                    }
                                                    return { ...prev, height: val };
                                                });
                                            }}
                                            className="w-full bg-transparent border-none text-teal-400 font-mono font-bold p-0 focus:ring-0 text-sm"
                                        />
                                    </div>
                                </div>
                                <div className="flex justify-between mt-2">
                                    <button onClick={() => updateSize(4)} className="text-[10px] bg-gray-800 hover:bg-gray-700 px-2 py-1 rounded border border-gray-700 font-mono">缩减 [</button>
                                    <button onClick={() => updateSize(-4)} className="text-[10px] bg-gray-800 hover:bg-gray-700 px-2 py-1 rounded border border-gray-700 font-mono">增大 ]</button>
                                </div>
                            </div>

                            <div className="flex items-center justify-between border-t border-gray-800 pt-4">
                                <span className="text-[10px] font-black text-gray-500 uppercase">视角: {(transform.scale * 100).toFixed(0)}%</span>
                                <button onClick={resetView} className="text-[10px] flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded text-gray-300 transition-colors"><ResetIcon /> 重置</button>
                            </div>

                            <div className="bg-teal-500/5 border border-teal-500/20 rounded-xl p-4 space-y-3">
                                <ul className="text-[11px] text-teal-200/60 space-y-2 list-none">
                                    <li className="flex gap-2">
                                        <kbd className="px-1 bg-gray-800 border border-gray-700 rounded text-teal-400 text-[9px] h-fit">Ctrl+V</kbd>
                                        <span>粘贴剪贴板图片</span>
                                    </li>
                                    <li className="flex gap-2">
                                        <kbd className="px-1 bg-gray-800 border border-gray-700 rounded text-teal-400 text-[9px] h-fit">右键拖拽</kbd>
                                        <span>平移画布</span>
                                    </li>
                                    <li className="flex gap-2">
                                        <kbd className="px-1 bg-gray-800 border border-gray-700 rounded text-teal-400 text-[9px] h-fit">Ctrl+滚轮</kbd>
                                        <span>缩放裁切框</span>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    )}

                    {extractedAssets.length > 0 && (
                        <div className="pt-6 border-t border-gray-800">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xs font-black text-gray-300 uppercase tracking-widest">已提取 ({extractedAssets.length})</h3>
                                <button onClick={exportSpriteSheet} className="text-[10px] flex items-center gap-1.5 bg-purple-500/10 hover:bg-purple-500/20 px-2.5 py-1.5 rounded-lg text-purple-400 font-bold transition-all border border-purple-500/20"><GridIcon /> 导出精灵图</button>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <AnimatePresence>
                                    {extractedAssets.map((asset, i) => (
                                        <motion.div key={asset.id} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }} className="group relative aspect-square bg-gray-800/80 rounded-xl border border-gray-700/50 overflow-hidden hover:border-teal-500/50 transition-all hover:shadow-lg">
                                            <img src={asset.dataUrl} className="w-full h-full object-contain p-1" alt={`Slice ${i}`} />
                                            <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                <button onClick={() => downloadAsset(asset, i)} className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all scale-75 group-hover:scale-100"><DownloadIcon /></button>
                                                <button onClick={() => setExtractedAssets(curr => curr.filter(x => x.id !== asset.id))} className="p-2 bg-red-500/10 hover:bg-red-500/20 rounded-full text-red-400 transition-all scale-75 group-hover:scale-100"><XIcon /></button>
                                            </div>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </div>
                        </div>
                    )}
                </div>
            </motion.div>

            <div className="absolute left-0 top-1/2 -translate-y-1/2 z-30" style={{ left: isSidebarOpen ? 320 : 0 }}>
                <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="w-6 h-12 bg-gray-800 border border-l-0 border-gray-700 rounded-r-md flex items-center justify-center text-gray-400 hover:text-white hover:bg-teal-600 transition-all shadow-xl group">
                    {isSidebarOpen ? <ChevronLeftIcon /> : <ChevronRightIcon />}
                </button>
            </div>

            <div 
                className={cn("flex-1 bg-gray-950 relative overflow-hidden flex items-center justify-center border-l border-gray-800 perspective-1000", isPanning ? "cursor-grabbing" : "cursor-default")} 
                onMouseMove={handleMouseMove} 
                onMouseDown={handleMouseDown}
                onContextMenu={(e) => {
                    // 阻止右键菜单（右键用于拖拽）
                    e.preventDefault();
                }}
                ref={containerRef}
            >
                {!sourceImage ? (
                    <div className="flex flex-col items-center justify-center p-16 border-2 border-dashed border-gray-800 rounded-[32px] bg-gray-900/20 text-gray-500 pointer-events-none max-w-md w-full select-none">
                        <UploadIcon />
                        <h2 className="mt-6 text-2xl font-black text-gray-300">无图片</h2>
                        <p className="mt-3 text-sm text-center leading-relaxed text-gray-600">更换图片 (Ctrl+V) / 拖入图片</p>
                    </div>
                ) : (
                    <div className="w-full h-full flex items-center justify-center pointer-events-none">
                        <div className="pointer-events-auto origin-center" style={{ transform: `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${transform.scale})` }}>
                            <img 
                                ref={imageRef} 
                                src={sourceImage} 
                                alt="Source" 
                                className={cn(
                                    "max-w-none shadow-[0_0_100px_rgba(0,0,0,0.8)] ring-1 ring-gray-700/50 select-none", 
                                    (isAltPressed || isPanning) ? "cursor-grab" : isHoveringImage ? "cursor-none" : "cursor-default"
                                )} 
                                onMouseEnter={() => setIsHoveringImage(true)} 
                                onMouseLeave={() => setIsHoveringImage(false)} 
                                draggable={false}
                                onDragStart={(e) => e.preventDefault()} // 完全阻止拖拽
                            />
                        </div>
                    </div>
                )}

                {sourceImage && isHoveringImage && !isAltPressed && !isPanning && (
                    <div
                        ref={cursorRef}
                        className={cn(
                            "fixed pointer-events-none border-2 border-teal-400 shadow-[0_0_20px_rgba(45,212,191,0.6)] z-50 mix-blend-difference transition-[border-color,box-shadow,width,height] duration-75",
                            shape === 'circle' ? 'rounded-full' : 'rounded-none',
                            isDrawing && "border-white border-dashed opacity-80"
                        )}
                        style={{
                            // 样式完全由 handleMouseMove 和 useEffect 控制，避免 React 渲染冲突
                            transform: 'none',
                        }}
                    >
                        {/* 实时尺寸提示 */}
                        <div className="absolute bottom-[-24px] left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-black/80 rounded text-[10px] font-mono font-bold text-gray-300 whitespace-nowrap">
                            {cropSize.width}x{cropSize.height}
                        </div>
                        {isDrawing ? (
                            <div className="absolute -top-6 left-0 flex items-center gap-1.5">
                                <div className={cn("text-white px-1.5 py-0.5 rounded-sm text-[9px] font-bold uppercase tracking-tighter", isQuickSlice ? "bg-amber-500" : "bg-teal-500")}>
                                    {isQuickSlice ? "释放提取" : "释放锁定"}
                                </div>
                                <div className="text-[10px] text-white/50 font-mono">
                                    {isQuickSlice ? "快裁模式" : "滑选模式"}
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="absolute top-1/2 left-1/2 w-3 h-0.5 bg-teal-400 -translate-x-1/2 -translate-y-1/2" />
                                <div className="absolute top-1/2 left-1/2 w-0.5 h-3 bg-teal-400 -translate-x-1/2 -translate-y-1/2" />
                            </>
                        )}
                    </div>
                )}

                {sourceImage && (
                    <div className="fixed bottom-6 right-6 bg-gray-900/90 backdrop-blur-xl border border-gray-700 px-4 py-2 rounded-full text-[10px] text-gray-400 flex items-center gap-4 z-50 shadow-2xl select-none pointer-events-none">
                        <div className="flex items-center gap-1.5"><span className="font-mono text-teal-400 font-bold">{(transform.scale * 100).toFixed(0)}%</span><span>视角</span></div>
                        <div className="w-px h-3 bg-gray-700" />
                        <div className="flex items-center gap-1.5"><span className={cn("w-1.5 h-1.5 rounded-full", (isAltPressed || isPanning) ? "bg-blue-500 animate-pulse" : "bg-gray-700")} /><span>{isPanning ? "平移中" : "右键/Alt 拖拽"}</span></div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AssetSlicer;
