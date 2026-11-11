# h-droid (retired)

This repository used to build and serve a personal F-Droid repository. It is retired: the Worker,
the R2 bucket and the custom domain are deleted, and the apps are distributed as GitHub releases on
their own repositories, installed with Obtainium (see `README.md`). The GitHub repository is archived.

- Do not run `pnpm index` or `pnpm release`; there is nothing left to deploy to.
- Each app's release steps live in its own repository: abumalick/Signal-Android (`FORK.md`),
  abumalick/Tabgram (`UPSTREAM-UPDATE.md`), abumalick/fossify-calendar (`FORK.md`, release workflow).
- Signing keys are never committed. An app's key must never change, or installed copies cannot update.
