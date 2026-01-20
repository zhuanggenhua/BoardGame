import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Helper to merge classes
function cn(...inputs: (string | undefined | null | false)[]) {
    return twMerge(clsx(inputs));
}

// Icons (SVGs)
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

const ChevronRightIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
);

const GridIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>
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
    // Metadata for sprite sheet regeneration
    srcX: number;
    srcY: number;
    width: number;
    height: number;
    shape: 'circle' | 'square';
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
    const [diameter, setDiameter] = useState<number>(64); // 默认尺寸改为 64x64，更适合图标
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
    const [isHoveringImage, setIsHoveringImage] = useState(false);
    const [isAltPressed, setIsAltPressed] = useState(false);

    // 高级功能状态


    // 引用
    const imageRef = useRef<HTMLImageElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

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

            // 提取尺寸快捷键 (Photoshop 风格: [ 减小, ] 增大)
            if (e.key === '[') {
                updateDiameter(-4);
            }
            if (e.key === ']') {
                updateDiameter(4);
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
    }, [diameter]); // 依赖 diameter 是因为 updateDiameter 闭包问题，虽然这里只用函数式更新

    // 图像缩放逻辑封装 (支持以特定点为中心缩放)
    const handleImageZoom = (deltaY: number, mouseX?: number, mouseY?: number) => {
        setTransform(prev => {
            // 使用指数缩放，并减小灵敏度以获得更平滑的体验
            const zoomIntensity = 0.001;
            const zoomFactor = Math.exp(-deltaY * zoomIntensity);
            const newScale = Math.min(Math.max(0.01, prev.scale * zoomFactor), 50);

            if (mouseX === undefined || mouseY === undefined || !containerRef.current) {
                return { ...prev, scale: newScale };
            }

            const rect = containerRef.current.getBoundingClientRect();
            const cx = mouseX - rect.left;
            const cy = mouseY - rect.top;

            const scaleRatio = newScale / prev.scale;
            const newX = cx - (cx - prev.x) * scaleRatio;
            const newY = cy - (cy - prev.y) * scaleRatio;

            return { x: newX, y: newY, scale: newScale };
        });
    };

    // 提取区域尺寸逻辑封装 (指数增长更丝滑)
    const updateDiameter = (deltaY: number) => {
        setDiameter(prev => {
            const zoomIntensity = 0.001;
            const step = Math.exp(-deltaY * zoomIntensity);
            const next = prev * step;
            // 限制一个合理的增长范围，避免单次滚轮变化过巨
            return Math.max(1, Math.round(next));
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
                updateDiameter(e.deltaY);
            } else {
                // 普通滚轮，缩放视角，以鼠标位置为中心
                handleImageZoom(e.deltaY, e.clientX, e.clientY);
            }
        };

        container.addEventListener('wheel', handleNativeWheel, { passive: false });
        return () => container.removeEventListener('wheel', handleNativeWheel);
    }, [sourceImage]); // 不再依赖 diameter，仅依赖图片状态

    // 文件处理
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) loadFile(file);
    };

    const loadFile = (file: File) => {
        // Revoke old URL to avoid memory leaks
        if (sourceImage) URL.revokeObjectURL(sourceImage);

        const url = URL.createObjectURL(file);
        setSourceImage(url);
        setImageName(file.name.replace(/\.[^/.]+$/, ""));
        setExtractedAssets([]);
        setTransform({ x: 0, y: 0, scale: 1 });
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDraggingFile(false);
        const file = e.dataTransfer.files?.[0];
        if (file && file.type.startsWith('image/')) loadFile(file);
    };



    // 核心功能：提取切片
    const handleExtract = (e: React.MouseEvent) => {
        if (!imageRef.current || isPanning || isAltPressed) return;
        if (Math.abs(panStart.x - e.clientX) > 5 || Math.abs(panStart.y - e.clientY) > 5) return;

        const img = imageRef.current;
        const rect = img.getBoundingClientRect();

        const displayX = e.clientX - rect.left;
        const displayY = e.clientY - rect.top;

        const scaleFactor = img.naturalWidth / rect.width;

        const centerX = displayX * scaleFactor;
        const centerY = displayY * scaleFactor;

        let targetX = centerX - (diameter / 2);
        let targetY = centerY - (diameter / 2);
        let targetW = diameter;
        let targetH = diameter;



        // 生成预览图
        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // 根据形状裁切
        if (shape === 'circle') {
            ctx.beginPath();
            ctx.arc(targetW / 2, targetH / 2, targetW / 2, 0, Math.PI * 2);
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
            shape,
            timestamp: Date.now()
        }]);
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

        console.log(`[AssetSlicer] 正在导出精灵图... 资源数: ${extractedAssets.length}`);

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

    const cursorRef = useRef<HTMLDivElement>(null);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button === 1 || (e.button === 0 && isAltPressed)) {
            e.preventDefault();
            setIsPanning(true);
            setPanStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
        } else if (e.button === 0) {
            setPanStart({ x: e.clientX, y: e.clientY });
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        // 性能优化：移除了实时自动贴边计算，只在点击时触发，避免“乱动”
        if (cursorRef.current && sourceImage) {
            const transformScale = transform.scale;
            // 恢复为固定的光标大小，仅跟随直径
            const currentWidth = diameter * transformScale;
            const currentHeight = diameter * transformScale;

            cursorRef.current.style.width = `${currentWidth}px`;
            cursorRef.current.style.height = `${currentHeight}px`;
            cursorRef.current.style.left = `${e.clientX}px`;
            cursorRef.current.style.top = `${e.clientY}px`;
        }

        if (isPanning) {
            e.preventDefault();
            setTransform(prev => ({ ...prev, x: e.clientX - panStart.x, y: e.clientY - panStart.y }));
        }
    };

    const handleMouseUp = () => { setIsPanning(false); };
    const resetView = () => { setTransform({ x: 0, y: 0, scale: 1 }); };

    const displayedCursorSize = diameter * transform.scale;

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
                    <h1 className="text-2xl font-black bg-gradient-to-r from-teal-400 to-blue-500 bg-clip-text text-transparent truncate cursor-pointer" onClick={resetView}>
                        素材切片机
                    </h1>
                    <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-widest font-bold">Circle & Square Extractor</p>
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
                                <button onClick={() => setShape('square')} className={cn("flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-xs font-bold transition-all", shape === 'square' ? "bg-teal-500 text-white shadow-lg" : "text-gray-400 hover:text-white")}><SquareIcon /> 方形</button>
                                <button onClick={() => setShape('circle')} className={cn("flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-xs font-bold transition-all", shape === 'circle' ? "bg-teal-500 text-white shadow-lg" : "text-gray-400 hover:text-white")}><CircleIcon /> 圆形</button>
                            </div>



                            <div>
                                <div className="flex justify-between items-end mb-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">裁切尺寸</label>
                                    <div className="flex items-center gap-1 group/input">
                                        <input
                                            type="number"
                                            value={diameter}
                                            onChange={(e) => setDiameter(Math.max(1, Number(e.target.value)))}
                                            className="w-16 bg-transparent border-none text-right text-sm text-teal-400 font-mono font-bold p-0 focus:ring-0"
                                        />
                                        <span className="text-xs text-gray-500 font-mono">px</span>
                                    </div>
                                </div>
                                <input
                                    type="range"
                                    min="8"
                                    max="2048"
                                    step="1"
                                    value={diameter > 2048 ? 2048 : diameter}
                                    onChange={(e) => setDiameter(Number(e.target.value))}
                                    className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-teal-500"
                                />
                                <div className="flex justify-between mt-2">
                                    <button onClick={() => updateDiameter(-4)} className="text-[10px] bg-gray-800 hover:bg-gray-700 px-2 py-1 rounded border border-gray-700 font-mono">缩减 [</button>
                                    <button onClick={() => updateDiameter(4)} className="text-[10px] bg-gray-800 hover:bg-gray-700 px-2 py-1 rounded border border-gray-700 font-mono">增大 ]</button>
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

            <div className={cn("flex-1 bg-gray-950 relative overflow-hidden flex items-center justify-center border-l border-gray-800 perspective-1000", isPanning ? "cursor-grabbing" : "cursor-default")} onMouseMove={handleMouseMove} onMouseDown={handleMouseDown} ref={containerRef}>
                {!sourceImage ? (
                    <div className="flex flex-col items-center justify-center p-16 border-2 border-dashed border-gray-800 rounded-[32px] bg-gray-900/20 text-gray-500 pointer-events-none max-w-md w-full select-none">
                        <UploadIcon />
                        <h2 className="mt-6 text-2xl font-black text-gray-300">无图片</h2>
                        <p className="mt-3 text-sm text-center leading-relaxed text-gray-600">更换图片 (Ctrl+V) / 拖入图片</p>
                    </div>
                ) : (
                    <div className="w-full h-full flex items-center justify-center pointer-events-none">
                        <div className="pointer-events-auto origin-center" style={{ transform: `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${transform.scale})` }}>
                            <img ref={imageRef} src={sourceImage} alt="Source" className={cn("max-w-none shadow-[0_0_100px_rgba(0,0,0,0.8)] ring-1 ring-gray-700/50 select-none", (isAltPressed || isPanning) ? "cursor-grab" : isHoveringImage ? "cursor-none" : "cursor-default")} onMouseEnter={() => setIsHoveringImage(true)} onMouseLeave={() => setIsHoveringImage(false)} onClick={handleExtract} draggable={false} />
                        </div>
                    </div>
                )}

                {sourceImage && isHoveringImage && !isAltPressed && !isPanning && (
                    <div ref={cursorRef} className={cn("fixed pointer-events-none border-2 border-teal-400 shadow-[0_0_20px_rgba(45,212,191,0.6)] z-50 mix-blend-difference transition-[border-color,box-shadow] duration-150",
                        shape === 'circle' ? 'rounded-full' : 'rounded-none'
                    )}
                        style={{ width: displayedCursorSize, height: displayedCursorSize, transform: 'translate(-50%, -50%)' }}>
                        <div className="absolute top-1/2 left-1/2 w-3 h-0.5 bg-teal-400 -translate-x-1/2 -translate-y-1/2" />
                        <div className="absolute top-1/2 left-1/2 w-0.5 h-3 bg-teal-400 -translate-x-1/2 -translate-y-1/2" />
                        <div className="absolute bottom-[-24px] left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-black/80 rounded text-[10px] font-mono font-bold text-gray-300 whitespace-nowrap">{diameter}x{diameter}</div>
                    </div>
                )}

                {sourceImage && (
                    <div className="fixed bottom-6 right-6 bg-gray-900/90 backdrop-blur-xl border border-gray-700 px-4 py-2 rounded-full text-[10px] text-gray-400 flex items-center gap-4 z-50 shadow-2xl select-none pointer-events-none">
                        <div className="flex items-center gap-1.5"><span className="font-mono text-teal-400 font-bold">{(transform.scale * 100).toFixed(0)}%</span><span>视角</span></div>
                        <div className="w-px h-3 bg-gray-700" />
                        <div className="flex items-center gap-1.5"><span className={cn("w-1.5 h-1.5 rounded-full", (isAltPressed || isPanning) ? "bg-blue-500 animate-pulse" : "bg-gray-700")} /><span>{isAltPressed ? "平移中" : "Alt 拖拽"}</span></div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AssetSlicer;
