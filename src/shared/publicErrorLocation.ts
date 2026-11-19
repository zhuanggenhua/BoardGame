/** 仅识别当前正式域名及其实际直连入口的构建脚本位置。 */
const PUBLIC_SOURCE = String.raw`(?:https:\/\/easyboardgame\.top|http:\/\/8\.148\.71\.102)\/assets\/[a-zA-Z0-9_.-]{1,180}-([a-zA-Z0-9_-]{8,16})\.js:(\d{1,7}):(\d{1,7})`;
const EXACT_SOURCE = new RegExp(`^${PUBLIC_SOURCE}$`);
const STACK_SOURCE = new RegExp(`(?:^|[\\s(@])(${PUBLIC_SOURCE})(?=$|[\\s)])`, 'm');

export function findPublicErrorSource(stack: string | undefined): string | undefined {
    return stack?.match(STACK_SOURCE)?.[1];
}

export function parsePublicErrorSource(source: string): { bundle: string; line: number; column: number } | undefined {
    const match = EXACT_SOURCE.exec(source);
    return match ? { bundle: match[1], line: Number(match[2]), column: Number(match[3]) } : undefined;
}
