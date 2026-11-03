# Repository workflow

- For each new coding task, inspect git status and preserve existing work. Use the existing checkout; do not create worktrees unless explicitly requested.
- Create a named feature/fix branch from current origin/main before editing. Never develop directly on main.
- Keep one release focused on the requested scope. Update package.json, data.js VERSION, index.html title, README and CHANGELOG together when releasing.
- Run npm ci, npm test, npm run test:e2e and git diff --check. Locally CHROMIUM_PATH=/usr/bin/chromium can select the installed browser. Use isolated browser contexts, never real sales data.
- Merge only within user authorization, using --no-ff to retain branch boundaries. Add an annotated version tag and push branch/main/tag without force. Preserve branches for review.
- App is static-hostable under a subdirectory: use relative module/asset URLs. Preserve the littlecup-pos-v1 storage key and existing sales data through validated migrations.
- Product/brand images stay in browser storage; no authentication or server-side sync exists. Do not describe admin screens as access controlled.
- Explain changes, validation, migration effects and deployment limitations in the release report. A successful Git push is not proof of a successful GitHub Pages deployment.
