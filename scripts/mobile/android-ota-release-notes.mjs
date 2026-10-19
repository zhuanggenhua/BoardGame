import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const COMMIT_SUBJECT_LIMIT = 5;
const SHA_PATTERN = /^[a-f0-9]{40}$/i;

const cleanSubject = (subject) => subject
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);

export const resolvePreviousAndroidOtaSourceRef = (manifest) => {
    const sourceRef = typeof manifest?.sourceRef === 'string' ? manifest.sourceRef.trim() : '';
    if (SHA_PATTERN.test(sourceRef)) return sourceRef.toLowerCase();

    const notes = typeof manifest?.notes === 'string' ? manifest.notes : '';
    const legacyMatch = notes.match(/\b([a-f0-9]{40})@[a-f0-9]{7}\b/i);
    return legacyMatch?.[1]?.toLowerCase();
};

export const formatAndroidOtaReleaseNotes = ({
    previousRef,
    currentRef,
    subjects,
    maxEntries = COMMIT_SUBJECT_LIMIT,
}) => {
    if (previousRef && previousRef.toLowerCase() === currentRef.toLowerCase()) {
        return '本次为同一代码版本的 OTA 重新发布，源码没有变化。';
    }

    const selectedSubjects = subjects
        .map(cleanSubject)
        .filter(Boolean)
        .slice(0, maxEntries);
    if (selectedSubjects.length === 0) {
        return '本次 OTA 重新发布，未检测到新的代码提交。';
    }

    const lines = selectedSubjects.map((subject) => `- ${subject}`);
    const remainingCount = subjects.filter((subject) => cleanSubject(subject)).length - selectedSubjects.length;
    if (remainingCount > 0) {
        lines.push(`- 另有 ${remainingCount} 项提交。`);
    }

    return lines.join('\n');
};

const readArgValue = (name) => {
    const prefix = `--${name}=`;
    const direct = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
    if (direct) return direct.slice(prefix.length);
    const index = process.argv.slice(2).findIndex((arg) => arg === `--${name}`);
    return index >= 0 ? process.argv[index + 3] || '' : '';
};

const fetchPreviousManifest = async (manifestUrls) => {
    for (const rawUrl of manifestUrls) {
        if (!rawUrl) continue;
        try {
            const url = new URL(rawUrl);
            url.searchParams.set('ota-notes-check', `${Date.now()}-${randomUUID()}`);
            const response = await fetch(url, {
                method: 'GET',
                cache: 'no-store',
                headers: {
                    Accept: 'application/json',
                    'Cache-Control': 'no-cache',
                },
                signal: AbortSignal.timeout(10_000),
            });
            if (!response.ok) continue;
            const manifest = await response.json();
            if (manifest && typeof manifest === 'object') return manifest;
        } catch {
            // The fallback manifest URL is tried next; a missing baseline uses the current commit subjects.
        }
    }
    return undefined;
};

const readCommitSubjects = (currentRef, previousRef) => {
    const isAncestor = (ref) => {
        if (!ref) return false;
        try {
            execFileSync('git', ['merge-base', '--is-ancestor', ref, currentRef], { stdio: 'ignore' });
            return true;
        } catch {
            return false;
        }
    };

    const previousRefIsAncestor = isAncestor(previousRef);
    if (previousRefIsAncestor && previousRef.toLowerCase() === currentRef.toLowerCase()) {
        return { subjects: [], previousRefIsAncestor };
    }

    const range = previousRefIsAncestor ? `${previousRef}..${currentRef}` : currentRef;
    const args = previousRefIsAncestor
        ? ['log', '--no-merges', '--reverse', `--format=%s`, range]
        : ['log', '-5', '--no-merges', '--format=%s', currentRef];
    const output = execFileSync('git', args, { encoding: 'utf8' });
    return {
        subjects: output.split(/\r?\n/).filter(Boolean),
        previousRefIsAncestor,
    };
};

const main = async () => {
    const currentRef = readArgValue('current-ref').trim();
    if (!SHA_PATTERN.test(currentRef)) {
        throw new Error('--current-ref 必须是完整的 40 位 git SHA。');
    }

    const manifestUrls = [
        readArgValue('manifest-url').trim(),
        readArgValue('fallback-manifest-url').trim(),
    ];
    const previousManifest = await fetchPreviousManifest(manifestUrls);
    const previousRef = resolvePreviousAndroidOtaSourceRef(previousManifest);
    if (!previousManifest) {
        console.error('Android OTA 上一版清单不可用；更新说明将根据当前提交生成。');
    }

    const { subjects } = readCommitSubjects(currentRef, previousRef);
    console.log(formatAndroidOtaReleaseNotes({
        previousRef,
        currentRef,
        subjects,
    }));
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    await main();
}
