# Screens and flows

Route files live in `src/app/`; bodies in `src/screens/`. "Built" means present in the repo now (sample data only); everything else is planned with its backlog task.

## Route map

```
/ (Stack, root)
├── (tabs)                     Tabs with custom translucent TabBar
│   ├── index      → Clean     Built (P0)
│   ├── library    → Library   Built (P0, sample grid)
│   └── studio     → Studio    Built (P0, honest placeholder)
├── category/[category] → push Built (P1-CLN-001): all findings of one category
├── settings       → modal     Built (P0)
├── gallery        → push      Built (P0, __DEV__ only; redirects home in release)
│
├── onboarding/*               P1-ONB-001..003
├── scan                       P1-JOB-002 (expanded job detail; formSheet)
├── review/[groupId]           P1-REV-002 (full-screen compare for one group)
├── asset/[id]                 P1-LIB-003 (viewer)
├── studio/export/[id]         P2-EXP-*
└── activity                   P3-ACT-001
```

## Global flows

**First launch (P1)**: value intro (one screen, restrained animated media composition) → "Explore with sample photos" or "Continue" → access explainer (what stays on device, why access helps) → system permission prompt only after an intentional tap → Clean home in the right state (full / limited / denied).

**Cleanup (sample in P1, real in P3)**: Clean home → category → group list → group review (keeper + compare + select) → action plan review (exact items, bytes, iCloud warning) → system confirmation → result + Activity entry.

**Export (P2)**: Library → viewer → "Make a copy" → settings (quality-first or size-limit) → preview with real bytes → Save copy → result (format, dimensions, bytes, location).

---

## Clean (`/`) — Built

| Aspect          | Spec                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Purpose         | Scan entry, findings by category, current state of the library                                                                                                                                                                                                                                                                                                                                                                                               |
| Entry / exit    | Tab root. Exits: Settings, category → group review (P1), job bar → scan detail (P1)                                                                                                                                                                                                                                                                                                                                                                          |
| Data            | P0: sample group. P1: sample findings model. P3: catalog findings + scan job                                                                                                                                                                                                                                                                                                                                                                                 |
| States          | **Not scanned** (built), scanning (job bar + partial results), partial results, no findings, failed scan, permission denied, limited access (shows coverage "1,204 of 1,204 selected photos analyzed")                                                                                                                                                                                                                                                       |
| Built now       | **Not scanned**: intro + "Explore sample results". **Results**: "Could free up to X" (each photo counted once) with coverage line and Sample pill; horizontal shelf of photo-led category cards (fanned preview stack on a backdrop tinted from the lead photo) for Similar shots, Exact copies, Possibly blurry, Large files; Reset sample. **Partial**, **no findings**, **failed** states render from the same component (previewable in the dev gallery) |
| Accessibility   | Settings button labelled; tiles are checkboxes (keeper is an image, not a checkbox); summary is a polite live region; Select all/Clear announces result                                                                                                                                                                                                                                                                                                      |
| Motion          | Press feedback; badge spring; overlay fade. Home reveal is P1-MOT-001                                                                                                                                                                                                                                                                                                                                                                                        |
| Acceptance (P0) | Keeper can never be selected; summary counts and bytes match the selection; all labels say "Sample"; works in both themes and at largest Dynamic Type without clipping                                                                                                                                                                                                                                                                                       |

## Category (`/category/[category]`) — Built (sample)

| Aspect       | Spec                                                                                                                                                                                                                                                                                                                                       |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Purpose      | Review every finding in one category                                                                                                                                                                                                                                                                                                       |
| Entry / exit | Category card on Clean → native push with large title; back swipe                                                                                                                                                                                                                                                                          |
| Built now    | Sample pill + plain-language description; group categories show each group with keeper ("Keep" badge, never a checkbox), reason, Select all/Clear; item categories show each flagged photo with its reason and size; one translucent summary bar ("N selected · X (sample sizes)") across all groups, stating nothing is removed from here |
| States       | Results; "Nothing here yet" if opened without results; unknown category redirects home                                                                                                                                                                                                                                                     |
| Acceptance   | Selections across groups add up once; keepers never selectable; flagged photos show why                                                                                                                                                                                                                                                    |

## Library (`/library`) — Built (sample)

| Aspect     | Spec                                                                                                                                                                                           |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Purpose    | Chronological browsing, selection, entry to viewer                                                                                                                                             |
| Data       | P0: 88 synthetic sample assets. P2: paginated MediaLibrary Query mirrored into SQLite                                                                                                          |
| States     | Loading (skeleton tiles, no spinner flash), empty, limited ("Manage selected photos"), denied (explain + Open Settings), offline/iCloud placeholders                                           |
| Built now  | Virtualized 3-column edge-to-edge grid (`FlatList`, fixed item layout), Select mode with per-tile checkbox semantics and count                                                                 |
| Next       | Month/day section headers + sticky date (P1-LIB-001), adaptive columns for width/text size (P1-LIB-002), viewer (P1-LIB-003), date search (P2-LIB-002), stable scroll restoration (P1-LIB-005) |
| Acceptance | Never loads full-resolution images for the grid; selection survives scrolling; 44-pt targets; VoiceOver reads date and selection                                                               |

## Studio (`/studio`) — Built (placeholder)

Shows one honest empty state: tools need photo access, originals never change. No unbuilt tools appear in navigation (product rule). P2 replaces it with photo-led entry points for Crop/Resize/Compress.

## Settings (`/settings`, modal) — Built

Native grouped Form via `@expo/ui`: Appearance (System/Light/Dark menu), Motion & Feedback (Less motion, Haptics, explanatory footer), Privacy statement, Developer (gallery link, dev only), About (version, SDK). Preferences persist across launches (P1-SET-002). Next: cache size and clearing (P2), photo access status + "Manage selected photos" (P2), processing policy (P5).

Acceptance: Appearance change applies app-wide including native chrome; Less motion never overrides system Reduce Motion; Done and swipe-down both dismiss.

## Component & Motion gallery (`/gallery`) — Built, dev only

Typography, color tokens, buttons in all states, pills, selection badge retargeting, selectable tiles, empty/error states. Used for both-theme and Dynamic Type checks. Release builds redirect to `/`.

## Planned screens (summary)

| Screen                  | Task       | Key states                                                                             | Notes                                                              |
| ----------------------- | ---------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Onboarding (3 steps)    | P1-ONB-*   | first run, returning                                                                   | Permission prompt only after explicit action                       |
| Scan detail / job sheet | P1-JOB-*   | queued, running (count + known/indeterminate total), paused, interrupted, done, failed | Progress only from job events, never timers                        |
| Group review            | P1-REV-*   | keeper, compare (side-by-side + swipe), full-res inspect, protect, skip                | Swipe changes a choice, never deletes                              |
| Action plan review      | P3-DEL-001 | scope, bytes, iCloud warning, protected excluded                                       | Precedes the system dialog                                         |
| Viewer                  | P1-LIB-003 | pinch/pan/double-tap, info (date provenance, dimensions, source, availability)         | Button alternatives for every gesture                              |
| Export                  | P2-EXP-*   | quality-first, size-limit, not achievable                                              | Real bytes after encode, not estimates                             |
| Activity                | P3-ACT-*   | analyzed, exported, system-deleted, cancelled, failed, partial                         | Recovery copy points to Photos → Recently Deleted; no fake restore |
