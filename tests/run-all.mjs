const files = process.argv.slice(2).length ? process.argv.slice(2) : ['t1_boot_desktop', 't2_core_loop', 't3_save', 't4_world_rules', 't5_mobile', 't6_visual'];
const R = [];
for (const f of files) {
  console.log(`\n=== ${f} ===`);
  try { const m = await import(`./${f}.mjs`); await m.default(R); }
  catch (e) { R.push({ name: f + ' crashed', ok: false, info: String(e && e.stack || e).slice(0, 400) }); console.log('CRASH', e); }
}
const fail = R.filter(r => !r.ok);
console.log(`\n${R.length - fail.length}/${R.length} checks passed`);
for (const r of fail) console.log('FAILED:', r.name, r.info);
const fs = await import('fs'); fs.writeFileSync(new URL('../test-results.json', import.meta.url), JSON.stringify(R, null, 2));
process.exit(fail.length ? 1 : 0);
