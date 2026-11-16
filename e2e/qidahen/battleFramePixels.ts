/** 只判断结果区域是否出现新亮色笔画；具体文字仍由领域断言和原图审查确认。 */
export function countNewResultInk(current: Uint8Array, baseline: Uint8Array): number {
    if (current.length !== baseline.length || current.length % 3 !== 0) throw new Error('战斗帧区域尺寸不一致');
    let count = 0;
    for (let index = 0; index < current.length; index += 3) {
        const [r, g, b] = [current[index], current[index + 1], current[index + 2]];
        const [br, bg, bb] = [baseline[index], baseline[index + 1], baseline[index + 2]];
        if (r >= 200 && g >= 180 && b >= 140 && r - b < 90
            && Math.abs(r - br) + Math.abs(g - bg) + Math.abs(b - bb) >= 90) count++;
    }
    return count;
}
