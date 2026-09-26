# STREET CROWS: CITY OF RIVALS — v0.1 vertical slice

An original 3D browser brawler / action RPG. Haru Boya, a laid-back transfer student who is far too strong, arrives in Akebono City, where rival high schools and street gangs fight over territory. **Everything in the game is original**: characters, gangs, story, art and audio. Nothing is taken from any existing manga.

- Tech: Vite + TypeScript + Three.js. The output is fully static (`dist/`) and runs on any static host.
- Art: toon (cel) shading, inverted-hull ink outlines, halftone in shadow areas, manga speed lines, impact frames and onomatopoeia.
- Time of day: day, golden hour and night, with lit windows, street-lamp lights and neon shop signs.
- Audio: 100% procedural WebAudio (hits, UI, a punk-rock loop, ambience). No audio files are shipped.
- Text: Thai first, English second. There is a TH/EN toggle on the title screen and in Settings.

## Run / build / test
```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # tsc --noEmit && vite build  -> dist/
npm test           # Playwright suite. Serve dist/ first, e.g.:
                   # (cd dist && python3 -m http.server 8090) ; BASE_URL=http://127.0.0.1:8090/ npm test
```
The tests use `playwright-core` with the system Chrome at `/usr/bin/google-chrome` (headless, SwiftShader WebGL). Results go to `test-results.json` and screenshots to `screenshots/`.

URL flags for development and testing: `?quality=0|1|2`, `?lang=th|en`, `?touch=1`, `?newgame=1`, `?continue=1`, `?test=1` (disables pointer lock), `?render=0` (simulation only), `?speed=N`.
`window.__game.debug` is a set of debug hooks. It includes teleport, spawn, setTime, giveExp, killAll, god, bot, step and state.

## Controls
| Action | Keyboard / mouse | Gamepad (standard) | Touch |
|---|---|---|---|
| Move / sprint | WASD / arrows, Shift | Left stick, LT or L3 | Left floating joystick (push fully = sprint) |
| Camera | Mouse (click to lock the pointer; drag also works) | Right stick | Drag on the right half of the screen |
| Punch / heavy | LMB or J / RMB or K | X / Y | ต่อย / หนัก |
| Kick / heavy kick (guard break) | F / C | B / RT | เตะ / เตะหนัก |
| Dodge (perfect dodge = slow-mo) | Space | A | หลบ |
| Block (hold; a well-timed tap = parry) | Q | LB | การ์ด |
| Grab, then press again to throw | G or MMB | RB | จับ |
| Special (full meter) | R | D-pad up / R3 | พิเศษ |
| Interact / menu / map / help | E / Tab or Esc / M / H | D-pad right / Back / Start | E / ☰ buttons |
| Items | 1 onigiri, 2 energy drink, 3 bento | D-pad left (onigiri) | 🍙 |

**Combos and techniques**
- Combos: P-P-Heavy, P-K-K (kick finisher), P-P-P (with the *Combo Flow* skill), Sprint + Kick = flying kick, Grab → Grab = throw (the throw also hits other enemies).
- Counters: dodge or block successfully, then attack straight away to get a counter.
- Finisher: a heavy attack on a dizzy enemy.
- Other mechanics: guard break (heavy kick or repeated hits on a guard), hit stop, knockdown/get-up, stun, and guard-crush.

## What's in v0.1
- **World**: one fictional city, 396 × 396 m, with 15 zones.
  - Schools: Kurogane High (with schoolyard and rooftop), Hakuryu Academy, Tetsuwan Technical.
  - Hinode shopping arcade, Chuo main road, back alleys, Maruichi ramen shop, Happy Mart convenience store, Midori park with a pond and torii, and Akebono station with tracks.
  - Parking lot, the abandoned Tekkotsu factory/warehouse, the river with two bridges, and the under-bridge area.
  - The map is split into 50 m chunks. Chunks are built lazily and hidden beyond view distance, and buildings and props are instanced.
  - The city has 50–170 ambient pedestrians, depending on quality: commuters, students, and groups standing and chatting. They flee from fights and change with the time of day.
  - Gang members loiter in their own territory. Rival gangs fight each other in random street events.
  - A minimap and a territory map show gang colours.
- **Combat**: real-time, state-machine based.
  - Moves: 16 player moves and 9 special moves.
  - Defence: block, parry, a guard meter, guard break, dizziness, armor, and a perfect dodge that triggers slow-mo.
  - Offence: counters, grab/throw, and finishers.
  - Feedback: hit-stop, camera shake, particles, speed lines, impact frames and onomatopoeia.
- **Enemy AI**:
  - An attack-token coordinator lets only 1–2 enemies attack at once. The others hold surround slots, circle, feint and wait for openings.
  - Enemies react to your attacks with a delay and choose to block, dodge or counter. They punish your whiffs, retreat when their HP is low, and flee if you have Intimidation.
  - Enemies adapt to your habits: punch spam → they block more; turtling → they grab more; and so on.
  - Tiers: grunt < mid < mini-boss < boss.
- **Bosses**: every boss has 3 phases (Phase 1 / Phase 2 / Final). Each phase has its own taunt, AI parameters, moveset and special.
  - Mini-bosses:
    - Onoda: brawler.
    - Kuroki: biker gang leader.
    - Tsukiyo: masked night fighter, found at the warehouse at night.
  - Bosses:
    - Kirishima: counter-master with the "Dragon Mirror" stance. Grab or guard-break him.
    - Goda: heavy hitter with super armor and a ground slam.
    - Hayate: speedster with rushes and dashes.
- **Quests**: all 9 quests are verified completable by the automated test.
  - Main line:
    - Tutorial.
    - Ch.1 Kurogane: Onoda, then rooftop talk.
    - Ch.2 Hakuryu squad, then Kirishima.
    - Ch.3 Tetsuwan / Kagero: Goda, then Hayate.
  - Side quests:
    - Gang quest: Yamikaze toll road.
    - 1v1 duel: Mikami.
    - Help: Grandma's cat.
    - Help: ramen shop protection.
    - Rumor: masked fighter at the warehouse at night (Lv3+).
  - Random street events every 2–4 minutes: bullying, a challenger, a gang war, an ambush.
- **Progression**:
  - Level, EXP (`90·L^1.45`), HP and stamina.
  - Six stats: Power, Speed, Defense, Technique, Counter, Charisma.
  - Reputation, with 7 tiers from Unknown to Legend. The crowd reacts to your tier.
  - Money and items.
  - A skill tree of 20 skills in 5 branches: Power, Speed, Technique, Toughness, Street Instinct. Each skill changes combat modifiers or unlocks mechanics (third jab, earthshaker shockwave, shadow step, and more).
  - Relationship values for key NPCs, from Stranger to Friend / Brother / Rival / Nemesis. Dialogue choices change them.
- **Data**: 10 gangs/schools in `src/data/gangs.ts` and 23 fully written key characters in `src/data/characters.ts`. Each character has a name, nickname, age, school, gang, personality, backstory, relationships, power, style, signature move, strengths, weaknesses and AI parameters. The schema is designed to scale to 40–60 characters.
- **Customization**: hair style and colour, jacket, shirt, pants, shoes, coat type, accessory and title. Haru's face and personality stay fixed.
- **Save**:
  - Autosave every 45 s, on key events and on page close.
  - Manual save/load with 3 slots.
  - Versioned schema (v2) with migrations. A corrupt save is backed up and ignored, and never crashes the game.
- **Controls**: keyboard + mouse, gamepad and touch. The layout is responsive.
- **Quality**: low / medium / high. Mobile auto-detects low: lower pixel ratio, no shadows, fewer crowd NPCs, shorter view distance.

## Architecture
```
src/
  core/    engine-agnostic services: EventBus, Input (kbd/mouse/gamepad/touch/bot), audio,
           i18n, SaveProvider (+LocalStorage impl), NetworkAdapter (+LocalSimulatedNetwork)
  data/    pure data: gangs, characters, skills, quests/encounters, city layout, barks
  sim/     deterministic fixed-step simulation, no rendering:
           World (game state), Fighter (entity + state machine), Combat, AIBrain + AttackCoordinator,
           Progression, QuestSystem, Crowd, Collision (grid AABB/circles, layers), cityGen
  render/  Three.js view: reads World, never writes. CityView (chunk streaming, instancing),
           CharacterRig (procedural rigs + animation), CrowdView (instanced), FX pools, manga Overlay
  ui/      DOM HUD, menus, modals, touch controls
  main.ts  wiring + fixed 60 Hz loop (max 5 substeps) + autosave + debug hooks
```
- **Sim/render split**: `World.step(dt, input)` runs at a fixed 60 Hz. The renderer interpolates with `alpha`. `?render=0` runs the whole game headless. The tests use this, and a future authoritative server could too.
- **Entity/component style**: a `Fighter` entity carries plain data components: transform, combat state, stats/`Mods`, an optional `AIBrain`, an appearance, and boss phases. Systems (Combat, AI, QuestSystem, Crowd) operate on these entities. Content is data-driven from `src/data`.
- **Events**: gameplay emits bus events (`hit`, `ko`, `bossPhase`, `questComplete`, …). The renderer, audio and HUD subscribe to them, so the simulation never calls presentation code.
- **Network-ready**: the `NetworkAdapter` interface has `connect`, `send`, `onMessage` and `tick`. World sends a player snapshot every 100 ms and renders remote snapshots as ghosts. `LocalSimulatedNetwork` fakes 3 online players with chat. A WebSocket or WebRTC adapter can replace it without touching the simulation.
- **Cloud-save-ready**: `SaveProvider` is async (`save`, `load`, `list`, `remove`). `LocalStorageSaveProvider` is today's implementation. A REST or Firebase provider can be dropped in.

## Credits
- Fonts: Kanit and Bangers (SIL Open Font License), bundled in `public/fonts`.
- Everything else, including code, procedural meshes, textures, music and SFX, was made for this project.

## Deploying
`dist/` is a static site with relative asset paths (`base: './'`). Options:
- **GitHub Pages** (live): `.github/workflows/deploy.yml` runs `npm ci && npm run build` on every push to `main` and deploys `dist/` with actions/deploy-pages (Pages source = GitHub Actions). Because `base: './'`, the same build works under a project subpath (`/street-crows/`) and at a domain root.
- **Netlify / Vercel / Cloudflare Pages**: build command `npm run build`, publish directory `dist`.

## Tests (v0.1 status)
`tests/run-all.mjs` runs 7 Playwright suites, 80 checks in total:
- **Desktop boot**: title screen, zero console errors, fonts, new game, dialogue, WASD/sprint, mouse attacks, camera, all menu tabs, customization, TH/EN, help.
- **Core loop**: sim mode. Beats grunts without god mode, EXP/money/rep, AI attack-token cap (≤2 attackers), circling, habit tracking, level-up, skill unlock through the UI, and **all 9 quests completed through the real quest system** by an in-page bot with no god mode. Includes 3 mini-bosses and 3 bosses with phase transitions.
- **Save**: slot save through the UI, reload, Continue restores state, autosave, corrupt saves, v1→v2 migration.
- **World rules**: map bounds, no falling through the ground, no building/water penetration, rooftop edges, no hits through walls in either direction (with a positive control).
- **Mobile**: Pixel 7 portrait and landscape, touch joystick, drag-look, buttons, menu.
- **Visual**: screenshot capture at quality high.
- **Gamepad**: a virtual pad drives the stick, face buttons and menu.

Selected screenshots are in `docs/screenshots/`.
