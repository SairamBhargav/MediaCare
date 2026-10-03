# Changelog

## Unreleased: Phase 1 in progress

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
