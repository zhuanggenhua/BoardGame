import React from 'react';

export type QidahenStatReadoutItem = {
    testId: string;
    label: string;
    value: string;
};

export type QidahenStatReadoutTone = {
    label: string;
    value: string;
};

interface QidahenStatReadoutProps {
    items: QidahenStatReadoutItem[];
    tone: QidahenStatReadoutTone;
    testId?: string;
    size?: 'panel' | 'tip';
}

const SIZE = {
    panel: { label: 11, value: 22, gap: 22 },
    tip: { label: 10, value: 18, gap: 16 },
} as const;

export const QidahenStatReadout: React.FC<QidahenStatReadoutProps> = ({
    items,
    tone,
    testId,
    size = 'panel',
}) => {
    if (items.length === 0) {
        return null;
    }

    const metrics = SIZE[size];
    return (
        <div
            className="flex flex-wrap items-end"
            data-testid={testId}
            style={{ columnGap: metrics.gap, rowGap: 10 }}
        >
            {items.map((item) => (
                <div key={item.testId} className="min-w-0" data-testid={item.testId}>
                    <div
                        className="font-semibold tracking-[0.18em]"
                        data-testid={`${item.testId}-label`}
                        style={{
                            color: tone.label,
                            fontSize: metrics.label,
                            lineHeight: 1,
                        }}
                    >
                        {item.label}
                    </div>
                    <div
                        className="mt-1 font-black tabular-nums leading-none"
                        data-testid={`${item.testId}-value`}
                        style={{
                            color: tone.value,
                            fontSize: metrics.value,
                        }}
                    >
                        {item.value}
                    </div>
                </div>
            ))}
        </div>
    );
};
