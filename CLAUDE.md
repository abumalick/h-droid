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
- `signal-release.p12`: app signing key for the Signal fork (alias `signal`, password
  `SIGNAL_KEY_PASS`). Separate from the index key (alias `hdroid`). Losing it means nobody can
  update that app in place. Convention for new apps: `<app>-release.p12`, alias `<app>`,
  password `<APP>_KEY_PASS`.
- On a new machine the keys and `secrets.env` must be restored from the owner's backup before
  anything can be signed or indexed; they are not in git.
- `secrets.env`: passwords (`FDROID_KEY_STORE_PASS`, `FDROID_KEY_PASS`, `SIGNAL_KEY_PASS`),
  loaded by `mise.toml`. `config.yml` references them with `{env: VAR}`.
- `fdroid update --create-key` writes the passwords it generates into `config.yml`;
  move them to `secrets.env` and keep only the `{env: ...}` lines.

## Adding an app

### 0. Decide with the owner first (these change what gets built)

- **Licence**: does it allow distributing this modified build? Copyleft (GPL/AGPL) is fine if
  the source is linked in `SourceCode`; anything restrictive or unclear means stop and ask.
- **Application ID**: forks that keep upstream's ID cannot update over, or be updated by, the
  official build (different signature), so the user must uninstall first and risks data loss.
  Default: give the fork its own ID (here `net.hilson.<app>`), set only on the flavor that is
  distributed. It is permanent after the first release.
- **Signing key**: one key per app, never shared with another app or with the repo index key.
- **ABI**: publish `arm64-v8a` only unless a device needs another one.

### 1. Create the app's signing key (once per app)

    cd <this repo>; set -a; . ./secrets.env; set +a
    PW=$(openssl rand -base64 24); printf '<APP>_KEY_PASS=%s\n' "$PW" >> secrets.env
    export <APP>_KEY_PASS="$PW"
    mise exec -- keytool -genkeypair -keystore <app>-release.p12 -storetype PKCS12 \
      -alias <app> -keyalg RSA -keysize 4096 -validity 36500 -dname "CN=<App> fork" \
      -storepass:env <APP>_KEY_PASS -keypass:env <APP>_KEY_PASS
    chmod 600 <app>-release.p12

`*.p12` and `secrets.env` are git-ignored. Never print passwords. Tell the owner to back both up
outside the repo: the key cannot be recovered and every later update must use it.

### 2. Build and sign the release APK

Build the fork's unsigned release variant (for Android Studio projects usually
`./gradlew assemble<Flavor>Release`; Gradle can need a lot of memory, so bound it).
Then, with `BT=$ANDROID_HOME/build-tools/<newest>`:

    $BT/aapt2 dump badging in.apk | head -1          # check package name and versionCode
    $BT/zipalign -c -P 16 4 in.apk                    # if it fails: zipalign -P 16 -f 4 in.apk aligned.apk
    mise exec -- $BT/apksigner sign --ks <app>-release.p12 --ks-key-alias <app> \
      --ks-pass env:<APP>_KEY_PASS --out repo/<applicationId>_<versionCode>.apk in.apk
    mise exec -- $BT/apksigner verify --print-certs repo/<applicationId>_<versionCode>.apk

An update must keep the same ID and key and have a higher `versionCode`.

### 3. Index and publish

1. `mise exec -- pnpm index` creates `metadata/<applicationId>.yml` on first run.
2. Fill it in: `Name`, `Summary`, `Description`, `License` (SPDX), `SourceCode`, `IssueTracker`,
   `WebSite`, a real `Categories` value, `AutoUpdateMode: None`, `UpdateCheckMode: None`
   (APKs are added by hand; there is no source build here). Icons come from the APK.
3. `mise exec -- pnpm release` regenerates the index, uploads changed files, deploys the Worker.
4. Add a row to the **Apps** table below and commit it, so the next agent sees it.

### 4. Verify from the public URL (do not claim done without this)

    curl -s https://fdroid.hilson.net/repo/index-v2.json | jq '.packages["<applicationId>"].versions | keys'
    curl -s -o .tmp/check.apk https://fdroid.hilson.net/repo/<applicationId>_<versionCode>.apk
    sha256sum .tmp/check.apk repo/<applicationId>_<versionCode>.apk   # identical
    apksigner verify --print-certs .tmp/check.apk                      # shows the app key, not the repo key

Installing and running it on a real device is a separate check the owner must do.

### Updating or removing an app

- Update: repeat steps 2 to 4. `archive_older: 0` keeps every APK in `repo/`; delete superseded
  APKs locally and from R2 if space matters (they stay downloadable until removed).
- Remove: delete the APK and `metadata/<applicationId>.yml`, run `pnpm release`, then
  `wrangler r2 object delete h-droid-repo/repo/<file> --remote`. Installed copies keep working.

### Rules for this repo

- It is public: no secrets, hostnames, personal setup details or incident stories in tracked files.
  Put anything machine-specific in `CLAUDE.local.md` (ignored).
- Never run `fdroid update --create-key` again and never replace `keystore.p12`: devices pin the
  repo's fingerprint and would all have to re-add it.
- `config.yml` should be mode 600 (`chmod 600 config.yml`); fdroid warns otherwise.
- Commit and push only when the owner asks.

## Apps

| Package | Source | Notes |
|---|---|---|
| `net.hilson.signal` | github.com/abumalick/Signal-Android (`github` flavor) | Own application ID and key; arm64-v8a only; v8.32.2 (code 176901). Build: `./gradlew :Signal-Android:assembleGithubProdRelease` (about 11 min, needs a memory bound). Rebuild regularly: Signal servers can reject old clients. |
| `net.hilson.tabgram` | github.com/abumalick/Tabgram (branch `tabgram`, fork of DrKLO/Telegram) | GPL-2.0-only; arm64-v8a only; v13.0.3 (code 71839). Signed at build time with Tabgram's own key (cert SHA-256 `888f1be3…`), kept in the Tabgram checkout, not here: copy the APK as-is, do not re-sign. Build: `./gradlew :TMessagesProj_App:assembleAfatRelease -Pandroid.injected.build.abi=arm64-v8a -Pandroid.injected.testOnly=false` (needs a memory bound; without `testOnly=false` the APK is test-only). Needs the gitignored `unofficial.properties`, `unofficial-signing/tabgram.keystore` and both `google-services.json`; see `UPSTREAM-UPDATE.md` there. |

## Pending

- HeliBoard fork: confirm what the licence allows before publishing it.
- File-manager fork (SSH filesystem support): not added yet.
- Real-device checks for the Signal fork (fresh install, video call, corner persistence).

## Gotchas already hit

- pnpm 11 blocks esbuild/workerd install scripts: `pnpm-workspace.yaml` has `allowBuilds`.
- The Worker must answer 206 only when the request has a `Range` header (R2 reports a range anyway).
- A zero-byte `repo/.gitkeep` makes fdroid fail; `repo/` is simply ignored.
- Ignored by git: `repo/`, `*.p12`, `secrets.env`, `.tmp/`, `node_modules/`, `CLAUDE.local.md`.
