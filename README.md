# slatepress — site + dash

Source for `slatepress.co` (Cloudflare Pages).

## Layout

```
index.html              Marketing site
_redirects              Cloudflare Pages redirect/rewrite rules
assets/                 Static media (launch film, contact-modal.js)
dash/index.html         /dash/ SPA (notes, articles, bookmarks, todos, accounts, leads)
functions/api/          Pages Functions — D1-backed CRUD + /api/stats aggregate
  [[path]].js           Catch-all for GET|POST /api/<resource> + PUT|DELETE /api/<resource>/<id>
  stats.js              GET /api/stats — aggregate counts + burn + renewals
```

## Deploy

Connected to Cloudflare Pages via Git integration. Every push to `main` triggers a Production build; every push to any other branch triggers a Preview build. Pages handles `functions/` natively — no build command or framework preset needed.

Build config in the Cloudflare Pages dashboard:
- Build command: (empty)
- Build output directory: (empty / repo root)
- Root directory: (empty)

## Bindings

The `functions/api/*` code expects one D1 binding: `DASH_DB`. Configured at the project level in Pages → Settings → Bindings. Auth is handled upstream by Cloudflare Access (`slatepress.cloudflareaccess.com`, "Slatepress Dash" app) so the Functions themselves have no auth logic.

## Local dev

Not set up. If needed in the future, use `wrangler pages dev .` from the repo root — wrangler compiles `functions/` and serves it alongside the static assets.

<!-- kick deploy: 1778508520040 -->

<!-- kick deploy 1778519938069 (env var SLATEPRESS_SITE_PAT added) -->
