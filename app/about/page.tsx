import Link from 'next/link';
export default function About(){return <main style={{maxWidth:760,margin:'7vh auto',padding:'0 24px',fontFamily:'system-ui',lineHeight:1.65,color:'#21362d'}}>
 <Link href="/">← Back to the atlas</Link><h1>About Atlas of Empires</h1>
 <p>Atlas of Empires is an educational map of approximate historical political and cultural regions. The polygons come from dated source maps. Annual edges between those maps are estimates. A color or line does not establish a legal or historical claim.</p>
 <h2>Sources and rights</h2><p>Historical boundaries are derived from <a href="https://github.com/aourednik/historical-basemaps">André Ourednik’s historical-basemaps</a> (GPL-3.0). Land shapes come from <a href="https://www.naturalearthdata.com/about/terms-of-use/">Natural Earth</a> (public domain). Event source links appear with each event.</p>
 <p>© 2026 Sriram Murali and contributors. Application source is GPL-3.0-only. See the repository’s COPYRIGHT.md, LICENSE, and CONTRIBUTING.md for details.</p>
 <h2>Analytics and saved views</h2><p>When configured, this site uses Umami to measure page visits and counts of save/view-switch actions. It honors Do Not Track. Search text and saved view contents are not sent as custom events. Saved views are stored in your browser.</p>
 </main>}
