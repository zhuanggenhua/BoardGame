/**
 * 特效预览 - 缩略图
 * 粒子爆发风格的 SVG 缩略图
 */
export default function Thumbnail() {
    return (
        <div className="w-full h-full bg-gradient-to-br from-[#f7f3eb] to-[#ede5d5] flex items-center justify-center overflow-hidden relative">
            <svg viewBox="0 0 120 90" className="w-[85%] h-[85%] opacity-80">
                {/* 中心爆发 */}
                <circle cx="60" cy="45" r="8" fill="#D4AF37" opacity="0.3" />
                <circle cx="60" cy="45" r="4" fill="#D4AF37" opacity="0.6" />
                {/* 射线 */}
                {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => {
                    const rad = (angle * Math.PI) / 180;
                    const x2 = 60 + Math.cos(rad) * 30;
                    const y2 = 45 + Math.sin(rad) * 22;
                    return (
                        <line
                            key={angle}
                            x1={60 + Math.cos(rad) * 10}
                            y1={45 + Math.sin(rad) * 8}
                            x2={x2}
                            y2={y2}
                            stroke="#4A3B2A"
                            strokeWidth="1"
                            opacity={0.2 + (angle % 90 === 0 ? 0.2 : 0)}
                        />
                    );
                })}
                {/* 散落粒子 */}
                {[
                    [35, 22, 2.5], [88, 30, 2], [28, 62, 1.8], [92, 65, 2.2],
                    [48, 18, 1.5], [75, 72, 1.8], [20, 40, 1.2], [100, 48, 1.5],
                    [42, 70, 2], [78, 20, 1.6],
                ].map(([cx, cy, r], i) => (
                    <circle
                        key={i}
                        cx={cx}
                        cy={cy}
                        r={r}
                        fill={i % 3 === 0 ? '#D4AF37' : '#4A3B2A'}
                        opacity={0.2 + (r as number) * 0.12}
                    />
                ))}
                {/* 外圈虚线 */}
                <circle cx="60" cy="45" r="28" fill="none" stroke="#C8B69E" strokeWidth="0.8" strokeDasharray="3 4" opacity="0.5" />
            </svg>
        </div>
    );
}
