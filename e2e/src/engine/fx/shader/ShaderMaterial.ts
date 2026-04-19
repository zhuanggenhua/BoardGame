/**
 * ShaderMaterial — WebGL shader 编译与 uniform 管理
 *
 * 提供三个核心函数：
 * - compileShader  — 编译单个 vertex/fragment shader
 * - createProgram  — 编译并链接 program（链接后自动释放 shader 对象）
 * - setUniforms    — 根据值类型自动选择 gl.uniform* 调用（带 location 缓存）
 */

import type { UniformValue } from './types';

// ============================================================================
// Shader 编译
// ============================================================================

/** 编译单个 shader（返回 null 表示失败，错误输出到 console） */
export function compileShader(
  gl: WebGLRenderingContext,
  source: string,
  type: number,
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const label = type === gl.VERTEX_SHADER ? 'Vertex' : 'Fragment';
    console.error(
      `[ShaderMaterial] ${label} shader compilation failed:\n`,
      gl.getShaderInfoLog(shader),
    );
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

// ============================================================================
// Program 链接
// ============================================================================

/** 编译并链接 shader program */
export function createProgram(
  gl: WebGLRenderingContext,
  vertSrc: string,
  fragSrc: string,
): WebGLProgram | null {
  const vert = compileShader(gl, vertSrc, gl.VERTEX_SHADER);
  const frag = compileShader(gl, fragSrc, gl.FRAGMENT_SHADER);
  if (!vert || !frag) {
    if (vert) gl.deleteShader(vert);
    if (frag) gl.deleteShader(frag);
    return null;
  }

  const program = gl.createProgram();
  if (!program) return null;

  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(
      '[ShaderMaterial] Program link failed:\n',
      gl.getProgramInfoLog(program),
    );
    gl.deleteProgram(program);
    gl.deleteShader(vert);
    gl.deleteShader(frag);
    return null;
  }

  // 链接成功后 shader 对象可释放（program 保持引用）
  gl.deleteShader(vert);
  gl.deleteShader(frag);

  return program;
}

// ============================================================================
// Uniform 设置
// ============================================================================

/** uniform location 缓存（避免每帧重复查询） */
const locationCache = new WeakMap<
  WebGLProgram,
  Map<string, WebGLUniformLocation | null>
>();

function getLocation(
  gl: WebGLRenderingContext,
  program: WebGLProgram,
  name: string,
): WebGLUniformLocation | null {
  let cache = locationCache.get(program);
  if (!cache) {
    cache = new Map();
    locationCache.set(program, cache);
  }
  if (cache.has(name)) return cache.get(name)!;
  const loc = gl.getUniformLocation(program, name);
  cache.set(name, loc);
  return loc;
}

/**
 * 根据值类型自动选择 gl.uniform* 调用
 *
 * - number          → uniform1f
 * - [x, y]          → uniform2f
 * - [r, g, b]       → uniform3f
 * - [r, g, b, a]    → uniform4f
 */
export function setUniforms(
  gl: WebGLRenderingContext,
  program: WebGLProgram,
  uniforms: Record<string, UniformValue>,
): void {
  for (const [name, value] of Object.entries(uniforms)) {
    const loc = getLocation(gl, program, name);
    if (!loc) continue;

    if (typeof value === 'number') {
      gl.uniform1f(loc, value);
    } else if (Array.isArray(value)) {
      switch (value.length) {
        case 2: gl.uniform2f(loc, value[0], value[1]); break;
        case 3: gl.uniform3f(loc, value[0], value[1], value[2]); break;
        case 4: gl.uniform4f(loc, value[0], value[1], value[2], value[3]); break;
      }
    }
  }
}
