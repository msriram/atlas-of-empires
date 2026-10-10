type Edge = {from: number; to: number; owner: number; direction: number; used: boolean};

/** Trace each occupied region once, then round local turns. Shared two-owner
 * borders use the same grid vertices in opposite directions. */
export function traceOwnershipContours(cells: Uint16Array, width: number, height: number): Map<number, string> {
  const stride = width + 1, vertexCount = stride * (height + 1);
  const edges: Edge[] = [];
  const outgoing = new Map<number, number | number[]>();
  const add = (owner: number, from: number, to: number, direction: number) => {
    const index = edges.length, key = owner * vertexCount + from;
    edges.push({from, to, owner, direction, used: false});
    const prior = outgoing.get(key);
    if (prior === undefined) outgoing.set(key, index);
    else if (typeof prior === 'number') outgoing.set(key, [prior, index]);
    else prior.push(index);
  };

  for (let y = 0; y < height; y++) {
    const row = y * width, top = y * stride;
    for (let x = 0; x < width; x++) {
      const owner = cells[row + x];
      if (!owner) continue;
      const a = top + x, b = a + 1, c = b + stride, d = a + stride;
      if (y === 0 || cells[row - width + x] !== owner) add(owner, a, b, 0);
      if (x === width - 1 || cells[row + x + 1] !== owner) add(owner, b, c, 1);
      if (y === height - 1 || cells[row + width + x] !== owner) add(owner, c, d, 2);
      if (x === 0 || cells[row + x - 1] !== owner) add(owner, d, a, 3);
    }
  }

  const point = (vertex: number) => [vertex % stride, Math.floor(vertex / stride)] as const;
  const loopPath = (vertices: number[]) => {
    if (vertices.length < 3) return '';
    let points: [number, number][] = vertices.map(vertex => [...point(vertex)]);
    // Blur the contour coordinates, not the rendered colors. Two short passes
    // soften stair steps while the edge remains shared by neighboring owners.
    if (points.length >= 8) for (let pass = 0; pass < 2; pass++) {
      const previous = points;
      points = previous.map(([x, y], i) => {
        if (x === 0 || x === width || y === 0 || y === height) return [x, y];
        const before = previous[(i + previous.length - 1) % previous.length];
        const after = previous[(i + 1) % previous.length];
        return [(before[0] + 2 * x + after[0]) / 4, (before[1] + 2 * y + after[1]) / 4];
      });
    }
    const corners = points.filter(([x, y], i) => {
      const [px, py] = points[(i + points.length - 1) % points.length];
      const [nx, ny] = points[(i + 1) % points.length];
      return Math.abs((x - px) * (ny - y) - (y - py) * (nx - x)) > 1e-6;
    });
    if (corners.length < 3) return '';
    const format = (value: number) => Number(value.toFixed(2));
    const last = corners[corners.length - 1], first = corners[0];
    let path = `M${format((last[0] + first[0]) / 2)},${format((last[1] + first[1]) / 2)}`;
    for (let i = 0; i < corners.length; i++) {
      const [x, y] = corners[i], [nx, ny] = corners[(i + 1) % corners.length];
      const middle = `${format((x + nx) / 2)},${format((y + ny) / 2)}`;
      path += x === 0 || x === width || y === 0 || y === height
        ? `L${format(x)},${format(y)}L${middle}`
        : `Q${format(x)},${format(y)} ${middle}`;
    }
    return path + 'Z';
  };

  const paths = new Map<number, string[]>();
  for (let start = 0; start < edges.length; start++) {
    if (edges[start].used) continue;
    const vertices: number[] = [];
    const first = edges[start].from;
    let index = start, closed = false;
    for (let steps = 0; steps < edges.length; steps++) {
      const edge = edges[index];
      if (edge.used) break;
      edge.used = true;
      vertices.push(edge.from);
      if (edge.to === first) {closed = true; break;}
      const candidates = outgoing.get(edge.owner * vertexCount + edge.to);
      if (candidates === undefined) break;
      const options = typeof candidates === 'number' ? [candidates] : candidates;
      let next = -1, bestTurn = 5;
      for (const candidate of options) {
        if (edges[candidate].used) continue;
        const turn = (edges[candidate].direction - edge.direction + 4) % 4;
        const rank = turn === 1 ? 0 : turn === 0 ? 1 : turn === 3 ? 2 : 3;
        if (rank < bestTurn) {bestTurn = rank; next = candidate;}
      }
      if (next < 0) break;
      index = next;
    }
    if (!closed) continue;
    const path = loopPath(vertices);
    if (!path) continue;
    let list = paths.get(edges[start].owner);
    if (!list) {list = []; paths.set(edges[start].owner, list);}
    list.push(path);
  }
  const output = new Map<number, string>();
  for (const [owner, parts] of paths) output.set(owner, parts.join(''));
  return output;
}
