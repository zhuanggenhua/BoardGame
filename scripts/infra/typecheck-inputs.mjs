export function isTypecheckInfrastructureFile(file) {
    return file === 'scripts/infra/run-changed-quality-gate.mjs'
        || /^scripts\/infra\/typecheck[^/]*\.(?:mjs|json)$/.test(file)
        || /^scripts\/infra\/__tests__\/typecheck[^/]*\.test\.mjs$/.test(file);
}
