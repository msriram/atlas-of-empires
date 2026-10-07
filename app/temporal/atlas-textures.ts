import type {AtlasPlan} from './atlas';

type Slot = {textures: WebGLTexture[]; width: number; height: number};
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
      if (slot.width !== plan.width || slot.height !== plan.height) {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG16UI, plan.width, plan.height, 0, gl.RG_INTEGER, gl.UNSIGNED_SHORT, null);
      }
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, plan.width, plan.height, gl.RG_INTEGER, gl.UNSIGNED_SHORT, unit ? plan.timing : plan.owners);
    }
    slot.width = plan.width; slot.height = plan.height;
    this.slots.set(id, slot);
    if (upload) this.uploads++;
  }
  dispose() {for (const slot of this.slots.values()) slot.textures.forEach(t => this.gl.deleteTexture(t)); this.slots.clear();}
}
