/**
 * 通用 Fullscreen Quad Vertex Shader
 *
 * 输入：aPosition — clip space 坐标 (-1 ~ +1)
 * 输出：vUv       — 标准化纹理坐标 (0 ~ 1)
 *
 * 配合 TRIANGLE_STRIP 4 顶点：(-1,-1), (1,-1), (-1,1), (1,1)
 */
export const COMMON_VERT = /* glsl */ `
attribute vec2 aPosition;
varying vec2 vUv;

void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;
