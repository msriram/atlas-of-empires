'use client';
import {useEffect, useId, useRef, type RefObject} from 'react';
import type {AtlasPlan} from './atlas';
import type {PlaybackClock} from './use-playback';
import {displayName, colorKey} from './chronology';
import {searchTerms} from '../data/historical-names';
import {visibleSvgView} from './svg-viewport';
import {traceOwnershipContours} from './contours';

const SVG_NS = 'http://www.w3.org/2000/svg';
function rgb(name: string) {
  let hash = 0;
  for (const ch of colorKey(name)) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  const hue = Math.abs(hash) % 360 / 60;
  const chroma = (1 - Math.abs(2 * .62 - 1)) * .46;
  const x = chroma * (1 - Math.abs(hue % 2 - 1)), m = .62 - chroma / 2;
  const c = hue < 1 ? [chroma, x, 0] : hue < 2 ? [x, chroma, 0] : hue < 3 ? [0, chroma, x] : hue < 4 ? [0, x, chroma] : hue < 5 ? [x, 0, chroma] : [chroma, 0, x];
  return `rgb(${c.map(v => Math.round((v + m) * 255)).join(',')})`;
}

type Props = {
  plan: AtlasPlan; names: string[]; clock: RefObject<PlaybackClock>;
  view: readonly number[]; rotation: [number, number]; zoom: number;
  mode: 'flat' | 'globe'; selected: string | null; query: string; dark: boolean;
  flatLandPaths: readonly string[]; globeLandPaths: readonly string[]; repeats: readonly number[];
};

/** Vector ownership layer. A changing frontier updates only changed paths;
 * quiet years leave the DOM untouched. No animated raster surface is retained. */
export default function TerritoryCanvas(props: Props) {
  const svg = useRef<SVGSVGElement>(null), contourGroup = useRef<SVGGElement>(null);
  const current = useRef(props), clipId = `land-${useId().replaceAll(':', '')}`;
  useEffect(() => {current.current = props;});
  useEffect(() => {
    const element = svg.current!, contoursElement = contourGroup.current!;
    let frame = 0, previousFrame = 0, measuredAt = 0, changedFrames = 0;
    let sampleWidth = 0, sampleHeight = 0, viewportWidth = 1, viewportHeight = 1, positionDirty = true, quality = false;
    let geometryKey = '', lastYear = NaN, paletteKey = '';
    let coordinates = new Int32Array(0), ownership = new Uint16Array(0), paletteNames: string[] | undefined;
    const paths = new Map<number, SVGPathElement>(), shapes = new Map<number, string>();
    let loaded: AtlasPlan | undefined, binds = 0;

    const positionLayer = () => {
      const parent = element.parentElement!.getBoundingClientRect();
      viewportWidth = Math.max(1, parent.width);
      viewportHeight = Math.max(1, parent.height);
      element.style.width = `${viewportWidth}px`; element.style.height = `${viewportHeight}px`;
      element.style.left = '0'; element.style.top = '0';
      positionDirty = true; geometryKey = '';
    };
    const resize = new ResizeObserver(positionLayer);
    resize.observe(element.parentElement!); positionLayer();

    const draw = (now: number) => {
      const p = current.current, playing = p.clock.current.running;
      if (playing && now - previousFrame < 1000 / 12) {frame = requestAnimationFrame(draw); return;}
      previousFrame = now;
      if (quality !== playing) {quality = playing; positionDirty = true;}
      if (positionDirty) {
        const scale = Math.min(1, (playing ? 520 : 1000) / viewportWidth, (playing ? 260 : 500) / viewportHeight);
        const nextWidth = Math.max(1, Math.round(viewportWidth * scale));
        const nextHeight = Math.max(1, Math.round(viewportHeight * scale));
        if (nextWidth !== sampleWidth || nextHeight !== sampleHeight) {
          sampleWidth = nextWidth; sampleHeight = nextHeight;
          coordinates = new Int32Array(sampleWidth * sampleHeight);
          ownership = new Uint16Array(sampleWidth * sampleHeight);
          geometryKey = '';
        }
        positionDirty = false;
      }
      const nextGeometryKey = `${sampleWidth}:${sampleHeight}:${p.plan.width}:${p.plan.height}:${p.view.join(',')}:${p.rotation.join(',')}:${p.zoom}:${p.mode}`;
      if (nextGeometryKey !== geometryKey) {
        const [vx, vy, vw, vh] = visibleSvgView(p.view, viewportWidth, viewportHeight);
        // Render both land clip and territory contours in the base map's world
        // coordinate system. Only the contours need sample-to-world scaling.
        element.setAttribute('viewBox', `${vx} ${vy} ${vw} ${vh}`);
        contoursElement.setAttribute('transform', `translate(${vx} ${vy}) scale(${vw / sampleWidth} ${vh / sampleHeight})`);
        const cos = Math.cos(p.rotation[1] * Math.PI / 180), sin = Math.sin(p.rotation[1] * Math.PI / 180);
        const radians = 180 / Math.PI, turn = p.rotation[0] * Math.PI / 180;
        for (let y = 0; y < sampleHeight; y++) {
          const worldY = vy + (y + .5) / sampleHeight * vh;
          for (let x = 0; x < sampleWidth; x++) {
            const worldX = vx + (x + .5) / sampleWidth * vw;
            let lon: number, lat: number;
            if (p.mode === 'globe') {
              const qx = (worldX - 450) / (205 * p.zoom), qy = -(worldY - 225) / (205 * p.zoom);
              const radius = qx * qx + qy * qy;
              if (radius > 1) {coordinates[y * sampleWidth + x] = -1; continue;}
              const front = Math.sqrt(Math.max(0, 1 - radius));
              lon = (Math.atan2(qx, front * cos + qy * sin) - turn) * radians;
              lat = Math.asin(Math.max(-1, Math.min(1, qy * cos - front * sin))) * radians;
            } else {lon = worldX / 2.5 - 180; lat = 90 - worldY / 2.5;}
            if (Math.abs(lat) > 90) {coordinates[y * sampleWidth + x] = -1; continue;}
            const gx = Math.round((lon + 180) / 360 * p.plan.width - .5);
            const gy = Math.round((90 - lat) / 180 * p.plan.height - .5);
            coordinates[y * sampleWidth + x] = Math.max(0, Math.min(p.plan.height - 1, gy)) * p.plan.width + ((gx % p.plan.width) + p.plan.width) % p.plan.width;
          }
        }
        geometryKey = nextGeometryKey; lastYear = NaN;
      }
      if (loaded !== p.plan) {loaded = p.plan; binds++; element.dataset.uploads = String(binds); lastYear = NaN;}
      const year = Math.max(p.plan.start, Math.min(p.plan.end, p.clock.current.year));
      const nextPaletteKey = `${p.selected}:${p.query}:${p.dark}:${displayName('Egypt',year)}:${displayName('Songhai',year)}:${year < -27}`;
      const paletteChanged = nextPaletteKey !== paletteKey || paletteNames !== p.names;
      if (paletteChanged) {paletteKey = nextPaletteKey; paletteNames = p.names;}
      if (lastYear !== year || paletteChanged) {
        const phase = (year - p.plan.start) / (p.plan.end - p.plan.start);
        const owner = p.plan.owners, timing = p.plan.timing;
        for (let i = 0; i < ownership.length; i++) {
          const cell = coordinates[i];
          if (cell < 0) {ownership[i] = 0; continue;}
          const offset = cell * 2, from = owner[offset], to = owner[offset + 1];
          ownership[i] = from === to || phase <= 0 || (phase < 1 && phase <= timing[offset] / 65535) ? from : to;
        }
        const contours = traceOwnershipContours(ownership, sampleWidth, sampleHeight);
        let changed = false;
        const query = p.query.trim().toLocaleLowerCase();
        for (const [id, d] of contours) {
          let path = paths.get(id);
          const fresh = !path;
          if (!path) {
            path = document.createElementNS(SVG_NS, 'path');
            path.setAttribute('shape-rendering', 'geometricPrecision');
            path.setAttribute('fill-rule', 'evenodd');
            contoursElement.appendChild(path); paths.set(id, path);
            changed = true;
          }
          if (shapes.get(id) !== d) {path.setAttribute('d', d); shapes.set(id, d); changed = true;}
          if (fresh || paletteChanged) {
            const name = displayName(p.names[id], year);
            path.setAttribute('fill', rgb(name));
            path.setAttribute('fill-opacity', String(p.selected === name || (query && searchTerms(name).some(term=>term.toLocaleLowerCase().includes(query))) ? 1 : query ? .12 : p.dark ? .88 : .82));
          }
        }
        for (const [id, path] of paths) if (!contours.has(id)) {path.remove(); paths.delete(id); shapes.delete(id); changed = true;}
        element.dataset.year = year.toFixed(3);
        element.dataset.interval = `${p.plan.start}:${p.plan.end}`;
        if (changed) {
          if (!element.dataset.firstFrameMs) element.dataset.firstFrameMs = performance.now().toFixed(0);
          if (!measuredAt) measuredAt = now;
          changedFrames++;
          if (now - measuredAt >= 1000) {element.dataset.fps = (changedFrames * 1000 / (now - measuredAt)).toFixed(1); changedFrames = 0; measuredAt = now;}
        }
        lastYear = year;
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => {cancelAnimationFrame(frame); resize.disconnect(); paths.clear(); shapes.clear();};
  }, []);
  return <svg ref={svg} className="territory-canvas" aria-hidden="true" preserveAspectRatio="none">
    <defs><clipPath id={clipId} clipPathUnits="userSpaceOnUse">
      {props.mode === 'flat' ? props.repeats.flatMap(copy => props.flatLandPaths.map((d, i) => <path key={`${copy}:${i}`} transform={`translate(${copy * 900} 0)`} d={d}/>)) : props.globeLandPaths.map((d, i) => <path key={i} d={d}/>)}
    </clipPath></defs>
    <g ref={contourGroup} clipPath={`url(#${clipId})`}/>
  </svg>;
}
