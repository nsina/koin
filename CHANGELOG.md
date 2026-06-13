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

- **Backup/restore** — full backup now covers contractors, recurring templates, and estimated tax payments alongside expenses + mileage (`exportBackup`/`restoreBackup` in `useExpenseStore`); payload `version` 2 → 3. Auxiliary datasets fetched fresh from API on export, restored in place via delete-all-then-insert (`restoreAuxDataset` helper) with post-restore store reload (`useContractors`/`useRecurring`). Legacy v2 files still restore — absent datasets detected and skipped; success toast itemizes restored counts.
- **Estimated taxes API** — `DELETE /api/estimated-taxes/[id]` endpoint (enables restore to clear prior rows); `GET /api/estimated-taxes?year=all` (or no `year`) returns all payments for export, ordered by year then quarter.

### Changed

- **Settings — Data Management** — restore confirm dialog and helper copy state full dataset scope and note receipt files are excluded (`pages/settings.vue`).

### Fixed

- **ExpenseModal** — vendor `UInputMenu` `autocomplete` prop passed bare `true` → `"off"` (string-typed prop; native autofill suppressed in favor of the suggestions menu); cleared a pre-existing `pnpm typecheck` failure.
