/** Shared GPU handles for a fullscreen WebGL triangle-quad shader pass. */
export interface GlFullscreenCore {
  readonly gl: WebGLRenderingContext;
  readonly program: WebGLProgram;
  readonly vs: WebGLShader;
  readonly fs: WebGLShader;
  readonly buffer: WebGLBuffer | null;
  readonly aPos: number;
}

/** Vertex count for the fullscreen two-triangle clip-space quad. */
export const FULLSCREEN_QUAD_VERTS = 6;

const FULLSCREEN_QUAD_POSITIONS = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);

/** Acquires a low-power premultiplied-alpha WebGL1 context, or returns null when unavailable. */
export function createSmokeGlContext(canvas: HTMLCanvasElement): WebGLRenderingContext | null {
  try {
    const gl = canvas.getContext('webgl', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
      powerPreference: 'low-power',
    });
    return gl && !gl.isContextLost() ? gl : null;
  } catch {
    return null;
  }
}

/** Compiles one WebGL vertex or fragment shader and cleans up automatically on compile error. */
export function compileSmokeShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) {
    return null;
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function linkSmokeProgram(
  gl: WebGLRenderingContext,
  vs: WebGLShader,
  fs: WebGLShader,
): WebGLProgram | null {
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return null;
  }
  return program;
}

/** Compiles, links, and binds a fullscreen quad WebGL program on `canvas`. */
export function createFullscreenSmokeProgram(
  canvas: HTMLCanvasElement,
  vertexSrc: string,
  fragmentSrc: string,
): GlFullscreenCore | null {
  const gl = createSmokeGlContext(canvas);
  if (!gl) {
    return null;
  }
  const vs = compileSmokeShader(gl, gl.VERTEX_SHADER, vertexSrc);
  if (!vs) {
    return null;
  }
  const fs = compileSmokeShader(gl, gl.FRAGMENT_SHADER, fragmentSrc);
  if (!fs) {
    gl.deleteShader(vs);
    return null;
  }
  const program = linkSmokeProgram(gl, vs, fs);
  if (!program) {
    return null;
  }
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, FULLSCREEN_QUAD_POSITIONS, gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(program, 'a_pos');
  gl.useProgram(program);
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  gl.clearColor(0, 0, 0, 0);
  return { gl, program, vs, fs, buffer, aPos };
}

/** Releases all WebGL buffers, shaders, and program handles when the context is still live. */
export function disposeFullscreenSmokeProgram(core: GlFullscreenCore): void {
  const { gl, aPos, buffer, program, vs, fs } = core;
  if (gl.isContextLost()) {
    return;
  }
  gl.disableVertexAttribArray(aPos);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  if (buffer) {
    gl.deleteBuffer(buffer);
  }
  gl.useProgram(null);
  gl.deleteProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
}
