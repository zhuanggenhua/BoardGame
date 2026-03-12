import type { ReactNode } from 'react';

interface MobileBoardShellProps {
    children: ReactNode;
    topRail?: ReactNode;
    sideDock?: ReactNode;
    bottomRail?: ReactNode;
}

export const MobileBoardShell = ({
    children,
    topRail,
    sideDock,
    bottomRail,
}: MobileBoardShellProps) => (
    <div className="mobile-board-shell">
        {topRail ? (
            <div className="mobile-board-shell__top-rail">
                {topRail}
            </div>
        ) : null}

        <div className="mobile-board-shell__canvas">
            {children}
        </div>

        {sideDock ? (
            <div className="mobile-board-shell__side-dock">
                {sideDock}
            </div>
        ) : null}

        {bottomRail ? (
            <div className="mobile-board-shell__bottom-rail">
                {bottomRail}
            </div>
        ) : null}
    </div>
);

export type { MobileBoardShellProps };
