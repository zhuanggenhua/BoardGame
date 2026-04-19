/**
 * 架构可视化 - 缩略图
 * 节点连线图风格的 SVG 缩略图
 */
export default function Thumbnail() {
    return (
        <div className="w-full h-full bg-gradient-to-br from-[#f7f3eb] to-[#ede5d5] flex items-center justify-center overflow-hidden relative">
            <svg viewBox="0 0 120 90" className="w-[85%] h-[85%] opacity-80">
                {/* 连线 */}
                <line x1="30" y1="25" x2="60" y2="45" stroke="#C8B69E" strokeWidth="1.5" />
                <line x1="90" y1="25" x2="60" y2="45" stroke="#C8B69E" strokeWidth="1.5" />
                <line x1="60" y1="45" x2="35" y2="70" stroke="#C8B69E" strokeWidth="1.5" />
                <line x1="60" y1="45" x2="85" y2="70" stroke="#C8B69E" strokeWidth="1.5" />
                {/* 节点 */}
                <circle cx="30" cy="25" r="8" fill="#D4AF37" opacity="0.7" />
                <circle cx="90" cy="25" r="8" fill="#D4AF37" opacity="0.7" />
                <circle cx="60" cy="45" r="10" fill="#4A3B2A" opacity="0.6" />
                <circle cx="35" cy="70" r="7" fill="#C8B69E" opacity="0.8" />
                <circle cx="85" cy="70" r="7" fill="#C8B69E" opacity="0.8" />
                {/* 节点内小圆点 */}
                <circle cx="30" cy="25" r="3" fill="#fff" opacity="0.6" />
                <circle cx="90" cy="25" r="3" fill="#fff" opacity="0.6" />
                <circle cx="60" cy="45" r="4" fill="#fff" opacity="0.5" />
                <circle cx="35" cy="70" r="2.5" fill="#fff" opacity="0.6" />
                <circle cx="85" cy="70" r="2.5" fill="#fff" opacity="0.6" />
            </svg>
            {/* 装饰性网格 */}
            <div className="absolute inset-0 opacity-[0.04]" style={{
                backgroundImage: 'linear-gradient(#4A3B2A 1px, transparent 1px), linear-gradient(90deg, #4A3B2A 1px, transparent 1px)',
                backgroundSize: '16px 16px',
            }} />
        </div>
    );
}
