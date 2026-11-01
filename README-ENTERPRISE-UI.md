# SSP ATLAS — Workstation UI, version 3

This is an experimental visual rewrite on branch `feature/enterprise-ui-v1`, based on the last approved `develop` checkpoint. It **overwrites the previous Enterprise UI experiment**. Neither `develop`, `main`, the saved snapshot nor production has been changed.

## What is different from the previous attempt?

- The application is no longer presented as a top header plus a row of generic dashboard cards. It has a fixed right-side operational rail, a separate workspace canvas, a compact command/search header and a split live workload surface.
- The worklist is now a dense operations pipeline with status filtering and hierarchy for each group.
- All six additional application modules get dedicated work-area headings; their data grids, forms, report analytics, role matrix and records are independently styled.
- Upload/serial media uses a separate side-panel document-vault layout. Drag-and-drop was removed; native file picker and queue remain.
- Dialogs, management operations, account controls, calendar, detail panels and light/dark palettes have been redesigned directly in their stylesheets.
- Dashboard completion percentage is calculated from existing live `statCompleted` and `statTotal` values, without a new API.

### Main rewritten files

`frontend/index.html`, `frontend/assets/css/app.css`, `frontend/assets/css/invoice-media.css`, `frontend/assets/js/enterprise.js`, `frontend/assets/icons/lucide-icons.js`, `frontend/test/enterprise-ui.test.js`.

`frontend/assets/js/app.js` only changes the chart color sequence. Invoice behavior, access rules, SQL, media storage, backend endpoints and data semantics remain unchanged.

## Test server installation (smc-server only)

First confirm the local working tree has no important uncommitted changes:

```bash
cd /root/portal
git status -sb
git fetch origin
git switch feature/enterprise-ui-v1
git pull --ff-only origin feature/enterprise-ui-v1
```

For first checkout, use `git switch --track origin/feature/enterprise-ui-v1` instead. Refresh the browser with **Ctrl+F5**. No database change, file deletion or backend rebuild is required for this visual revision.

## Automated test

```bash
docker run --rm --network none -v "$PWD":/work:ro -w /work node:24-alpine node --test frontend/test/enterprise-ui.test.js
docker exec node_app node --test test/invoice-media.test.js
```

The first command requires a local `node:24-alpine` image when running with `--network none`. Otherwise run `node --test frontend/test/enterprise-ui.test.js` if Node is installed on the test host.

## Mandatory browser acceptance

Verify the page in light **and** dark mode with browser widths around 1600, 1280, 900, 740 and 390 px. Validate: login/logout, user permissions, invoice search, status counts/filters, grouped order tables, invoice create/edit, technical notes, serial manager, media upload/view/download/replace, archive, analytics drill-down, activity logs, lookup editing, user roles, calendar and account settings.

Static source inspection and JavaScript syntax checks were performed in the GitHub working environment. **Real screenshot review, browser automation and Docker integration tests have not yet been performed**. Do not merge the branch into `develop` or production until acceptance testing passes.
