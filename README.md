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
npm run build     # type-check + production build to dist/
```

## How it works

- **Stack:** TypeScript + Vite, Canvas 2D renderer, Web Audio API for synthesized SFX
- **Touch input:** Pointer Events with per-`pointerId` tracking and `touch-action: none` (works on iOS Safari 13+ and Android); mouse and keyboard are not supported
- **Entities:** 3 brawler archetypes (Blaster, Charger, Tank), bots with AI state machines, projectiles with pierce/knockback, pickup respawns
- **Arena:** seeded procedural generation of walls and hiding bushes
- **Tests:** Vitest suites covering math, collision, arena generation, brawler mechanics, bot AI, and input

## Deploying

Pushing to `main` triggers `.github/workflows/deploy.yml`, which runs the tests, builds, and publishes to GitHub Pages automatically. The Vite config uses `base: './'` so assets resolve correctly under any repo subpath.

1. Create the repo and push this project to `main`
2. In **Settings → Pages**, set the source to **GitHub Actions**
3. The demo is live at `https://danse.github.io/splash/`
