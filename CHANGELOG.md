<!--
CHANGELOG RULES
───────────────────────────────────────────────────────────────────────────────
Principles
  - Written for humans, not machines.
  - Every release gets an entry; [Unreleased] collects work not yet versioned.
  - Changes are grouped by type within each version.
  - The latest version comes first.
  - We follow Semantic Versioning (semver.org).

Structure
  ## [Unreleased]
  ## [X.Y.Z] - YYYY-MM-DD

  Under each version, use only the section headings that apply:
    ### Added       — new features
    ### Changed     — changes to existing functionality
    ### Deprecated  — features that will be removed in a future release
    ### Removed     — features removed in this release
    ### Fixed       — bug fixes
    ### Security    — security-related changes

Tone & Style
  - Telegraphic Style: Write in dense, compact engineering fragments. Strip out conversational or narrative filler (e.g., delete phrases like 'now has a', 'lets users easily', 'conditions can be dragged to').
  - Action-First Syntax: Begin the descriptive text immediately with the action or technical mechanism, using a standard schema: **Component** — change description — (technical mechanism/stack details).
  - Parenthetical Stacking: Pack specific tools, hooks, package names, or files into parentheses rather than writing whole sentences to explain where they came from (e.g., use 'via useSortable (@vueuse/integrations)' instead of 'This was implemented using the useSortable hook from the vueuse integrations package').
  - Mechanics over Storytelling: Describe the technical fix for edge cases using precise engineering terms (e.g., 'blocking nested handle event-bubbling' instead of 'to prevent event-bubbling from a sub-group's handles triggering the parent's sortable').

Rules
  1. NEVER duplicate a version section. Add to [Unreleased] until a release is cut.
  2. On release, rename [Unreleased] to [X.Y.Z] - YYYY-MM-DD and open a fresh [Unreleased].
  3. One bullet per logical change; sub-bullets only for non-obvious caveats.
  4. Do not retroactively edit released entries. Append a correction note if needed.
  5. ARCHIVING: When the file grows past ~200 lines of actual content, move
     all entries older than the current calendar year into CHANGELOG-YYYY.md
     and leave a pointer at the bottom of this file.
───────────────────────────────────────────────────────────────────────────────
-->

# Changelog

All notable changes to rampEV are documented here.
This project adheres to [Semantic Versioning](https://semver.org).
Older years: _(none yet)_

---

## [Unreleased]

### Added

- **Clients tab — Revenue Tracking** — new tab tracking clients, services sold, and forward-looking revenue (`ClientsTab.vue`, `useClients.ts`, `clients` + `client_services` tables via migration `0001_colossal_captain_flint`). Fixed + hourly pricing (`rate × est. monthly hours`), committed-vs-projected 12-month forecast (recurring cadences amortized to a monthly run rate via `monthlyRunRate` — quarterly ÷3, annual ÷12 spread across every active month; one-time fees land as single-month spikes; one shared definition across all KPIs/list/detail), and Gantt-style timeline (single-hue `primary`, solid = committed / diagonal-hatch = projected). Optional per-client `billingCode` for Mercury matching. REST via `/api/clients/*` + `/api/client-services/*` (client delete cascades services). Backup/restore extended to `clients` + `clientServices` (payload `version` 3 → 4; clients restored before services to avoid cascade orphans); factory wipe clears both tables.
- **Clients tab — master-detail scan UX** — searchable (name/contact/code) + status-filterable client list with fixed-height (`h-96`) internal scroll, keeping section height stable as the roster grows or filters narrow; header badge shows `matched / total`. Detail metrics (run rate/services/status) consolidated into one `UCard variant="soft"` divided-column panel (filled tile inside outlined card) for consistent hierarchy and no per-client height shift; master-detail grid `items-start` so the capped list card no longer stretches to the taller detail card.
- **Clients tab — Revenue Forecast chart** — 12-month committed-vs-projected stacked `BarChart` (nuxt-charts) replacing the month-card grid; single-hue stack (committed = solid `--ui-primary`, projected = soft `color-mix` tint via `PROJECTED_FILL`), `committedRunway` headline ("Committed through {month} · N of 12 contracted"). Custom hover tooltip (committed/projected/total + active clients) driven by bar-geometry event delegation (`onForecastMove`) — library tooltip disabled (unreliable slot render). Shared `compactCurrency` axis formatter extracted to `app/utils/formatters.ts` (deduped with `DashboardTab`).
- **Dashboard — Monthly Spend** — converted to stacked gradient `AreaChart` (nuxt-charts) splitting deductible vs non-deductible per month (`getNetDeductible`); `MonotoneX` curve, `xExplicitTicks` index→month labels, themed tooltip with totals.
- **Dashboard — Payment Methods** — new YTD donut (spend by `paymentMethod`); donut-on-top, legend below in narrow card.
- **Dashboard — Cumulative Spend** — new YTD running-total `AreaChart` for budget pacing.
- **ChartLegend** — reusable aligned donut legend (`dot · label · amount · %`) via fixed-width grid; used by Top Vendors + Payment Methods (`components/ChartLegend.vue`).
- **Backup/restore** — full backup now covers contractors, recurring templates, and estimated tax payments alongside expenses + mileage (`exportBackup`/`restoreBackup` in `useExpenseStore`); payload `version` 2 → 3. Auxiliary datasets fetched fresh from API on export, restored in place via delete-all-then-insert (`restoreAuxDataset` helper) with post-restore store reload (`useContractors`/`useRecurring`). Legacy v2 files still restore — absent datasets detected and skipped; success toast itemizes restored counts.
- **Estimated taxes API** — `DELETE /api/estimated-taxes/[id]` endpoint (enables restore to clear prior rows); `GET /api/estimated-taxes?year=all` (or no `year`) returns all payments for export, ordered by year then quarter.

### Changed

- **Dashboard — Spend by Category** — replaced horizontal `BarChart` (rendered index labels `0,1,2…`) with ranked inline-bar list (name · amount · % of YTD, `bg-primary` bars).
- **Dashboard — Top Vendors** — donut + side-by-side legend (`col-span-3`); built-in legend hidden for custom `ChartLegend` with full labels (`:title` hover fallback, no cropping).
- **Dashboard — chart tooltips/legends** — themed via unovis CSS vars mapped to Nuxt UI tokens (`--vis-tooltip-*`, `--vis-legend-spacing` in `main.css`); single themed card, dark-mode aware.
- **Settings — Data Management** — restore confirm dialog and helper copy state full dataset scope and note receipt files are excluded (`pages/settings.vue`).

### Fixed

- **ExpenseModal** — vendor `UInputMenu` `autocomplete` prop passed bare `true` → `"off"` (string-typed prop; native autofill suppressed in favor of the suggestions menu); cleared a pre-existing `pnpm typecheck` failure.
