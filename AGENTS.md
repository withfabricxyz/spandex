# Repository Guidelines

## Project Structure & Module Organization
- `packages/core/`: core TypeScript library (entry at `packages/core/index.ts`, logic in `packages/core/lib/`, aggregators in `packages/core/lib/aggregators/`).
- `packages/react/`: React hooks and utilities (entry at `packages/react/index.ts`, helpers in `packages/react/lib/`, tests in `packages/react/test/`).
- `site/`: Vocs-powered documentation site with its own `package.json`.
- `scripts/`: repo tooling like `scripts/build-packages.ts`.
- Build outputs land in each package's `dist/`; coverage reports go to `coverage/`.

## Build, Test, and Development Commands
- `bun install`: install workspace dependencies.
- `bun run build`: build all workspace packages via `scripts/build-packages.ts`.
- `bun ./scripts/build-packages.ts core`: build a single workspace by name/path.
- `bun run pack`: create tarballs for `packages/core` and `packages/react`.
- `bun run lint`: run Biome formatting + lint checks.
- `bun run lint:fix`: apply Biome fixes across the repo.
- `bun test`: run the Bun test runner (uses `bunfig.toml` coverage settings).
- `bun --cwd site run dev`: start the documentation site locally.

## Coding Style & Naming Conventions
- Language: TypeScript with ESM modules.
- Formatting/Linting: Biome (`biome.json`) with 2-space indentation and 100-char lines.
- Naming: camelCase for files/functions (e.g., `getQuote.ts`), PascalCase for types/classes.

## Testing Guidelines
- Test files use the `*.test.ts` suffix alongside the code (mostly in `packages/core/lib/`).
- React tests live in `packages/react/test/` and run with `happy-dom` via `test-setup.ts`.
- Prefer adding tests for new behavior and edge cases; keep tests close to modules.

## Commit & Pull Request Guidelines
- Commit messages are short and descriptive; prefixes like `feat:` or `nit:` are common.
- PRs should include: a concise summary, testing notes (commands run), and links to related issues/PRs.
- For changes that affect docs or APIs, note the impact and update `site/` or package docs as needed.
