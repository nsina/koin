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

All notable changes to Koin are documented here.
This project adheres to [Semantic Versioning](https://semver.org).
Older years: _(none yet)_

---

## [Unreleased]

### Changed

- **Clients tab — timeline grouping** — Gantt rows clustered per client (`timelineGroups`, `useClients.ts`): multi-service clients get a header row (name · service count · ending-soon badge), single-service clients stay client-name-first; groups alphabetical to match the client list. Scroll capped (`max-h-128`) with sticky month-axis header (`Client · Service` + 12 columns).

### Fixed

- **Clients tab — timeline one-time bars** — one-time services without an end date rendered as open-ended "Ongoing" projected bars spanning the full window; now collapse to their start-day event, drawn solid (matches `serviceIsCommittedInMonth` + forecast chart) with `min-w-2` so day-width bars stay visible; past events drop off the timeline like other ended services.
- **Clients tab — lapsed commitment chip** — "Committed thru {date}" chip suppressed once no committed span remains in the window (`commitmentSpan > 0` guard); row falls back to "Ongoing", matching the client list's Projected state.
- **Clients tab — timeline bar caps** — bars clamped at the window start render a square left edge (`startsBeforeWindow`), mirroring the square edge + chevron for bars extending past the window; rounded caps no longer imply a start at the window edge.

- **Mercury Import — duplicate detection** — API rows now dedupe on the stable Mercury transaction id (`hasDuplicateExpense` optional 4th arg, `useExpenseStore`); an exact id match is definitive and fuzzy date+vendor+amount only falls back against id-less rows (manual/CSV). Two distinct same-day/same-amount transactions no longer false-flag each other, while manual↔import overlap is still caught. CSV path unchanged (no UUID).
- **Mercury Import — category defaulting** — removed blind `outgoingPayment → Contractors & Freelancers` fallback (`useMercuryImport`); unmatched payments stay `Other / Misc Business` for conscious review instead of mislabeling rent/reimbursements/owner's draws as 100%-deductible contract labor (genuine contractor ACH still caught via `send money`/`gusto`/`deel` keywords + Mercury `Payroll` map).
- **Mercury Import — sync error copy** — surfaces the server's `statusMessage` (`MercuryImportTab`) so an invalid/expired token reads "Invalid Mercury token" instead of the misleading "not configured" hint (was branching on `statusCode === 401`, shared by both cases).

## [1.2.0] - 2026-07-04

### Added

- **Clients tab — Revenue Tracking** — new tab tracking clients, services sold, and forward-looking revenue (`ClientsTab.vue`, `useClients.ts`, `clients` + `client_services` tables via migration `0001_colossal_captain_flint`). Fixed + hourly pricing (`rate × est. monthly hours`), committed-vs-projected 12-month forecast (recurring cadences amortized to a monthly run rate via `monthlyRunRate` — quarterly ÷3, annual ÷12 spread across every active month; one-time fees land as single-month spikes; one shared definition across all KPIs/list/detail), and Gantt-style timeline (single-hue `primary`, solid = committed / diagonal-hatch = projected). Optional per-client `billingCode` for Mercury matching. REST via `/api/clients/*` + `/api/client-services/*` (client delete cascades services). Backup/restore extended to `clients` + `clientServices` (payload `version` 3 → 4; clients restored before services to avoid cascade orphans); factory wipe clears both tables. Per-client list/detail figures route through `clientRevenueSummary` (`useClients.ts`) — same `serviceActiveInMonth`/committed rules as `currentMonthlyRevenue`, so list rows sum to the KPI; returns `monthlyRunRate`, committed/projected split, and `next12Total` (12-month contribution incl. one-time spikes).
- **Clients tab — master-detail scan UX** — searchable (name/contact/code) + status-filterable client list with fixed-height (`h-96`) internal scroll; header badge shows `matched / total`. List rows tuned for scan: leading status dot (`STATUS_DOT`), billing-code chip, active/total service count, monthly run rate (`/mo`) with per-row commitment state (`committedShare` → 🔒 Committed / N% committed / Projected); clients with only one-time or not-yet-started work fall back to `next12Total` (`next 12 mo`). Detail panel: client status + billing-code badges moved into the header, services count into a `Services (N)` section heading; two-tile `UCard variant="soft"` strip (Monthly Run Rate + committed·projected split | per-client 12-Month Forecast) replacing the prior run-rate/services/status tiles, `space-y-6` spacing. Master-detail grid `items-start` so the capped list card no longer stretches to the taller detail card.
- **Clients tab — modal forms** — Add/Edit Client and Add/Edit Service extracted from inline page panels into `ClientFormModal.vue` / `ClientServiceFormModal.vue` (mirrors `ExpenseModal`; self-contained draft/validation/submit via `useClients`). Searchable client picker (`USelectMenu` + `search-input`); hourly pricing shows live monthly-total preview (`rate × est. hours`); Cadence locked to monthly when hourly.
- **Clients tab — Revenue Forecast chart** — 12-month committed-vs-projected stacked `BarChart` (nuxt-charts) replacing the month-card grid; single-hue stack (committed = solid `--ui-primary`, projected = soft `color-mix` tint via `PROJECTED_FILL`), `committedRunway` headline ("Committed through {month} · N of 12 contracted"). Custom hover tooltip (committed/projected/total + active clients) driven by bar-geometry event delegation (`onForecastMove`) — library tooltip disabled (unreliable slot render). Shared `compactCurrency` axis formatter extracted to `app/utils/formatters.ts` (deduped with `DashboardTab`).
- **Dashboard — Monthly Spend** — converted to stacked gradient `AreaChart` (nuxt-charts) splitting deductible vs non-deductible per month (`getNetDeductible`); `MonotoneX` curve, `xExplicitTicks` index→month labels, themed tooltip with totals.
- **Dashboard — Payment Methods** — new YTD donut (spend by `paymentMethod`); donut-on-top, legend below in narrow card.
- **Dashboard — Cumulative Spend** — new YTD running-total `AreaChart` for budget pacing.
- **ChartLegend** — reusable aligned donut legend (`dot · label · amount · %`) via fixed-width grid; used by Top Vendors + Payment Methods (`components/ChartLegend.vue`).
- **Backup/restore** — full backup now covers contractors, recurring templates, and estimated tax payments alongside expenses + mileage (`exportBackup`/`restoreBackup` in `useExpenseStore`); payload `version` 2 → 3. Auxiliary datasets fetched fresh from API on export, restored in place via delete-all-then-insert (`restoreAuxDataset` helper) with post-restore store reload (`useContractors`/`useRecurring`). Legacy v2 files still restore — absent datasets detected and skipped; success toast itemizes restored counts.
- **Estimated taxes API** — `DELETE /api/estimated-taxes/[id]` endpoint (enables restore to clear prior rows); `GET /api/estimated-taxes?year=all` (or no `year`) returns all payments for export, ordered by year then quarter.

### Changed

- **Modals — accidental-dismiss guard** — `:dismissible="false"` on `ExpenseModal`, `RecurringManager`, `ContractorDirectory`, and the new client modals; outside-click / `Esc` no longer discards entered data (X button and Cancel still close).
- **Modal footers** — action buttons right-aligned per EUI dialog guidance (primary bottom-right); `w-full` on the `justify-end` footer flex so it spans Nuxt UI's flex footer slot (was collapsing to content width → left). Standardized across `ExpenseModal` + client modals to match `ConfirmModal` / settings.
- **AppDatePicker** — `clearable` (in-popover Clear action emitting `''`) for optional dates; `block` full-width input-style trigger (trailing chevron, dimmed placeholder) matching sibling `USelect`s in form grids. Applied to service modal (End Date / Commitment), `ExpenseModal`, `RecurringManager` (End Date).
- **Dashboard — Spend by Category** — replaced horizontal `BarChart` (rendered index labels `0,1,2…`) with ranked inline-bar list (name · amount · % of YTD, `bg-primary` bars).
- **Dashboard — Top Vendors** — donut + side-by-side legend (`col-span-3`); built-in legend hidden for custom `ChartLegend` with full labels (`:title` hover fallback, no cropping).
- **Dashboard — chart tooltips/legends** — themed via unovis CSS vars mapped to Nuxt UI tokens (`--vis-tooltip-*`, `--vis-legend-spacing` in `main.css`); single themed card, dark-mode aware.
- **Settings — Data Management** — restore confirm dialog and helper copy state full dataset scope and note receipt files are excluded (`pages/settings.vue`).

### Fixed

- **ExpenseModal** — vendor `UInputMenu` `autocomplete` prop passed bare `true` → `"off"` (string-typed prop; native autofill suppressed in favor of the suggestions menu); cleared a pre-existing `pnpm typecheck` failure.
