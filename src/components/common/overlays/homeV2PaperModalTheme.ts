import clsx from 'clsx';

export const homeV2PaperLabelClassName = 'mb-2 block text-[12px] font-semibold tracking-[0.06em] text-[#3f2616]';
export const homeV2PaperCompactLabelClassName = 'mb-[3px] block text-[7px] font-semibold tracking-[0.035em] text-[#342012]';
export const homeV2PaperHintClassName = 'text-[11px] italic text-[#8a6546]';
export const homeV2PaperCompactHintClassName = 'text-[9px] italic text-[#8a6546]';

export const homeV2PaperInputClassName = clsx(
    'w-full rounded-[2px] border border-[#855a33] bg-[rgba(246,226,188,0.18)]',
    'px-4 py-[11px] text-[14px] leading-[1.28] text-[#3f2616]',
    'shadow-[inset_0_1px_2px_rgba(88,52,20,0.08),inset_0_0_0_1px_rgba(255,236,199,0.20)] transition-colors outline-none',
    'placeholder:text-[#80664d]/78 focus:border-[#5f3a1a] focus:bg-[rgba(245,223,184,0.26)]',
);

export const homeV2PaperCompactInputClassName = clsx(
    'w-full rounded-[2px] border border-[#80552f] bg-[rgba(244,221,181,0.16)]',
    'px-[7px] py-[4.25px] text-[8.4px] leading-[1.12] text-[#342012]',
    'shadow-[inset_0_1px_2px_rgba(88,52,20,0.07),inset_0_0_0_1px_rgba(255,236,199,0.18)] transition-colors outline-none',
    'placeholder:text-[#7d654e]/72 focus:border-[#563516] focus:bg-[rgba(244,221,181,0.24)]',
);

export const homeV2PaperSendCodeButtonClassName = clsx(
    'cursor-pointer rounded-[8px] border border-[#8a6038] bg-[#7d5630]',
    'px-3.5 py-[10px] text-[11px] font-semibold tracking-[0.08em] text-[#f7ead2]',
    'shadow-[0_7px_14px_rgba(68,39,18,0.18)] transition-colors hover:bg-[#694425]',
    'disabled:cursor-not-allowed disabled:opacity-55',
);

export const homeV2PaperCompactSendCodeButtonClassName = clsx(
    'cursor-pointer rounded-[7px] border border-[#8a6038] bg-[#7d5630]',
    'px-2.5 py-[4px] text-[7px] font-semibold tracking-[0.02em] text-[#f7ead2]',
    'shadow-[0_7px_14px_rgba(68,39,18,0.18)] transition-colors hover:bg-[#694425]',
    'disabled:cursor-not-allowed disabled:opacity-55',
);

export const homeV2PaperPrimaryButtonClassName = clsx(
    'cursor-pointer rounded-[1px] border border-[#c19352] bg-[#0d3206]',
    '[clip-path:polygon(0_8px,8px_0,calc(100%-8px)_0,100%_8px,100%_calc(100%-8px),calc(100%-8px)_100%,8px_100%,0_calc(100%-8px))]',
    'px-4 py-[11px] text-[17px] font-bold tracking-[0.24em] text-[#f7f0df]',
    'shadow-[0_7px_13px_rgba(20,35,11,0.30),0_0_0_1px_rgba(12,22,5,0.92)_inset,0_0_0_2px_rgba(217,169,82,0.42),inset_0_1px_0_rgba(255,244,190,0.18)] transition-colors',
    'hover:bg-[#113008] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-65',
);

export const homeV2PaperCompactPrimaryButtonClassName = clsx(
    'cursor-pointer rounded-[1px] border border-[#c19352] bg-[#0d3206]',
    '[clip-path:polygon(0_5px,5px_0,calc(100%-5px)_0,100%_5px,100%_calc(100%-5px),calc(100%-5px)_100%,5px_100%,0_calc(100%-5px))]',
    'px-3 py-[3.65px] text-[8.2px] font-bold tracking-[0.17em] text-[#f7f0df]',
    'shadow-[0_6px_11px_rgba(20,35,11,0.30),0_0_0_1px_rgba(12,22,5,0.92)_inset,0_0_0_2px_rgba(217,169,82,0.38),inset_0_1px_0_rgba(255,244,190,0.18)] transition-colors',
    'hover:bg-[#113008] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-65',
);

export const homeV2PaperDangerPrimaryButtonClassName = clsx(
    'cursor-pointer rounded-[3px] border border-[#a16f43]/76',
    'bg-[linear-gradient(180deg,rgba(98,56,31,0.98)_0%,rgba(71,40,22,1)_100%)]',
    'px-4 py-[11px] text-[15px] font-bold tracking-[0.12em] text-[#f3e0bf]',
    'shadow-[0_8px_14px_rgba(50,29,16,0.18),inset_0_1px_0_rgba(255,240,206,0.16)] transition-colors',
    'hover:bg-[linear-gradient(180deg,rgba(108,61,33,0.98)_0%,rgba(76,43,23,1)_100%)]',
    'disabled:cursor-not-allowed disabled:opacity-65',
);

export const homeV2PaperCompactDangerPrimaryButtonClassName = clsx(
    'cursor-pointer rounded-[3px] border border-[#a16f43]/76',
    'bg-[linear-gradient(180deg,rgba(98,56,31,0.98)_0%,rgba(71,40,22,1)_100%)]',
    'px-[8px] py-[4px] text-[7.8px] font-bold tracking-[0.08em] text-[#f3e0bf]',
    'shadow-[0_8px_14px_rgba(50,29,16,0.18),inset_0_1px_0_rgba(255,240,206,0.16)] transition-colors',
    'hover:bg-[linear-gradient(180deg,rgba(108,61,33,0.98)_0%,rgba(76,43,23,1)_100%)]',
    'disabled:cursor-not-allowed disabled:opacity-65',
);

export const homeV2PaperSecondaryButtonClassName = clsx(
    'cursor-pointer rounded-[4px] border border-[#a67845] bg-[rgba(246,230,199,0.44)]',
    'px-4 py-[11px] text-[14px] font-semibold text-[#4c2e1a] transition-colors hover:bg-[rgba(240,212,164,0.70)]',
    'disabled:cursor-not-allowed disabled:opacity-55',
);

export const homeV2PaperCompactSecondaryButtonClassName = clsx(
    'cursor-pointer rounded-[3px] border border-[#a67845] bg-[rgba(246,230,199,0.46)]',
    'px-3 py-[3.25px] text-[7.6px] font-semibold text-[#4c2e1a] transition-colors hover:bg-[rgba(240,212,164,0.72)]',
    'disabled:cursor-not-allowed disabled:opacity-55',
);

export const homeV2PaperTextButtonClassName = 'text-[12px] font-semibold text-[#6d4a31] transition-colors hover:text-[#3f2616]';
export const homeV2PaperCompactTextButtonClassName = 'text-[7.2px] font-semibold text-[#6d4a31] transition-colors hover:text-[#3f2616]';

export const getHomeV2PaperFooterTabClassName = (active: boolean) => clsx(
    'group relative cursor-pointer px-1 py-1 transition-colors',
    active ? 'font-bold text-[#433422]' : 'text-[#8c7b64] hover:text-[#433422]',
);
