/** Public files live below the repository name on GitHub Pages. */
export function assetPath(path: `/${string}`) {
  return `${process.env.NEXT_PUBLIC_SITE_BASE_PATH || ''}${path}`;
}
