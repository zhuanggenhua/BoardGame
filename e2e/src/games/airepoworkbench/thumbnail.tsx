export default function Thumbnail() {
    return (
        <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top_left,#fffaf1_0%,#eadcc7_55%,#d9c2a2_100%)]">
            <div
                className="absolute inset-0 opacity-[0.08]"
                style={{
                    backgroundImage: 'linear-gradient(#5b4630 1px, transparent 1px), linear-gradient(90deg, #5b4630 1px, transparent 1px)',
                    backgroundSize: '16px 16px',
                }}
            />
            <svg viewBox="0 0 120 90" className="h-[86%] w-[86%] opacity-90">
                <rect x="10" y="12" width="100" height="66" rx="10" fill="#fff" stroke="#b89b73" strokeWidth="1.6" />
                <rect x="18" y="20" width="34" height="50" rx="8" fill="#f5efe3" stroke="#c6a977" strokeWidth="1.2" />
                <rect x="22" y="25" width="26" height="9" rx="4.5" fill="#2f4f4f" opacity="0.85" />
                <rect x="22" y="40" width="20" height="5" rx="2.5" fill="#d8b786" />
                <rect x="22" y="49" width="18" height="5" rx="2.5" fill="#d8b786" opacity="0.75" />
                <rect x="22" y="58" width="24" height="5" rx="2.5" fill="#d8b786" opacity="0.55" />
                <path d="M58 31 L72 31" stroke="#b89b73" strokeWidth="1.8" />
                <path d="M72 31 L86 31" stroke="#b89b73" strokeWidth="1.8" />
                <path d="M58 45 L72 45" stroke="#b89b73" strokeWidth="1.8" />
                <path d="M72 45 L86 45" stroke="#b89b73" strokeWidth="1.8" />
                <path d="M58 59 L72 59" stroke="#b89b73" strokeWidth="1.8" />
                <path d="M72 59 L86 59" stroke="#b89b73" strokeWidth="1.8" />
                <circle cx="58" cy="31" r="4.5" fill="#1d4ed8" opacity="0.9" />
                <circle cx="72" cy="31" r="4.5" fill="#0f766e" opacity="0.9" />
                <circle cx="86" cy="31" r="4.5" fill="#eab308" opacity="0.9" />
                <circle cx="58" cy="45" r="4.5" fill="#0f766e" opacity="0.9" />
                <circle cx="72" cy="45" r="4.5" fill="#0284c7" opacity="0.9" />
                <circle cx="86" cy="45" r="4.5" fill="#22c55e" opacity="0.9" />
                <circle cx="58" cy="59" r="4.5" fill="#94a3b8" opacity="0.9" />
                <circle cx="72" cy="59" r="4.5" fill="#16a34a" opacity="0.9" />
                <circle cx="86" cy="59" r="4.5" fill="#f59e0b" opacity="0.9" />
            </svg>
        </div>
    );
}
