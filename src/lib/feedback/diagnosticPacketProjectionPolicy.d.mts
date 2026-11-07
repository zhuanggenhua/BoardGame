export type FeedbackDiagnosticMetadataProjection = {
    source?: 'user' | 'client-auto' | 'server';
    collectionStatus?: 'complete' | 'partial' | 'failed';
    replayability?: 'full' | 'partial' | 'unreplayable';
    missingFields?: string[];
};

export function projectFeedbackDiagnosticMetadata(value: unknown): FeedbackDiagnosticMetadataProjection;
