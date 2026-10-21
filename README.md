# h-droid

Personal F-Droid repository, served at https://fdroid.hilson.net/repo.
`fdroidserver` builds the signed index from the APKs in `repo/`. A Cloudflare Worker serves the files from an R2 bucket (Workers static assets cap files at 25 MiB, which APKs exceed).

## Add the repo on a phone

Open this link on the device with F-Droid installed (or scan it as a QR code):

    https://fdroid.hilson.net/repo?fingerprint=e818ba438881b7fbaeda975f6e8e4e5a345eb00c72c4a09a7234b78ffad24b7c

## Publish an app

1. Copy the signed APK into `repo/` (named `<applicationId>_<versionCode>.apk`).
2. `mise exec -- pnpm release`: regenerates the index, uploads changed files to R2, deploys the Worker.

Optionally edit `metadata/<applicationId>.yml` (name, summary, description) after the first `pnpm index`.

## Setup on a new machine

    mise install && uv sync && pnpm install

Needs `keystore.p12` and `secrets.env` (neither is tracked). Back them up outside the repo: losing the repo key means every device must re-add the repository.

## Notes

- Apps signed with your key cannot update over the upstream build, and vice versa. Uninstall once, or give the fork a different `applicationId`.
- `scripts/publish.mjs` only uploads; it never deletes. Removing an APK also requires `wrangler r2 object delete h-droid-repo/repo/<file> --remote`.
