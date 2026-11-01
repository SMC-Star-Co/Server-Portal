# Portal 2.0 — Enterprise UI Rebuild

Branch: `feature/enterprise-ui-v1`

This revision replaces the previous appearance rather than layering over it.

Rewritten directly:
- `frontend/assets/css/app.css`: full core interface, RTL layout, login, dashboard, navigation, order tables, operations forms, users, roles, lookups, archive, reports, logs, account, date picker, responsive styles and both themes.
- `frontend/assets/css/invoice-media.css`: complete media manager redesign.
- `frontend/index.html`: rebuilt login, header, sidebar and dashboard, live KPI and status filters while retaining existing functional element IDs.
- `frontend/assets/js/enterprise.js`: visual preferences, dynamic titles, sidebar and keyboard controls.
- `frontend/test/enterprise-ui.test.js`: regression checks.

`frontend/assets/css/enterprise.css` is now an empty migration marker. No old override styles remain.

No database, environment, deployment or production changes. No untested dependency version changes.

## Test-only checkout

```bash
cd /root/portal
git status -sb
git fetch origin
git switch feature/enterprise-ui-v1
git pull --ff-only origin feature/enterprise-ui-v1
```

If branch is not local: `git switch --track origin/feature/enterprise-ui-v1`.

Test UI with the already-installed server or:

```bash
docker run --rm --network none -v "$PWD":/work:ro -w /work node:24-alpine node --test frontend/test/enterprise-ui.test.js
```

Reopen the test portal with Ctrl+F5. Verify light and dark modes, all seven pages, every dialog, serial/media workflows, access permissions, mobile and desktop breakpoints. Do not merge into `develop` without browser and end-to-end testing.
