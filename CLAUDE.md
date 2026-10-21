# h-droid

Personal F-Droid repository for custom forks and own apps, served publicly at
https://fdroid.hilson.net/repo. See `README.md` for the end-user steps; this file
records how it is built and why.

## Architecture

- `fdroidserver` (Python, via `uv`) turns the signed APKs in `repo/` plus
  `metadata/<applicationId>.yml` into a signed index.
- `repo/` is generated/ignored output. A Cloudflare Worker (`src/worker.js`)
  serves it from the R2 bucket `h-droid-repo` under `/repo/*`, with Range
  support (resumable downloads) and `/` redirecting to `/repo/index.html`.
- R2 instead of Workers static assets because static assets cap files at 25 MiB
  and APKs exceed that. Pages was avoided on purpose (Workers is the supported path).
- Custom domain `fdroid.hilson.net` is declared in `wrangler.jsonc`.

## Commands (run through `mise exec --` so Java, Node and `secrets.env` load)

- `pnpm index` regenerates the signed index (`fdroid update --create-metadata`, then `fdroid update`).
- `pnpm release` = `pnpm index`, upload changed files to R2, `wrangler deploy`.
- `scripts/publish.mjs` uploads by SHA-256 against `.tmp/uploaded.json` and never deletes;
  removing an APK also needs `wrangler r2 object delete h-droid-repo/repo/<file> --remote`.

Do not rename these scripts `update` or `publish`: they are built-in pnpm commands.

## Keys and secrets (never committed)

- `keystore.p12`: repo index signing key. Its fingerprint is in the add-repo link in `README.md`;
  losing it forces every device to re-add the repo.
- `signal-release.p12`: app signing key for the Signal fork. Separate from the index key.
  Losing it means nobody can update that app in place.
- `secrets.env`: passwords (`FDROID_KEY_STORE_PASS`, `FDROID_KEY_PASS`, `SIGNAL_KEY_PASS`),
  loaded by `mise.toml`. `config.yml` references them with `{env: VAR}`.
- `fdroid update --create-key` writes the passwords it generates into `config.yml`;
  move them to `secrets.env` and keep only the `{env: ...}` lines.

## Adding an app

1. Build a release APK of the fork and sign it with that app's own permanent key
   (`apksigner sign`; check with `zipalign -c -P 16 4` and `aapt2 dump badging`).
2. Copy it to `repo/<applicationId>_<versionCode>.apk`.
3. `pnpm index` creates `metadata/<applicationId>.yml`; fill in name, summary, licence,
   source links, then `pnpm release`.
4. Verify from the public URL: the package appears in `index-v2.json`, the downloaded
   APK hash matches, and `apksigner verify` shows the app key.

Forks that keep upstream's application ID cannot update over, or be updated by, the
official build (different signature). Give forks their own application ID.

## Apps

| Package | Source | Notes |
|---|---|---|
| `net.hilson.signal` | github.com/abumalick/Signal-Android (`github` flavor) | Own application ID and key; arm64-v8a only; v8.32.2 (code 176901). Build: `./gradlew :Signal-Android:assembleGithubProdRelease` (about 11 min, needs a memory bound). Rebuild regularly: Signal servers can reject old clients. |

## Pending

- HeliBoard fork: confirm what the licence allows before publishing it.
- File-manager fork (SSH filesystem support): not added yet.
- Real-device checks for the Signal fork (fresh install, video call, corner persistence).

## Gotchas already hit

- pnpm 11 blocks esbuild/workerd install scripts: `pnpm-workspace.yaml` has `allowBuilds`.
- The Worker must answer 206 only when the request has a `Range` header (R2 reports a range anyway).
- A zero-byte `repo/.gitkeep` makes fdroid fail; `repo/` is simply ignored.
- Ignored by git: `repo/`, `*.p12`, `secrets.env`, `.tmp/`, `node_modules/`, `CLAUDE.local.md`.
