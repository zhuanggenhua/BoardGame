export type FeedbackDiagnosticMetadataProjection = {
    source?: 'user' | 'client-auto' | 'server';
    collectionStatus?: 'complete' | 'partial' | 'failed';
    replayability?: 'full' | 'partial' | 'unreplayable';
    missingFields?: string[];
};

export function projectFeedbackDiagnosticMetadata(value: unknown): FeedbackDiagnosticMetadataProjection;
export function projectStoredFeedbackErrorLocation(value: unknown): { bundle: string; line: number; column: number } | undefined;
export function projectFailedFeedbackAsset(value: unknown): {
    path: string;
    observedAt: string;
    responseStatus?: number;
    durationMs?: number;
    transferSize?: number;
    encodedBodySize?: number;
    decodedBodySize?: number;
    timingResponseStartPresent?: boolean;
    online?: boolean;
} | undefined;
