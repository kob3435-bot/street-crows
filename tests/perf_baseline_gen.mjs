// Records tests/perf_baseline.json from whatever build is served (run once on the pre-change build).
import { launch } from './lib.mjs'; import { measurePerf } from './perf_probe.mjs'; import fs from 'fs';
const b = await launch(); const out = { measuredAt: new Date().toISOString(), note: process.argv[2] || '', runs: [] };
for (const q of [1, 0]) { const r = await measurePerf(b, { quality: q }); console.log(JSON.stringify(r)); out.runs.push(r); }
await b.close(); fs.writeFileSync(new URL('./perf_baseline.json', import.meta.url), JSON.stringify(out, null, 2));
