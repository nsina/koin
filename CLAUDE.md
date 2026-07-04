# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
It acts as the primary "Memory" for the agent.

## Project Memory

@llms.txt
@llms-full.txt

## Commands

```bash
pnpm dev        # Start dev server
pnpm build      # Build for production
pnpm lint:fix   # Fix ESLint issues
pnpm format     # Format with Prettier
pnpm typecheck  # TypeScript type checking — run this to verify changes
```

There is no test suite. `pnpm typecheck` is the primary verification step.

## Architecture

Koin is a **Nuxt 4** SPA for expense tracking, tax reporting, and Mercury bank CSV import. All data persists in **SQLite via NuxtHub** — no auth, no external backend.

**Data flow:** Components → composable methods → `$fetch()` → `server/api/` endpoints → Drizzle ORM → NuxtHub SQLite

```
app/
├── pages/index.vue       # Single page, 5 tabs
├── components/           # One component per tab + modals
├── composables/          # All client state (see below)
└── utils/formatters.ts   # Currency, date, CSV helpers

server/
├── api/                  # REST endpoints: expenses, mileage, contractors, recurring, settings, estimated-taxes
└── db/schema.ts          # 6 Drizzle tables; migrations/ alongside
```

## State Management

All client state lives in **module-level `ref()`s inside composables** — no Pinia. Key composables:

- **`useExpenseStore`** — primary store; CRUD for expenses + mileage; `getTaxDefaultsForCategory()`, `getNetDeductible()`, `hasDuplicateExpense()`; computed YTD/category/vendor breakdowns
- **`useMercuryImport`** — parses Mercury CSV; maps categories (22 rules); vendor→category keyword matching (100+ patterns); transfer detection; duplicate flagging before bulk import
- **`useRecurring`** — `processAutoAdd()` auto-creates expenses when `nextDueDate <= today`, runs on app init
- **`useConfirm`** — promise-based confirmation dialog: `confirm(options): Promise<boolean>`

Each composable has `sanitize*()` functions to normalize raw API responses before storing in refs.

## Database

Schema is in `server/db/schema.ts`; migrations in `server/db/migrations/`.

- **Database Dialect**: The database dialect is set in the `nuxt.config.ts` file, within the `hub.db` option or `hub.db.dialect` property.
- **Drizzle Config**: Don't generate the `drizzle.config.ts` file manually, it is generated automatically by NuxtHub.
- **Access the database**: Use the `db` instance from `@nuxthub/db` (or `hub:db` for backwards compatibility) to query the database, it is a Drizzle ORM instance.

### Golden Rules

1. **Schema is the source of truth.** Change `server/db/schema.ts`, never a `.sql` file. The migrations are generated *from* the schema.
2. **Never hand-write or hand-edit migration artifacts.** That means the `.sql` files, `meta/_journal.json`, and `meta/*_snapshot.json` are all generator-owned. Hand-editing them desyncs the Drizzle snapshot chain (a real bug this repo already had to unwind).
3. **Never edit a migration that has been applied anywhere** (your local DB, a teammate's, or production). Applied migrations are immutable history — add a *new* migration for the next change.

### Standard Workflow (any schema change or enhancement)

1. Edit `server/db/schema.ts` (add/modify a table or column).
2. Run `npx nuxt db generate` — creates the next `NNNN_*.sql` **and** its snapshot, and appends to `_journal.json`.
3. Review the generated `.sql` to confirm it matches your intent.
4. Apply it: `npx nuxt dev` (applies on startup) or `npx nuxt db migrate`.
5. Run `pnpm typecheck`, then commit the schema change **and** the generated migration files together in one commit.

### Troubleshooting & Recovery

- **`table/column already exists` on apply** — the DB already has that state under an older migration record (common after consolidating or renaming migrations). Don't drop anything; tell NuxtHub the state is already present:
  `npx nuxt db mark-as-migrated <migration_name>`
- **Consolidating/squashing migrations** — delete the target `.sql` files, remove their `meta/*_snapshot.json`, trim their entries from `meta/_journal.json` back to the last good baseline, then run `npx nuxt db generate` to emit one fresh migration. Do **not** write the squashed SQL by hand. Reset local dev state cleanly with `rm -rf .data/hub/database` (discards local data), or `mark-as-migrated` if the tables already match.
- **Inspect state** — `npx nuxt db migrations list` locally; add `--production` for the remote D1.

### Production (Cloudflare / NuxtHub D1)

- Pending migrations apply **automatically at deploy** (git-integration CI or `npx nuxthub deploy`); each runs once, tracked in the remote `_hub_migrations` table. There is no manual "run the SQL" step.
- **Before deploying a consolidated/renamed migration to a prod DB that already has those tables**, baseline it so it isn't re-run:
  `npx nuxthub database migrations mark-all-applied --production`
- Never paste migration SQL into the D1 console by hand — it desyncs `_hub_migrations` and NuxtHub will try to re-run it on the next deploy.

## Code Style

Prettier: **no semicolons**, single quotes, 100-char line width, no trailing commas, `tailwindcss` plugin sorts classes. ESLint extends `@nuxt/eslint`; `vue/multi-word-component-names` is disabled.

## UI/UX Conventions

Based on [EUI button placement guidelines](https://eui.elastic.co/v101.4.0/docs/components/navigation/buttons/guidelines/). Keep these consistent across all modals and forms.

**Button placement**

- **Modals / flyouts / popovers** (restricted width): actions go **bottom-right**, dismiss on the left, primary on the far right — `flex justify-end gap-2` with `Cancel` first, primary action last.
- **Full-page forms** (unrestricted width): actions go **bottom-left**.
- **Page-header actions** (e.g. a "Create" button tied to the page title): **upper-right**.

**Button hierarchy**

- One primary action per modal/form/section. Primary = `variant="solid"`; secondary/dismiss = `variant="soft"`. This app is monochrome (`color="neutral"`) and expresses hierarchy through variant, not accent color — keep it that way.
- Dismiss buttons are never destructive-colored. Use `color="error"` only for the primary action of a genuinely destructive confirm (see `ConfirmModal`).
- Max ~2 buttons per group; use a dropdown/menu for 3+.

## Commit Style

Follow [Conventional Commits](https://www.conventionalcommits.org):

- `feat:` — new feature
- `fix:` — bug fix
- `docs:` — documentation only
- `chore:` — maintenance, dependency updates, tooling

Examples: `feat: add CSV export`, `fix: correct mileage deduction rounding`
