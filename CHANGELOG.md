# Changelog

## Unreleased: Phase 1 polish, then exact copies

- Home reveal (P1-MOT-001): the Clean screen’s content fades up in at most four groups, 40 ms apart, once per session and only once it’s actually on screen; never under Reduce Motion or Less motion.
- Onboarding (P1-ONB-001..003): a one-screen introduction on first run (sample photos, labelled, settle in under 1.2 s; buttons usable at once), then an explanation of photo access before iOS asks. Every "Scan my library" button now explains first if iOS hasn’t asked yet. The seen flag is stored with preferences; Settings → Help reopens the introduction and the access explanation.
- Photo viewer (P1-LIB-003/004): opens out of the tapped tile and returns to it; pinch, pan and double-tap zoom; drag down or up to close, a Close button, and the VoiceOver escape gesture. Info shows date source, dimensions, size, source and file. Reduce Motion fades instead of flying.
- Library keeps its place (P1-LIB-005): Select mode, the selection and the scroll position survive tab switches and the screen being rebuilt; photos that leave the library drop out of the selection; Clear data resets it.
- Increase Contrast (P1-UI-006): when iOS Increase Contrast is on, the app uses stronger palettes (black or white labels, 7:1 body text, visible separators, near-opaque bars). Tests check they meet every standard pair and never lower one.
- Removed unused template packages expo-glass-effect, expo-device and expo-web-browser (P1-UI-008). Doctor 21/21, iOS bundle exports.

## Unreleased: Phase 2 (real photos) built, awaiting device test

- Fixed from the first device test (iPhone 17): gray thumbnails (asset ids already include ph://), and Compare opening "page could not be found" for real groups (ids with slashes are now escaped).

- Real photo access (full, limited, denied) with Manage selected photos and Open Settings; access rechecked when the app returns to the foreground.
- On-device SQLite catalog (metadata only) filled by a resumable, checkpointed scan that reads no files and downloads nothing; rescans skip unchanged items; interrupted scans are recorded as interrupted.
- Real findings limited to what metadata supports: moments taken within 2 seconds, screenshots, long videos. Favorites are never suggested; no sizes are claimed.
- Library shows your photos (Photos thumbnails at tile size); viewer with date source, dimensions, type, Protect and Make a smaller copy.
- Smaller copies: quality-first or target size with bounded search, measured bytes, decode verification, saved to Photos as a new item, share; copies listed in Studio.
- Settings: photo access, catalog size, Clear MediaCare data (never touches Photos), Diagnostics.
- Diagnostics report for device evidence (library facts, file check, copy check).
- Photo permission explanations for future development builds.

## Phase 1 work

- Preferences (theme, less motion, haptics) persist on device via the synchronous expo-sqlite key-value store; saved theme applies before the first frame; corrupted values fall back to defaults (P1-SET-002).
- Clean home rebuilt around explicit states (not scanned, results, partial, no findings, failed) with a "Could free up to" total that counts each photo once and shows coverage (P1-CLN-001).
- Photo-led category shelf: Similar shots, Exact copies, Possibly blurry, Large files, all labelled Sample.
- New category screen: per-group review with protected keepers, flagged photos with reasons and sizes, and one translucent selection summary across the category.
- Sample library extended with hand-authored findings (3 burst groups, 2 exact-copy sets, 5 soft-focus photos, 4 panoramas).
- Findings domain module with tests; shared ChromeBackground component; Clean state previews in the dev gallery.
- Docs: Windows typed-routes troubleshooting; PRD task-ID formatting fix.
- Job model: a tested state machine where progress only comes from reported events, never moves backwards, and ignores late events after stop (P1-JOB-001).
- Simulated sample scan (clearly labelled "Sample scan" and "Simulated") with pause, resume and stop; stopping keeps honest partial results, counting only findings whose photos were all checked.
- Compact job bar floating above the tab bar, Apple Music mini-player style; expands into a native scan sheet with stages and controls; content insets grow while it shows (P1-JOB-002).
- Review choices (P1-REV-001): Skip a group (collapses with Undo), Protect/Unprotect a photo, "Keep this one instead" to change the keeper, via a touch-and-hold native action sheet or VoiceOver custom actions. Choices persist for the session and clear when results change. Protected photos and skipped groups drop out of every total; keeper changes are reflected.
- Full-screen group review (P1-REV-002/003): swipe through photos with native paging and pinch zoom, or compare side by side with the keeper; thumbnail strip with keeper/protected/marked markers; plain-language differences from the keeper; Mark for review, Keep this one, Protect; Next group slides in and settles. Every gesture has a button alternative.
- Removal plan preview (P1-REV-004): exact photos removed and kept per group, single flagged photos, honest "could free up to", iCloud sync and Recently Deleted warning, notice when marked keepers were left out, and a disabled remove button for sample data. Built by a tested pure planner that never includes keepers (even flagged elsewhere), protected photos or skipped groups, and counts each photo once.
- Library timeline (P1-LIB-001/002): month sections with sticky translucent headers, virtualized by row; capture-local dates that never shift across time zones, with an "Undated" section instead of invented dates; adaptive grid columns for width and very large text.
- Shared ProgressBar (eases between reported values; indeterminate sweep; reduced-motion fallbacks). One success haptic and VoiceOver announcement on completion.

## 0.1.0 — Phase 0 foundation (2026-10-02)

- Expo SDK 57 / React Native 0.86 / TypeScript strict app scaffolded; template demo removed.
- Design tokens (contrast-tested light and dark palettes, type ramp, spacing, radius, shadows) and motion tokens.
- UI primitives: AppText, Button, IconButton, Icon (SF Symbols), PressableScale, Surface, StatusPill, SectionHeader, EmptyState, Screen, TabBar, MediaTile, SelectionBadge.
- Clean, Library and Studio tabs with a translucent custom tab bar; Settings sheet with native `@expo/ui` controls; development-only components and motion gallery.
- Sample "Similar shots" review demonstrating keeper protection, selection motion, haptics and a live summary; virtualized sample library grid with Select mode.
- Domain rules with tests: review selection (keeper/protected never selectable), SI/IEC byte formatting, unique-asset byte sums.
- Jest + Testing Library, ESLint + Prettier, GitHub Actions CI, EAS build profiles (not linked to an account).
- Planning documents: PRD, architecture, stack, capabilities, design system, motion, screens, data model, roadmap, backlog, test plan, Windows setup, privacy and safety, risks, and ADRs 0001–0006.
