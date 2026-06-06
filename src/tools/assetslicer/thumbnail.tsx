/**
 * 素材切片机 - 缩略图
 * 裁切网格 + 剪刀风格的 SVG 缩略图
 */
export default function Thumbnail() {
    return (
        <div className="w-full h-full bg-gradient-to-br from-[#f7f3eb] to-[#ede5d5] flex items-center justify-center overflow-hidden relative">
            <svg viewBox="0 0 120 90" className="w-[85%] h-[85%] opacity-80">
                {/* 裁切网格 */}
                <rect x="20" y="15" width="80" height="60" rx="3" fill="none" stroke="#C8B69E" strokeWidth="1.2" strokeDasharray="4 2" />
                <line x1="46" y1="15" x2="46" y2="75" stroke="#D4AF37" strokeWidth="0.8" strokeDasharray="3 2" />
                <line x1="72" y1="15" x2="72" y2="75" stroke="#D4AF37" strokeWidth="0.8" strokeDasharray="3 2" />
                <line x1="20" y1="35" x2="100" y2="35" stroke="#D4AF37" strokeWidth="0.8" strokeDasharray="3 2" />
                <line x1="20" y1="55" x2="100" y2="55" stroke="#D4AF37" strokeWidth="0.8" strokeDasharray="3 2" />
                {/* 高亮选区 */}
                <rect x="46" y="35" width="26" height="20" fill="#D4AF37" opacity="0.15" />
                <rect x="46" y="35" width="26" height="20" fill="none" stroke="#4A3B2A" strokeWidth="1.2" />
                {/* 角标记 */}
                <path d="M44 33 L46 35 L48 33" fill="none" stroke="#4A3B2A" strokeWidth="1" />
                <path d="M70 33 L72 35 L74 33" fill="none" stroke="#4A3B2A" strokeWidth="1" />
                <path d="M44 57 L46 55 L48 57" fill="none" stroke="#4A3B2A" strokeWidth="1" />
                <path d="M70 57 L72 55 L74 57" fill="none" stroke="#4A3B2A" strokeWidth="1" />
            </svg>
        </div>
    );
}
