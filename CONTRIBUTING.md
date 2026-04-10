# Contributing to Koin

Bug fixes, improvements, and feature additions are welcome.

## Before You Start

- **Bug fixes** — open an issue first if the bug isn't already tracked.
- **New features** — open a feature request and wait for a thumbs-up before building. Keeps everyone from wasting time.
- **Typos / docs** — just open a PR.

## Setup

```bash
git clone https://github.com/nsina/koin.git
cd koin
pnpm install
pnpm dev
```

Requires a [NuxtHub](https://hub.nuxt.com) project for the database. Run `npx nuxthub dev` to get a local SQLite instance.

## Development

```bash
pnpm dev          # Start dev server
pnpm lint:fix     # Fix ESLint issues
pnpm format       # Format with Prettier
pnpm typecheck    # TypeScript check — run this before opening a PR
```

There is no test suite. `pnpm typecheck` passing is the bar for correctness.

### Code Style

Koin uses **ESLint + Prettier** for consistency:

- **No semicolons**, single quotes, 100-char line width, no trailing commas
- **Prettier auto-formats** on save in VS Code (configured via `.prettierrc`)
- **ESLint lints** for code quality issues (no auto-fix on save to avoid conflicts)
- **Tailwind CSS** class sorting via `prettier-plugin-tailwindcss`

VS Code settings are pre-configured in `.vscode/settings.json`. Simply opening the project in VS Code will apply formatting automatically on file save.

**Manual formatting:**
```bash
pnpm format       # Format all files with Prettier
pnpm lint:fix     # Fix all ESLint issues
```

## Commit Style

Follow [Conventional Commits](https://www.conventionalcommits.org):

```
feat: add export to CSV
fix: correct mileage deduction rounding
docs: update setup instructions
chore: bump dependencies
```

## Pull Requests

- Keep PRs focused — one concern per PR.
- Run `pnpm typecheck` and `pnpm lint` before pushing.
- Describe *what* changed and *why* in the PR description.
