import { diagnosticKey } from './typecheck-diagnostics.mjs';

export function validateTypecheckBaseline(baseline, projects, compilerVersion) {
    if (!baseline || baseline.version !== 1 || baseline.compilerVersion !== compilerVersion
        || !baseline.projects || JSON.stringify(Object.keys(baseline.projects)) !== JSON.stringify(projects)) {
        throw new Error('Missing or incompatible reviewed typecheck baseline');
    }
    for (const project of projects) {
        const entries = baseline.projects[project];
        if (!Array.isArray(entries)) throw new Error(`Invalid baseline for ${project}`);
        const keys = new Set();
        for (const entry of entries) {
            if (!entry || typeof entry.file !== 'string' || !entry.file || entry.file.startsWith('../')
                || typeof entry.source !== 'string' || typeof entry.message !== 'string' || !entry.message
                || typeof entry.scope !== 'string' || !/^[a-f0-9]{64}$/.test(entry.scope)
                || !Number.isSafeInteger(entry.code) || entry.code <= 0
                || !Number.isSafeInteger(entry.count) || entry.count <= 0) throw new Error(`Invalid baseline allowance: ${project}`);
            const key = diagnosticKey(entry);
            if (keys.has(key)) throw new Error(`Duplicate baseline allowance: ${project}`);
            keys.add(key);
        }
    }
}
