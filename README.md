# Window Smash

Kick a football through the neighbours' windows. Plain HTML/CSS/JS with three.js r128, with no build step and no external requests (Poki-ready).

## Run

- Open `index.html` directly in a browser, or
- serve the folder: `npx serve` (then open the printed URL).

## Files

| File | Holds |
| --- | --- |
| `index.html` | Markup only; links the stylesheet and loads the scripts in order |
| `css/style.css` | All styles, plus local `@font-face` rules |
| `assets/fonts/` | Lilita One (400) and Nunito (700–900, variable) as woff2 |
| `js/lib/three.min.js` | three.js r128 (local copy) |
| `js/settings.js` | Shared helpers (`T`, `$`, `rnd`, `clamp`, `lerp`), `DEF`, `S`, `SL`, save/load |
| `js/scene.js` | Renderer, camera, lights, yard, clouds, kick spot, camera layout and `toScreen` |
| `js/ball.js` | Football texture/material, ball spawn and removal |
| `js/fx.js` | Particles, shatter, juice (freeze, slow-mo, shake, pops) |
| `js/audio.js` | Web Audio sfx |
| `js/levels.js` | `LV` level data, `buildHouse`, `buildStand`, `makeRoom`, `loadLevel` |
| `js/input.js` | Live swipe (default) plus the old aim/shape controls (hidden) |
| `js/game.js` | Win/fail, ball physics, main loop |
| `js/ui.js` | Tuning panel, buttons, keyboard, startup, `window.__ws` debug hook |

Scripts are plain (non-module) and share globals, so the load order in `index.html` matters. Press `M` to cycle control modes. The tuning panel (⚙) has a **Sandbox** button: an empty yard with unlimited balls for testing kick feel (`R` reloads it).
