/** 将作者介绍中的公开网址显示为可点击链接，不解析 HTML。 */
export function ExternalGameText({ text }: { text: string }) {
    return <>{text.split(/(https?:\/\/[^\s，。]+\.[^\s，。]+)/g).map((part, index) => {
        if (!/^https?:\/\//.test(part)) return part;
        try {
            const url = new URL(part);
            if (url.username || url.password) return part;
            return <a key={`${index}-${part}`} className="platform-author-profile-link" href={url.href} target="_blank" rel="noopener noreferrer">{part}</a>;
        } catch { return part; }
    })}</>;
}
