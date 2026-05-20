import type { CSSProperties, MouseEventHandler, ReactNode } from 'react';
import clsx from 'clsx';

interface HomeV2PaperModalFrameProps {
    title: ReactNode;
    children: ReactNode;
    showHeader?: boolean;
    onClick?: MouseEventHandler<HTMLDivElement>;
    dataTestId?: string;
    dataTextEntryAutoscroll?: 'off';
    surfaceClassName?: string;
    surfaceStyle?: CSSProperties;
    headerClassName?: string;
    titleClassName?: string;
    dividerClassName?: string;
}

const cornerSpecs = {
    topLeft: {
        className: 'left-[6px] top-[6px]',
        outerPath: 'M4 31.5V8.5C4 6 6 4 8.5 4H31.5',
        innerPath: 'M8 27.5V11.5C8 9.7 9.7 8 11.5 8H27.5',
    },
    topRight: {
        className: 'right-[6px] top-[6px]',
        outerPath: 'M34 31.5V8.5C34 6 32 4 29.5 4H6.5',
        innerPath: 'M30 27.5V11.5C30 9.7 28.3 8 26.5 8H10.5',
    },
    bottomLeft: {
        className: 'bottom-[6px] left-[6px]',
        outerPath: 'M4 6.5V29.5C4 32 6 34 8.5 34H31.5',
        innerPath: 'M8 10.5V26.5C8 28.3 9.7 30 11.5 30H27.5',
    },
    bottomRight: {
        className: 'bottom-[6px] right-[6px]',
        outerPath: 'M34 6.5V29.5C34 32 32 34 29.5 34H6.5',
        innerPath: 'M30 10.5V26.5C30 28.3 28.3 30 26.5 30H10.5',
    },
} as const;

const CornerOrnament = ({ position }: { position: keyof typeof cornerSpecs }) => (
    <svg
        aria-hidden="true"
        viewBox="0 0 38 38"
        className={clsx('pointer-events-none absolute h-[16px] w-[16px] text-[#6a3f1d]', cornerSpecs[position].className)}
    >
        <path
            d={cornerSpecs[position].outerPath}
            fill="none"
            stroke="currentColor"
            strokeWidth="0.96"
            strokeLinecap="round"
        />
        <path
            d={cornerSpecs[position].innerPath}
            fill="none"
            stroke="#b98746"
            strokeWidth="0.62"
            strokeLinecap="round"
        />
    </svg>
);

export const HomeV2PaperModalFrame = ({
    title,
    children,
    showHeader = true,
    onClick,
    dataTestId,
    dataTextEntryAutoscroll,
    surfaceClassName,
    surfaceStyle,
    headerClassName,
    titleClassName,
    dividerClassName,
}: HomeV2PaperModalFrameProps) => (
    <div
        className={clsx(
            'home-v2-paper-modal-frame pointer-events-auto relative flex max-w-full flex-col overflow-hidden rounded-[2px] border border-[#563315] text-[#432817]',
            'bg-[#e7cca0]',
            'bg-[radial-gradient(circle_at_50%_12%,rgba(247,226,188,0.88)_0%,rgba(229,199,151,0.95)_58%,rgba(202,158,99,0.98)_100%)]',
            'shadow-[0_14px_26px_rgba(0,0,0,0.44),0_0_0_1px_rgba(246,217,160,0.92)_inset,0_0_0_1px_rgba(107,62,25,0.34)]',
            surfaceClassName,
        )}
        onClick={onClick}
        style={surfaceStyle}
        data-testid={dataTestId}
        data-text-entry-autoscroll={dataTextEntryAutoscroll}
    >
        <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.09] mix-blend-multiply"
            style={{
            backgroundImage: 'url(/assets/common/images/noise.svg)',
            backgroundSize: '74px 74px',
        }}
        />
        <div className="pointer-events-none absolute inset-0 opacity-[0.08] mix-blend-multiply [background-image:radial-gradient(circle_at_23%_28%,rgba(99,58,25,0.07)_0%,transparent_18%),radial-gradient(circle_at_78%_62%,rgba(108,65,30,0.05)_0%,transparent_22%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_43%,rgba(255,240,199,0)_0%,rgba(116,71,32,0.035)_72%,rgba(57,32,13,0.13)_100%)]" />
        <div className="pointer-events-none absolute inset-[3px] rounded-[1px] border border-[#e2b36f]/78" />
        <CornerOrnament position="topLeft" />
        <CornerOrnament position="topRight" />
        <CornerOrnament position="bottomLeft" />
        <CornerOrnament position="bottomRight" />

        {showHeader ? (
            <div className={clsx('relative z-10 shrink-0 px-7 pb-3 pt-6', headerClassName)}>
                <h2 className={clsx('text-center font-bold leading-[1.08] tracking-[0.045em] text-[clamp(22px,1.38vw,28px)] text-[#35200f]', titleClassName)}>
                    {title}
                </h2>
                <div className={clsx('mx-auto mt-4 flex w-[66%] items-center justify-center gap-2', dividerClassName)}>
                    <span className="h-px flex-1 bg-[linear-gradient(90deg,rgba(125,83,45,0)_0%,rgba(125,83,45,0.62)_100%)]" />
                    <span className="h-[7px] w-[7px] rotate-45 border border-[#c39a63] bg-[#a57a43]" />
                    <span className="h-px flex-1 bg-[linear-gradient(90deg,rgba(125,83,45,0.62)_0%,rgba(125,83,45,0)_100%)]" />
                </div>
            </div>
        ) : null}

        {children}
    </div>
);
