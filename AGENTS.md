# AGENTS.md

## Cursor Cloud specific instructions

- This repo is a static Cloudflare Pages site with Pages Functions; README.md documents the normal deploy shape and the standard local entry point.
- There is currently no package manifest, lockfile, wrangler config, or D1 migration set. Use `npx -y wrangler@latest` for ad hoc local Cloudflare commands.
- Full `/dash/` testing needs a local D1 binding named `DASH_DB`. The required tables are implied by `functions/api/[[path]].js` and `functions/api/stats.js`.
- In Cursor Cloud, keep Wrangler Pages dev and D1 initialization on the same `--persist-to` directory. If `wrangler pages dev --d1 DASH_DB` does not see tables created through `wrangler d1 execute`, start Pages dev with an explicit local resource such as `--d1 DASH_DB=local-DASH_DB` using the same persistence directory.
- Wrangler 4 may prompt to install Cloudflare agent skills even in a non-interactive setup. Pass `--install-skills=false` when starting local dev servers from automation.
- `/editor/` publish and Twilio Verify flows require production secrets and Cloudflare Access context. For local environment smoke tests without those secrets, use public pages plus `/dash/` CRUD through the local D1 binding.
