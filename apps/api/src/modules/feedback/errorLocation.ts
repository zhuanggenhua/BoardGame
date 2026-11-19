import { parsePublicErrorSource } from '../../../../../src/shared/publicErrorLocation';
import { projectStoredFeedbackErrorLocation } from '../../../../../src/lib/feedback/diagnosticPacketProjectionPolicy.mjs';

/** 仅保留公开构建资源的指纹与位置，不保留 URL、查询参数或原始堆栈。 */
export interface SafeErrorLocation {
    bundle: string;
    line: number;
    column: number;
}

export function projectSafeErrorLocation(source: unknown, stored: unknown): SafeErrorLocation | undefined {
    if (typeof source === 'string') {
        const location = parsePublicErrorSource(source);
        if (location) return location;
    }
    return projectStoredFeedbackErrorLocation(stored);
}
