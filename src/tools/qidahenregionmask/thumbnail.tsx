export default function Thumbnail() {
    return (
        <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-[#20150d]">
            <div
                className="absolute inset-0 opacity-80"
                style={{
                    background:
                        'radial-gradient(circle at 30% 20%, rgba(210,183,117,0.32), transparent 34%), linear-gradient(135deg, #2d1b10 0%, #6f3a24 52%, #1e1510 100%)',
                }}
            />
            <svg viewBox="0 0 120 90" className="relative h-[88%] w-[88%]">
                <path
                    d="M18 58 C28 28 50 18 70 30 C82 38 98 36 104 51 C94 66 76 71 57 65 C42 60 31 70 18 58 Z"
                    fill="#d8bd76"
                    opacity="0.78"
                />
                <path
                    d="M27 55 C38 42 47 36 62 40 C75 44 82 43 95 51"
                    fill="none"
                    stroke="#8f2f23"
                    strokeWidth="4"
                    strokeLinecap="round"
                />
                <path
                    d="M40 63 L48 48 L61 58 L72 39 L84 58"
                    fill="none"
                    stroke="#23170e"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity="0.72"
                />
                <circle cx="62" cy="40" r="4" fill="#9f3426" />
                <circle cx="95" cy="51" r="4" fill="#9f3426" />
                <rect x="14" y="14" width="92" height="62" fill="none" stroke="#ead7a7" strokeWidth="1.5" opacity="0.42" />
            </svg>
        </div>
    );
}
