# concerninghabits.com

The marketing site: static pages built with [Astro](https://astro.build), hosted on Cloudflare as a Worker that serves only static files. It's a separate project from the app, with its own dependencies; the app's lint, typecheck, Tailwind and Docker build all ignore this folder.

## Working on It

```bash
cd site
npm install
npm run dev       # http://localhost:4321, reloads as you edit
npm run build     # the static site, in dist/
npm run preview   # serves dist/
```

Pages are in `src/pages/`, and every page uses `src/layouts/Base.astro` (metadata, favicon, the Geist font, and colors that match the app's, in light and dark). `public/screenshots` is a link to the README's screenshots in `docs/screenshots/`, and `public/art/` links to the app's title, hobbit hole and plant SVGs in its own `public/`, so both stay the same. Draw the art with `src/components/Ink.astro`, which colors it with the theme's ink so it shows in dark mode too.

## Deploying

Cloudflare Workers Builds builds and publishes the site from this repo:

- **Every push to `main`** is published to https://concerninghabits.com and https://www.concerninghabits.com.
- **Every pull request** gets its own preview address, posted on the pull request.

`wrangler.jsonc` describes the deploy: the files in `dist/`, the two domains, and previews turned on. Keep it committed. Without it, Wrangler sets the project up itself on every deploy and adds things a static site doesn't need.

The Worker's build settings (Workers & Pages → `concerninghabits` → Settings → Build):

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Root directory | `/site` |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Non-production branch deploy command | `npx wrangler preview` |
