# Mahmoud Mardini — Personal Website

Personal portfolio for **Mahmoud Mardini**, an embedded hardware and AI cloud engineer in Stuttgart. The site is built as a **Deployment Screen** — a Battlefield-inspired mission briefing for embedded systems, edge infrastructure, cloud and AI — while presenting the real CV: 5+ years across automotive electronics, embedded Linux, AWS cloud infrastructure, edge computing and production agent systems.

Live: <https://cv.mardini-ing.workers.dev/>

## Highlights

- **Deployment-screen concept:** a full-bleed sector map with capture points, radar sweep, moving front lines, supply dots, an aircraft flyby and a pointer reticle. The briefing leads with a four-class loadout — **Embedded, Edge, Cloud, AI** — a squad skills panel, a live sector-intel bar and a hover curtain that drops sector details over the map.
- **Ikigai:** the background watermark and the briefing line tie the concept together — what I love, what I'm good at, what the world needs and what pays.
- **Amber cockpit palette:** amber `#ffb020`, orange `#ff6a00` and signal green `#7ae582` on a warm near-black deck. The "daylight cockpit" light theme switches to parchment with bronze/forest accents; the mission display stays dark in both themes.
- **No WebGL, no build step:** the old Three.js PCB scene is gone. The map is inline SVG with CSS/SMIL motion, paused when offscreen or when reduced motion is requested.
- **CV-aligned content:** eight service-record entries from the 2026 CV — edge-cloud lab, AWS certification track, Hoerbiger, Mercedes-Benz VAN, Odelo, Volvo/Flex, JDM, and the BSc in Renewable Energies.
- **Fully static:** plain HTML, CSS and JavaScript.
- **Trilingual UI:** English, German and Arabic with a full RTL layout, Cairo typography and mirrored navigation. The language is remembered in `localStorage` (`mm-lang`).
- **Responsive:** mobile command menu, scroll spy, reveal animations, animated counters and a pointer-lit card spotlight. Capture points are desktop-only; the map and intel bar stay on mobile.
- **Lazy-loaded Calendly panel:** framed loading state, a direct scheduling fallback, and a safety timeout so the panel never gets stuck.
- **Local assets:** SVG icon sprite, favicon, and a 1200×630 Open Graph image in the same visual language.

## Project structure

```text
.
├── index.html              # Single-page markup, metadata, inline sector-map SVG
├── assets/
│   ├── css/styles.css      # Design system, dark/light themes, deploy hero, layout, motion, RTL
│   ├── js/main.js          # Navigation, theme, scroll spy, reveals, deploy map, Calendly
│   ├── js/i18n.js          # en / de / ar dictionaries and language runtime
│   ├── icons.svg           # Local SVG icon sprite (HUD / chip / cloud / agent set)
│   ├── favicon.svg         # Flight-deck favicon
│   └── og-image.png        # 1200×630 social preview image
├── wrangler.jsonc          # Cloudflare Workers static-assets config
└── README.md
```

## Local preview

Serve the folder with any static HTTP server. For example:

```powershell
python -m http.server 8080
```

Then open <http://localhost:8080>.

Overrides are available through the query string:

- Themes: <http://localhost:8080/?theme=light> or <http://localhost:8080/?theme=dark>
- Languages: <http://localhost:8080/?lang=en>, `?lang=de`, `?lang=ar`
- Combined: <http://localhost:8080/?lang=de&theme=light>

Precedence is query parameter → saved preference → default. The default theme is the night deck; the default language follows the browser (`en` fallback).

## Editing content

- **Copy and translations:** text is marked with `data-i18n`, `data-i18n-content`, or `data-i18n-aria` attributes in `index.html`. Add or update the matching keys in all three dictionaries in `assets/js/i18n.js`.
- **Theme tokens:** the night deck lives under `html[data-theme="dark"]`; the daylight cockpit overrides live under `html[data-theme="light"]` at the top of `assets/css/styles.css`. The toggle and persistence logic are in `assets/js/main.js`, with the initial theme applied inline in `<head>` to avoid a flash.
- **Icons:** add a `<symbol id="...">` to `assets/icons.svg` and reference it with `<use href="assets/icons.svg#...">`.
- **Social image:** `assets/og-image.png` must stay at 1200×630 to match the Open Graph metadata.

## Deployment

The repository is configured for Cloudflare Workers static assets via `wrangler.jsonc`. With Wrangler installed and authenticated:

```powershell
npx wrangler deploy
```

Because there is no build step, the repository root is served as-is. Any other static host (Cloudflare Pages, GitHub Pages, Netlify, etc.) works the same way.
