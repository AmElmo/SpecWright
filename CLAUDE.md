# CLAUDE.md

## Project Overview

SpecWright is an AI-powered specification engine for Specification-Driven Development (SDD).
It has a CLI (Node.js/Express) and a Web UI (React/Vite) that share a file-based backend.

## Tech Stack

- **Language**: TypeScript (ES2022, ESM modules)
- **CLI/Server**: Express.js, WebSocket (`ws`), Inquirer
- **Web UI**: React 18, Vite, TailwindCSS, Radix UI
- **State**: File-based (JSON/Markdown in `outputs/`), no database
- **Build**: Babel (CLI) + Vite (UI)

## Development Commands

- `npm run dev` — Run CLI in debug mode
- `npm run dev:ui` — Run Web UI with Vite HMR
- `npm run dev:server` — Run Express server in debug mode
- `npm run build` — Build both CLI and UI
- `npm run type-check` — TypeScript checking (no emit)
- `npm run lint` / `npm run lint:fix` — ESLint
- `npm run format` / `npm run format:check` — Prettier
- No test framework is configured. Do not create test files.

## Critical Rules

### Imports

- Always use `.js` extension in imports for CLI/server code (ESM requirement):
  `import { something } from './other-file.js';`
- Web UI imports do NOT use `.js` extensions (Vite handles resolution)
- Use `@/` alias for web UI internal imports: `import { Button } from '@/components/ui/button'`

### Logging — Never use `console.log()`

```typescript
// CLI/Server
import { logger } from '../utils/logger.js';
// Web UI
import { logger } from '../utils/logger';

logger.debug('dev only');    // Hidden in production
logger.print('user output'); // Always visible
```

### File Operations — Atomic Writes

When writing status/state files, use the temp file + rename pattern:
write to `file.tmp`, then `fs.renameSync('file.tmp', 'file.json')`.

### Styling

- Use TailwindCSS utility classes, not raw CSS
- Use `cn()` from `@/lib/utils` for conditional classes
- Use Radix UI components from `@/components/ui/` for accessible primitives

### React Patterns

- State: `useState` + `useEffect` + Context API. No Redux.
- Modal state: Use `ShipModalProvider` context, not local route state
- Fetch data on mount, use WebSocket for real-time updates

### Path Resolution

Use helpers from `src/utils/project-paths.ts` — never hardcode paths.

## Architecture Notes

### Dual Interface

CLI and Web UI share the same Express server and file-based state.
Changes to API endpoints in `web-server.ts` affect both interfaces.

### Large Files (Handle with care)

- `src/web-server.ts` (~138KB) — All API routes
- `src/web-ui/src/components/Settings.tsx` (~97KB) — Settings UI

### Workflow Phases

PM → Designer → Engineer → Breakdown. Each phase has validation
prerequisites. Check `phase-validation-service.ts` before modifying workflow logic.

### File-Based State

All project state lives in `outputs/`. The `status-service.ts` manages
reads/writes with atomic operations. Never write status files directly.

## Releases & Versioning

Versioning is **fully automated** via `semantic-release` on merge to `main`.
Do NOT manually bump `version` in `package.json`.

### How it works

1. Write commits using **Conventional Commits** format:
   - `feat: ...` → minor version bump (e.g. 3.1.0 → 3.2.0)
   - `fix: ...` → patch version bump (e.g. 3.1.0 → 3.1.1)
   - `feat!: ...` or `BREAKING CHANGE:` footer → major bump
   - `chore:`, `docs:`, `style:`, `test:`, `ci:` → no release
2. Create a PR branch, commit, push, open PR against `main`
3. On merge to `main`, the `publish.yml` workflow:
   - Builds and type-checks
   - Runs `semantic-release` which analyzes commit messages
   - Bumps `package.json`, updates `CHANGELOG.md`
   - Publishes to NPM and creates a GitHub Release
4. Config lives in `.releaserc` and `.github/workflows/publish.yml`

### Branch naming

Use `AmElmo/<descriptive-name>` prefix for feature branches.

## Formatting

- Prettier: single quotes, trailing commas (es5), 100 char width, 2-space indent
- Follow existing patterns in each file
