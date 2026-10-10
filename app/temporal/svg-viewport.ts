/** The map SVG uses xMidYMid meet. Its artwork can extend into the extra
 * viewport space outside the nominal viewBox, so the territory sampler must
 * cover that same visible coordinate range. */
export function visibleSvgView(view: readonly number[], width: number, height: number) {
  const [x, y, viewWidth, viewHeight] = view;
  const scale = Math.min(width / viewWidth, height / viewHeight);
  const visibleWidth = width / scale;
  const visibleHeight = height / scale;
  return [
    x + (viewWidth - visibleWidth) / 2,
    y + (viewHeight - visibleHeight) / 2,
    visibleWidth,
    visibleHeight,
  ] as const;
}
