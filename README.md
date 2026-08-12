# SPLASH — Arena Brawler

A touch-only, twin-stick arena brawler for the browser. Move with your left thumb, aim and fire with your right. Fight a squad of AI bots, grab power-ups, and charge your super.

## Play

**Live demo:** https://danse.github.io/splash/

Requires a touch screen device — a message is shown on desktop. Play in landscape; a prompt appears if you rotate to portrait.

## Controls

| Action | Touch |
| --- | --- |
| Move | Left virtual joystick |
| Aim | Right virtual joystick (aim while holding) |
| Fire | Release the right joystick |
| Auto-aim shot | Tap the right side (fires at the closest enemy) |
| Super | ★ button (bottom-right) |

## Development

```bash
npm install
npm run dev       # start dev server (reachable from phone on LAN)
npm test          # run unit tests
npm run test:e2e  # run headless-browser rendering tests (Playwright, 1280x720 reference size)
npm run build     # type-check + production build to dist/
```

## Rendering tests

Playwright runs the real game in headless Chromium at a fixed reference size (1280×720 touch). It boots the app, verifies layout geometry (canvas fills the viewport, super button is exactly 56px, no element overlap), and checks pixel-perfect screenshots of the menu and brawler-select screens against stored baselines.

To re-baseline the golden screenshots after an intentional visual change:

```bash
npx playwright test --update-snapshots
```

Then review the diff via `npx playwright test` (failures show pixel diffs in `test-results/`). The project has one reference size; add more viewport sizes as extra projects in `playwright.config.ts`.

## How it works

- **Stack:** TypeScript + Vite, Canvas 2D renderer, Web Audio API for synthesized SFX
- **Touch input:** Pointer Events with per-`pointerId` tracking and `touch-action: none` (works on iOS Safari 13+ and Android); mouse and keyboard are not supported
- **Entities:** 3 brawler archetypes (Blaster, Charger, Tank), bots with AI state machines, projectiles with pierce/knockback, pickup respawns. The Tank is a close-combat brawler that swings its weapon in an arc instead of firing projectiles.
- **Arena:** seeded procedural generation of walls and hiding bushes
- **Tests:** Vitest suites covering math, collision, arena generation, brawler mechanics, bot AI, and input

## Balance harness

Headless, seeded bot-vs-bot duels for comparing archetypes. Deterministic per seed (`Math.random` is seeded).

```bash
npm run balance -- --n 100          # full round-robin (6 matchups) in parallel workers
npm run balance -- --pairs blaster:tank --n 50
npm run balance -- --n 50 --json results.json
npm run balance -- --ablate turret  # remove a bot capability and measure the win-rate delta
```

Options: `--n` duels per pair (default 100), `--seed` (default 1), `--pairs a:b,c:d`, `--workers`, `--pickups`, `--duration`, `--json <path>`, and for ablation: `--ablate <turret|nosuper|noretreat|perfectaim>`, `--ref <archetype>` (default `charger`, plays side B), `--targets <a,b,c>`.

Output includes a matchup table (wins, avg damage, hits/shot, supers, HP left), an archetype overview, and optionally a JSON blob with per-duel aggregates.

## Sprites

In-game character and tank sprites are from the [Kenney](https://kenney.nl/) packs **Top-down Shooter** and **Top-down Tanks**, by Kenney Vleugels, released under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). Copies of the license files live in `public/assets/sprites/`. Attribution (Kenney or kenney.nl) is appreciated but not required.

- `soldier1_stand.png` — Blaster
- `hitman1_stand.png` — Charger
- `tankGreen.png` + `barrelGreen.png` — Tank (body + aimable barrel)

## Deploying

Pushing to `main` triggers `.github/workflows/deploy.yml`, which runs the tests, builds, and publishes to GitHub Pages automatically. The Vite config uses `base: './'` so assets resolve correctly under any repo subpath.

1. Create the repo and push this project to `main`
2. In **Settings → Pages**, set the source to **GitHub Actions**
3. The demo is live at `https://danse.github.io/splash/`
