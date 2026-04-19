/**
 * UGC 原型制作器 - 缩略图
 * 卡牌拼装风格的 SVG 缩略图
 */
export default function Thumbnail() {
    return (
        <div className="w-full h-full bg-gradient-to-br from-[#f7f3eb] to-[#ede5d5] flex items-center justify-center overflow-hidden relative">
            <svg viewBox="0 0 120 90" className="w-[85%] h-[85%] opacity-80">
                {/* 底层卡牌（偏移） */}
                <rect x="38" y="12" width="32" height="44" rx="3" fill="#C8B69E" opacity="0.3" transform="rotate(-8 54 34)" />
                {/* 中层卡牌 */}
                <rect x="44" y="10" width="32" height="44" rx="3" fill="#fff" stroke="#C8B69E" strokeWidth="1" opacity="0.7" />
                <rect x="48" y="16" width="24" height="14" rx="1.5" fill="#ede5d5" />
                <line x1="48" y1="35" x2="72" y2="35" stroke="#C8B69E" strokeWidth="0.8" />
                <line x1="48" y1="39" x2="66" y2="39" stroke="#C8B69E" strokeWidth="0.6" opacity="0.5" />
                <line x1="48" y1="43" x2="62" y2="43" stroke="#C8B69E" strokeWidth="0.6" opacity="0.3" />
                {/* 拼图块 */}
                <g transform="translate(18, 55)">
                    <rect width="22" height="22" rx="3" fill="none" stroke="#D4AF37" strokeWidth="1.2" strokeDasharray="3 2" />
                    <text x="11" y="15" textAnchor="middle" fontSize="10" fill="#D4AF37" opacity="0.7">+</text>
                </g>
                {/* 齿轮 */}
                <g transform="translate(82, 58)" opacity="0.4">
                    <circle cx="8" cy="8" r="6" fill="none" stroke="#4A3B2A" strokeWidth="1.2" />
                    <circle cx="8" cy="8" r="2.5" fill="#4A3B2A" opacity="0.3" />
                    {[0, 60, 120, 180, 240, 300].map((angle) => {
                        const rad = (angle * Math.PI) / 180;
                        return (
                            <line
                                key={angle}
                                x1={8 + Math.cos(rad) * 5}
                                y1={8 + Math.sin(rad) * 5}
                                x2={8 + Math.cos(rad) * 8.5}
                                y2={8 + Math.sin(rad) * 8.5}
                                stroke="#4A3B2A"
                                strokeWidth="2"
                                strokeLinecap="round"
                            />
                        );
                    })}
                </g>
            </svg>
        </div>
    );
}
