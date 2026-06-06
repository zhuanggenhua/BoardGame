/**
 * 音效浏览器 - 缩略图
 * 音频波形风格的 SVG 缩略图
 */
export default function Thumbnail() {
    return (
        <div className="w-full h-full bg-gradient-to-br from-[#f7f3eb] to-[#ede5d5] flex items-center justify-center overflow-hidden relative">
            <svg viewBox="0 0 120 90" className="w-[85%] h-[85%] opacity-80">
                {/* 音频波形条 */}
                {[18, 26, 34, 42, 50, 58, 66, 74, 82, 90, 98].map((x, i) => {
                    const heights = [14, 28, 20, 38, 32, 44, 26, 36, 18, 30, 12];
                    const h = heights[i];
                    const y = 45 - h / 2;
                    return (
                        <rect
                            key={x}
                            x={x - 2.5}
                            y={y}
                            width="5"
                            height={h}
                            rx="2.5"
                            fill={i === 5 ? '#D4AF37' : '#4A3B2A'}
                            opacity={i === 5 ? 0.7 : 0.25 + (h / 44) * 0.35}
                        />
                    );
                })}
                {/* 播放指示线 */}
                <line x1="58" y1="18" x2="58" y2="72" stroke="#D4AF37" strokeWidth="0.8" opacity="0.5" />
                {/* 底部时间轴 */}
                <line x1="15" y1="78" x2="105" y2="78" stroke="#C8B69E" strokeWidth="0.8" />
                <circle cx="58" cy="78" r="2.5" fill="#D4AF37" opacity="0.7" />
            </svg>
        </div>
    );
}
