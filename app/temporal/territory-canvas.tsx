'use client';
import {useEffect, useRef, type RefObject} from 'react';
import type {AtlasPlan} from './atlas';
import type {PlaybackClock} from './use-playback';
import {displayName,colorKey} from './chronology';
import {AtlasTextures} from './atlas-textures';

const vertex = `#version 300 es
void main() {
  vec2 p = gl_VertexID == 0 ? vec2(-1., -1.) : gl_VertexID == 1 ? vec2(3., -1.) : vec2(-1., 3.);
  gl_Position = vec4(p, 0., 1.);
}`;
const fragment = `#version 300 es
precision highp float;
precision highp usampler2D;
uniform usampler2D uOwners;
uniform usampler2D uTiming;
uniform sampler2D uPalette;
uniform vec2 uResolution;
uniform vec4 uView;
uniform vec2 uRotation;
uniform float uZoom;
uniform float uPhase;
uniform bool uGlobe;
uniform bool uDark;
out vec4 outputColor;
const float PI = 3.141592653589793;
void main() {
  vec2 screen = vec2(gl_FragCoord.x / uResolution.x, 1. - gl_FragCoord.y / uResolution.y);
  vec2 world = uView.xy + screen * uView.zw;
  vec2 coordinate;
  if (uGlobe) {
    vec2 q = (world - vec2(450., 225.)) / (205. * uZoom); q.y = -q.y;
    float radius = dot(q, q); if (radius > 1.) discard;
    float front = sqrt(max(0., 1. - radius));
    float cp = cos(uRotation.y), sp = sin(uRotation.y);
    coordinate = vec2(atan(q.x, front * cp + q.y * sp) - uRotation.x, asin(clamp(q.y * cp - front * sp, -1., 1.))) * 180. / PI;
  } else coordinate = vec2(world.x / 2.5 - 180., 90. - world.y / 2.5);
  if (abs(coordinate.y) > 90.) discard;
  ivec2 size = textureSize(uOwners, 0);
  vec2 p = vec2(fract((coordinate.x + 180.) / 360.), (90. - coordinate.y) / 180.) * vec2(size) - .5;
  ivec2 base = ivec2(floor(p)); vec2 f = fract(p);
  uint ids[8]; float votes[8];
  for (int k = 0; k < 4; k++) {
    int dx = k % 2, dy = k / 2;
    ivec2 cell = ivec2((base.x + dx + size.x) % size.x, clamp(base.y + dy, 0, size.y - 1));
    uvec2 owners = texelFetch(uOwners, cell, 0).rg;
    float incoming = 0.;
    if (owners.x != owners.y) {
      vec2 timing = vec2(texelFetch(uTiming, cell, 0).rg) / 65535.;
      incoming = uPhase <= 0. ? 0. : uPhase >= 1. ? 1. : clamp(.5 + (uPhase - timing.x) / max(timing.y, 1. / 65535.), 0., 1.);
    }
    float weight = (dx == 0 ? 1. - f.x : f.x) * (dy == 0 ? 1. - f.y : f.y);
    ids[k * 2] = owners.x; ids[k * 2 + 1] = owners.y;
    votes[k * 2] = weight * (1. - incoming); votes[k * 2 + 1] = weight * incoming;
  }
  float best = -1., runner = 0.; uint winner = uint(0);
  if (ids[0] == ids[2] && ids[0] == ids[4] && ids[0] == ids[6] && ids[1] == ids[3] && ids[1] == ids[5] && ids[1] == ids[7]) {
    float incoming = votes[1] + votes[3] + votes[5] + votes[7];
    winner = incoming > .5 ? ids[1] : ids[0];
    best = ids[0] == ids[1] ? 1. : max(incoming, 1. - incoming);
    runner = ids[0] == ids[1] ? 0. : min(incoming, 1. - incoming);
  } else for (int k = 0; k < 8; k++) {
    bool duplicate = false;
    for (int j = 0; j < 8; j++) if (j < k && ids[j] == ids[k]) duplicate = true;
    if (duplicate) continue;
    float score = 0.;
    for (int j = 0; j < 8; j++) if (ids[j] == ids[k]) score += votes[j];
    if (score > best) {runner = best; best = score; winner = ids[k];} else runner = max(runner, score);
  }
  vec4 color = texelFetch(uPalette, ivec2(int(winner) % 64, int(winner) / 64), 0);
  float difference = best - runner;
  float edge = 1. - smoothstep(0., max(fwidth(difference) * .85, .002), difference);
  color.rgb = mix(color.rgb, uDark ? vec3(.93, .97, .93) : vec3(.17, .28, .29), edge * .65);
  outputColor = color;
}`;

function rgb(name: string): [number, number, number] {
  let hash = 0; for (const ch of colorKey(name)) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  const hue = Math.abs(hash) % 360 / 60, chroma = (1 - Math.abs(2 * .62 - 1)) * .46, x = chroma * (1 - Math.abs(hue % 2 - 1)), m = .62 - chroma / 2;
  const c = hue < 1 ? [chroma, x, 0] : hue < 2 ? [x, chroma, 0] : hue < 3 ? [0, chroma, x] : hue < 4 ? [0, x, chroma] : hue < 5 ? [x, 0, chroma] : [chroma, 0, x];
  return c.map(v => Math.round((v + m) * 255)) as [number, number, number];
}
type Props = {plan: AtlasPlan; names: string[]; clock: RefObject<PlaybackClock>; view: readonly number[]; rotation: [number, number]; zoom: number; mode: 'flat' | 'globe'; selected: string | null; query: string; dark: boolean; onError: (error: string) => void};
export default function TerritoryCanvas(props: Props) {
  const canvas = useRef<HTMLCanvasElement>(null), current = useRef(props);
  useEffect(() => {current.current = props;});
  useEffect(() => {
    const element = canvas.current!;
    const gl = element.getContext('webgl2', {alpha: true, antialias: false, premultipliedAlpha: false, powerPreference: 'low-power'});
    if (!gl) {current.current.onError('Smooth boundaries require WebGL 2. Enable hardware acceleration and reload.'); return;}
    function compile(type: number, code: string) {
      const shader = gl!.createShader(type)!; gl!.shaderSource(shader, code); gl!.compileShader(shader);
      if (!gl!.getShaderParameter(shader, gl!.COMPILE_STATUS)) {const error = gl!.getShaderInfoLog(shader); gl!.deleteShader(shader); throw new Error(error ?? 'Boundary shader failed');}
      return shader;
    }
    let program: WebGLProgram;
    try {
      const vs = compile(gl.VERTEX_SHADER, vertex), fs = compile(gl.FRAGMENT_SHADER, fragment);
      program = gl.createProgram()!; gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program); gl.deleteShader(vs); gl.deleteShader(fs);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? 'Boundary renderer failed');
    } catch (e) {current.current.onError(String(e)); return;}
    gl.useProgram(program);
    const uniforms = Object.fromEntries(['uOwners', 'uTiming', 'uPalette', 'uResolution', 'uView', 'uRotation', 'uZoom', 'uPhase', 'uGlobe', 'uDark'].map(n => [n, gl.getUniformLocation(program, n)]));
    const paletteTexture = [2].map(unit => {
      const t = gl.createTexture()!; gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t;
    });
    gl.uniform1i(uniforms.uOwners, 0); gl.uniform1i(uniforms.uTiming, 1); gl.uniform1i(uniforms.uPalette, 2);
    const atlasTextures = new AtlasTextures(gl);
    let frame = 0, loaded: AtlasPlan | undefined, paletteKey = '', paletteNames: string[] | undefined, lastDraw = '', dirty = true, measuredFrames = 0, measuredAt = 0, previousFrame = 0;
    const resize = new ResizeObserver(() => {dirty = true;}); resize.observe(element);
    const lost = (e: Event) => {e.preventDefault(); cancelAnimationFrame(frame); current.current.onError('The graphics context was interrupted. Reload to restore the map.');};
    element.addEventListener('webglcontextlost', lost);
    const draw = (now: number) => {
      const p = current.current;
      if (now - previousFrame > 150) {measuredAt = now; measuredFrames = 0;}
      previousFrame = now;
      if (loaded !== p.plan) {
        atlasTextures.bind(p.plan);
        element.dataset.uploads = String(atlasTextures.uploads);
        loaded = p.plan; dirty = true;
      }
      const nextKey = JSON.stringify([p.selected, p.query, p.dark, p.clock.current.year < -27]);
      if (paletteKey !== nextKey || paletteNames !== p.names) {
        const palette = new Uint8Array(64 * 64 * 4), query = p.query.trim().toLocaleLowerCase();
        p.names.forEach((rawName, i) => {if (!i) return; const name = displayName(rawName, p.clock.current.year); palette.set(rgb(name), i * 4); palette[i * 4 + 3] = (p.selected === name || (query && name.toLocaleLowerCase().includes(query))) ? 255 : query ? 30 : p.dark ? 225 : 210;});
        gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, paletteTexture[0]); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 64, 64, 0, gl.RGBA, gl.UNSIGNED_BYTE, palette);
        paletteKey = nextKey; paletteNames = p.names; dirty = true;
      }
      const year = Math.max(p.plan.start, Math.min(p.plan.end, p.clock.current.year));
      const key = `${year}:${p.view}:${p.rotation}:${p.zoom}:${p.mode}`;
      if (dirty || key !== lastDraw) {
        const rect = element.getBoundingClientRect(), ratio = Math.min(window.devicePixelRatio || 1, 1.5);
        const width = Math.max(1, Math.round(rect.width * ratio)), height = Math.max(1, Math.round(rect.height * ratio));
        if (element.width !== width || element.height !== height) {element.width = width; element.height = height; gl.viewport(0, 0, width, height);}
        gl.uniform2f(uniforms.uResolution, width, height); gl.uniform4fv(uniforms.uView, p.view);
        gl.uniform2f(uniforms.uRotation, p.rotation[0] * Math.PI / 180, p.rotation[1] * Math.PI / 180);
        gl.uniform1f(uniforms.uZoom, p.zoom); gl.uniform1f(uniforms.uPhase, (year - p.plan.start) / (p.plan.end - p.plan.start));
        gl.uniform1i(uniforms.uGlobe, p.mode === 'globe' ? 1 : 0); gl.uniform1i(uniforms.uDark, p.dark ? 1 : 0);
        gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLES, 0, 3);
        // Lightweight observable diagnostics; no user data or telemetry.
        if (!measuredAt) measuredAt = now;
        measuredFrames++;
        if (now - measuredAt >= 1000) {element.dataset.fps = (measuredFrames * 1000 / (now - measuredAt)).toFixed(1); measuredFrames = 0; measuredAt = now;}
        if (!element.dataset.firstFrameMs) element.dataset.firstFrameMs = performance.now().toFixed(0);
        element.dataset.year = year.toFixed(3); element.dataset.interval = `${p.plan.start}:${p.plan.end}`;
        lastDraw = key; dirty = false;
      } else {measuredAt = 0; measuredFrames = 0;}
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => {cancelAnimationFrame(frame); resize.disconnect(); element.removeEventListener('webglcontextlost', lost); atlasTextures.dispose(); paletteTexture.forEach(t => gl.deleteTexture(t)); gl.deleteProgram(program);};
  }, []);
  return <canvas ref={canvas} className="territory-canvas" aria-hidden="true"/>;
}
