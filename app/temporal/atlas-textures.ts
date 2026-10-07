import type {AtlasPlan} from './atlas';

type Slot = {textures: WebGLTexture[]; width: number; height: number};
const MAX_GPU_WIDTH = 1440;

function uploadSource(plan: AtlasPlan, unit: number) {
  const stride = Math.max(1, Math.ceil(plan.width / MAX_GPU_WIDTH));
  const width = Math.ceil(plan.width / stride), height = Math.ceil(plan.height / stride);
  const source = unit ? plan.timing : plan.owners;
  if (stride === 1) return {width, height, cells: source};
  // The full-resolution atlas remains available for exact map clicks. Display
  // samples are smaller because historical outlines are approximate and a
  // 2880×1440 texture pair per interval exhausts modest browser GPU budgets.
  const cells = new Uint16Array(width * height * 2);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const from = (Math.min(plan.height - 1, y * stride + (stride >> 1)) * plan.width + Math.min(plan.width - 1, x * stride + (stride >> 1))) * 2;
    const to = (y * width + x) * 2;
    cells[to] = source[from]; cells[to + 1] = source[from + 1];
  }
  return {width, height, cells};
}
/** Bounded GPU cache. Reversing between recent intervals binds existing textures,
 * avoiding two 16 MB uploads per switch. Keys do not retain CPU atlas buffers. */
export class AtlasTextures {
  private ids = new WeakMap<AtlasPlan, number>();
  private nextId = 0;
  private slots = new Map<number, Slot>();
  uploads = 0;
  constructor(private gl: WebGL2RenderingContext) {}
  bind(plan: AtlasPlan) {
    const gl = this.gl;
    let id = this.ids.get(plan);
    if (id === undefined) {id = this.nextId++; this.ids.set(plan, id);}
    let slot = this.slots.get(id);
    const upload = !slot;
    if (slot) this.slots.delete(id);
    else if (this.slots.size === 2) {
      const oldest = this.slots.keys().next().value!;
      slot = this.slots.get(oldest)!; this.slots.delete(oldest);
    } else slot = {textures: [gl.createTexture()!, gl.createTexture()!], width: 0, height: 0};
    for (let unit = 0; unit < 2; unit++) {
      gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, slot.textures[unit]);
      if (!upload) continue;
      const texture = uploadSource(plan, unit);
      if (slot.width !== texture.width || slot.height !== texture.height) {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG16UI, texture.width, texture.height, 0, gl.RG_INTEGER, gl.UNSIGNED_SHORT, null);
      }
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, texture.width, texture.height, gl.RG_INTEGER, gl.UNSIGNED_SHORT, texture.cells);
    }
    const stride = Math.max(1, Math.ceil(plan.width / MAX_GPU_WIDTH));
    slot.width = Math.ceil(plan.width / stride); slot.height = Math.ceil(plan.height / stride);
    this.slots.set(id, slot);
    if (upload) this.uploads++;
  }
  dispose() {for (const slot of this.slots.values()) slot.textures.forEach(t => this.gl.deleteTexture(t)); this.slots.clear();}
}
