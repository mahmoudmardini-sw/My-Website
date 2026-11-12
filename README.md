# Mahmoud Mardini — Personal Website

Personal portfolio for **Mahmoud Mardini**, an Embedded Hardwareentwicklungsingenieur and AI Cloud Engineer based in Stuttgart. The site presents 5+ years of experience across automotive electronics, embedded Linux, AWS cloud infrastructure, edge computing, and autonomous AI agents.

Live: <https://cv.mardini-ing.workers.dev/>

## Highlights

- **Two themes:** the original dark teal/indigo design plus a warm light theme (ivory background, espresso text, gold/bronze accents). Switch from the header; the choice is remembered in `localStorage` under `mm-theme`.
- **Custom emblem:** a hexagonal "engineering core" mark replaces the old monogram in the hero, header/footer brand marks, favicon, and social preview image.
- **CV-aligned content:** eight experience entries from the 2026 CV — independent edge-cloud projects, the AWS certification track, Hoerbiger, Mercedes-Benz VAN, Odelo, Volvo/Flex, JDM, and the BSc in Renewable Energies.
- **Fully static:** plain HTML, CSS, and JavaScript with no build step.
- **Trilingual UI:** English, Arabic (full RTL layout), and German. The language can be switched from the header and is remembered in `localStorage` (`mm-lang`).
- **Responsive layout:** mobile navigation drawer, scroll reveal effects, animated counters, and section-aware navigation.
- **Lazy-loaded Calendly panel:** with a matching framed loading state and direct scheduling fallback.
- **Local assets:** SVG icon sprite and favicon, a 1200×630 Open Graph image, and Person JSON-LD metadata.

## Project structure

```text
.
├── index.html              # Single-page markup, metadata, hero SVG
├── assets/
│   ├── css/styles.css      # Design system, dark/light themes, layout, animations, RTL
│   ├── js/main.js          # Theme/language UI, navigation, scrollspy, reveals, counters, Calendly
│   ├── js/i18n.js          # en / ar / de dictionaries and language runtime
│   ├── icons.svg           # Local SVG icon sprite
│   ├── favicon.svg         # Favicon (hexagonal engineering core)
│   └── og-image.png        # 1200x630 social preview image
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

Precedence is query parameter → saved preference → default. The default theme is dark; the default language follows the browser (`en` fallback).

## Editing content

- **Copy and translations:** text is marked with `data-i18n`, `data-i18n-content`, or `data-i18n-aria` attributes in `index.html`. Add or update the matching keys in all three dictionaries in `assets/js/i18n.js`.
- **Themes:** dark tokens live under `:root` at the top of `assets/css/styles.css`; light overrides live under `html[data-theme="light"]`. The header toggle and persistence logic are in `assets/js/main.js`, with the initial theme applied inline in `<head>` to avoid a flash.
- **Icons:** add a `<symbol id="...">` to `assets/icons.svg` and reference it with `<use href="assets/icons.svg#...">`.
- **Social image:** `assets/og-image.png` must stay at 1200×630 to match the Open Graph metadata.

## Deployment

The repository is configured for Cloudflare Workers static assets via `wrangler.jsonc`. With Wrangler installed and authenticated:

```powershell
npx wrangler deploy
```

Because there is no build step, the repository root is served as-is. Any other static host (Cloudflare Pages, GitHub Pages, Netlify, etc.) works the same way.
