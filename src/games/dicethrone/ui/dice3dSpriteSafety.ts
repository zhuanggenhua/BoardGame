export const isCanvasSafeSpriteCandidate = (url: string) => {
    if (!url) return false;
    if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('/')) {
        return true;
    }
    if (typeof window === 'undefined') {
        return !/^https?:\/\//i.test(url);
    }
    try {
        return new URL(url, window.location.href).origin === window.location.origin;
    } catch {
        return false;
    }
};

export const prioritizeWebglSpriteCandidates = (candidateUrls: string[]) => (
    candidateUrls.filter((candidateUrl, index, list) => (
        isCanvasSafeSpriteCandidate(candidateUrl)
        && list.indexOf(candidateUrl) === index
    ))
);
