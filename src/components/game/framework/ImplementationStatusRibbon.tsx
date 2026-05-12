import React from 'react';
import { CharacterSelectionBadge } from './CharacterSelectionBadge';

const IMPLEMENTATION_BADGE = {
    id: 'under_construction',
    labelKey: 'common:status_tags.under_construction',
    tone: 'warning' as const,
    variant: 'disabled-overlay' as const,
};

export interface ImplementationStatusRibbonProps {
    label: string;
    testId?: string;
    className?: string;
}

export const ImplementationStatusRibbon: React.FC<ImplementationStatusRibbonProps> = ({
    label,
    testId,
    className = 'absolute inset-0 z-40 overflow-hidden pointer-events-none',
}) => (
    <div className={className} data-testid={testId}>
        <CharacterSelectionBadge
            badge={IMPLEMENTATION_BADGE}
            label={label}
            inlineUnit={(value) => `${value}rem`}
            testId={testId ? `${testId}-label` : 'implementation-status-ribbon-label'}
        />
    </div>
);
